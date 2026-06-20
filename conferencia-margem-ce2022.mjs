// conferencia-margem-ce2022.mjs
//
// Valida calcularMargemUltimaCadeira sobre o caso oficial CE 2022.
//
// Gabarito de referencia (CLAUDE.md):
//   Heitor Freire (UNIAO, 48.888 nominais, modalidade "nominal") -> PL 5->6, UNIAO 4->3
//
// Este arquivo usa os dados do data/tse/2022_CE_federal.json (5.083.860 votos,
// QE = 231.084), que e a base validada contra o resultado oficial do TSE.

import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { calcularMargemUltimaCadeira } from "./js/cascata-margem.js";

// ─── 1. Carrega dados oficiais CE 2022 ────────────────────────────────────────

const rawText = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^﻿/, "");
const raw = JSON.parse(rawText);
const VAGAS = 22;

const cenarioBase = { rotulo: "CE 2022 base oficial", vagas: VAGAS, partidos: raw.partidos };
const saidaBase = calcular(cenarioBase);

// ─── 2. Confirmacao da baseline ───────────────────────────────────────────────

console.log("=== BASELINE CE 2022 ===");
console.log("votosValidos:", saidaBase.votosValidos, "| QE:", saidaBase.qe, "| barreira80:", saidaBase.barreira80.toFixed(2));
for (const p of saidaBase.partidos.filter(p => p.total > 0)) {
  console.log(`  ${p.sigla.padEnd(20)} qp=${p.qp} f2=${p.sobrasF2} f3=${p.sobrasF3} total=${p.total}`);
}

// ─── 3. Calcula a margem da ultima cadeira ────────────────────────────────────

console.log("\n=== MARGEM DA ULTIMA CADEIRA ===");
const margem = calcularMargemUltimaCadeira(saidaBase, cenarioBase, calcular);

if (margem.status !== "ok") {
  console.error("ERRO: status inesperado:", margem.status, margem.observacao);
  process.exit(1);
}

const uc = margem.ultimaCadeira;
console.log("Ultima cadeira distribuida:");
console.log("  Rodada:", uc.rodada, "| Fase:", uc.fase);
console.log("  Vencedor:", uc.sigla, "| Media:", uc.media.toFixed(2));
console.log("  Total de cadeiras do vencedor:", uc.cadeirasVencedor);
if (uc.ultimoEleito) {
  const vn = uc.ultimoEleito.votos ?? uc.ultimoEleito.votosNominais ?? "(sem dado)";
  console.log("  Ultimo eleito convocado:", uc.ultimoEleito.nome ?? "(anonimo)", "| votos:", vn);
}

console.log("\nPrimeiro fora:");
if (!margem.primeiroFora) {
  console.log("  (nenhum candidato calculavel encontrado)");
} else {
  const pf = margem.primeiroFora;
  console.log("  Sigla:", pf.sigla);
  console.log("  Votos atuais:", pf.votos, "| Media na ultima rodada:", pf.media.toFixed(2));
  console.log("  Participava da rodada:", pf.participava);
  console.log("  Tipo de exclusao:", pf.tipoExclusao ?? "nenhuma (participou)");
  console.log("  Cadeiras atuais:", pf.cadeirasAtuais);
  console.log("  Votos necessarios para virar a cadeira:", pf.votosNecessarios);
}

console.log("\nDemais candidatos (ordenados por votos necessarios):");
for (const c of margem.demaisCandidatos) {
  const sit = c.participava ? "PARTICIPA" : `EXCLUIDO(${c.tipoExclusao})`;
  const vn = c.votosNecessarios !== null ? String(c.votosNecessarios) : "nao calculavel";
  console.log(`  ${c.sigla.padEnd(20)} media=${c.media.toFixed(2)} [${sit}] votosNecessarios=${vn}`);
}

// ─── 4. Verificacoes de corretude ─────────────────────────────────────────────

function checa(nome, ok) {
  console.log((ok ? "OK    " : "FALHOU") + " " + nome);
  return ok;
}

console.log("\n=== VERIFICACOES ===");
let tudo = true;

tudo &= checa(
  "Ultima cadeira e da UNIAO (Rodada 6, Fase 2)",
  uc.sigla === "UNIÃO" && uc.rodada === 6 && uc.fase === 2
);

tudo &= checa(
  "Primeiro fora e REPUBLICANOS",
  margem.primeiroFora && margem.primeiroFora.sigla === "REPUBLICANOS"
);

tudo &= checa(
  "REPUBLICANOS esta classificado como barreira_80",
  margem.primeiroFora && margem.primeiroFora.tipoExclusao === "barreira_80"
);

tudo &= checa(
  "Votos necessarios do primeiro fora e maior que zero",
  margem.primeiroFora && margem.primeiroFora.votosNecessarios > 0
);

// ─── 5. Teste de fronteira (prova de exatidao do numero) ─────────────────────
//
// Roda o engine com n-1 e n votos adicionais ao REPUBLICANOS.
// n-1 deve manter o resultado original (REPUBLICANOS sem cadeira, UNIAO com 4).
// n deve virar a cadeira (REPUBLICANOS ganha 1, UNIAO perde 1).
// Sem esse par de testes, o numero nao pode ser considerado exato.

console.log("\n=== TESTE DE FRONTEIRA ===");
const vn = margem.primeiroFora ? margem.primeiroFora.votosNecessarios : null;

if (vn === null) {
  console.log("AVISO: primeiro fora sem votos calculaveis, teste de fronteira ignorado.");
} else {
  function rodarComVotos(sigla, votosAdicionais) {
    const clone = JSON.parse(JSON.stringify(cenarioBase));
    const p = clone.partidos.find(x => x.sigla === sigla);
    if (p) p.votosLegenda = (p.votosLegenda || 0) + votosAdicionais;
    return calcular(clone);
  }

  const siglaAlvo = margem.primeiroFora.sigla;
  const cadeirasAlvoBase = margem.primeiroFora.cadeirasAtuais;
  const cadeirasVencedorBase = uc.cadeirasVencedor;

  const resNMenos1 = rodarComVotos(siglaAlvo, vn - 1);
  const resN = rodarComVotos(siglaAlvo, vn);

  const alvoNMenos1 = resNMenos1.partidos.find(p => p.sigla === siglaAlvo);
  const vencedorNMenos1 = resNMenos1.partidos.find(p => p.sigla === uc.sigla);
  const alvoN = resN.partidos.find(p => p.sigla === siglaAlvo);
  const vencedorN = resN.partidos.find(p => p.sigla === uc.sigla);

  console.log(`Com +${vn - 1} votos ao ${siglaAlvo}:`);
  console.log(`  ${siglaAlvo}: ${alvoNMenos1 ? alvoNMenos1.total : "?"} (base: ${cadeirasAlvoBase})`);
  console.log(`  ${uc.sigla}: ${vencedorNMenos1 ? vencedorNMenos1.total : "?"} (base: ${cadeirasVencedorBase})`);

  console.log(`Com +${vn} votos ao ${siglaAlvo}:`);
  console.log(`  ${siglaAlvo}: ${alvoN ? alvoN.total : "?"} (base: ${cadeirasAlvoBase})`);
  console.log(`  ${uc.sigla}: ${vencedorN ? vencedorN.total : "?"} (base: ${cadeirasVencedorBase})`);

  tudo &= checa(
    `n-1 (${vn - 1} votos): ${siglaAlvo} NAO ganha cadeira`,
    alvoNMenos1 && alvoNMenos1.total === cadeirasAlvoBase
  );

  tudo &= checa(
    `n-1 (${vn - 1} votos): ${uc.sigla} MANTEM cadeiras`,
    vencedorNMenos1 && vencedorNMenos1.total === cadeirasVencedorBase
  );

  tudo &= checa(
    `n (${vn} votos): ${siglaAlvo} GANHA 1 cadeira`,
    alvoN && alvoN.total === cadeirasAlvoBase + 1
  );

  tudo &= checa(
    `n (${vn} votos): ${uc.sigla} PERDE 1 cadeira`,
    vencedorN && vencedorN.total === cadeirasVencedorBase - 1
  );
}

// ─── 6. Conexao com o caso Heitor Freire ─────────────────────────────────────
//
// A cassacao de Heitor Freire (UNIAO, 48.888 nominais, modalidade "nominal")
// causa UNIAO 4->3 e PL 5->6 pelo seguinte mecanismo:
//   - Os votos nominais de Heitor sao anulados, reduzindo o total da eleicao.
//   - O novo QE (menor) faz o QP da UNIAO cair de 3 para 2 (um lugar a menos
//     na Fase 1), liberando uma sobra extra.
//   - Essa sobra extra vai ao PL na Fase 2.
//   - A UNIAO continua vencendo uma rodada de sobra (f2=1) no novo cenario.
//
// A funcao calcularMargemUltimaCadeira identifica a UNIAO como titular da
// ultima cadeira de sobra, com REPUBLICANOS como primeiro fora a 5.704 votos.
// A cassacao Heitor/UNIAO e a virada REPUBLICANOS/UNIAO tem a mesma vitima
// (UNIAO perde 1 cadeira em ambos os casos), mas mecanismos distintos:
//   - Cassacao: UNIAO perde uma vaga de Fase 1 (QP), PL ganha sobra extra.
//   - Virada por votos de legenda: UNIAO perde a sobra da Rodada 6 diretamente.
//
// A consistencia e confirmada abaixo rodando a cassacao homologada.

console.log("\n=== CONEXAO COM HEITOR FREIRE ===");
const cassHeitor = [{ partido: "UNIÃO", candidato: "HEITOR RODRIGO PEREIRA FREIRE", votosAnular: 48888, modalidade: "nominal" }];
const saidaHeitor = calcular({ ...cenarioBase, cassacoes: cassHeitor });
const uniaoHeitor = saidaHeitor.partidos.find(p => p.sigla === "UNIÃO");
const plHeitor = saidaHeitor.partidos.find(p => p.sigla === "PL");
const uniaoBase = saidaBase.partidos.find(p => p.sigla === "UNIÃO");
const plBase = saidaBase.partidos.find(p => p.sigla === "PL");

console.log(`UNIAO: ${uniaoBase.total} -> ${uniaoHeitor.total} (qp base=${uniaoBase.qp} pos=${uniaoHeitor.qp}, f2 base=${uniaoBase.sobrasF2} pos=${uniaoHeitor.sobrasF2})`);
console.log(`PL:    ${plBase.total} -> ${plHeitor.total} (qp base=${plBase.qp} pos=${plHeitor.qp}, f2 base=${plBase.sobrasF2} pos=${plHeitor.sobrasF2})`);

tudo &= checa("Cassacao Heitor: UNIAO 4->3 (gabarito CLAUDE.md)", uniaoHeitor.total === 3);
tudo &= checa("Cassacao Heitor: PL 5->6 (gabarito CLAUDE.md)", plHeitor.total === 6);
tudo &= checa("Cassacao Heitor: UNIAO manteve f2=1 (perdeu QP, nao a sobra)", uniaoHeitor.sobrasF2 === 1);
tudo &= checa("Cassacao Heitor: PL ganhou f2 extra (f2 base=1 -> pos=2)", plHeitor.sobrasF2 === 2);

// ─── 7. Resultado final ───────────────────────────────────────────────────────

console.log("\nRESULTADO:", tudo ? "APROVADO" : "REPROVADO");
