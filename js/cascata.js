function clonarProfundamente(valor) {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }

  return JSON.parse(JSON.stringify(valor));
}

export function classificarCenario(cenario) {
  if (!cenario || typeof cenario !== "object") {
    return "indefinido";
  }

  const tipo = String(cenario.tipo || "").toLowerCase();

  if (
    tipo === "anulacao_drap" ||
    tipo === "anulação_drap" ||
    tipo === "anulacao de drap" ||
    tipo === "anulação de drap"
  ) {
    return "anulacao_drap";
  }

  if (
    tipo === "cassacao_com_perda_votos" ||
    tipo === "cassação_com_perda_votos" ||
    cenario.perdaDeVotos === true
  ) {
    return "cassacao_com_perda_votos";
  }

  if (
    tipo === "cassacao_sem_perda_votos" ||
    tipo === "cassação_sem_perda_votos" ||
    cenario.perdaDeVotos === false
  ) {
    return "cassacao_sem_perda_votos";
  }

  return "indefinido";
}

function criarResultadoPendente() {
  return {
    status: "pendente_validacao",
    valorBase: null,
    valorCenario: null,
    delta: null
  };
}

export function calcularTempoTV(_base, _cenarioRetotalizado, dadosReferencia, cenario, _categoria) {
  const referencia = dadosReferencia && dadosReferencia.tempoTVCamara2022;
  const fotoBase = referencia && referencia.cadeirasPorPartido;

  if (!fotoBase || typeof fotoBase !== "object") {
    return criarResultadoPendente();
  }

  const deltaCadeiras = cenario && cenario.deltaCadeirasPorPartido;

  if (!deltaCadeiras || typeof deltaCadeiras !== "object") {
    return {
      ...criarResultadoPendente(),
      observacao: "delta de cadeiras nao informado"
    };
  }

  const fotoDepois = { ...fotoBase };
  const siglasNaoMapeadas = [];

  for (const [sigla, variacao] of Object.entries(deltaCadeiras)) {
    if (!Object.prototype.hasOwnProperty.call(fotoDepois, sigla)) {
      siglasNaoMapeadas.push(sigla);
      continue;
    }

    fotoDepois[sigla] += variacao;
  }

  function repartirFracao(fotoCadeiras) {
    // Formula 90/10 validada contra a Resolucao TSE 23.706/2022
    // em conferencia-tempotv-presidente.mjs. Aqui ela e aplicada em fracao
    // para medir o impacto de uma retotalizacao, sem arredondar em segundos.
    // A porta de entrada (cadeira maior que zero) implementa o limiar do art. 47.
    const concorrentes = Object.entries(fotoCadeiras)
      .filter(([, cadeiras]) => cadeiras > 0);

    if (concorrentes.length === 0) {
      return {};
    }

    const parteIgual = 0.10 / concorrentes.length;
    const somaCadeiras = concorrentes.reduce((s, [, cadeiras]) => s + cadeiras, 0);
    const fracoes = {};

    for (const [sigla, cadeiras] of concorrentes) {
      const parteProporcional = 0.90 * (cadeiras / somaCadeiras);
      fracoes[sigla] = parteIgual + parteProporcional;
    }

    return fracoes;
  }

  const fracaoAntes = repartirFracao(fotoBase);
  const fracaoDepois = repartirFracao(fotoDepois);
  const todasSiglas = new Set([
    ...Object.keys(fracaoAntes),
    ...Object.keys(fracaoDepois)
  ]);

  const porPartido = {};

  for (const sigla of todasSiglas) {
    const antes = fracaoAntes[sigla] || 0;
    const depois = fracaoDepois[sigla] || 0;

    porPartido[sigla] = {
      fracaoAntes: antes,
      fracaoDepois: depois,
      deltaFracao: depois - antes
    };
  }

  const resultado = {
    status: "validado",
    base: "tempoTVCamara2022",
    porPartido
  };

  if (siglasNaoMapeadas.length) {
    resultado._siglasNaoMapeadas = siglasNaoMapeadas;
  }

  return resultado;
}

export function calcularFEFC(_base, _cenarioRetotalizado, dadosReferencia, cenario, categoria) {
  const fefc = dadosReferencia && dadosReferencia.fefc;

  if (!fefc || fefc.poolCadeiras == null) {
    return criarResultadoPendente();
  }

  const unidadeCadeira = fefc.poolCadeiras / fefc.totalCadeiras;
  const unidadeSenador = fefc.poolSenado / fefc.totalSenadores;
  const deltaCadeiras = cenario && cenario.deltaCadeirasPorPartido;

  if (!deltaCadeiras || typeof deltaCadeiras !== "object") {
    return {
      ...criarResultadoPendente(),
      observacao: "delta de cadeiras nao informado"
    };
  }

  const porPartido = {};
  let temDelta35Pendente = false;

  for (const [sigla, variacao] of Object.entries(deltaCadeiras)) {
    const delta2 = 0;
    const delta48 = unidadeCadeira * variacao;
    const delta15 = 0;
    const delta35 = categoria === "cassacao_sem_perda_votos" ? 0 : null;
    const deltaTotal = delta35 === null ? null : delta2 + delta35 + delta48 + delta15;

    if (delta35 === null) {
      temDelta35Pendente = true;
    }

    porPartido[sigla] = { delta2, delta35, delta48, delta15, deltaTotal };
  }

  return {
    status: temDelta35Pendente ? "parcial_35_pendente" : "validado",
    unidadeCadeira,
    unidadeSenador,
    porPartido
  };
}

export function calcularClausula() {
  // TODO: preencher a formula apos validacao contra dado oficial do TSE.
  return criarResultadoPendente();
}

export function calcularFundoPartidario() {
  // TODO: preencher a formula apos validacao contra dado oficial do TSE.
  return criarResultadoPendente();
}

export function calcularCascata(saidaEngineBase, saidaEngineCenario, dadosReferencia, cenario) {
  const base = clonarProfundamente(saidaEngineBase);
  const cenarioRetotalizado = clonarProfundamente(saidaEngineCenario);
  // As copias defensivas garantem que a cascata nunca altere a estrutura original produzida pelo engine.

  const categoriaClassificada = classificarCenario(cenario);

  if (categoriaClassificada === "indefinido") {
    throw new Error(
      "Cenario indefinido: informe um tipo reconhecido ou o campo perdaDeVotos para permitir a classificacao da cascata."
    );
  }

  const tipo = cenario && Object.prototype.hasOwnProperty.call(cenario, "tipo")
    ? cenario.tipo
    : null;

  const circunscricaoAfetada = cenario && Object.prototype.hasOwnProperty.call(cenario, "circunscricao")
    ? cenario.circunscricao
    : null;

  return {
    cenario: { tipo, categoriaClassificada },
    circunscricaoAfetada,
    nos: {
      tempoTV: calcularTempoTV(base, cenarioRetotalizado, dadosReferencia, cenario, categoriaClassificada),
      fefc: calcularFEFC(base, cenarioRetotalizado, dadosReferencia, cenario, categoriaClassificada),
      clausula: calcularClausula(base, cenarioRetotalizado, dadosReferencia, cenario, categoriaClassificada),
      fundoPartidario: calcularFundoPartidario(base, cenarioRetotalizado, dadosReferencia, cenario, categoriaClassificada)
    },
    observacoes: []
  };
}
