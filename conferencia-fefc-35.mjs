import fs from 'node:fs';
import readline from 'node:readline';

const NEGRO_INCLUI_PARDA = true;
const DOBRO_NAO_QUADRUPLICA = true;
const INCLUIR_LEGENDA_NA_BASE = false;
const AGREGAR_FEDERACAO = false;
const POOL_35 = 1736531922.00;

const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const partes = l => l.split(';').map(c => c.replace(/^"|"$/g, ''));
const achar = caminhos => { for (const p of caminhos) if (fs.existsSync(p)) return p; return null; };

const CAD = achar([
  './cache/consulta_cand_2022/consulta_cand_2022_BRASIL.csv',
  './cache/consulta_cand_2022_BRASIL.csv',
]);
const VOT = achar([
  './cache/votacao_candidato_munzona_2022/votacao_candidato_munzona_2022_BRASIL.csv',
  './cache/votacao_candidato_munzona_2022_BRASIL.csv',
]);
if (!CAD) { console.error('Cadastro nao encontrado.'); process.exit(1); }
if (!VOT) { console.error('Votacao nao encontrada. Extraia o ZIP.'); process.exit(1); }

const cadastro = new Map();
{
  const linhas = fs.readFileSync(CAD, 'latin1').split(/\r?\n/);
  const cab = partes(linhas[0]); const i = n => cab.indexOf(n);
  const iCargo = i('DS_CARGO'), iSq = i('SQ_CANDIDATO'), iGen = i('DS_GENERO'),
        iRaca = i('DS_COR_RACA'), iPart = i('SG_PARTIDO'), iFed = i('SG_FEDERACAO');
  for (let k = 1; k < linhas.length; k++) {
    if (!linhas[k]) continue;
    const c = partes(linhas[k]);
    if (!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL')) continue;
    cadastro.set(c[iSq], {
      mulher: semAcento(c[iGen]) === 'FEMININO',
      negro: semAcento(c[iRaca]) === 'PRETA' || (NEGRO_INCLUI_PARDA && semAcento(c[iRaca]) === 'PARDA'),
      partido: semAcento(c[iPart]),
      federacao: semAcento(c[iFed]),
    });
  }
}
console.log('Candidatos a deputado federal no cadastro:', cadastro.size);

const votosPorCand = new Map();
const legendaPorChave = new Map();
const chaveDe = m => (AGREGAR_FEDERACAO && m && m.federacao && m.federacao !== '#NULO') ? m.federacao : (m ? m.partido : null);

await new Promise((res, rej) => {
  const rl = readline.createInterface({ input: fs.createReadStream(VOT, { encoding: 'latin1' }) });
  let cab = null, iCargo, iSq, iVotos, iDest, iPart, iFed;
  rl.on('line', l => {
    if (!cab) {
      cab = partes(l); const i = n => cab.indexOf(n);
      iCargo = i('DS_CARGO'); iSq = i('SQ_CANDIDATO'); iVotos = i('QT_VOTOS_NOMINAIS');
      iDest = i('NM_TIPO_DESTINACAO_VOTOS'); iPart = i('SG_PARTIDO'); iFed = i('SG_FEDERACAO');
      return;
    }
    if (!l) return;
    const c = partes(l);
    if (!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL')) return;
    const d = semAcento(c[iDest]);
    if (!d.startsWith('VALIDO')) return;
    const votos = parseInt(c[iVotos] || '0', 10) || 0;
    if (d.includes('LEGENDA')) {
      const fed = semAcento(c[iFed]);
      const chave = (AGREGAR_FEDERACAO && fed && fed !== '#NULO') ? fed : semAcento(c[iPart]);
      legendaPorChave.set(chave, (legendaPorChave.get(chave) || 0) + votos);
    } else {
      votosPorCand.set(c[iSq], (votosPorCand.get(c[iSq]) || 0) + votos);
    }
  });
  rl.on('close', res); rl.on('error', rej);
});

const porChave = new Map();
let semCadastro = 0;
for (const [sq, votos] of votosPorCand) {
  const m = cadastro.get(sq);
  if (!m) { semCadastro += votos; continue; }
  const chave = chaveDe(m);
  const dobra = m.mulher || m.negro;
  let comDobro = votos;
  if (dobra) comDobro = DOBRO_NAO_QUADRUPLICA ? votos * 2 : ((m.mulher && m.negro) ? votos * 4 : votos * 2);
  const o = porChave.get(chave) || { simples: 0, dobro: 0, legenda: 0 };
  o.simples += votos; o.dobro += comDobro; porChave.set(chave, o);
}
for (const [chave, v] of legendaPorChave) {
  const o = porChave.get(chave) || { simples: 0, dobro: 0, legenda: 0 };
  o.legenda += v; porChave.set(chave, o);
}

const base = o => o.dobro + (INCLUIR_LEGENDA_NA_BASE ? o.legenda : 0);
const totalBase = [...porChave.values()].reduce((s, o) => s + base(o), 0);
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const linhas = [...porChave.entries()].map(([k, o]) => ({ k, base: base(o), reais: POOL_35 * base(o) / totalBase, ...o }))
  .sort((a, b) => b.reais - a.reais);

console.log('\nChaves de decisao: negroIncluiParda=' + NEGRO_INCLUI_PARDA + ', naoQuadruplica=' + DOBRO_NAO_QUADRUPLICA + ', incluiLegenda=' + INCLUIR_LEGENDA_NA_BASE + ', agregaFederacao=' + AGREGAR_FEDERACAO);
console.log('Votos nominais sem cadastro correspondente:', semCadastro);
console.log('\nPARTIDO/FED | nominal simples | nominal em dobro | legenda | 35% (R$)');
for (const r of linhas) console.log(r.k + ' | ' + r.simples + ' | ' + r.dobro + ' | ' + r.legenda + ' | ' + brl(r.reais));

const soma = linhas.reduce((s, r) => s + r.reais, 0);
console.log('\nSoma das fatias de 35%: ' + brl(soma));
console.log('Pool oficial de 35%:    ' + brl(POOL_35));
console.log('Diferenca: ' + brl(soma - POOL_35));
