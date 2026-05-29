/**
 * tse-direto.js — Carregamento de dados do TSE via JSONs pré-processados
 *
 * Fluxo:
 *   1. Usuário seleciona Ano → UF → Cargo (→ Município se Vereador)
 *   2. Verifica cache IndexedDB; se ausente, faz fetch do JSON local em data/tse/
 *   3. Cacheia no IDB para uso offline subsequente
 *   4. Chama window.ImportTSE.injetarDados() para preencher o formulário
 *
 * JSONs pré-processados: data/tse/{ano}_{UF}_{cargo}.json
 *   Gerados por: node scripts/processar-tse.js <ano> <UF> <cargo>
 *   Tamanho típico: < 5 KB por estado/cargo (vs. 25 MB do ZIP original)
 *
 * Cache: IndexedDB "tse-direto-v2" — persiste entre sessões, sem expiração
 *         (dados eleitorais não mudam após publicação)
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════
     CONFIGURAÇÃO
  ═══════════════════════════════════════════════════════════════════ */

  // Slug de cargo → nome canônico (espelha o script processar-tse.js)
  const CARGO_SLUG = {
    'Deputado Federal':   'federal',
    'Deputado Distrital': 'distrital',
    'Deputado Estadual':  'estadual',
    'Vereador':           'vereador',
  };

  const urlJSON = (ano, uf, cargo, cdMun) =>
    cdMun
      ? `data/tse/${ano}_${uf}_${cdMun}_${CARGO_SLUG[cargo] || cargo}.json`
      : `data/tse/${ano}_${uf}_${CARGO_SLUG[cargo] || cargo}.json`;

  // ── Supabase (Vereador 2024) ───────────────────────────────────────────────
  const SB_URL = 'https://wntdwtccekurhzlbnjpw.supabase.co/rest/v1';
  const SB_KEY = 'sb_publishable_HNDS6k_B01BJKpgbyvf74Q_xu7Fy1o-';

  async function _sbGet(tabela, params) {
    const resp = await fetch(`${SB_URL}/${tabela}?${params}`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    if (!resp.ok) throw new Error(`Supabase ${tabela}: HTTP ${resp.status}`);
    return resp.json();
  }

  // Apenas anos juridicamente relevantes para retotalização (ADIs 7.228/7.263/7.325)
  const ANOS = [
    { ano: '2022', label: '2022 — Eleições Gerais',     tipo: 'gerais'     },
    { ano: '2024', label: '2024 — Eleições Municipais', tipo: 'municipais' },
  ];

  // 2022: Federal (todas as UFs), Estadual (todas exceto DF) e Distrital (apenas DF)
  // 2024: só Vereador (todas as UFs)
  const CARGOS_TIPO = {
    gerais:     ['Deputado Federal', 'Deputado Estadual', 'Deputado Distrital'],
    municipais: ['Vereador'],
  };

  // Deputado Distrital só existe no DF — bloqueio feito na UI
  const CARGO_SOMENTE_DF = new Set(['Deputado Distrital']);

  const UFS = [
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
  ];

  // Vagas por cargo e UF — Deputado Federal: TSE Res. 23.669/2021 (513 cadeiras)
  // Deputado Estadual: CF art. 27 (federal≤12 → 3×fed; federal>12 → 36+(fed−12))
  // Deputado Distrital: CLDF, 24 cadeiras
  // Vereador: omitido (varia por município — não auto-preenche)
  const VAGAS = {
    'Deputado Federal': {
      AC:  8, AL:  9, AM:  8, AP:  8, BA: 39, CE: 22, DF:  8,
      ES: 10, GO: 17, MA: 18, MG: 53, MS:  8, MT:  8, PA: 17,
      PB: 12, PE: 25, PI: 10, PR: 30, RJ: 46, RN:  8, RO:  8,
      RR:  8, RS: 31, SC: 16, SE:  8, SP: 70, TO:  8,
    },
    'Deputado Estadual': {
      AC: 24, AL: 27, AM: 24, AP: 24, BA: 63, CE: 46,
      ES: 30, GO: 41, MA: 42, MG: 77, MS: 24, MT: 24, PA: 41,
      PB: 36, PE: 49, PI: 30, PR: 54, RJ: 70, RN: 24, RO: 24,
      RR: 24, RS: 55, SC: 40, SE: 24, SP: 94, TO: 24,
    },
    'Deputado Distrital': { DF: 24 },
  };

  /* ═══════════════════════════════════════════════════════════════════
     INDEXEDDB
  ═══════════════════════════════════════════════════════════════════ */

  const IDB_NAME  = 'tse-direto-v2';
  const IDB_STORE = 'dados';
  let   _idb      = null;

  function _abrirDB() {
    if (_idb) return Promise.resolve(_idb);
    return new Promise((res, rej) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, { keyPath: 'k' });
      req.onsuccess  = e => { _idb = e.target.result; res(_idb); };
      req.onerror    = e => rej(e.target.error);
    });
  }

  async function _cacheGet(k) {
    const db = await _abrirDB();
    return new Promise((res, rej) => {
      const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(k);
      r.onsuccess = e => res(e.target.result ? e.target.result.v : null);
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function _cachePut(k, v) {
    const db = await _abrirDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ k, v });
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     FETCH JSON PRÉ-PROCESSADO
  ═══════════════════════════════════════════════════════════════════ */

  async function _processarJSON(json, chave, onProgress) {
    onProgress(0.6, 'Processando…');
    const partidos = json.partidos.map(p => ({
      sigla: p.sigla, nome: p.nome,
      nominais: p.votosNominais, legenda: p.votosLegenda,
      candidatos: p.candidatos || [],
    }));
    const municipios  = json.municipios || [];
    const munPartidos = {};
    if (json.dadosMun) {
      for (const [mun, ps] of Object.entries(json.dadosMun)) {
        munPartidos[mun] = ps.map(p => ({
          sigla: p.sigla, nome: p.nome,
          nominais: p.votosNominais, legenda: p.votosLegenda,
        }));
      }
    }
    await _cachePut(chave, { partidos, municipios, munPartidos });
    console.log(`[TSE Direto] ${partidos.length} partidos processados e cacheados`);
    onProgress(1, 'Pronto!');
  }

  async function _obterDados(ano, uf, cargo, onProgress, cdMun) {
    const url = urlJSON(ano, uf, cargo, cdMun);
    onProgress(0, 'Verificando versão dos dados…');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(
      `Dados não disponíveis para ${cargo} · ${uf} · ${ano}. ` +
      `Arquivo ${url} não encontrado (HTTP ${resp.status}). ` +
      `Use o modo CSV Manual ou aguarde a geração do arquivo.`
    );

    const json = await resp.json();
    const gerado = (json.meta && json.meta.gerado) || '';
    const chave = `v3:${ano}:${uf}:${cargo}:${gerado}`;

    const dados = await _cacheGet(chave);
    if (dados) {
      console.log(`[TSE Direto] cache válido (${gerado || 'sem versão'}): ${chave}`);
      onProgress(1, 'Dados carregados do cache local.');
      return dados;
    }

    console.log(`[TSE Direto] versão nova ou sem cache (${gerado}): ${chave}`);
    await _processarJSON(json, chave, onProgress);
    const resultado = await _cacheGet(chave);
    if (!resultado) throw new Error(`Nenhum dado encontrado para ${cargo} · ${uf} · ${ano}.`);
    return resultado;
  }

  /* ═══════════════════════════════════════════════════════════════════
     UI
  ═══════════════════════════════════════════════════════════════════ */

  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('pt-BR').format(Math.round(n));

  function _setStatus(html, tipo) {
    const el = $('tse-direto-status');
    if (!el) return;
    el.className = 'import-status ' + (tipo || 'info');
    el.innerHTML = html;
  }

  let _dadosMuns = {};           // { mun → Partido[] }
  let _anoCorrente  = '';
  let _ufCorrente   = '';
  let _cargoCorrente = '';

  function _popularUFs() {
    const sel = $('tse-uf');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecionar UF —</option>' +
      UFS.map(uf => `<option value="${uf}">${uf}</option>`).join('');
    sel.disabled = false;
  }

  function _popularCargos(tipo) {
    const sel = $('tse-cargo');
    if (!sel) return;
    const uf  = ($('tse-uf') || {}).value;
    const lista = (CARGOS_TIPO[tipo] || []).filter(c => {
      if (c === 'Deputado Distrital') return uf === 'DF';
      if (c === 'Deputado Estadual')  return uf !== 'DF';
      return true;
    });
    sel.innerHTML = '<option value="">— Selecionar cargo —</option>' +
      lista.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.disabled = false;
  }

  function _popularMunicipios(muns) {
    // mantida para compatibilidade com fluxo de JSON local (vereador não-2024)
    const wrap = $('tse-mun-wrap');
    if (wrap) wrap.style.display = muns.length ? '' : 'none';
  }

  // ── Busca de município via Supabase ────────────────────────────────────────
  let _buscaTimer = null;

  function _mostrarBuscaMunicipio() {
    const wrap = $('tse-mun-wrap');
    const cdmunWrap = $('tse-cdmun-wrap');
    if (wrap) wrap.style.display = '';
    if (cdmunWrap) cdmunWrap.style.display = 'none';
    const input = $('tse-municipio-busca');
    if (input) { input.value = ''; input.focus(); }
    const cd = $('tse-municipio-cd');
    const nm = $('tse-municipio');
    if (cd) cd.value = '';
    if (nm) nm.value = '';
  }

  async function _buscarMunicipios(uf, texto) {
    if (texto.length < 2) { _fecharLista(); return; }
    const q = encodeURIComponent(texto.toUpperCase());
    const rows = await _sbGet('municipios_2024',
      `uf=eq.${uf}&nm_municipio=ilike.*${q}*&order=nm_municipio&limit=10&select=cd_municipio,nm_municipio`
    );
    _renderizarLista(rows);
  }

  function _renderizarLista(rows) {
    const lista = $('tse-municipio-lista');
    if (!lista) return;
    if (!rows.length) {
      lista.innerHTML = '<li style="padding:8px 12px;font-size:13px;color:#8BA3C7;font-style:italic">Nenhum município encontrado</li>';
      lista.style.display = '';
      return;
    }
    lista.innerHTML = rows.map(r =>
      `<li data-cd="${r.cd_municipio}" data-nm="${r.nm_municipio}"
          style="padding:8px 12px;cursor:pointer;font-size:13px;color:#C8D9EF;
                 border-bottom:1px solid rgba(255,255,255,.06)"
          onmouseover="this.style.background='rgba(255,255,255,.08)'"
          onmouseout="this.style.background=''">${r.nm_municipio}</li>`
    ).join('');
    lista.style.display = '';
  }

  function _fecharLista() {
    const lista = $('tse-municipio-lista');
    if (lista) lista.style.display = 'none';
  }

  async function _carregarMunicipio(cd, nm, uf) {
    _fecharLista();
    const input = $('tse-municipio-busca');
    if (input) input.value = nm;
    const hdCd = $('tse-municipio-cd');
    const hdNm = $('tse-municipio');
    if (hdCd) hdCd.value = cd;
    if (hdNm) hdNm.value = nm;

    _setStatus('<span class="import-spinner"></span> Carregando dados do município…', 'progresso');
    const btnCarr = $('btn-tse-carregar');
    if (btnCarr) btnCarr.disabled = true;

    try {
      const [rowsMun, rowsPart, rowsCand] = await Promise.all([
        _sbGet('municipios_2024', `cd_municipio=eq.${cd}&select=vagas`),
        _sbGet('partidos_2024',   `cd_municipio=eq.${cd}&order=votos_nominais.desc`),
        _sbGet('candidatos_2024', `cd_municipio=eq.${cd}&order=votos.desc`),
      ]);

      // Preenche vagas automaticamente
      const vagas = rowsMun[0] && rowsMun[0].vagas;
      if (vagas) {
        const elVagas = $('input-vagas');
        if (elVagas) elVagas.value = vagas;
      }

      // Reconstrói estrutura igual ao JSON local
      const candPorBloco = {};
      for (const c of rowsCand) {
        (candPorBloco[c.bloco] = candPorBloco[c.bloco] || []).push(
          { nome: c.nome, votos: c.votos, partido: c.partido }
        );
      }

      const partidos = rowsPart.map(p => ({
        sigla:        p.sigla,
        nome:         p.nome,
        nominais:     p.votos_nominais,
        legenda:      p.votos_legenda,
        candidatos:   candPorBloco[p.sigla] || [],
        ...(p.partidos_fed ? { partidos: p.partidos_fed } : {}),
      }));

      _injetarNoFormulario(partidos, uf, 'Vereador', '2024', nm);
    } catch (err) {
      console.error('[TSE Direto Supabase]', err);
      _setStatus(`❌ ${err.message}`, 'erro');
    } finally {
      if (btnCarr) btnCarr.disabled = false;
    }
  }

  function _atualizarBotao() {
    const btn = $('btn-tse-carregar');
    if (!btn) return;
    const ano   = ($('tse-ano')   || {}).value;
    const uf    = ($('tse-uf')    || {}).value;
    const cargo = ($('tse-cargo') || {}).value;
    btn.disabled = !(ano && uf && cargo);
  }

  function _barra(pct) {
    const n = Math.round(pct * 20);
    return '█'.repeat(n) + '░'.repeat(20 - n);
  }

  function _injetarNoFormulario(partidos, uf, cargo, ano, municipio) {
    if (!window.ImportTSE || !window.ImportTSE.injetarDados) {
      _setStatus('❌ ImportTSE.injetarDados não disponível — verifique import.js.', 'erro');
      return;
    }

    const totalVotos  = partidos.reduce((s, p) => s + p.nominais + p.legenda, 0);
    const timestamp   = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    const ufLabel     = municipio ? `${uf} · ${municipio}` : uf;

    const candPorSigla = {};
    for (const p of partidos) {
      if (p.candidatos?.length) candPorSigla[p.sigla] = p.candidatos;
    }

    window.ImportTSE.injetarDados(partidos, candPorSigla, {
      arquivo:    `TSE direto · ${ano}`,
      partidos:   partidos.length,
      totalVotos,
      cargo,
      uf:         ufLabel,
      timestamp,
    });

    // Auto-preenche rótulo se estiver vazio
    const rotulo = $('input-rotulo');
    if (rotulo && !rotulo.value.trim()) {
      rotulo.value = `${cargo} · ${ufLabel} · ${ano}`;
    }

    // Auto-preenche vagas conforme tabela oficial (sobrescreve sempre ao carregar)
    const vagasOficiais = (VAGAS[cargo] || {})[uf];
    if (vagasOficiais) {
      const elVagas = $('input-vagas');
      if (elVagas) elVagas.value = vagasOficiais;
    }

    const munLabel = municipio ? ` · ${municipio}` : '';
    _setStatus(
      `✅ <strong>${partidos.length} partidos carregados</strong> · ` +
      `${fmt(totalVotos)} votos · ${cargo} · ${uf}${munLabel} · ${ano}`,
      'ok'
    );

    // Recolhe o painel de importação
    const body = $('import-body');
    if (body) body.style.display = 'none';
    const btn = $('btn-toggle-import');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  async function _aoClicarCarregar() {
    const ano   = ($('tse-ano')   || {}).value;
    const uf    = ($('tse-uf')    || {}).value;
    const cargo = ($('tse-cargo') || {}).value;
    if (!ano || !uf || !cargo) return;

    _anoCorrente   = ano;
    _ufCorrente    = uf;
    _cargoCorrente = cargo;

    // Vereador 2024 → busca por nome via Supabase
    if (cargo === 'Vereador' && ano === '2024') {
      _mostrarBuscaMunicipio();
      _setStatus('🔍 Digite o nome do município para buscar.', 'info');
      return;
    }

    const btnCarr = $('btn-tse-carregar');
    if (btnCarr) btnCarr.disabled = true;

    try {
      const cdMun = ($('tse-cdmun') || {}).value || undefined;
      const dados = await _obterDados(ano, uf, cargo, (pct, msg) => {
        _setStatus(
          `<span class="import-spinner"></span> ${msg}` +
          `<br><span style="font-family:monospace;letter-spacing:1px;font-size:11px">${_barra(pct)} ${Math.round(pct * 100)}%</span>`,
          'progresso'
        );
      }, cdMun);

      _dadosMuns = dados.munPartidos || {};

      if (cargo === 'Vereador' && dados.municipios && dados.municipios.length > 0) {
        _popularMunicipios(dados.municipios);
        _setStatus(
          `✅ ${dados.municipios.length} municípios disponíveis · ${dados.partidos.length} partidos · ` +
          `<strong>Selecione um município para preencher os campos.</strong>`,
          'ok'
        );
      } else {
        _injetarNoFormulario(dados.partidos, uf, cargo, ano, null);
      }

    } catch (err) {
      console.error('[TSE Direto]', err);
      _setStatus(`❌ ${err.message}`, 'erro');
    } finally {
      if (btnCarr) btnCarr.disabled = false;
    }
  }

  function _aoMudarMunicipio() {
    const sel = $('tse-municipio');
    const mun = sel ? sel.value : '';
    if (!mun || !_anoCorrente) return;

    const partidos = _dadosMuns[mun];
    if (!partidos || !partidos.length) {
      _setStatus(`⚠ Nenhum dado encontrado para ${mun}.`, 'aviso');
      return;
    }
    _injetarNoFormulario(partidos, _ufCorrente, _cargoCorrente, _anoCorrente, mun);
  }

  function _injetarCSS() {
    if (document.getElementById('tse-direto-css')) return;
    const s = document.createElement('style');
    s.id = 'tse-direto-css';
    s.textContent = `
      .import-modo-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,.1);
        padding-bottom: 8px;
      }
      .import-modo-tab {
        flex: 1;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 6px 6px 0 0;
        color: #8BA3C7;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 10px;
        cursor: pointer;
        transition: background .15s, color .15s;
      }
      .import-modo-tab:hover {
        background: rgba(255,255,255,.1);
        color: #C8D9EF;
      }
      .import-modo-tab--active {
        background: rgba(59,130,246,.18);
        border-color: rgba(59,130,246,.4);
        color: #93C5FD;
      }
      #import-panel-auto .import-filter-field { margin-bottom: 8px; }
      .tse-nota-cand {
        font-size: 11px;
        color: #6B88AB;
        margin-top: 10px;
        line-height: 1.4;
        border-left: 2px solid rgba(255,255,255,.1);
        padding-left: 8px;
      }
    `;
    document.head.appendChild(s);
  }

  function init() {
    _injetarCSS();

    // ── Tabs Automático / Manual ─────────────────────────────────────
    document.querySelectorAll('.import-modo-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const modo = btn.dataset.modo;
        document.querySelectorAll('.import-modo-tab').forEach(b =>
          b.classList.toggle('import-modo-tab--active', b.dataset.modo === modo)
        );
        const panelAuto   = $('import-panel-auto');
        const panelManual = $('import-panel-manual');
        if (panelAuto)   panelAuto.style.display   = modo === 'auto'   ? '' : 'none';
        if (panelManual) panelManual.style.display  = modo === 'manual' ? '' : 'none';
      });
    });

    // ── Cascata Ano → UF → Cargo ─────────────────────────────────────
    const selAno = $('tse-ano');
    if (selAno) {
      selAno.addEventListener('change', () => {
        const ano = selAno.value;
        // Reset UF e cargo
        const selUF = $('tse-uf');
        if (selUF) {
          selUF.innerHTML = '<option value="">— Selecionar UF —</option>';
          selUF.disabled = !ano;
        }
        const selCargo = $('tse-cargo');
        if (selCargo) {
          selCargo.innerHTML = '<option value="">— Selecionar —</option>';
          selCargo.disabled = true;
        }
        const wrap = $('tse-mun-wrap');
        if (wrap) wrap.style.display = 'none';
        if (ano) _popularUFs();
        _atualizarBotao();
      });
    }

    const selUF = $('tse-uf');
    if (selUF) {
      selUF.addEventListener('change', () => {
        const ano = ($('tse-ano') || {}).value;
        if (!ano || !selUF.value) { _atualizarBotao(); return; }
        const cfg = ANOS.find(a => a.ano === ano);
        if (cfg) _popularCargos(cfg.tipo);
        const wrap = $('tse-mun-wrap');
        if (wrap) wrap.style.display = 'none';
        _atualizarBotao();
      });
    }

    const selCargo = $('tse-cargo');
    if (selCargo) {
      selCargo.addEventListener('change', () => {
        const cargo = selCargo.value;
        const selUF = $('tse-uf');
        if (CARGO_SOMENTE_DF.has(cargo)) {
          // Deputado Distrital só existe no DF — trava seleção automaticamente
          if (selUF) { selUF.value = 'DF'; selUF.disabled = true; }
        } else {
          // Desbloqueia UF se estava travada por Deputado Distrital
          if (selUF && selUF.disabled) selUF.disabled = false;
        }
        const ano = ($('tse-ano') || {}).value;
        const vereador2024 = cargo === 'Vereador' && ano === '2024';
        const wrap = $('tse-mun-wrap');
        const wrapCd = $('tse-cdmun-wrap');
        const inputCd = $('tse-cdmun');
        if (vereador2024) {
          // Supabase: mostra busca por nome, esconde campo de código
          if (wrap) wrap.style.display = '';
          if (wrapCd) wrapCd.style.display = 'none';
          if (inputCd) inputCd.value = '';
          const inputBusca = $('tse-municipio-busca');
          if (inputBusca) { inputBusca.value = ''; inputBusca.focus(); }
          const hdCd = $('tse-municipio-cd');
          const hdNm = $('tse-municipio');
          if (hdCd) hdCd.value = '';
          if (hdNm) hdNm.value = '';
        } else {
          if (wrap) wrap.style.display = 'none';
          if (wrapCd) wrapCd.style.display = cargo === 'Vereador' ? '' : 'none';
          if (inputCd) inputCd.value = '';
        }
        _atualizarBotao();

        // Pré-preenche vagas ao selecionar cargo (UF já está definida)
        const ufAtual = ($('tse-uf') || {}).value;
        const vagasPrev = (VAGAS[cargo] || {})[ufAtual];
        const elVagasPrev = $('input-vagas');
        if (vagasPrev && elVagasPrev) elVagasPrev.value = vagasPrev;
      });
    }

    const btnCarr = $('btn-tse-carregar');
    if (btnCarr) btnCarr.addEventListener('click', _aoClicarCarregar);

    const selMun = $('tse-municipio');
    if (selMun) selMun.addEventListener('change', _aoMudarMunicipio);

    // ── Busca de município (Supabase) ──────────────────────────────────
    const inputBusca = $('tse-municipio-busca');
    if (inputBusca) {
      inputBusca.addEventListener('input', () => {
        clearTimeout(_buscaTimer);
        const uf   = ($('tse-uf') || {}).value;
        const txt  = inputBusca.value.trim();
        _buscaTimer = setTimeout(() => _buscarMunicipios(uf, txt), 280);
      });
      inputBusca.addEventListener('blur', () => {
        setTimeout(_fecharLista, 200);
      });
    }

    const lista = $('tse-municipio-lista');
    if (lista) {
      lista.addEventListener('mousedown', e => {
        const li = e.target.closest('li');
        if (!li) return;
        const uf = ($('tse-uf') || {}).value;
        _carregarMunicipio(li.dataset.cd, li.dataset.nm, uf);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
