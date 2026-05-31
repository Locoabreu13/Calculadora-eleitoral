/**
 * import.js — Ponte de preenchimento do formulário com dados do TSE.
 *
 * O upload manual de CSV foi descontinuado; o carregamento de dados é feito
 * automaticamente por js/tse-direto.js, que chama window.ImportTSE.injetarDados().
 * Este módulo mantém apenas:
 *   - preencherCamposComDadosTSE() — popula a lista de partidos no formulário
 *   - mostrarBadge()               — exibe o badge de confirmação (#import-badge)
 *   - o toggle do painel "Importar dados do TSE" (#btn-toggle-import / #import-body)
 *   - a API pública window.ImportTSE { getFonteDados, injetarDados }
 *
 * Depende de: ui.js (window._UI.adicionarPartido exposto por ui.js)
 */
(function () {
'use strict';

let fonteDados = null;    // { arquivo, partidos, totalVotos, cargo, uf, timestamp }

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

function fmt(n) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n));
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

  // Limpar lista atual e ativar modo somente-leitura (dados oficiais TSE)
  const lista = $('lista-partidos');
  if (lista) { lista.innerHTML = ''; lista.classList.add('modo-tse'); }

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
// INICIALIZAÇÃO — toggle do painel de importação
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
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT GLOBAL — para export.js incluir metadados de fonte no PDF
// ═══════════════════════════════════════════════════════════════════════════════

window.ImportTSE = {
  getFonteDados: () => fonteDados,

  /**
   * Preenche o formulário com dados de partidos já processados.
   * Chamado por tse-direto.js após fetch direto do TSE.
   * @param {Array}  partidos  - [{ sigla, nome, nominais, legenda }]
   * @param {Array|null} candidatos
   * @param {Object} meta      - { arquivo, partidos, totalVotos, cargo, uf, timestamp }
   */
  injetarDados: function (partidos, candidatos, meta) {
    preencherCamposComDadosTSE(partidos, candidatos);
    if (meta) {
      const totalVotos = meta.totalVotos ||
        partidos.reduce((s, p) => s + (p.nominais || 0) + (p.legenda || 0), 0);
      fonteDados = meta;
      mostrarBadge(meta.partidos || partidos.length, totalVotos,
        meta.cargo, meta.uf, meta.arquivo, meta.timestamp);
    }
  },
};

})();
