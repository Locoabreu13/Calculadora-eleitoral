import { calcularTempoTV } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// O PSC tem 7 cadeiras na foto base; com delta -7 ele vai a zero e deve sair
// inteiro da divisao pela porta de entrada (cadeira > 0).
const cenario = {
  deltaCadeirasPorPartido: {
    "PSC": -7
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

console.log("== Tempo TV: alavancagem da porta de entrada ==");
console.log("status:", resultado.status);
console.log("base:", resultado.base);

console.log("\n== Partidos ilustrativos ==");
imprimirPartido("PSC");
imprimirPartido("UNIÃO");
imprimirPartido("AVANTE");

const entradas = Object.entries(resultado.porPartido || {});
const somaDelta = entradas.reduce((s, [, p]) => s + p.deltaFracao, 0);
const qtdDeltaNaoZero = entradas.filter(([, p]) => p.deltaFracao !== 0).length;
const psc = resultado.porPartido && resultado.porPartido["PSC"];
const pscFoiAZero = !!psc && psc.fracaoDepois === 0;
const somaGeralProximaZero = Math.abs(somaDelta) < 1e-9;
const maisDeDoisMoveram = qtdDeltaNaoZero > 2;

const remanescentes = entradas.filter(([, p]) => p.fracaoDepois > 0);
const todosRemanescentesSubiram = remanescentes.every(([, p]) => p.deltaFracao > 0);

console.log("\n== Balanca ==");
console.log("fracaoDepois PSC:", psc ? psc.fracaoDepois : "nao encontrado");
console.log("soma de todos os deltaFracao:", somaDelta);
console.log("soma geral proxima de zero:", somaGeralProximaZero);
console.log("partidos com deltaFracao diferente de zero:", qtdDeltaNaoZero);
console.log("remanescentes avaliados:", remanescentes.length);
console.log("todos os remanescentes subiram:", todosRemanescentesSubiram);

const alavancagemOk =
  pscFoiAZero &&
  somaGeralProximaZero &&
  maisDeDoisMoveram &&
  todosRemanescentesSubiram;

console.log("\n== Veredito ==");
console.log("PSC foi a zero:", pscFoiAZero);
console.log("soma geral proxima de zero:", somaGeralProximaZero);
console.log("mais de 2 partidos se moveram:", maisDeDoisMoveram);
console.log("todos os remanescentes subiram:", todosRemanescentesSubiram);
console.log("ALAVANCAGEM OK:", alavancagemOk ? "sim" : "nao");
