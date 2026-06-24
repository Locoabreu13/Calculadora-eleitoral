// cascata-peticao.js — Gera a peca de peticao para protocolo a partir do que a
// tela ja calculou para a DECISAO REAL carregada (base contra cenario).
//
// Este modulo nao recalcula nenhum no, nao reexecuta o motor, nao usa margem nem
// cenario sintetico. Ele apenas LE a saida de calcularCascata e o cenario adaptado,
// faz copia defensiva profunda na entrada e organiza tudo para impressao.
//
// Funcoes exportadas:
//   montarDadosPeca({ resultadoCascata, dadosCenario, contexto }) -> objeto de dados (sem DOM)
//   renderizarPecaHTML(dados) -> string HTML completa (sem DOM)
//   abrirPecaParaImpressao(dados) -> abre a janela de impressao do navegador (unico ponto com DOM)
//
// A separacao em tres funcoes permite validar montarDadosPeca e renderizarPecaHTML
// no Node, sem navegador, no padrao dos arquivos de conferencia .mjs do projeto.
//
// Observacao de idioma: os comentarios seguem o padrao do projeto, sem acentos.
// Todo texto visivel na peca (titulos, frase, fundamento legal, rodape) usa
// acentuacao plena, por se tratar de documento juridico formal.

function clonarProfundamente(valor) {
  if (valor == null) return valor;
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }
  return JSON.parse(JSON.stringify(valor));
}

// Montante anual de referencia do Fundo Partidario usado como recurso de exibicao
// quando a referencia oficial nao traz o valor (mesmo numero ja adotado em cascata-ui.js).
const FUNDO_VALOR_ANUAL_FALLBACK = 1185566089.46;

const NOME_UF = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
  PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima",
  RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo",
  TO: "Tocantins"
};

const MODALIDADE_LEGIVEL = {
  nominal: "anulação de votos nominais sem reatribuição",
  nominal_legenda: "anulação de votos nominais com reatribuição à legenda",
  total: "anulação total de votos",
  cassacao_drap: "anulação de DRAP"
};

const MOTIVO_VOTO_DOBRO_LEGIVEL = {
  ausente: "candidato não localizado na tabela de gênero e raça da unidade federativa",
  ambiguo: "registro divergente quanto à contagem em dobro para o candidato",
  sem_tabela: "tabela de gênero e raça não disponível para a unidade federativa e o ano da decisão",
  sigla_nao_mapeada_no_fefc: "sigla partidária não localizada na base oficial de votos do FEFC"
};

function motivoVotoDobroLegivel(motivo) {
  return MOTIVO_VOTO_DOBRO_LEGIVEL[motivo] || (motivo ? String(motivo) : "motivo não informado");
}

const fmtReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function reais(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "R$ 0,00";
  // Intl pt-BR insere U+00A0 entre "R$" e o numero; troca pelo espaco comum
  // para nao corromper texto colado em editores de peticao.
  return fmtReais.format(valor).replace(/\u00A0/g, " ");
}

function inteiro(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "0";
  return fmtInt.format(Math.round(valor));
}

// Percentual com duas casas, para a tabela por partido. Mesma precisao da frase
// de abertura (percentualProsa), para que frase e tabela nao divirjam. Duas casas
// porque o metodo do tempo de TV usa cadeiras inteiras de uma tabela de 507
// representantes, o que nao sustenta mais precisao (vide cascata-sintese.js).
function percentualPreciso(fracao) {
  if (typeof fracao !== "number" || !Number.isFinite(fracao)) return "0,00%";
  return (fracao * 100).toFixed(2).replace(".", ",") + "%";
}

// Percentual com duas casas, no padrao da frase-sintese do produto, para a prosa
// da frase de abertura. Deriva do mesmo numero do nó, apenas arredondado para leitura.
function percentualProsa(fracao) {
  if (typeof fracao !== "number" || !Number.isFinite(fracao)) return "0,00 por cento";
  return (Math.abs(fracao) * 100).toFixed(2).replace(".", ",") + " por cento";
}

function segundos(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null;
  return valor.toFixed(2).replace(".", ",") + "s";
}

function sinal(valor) {
  return typeof valor === "number" && valor > 0 ? "+" : "";
}

function escaparHtml(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nomeUf(uf) {
  const sigla = String(uf || "").trim().toUpperCase();
  return NOME_UF[sigla] || sigla;
}

// Une uma lista de nomes em prosa: "A", "A e B", "A, B e C".
function unirNomes(nomes) {
  if (!nomes || nomes.length === 0) return "";
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}

// Constroi "do partido X" / "dos partidos X e Y", regencia fixa que funciona
// para qualquer sigla ou federacao, sem o problema de genero do artigo.
function listaPartidos(siglas, preposicaoSingular, preposicaoPlural) {
  if (!siglas || siglas.length === 0) return "";
  if (siglas.length === 1) return " " + preposicaoSingular + " partido " + siglas[0];
  return " " + preposicaoPlural + " partidos " + unirNomes(siglas);
}

function ehStatusValidado(status) {
  return status === "validado";
}

function ehStatusPendente(status) {
  return typeof status === "string" && status.includes("pendente");
}

// ─── 1. Montagem dos dados ────────────────────────────────────────────────────

export function montarDadosPeca({ resultadoCascata, dadosCenario, contexto } = {}) {
  const r = clonarProfundamente(resultadoCascata) || {};
  const cen = clonarProfundamente(dadosCenario) || {};
  const ctx = clonarProfundamente(contexto) || {};

  const nos = r.nos || {};
  const fefc = nos.fefc || {};
  const tv = nos.tempoTV || {};
  const clausula = nos.clausula || {};
  const fundo = nos.fundoPartidario || {};

  const deltaCadeiras = (cen.deltaCadeirasPorPartido && typeof cen.deltaCadeirasPorPartido === "object")
    ? cen.deltaCadeirasPorPartido
    : {};

  const uf = String(ctx.uf || cen.circunscricao || r.circunscricaoAfetada || "").trim().toUpperCase();

  // Perdedores e ganhadores de cadeira, a partir do delta de cadeiras da decisao real.
  const perdedores = [];
  const ganhadores = [];
  let totalCadeirasMovidas = 0;
  for (const [sigla, delta] of Object.entries(deltaCadeiras)) {
    if (delta < 0) perdedores.push({ sigla, delta });
    if (delta > 0) {
      ganhadores.push({ sigla, delta });
      totalCadeirasMovidas += delta;
    }
  }

  // Somas de impacto, no mesmo criterio da frase-sintese (lado positivo).
  let somaFefc = 0;
  if (fefc.porPartido) {
    for (const p of Object.values(fefc.porPartido)) {
      somaFefc += Math.max(0, (p && p.deltaTotal) || 0);
    }
  }
  let somaTvFracao = 0;
  if (tv.porPartido) {
    for (const p of Object.values(tv.porPartido)) {
      somaTvFracao += Math.max(0, (p && p.deltaFracao) || 0);
    }
  }

  // A fatia de 35% (por votos) so se move quando ha delta de votos capturado.
  // Desde a Fase 5 (conferencia-fase5-heitor.mjs, 10/10 verificacoes), o
  // adaptador entrega deltaVotosFEFCPorPartido e o delta35 e calculado pelo no.
  // Este sinal permite a peca ser transparente: nao apresentar o FEFC como
  // integral nem citar o inciso II (votos) quando essa fatia for zero por
  // ausencia de perda de votos no cenario, nao por lacuna de implementacao.
  let fefcFatia35Moveu = false;
  if (fefc.porPartido) {
    for (const p of Object.values(fefc.porPartido)) {
      if (typeof (p && p.delta35) === "number" && p.delta35 !== 0) {
        fefcFatia35Moveu = true;
        break;
      }
    }
  }

  // Tabela consolidada por partido: uniao das siglas com movimento de cadeira,
  // de FEFC ou de tempo de TV.
  const valorFundoAnual = typeof fundo.valorTotalAnual === "number"
    ? fundo.valorTotalAnual
    : FUNDO_VALOR_ANUAL_FALLBACK;

  const siglas = new Set([
    ...Object.keys(deltaCadeiras),
    ...Object.keys(fefc.porPartido || {}).filter((s) => (fefc.porPartido[s].deltaTotal || 0) !== 0),
    ...Object.keys(tv.porPartido || {}).filter((s) => (tv.porPartido[s].deltaFracao || 0) !== 0)
  ]);

  const fundoValidado = ehStatusValidado(fundo.status);
  const fundoPendente = ehStatusPendente(fundo.status);

  const linhasTabela = [];
  for (const sigla of siglas) {
    const dCad = deltaCadeiras[sigla] || 0;
    const pFefc = (fefc.porPartido && fefc.porPartido[sigla]) || null;
    const pTv = (tv.porPartido && tv.porPartido[sigla]) || null;
    const fracaoFundo = (fundo.fracoesBase && fundo.fracoesBase[sigla]) || null;
    const deltaFundo = (fundo.deltas && fundo.deltas[sigla]) || null;
    // Impacto da decisao sobre o Fundo Partidario em reais: variacao de fracao
    // (deltaFatia5 + deltaFatia95) multiplicada pelo valor anual de referencia.
    // deltaFatia5 so muda quando a clausula muda (domino); deltaFatia95 muda
    // quando ha perda de votos e o adaptador entregou deltaVotosFEFCPorPartido.
    const fundoDeltaReais = deltaFundo
      ? ((deltaFundo.deltaFatia5 || 0) + (deltaFundo.deltaFatia95 || 0)) * valorFundoAnual
      : null;

    linhasTabela.push({
      sigla,
      deltaCadeira: dCad,
      fefcDelta: pFefc ? (pFefc.deltaTotal || 0) : null,
      fefcDelta48: pFefc && typeof pFefc.delta48 === "number" ? pFefc.delta48 : null,
      fefcDelta35: pFefc && typeof pFefc.delta35 === "number" ? pFefc.delta35 : null,
      tvDeltaFracao: pTv ? (pTv.deltaFracao || 0) : null,
      tvDeltaSegundos: pTv && typeof pTv.deltaSegundos === "number" ? pTv.deltaSegundos : null,
      fundoDeltaReais,
      fundoTemClausula: !!(fracaoFundo && (fracaoFundo.fatia5 || 0) > 0)
    });
  }
  // Ordena por maior ganho de FEFC primeiro, para leitura.
  linhasTabela.sort((a, b) => (b.fefcDelta || 0) - (a.fefcDelta || 0));

  // Bloco de cláusula com efeito dominó.
  const clausulaValidada = ehStatusValidado(clausula.status);
  const mudancasClausula = Array.isArray(clausula.mudancas) ? clausula.mudancas : [];

  // Decisao (cassacao carregada), para o cabecalho e a frase de abertura.
  const cassacoes = Array.isArray(ctx.decisao && ctx.decisao.cassacoes)
    ? ctx.decisao.cassacoes
    : (Array.isArray(ctx.cassacoes) ? ctx.cassacoes : []);

  // Avisos de voto em dobro nao garantido (Fase 5), vindos do adaptador via
  // cenario.cassacoes. Quando presentes, a peca exibe ressalva propria, antes
  // do fundamento legal.
  const avisosVotoEmDobro = Array.isArray(cen._avisosVotoEmDobro) ? cen._avisosVotoEmDobro : [];

  const cabecalho = {
    cargo: ctx.cargo || "Deputado Federal",
    uf,
    ufNome: nomeUf(uf),
    ano: ctx.ano || null,
    vagas: typeof ctx.vagas === "number" ? ctx.vagas : null,
    dataGeracao: ctx.dataGeracao instanceof Date ? ctx.dataGeracao : new Date(),
    decisaoDescricao: descreverDecisao(cassacoes)
  };

  const fraseAbertura = narrarFatoConsumado({
    cassacoes,
    perdedores,
    ganhadores,
    totalCadeirasMovidas,
    somaFefc,
    somaTvFracao,
    mudancasClausula,
    uf
  });

  return {
    cabecalho,
    fraseAbertura,
    transferencias: { perdedores, ganhadores, totalCadeirasMovidas },
    tabela: {
      linhas: linhasTabela,
      fefcStatus: fefc.status || "indisponivel",
      tvStatus: tv.status || "indisponivel",
      fundoStatus: fundo.status || "indisponivel",
      fundoValidado,
      fundoPendente,
      fefcFatia35Moveu,
      valorFundoAnual
    },
    clausula: {
      status: clausula.status || "indisponivel",
      validada: clausulaValidada,
      pendente: ehStatusPendente(clausula.status),
      temMudanca: clausulaValidada && mudancasClausula.length > 0,
      mudancas: mudancasClausula,
      limites: clausula.limites || {},
      anoEleicao: clausula.anoEleicao || null
    },
    somas: { somaFefc, somaTvFracao },
    fundamentoLegal: montarFundamentoLegal(fefcFatia35Moveu),
    avisosVotoEmDobro,
    rodape: "Esta peça é uma simulação técnica independente, de caráter auxiliar. " +
      "Os valores aqui apresentados não constituem a totalização oficial da Justiça Eleitoral " +
      "e não substituem os atos e cálculos oficiais do Tribunal competente."
  };
}

function descreverDecisao(cassacoes) {
  if (!cassacoes || cassacoes.length === 0) {
    return "Retotalização da decisão carregada.";
  }
  const partes = cassacoes.map((c) => {
    const cand = c.candidato ? String(c.candidato) : "candidato não identificado";
    const part = c.partido ? String(c.partido) : "";
    const votos = typeof c.votosAnular === "number" ? inteiro(c.votosAnular) + " votos" : "votos";
    const modal = MODALIDADE_LEGIVEL[c.modalidade] || (c.modalidade ? String(c.modalidade) : "modalidade não informada");
    return "anulação de " + votos + " de " + cand + (part ? " (" + part + ")" : "") + ", na modalidade de " + modal;
  });
  return partes.join("; ") + ".";
}

function narrarFatoConsumado({ cassacoes, perdedores, ganhadores, totalCadeirasMovidas, somaFefc, somaTvFracao, mudancasClausula, uf }) {
  const ufTexto = uf ? ", na circunscrição eleitoral de " + nomeUf(uf) : "";

  // Abertura: a decisao em si.
  let abertura;
  if (cassacoes && cassacoes.length > 0) {
    const c = cassacoes[0];
    const cand = c.candidato ? String(c.candidato) : "candidato cassado";
    const part = c.partido ? " (" + c.partido + ")" : "";
    const votos = typeof c.votosAnular === "number" ? inteiro(c.votosAnular) + " votos nominais" : "votos nominais";
    abertura = "A decisão analisada anulou " + votos + " de " + cand + part;
  } else {
    abertura = "A retotalização analisada";
  }

  // Transferencia de cadeira.
  let transferencia;
  if (totalCadeirasMovidas > 0) {
    const nCad = totalCadeirasMovidas === 1 ? "uma cadeira" : inteiro(totalCadeirasMovidas) + " cadeiras";
    const de = listaPartidos(perdedores.map((p) => p.sigla), "do", "dos");
    const para = ganhadores.length
      ? (ganhadores.length === 1 ? " para o partido " + ganhadores[0].sigla : " para os partidos " + unirNomes(ganhadores.map((g) => g.sigla)))
      : "";
    transferencia = " e resultou na transferência de " + nCad + de + para + ufTexto + ".";
  } else {
    transferencia = " e não resultou em transferência de cadeira" + ufTexto + ".";
  }

  // Consequencia financeira e de propaganda.
  let consequencia = "";
  if (somaFefc > 0 || somaTvFracao > 0) {
    const partes = [];
    if (somaFefc > 0) partes.push("deslocam-se " + reais(somaFefc) + " do Fundo Especial de Financiamento de Campanha");
    if (somaTvFracao > 0) partes.push("altera-se " + percentualProsa(somaTvFracao) + " do tempo de propaganda eleitoral gratuita");
    consequencia = " Em consequência, " + unirNomes(partes) + ".";
  }

  // Efeito dominó da cláusula, quando houver.
  let clausulaTexto = "";
  const perdas = (mudancasClausula || []).filter((m) => m.para === "nao_cumpre");
  if (perdas.length > 0) {
    const nomes = unirNomes(perdas.map((m) => m.entidade));
    clausulaTexto = " Além disso, a decisão retira a cláusula de desempenho de " + nomes +
      ", com a consequente perda de acesso ao fundo partidário e ao tempo de propaganda.";
  }

  return abertura + transferencia + consequencia + clausulaTexto;
}

function montarFundamentoLegal(fefcFatia35Moveu) {
  // O inciso III trata da fatia por cadeiras (48%), sempre apurada. O inciso II
  // trata da fatia por votos (35%): so e citado quando essa fatia de fato se moveu,
  // para a citacao nunca aparecer sem o numero correspondente.
  const dispositivoFefc = fefcFatia35Moveu
    ? "Art. 16-D, incisos II e III, da Lei nº 9.504/1997"
    : "Art. 16-D, inciso III, da Lei nº 9.504/1997";
  return [
    { tema: "Fundo Especial de Financiamento de Campanha (FEFC)", dispositivo: dispositivoFefc },
    { tema: "Tempo de propaganda eleitoral gratuita", dispositivo: "Art. 47, § 1º, inciso II, da Lei nº 9.504/1997" },
    { tema: "Fundo Partidário", dispositivo: "Art. 41-A da Lei nº 9.096/1995" },
    { tema: "Cláusula de desempenho", dispositivo: "Art. 17, § 3º, da Constituição Federal, com a redação da Emenda Constitucional nº 97/2017" },
    { tema: "Contagem em dobro de votos de mulheres e de pessoas negras", dispositivo: "Emenda Constitucional nº 111/2021" }
  ];
}

// ─── 2. Renderizacao em HTML ──────────────────────────────────────────────────

function rotuloStatus(status) {
  if (ehStatusValidado(status)) return "Calculado";
  if (ehStatusPendente(status)) return "Pendente";
  return "Indisponível";
}

export function renderizarPecaHTML(dados) {
  const d = dados || {};
  const cab = d.cabecalho || {};
  const data = cab.dataGeracao instanceof Date ? cab.dataGeracao : new Date();
  const dataFormatada = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const linhaEleicao = [
    cab.cargo,
    cab.ufNome || cab.uf,
    cab.ano ? "Eleições " + cab.ano : null,
    typeof cab.vagas === "number" ? cab.vagas + " vagas" : null
  ].filter(Boolean).map(escaparHtml).join(" &middot; ");

  // Cabeçalho e frase de abertura
  let corpo = "";
  corpo += '<header class="cabecalho">';
  corpo += '<h1>Demonstrativo de Impacto da Retotalização Eleitoral</h1>';
  corpo += '<p class="identificacao">' + linhaEleicao + '</p>';
  corpo += '<p class="decisao"><strong>Decisão analisada:</strong> ' + escaparHtml(cab.decisaoDescricao || "") + '</p>';
  corpo += '<p class="data">Documento gerado em ' + escaparHtml(dataFormatada) + '.</p>';
  corpo += '</header>';

  corpo += '<section class="sintese"><p>' + escaparHtml(d.fraseAbertura || "") + '</p></section>';

  // Tabela por partido
  const tab = d.tabela || {};
  corpo += '<section class="bloco">';
  corpo += '<h2>1. Impacto por partido</h2>';
  // Quando o FEFC esta calculado mas a fatia de 35% (por votos) nao se moveu,
  // o rotulo deixa claro que so a fatia de cadeira foi computada, no mesmo espirito
  // de transparencia do "Pendente" usado em clausula e fundo.
  const rotuloFefc = (ehStatusValidado(tab.fefcStatus) && !tab.fefcFatia35Moveu)
    ? "Calculado (apenas fatia de cadeira, 48%)"
    : rotuloStatus(tab.fefcStatus);
  corpo += '<p class="nota-status">' +
    'FEFC: ' + escaparHtml(rotuloFefc) + '. ' +
    'Tempo de TV: ' + escaparHtml(rotuloStatus(tab.tvStatus)) + '. ' +
    'Fundo Partidário: ' + escaparHtml(rotuloStatus(tab.fundoStatus)) + '.' +
    '</p>';

  if (tab.linhas && tab.linhas.length > 0) {
    corpo += '<table>';
    corpo += '<thead><tr>' +
      '<th>Partido</th>' +
      '<th>Cadeiras</th>' +
      '<th>' + escaparHtml(tab.fefcFatia35Moveu ? "FEFC (48% cadeiras + 35% votos)" : "FEFC (48% das cadeiras)") + '</th>' +
      '<th>Tempo de TV</th>' +
      '<th>Fundo Partidário (variação anual estimada)</th>' +
      '</tr></thead><tbody>';
    for (const l of tab.linhas) {
      const cadTxt = l.deltaCadeira ? (sinal(l.deltaCadeira) + inteiro(l.deltaCadeira)) : "0";
      const cadCls = l.deltaCadeira > 0 ? "positivo" : (l.deltaCadeira < 0 ? "negativo" : "");
      const fefcTxt = l.fefcDelta != null ? (sinal(l.fefcDelta) + reais(l.fefcDelta)) : "-";
      const fefcCls = (l.fefcDelta || 0) > 0 ? "positivo" : ((l.fefcDelta || 0) < 0 ? "negativo" : "");
      let fefcDetalhe = "";
      if (typeof l.fefcDelta35 === "number" && l.fefcDelta35 !== 0) {
        fefcDetalhe = '<br><span class="detalhe">cadeiras (48%): ' + sinal(l.fefcDelta48 || 0) + reais(l.fefcDelta48 || 0) +
          '; votos (35%): ' + sinal(l.fefcDelta35) + reais(l.fefcDelta35) + '</span>';
      }
      let tvTxt = "-";
      if (l.tvDeltaFracao != null) {
        tvTxt = sinal(l.tvDeltaFracao) + percentualPreciso(l.tvDeltaFracao);
        if (l.tvDeltaSegundos != null) {
          tvTxt += " (" + sinal(l.tvDeltaSegundos) + segundos(l.tvDeltaSegundos) + ")";
        }
      }
      const tvCls = (l.tvDeltaFracao || 0) > 0 ? "positivo" : ((l.tvDeltaFracao || 0) < 0 ? "negativo" : "");
      let fundoTxt = "-";
      let fundoCls = "";
      if (tab.fundoPendente) {
        if (l.fundoDeltaReais != null) {
          fundoTxt = sinal(l.fundoDeltaReais) + reais(l.fundoDeltaReais) + " (estimativa pendente)";
          fundoCls = l.fundoDeltaReais > 0 ? "positivo" : (l.fundoDeltaReais < 0 ? "negativo" : "");
        } else {
          fundoTxt = "Pendente";
        }
      } else if (l.fundoDeltaReais != null) {
        fundoTxt = sinal(l.fundoDeltaReais) + reais(l.fundoDeltaReais);
        fundoCls = l.fundoDeltaReais > 0 ? "positivo" : (l.fundoDeltaReais < 0 ? "negativo" : "");
      }
      corpo += '<tr>' +
        '<td class="partido">' + escaparHtml(l.sigla) + '</td>' +
        '<td class="' + cadCls + '">' + cadTxt + '</td>' +
        '<td class="' + fefcCls + '">' + fefcTxt + fefcDetalhe + '</td>' +
        '<td class="' + tvCls + '">' + tvTxt + '</td>' +
        '<td class="' + fundoCls + '">' + fundoTxt + '</td>' +
        '</tr>';
    }
    corpo += '</tbody></table>';
  } else {
    corpo += '<p class="vazio">Nenhum partido sofreu impacto identificável nesta retotalização.</p>';
  }

  if (tab.fundoPendente) {
    corpo += '<p class="rodape-bloco">O impacto sobre a faixa de 95% do Fundo Partidário depende da ' +
      'redistribuição de votos por unidade da federação, ainda não calculada nesta decisão com perda de votos. ' +
      'Os valores da coluna de fundo são estimativas parciais, sujeitas a revisão.</p>';
  }
  corpo += '</section>';

  // Bloco de cláusula
  const cl = d.clausula || {};
  corpo += '<section class="bloco">';
  corpo += '<h2>2. Cláusula de desempenho</h2>';
  if (cl.anoEleicao || (cl.limites && cl.limites.deputadosMinimos)) {
    corpo += '<p class="nota-status">Patamar aplicado: Eleições ' + escaparHtml(cl.anoEleicao || "") +
      ', mínimo de ' + escaparHtml(cl.limites.deputadosMinimos || "?") + ' cadeiras em ' +
      escaparHtml(cl.limites.ufsMinimas || "?") + ' unidades da federação.</p>';
  }
  if (cl.temMudanca && cl.mudancas.length > 0) {
    corpo += '<table><thead><tr><th>Partido ou federação</th><th>Situação</th><th>Efeito dominó</th></tr></thead><tbody>';
    for (const m of cl.mudancas) {
      const cumpre = m.para === "CUMPRE";
      const sit = cumpre ? "Passou a cumprir a cláusula" : "Deixou de cumprir a cláusula";
      const cls = cumpre ? "positivo" : "negativo";
      let domino = "-";
      if (!cumpre && m.domino) {
        const partes = [];
        const fp = m.domino.fundoPartidario;
        if (fp && fp.status === "calculado") {
          partes.push("perda de acesso ao fundo partidário" +
            (typeof fp.valorAtual === "number" ? " (cerca de " + reais(fp.valorAtual) + " ao ano)" : ""));
        }
        const tvd = m.domino.tempoTV;
        if (tvd && tvd.status === "calculado") {
          partes.push("perda de tempo de propaganda" +
            (typeof tvd.segundosAtual === "number" ? " (cerca de " + segundos(tvd.segundosAtual) + " por bloco)" : ""));
        }
        domino = partes.length ? partes.join("; ") + "." : "Efeitos a verificar.";
      }
      const det = m.detalheCadeiras;
      let detTxt = "";
      if (det && det.antes && det.depois) {
        detTxt = '<br><span class="detalhe">cadeiras: ' + escaparHtml(det.antes.cadeiras) + ' para ' +
          escaparHtml(det.depois.cadeiras) + '; UFs: ' + escaparHtml(det.antes.ufsComCadeira) + ' para ' +
          escaparHtml(det.depois.ufsComCadeira) + '</span>';
      }
      corpo += '<tr>' +
        '<td class="partido">' + escaparHtml(m.entidade) + '</td>' +
        '<td class="' + cls + '">' + sit + detTxt + '</td>' +
        '<td>' + domino + '</td>' +
        '</tr>';
    }
    corpo += '</tbody></table>';
  } else if (cl.pendente) {
    corpo += '<p class="vazio">A apuração da cláusula de desempenho depende da redistribuição de votos por ' +
      'unidade da federação, ainda não calculada nesta decisão com perda de votos. Não há alteração de cláusula apurada.</p>';
  } else {
    corpo += '<p class="vazio">Nenhuma alteração na situação da cláusula de desempenho dos partidos nesta retotalização.</p>';
  }
  corpo += '</section>';

  // Ressalvas quanto ao voto em dobro (EC 111/2021), quando o adaptador nao
  // confirmou o multiplicador para algum candidato da decisao carregada.
  const avisos = Array.isArray(d.avisosVotoEmDobro) ? d.avisosVotoEmDobro : [];
  if (avisos.length > 0) {
    corpo += '<section class="bloco">';
    corpo += '<h2>3. Ressalvas quanto à contagem em dobro de votos</h2>';
    corpo += '<p class="nota-status">Em relação aos candidatos a seguir, não foi possível confirmar a contagem ' +
      'em dobro de votos prevista na Emenda Constitucional nº 111/2021. Para esses casos, o cálculo desta peça ' +
      'adotou a contagem simples (sem duplicação), até que a confirmação seja obtida.</p>';
    corpo += '<table><thead><tr><th>Candidato</th><th>Partido</th><th>Motivo</th></tr></thead><tbody>';
    for (const av of avisos) {
      corpo += '<tr>' +
        '<td>' + escaparHtml(av.candidato || "candidato não identificado") + '</td>' +
        '<td class="partido">' + escaparHtml(av.partido || "") + '</td>' +
        '<td>' + escaparHtml(motivoVotoDobroLegivel(av.motivo)) + '</td>' +
        '</tr>';
    }
    corpo += '</tbody></table>';
    corpo += '</section>';
  }

  // Fundamento legal
  corpo += '<section class="bloco">';
  corpo += '<h2>' + (avisos.length > 0 ? "4" : "3") + '. Fundamento legal</h2>';
  corpo += '<table class="legal"><tbody>';
  for (const f of (d.fundamentoLegal || [])) {
    corpo += '<tr><td class="tema">' + escaparHtml(f.tema) + '</td><td>' + escaparHtml(f.dispositivo) + '</td></tr>';
  }
  corpo += '</tbody></table>';
  corpo += '</section>';

  // Rodapé
  corpo += '<footer class="rodape"><p>' + escaparHtml(d.rodape || "") + '</p></footer>';

  return '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n' +
    '<title>Demonstrativo de Impacto da Retotalização Eleitoral</title>\n' +
    '<style>' + estiloPeca() + '</style>\n</head>\n<body>\n' + corpo + '\n</body>\n</html>';
}

function estiloPeca() {
  return [
    "body{font-family:'Times New Roman',Georgia,serif;font-size:12pt;color:#111;margin:2.5cm;line-height:1.5;}",
    "h1{font-size:15pt;text-align:center;text-transform:uppercase;margin:0 0 6px;}",
    "h2{font-size:13pt;margin:22px 0 8px;border-bottom:1px solid #999;padding-bottom:4px;}",
    ".cabecalho{text-align:center;margin-bottom:18px;}",
    ".identificacao{font-size:11pt;color:#333;margin:2px 0;}",
    ".cabecalho .decisao,.cabecalho .data{text-align:left;font-size:11pt;margin:8px 0 0;}",
    ".sintese{background:#f4f4f4;border-left:4px solid #444;padding:12px 16px;margin:16px 0;font-size:12pt;text-align:justify;}",
    ".nota-status{font-size:10pt;color:#555;font-style:italic;margin:4px 0 10px;}",
    "table{width:100%;border-collapse:collapse;margin:10px 0 6px;}",
    "th{background:#eee;border:1px solid #999;padding:7px;text-align:left;font-size:10.5pt;}",
    "td{border:1px solid #bbb;padding:7px;font-size:10.5pt;vertical-align:top;}",
    "td.partido,td.tema{font-weight:bold;}",
    "td.positivo{color:#14532d;font-weight:bold;}",
    "td.negativo{color:#7f1d1d;font-weight:bold;}",
    ".detalhe{font-size:9pt;color:#555;}",
    ".vazio{font-style:italic;color:#555;}",
    ".rodape-bloco{font-size:9.5pt;color:#555;margin-top:4px;text-align:justify;}",
    "table.legal td.tema{width:55%;}",
    ".rodape{margin-top:28px;border-top:1px solid #999;padding-top:10px;font-size:9.5pt;color:#444;text-align:justify;}",
    "@media print{body{margin:2cm;}}"
  ].join("");
}

// ─── 3. Abertura da janela de impressao (unico ponto com DOM) ─────────────────

export function abrirPecaParaImpressao(dados) {
  const html = renderizarPecaHTML(dados);
  const janela = window.open("", "_blank");
  if (!janela) {
    alert("O navegador bloqueou a abertura da janela. Permita pop-ups para este site e tente novamente.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
}
