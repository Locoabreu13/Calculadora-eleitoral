/**
 * runner.js — Suite de testes automatizados do algoritmo eleitoral.
 *
 * Ativação: Shift+Click no título principal da página (h1).
 * Depende de: engine.js (window.ElectoralEngine)
 */
(function () {
  'use strict';

  // ─── Mini framework de asserções ───────────────────────────────────────────────

  function tc(id, nome, descricao) {
    return { id, nome, descricao, asserts: [], passou: true, pendente: false };
  }

  function assertEquals(t, obtido, esperado, msg) {
    const ok = obtido === esperado;
    if (!ok) t.passou = false;
    t.asserts.push({ ok, msg, obtido, esperado, tipo: 'eq' });
  }

  function assertTrue(t, cond, msg, obtido, esperado) {
    const ok = !!cond;
    if (!ok) t.passou = false;
    t.asserts.push({ ok, msg, obtido: obtido ?? cond, esperado: esperado ?? true, tipo: 'bool' });
  }

  function assertContains(t, str, sub, msg) {
    const ok = (typeof str === 'string') && str.includes(sub);
    if (!ok) t.passou = false;
    t.asserts.push({ ok, msg, obtido: str, esperado: `contém "${sub}"`, tipo: 'contains' });
  }

  function nota(t, msg) {
    t.asserts.push({ ok: null, msg, tipo: 'nota' });
  }

  // ─── TC-01 ─────────────────────────────────────────────────────────────────────
  // Fase 3 ativada por esgotamento de candidatos ≥ 20% QE após F1
  // (Nota: a spec original diz "Gatilho 1 — nenhum partido atinge 80% QE",
  //  mas matematicamente A/B/C todos passam a barreira 80%. O Gatilho correto
  //  é o 2: todos esgotam candidatos 20% após F1. O teste documenta isso.)
  function tc01() {
    const t = tc('TC-01',
      'Fase 3 por esgotamento de candidatos ≥ 20% QE após F1',
      'Vagas=4. A:750, B:700, C:600. QE=512. Todos têm QP=1 (F1=3 vagas). ' +
      'Candidatos residuais de todos ficam abaixo de 20% QE (102) → Gatilho 2 ativa F3 com 1 sobra.');

    const r = ElectoralEngine.calcular({
      rotulo: 'TC-01', vagas: 4,
      partidos: [
        { sigla: 'A', nome: 'A', votosNominais: 750, votosLegenda: 0,
          candidatos: [{ nome: 'A1', partido: 'A', votos: 700 },
                       { nome: 'A2', partido: 'A', votos: 50 }] },
        { sigla: 'B', nome: 'B', votosNominais: 700, votosLegenda: 0,
          candidatos: [{ nome: 'B1', partido: 'B', votos: 650 },
                       { nome: 'B2', partido: 'B', votos: 50 }] },
        { sigla: 'C', nome: 'C', votosNominais: 600, votosLegenda: 0,
          candidatos: [{ nome: 'C1', partido: 'C', votos: 550 },
                       { nome: 'C2', partido: 'C', votos: 50 }] },
      ],
    });

    const total = r.partidos.reduce((s, p) => s + p.total, 0);
    const totalF2 = r.partidos.reduce((s, p) => s + p.sobrasF2, 0);
    const totalF3 = r.partidos.reduce((s, p) => s + p.sobrasF3, 0);

    assertEquals(t, r.qe,       512, 'QE = intDiv(2050, 4) = 512');
    assertEquals(t, r.totalQPs,   3, 'F1: A, B e C têm QP=1 cada → 3 vagas diretas');
    assertEquals(t, totalF2,      0, 'F2 = 0 sobras (todos esgotam candidatos ≥ 20% QE após F1)');
    assertTrue  (t, r.fase3Ativada, 'Fase 3 ativada', r.fase3Ativada, true);
    assertEquals(t, totalF3,      1, 'F3 = 1 sobra (a única restante)');
    assertEquals(t, total,        4, 'Total = 4 vagas distribuídas (sem vaga não preenchida)');

    const gatilho2 = r.alertas.some(a => a.includes('Gatilho 2'));
    assertTrue(t, gatilho2, 'Gatilho 2 registrado (esgotamento cands. 20% QE — não Gatilho 1)', gatilho2, true);

    nota(t, '⚠ A spec original diz "Gatilho 1 — nenhum atinge 80% QE", o que é matematicamente ' +
            'incorreto (750, 700 e 600 > 80% de 512=409). O Gatilho correto é o 2.');

    return t;
  }

  // ─── TC-02 ─────────────────────────────────────────────────────────────────────
  // F2: esgotamento de candidatos elegíveis após distribuição de QPs
  function tc02() {
    const t = tc('TC-02',
      'F2: esgotamento de candidatos elegíveis ≥ 20% QE',
      'Vagas=3. A:600(QP=1), B:550(QP=1), C:350(barrado 80%). ' +
      'Após F1, cands. residuais de A e B ficam abaixo de 20% QE=100 → F3 com 1 sobra. ' +
      'C vence F3 com maior média (350/1=350 > A:300 > B:275).');

    const r = ElectoralEngine.calcular({
      rotulo: 'TC-02', vagas: 3,
      partidos: [
        { sigla: 'A', nome: 'A', votosNominais: 600, votosLegenda: 0,
          candidatos: [{ nome: 'A1', partido: 'A', votos: 580 },
                       { nome: 'A2', partido: 'A', votos: 30 }] },
        { sigla: 'B', nome: 'B', votosNominais: 550, votosLegenda: 0,
          candidatos: [{ nome: 'B1', partido: 'B', votos: 530 },
                       { nome: 'B2', partido: 'B', votos: 20 }] },
        { sigla: 'C', nome: 'C', votosNominais: 350, votosLegenda: 0,
          candidatos: [{ nome: 'C1', partido: 'C', votos: 330 },
                       { nome: 'C2', partido: 'C', votos: 20 }] },
      ],
    });

    const A = r.partidos.find(p => p.sigla === 'A');
    const B = r.partidos.find(p => p.sigla === 'B');
    const C = r.partidos.find(p => p.sigla === 'C');
    const total = r.partidos.reduce((s, p) => s + p.total, 0);

    assertEquals(t, r.qe,        500, 'QE = intDiv(1500, 3) = 500');
    assertEquals(t, r.barreira80, 400, 'Barreira 80% = 400');
    assertEquals(t, r.piso20,     100, 'Piso 20% = 100');
    assertEquals(t, r.totalQPs,    2, 'F1: A(QP=1) + B(QP=1) = 2 vagas diretas');
    assertTrue  (t, r.fase3Ativada, 'Fase 3 ativada (A e B esgotaram cands. ≥ 20% QE)', r.fase3Ativada, true);
    assertEquals(t, C.sobrasF2,    0, 'C não obteve vagas via F2 (barrado pela barreira 80% QE)');
    assertEquals(t, C.sobrasF3,    1, 'C vence F3 com maior média D\'Hondt (350/1=350)');
    assertEquals(t, C.total,       1, 'C total = 1');
    assertEquals(t, A.total,       1, 'A total = 1 (só o QP da F1)');
    assertEquals(t, B.total,       1, 'B total = 1 (só o QP da F1)');
    assertEquals(t, total,         3, 'Total = 3 vagas distribuídas');

    return t;
  }

  // ─── TC-03 ─────────────────────────────────────────────────────────────────────
  // Município sem nenhum partido atingindo 80% QE — art. 111 proibido
  function tc03() {
    const t = tc('TC-03',
      'Sem partido ≥ 80% QE — art. 111 CE não aplicado (Gatilho 1)',
      'Vagas=3. Total=900, QE=300, 80% QE=240. ' +
      'Nenhum partido atinge 240 → F2 vazia → Gatilho 1 → F3 D\'Hondt direto. ' +
      'CRÍTICO: nenhuma vaga pode ser preenchida por "maior votação individual" (art. 111 inconstitucional).');

    // Totaliza 900 exatamente: legenda complementa cada partido.
    // ATENÇÃO: todos os partidos devem ficar ABAIXO de 80% QE (240).
    // A=231, B=210, C=220, D=239 → total=900, QE=300, barreira=240. Todos < 240 → Gatilho 1.
    // (D era 240 na versão anterior, o que o qualificaria para F2 — corrigido para 239.)
    const r = ElectoralEngine.calcular({
      rotulo: 'TC-03', vagas: 3,
      partidos: [
        { sigla: 'A', nome: 'A', votosNominais: 201, votosLegenda: 30,
          candidatos: [{ nome: 'A1', partido: 'A', votos: 181 },
                       { nome: 'A2', partido: 'A', votos: 20 }] },
        { sigla: 'B', nome: 'B', votosNominais: 180, votosLegenda: 30,
          candidatos: [{ nome: 'B1', partido: 'B', votos: 160 },
                       { nome: 'B2', partido: 'B', votos: 20 }] },
        { sigla: 'C', nome: 'C', votosNominais: 150, votosLegenda: 70,
          candidatos: [{ nome: 'C1', partido: 'C', votos: 130 },
                       { nome: 'C2', partido: 'C', votos: 20 }] },
        { sigla: 'D', nome: 'D', votosNominais: 149, votosLegenda: 90,
          candidatos: [{ nome: 'D1', partido: 'D', votos: 139 },
                       { nome: 'D2', partido: 'D', votos: 10 }] },
      ],
    });
    // Total partidos: 231+210+220+239 = 900 → QE=300, 80%=240. Todos < 240 → Gatilho 1.

    const total = r.partidos.reduce((s, p) => s + p.total, 0);

    assertEquals(t, r.votosValidos, 900, 'Total de votos = 900');
    assertEquals(t, r.qe,          300, 'QE = intDiv(900, 3) = 300');
    assertEquals(t, r.totalQPs,      0, 'F1 = 0 QPs (nenhum partido atinge QE=300)');
    assertTrue  (t, r.fase3Ativada,   'Fase 3 ativada (Gatilho 1)', r.fase3Ativada, true);
    assertEquals(t, total,            3, 'Todas as 3 vagas distribuídas pela F3');

    // CRÍTICO: nenhum alerta de distritão (art. 111)
    const distritao = r.alertas.some(a =>
      a.toLowerCase().includes('maior votação individual') ||
      (a.includes('não distribuída') && !a.includes('Art. 111'))
    );
    assertTrue(t, !distritao, 'Art. 111 não foi aplicado (distritão proibido)', distritao, false);

    // Gatilho 1 registrado
    const g1 = r.alertas.some(a => a.includes('Gatilho 1'));
    assertTrue(t, g1, 'Gatilho 1 registrado no log de auditoria', g1, true);

    nota(t, 'ℹ Os dados foram calibrados para D=239 (< 240 = 80% QE) de modo que nenhum ' +
            'partido qualifique a barreira F2 e o Gatilho 1 seja ativado com certeza. ' +
            'Versões anteriores usavam D=240 (≥ barreira), o que ativava o Gatilho 2 — comportamento incorreto para este TC.');

    return t;
  }

  // ─── TC-04 ─────────────────────────────────────────────────────────────────────
  // Precisão aritmética — intDiv sem arredondamento
  function tc04() {
    const t = tc('TC-04',
      'Precisão aritmética — intDiv sem arredondamento de ponto flutuante',
      'Total=1.000.001, vagas=55. QE deve ser floor(1000001/55)=18181 (não 18181,836). ' +
      'A(999.999 votos): QP=intDiv(999999,18181)=55 — preenche todas as vagas em F1. ' +
      '⚠ A spec original esperava QP=54, mas 18181×55=999.955 < 999.999 → QP correto é 55.');

    // 55 candidatos para A, decrescentes, para cobrir as 55 vagas de F1
    const candsA = Array.from({ length: 56 }, (_, i) => ({
      nome: `A${i + 1}`, partido: 'A', votos: 18200 - i,
    }));

    const r = ElectoralEngine.calcular({
      rotulo: 'TC-04', vagas: 55,
      partidos: [
        { sigla: 'A', nome: 'A', votosNominais: 999999, votosLegenda: 0, candidatos: candsA },
        { sigla: 'B', nome: 'B', votosNominais: 2,      votosLegenda: 0,
          candidatos: [{ nome: 'B1', partido: 'B', votos: 1 },
                       { nome: 'B2', partido: 'B', votos: 1 }] },
      ],
    });

    const A = r.partidos.find(p => p.sigla === 'A');
    const total = r.partidos.reduce((s, p) => s + p.total, 0);

    assertEquals(t, r.qe,   18181, 'QE = intDiv(1000001, 55) = 18181 (sem arredondamento)');
    assertEquals(t, A.qp,      55, 'QP(A) = intDiv(999999, 18181) = 55 (A preenche tudo em F1)');
    assertEquals(t, r.sobras,   0, 'Sobras = 0 (55 QPs = 55 vagas, F2/F3 não executam)');
    assertEquals(t, total,     55, 'Total = 55 vagas preenchidas');

    // Verificar que QE não foi calculado com float não truncado
    assertTrue(t, r.qe === Math.floor(1000001 / 55),
      'QE coincide com Math.floor(1000001/55) — intDiv funciona corretamente',
      r.qe, Math.floor(1000001 / 55));

    nota(t, '⚠ A spec original esperava QP=54. O valor correto é 55: ' +
            'intDiv(999999, 18181) = 55 pois 18181×55=999.955 < 999.999.');

    return t;
  }

  // ─── TC-05 ─────────────────────────────────────────────────────────────────────
  // Desempate por idade — PENDENTE (não implementado)
  function tc05() {
    const t = tc('TC-05',
      'Desempate por idade — art. 108 CE',
      'Em empate de votos entre candidatos, o mais idoso tem preferência (art. 108 CE). ' +
      'O sistema atual não possui campo de data de nascimento na interface nem lógica de desempate no engine.');
    t.pendente = true;
    t.asserts.push({
      ok: null, tipo: 'pendente',
      msg: 'PENDENTE — campo "data de nascimento" ausente na interface e no engine. ' +
           'Em caso de compareQuotients()==0 entre dois candidatos de igual votação, ' +
           'o desempate atualmente é determinado pela ordem de entrada no array (não pelo art. 108 CE).',
      obtido: 'desempate por posição no array',
      esperado: 'desempate pelo candidato mais idoso (art. 108 CE)',
    });
    return t;
  }

  // ─── Cálculo do delta ──────────────────────────────────────────────────────────

  function delta(a, e) {
    if (typeof a === 'number' && typeof e === 'number') {
      const d = a - e;
      return (d > 0 ? '+' : '') + d;
    }
    return String(a) + ' ≠ ' + String(e);
  }

  // ─── Renderização do modal ─────────────────────────────────────────────────────

  const CORES = {
    bg:        '#0d1117',
    surface:   '#161b22',
    border:    '#30363d',
    texto:     '#e6edf3',
    fraco:     '#8b949e',
    verde:     '#3fb950',
    vermelho:  '#f85149',
    amarelo:   '#d29922',
    azul:      '#58a6ff',
    laranja:   '#ffa657',
    ciano:     '#79c0ff',
    bgVerde:   '#0d2818',
    bgVerm:    '#280d0d',
    bgAmar:    '#1c1a10',
  };

  function estilo(obj) {
    return Object.entries(obj).map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      return `${prop}:${v}`;
    }).join(';');
  }

  function renderAssert(a) {
    const d = document.createElement('div');
    d.style.cssText = estilo({
      padding: '5px 0',
      borderBottom: `1px solid ${CORES.border}`,
      fontSize: '11px',
      lineHeight: '1.6',
    });

    if (a.tipo === 'nota') {
      d.innerHTML = `<span style="color:${CORES.amarelo}">📝 ${esc(a.msg)}</span>`;
    } else if (a.tipo === 'pendente') {
      d.innerHTML = `
        <span style="color:${CORES.amarelo}">⏸ ${esc(a.msg)}</span>
        <div style="padding-left:14px;margin-top:2px">
          <span style="color:${CORES.fraco}">Obtido:  </span>
          <span style="color:${CORES.laranja}">${esc(String(a.obtido))}</span>
        </div>
        <div style="padding-left:14px">
          <span style="color:${CORES.fraco}">Esperado:</span>
          <span style="color:${CORES.ciano}">${esc(String(a.esperado))}</span>
        </div>`;
    } else if (a.ok) {
      d.innerHTML = `<span style="color:${CORES.verde}">✓</span> <span style="color:${CORES.fraco}">${esc(a.msg)}</span>`;
    } else {
      d.innerHTML = `
        <div><span style="color:${CORES.vermelho}">✗</span>
             <span style="color:${CORES.vermelho}"> ${esc(a.msg)}</span></div>
        <div style="padding-left:14px">
          <span style="color:${CORES.fraco}">Obtido:  </span>
          <span style="color:${CORES.laranja}">${esc(JSON.stringify(a.obtido))}</span>
        </div>
        <div style="padding-left:14px">
          <span style="color:${CORES.fraco}">Esperado:</span>
          <span style="color:${CORES.ciano}">${esc(JSON.stringify(a.esperado))}</span>
        </div>
        <div style="padding-left:14px">
          <span style="color:${CORES.fraco}">Delta:   </span>
          <span style="color:${CORES.vermelho}">${esc(delta(a.obtido, a.esperado))}</span>
        </div>`;
    }
    return d;
  }

  function renderTC(t) {
    const cor = t.pendente ? CORES.amarelo : t.passou ? CORES.verde : CORES.vermelho;
    const bgHdr = t.pendente ? CORES.bgAmar : t.passou ? CORES.bgVerde : CORES.bgVerm;
    const bdCor = t.pendente ? '#2d2b18' : t.passou ? '#1f3d2a' : '#3d1f1f';
    const icone = t.pendente ? '⏸' : t.passou ? '✅' : '❌';

    const wrap = document.createElement('div');
    wrap.style.cssText = estilo({
      marginBottom: '18px',
      border: `1px solid ${bdCor}`,
      borderRadius: '6px',
      overflow: 'hidden',
    });

    // Cabeçalho do TC
    const hdr = document.createElement('div');
    hdr.style.cssText = estilo({
      padding: '10px 14px',
      background: bgHdr,
      borderBottom: `1px solid ${CORES.border}`,
    });
    hdr.innerHTML = `
      <div>
        <span style="color:${cor};font-weight:700">${icone} ${esc(t.id)}</span>
        <span style="color:${CORES.texto};margin-left:10px">${esc(t.nome)}</span>
      </div>
      <div style="color:${CORES.fraco};font-size:11px;margin-top:4px">${esc(t.descricao)}</div>`;
    wrap.appendChild(hdr);

    // Asserts
    const corpo = document.createElement('div');
    corpo.style.cssText = 'padding:8px 14px';
    for (const a of t.asserts) corpo.appendChild(renderAssert(a));
    wrap.appendChild(corpo);
    return wrap;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showModal(resultados) {
    const old = document.getElementById('runner-modal');
    if (old) old.remove();

    const passou  = resultados.filter(r => !r.pendente && r.passou).length;
    const falhou  = resultados.filter(r => !r.pendente && !r.passou).length;
    const pend    = resultados.filter(r => r.pendente).length;
    const total   = resultados.filter(r => !r.pendente).length;

    const overlay = document.createElement('div');
    overlay.id = 'runner-modal';
    overlay.style.cssText = estilo({
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,.87)',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    });

    const box = document.createElement('div');
    box.style.cssText = estilo({
      background: CORES.bg,
      color: CORES.texto,
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '12px',
      borderRadius: '8px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
      border: `1px solid ${CORES.border}`,
      boxShadow: '0 24px 64px rgba(0,0,0,.9)',
    });

    // Header fixo
    const hdr = document.createElement('div');
    hdr.style.cssText = estilo({
      padding: '14px 20px',
      borderBottom: `1px solid ${CORES.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: '0',
      background: CORES.bg,
      zIndex: '1',
    });
    const sumario = falhou > 0
      ? `<span style="color:${CORES.vermelho}">❌ ${falhou} falha${falhou>1?'s':''}</span> &nbsp;`
      : `<span style="color:${CORES.verde}">✅ todos passaram</span> &nbsp;`;
    hdr.innerHTML = `
      <div>
        <span style="font-weight:700;font-size:14px;color:${CORES.azul}">⚡ Suite de Testes — Algoritmo Eleitoral</span>
        <div style="margin-top:4px;font-size:11px;color:${CORES.fraco}">
          <span style="color:${CORES.verde}">✅ ${passou}/${total}</span> &nbsp;
          ${sumario}
          <span style="color:${CORES.amarelo}">⏸ ${pend} pendente${pend!==1?'s':''}</span>
        </div>
      </div>
      <button id="runner-fechar"
        style="background:none;border:1px solid ${CORES.border};color:${CORES.texto};
               cursor:pointer;border-radius:4px;padding:5px 12px;font-family:inherit;font-size:12px">
        ✕ Fechar
      </button>`;
    box.appendChild(hdr);

    // Corpo
    const corpo = document.createElement('div');
    corpo.style.cssText = 'padding:16px 20px';
    for (const r of resultados) corpo.appendChild(renderTC(r));
    box.appendChild(corpo);

    // Rodapé
    const foot = document.createElement('div');
    foot.style.cssText = estilo({
      padding: '10px 20px',
      borderTop: `1px solid ${CORES.border}`,
      color: CORES.fraco,
      fontSize: '10px',
      textAlign: 'center',
    });
    foot.textContent =
      `Executado em ${new Date().toLocaleString('pt-BR')} · Ativar: Shift+Click no título · ` +
      `engine.js v${(window.ElectoralEngine ? 'ok' : 'não carregado')}`;
    box.appendChild(foot);

    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    document.getElementById('runner-fechar').addEventListener('click', () => overlay.remove());
  }

  // ─── Executar todos os TCs ─────────────────────────────────────────────────────

  function runAll() {
    if (!window.ElectoralEngine) {
      alert('ElectoralEngine não carregado. Recarregue a página.');
      return;
    }
    let resultados;
    try {
      resultados = [tc01(), tc02(), tc03(), tc04(), tc05()];
    } catch (err) {
      alert('Erro durante execução dos testes:\n' + err.message);
      console.error(err);
      return;
    }
    showModal(resultados);
  }

  // ─── Ativação por Shift+Click no título ────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    const h1 = document.querySelector('h1');
    if (!h1) return;
    h1.title = 'Shift+Click para executar a suite de testes do algoritmo';
    h1.addEventListener('click', e => { if (e.shiftKey) runAll(); });
  });

})();
