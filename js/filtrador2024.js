/**
 * filtrador2024.js — Pré-filtro para arquivos nacionais TSE 2024 (cargo Vereador)
 *
 * O TSE 2024 distribui um único arquivo nacional em vez de arquivos por UF.
 * Este módulo adiciona um painel de pré-filtro que aparece somente quando
 * o cargo "Vereador" é selecionado.
 *
 * Fluxo:
 *   1. Cargo muda para "Vereador"  → painel aparece
 *   2. Upload do ZIP/CSV nacional  → scan automático popula select de UF
 *   3. Selecionar UF               → select de Município é populado
 *   4. Selecionar Município        → botão "Filtrar" é liberado
 *   5. Clicar "Filtrar e injetar"  → CSVs filtrados são injetados nos inputs
 *                                    originais (file-partido / file-candidato)
 *   6. Clicar "▶ Processar"        → fluxo normal do import.js
 *
 * IDs esperados em app.html (confirmados em import.js v3):
 *   filter-cargo, filter-uf, file-partido, file-candidato,
 *   btn-toggle-import, import-body
 *
 * Dependências CDN (devem vir ANTES deste script em app.html):
 *   JSZip  3.10.1 — window.JSZip
 *   PapaParse 5.4.1 — não usado diretamente; mantido para compatibilidade
 */
(function () {
  'use strict';

  /* ─── Normalização de município (ignora maiúsculas, acentos, espaços) ───── */
  function normMun(s) {
    return (s || '')
      .replace(/^"|"$/g, '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  /* ─── Utilitário DOM ────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  /* ─── Estado interno ────────────────────────────────────────────────────── */
  let dadosPartido   = null;  // { headerLinha, linhas, iUF, iMun }
  let dadosCandidato = null;
  let ufSel          = '';
  let munSel         = '';

  /* ─── Colunas de município (2024 usa NM_UE como fallback) ──────────────── */
  const COLUNAS_MUN = ['NM_MUNICIPIO', 'NM_UE'];

  /* ═══════════════════════════════════════════════════════════════════════════
     CSS DO PAINEL (injetado uma única vez)
  ═══════════════════════════════════════════════════════════════════════════ */
  function injetarCSS() {
    if ($('f24-css')) return;
    const s = document.createElement('style');
    s.id = 'f24-css';
    s.textContent = `
      #f24-painel {
        border: 1px solid #2d5a8e;
        border-radius: 6px;
        margin-bottom: 10px;
        background: #162d45;
        color: #cce0f5;
        font-size: 13px;
        font-family: inherit;
      }
      #f24-painel[hidden] { display: none; }
      .f24-header {
        padding: 8px 12px;
        background: #1e4270;
        border-radius: 5px 5px 0 0;
        font-weight: 600;
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      .f24-header small { font-weight: 400; font-size: 11px; opacity: .75; }
      .f24-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
      .f24-row { display: flex; flex-direction: column; gap: 4px; }
      .f24-row label { font-size: 11px; opacity: .8; }
      .f24-row select, .f24-row input[type=file] {
        width: 100%; box-sizing: border-box;
        background: #0d1f31; color: #cce0f5; border: 1px solid #2d5a8e;
        border-radius: 4px; padding: 5px 8px; font-size: 12px;
      }
      .f24-link { font-size: 11px; color: #7ab8f5; text-decoration: none; }
      .f24-link:hover { text-decoration: underline; }
      #f24-status {
        padding: 6px 10px; border-radius: 4px; font-size: 12px;
        background: #0d1f31;
      }
      #f24-status.ok   { color: #7fdb8a; }
      #f24-status.err  { color: #ff8a8a; }
      #f24-status.info { color: #7ab8f5; }
      #f24-btn-filtrar {
        padding: 8px 14px; border-radius: 4px; border: none;
        background: #1e6fc7; color: #fff; cursor: pointer;
        font-size: 13px; font-family: inherit; font-weight: 600;
        transition: background .15s;
      }
      #f24-btn-filtrar:disabled { opacity: .4; cursor: not-allowed; }
      #f24-btn-filtrar:not(:disabled):hover { background: #2581e0; }
      .f24-downloads { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
      .f24-downloads a { font-size: 12px; color: #7ab8f5; }
    `;
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     HTML DO PAINEL
  ═══════════════════════════════════════════════════════════════════════════ */
  function criarPainel() {
    const div = document.createElement('div');
    div.id = 'f24-painel';
    div.hidden = true;
    div.innerHTML = `
      <div class="f24-header">
        📦 Filtrador TSE 2024 — Vereador
        <small>arquivo nacional → filtrar por município antes de processar</small>
      </div>
      <div class="f24-body">

        <div class="f24-row">
          <label>F1 — Votos por partido (ZIP ou CSV)</label>
          <input type="file" id="f24-partido" accept=".zip,.csv">
          <a class="f24-link" target="_blank"
            href="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_2024.zip">
            ↓ Baixar arquivo TSE (~80 MB)
          </a>
        </div>

        <div class="f24-row">
          <label>F2 — Candidatos (ZIP ou CSV — opcional)</label>
          <input type="file" id="f24-candidato" accept=".zip,.csv">
          <a class="f24-link" target="_blank"
            href="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip">
            ↓ Baixar arquivo TSE (~230 MB)
          </a>
        </div>

        <div id="f24-status" class="info" style="display:none"></div>

        <div id="f24-selects" style="display:none">
          <div class="f24-row">
            <label>UF</label>
            <select id="f24-uf"><option value="">— selecione a UF —</option></select>
          </div>
          <div class="f24-row" id="f24-mun-wrap" style="display:none">
            <label>Município</label>
            <select id="f24-municipio"><option value="">— selecione o município —</option></select>
          </div>
        </div>

        <div>
          <button id="f24-btn-filtrar" disabled>⚡ Filtrar e injetar nos campos abaixo</button>
          <div id="f24-downloads" class="f24-downloads" style="display:none"></div>
        </div>

      </div>
    `;
    return div;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     UTILITÁRIOS DE IO
  ═══════════════════════════════════════════════════════════════════════════ */

  function setStatus(msg, tipo) {
    const el = $('f24-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.textContent = msg;
    el.className = tipo || 'info';
    el.style.display = 'block';
  }

  /** Lê File (ZIP ou CSV) e retorna Uint8Array dos bytes brutos. */
  async function lerBytes(file) {
    const buf = await file.arrayBuffer();
    if (file.name.toLowerCase().endsWith('.zip')) {
      if (!window.JSZip) throw new Error('JSZip não carregado. Verifique os scripts CDN em app.html.');
      const zip  = await JSZip.loadAsync(buf);
      const csvs = Object.values(zip.files)
        .filter(f => !f.dir && f.name.toLowerCase().endsWith('.csv'))
        .sort((a, b) => (b._data?.uncompressedSize || 0) - (a._data?.uncompressedSize || 0));
      if (!csvs.length) throw new Error('Nenhum arquivo .csv encontrado dentro do ZIP.');
      return await csvs[0].async('uint8array');
    }
    return new Uint8Array(buf);
  }

  /** Decodifica bytes ISO-8859-1 → string JS. */
  const decodificar = bytes => new TextDecoder('iso-8859-1').decode(bytes);

  /** Re-encoda string JS → Uint8Array ISO-8859-1 (preserva bytes originais). */
  function encodificar(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
    return out;
  }

  /** Retorna o índice da primeira coluna encontrada no array header. */
  function detectarIdx(header, candidatos) {
    for (const c of candidatos) {
      const i = header.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     SCAN — lê arquivo, detecta UFs e prepara linhas em memória
  ═══════════════════════════════════════════════════════════════════════════ */
  async function scan(bytes) {
    const text  = decodificar(bytes);
    const todas = text.split(/\r?\n/);

    if (todas.length < 2) throw new Error('Arquivo vazio ou sem linhas de dados.');

    const headerArr = todas[0].split(';').map(c => c.replace(/^"|"$/g, '').trim());
    const iUF = headerArr.indexOf('SG_UF');
    if (iUF === -1) throw new Error('Coluna SG_UF não encontrada. Verifique se é o arquivo correto do TSE 2024.');

    const iMun = detectarIdx(headerArr, COLUNAS_MUN);

    const linhas = [];
    const ufs    = new Set();

    for (let i = 1; i < todas.length; i++) {
      const l = todas[i];
      if (!l.trim()) continue;
      linhas.push(l);
      const cols = l.split(';');
      if (iUF < cols.length) ufs.add(cols[iUF].replace(/^"|"$/g, '').trim());
    }

    return { headerLinha: todas[0], linhas, iUF, iMun, ufs: [...ufs].sort() };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     FILTRAR — retorna string CSV com header + linhas filtradas
  ═══════════════════════════════════════════════════════════════════════════ */
  function filtrar(dados, uf, municipio) {
    const { headerLinha, linhas, iUF, iMun } = dados;
    const filtradas = linhas.filter(l => {
      const cols = l.split(';');
      const ufOk = iUF < cols.length &&
                   cols[iUF].replace(/^"|"$/g, '').trim() === uf;
      if (!ufOk) return false;
      if (municipio && iMun !== -1) {
        return iMun < cols.length &&
               normMun(cols[iMun]) === normMun(municipio);
      }
      return true;
    });
    return headerLinha + '\n' + filtradas.join('\n');
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INJEÇÃO — cria File e atribui ao input via DataTransfer
  ═══════════════════════════════════════════════════════════════════════════ */
  function injetar(inputId, bytes, nome) {
    const inp = $(inputId);
    if (!inp) return false;
    try {
      const file = new File([bytes], nome, { type: 'text/plain' });
      const dt   = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  function criarLinkDownload(bytes, nome) {
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([bytes], { type: 'text/plain' }));
    a.download = nome;
    a.textContent = '↓ ' + nome;
    return a;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     POPULAR SELECTS
  ═══════════════════════════════════════════════════════════════════════════ */
  function popularUF(ufs) {
    const sel = $('f24-uf');
    if (!sel) return;
    sel.innerHTML = '<option value="">— selecione a UF —</option>';
    ufs.forEach(uf => {
      const o = document.createElement('option');
      o.value = o.textContent = uf;
      sel.appendChild(o);
    });
  }

  function popularMunicipio(uf) {
    if (!dadosPartido) return;
    const { linhas, iUF, iMun } = dadosPartido;
    const municipios = new Set();
    linhas.forEach(l => {
      const cols = l.split(';');
      if (iUF < cols.length && cols[iUF].replace(/^"|"$/g,'').trim() === uf &&
          iMun !== -1 && iMun < cols.length) {
        municipios.add(normMun(cols[iMun]));
      }
    });
    const sel = $('f24-municipio');
    if (!sel) return;
    sel.innerHTML = '<option value="">— selecione o município —</option>';
    [...municipios].sort().forEach(m => {
      const o = document.createElement('option');
      o.value = o.textContent = m;
      sel.appendChild(o);
    });
    const wrap = $('f24-mun-wrap');
    if (wrap) wrap.style.display = municipios.size ? 'block' : 'none';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     HANDLERS DE EVENTOS
  ═══════════════════════════════════════════════════════════════════════════ */

  async function onPartidoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    dadosPartido = null;
    ufSel = munSel = '';
    atualizarBotao();
    $('f24-selects').style.display = 'none';
    setStatus('Descomprimindo… pode levar alguns segundos.', 'info');
    try {
      const bytes = await lerBytes(file);
      dadosPartido = await scan(bytes);
      popularUF(dadosPartido.ufs);
      $('f24-selects').style.display = 'block';
      setStatus(`✓ ${dadosPartido.ufs.length} UFs detectadas. Selecione UF e Município.`, 'ok');
    } catch (err) {
      setStatus('❌ ' + err.message, 'err');
    }
  }

  async function onCandidatoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    dadosCandidato = null;
    // Scan silencioso em background
    try {
      const bytes = await lerBytes(file);
      dadosCandidato = await scan(bytes);
    } catch {
      dadosCandidato = null;
    }
  }

  function onUFChange(e) {
    ufSel = e.target.value;
    munSel = '';
    if ($('f24-municipio')) $('f24-municipio').value = '';
    if (ufSel) popularMunicipio(ufSel);
    else {
      const wrap = $('f24-mun-wrap');
      if (wrap) wrap.style.display = 'none';
    }
    atualizarBotao();
  }

  function onMunicipioChange(e) {
    munSel = e.target.value;
    atualizarBotao();
  }

  function atualizarBotao() {
    const btn = $('f24-btn-filtrar');
    if (btn) btn.disabled = !(dadosPartido && ufSel && munSel);
  }

  async function onFiltrar() {
    if (!dadosPartido || !ufSel || !munSel) return;
    const btn = $('f24-btn-filtrar');
    if (btn) btn.disabled = true;
    setStatus('Filtrando…', 'info');

    const dl = $('f24-downloads');
    dl.innerHTML = '';
    dl.style.display = 'none';

    try {
      /* ── Partido ── */
      const csvP  = filtrar(dadosPartido, ufSel, munSel);
      const bytP  = encodificar(csvP);
      const nomeP = `votacao_partido_munzona_2024_${ufSel}_${munSel.replace(/\s+/g,'_')}.csv`;
      const okP   = injetar('file-partido', bytP, nomeP);
      if (!okP) { dl.appendChild(criarLinkDownload(bytP, nomeP)); dl.style.display = 'flex'; }

      /* ── Candidato (se disponível) ── */
      if (dadosCandidato) {
        const csvC  = filtrar(dadosCandidato, ufSel, munSel);
        const bytC  = encodificar(csvC);
        const nomeC = `votacao_candidato_munzona_2024_${ufSel}_${munSel.replace(/\s+/g,'_')}.csv`;
        const okC   = injetar('file-candidato', bytC, nomeC);
        if (!okC) { dl.appendChild(criarLinkDownload(bytC, nomeC)); dl.style.display = 'flex'; }
      }

      /* ── Contar linhas filtradas ── */
      const nLinhas = csvP.split('\n').filter(l => l.trim()).length - 1;

      setStatus(
        `✅ ${nLinhas} linhas filtradas para ${munSel} / ${ufSel}. ` +
        (okP ? 'Clique em ▶ Processar e preencher campos abaixo.' :
               'Baixe os arquivos acima e importe manualmente.'),
        'ok'
      );

      /* ── Expandir painel original de importação ── */
      const importBody = $('import-body');
      const btnToggle  = $('btn-toggle-import');
      if (importBody && importBody.style.display === 'none') {
        importBody.style.display = 'block';
        if (btnToggle) btnToggle.setAttribute('aria-expanded', 'true');
      }

    } catch (err) {
      setStatus('❌ ' + err.message, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     VISIBILIDADE DO PAINEL
  ═══════════════════════════════════════════════════════════════════════════ */
  function atualizarVisibilidade() {
    const painel = $('f24-painel');
    const cargo  = $('filter-cargo');
    if (!painel || !cargo) return;
    painel.hidden = (cargo.value !== 'Vereador');
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INSERÇÃO DO PAINEL NO DOM
  ═══════════════════════════════════════════════════════════════════════════ */
  function inserirPainel() {
    if ($('f24-painel')) return;
    injetarCSS();
    const painel = criarPainel();

    // Inserir imediatamente antes do botão de toggle do painel de importação
    const ancora = $('btn-toggle-import') || $('import-body');
    if (ancora && ancora.parentNode) {
      ancora.parentNode.insertBefore(painel, ancora);
    } else {
      // Fallback: primeiro filho do body
      document.body.insertBefore(painel, document.body.firstChild);
    }

    // Eventos internos do painel
    $('f24-partido').addEventListener('change',   onPartidoChange);
    $('f24-candidato').addEventListener('change', onCandidatoChange);
    $('f24-uf').addEventListener('change',        onUFChange);
    $('f24-municipio').addEventListener('change', onMunicipioChange);
    $('f24-btn-filtrar').addEventListener('click', onFiltrar);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════════════ */
  function init() {
    const cargo = $('filter-cargo');
    if (!cargo) return; // import.js ainda não carregou o DOM

    inserirPainel();
    cargo.addEventListener('change', atualizarVisibilidade);
    atualizarVisibilidade();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
