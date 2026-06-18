import { calcularFundoPartidario } from './js/cascata.js';
import { dadosReferencia } from './js/cascata-referencia.js';

const resultado = calcularFundoPartidario({}, {}, dadosReferencia, {tipo: "cassacao_sem_perda_votos"}, "cassacao_sem_perda_votos");

const fracoes = resultado.fracoesBase;
const linhas = [];

for (const p in fracoes) {
  const f5 = fracoes[p].fatia5;
  const f95 = fracoes[p].fatia95;
  
  const pct5 = f5 * 0.05 * 100;
  const pct95 = f95 * 0.95 * 100;
  const pctTotal = pct5 + pct95;

  if (pctTotal > 0) {
    linhas.push({
      partido: p,
      pctTotal: pctTotal
    });
  }
}

linhas.sort((a, b) => b.pctTotal - a.pctTotal);

console.log("=== CONFERÊNCIA FUNDO PARTIDÁRIO (TC-05) ===");
console.log("PARTIDO         | PROPORÇÃO DO BOLO TOTAL (%)");
let soma = 0;
for (const r of linhas) {
  console.log(`${r.partido.padEnd(15)} | ${r.pctTotal.toFixed(4).padStart(8)}%`);
  soma += r.pctTotal;
}
console.log("----------------|------------------");
console.log(`SOMA TOTAL      | ${soma.toFixed(4).padStart(8)}%`);
