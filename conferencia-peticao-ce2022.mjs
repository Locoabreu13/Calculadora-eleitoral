// conferencia-peticao-ce2022.mjs
//
// Valida o modulo js/cascata-peticao.js sobre o caso real Heitor Freire (CE 2022),
// usando a base OFICIAL data/tse/2022_CE_federal.json (nunca os presets) e a
// modalidade "nominal" (anula apenas nominais sem reatribuicao), reproduzindo a
// chamada identica a da tela (categoria "cassacao_com_perda_votos").
//
// Confere:
//   1. que os numeros impressos coincidem exatamente com os de calcularCascata;
//   2. que a peca inclui os quatro nos (FEFC, tempo de TV, clausula, fundo);
//   3. que ha fundamento legal e rodape de aviso;
//   4. que a frase de abertura narra o fato consumado (UNIAO para PL).
//
// Execucao: node conferencia-peticao-ce2022.mjs

import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { gerarCenarioCascata } from "./js/cascata-adaptador.js";
import { calcularCascata } from "./js/cascata.js";
import { dadosReferencia } from "./js/cascata-referencia.js";
import { montarDadosPeca, renderizarPecaHTML } from "./js/cascata-peticao.js";

const oficial = JSON.parse(fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^﻿/, ""));
const VAGAS = 22;
const NOME_HEITOR = "HEITOR RODRIGO PEREIRA FREIRE";
const cassacoes = [{ partido: "UNIÃO", candidato: NOME_HEITOR, votosAnular: 48888, modalidade: "nominal" }];

const antes = calcular({ vagas: VAGAS, partidos: oficial.partidos });
const depois = calcular({ vagas: VAGAS, partidos: oficial.partidos, cassacoes });

// Chamada identica a da tela (btn-cascata usa "cassacao_com_perda_votos").
const cen = gerarCenarioCascata(antes, depois, "cassacao_com_perda_votos", "CE");
const r = calcularCascata(antes, depois, dadosReferencia, cen);

const contexto = {
  cargo: "Deputado Federal",
  uf: "CE",
  ano: 2022,
  vagas: VAGAS,
  dataGeracao: new Date("2026-06-21T12:00:00"),
  decisao: { cassacoes }
};

const dados = montarDadosPeca({ resultadoCascata: r, dadosCenario: cen, contexto });
const html = renderizarPecaHTML(dados);

// Grava o HTML em arquivo temporario para a previa visual (fora do repositorio).
const caminhoPreview = (process.env.TMPDIR || "/tmp") + "/peca-ce2022.html";
fs.writeFileSync(caminhoPreview, html, "utf8");

function checa(nome, ok) {
  console.log((ok ? "OK    " : "FALHOU") + " " + nome);
  return ok;
}

// Auxiliares de formatacao iguais aos do modulo, para conferir coincidencia exata.
const fmtReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (v) => fmtReais.format(v).replace(/\u00A0/g, " ");
const pct4 = (fr) => (fr * 100).toFixed(4).replace(".", ",") + "%";

console.log("\n=== FRASE DE ABERTURA ===");
console.log(dados.fraseAbertura);
console.log("\n=== Previa HTML gravada em:", caminhoPreview, "===");

console.log("\n=== VERIFICACOES ===");
let tudo = true;

// 1. Transferencia de cadeira
const perdedores = dados.transferencias.perdedores.map((p) => p.sigla);
const ganhadores = dados.transferencias.ganhadores.map((g) => g.sigla);
tudo &= checa("Perdedor de cadeira: UNIAO", perdedores.includes("UNIÃO"));
tudo &= checa("Ganhador de cadeira: PL", ganhadores.includes("PL"));
tudo &= checa("Total de cadeiras movidas = 1", dados.transferencias.totalCadeirasMovidas === 1);

// 2. Coincidencia exata dos numeros com os nos de calcularCascata
const linhaPL = dados.tabela.linhas.find((l) => l.sigla === "PL");
const linhaUN = dados.tabela.linhas.find((l) => l.sigla === "UNIÃO");
tudo &= checa("FEFC PL coincide com o no", linhaPL && linhaPL.fefcDelta === r.nos.fefc.porPartido["PL"].deltaTotal);
tudo &= checa("FEFC UNIAO coincide com o no", linhaUN && linhaUN.fefcDelta === r.nos.fefc.porPartido["UNIÃO"].deltaTotal);
tudo &= checa("TV PL coincide com o no", linhaPL && linhaPL.tvDeltaFracao === r.nos.tempoTV.porPartido["PL"].deltaFracao);
tudo &= checa("TV UNIAO coincide com o no", linhaUN && linhaUN.tvDeltaFracao === r.nos.tempoTV.porPartido["UNIÃO"].deltaFracao);

// Soma do FEFC positiva coincide
const somaFefcNo = Object.values(r.nos.fefc.porPartido).reduce((s, p) => s + Math.max(0, p.deltaTotal || 0), 0);
tudo &= checa("Soma FEFC coincide com os nos", dados.somas.somaFefc === somaFefcNo);

// 3. Numeros impressos no HTML
tudo &= checa("HTML imprime FEFC do PL (" + reais(r.nos.fefc.porPartido["PL"].deltaTotal) + ")",
  html.includes(reais(r.nos.fefc.porPartido["PL"].deltaTotal)));
tudo &= checa("HTML imprime TV do PL (" + pct4(r.nos.tempoTV.porPartido["PL"].deltaFracao) + ")",
  html.includes(pct4(r.nos.tempoTV.porPartido["PL"].deltaFracao)));

// 4. Os quatro nos presentes
tudo &= checa("Peca inclui o no FEFC", html.includes("FEFC"));
tudo &= checa("Peca inclui o no Tempo de TV", html.includes("Tempo de TV"));
tudo &= checa("Peca inclui o no Clausula de desempenho", html.includes("Cláusula de desempenho"));
tudo &= checa("Peca inclui o no Fundo Partidario", html.includes("Fundo Partidário"));

// 5. Fundamento legal completo
tudo &= checa("Fundamento: art. 16-D", html.includes("16-D"));
tudo &= checa("Fundamento: art. 47", html.includes("Art. 47"));
tudo &= checa("Fundamento: art. 41-A", html.includes("41-A"));
tudo &= checa("Fundamento: EC 97/2017", html.includes("97/2017"));
tudo &= checa("Fundamento: EC 111/2021", html.includes("111/2021"));

// 6. Rodape de aviso
tudo &= checa("Rodape de simulacao independente", html.includes("simulação técnica independente"));

// 7. Frase de abertura narra o fato consumado
tudo &= checa("Frase cita os votos anulados (48.888)", dados.fraseAbertura.includes("48.888"));
tudo &= checa("Frase cita o candidato (HEITOR)", dados.fraseAbertura.toUpperCase().includes("HEITOR"));
tudo &= checa("Frase narra transferencia para o PL", dados.fraseAbertura.includes("PL"));
tudo &= checa("Frase parte da UNIAO", dados.fraseAbertura.includes("UNIÃO"));

// 8. Estados dos nos refletidos com fidelidade (com perda de votos: clausula e fundo pendentes)
tudo &= checa("FEFC validado", dados.tabela.fefcStatus === "validado");
tudo &= checa("Tempo de TV validado", dados.tabela.tvStatus === "validado");
tudo &= checa("Fundo pendente (decisao com perda de votos)", dados.tabela.fundoPendente === true);
tudo &= checa("Clausula pendente (decisao com perda de votos)", dados.clausula.pendente === true);

console.log("\nRESULTADO:", tudo ? "APROVADO" : "REPROVADO");
process.exit(tudo ? 0 : 1);
