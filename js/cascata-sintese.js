// cascata-sintese.js — Gera a frase-sintese da retotalizacao a partir dos
// resultados ja calculados pelos modulos de margem e de cascata.
//
// Funcao exportada:
//   gerarSintese(resultadoMargem, resultadoCascata) -> string
//
// Contrato do chamador: resultadoCascata deve ter sido calculado sobre o cenario
// sintetico em que primeiroFora.sigla recebeu primeiroFora.votosNecessarios votos
// de legenda adicionais. O modulo nao valida essa coerencia — apenas formata.
//
// Sem DOM. Sem imports. Determinístico.

const fmtReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtInt   = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
// Duas casas decimais: o metodo usa cadeiras inteiras de uma tabela nacional
// de 507 representantes, o que nao sustenta mais precisao do que isso.
const fmtPct   = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function reais(valor) {
  // Intl pt-BR insere U+00A0 entre "R$" e o número; substituímos por espaço regular
  // para não corromper texto colado em editores de texto ou processadores de petição.
  return fmtReais.format(valor).replace(/ /g, " ");
}

function inteiro(valor) {
  return fmtInt.format(Math.round(valor));
}

function porCento(fracao) {
  return fmtPct.format(fracao * 100) + " por cento";
}

function unir(partes) {
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1];
}

function detalheDomino(domino) {
  const fp = domino && domino.fundoPartidario && domino.fundoPartidario.status === "calculado";
  const tv = domino && domino.tempoTV && domino.tempoTV.status === "calculado";
  if (fp && tv) return "com perda de fundo e de tempo de TV";
  if (fp)       return "com perda de acesso ao fundo partidário";
  if (tv)       return "com perda de tempo de TV";
  return "com efeitos a verificar";
}

function segmentoClausula(clausula) {
  if (!clausula || !clausula.temMudancaNaClausula) return null;
  const perdas = (clausula.mudancas || []).filter(m => m.para === "nao_cumpre");
  if (perdas.length === 0) return null;

  const nomes = perdas.map(m => m.entidade);
  const quais = nomes.length === 1
    ? "a cláusula de " + nomes[0]
    : "a cláusula de " + nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];

  // Quando ha multiplas entidades perdendo clausula, usa o domino da primeira.
  // Cada entidade pode ter dominos distintos; a frase nao tenta fundir todos.
  return "pode derrubar " + quais + ", " + detalheDomino(perdas[0].domino);
}

const MOTIVO = {
  candidato_trava_20pct:      "candidatos individuais abaixo do piso de 20% do QE",
  sem_candidatos_disponiveis: "sem candidatos disponíveis na fase 3",
  excluido_outros:            "exclusão por motivo não categorizado"
};

export function gerarSintese(resultadoMargem, resultadoCascata) {
  // ── Parte 1 — Margem ──────────────────────────────────────────────────────
  let parte1;

  if (!resultadoMargem || resultadoMargem.status === "sem_sobras") {
    parte1 = "Não há sobras a distribuir por D'Hondt nesta retotalização.";
  } else {
    const uc = resultadoMargem.ultimaCadeira;
    const pf = resultadoMargem.primeiroFora;

    if (pf && pf.votosNecessarios !== null) {
      parte1 =
        "A última cadeira, hoje de " + uc.sigla
        + ", está a " + inteiro(pf.votosNecessarios) + " votos de legenda"
        + " de passar para " + pf.sigla + ".";
    } else if (pf) {
      const motivo = MOTIVO[pf.tipoExclusao]
        || (pf.tipoExclusao ? pf.tipoExclusao.replace(/_/g, " ") : "motivo não identificado");
      parte1 =
        "A margem da última cadeira não é calculável pela legenda de "
        + pf.sigla + " (" + motivo + ").";
    } else {
      parte1 = "Não foi encontrado partido concorrente com margem calculável para esta cadeira.";
    }
  }

  // ── Parte 2 — Cascata ────────────────────────────────────────────────────
  const margemOk =
    resultadoMargem &&
    resultadoMargem.status === "ok" &&
    resultadoMargem.primeiroFora &&
    resultadoMargem.primeiroFora.votosNecessarios !== null;

  const prefixo = margemOk ? "Virá-la " : "Essa mudança ";

  if (!resultadoCascata || !resultadoCascata.nos) {
    return parte1 + " " + prefixo + "não gerou impacto identificável nos nós financeiros calculados.";
  }

  const nos = resultadoCascata.nos;
  const partes = [];

  if (nos.fefc && nos.fefc.status === "validado") {
    const soma = Object.values(nos.fefc.porPartido || {})
      .reduce((s, p) => s + Math.max(0, p.deltaTotal || 0), 0);
    if (soma > 0) partes.push("desloca " + reais(soma) + " de FEFC");
  }

  if (nos.tempoTV && nos.tempoTV.status === "validado") {
    const somaPos = Object.values(nos.tempoTV.porPartido || {})
      .reduce((s, p) => s + Math.max(0, p.deltaFracao || 0), 0);
    if (somaPos > 0) partes.push("altera " + porCento(somaPos) + " do tempo de TV");
  }

  const clausulaSeg = segmentoClausula(nos.clausula);
  if (clausulaSeg) partes.push(clausulaSeg);

  const corpo = partes.length > 0
    ? prefixo + unir(partes) + "."
    : prefixo + "não gerou impacto identificável nos nós financeiros calculados.";

  return parte1 + " " + corpo;
}
