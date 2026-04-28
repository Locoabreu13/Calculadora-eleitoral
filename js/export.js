/**
 * export.js — Exportação PDF (parecer técnico estruturado), CSV e link compartilhável.
 *
 * PDF: portrait A4, Courier 10pt, seções numeradas com quebra de página automática
 *      e rodapé "Pág. X de Y". Gerado 100% via jsPDF (sem plugins externos).
 */

'use strict';

// ════════════════════════════════════════════════════════════════════════════════
// CSV
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Exporta o resultado para CSV.
 * @param {import('./engine').ResultadoFinal} resultado
 * @returns {string} conteúdo CSV
 */
function exportarCSV(resultado) {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  const linhas = [
    [`# Calculadora de Retotalização Eleitoral v2.0`],
    [`# Gerado em: ${agora}`],
    [`# Base legal: art. 109 CE + ADIs 7.228/7.263/7.325 STF (13/03/2025)`],
    [`#`],
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

// ════════════════════════════════════════════════════════════════════════════════
// PDF — PARECER TÉCNICO ESTRUTURADO
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Gera o parecer técnico em PDF (portrait A4, Courier 10pt).
 * @param {import('./engine').ResultadoFinal} resultado
 * @param {import('./engine').ResultadoFinal|null} original - cenário base para comparativo
 */
function exportarPDF(resultado, original) {
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
    return;
  }
  const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };

  // ── Layout ──────────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW   = 210;   // largura da página
  const PH   = 297;   // altura da página
  const ML   = 14;    // margem esquerda
  const MR   = 196;   // margem direita  (PW - 14)
  const MT   = 16;    // margem superior
  const CW   = MR - ML;  // largura de conteúdo: 182mm
  const FOOTER_H = 14;   // altura reservada para rodapé
  const MAX_Y    = PH - FOOTER_H;

  // Alturas de linha por tamanho de fonte (mm)
  const LH12 = 7;    // 12pt cabeçalho
  const LH10 = 5.5;  // 10pt corpo
  const LH9  = 5.0;  // 9pt metadados
  const LH8  = 4.5;  // 8pt tabelas

  // Curser vertical
  let y = MT;

  // ── Formatadores ────────────────────────────────────────────────────────────
  /** Número inteiro formatado em pt-BR */
  const fmtI = n => new Intl.NumberFormat('pt-BR').format(Math.round(n));

  /** Número com até d casas decimais (suprime zeros no final) */
  const fmtN = n => {
    if (Number.isInteger(n)) return new Intl.NumberFormat('pt-BR').format(n);
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);
  };

  /** Número decimal fixo com d casas */
  const fmtD = (n, d = 2) =>
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);

  /** Pad de string (esquerda) ou número (direita) para largura fixa */
  const padL = (s, n) => {
    const str = String(s ?? '');
    const cut = str.length > n ? str.substring(0, n - 1) + '\u2026' : str;
    return cut.padEnd(n);
  };
  const padR = (s, n) => {
    const str = String(s ?? '');
    const cut = str.length > n ? str.substring(0, n - 1) + '\u2026' : str;
    return cut.padStart(n);
  };

  // ── Data/hora e nome do arquivo ──────────────────────────────────────────────
  const now  = new Date();
  const aaaa = now.getFullYear();
  const mmes = String(now.getMonth() + 1).padStart(2, '0');
  const ddia = String(now.getDate()).padStart(2, '0');
  const hh   = String(now.getHours()).padStart(2, '0');
  const mi   = String(now.getMinutes()).padStart(2, '0');
  const ss   = String(now.getSeconds()).padStart(2, '0');
  const dataHora = `${ddia}/${mmes}/${aaaa} ${hh}:${mi}:${ss}`;
  const dataNome = `${aaaa}${mmes}${ddia}`;

  // ── Primitivos de renderização ───────────────────────────────────────────────

  /** Avança para nova página se necessário */
  function checkBreak(needed) {
    if (y + needed > MAX_Y) {
      doc.addPage();
      y = MT;
    }
  }

  /** Configura fonte */
  function setF(size, bold) {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
  }

  /**
   * Imprime uma linha de texto com quebra automática de página.
   * Retorna a quantidade de sub-linhas impressas.
   */
  function txtLine(text, opts) {
    const {
      size  = 10,
      bold  = false,
      align = 'left',
      x     = ML,
      color = null,
      lhOvr = null,   // override de altura de linha
    } = opts || {};

    const lh = lhOvr || (size >= 11 ? LH12 : size === 10 ? LH10 : size === 9 ? LH9 : LH8);
    setF(size, bold);
    if (color) doc.setTextColor(...color);

    const xPos = align === 'center' ? PW / 2 : align === 'right' ? MR : x;
    const maxW  = align === 'center' ? CW : CW - (x - ML);
    const lines = doc.splitTextToSize(String(text), maxW);

    for (let i = 0; i < lines.length; i++) {
      checkBreak(lh + 1);
      doc.text(lines[i], xPos, y, { align });
      y += lh;
    }
    if (color) doc.setTextColor(0, 0, 0);
    return lines.length;
  }

  /** Linha horizontal pesada (separadora de seção) */
  function hLine() {
    checkBreak(4);
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.4);
    doc.line(ML, y, MR, y);
    y += 3;
  }

  /** Linha horizontal fina (separadora interna) */
  function thinLine() {
    checkBreak(3);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.2);
    doc.line(ML, y, MR, y);
    y += 2.5;
  }

  /** Título de seção principal */
  function secao(titulo) {
    y += 4;
    hLine();
    txtLine(titulo, { size: 10, bold: true });
    y += 1;
  }

  /** Título de subseção */
  function subsecao(titulo) {
    y += 3;
    checkBreak(LH10 + 4);
    txtLine(titulo, { size: 10, bold: true });
    y += 1;
  }

  /**
   * Renderiza tabela monospace (Courier 8pt) com cabeçalho sombreado.
   *
   * @param {Array<{label:string, width:number, right?:boolean}>} cols
   * @param {Array<Array>} rows
   * @param {number} [minRowsBeforeBreak=3] - garante que pelo menos este número
   *   de linhas fique junto ao cabeçalho (evita cabeçalho órfão no fim da página)
   */
  function tabelaTexto(cols, rows, minRowsBeforeBreak) {
    const minRows = minRowsBeforeBreak || Math.min(3, rows.length);

    // Certifica que cabeçalho + N linhas iniciais cabem juntos
    checkBreak(LH8 * (1 + minRows) + 2);

    // ── Cabeçalho ──
    setF(8, true);
    doc.setFillColor(210, 210, 218);
    doc.rect(ML, y - 3.8, CW, LH8 + 0.5, 'F');
    doc.setTextColor(20, 20, 20);

    let hdrStr = '';
    for (const col of cols) {
      hdrStr += (col.right ? padR(col.label, col.width) : padL(col.label, col.width)) + ' ';
    }
    doc.text(hdrStr.trimEnd(), ML, y);
    y += LH8 + 0.5;

    // ── Linhas ──
    setF(8, false);
    let alt = false;
    for (const row of rows) {
      checkBreak(LH8 + 1);
      if (alt) {
        doc.setFillColor(248, 248, 252);
        doc.rect(ML, y - 3.8, CW, LH8 + 0.5, 'F');
      }
      alt = !alt;
      doc.setTextColor(0, 0, 0);

      let rowStr = '';
      for (let i = 0; i < cols.length; i++) {
        const val = String(row[i] ?? '');
        rowStr += (cols[i].right ? padR(val, cols[i].width) : padL(val, cols[i].width)) + ' ';
      }
      doc.text(rowStr.trimEnd(), ML, y);
      y += LH8;
    }
    y += 2;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONTEÚDO DO DOCUMENTO
  // ════════════════════════════════════════════════════════════════════════════

  // ── CABEÇALHO ──────────────────────────────────────────────────────────────
  setF(12, true);
  doc.text('RELATÓRIO TÉCNICO DE DISTRIBUIÇÃO PROPORCIONAL', PW / 2, y, { align: 'center' });
  y += LH12;

  // ── METADADOS ──────────────────────────────────────────────────────────────
  hLine();

  const interpLabel = resultado.interpretacaoF3 === 'conservadora'
    ? 'conservadora (piso individual 20% QE mantido na F3)'
    : 'expansiva (piso individual 20% QE suprimido na F3 — padrão pós-ADIs)';

  const metas = [
    ['Pleito:',                  resultado.rotulo],
    ['Data de geração:',         dataHora],
    ['Versão do algoritmo:',     '2.0'],
    ['Base legal:',              'art. 109 CE (Lei 14.211/2021) + ADIs 7.228/7.263/7.325 STF (13/03/2025)'],
    ['Interpretação Fase 3:',    interpLabel],
  ];

  for (const [label, valor] of metas) {
    checkBreak(LH9 * 2 + 1);
    setF(9, true);
    const lw = doc.getTextWidth(label);
    doc.text(label, ML, y);
    setF(9, false);
    const gap = 3;
    const valorLines = doc.splitTextToSize(valor, CW - lw - gap);
    doc.text(valorLines[0] || '', ML + lw + gap, y);
    y += LH9;
    for (let vi = 1; vi < valorLines.length; vi++) {
      checkBreak(LH9);
      doc.text(valorLines[vi], ML + lw + gap, y);
      y += LH9;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 1 — PARÂMETROS DE ENTRADA
  // ════════════════════════════════════════════════════════════════════════════
  secao('SEÇÃO 1 — PARÂMETROS DE ENTRADA');

  const p1 = [
    ['Número de vagas:',
      String(resultado.vagas)],
    ['Total de votos válidos:',
      fmtI(resultado.votosValidos)],
    ['Quociente Eleitoral (QE):',
      `${fmtN(resultado.qe)}   [fórmula: floor(${fmtI(resultado.votosValidos)} ÷ ${resultado.vagas}) = ${fmtN(resultado.qe)}]`],
    ['Limiar F2 — 80% QE:',
      fmtN(resultado.barreira80)],
    ['Piso individual F2 — 20% QE:',
      fmtN(resultado.piso20)],
    ['Vagas distribuídas na F1 (QPs):',
      `${resultado.totalQPs}   |   Sobras para F2/F3: ${resultado.sobras}`],
  ];

  for (const [label, valor] of p1) {
    checkBreak(LH10 + 1);
    setF(10, true);
    const lw10 = doc.getTextWidth(label);
    doc.text(label, ML, y);
    setF(10, false);
    const linhasV = doc.splitTextToSize(valor, CW - lw10 - 4);
    doc.text(linhasV[0] || '', ML + lw10 + 4, y);
    y += LH10;
    for (let vi = 1; vi < linhasV.length; vi++) {
      checkBreak(LH10);
      doc.text(linhasV[vi], ML + lw10 + 4, y);
      y += LH10;
    }
  }

  // Fonte dos dados — só exibida se houve importação TSE
  const _fonteTSE = window.ImportTSE && window.ImportTSE.getFonteDados
    ? window.ImportTSE.getFonteDados()
    : null;
  if (_fonteTSE) {
    thinLine();
    const fonteMetas = [
      ['Fonte dos dados:',              `CSV TSE importado em ${_fonteTSE.timestamp}`],
      ['Arquivo:',                      _fonteTSE.arquivo],
      ['Total de partidos importados:', String(_fonteTSE.partidos)],
    ];
    for (const [label, valor] of fonteMetas) {
      checkBreak(LH10 + 1);
      setF(10, true);
      const lw10f = doc.getTextWidth(label);
      doc.text(label, ML, y);
      setF(10, false);
      const linhasF = doc.splitTextToSize(valor, CW - lw10f - 4);
      doc.text(linhasF[0] || '', ML + lw10f + 4, y);
      y += LH10;
      for (let vi = 1; vi < linhasF.length; vi++) {
        checkBreak(LH10);
        doc.text(linhasF[vi], ML + lw10f + 4, y);
        y += LH10;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 2 — DISTRIBUIÇÃO POR FASE
  // ════════════════════════════════════════════════════════════════════════════
  secao('SEÇÃO 2 — DISTRIBUIÇÃO POR FASE');

  // ── 2.1 FASE 1 ─────────────────────────────────────────────────────────────
  subsecao('2.1  Fase 1 — Quocientes Partidários (art. 109, I, CE)');

  const f1Cols = [
    { label: 'PARTIDO',  width: 8 },
    { label: 'NOME',     width: 27 },
    { label: 'VOTOS',    width: 14, right: true },
    { label: '% QE',     width: 7,  right: true },
    { label: 'QP',       width: 4,  right: true },
    { label: 'VAGAS F1', width: 8,  right: true },
  ];
  // total chars: 8+27+14+7+4+8 = 68 + 6 espaços = 74 chars (~125mm @ 8pt Courier)

  const f1Rows = resultado.partidos.map(p => [
    p.sigla,
    p.nome,
    fmtI(p.votos),
    (p.percentualQE * 100).toFixed(1) + '%',
    p.qp,
    p.qp,
  ]);
  tabelaTexto(f1Cols, f1Rows);

  // Linha de total F1
  thinLine();
  const totQP = resultado.partidos.reduce((s, p) => s + p.qp, 0);
  txtLine(
    `Total vagas distribuídas na Fase 1: ${totQP} de ${resultado.vagas}` +
    `   |   Sobras: ${resultado.sobras}`,
    { size: 9, bold: true }
  );

  // Partidos barrados da F2
  const barrados80 = resultado.partidos.filter(p => p.votos < resultado.barreira80);
  if (barrados80.length > 0) {
    y += 1;
    txtLine(
      `Partidos excluídos da F2 por não atingir o limiar de 80% QE (${fmtN(resultado.barreira80)}): ` +
      barrados80.map(p => `${p.sigla} [${fmtI(p.votos)}]`).join(', '),
      { size: 9 }
    );
  }

  // ── 2.2 FASE 2 ─────────────────────────────────────────────────────────────
  subsecao('2.2  Fase 2 — Maiores Médias com Barreira (art. 109, II, CE)');
  txtLine(
    `Regras: barreira partidária ≥ 80% QE (${fmtN(resultado.barreira80)})` +
    `   |   piso individual ≥ 20% QE (${fmtN(resultado.piso20)}) por candidato convocado.`,
    { size: 9 }
  );
  y += 1;

  const rodadasF2 = resultado.auditoria.filter(r => r.fase === 2);

  if (rodadasF2.length === 0) {
    txtLine('Nenhuma rodada de Fase 2 executada (sem sobras ou todos os partidos barrados).', { size: 9 });
  } else {
    const f2Cols = [
      { label: 'RD',        width: 3,  right: true },
      { label: 'PARTIDO',   width: 8 },
      { label: 'MÉDIA',     width: 14, right: true },
      { label: 'CANDIDATO CONVOCADO', width: 28 },
      { label: 'BASE LEGAL',          width: 30 },
    ];
    // total: 3+8+14+28+30 = 83 + 5 espaços = 88 chars
    const f2Rows = rodadasF2.map(r => [
      r.rodada,
      r.vencedor,
      fmtD(r.mediaVencedor, 2),
      r.candidatoConvocado ? r.candidatoConvocado.nome : '(sem lista de candidatos)',
      'Art. 109, II, CE',
    ]);
    tabelaTexto(f2Cols, f2Rows);

    if (barrados80.length > 0) {
      txtLine(
        `Partidos excluídos da F2 (barreira 80% QE): ` +
        barrados80.map(p => `${p.sigla} [${fmtI(p.votos)} < ${fmtN(resultado.barreira80)}]`).join('  |  '),
        { size: 9 }
      );
    }
  }

  // ── 2.3 FASE 3 ─────────────────────────────────────────────────────────────
  subsecao('2.3  Fase 3 — Maiores Médias sem Barreira Partidária (ADIs 7.228/7.263/7.325)');

  if (!resultado.fase3Ativada) {
    txtLine(
      'Fase 3 não ativada — todas as vagas foram preenchidas nas Fases 1 e 2.',
      { size: 9 }
    );
  } else {
    // Determinar qual condição ativou a Fase 3
    const alertaF3 = resultado.alertas.find(a => a.includes('FASE 3 ATIVADA')) || '';
    let condicaoLabel;
    if (alertaF3.includes('Gatilho 1') || resultado.fase3Motivo.includes('Nenhum partido atingiu')) {
      condicaoLabel =
        'Condição A — nenhum partido atingiu 80% do QE (Gatilho 1: campo partidário vazio na F2).';
    } else if (alertaF3.includes('Gatilho 2') || resultado.fase3Motivo.includes('esgotaram')) {
      condicaoLabel =
        'Condição B — todos os partidos qualificados (≥ 80% QE) esgotaram candidatos elegíveis ≥ 20% QE (Gatilho 2).';
    } else {
      condicaoLabel =
        'Condição mista — Gatilhos 1 e 2 acionados simultaneamente.';
    }

    txtLine(`Ativada por: ${condicaoLabel}`, { size: 9 });
    txtLine(
      `Interpretação aplicada: ${resultado.interpretacaoF3}` +
      (resultado.aplicarPiso20F3
        ? ' — piso individual de 20% QE mantido na F3 (opção conservadora selecionada pelo usuário).'
        : ' — piso individual de 20% QE suprimido na F3 (padrão pós-ADIs 7.228/7.263/7.325).'),
      { size: 9 }
    );
    if (resultado.fase3Motivo) {
      txtLine(`Motivo: ${resultado.fase3Motivo}`, { size: 9 });
    }
    y += 1;

    const rodadasF3 = resultado.auditoria.filter(r => r.fase === 3);
    if (rodadasF3.length === 0) {
      txtLine('Nenhuma rodada de Fase 3 registrada.', { size: 9 });
    } else {
      const f3Cols = [
        { label: 'RD',        width: 3,  right: true },
        { label: 'PARTIDO',   width: 8 },
        { label: 'MÉDIA',     width: 14, right: true },
        { label: 'CANDIDATO CONVOCADO', width: 28 },
        { label: 'OBSERVAÇÃO',          width: 28 },
      ];
      const f3Rows = rodadasF3.map(r => [
        r.rodada,
        r.vencedor,
        fmtD(r.mediaVencedor, 2),
        r.candidatoConvocado ? r.candidatoConvocado.nome : '(sem lista de candidatos)',
        'Sem barreira partidária (ADIs STF)',
      ]);
      tabelaTexto(f3Cols, f3Rows);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 3 — RESULTADO FINAL
  // ════════════════════════════════════════════════════════════════════════════
  secao('SEÇÃO 3 — RESULTADO FINAL');

  const r3Cols = [
    { label: 'PARTIDO',  width: 8 },
    { label: 'NOME',     width: 23 },
    { label: 'F1',       width: 4,  right: true },
    { label: 'F2',       width: 4,  right: true },
    { label: 'F3',       width: 4,  right: true },
    { label: 'TOTAL',    width: 5,  right: true },
    { label: 'CANDIDATOS ELEITOS', width: 38 },
  ];
  // total: 8+23+4+4+4+5+38 = 86 + 7 espaços = 93 chars

  const r3Rows = resultado.partidos.map(p => [
    p.sigla,
    p.nome,
    p.qp,
    p.sobrasF2,
    p.sobrasF3,
    p.total,
    (p.eleitos && p.eleitos.length > 0)
      ? p.eleitos.map(e => e.nome).join(' / ')
      : '—',
  ]);
  tabelaTexto(r3Cols, r3Rows, 2);

  // Linha totalizadora
  thinLine();
  const totF1g  = resultado.partidos.reduce((s, p) => s + p.qp,      0);
  const totF2g  = resultado.partidos.reduce((s, p) => s + p.sobrasF2, 0);
  const totF3g  = resultado.partidos.reduce((s, p) => s + p.sobrasF3, 0);
  const totGer  = resultado.partidos.reduce((s, p) => s + p.total,    0);
  txtLine(
    `TOTAL GERAL:  F1 = ${totF1g}   F2 = ${totF2g}   F3 = ${totF3g}` +
    `   VAGAS PREENCHIDAS = ${totGer}   /   VAGAS OFERTADAS = ${resultado.vagas}`,
    { size: 9, bold: true }
  );

  // Vagas não preenchidas (art. 111 inconstitucional)
  const vagasNaoPreenchidas = resultado.alertas.filter(a => a.includes('não distribuída'));
  if (vagasNaoPreenchidas.length > 0) {
    y += 1;
    txtLine(
      `ATENÇÃO: ${vagasNaoPreenchidas.length} vaga(s) não distribuída(s). ` +
      `O art. 111 CE (distritão residual) foi declarado inconstitucional pelas ` +
      `ADIs 7.228/7.263/7.325 (STF, 13/03/2025). Estas vagas permanecem vacantes.`,
      { size: 9, color: [160, 0, 0] }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 4 — COMPARATIVO (somente se houver cenário original)
  // ════════════════════════════════════════════════════════════════════════════
  if (original) {
    secao('SEÇÃO 4 — COMPARATIVO: CENÁRIO ORIGINAL × RETOTALIZADO');

    txtLine(`Cenário de referência (original):   ${original.rotulo}`, { size: 9 });
    txtLine(`Cenário recalculado (retotalizado): ${resultado.rotulo}`, { size: 9 });
    y += 2;

    // Montar lista unificada de partidos
    const siglas = new Set([
      ...original.partidos.map(p => p.sigla),
      ...resultado.partidos.map(p => p.sigla),
    ]);

    const c4Cols = [
      { label: 'PARTIDO',   width: 8 },
      { label: 'NOME',      width: 25 },
      { label: 'ORIGINAL',  width: 9,  right: true },
      { label: 'RETOTAL.',  width: 9,  right: true },
      { label: 'Δ VAGAS',   width: 8,  right: true },
      { label: 'OBSERVAÇÃO',width: 30 },
    ];
    // total: 8+25+9+9+8+30 = 89 + 6 espaços = 95 chars

    const c4Rows = [];
    const vagasAlteradas = [];

    for (const sig of siglas) {
      const o  = original.partidos.find(p => p.sigla === sig);
      const r  = resultado.partidos.find(p => p.sigla === sig);
      const origTotal = o ? o.total : 0;
      const retotTotal = r ? r.total : 0;
      const delta = retotTotal - origTotal;
      const nomeRef = (r || o).nome;

      let obs;
      if (delta > 0)       obs = `GANHOU +${delta} VAGA(S)`;
      else if (delta < 0)  obs = `PERDEU ${delta} VAGA(S)`;
      else                 obs = 'Sem alteração';

      if (delta !== 0) {
        vagasAlteradas.push({ sig, nomeRef, origTotal, retotTotal, delta });
      }

      c4Rows.push([
        sig,
        nomeRef,
        origTotal,
        retotTotal,
        (delta >= 0 ? '+' : '') + delta,
        obs,
      ]);
    }

    tabelaTexto(c4Cols, c4Rows, 2);

    // Detalhamento das vagas alteradas
    if (vagasAlteradas.length > 0) {
      y += 1;
      txtLine('Vagas que mudaram de titularidade:', { size: 9, bold: true });
      for (const v of vagasAlteradas) {
        txtLine(
          `  \u2022 ${v.sig} (${v.nomeRef}): ` +
          `${v.origTotal} vaga(s) no original \u2192 ` +
          `${v.retotTotal} vaga(s) no retotalizado ` +
          `(varia\u00e7\u00e3o: ${v.delta > 0 ? '+' + v.delta : v.delta})`,
          { size: 9 }
        );
      }
    } else {
      txtLine(
        'Nenhuma vaga mudou de titularidade entre os dois cenários.',
        { size: 9 }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ALERTAS JURÍDICOS (somente os relevantes)
  // ════════════════════════════════════════════════════════════════════════════
  const alertasJur = resultado.alertas.filter(a =>
    a.includes('ALERTA JURÍDICO') ||
    (a.includes('FASE 3 ATIVADA') && a.length > 50)
  );

  if (alertasJur.length > 0) {
    secao('ALERTAS JURÍDICOS');
    for (const alerta of alertasJur) {
      txtLine('\u2022 ' + alerta, { size: 9 });
      y += 1;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEÇÃO FINAL — METODOLOGIA E DISCLAIMER
  // ════════════════════════════════════════════════════════════════════════════
  secao('METODOLOGIA E DISCLAIMER');

  const metodologia = [
    ['FERRAMENTA:', 'Calculadora de Retotalização Eleitoral, v2.0.'],
    ['OBJETIVO:',
      'Apoio técnico-jurídico ao cálculo de distribuição proporcional de cadeiras ' +
      'em eleições legislativas brasileiras, com suporte a cenários de retotalização ' +
      'por cassação de mandato.'],
    ['', ''],
    ['FUNDAMENTOS JURÍDICOS:', ''],
    ['',
      '\u2022 Art. 106 CE: QE = floor(total de votos válidos / número de vagas).'],
    ['',
      '\u2022 Art. 109, I, CE: Fase 1 — quociente partidário; vagas = floor(votos do partido / QE).'],
    ['',
      '\u2022 Art. 109, II, CE (Lei 14.211/2021): Fase 2 — D\'Hondt com barreira de 80% QE ' +
      'e piso individual de 20% QE por candidato convocado.'],
    ['',
      '\u2022 ADIs 7.228, 7.263 e 7.325 (STF, 13/03/2025, Min. Flávio Dino): Fase 3 — ' +
      'D\'Hondt sem barreira partidária. Declarada a inconstitucionalidade do art. 111 CE ' +
      '(distritão residual); vagas restantes não são preenchidas pelo critério ' +
      'de maior votação individual.'],
    ['', ''],
    ['PRECISÃO ARITMÉTICA:', ''],
    ['',
      '\u2022 Divisão inteira por truncamento — floor(a/b) — sem arredondamento em QE e QP.'],
    ['',
      '\u2022 Comparação de médias D\'Hondt com tolerância \u03b5 = 1\u00d710\u207b\u00b9\u2070 ' +
      '(proteção contra erro de ponto flutuante).'],
    ['',
      '\u2022 Em caso de empate exato de médias, prevalece a ordem de entrada dos partidos ' +
      '(desempate por art. 108 CE — mais idoso — não implementado).'],
    ['', ''],
    ['INTERPRETAÇÃO DA FASE 3:',
      resultado.aplicarPiso20F3
        ? 'Conservadora (piso individual de 20% do QE aplicado)'
        : 'Expansiva (sem piso individual \u2014 padr\u00e3o p\u00f3s-ADIs 7.228/7.263/7.325)'],
    ['', ''],
  ];

  for (const [label, valor] of metodologia) {
    if (label === '' && valor === '') {
      y += 2;
      continue;
    }
    if (label && valor === '') {
      txtLine(label, { size: 9, bold: true });
    } else if (label) {
      checkBreak(LH9 + 1);
      setF(9, true);
      const lw = doc.getTextWidth(label);
      doc.text(label, ML, y);
      setF(9, false);
      const vlines = doc.splitTextToSize(valor, CW - lw - 3);
      doc.text(vlines[0] || '', ML + lw + 3, y);
      y += LH9;
      for (let vi = 1; vi < vlines.length; vi++) {
        checkBreak(LH9);
        doc.text(vlines[vi], ML + lw + 3, y);
        y += LH9;
      }
    } else {
      txtLine(valor, { size: 9 });
    }
  }

  // Disclaimer final — caixa destacada
  y += 3;
  checkBreak(LH9 * 4 + 6);
  doc.setFillColor(255, 245, 230);
  doc.setDrawColor(180, 100, 0);
  doc.setLineWidth(0.4);
  doc.rect(ML, y - 1, CW, LH9 * 4 + 4, 'FD');
  y += 3;
  txtLine(
    'AVISO: Instrumento de apoio técnico-jurídico. ' +
    'N\u00e3o substitui decis\u00e3o da Justi\u00e7a Eleitoral. ' +
    'Os resultados apresentados t\u00eam car\u00e1ter informativo e devem ser validados ' +
    'pela autoridade eleitoral competente. ' +
    'Os dados de entrada s\u00e3o de responsabilidade exclusiva do usu\u00e1rio.',
    { size: 9, bold: true, color: [120, 60, 0] }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RODAPÉ COM NUMERAÇÃO DE PÁGINAS (segundo passo — após todo o conteúdo)
  // ════════════════════════════════════════════════════════════════════════════
  const totalPaginas = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPaginas; pg++) {
    doc.setPage(pg);
    // Linha divisória do rodapé
    doc.setDrawColor(140, 140, 140);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - FOOTER_H + 1, MR, PH - FOOTER_H + 1);
    // Texto esquerdo: título resumido
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(
      'Calculadora de Retotaliza\u00e7\u00e3o Eleitoral \u2014 art. 109 CE \u00b7 ADIs 7.228/7.263/7.325 STF',
      ML, PH - FOOTER_H + 5
    );
    // Texto direito: número de página
    doc.text(`P\u00e1g. ${pg} de ${totalPaginas}`, MR, PH - FOOTER_H + 5, { align: 'right' });
    // Segunda linha do rodapé: pleito
    doc.text(
      resultado.rotulo,
      ML, PH - FOOTER_H + 9
    );
    doc.text(dataHora, MR, PH - FOOTER_H + 9, { align: 'right' });
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const rotuloSafe = resultado.rotulo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 50);

  doc.save(`RetotalizacaoEleitoral_${rotuloSafe}_${dataNome}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════════════
// LINK COMPARTILHÁVEL
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Codifica o cenário na URL (base64).
 * @param {Object} cenario
 * @returns {string} URL compartilhável
 */
function gerarLinkCompartilhavel(cenario) {
  const json   = JSON.stringify(cenario);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const url    = new URL(window.location.href);
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

// ── Exports ──────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { exportarCSV, downloadCSV, exportarPDF, gerarLinkCompartilhavel, lerCenarioDaURL };
} else {
  window.Export = { exportarCSV, downloadCSV, exportarPDF, gerarLinkCompartilhavel, lerCenarioDaURL };
}
