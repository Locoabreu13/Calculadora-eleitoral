/**
 * ui.js — Interface do usuário e renderização.
 * Depende de: engine.js, i18n.js, presets.js, export.js
 */
(function () {
'use strict';

// ─── Versão da aplicação ────────────────────────────────────────────────────────
const APP_VERSION = '2.0';
const APP_BUILD   = new Date().toISOString().split('T')[0]; // AAAA-MM-DD

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
    class: 'pcard-footer-btn',
    title: 'Editar lista de candidatos',
    onclick: () => {
      const lista = card.querySelector('.candidatos-wrapper');
      lista.style.display = lista.style.display === 'none' ? 'block' : 'none';
    },
  }, '👥 Candidatos');

  // ── Grid areas: label + input ─────────────────────────────────────────────────
  // Área: Sigla
  const gSigla = el('div', { class: 'partido-field-group pcard-sigla' });
  const lSigla = el('label', { class: 'partido-field-label' }); lSigla.textContent = 'Sigla';
  const wSigla = el('div', { class: 'input-valida' }); wSigla.appendChild(inputSigla);
  gSigla.append(lSigla, wSigla);

  // Área: Nome do Partido
  const gNome = el('div', { class: 'partido-field-group pcard-nome' });
  const lNome = el('label', { class: 'partido-field-label' }); lNome.textContent = 'Nome do Partido';
  gNome.append(lNome, inputNome);

  // Área: Botão remover
  const gRemover = el('div', { class: 'pcard-remover' });
  gRemover.appendChild(btnRemover);

  // Área: Votos Nominais
  const gNominais = el('div', { class: 'partido-field-group pcard-nominais' });
  const lNominais = el('label', { class: 'partido-field-label' }); lNominais.textContent = 'Votos Nominais';
  const wNominais = el('div', { class: 'input-valida' }); wNominais.appendChild(inputNominais);
  gNominais.append(lNominais, wNominais);

  // Área: Votos de Legenda
  const gLegenda = el('div', { class: 'partido-field-group pcard-legenda' });
  const lLegenda = el('label', { class: 'partido-field-label' }); lLegenda.textContent = 'Votos de Legenda';
  const wLegenda = el('div', { class: 'input-valida' }); wLegenda.appendChild(inputLegenda);
  gLegenda.append(lLegenda, wLegenda);

  header.append(gSigla, gNome, gRemover, gNominais, gLegenda);
  card.appendChild(header);

  // ── Footer: Candidatos + Federação ───────────────────────────────────────────
  const inputFederacao = el('input', {
    type: 'text',
    placeholder: 'Federação (opcional)',
    'aria-label': 'Nome da federação',
    class: 'partido-federacao',
    value: dados ? (dados.federacao || '') : '',
    title: 'Se este partido integra uma federação, informe o mesmo nome para todos os membros. Eles serão agrupados automaticamente no cálculo.',
  });
  const gFed = el('div', { class: 'partido-field-group pcard-footer-fed' });
  const lFed = el('label', { class: 'partido-field-label' }); lFed.textContent = 'Federação';
  gFed.append(lFed, inputFederacao);

  const footer = el('div', { class: 'pcard-footer' });
  footer.append(btnToggleCandidatos, gFed);
  card.appendChild(footer);

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

// ─── Validação em tempo real ────────────────────────────────────────────────────

/**
 * Aplica estado visual (borda + mensagem de erro) a um campo.
 * @param {HTMLInputElement} input
 * @param {boolean|null} valid  — true=válido, false=inválido, null=sem estado (não tocado)
 * @param {string} msg          — mensagem de erro (apenas quando invalid=false)
 */
function setFieldState(input, valid, msg) {
  // Remover mensagem de erro anterior (dentro do mesmo wrapper/pai)
  const anterior = input.parentNode.querySelector(':scope > .campo-erro');
  if (anterior) anterior.remove();

  input.classList.remove('invalido', 'valido');

  if (valid === null) { atualizarBotaoCalcular(); return; }

  if (valid) {
    input.classList.add('valido');
  } else {
    input.classList.add('invalido');
    const errEl = el('div', { class: 'campo-erro' }, `⚠ ${msg}`);
    input.after(errEl); // inserido como irmão, dentro do wrapper .input-valida
  }
  atualizarBotaoCalcular();
}

/** Habilita/desabilita o botão Calcular conforme existência de erros no formulário. */
function atualizarBotaoCalcular() {
  const btn = $('btn-calcular');
  if (!btn) return;
  const temErros = document.querySelectorAll('input.invalido').length > 0;
  btn.disabled = temErros;
}

// ── Validadores individuais ────────────────────────────────────────────────────

function validarVagas(input, mark) {
  const v = parseInt(input.value, 10);
  const ok = !isNaN(v) && v >= 1 && v <= 513;
  if (mark !== false) setFieldState(input, ok, 'Número de vagas deve ser entre 1 e 513');
  return ok;
}

function validarVotos(input, mark) {
  const raw = input.value.trim();
  if (raw === '') { if (mark !== false) setFieldState(input, null, ''); return true; }
  const v = Number(raw);
  const ok = Number.isInteger(v) && v >= 0;
  if (mark !== false) setFieldState(input, ok, 'Votos devem ser um número inteiro positivo ou zero');
  return ok;
}

function validarSigla(input, mark) {
  const s = input.value.trim();
  const ok = s.length > 0 && s.length <= 20;
  if (mark !== false) setFieldState(input, ok, 'Sigla obrigatória (máximo 20 caracteres)');
  return ok;
}

function validarCassacaoVotos(input, mark) {
  const row    = input.closest('.cassacao-row');
  const sigla  = row?.querySelector('.cass-partido')?.value.trim() || '';
  const votos  = parseInt(input.value, 10);

  if (!sigla || !input.value.trim() || isNaN(votos)) {
    if (mark !== false) setFieldState(input, null, '');
    return true;
  }

  const card = [...document.querySelectorAll('.partido-card')].find(c =>
    c.querySelector('.partido-sigla')?.value.trim() === sigla
  );
  if (!card) { if (mark !== false) setFieldState(input, null, ''); return true; }

  const nom   = parseInt(card.querySelector('.partido-nominais').value, 10) || 0;
  const leg   = parseInt(card.querySelector('.partido-legenda').value,  10) || 0;
  const total = nom + leg;
  const ok    = votos <= total;
  if (mark !== false) setFieldState(input, ok,
    `Votos a anular excedem o total de votos do partido (${fmt(total)} votos)`);
  return ok;
}

/** Valida todos os campos relevantes e retorna true se o formulário está ok. */
function validarTudo() {
  let ok = true;

  if (!validarVagas($('input-vagas'))) ok = false;

  for (const card of document.querySelectorAll('.partido-card')) {
    if (!validarSigla(card.querySelector('.partido-sigla')))       ok = false;
    if (!validarVotos(card.querySelector('.partido-nominais')))    ok = false;
    if (!validarVotos(card.querySelector('.partido-legenda')))     ok = false;
  }

  for (const row of document.querySelectorAll('.cassacao-row')) {
    const inp = row.querySelector('.cass-votos');
    if (inp && inp.value.trim()) {
      if (!validarCassacaoVotos(inp)) ok = false;
    }
  }

  atualizarBotaoCalcular();
  return ok;
}

/** Registra listeners de validação on-blur (captura) e on-input para campos dinâmicos. */
function inicializarValidacao() {
  // Campo de vagas (estático)
  const inputVagas = $('input-vagas');
  inputVagas.addEventListener('blur',  () => validarVagas(inputVagas));
  inputVagas.addEventListener('input', () => {
    if (inputVagas.classList.contains('invalido')) validarVagas(inputVagas);
  });

  // Campos de partido — event delegation (blur requer capture=true)
  $('lista-partidos').addEventListener('blur', e => {
    const t = e.target;
    if (t.matches('.partido-sigla'))    validarSigla(t);
    if (t.matches('.partido-nominais')) validarVotos(t);
    if (t.matches('.partido-legenda'))  validarVotos(t);
  }, true);

  $('lista-partidos').addEventListener('input', e => {
    const t = e.target;
    if (!t.classList.contains('invalido')) return;
    if (t.matches('.partido-sigla'))    validarSigla(t);
    if (t.matches('.partido-nominais')) validarVotos(t);
    if (t.matches('.partido-legenda'))  validarVotos(t);
  });

  // Campos de cassação — event delegation
  const listaCass = $('lista-cassacoes');
  listaCass.addEventListener('blur', e => {
    if (e.target.matches('.cass-votos')) validarCassacaoVotos(e.target);
  }, true);

  listaCass.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('invalido') && t.matches('.cass-votos')) validarCassacaoVotos(t);
  });
}

// ─── Leitura do formulário ──────────────────────────────────────────────────────

function lerFormulario() {
  const erros = [];

  const rotulo = $('input-rotulo').value.trim() || 'Pleito sem rótulo';
  const vagas = parseInt($('input-vagas').value, 10);

  if (isNaN(vagas) || vagas < 1 || vagas > 513) erros.push('Número de vagas deve ser entre 1 e 513.');

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

    const federacao = card.querySelector('.partido-federacao')?.value.trim() || null;
    partidos.push({ sigla, nome, votosNominais: nominais, votosLegenda: legenda, candidatos, federacao: federacao || null });
  }

  if (partidos.length === 0) erros.push('Informe ao menos um partido.');
  else if (partidos.length === 1) erros.push('AVISO: Recomendado pelo menos 2 partidos para cálculo significativo.');

  // Cassações
  const cassacoes = [];
  for (const row of document.querySelectorAll('.cassacao-row')) {
    const partido = row.querySelector('.cass-partido').value.trim();
    const candidato = row.querySelector('.cass-candidato').value.trim();
    const votos = parseInt(row.querySelector('.cass-votos').value, 10) || 0;
    const modalidade = row.querySelector('.cass-modalidade').value;
    if (partido && (votos > 0 || modalidade === 'cassacao_drap')) {
      cassacoes.push({ partido, candidato: candidato || undefined, votosAnular: votos, modalidade });
    }
  }

  const aplicarPiso20F3 = !!($('togglePiso20F3')?.checked);
  const cenario = { rotulo, vagas, partidos, cassacoes, aplicarPiso20F3 };
  if (Estado.presetComparar) cenario._comparar_com = Estado.presetComparar;
  return { erros, cenario };
}

// ─── Cálculo e renderização ─────────────────────────────────────────────────────

async function executarCalculo() {
  // (Créditos são verificados/consumidos no SERVIDOR, após a validação — ver abaixo.)

  // Validação em tempo real: bloqueia se houver campos inválidos
  if (!validarTudo()) {
    const erroBox = $('erros-formulario');
    erroBox.innerHTML = '';
    erroBox.appendChild(el('div', { class: 'alerta critico' },
      el('div', { class: 'alerta-titulo' }, '✕ Erro de validação'),
      'Corrija os campos marcados em vermelho antes de calcular.'
    ));
    return;
  }

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

  // Validar cassações contra partidos e candidatos do cenário carregado
  const normSigla = s => (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const errosCassacao = [];
  for (const cass of cenario.cassacoes) {
    const partidoEncontrado = cenario.partidos.find(
      p => normSigla(p.sigla) === normSigla(cass.partido)
    );
    if (!partidoEncontrado) {
      const siglas = cenario.partidos.map(p => p.sigla).join(', ');
      errosCassacao.push(
        `Partido "${cass.partido}" não encontrado no cenário. Siglas disponíveis: ${siglas}`
      );
      continue;
    }
    if (cass.candidato && partidoEncontrado.candidatos && partidoEncontrado.candidatos.length > 0) {
      const achou = partidoEncontrado.candidatos.find(c => c.nome === cass.candidato);
      if (!achou) {
        const nomes = partidoEncontrado.candidatos.map(c => c.nome).join(', ');
        errosCassacao.push(
          `Candidato "${cass.candidato}" não encontrado no partido "${partidoEncontrado.sigla}". ` +
          `Candidatos disponíveis: ${nomes}`
        );
      }
    }
  }
  if (errosCassacao.length > 0) {
    for (const msg of errosCassacao) {
      erroBox.appendChild(el('div', { class: 'alerta critico' },
        el('div', { class: 'alerta-titulo' }, '✕ Cassação inválida'),
        msg
      ));
    }
    erroBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // ── Autorização de crédito (SERVIDOR desconta 1; recusa se sem saldo) ──────
  // O servidor é a fonte da verdade. Só calcula se autorizado.
  let _autorizado = null; // null = função do servidor indisponível (fallback)
  if (typeof window._autorizarCalculo === 'function') {
    try {
      _autorizado = await window._autorizarCalculo(); // { ok, creditos, motivo? }
    } catch (e) {
      console.warn('[Créditos] Função do servidor indisponível (ainda não publicada?):', e);
      _autorizado = null;
    }
  }
  if (_autorizado) {
    if (!_autorizado.ok) {
      if (typeof window._mostrarModalSemCreditos === 'function') window._mostrarModalSemCreditos();
      return;
    }
  } else {
    // Fallback enquanto a Cloud Function não estiver publicada: checagem local antiga.
    if (typeof window._creditosDisponiveis !== 'undefined' && window._creditosDisponiveis <= 0) {
      if (typeof window._mostrarModalSemCreditos === 'function') window._mostrarModalSemCreditos();
      return;
    }
    if (typeof window._consumirCreditoAtual === 'function') window._consumirCreditoAtual();
  }
  // ──────────────────────────────────────────────────────────────────────────

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

  // (O crédito já foi descontado no servidor, antes do cálculo — ver acima.)

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
  renderizarRelatorio(resultado, original);

  $('secao-comparativo').style.display = original ? 'block' : 'none';
  $('btn-exportar-csv').disabled = false;
  $('btn-exportar-pdf').disabled = false;
  $('btn-link').disabled = false;
  $('btn-apresentacao').disabled = false;
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

// ─── Tooltips das células de fase ──────────────────────────────────────────────

/**
 * Tooltip para a célula F1 (Quociente Partidário).
 * Quando valor > 0: descreve a fórmula aplicada.
 * Quando valor = 0: explica por que o partido não obteve vagas diretas.
 */
function tooltipF1(p, r) {
  if (p.qp > 0) {
    return `${p.qp} vaga(s) pelo Quociente Partidário — ` +
      `floor(${fmt(p.votos)} ÷ ${fmt(r.qe)}) = ${p.qp} · art. 109, I, CE`;
  }
  return `Sem vagas em F1 — votos do partido (${fmt(p.votos)}) ` +
    `inferiores ao Quociente Eleitoral (${fmt(r.qe)})`;
}

/**
 * Tooltip para a célula F2 (Maiores Médias com barreira 80/20).
 * Distingue: barrado pela barreira, sem sobras, sem candidatos 20%, ou não venceu.
 */
function tooltipF2(p, r) {
  if (p.sobrasF2 > 0) {
    return `${p.sobrasF2} vaga(s) por maiores médias D'Hondt com barreira ` +
      `80% QE / piso 20% QE individual · art. 109, II, CE`;
  }
  // Barrado pela cláusula de 80% do QE
  if (p.votos < r.barreira80) {
    return `Excluído da Fase 2 — votos do partido (${fmt(p.votos)}) ` +
      `abaixo da barreira de 80% do QE (${fmt(r.barreira80)})`;
  }
  // Fase 2 sequer executou (todas as vagas preenchidas em F1)
  if (r.sobras === 0) {
    return 'Fase 2 não executada — todas as vagas foram preenchidas ' +
      'pelo Quociente Partidário na Fase 1';
  }
  // Qualificado mas sem candidatos com ≥ 20% QE disponíveis
  if (p.candidatos20Disponiveis === 0) {
    return `Partido atingiu a barreira de 80% QE mas não tinha candidatos ` +
      `com votos ≥ 20% QE (${fmt(r.piso20)}) disponíveis para convocação`;
  }
  // Qualificado, participou, mas não venceu nenhuma rodada
  return `Partido qualificado para a Fase 2 (≥ 80% QE) mas não ` +
    `venceu nenhuma rodada de maiores médias D'Hondt`;
}

/**
 * Tooltip para a célula F3 (Maiores Médias sem barreira — ADIs STF).
 * Distingue: F3 não ativada vs. F3 ativada mas partido não venceu rodadas.
 */
function tooltipF3(p, r) {
  if (p.sobrasF3 > 0) {
    return `${p.sobrasF3} vaga(s) por maiores médias D'Hondt sem barreira ` +
      `partidária · ADIs 7.228/7.263/7.325 STF (13/03/2025)`;
  }
  if (!r.fase3Ativada) {
    return 'Fase 3 não ativada — todas as vagas foram distribuídas ' +
      'nas Fases 1 e 2';
  }
  return 'Fase 3 ativada mas o partido não venceu nenhuma rodada ' +
    "de maiores médias nesta fase (sem barreira partidária)";
}

/** Formata sigla + membros de federação para exibição: "FE BRASIL (PT + PCdoB + PV)" */
function formatarSiglaFed(p) {
  if (p.membros && p.membros.length > 0) {
    return `${p.sigla} (${p.membros.join(' + ')})`;
  }
  return p.sigla;
}

/**
 * Retorna candidatos de um partido em ordem de preferência:
 * eleitos (ordem D'Hondt determinada pelo engine) + não-eleitos por votos DESC.
 * Retorna null se o partido não tem lista de candidatos no cenário de entrada.
 */
function candidatosOrdenados(pResult, cenario) {
  if (!cenario) return null;
  const pc = (cenario.partidos || []).find(p => p.sigla === pResult.sigla);
  if (!pc || !pc.candidatos || pc.candidatos.length === 0) return null;

  const eleitos      = pResult.eleitos || [];
  const eleitosNomes = new Set(eleitos.map(c => c.nome));

  const suplentes = pc.candidatos
    .filter(c => !c.cassado && !eleitosNomes.has(c.nome))
    .sort((a, b) => b.votos - a.votos);

  return [
    ...eleitos.map(c => ({ nome: c.nome, votos: c.votos, partido: c.partido, eleito: true })),
    ...suplentes.map(c => ({ nome: c.nome, votos: c.votos, partido: c.partido || pc.sigla, eleito: false })),
  ];
}

/** Calcula quantas vagas cada membro de uma federação recebeu, baseado nos eleitos. */
function distribuicaoInterna(p) {
  if (!p.membros || p.membros.length === 0) return null;
  const mapa = Object.fromEntries(p.membros.map(m => [m, []]));
  for (const c of (p.eleitos || [])) {
    const chave = c.partido;
    if (mapa[chave]) mapa[chave].push(c);
    else {
      // partido do candidato não reconhecido como membro — colocar em "outros"
      mapa['?'] = mapa['?'] || [];
      mapa['?'].push(c);
    }
  }
  return mapa;
}

function renderizarTabelaResultado(resultado, original) {
  const container = $('tabela-resultado');

  const variacao = original ? ElectoralEngine.compararResultados(original, resultado) : {};

  const thead = el('thead');
  const ths = ['Partido', 'Nome', 'Votos Válidos', '% QE', 'F1 (QP)', 'F2 (Sobras)', 'F3 (Sobras)', 'Total'];
  if (original) ths.push('Variação');
  ths.push('Status', 'Eleitos / Suplentes');

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

    // ── Badge de zona de sensibilidade F2 ──────────────────
    const limiar85 = resultado.qe * 0.85;
    const limiar75 = resultado.qe * 0.75;
    // delta = votos do partido - floor(80% QE)  [spec: votos - floor(0.8 × QE)]
    const barreiraInt  = Math.floor(resultado.barreira80);
    const deltaAbsSens = Math.abs(p.votos - barreiraInt);

    let badgeZona;
    if (p.votos >= limiar85) {
      badgeZona = el('span', {
        class: 'badge-zona zona-apta',
        title: 'Partido acima de 85% do QE — confortavelmente apto para a Fase 2',
      }, 'Apto F2');
    } else if (p.votos >= limiar75) {
      badgeZona = el('span', {
        class: 'badge-zona zona-sensivel',
        title: `Variação de ${fmt(deltaAbsSens)} votos altera elegibilidade para a Fase 2`,
      }, '⚠ Zona sensível');
    } else {
      badgeZona = el('span', {
        class: 'badge-zona zona-excluida',
        title: 'Partido abaixo de 75% do QE — excluído da Fase 2',
      }, 'Excluído F2');
    }

    const tdSigla = el('td', {});
    tdSigla.appendChild(el('strong', {}, p.sigla));
    // Badge de federação + membros
    if (p.membros && p.membros.length > 0) {
      tdSigla.appendChild(el('div', { class: 'fed-membros-label' }, p.membros.join(' · ')));
    }
    tdSigla.appendChild(el('br', {}));
    tdSigla.appendChild(badgeZona);
    tr.appendChild(tdSigla);

    tr.appendChild(el('td', {}, p.nome));
    tr.appendChild(el('td', { class: 'right' }, fmt(p.votos)));
    tr.appendChild(el('td', { class: 'right' }, fmtPct(p.percentualQE)));
    tr.appendChild(el('td', { class: 'right center td-fase', title: tooltipF1(p, resultado) }, String(p.qp)));
    tr.appendChild(el('td', { class: 'right center td-fase', title: tooltipF2(p, resultado) }, String(p.sobrasF2)));
    tr.appendChild(el('td', { class: 'right center td-fase', title: tooltipF3(p, resultado) }, String(p.sobrasF3)));
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

    // Candidatos por ordem (eleitos + suplentes)
    const eletosCell = el('td', { class: 'td-cands-ordem' });
    const ordemCands = candidatosOrdenados(p, Estado.cenario);
    if (ordemCands && ordemCands.length > 0) {
      const ul = el('ul', { class: 'cands-ordem-lista' });
      ordemCands.forEach((c, i) => {
        const pos = i + 1;
        const partidoLabel = (p._isFederacao && c.partido && c.partido !== p.sigla)
          ? ` [${c.partido}]` : '';
        const tag = c.eleito
          ? el('span', { class: 'cand-tag cand-eleito-tag' }, '✓')
          : el('span', { class: 'cand-tag cand-suplente-tag' }, `${pos}º`);
        const li = el('li', { class: c.eleito ? 'cand-row-eleito' : 'cand-row-suplente' });
        li.append(tag, ` ${c.nome}${partidoLabel} (${fmt(c.votos)})`);
        ul.appendChild(li);
      });
      eletosCell.appendChild(ul);
    } else if (p.eleitos && p.eleitos.length > 0) {
      // fallback: sem lista de candidatos no cenário, apenas eleitos do engine
      const ul = el('ul', { class: 'cands-ordem-lista' });
      for (const c of p.eleitos) {
        const partidoLabel = (p._isFederacao && c.partido && c.partido !== p.sigla)
          ? ` [${c.partido}]` : '';
        const li = el('li', { class: 'cand-row-eleito' });
        li.append(el('span', { class: 'cand-tag cand-eleito-tag' }, '✓'), ` ${c.nome}${partidoLabel} (${fmt(c.votos)})`);
        ul.appendChild(li);
      }
      eletosCell.appendChild(ul);
    }
    tr.appendChild(eletosCell);
    tbody.appendChild(tr);

    // Sub-linha expansível de distribuição interna (MUDANÇA 5)
    if (p._isFederacao && p.membros && p.membros.length > 0) {
      const subRow  = el('tr', { class: 'fed-sub-row', style: 'display:none' });
      const subCell = el('td', { colspan: String(ths.length), class: 'fed-distribuicao' });

      const distMap = distribuicaoInterna(p);
      const tituloDiv = el('div', { class: 'fed-dist-titulo' }, '📋 Distribuição interna da federação:');
      subCell.appendChild(tituloDiv);

      const distGrid = el('div', { class: 'fed-dist-grid' });
      for (const [membro, eleitos] of Object.entries(distMap)) {
        const item = el('div', { class: 'fed-dist-item' });
        item.appendChild(el('strong', {}, `${membro} — ${eleitos.length} vaga${eleitos.length !== 1 ? 's' : ''}`));
        if (eleitos.length > 0) {
          const ul = el('ul', { class: 'fed-dist-lista' });
          for (const c of eleitos) {
            ul.appendChild(el('li', {}, `${c.nome} (${fmt(c.votos)})`));
          }
          item.appendChild(ul);
        }
        distGrid.appendChild(item);
      }
      subCell.appendChild(distGrid);
      subRow.appendChild(subCell);
      tbody.appendChild(subRow);

      // Botão na célula de sigla para expandir/recolher
      const btnExpand = el('button', { class: 'btn-fed-expand' }, '▼ Distribuição');
      btnExpand.addEventListener('click', () => {
        const aberto = subRow.style.display !== 'none';
        subRow.style.display = aberto ? 'none' : '';
        btnExpand.textContent = aberto ? '▼ Distribuição' : '▲ Distribuição';
      });
      tdSigla.appendChild(btnExpand);
    }
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

    // Rótulo do vencedor: para federações, inclui membros (MUDANÇA 6)
    const vencedorInfo = rodada.medias.find(m => m.sigla === rodada.vencedor);
    const vencedorLabel = (vencedorInfo && vencedorInfo.membros && vencedorInfo.membros.length > 0)
      ? `${rodada.vencedor} (${vencedorInfo.membros.join(' + ')})`
      : rodada.vencedor;

    header.appendChild(el('span', { style: 'font-weight:700; color:var(--cor-texto-fraco); font-size:12px;' }, `#${rodada.rodada}`));
    header.appendChild(el('span', { class: `fase-badge ${faseCls}` }, `Fase ${rodada.fase}`));
    header.appendChild(el('span', { class: 'vencedor' }, `Vencedor: ${vencedorLabel}`));
    header.appendChild(el('span', { class: 'media' }, `Média: ${fmtD(rodada.mediaVencedor, 2)}`));
    if (rodada.candidatoConvocado) {
      const partLabel = (rodada.candidatoConvocado.partido && rodada.candidatoConvocado.partido !== rodada.vencedor)
        ? ` [${rodada.candidatoConvocado.partido}]` : '';
      header.appendChild(el('span', { class: 'candidato' }, `↪ ${rodada.candidatoConvocado.nome}${partLabel} (${fmt(rodada.candidatoConvocado.votos)})`));
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
      const siglaCell = el('td', {});
      siglaCell.appendChild(el('strong', {}, m.sigla));
      if (m.membros && m.membros.length > 0) {
        siglaCell.appendChild(el('div', { class: 'fed-membros-label' }, m.membros.join(' · ')));
      }
      tr.appendChild(siglaCell);
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

// ─── Relatório Técnico ─────────────────────────────────────────────────────────

/**
 * Gera o texto plano do relatório (para copiar em petições).
 */
function gerarTextoRelatorio(resultado, original) {
  const r = resultado;
  const n = v => Math.round(v).toLocaleString('pt-BR');
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const L = [];

  L.push('═══════════════════════════════════════════════════════════════');
  L.push('RELATÓRIO TÉCNICO — DISTRIBUIÇÃO PROPORCIONAL DE CADEIRAS');
  L.push('Art. 109 CE (Lei 14.211/2021) · ADIs 7.228/7.263/7.325 STF');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push(`Pleito: ${r.rotulo}`);
  L.push(`Gerado em: ${hoje}`);
  L.push('');

  L.push('───────────────────────────────────────────────────────────────');
  L.push('1. PARÂMETROS DA ELEIÇÃO');
  L.push('───────────────────────────────────────────────────────────────');
  L.push('');
  L.push(`Vagas disputadas .............. ${r.vagas}`);
  if (original && original.votosValidos !== r.votosValidos) {
    L.push(`Votos válidos (antes)  ........ ${n(original.votosValidos)}`);
    L.push(`Votos válidos (após cassação) . ${n(r.votosValidos)}`);
  } else {
    L.push(`Votos válidos ................. ${n(r.votosValidos)}`);
  }
  if (original && original.qe !== r.qe) {
    L.push(`QE antes da cassação .......... ${n(original.qe)}`);
    L.push(`QE após cassação .............. ${n(r.qe)}  [= floor(${n(r.votosValidos)} ÷ ${r.vagas})]`);
  } else {
    L.push(`Quociente Eleitoral (QE) ...... ${n(r.qe)}  [= floor(${n(r.votosValidos)} ÷ ${r.vagas})]`);
  }
  L.push(`Barreira 80% QE ............... ${n(r.barreira80)}  [= 0,8 × ${n(r.qe)}]`);
  L.push(`Piso individual 20% QE ........ ${n(r.piso20)}  [= 0,2 × ${n(r.qe)}]`);
  L.push(`QPs distribuídos (Fase 1) ..... ${r.totalQPs}`);
  L.push(`Sobras (Fases 2+3) ............ ${r.sobras}`);
  L.push('');

  L.push('───────────────────────────────────────────────────────────────');
  L.push('2. DISTRIBUIÇÃO DE CADEIRAS POR PARTIDO E FASE');
  L.push('───────────────────────────────────────────────────────────────');
  L.push('');
  L.push(`${'Partido'.padEnd(22)} ${'Votos'.padStart(11)} ${'%QE'.padStart(6)} ${'F1'.padStart(4)} ${'F2'.padStart(4)} ${'F3'.padStart(4)} ${'Total'.padStart(6)} ${'Status F2'}`);
  L.push('─'.repeat(75));
  for (const p of r.partidos) {
    const pct = (p.percentualQE * 100).toFixed(1) + '%';
    const st = p.votos >= r.barreira80 ? 'Apto' : 'Barrado';
    L.push(
      `${p.sigla.padEnd(22)} ${n(p.votos).padStart(11)} ${pct.padStart(6)} ` +
      `${String(p.qp).padStart(4)} ${String(p.sobrasF2).padStart(4)} ` +
      `${String(p.sobrasF3).padStart(4)} ${String(p.total).padStart(6)}  ${st}`
    );
  }
  L.push('');

  const barrados = r.partidos.filter(p => p.status === 'barrado_80');
  if (barrados.length > 0) {
    L.push('───────────────────────────────────────────────────────────────');
    L.push('3. PARTIDOS EXCLUÍDOS DA FASE 2 (abaixo da barreira 80% QE)');
    L.push('───────────────────────────────────────────────────────────────');
    L.push(`Barreira: ${n(r.barreira80)} votos (80% × QE ${n(r.qe)})`);
    L.push('');
    for (const p of barrados) {
      const deficit = Math.floor(r.barreira80) - p.votos;
      L.push(`• ${p.sigla}: ${n(p.votos)} votos — faltaram ${n(deficit)} votos para a barreira`);
    }
    L.push('');
    L.push('  Base: Art. 109, II, CE (Lei 14.211/2021) — constitucional conforme');
    L.push('  STF ADIs 7.228/7.263/7.325 (13/03/2025).');
    L.push('');
  }

  if (r.fase3Ativada) {
    L.push('───────────────────────────────────────────────────────────────');
    L.push('4. FASE 3 — MAIORES MÉDIAS SEM BARREIRA (ADIs STF)');
    L.push('───────────────────────────────────────────────────────────────');
    L.push('');
    L.push(`Motivo: ${r.fase3Motivo}`);
    L.push('');
    const g3 = r.partidos.filter(p => p.sobrasF3 > 0);
    for (const p of g3) {
      L.push(`• ${p.sigla}: ${p.sobrasF3} vaga(s) distribuída(s) na Fase 3`);
    }
    L.push('');
    L.push('  Base: Art. 109, III, CE — sem barreira partidária na Fase 3');
    L.push('  (ADIs 7.228/7.263/7.325 STF, 13/03/2025 — Red. Min. Flávio Dino).');
    L.push('');
  }

  if (original) {
    const variacao = ElectoralEngine.compararResultados(original, r);
    const mudancas = Object.entries(variacao).filter(([, v]) => v !== 0);
    L.push('───────────────────────────────────────────────────────────────');
    L.push('5. VARIAÇÃO DE CADEIRAS (Original × Retotalizado)');
    L.push('───────────────────────────────────────────────────────────────');
    L.push(`QE original: ${n(original.qe)} → QE retotalizado: ${n(r.qe)}`);
    L.push('');
    if (mudancas.length === 0) {
      L.push('Nenhuma variação — resultado idêntico ao cenário original.');
    } else {
      for (const [sigla, diff] of mudancas.sort((a, b) => b[1] - a[1])) {
        const acao = diff > 0 ? `GANHOU +${diff} vaga(s)` : `PERDEU ${Math.abs(diff)} vaga(s)`;
        const pNome = (diff > 0 ? r : original).partidos.find(p => p.sigla === sigla)?.nome || sigla;
        L.push(`• ${sigla} (${pNome}): ${acao}`);
      }
    }
    L.push('');
  }

  L.push('═══════════════════════════════════════════════════════════════');
  L.push('FUNDAMENTAÇÃO LEGAL');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push('Calculado conforme Art. 109 do Código Eleitoral (Lei nº 4.737/1965,');
  L.push('com redação dada pela Lei nº 14.211/2021) e interpretação conforme');
  L.push('fixada pelo Supremo Tribunal Federal nas ADIs 7.228, 7.263 e 7.325,');
  L.push('julgamento de mérito e embargos de declaração em 13/03/2025,');
  L.push('Redator Min. Flávio Dino.');
  L.push('');
  L.push('Sistema RetotalizaJE · Ferramenta técnico-jurídica de apoio.');
  L.push('Não substitui decisão da Justiça Eleitoral.');
  L.push('═══════════════════════════════════════════════════════════════');
  return L.join('\n');
}

/**
 * Renderiza o painel HTML do relatório técnico.
 */
function renderizarRelatorio(resultado, original) {
  const container = $('relatorio-container');
  if (!container) return;
  container.innerHTML = '';

  const r = resultado;
  const n = v => Math.round(v).toLocaleString('pt-BR');
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Cabeçalho ──────────────────────────────────────────────────
  const hdr = el('div', { class: 'relatorio-header' });
  const titWrap = el('div');
  titWrap.appendChild(el('div', { class: 'relatorio-titulo' }, 'Relatório Técnico'));
  titWrap.appendChild(el('div', { class: 'relatorio-subtitulo' }, `${r.rotulo} · Gerado em ${hoje}`));
  hdr.appendChild(titWrap);

  const btnCopiar = el('button', { class: 'btn-relatorio-copiar' }, '📋 Copiar como texto');
  btnCopiar.addEventListener('click', () => {
    const texto = gerarTextoRelatorio(resultado, original);
    const restaurar = () => { btnCopiar.textContent = '📋 Copiar como texto'; };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        btnCopiar.textContent = '✓ Copiado!';
        setTimeout(restaurar, 2000);
      }).catch(() => fallbackCopiar(texto, btnCopiar, restaurar));
    } else {
      fallbackCopiar(texto, btnCopiar, restaurar);
    }
  });
  hdr.appendChild(btnCopiar);
  container.appendChild(hdr);

  // ── Seção 1: Parâmetros ─────────────────────────────────────────
  const sec1 = el('div', { class: 'relatorio-sec' });
  sec1.appendChild(el('div', { class: 'relatorio-sec-titulo' }, '1. Parâmetros da Eleição'));

  const grid1 = el('div', { class: 'relatorio-kpi-grid' });
  const kpi = (label, valor, formula, destaque) => {
    const d = el('div', { class: 'relatorio-kpi' + (destaque ? ' relatorio-kpi--destaque' : '') });
    d.appendChild(el('div', { class: 'relatorio-kpi-label' }, label));
    d.appendChild(el('div', { class: 'relatorio-kpi-valor' }, valor));
    if (formula) d.appendChild(el('div', { class: 'relatorio-kpi-formula' }, formula));
    return d;
  };

  if (original && original.votosValidos !== r.votosValidos) {
    grid1.appendChild(kpi('Votos válidos (antes)', n(original.votosValidos)));
    grid1.appendChild(kpi('Votos válidos (após cassação)', n(r.votosValidos), null, true));
  } else {
    grid1.appendChild(kpi('Votos válidos', n(r.votosValidos), 'nominais + legenda'));
  }
  if (original && original.qe !== r.qe) {
    grid1.appendChild(kpi('QE antes da cassação', n(original.qe)));
    grid1.appendChild(kpi('QE após cassação', n(r.qe), `floor(${n(r.votosValidos)} ÷ ${r.vagas})`, true));
  } else {
    grid1.appendChild(kpi('Quociente Eleitoral (QE)', n(r.qe), `floor(${n(r.votosValidos)} ÷ ${r.vagas})`));
  }
  grid1.appendChild(kpi('Barreira 80% QE', n(r.barreira80), `0,8 × ${n(r.qe)}`));
  grid1.appendChild(kpi('Piso individual 20% QE', n(r.piso20), `0,2 × ${n(r.qe)}`));
  grid1.appendChild(kpi('Vagas', String(r.vagas)));
  grid1.appendChild(kpi('QPs — Fase 1', String(r.totalQPs), 'vagas diretas'));
  grid1.appendChild(kpi('Sobras — F2+F3', String(r.sobras), 'por maiores médias'));
  sec1.appendChild(grid1);
  container.appendChild(sec1);

  // ── Seção 2: Tabela por partido ─────────────────────────────────
  const sec2 = el('div', { class: 'relatorio-sec' });
  sec2.appendChild(el('div', { class: 'relatorio-sec-titulo' }, '2. Distribuição por Partido e Fase'));

  const thead2 = el('thead', {}, el('tr', {},
    el('th', {}, 'Partido'),
    el('th', { class: 'right' }, 'Votos'),
    el('th', { class: 'right' }, '% QE'),
    el('th', { class: 'center' }, 'F1'),
    el('th', { class: 'center' }, 'F2'),
    el('th', { class: 'center' }, 'F3'),
    el('th', { class: 'center' }, 'Total'),
    el('th', { class: 'center' }, 'Status F2'),
  ));
  const tbody2 = el('tbody');
  for (const p of r.partidos) {
    const barrado = p.status === 'barrado_80';
    const tr = el('tr', { class: barrado ? 'relatorio-tr-barrado' : '' });
    tr.appendChild(el('td', {}, el('strong', {}, p.sigla)));
    tr.appendChild(el('td', { class: 'right' }, n(p.votos)));
    tr.appendChild(el('td', { class: 'right' }, (p.percentualQE * 100).toFixed(1) + '%'));
    tr.appendChild(el('td', { class: 'center' }, String(p.qp)));
    tr.appendChild(el('td', { class: 'center' }, String(p.sobrasF2)));
    tr.appendChild(el('td', { class: 'center' }, String(p.sobrasF3)));
    tr.appendChild(el('td', { class: 'center bold' }, String(p.total)));
    const deficit = Math.floor(r.barreira80) - p.votos;
    const badge = barrado
      ? el('span', { class: 'relatorio-badge relatorio-badge--barrado', title: `Faltaram ${n(deficit)} votos` }, 'Barrado')
      : el('span', { class: 'relatorio-badge relatorio-badge--apto' }, 'Apto');
    tr.appendChild(el('td', { class: 'center' }, badge));
    tbody2.appendChild(tr);
  }
  sec2.appendChild(el('div', { class: 'tabela-scroll' }, el('table', { class: 'relatorio-tabela' }, thead2, tbody2)));
  container.appendChild(sec2);

  // ── Seção 3: Partidos barrados ──────────────────────────────────
  const barrados = r.partidos.filter(p => p.status === 'barrado_80');
  if (barrados.length > 0) {
    const sec3 = el('div', { class: 'relatorio-sec' });
    sec3.appendChild(el('div', { class: 'relatorio-sec-titulo' }, '3. Partidos Excluídos da Fase 2'));
    sec3.appendChild(el('div', { class: 'relatorio-sec-sub' },
      `Barreira: ${n(r.barreira80)} votos (80% × QE ${n(r.qe)})`));
    const ul3 = el('ul', { class: 'relatorio-lista' });
    for (const p of barrados) {
      const deficit = Math.floor(r.barreira80) - p.votos;
      ul3.appendChild(el('li', {},
        el('strong', {}, p.sigla),
        ` — ${n(p.votos)} votos (faltaram `,
        el('strong', {}, n(deficit)),
        ` para a barreira)`
      ));
    }
    sec3.appendChild(ul3);
    sec3.appendChild(el('div', { class: 'relatorio-legal' },
      'Base legal: Art. 109, II, CE (Lei 14.211/2021) — constitucional conforme STF ADIs 7.228/7.263/7.325 (13/03/2025).'));
    container.appendChild(sec3);
  }

  // ── Seção 4: Fase 3 ────────────────────────────────────────────
  if (r.fase3Ativada) {
    const secF3 = el('div', { class: 'relatorio-sec relatorio-sec--f3' });
    secF3.appendChild(el('div', { class: 'relatorio-sec-titulo' }, '⚖ Fase 3 — Maiores Médias sem Barreira'));
    secF3.appendChild(el('p', { class: 'relatorio-motivo' }, r.fase3Motivo));
    const g3 = r.partidos.filter(p => p.sobrasF3 > 0);
    if (g3.length > 0) {
      const ul = el('ul', { class: 'relatorio-lista' });
      for (const p of g3) {
        ul.appendChild(el('li', {}, el('strong', {}, p.sigla), ` — ${p.sobrasF3} vaga(s) distribuída(s) na Fase 3`));
      }
      secF3.appendChild(ul);
    }
    secF3.appendChild(el('div', { class: 'relatorio-legal' },
      'Base legal: Art. 109, III, CE — sem barreira partidária na Fase 3 (ADIs 7.228/7.263/7.325 STF, 13/03/2025, Red. Min. Flávio Dino).'));
    container.appendChild(secF3);
  }

  // ── Seção 5: Comparativo ────────────────────────────────────────
  if (original) {
    const variacao = ElectoralEngine.compararResultados(original, r);
    const mudancas = Object.entries(variacao).filter(([, v]) => v !== 0);
    const secComp = el('div', { class: 'relatorio-sec' });
    secComp.appendChild(el('div', { class: 'relatorio-sec-titulo' }, '5. Variação de Cadeiras (Original × Retotalizado)'));
    secComp.appendChild(el('div', { class: 'relatorio-sec-sub' },
      `QE original: ${n(original.qe)} → QE retotalizado: ${n(r.qe)}`));
    if (mudancas.length === 0) {
      secComp.appendChild(el('p', { class: 'relatorio-motivo' }, 'Nenhuma variação — resultado idêntico ao cenário original.'));
    } else {
      const ulComp = el('ul', { class: 'relatorio-lista' });
      for (const [sigla, diff] of mudancas.sort((a, b) => b[1] - a[1])) {
        const pNome = (diff > 0 ? r : original).partidos.find(p => p.sigla === sigla)?.nome || sigla;
        const cls = diff > 0 ? 'relatorio-ganhou' : 'relatorio-perdeu';
        const txt = diff > 0 ? `ganhou +${diff} vaga(s)` : `perdeu ${Math.abs(diff)} vaga(s)`;
        ulComp.appendChild(el('li', { class: cls }, el('strong', {}, sigla), ` (${pNome}): ${txt}`));
      }
      secComp.appendChild(ulComp);
    }
    container.appendChild(secComp);
  }

  // ── Rodapé jurídico ─────────────────────────────────────────────
  const rodape = el('div', { class: 'relatorio-rodape' });
  rodape.innerHTML =
    '<strong>Fundamentação legal:</strong> Calculado conforme Art. 109 do Código Eleitoral ' +
    '(Lei nº 4.737/1965, redação dada pela Lei nº 14.211/2021) e interpretação conforme ' +
    'fixada pelo STF nas <strong>ADIs 7.228, 7.263 e 7.325</strong>, julgamento de mérito e ' +
    'embargos de declaração em 13/03/2025 (Redator Min. Flávio Dino).' +
    '<br><em>Sistema RetotalizaJE · Ferramenta técnico-jurídica de apoio · ' +
    'Não substitui decisão da Justiça Eleitoral.</em>';
  container.appendChild(rodape);
}

function fallbackCopiar(texto, btn, restaurar) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); btn.textContent = '✓ Copiado!'; } catch { btn.textContent = '⚠ Copie manualmente'; }
  document.body.removeChild(ta);
  setTimeout(restaurar, 2000);
}

// ─── Modo Apresentação — Slides ────────────────────────────────────────────────

/* Estado interno dos slides */
const _Apres = { slides: [], indice: 0 };

/** Listener de teclado */
function _apresKeys(e) {
  if (e.key === 'Escape')       sairApresentacao();
  if (e.key === 'ArrowRight')   _apresNavegar(1);
  if (e.key === 'ArrowLeft')    _apresNavegar(-1);
}

/** Navega para o slide índice `idx`, com fade suave */
function _apresIrPara(idx) {
  const slides = _Apres.slides;
  if (!slides.length) return;
  idx = Math.max(0, Math.min(idx, slides.length - 1));

  const atual = slides[_Apres.indice];
  if (atual) atual.classList.remove('ativo');

  _Apres.indice = idx;

  const prox = slides[idx];
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { if (prox) prox.classList.add('ativo'); });
  });

  const total = slides.length;
  const _cnt  = $('apres-contador');
const _bar  = $('apres-barra');
const _prev = $('apres-prev');
const _next = $('apres-next');
if (_cnt)  _cnt.textContent  = `${idx + 1} / ${total}`;
if (_bar)  _bar.style.width  = `${((idx + 1) / total) * 100}%`;
if (_prev) _prev.disabled    = idx === 0;
if (_next) _next.disabled    = idx === slides.length - 1;
}

function _apresNavegar(delta) { _apresIrPara(_Apres.indice + delta); }

function _apresSlide(cls) {
  const s = el('div', { class: `apres-slide ${cls}` });
  _Apres.slides.push(s);
  return s;
}

function _apresB(txt, cls) { return el('span', { class: `apres-badge ${cls}` }, txt); }

// ── Construtores de cada slide ──────────────────────────────────────────────

function _criarSlideCapa(r) {
  const s = _apresSlide('slide-capa');
  s.appendChild(el('div', { class: 'capa-pleito' }, r.rotulo));
  s.appendChild(el('div', { class: 'capa-subtitulo' },
    `${r.vagas} vagas  ·  QE ${fmt(r.qe)}  ·  Barreira 80% ${fmt(r.barreira80)}  ·  Piso 20% ${fmt(r.piso20)}`
  ));
  s.appendChild(el('div', { class: 'capa-badge' }, 'ADIs 7.228/7.263/7.325 — STF 13/03/2025'));
  if (r.fase3Ativada) {
    s.appendChild(el('div', { class: 'capa-fase3-badge' }, '⚖ FASE 3 ATIVADA — ADIs 7.228/7.263/7.325'));
  }
}

function _criarSlideMetricas(r) {
  const s = _apresSlide('slide-dark');
  s.appendChild(el('div', { class: 'slide-titulo' }, '📊 Métricas do Pleito'));

  const cards = [
    { label: 'Votos Válidos',       valor: fmt(r.votosValidos), sub: 'nominais + legenda',     cls: 'blue'  },
    { label: 'Quociente Eleitoral', valor: fmt(r.qe),           sub: `÷ ${r.vagas} vagas`,    cls: 'blue'  },
    { label: 'Barreira 80% QE',     valor: fmt(r.barreira80),   sub: 'mínimo para Fase 2',    cls: 'amber' },
    { label: 'Piso 20% QE',         valor: fmt(r.piso20),       sub: 'candidato elegível F2', cls: 'amber' },
    { label: 'Vagas Totais',        valor: fmt(r.vagas),        sub: 'ofertadas',              cls: 'green' },
    { label: 'QPs — Fase 1',        valor: fmt(r.totalQPs),     sub: 'vagas diretas',          cls: 'green' },
    { label: 'Sobras',              valor: fmt(r.sobras),       sub: 'para maiores médias',    cls: 'gray'  },
  ];

  const grid = el('div', { class: 'apres-kpi-grid' });
  for (const c of cards) {
    const card = el('div', { class: `apres-kpi-card ${c.cls}` });
    card.appendChild(el('div', { class: 'apres-kpi-label' }, c.label));
    card.appendChild(el('div', { class: 'apres-kpi-valor' }, c.valor));
    card.appendChild(el('div', { class: 'apres-kpi-sub'   }, c.sub));
    grid.appendChild(card);
  }
  s.appendChild(grid);
}

function _criarSlideDistribuicao(r, original) {
  const s = _apresSlide('slide-dark');
  s.appendChild(el('div', { class: 'slide-titulo' }, '🏛 Distribuição de Cadeiras'));

  const variacao = original ? ElectoralEngine.compararResultados(original, r) : {};
  const temComp  = !!original;

  const ths = ['Partido', 'Votos', '% QE', 'F1', 'F2', 'F3', 'Total'];
  if (temComp) ths.push('Variação');
  ths.push('F2?', 'Status');

  const thead = el('thead', {}, el('tr', {},
    ...ths.map(h => el('th', { class: ['Votos','% QE','F1','F2','F3','Total','Variação'].includes(h) ? 'right' : '' }, h))
  ));

  const tbody = el('tbody');
  for (const p of r.partidos) {
    const tr = el('tr');

    const tdSigla = el('td', {});
    tdSigla.appendChild(el('strong', {}, p.sigla));
    if (p.membros && p.membros.length) {
      tdSigla.appendChild(el('div', { style: 'font-size:10px;color:rgba(255,255,255,.4)' }, p.membros.join(' · ')));
    }
    tr.appendChild(tdSigla);

    tr.appendChild(el('td', { class: 'right' }, fmt(p.votos)));
    tr.appendChild(el('td', { class: 'right' }, fmtPct(p.percentualQE)));
    tr.appendChild(el('td', { class: 'right center' }, String(p.qp)));
    tr.appendChild(el('td', { class: 'right center' }, String(p.sobrasF2)));
    tr.appendChild(el('td', { class: 'right center' }, String(p.sobrasF3)));
    tr.appendChild(el('td', { class: 'right center' },
      el('strong', { style: p.total > 0 ? 'color:#34D399' : '' }, String(p.total))
    ));

    if (temComp) {
      const diff = variacao[p.sigla] || 0;
      const cls = diff > 0 ? 'apres-var-pos' : diff < 0 ? 'apres-var-neg' : 'apres-var-zero';
      const txt = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : '—';
      tr.appendChild(el('td', { class: `right ${cls}` }, txt));
    }

    const limiar85 = r.qe * 0.85;
    const limiar75 = r.qe * 0.75;
    let badgeF2;
    if (p.votos >= limiar85)      badgeF2 = _apresB('Apto F2',    'apto-f2');
    else if (p.votos >= limiar75) badgeF2 = _apresB('⚠ Sensível', 'sens-f2');
    else                          badgeF2 = _apresB('Excluído F2','excl-f2');
    tr.appendChild(el('td', {}, badgeF2));

    const SBADGE = {
      eleito:               ['Eleito',    'eleito'],
      qualificado_sem_vaga: ['Qualif.',   'qualif'],
      barrado_80:           ['Barrado',   'barrado'],
      fase3_apenas:         ['Fase 3',    'fase3'],
      sem_votos:            ['Sem votos', 'qualif'],
    };
    const [stxt, scls] = SBADGE[p.status] || [p.status, 'qualif'];
    tr.appendChild(el('td', {}, _apresB(stxt, scls)));
    tbody.appendChild(tr);
  }

  s.appendChild(el('div', { class: 'apres-table-wrap' },
    el('table', { class: 'apres-table' }, thead, tbody)
  ));
}

function _criarSlideFase3(r) {
  const s = _apresSlide('slide-fase3');
  s.appendChild(el('div', { class: 'f3-titulo' }, '⚖ FASE 3 ATIVADA'));
  s.appendChild(el('div', { class: 'f3-subtitulo' }, r.fase3Motivo ||
    'Fase 3 ativada — vagas residuais distribuídas sem barreira partidária.'));
  s.appendChild(el('div', { class: 'f3-badge' }, 'ADIs 7.228/7.263/7.325 — STF 13/03/2025'));
}

function _criarSlideAuditoria(rodada, r) {
  const s = _apresSlide('slide-dark');

  const hdr = el('div', { class: 'apres-audit-header' });
  hdr.appendChild(el('span', { class: 'apres-audit-num' }, `#${rodada.rodada}`));
  hdr.appendChild(el('span', { class: `apres-audit-fase ${rodada.fase === 3 ? 'f3' : 'f2'}` },
    rodada.fase === 3 ? 'Fase 3' : 'Fase 2'));

  const vencedorInfo = rodada.medias.find(m => m.sigla === rodada.vencedor);
  const vencedorLabel = (vencedorInfo && vencedorInfo.membros && vencedorInfo.membros.length)
    ? `${rodada.vencedor} (${vencedorInfo.membros.join(' + ')})` : rodada.vencedor;

  hdr.appendChild(el('span', { class: 'apres-audit-venc' }, `Vencedor: ${vencedorLabel}`));
  hdr.appendChild(el('span', { class: 'apres-audit-media' }, `Média: ${fmtD(rodada.mediaVencedor, 2)}`));

  if (rodada.candidatoConvocado) {
    const partLabel = (rodada.candidatoConvocado.partido && rodada.candidatoConvocado.partido !== rodada.vencedor)
      ? ` [${rodada.candidatoConvocado.partido}]` : '';
    hdr.appendChild(el('span', { class: 'apres-audit-cand' },
      `↪ ${rodada.candidatoConvocado.nome}${partLabel} (${fmt(rodada.candidatoConvocado.votos)})`));
  }
  s.appendChild(hdr);

  const thead = el('thead', {}, el('tr', {},
    el('th', {}, 'Partido'),
    el('th', { class: 'right' }, 'Votos'),
    el('th', { class: 'right' }, 'Cads+1'),
    el('th', { class: 'right' }, 'Média'),
    el('th', { class: 'center' }, '>80% QE?'),
    el('th', { class: 'center' }, 'Cands. 20%'),
    el('th', { class: 'center' }, 'Participa?'),
  ));

  const tbody = el('tbody');
  for (const m of rodada.medias) {
    const isVenc = m.sigla === rodada.vencedor && m.participaDaRodada;
    const tr = el('tr', { class: isVenc ? 'row-venc' : !m.participaDaRodada ? 'row-excl' : '' });
    const tdSigla = el('td', {});
    tdSigla.appendChild(el('strong', {}, m.sigla));
    if (m.membros && m.membros.length) {
      tdSigla.appendChild(el('div', { style: 'font-size:10px;color:rgba(255,255,255,.35)' }, m.membros.join(' · ')));
    }
    tr.appendChild(tdSigla);
    tr.appendChild(el('td', { class: 'right' }, fmt(m.votos)));
    tr.appendChild(el('td', { class: 'right' }, String(m.cadeirasMaisUm)));
    tr.appendChild(el('td', { class: 'right' }, fmtD(m.media, 2)));
    tr.appendChild(el('td', { class: 'center' }, m.qualificado80 ? '✓' : '✕'));
    tr.appendChild(el('td', { class: 'center' }, m.candidatos20disponiveis < 0 ? '(s/lista)' : String(m.candidatos20disponiveis)));
    tr.appendChild(el('td', { class: 'center' }, m.participaDaRodada ? '✓' : '✕'));
    tbody.appendChild(tr);
  }

  s.appendChild(el('div', { class: 'apres-table-wrap' },
    el('table', { class: 'apres-table' }, thead, tbody)
  ));
  s.appendChild(el('div', { class: 'apres-audit-fund' }, rodada.fundamentacao));
}

function _criarSlideCandidatos(r, cenario) {
  if (!cenario) return;
  // Apenas partidos com vagas E candidatos cadastrados
  const partidos = r.partidos.filter(p => {
    if (p.total === 0) return false;
    const pc = (cenario.partidos || []).find(cp => cp.sigla === p.sigla);
    return pc && pc.candidatos && pc.candidatos.length > 0;
  });
  if (partidos.length === 0) return;

  // Agrupar em slides de até 4 partidos
  const PORSLIDE = 4;
  for (let i = 0; i < partidos.length; i += PORSLIDE) {
    const grupo = partidos.slice(i, i + PORSLIDE);
    const s = _apresSlide('slide-dark');
    const sufixo = partidos.length > PORSLIDE
      ? ` (${i + 1}–${Math.min(i + PORSLIDE, partidos.length)} de ${partidos.length})`
      : '';
    s.appendChild(el('div', { class: 'slide-titulo' }, `👥 Candidatos por Ordem${sufixo}`));

    const grid = el('div', { class: 'apres-cands-grid' });
    for (const p of grupo) {
      const ordemCands = candidatosOrdenados(p, cenario);
      if (!ordemCands || ordemCands.length === 0) continue;

      const box = el('div', { class: 'apres-cand-box' });
      const titulo = el('div', { class: 'apres-cand-titulo' });
      titulo.append(
        el('strong', {}, p.sigla),
        el('span', { class: 'apres-cand-vagas' }, ` — ${p.total} vaga${p.total !== 1 ? 's' : ''}`)
      );
      box.appendChild(titulo);

      const ul = el('ul', { class: 'apres-cand-lista' });
      ordemCands.forEach((c, idx) => {
        const pos = idx + 1;
        const li = el('li', { class: c.eleito ? 'apres-cand-eleito' : 'apres-cand-suplente' });
        const tagTxt = c.eleito ? `${pos}º ✓` : `${pos}º`;
        li.append(
          el('span', { class: c.eleito ? 'apres-ctag-eleito' : 'apres-ctag-sup' }, tagTxt),
          ` ${c.nome} (${fmt(c.votos)})`
        );
        ul.appendChild(li);
      });
      box.appendChild(ul);
      grid.appendChild(box);
    }
    s.appendChild(grid);
  }
}

function _criarSlideComparativo(original, r) {
  const s = _apresSlide('slide-dark');
  s.appendChild(el('div', { class: 'slide-titulo' }, '🔄 Comparativo: Original × Retotalizado'));

  const variacao = ElectoralEngine.compararResultados(original, r);
  const grid = el('div', { class: 'apres-comp-grid' });

  const colOrig = el('div', { class: 'apres-comp-col' });
  colOrig.appendChild(el('h3', {}, 'Cenário Original'));
  for (const p of original.partidos) {
    const row = el('div', { class: 'apres-comp-row' });
    row.appendChild(el('span', { class: 'sigla' }, p.sigla));
    row.appendChild(el('span', { class: 'vagas' }, String(p.total)));
    colOrig.appendChild(row);
  }
  grid.appendChild(colOrig);

  const colRet = el('div', { class: 'apres-comp-col' });
  colRet.appendChild(el('h3', {}, 'Cenário Retotalizado'));
  for (const p of r.partidos) {
    const diff = variacao[p.sigla] || 0;
    const cor = diff > 0 ? '#34D399' : diff < 0 ? '#FCA5A5' : '';
    const row = el('div', { class: 'apres-comp-row' });
    row.appendChild(el('span', { class: 'sigla', style: cor ? `color:${cor}` : '' }, p.sigla));
    const vagasEl = el('span', { class: 'vagas', style: cor ? `color:${cor}` : '' }, String(p.total));
    if (diff !== 0) {
      vagasEl.appendChild(el('span', {
        style: `font-size:12px;margin-left:6px;color:${diff > 0 ? '#34D399' : '#FCA5A5'}`,
      }, diff > 0 ? `+${diff}` : String(diff)));
    }
    row.appendChild(vagasEl);
    colRet.appendChild(row);
  }
  grid.appendChild(colRet);
  s.appendChild(grid);

  const migracoes = Object.entries(variacao).filter(([, v]) => v !== 0);
  if (migracoes.length) {
    const wrap = el('div', { class: 'apres-migracoes' });
    for (const [sigla, diff] of migracoes) {
      const acao = diff > 0 ? `${sigla} +${diff}` : `${sigla} ${diff}`;
      wrap.appendChild(el('span', { class: `apres-migr-chip ${diff > 0 ? 'ganhou' : 'perdeu'}` }, acao));
    }
    s.appendChild(wrap);
  }
}

// ── Orquestrador principal ──────────────────────────────────────────────────

function entrarApresentacao() {
  if (!Estado.resultado) return;

  const r        = Estado.resultado;
  const original = Estado.resultadoOriginal;

  _Apres.slides = [];
  _Apres.indice = 0;
  const area = $('apres-slides-area');
  area.innerHTML = '';

  _criarSlideCapa(r);
  _criarSlideMetricas(r);
  _criarSlideDistribuicao(r, original);
  if (r.fase3Ativada) _criarSlideFase3(r);
  _criarSlideCandidatos(r, Estado.cenario);
  for (const rod of r.auditoria) {
    _criarSlideAuditoria(rod, r);
  }
  if (original) _criarSlideComparativo(original, r);

  for (const s of _Apres.slides) area.appendChild(s);

  document.body.classList.add('modo-apresentacao');
  _apresIrPara(0);

  document.addEventListener('keydown', _apresKeys);
  $('apres-prev').addEventListener('click', () => _apresNavegar(-1));
  $('apres-next').addEventListener('click', () => _apresNavegar(1));
}

function sairApresentacao() {
  document.body.classList.remove('modo-apresentacao');
  document.removeEventListener('keydown', _apresKeys);
}

// ─── Cassações ──────────────────────────────────────────────────────────────────

let contadorCassacao = 0;

function adicionarCassacaoUI(dados = null) {
  const id = ++contadorCassacao;
  const container = $('lista-cassacoes');
  const row = el('div', { class: 'cassacao-row', id: `cassacao-${id}` });

  // ── Coletar siglas disponíveis dos cards de partido ───────────────────────────
  const siglaEls = document.querySelectorAll('.partido-sigla');
  const siglas = Array.from(siglaEls).map(e => e.value.trim()).filter(Boolean);

  // ── Campo Partido: dropdown se há dados carregados, senão texto livre ─────────
  let selPartido;
  if (siglas.length > 0) {
    selPartido = el('select', { class: 'cass-partido', 'aria-label': 'Partido' });
    selPartido.appendChild(el('option', { value: '' }, '— Partido —'));
    for (const s of siglas) selPartido.appendChild(el('option', { value: s }, s));
  } else {
    selPartido = el('input', { type: 'text', placeholder: 'Sigla partido', class: 'cass-partido', 'aria-label': 'Partido' });
  }

  // ── Campo Candidato: dropdown se há candidatos nos cards ──────────────────────
  const temCandidatos = document.querySelectorAll('.candidato-row .candidato-nome').length > 0;
  let selCandidato;
  if (temCandidatos) {
    selCandidato = el('select', { class: 'cass-candidato', 'aria-label': 'Candidato' });
    selCandidato.appendChild(el('option', { value: '' }, '— Candidato (opcional) —'));
  } else {
    selCandidato = el('input', { type: 'text', placeholder: 'Nome candidato (opcional)', class: 'cass-candidato', 'aria-label': 'Candidato' });
  }

  const selVotos = el('input', { type: 'number', placeholder: 'Votos a anular', min: '0', class: 'cass-votos', 'aria-label': 'Votos' });

  const selModal = el('select', { class: 'cass-modalidade', 'aria-label': 'Modalidade' });
  for (const [k, v] of Object.entries(I18N.MODALIDADE_CASSACAO)) {
    selModal.appendChild(el('option', { value: k }, v));
  }

  const btnRem = el('button', { class: 'btn btn-perigo btn-xs cass-btn-rem', onclick: () => row.remove() }, '✕');

  // ── Montar grupos com label ───────────────────────────────────────────────────
  const gPartido = el('div', { class: 'cass-field-group' });
  const lPartido = el('label', { class: 'cass-field-label' }); lPartido.textContent = 'Partido';
  gPartido.append(lPartido, selPartido);

  const gCandidato = el('div', { class: 'cass-field-group' });
  const lCandidato = el('label', { class: 'cass-field-label' }); lCandidato.textContent = 'Candidato';
  gCandidato.append(lCandidato, selCandidato);

  const wVotos = el('div', { class: 'input-valida' }); wVotos.appendChild(selVotos);
  const gVotos = el('div', { class: 'cass-field-group' });
  const lVotos = el('label', { class: 'cass-field-label' }); lVotos.textContent = 'Votos a anular';
  gVotos.append(lVotos, wVotos);

  const gModal = el('div', { class: 'cass-field-group cass-field-modal' });
  const lModal = el('label', { class: 'cass-field-label' }); lModal.textContent = 'Modalidade';
  gModal.append(lModal, selModal);

  const fieldRow = el('div', { class: 'cass-field-row' });
  fieldRow.append(gPartido, gCandidato, gVotos, gModal, btnRem);

  const preview = el('div', { class: 'cass-preview' });

  row.append(fieldRow, preview);
  container.appendChild(row);

  // ── Lógica de cascata ─────────────────────────────────────────────────────────

  function getSigla() {
    return selPartido.tagName === 'SELECT' ? selPartido.value : selPartido.value.trim();
  }

  function atualizarCandidatos() {
    if (selCandidato.tagName !== 'SELECT') return;
    const sigla = getSigla();
    const cards = document.querySelectorAll('.partido-card');
    const candidatos = [];
    for (const card of cards) {
      const sig = card.querySelector('.partido-sigla');
      if (sig && sig.value.trim() === sigla) {
        card.querySelectorAll('.candidato-row').forEach(cr => {
          const nome = cr.querySelector('.candidato-nome');
          const votos = cr.querySelector('.candidato-votos');
          if (nome && nome.value.trim()) {
            candidatos.push({ nome: nome.value.trim(), votos: votos ? (votos.value.trim() || '') : '' });
          }
        });
        break;
      }
    }
    selCandidato.innerHTML = '';
    selCandidato.appendChild(el('option', { value: '' }, '— Candidato (opcional) —'));
    for (const c of candidatos) {
      const label = c.votos ? `${c.nome} (${Number(c.votos).toLocaleString('pt-BR')} votos)` : c.nome;
      selCandidato.appendChild(el('option', { value: c.nome, 'data-votos': c.votos }, label));
    }
  }

  function atualizarVotosDoCandidato() {
    if (selCandidato.tagName !== 'SELECT') return;
    const opt = selCandidato.selectedOptions[0];
    if (opt && opt.dataset.votos) selVotos.value = opt.dataset.votos;
    atualizarPreview();
  }

  function atualizarPreview() {
    const partido = getSigla();
    const candidato = selCandidato.tagName === 'SELECT' ? selCandidato.value : selCandidato.value.trim();
    const votos = selVotos.value ? Number(selVotos.value).toLocaleString('pt-BR') : '';
    const modalText = selModal.selectedOptions[0] ? selModal.selectedOptions[0].textContent : '';
    const isDrap = selModal.value === 'cassacao_drap';

    if (!partido) { preview.textContent = ''; return; }

    let texto = '';
    if (isDrap) {
      texto = `Cassação do DRAP — ${partido}`;
    } else if (candidato && votos) {
      texto = `Anular ${votos} votos de ${candidato} (${partido}) · ${modalText}`;
    } else if (votos) {
      texto = `Anular ${votos} votos do partido ${partido} · ${modalText}`;
    } else if (candidato) {
      texto = `Cassação de ${candidato} (${partido}) · ${modalText}`;
    } else {
      texto = `Cassação — ${partido} · ${modalText}`;
    }
    preview.textContent = texto;
  }

  function atualizarCamposCassacao() {
    const isDrap = selModal.value === 'cassacao_drap';
    gCandidato.style.display = isDrap ? 'none' : '';
    gVotos.style.display     = isDrap ? 'none' : '';
    atualizarPreview();
  }

  if (selPartido.tagName === 'SELECT') {
    selPartido.addEventListener('change', () => { atualizarCandidatos(); atualizarPreview(); });
  } else {
    selPartido.addEventListener('input', atualizarPreview);
  }
  if (selCandidato.tagName === 'SELECT') {
    selCandidato.addEventListener('change', atualizarVotosDoCandidato);
  } else {
    selCandidato.addEventListener('input', atualizarPreview);
  }
  selVotos.addEventListener('input', atualizarPreview);
  selModal.addEventListener('change', atualizarCamposCassacao);

  // ── Preencher com dados passados (preset / URL restore) ───────────────────────
  if (dados) {
    if (selPartido.tagName === 'SELECT') {
      selPartido.value = dados.partido || '';
      atualizarCandidatos();
    } else {
      selPartido.value = dados.partido || '';
    }
    if (selCandidato.tagName === 'SELECT') {
      selCandidato.value = dados.candidato || '';
    } else {
      selCandidato.value = dados.candidato || '';
    }
    selVotos.value = dados.votosAnular || '';
    selModal.value = dados.modalidade || 'nominal';
    selModal.dispatchEvent(new Event('change'));
    atualizarPreview();
  }
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
    adicionarCassacaoUI(cass);
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
  if (!sel) return;
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
  $('select-preset')?.addEventListener('change', e => carregarPresetUI(e.target.value));

  // Botões de ação
  $('btn-adicionar-partido').addEventListener('click', () => adicionarPartidoUI());
  $('btn-calcular').addEventListener('click', executarCalculo);
  $('btn-limpar').addEventListener('click', () => {
    if (confirm('Limpar todos os dados?')) {
      $('input-rotulo').value = '';
      $('input-vagas').value = '';
      $('lista-partidos').innerHTML = '';
      $('lista-partidos').classList.remove('modo-tse');
      $('lista-cassacoes').innerHTML = '';
      $('erros-formulario').innerHTML = '';
      contadorPartido = 0;
      contadorCassacao = 0;
    }
  });
  $('btn-adicionar-cassacao').addEventListener('click', adicionarCassacaoUI);

  $('btn-apresentacao').addEventListener('click', entrarApresentacao);
  $('apres-sair').addEventListener('click', sairApresentacao);

  $('btn-exportar-csv').addEventListener('click', () => {
    if (!Estado.resultado) return;
    Export.downloadCSV(Export.exportarCSV(Estado.resultado, Estado.cenario), `retotalizacao.csv`);
  });
  $('btn-exportar-pdf').addEventListener('click', () => {
    if (!Estado.resultado) return;
    Export.exportarPDF(Estado.resultado, Estado.resultadoOriginal, Estado.cenario);
  });
  $('btn-link').addEventListener('click', copiarLink);

  // Carregar da URL se houver (compartilhamento via botão 🔗 Link)
  const cenarioDaURL = Export.lerCenarioDaURL();
  if (cenarioDaURL) {
    preencherFormularioDeCenario(cenarioDaURL);
  }
  // Auto-restore do último cálculo removido — página inicia sempre limpa

  // Adicionar ao menos um partido vazio inicialmente
  if (document.querySelectorAll('.partido-card').length === 0) {
    adicionarPartidoUI();
  }

  // Validação em tempo real
  inicializarValidacao();

  // Versão no rodapé
  const spanVersao = $('rodape-versao');
  if (spanVersao) {
    spanVersao.textContent = `v${APP_VERSION} · art. 109 CE · ADIs 7.228/7.263/7.325 · ${APP_BUILD}`;
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
    adicionarCassacaoUI(c);
  }
}

document.addEventListener('DOMContentLoaded', init);

// ── Exports para módulo de importação TSE ───────────────────────────────────────
window._UI = {
  adicionarPartido: adicionarPartidoUI,
  preencherCenario: preencherFormularioDeCenario,
};

})(); // fim da IIFE
