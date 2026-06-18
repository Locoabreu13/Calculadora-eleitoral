// Este teste prova a MECANICA de ponta a ponta: engine -> adaptador -> cascata -> no de tempo de TV.
// O caso Heitor Freire e uma retotalizacao do Ceara, e o tempo de TV de deputado e estadual,
// nao nacional. Portanto, a fracao abaixo nao e afirmacao juridica de que a cassacao mudou
// o tempo nacional; e apenas a prova de que a tubulacao esta conectada corretamente.

import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { montarCenarioCascata } from "./js/cascata-adaptador.js";
import { calcularCascata } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// 1. Base oficial completa do Ceara 2022 (28 partidos, 350 candidatos)
const _bruto = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^\uFEFF/, "");
const oficial = JSON.parse(_bruto);
const partidosOficiais = oficial.partidos;
const VAGAS = 22;
const NOME_HEITOR = "HEITOR RODRIGO PEREIRA FREIRE";

// 2. Dois cenarios sobre a MESMA base oficial
const cenarioAntes = { rotulo: "CE 2022 antes (oficial)", vagas: VAGAS, partidos: partidosOficiais };
const cenarioDepois = {
  rotulo: "CE 2022 depois (oficial)",
  vagas: VAGAS,
  partidos: partidosOficiais,
  cassacoes: [{ partido: "UNIÃO", candidato: NOME_HEITOR, votosAnular: 48888, modalidade: "nominal" }]
};

const saidaAntes = calcular(cenarioAntes);
const saidaDepois = calcular(cenarioDepois);

// 3. Adaptador: monta o cenario da cascata sem delta manual.
const cenarioCascata = montarCenarioCascata(saidaAntes, saidaDepois, dadosReferencia, {
  tipo: "cassacao_sem_perda_votos",
  perdaDeVotos: false,
  circunscricao: "CE"
});

// 4. Cascata completa e no de tempo de TV.
const resultado = calcularCascata(saidaAntes, saidaDepois, dadosReferencia, cenarioCascata);
const tv = resultado.nos.tempoTV;

const pct = n => (n * 100).toFixed(4) + "%";
const fmt = n => Number(n).toFixed(12);

function imprimirPartido(sigla) {
  const p = tv.porPartido && tv.porPartido[sigla];
  if (!p) {
    console.log(sigla + ": nao encontrado");
    return null;
  }

  console.log(sigla + ":");
  console.log("  fracaoAntes :", fmt(p.fracaoAntes), "(" + pct(p.fracaoAntes) + ")");
  console.log("  fracaoDepois:", fmt(p.fracaoDepois), "(" + pct(p.fracaoDepois) + ")");
  console.log("  deltaFracao :", fmt(p.deltaFracao), "(" + pct(p.deltaFracao) + ")");
  return p;
}

console.log("== Tempo TV: ponta a ponta ==");
console.log("delta do adaptador:", JSON.stringify(cenarioCascata.deltaCadeirasPorPartido));
console.log("siglas nao mapeadas no adaptador:", JSON.stringify(cenarioCascata._siglasNaoMapeadas || []));
console.log("status TV:", tv.status);
console.log("base TV:", tv.base);

console.log("\n== Partidos afetados ==");
const uniao = imprimirPartido("UNIÃO");
const pl = imprimirPartido("PL");

const entradas = Object.entries(tv.porPartido || {});
const somaDelta = entradas.reduce((s, [, p]) => s + p.deltaFracao, 0);
const naoMapeadasTV = tv._siglasNaoMapeadas || [];
const statusValidado = tv.status === "validado";
const sinaisCorretos = !!(uniao && pl && uniao.deltaFracao < 0 && pl.deltaFracao > 0);
const somaZero = Math.abs(somaDelta) < 1e-9;
const semNaoMapeadas = naoMapeadasTV.length === 0;
const simetria = !!(uniao && pl && Math.abs(Math.abs(pl.deltaFracao) - Math.abs(uniao.deltaFracao)) < 1e-12);

console.log("\n== Balanca ==");
console.log("soma de todos os deltaFracao:", somaDelta);
console.log("soma geral proxima de zero:", somaZero);
console.log("tv._siglasNaoMapeadas:", JSON.stringify(naoMapeadasTV));
console.log("simetria |PL| == |UNIAO|:", simetria);

const pontaAPontaOk =
  statusValidado &&
  sinaisCorretos &&
  somaZero &&
  semNaoMapeadas &&
  simetria;

console.log("\n== Veredito ==");
console.log("status validado:", statusValidado);
console.log("UNIAO negativo e PL positivo:", sinaisCorretos);
console.log("soma geral proxima de zero:", somaZero);
console.log("sem siglas nao mapeadas no no TV:", semNaoMapeadas);
console.log("deltaFracao PL e UNIAO simetricos:", simetria);
console.log("TEMPO TV PONTA A PONTA:", pontaAPontaOk ? "sim" : "nao");
