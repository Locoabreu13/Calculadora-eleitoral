import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { gerarCenarioCascata } from "./js/cascata-adaptador.js";
import { calcularCascata } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// 1. Base oficial completa do Ceara 2022 (28 partidos, 350 candidatos)
const _bruto = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^﻿/, "");
const oficial = JSON.parse(_bruto);
const partidosOficiais = oficial.partidos;
const VAGAS = 22;
const NOME_HEITOR = "HEITOR RODRIGO PEREIRA FREIRE";

// 2. Tabela de genero/raca (Etapa 1), para o voto em dobro da EC 111/2021
const tabelaGeneroRaca = JSON.parse(
  fs.readFileSync("./data/tse/2022_CE_genero-raca.json", "utf8").replace(/^﻿/, "")
);

// 3. Cassacao real validada: Heitor Freire, UNIAO, 48.888 votos nominais
const cassacao = { partido: "UNIÃO", candidato: NOME_HEITOR, votosAnular: 48888, modalidade: "nominal" };

// 4. Dois cenarios sobre a MESMA base oficial
const cenarioAntes = { rotulo: "CE 2022 antes (oficial)", vagas: VAGAS, partidos: partidosOficiais };
const cenarioDepois = {
  rotulo: "CE 2022 depois (oficial)",
  vagas: VAGAS,
  partidos: partidosOficiais,
  cassacoes: [cassacao]
};

const saidaAntes = calcular(cenarioAntes);
const saidaDepois = calcular(cenarioDepois);

const cad = (saida, sigla) => { const p = saida.partidos.find(x => x.sigla === sigla); return p ? p.total : 0; };
console.log("== Cadeiras pelo engine (base oficial) ==");
for (const s of ["UNIÃO", "PL"]) {
  console.log(s.padEnd(6), "antes:", cad(saidaAntes, s), "depois:", cad(saidaDepois, s));
}

// 5. Adaptador com os tres nodes destravados (Etapa 2/3): cassacoes, tabela de
// genero/raca e dados de referencia, todos via opts
const cenarioCascata = gerarCenarioCascata(saidaAntes, saidaDepois, "cassacao_com_perda_votos", "CE", {
  cassacoes: [cassacao],
  tabelaGeneroRaca,
  dadosReferencia
});

console.log("\n== Deltas entregues a cascata (Fase 5) ==");
console.log("deltaCadeirasPorPartido:", JSON.stringify(cenarioCascata.deltaCadeirasPorPartido));
console.log("deltaVotosFEFCPorPartido:", JSON.stringify(cenarioCascata.deltaVotosFEFCPorPartido));
console.log("deltaVotosClausulaPorPartido:", JSON.stringify(cenarioCascata.deltaVotosClausulaPorPartido));
console.log("avisos de voto em dobro:", JSON.stringify(cenarioCascata._avisosVotoEmDobro));

// 6. Cascata completa: FEFC 35%, Fundo Partidario 95%, Clausula
const resultado = calcularCascata(saidaAntes, saidaDepois, dadosReferencia, cenarioCascata);
const brl = n => (typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(n));

const fefcUniao = resultado.nos.fefc && resultado.nos.fefc.porPartido && resultado.nos.fefc.porPartido["UNIÃO"];
console.log("\n== Efeito no FEFC (35% por votos ponderados) ==");
console.log("status FEFC:", resultado.nos.fefc ? resultado.nos.fefc.status : "(sem no)");
if (fefcUniao) {
  console.log("UNIÃO delta35:", brl(fefcUniao.delta35));
  console.log("UNIÃO deltaTotal:", brl(fefcUniao.deltaTotal));
}

const fpUniao = resultado.nos.fundoPartidario && resultado.nos.fundoPartidario.deltas && resultado.nos.fundoPartidario.deltas["UNIÃO"];
console.log("\n== Efeito no Fundo Partidario (quota de 95%) ==");
console.log("status Fundo Partidario:", resultado.nos.fundoPartidario ? resultado.nos.fundoPartidario.status : "(sem no)");
if (fpUniao) {
  console.log("UNIÃO deltaFatia95:", fpUniao.deltaFatia95);
}

const clausulaUniao = resultado.nos.clausula && resultado.nos.clausula.porEntidade && resultado.nos.clausula.porEntidade["UNIÃO"];
console.log("\n== Situacao da Clausula de Desempenho (UNIÃO) ==");
console.log("status Clausula:", resultado.nos.clausula ? resultado.nos.clausula.status : "(sem no)");
if (clausulaUniao) {
  console.log("cumpriuAntes:", clausulaUniao.cumpriuAntes, "| cumpriuDepois:", clausulaUniao.cumpriuDepois, "| mudou:", clausulaUniao.mudou);
}
console.log("mudancas na clausula:", JSON.stringify((resultado.nos.clausula && resultado.nos.clausula.mudancas) || []));

// 7. Verificacoes do caso Heitor Freire (CE 2022), Fase 5 ponta a ponta
function checa(n, ok) { console.log((ok ? "OK  " : "FALHOU  ") + n); return ok; }
let tudo = true;
tudo &= checa("cadeiras UNIAO 4 para 3 (controle, ja validado)", cad(saidaAntes, "UNIÃO") === 4 && cad(saidaDepois, "UNIÃO") === 3);
tudo &= checa("cadeiras PL 5 para 6 (controle, ja validado)", cad(saidaAntes, "PL") === 5 && cad(saidaDepois, "PL") === 6);
tudo &= checa("delta FEFC ponderado UNIAO = -97776 (48888 x 2, voto em dobro)", cenarioCascata.deltaVotosFEFCPorPartido["UNIÃO"] === -97776);
tudo &= checa("delta clausula simples UNIAO = -48888 (sem dobro)", cenarioCascata.deltaVotosClausulaPorPartido["UNIÃO"] === -48888);
tudo &= checa("sem avisos de voto em dobro pendente", (cenarioCascata._avisosVotoEmDobro || []).length === 0);
tudo &= checa("FEFC validado e delta35 da UNIAO negativo", resultado.nos.fefc.status === "validado" && fefcUniao && fefcUniao.delta35 < 0);
tudo &= checa("Fundo Partidario validado (delta de votos aplicado)", resultado.nos.fundoPartidario.status === "validado");
tudo &= checa("Fundo Partidario: deltaFatia95 da UNIAO negativo", fpUniao && fpUniao.deltaFatia95 < 0);
tudo &= checa("Clausula: UNIAO continua cumprindo (resolvido por cadeiras, 57 acima do piso)", !!clausulaUniao && clausulaUniao.cumpriuDepois === true);
tudo &= checa("Clausula: UNIAO nao consta em mudancas", !(resultado.nos.clausula.mudancas || []).some(m => m.entidade === "UNIÃO"));

console.log("\nRESULTADO Fase 5 (FEFC + Fundo Partidario + Clausula, caso Heitor Freire):", tudo ? "APROVADO" : "REPROVADO");
