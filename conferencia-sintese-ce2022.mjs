// conferencia-sintese-ce2022.mjs
//
// Valida gerarSintese sobre o caso CE 2022 base (sem cassação).
//
// Cenário: base CE 2022, 22 vagas.
// Margem: UNIÃO é a última cadeira (fase 2, rodada 6); REPUBLICANOS é o
// primeiro fora com 5.704 votos de legenda necessários.
// Cenário sintético: REPUBLICANOS recebe +5.704 votos de legenda e toma a
// cadeira da UNIÃO. A frase deve descrever essa virada e seus efeitos.
//
// Execução: node conferencia-sintese-ce2022.mjs

import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { calcularMargemUltimaCadeira } from "./js/cascata-margem.js";
import { gerarCenarioCascata } from "./js/cascata-adaptador.js";
import { calcularCascata } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";
import { gerarSintese } from "./js/cascata-sintese.js";

const rawText = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^﻿/, "");
const raw = JSON.parse(rawText);
const VAGAS = 22;

const cenarioBase = { rotulo: "CE 2022 base", vagas: VAGAS, partidos: raw.partidos };
const saidaBase = calcular(cenarioBase);

// ─── 1. Margem ───────────────────────────────────────────────────────────────

const margem = calcularMargemUltimaCadeira(saidaBase, cenarioBase, calcular);

// ─── 2. Cenário sintético ────────────────────────────────────────────────────

const pf = margem.primeiroFora;
const cenarioSintetico = JSON.parse(JSON.stringify(cenarioBase));
const partidoAlvo = cenarioSintetico.partidos.find(p => p.sigla === pf.sigla);
partidoAlvo.votosLegenda = (partidoAlvo.votosLegenda || 0) + pf.votosNecessarios;
const saidaSintetica = calcular(cenarioSintetico);

// ─── 3. Cascata ──────────────────────────────────────────────────────────────

// "cassacao_sem_perda_votos" instrui calcularFEFC a computar só delta48, sem
// delta35. Correto para análise de margem: os votos adicionados são de legenda,
// não redistribuem nominais de candidatos no FEFC (deltaVotosFEFCPorPartido fica
// vazio) e nenhum voto real é anulado ou transferido entre eleições.
const cenarioCascata = gerarCenarioCascata(
  saidaBase, saidaSintetica, "cassacao_sem_perda_votos", "CE"
);
const resultadoCascata = calcularCascata(
  saidaBase, saidaSintetica, dadosReferencia, cenarioCascata
);

// ─── 4. Síntese ──────────────────────────────────────────────────────────────

const frase = gerarSintese(margem, resultadoCascata);
console.log("\n=== FRASE SINTETIZADA ===");
console.log(frase);

// ─── 5. Verificações ─────────────────────────────────────────────────────────

function checa(nome, ok) {
  console.log((ok ? "OK    " : "FALHOU") + " " + nome);
  return ok;
}

console.log("\n=== VERIFICAÇÕES ===");
let tudo = true;

// Margem
tudo &= checa("Margem status ok",              margem.status === "ok");
tudo &= checa("Titular da última cadeira: UNIÃO",   margem.ultimaCadeira.sigla === "UNIÃO");
tudo &= checa("Primeiro fora: REPUBLICANOS",    pf && pf.sigla === "REPUBLICANOS");
tudo &= checa("votosNecessarios = 5.704",       pf && pf.votosNecessarios === 5704);

// Virada confirmada
const sSintPf  = saidaSintetica.partidos.find(p => p.sigla === pf.sigla);
const sSintTit = saidaSintetica.partidos.find(p => p.sigla === margem.ultimaCadeira.sigla);
tudo &= checa("Virada: REPUBLICANOS ganha 1 cadeira (0→1)", sSintPf  && sSintPf.total  === 1);
tudo &= checa("Virada: UNIÃO perde 1 cadeira (4→3)",        sSintTit && sSintTit.total === 3);

// FEFC: deslocamento deve ser exatamente uma unidade de cadeira
const unidadeCadeira = dadosReferencia.fefc.poolCadeiras / dadosReferencia.fefc.totalCadeiras;
const somaFefc = Object.values(resultadoCascata.nos.fefc.porPartido)
  .reduce((s, p) => s + Math.max(0, p.deltaTotal || 0), 0);
tudo &= checa("FEFC status validado",                resultadoCascata.nos.fefc.status === "validado");
tudo &= checa("FEFC delta35 = 0 (sem redistribuição de votos)",
  Object.values(resultadoCascata.nos.fefc.porPartido).every(p => p.delta35 === 0)
);
tudo &= checa(
  "FEFC deslocamento = uma unidade de cadeira (≈ R$ 4.642.357,69)",
  Math.abs(somaFefc - unidadeCadeira) < 0.01
);

// TV: delta positivo esperado ≈ 0,18% (0,9/494, tabela CE filtrada sem SOLIDARIEDADE)
const somaTV = Object.values(resultadoCascata.nos.tempoTV.porPartido)
  .reduce((s, p) => s + Math.max(0, p.deltaFracao || 0), 0);
tudo &= checa("TV status validado",     resultadoCascata.nos.tempoTV.status === "validado");
tudo &= checa("TV delta positivo > 0",  somaTV > 0);
tudo &= checa("TV delta positivo < 1%", somaTV < 0.01);

// Cláusula: nem UNIÃO nem REPUBLICANOS perde a cláusula nesta virada
tudo &= checa("Cláusula: sem mudança",  !resultadoCascata.nos.clausula.temMudancaNaClausula);

// Conteúdo da frase
tudo &= checa("Frase contém 'UNIÃO'",            frase.includes("UNIÃO"));
tudo &= checa("Frase contém 'REPUBLICANOS'",     frase.includes("REPUBLICANOS"));
tudo &= checa("Frase contém 'votos de legenda'", frase.includes("votos de legenda"));
tudo &= checa("Frase contém '5.704'",            frase.includes("5.704"));
tudo &= checa("Frase contém 'FEFC'",             frase.includes("FEFC"));
tudo &= checa("Frase contém '0,18'",             frase.includes("0,18"));
tudo &= checa("Frase contém 'tempo de TV'",      frase.includes("tempo de TV"));
tudo &= checa("Frase NÃO contém 'cláusula'",    !frase.includes("cláusula"));

console.log("\nRESULTADO:", tudo ? "APROVADO" : "REPROVADO");
