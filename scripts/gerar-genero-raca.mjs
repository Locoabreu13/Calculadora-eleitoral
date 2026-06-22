#!/usr/bin/env node
/**
 * scripts/gerar-genero-raca.mjs
 *
 * Gera a tabela de genero/raca por UF para o voto em dobro (EC 111/2021),
 * a partir do dataset consulta_cand do TSE (cache local), cruzando por
 * SQ_CANDIDATO internamente. NAO toca em nenhum JSON de votos ja validado.
 *
 * Reusa a MESMA normalizacao de texto do adaptador (normalizarTexto), para
 * que a chave gerada aqui case exatamente com a busca feita em runtime.
 *
 * Uso (uma UF por vez; "todas" e proibido):
 *   node scripts/gerar-genero-raca.mjs 2022 CE federal
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizarTexto } from "../js/cascata-adaptador.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CARGO_SLUG = {
  federal: "Deputado Federal",
  estadual: "Deputado Estadual",
  distrital: "Deputado Distrital",
  vereador: "Vereador",
};

const UFS_VALIDAS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// Remove BOM antes de qualquer parse (condicao 2). Vale para CSV e JSON.
function lerSemBOM(caminho, encoding) {
  let txt = fs.readFileSync(caminho, encoding);
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
  return txt;
}

function splitLinha(linha) {
  return linha.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
}

// Regra do voto em dobro: EC 111/2021. Mulher OU pessoa negra (preta/parda).
function ehVotoEmDobro(generoNorm, racaNorm) {
  return generoNorm === "FEMININO" || racaNorm === "PRETA" || racaNorm === "PARDA";
}

function main() {
  const [ano, ufArg, slugArg] = process.argv.slice(2);
  const uf = String(ufArg || "").toUpperCase().trim();
  const slug = String(slugArg || "federal").toLowerCase().trim();

  if (!ano || !uf) {
    console.error("Uso: node scripts/gerar-genero-raca.mjs <ano> <UF> <cargo>");
    process.exit(1);
  }
  if (["TODAS","TODOS","ALL","BR","BRASIL"].includes(uf)) {
    console.error("Este script aceita apenas UMA UF por vez. 'todas' e proibido.");
    process.exit(1);
  }
  if (!UFS_VALIDAS.includes(uf)) {
    console.error(`UF invalida: "${uf}".`);
    process.exit(1);
  }
  const cargo = CARGO_SLUG[slug];
  if (!cargo) {
    console.error(`Cargo invalido: "${slug}". Use: federal, estadual, distrital, vereador`);
    process.exit(1);
  }
  const cargoCSV = cargo.toUpperCase();

  const csvPath = path.join(ROOT, "cache", `consulta_cand_${ano}`, `consulta_cand_${ano}_${uf}.csv`);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV de candidatos nao encontrado: ${csvPath}`);
    process.exit(1);
  }

  const linhas = lerSemBOM(csvPath, "latin1").split(/\r?\n/);
  const header = splitLinha(linhas[0]);
  const col = (n) => header.indexOf(n);
  const iCargo = col("DS_CARGO"), iUF = col("SG_UF"), iSq = col("SQ_CANDIDATO"),
        iNome = col("NM_CANDIDATO"), iPart = col("SG_PARTIDO"),
        iGen = col("DS_GENERO"), iRaca = col("DS_COR_RACA");

  if ([iCargo, iSq, iNome, iPart, iGen, iRaca].some((i) => i < 0)) {
    console.error("Colunas obrigatorias ausentes no consulta_cand (DS_CARGO, SQ_CANDIDATO, NM_CANDIDATO, SG_PARTIDO, DS_GENERO, DS_COR_RACA).");
    process.exit(1);
  }

  // Agrupa por chave nome|partido normalizada; deduplica por SQ.
  const porChave = new Map(); // chave -> Map(SQ -> { genero, raca, votoEmDobro })
  for (let k = 1; k < linhas.length; k++) {
    const linha = linhas[k].trim();
    if (!linha) continue;
    const c = splitLinha(linha);
    if ((c[iCargo] || "").toUpperCase() !== cargoCSV) continue;
    if (iUF >= 0 && (c[iUF] || "").toUpperCase() !== uf) continue;
    const nome = (c[iNome] || "").trim();
    const part = (c[iPart] || "").trim();
    if (!nome || !part) continue;
    const chave = normalizarTexto(nome) + "|" + normalizarTexto(part);
    const sq = (c[iSq] || "").trim();
    const genero = normalizarTexto(c[iGen]);
    const raca = normalizarTexto(c[iRaca]);
    if (!porChave.has(chave)) porChave.set(chave, new Map());
    porChave.get(chave).set(sq, { genero, raca, votoEmDobro: ehVotoEmDobro(genero, raca) });
  }

  // Resolve cada chave: concordam -> registra; divergem -> ambiguo (condicao 1).
  const candidatos = {};
  let totalAmbiguos = 0;
  for (const [chave, porSq] of porChave) {
    const regs = [...porSq.values()];
    const respostas = new Set(regs.map((r) => r.votoEmDobro));
    if (respostas.size === 1) {
      const r = regs[0];
      candidatos[chave] = { genero: r.genero, raca: r.raca, votoEmDobro: r.votoEmDobro };
    } else {
      totalAmbiguos++;
      candidatos[chave] = {
        ambiguo: true,
        motivo: `${porSq.size} registros (SQ) com voto em dobro divergente`,
      };
    }
  }

  // Verificacao cruzada contra os candidatos servidos (2022_UF_federal.json).
  const jsonVotosPath = path.join(ROOT, "data", "tse", `${ano}_${uf}_${slug}.json`);
  const cruzamento = { servidos: 0, encontrados: 0, ausentes: [] };
  if (fs.existsSync(jsonVotosPath)) {
    const jv = JSON.parse(lerSemBOM(jsonVotosPath, "utf8"));
    for (const p of (jv.partidos || [])) {
      for (const cand of (p.candidatos || [])) {
        cruzamento.servidos++;
        const chave = normalizarTexto(cand.nome) + "|" + normalizarTexto(cand.partido);
        if (Object.prototype.hasOwnProperty.call(candidatos, chave)) {
          cruzamento.encontrados++;
        } else if (cruzamento.ausentes.length < 20) {
          cruzamento.ausentes.push(chave);
        }
      }
    }
  }

  const saida = {
    meta: {
      ano: Number(ano), uf, cargo,
      gerado: new Date().toISOString(),
      fonte: `consulta_cand_${ano}_${uf}.csv`,
      regraDobro: "EC 111/2021: genero FEMININO ou raca PRETA/PARDA",
      totalCandidatos: Object.keys(candidatos).length,
      totalAmbiguos,
    },
    candidatos,
  };

  const outPath = path.join(ROOT, "data", "tse", `${ano}_${uf}_genero-raca.json`);
  fs.writeFileSync(outPath, JSON.stringify(saida, null, 4), "utf8");

  console.log(`Gravado: ${path.relative(ROOT, outPath)}`);
  console.log(`  totalCandidatos: ${saida.meta.totalCandidatos} | totalAmbiguos: ${totalAmbiguos}`);
  console.log(`  cruzamento: ${cruzamento.encontrados}/${cruzamento.servidos} candidatos servidos encontrados na tabela`);
  if (cruzamento.ausentes.length) {
    console.log(`  ausentes (ate 20):`);
    for (const a of cruzamento.ausentes) console.log(`    ${a}`);
  }
}

main();
