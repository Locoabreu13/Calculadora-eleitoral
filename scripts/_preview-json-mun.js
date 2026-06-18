'use strict';
/**
 * Gera PRÉVIA do JSON de um município/Vereador com candidatos, na saída padrão.
 * NÃO grava nenhum arquivo.
 * Uso: node scripts/_preview-json-mun.js <ano> <UF> <CD_MUNICIPIO> <vagas>
 * Ex:  node scripts/_preview-json-mun.js 2024 MA 8893 21
 */
const https = require('https');
const http  = require('http');
const zlib  = require('zlib');

const ANO    = process.argv[2] || '2024';
const UF     = (process.argv[3] || 'MA').toUpperCase();
const CD_MUN = process.argv[4] || '8893';
const VAGAS  = parseInt(process.argv[5] || '21', 10);

const URL_PART = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_${ANO}.zip`;
const URL_CAND = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_${ANO}.zip`;

const CARGO_MAP = { 'VEREADOR': 'Vereador', 'DEPUTADO FEDERAL': 'Deputado Federal', 'DEPUTADO ESTADUAL': 'Deputado Estadual', 'DEPUTADO DISTRITAL': 'Deputado Distrital' };

/* ── Download ─────────────────────────────────────────────────────────────── */
function baixar(url, label) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const chunks = [];
    let received = 0, total = 0, lastPct = -1;
    function req(u) {
      proto.get(u, { headers: { 'User-Agent': 'preview-json-mun/2.0' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return req(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} — ${u}`));
        total = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', chunk => {
          chunks.push(chunk);
          received += chunk.length;
          const pct = total ? Math.round(received / total * 100) : -1;
          if (pct !== lastPct) {
            lastPct = pct;
            process.stderr.write(`\r  [${label}] ↓ ${(received/1048576).toFixed(1)}/${total?(total/1048576).toFixed(1):'?'} MB${pct>=0?` (${pct}%)`:''}   `);
          }
        });
        res.on('end', () => { process.stderr.write('\n'); resolve(Buffer.concat(chunks)); });
        res.on('error', reject);
      }).on('error', reject);
    }
    req(url);
  });
}

/* ── ZIP ──────────────────────────────────────────────────────────────────── */
function parsearCD(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('EOCD não encontrado');
  const num = buf.readUInt16LE(eocd + 10);
  let pos   = buf.readUInt32LE(eocd + 16);
  const entradas = [];
  for (let i = 0; i < num; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const comp = buf.readUInt16LE(pos + 10), tc = buf.readUInt32LE(pos + 20);
    const nl = buf.readUInt16LE(pos + 28), el = buf.readUInt16LE(pos + 30), cl = buf.readUInt16LE(pos + 32);
    const off = buf.readUInt32LE(pos + 42);
    const nome = buf.slice(pos + 46, pos + 46 + nl).toString('utf8');
    entradas.push({ nome, comp, tc, off });
    pos += 46 + nl + el + cl;
  }
  return entradas;
}

function extrair(buf, e) {
  const p = e.off;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('LFH inválido');
  const fn = buf.readUInt16LE(p + 26), ex = buf.readUInt16LE(p + 28);
  const inicio = p + 30 + fn + ex;
  const raw = buf.slice(inicio, inicio + e.tc);
  if (e.comp === 0) return raw;
  if (e.comp === 8) return zlib.inflateRawSync(raw, { maxOutputLength: 512 * 1024 * 1024 });
  throw new Error(`Compressão desconhecida: ${e.comp}`);
}

function encontrarUF(entradas, uf) {
  return entradas.find(e => new RegExp(`_${uf}\\.csv$`, 'i').test(e.nome));
}

function split(l) { return l.split(';').map(c => c.trim().replace(/^"|"$/g, '')); }

/* ── Parse CSV de partidos (por município) ────────────────────────────────── */
function parsearPartidos(texto, cdMun) {
  const linhas = texto.split(/\r?\n/);
  const header = split(linhas[0]);
  const col = n => header.indexOf(n);

  const cCd    = col('CD_MUNICIPIO');
  const cNmMun = col('NM_MUNICIPIO');
  const cCargo = col('DS_CARGO');
  const cSigla = col('SG_PARTIDO');
  const cNome  = col('NM_PARTIDO');
  const cNom   = col('QT_VOTOS_NOMINAIS_VALIDOS') >= 0 ? col('QT_VOTOS_NOMINAIS_VALIDOS') : col('QT_VOTOS_NOMINAIS');
  const cLeg   = col('QT_TOTAL_VOTOS_LEG_VALIDOS') >= 0 ? col('QT_TOTAL_VOTOS_LEG_VALIDOS')
                 : col('QT_VOTOS_LEGENDA_VALIDOS') >= 0  ? col('QT_VOTOS_LEGENDA_VALIDOS')
                 : col('QT_VOTOS_LEGENDA');
  const cSgFed = col('SG_FEDERACAO');
  const cNmFed = col('NM_FEDERACAO');

  let nmMunicipio = '';
  const entidades = {};

  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;
    const cols = split(l);
    if (cols.length < 5) continue;
    if (cols[cCd] !== cdMun) continue;
    if (CARGO_MAP[(cols[cCargo] || '').trim().toUpperCase()] !== 'Vereador') continue;
    if (!nmMunicipio) nmMunicipio = cols[cNmMun] || '';

    const sigla = cols[cSigla] || '';
    const nome  = cols[cNome]  || sigla;
    const nom   = parseInt(cols[cNom] || '0', 10) || 0;
    const leg   = parseInt(cols[cLeg] || '0', 10) || 0;
    const sgFed = (cols[cSgFed] || '').trim();
    const nmFed = (cols[cNmFed] || '').trim();
    const emFed = sgFed && sgFed !== '#NULO#' && sgFed !== '-1';
    const chave = emFed ? sgFed : sigla;
    const nomeEnt = emFed ? nmFed : nome;

    if (!entidades[chave]) {
      entidades[chave] = { sigla: chave, nome: nomeEnt, votosNominais: 0, votosLegenda: 0 };
      if (emFed) entidades[chave].partidos = [];
    }
    entidades[chave].votosNominais += nom;
    entidades[chave].votosLegenda  += leg;
    if (emFed && !entidades[chave].partidos.includes(sigla))
      entidades[chave].partidos.push(sigla);
  }

  return { nmMunicipio, entidades };
}

/* ── Parse CSV de candidatos (por município) ──────────────────────────────── */
function parsearCandidatos(texto, uf, cdMun, entidades) {
  // Monta mapa partido → sigla do bloco (federação ou próprio partido)
  const mapaFederacao = {};
  for (const [chave, e] of Object.entries(entidades)) {
    if (e.partidos) {
      for (const p of e.partidos) mapaFederacao[p] = chave;
    } else {
      mapaFederacao[e.sigla] = e.sigla;
    }
  }

  const linhas = texto.split(/\r?\n/);
  const header = split(linhas[0]);
  const col = n => header.indexOf(n);

  const cCargo  = col('DS_CARGO');
  const cUF     = col('SG_UF');
  const cCd     = col('CD_MUNICIPIO');
  const cNome   = col('NM_CANDIDATO');
  const cNum    = col('NR_CANDIDATO');
  const cSigla  = col('SG_PARTIDO');
  const cVotos  = col('QT_VOTOS_NOMINAIS_VALIDOS') >= 0 ? col('QT_VOTOS_NOMINAIS_VALIDOS') : col('QT_VOTOS_NOMINAIS');

  if (cNome < 0 || cSigla < 0 || cVotos < 0)
    throw new Error(`Colunas obrigatórias ausentes no CSV de candidatos. Header: ${header.slice(0,10).join(' | ')}`);

  const porBloco = {};
  let nProc = 0, nIgn = 0;

  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;
    const cols = split(l);
    if (cols.length < 5) { nIgn++; continue; }
    if (cUF >= 0 && (cols[cUF] || '').trim().toUpperCase() !== uf) { nIgn++; continue; }
    if (cCd >= 0 && cols[cCd] !== cdMun) { nIgn++; continue; }
    if (CARGO_MAP[(cols[cCargo] || '').trim().toUpperCase()] !== 'Vereador') { nIgn++; continue; }

    const siglaPartido = (cols[cSigla] || '').trim();
    const nomeCand     = (cols[cNome]  || '').trim();
    const numCand      = cNum >= 0 ? (cols[cNum] || '').trim() : '';
    const votos        = parseInt(cols[cVotos] || '0', 10) || 0;
    if (!siglaPartido || !nomeCand) { nIgn++; continue; }

    const blocoKey = mapaFederacao[siglaPartido] || siglaPartido;
    if (!porBloco[blocoKey]) porBloco[blocoKey] = {};
    const chave = `${numCand}_${nomeCand}`;
    if (!porBloco[blocoKey][chave]) {
      porBloco[blocoKey][chave] = { nome: nomeCand, votos: 0, partido: siglaPartido };
    }
    porBloco[blocoKey][chave].votos += votos;
    nProc++;
  }

  process.stderr.write(`    candidatos: ${nProc} linhas úteis, ${nIgn} ignoradas\n`);

  const resultado = {};
  for (const [bloco, cands] of Object.entries(porBloco)) {
    resultado[bloco] = Object.values(cands).sort((a, b) => b.votos - a.votos);
  }
  return resultado;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
(async () => {
  // ── 1. Partidos ────────────────────────────────────────────────────────────
  process.stderr.write(`\n[1/2] Baixando dados de partidos...\n`);
  process.stderr.write(`  URL: ${URL_PART}\n`);
  const zipPart = await baixar(URL_PART, 'partidos');
  process.stderr.write(`  ZIP: ${(zipPart.length/1048576).toFixed(1)} MB\n`);

  const entPart = parsearCD(zipPart);
  const alvoPart = encontrarUF(entPart, UF);
  if (!alvoPart) throw new Error(`CSV de partidos para ${UF} não encontrado`);
  process.stderr.write(`  Entrada: ${alvoPart.nome}\n`);

  const rawPart = extrair(zipPart, alvoPart);
  const { nmMunicipio, entidades } = parsearPartidos(rawPart.toString('latin1'), CD_MUN);
  process.stderr.write(`  Município: ${nmMunicipio} (CD ${CD_MUN}) — ${Object.keys(entidades).length} entidades\n`);

  // ── 2. Candidatos ──────────────────────────────────────────────────────────
  process.stderr.write(`\n[2/2] Baixando dados de candidatos...\n`);
  process.stderr.write(`  URL: ${URL_CAND}\n`);
  const zipCand = await baixar(URL_CAND, 'cand.');
  process.stderr.write(`  ZIP: ${(zipCand.length/1048576).toFixed(1)} MB\n`);

  const entCand = parsearCD(zipCand);
  const alvoCand = encontrarUF(entCand, UF);
  if (!alvoCand) throw new Error(`CSV de candidatos para ${UF} não encontrado`);
  process.stderr.write(`  Entrada: ${alvoCand.nome}\n`);

  const rawCand = extrair(zipCand, alvoCand);
  const candidatosPorBloco = parsearCandidatos(rawCand.toString('latin1'), UF, CD_MUN, entidades);

  // ── 3. Montar lista final e verificar margem zero ──────────────────────────
  const partidos = Object.values(entidades)
    .sort((a, b) => (b.votosNominais + b.votosLegenda) - (a.votosNominais + a.votosLegenda))
    .map(e => {
      const obj = {
        sigla:         e.sigla,
        nome:          e.nome,
        votosNominais: e.votosNominais,
        votosLegenda:  e.votosLegenda,
        candidatos:    candidatosPorBloco[e.sigla] || [],
      };
      if (e.partidos) obj.partidos = e.partidos;
      return obj;
    });

  const totalVotos = partidos.reduce((s, p) => s + p.votosNominais + p.votosLegenda, 0);
  const qeExato   = totalVotos / VAGAS;
  const qeFrac    = qeExato - Math.floor(qeExato);
  const qe        = qeFrac > 0.5 ? Math.ceil(qeExato) : Math.floor(qeExato);

  // Margem zero
  process.stderr.write(`\n=== VERIFICAÇÃO DE MARGEM ZERO (soma candidatos vs votosNominais) ===\n`);
  let todasOk = true;
  for (const p of partidos) {
    const somaCands = p.candidatos.reduce((s, c) => s + c.votos, 0);
    const diff = somaCands - p.votosNominais;
    const status = diff === 0 ? 'OK' : `DIVERGÊNCIA ${diff > 0 ? '+' : ''}${diff}`;
    const flag = diff !== 0 ? ' <<<' : '';
    process.stderr.write(`  ${p.sigla.padEnd(20)} votos nominais: ${String(p.votosNominais).padStart(6)}  soma candidatos: ${String(somaCands).padStart(6)}  diff: ${String(diff).padStart(4)}  ${status}${flag}\n`);
    if (diff !== 0) todasOk = false;
  }
  process.stderr.write(todasOk
    ? `\n  ✓ Margem zero confirmada em todas as ${partidos.length} entidades.\n`
    : `\n  ✗ DIVERGÊNCIAS ENCONTRADAS — revisar antes de gravar.\n`
  );

  process.stderr.write(`\nTotal votos válidos: ${totalVotos.toLocaleString('pt-BR')}\n`);
  process.stderr.write(`QE: ${totalVotos} ÷ ${VAGAS} = ${qeExato.toFixed(6)} → fração ${qeFrac.toFixed(6)} ${qeFrac>0.5?'> 0,5 (arredonda)':'≤ 0,5 (despreza)'} → QE = ${qe}\n`);
  process.stderr.write(`\n=== PRÉVIA DO JSON — NÃO foi gravado nenhum arquivo ===\n\n`);

  const json = {
    meta: {
      ano:         ANO,
      uf:          UF,
      cargo:       'Vereador',
      municipio:   nmMunicipio,
      cdMunicipio: CD_MUN,
      vagas:       VAGAS,
      gerado:      new Date().toISOString(),
    },
    partidos,
  };

  process.stdout.write(JSON.stringify(json, null, 4) + '\n');
})().catch(e => { process.stderr.write(`ERRO: ${e.message}\n${e.stack}\n`); process.exit(1); });
