import { calcularTempoTV } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// Delta vindo do caso Heitor Freire (CE 2022), aplicado aqui sobre a foto nacional
// apenas para testar o encaixe da cascata. O numero resultante nao e uma afirmacao
// juridica sobre o impacto real do caso concreto no tempo de TV.
const cenario = {
  deltaCadeirasPorPartido: {
    "UNIÃO": -1,
    "PL": 1
  }
};

const resultado = calcularTempoTV(
  null,
  null,
  dadosReferencia,
  cenario,
  "cassacao_sem_perda_votos"
);

const pct = n => (n * 100).toFixed(4) + "%";
const fmt = n => Number(n).toFixed(12);

function imprimirPartido(sigla) {
  const p = resultado.porPartido && resultado.porPartido[sigla];
  if (!p) {
    console.log(sigla + ": nao encontrado");
    return;
  }

  console.log(sigla + ":");
  console.log("  fracaoAntes :", fmt(p.fracaoAntes), "(" + pct(p.fracaoAntes) + ")");
  console.log("  fracaoDepois:", fmt(p.fracaoDepois), "(" + pct(p.fracaoDepois) + ")");
  console.log("  deltaFracao :", fmt(p.deltaFracao), "(" + pct(p.deltaFracao) + ")");
}

console.log("== Tempo TV: teste de encaixe ==");
console.log("status:", resultado.status);
console.log("base:", resultado.base);

console.log("\n== Partidos afetados ==");
imprimirPartido("UNIÃO");
imprimirPartido("PL");

const entradas = Object.entries(resultado.porPartido || {});
const somaDelta = entradas.reduce((s, [, p]) => s + p.deltaFracao, 0);
const qtdDeltaNaoZero = entradas.filter(([, p]) => p.deltaFracao !== 0).length;

console.log("\n== Balanca ==");
console.log("soma de todos os deltaFracao:", somaDelta);
console.log("soma proxima de zero:", Math.abs(somaDelta) < 1e-9);
console.log("partidos com deltaFracao diferente de zero:", qtdDeltaNaoZero);

const uniao = resultado.porPartido && resultado.porPartido["UNIÃO"];
const pl = resultado.porPartido && resultado.porPartido["PL"];
const sinaisOk = !!(uniao && pl && uniao.deltaFracao < 0 && pl.deltaFracao > 0);
const somaOk = Math.abs(somaDelta) < 1e-9;

console.log("\n== Veredito ==");
console.log("UNIAO negativo e PL positivo:", sinaisOk);
console.log("soma geral proxima de zero:", somaOk);
console.log("ENCAIXE OK:", sinaisOk && somaOk ? "sim" : "nao");
