/**
 * tse-direto.js — Carregamento direto dos dados do TSE via CORS
 *
 * Fluxo:
 *   1. Usuário seleciona Ano → UF → Cargo (→ Município se Vereador)
 *   2. Verifica cache IndexedDB; se ausente, baixa o ZIP do cdn.tse.jus.br
 *   3. Descomprime com JSZip, decodifica ISO-8859-1, parseia CSV
 *   4. Cacheia TODAS as combinações UF×cargo do ano de uma vez
 *   5. Chama window.ImportTSE.injetarDados() para preencher o formulário
 *
 * CORS: cdn.tse.jus.br retorna Access-Control-Allow-Origin: *
 * Cache: IndexedDB "tse-direto-v1" — persiste entre sessões, sem expiração
 *         (dados eleitorais não mudam após publicação)
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════
     CONFIGURAÇÃO
  ═══════════════════════════════════════════════════════════════════ */

  const CDN_DIRETO = ano =>
    `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_${ano}.zip`;

  // CDN do TSE retorna header CORS duplicado ("*, *") que browsers rejeitam.
  // Usamos proxy apenas para este fetch — o resto do app não passa por proxy.
  const PROXIES = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  // Apenas anos juridicamente relevantes para retotalização (ADIs 7.228/7.263/7.325)
  const ANOS = [
    { ano: '2022', label: '2022 — Eleições Gerais',      tipo: 'gerais',     sizeMB: 25 },
    { ano: '2024', label: '2024 — Eleições Municipais',  tipo: 'municipais', sizeMB: 6  },
  ];

  // 2022: só Federal (todas as UFs) e Distrital (apenas DF)
  // 2024: só Vereador (todas as UFs)
  const CARGOS_TIPO = {
    gerais:     ['Deputado Federal', 'Deputado Distrital'],
    municipais: ['Vereador'],
  };

  // Deputado Distrital só existe no DF — bloqueio feito na UI
  const CARGO_SOMENTE_DF = new Set(['Deputado Distrital']);

  const UFS = [
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
  ];

  // TSE CSV usa maiúsculas; Deputado Estadual ignorado (não relevante para ADIs)
  const CARGO_MAP = {
    'DEPUTADO FEDERAL':   'Deputado Federal',
    'DEPUTADO DISTRITAL': 'Deputado Distrital',
    'VEREADOR':           'Vereador',
    // 'DEPUTADO ESTADUAL' ausente → _normCargo retorna null → linha ignorada
  };

  /* ═══════════════════════════════════════════════════════════════════
     INDEXEDDB
  ═══════════════════════════════════════════════════════════════════ */

  const IDB_NAME  = 'tse-direto-v1';
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
     DOWNLOAD + UNZIP + PARSE
  ═══════════════════════════════════════════════════════════════════ */

  function _splitLinha(linha) {
    return linha.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
  }

  function _normCargo(s) {
    return CARGO_MAP[(s || '').trim().toUpperCase()] || null;
  }

  function _encontrarCol(header, opcoes) {
    for (const o of opcoes) if (header.includes(o)) return o;
    return opcoes[opcoes.length - 1];
  }

  /**
   * Parseia o CSV completo e retorna Map keyed "ano:uf:cargo"
   * com { partidos, municipios, munPartidos }.
   */
  function _parsearCSV(text, ano) {
    const linhas = text.split(/\r?\n/);
    if (linhas.length < 2) throw new Error('Arquivo CSV vazio ou inválido.');

    const header = _splitLinha(linhas[0]);
    const cNom = _encontrarCol(header, ['QT_VOTOS_NOMINAIS_VALIDOS', 'QT_VOTOS_NOMINAIS']);
    const cLeg = _encontrarCol(header, ['QT_TOTAL_VOTOS_LEG_VALIDOS', 'QT_VOTOS_LEGENDA_VALIDOS', 'QT_VOTOS_LEGENDA']);

    const idx = {};
    for (const c of ['DS_CARGO', 'SG_UF', 'NM_MUNICIPIO', 'SG_PARTIDO', 'NM_PARTIDO', cNom, cLeg]) {
      idx[c] = header.indexOf(c);
    }

    if (idx['DS_CARGO'] === -1 || idx['SG_UF'] === -1) {
      throw new Error('Colunas DS_CARGO ou SG_UF não encontradas. Verifique o arquivo.');
    }

    // Map: "ano:uf:cargo" → { estado: {sigla→p}, muns: {mun→{sigla→p}} }
    const agrupado = new Map();

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha.trim()) continue;

      const cols  = _splitLinha(linha);
      if (cols.length < 5) continue;

      const cargo = _normCargo(cols[idx['DS_CARGO']] || '');
      if (!cargo) continue; // ignora Presidente, Governador, Senador, etc.

      const uf    = (cols[idx['SG_UF']]      || '').trim();
      const mun   = idx['NM_MUNICIPIO'] >= 0 ? (cols[idx['NM_MUNICIPIO']] || '').trim() : '';
      const sigla = (cols[idx['SG_PARTIDO']] || '').trim();
      const nome  = (cols[idx['NM_PARTIDO']] || '').trim();
      if (!uf || !sigla) continue;

      const nominais = parseInt(cols[idx[cNom]], 10) || 0;
      const legenda  = parseInt(cols[idx[cLeg]], 10) || 0;

      const chave = `${ano}:${uf}:${cargo}`;
      if (!agrupado.has(chave)) agrupado.set(chave, { estado: {}, muns: {} });
      const g = agrupado.get(chave);

      if (!g.estado[sigla]) g.estado[sigla] = { sigla, nome, nominais: 0, legenda: 0 };
      g.estado[sigla].nominais += nominais;
      g.estado[sigla].legenda  += legenda;

      if (cargo === 'Vereador' && mun) {
        if (!g.muns[mun]) g.muns[mun] = {};
        if (!g.muns[mun][sigla]) g.muns[mun][sigla] = { sigla, nome, nominais: 0, legenda: 0 };
        g.muns[mun][sigla].nominais += nominais;
        g.muns[mun][sigla].legenda  += legenda;
      }
    }

    return agrupado;
  }

  async function _baixarECacharAno(ano, onProgress) {
    const cfg = ANOS.find(a => a.ano === ano) || { sizeMB: '?' };

    // 1. Download via proxy (CDN do TSE envia header CORS duplicado "*, *")
    onProgress(0, `Conectando ao servidor do TSE…`);

    const urlOrigem = CDN_DIRETO(ano);
    let resp = null;
    let proxyUsado = '';
    for (let i = 0; i < PROXIES.length; i++) {
      const urlProxy = PROXIES[i](urlOrigem);
      try {
        console.log(`[TSE Direto] tentando proxy ${i + 1}:`, urlProxy);
        resp = await fetch(urlProxy);
        if (resp.ok) { proxyUsado = urlProxy; break; }
        console.warn(`[TSE Direto] proxy ${i + 1} retornou HTTP ${resp.status}`);
      } catch (e) {
        console.warn(`[TSE Direto] proxy ${i + 1} falhou:`, e.message);
      }
      resp = null;
    }
    if (!resp) {
      throw new Error('Não foi possível baixar os dados do TSE. Verifique sua conexão e tente novamente.');
    }
    console.log(`[TSE Direto] download via proxy: ${proxyUsado}`);

    const total   = parseInt(resp.headers.get('Content-Length') || '0', 10);
    const reader  = resp.body.getReader();
    const chunks  = [];
    let   received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) {
        onProgress(
          (received / total) * 0.55,
          `Baixando… ${(received / 1048576).toFixed(1)} / ${cfg.sizeMB} MB`
        );
      }
    }

    const raw = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { raw.set(c, off); off += c.length; }

    // 2. Unzip
    onProgress(0.55, 'Descomprimindo ZIP…');
    if (!window.JSZip) throw new Error('JSZip não encontrado. Verifique os scripts do app.');

    const zip = await window.JSZip.loadAsync(raw.buffer);

    // Encontra o CSV de partidos (ignora LEIAME, README, etc.)
    const entradas = Object.values(zip.files);
    const csvEntry = entradas.find(f =>
      !f.dir && f.name.toLowerCase().includes('partido') && f.name.endsWith('.csv')
    ) || entradas.find(f => !f.dir && f.name.endsWith('.csv'));

    if (!csvEntry) throw new Error('CSV de partidos não encontrado dentro do ZIP.');

    // 3. Decodifica ISO-8859-1
    onProgress(0.65, 'Extraindo e decodificando CSV…');
    const ab   = await csvEntry.async('arraybuffer');
    const text = new TextDecoder('iso-8859-1').decode(ab);

    // 4. Parseia
    onProgress(0.75, 'Processando dados (pode demorar alguns segundos)…');
    const agrupado = _parsearCSV(text, ano);

    // 5. Cacheia tudo
    onProgress(0.90, 'Salvando no cache local…');
    const promises = [];
    for (const [chave, dados] of agrupado) {
      const partidos  = Object.values(dados.estado)
        .sort((a, b) => (b.nominais + b.legenda) - (a.nominais + a.legenda));
      const municipios = Object.keys(dados.muns).sort();
      const munPartidos = {};
      for (const [m, ps] of Object.entries(dados.muns)) {
        munPartidos[m] = Object.values(ps)
          .sort((a, b) => (b.nominais + b.legenda) - (a.nominais + a.legenda));
      }
      promises.push(_cachePut(chave, { partidos, municipios, munPartidos }));
    }
    // Marca que o ano foi processado
    promises.push(_cachePut(`${ano}:_ok`, { ts: Date.now(), qtd: agrupado.size }));
    await Promise.all(promises);

    onProgress(1, 'Pronto!');
  }

  async function _obterDados(ano, uf, cargo, onProgress) {
    const chave = `${ano}:${uf}:${cargo}`;
    let dados = await _cacheGet(chave);
    if (!dados) {
      await _baixarECacharAno(ano, onProgress);
      dados = await _cacheGet(chave);
    }
    if (!dados) {
      throw new Error(`Nenhum dado encontrado para ${cargo} · ${uf} · ${ano}.`);
    }
    return dados;
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
    const lista = CARGOS_TIPO[tipo] || [];
    sel.innerHTML = '<option value="">— Selecionar cargo —</option>' +
      lista.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.disabled = false;
  }

  function _popularMunicipios(muns) {
    const sel  = $('tse-municipio');
    const wrap = $('tse-mun-wrap');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecionar município —</option>' +
      muns.map(m => `<option value="${m}">${m}</option>`).join('');
    if (wrap) wrap.style.display = muns.length ? '' : 'none';
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

    window.ImportTSE.injetarDados(partidos, null, {
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

    const btnCarr = $('btn-tse-carregar');
    if (btnCarr) btnCarr.disabled = true;

    try {
      const cfg = ANOS.find(a => a.ano === ano) || {};
      const dados = await _obterDados(ano, uf, cargo, (pct, msg) => {
        const cachado = pct === 0 && msg.includes('Conectando');
        _setStatus(
          `<span class="import-spinner"></span> ${msg}` +
          (pct < 0.56 && cfg.sizeMB ? ` <span style="opacity:.7">(~${cfg.sizeMB} MB · cache local após esta vez)</span>` : '') +
          `<br><span style="font-family:monospace;letter-spacing:1px;font-size:11px">${_barra(pct)} ${Math.round(pct * 100)}%</span>`,
          'progresso'
        );
      });

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
        const wrap = $('tse-mun-wrap');
        if (wrap) wrap.style.display = 'none';
        _atualizarBotao();
      });
    }

    const btnCarr = $('btn-tse-carregar');
    if (btnCarr) btnCarr.addEventListener('click', _aoClicarCarregar);

    const selMun = $('tse-municipio');
    if (selMun) selMun.addEventListener('change', _aoMudarMunicipio);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
