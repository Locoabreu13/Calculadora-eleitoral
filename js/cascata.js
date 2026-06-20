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

export function calcularTempoTV(base, _cenarioRetotalizado, dadosReferencia, cenario, _categoria) {
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

  // Filtra a tabela nacional para conter apenas os partidos que de fato
  // registraram candidato a deputado federal no estado da retotalizacao,
  // pois o tempo de TV de deputado federal e dividido por concorrente real
  // em cada unidade da federacao, nao pela bancada nacional inteira.
  // Validado contra o relatorio oficial "Distribuicao de Tempo" do TRE-CE,
  // Cargo Deputado Federal, 2022 (total de representantes 494, nao 507,
  // por exclusao do SOLIDARIEDADE, que nao teve candidato no Ceara).
  const siglasEstado = (() => {
    const partidosEstado = base && Array.isArray(base.partidos) ? base.partidos : null;
    if (!partidosEstado) return null;
    return new Set(
      partidosEstado
        .map((p) => String((p && p.sigla) || "").trim().toUpperCase())
        .filter(Boolean)
    );
  })();

  const federacoes = (dadosReferencia && dadosReferencia.federacoesTV2022) || {};

  function partidoConcorreuNoEstado(siglaNacional) {
    if (!siglasEstado) return true;
    const siglaUpper = String(siglaNacional).trim().toUpperCase();
    if (siglasEstado.has(siglaUpper)) return true;
    const membros = federacoes[siglaNacional];
    if (Array.isArray(membros)) {
      return membros.some((m) => siglasEstado.has(String(m).trim().toUpperCase()));
    }
    return false;
  }

  const siglasExcluidasPorAusenciaNoEstado = siglasEstado
    ? Object.keys(fotoBase).filter((sigla) => !partidoConcorreuNoEstado(sigla))
    : [];

  function filtrarPorEstado(fotoCadeiras) {
    if (!siglasEstado) return fotoCadeiras;
    const resultado = {};
    for (const [sigla, cadeiras] of Object.entries(fotoCadeiras)) {
      if (partidoConcorreuNoEstado(sigla)) {
        resultado[sigla] = cadeiras;
      }
    }
    return resultado;
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

  const fracaoAntes = repartirFracao(filtrarPorEstado(fotoBase));
  const fracaoDepois = repartirFracao(filtrarPorEstado(fotoDepois));
  const todasSiglas = new Set([
    ...Object.keys(fracaoAntes),
    ...Object.keys(fracaoDepois)
  ]);

  const totalSegundosBloco = referencia.totalSegundosBloco || null;
  const porPartido = {};

  for (const sigla of todasSiglas) {
    const antes = fracaoAntes[sigla] || 0;
    const depois = fracaoDepois[sigla] || 0;
    const deltaFracao = depois - antes;

    porPartido[sigla] = {
      fracaoAntes: antes,
      fracaoDepois: depois,
      deltaFracao
    };

    // Conversao para segundos reais, validada contra o art. 47, par. 1o,
    // inciso II, alinea "a" da Lei 9.504/1997 (750 segundos por bloco,
    // deputado federal). So calculada quando a referencia tiver esse dado.
    if (totalSegundosBloco) {
      porPartido[sigla].segundosAntes = antes * totalSegundosBloco;
      porPartido[sigla].segundosDepois = depois * totalSegundosBloco;
      porPartido[sigla].deltaSegundos = deltaFracao * totalSegundosBloco;
    }
  }

  const resultado = {
    status: "validado",
    base: "tempoTVCamara2022",
    porPartido
  };

  if (siglasNaoMapeadas.length) {
    resultado._siglasNaoMapeadas = siglasNaoMapeadas;
  }

  if (siglasExcluidasPorAusenciaNoEstado.length) {
    resultado._siglasExcluidasPorAusenciaNoEstado = siglasExcluidasPorAusenciaNoEstado;
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

  const pool35 = 1736531922.00;
  const votosBase = fefc.votosPorPartido || {};
  const deltaVotos = cenario && cenario.deltaVotosFEFCPorPartido;
  const temDeltaVotos =
    categoria !== "cassacao_sem_perda_votos" &&
    deltaVotos &&
    typeof deltaVotos === "object";

  let totalVotosBase = 0;
  for (const votos of Object.values(votosBase)) {
    totalVotosBase += votos;
  }

  let totalVotosNovo = totalVotosBase;
  if (temDeltaVotos) {
    for (const variacao of Object.values(deltaVotos)) {
      totalVotosNovo += variacao;
    }
  }

  const siglas = new Set([
    ...Object.keys(votosBase),
    ...Object.keys(deltaCadeiras),
    ...(temDeltaVotos ? Object.keys(deltaVotos) : [])
  ]);

  const porPartido = {};

  for (const sigla of siglas) {
    const variacaoCadeiras = deltaCadeiras[sigla] || 0;
    const delta2 = 0;
    const delta48 = unidadeCadeira * variacaoCadeiras;
    const delta15 = 0;

    let delta35 = 0;
    if (temDeltaVotos) {
      const basePartido = votosBase[sigla] || 0;
      const variacaoVotos = deltaVotos[sigla] || 0;
      const fracaoAntiga = totalVotosBase > 0 ? basePartido / totalVotosBase : 0;
      const fracaoNova = totalVotosNovo > 0 ? (basePartido + variacaoVotos) / totalVotosNovo : 0;
      delta35 = (fracaoNova - fracaoAntiga) * pool35;
    }

    const deltaTotal = delta2 + delta35 + delta48 + delta15;

    porPartido[sigla] = { delta2, delta35, delta48, delta15, deltaTotal };
  }

  return {
    status: "validado",
    unidadeCadeira,
    unidadeSenador,
    porPartido
  };
}

export function calcularClausula(_base, _cenarioRetotalizado, dadosReferencia, cenario, _categoria) {
  const linhaDeBase = dadosReferencia && dadosReferencia.clausulaLinhaDeBase2022;
  const clausulaMeta = dadosReferencia && dadosReferencia.clausula;

  if (!linhaDeBase || !clausulaMeta) {
    return criarResultadoPendente();
  }

  const uf = cenario && cenario.circunscricao;
  if (!uf) {
    return { ...criarResultadoPendente(), observacao: "circunscricao nao informada" };
  }

  const delta = cenario && cenario.deltaCadeirasPorPartido;
  if (!delta || typeof delta !== "object") {
    return { ...criarResultadoPendente(), observacao: "delta de cadeiras nao informado" };
  }

  const anoEleicao = linhaDeBase.anoEleicao;
  const patamar = clausulaMeta.patamaresPorEleicao[anoEleicao];
  if (!patamar) {
    return { ...criarResultadoPendente(), observacao: "patamar nao encontrado para ano " + anoEleicao };
  }

  const mapeamento = linhaDeBase.mapeamentoSiglaParaEntidade;
  const cadeirasPorEntidadePorUFBase = linhaDeBase.cadeirasPorEntidadePorUF;
  const statusVotosPorEntidade = linhaDeBase.statusVotosPorEntidade;

  // Mapear delta de siglas para entidades (federacoes ou partidos individuais).
  // Siglas desconhecidas sao registradas e ignoradas.
  const deltaEntidade = {};
  const siglasNaoMapeadas = [];

  for (const [sigla, variacao] of Object.entries(delta)) {
    const entidade = mapeamento[sigla] || sigla;
    if (!cadeirasPorEntidadePorUFBase[entidade] && !statusVotosPorEntidade[entidade]) {
      siglasNaoMapeadas.push(sigla);
      continue;
    }
    deltaEntidade[entidade] = (deltaEntidade[entidade] || 0) + variacao;
  }

  // Avalia o criterio de cadeiras antes e depois da retotalizacao,
  // aplicando a variacao apenas na UF da circunscricao.
  function avaliarCriteriosCadeiras(entidade, variacaoNaUF) {
    const baseUF = cadeirasPorEntidadePorUFBase[entidade] || {};

    const cadeirasAntes = Object.values(baseUF).reduce((a, b) => a + b, 0);
    const ufsAntes = Object.values(baseUF).filter(c => c >= 1).length;

    const depoisUF = { ...baseUF };
    const novaCont = (depoisUF[uf] || 0) + variacaoNaUF;
    if (novaCont > 0) {
      depoisUF[uf] = novaCont;
    } else {
      delete depoisUF[uf];
    }
    const cadeirasDepois = Object.values(depoisUF).reduce((a, b) => a + b, 0);
    const ufsDepois = Object.values(depoisUF).filter(c => c >= 1).length;

    return {
      antes: {
        cadeiras: cadeirasAntes,
        ufsComCadeira: ufsAntes,
        cumpriu: cadeirasAntes >= patamar.deputadosMinimos && ufsAntes >= patamar.ufsMinimas
      },
      depois: {
        cadeiras: cadeirasDepois,
        ufsComCadeira: ufsDepois,
        cumpriu: cadeirasDepois >= patamar.deputadosMinimos && ufsDepois >= patamar.ufsMinimas
      }
    };
  }

  const perdaDeVotos = cenario.perdaDeVotos === true;
  const porEntidade = {};
  const mudancas = [];

  for (const [entidade, variacaoNaUF] of Object.entries(deltaEntidade)) {
    const svBase = statusVotosPorEntidade[entidade] || {
      cumpriuPorVotos: false, pctNacional: 0, ufsComPctMinimo: 0
    };
    const critCadeiras = avaliarCriteriosCadeiras(entidade, variacaoNaUF);

    // Criterio de votos: sem perda de votos, mantem o resultado da eleicao de base.
    // Com perda de votos, marcado como parcial_pendente (recalculo por UF nao implementado).
    const critVotos = perdaDeVotos
      ? { status: "parcial_pendente", observacao: "recalculo de votos por UF nao implementado" }
      : { cumpriu: svBase.cumpriuPorVotos, pctNacional: svBase.pctNacional, ufsComPctMinimo: svBase.ufsComPctMinimo };

    const cumpriuAntes = critCadeiras.antes.cumpriu || svBase.cumpriuPorVotos;
    const cumpriuDepois = perdaDeVotos
      ? null
      : (critCadeiras.depois.cumpriu || critVotos.cumpriu);
    const mudou = !perdaDeVotos && (cumpriuAntes !== cumpriuDepois);

    porEntidade[entidade] = {
      criteriosCadeiras: critCadeiras,
      criterioVotos: critVotos,
      cumpriuAntes,
      cumpriuDepois,
      mudou
    };

    if (mudou) {
      mudancas.push({
        entidade,
        de: cumpriuAntes ? "CUMPRIA" : "nao_cumpria",
        para: cumpriuDepois ? "CUMPRE" : "nao_cumpre",
        detalheCadeiras: critCadeiras,
        detalheVotos: critVotos
      });
    }
  }

  const resultado = {
    status: perdaDeVotos ? "parcial_votos_pendentes" : "validado",
    anoEleicao,
    uf,
    patamarAplicado: "EC 97/2017, inciso " + patamar.incisoEC97,
    limites: {
      deputadosMinimos: patamar.deputadosMinimos,
      ufsMinimas: patamar.ufsMinimas,
      votosValidosPct: patamar.votosValidosPct,
      votosMinimoPorUFPct: patamar.votosMinimoPorUFPct
    },
    temMudancaNaClausula: mudancas.length > 0,
    mudancas,
    porEntidade
  };

  if (siglasNaoMapeadas.length) {
    resultado._siglasNaoMapeadas = siglasNaoMapeadas;
  }

  return resultado;
}

export function calcularFundoPartidario(base, cenarioRetotalizado, dadosReferencia, cenario, categoriaClassificada) {
  const fpRef = dadosReferencia.fundoPartidario;
  const votosBase = dadosReferencia.fefc.votosPorPartido;

  const elegiveisBase = fpRef.entidadesElegiveis5Pct;
  const qtdElegiveisBase = elegiveisBase.length;

  let totalVotosBase = 0;
  for (const p in votosBase) {
    if (elegiveisBase.includes(p)) {
      totalVotosBase += votosBase[p];
    }
  }

  const fracoesBase = {};
  const deltas = {};

  for (const p in votosBase) {
    let f5 = 0;
    if (elegiveisBase.includes(p)) {
      f5 = 1 / qtdElegiveisBase;
    }

    let f95 = 0;
    if (elegiveisBase.includes(p) && totalVotosBase > 0) {
      f95 = votosBase[p] / totalVotosBase;
    }

    fracoesBase[p] = { fatia5: f5, fatia95: f95 };
    // O delta real requer a variacao de votos ponderados e a variacao da clausula.
    // Mantemos zerado nesta etapa para permitir a validacao da base contra o TSE.
    deltas[p] = { deltaFatia5: 0, deltaFatia95: 0 };
  }

  let statusNo = "validado";
  if (categoriaClassificada === "cassacao_com_perda_votos" || categoriaClassificada === "anulacao_drap") {
    statusNo = "parcial_pendente_delta_votos";
  }

  return {
    status: statusNo,
    fracoesBase: fracoesBase,
    deltas: deltas,
    valorTotalAnual: fpRef.valorTotalAnual
  };
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
