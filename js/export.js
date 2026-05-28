/**
 * export.js — Exportação PDF, CSV e link compartilhável.
 *
 * PDF v4: jsPDF + jsPDF-AutoTable + Roboto Unicode (via pdf-font.js).
 *         Espelha o layout da tela de resultados do Sistema RetotalizaJE:
 *         header brand, KPI cards, banner F3, tabela de distribuição,
 *         auditoria por rodada, metodologia e rodapé duplo.
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
function exportarCSV(resultado, cenario) {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

  // Fix 3: status em português
  const STATUS_PT = {
    'eleito':               'Eleito',
    'barrado_80':           'Barrado (80% QE)',
    'barrado_piso':         'Barrado (piso 20%)',
    'sem_votos':            'Sem votos',
    'qualificado_sem_vaga': 'Qualificado (sem vaga)',
    'fase3_apenas':         'Eleito (Fase 3)',
  };

  // Fix 4: média D'Hondt — máximo 2 casas decimais, ponto decimal, sem zeros à direita
  function formatarMedia(v) {
    return v.toFixed(2).replace(/\.?0+$/, '');
  }

  const linhas = [
    [`# Sistema RetotalizaJE v2.0`],
    [`# Gerado em: ${agora}`],
    [`# Base legal: art. 109 CE + ADIs 7.228/7.263/7.325 STF (13/03/2025)`],
    [`#`],
    ['Sistema RetotalizaJE'],
    [`Pleito: ${resultado.rotulo}`],
    [`Vagas: ${resultado.vagas}`],
    [`Votos Válidos: ${resultado.votosValidos}`],
    [`Quociente Eleitoral (QE): ${resultado.qe}`],
    [`Barreira 80% QE: ${resultado.barreira80.toFixed(2)}`],   // Fix 1+5: arredonda, ponto decimal
    [`Piso 20% QE: ${resultado.piso20.toFixed(2)}`],           // Fix 1+5: arredonda, ponto decimal
    [`Total QPs (Fase 1): ${resultado.totalQPs}`],
    [`Sobras: ${resultado.sobras}`],
    [`Fase 3 Ativada: ${resultado.fase3Ativada ? 'Sim' : 'Não'}`],
    [],
    ['Partido', 'Nome', 'Votos Válidos', '% do QE', 'QP (F1)', 'Sobras F2', 'Sobras F3', 'Total', 'Status'],
    ...resultado.partidos.map(p => [
      p.sigla,
      p.nome,
      p.votos,
      (p.percentualQE * 100).toFixed(2) + '%',               // Fix 2: remove replace('.', ',')
      p.qp,
      p.sobrasF2,
      p.sobrasF3,
      p.total,
      STATUS_PT[p.status] || p.status,                       // Fix 3: status em português
    ]),
    [],
    ['Auditoria D\'Hondt'],
    ['Rodada', 'Fase', 'Vencedor', 'Média Vencedor', 'Candidato Convocado', 'Fundamentação'],
    ...resultado.auditoria.map(r => [
      r.rodada,
      r.fase,
      r.vencedor,
      formatarMedia(r.mediaVencedor),
      r.candidatoConvocado ? r.candidatoConvocado.nome : '(sem lista)',
      r.fundamentacao,
    ]),
  ];

  // Seção de candidatos por partido (só se há dados de candidatos)
  if (cenario) {
    var partidosComCands = resultado.partidos.filter(function(p) {
      var pc = (cenario.partidos || []).find(function(cp) { return cp.sigla === p.sigla; });
      return pc && pc.candidatos && pc.candidatos.length > 0;
    });
    if (partidosComCands.length > 0) {
      linhas.push([]);
      linhas.push(['Candidatos por Partido — Ordem de Preferência']);
      linhas.push(['Partido', 'Nº', 'Nome', 'Votos', 'Status']);
      for (var pi = 0; pi < partidosComCands.length; pi++) {
        var p = partidosComCands[pi];
        var pc = (cenario.partidos || []).find(function(cp) { return cp.sigla === p.sigla; });
        var eleitos     = p.eleitos || [];
        var eleitosMap  = {};
        eleitos.forEach(function(c) { eleitosMap[c.nome] = true; });
        var suplentes   = (pc.candidatos || [])
          .filter(function(c) { return !c.cassado && !eleitosMap[c.nome]; })
          .sort(function(a, b) { return b.votos - a.votos; });
        var todos = eleitos.map(function(c) { return { nome: c.nome, votos: c.votos, status: 'Eleito' }; })
          .concat(suplentes.map(function(c) { return { nome: c.nome, votos: c.votos, status: 'Suplente' }; }));
        todos.forEach(function(c, i) {
          linhas.push([p.sigla, i + 1, c.nome, c.votos, c.status]);
        });
      }
    }
  }

  return linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

/**
 * Faz download de um CSV.
 * @param {string} conteudo
 * @param {string} nomeArquivo
 */
function downloadCSV(conteudo, nomeArquivo) {
  const BOM = '﻿'; // UTF-8 BOM para Excel
  const blob = new Blob([BOM + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo || 'resultado_eleitoral.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════════════════
// PDF — LAYOUT ESPELHANDO A TELA DE RESULTADOS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Gera o PDF espelhando a tela de resultados do Sistema RetotalizaJE.
 *
 * Fonte Unicode: Roboto (Regular + Bold) + Roboto Mono via window.PDF_FONTS.
 * Se PDF_FONTS ainda não carregou, injeta pdf-font.js e reexecuta ao terminar.
 *
 * @param {import('./engine').ResultadoFinal} resultado
 * @param {import('./engine').ResultadoFinal|null} original - cenário base p/ comparativo
 */
function exportarPDF(resultado, original, cenario) {

  // ── Guard: carregar fontes lazily se ainda não disponíveis ──────────────────
  if (!window.PDF_FONTS) {
    if (!document.getElementById('pdf-font-script')) {
      var s = document.createElement('script');
      s.id  = 'pdf-font-script';
      s.src = 'js/pdf-font.js?v=1';
      s.onload = function () { exportarPDF(resultado, original); };
      document.head.appendChild(s);
    }
    return;
  }

  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
    return;
  }
  const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };

  // ── Registro de fontes: UMA vez por sessão via evento 'initialized' ────────
  // Problema: em jsPDF 2.5.1, chamar addFileToVFS + addFont em cada nova
  // instância pode lançar exceção silenciosa na segunda chamada (estado interno
  // do módulo TTFFont conflita com a re-processamento do mesmo arquivo .ttf).
  // Solução: injetar o registro no evento 'initialized' do jsPDF uma única vez,
  // de modo que TODA nova instância já receba Roboto automaticamente.
  const FONT = 'roboto';
  const MONO = 'roboto-mono';

  if (!jsPDF.API.__robotoFontsRegistered) {
    jsPDF.API.events.push(['initialized', function () {
      try {
        this.addFileToVFS('Roboto-Regular.ttf',     window.PDF_FONTS['Roboto-Regular']);
        this.addFont    ('Roboto-Regular.ttf',       FONT, 'normal');
        this.addFileToVFS('Roboto-Bold.ttf',        window.PDF_FONTS['Roboto-Bold']);
        this.addFont    ('Roboto-Bold.ttf',          FONT, 'bold');
        this.addFileToVFS('RobotoMono-Regular.ttf', window.PDF_FONTS['RobotoMono-Regular']);
        this.addFont    ('RobotoMono-Regular.ttf',   MONO, 'normal');
      } catch (e) {
        console.warn('[PDF] Falha no registro de fontes Roboto:', e);
      }
    }]);
    jsPDF.API.__robotoFontsRegistered = true;
  }

  // ── Instância (fontes já registradas pelo handler 'initialized') ────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var fontOk = false;
  try {
    doc.setFont(FONT, 'normal');
    fontOk = true;
  } catch (e) {
    console.warn('[PDF] Fonte Roboto não disponível nesta instância, usando Courier:', e);
    doc.setFont('courier', 'normal');
  }
  const F  = fontOk ? FONT : 'courier';
  const FM = fontOk ? MONO : 'courier';

  // ── Constantes de layout ────────────────────────────────────────────────────
  const PW = 210, PH = 297;
  const ML = 14,  MR = 196;
  const MT = 16;
  const CW = MR - ML;          // 182 mm
  const FOOTER_H = 16;
  const MAX_Y    = PH - FOOTER_H;

  // Alturas de linha por tamanho de fonte (mm) — Roboto
  const lh = function (sz) {
    if (sz >= 14) return 8.5;
    if (sz >= 12) return 7.5;
    if (sz >= 10) return 6;
    if (sz >= 9)  return 5.5;
    if (sz >= 8)  return 5;
    return 4.5;
  };

  // Paleta de cores (RGB)
  const CN  = [15,  28,  46];   // navy     #0F1C2E
  const CB  = [37,  99,  235];  // blue     #2563EB
  const CG  = [5,   150, 105];  // green    #059669
  const CA  = [180, 95,  0];    // amber    #B45F00 (escurecido para WCAG em fundo claro)
  const CR  = [185, 28,  28];   // red      #B91C1C
  const CGR = [100, 116, 139];  // gray     #64748B
  const CLG = [226, 232, 240];  // lgray    #E2E8F0
  const CSF = [248, 250, 252];  // surface  #F8FAFC
  const CW2 = [255, 255, 255];  // white
  const CBK = [15,  23,  42];   // black    #0F172A

  let y = MT;

  // ── Utilitários de renderização ─────────────────────────────────────────────

  function checkBreak(needed) {
    if (y + needed > MAX_Y) { doc.addPage(); y = MT; }
  }

  function setF(sz, bold, mono) {
    doc.setFont(mono ? FM : F, bold ? 'bold' : 'normal');
    doc.setFontSize(sz);
    doc.setTextColor(...CBK);
  }

  /**
   * Imprime texto com wrap automático. Retorna número de sub-linhas.
   */
  function txt(text, opts) {
    const { sz = 10, bold = false, mono = false,
            align = 'left', x = ML, color = null, maxW = null } = opts || {};
    const lhv  = lh(sz);
    const mw   = maxW || (align === 'center' ? CW : CW - (x - ML));
    const xpos = align === 'center' ? PW / 2 : align === 'right' ? MR : x;
    setF(sz, bold, mono);
    if (color) doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text ?? ''), mw);
    for (var i = 0; i < lines.length; i++) {
      checkBreak(lhv + 1);
      doc.text(lines[i], xpos, y, { align });
      y += lhv;
    }
    if (color) doc.setTextColor(...CBK);
    return lines.length;
  }

  function hline(color, weight) {
    checkBreak(4);
    doc.setDrawColor(...(color || [80, 80, 100]));
    doc.setLineWidth(weight || 0.4);
    doc.line(ML, y, MR, y);
    y += 3;
  }

  function thinLine() {
    checkBreak(3);
    doc.setDrawColor(...CLG);
    doc.setLineWidth(0.2);
    doc.line(ML, y, MR, y);
    y += 2.5;
  }

  /** Título de seção com barra lateral colorida. */
  function sectionTitle(label, color) {
    y += 6;
    checkBreak(lh(10) + 8);
    const c = color || CN;
    doc.setFillColor(...c);
    doc.rect(ML, y - 4.5, 3, lh(10) + 1.5, 'F');
    setF(10, true);
    doc.setTextColor(...c);
    doc.text(label, ML + 5, y);
    doc.setTextColor(...CBK);
    y += lh(10);
    doc.setDrawColor(...c);
    doc.setLineWidth(0.25);
    doc.line(ML + 5, y, MR, y);
    y += 4;
  }

  /** Subtítulo (negrito menor). */
  function subTitle(label) {
    y += 3;
    checkBreak(lh(9) + 3);
    setF(9, true);
    doc.setTextColor(...CN);
    doc.text(label, ML, y);
    doc.setTextColor(...CBK);
    y += lh(9) + 1;
  }

  // Formatadores
  const fI = function (n) {
    return new Intl.NumberFormat('pt-BR').format(Math.round(n));
  };
  const fN = function (n, d) {
    d = (d === undefined) ? 2 : d;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: d, maximumFractionDigits: d,
    }).format(n);
  };

  // Data/hora
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const hh   = String(now.getHours()).padStart(2, '0');
  const mi   = String(now.getMinutes()).padStart(2, '0');
  const ss   = String(now.getSeconds()).padStart(2, '0');
  const dataHora = `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  const dataNome = `${yyyy}${mm}${dd}`;

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CABEÇALHO
  // ════════════════════════════════════════════════════════════════════════════

  // Título principal
  setF(16, true);
  doc.setTextColor(...CN);
  doc.text('Sistema RetotalizaJE', PW / 2, y, { align: 'center' });
  y += lh(16) + 1;

  // Subtítulo
  setF(9, false);
  doc.setTextColor(...CGR);
  doc.text('SISTEMA PROPORCIONAL BRASILEIRO · ART. 109 CE', PW / 2, y, { align: 'center' });
  y += lh(9) + 2;

  // Badge legal (caixa navy)
  const badgeTxt = 'ADIs 7.228/7.263/7.325 — STF 13/03/2025';
  setF(8, true);
  const bw = doc.getTextWidth(badgeTxt) + 10;
  const bx = (PW - bw) / 2;
  doc.setFillColor(...CN);
  doc.roundedRect(bx, y - 4, bw, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...CW2);
  doc.text(badgeTxt, PW / 2, y, { align: 'center' });
  doc.setTextColor(...CBK);
  y += lh(8) + 3;

  // Linha de metadados
  setF(8.5, false);
  doc.setTextColor(...CGR);
  doc.text(
    `Pleito: ${resultado.rotulo}   ·   Gerado em: ${dataHora}`,
    PW / 2, y, { align: 'center' }
  );
  doc.setTextColor(...CBK);
  y += lh(8.5) + 3;

  // Divisor pesado
  doc.setDrawColor(...CN);
  doc.setLineWidth(0.6);
  doc.line(ML, y, MR, y);
  y += 6;

  // ════════════════════════════════════════════════════════════════════════════
  // 2. KPI CARDS (2 × 4)
  // ════════════════════════════════════════════════════════════════════════════

  const CARD_COLS = 4;
  const CARD_GAP  = 2;
  const CARD_W    = (CW - (CARD_COLS - 1) * CARD_GAP) / CARD_COLS; // ≈ 43 mm
  const CARD_H    = 18;

  function drawCard(cx, cy, label, value, sub, accentColor) {
    // Fundo
    doc.setFillColor(...CSF);
    doc.setDrawColor(...CLG);
    doc.setLineWidth(0.15);
    doc.roundedRect(cx, cy, CARD_W, CARD_H, 1.5, 1.5, 'FD');
    // Faixa de cor no topo (retângulo simples, fica sob arredondamentos)
    doc.setFillColor(...accentColor);
    doc.rect(cx, cy, CARD_W, 2, 'F');

    // Label
    setF(6, true);
    doc.setTextColor(...CGR);
    doc.text(String(label), cx + CARD_W / 2, cy + 6, { align: 'center' });

    // Value
    setF(11, true);
    doc.setTextColor(...accentColor);
    const valStr = String(value);
    // Se valor grande demais, reduz tamanho
    const valSz = valStr.length > 10 ? 9 : 11;
    setF(valSz, true);
    doc.text(valStr, cx + CARD_W / 2, cy + 12.5, { align: 'center' });

    // Sub-label
    if (sub) {
      setF(5.5, false);
      doc.setTextColor(...CGR);
      doc.text(String(sub), cx + CARD_W / 2, cy + 16.5, { align: 'center' });
    }
    doc.setTextColor(...CBK);
  }

  checkBreak(CARD_H * 2 + CARD_GAP + 6);

  var row1 = [
    { label: 'VOTOS VÁ LIDOS',       v: fI(resultado.votosValidos), sub: 'nominais + legenda',          c: CB },
    { label: 'QUOCIENTE ELEITORAL',  v: fI(resultado.qe),           sub: '÷ ' + resultado.vagas + ' vagas', c: CB },
    { label: 'BARREIRA 80% QE',      v: fN(resultado.barreira80),   sub: 'mínimo para Fase 2',          c: CA },
    { label: 'PISO 20% QE',          v: fN(resultado.piso20),       sub: 'candidato elegível F2',       c: CA },
  ];
  // Fix label spacing
  row1[0].label = 'VOTOS VÁLIDOS';

  var row2 = [
    { label: 'VAGAS TOTAIS',  v: resultado.vagas,    sub: 'ofertadas',      c: CG },
    { label: 'QPs — F1', v: resultado.totalQPs, sub: 'vagas diretas',  c: CG },
    { label: 'SOBRAS',        v: resultado.sobras,   sub: 'para F2 e F3',   c: CGR },
    {
      label: 'FASE 3',
      v:     resultado.fase3Ativada ? 'ATIVADA' : 'inativa',
      sub:   resultado.fase3Ativada ? 'ADIs 7.228/7.263/7.325' : '—',
      c:     resultado.fase3Ativada ? CR : CGR,
    },
  ];

  var r1y = y;
  row1.forEach(function (c, i) {
    drawCard(ML + i * (CARD_W + CARD_GAP), r1y, c.label, c.v, c.sub, c.c);
  });
  y += CARD_H + CARD_GAP;

  var r2y = y;
  row2.forEach(function (c, i) {
    drawCard(ML + i * (CARD_W + CARD_GAP), r2y, c.label, c.v, c.sub, c.c);
  });
  y += CARD_H + 7;

  // ════════════════════════════════════════════════════════════════════════════
  // 3. BANNER DE ALERTA FASE 3 (se ativada)
  // ════════════════════════════════════════════════════════════════════════════

  if (resultado.fase3Ativada) {
    setF(9, false);
    var f3body   = resultado.fase3Motivo ||
      'Fase 3 ativada — sem barreira partidária (ADIs 7.228/7.263/7.325 STF).';
    var f3prefix = 'FASE 3 ATIVADA — ';
    var f3lines  = doc.splitTextToSize(f3prefix + f3body, CW - 14);
    var bannerH  = f3lines.length * lh(9) + 10;

    checkBreak(bannerH + 4);
    doc.setFillColor(255, 248, 230);
    doc.setDrawColor(...CA);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, bannerH, 2, 2, 'FD');
    doc.setFillColor(...CA);
    doc.rect(ML, y, 3, bannerH, 'F');

    y += 5;
    // Primeira linha em negrito (o prefixo)
    setF(9, true);
    doc.setTextColor(...CA);
    var prefixW = doc.getTextWidth(f3prefix);
    doc.text(f3prefix, ML + 5.5, y);
    // Resto em normal
    setF(9, false);
    doc.setTextColor(80, 50, 0);
    var firstRemainder = f3lines[0].replace(f3prefix, '');
    doc.text(firstRemainder, ML + 5.5 + prefixW, y);
    y += lh(9);
    for (var li = 1; li < f3lines.length; li++) {
      checkBreak(lh(9) + 1);
      doc.text(f3lines[li], ML + 5.5, y);
      y += lh(9);
    }
    doc.setTextColor(...CBK);
    y += 6;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. TABELA DE DISTRIBUIÇÃO DE CADEIRAS
  // ════════════════════════════════════════════════════════════════════════════

  sectionTitle('DISTRIBUIÇÃO DE CADEIRAS POR PARTIDO', CN);

  // Mapeamento de status
  var statusLabel = {
    'eleito':               'Eleito',
    'barrado_80':           'Barrado (< 80% QE)',
    'fase3_apenas':         'Eleito (F3)',
    'qualificado_sem_vaga': 'Qualif. / sem vaga',
  };

  // Largura dinâmica da coluna PARTIDO baseada na sigla mais longa
  var maxSigla = Math.max(8, Math.min(26,
    resultado.partidos.reduce(function (m, p) {
      return Math.max(m, (p.sigla || '').length);
    }, 0) * 2 + 4
  ));

  if (doc.autoTable) {
    doc.autoTable({
      startY: y,
      margin: { left: ML, right: PW - MR },
      styles: {
        font:       F,
        fontSize:   7.5,
        cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
        overflow:   'linebreak',
        textColor:  CBK,
        lineColor:  CLG,
        lineWidth:  0.12,
      },
      headStyles: {
        font:       F,
        fontStyle:  'bold',
        fontSize:   7,
        fillColor:  CN,
        textColor:  CW2,
        cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      },
      alternateRowStyles: { fillColor: CSF },
      columnStyles: {
        0: { cellWidth: maxSigla,  fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 19, halign: 'right',  font: FM },
        3: { cellWidth: 14, halign: 'right',  font: FM },
        4: { cellWidth: 6,  halign: 'center', font: FM },
        5: { cellWidth: 6,  halign: 'center', font: FM },
        6: { cellWidth: 6,  halign: 'center', font: FM },
        7: { cellWidth: 9,  halign: 'center', font: FM, fontStyle: 'bold' },
        8: { cellWidth: 26 },
      },
      head: [['PARTIDO', 'NOME', 'VOTOS', '% QE', 'F1', 'F2', 'F3', 'TOTAL', 'STATUS']],
      body: resultado.partidos.map(function (p) {
        return [
          p.sigla,
          p.nome,
          fI(p.votos),
          (p.percentualQE * 100).toFixed(1) + '%',
          p.qp      || 0,
          p.sobrasF2 || 0,
          p.sobrasF3 || 0,
          p.total    || 0,
          statusLabel[p.status] || p.status || '',
        ];
      }),
      didParseCell: function (data) {
        if (data.section !== 'body') return;
        var p = resultado.partidos[data.row.index];
        if (!p) return;
        // Cor coluna STATUS
        if (data.column.index === 8) {
          if (p.status === 'eleito' || p.status === 'fase3_apenas') {
            data.cell.styles.textColor = CG;
          } else if (p.status === 'barrado_80') {
            data.cell.styles.textColor = CR;
          } else {
            data.cell.styles.textColor = CGR;
          }
        }
        // Cor coluna TOTAL (destacar > 0)
        if (data.column.index === 7 && p.total > 0) {
          data.cell.styles.textColor = CB;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 3;
  } else {
    txt('(jsPDF-AutoTable não carregado — tabela não disponível)', { sz: 9, color: CR });
    y += 4;
  }

  // Linha de total
  thinLine();
  var totF1 = resultado.partidos.reduce(function (s, p) { return s + (p.qp || 0); }, 0);
  var totF2 = resultado.partidos.reduce(function (s, p) { return s + (p.sobrasF2 || 0); }, 0);
  var totF3 = resultado.partidos.reduce(function (s, p) { return s + (p.sobrasF3 || 0); }, 0);
  var totAl = resultado.partidos.reduce(function (s, p) { return s + (p.total || 0); }, 0);
  setF(8.5, true);
  doc.setTextColor(...CN);
  doc.text(
    'TOTAL GERAL:   F1 = ' + totF1 +
    '   F2 = ' + totF2 +
    '   F3 = ' + totF3 +
    '   VAGAS PREENCHIDAS = ' + totAl + ' / ' + resultado.vagas,
    ML, y
  );
  doc.setTextColor(...CBK);
  y += lh(8.5) + 4;

  // ════════════════════════════════════════════════════════════════════════════
  // 4b. CANDIDATOS POR PARTIDO — ORDEM DE PREFERÊNCIA
  // ════════════════════════════════════════════════════════════════════════════
  if (cenario) {
    var partidosComCandsPDF = resultado.partidos.filter(function(p) {
      var pc = (cenario.partidos || []).find(function(cp) { return cp.sigla === p.sigla; });
      return pc && pc.candidatos && pc.candidatos.length > 0;
    });
    if (partidosComCandsPDF.length > 0) {
      sectionTitle('CANDIDATOS POR PARTIDO — ORDEM DE PREFERÊNCIA', CN);

      var candRows = [];
      for (var ci = 0; ci < partidosComCandsPDF.length; ci++) {
        var pCand = partidosComCandsPDF[ci];
        var pcCand = (cenario.partidos || []).find(function(cp) { return cp.sigla === pCand.sigla; });
        var eleitosCand = pCand.eleitos || [];
        var eleitosMapC = {};
        eleitosCand.forEach(function(c) { eleitosMapC[c.nome] = true; });
        var suplentesCand = (pcCand.candidatos || [])
          .filter(function(c) { return !c.cassado && !eleitosMapC[c.nome]; })
          .sort(function(a, b) { return b.votos - a.votos; });
        var todosCand = eleitosCand.map(function(c) {
            return { sigla: pCand.sigla, nome: c.nome, votos: c.votos, status: 'Eleito' };
          }).concat(suplentesCand.map(function(c) {
            return { sigla: '', nome: c.nome, votos: c.votos, status: 'Suplente' };
          }));
        todosCand.forEach(function(c, idx) {
          candRows.push({ sigla: idx === 0 ? pCand.sigla : '', pos: idx + 1, nome: c.nome, votos: fI(c.votos), status: c.status });
        });
      }

      if (doc.autoTable) {
        doc.autoTable({
          startY: y,
          margin: { left: ML, right: PW - MR },
          styles: { font: F, fontSize: 8.5, cellPadding: 2 },
          headStyles: { fillColor: CN, textColor: CW2, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: CSF },
          columnStyles: {
            0: { cellWidth: 24, fontStyle: 'bold' },
            1: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 22, halign: 'center' },
          },
          head: [['PARTIDO', 'Nº', 'CANDIDATO', 'VOTOS', 'STATUS']],
          body: candRows.map(function(r) {
            return [r.sigla, r.pos, r.nome, r.votos, r.status];
          }),
          didParseCell: function(data) {
            if (data.section !== 'body') return;
            var row = candRows[data.row.index];
            if (!row) return;
            if (data.column.index === 4) {
              data.cell.styles.textColor = row.status === 'Eleito' ? CG : CGR;
              data.cell.styles.fontStyle = row.status === 'Eleito' ? 'bold' : 'normal';
            }
          },
        });
        y = doc.lastAutoTable.finalY + 5;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. EXECUÇÃO PASSO A PASSO — AUDITORIA D'HONDT
  // ════════════════════════════════════════════════════════════════════════════

  if (resultado.auditoria && resultado.auditoria.length > 0) {
    sectionTitle('EXECUÇÃO PASSO A PASSO — ALGORITMO D\u2019HONDT', CN);

    // 5a. Resumo de todas as rodadas
    subTitle('Resumo das rodadas');
    if (doc.autoTable) {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: PW - MR },
        styles: {
          font: F, fontSize: 8, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
          overflow: 'linebreak', textColor: CBK, lineColor: CLG, lineWidth: 0.12,
        },
        headStyles: {
          font: F, fontStyle: 'bold', fontSize: 7.5,
          fillColor: CN, textColor: CW2,
        },
        alternateRowStyles: { fillColor: CSF },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center', font: FM },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 20 },
          3: { cellWidth: 24, halign: 'right', font: FM },
          4: { cellWidth: 'auto' },
        },
        head: [['RD', 'FASE', 'VENCEDOR', 'MÉDIA', 'CANDIDATO CONVOCADO']],
        body: resultado.auditoria.map(function (r) {
          return [
            r.rodada,
            r.fase === 2 ? 'F2 — 80/20' : 'F3 — ADIs',
            r.vencedor,
            fN(r.mediaVencedor),
            r.candidatoConvocado ? r.candidatoConvocado.nome : '(sem lista)',
          ];
        }),
        didParseCell: function (data) {
          if (data.section !== 'body') return;
          var r = resultado.auditoria[data.row.index];
          if (!r) return;
          if (data.column.index === 1) {
            data.cell.styles.textColor = r.fase === 2 ? CG : CA;
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = doc.lastAutoTable.finalY + 5;
    }

    // 5b. Detalhamento por rodada
    subTitle('Detalhamento por rodada — Médias completas');

    resultado.auditoria.forEach(function (rodada) {
      if (!rodada.medias || rodada.medias.length === 0) return;

      var faseColor = rodada.fase === 2 ? CG : CA;
      var faseTag   = rodada.fase === 2 ? 'F2' : 'F3';

      // Header da rodada
      checkBreak(lh(8) * (Math.min(rodada.medias.length, 5) + 2) + 10);
      y += 1;
      setF(8, true);
      doc.setTextColor(...faseColor);
      doc.text('Rodada ' + rodada.rodada + ' — ' + faseTag, ML, y);

      var vencStr = '  Vencedor: ' + rodada.vencedor +
        '   Média: ' + fN(rodada.mediaVencedor);
      if (rodada.candidatoConvocado) {
        vencStr += '   →  ' + rodada.candidatoConvocado.nome +
          ' (' + fI(rodada.candidatoConvocado.votos) + ' votos)';
      }
      setF(7.5, false);
      doc.setTextColor(...CGR);
      doc.text(vencStr, ML + 28, y);
      doc.setTextColor(...CBK);
      y += lh(8) + 1;

      // Tabela de médias da rodada
      if (doc.autoTable) {
        doc.autoTable({
          startY: y,
          margin: { left: ML + 4, right: PW - MR },
          styles: {
            font: F, fontSize: 6.5,
            cellPadding: { top: 0.8, right: 1.2, bottom: 0.8, left: 1.2 },
            overflow: 'linebreak', textColor: CBK, lineColor: CLG, lineWidth: 0.1,
          },
          headStyles: {
            font: F, fontStyle: 'bold', fontSize: 6,
            fillColor: [210, 218, 232], textColor: CN,
          },
          alternateRowStyles: { fillColor: [252, 253, 254] },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 20, halign: 'right',  font: FM },
            2: { cellWidth: 10, halign: 'center', font: FM },
            3: { cellWidth: 20, halign: 'right',  font: FM },
            4: { cellWidth: 14, halign: 'center' },
            5: { cellWidth: 14, halign: 'center', font: FM },
            6: { cellWidth: 16, halign: 'center' },
          },
          head: [['PARTIDO', 'VOTOS', 'CADS+1', 'MÉDIA', '≥ 80% QE', 'CAND. ≥ 20%', 'PARTICIPA?']],
          body: rodada.medias.map(function (m) {
            var cand20str = m.candidatos20disponiveis < 0 ? '—' : String(m.candidatos20disponiveis);
            return [
              m.sigla,
              fI(m.votos),
              String(m.cadeirasMaisUm),
              fN(m.media),
              m.qualificado80 ? 'Sim' : 'Não',
              cand20str,
              m.participaDaRodada ? 'Sim' : '—',
            ];
          }),
          didParseCell: function (data) {
            if (data.section !== 'body') return;
            var m = rodada.medias[data.row.index];
            if (!m) return;
            if (m.sigla === rodada.vencedor) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = faseColor;
            } else if (!m.participaDaRodada) {
              data.cell.styles.textColor = CGR;
            }
          },
        });
        y = doc.lastAutoTable.finalY + 4;
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. COMPARATIVO (somente se houver cenário original)
  // ════════════════════════════════════════════════════════════════════════════

  if (original) {
    sectionTitle('COMPARATIVO: CENÁRIO ORIGINAL × RETOTALIZADO', CN);

    txt('Cenário de referência (original):    ' + original.rotulo,  { sz: 9 });
    txt('Cenário recalculado (retotalizado): ' + resultado.rotulo, { sz: 9 });
    y += 3;

    var siglas = new Set(
      original.partidos.map(function (p) { return p.sigla; }).concat(
      resultado.partidos.map(function (p) { return p.sigla; }))
    );

    var cmpRows = [];
    var vagasAlter = [];
    siglas.forEach(function (sig) {
      var o = original.partidos.find(function (p) { return p.sigla === sig; });
      var r = resultado.partidos.find(function (p) { return p.sigla === sig; });
      var ot = o ? o.total : 0;
      var rt = r ? r.total : 0;
      var dt = rt - ot;
      var nome = (r || o).nome;
      var obs  = dt > 0 ? 'GANHOU +' + dt : dt < 0 ? 'PERDEU ' + dt : 'Sem alteração';
      if (dt !== 0) vagasAlter.push({ sig: sig, nome: nome, ot: ot, rt: rt, dt: dt });
      cmpRows.push([sig, nome, ot, rt, (dt >= 0 ? '+' : '') + dt, obs]);
    });

    if (doc.autoTable) {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: PW - MR },
        styles: {
          font: F, fontSize: 7.5, cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
          overflow: 'linebreak', textColor: CBK, lineColor: CLG, lineWidth: 0.12,
        },
        headStyles: { font: F, fontStyle: 'bold', fontSize: 7, fillColor: CN, textColor: CW2 },
        alternateRowStyles: { fillColor: CSF },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 17, halign: 'center', font: FM },
          3: { cellWidth: 17, halign: 'center', font: FM },
          4: { cellWidth: 14, halign: 'center', font: FM },
          5: { cellWidth: 28 },
        },
        head: [['PARTIDO', 'NOME', 'ORIGINAL', 'RETOTAL.', 'Δ VAGAS', 'OBSERVAÇÃO']],
        body: cmpRows,
        didParseCell: function (data) {
          if (data.section !== 'body') return;
          if (data.column.index === 5) {
            var row = cmpRows[data.row.index];
            var delta = row ? parseInt(String(row[4])) : 0;
            data.cell.styles.textColor = delta > 0 ? CG : delta < 0 ? CR : CGR;
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    if (vagasAlter.length > 0) {
      subTitle('Mudanças de titularidade:');
      vagasAlter.forEach(function (v) {
        txt(
          '• ' + v.sig + ' (' + v.nome + '): ' +
          v.ot + ' vaga(s) → ' + v.rt + ' vaga(s)  (variação: ' +
          (v.dt > 0 ? '+' + v.dt : v.dt) + ')',
          { sz: 8.5, x: ML + 3 }
        );
      });
      y += 3;
    } else {
      txt('Nenhuma vaga mudou de titularidade entre os dois cenários.', { sz: 9 });
      y += 3;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. ALERTAS JURÍDICOS
  // ════════════════════════════════════════════════════════════════════════════

  var alertasJur = (resultado.alertas || []).filter(function (a) {
    return a.includes('ALERTA JURÍDICO') ||
      (a.includes('FASE 3 ATIVADA') && a.length > 50);
  });

  if (alertasJur.length > 0) {
    sectionTitle('ALERTAS JURÍDICOS', CR);
    alertasJur.forEach(function (alerta) {
      y += 1;
      txt('• ' + alerta, { sz: 8.5, x: ML + 2, color: [140, 10, 10] });
      y += 1;
    });
    y += 2;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. METODOLOGIA E FUNDAMENTOS JURÍDICOS
  // ════════════════════════════════════════════════════════════════════════════

  sectionTitle('METODOLOGIA E FUNDAMENTOS JURÍDICOS', CN);

  var metodoBlocks = [
    { h: 'FERRAMENTA',
      b: 'Sistema RetotalizaJE v2.0. Apoio técnico-jurídico ao cálculo de distribuição proporcional de cadeiras em eleições legislativas brasileiras, com suporte a cenários de retotalização por cassação de mandato.' },
    { h: 'FUNDAMENTOS JURÍDICOS', b: null },
    { h: null, b: '• Art. 106 CE: QE = floor(total de votos válidos ÷ número de vagas).' },
    { h: null, b: '• Art. 109, I, CE: Fase 1 — quociente partidário; vagas = floor(votos do partido ÷ QE).' },
    { h: null, b: '• Art. 109, II, CE (Lei 14.211/2021): Fase 2 — D\u2019Hondt com barreira de 80% QE e piso individual de 20% QE por candidato convocado.' },
    { h: null, b: '• ADIs 7.228, 7.263 e 7.325 (STF, 13/03/2025, Min. Flávio Dino): Fase 3 — D\u2019Hondt sem barreira partidária. Declarada a inconstitucionalidade do art. 111 CE (distritão residual); vagas restantes não são preenchidas pelo critério de maior votação individual.' },
    { h: 'PRECISÃO ARITMÉTICA', b: null },
    { h: null, b: '• Divisão inteira por truncamento — floor(a/b) — sem arredondamento em QE e QP.' },
    { h: null, b: '• Comparação de médias D\u2019Hondt com tolerância ε = 1×10⁻¹⁰ (proteção contra erro de ponto flutuante).' },
    { h: null, b: '• Em caso de empate exato de médias, prevalece a ordem de entrada dos partidos (desempate por art. 108 CE — mais idoso — não implementado).' },
    { h: 'INTERPRETAÇÃO DA FASE 3', b: 'Expansiva — piso individual de 20% QE suprimido na Fase 3 (padrão pós-ADIs 7.228/7.263/7.325 STF).' },
    { h: 'FONTES JURÍDICAS', b: null },
    { h: null, b: '• Código Eleitoral (Lei n.º 4.737/1965), arts. 106, 107, 108, 109 e 111 — redação da Lei n.º 14.211/2021.' },
    { h: null, b: '• Resolução TSE n.º 23.677/2021 (art. 13 declarado inconstitucional).' },
    { h: null, b: '• Resolução TSE n.º 23.735/2024.' },
    { h: null, b: '• STF, ADIs 7.228, 7.263 e 7.325 — julgamento de mérito e ED (13/03/2025).' },
    { h: null, b: '• Ato n.º 209/2025 da Mesa da Câmara dos Deputados.' },
  ];

  metodoBlocks.forEach(function (blk) {
    if (blk.h && blk.b) {
      y += 1;
      checkBreak(lh(9) * 2 + 2);
      setF(9, true);
      doc.setTextColor(...CN);
      doc.text(blk.h + ':', ML, y);
      doc.setTextColor(...CBK);
      y += lh(9);
      txt(blk.b, { sz: 9, x: ML + 2 });
      y += 1;
    } else if (blk.h) {
      y += 3;
      checkBreak(lh(9) + 3);
      setF(9, true);
      doc.setTextColor(...CN);
      doc.text(blk.h + ':', ML, y);
      doc.setTextColor(...CBK);
      y += lh(9);
    } else if (blk.b) {
      txt(blk.b, { sz: 8.5, x: ML + 2 });
    }
  });

  // Caixa de disclaimer
  y += 4;
  setF(9, false);
  var discTxt = 'AVISO: Instrumento de apoio técnico-jurídico. Não substitui decisão da Justiça Eleitoral. ' +
    'Os resultados apresentados têm caráter informativo e devem ser validados pela autoridade eleitoral ' +
    'competente. Os dados de entrada são de responsabilidade exclusiva do usuário.';
  var discLines = doc.splitTextToSize(discTxt, CW - 12);
  var discH     = discLines.length * lh(9) + 10;
  checkBreak(discH + 4);
  doc.setFillColor(255, 248, 230);
  doc.setDrawColor(...CA);
  doc.setLineWidth(0.35);
  doc.roundedRect(ML, y, CW, discH, 2, 2, 'FD');
  doc.setFillColor(...CA);
  doc.rect(ML, y, 3, discH, 'F');
  y += 6;
  setF(9, true);
  doc.setTextColor(110, 55, 0);
  discLines.forEach(function (line) {
    checkBreak(lh(9) + 1);
    doc.text(line, ML + 5.5, y);
    y += lh(9);
  });
  doc.setTextColor(...CBK);
  y += 4;

  // ════════════════════════════════════════════════════════════════════════════
  // RODAPÉ (todas as páginas)
  // ════════════════════════════════════════════════════════════════════════════

  var totalPgs = doc.getNumberOfPages();
  for (var pg = 1; pg <= totalPgs; pg++) {
    doc.setPage(pg);

    // Linha divisória
    doc.setDrawColor(...CLG);
    doc.setLineWidth(0.25);
    doc.line(ML, PH - FOOTER_H + 1, MR, PH - FOOTER_H + 1);

    // Linha 1 — Brand principal + número de página
    doc.setFont(F, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...CN);
    doc.text('Sistema RetotalizaJE', ML, PH - FOOTER_H + 6);
    doc.setFont(F, 'normal');
    doc.setTextColor(...CGR);
    doc.text('Pág. ' + pg + ' de ' + totalPgs, MR, PH - FOOTER_H + 6, { align: 'right' });

    // Linha 2 — Identificação institucional + pleito + data
    doc.setFontSize(6.5);
    doc.setTextColor(150, 155, 170);
    doc.text(
      'Calculadora de Retotalização Eleitoral — art. 109 CE · ADIs 7.228/7.263/7.325 STF',
      ML, PH - FOOTER_H + 11
    );
    doc.text(
      resultado.rotulo + '   ·   ' + dataHora,
      MR, PH - FOOTER_H + 11, { align: 'right' }
    );
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────
  var rotuloSafe = resultado.rotulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 50);

  doc.save('RetotalizaJE_' + rotuloSafe + '_' + dataNome + '.pdf');
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
