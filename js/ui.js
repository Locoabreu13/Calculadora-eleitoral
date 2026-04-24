/**
 * ui.js — Interface do usuário e renderização.
 * Depende de: engine.js, i18n.js, presets.js, export.js
 */
(function () {
'use strict';

// ─── Estado global ──────────────────────────────────────────────────────────────

const Estado = {
  cenario: null,         // cenário atual sendo editado
  resultado: null,       // ResultadoFinal atual
  resultadoOriginal: null, // para comparação após cassação ou preset base
  presetComparar: null,  // id do preset base para comparação (comparar_com)
  presets: [],
  abaAtiva: 'entrada',
};

// ─── Utilitários DOM ────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return e;
};

function fmt(n) { return I18N.formatarNumero(Math.round(n)); }
function fmtD(n, casas = 2) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n); }
function fmtPct(n) { return fmtD(n * 100, 1) + '%'; }

// ─── Navegação por abas ─────────────────────────────────────────────────────────

function ativarAba(nome) {
  Estado.abaAtiva = nome;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === nome));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('ativo', t.id === 'aba-' + nome));
}

// ─── Gerenciamento de partidos na entrada ───────────────────────────────────────

let contadorPartido = 0;

function adicionarPartidoUI(dados = null) {
  const id = ++contadorPartido;
  const container = $('lista-partidos');

  const card = el('div', { class: 'partido-card', id: `partido-card-${id}` });

  const header = el('div', { class: 'partido-card-header' });

  const inputSigla = el('input', {
    type: 'text',
    placeholder: 'Sigla',
    'aria-label': 'Sigla do partido',
    style: 'width:100px',
    class: 'partido-sigla',
    value: dados ? dados.sigla : '',
  });
  const inputNome = el('input', {
    type: 'text',
    placeholder: 'Nome completo',
    'aria-label': 'Nome do partido',
    class: 'partido-nome grow',
    style: 'flex:1',
    value: dados ? dados.nome : '',
  });
  const inputNominais = el('input', {
    type: 'number',
    placeholder: 'Votos nominais',
    'aria-label': 'Votos nominais',
    min: '0',
    class: 'partido-nominais',
    style: 'width:130px',
    value: dados ? dados.votosNominais : '',
  });
  const inputLegenda = el('input', {
    type: 'number',
    placeholder: 'Votos legenda',
    'aria-label': 'Votos legenda',
    min: '0',
    class: 'partido-legenda',
    style: 'width:130px',
    value: dados ? dados.votosLegenda : '',
  });

  const btnRemover = el('button', {
    class: 'btn btn-perigo btn-xs',
    title: 'Remover partido',
    onclick: () => card.remove(),
  }, '✕');

  const btnToggleCandidatos = el('button', {
    class: 'btn btn-secundario btn-xs',
    title: 'Editar lista de candidatos',
    onclick: () => {
      const lista = card.querySelector('.candidatos-wrapper');
      lista.style.display = lista.style.display === 'none' ? 'block' : 'none';
    },
  }, 'Candidatos');

  header.append(inputSigla, inputNome, inputNominais, inputLegenda, btnToggleCandidatos, btnRemover);
  card.appendChild(header);

  // Lista de candidatos
  const candWrapper = el('div', { class: 'candidatos-wrapper', style: 'display:none; margin-top:8px;' });
  const candLista = el('div', { class: 'candidatos-lista' });

  const btnAdicionarCand = el('button', {
    class: 'btn btn-secundario btn-xs',
    style: 'margin-top:6px',
    onclick: () => adicionarCandidatoUI(candLista, null, inputSigla.value || 'P'),
  }, '+ Candidato');

  candWrapper.append(candLista, btnAdicionarCand);
  card.appendChild(candWrapper);

  // Preencher candidatos se houver dados
  if (dados && dados.candidatos) {
    candWrapper.style.display = 'block';
    for (const cand of dados.candidatos) {
      adicionarCandidatoUI(candLista, cand, dados.sigla);
    }
  }

  container.appendChild(card);
}

function adicionarCandidatoUI(lista, dados = null, siglaPartido = '') {
  const row = el('div', { class: 'candidato-row' });
  const inputNome = el('input', { type: 'text', placeholder: 'Nome do candidato', class: 'candidato-nome', value: dados ? dados.nome : '' });
  const inputVotos = el('input', { type: 'number', placeholder: 'Votos', class: 'candidato-votos votos', min: '0', value: dados ? dados.votos : '' });
  const inputPartido = el('input', { type: 'text', placeholder: 'Partido', class: 'candidato-partido', style: 'width:80px', value: dados ? (dados.partido || siglaPartido) : siglaPartido });
  const btnRemover = el('button', { class: 'btn btn-perigo btn-xs', onclick: () => row.remove() }, '✕');
  row.append(inputNome, inputVotos, inputPartido, btnRemover);
  lista.appendChild(row);
}

// ─── Leitura do formulário ──────────────────────────────────────────────────────

function lerFormulario() {
  const erros = [];

  const rotulo = $('input-rotulo').value.trim() || 'Pleito sem rótulo';
  const vagas = parseInt($('input-vagas').value, 10);

  if (isNaN(vagas) || vagas < 1) erros.push('Número de vagas deve ser ≥ 1.');

  const partidos = [];
  const siglasSeen = new Set();

  for (const card of document.querySelectorAll('.partido-card')) {
    const sigla = card.querySelector('.partido-sigla').value.trim();
    const nome = card.querySelector('.partido-nome').value.trim() || sigla;
    const nominais = parseInt(card.querySelector('.partido-nominais').value, 10) || 0;
    const legenda = parseInt(card.querySelector('.partido-legenda').value, 10) || 0;

    if (!sigla) { erros.push('Sigla obrigatória para todos os partidos.'); continue; }
    if (siglasSeen.has(sigla)) { erros.push(`Sigla duplicada: ${sigla}.`); continue; }
    siglasSeen.add(sigla);
    if (nominais < 0 || legenda < 0) erros.push(`Votos negativos em ${sigla}.`);

    const candidatos = [];
    let somaNominaisCandidatos = 0;
    for (const row of card.querySelectorAll('.candidato-row')) {
      const nomeC = row.querySelector('.candidato-nome').value.trim();
      const votosC = parseInt(row.querySelector('.candidato-votos').value, 10) || 0;
      const partidoC = row.querySelector('.candidato-partido').value.trim() || sigla;
      if (nomeC) {
        candidatos.push({ nome: nomeC, partido: partidoC, votos: votosC });
        somaNominaisCandidatos += votosC;
      }
    }

    // Alertar inconsistência
    if (candidatos.length > 0 && Math.abs(somaNominaisCandidatos - nominais) > nominais * 0.05 + 10) {
      erros.push(
        `AVISO: Soma dos votos dos candidatos de ${sigla} (${fmt(somaNominaisCandidatos)}) ` +
        `difere dos votos nominais informados (${fmt(nominais)}) em mais de 5%.`
      );
    }

    partidos.push({ sigla, nome, votosNominais: nominais, votosLegenda: legenda, candidatos });
  }

  if (partidos.length === 0) erros.push('Informe ao menos um partido.');

  // Cassações
  const cassacoes = [];
  for (const row of document.querySelectorAll('.cassacao-row')) {
    const partido = row.querySelector('.cass-partido').value.trim();
    const candidato = row.querySelector('.cass-candidato').value.trim();
    const votos = parseInt(row.querySelector('.cass-votos').value, 10) || 0;
    const modalidade = row.querySelector('.cass-modalidade').value;
    if (partido && votos > 0) {
      cassacoes.push({ partido, candidato: candidato || undefined, votosAnular: votos, modalidade });
    }
  }

  const cenario = { rotulo, vagas, partidos, cassacoes };
  if (Estado.presetComparar) cenario._comparar_com = Estado.presetComparar;
  return { erros, cenario };
}

// ─── Cálculo e renderização ─────────────────────────────────────────────────────

function executarCalculo() {
  const { erros, cenario } = lerFormulario();

  const erroBox = $('erros-formulario');
  erroBox.innerHTML = '';

  const avisos = erros.filter(e => e.startsWith('AVISO:'));
  const errosCriticos = erros.filter(e => !e.startsWith('AVISO:'));

  for (const av of avisos) {
    erroBox.appendChild(el('div', { class: 'alerta' }, el('div', { class: 'alerta-titulo' }, '⚠ Aviso'), av));
  }

  if (errosCriticos.length > 0) {
    for (const e of errosCriticos) {
      erroBox.appendChild(el('div', { class: 'alerta critico' }, el('div', { class: 'alerta-titulo' }, '✕ Erro'), e));
    }
    return;
  }

  // Calcular cenário original para comparação
  if (cenario.cassacoes && cenario.cassacoes.length > 0) {
    // Cassação: original é o mesmo cenário sem as cassações
    const cenarioOriginal = { ...cenario, cassacoes: [] };
    Estado.resultadoOriginal = ElectoralEngine.calcular(cenarioOriginal);
  } else if (Estado.presetComparar || cenario._comparar_com) {
    // Preset com comparar_com: carregar e calcular o preset base
    const baseId = Estado.presetComparar || cenario._comparar_com;
    const presetBase = Estado.presets.find(p => p.id === baseId);
    Estado.resultadoOriginal = presetBase ? ElectoralEngine.calcular(presetBase) : null;
  } else {
    Estado.resultadoOriginal = null;
  }

  Estado.cenario = cenario;
  Estado.resultado = ElectoralEngine.calcular(cenario);

  // Salvar no localStorage
  localStorage.setItem('ultimo_calculo', JSON.stringify({ cenario, timestamp: Date.now() }));

  renderizarResultado(Estado.resultado, Estado.resultadoOriginal);
  ativarAba('resultado');
}

// ─── Renderização do resultado ──────────────────────────────────────────────────

function renderizarResultado(resultado, original) {
  renderizarParametros(resultado);
  renderizarAlertas(resultado);
  renderizarTabelaResultado(resultado, original);
  renderizarAuditoria(resultado);
  if (original) renderizarComparativo(original, resultado);

  $('secao-comparativo').style.display = original ? 'block' : 'none';
  $('btn-exportar-csv').disabled = false;
  $('btn-exportar-pdf').disabled = false;
  $('btn-link').disabled = false;
}

function renderizarParametros(r) {
  const container = $('painel-parametros');
  container.innerHTML = '';
  const items = [
    { label: 'Votos Válidos', valor: fmt(r.votosValidos), detalhe: 'nominais + legenda' },
    { label: 'Quociente Eleitoral', valor: fmt(r.qe), detalhe: `⌊${fmt(r.votosValidos)} ÷ ${r.vagas}⌋` },
    { label: 'Barreira 80% QE', valor: fmt(r.barreira80), detalhe: 'mínimo para Fase 2' },
    { label: 'Piso 20% QE', valor: fmt(r.piso20), detalhe: 'candidato elegível F2' },
    { label: 'Vagas Totais', valor: fmt(r.vagas), detalhe: '' },
    { label: 'QPs (Fase 1)', valor: fmt(r.totalQPs), detalhe: 'vagas diretas' },
    { label: 'Sobras', valor: fmt(r.sobras), detalhe: 'vagas por maiores médias' },
    { label: 'Fase 3', valor: r.fase3Ativada ? 'ATIVADA' : 'Não', detalhe: r.fase3Ativada ? 'sem barreira 80%' : '' },
  ];

  for (const item of items) {
    const d = el('div', { class: 'param-item' });
    d.appendChild(el('div', { class: 'label' }, item.label));
    const v = el('div', { class: 'valor' }, item.valor);
    if (item.label === 'Fase 3' && r.fase3Ativada) v.style.color = 'var(--cor-fase3)';
    d.appendChild(v);
    if (item.detalhe) d.appendChild(el('div', { class: 'detalhe' }, item.detalhe));
    container.appendChild(d);
  }
}

function renderizarAlertas(r) {
  const container = $('painel-alertas');
  container.innerHTML = '';

  if (r.fase3Ativada) {
    const banner = el('div', { class: 'fase-banner fase3' });
    banner.innerHTML = `<strong>⚖ FASE 3 ATIVADA</strong> — ${r.fase3Motivo}`;
    container.appendChild(banner);
  }

  for (const alerta of r.alertas) {
    if (alerta.startsWith('FASE 3')) continue; // já mostrado no banner
    const classe = alerta.startsWith('ALERTA JURÍDICO') ? 'critico' : 'info';
    const div = el('div', { class: `alerta ${classe}` });
    const titulo = alerta.startsWith('ALERTA') ? '⚖ Alerta Jurídico' : 'ℹ Informação';
    div.appendChild(el('div', { class: 'alerta-titulo' }, titulo));
    div.appendChild(el('p', {}, alerta));
    container.appendChild(div);
  }
}

function renderizarTabelaResultado(resultado, original) {
  const container = $('tabela-resultado');

  const variacao = original ? ElectoralEngine.compararResultados(original, resultado) : {};

  const thead = el('thead');
  const ths = ['Partido', 'Nome', 'Votos Válidos', '% QE', 'F1 (QP)', 'F2 (Sobras)', 'F3 (Sobras)', 'Total'];
  if (original) ths.push('Variação');
  ths.push('Status', 'Eleitos');

  const trHead = el('tr');
  for (const h of ths) {
    const cls = ['Votos Válidos', '% QE', 'F1 (QP)', 'F2 (Sobras)', 'F3 (Sobras)', 'Total', 'Variação'].includes(h) ? 'right' : '';
    trHead.appendChild(el('th', { class: cls }, h));
  }
  thead.appendChild(trHead);

  const tbody = el('tbody');
  for (const p of resultado.partidos) {
    const statusClass = {
      eleito: 'eleito',
      qualificado_sem_vaga: 'qualificado',
      barrado_80: 'barrado',
      fase3_apenas: 'fase3',
    }[p.status] || '';

    const tr = el('tr', { class: statusClass, title: I18N.STATUS_TITLE[p.status] || '' });

    tr.appendChild(el('td', {}, el('strong', {}, p.sigla)));
    tr.appendChild(el('td', {}, p.nome));
    tr.appendChild(el('td', { class: 'right' }, fmt(p.votos)));
    tr.appendChild(el('td', { class: 'right' }, fmtPct(p.percentualQE)));
    tr.appendChild(el('td', { class: 'right center' }, String(p.qp)));
    tr.appendChild(el('td', { class: 'right center' }, String(p.sobrasF2)));
    tr.appendChild(el('td', { class: 'right center' }, String(p.sobrasF3)));
    tr.appendChild(el('td', { class: 'right center' }, el('strong', {}, String(p.total))));

    if (original) {
      const diff = variacao[p.sigla] || 0;
      const cls = diff > 0 ? 'var-pos' : diff < 0 ? 'var-neg' : 'var-zero';
      const txt = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : '—';
      tr.appendChild(el('td', { class: `var-cell ${cls}` }, txt));
    }

    // Badge status
    const badgeClass = {
      eleito: 'badge-eleito',
      qualificado_sem_vaga: 'badge-qualificado',
      barrado_80: 'badge-barrado',
      fase3_apenas: 'badge-fase3',
    }[p.status] || '';
    tr.appendChild(el('td', {}, el('span', { class: `badge ${badgeClass}` }, I18N.STATUS[p.status] || p.status)));

    // Eleitos
    const eletosCell = el('td', {});
    if (p.eleitos && p.eleitos.length > 0) {
      const ul = el('ul', { style: 'list-style:none; margin:0; padding:0; font-size:11px;' });
      for (const c of p.eleitos) {
        ul.appendChild(el('li', {}, `${c.nome} (${fmt(c.votos)})`));
      }
      eletosCell.appendChild(ul);
    }
    tr.appendChild(eletosCell);

    tbody.appendChild(tr);
  }

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'tabela-scroll' }, el('table', {}, thead, tbody)));
}

function renderizarAuditoria(resultado) {
  const container = $('auditoria-container');
  container.innerHTML = '';

  if (resultado.auditoria.length === 0) {
    container.appendChild(el('p', {}, 'Nenhuma rodada D\'Hondt (todas as vagas distribuídas por QP).'));
    return;
  }

  for (const rodada of resultado.auditoria) {
    const card = el('div', { class: 'rodada-card fade-in' });

    const faseCls = rodada.fase === 3 ? 'fase3' : '';
    const header = el('div', {
      class: 'rodada-header',
      onclick: () => body.classList.toggle('aberto'),
    });

    header.appendChild(el('span', { style: 'font-weight:700; color:var(--cor-texto-fraco); font-size:12px;' }, `#${rodada.rodada}`));
    header.appendChild(el('span', { class: `fase-badge ${faseCls}` }, `Fase ${rodada.fase}`));
    header.appendChild(el('span', { class: 'vencedor' }, `Vencedor: ${rodada.vencedor}`));
    header.appendChild(el('span', { class: 'media' }, `Média: ${fmtD(rodada.mediaVencedor, 2)}`));
    if (rodada.candidatoConvocado) {
      header.appendChild(el('span', { class: 'candidato' }, `↪ ${rodada.candidatoConvocado.nome} (${fmt(rodada.candidatoConvocado.votos)})`));
    }

    const body = el('div', { class: 'rodada-body' });

    // Tabela de médias
    const thead = el('thead', {}, el('tr', {},
      el('th', {}, 'Partido'),
      el('th', { class: 'right' }, 'Votos'),
      el('th', { class: 'right' }, 'Cadeiras +1'),
      el('th', { class: 'right' }, 'Média'),
      el('th', { class: 'center' }, '>80% QE?'),
      el('th', { class: 'center' }, 'Cands. 20%'),
      el('th', { class: 'center' }, 'Participa?'),
    ));

    const tbody = el('tbody');
    for (const m of rodada.medias) {
      const isVencedor = m.sigla === rodada.vencedor && m.participaDaRodada;
      const cls = isVencedor ? 'row-vencedor' : !m.participaDaRodada ? 'row-excluido' : '';
      const tr = el('tr', { class: cls });
      tr.appendChild(el('td', {}, el('strong', {}, m.sigla)));
      tr.appendChild(el('td', { class: 'right' }, fmt(m.votos)));
      tr.appendChild(el('td', { class: 'right' }, String(m.cadeirasMaisUm)));
      tr.appendChild(el('td', { class: 'right' }, fmtD(m.media, 2)));
      tr.appendChild(el('td', { class: 'center' }, m.qualificado80 ? '✓' : '✕'));
      tr.appendChild(el('td', { class: 'center' }, m.candidatos20disponiveis < 0 ? '(s/ lista)' : String(m.candidatos20disponiveis)));
      tr.appendChild(el('td', { class: 'center' }, m.participaDaRodada ? '✓' : '✕'));
      tbody.appendChild(tr);
    }

    body.appendChild(el('div', { class: 'tabela-scroll' }, el('table', {}, thead, tbody)));
    body.appendChild(el('div', { class: 'rodada-fundamentacao' }, rodada.fundamentacao));

    card.append(header, body);
    container.appendChild(card);
  }
}

function renderizarComparativo(original, retotalizado) {
  const container = $('comparativo-container');
  container.innerHTML = '';

  const variacao = ElectoralEngine.compararResultados(original, retotalizado);

  const criarTabela = (resultado, titulo) => {
    const tbl = el('table');
    const thead = el('thead', {}, el('tr', {},
      el('th', {}, titulo),
      el('th', { class: 'center' }, 'Total'),
    ));
    const tbody = el('tbody');
    for (const p of resultado.partidos) {
      const tr = el('tr');
      tr.appendChild(el('td', {}, p.sigla));
      tr.appendChild(el('td', { class: 'center' }, el('strong', {}, String(p.total))));
      tbody.appendChild(tr);
    }
    tbl.append(thead, tbody);
    return el('div', { class: 'card' }, el('div', { class: 'tabela-scroll' }, tbl));
  };

  // Tabela lado a lado
  const div = el('div', { class: 'comparativo-container' });
  div.appendChild(criarTabela(original, 'Cenário Original'));
  div.appendChild(criarTabela(retotalizado, 'Cenário Retotalizado'));
  container.appendChild(div);

  // Variações
  const variacoes = Object.entries(variacao).filter(([, v]) => v !== 0);
  if (variacoes.length > 0) {
    const p = el('div', { class: 'alerta info', style: 'margin-top:12px;' });
    p.appendChild(el('div', { class: 'alerta-titulo' }, 'Migrações de vagas'));
    for (const [sigla, diff] of variacoes) {
      const acao = diff > 0 ? `ganhou ${diff} vaga(s)` : `perdeu ${Math.abs(diff)} vaga(s)`;
      p.appendChild(el('p', {}, `${sigla}: ${acao}`));
    }
    container.appendChild(p);
  }
}

// ─── Cassações ──────────────────────────────────────────────────────────────────

let contadorCassacao = 0;

function adicionarCassacaoUI() {
  const id = ++contadorCassacao;
  const container = $('lista-cassacoes');
  const row = el('div', { class: 'cassacao-row form-row', id: `cassacao-${id}` });

  const selPartido = el('input', { type: 'text', placeholder: 'Sigla partido', class: 'cass-partido', style: 'width:100px', 'aria-label': 'Partido' });
  const selCandidato = el('input', { type: 'text', placeholder: 'Nome candidato (opcional)', class: 'cass-candidato', style: 'flex:1', 'aria-label': 'Candidato' });
  const selVotos = el('input', { type: 'number', placeholder: 'Votos a anular', min: '0', class: 'cass-votos', style: 'width:140px', 'aria-label': 'Votos' });
  const selModal = el('select', { class: 'cass-modalidade', 'aria-label': 'Modalidade' });
  for (const [k, v] of Object.entries(I18N.MODALIDADE_CASSACAO)) {
    selModal.appendChild(el('option', { value: k }, v));
  }
  const btnRem = el('button', { class: 'btn btn-perigo btn-xs', onclick: () => row.remove() }, '✕');

  row.append(selPartido, selCandidato, selVotos, selModal, btnRem);
  container.appendChild(row);
}

// ─── Presets ────────────────────────────────────────────────────────────────────

async function carregarPresetUI(id) {
  if (!id) return;
  const todos = await Presets.todosPresets();
  const preset = todos.find(p => p.id === id);
  if (!preset) return;

  $('input-rotulo').value = preset.rotulo || '';
  $('input-vagas').value = preset.vagas || '';

  $('lista-partidos').innerHTML = '';
  contadorPartido = 0;
  for (const p of (preset.partidos || [])) {
    adicionarPartidoUI(p);
  }

  // Cassações embutidas no preset
  $('lista-cassacoes').innerHTML = '';
  contadorCassacao = 0;
  for (const cass of (preset.cassacoes || [])) {
    adicionarCassacaoUI();
    const rows = document.querySelectorAll('.cassacao-row');
    const row = rows[rows.length - 1];
    row.querySelector('.cass-partido').value = cass.partido || '';
    row.querySelector('.cass-candidato').value = cass.candidato || '';
    row.querySelector('.cass-votos').value = cass.votosAnular || '';
    row.querySelector('.cass-modalidade').value = cass.modalidade || 'nominal';
  }

  Estado.presetComparar = preset.comparar_com || null;

  if (preset.notas) {
    const notasBox = $('preset-notas');
    notasBox.textContent = preset.notas;
    notasBox.style.display = 'block';
  } else {
    $('preset-notas').style.display = 'none';
  }
}

async function popularSelectPresets() {
  const sel = $('select-preset');
  sel.innerHTML = '<option value="">— Selecionar caso de estudo —</option>';
  const todos = await Presets.todosPresets();
  Estado.presets = todos;
  for (const p of todos) {
    const opt = el('option', { value: p.id }, p.rotulo + (p._personalizado ? ' (personalizado)' : ''));
    sel.appendChild(opt);
  }
}

// ─── Link compartilhável ────────────────────────────────────────────────────────

function copiarLink() {
  if (!Estado.cenario) return;
  const url = Export.gerarLinkCompartilhavel(Estado.cenario);
  navigator.clipboard.writeText(url).then(() => {
    alert('Link copiado para a área de transferência!');
  }).catch(() => {
    prompt('Copie o link abaixo:', url);
  });
}

// ─── Inicialização ──────────────────────────────────────────────────────────────

async function init() {
  // Tabs
  document.querySelectorAll('nav button[data-aba]').forEach(btn => {
    btn.addEventListener('click', () => ativarAba(btn.dataset.aba));
  });

  // Presets
  await popularSelectPresets();
  $('select-preset').addEventListener('change', e => carregarPresetUI(e.target.value));

  // Botões de ação
  $('btn-adicionar-partido').addEventListener('click', () => adicionarPartidoUI());
  $('btn-calcular').addEventListener('click', executarCalculo);
  $('btn-limpar').addEventListener('click', () => {
    if (confirm('Limpar todos os dados?')) {
      $('input-rotulo').value = '';
      $('input-vagas').value = '';
      $('lista-partidos').innerHTML = '';
      $('lista-cassacoes').innerHTML = '';
      $('erros-formulario').innerHTML = '';
      contadorPartido = 0;
      contadorCassacao = 0;
    }
  });
  $('btn-adicionar-cassacao').addEventListener('click', adicionarCassacaoUI);

  $('btn-exportar-csv').addEventListener('click', () => {
    if (!Estado.resultado) return;
    Export.downloadCSV(Export.exportarCSV(Estado.resultado), `retotalizacao.csv`);
  });
  $('btn-exportar-pdf').addEventListener('click', () => {
    if (!Estado.resultado) return;
    Export.exportarPDF(Estado.resultado, Estado.resultadoOriginal);
  });
  $('btn-link').addEventListener('click', copiarLink);

  // Carregar da URL se houver
  const cenarioDaURL = Export.lerCenarioDaURL();
  if (cenarioDaURL) {
    preencherFormularioDeCenario(cenarioDaURL);
  } else {
    // Restaurar último cálculo
    const ultimoRaw = localStorage.getItem('ultimo_calculo');
    if (ultimoRaw) {
      try {
        const { cenario } = JSON.parse(ultimoRaw);
        if (cenario) preencherFormularioDeCenario(cenario);
      } catch { /* ignorar */ }
    }
  }

  // Adicionar ao menos um partido vazio inicialmente
  if (document.querySelectorAll('.partido-card').length === 0) {
    adicionarPartidoUI();
  }
}

function preencherFormularioDeCenario(cenario) {
  Estado.presetComparar = cenario._comparar_com || null;
  $('input-rotulo').value = cenario.rotulo || '';
  $('input-vagas').value = cenario.vagas || '';
  $('lista-partidos').innerHTML = '';
  contadorPartido = 0;
  for (const p of (cenario.partidos || [])) adicionarPartidoUI(p);
  $('lista-cassacoes').innerHTML = '';
  contadorCassacao = 0;
  for (const c of (cenario.cassacoes || [])) {
    adicionarCassacaoUI();
    const rows = document.querySelectorAll('.cassacao-row');
    const row = rows[rows.length - 1];
    row.querySelector('.cass-partido').value = c.partido || '';
    row.querySelector('.cass-candidato').value = c.candidato || '';
    row.querySelector('.cass-votos').value = c.votosAnular || '';
    row.querySelector('.cass-modalidade').value = c.modalidade || 'nominal';
  }
}

document.addEventListener('DOMContentLoaded', init);

})(); // fim da IIFE
