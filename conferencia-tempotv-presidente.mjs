// Limitacao: o residuo de poucos segundos vai para o ultimo na ordem de exibicao definida por sorteio.
// O valor com peso juridico e o tempo base por cadeira, nao a fracao residual.

function repartirTempo(concorrentes, tempoTotalSegundos) {
  const parteIgualTotal = tempoTotalSegundos * 0.10;
  const parteProporcionalTotal = tempoTotalSegundos * 0.90;
  const quantidade = concorrentes.length;
  const somaCadeiras = concorrentes.reduce((s, c) => s + c.cadeiras, 0);

  const tempos = concorrentes.map(c => {
    const parteIgual = parteIgualTotal / quantidade;
    const parteProporcional = parteProporcionalTotal * (c.cadeiras / somaCadeiras);
    return {
      nome: c.nome,
      segundos: Math.floor(parteIgual + parteProporcional)
    };
  });

  const somaArredondada = tempos.reduce((s, c) => s + c.segundos, 0);
  const residuo = tempoTotalSegundos - somaArredondada;
  if (tempos.length > 0) {
    tempos[tempos.length - 1].segundos += residuo;
  }

  return tempos;
}

const tempoTotalSegundos = 750;

const concorrentes = [
  { nome: "Coligação Brasil para Todos", cadeiras: 88, esperado: 140 },
  { nome: "União Brasil", cadeiras: 81, esperado: 130 },
  { nome: "Coligação Pelo Bem do Brasil", cadeiras: 100, esperado: 158 },
  { nome: "Novo", cadeiras: 8, esperado: 22 },
  { nome: "Coligação Brasil da Esperança", cadeiras: 141, esperado: 219 },
  { nome: "PDT", cadeiras: 28, esperado: 52 },
  // Valor base no art. 1º e 25 segundos; o § do mesmo artigo soma 4 segundos de residuo de fracoes ao ultimo colocado; valor final 29 segundos.
  { nome: "PTB", cadeiras: 10, esperado: 29 }
];

const somaCadeiras = concorrentes.reduce((s, c) => s + c.cadeiras, 0);
const resultado = repartirTempo(concorrentes, tempoTotalSegundos);

console.log("== Diagnostico ==");
console.log("tempo total segundos:", tempoTotalSegundos);
console.log("soma das cadeiras dos sete concorrentes:", somaCadeiras);
console.log("denominador da parte proporcional:", somaCadeiras);

console.log("\n== Conferencia contra Res. TSE 23.706/2022, art. 1º ==");
let todosBatem = true;

for (const r of resultado) {
  const esperado = concorrentes.find(c => c.nome === r.nome).esperado;
  const bate = r.segundos === esperado;
  todosBatem = todosBatem && bate;
  console.log(`${r.nome}: calculado=${r.segundos} esperado=${esperado} bate=${bate}`);
}

const somaCalculados = resultado.reduce((s, r) => s + r.segundos, 0);

console.log("\n== Soma ==");
console.log("soma dos calculados:", somaCalculados);
console.log("TODOS OS SETE BATEM:", todosBatem ? "sim" : "nao");
