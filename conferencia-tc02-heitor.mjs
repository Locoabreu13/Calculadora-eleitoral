import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { montarCenarioCascata } from "./js/cascata-adaptador.js";
import { calcularCascata } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// 1. Carrega a base oficial do Ceara a partir do preset tse_real
const presets = JSON.parse(fs.readFileSync("./data/presets.json", "utf8")).presets;
const real = presets.find(p => p.id === "ce2022_cassacao_tse_real");
if (!real) { console.error("preset ce2022_cassacao_tse_real nao encontrado"); process.exit(1); }

const baseParticipantes = real.partidos;     // base oficial de votos
const cassacaoHeitor = real.cassacoes;       // a cassacao homologada

// 2. Dois cenarios sobre a MESMA base: antes (sem cassacao) e depois (com)
const cenarioAntes = { rotulo: "CE 2022 antes", vagas: real.vagas, partidos: baseParticipantes };
const cenarioDepois = { rotulo: "CE 2022 depois", vagas: real.vagas, partidos: baseParticipantes, cassacoes: cassacaoHeitor };

const saidaAntes = calcular(cenarioAntes);
const saidaDepois = calcular(cenarioDepois);

// 3. Cadeiras por partido antes e depois (verdade do engine)
const cad = (saida, sigla) => { const p = saida.partidos.find(x => x.sigla === sigla); return p ? p.total : 0; };
console.log("== Cadeiras pelo engine ==");
console.log("UNIAO antes:", cad(saidaAntes, "UNIÃO"), "depois:", cad(saidaDepois, "UNIÃO"));
console.log("PL    antes:", cad(saidaAntes, "PL"), "depois:", cad(saidaDepois, "PL"));

// 4. Adaptador: monta o cenario da cascata a partir das duas saidas do engine
const cenarioCascata = montarCenarioCascata(saidaAntes, saidaDepois, dadosReferencia, {
  tipo: "cassacao_sem_perda_votos",
  perdaDeVotos: false,
  circunscricao: "CE"
});
console.log("\n== Delta que o adaptador entregou a cascata ==");
console.log(JSON.stringify(cenarioCascata.deltaCadeirasPorPartido));
if (cenarioCascata._siglasNaoMapeadas.length) {
  console.log("ATENCAO siglas nao mapeadas:", cenarioCascata._siglasNaoMapeadas);
}

// 5. Cascata: efeito financeiro
const resultado = calcularCascata(saidaAntes, saidaDepois, dadosReferencia, cenarioCascata);
const fefc = resultado.nos.fefc;
const brl = n => (typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(n));
console.log("\n== Efeito no FEFC (fatia de cadeira, 48%) ==");
if (fefc && fefc.porPartido) {
  for (const [sigla, v] of Object.entries(fefc.porPartido)) {
    const d48 = v && (v.delta48 ?? v.delta_48 ?? v.d48);
    if (d48) console.log(sigla, "delta 48%:", brl(d48));
  }
}
console.log("status FEFC:", fefc ? fefc.status : "(sem no fefc)");

// 6. Verificacoes do TC-02 (gabarito homologado: UNIAO 4->3, PL 5->6)
function checa(nome, ok) { console.log((ok ? "OK  " : "FALHOU  ") + nome); return ok; }
let tudo = true;
tudo &= checa("UNIAO 4 para 3", cad(saidaAntes,"UNIÃO")===4 && cad(saidaDepois,"UNIÃO")===3);
tudo &= checa("PL 5 para 6", cad(saidaAntes,"PL")===5 && cad(saidaDepois,"PL")===6);
tudo &= checa("delta UNIAO = -1 no adaptador", cenarioCascata.deltaCadeirasPorPartido["UNIÃO"]===-1);
tudo &= checa("delta PL = +1 no adaptador", cenarioCascata.deltaCadeirasPorPartido["PL"]===1);
console.log("\nRESULTADO TC-02:", tudo ? "APROVADO" : "REPROVADO");
