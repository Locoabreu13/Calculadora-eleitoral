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

export function calcularTempoTV() {
  // TODO: preencher a formula apos validacao contra dado oficial do TSE.
  return criarResultadoPendente();
}

export function calcularFEFC() {
  // TODO: preencher a formula apos validacao contra dado oficial do TSE.
  return criarResultadoPendente();
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
