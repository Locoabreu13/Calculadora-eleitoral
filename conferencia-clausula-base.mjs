// conferencia-clausula-base.mjs
// Pre-computa cadeiras e votos por partido/federacao por estado (2022)
// e valida contra o gabarito da Portaria TSE 10/2023 (clausula de desempenho).
// Execucao: node conferencia-clausula-base.mjs
// Arquivo de conferencia descartavel. Nao edita nada, nao commita.

import fs from "fs";
import { calcular } from "./js/engine.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

const PATAMAR = dadosReferencia.clausula.patamaresPorEleicao[2022];
const VAGAS_POR_UF = dadosReferencia.vagasDeputadoFederal2022PorUF.porUF;
const GABARITO = dadosReferencia.clausula.gabarito2022;

// Mapeamento das tres federacoes de 2022.
// 26 estados usam siglaAgrupada; CE usa membros individuais.
// RO nao tem PSDB/CIDADANIA em nenhum formato: zero votos e zero cadeiras la.
const FEDERACOES_2022 = {
  "FE Brasil (PT/PC do B/PV)": {
    siglaAgrupada: "PT/PC do B/PV",
    membros: ["PT", "PC do B", "PV"]
  },
  "PSDB/Cidadania": {
    siglaAgrupada: "PSDB/CIDADANIA",
    membros: ["PSDB", "CIDADANIA"]
  },
  "PSOL/Rede": {
    siglaAgrupada: "PSOL/REDE",
    membros: ["PSOL", "REDE"]
  }
};

const UFS = Object.keys(VAGAS_POR_UF).sort();

// Normaliza o resultado do engine de um estado:
// detecta formato agrupado ou individual das federacoes e retorna
// mapa { nomeEntidade -> { votos, cadeiras } }.
function normalizarResultadoEstado(resultadoEngine) {
  const porSigla = {};
  for (const p of resultadoEngine.partidos) {
    porSigla[p.sigla] = { votos: p.votos, cadeiras: p.total };
  }

  const normalizado = {};

  for (const [nomeFed, fed] of Object.entries(FEDERACOES_2022)) {
    if (porSigla[fed.siglaAgrupada] !== undefined) {
      // Formato agrupado: a federacao aparece como uma sigla unica.
      normalizado[nomeFed] = { ...porSigla[fed.siglaAgrupada] };
      delete porSigla[fed.siglaAgrupada];
    } else {
      // Formato individual: soma os membros que aparecerem.
      let votos = 0, cadeiras = 0, encontrou = false;
      for (const membro of fed.membros) {
        if (porSigla[membro] !== undefined) {
          votos += porSigla[membro].votos;
          cadeiras += porSigla[membro].cadeiras;
          delete porSigla[membro];
          encontrou = true;
        }
      }
      if (encontrou) {
        normalizado[nomeFed] = { votos, cadeiras };
      }
    }
  }

  // Adiciona os partidos restantes (nao membros de federacao).
  for (const [sigla, dados] of Object.entries(porSigla)) {
    normalizado[sigla] = dados;
  }

  return normalizado;
}

// Acumula dados por UF.
const votosPorEntidadePorUF = {};
const cadeirasPorEntidadePorUF = {};
const totalVotosPorUF = {};

for (const uf of UFS) {
  const caminho = `./data/tse/2022_${uf}_federal.json`;
  const bruto = fs.readFileSync(caminho, "utf8").replace(/^\uFEFF/, "");
  const dadosEstado = JSON.parse(bruto);
  const vagas = VAGAS_POR_UF[uf];
  const resultado = calcular({
    rotulo: `2022_${uf}`,
    vagas,
    partidos: dadosEstado.partidos
  });
  totalVotosPorUF[uf] = resultado.votosValidos;
  const normalizado = normalizarResultadoEstado(resultado);
  for (const [entidade, dados] of Object.entries(normalizado)) {
    if (!votosPorEntidadePorUF[entidade]) votosPorEntidadePorUF[entidade] = {};
    if (!cadeirasPorEntidadePorUF[entidade]) cadeirasPorEntidadePorUF[entidade] = {};
    votosPorEntidadePorUF[entidade][uf] = dados.votos;
    cadeirasPorEntidadePorUF[entidade][uf] = dados.cadeiras;
  }
}

const totalVotosNacional = Object.values(totalVotosPorUF).reduce((a, b) => a + b, 0);
const totalCadeirasNacional = Object.values(cadeirasPorEntidadePorUF)
  .reduce((acc, porUF) => acc + Object.values(porUF).reduce((a, b) => a + b, 0), 0);

// Aplica criterios da clausula por entidade.
const todasEntidades = new Set([
  ...Object.keys(votosPorEntidadePorUF),
  ...Object.keys(cadeirasPorEntidadePorUF)
]);

const resultadoClausula = {};
for (const entidade of todasEntidades) {
  const votosPorUF = votosPorEntidadePorUF[entidade] || {};
  const cadeirasPorUF = cadeirasPorEntidadePorUF[entidade] || {};
  const votosNacional = Object.values(votosPorUF).reduce((a, b) => a + b, 0);
  const cadeirasNacional = Object.values(cadeirasPorUF).reduce((a, b) => a + b, 0);
  const pctNacional = votosNacional / totalVotosNacional * 100;
  let ufsComPctMinimo = 0, ufsComCadeira = 0;
  for (const uf of UFS) {
    const pctUF = (votosPorUF[uf] || 0) / totalVotosPorUF[uf] * 100;
    if (pctUF >= PATAMAR.votosMinimoPorUFPct) ufsComPctMinimo++;
    if ((cadeirasPorUF[uf] || 0) >= 1) ufsComCadeira++;
  }
  const cumpriuPorVotos =
    pctNacional >= PATAMAR.votosValidosPct && ufsComPctMinimo >= PATAMAR.ufsMinimas;
  const cumpriuPorCadeiras =
    cadeirasNacional >= PATAMAR.deputadosMinimos && ufsComCadeira >= PATAMAR.ufsMinimas;
  resultadoClausula[entidade] = {
    votosNacional, pctNacional, cadeirasNacional,
    ufsComPctMinimo, ufsComCadeira,
    cumpriuPorVotos, cumpriuPorCadeiras,
    cumpriu: cumpriuPorVotos || cumpriuPorCadeiras
  };
}

// Relatorio
console.log("=== CONFERENCIA CLAUSULA DE DESEMPENHO 2022 ===");
console.log(`Patamar EC 97/2017, inciso II (legislatura seguinte a 2022)`);
console.log(`Criterio votos  : >= ${PATAMAR.votosValidosPct}% nacional E >= ${PATAMAR.votosMinimoPorUFPct}% em >= ${PATAMAR.ufsMinimas} UFs`);
console.log(`Criterio cadeira: >= ${PATAMAR.deputadosMinimos} cadeiras  E em >= ${PATAMAR.ufsMinimas} UFs`);
console.log(`Total votos validos nacional : ${totalVotosNacional.toLocaleString("pt-BR")}`);
console.log(`Total cadeiras apuradas      : ${totalCadeirasNacional} (esperado: 513)`);
console.log("");

const entidadesOrdenadas = [...todasEntidades].sort(
  (a, b) => resultadoClausula[b].cadeirasNacional - resultadoClausula[a].cadeirasNacional
);

const cab = "Entidade                         Cad  Votos%   UFsCad UFsVot  PorVot PorCad Cumpriu";
console.log(cab);
console.log("-".repeat(cab.length));
for (const entidade of entidadesOrdenadas) {
  const r = resultadoClausula[entidade];
  if (r.cadeirasNacional === 0 && r.votosNacional === 0) continue;
  console.log(
    entidade.padEnd(32) +
    String(r.cadeirasNacional).padStart(4) + "  " +
    r.pctNacional.toFixed(2).padStart(6) + "%  " +
    String(r.ufsComCadeira).padStart(6) + " " +
    String(r.ufsComPctMinimo).padStart(6) + "  " +
    (r.cumpriuPorVotos   ? "   SIM" : "   nao") + " " +
    (r.cumpriuPorCadeiras ? "   SIM" : "   nao") + " " +
    (r.cumpriu ? "  CUMPRIU" : "      nao")
  );
}

console.log("");
console.log("=== COMPARACAO COM GABARITO (Portaria TSE 10/2023) ===");
const cumpriramNoScript = [...todasEntidades]
  .filter(e => resultadoClausula[e].cumpriu).sort();
console.log(`Gabarito (${GABARITO.atingiramPelasUrnas.length} entes): ${GABARITO.atingiramPelasUrnas.join(", ")}`);
console.log(`Script   (${cumpriramNoScript.length} entes): ${cumpriramNoScript.join(", ")}`);
console.log("");
console.log("Nota: grafias podem diferir (ex: PCdoB vs 'PC do B'; UNIAO vs UNIAO com acento).");
console.log("Conferir os 12 entes manualmente pela correspondencia de partidos/federacoes.");

// --- Exportar linha de base para insercao em dadosReferencia ---
const mapeamentoSiglaParaEntidade = {};
for (const [nomeFed, fed] of Object.entries(FEDERACOES_2022)) {
  for (const membro of fed.membros) {
    mapeamentoSiglaParaEntidade[membro] = nomeFed;
  }
  mapeamentoSiglaParaEntidade[fed.siglaAgrupada] = nomeFed;
}

const cadeirasSparse = {};
for (const [entidade, porUF] of Object.entries(cadeirasPorEntidadePorUF)) {
  const totalCad = Object.values(porUF).reduce((a, b) => a + b, 0);
  if (totalCad > 0) {
    const sparse = {};
    for (const [uf, count] of Object.entries(porUF)) {
      if (count > 0) sparse[uf] = count;
    }
    cadeirasSparse[entidade] = sparse;
  }
}

const statusVotos = {};
for (const [entidade, r] of Object.entries(resultadoClausula)) {
  statusVotos[entidade] = {
    cumpriuPorVotos: r.cumpriuPorVotos,
    pctNacional: parseFloat(r.pctNacional.toFixed(4)),
    ufsComPctMinimo: r.ufsComPctMinimo
  };
}

const linhaDeBase = {
  fonte: "Resultado TSE 2022 processado via conferencia-clausula-base.mjs; soma cadeiras = " + totalCadeirasNacional,
  anoEleicao: 2022,
  mapeamentoSiglaParaEntidade,
  totalVotosPorUF,
  cadeirasPorEntidadePorUF: cadeirasSparse,
  statusVotosPorEntidade: statusVotos
};

fs.writeFileSync("./clausula-linhaDeBase2022.json",
  JSON.stringify(linhaDeBase, null, 2), "utf8");
console.log("\nLinha de base exportada: clausula-linhaDeBase2022.json");
