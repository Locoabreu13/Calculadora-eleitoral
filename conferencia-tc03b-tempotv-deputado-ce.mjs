import fs from "node:fs";
import { calcularTempoTV } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// Base oficial do Ceara 2022 (mesma fonte do TC-02), usada aqui so para extrair
// a lista real de partidos que registraram candidato a deputado federal no estado.
const _bruto = fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^\uFEFF/, "");
const oficial = JSON.parse(_bruto);
const base = { partidos: oficial.partidos };

// Cenario neutro, sem retotalizacao, so para obter a fotografia real de 2022 (fracaoAntes).
const cenario = { deltaCadeirasPorPartido: {} };

const resultado = calcularTempoTV(base, null, dadosReferencia, cenario, "cassacao_sem_perda_votos");

const TOTAL_SEGUNDOS = 750; // bloco de 12min30s, confirmado pelo cronograma oficial do TRE-CE

// Igualitario + Proporcional, em segundos, extraidos do relatorio oficial "Distribuicao de
// Tempo", Cargo Deputado Federal, CEARA, TRE-CE, 18/08/2022 (paginas do PDF unificado).
const oficialPorSigla = {
  "PTB": 17.83,
  "MDB": 50.63,
  "PATRIOTA": 16.47,
  "FEDERAÇÃO BRASIL DA ESPERANÇA": 99.82,
  "PSD": 51.99,
  "AVANTE": 13.73,
  "REPUBLICANOS": 43.80,
  "FEDERAÇÃO PSOL REDE": 19.20,
  "PROS": 15.10,
  "FEDERAÇÃO PSDB CIDADANIA": 54.73,
  "PSB": 47.89,
  "PDT": 42.43,
  "PL": 49.26,
  "NOVO": 15.10,
  "UNIÃO": 114.85,
  "PP": 56.09,
  "PODE": 27.40,
  "PSC": 13.73
};

console.log("Status:", resultado.status);
console.log("Partidos excluidos por ausencia no estado:", resultado._siglasExcluidasPorAusenciaNoEstado || []);
console.log("");

let todasBateram = true;

for (const [sigla, segundosOficiais] of Object.entries(oficialPorSigla)) {
  const entrada = resultado.porPartido[sigla];

  if (!entrada) {
    console.log(`FALTANDO: ${sigla} nao apareceu no resultado calculado.`);
    todasBateram = false;
    continue;
  }

  const segundosCalculados = entrada.fracaoAntes * TOTAL_SEGUNDOS;
  const diferenca = Math.abs(segundosCalculados - segundosOficiais);
  const bateu = diferenca < 0.05;

  if (!bateu) todasBateram = false;

  console.log(
    sigla.padEnd(35) +
    " oficial=" + segundosOficiais.toFixed(2) + "s" +
    "  calculado=" + segundosCalculados.toFixed(2) + "s" +
    "  diferenca=" + diferenca.toFixed(3) + "s" +
    "  " + (bateu ? "OK" : "DIVERGIU")
  );
}

console.log("");
console.log(todasBateram
  ? "TC-03b: VALIDADO contra o relatorio oficial do TRE-CE (Distribuicao de Tempo, Deputado Federal, CE 2022)."
  : "TC-03b: DIVERGENCIAS ENCONTRADAS, revisar.");
