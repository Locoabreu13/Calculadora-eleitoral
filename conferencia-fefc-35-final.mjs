import fs from 'node:fs';
import readline from 'node:readline';

const NEGRO_INCLUI_PARDA = true;
const USAR_LEGENDA = true;            // alterne para false para ver o antes
const RESTRINGIR_A_PARTIDOS_COM_ACESSO = true;
const POOL_35 = 1736531921.95;

const OFICIAL_35 = {
  'AGIR':0,'AVANTE':36712593.53,'CIDADANIA':24466689.24,'DC':0,'DEMOCRATA':0,
  'MDB':123663898.73,'MISSAO':0,'MOBILIZA':0,'NOVO':19809450.35,'PC DO B':24727730.59,
  'PCB':0,'PCO':0,'PDT':64136242.33,'PL':285578750.45,'PODE':85498933.00,
  'PP':140441249.79,'PRD':45299759.09,'PRTB':0,'PSB':70121911.34,'PSD':121653706.77,
  'PSDB':47484844.28,'PSOL':67847954.65,'PSTU':0,'PT':213687981.41,'PV':14022047.29,
  'REDE':14023426.22,'REPUBLICANOS':127379472.03,'SOLIDARIEDADE':43534486.59,
  'UNIAO':166440794.28,'UP':0,
};

const REMAP = { 'PATRIOTA':'PRD','PTB':'PRD','PROS':'SOLIDARIEDADE','PSC':'PODE','PMN':'MOBILIZA','PMB':'MISSAO' };
const semAcento = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const canon = s => { const u=semAcento(s); return REMAP[u]||u; };
const partes = l => l.split(';').map(c=>c.replace(/^"|"$/g,''));
const achar = c => { for(const p of c) if(fs.existsSync(p)) return p; return null; };

const CAD = achar(['./cache/consulta_cand_2022/consulta_cand_2022_BRASIL.csv','./cache/consulta_cand_2022_BRASIL.csv']);
const VOTC = achar(['./cache/votacao_candidato_munzona_2022/votacao_candidato_munzona_2022_BRASIL.csv','./cache/votacao_candidato_munzona_2022_BRASIL.csv']);
const VOTP = achar(['./cache/votacao_partido_munzona_2022/votacao_partido_munzona_2022_BRASIL.csv','./cache/votacao_partido_munzona_2022_BRASIL.csv']);
if(!CAD||!VOTC||!VOTP){ console.error('CSV faltando.'); process.exit(1); }

// cadastro: genero e raca por candidato
const cadastro = new Map();
{
  const linhas = fs.readFileSync(CAD,'latin1').split(/\r?\n/);
  const cab=partes(linhas[0]); const i=n=>cab.indexOf(n);
  const iCargo=i('DS_CARGO'),iSq=i('SQ_CANDIDATO'),iGen=i('DS_GENERO'),iRaca=i('DS_COR_RACA'),iPart=i('SG_PARTIDO');
  for(let k=1;k<linhas.length;k++){ if(!linhas[k])continue; const c=partes(linhas[k]);
    if(!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL'))continue;
    cadastro.set(c[iSq],{ mulher:semAcento(c[iGen])==='FEMININO',
      negro: semAcento(c[iRaca])==='PRETA'||(NEGRO_INCLUI_PARDA&&semAcento(c[iRaca])==='PARDA'),
      partido:canon(c[iPart]) }); }
}

// nominal em dobro, por candidato, agregado por partido
const dobroPart = new Map();
await new Promise((res,rej)=>{
  const rl=readline.createInterface({input:fs.createReadStream(VOTC,{encoding:'latin1'})});
  let cab=null,iCargo,iSq,iVotos,iDest;
  rl.on('line',l=>{
    if(!cab){cab=partes(l);const i=n=>cab.indexOf(n);iCargo=i('DS_CARGO');iSq=i('SQ_CANDIDATO');iVotos=i('QT_VOTOS_NOMINAIS');iDest=i('NM_TIPO_DESTINACAO_VOTOS');return;}
    if(!l)return; const c=partes(l);
    if(!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL'))return;
    const d=semAcento(c[iDest]); if(!d.startsWith('VALIDO')||d.includes('LEGENDA'))return;
    const m=cadastro.get(c[iSq]); if(!m)return;
    const votos=parseInt(c[iVotos]||'0',10)||0;
    const comDobro=(m.mulher||m.negro)?votos*2:votos;
    dobroPart.set(m.partido,(dobroPart.get(m.partido)||0)+comDobro);
  });
  rl.on('close',res); rl.on('error',rej);
});

// legenda valida, por partido
const legPart = new Map();
await new Promise((res,rej)=>{
  const rl=readline.createInterface({input:fs.createReadStream(VOTP,{encoding:'latin1'})});
  let cab=null,iCargo,iPart,iLeg;
  rl.on('line',l=>{
    if(!cab){cab=partes(l);const i=n=>cab.indexOf(n);iCargo=i('DS_CARGO');iPart=i('SG_PARTIDO');iLeg=i('QT_VOTOS_LEGENDA_VALIDOS');return;}
    if(!l)return; const c=partes(l);
    if(!semAcento(c[iCargo]).includes('DEPUTADO FEDERAL'))return;
    const k=canon(c[iPart]); const v=parseInt(c[iLeg]||'0',10)||0;
    legPart.set(k,(legPart.get(k)||0)+v);
  });
  rl.on('close',res); rl.on('error',rej);
});

const temAcesso = k => OFICIAL_35[k]!==undefined && OFICIAL_35[k]>0;
const baseDe = k => (dobroPart.get(k)||0) + (USAR_LEGENDA?(legPart.get(k)||0):0);

let totalBase=0;
const chaves=new Set([...Object.keys(OFICIAL_35),...dobroPart.keys(),...legPart.keys()]);
for(const k of chaves){ if(!RESTRINGIR_A_PARTIDOS_COM_ACESSO||temAcesso(k)) totalBase+=baseDe(k); }

const brl=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const linhas=[];
for(const k of chaves){
  const oficial=OFICIAL_35[k]||0;
  const incl=!RESTRINGIR_A_PARTIDOS_COM_ACESSO||temAcesso(k);
  const meu=(incl&&totalBase>0)?POOL_35*baseDe(k)/totalBase:0;
  linhas.push({k,dobro:dobroPart.get(k)||0,leg:legPart.get(k)||0,meu,oficial,pct:oficial>0?(meu-oficial)/oficial*100:null});
}
linhas.sort((a,b)=>b.oficial-a.oficial);

console.log('USAR_LEGENDA='+USAR_LEGENDA+', restringeAcesso='+RESTRINGIR_A_PARTIDOS_COM_ACESSO);
console.log('\nPARTIDO | nominal dobro | legenda | meu 35% | oficial 35% | erro %');
for(const r of linhas){ if(r.oficial===0&&r.meu===0)continue;
  console.log(r.k+' | '+r.dobro+' | '+r.leg+' | '+brl(r.meu)+' | '+brl(r.oficial)+' | '+(r.pct===null?'-':r.pct.toFixed(2)+'%')); }
const piores=linhas.filter(r=>r.pct!==null).sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,3);
console.log('\nTres maiores erros: '+piores.map(r=>r.k+' '+r.pct.toFixed(2)+'%').join(' | '));
console.log('Soma minha: '+brl(linhas.reduce((s,r)=>s+r.meu,0)));

const jsonVotos = {};
for (const k of chaves) {
  const v = baseDe(k);
  if (v > 0) {
    jsonVotos[k] = v;
  }
}
console.log('\n=== JSON PARA CASCATA-REFERENCIA ===');
console.log(JSON.stringify(jsonVotos, null, 2));
