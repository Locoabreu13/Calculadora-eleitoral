// conferencia-reverso-heitor.mjs
//
// Valida analisarDecisaoLitigio (js/cascata-reverso.js) sobre o caso oficial
// Heitor Freire (UNIÃO, CE 2022), já validado ponta a ponta em
// conferencia-fase5-heitor.mjs. O objetivo aqui não é recalcular nada — é
// confirmar que o modo reverso devolve OS MESMOS números da cascata direta,
// apenas reorganizados na ótica de quem decide se vale a pena litigar: o que
// o PL (que ganharia a cadeira) tem a favor, o que a UNIÃO (alvo da
// cassação cogitada) perderia.
//
// Achado durante o projeto da conferência (rodado antes deste script):
// o componente delta48 do FEFC (fatia de 48% por cadeira) é exatamente
// simétrico entre PL e UNIÃO, porque só esses dois partidos têm variação de
// cadeira. Já o delta35 (fatia de 35% por votos ponderados) NÃO é simétrico
// entre os dois: a perda de votos ponderados da UNIÃO é redistribuída
// proporcionalmente entre TODOS os partidos nacionais com voto no FEFC, não
// só para o PL. Por isso deltaTotal do PL não bate em módulo com o da
// UNIÃO — só delta48 bate. A verificação 1 abaixo documenta os dois fatos:
// simetria de delta48 e conservação nacional do delta35 (soma de todos os
// delta35 do resultado fecha em zero, sem vazamento de valor).
//
// Execução: node conferencia-reverso-heitor.mjs

import fs from "node:fs";
import { calcular } from "./js/engine.js";
import { analisarDecisaoLitigio } from "./js/cascata-reverso.js";
import { dadosReferencia } from "./js/cascata-referencia.js";

// 1. Base oficial completa do Ceará 2022 (28 partidos, 350 candidatos)
const oficial = JSON.parse(
  fs.readFileSync("./data/tse/2022_CE_federal.json", "utf8").replace(/^﻿/, "")
);
const VAGAS = 22;
const NOME_HEITOR = "HEITOR RODRIGO PEREIRA FREIRE";

// 2. Tabela de gênero/raça (Fase 5), para o voto em dobro da EC 111/2021
const tabelaGeneroRaca = JSON.parse(
  fs.readFileSync("./data/tse/2022_CE_genero-raca.json", "utf8").replace(/^﻿/, "")
);

// 3. Cassação cogitada: Heitor Freire, UNIÃO, 48.888 votos nominais
const cassacao = { partido: "UNIÃO", candidato: NOME_HEITOR, votosAnular: 48888, modalidade: "nominal" };

// 4. Dois cenários sobre a MESMA base oficial — "antes" é o estado atual,
// "depois" é o cenário da cassação cogitada (ainda não decidida).
const cenarioAntes = { rotulo: "CE 2022 antes (oficial)", vagas: VAGAS, partidos: oficial.partidos };
const cenarioDepois = {
  rotulo: "CE 2022 depois (cogitado)",
  vagas: VAGAS,
  partidos: oficial.partidos,
  cassacoes: [cassacao]
};

const saidaAntes = calcular(cenarioAntes);
const saidaDepois = calcular(cenarioDepois);

// 5. Modo reverso: o advogado representa o PL (parte que ganharia a cadeira
// se a cassação da UNIÃO se confirmar). O adversário ("UNIÃO") é inferido
// automaticamente a partir do partido da cassação cogitada, sem que o
// chamador precise informá-lo.
const analise = analisarDecisaoLitigio({
  saidaEngineBase: saidaAntes,
  cenarioOriginalBase: cenarioAntes,
  saidaEngineCenario: saidaDepois,
  calcularFn: calcular,
  dadosReferencia,
  categoria: "cassacao_com_perda_votos",
  uf: "CE",
  opts: { cassacoes: [cassacao], tabelaGeneroRaca, dadosReferencia },
  siglaPartidoProprio: "PL"
});

const brl = (n) => (typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(n));

console.log("== Partidos identificados ==");
console.log("Próprio (advogado):", analise.siglaPartidoProprio);
console.log("Adversários (inferidos das cassações cogitadas):", JSON.stringify(analise.siglasPartidosAdversarios));

console.log("\n== Ganhos do partido próprio (PL) ==");
console.log("FEFC:", JSON.stringify(analise.ganhosPartidoProprio.fefc));
console.log("Tempo de TV:", JSON.stringify(analise.ganhosPartidoProprio.tempoTV));
console.log("Cláusula:", JSON.stringify(analise.ganhosPartidoProprio.clausula));

console.log("\n== Perdas do(s) partido(s) adversário(s) ==");
for (const sigla of analise.siglasPartidosAdversarios) {
  console.log(`-- ${sigla} --`);
  console.log("FEFC:", JSON.stringify(analise.perdasPorAdversario[sigla].fefc));
  console.log("Tempo de TV:", JSON.stringify(analise.perdasPorAdversario[sigla].tempoTV));
  console.log("Cláusula:", JSON.stringify(analise.perdasPorAdversario[sigla].clausula));
}

console.log("\n== Margem da última cadeira (fragilidade, fato independente da cassação) ==");
console.log("status:", analise.margem.status);
if (analise.margem.status === "ok") {
  console.log("Última cadeira (titular):", analise.margem.ultimaCadeira.sigla);
  console.log("Primeiro fora:", analise.margem.primeiroFora && analise.margem.primeiroFora.sigla);
  console.log("Votos necessários:", analise.margem.primeiroFora && analise.margem.primeiroFora.votosNecessarios);
}

console.log("\n== Frase de fragilidade ==");
console.log(analise.fraseFragilidade);

console.log("\n== Frase de impacto do litígio ==");
console.log(analise.fraseImpactoLitigio);

console.log("\n== Aviso de escopo ==");
console.log(analise.avisoEscopo);

// ─── Verificações ────────────────────────────────────────────────────────────

function checa(nome, ok) {
  console.log((ok ? "OK    " : "FALHOU") + " " + nome);
  return ok;
}

console.log("\n=== VERIFICAÇÕES ===");
let tudo = true;

// 1a. delta48 do FEFC é exatamente simétrico entre PL e UNIÃO (zero-sum,
// só esses dois partidos têm variação de cadeira).
const fefcPL = analise.ganhosPartidoProprio.fefc;
const fefcUniao = analise.perdasPorAdversario["UNIÃO"].fefc;
tudo &= checa(
  "1a. FEFC delta48: PL e UNIÃO são exatamente simétricos (zero-sum por cadeira)",
  Math.abs(fefcPL.delta48 + fefcUniao.delta48) < 0.01
);

// 1b. deltaTotal: PL positivo, UNIÃO negativo, com os módulos batendo com os
// valores já impressos por conferencia-fase5-heitor.mjs (não exigimos
// igualdade entre si — só delta48 é simétrico, deltaTotal não é).
tudo &= checa("1b. FEFC deltaTotal do PL é positivo", fefcPL.deltaTotal > 0);
tudo &= checa("1b. FEFC deltaTotal da UNIÃO é negativo", fefcUniao.deltaTotal < 0);
tudo &= checa(
  "1b. FEFC deltaTotal da UNIÃO bate com conferencia-fase5-heitor.mjs (-R$ 5.648.428,16)",
  Math.abs(fefcUniao.deltaTotal - -5648428.158035657) < 0.01
);
tudo &= checa(
  "1b. FEFC delta35 da UNIÃO bate com conferencia-fase5-heitor.mjs (-R$ 1.006.070,47)",
  Math.abs(fefcUniao.delta35 - -1006070.4718758129) < 0.01
);

// 1c. Conservação nacional do delta35: a perda de votos ponderados da UNIÃO é
// redistribuída entre TODOS os partidos nacionais com voto no FEFC, não só
// para o PL — a soma de todos os delta35 do resultado deve fechar em zero
// (sem vazamento de valor).
const somaDelta35Nacional = Object.values(analise.cascata.nos.fefc.porPartido)
  .reduce((soma, p) => soma + (p.delta35 || 0), 0);
tudo &= checa(
  "1c. Conservação nacional: soma de delta35 de todos os partidos fecha em zero",
  Math.abs(somaDelta35Nacional) < 0.01
);
tudo &= checa(
  "1c. PL recebe só sua fração da redistribuição nacional, não a perda inteira da UNIÃO",
  fefcPL.delta35 > 0 && fefcPL.delta35 < Math.abs(fefcUniao.delta35)
);

// 2. tempoTV: simetria exata entre PL e UNIÃO (zero-sum dentro da tabela
// filtrada por UF, só os dois partidos têm variação de cadeira na UF).
const tvPL = analise.ganhosPartidoProprio.tempoTV;
const tvUniao = analise.perdasPorAdversario["UNIÃO"].tempoTV;
tudo &= checa(
  "2. tempoTV deltaFracao: PL e UNIÃO são simétricos em módulo",
  Math.abs(tvPL.deltaFracao + tvUniao.deltaFracao) < 1e-9
);
tudo &= checa("2. tempoTV deltaFracao do PL é positivo", tvPL.deltaFracao > 0);
tudo &= checa("2. tempoTV deltaFracao da UNIÃO é negativo", tvUniao.deltaFracao < 0);

// 3. Cláusula: UNIÃO mantém cumpriuDepois === true, sem entrada em mudancas.
const clausulaUniao = analise.perdasPorAdversario["UNIÃO"].clausula;
tudo &= checa("3. Cláusula: UNIÃO cumpriuDepois === true", clausulaUniao.cumpriuDepois === true);
tudo &= checa("3. Cláusula: UNIÃO não mudou (mudou === false)", clausulaUniao.mudou === false);
tudo &= checa(
  "3. Cláusula: UNIÃO não consta na lista de mudanças do resultado bruto",
  !(analise.cascata.nos.clausula.mudancas || []).some((m) => m.entidade === "UNIÃO")
);

// 4. fraseFragilidade não é nula e contém um número de votos de margem.
tudo &= checa("4. fraseFragilidade não é nula/vazia", typeof analise.fraseFragilidade === "string" && analise.fraseFragilidade.length > 0);
tudo &= checa("4. fraseFragilidade contém um número", /\d/.test(analise.fraseFragilidade));

// 5. fraseImpactoLitigio menciona PL ganhando e UNIÃO perdendo, com os
// valores corretos em reais (mesma formatação Intl pt-BR usada pelo módulo).
const fmtReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reaisGanhoPL = fmtReais.format(fefcPL.deltaTotal).replace(/\u00a0/g, " ");
const reaisPerdaUniao = fmtReais.format(Math.abs(fefcUniao.deltaTotal)).replace(/\u00a0/g, " ");
tudo &= checa("5. fraseImpactoLitigio menciona 'PL'", analise.fraseImpactoLitigio.includes("PL"));
tudo &= checa("5. fraseImpactoLitigio menciona 'ganha'", analise.fraseImpactoLitigio.includes("ganha"));
tudo &= checa("5. fraseImpactoLitigio contém o valor correto de ganho do PL em reais (" + reaisGanhoPL + ")", analise.fraseImpactoLitigio.includes(reaisGanhoPL));
tudo &= checa("5. fraseImpactoLitigio menciona 'UNIÃO'", analise.fraseImpactoLitigio.includes("UNIÃO"));
tudo &= checa("5. fraseImpactoLitigio menciona 'perde'", analise.fraseImpactoLitigio.includes("perde"));
tudo &= checa("5. fraseImpactoLitigio contém o valor correto de perda da UNIÃO em reais (" + reaisPerdaUniao + ")", analise.fraseImpactoLitigio.includes(reaisPerdaUniao));

// 6. avisoEscopo contém o texto sobre custo e risco processual.
tudo &= checa("6. avisoEscopo menciona 'Custo do litígio'", analise.avisoEscopo.includes("Custo do litígio"));
tudo &= checa("6. avisoEscopo menciona 'risco processual'", analise.avisoEscopo.includes("risco processual"));
tudo &= checa("6. avisoEscopo menciona 'juízo exclusivo do advogado'", analise.avisoEscopo.includes("juízo exclusivo do advogado"));

console.log("\nRESULTADO (modo reverso, caso Heitor Freire):", tudo ? "APROVADO" : "REPROVADO");
