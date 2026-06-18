'use strict';
const fs = require('fs');
const path = require('path');

const arquivo = path.join(__dirname, '..', 'data', 'tse', '2022_PA_federal.json');
const json = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

console.log('══ Verificação de somas — 2022_PA_federal.json ══════════════════');
console.log(`  Partidos: ${json.partidos.length}`);
console.log('');

let todosOk = true;

for (const p of json.partidos) {
  const nominais = p.votosNominais;

  if (!p.candidatos || p.candidatos.length === 0) {
    console.log(`  ${p.sigla.padEnd(22)} SEM CANDIDATOS`);
    continue;
  }

  const soma = p.candidatos.reduce((acc, c) => acc + (c.votos || 0), 0);
  const diff = soma - nominais;

  if (diff === 0) {
    console.log(`  ${p.sigla.padEnd(22)} OK  (${p.candidatos.length} cands, soma = ${soma.toLocaleString('pt-BR')})`);
  } else {
    todosOk = false;
    console.log(`  ${p.sigla.padEnd(22)} DIFERENÇA: soma ${soma.toLocaleString('pt-BR')} vs nominais ${nominais.toLocaleString('pt-BR')}  (delta ${diff > 0 ? '+' : ''}${diff})`);
  }
}

console.log('');
console.log(todosOk ? '✅ Todas as somas batem exatamente.' : '❌ Há divergências acima.');
