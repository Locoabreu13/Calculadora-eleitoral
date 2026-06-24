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

// Formula 90/10 da Lei 9.504/1997, art. 47, validada contra a Resolucao TSE 23.706/2022
// em conferencia-tempotv-presidente.mjs. Elevada ao escopo do modulo para ser compartilhada
// por calcularTempoTV (calcula delta por estado) e calcularDominoTempoTV (fracao nacional
// para o domino da clausula). Uma unica implementacao da formula, dois pontos de uso.
// A porta de entrada (cadeira maior que zero) implementa o limiar do art. 47.
function repartirFracao(fotoCadeiras) {
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

  const resultado = {
    status: "validado",
    unidadeCadeira,
    unidadeSenador,
    porPartido
  };

  // Aviso de consistencia: em cenario de perda de votos, o delta35 deveria
  // ter sido calculado. Se chegou zero para todos os partidos e nao era
  // cassacao_sem_perda_votos, registra observacao para facilitar depuracao.
  if (categoria !== "cassacao_sem_perda_votos" && !temDeltaVotos) {
    resultado._aviso = "delta35_ausente: categoria indica perda de votos mas " +
      "deltaVotosFEFCPorPartido nao foi fornecido; fatia de 35% calculada como zero";
  }

  return resultado;
}

// Calcula o domino do fundo partidario quando uma entidade perde a clausula de desempenho.
// Chama calcularFundoPartidario com cenario vazio para obter fracoesBase ja validadas,
// sem duplicar a formula de calculo de cotas. Retorna status "sem_dados_referencia" quando
// os dados de referencia de FP ou votos ponderados nao estiverem disponiveis.
function calcularDominoFundoPartidario(entidade, dadosReferencia) {
  const fpRef = dadosReferencia && dadosReferencia.fundoPartidario;
  const fefc = dadosReferencia && dadosReferencia.fefc;

  if (!fpRef || !fefc || !fefc.votosPorPartido) {
    return { status: "sem_dados_referencia" };
  }

  const fpBase = calcularFundoPartidario(null, null, dadosReferencia, {}, "cassacao_sem_perda_votos");
  const fracaoEntidade = fpBase.fracoesBase[entidade];
  const eraElegivel = !!(fracaoEntidade && fracaoEntidade.fatia5 > 0);

  if (!eraElegivel) {
    return { status: "nao_era_elegivel", eraElegivel: false };
  }

  const fracaoAtual = fracaoEntidade.fatia5 * 0.05 + fracaoEntidade.fatia95 * 0.95;
  const valorAtual = typeof fpRef.valorTotalAnual === "number"
    ? fracaoAtual * fpRef.valorTotalAnual
    : null;
  const quantosGanham = (fpRef.entidadesElegiveis5Pct || []).length - 1;

  return { status: "calculado", eraElegivel: true, fracaoAtual, valorAtual, quantosGanham };
}

// Calcula o domino do tempo de TV quando uma entidade perde a clausula de desempenho.
// Usa repartirFracao (modulo) sobre a tabela nacional tempoTVCamara2022.
//
// ATENCAO — denominador nacional, nao por estado: este calculo usa a tabela tempoTVCamara2022
// com a totalidade das 507 cadeiras da Camara, sem filtragem por UF. O domino da clausula e um
// efeito nacional: a entidade perde o acesso ao tempo de TV em todas as UFs (CF/1988, art. 17,
// par. 3, com regime transitorio do art. 3 da EC 97/2017 — VERIFICAR referencia legal contra
// o texto oficial antes de usar em peca processual). Nao confundir com calcularTempoTV, que
// filtra pelo conjunto de partidos concorrentes em cada estado especifico (precisao validada em
// TC-03b contra o relatorio oficial do TRE-CE).
function calcularDominoTempoTV(entidade, dadosReferencia) {
  const tvRef = dadosReferencia && dadosReferencia.tempoTVCamara2022;

  if (!tvRef || !tvRef.cadeirasPorPartido) {
    return { status: "sem_dados_referencia" };
  }

  const tvCadeiras = tvRef.cadeirasPorPartido;
  const mapeamento = (dadosReferencia.clausulaLinhaDeBase2022 &&
    dadosReferencia.clausulaLinhaDeBase2022.mapeamentoSiglaParaEntidade) || {};
  const federacoesTV = dadosReferencia.federacoesTV2022 || {};

  // Mapear o nome de clausula para a chave da tabela de TV.
  // Entidades individuais batem diretamente. Federacoes de clausula (ex.: "FE Brasil (PT/PC do B/PV)")
  // sao localizadas via membros do mapeamentoSiglaParaEntidade cruzados com federacoesTV2022.
  let chaveTV = null;
  if (tvCadeiras[entidade] !== undefined) {
    chaveTV = entidade;
  } else {
    const membros = Object.entries(mapeamento)
      .filter(([, ent]) => ent === entidade)
      .map(([sigla]) => sigla);

    for (const [tvSigla, tvMembros] of Object.entries(federacoesTV)) {
      if (membros.some(m => tvMembros.includes(m))) {
        chaveTV = tvSigla;
        break;
      }
    }
  }

  if (chaveTV === null || !(tvCadeiras[chaveTV] > 0)) {
    return { status: "sem_representacao", temRepresentacao: false };
  }

  const fracoes = repartirFracao(tvCadeiras);
  const fracaoAtual = fracoes[chaveTV] || 0;
  const totalSegundosBloco = tvRef.totalSegundosBloco || null;
  const segundosAtual = totalSegundosBloco !== null ? fracaoAtual * totalSegundosBloco : null;
  const quantosGanham = Object.values(tvCadeiras).filter(c => c > 0).length - 1;

  return {
    status: "calculado",
    temRepresentacao: true,
    chaveTV,
    fracaoAtual,
    segundosAtual,
    quantosGanham
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

  // Etapa 3b — entidades que perderam votos (delta simples por UF vindo do
  // adaptador). Inclui no conjunto avaliado tambem entidades que perderam votos
  // sem mudar cadeira (variacao de cadeira 0), para a clausula nao ignorar uma
  // perda de votos isolada. A validacao de sigla, adiada de proposito na Etapa 2,
  // acontece aqui: siglas desconhecidas vao para siglasNaoMapeadas, mesmo padrao.
  const deltaVotosClausula = (cenario && cenario.deltaVotosClausulaPorPartido) || {};
  const entidadesComPerdaVotos = new Set();
  for (const [sigla, variacao] of Object.entries(deltaVotosClausula)) {
    if (!(variacao < 0)) continue;
    const entidade = mapeamento[sigla] || sigla;
    if (!cadeirasPorEntidadePorUFBase[entidade] && !statusVotosPorEntidade[entidade]) {
      if (!siglasNaoMapeadas.includes(sigla)) siglasNaoMapeadas.push(sigla);
      continue;
    }
    entidadesComPerdaVotos.add(entidade);
    if (!(entidade in deltaEntidade)) deltaEntidade[entidade] = 0;
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

    const cumpriuAntes = critCadeiras.antes.cumpriu || svBase.cumpriuPorVotos;

    // Criterio de votos.
    // - Sem perda de votos: inalterado, mantem o resultado da eleicao de base.
    // - Com perda de votos (Etapa 3b): o criterio de CADEIRAS acima nao muda; o de
    //   VOTOS tem dois patamares (percentual nacional e minimo por UF) que exigem o
    //   numero absoluto de votos por entidade, AUSENTE na referencia. Por isso, sem
    //   aproximar a partir do pctNacional armazenado:
    //     entidade que nao perdeu votos -> votos = base (definitivo);
    //     perdeu votos e ja nao cumpria por votos -> continua nao cumprindo
    //       (monotonico: remover votos nao faz cruzar o patamar para cima);
    //     perdeu votos e cumpria por votos -> PENDENTE (nao da para confirmar).
    let critVotos;
    let cumpriuDepois;
    if (!perdaDeVotos) {
      critVotos = { cumpriu: svBase.cumpriuPorVotos, pctNacional: svBase.pctNacional, ufsComPctMinimo: svBase.ufsComPctMinimo };
      cumpriuDepois = critCadeiras.depois.cumpriu || critVotos.cumpriu;
    } else {
      let votosDepois; // true | false | null (pendente)
      if (!entidadesComPerdaVotos.has(entidade)) {
        votosDepois = svBase.cumpriuPorVotos;
        critVotos = { cumpriu: votosDepois, pctNacional: svBase.pctNacional, ufsComPctMinimo: svBase.ufsComPctMinimo, base: "votos_inalterados" };
      } else if (svBase.cumpriuPorVotos === false) {
        votosDepois = false;
        critVotos = { cumpriu: false, observacao: "ja nao cumpria por votos; remocao de votos mantem abaixo do patamar" };
      } else {
        votosDepois = null;
        critVotos = { status: "parcial_pendente", observacao: "recalculo dos dois patamares de votos exige votos absolutos por entidade, ausentes na referencia" };
      }

      if (critCadeiras.depois.cumpriu || votosDepois === true) {
        cumpriuDepois = true;            // cumpre por cadeiras ou por votos (definitivo)
      } else if (votosDepois === false) {
        cumpriuDepois = false;           // falha cadeiras e votos: perdeu a clausula
      } else {
        cumpriuDepois = null;            // depende de votos nao recuperaveis: pendente
      }
    }

    const mudou = cumpriuDepois !== null && cumpriuAntes !== cumpriuDepois;

    porEntidade[entidade] = {
      criteriosCadeiras: critCadeiras,
      criterioVotos: critVotos,
      cumpriuAntes,
      cumpriuDepois,
      mudou
    };

    if (mudou) {
      const entrada = {
        entidade,
        de: cumpriuAntes ? "CUMPRIA" : "nao_cumpria",
        para: cumpriuDepois ? "CUMPRE" : "nao_cumpre",
        detalheCadeiras: critCadeiras,
        detalheVotos: critVotos
      };
      if (!cumpriuDepois) {
        entrada.domino = {
          fundoPartidario: calcularDominoFundoPartidario(entidade, dadosReferencia),
          tempoTV: calcularDominoTempoTV(entidade, dadosReferencia)
        };
      }
      mudancas.push(entrada);
    }
  }

  // O no so fica pendente se ALGUMA entidade ficou indefinida (cumpriuDepois null),
  // ou seja, quando a confirmacao dependeria de votos absolutos ausentes. Resolvido
  // por cadeiras ou por monotonia, o no e "validado".
  const temPendencia = Object.values(porEntidade).some((e) => e.cumpriuDepois === null);

  const resultado = {
    status: temPendencia ? "parcial_votos_pendentes" : "validado",
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

  // Etapa 3a — faixa de 95%: consome o delta de votos PONDERADO nacional vindo do
  // adaptador (cenario.deltaVotosFEFCPorPartido). A faixa de 95% e proporcional aos
  // votos entre as entidades elegiveis; uma cassacao com perda de votos move essa
  // proporcao. So recalcula quando ha delta disponivel; sem ele, mantem o fallback
  // pendente, sem inventar numero. A faixa de 5% (igualitaria) NAO muda aqui: ela
  // so se altera se a entidade perde a clausula, dominio tratado em
  // calcularDominoFundoPartidario a partir de calcularClausula.
  //
  // PREMISSA: o conjunto de elegiveis (elegiveisBase) e tratado como CONSTANTE entre
  // base e cenario. E sob essa premissa que a soma de todos os deltaFatia95 fecha em
  // zero (redistribuicao sem vazamento). Uma mudanca de elegibilidade causada pela
  // clausula e responsabilidade do dominio (calcularDominoFundoPartidario), nao deste
  // ponto.
  const deltaVotos = (cenario && cenario.deltaVotosFEFCPorPartido) || null;
  const aplicaDelta =
    (categoriaClassificada === "cassacao_com_perda_votos" || categoriaClassificada === "anulacao_drap") &&
    deltaVotos && typeof deltaVotos === "object" && Object.keys(deltaVotos).length > 0;

  // Novo total ponderado entre elegiveis, somando o delta apenas das entidades elegiveis.
  let totalVotosNovo = totalVotosBase;
  if (aplicaDelta) {
    for (const p in deltaVotos) {
      if (elegiveisBase.includes(p)) totalVotosNovo += deltaVotos[p];
    }
  }

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

    // deltaFatia95: variacao da fracao proporcional apos o delta de votos.
    // deltaFatia5 permanece 0 (a faixa igualitaria so muda com mudanca de clausula).
    let deltaFatia95 = 0;
    if (aplicaDelta && elegiveisBase.includes(p) && totalVotosNovo > 0) {
      const f95Novo = (votosBase[p] + (deltaVotos[p] || 0)) / totalVotosNovo;
      deltaFatia95 = f95Novo - f95;
    }
    deltas[p] = { deltaFatia5: 0, deltaFatia95: deltaFatia95 };
  }

  let statusNo = "validado";
  if (categoriaClassificada === "cassacao_com_perda_votos" || categoriaClassificada === "anulacao_drap") {
    // Com o delta disponivel, a faixa de 95% passa a ser calculada (validado).
    // Sem ele, permanece o fallback pendente, exatamente como antes.
    statusNo = aplicaDelta ? "validado" : "parcial_pendente_delta_votos";
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
