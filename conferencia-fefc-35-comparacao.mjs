import fs from 'node:fs';
import readline from 'node:readline';

// Chaves de decisao para diagnostico
const NEGRO_INCLUI_PARDA = true;
const DOBRO_NAO_QUADRUPLICA = true;
const INCLUIR_LEGENDA_NA_BASE = false;
const AGREGAR_FEDERACAO = false;
const RESTRINGIR_A_PARTIDOS_COM_ACESSO = true;
const POOL_35 = 1736531922.00;

// Alvo oficial do TSE (fatia de 35%), extraido da planilha tse-calculo-de-distribuicao-do-FEFC-2026.xlsx
const OFICIAL_35 = {
  'AGIR':0,'AVANTE':36712593.53,'CIDADANIA':24466689.24,'DC':0,'DEMOCRATA':0,
  'MDB':123663898.73,'MISSAO':0,'MOBILIZA':0,'NOVO':19809450.35,'PC DO B':24727730.59,
  'PCB':0,'PCO':0,'PDT':64136242.33,'PL':285578750.45,'PODE':85498933.0,
  'PP':140441249.79,'PRD':45299759.09,'PRTB':0,'PSB':70121911.34,'PSD':121653706.77,
  'PSDB':47484844.28,'PSOL':67847954.65,'PSTU':0,'PT':213687981.41,'PV':14022047.29,
  'REDE':14023426.22,'REPUBLICANOS':127379472.03,'SOLIDARIEDADE':43534486.59,
  'UNIAO':166440794.28,'UP':0,
};

// Remapeamento oficial de 2022 para 2026 (fusoes e incorporacoes confirmadas no TSE)
const REMAP = {
  'PATRIOTA':'PRD', 'PTB':'PRD',
  'PROS':'SOLIDARIEDADE',
  'PSC':'PODE',
  'PMN':'MOBILIZA', 'PMB':'MISSAO',
};

const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const canon = s => { const u = semAcento(s); return REMAP[u] || u; };
const partes = l => l.split(';').map(c => c.replace(/^"|"$/g,''));
const achar = caminhos => { for (const p of caminhos) if (fs.existsSync(p)) return p; return null; };

const CAD = achar(['./cache/consulta_cand_2022/consulta_cand_2022_BRASIL.csv','./cache/consulta_cand_2022_BRASIL.csv']);
const VOT = achar(['./cache/votacao_candidato_munzona_2022/votacao_candidato_munzona_2022_BRASIL.csv','./cache/votacao_candidato_munzona_2022_BRASIL.csv']);
if (!CAD || !VOT) { console.error('CSV nao encontrado.'); process.exit(1); }

const cadastro = new Map();
{
  const linhas = fs.readFileSync(CAD,'latin1').split(/\r?\n/);
  const cab = partes(linhas[0]); const i = n => cab.indexOf(n);
  const iCargo=i('DS_CARGO'),iSq=i('SQ_CANDIDATO'),iGen=i('DS_GENERO'),iRaca=i('DS_COR_RACA'),iPart=i('SG_PARTIDO');
  for (let k=1;k<linhas.length;k++){
    if(!linhas[k])continue; const c=partes(linhas[k]);
    if(!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL'))continue;
    cadastro.set(c[iSq],{
      mulher: semAcento(c[iGen])==='FEMININO',
      negro: semAcento(c[iRaca])==='PRETA' || (NEGRO_INCLUI_PARDA && semAcento(c[iRaca])==='PARDA'),
      partido: canon(c[iPart]),
    });
  }
}

const votosPorCand = new Map();
const legendaPorPart = new Map();
await new Promise((res,rej)=>{
  const rl=readline.createInterface({input:fs.createReadStream(VOT,{encoding:'latin1'})});
  let cab=null,iCargo,iSq,iVotos,iDest,iPart;
  rl.on('line',l=>{
    if(!cab){cab=partes(l);const i=n=>cab.indexOf(n);iCargo=i('DS_CARGO');iSq=i('SQ_CANDIDATO');iVotos=i('QT_VOTOS_NOMINAIS');iDest=i('NM_TIPO_DESTINACAO_VOTOS');iPart=i('SG_PARTIDO');return;}
    if(!l)return; const c=partes(l);
    if(!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL'))return;
    const d=semAcento(c[iDest]); if(!d.startsWith('VALIDO'))return;
    const votos=parseInt(c[iVotos]||'0',10)||0;
    if(d.includes('LEGENDA')){ const k=canon(c[iPart]); legendaPorPart.set(k,(legendaPorPart.get(k)||0)+votos); }
    else { votosPorCand.set(c[iSq],(votosPorCand.get(c[iSq])||0)+votos); }
  });
  rl.on('close',res); rl.on('error',rej);
});

const porPart = new Map();
for (const [sq,votos] of votosPorCand){
  const m=cadastro.get(sq); if(!m)continue;
  const dobra=m.mulher||m.negro;
  let comDobro=votos;
  if(dobra) comDobro = DOBRO_NAO_QUADRUPLICA ? votos*2 : ((m.mulher&&m.negro)?votos*4:votos*2);
  const o=porPart.get(m.partido)||{dobro:0,legenda:0}; o.dobro+=comDobro; porPart.set(m.partido,o);
}
for(const [k,v] of legendaPorPart){ const o=porPart.get(k)||{dobro:0,legenda:0}; o.legenda+=v; porPart.set(k,o); }

const temAcesso = k => OFICIAL_35[k] !== undefined && OFICIAL_35[k] > 0;
const baseDe = o => o.dobro + (INCLUIR_LEGENDA_NA_BASE ? o.legenda : 0);

let totalBase=0;
for(const [k,o] of porPart){ if(!RESTRINGIR_A_PARTIDOS_COM_ACESSO || temAcesso(k)) totalBase += baseDe(o); }

const brl=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const linhas=[];
const chaves = new Set([...Object.keys(OFICIAL_35), ...porPart.keys()]);
for(const k of chaves){
  const oficial = OFICIAL_35[k] || 0;
  const o = porPart.get(k) || {dobro:0,legenda:0};
  const incluido = !RESTRINGIR_A_PARTIDOS_COM_ACESSO || temAcesso(k);
  const meu = (incluido && totalBase>0) ? POOL_35*baseDe(o)/totalBase : 0;
  linhas.push({k, meu, oficial, dif: meu-oficial, pct: oficial>0 ? (meu-oficial)/oficial*100 : null});
}
linhas.sort((a,b)=>b.oficial-a.oficial);

console.log('Chaves: negroIncluiParda='+NEGRO_INCLUI_PARDA+', naoQuadruplica='+DOBRO_NAO_QUADRUPLICA+', incluiLegenda='+INCLUIR_LEGENDA_NA_BASE+', agregaFederacao='+AGREGAR_FEDERACAO+', restringeAcesso='+RESTRINGIR_A_PARTIDOS_COM_ACESSO);
console.log('\nPARTIDO | meu 35% | oficial 35% | diferenca | erro %');
for(const r of linhas){
  if(r.oficial===0 && r.meu===0) continue;
  console.log(r.k+' | '+brl(r.meu)+' | '+brl(r.oficial)+' | '+brl(r.dif)+' | '+(r.pct===null?'-':r.pct.toFixed(2)+'%'));
}
const somaMeu=linhas.reduce((s,r)=>s+r.meu,0);
const somaOf=linhas.reduce((s,r)=>s+r.oficial,0);
const maiorErro=linhas.filter(r=>r.pct!==null).reduce((m,r)=>Math.abs(r.pct)>Math.abs(m.pct)?r:m,{pct:0,k:''});
console.log('\nSoma minha: '+brl(somaMeu)+' | Soma oficial: '+brl(somaOf));
console.log('Maior erro percentual: '+maiorErro.k+' '+(maiorErro.pct||0).toFixed(2)+'%');
