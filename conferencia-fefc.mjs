import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

async function importarModuloLocal(caminhoRelativo) {
  const codigo = await readFile(new URL(caminhoRelativo, import.meta.url), "utf8");
  const url = `data:text/javascript;base64,${Buffer.from(codigo).toString("base64")}`;
  return import(url);
}

const { dadosReferencia } = await importarModuloLocal("./js/cascata-referencia.js");
const { calcularFEFC } = await importarModuloLocal("./js/cascata.js");

const fefc = dadosReferencia.fefc;
const unidadeCadeira = fefc.poolCadeiras / fefc.totalCadeiras;
const unidadeSenador = fefc.poolSenado / fefc.totalSenadores;
const somaCadeiras = Object.values(fefc.cadeirasPorPartido).reduce((soma, valor) => soma + valor, 0);
const somaSenadores = Object.values(fefc.senadoresPorPartido).reduce((soma, valor) => soma + valor, 0);

const cenario = {
  tipo: "cassacao_sem_perda_votos",
  perdaDeVotos: false,
  deltaCadeirasPorPartido: { "PL": 1, "UNIÃO": -1 }
};

const resultado = calcularFEFC(null, null, dadosReferencia, cenario, cenario.tipo);

console.log("unidadeCadeira:", unidadeCadeira);
console.log("unidadeSenador:", unidadeSenador);
console.log("soma cadeirasPorPartido:", somaCadeiras);
console.log("soma senadoresPorPartido:", somaSenadores);
console.log("resultado calcularFEFC:");
console.log(JSON.stringify(resultado, null, 2));
