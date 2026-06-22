// conferencia-clausula-tc04.mjs
import fs from "fs";
import { calcular } from "./js/engine.js";
import { calcularClausula } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";
import { gerarCenarioCascata } from "./js/cascata-adaptador.js";

// ---------------------------------------------------------------------------
// TC-04a: Heitor Freire (CE 2022) — sem mudanca de clausula
// Valida que o domino nao aparece quando nao ha mudanca.
// ---------------------------------------------------------------------------
const VAGAS_CE = 22;
const NOME_HEITOR = "HEITOR RODRIGO PEREIRA FREIRE";
const bruto = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^﻿/, "");
const oficial = JSON.parse(bruto);
const saidaAntes = calcular({ rotulo: "CE 2022 antes", vagas: VAGAS_CE, partidos: oficial.partidos });
const saidaDepois = calcular({ rotulo: "CE 2022 depois", vagas: VAGAS_CE, partidos: oficial.partidos,
  cassacoes: [{ partido: "UNIÃO", candidato: NOME_HEITOR, votosAnular: 48888, modalidade: "nominal" }] });

// gerarCenarioCascata: (saidaEngineBase, saidaEngineCenario, categoria, uf)
const cenarioCascata = gerarCenarioCascata(saidaAntes, saidaDepois, "cassacao_sem_perda_votos", "CE");
const r04a = calcularClausula(null, null, dadosReferencia, cenarioCascata, "cassacao_sem_perda_votos");

console.log("=== TC-04a: Heitor Freire (CE 2022) ===");
console.log("Status              :", r04a.status);
console.log("UF                  :", r04a.uf);
console.log("Patamar             :", r04a.patamarAplicado);
console.log("Tem mudanca         :", r04a.temMudancaNaClausula);
console.log("Mudancas            :", JSON.stringify(r04a.mudancas));
const ru = r04a.porEntidade && r04a.porEntidade["UNIÃO"];
const rpl = r04a.porEntidade && r04a.porEntidade["PL"];
if (ru) console.log("UNIAO: cad", ru.criteriosCadeiras.antes.cadeiras, "->", ru.criteriosCadeiras.depois.cadeiras,
  "| UFs", ru.criteriosCadeiras.antes.ufsComCadeira, "->", ru.criteriosCadeiras.depois.ufsComCadeira,
  "| cumpriuAntes", ru.cumpriuAntes, "| cumpriuDepois", ru.cumpriuDepois, "| mudou", ru.mudou);
if (rpl) console.log("PL   : cad", rpl.criteriosCadeiras.antes.cadeiras, "->", rpl.criteriosCadeiras.depois.cadeiras,
  "| UFs", rpl.criteriosCadeiras.antes.ufsComCadeira, "->", rpl.criteriosCadeiras.depois.ufsComCadeira,
  "| cumpriuAntes", rpl.cumpriuAntes, "| cumpriuDepois", rpl.cumpriuDepois, "| mudou", rpl.mudou);

let ok04a = true;
const chk = (label, cond) => { if (!cond) { console.log("FALHA:", label); ok04a = false; } };
chk("status = validado", r04a.status === "validado");
chk("temMudancaNaClausula = false", r04a.temMudancaNaClausula === false);
chk("mudancas vazio", r04a.mudancas.length === 0);
chk("UNIAO presente", !!ru);
if (ru) {
  chk("UNIAO cumpriuAntes = true", ru.cumpriuAntes === true);
  chk("UNIAO cumpriuDepois = true", ru.cumpriuDepois === true);
  chk("UNIAO mudou = false", ru.mudou === false);
  chk("UNIAO cadeiras depois = antes - 1", ru.criteriosCadeiras.depois.cadeiras === ru.criteriosCadeiras.antes.cadeiras - 1);
}
chk("PL presente", !!rpl);
if (rpl) {
  chk("PL cumpriuAntes = true", rpl.cumpriuAntes === true);
  chk("PL cumpriuDepois = true", rpl.cumpriuDepois === true);
  chk("PL mudou = false", rpl.mudou === false);
  chk("PL cadeiras depois = antes + 1", rpl.criteriosCadeiras.depois.cadeiras === rpl.criteriosCadeiras.antes.cadeiras + 1);
}
// Sem mudanca de clausula: nenhuma entrada em mudancas tem campo domino
chk("sem domino (mudancas vazias, domino nao aplicavel)", r04a.mudancas.every(m => !m.domino));
console.log(ok04a ? "\nRESULTADO TC-04a: APROVADO" : "\nRESULTADO TC-04a: FALHOU");

// ---------------------------------------------------------------------------
// TC-04b: Cenario sintetico de limiar — dados sem referencia de FP/TV
// Valida que o domino retorna status "sem_dados_referencia" quando os dados
// de fundo partidario e tempo de TV nao estao presentes no dadosReferencia.
// ---------------------------------------------------------------------------
console.log("\n=== TC-04b: Cenario sintetico de limiar (dados sem FP/TV) ===");
const drSintetico = {
  clausula: dadosReferencia.clausula,
  clausulaLinhaDeBase2022: {
    anoEleicao: 2022,
    mapeamentoSiglaParaEntidade: {},
    totalVotosPorUF: { AA:1000000, BB:1000000, CC:1000000, DD:1000000, EE:1000000, FF:1000000, GG:1000000, HH:1000000, II:1000000 },
    cadeirasPorEntidadePorUF: { PARTIDO_X: { AA:2, BB:1, CC:1, DD:1, EE:1, FF:1, GG:1, HH:1, II:2 } },
    statusVotosPorEntidade: { PARTIDO_X: { cumpriuPorVotos: false, pctNacional: 0.5, ufsComPctMinimo: 2 } }
  }
};
const cenarioSintetico = { circunscricao: "BB", perdaDeVotos: false,
  deltaCadeirasPorPartido: { PARTIDO_X: -1, PARTIDO_Y: 1 } };
const r04b = calcularClausula(null, null, drSintetico, cenarioSintetico, null);
const rpx = r04b.porEntidade && r04b.porEntidade["PARTIDO_X"];
if (rpx) console.log("PARTIDO_X: cad", rpx.criteriosCadeiras.antes.cadeiras, "->", rpx.criteriosCadeiras.depois.cadeiras,
  "| UFs", rpx.criteriosCadeiras.antes.ufsComCadeira, "->", rpx.criteriosCadeiras.depois.ufsComCadeira,
  "| cumpriuAntes", rpx.cumpriuAntes, "| cumpriuDepois", rpx.cumpriuDepois, "| mudou", rpx.mudou);
console.log("Tem mudanca         :", r04b.temMudancaNaClausula);
if (r04b.mudancas.length > 0) {
  console.log("Mudanca[0].domino   :", JSON.stringify(r04b.mudancas[0].domino));
}
if (r04b._siglasNaoMapeadas) console.log("Nao mapeadas        :", r04b._siglasNaoMapeadas);

let ok04b = true;
const chk2 = (label, cond) => { if (!cond) { console.log("FALHA:", label); ok04b = false; } };
chk2("PARTIDO_X presente", !!rpx);
if (rpx) {
  chk2("cadeiras antes = 11", rpx.criteriosCadeiras.antes.cadeiras === 11);
  chk2("ufsComCadeira antes = 9", rpx.criteriosCadeiras.antes.ufsComCadeira === 9);
  chk2("cumpriuAntes = true", rpx.cumpriuAntes === true);
  chk2("cadeiras depois = 10", rpx.criteriosCadeiras.depois.cadeiras === 10);
  chk2("ufsComCadeira depois = 8", rpx.criteriosCadeiras.depois.ufsComCadeira === 8);
  chk2("cumpriuDepois = false", rpx.cumpriuDepois === false);
  chk2("mudou = true", rpx.mudou === true);
}
chk2("temMudancaNaClausula = true", r04b.temMudancaNaClausula === true);
chk2("exatamente 1 mudanca", r04b.mudancas.length === 1);
if (r04b.mudancas.length === 1) {
  chk2("mudanca de CUMPRIA", r04b.mudancas[0].de === "CUMPRIA");
  chk2("mudanca para nao_cumpre", r04b.mudancas[0].para === "nao_cumpre");
  chk2("mudanca entidade = PARTIDO_X", r04b.mudancas[0].entidade === "PARTIDO_X");
  // Domino: sem dados de referencia de FP/TV, status deve ser sem_dados_referencia em ambos
  const dom = r04b.mudancas[0].domino;
  chk2("domino presente na mudanca", !!dom);
  chk2("domino.fundoPartidario.status = sem_dados_referencia",
    dom && dom.fundoPartidario && dom.fundoPartidario.status === "sem_dados_referencia");
  chk2("domino.tempoTV.status = sem_dados_referencia",
    dom && dom.tempoTV && dom.tempoTV.status === "sem_dados_referencia");
}
chk2("PARTIDO_Y em siglasNaoMapeadas",
  Array.isArray(r04b._siglasNaoMapeadas) && r04b._siglasNaoMapeadas.includes("PARTIDO_Y"));
console.log(ok04b ? "\nRESULTADO TC-04b: APROVADO" : "\nRESULTADO TC-04b: FALHOU");

// ---------------------------------------------------------------------------
// TC-04c: Cenario sintetico com dados reais de FP e TV
// Valida o calculo numerico do domino: PP perde a clausula numa configuracao
// sintetica, usando dados reais de referencia para FP e TV.
//
// Setup: PP tem exatamente 11 cadeiras em 9 UFs e cumpriuPorVotos: false (passa
// apenas pelo criterio de cadeiras). Perde 1 cadeira em BB -> 10 cadeiras em
// 8 UFs -> falha ambos os criterios -> mudou = true.
//
// Esperado:
//   FP: status calculado, eraElegivel true, quantosGanham 18
//       fracaoAtual ~ 8,03% (5%/19 + 95% * votos_PP/total_votos_elegiveis)
//   TV: status calculado, temRepresentacao true, chaveTV "PP" (38 cadeiras na ref.)
//       fracaoAtual ~ 7,27% (formula 90/10 sobre 507 cadeiras nacionais)
//       segundosAtual ~ 54,54s (fracaoAtual * 750s)
//       quantosGanham 18 (19 partidos com cadeiras na ref. menos PP)
// ---------------------------------------------------------------------------
console.log("\n=== TC-04c: Domino numerico — PP perde clausula (dados reais de FP/TV) ===");

const drC = {
  clausula: dadosReferencia.clausula,
  fundoPartidario: dadosReferencia.fundoPartidario,
  fefc: dadosReferencia.fefc,
  tempoTVCamara2022: dadosReferencia.tempoTVCamara2022,
  federacoesTV2022: dadosReferencia.federacoesTV2022,
  clausulaLinhaDeBase2022: {
    anoEleicao: 2022,
    mapeamentoSiglaParaEntidade: {},
    totalVotosPorUF: { AA:1000000, BB:1000000, CC:1000000, DD:1000000, EE:1000000, FF:1000000, GG:1000000, HH:1000000, II:1000000 },
    cadeirasPorEntidadePorUF: { PP: { AA:2, BB:1, CC:1, DD:1, EE:1, FF:1, GG:1, HH:1, II:2 } },
    statusVotosPorEntidade: { PP: { cumpriuPorVotos: false, pctNacional: 0.5, ufsComPctMinimo: 2 } }
  }
};

const cenarioC = {
  circunscricao: "BB",
  perdaDeVotos: false,
  deltaCadeirasPorPartido: { PP: -1, PARTIDO_Y: 1 }
};

const r04c = calcularClausula(null, null, drC, cenarioC, null);
const rpp = r04c.porEntidade && r04c.porEntidade["PP"];

if (rpp) console.log("PP: cad", rpp.criteriosCadeiras.antes.cadeiras, "->", rpp.criteriosCadeiras.depois.cadeiras,
  "| UFs", rpp.criteriosCadeiras.antes.ufsComCadeira, "->", rpp.criteriosCadeiras.depois.ufsComCadeira,
  "| cumpriuAntes", rpp.cumpriuAntes, "| cumpriuDepois", rpp.cumpriuDepois, "| mudou", rpp.mudou);

if (r04c.mudancas.length > 0) {
  const dom = r04c.mudancas[0].domino;
  if (dom) {
    console.log("Domino FP  :", JSON.stringify(dom.fundoPartidario));
    console.log("Domino TV  :", JSON.stringify({
      status: dom.tempoTV.status,
      temRepresentacao: dom.tempoTV.temRepresentacao,
      chaveTV: dom.tempoTV.chaveTV,
      fracaoAtual: dom.tempoTV.fracaoAtual && dom.tempoTV.fracaoAtual.toFixed(6),
      segundosAtual: dom.tempoTV.segundosAtual && dom.tempoTV.segundosAtual.toFixed(4),
      quantosGanham: dom.tempoTV.quantosGanham
    }));
  }
}

let ok04c = true;
const chk3 = (label, cond) => { if (!cond) { console.log("FALHA:", label); ok04c = false; } };

chk3("PP presente", !!rpp);
if (rpp) {
  chk3("cadeiras antes = 11", rpp.criteriosCadeiras.antes.cadeiras === 11);
  chk3("ufsComCadeira antes = 9", rpp.criteriosCadeiras.antes.ufsComCadeira === 9);
  chk3("cumpriuAntes = true", rpp.cumpriuAntes === true);
  chk3("cadeiras depois = 10", rpp.criteriosCadeiras.depois.cadeiras === 10);
  chk3("ufsComCadeira depois = 8", rpp.criteriosCadeiras.depois.ufsComCadeira === 8);
  chk3("cumpriuDepois = false", rpp.cumpriuDepois === false);
  chk3("mudou = true", rpp.mudou === true);
}

chk3("temMudancaNaClausula = true", r04c.temMudancaNaClausula === true);
chk3("exatamente 1 mudanca", r04c.mudancas.length === 1);

if (r04c.mudancas.length === 1) {
  chk3("mudanca entidade = PP", r04c.mudancas[0].entidade === "PP");
  chk3("mudanca para nao_cumpre", r04c.mudancas[0].para === "nao_cumpre");

  const dom = r04c.mudancas[0].domino;
  chk3("domino presente", !!dom);

  // --- Fundo Partidario ---
  const fp = dom && dom.fundoPartidario;
  chk3("FP status = calculado", fp && fp.status === "calculado");
  chk3("FP eraElegivel = true", fp && fp.eraElegivel === true);
  chk3("FP quantosGanham = 18", fp && fp.quantosGanham === 18);
  chk3("FP valorAtual = null (valorTotalAnual nao preenchido)", fp && fp.valorAtual === null);
  // fracaoAtual esperada: 5%*(1/19) + 95%*(12221833/total_votos_elegiveis) ~ 8,03%
  chk3("FP fracaoAtual entre 0,079 e 0,082",
    fp && typeof fp.fracaoAtual === "number" && fp.fracaoAtual > 0.079 && fp.fracaoAtual < 0.082);

  // --- Tempo de TV ---
  const tv = dom && dom.tempoTV;
  chk3("TV status = calculado", tv && tv.status === "calculado");
  chk3("TV temRepresentacao = true", tv && tv.temRepresentacao === true);
  chk3("TV chaveTV = PP", tv && tv.chaveTV === "PP");
  chk3("TV quantosGanham = 18", tv && tv.quantosGanham === 18);
  // fracaoAtual: 10%/19 + 90%*(38/507) ~ 7,27%
  chk3("TV fracaoAtual entre 0,071 e 0,075",
    tv && typeof tv.fracaoAtual === "number" && tv.fracaoAtual > 0.071 && tv.fracaoAtual < 0.075);
  // segundosAtual: fracaoAtual * 750 ~ 54,54s
  chk3("TV segundosAtual entre 53,0 e 56,0",
    tv && typeof tv.segundosAtual === "number" && tv.segundosAtual > 53.0 && tv.segundosAtual < 56.0);
}
chk3("PP nao em siglasNaoMapeadas",
  !r04c._siglasNaoMapeadas || !r04c._siglasNaoMapeadas.includes("PP"));
chk3("PARTIDO_Y em siglasNaoMapeadas",
  Array.isArray(r04c._siglasNaoMapeadas) && r04c._siglasNaoMapeadas.includes("PARTIDO_Y"));

console.log(ok04c ? "\nRESULTADO TC-04c: APROVADO" : "\nRESULTADO TC-04c: FALHOU");

// ---------------------------------------------------------------------------
// TC-04d: ramo perdaDeVotos === true (Etapa 3b) — os tres desfechos do criterio
// de votos. Cenario sintetico, patamar 2022 (min. 11 cadeiras em 9 UFs),
// cassacao na UF "BB".
//   PARTIDO_A: 11/9 -> 10/8 (falha cadeiras), base votos false  -> cumpriuDepois false
//              (atalho monotonico), mudou true, dispara domino.
//   PARTIDO_B: 11/9 -> 10/8 (falha cadeiras), base votos true   -> cumpriuDepois null
//              (pendente: confirmar exigiria votos absolutos ausentes), sem mudanca/domino.
//   PARTIDO_C: 13/9 -> 12/9 (cumpre cadeiras), base votos true  -> cumpriuDepois true
//              (precedencia de cadeiras), sem mudanca.
// ---------------------------------------------------------------------------
console.log("\n=== TC-04d: ramo perda de votos (Etapa 3b) — tres desfechos do criterio de votos ===");

const drD = {
  clausula: dadosReferencia.clausula,
  clausulaLinhaDeBase2022: {
    anoEleicao: 2022,
    mapeamentoSiglaParaEntidade: {},
    totalVotosPorUF: { AA:1e6, BB:1e6, CC:1e6, DD:1e6, EE:1e6, FF:1e6, GG:1e6, HH:1e6, II:1e6 },
    cadeirasPorEntidadePorUF: {
      PARTIDO_A: { AA:2, BB:1, CC:1, DD:1, EE:1, FF:1, GG:1, HH:1, II:2 }, // 11 cad / 9 UFs
      PARTIDO_B: { AA:2, BB:1, CC:1, DD:1, EE:1, FF:1, GG:1, HH:1, II:2 }, // 11 cad / 9 UFs
      PARTIDO_C: { AA:3, BB:2, CC:2, DD:1, EE:1, FF:1, GG:1, HH:1, II:1 }  // 13 cad / 9 UFs
    },
    statusVotosPorEntidade: {
      PARTIDO_A: { cumpriuPorVotos: false, pctNacional: 0.5, ufsComPctMinimo: 2 },
      PARTIDO_B: { cumpriuPorVotos: true,  pctNacional: 9.0, ufsComPctMinimo: 20 },
      PARTIDO_C: { cumpriuPorVotos: true,  pctNacional: 9.0, ufsComPctMinimo: 20 }
    }
  }
};
const cenarioD = {
  circunscricao: "BB",
  perdaDeVotos: true,
  deltaCadeirasPorPartido:      { PARTIDO_A: -1, PARTIDO_B: -1, PARTIDO_C: -1 },
  deltaVotosClausulaPorPartido: { PARTIDO_A: -50000, PARTIDO_B: -50000, PARTIDO_C: -50000 }
};
const r04d = calcularClausula(null, null, drD, cenarioD, "cassacao_com_perda_votos");
const rA = r04d.porEntidade && r04d.porEntidade["PARTIDO_A"];
const rB = r04d.porEntidade && r04d.porEntidade["PARTIDO_B"];
const rC = r04d.porEntidade && r04d.porEntidade["PARTIDO_C"];

const show = (nome, e) => e && console.log(`${nome}: cad ${e.criteriosCadeiras.antes.cadeiras}->${e.criteriosCadeiras.depois.cadeiras}`,
  `| UFs ${e.criteriosCadeiras.antes.ufsComCadeira}->${e.criteriosCadeiras.depois.ufsComCadeira}`,
  `| cumpriuDepois ${e.cumpriuDepois}`, `| mudou ${e.mudou}`);
show("PARTIDO_A", rA); show("PARTIDO_B", rB); show("PARTIDO_C", rC);
console.log("Status no            :", r04d.status);
console.log("temMudancaNaClausula :", r04d.temMudancaNaClausula, "| mudancas:", JSON.stringify(r04d.mudancas.map(m => m.entidade)));

let ok04d = true;
const chk4 = (label, cond) => { if (!cond) { console.log("FALHA:", label); ok04d = false; } };
// PARTIDO_A: monotonico -> false, com domino
chk4("A presente", !!rA);
if (rA) {
  chk4("A cadeiras 11->10", rA.criteriosCadeiras.antes.cadeiras === 11 && rA.criteriosCadeiras.depois.cadeiras === 10);
  chk4("A cumpriuDepois === false (monotonico)", rA.cumpriuDepois === false);
  chk4("A mudou === true", rA.mudou === true);
}
// PARTIDO_B: pendente -> null, sem mudanca, sem domino
chk4("B presente", !!rB);
if (rB) {
  chk4("B cadeiras 11->10 (falha)", rB.criteriosCadeiras.depois.cadeiras === 10 && rB.criteriosCadeiras.depois.cumpriu === false);
  chk4("B cumpriuDepois === null (pendente)", rB.cumpriuDepois === null);
  chk4("B mudou === false", rB.mudou === false);
  chk4("B criterioVotos.status === parcial_pendente", rB.criterioVotos && rB.criterioVotos.status === "parcial_pendente");
}
// PARTIDO_C: precedencia de cadeiras -> true
chk4("C presente", !!rC);
if (rC) {
  chk4("C cadeiras 13->12 (cumpre)", rC.criteriosCadeiras.depois.cadeiras === 12 && rC.criteriosCadeiras.depois.cumpriu === true);
  chk4("C cumpriuDepois === true (precedencia de cadeiras)", rC.cumpriuDepois === true);
  chk4("C mudou === false", rC.mudou === false);
}
// No: pendente por causa de B; exatamente 1 mudanca (A), com domino
chk4("status no === parcial_votos_pendentes", r04d.status === "parcial_votos_pendentes");
chk4("exatamente 1 mudanca", r04d.mudancas.length === 1);
if (r04d.mudancas.length === 1) {
  chk4("mudanca e PARTIDO_A", r04d.mudancas[0].entidade === "PARTIDO_A");
  chk4("mudanca para nao_cumpre", r04d.mudancas[0].para === "nao_cumpre");
  chk4("A tem domino na mudanca", !!r04d.mudancas[0].domino);
}
// B e C nunca entram em mudancas
chk4("B nao esta em mudancas", !r04d.mudancas.some(m => m.entidade === "PARTIDO_B"));
chk4("C nao esta em mudancas", !r04d.mudancas.some(m => m.entidade === "PARTIDO_C"));
console.log(ok04d ? "\nRESULTADO TC-04d: APROVADO" : "\nRESULTADO TC-04d: FALHOU");

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log("\n=== RESULTADO FINAL TC-04 ===");
console.log((ok04a && ok04b && ok04c && ok04d) ? "APROVADO" : "FALHOU - verificar acima");
