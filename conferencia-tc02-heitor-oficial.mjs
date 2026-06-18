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

const cad = (saida, sigla) => { const p = saida.partidos.find(x => x.sigla === sigla); return p ? p.total : 0; };
console.log("== Cadeiras pelo engine (base oficial) ==");
for (const s of ["UNIÃO","PL","PDT","PSD","PT","MDB"]) {
  console.log(s.padEnd(6), "antes:", cad(saidaAntes,s), "depois:", cad(saidaDepois,s));
}

// 3. Conferir que a cassacao de fato reduziu os votos da UNIAO em 48.888
const votosUniao = (saida) => { const p = saida.partidos.find(x => x.sigla === "UNIÃO"); return p ? p.votos : null; };
const quedaUniao = votosUniao(saidaAntes) - votosUniao(saidaDepois);
console.log("\nVotos UNIAO antes:", votosUniao(saidaAntes), "depois:", votosUniao(saidaDepois), "| queda:", quedaUniao);

// 4. Adaptador
const cenarioCascata = montarCenarioCascata(saidaAntes, saidaDepois, dadosReferencia, {
  tipo: "cassacao_sem_perda_votos", perdaDeVotos: false, circunscricao: "CE"
});
console.log("\n== Delta entregue a cascata ==");
console.log(JSON.stringify(cenarioCascata.deltaCadeirasPorPartido));
if (cenarioCascata._siglasNaoMapeadas.length) console.log("ATENCAO nao mapeadas:", cenarioCascata._siglasNaoMapeadas);

// 5. Cascata
const resultado = calcularCascata(saidaAntes, saidaDepois, dadosReferencia, cenarioCascata);
const fefc = resultado.nos.fefc;
const brl = n => (typeof n === "number" ? n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : String(n));
console.log("\n== Efeito no FEFC (48%) ==");
if (fefc && fefc.porPartido) for (const [s,v] of Object.entries(fefc.porPartido)) {
  const d48 = v && (v.delta48 ?? v.delta_48 ?? v.d48);
  if (d48) console.log(s, "delta 48%:", brl(d48));
}
console.log("status FEFC:", fefc ? fefc.status : "(sem no)");

// 6. Verificacoes do TC-02 (gabarito homologado TRE-CE: UNIAO 4->3, PL 5->6)
function checa(n, ok){ console.log((ok?"OK  ":"FALHOU  ")+n); return ok; }
let tudo = true;
tudo &= checa("UNIAO 4 para 3", cad(saidaAntes,"UNIÃO")===4 && cad(saidaDepois,"UNIÃO")===3);
tudo &= checa("PL 5 para 6", cad(saidaAntes,"PL")===5 && cad(saidaDepois,"PL")===6);
tudo &= checa("cassacao reduziu votos da UNIAO em 48.888", quedaUniao === 48888);
tudo &= checa("delta UNIAO = -1", cenarioCascata.deltaCadeirasPorPartido["UNIÃO"]===-1);
tudo &= checa("delta PL = +1", cenarioCascata.deltaCadeirasPorPartido["PL"]===1);
console.log("\nRESULTADO TC-02 (oficial):", tudo ? "APROVADO" : "REPROVADO");
