// cascata-reverso.js — Modo reverso da cascata: apoio à decisão de litigar.
//
// A cascata direta parte de uma decisão já tomada (uma cassação digitada) e
// calcula as consequências. Este módulo inverte a pergunta: o advogado
// descreve o cenário que cogita atacar e o sistema devolve o retorno em jogo,
// reorganizado na ótica de quem decide se vale a pena litigar — o que o
// partido dele ganharia, o que o partido adversário perderia, e o quão
// frágil é a vaga em disputa.
//
// Módulo puro: sem DOM. Reaproveita calcularCascata e gerarCenarioCascata
// integralmente (mesmos números da cascata direta, sem recálculo paralelo) e
// calcularMargemUltimaCadeira para medir a fragilidade da cadeira. calcularFn
// (a função calcular do engine) é recebida por injeção, nunca importada —
// mesmo padrão de cascata-margem.js.
//
// IMPORTANTE — por que a margem e a síntese de impacto NÃO são fundidas numa
// única frase: calcularMargemUltimaCadeira mede a fragilidade da cadeira no
// cenário ATUAL (antes de qualquer cassação), por uma via independente
// (sobra de D'Hondt). A cascata, aqui, é calculada sobre o cenário da
// cassação COGITADA, um evento diferente. gerarSintese (cascata-sintese.js)
// pressupõe que os dois vêm do MESMO cenário sintético; usá-la aqui atribuiria
// o efeito financeiro da cassação à virada de margem, com causa errada. Por
// isso este módulo gera duas frases independentes: uma sobre a fragilidade da
// vaga (fato autônomo) e outra sobre o impacto da cassação cogitada.

import { calcularCascata } from "./cascata.js";
import { gerarCenarioCascata, normalizarTexto } from "./cascata-adaptador.js";
import { calcularMargemUltimaCadeira } from "./cascata-margem.js";

function clonarProfundamente(valor) {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }
  return JSON.parse(JSON.stringify(valor));
}

const AVISO_ESCOPO_PROCESSUAL =
  "Este cálculo mede apenas o retorno financeiro e político-eleitoral em jogo " +
  "(FEFC, tempo de propaganda e cláusula de desempenho), a partir dos mesmos " +
  "dados e fórmulas da cascata direta. Custo do litígio, risco processual, " +
  "prazo, prova disponível e mérito da tese de cassação ou anulação são juízo " +
  "exclusivo do advogado responsável pelo caso e estão fora do escopo deste " +
  "cálculo.";

// Acha a chave de um mapa que corresponde à sigla informada, tolerando
// diferença de acentuação/caixa (ex.: "UNIAO" digitado vs. "UNIÃO" na base
// oficial). Nunca por substring — sempre igualdade exata após normalizarTexto.
function buscarChaveNormalizada(mapa, sigla) {
  if (!mapa || !sigla) return null;
  if (Object.prototype.hasOwnProperty.call(mapa, sigla)) return sigla;
  const alvo = normalizarTexto(sigla);
  for (const chave of Object.keys(mapa)) {
    if (normalizarTexto(chave) === alvo) return chave;
  }
  return null;
}

// Traduz uma sigla individual para a entidade usada pelo nó da cláusula
// (ex.: "PT" -> "FE Brasil (PT/PC do B/PV)"), reaproveitando o mapeamento já
// existente em dadosReferencia.clausulaLinhaDeBase2022.mapeamentoSiglaParaEntidade.
// Siglas fora de federação não têm entrada no mapa e permanecem como estão,
// mesmo fallback usado em calcularClausula (js/cascata.js).
function resolverEntidadeClausula(sigla, dadosReferencia) {
  const linhaDeBase = dadosReferencia && dadosReferencia.clausulaLinhaDeBase2022;
  const mapeamento = (linhaDeBase && linhaDeBase.mapeamentoSiglaParaEntidade) || {};
  const chave = buscarChaveNormalizada(mapeamento, sigla);
  return chave ? mapeamento[chave] : sigla;
}

function extrairImpactoFEFC(noFefc, sigla) {
  if (!noFefc || noFefc.status !== "validado") {
    return { status: (noFefc && noFefc.status) || "indisponivel" };
  }
  const chave = buscarChaveNormalizada(noFefc.porPartido, sigla);
  const dados = chave ? noFefc.porPartido[chave] : null;
  return {
    status: "validado",
    delta2: dados ? dados.delta2 : 0,
    delta35: dados ? dados.delta35 : 0,
    delta48: dados ? dados.delta48 : 0,
    delta15: dados ? dados.delta15 : 0,
    deltaTotal: dados ? dados.deltaTotal : 0
  };
}

function extrairImpactoTV(noTempoTV, sigla) {
  if (!noTempoTV || noTempoTV.status !== "validado") {
    return { status: (noTempoTV && noTempoTV.status) || "indisponivel" };
  }
  const chave = buscarChaveNormalizada(noTempoTV.porPartido, sigla);
  const dados = chave ? noTempoTV.porPartido[chave] : null;
  return {
    status: "validado",
    fracaoAntes: dados ? dados.fracaoAntes : 0,
    fracaoDepois: dados ? dados.fracaoDepois : 0,
    deltaFracao: dados ? dados.deltaFracao : 0,
    deltaSegundos: dados && typeof dados.deltaSegundos === "number" ? dados.deltaSegundos : null
  };
}

function extrairImpactoClausula(noClausula, sigla, dadosReferencia) {
  if (!noClausula) return { status: "indisponivel" };
  const entidade = resolverEntidadeClausula(sigla, dadosReferencia);
  const chaveEntidade = buscarChaveNormalizada(noClausula.porEntidade, entidade) || entidade;
  const info = noClausula.porEntidade ? noClausula.porEntidade[chaveEntidade] : null;
  const mudancaEntry = (noClausula.mudancas || []).find((m) => m.entidade === chaveEntidade) || null;
  return {
    status: noClausula.status,
    entidade: chaveEntidade,
    cumpriuAntes: info ? info.cumpriuAntes : null,
    cumpriuDepois: info ? info.cumpriuDepois : null,
    mudou: info ? info.mudou : false,
    domino: mudancaEntry ? mudancaEntry.domino : null
  };
}

// Quando o chamador não informa explicitamente quem é o adversário, infere a
// partir do(s) partido(s) das cassações cogitadas (opts.cassacoes) — o
// adversário natural é quem está sendo atacado na decisão em análise. Trata
// notação de federação ("PT/PC do B/PV") do mesmo jeito que o adaptador faz
// para o delta de votos: cada membro é uma sigla candidata.
function inferirSiglasAdversariasDeCassacoes(cassacoes) {
  const siglas = new Set();
  for (const cass of Array.isArray(cassacoes) ? cassacoes : []) {
    const partido = String((cass && (cass.partido || cass.sigla)) || "").trim();
    if (!partido) continue;
    for (const membro of partido.split("/").map((s) => s.trim()).filter(Boolean)) {
      siglas.add(membro);
    }
  }
  return Array.from(siglas);
}

const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
function inteiro(valor) {
  return fmtInt.format(Math.round(valor));
}

// Frase sobre a fragilidade da vaga — fato autônomo, independente da cassação
// cogitada. Mesma lógica de cascata-sintese.js (parte 1), reescrita aqui para
// não acoplar este módulo a uma função cujo contrato pressupõe o cenário
// sintético de virada de margem.
function gerarFraseFragilidade(margem) {
  if (!margem || margem.status === "sem_sobras") {
    return "Não há sobras distribuídas por D'Hondt nesta retotalização; a fragilidade da última cadeira não é mensurável por este método.";
  }

  const uc = margem.ultimaCadeira;
  const pf = margem.primeiroFora;

  if (pf && pf.votosNecessarios !== null) {
    return (
      "Independentemente da cassação em análise, a última cadeira, hoje de " +
      uc.sigla +
      ", já está a " +
      inteiro(pf.votosNecessarios) +
      " votos de legenda de passar para " +
      pf.sigla +
      " pela via ordinária da distribuição de sobras — uma medida de quão apertada é essa vaga."
    );
  }

  if (pf) {
    const motivo = pf.tipoExclusao
      ? String(pf.tipoExclusao).replace(/_/g, " ")
      : "motivo não identificado";
    return (
      "A margem da última cadeira, hoje de " +
      uc.sigla +
      ", não é calculável pela legenda de " +
      pf.sigla +
      " (" +
      motivo +
      ")."
    );
  }

  return "Não foi encontrado partido concorrente com margem calculável para esta cadeira.";
}

const fmtReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function reais(valor) {
  // Intl pt-BR insere U+00A0 entre "R$" e o número; trocado por espaço comum
  // para não corromper texto colado em editores ou processadores de petição.
  return fmtReais.format(valor).replace(/ /g, " ");
}

const fmtPct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function porCento(fracao) {
  return fmtPct.format(fracao * 100) + " por cento";
}

// Frase sobre o impacto da cassação cogitada, na ótica do litígio: o que o
// partido próprio ganha, o que cada adversário perde. Adaptação de
// cascata-sintese.js (parte 2) para o cenário da decisão, não da margem.
function gerarFraseImpactoLitigio(siglaPartidoProprio, ganhos, siglasAdversarias, perdas) {
  const ganhosTexto = [];

  if (ganhos.fefc && ganhos.fefc.status === "validado" && ganhos.fefc.deltaTotal > 0) {
    ganhosTexto.push("ganha " + reais(ganhos.fefc.deltaTotal) + " de FEFC");
  }
  if (ganhos.tempoTV && ganhos.tempoTV.status === "validado" && ganhos.tempoTV.deltaFracao > 0) {
    ganhosTexto.push("ganha " + porCento(ganhos.tempoTV.deltaFracao) + " do tempo de TV");
  }

  let fraseGanho;
  if (ganhosTexto.length > 0) {
    fraseGanho =
      "Se a cassação cogitada se confirmar, " + siglaPartidoProprio + " " + ganhosTexto.join(" e ") + ".";
  } else {
    fraseGanho =
      "Se a cassação cogitada se confirmar, não foi identificado ganho financeiro ou de tempo de TV para " +
      siglaPartidoProprio +
      " nos nós calculados.";
  }

  const fraseClausulaPropria =
    ganhos.clausula && ganhos.clausula.mudou
      ? " " +
        siglaPartidoProprio +
        (ganhos.clausula.cumpriuDepois ? " passa a cumprir" : " deixa de cumprir") +
        " a cláusula de desempenho."
      : "";

  const perdasTexto = (siglasAdversarias || []).map((sigla) => {
    const p = perdas[sigla] || {};
    const itens = [];
    if (p.fefc && p.fefc.status === "validado" && p.fefc.deltaTotal < 0) {
      itens.push(reais(Math.abs(p.fefc.deltaTotal)) + " de FEFC");
    }
    if (p.tempoTV && p.tempoTV.status === "validado" && p.tempoTV.deltaFracao < 0) {
      itens.push(porCento(Math.abs(p.tempoTV.deltaFracao)) + " do tempo de TV");
    }

    let texto =
      itens.length > 0
        ? sigla + " perde " + itens.join(" e ")
        : sigla + " sem perda financeira ou de tempo de TV identificada nos nós calculados";

    if (p.clausula && p.clausula.mudou && p.clausula.cumpriuDepois === false) {
      texto += "; deixa de cumprir a cláusula de desempenho";
    }
    return texto;
  });

  const fraseAdversario = perdasTexto.length > 0 ? " Em contrapartida, " + perdasTexto.join("; ") + "." : "";

  return fraseGanho + fraseClausulaPropria + fraseAdversario;
}

// Função principal do modo reverso.
//
// Parâmetros:
//   saidaEngineBase        — saída do engine SEM a cassação cogitada (estado atual)
//   cenarioOriginalBase    — cenário INPUT do engine sem cassações (para a margem,
//                            que precisa recalcular o engine várias vezes)
//   saidaEngineCenario     — saída do engine COM a cassação cogitada
//   calcularFn             — ElectoralEngine.calcular, injetado (nunca importado)
//   dadosReferencia        — mesmo objeto de cascata-referencia.js usado na cascata direta
//   categoria, uf, opts    — mesmos parâmetros de gerarCenarioCascata (opts inclui
//                            cassacoes, tabelaGeneroRaca; Fase 5 já fiada, sem mudança)
//   siglaPartidoProprio    — obrigatório: de quem é o advogado. O sistema não infere
//                            isso — é uma decisão do usuário, não um dado do cálculo.
//   siglasPartidosAdversarios — opcional; se omitido, infere do(s) partido(s) das
//                            cassações cogitadas em opts.cassacoes.
export function analisarDecisaoLitigio(params) {
  const {
    saidaEngineBase,
    cenarioOriginalBase,
    saidaEngineCenario,
    calcularFn,
    dadosReferencia,
    categoria,
    uf,
    opts = {},
    siglaPartidoProprio,
    siglasPartidosAdversarios
  } = params || {};

  if (!siglaPartidoProprio) {
    throw new Error(
      "analisarDecisaoLitigio: siglaPartidoProprio é obrigatório — o sistema não infere de quem é o advogado."
    );
  }

  const base = clonarProfundamente(saidaEngineBase);
  const cenario = clonarProfundamente(saidaEngineCenario);

  const margem = calcularMargemUltimaCadeira(base, cenarioOriginalBase, calcularFn);

  const cenarioCascata = gerarCenarioCascata(base, cenario, categoria, uf, opts);
  const resultadoCascata = calcularCascata(base, cenario, dadosReferencia, cenarioCascata);

  const siglasAdversarias = (
    siglasPartidosAdversarios && siglasPartidosAdversarios.length > 0
      ? siglasPartidosAdversarios
      : inferirSiglasAdversariasDeCassacoes(opts.cassacoes)
  ).filter((sigla) => sigla !== siglaPartidoProprio);

  const ganhosPartidoProprio = {
    fefc: extrairImpactoFEFC(resultadoCascata.nos.fefc, siglaPartidoProprio),
    tempoTV: extrairImpactoTV(resultadoCascata.nos.tempoTV, siglaPartidoProprio),
    clausula: extrairImpactoClausula(resultadoCascata.nos.clausula, siglaPartidoProprio, dadosReferencia)
  };

  const perdasPorAdversario = {};
  for (const sigla of siglasAdversarias) {
    perdasPorAdversario[sigla] = {
      fefc: extrairImpactoFEFC(resultadoCascata.nos.fefc, sigla),
      tempoTV: extrairImpactoTV(resultadoCascata.nos.tempoTV, sigla),
      clausula: extrairImpactoClausula(resultadoCascata.nos.clausula, sigla, dadosReferencia)
    };
  }

  return {
    margem,
    cascata: resultadoCascata,
    siglaPartidoProprio,
    siglasPartidosAdversarios: siglasAdversarias,
    ganhosPartidoProprio,
    perdasPorAdversario,
    fraseFragilidade: gerarFraseFragilidade(margem),
    fraseImpactoLitigio: gerarFraseImpactoLitigio(
      siglaPartidoProprio,
      ganhosPartidoProprio,
      siglasAdversarias,
      perdasPorAdversario
    ),
    avisoEscopo: AVISO_ESCOPO_PROCESSUAL
  };
}
