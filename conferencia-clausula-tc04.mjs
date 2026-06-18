// conferencia-clausula-tc04.mjs
import fs from "fs";
import { calcular } from "./js/engine.js";
import { calcularClausula } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";
import { montarCenarioCascata } from "./js/cascata-adaptador.js";

const VAGAS_CE = 22;
const NOME_HEITOR = "HEITOR RODRIGO PEREIRA FREIRE";
const bruto = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^\uFEFF/, "");
const oficial = JSON.parse(bruto);
const saidaAntes = calcular({ rotulo: "CE 2022 antes", vagas: VAGAS_CE, partidos: oficial.partidos });
const saidaDepois = calcular({ rotulo: "CE 2022 depois", vagas: VAGAS_CE, partidos: oficial.partidos,
  cassacoes: [{ partido: "UNI\u00c3O", candidato: NOME_HEITOR, votosAnular: 48888, modalidade: "nominal" }] });
const cenarioCascata = montarCenarioCascata(saidaAntes, saidaDepois, dadosReferencia,
  { tipo: "cassacao_sem_perda_votos", perdaDeVotos: false, circunscricao: "CE" });
const r04a = calcularClausula(null, null, dadosReferencia, cenarioCascata, "cassacao_sem_perda_votos");
console.log("=== TC-04a: Heitor Freire (CE 2022) ===");
console.log("Status              :", r04a.status);
console.log("UF                  :", r04a.uf);
console.log("Patamar             :", r04a.patamarAplicado);
console.log("Tem mudanca         :", r04a.temMudancaNaClausula);
console.log("Mudancas            :", JSON.stringify(r04a.mudancas));
const ru = r04a.porEntidade && r04a.porEntidade["UNI\u00c3O"];
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
console.log(ok04a ? "\nRESULTADO TC-04a: APROVADO" : "\nRESULTADO TC-04a: FALHOU");

console.log("\n=== TC-04b: Cenario sintetico de limiar ===");
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
console.log("Mudancas            :", JSON.stringify(r04b.mudancas));
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
}
chk2("PARTIDO_Y em siglasNaoMapeadas",
  Array.isArray(r04b._siglasNaoMapeadas) && r04b._siglasNaoMapeadas.includes("PARTIDO_Y"));
console.log(ok04b ? "\nRESULTADO TC-04b: APROVADO" : "\nRESULTADO TC-04b: FALHOU");
console.log("\n=== RESULTADO FINAL TC-04 ===");
console.log((ok04a && ok04b) ? "APROVADO" : "FALHOU - verificar acima");
