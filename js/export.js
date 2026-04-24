/**
 * export.js — Exportação PDF, CSV e link compartilhável.
 */

'use strict';

/**
 * Exporta o resultado para CSV.
 * @param {import('./engine').ResultadoFinal} resultado
 * @returns {string} conteúdo CSV
 */
function exportarCSV(resultado) {
  const linhas = [
    ['Calculadora de Retotalização Eleitoral'],
    [`Pleito: ${resultado.rotulo}`],
    [`Vagas: ${resultado.vagas}`],
    [`Votos Válidos: ${resultado.votosValidos}`],
    [`Quociente Eleitoral (QE): ${resultado.qe}`],
    [`Barreira 80% QE: ${resultado.barreira80}`],
    [`Piso 20% QE: ${resultado.piso20}`],
    [`Total QPs (Fase 1): ${resultado.totalQPs}`],
    [`Sobras: ${resultado.sobras}`],
    [`Fase 3 Ativada: ${resultado.fase3Ativada ? 'Sim' : 'Não'}`],
    [],
    ['Partido', 'Nome', 'Votos Válidos', '% do QE', 'QP (F1)', 'Sobras F2', 'Sobras F3', 'Total', 'Status'],
    ...resultado.partidos.map(p => [
      p.sigla,
      p.nome,
      p.votos,
      (p.percentualQE * 100).toFixed(2).replace('.', ',') + '%',
      p.qp,
      p.sobrasF2,
      p.sobrasF3,
      p.total,
      p.status,
    ]),
    [],
    ['Auditoria D\'Hondt'],
    ['Rodada', 'Fase', 'Vencedor', 'Média Vencedor', 'Candidato Convocado', 'Fundamentação'],
    ...resultado.auditoria.map(r => [
      r.rodada,
      r.fase,
      r.vencedor,
      r.mediaVencedor.toFixed(4).replace('.', ','),
      r.candidatoConvocado ? r.candidatoConvocado.nome : '(sem lista)',
      r.fundamentacao,
    ]),
  ];

  return linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

/**
 * Faz download de um CSV.
 * @param {string} conteudo
 * @param {string} nomeArquivo
 */
function downloadCSV(conteudo, nomeArquivo) {
  const BOM = '\uFEFF'; // UTF-8 BOM para Excel
  const blob = new Blob([BOM + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo || 'resultado_eleitoral.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta relatório PDF usando jsPDF (deve estar carregado globalmente).
 * @param {import('./engine').ResultadoFinal} resultado
 * @param {import('./engine').ResultadoFinal|null} original - para comparativo
 */
function exportarPDF(resultado, original) {
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
    return;
  }
  const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // Cabeçalho
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Calculadora de Retotalização Eleitoral', pageW / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(resultado.rotulo, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });
  y += 10;

  // Parâmetros
  doc.setFont('helvetica', 'bold');
  doc.text('Parâmetros', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const fmt = n => new Intl.NumberFormat('pt-BR').format(n);
  const params = [
    [`Vagas: ${resultado.vagas}`, `Votos Válidos: ${fmt(resultado.votosValidos)}`],
    [`QE: ${fmt(resultado.qe)}`, `Barreira 80% QE: ${fmt(resultado.barreira80)}`],
    [`Piso 20% QE: ${fmt(resultado.piso20)}`, `Total QPs: ${resultado.totalQPs} | Sobras: ${resultado.sobras}`],
    [`Fase 3 Ativada: ${resultado.fase3Ativada ? 'SIM' : 'NÃO'}`, resultado.fase3Motivo || ''],
  ];
  for (const [col1, col2] of params) {
    doc.text(col1, 15, y);
    doc.text(col2, pageW / 2, y);
    y += 5;
  }
  y += 5;

  // Tabela de resultados
  doc.setFont('helvetica', 'bold');
  doc.text('Resultado por Partido', 15, y);
  y += 6;

  const colWidths = [25, 55, 28, 20, 18, 18, 18, 18, 35];
  const headers = ['Sigla', 'Nome', 'Votos', '% QE', 'F1', 'F2', 'F3', 'Total', 'Status'];
  let x = 15;
  doc.setFillColor(50, 50, 80);
  doc.setTextColor(255, 255, 255);
  doc.rect(x, y - 4, colWidths.reduce((a, b) => a + b, 0), 6, 'F');
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 1, y, { maxWidth: colWidths[i] - 2 });
    x += colWidths[i];
  }
  y += 4;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  const statusLabel = {
    eleito: 'Eleito',
    qualificado_sem_vaga: 'Qualificado s/ vaga',
    barrado_80: 'Barrado (< 80% QE)',
    fase3_apenas: 'Eleito (F3)',
  };

  for (const p of resultado.partidos) {
    if (y > 190) {
      doc.addPage();
      y = 15;
    }
    x = 15;
    const row = [
      p.sigla,
      p.nome,
      fmt(p.votos),
      (p.percentualQE * 100).toFixed(1) + '%',
      String(p.qp),
      String(p.sobrasF2),
      String(p.sobrasF3),
      String(p.total),
      statusLabel[p.status] || p.status,
    ];
    if (p.total > 0) {
      doc.setFillColor(230, 245, 230);
      doc.rect(15, y - 4, colWidths.reduce((a, b) => a + b, 0), 6, 'F');
    }
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x + 1, y, { maxWidth: colWidths[i] - 2 });
      x += colWidths[i];
    }
    y += 6;
  }

  // Alertas
  if (resultado.alertas.length > 0) {
    y += 5;
    if (y > 180) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.text('Alertas Jurídicos', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    for (const alerta of resultado.alertas) {
      if (y > 190) { doc.addPage(); y = 15; }
      const linhas = doc.splitTextToSize(alerta, pageW - 30);
      doc.text(linhas, 15, y);
      y += linhas.length * 5 + 2;
    }
  }

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Ferramenta de apoio técnico. Não substitui decisão da Justiça Eleitoral. ' +
    'Baseada no art. 109 do Código Eleitoral e ADIs 7.228/7.263/7.325 (STF, 13/03/2025).',
    pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center', maxWidth: pageW - 20 }
  );

  doc.save(`retotalizacao_${resultado.rotulo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

/**
 * Codifica o cenário na URL (base64).
 * @param {Object} cenario
 * @returns {string} URL compartilhável
 */
function gerarLinkCompartilhavel(cenario) {
  const json = JSON.stringify(cenario);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const url = new URL(window.location.href);
  url.searchParams.set('cenario', base64);
  return url.toString();
}

/**
 * Decodifica o cenário da URL.
 * @returns {Object|null}
 */
function lerCenarioDaURL() {
  const params = new URLSearchParams(window.location.search);
  const base64 = params.get('cenario');
  if (!base64) return null;
  try {
    const json = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { exportarCSV, downloadCSV, exportarPDF, gerarLinkCompartilhavel, lerCenarioDaURL };
} else {
  window.Export = { exportarCSV, downloadCSV, exportarPDF, gerarLinkCompartilhavel, lerCenarioDaURL };
}
