/**
 * i18n.js — Rótulos e formatação em português brasileiro.
 */

'use strict';

const fmt = new Intl.NumberFormat('pt-BR');
const fmtDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtPct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });

const I18N = {
  formatarNumero: n => fmt.format(n),
  formatarDecimal: n => fmtDecimal.format(n),
  formatarPorcentagem: n => fmtPct.format(n),

  STATUS: {
    eleito: 'Eleito',
    qualificado_sem_vaga: 'Qualificado sem vaga',
    barrado_80: 'Barrado (< 80% QE)',
    fase3_apenas: 'Eleito (Fase 3)',
  },

  STATUS_TITLE: {
    eleito: 'Partido obteve ao menos uma cadeira nas Fases 1, 2 ou 3.',
    qualificado_sem_vaga: 'Partido atingiu 80% do QE mas não obteve sobras.',
    barrado_80: 'Partido ficou abaixo de 80% do Quociente Eleitoral e foi excluído da Fase 2.',
    fase3_apenas: 'Partido obteve cadeira(s) exclusivamente pela Fase 3 (sem barreira — ADIs 7.228/7.263/7.325).',
  },

  FASES: {
    1: 'Fase 1 — Quociente Partidário',
    2: 'Fase 2 — Maiores Médias (barreira 80/20)',
    3: 'Fase 3 — Maiores Médias sem barreira (ADIs STF)',
  },

  MODALIDADE_CASSACAO: {
    'nominal_legenda': 'Anular nominais e reatribuir à legenda',
    'total': 'Anular nominais + proporção de legenda',
    'nominal': 'Anular apenas nominais (sem reatribuição)',
    'cassacao_drap': 'Anular todos os votos do partido (cassação do DRAP)',
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18N;
} else {
  window.I18N = I18N;
}
