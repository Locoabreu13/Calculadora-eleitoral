/**
 * import.js — Módulo de importação de CSV oficial do TSE.
 *
 * Parsing: ISO-8859-1 via ArrayBuffer + TextDecoder (sem FileReader, sem libs externas).
 * Arquivos > 100 MB: aviso + continua com processamento (arquivo completo na memória).
 * Compatível com Safari/iOS.
 *
 * Depende de: ui.js (window._UI.adicionarPartido exposto por ui.js)
 */
(function () {
'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const AVISO_MB  = 50;   // MB — mostrar aviso de arquivo grande
const LIMITE_MB = 500;  // MB — recusar (improvável com os CSVs do TSE)

/**
 * Normaliza DS_CARGO do TSE (maiúsculas) para o label do select (title case).
 * O TSE usa: "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL", "DEPUTADO DISTRITAL", "VEREADOR".
 * "Deputado Estadual" no select cobre tanto DEPUTADO ESTADUAL quanto DEPUTADO DISTRITAL.
 */
const CARGO_MAP = {
  'DEPUTADO FEDERAL':   'Deputado Federal',
  'DEPUTADO ESTADUAL':  'Deputado Estadual',
  'DEPUTADO DISTRITAL': 'Deputado Estadual',
  'VEREADOR':           'Vereador',
};

function encontrarNomeColuna(header, candidatos) {
  for (const nome of candidatos) {
    if (header.includes(nome)) return nome;
  }
  return candidatos[candidatos.length - 1];
}

function normalizarCargo(cargoCSV) {
  const upper = (cargoCSV || '').trim().toUpperCase();
  return CARGO_MAP[upper] || cargoCSV.trim();
}

let filtroAtivo = { cargo: 'Deputado Federal', uf: '', municipio: '' };
let fonteDados  = null;    // { arquivo, partidos, totalVotos, cargo, uf, timestamp }

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS DOM
// ═══════════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

function setStatus(html, tipo) {
  const box = $('import-status');
  if (!box) return;
  box.className = 'import-status ' + (tipo || 'info');
  box.innerHTML = html;
}

function clearStatus() {
  const box = $('import-status');
  if (box) { box.className = 'import-status'; box.innerHTML = ''; }
}

function fmt(n) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n));
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEITURA DO ARQUIVO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lê um File como texto ISO-8859-1.
 * Retorna { text, bytes } ou lança erro.
 */
async function lerArquivo(file) {
  const sizeMB = file.size / (1024 * 1024);

  // Rejeitar ZIP
  if (file.name.toLowerCase().endsWith('.zip')) {
    throw new Error(
      'Arquivos .zip ainda não são suportados. ' +
      'Descompacte o arquivo e importe o .csv diretamente.'
    );
  }

  if (sizeMB > LIMITE_MB) {
    throw new Error(
      `Arquivo muito grande (${sizeMB.toFixed(0)} MB). ` +
      `Use o arquivo por UF disponível no Portal TSE.`
    );
  }

  if (sizeMB > AVISO_MB) {
    setStatus(
      `⚠ Arquivo grande (${sizeMB.toFixed(1)} MB) — processando, aguarde…`,
      'progresso'
    );
  }

  const buffer  = await file.arrayBuffer();
  const decoder = new TextDecoder('iso-8859-1');
  const text    = decoder.decode(buffer);
  return { text, bytes: file.size };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extrai índices de colunas do cabeçalho.
 * Lança erro descritivo se coluna obrigatória não for encontrada.
 */
function extrairIndices(header, campos) {
  const idx = {};
  for (const campo of campos) {
    const i = header.indexOf(campo);
    if (i === -1) {
      throw new Error(
        `Arquivo inválido: coluna "${campo}" não encontrada. ` +
        `Confirme que é o arquivo de votação por partido do TSE.`
      );
    }
    idx[campo] = i;
  }
  return idx;
}

/**
 * Faz split de uma linha CSV com separador ';', removendo aspas.
 */
function splitLinha(linha) {
  return linha.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
}

/**
 * Detecta possível problema de encoding (muitos caracteres de substituição).
 */
function detectarEncodingRuim(amostra) {
  const count = (amostra.match(/�/g) || []).length;
  return count > 5;
}

// ── Arquivo de votação por partido ────────────────────────────────────────────

/**
 * Parseia votacao_partido_munzona_{ano}_{uf}.csv e retorna partidos agregados.
 *
 * @param {File}   file
 * @param {{ cargo:string, uf:string, municipio:string }} filtro
 * @returns {{ partidos: Array, totalLinhas: number, linhasIgnoradas: number,
 *             ufsDisponiveis: string[], municipiosDisponiveis: string[] }}
 */
async function parseCsvTSE(file, filtro) {
  const { text } = await lerArquivo(file);

  if (detectarEncodingRuim(text.slice(0, 500))) {
    setStatus(
      '⚠ Possível problema de encoding. O arquivo do TSE usa ISO-8859-1 (latin-1).',
      'aviso'
    );
  }

  const linhas = text.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) throw new Error('Arquivo vazio ou sem linhas de dados.');

  const header = splitLinha(linhas[0]);

  const campoNominais = encontrarNomeColuna(header, ['QT_VOTOS_NOMINAIS_VALIDOS','QT_VOTOS_NOMINAIS']);
  const campoLegenda  = encontrarNomeColuna(header, ['QT_VOTOS_LEGENDA_VALIDOS','QT_VOTOS_LEGENDA']);

  const idx = extrairIndices(header, [
    'DS_CARGO', 'SG_UF', 'NM_MUNICIPIO',
    'SG_PARTIDO', 'NM_PARTIDO', campoNominais, campoLegenda,
  ]);

  const partidos           = {};
  const ufsDisponiveis     = new Set();
  const municipiosDisp     = new Set();
  let totalLinhas          = 0;
  let linhasIgnoradas      = 0;

  for (let i = 1; i < linhas.length; i++) {
    const cols = splitLinha(linhas[i]);
    if (cols.length < header.length) { linhasIgnoradas++; continue; }

    const cargo     = normalizarCargo(cols[idx['DS_CARGO']]);
    const uf        = cols[idx['SG_UF']];
    const municipio = cols[idx['NM_MUNICIPIO']];

    ufsDisponiveis.add(uf);
    if (filtro.uf && uf === filtro.uf) municipiosDisp.add(municipio);

    // Aplicar filtros
    if (filtro.cargo    && cargo    !== filtro.cargo)    continue;
    if (filtro.uf       && uf       !== filtro.uf)       continue;
    if (filtro.municipio && municipio !== filtro.municipio) continue;

    const sigla    = cols[idx['SG_PARTIDO']];
    const nome     = cols[idx['NM_PARTIDO']];
    const nominais = parseInt(cols[idx[campoNominais]], 10) || 0;
    const legenda  = parseInt(cols[idx[campoLegenda]],  10) || 0;

    if (!partidos[sigla]) {
      partidos[sigla] = { sigla, nome, nominais: 0, legenda: 0 };
    }
    partidos[sigla].nominais += nominais;
    partidos[sigla].legenda  += legenda;
    totalLinhas++;
  }

  return {
    partidos:              Object.values(partidos),
    totalLinhas,
    linhasIgnoradas,
    ufsDisponiveis:        [...ufsDisponiveis].sort(),
    municipiosDisponiveis: [...municipiosDisp].sort(),
  };
}

// ── Arquivo de candidatos ─────────────────────────────────────────────────────

/**
 * Parseia votacao_candidato_munzona_{ano}_{uf}.csv.
 * Retorna { [sigla]: [ { nome, numero, votos, partido } ] } ordenado por votos desc.
 */
async function parseCsvCandidatosTSE(file, filtro) {
  const { text } = await lerArquivo(file);

  const linhas = text.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return {};

  const header = splitLinha(linhas[0]);

  // Colunas do arquivo de candidatos — DS_CARGO pode ter nome diferente em alguns anos
  const campoNomCand = encontrarNomeColuna(header, ['QT_VOTOS_NOMINAIS_VALIDOS','QT_VOTOS_NOMINAIS']);
  const campos = ['DS_CARGO','SG_UF','NM_MUNICIPIO','NM_CANDIDATO','NR_CANDIDATO',
                  'SG_PARTIDO', campoNomCand];
  const idx = {};
  for (const campo of campos) {
    const i = header.indexOf(campo);
    idx[campo] = i; // -1 se não encontrada — tratar abaixo
  }

  if (idx['SG_PARTIDO'] === -1 || idx['NM_CANDIDATO'] === -1) {
    throw new Error(
      'Arquivo de candidatos inválido: colunas NM_CANDIDATO ou SG_PARTIDO não encontradas. ' +
      'Verifique se é o arquivo de votação por candidato do TSE.'
    );
  }

  const candidatosPorPartido = {};

  for (let i = 1; i < linhas.length; i++) {
    const cols = splitLinha(linhas[i]);
    if (cols.length < header.length) continue;

    // Filtros
    if (idx['DS_CARGO'] >= 0 && filtro.cargo &&
        normalizarCargo(cols[idx['DS_CARGO']]) !== filtro.cargo) continue;
    if (idx['SG_UF'] >= 0 && filtro.uf &&
        cols[idx['SG_UF']] !== filtro.uf) continue;
    if (idx['NM_MUNICIPIO'] >= 0 && filtro.municipio &&
        cols[idx['NM_MUNICIPIO']] !== filtro.municipio) continue;

    const sigla  = cols[idx['SG_PARTIDO']];
    const nome   = idx['NM_CANDIDATO'] >= 0 ? cols[idx['NM_CANDIDATO']] : '';
    const numero = idx['NR_CANDIDATO'] >= 0 ? cols[idx['NR_CANDIDATO']] : '';
    const votos  = idx['QT_VOTOS_NOMINAIS'] >= 0
      ? (parseInt(cols[idx['QT_VOTOS_NOMINAIS']], 10) || 0) : 0;

    if (!nome) continue;

    if (!candidatosPorPartido[sigla]) candidatosPorPartido[sigla] = {};
    const chave = `${numero}_${nome}`;
    if (!candidatosPorPartido[sigla][chave]) {
      candidatosPorPartido[sigla][chave] = { nome, numero, votos: 0, partido: sigla };
    }
    candidatosPorPartido[sigla][chave].votos += votos;
  }

  // Converter para arrays ordenados por votos desc
  const resultado = {};
  for (const [sigla, cands] of Object.entries(candidatosPorPartido)) {
    resultado[sigla] = Object.values(cands).sort((a, b) => b.votos - a.votos);
  }
  return resultado;
}

// ── Discovery: popular filtros de UF/Município antes de processar ──────────────

/**
 * Lê apenas o cabeçalho e as primeiras linhas para descobrir as UFs disponíveis.
 * Executa scan completo para UFs (rápido pois é só uma coluna).
 */
async function descobrirFiltros(file) {
  try {
    const { text } = await lerArquivo(file);
    const linhas   = text.split(/\r?\n/).filter(l => l.trim());
    if (linhas.length < 2) return;

    const header = splitLinha(linhas[0]);
    const iUF    = header.indexOf('SG_UF');
    const iCargo = header.indexOf('DS_CARGO');
    if (iUF === -1) return;

    const ufs    = new Set();
    const cargos = new Set();

    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(';');
      if (iUF < cols.length)    ufs.add(cols[iUF].trim().replace(/"/g, ''));
      if (iCargo < cols.length) {
        const norm = normalizarCargo(cols[iCargo].trim().replace(/"/g, ''));
        cargos.add(norm);
      }
    }

    popularSelectUF([...ufs].sort());
    ajustarSelectCargo([...cargos].sort());
  } catch {
    // silencioso — os filtros ficam com os valores padrão
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTROS / SELECT DINÂMICOS
// ═══════════════════════════════════════════════════════════════════════════════

function popularSelectUF(ufs) {
  const sel = $('filter-uf');
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">Todas as UFs</option>';
  for (const uf of ufs) {
    const opt = document.createElement('option');
    opt.value = uf;
    opt.textContent = uf;
    if (uf === atual) opt.selected = true;
    sel.appendChild(opt);
  }
  filtroAtivo.uf = sel.value;
}

function popularSelectMunicipio(municipios) {
  const sel = $('filter-municipio');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos os municípios</option>';
  for (const m of municipios) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  }
  filtroAtivo.municipio = '';
  const wrap = $('filter-municipio-wrap');
  if (wrap) wrap.style.display = municipios.length > 0 ? 'block' : 'none';
}

function ajustarSelectCargo(cargos) {
  const sel = $('filter-cargo');
  if (!sel) return;
  const atual = sel.value;
  // Só ajusta se o valor atual não está disponível
  const existente = cargos.find(c => c === atual);
  if (!existente && cargos.length > 0) {
    sel.value = cargos[0];
    filtroAtivo.cargo = cargos[0];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREENCHIMENTO DO FORMULÁRIO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Limpa a lista de partidos e preenche com os dados importados do TSE.
 * Preserva rotulo e vagas (não sobrescreve).
 */
function preencherCamposComDadosTSE(partidos, candidatos) {
  if (!window._UI || !window._UI.adicionarPartido) {
    throw new Error('_UI não disponível. Verifique que ui.js carregou antes de import.js.');
  }

  // Limpar lista atual
  const lista = $('lista-partidos');
  if (lista) lista.innerHTML = '';

  // Ordenar por total de votos desc
  const sorted = [...partidos].sort(
    (a, b) => (b.nominais + b.legenda) - (a.nominais + a.legenda)
  );

  for (const p of sorted) {
    const cands = candidatos?.[p.sigla] || [];
    window._UI.adicionarPartido({
      sigla:         p.sigla,
      nome:          p.nome,
      votosNominais: p.nominais,
      votosLegenda:  p.legenda,
      candidatos:    cands,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE DE CONFIRMAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

function mostrarBadge(nPartidos, totalVotos, cargo, uf, arquivo, timestamp) {
  // Badge no sidebar (logo acima do botão Calcular)
  const badge = $('import-badge');
  if (!badge) return;

  const ufLabel = uf || 'todas as UFs';
  badge.innerHTML =
    `<div class="import-badge-linha1">✅ Dados TSE importados</div>` +
    `<div class="import-badge-linha2">` +
      `${nPartidos} partidos · ${fmt(totalVotos)} votos · ` +
      `${cargo} · ${ufLabel}` +
    `</div>` +
    `<div class="import-badge-linha3">Importado em ${timestamp}</div>` +
    `<div class="import-badge-linha3">Arquivo: ${arquivo}</div>`;
  badge.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL — PROCESSAR CSV
// ═══════════════════════════════════════════════════════════════════════════════

async function processarCSV() {
  const filePartido    = $('file-partido');
  const fileCandidato  = $('file-candidato');
  const btnProcessar   = $('btn-processar-csv');

  if (!filePartido || !filePartido.files.length) {
    setStatus(
      '⚠ Selecione o arquivo de votação por partido antes de processar.',
      'aviso'
    );
    return;
  }

  const fPartido = filePartido.files[0];

  // Bloquear ZIP
  if (fPartido.name.toLowerCase().endsWith('.zip')) {
    setStatus(
      '❌ Arquivos .zip ainda não são suportados. ' +
      'Descompacte o arquivo e importe o .csv diretamente.',
      'erro'
    );
    return;
  }

  if (btnProcessar) btnProcessar.disabled = true;
  setStatus('<span class="import-spinner"></span> Lendo arquivo de partidos…', 'progresso');

  try {
    // ── Passo 1: Parsear partidos ──
    const { partidos, totalLinhas, linhasIgnoradas, municipiosDisponiveis } =
      await parseCsvTSE(fPartido, filtroAtivo);

    // Atualizar filtro de município se cargo = Vereador
    if (filtroAtivo.cargo === 'Vereador' && municipiosDisponiveis.length > 0) {
      popularSelectMunicipio(municipiosDisponiveis);
    }

    if (partidos.length === 0) {
      const cargoLabel = filtroAtivo.cargo || '(sem filtro de cargo)';
      const ufLabel    = filtroAtivo.uf    || 'todas as UFs';
      setStatus(
        `❌ Nenhum dado encontrado para "${cargoLabel}" em ${ufLabel}. ` +
        `Verifique os filtros ou o arquivo.`,
        'erro'
      );
      if (btnProcessar) btnProcessar.disabled = false;
      return;
    }

    // ── Passo 2: Parsear candidatos (opcional) ──
    let candidatos = null;
    if (fileCandidato && fileCandidato.files.length) {
      const fCand = fileCandidato.files[0];
      if (!fCand.name.toLowerCase().endsWith('.zip')) {
        setStatus(
          '<span class="import-spinner"></span> Lendo arquivo de candidatos…',
          'progresso'
        );
        try {
          candidatos = await parseCsvCandidatosTSE(fCand, filtroAtivo);
        } catch (errCand) {
          setStatus(
            `⚠ Arquivo de candidatos ignorado: ${errCand.message}`,
            'aviso'
          );
          candidatos = null;
        }
      } else {
        setStatus(
          '⚠ Arquivo de candidatos .zip ignorado — use o .csv descompactado.',
          'aviso'
        );
      }
    }

    // ── Passo 3: Preencher formulário ──
    preencherCamposComDadosTSE(partidos, candidatos);

    // ── Passo 4: Calcular totais para badge ──
    const totalVotos = partidos.reduce((s, p) => s + p.nominais + p.legenda, 0);
    const totalAbaixo = totalVotos < 10000;
    const timestamp   = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short', timeStyle: 'medium',
    });
    const ufLabel = filtroAtivo.uf || 'todas as UFs';

    // Guardar metadados de fonte
    fonteDados = {
      arquivo:     fPartido.name,
      partidos:    partidos.length,
      totalVotos,
      cargo:       filtroAtivo.cargo,
      uf:          ufLabel,
      timestamp,
    };

    // ── Passo 5: Badge + status ──
    mostrarBadge(partidos.length, totalVotos, filtroAtivo.cargo, ufLabel,
                 fPartido.name, timestamp);

    let statusMsg =
      `✅ <strong>${partidos.length} partidos importados</strong> · ` +
      `${fmt(totalVotos)} votos válidos · ` +
      `${totalLinhas} linhas processadas` +
      (linhasIgnoradas > 0 ? ` · ${linhasIgnoradas} ignoradas` : '') +
      (candidatos ? ` · candidatos carregados` : '');

    if (totalAbaixo) {
      statusMsg +=
        `<br>⚠ Total muito baixo (${fmt(totalVotos)} votos). ` +
        `Confirme se os filtros estão corretos.`;
    }

    setStatus(statusMsg, 'ok');

    // Recolher painel
    const body = $('import-body');
    if (body) body.style.display = 'none';
    const btn  = $('btn-toggle-import');
    if (btn)  btn.setAttribute('aria-expanded', 'false');

  } catch (err) {
    setStatus(`❌ ${err.message}`, 'erro');
  } finally {
    if (btnProcessar) btnProcessar.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

function init() {
  // ── Toggle do painel ──
  const btnToggle = $('btn-toggle-import');
  const body      = $('import-body');
  if (btnToggle && body) {
    btnToggle.addEventListener('click', () => {
      const aberto = body.style.display !== 'none';
      body.style.display = aberto ? 'none' : 'block';
      btnToggle.setAttribute('aria-expanded', String(!aberto));
    });
  }

  // ── Seleção do arquivo de partidos: discovery automático de UFs ──
  const filePartido = $('file-partido');
  if (filePartido) {
    filePartido.addEventListener('change', async () => {
      if (!filePartido.files.length) return;
      const f = filePartido.files[0];
      if (f.name.toLowerCase().endsWith('.zip')) {
        setStatus(
          '❌ Arquivos .zip não suportados. Descompacte e importe o .csv.',
          'erro'
        );
        return;
      }
      setStatus(
        '<span class="import-spinner"></span> Detectando filtros disponíveis…',
        'progresso'
      );
      await descobrirFiltros(f);
      clearStatus();
    });
  }

  // ── Filtro de cargo ──
  const selCargo = $('filter-cargo');
  if (selCargo) {
    selCargo.addEventListener('change', () => {
      filtroAtivo.cargo = selCargo.value;
      const municipioWrap = $('filter-municipio-wrap');
      if (municipioWrap) {
        municipioWrap.style.display =
          filtroAtivo.cargo === 'Vereador' ? 'block' : 'none';
      }
    });
  }

  // ── Filtro de UF ──
  const selUF = $('filter-uf');
  if (selUF) {
    selUF.addEventListener('change', () => {
      filtroAtivo.uf = selUF.value;
    });
  }

  // ── Filtro de município ──
  const selMun = $('filter-municipio');
  if (selMun) {
    selMun.addEventListener('change', () => {
      filtroAtivo.municipio = selMun.value;
    });
  }

  // ── Botão processar ──
  const btnProcessar = $('btn-processar-csv');
  if (btnProcessar) {
    btnProcessar.addEventListener('click', processarCSV);
  }
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT GLOBAL — para export.js incluir metadados de fonte no PDF
// ═══════════════════════════════════════════════════════════════════════════════

window.ImportTSE = {
  /** Retorna os metadados da última importação, ou null se nenhuma foi feita. */
  getFonteDados: () => fonteDados,
};

})();
