'use strict';
/**
 * Cruza os dados de legenda de três fontes para São José de Ribamar / Vereador:
 *   1. CSV de candidatos (votacao_candidato_munzona_2024)
 *   2. CSV de partidos   (votacao_partido_munzona_2024)
 *   3. JSON salvo        (data/tse/2024_MA_8893_vereador.json)
 * Saída: tabela comparativa. Sem gravar nada.
 */
const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const path  = require('path');
const fs    = require('fs');

const ANO    = '2024';
const UF     = 'MA';
const CD_MUN = '8893';

const URL_PART = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_${ANO}.zip`;
const URL_CAND = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_${ANO}.zip`;

function baixar(url, label) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const chunks = [];
    let received = 0, total = 0, lastPct = -1;
    function req(u) {
      proto.get(u, { headers: { 'User-Agent': 'cruzar-legenda/1.0' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return req(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        total = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', chunk => {
          chunks.push(chunk);
          received += chunk.length;
          const pct = total ? Math.round(received / total * 100) : -1;
          if (pct !== lastPct) { lastPct = pct; process.stderr.write(`\r  [${label}] ${(received/1048576).toFixed(1)}/${total?(total/1048576).toFixed(1):'?'} MB${pct>=0?` (${pct}%)`:''}   `); }
        });
        res.on('end', () => { process.stderr.write('\n'); resolve(Buffer.concat(chunks)); });
        res.on('error', reject);
      }).on('error', reject);
    }
    req(url);
  });
}

function parsearCD(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('EOCD não encontrado');
  const num = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
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
  const raw = buf.slice(p + 30 + fn + ex, p + 30 + fn + ex + e.tc);
  if (e.comp === 0) return raw;
  if (e.comp === 8) return zlib.inflateRawSync(raw, { maxOutputLength: 512 * 1024 * 1024 });
  throw new Error(`Compressão desconhecida: ${e.comp}`);
}

function encontrarUF(entradas, uf) {
  return entradas.find(e => new RegExp(`_${uf}\\.csv$`, 'i').test(e.nome));
}

function split(l) { return l.split(';').map(c => c.trim().replace(/^"|"$/g, '')); }

(async () => {
  // ── 1. CSV de partidos ─────────────────────────────────────────────────────
  process.stderr.write(`\n[1/2] CSV de PARTIDOS\n`);
  const zipPart = await baixar(URL_PART, 'partidos');
  const entPart = parsearCD(zipPart);
  const alvoPart = encontrarUF(entPart, UF);
  const rawPart = extrair(zipPart, alvoPart).toString('latin1');

  const linhasPart = rawPart.split(/\r?\n/);
  const hdrPart = split(linhasPart[0]);
  const colP = n => hdrPart.indexOf(n);

  const cCdP   = colP('CD_MUNICIPIO');
  const cCargP = colP('DS_CARGO');
  const cSiglP = colP('SG_PARTIDO');
  const cFedP  = colP('SG_FEDERACAO');
  const cLegP  = colP('QT_VOTOS_LEGENDA_VALIDOS');
  const cConvP = colP('QT_VOTOS_NOM_CONVR_LEG_VALIDOS');
  const cTlegP = colP('QT_TOTAL_VOTOS_LEG_VALIDOS');
  const cNomP  = colP('QT_VOTOS_NOMINAIS_VALIDOS');

  // legenda pura, conversão e total por bloco (federação ou partido)
  const legPartido = {}; // siglaBloco → { legPura, conv, tleg, nom }

  for (let i = 1; i < linhasPart.length; i++) {
    const l = linhasPart[i].trim(); if (!l) continue;
    const cols = split(l);
    if (cols[cCdP] !== CD_MUN) continue;
    if ((cols[cCargP] || '').trim().toUpperCase() !== 'VEREADOR') continue;
    const sigla = cols[cSiglP] || '';
    const fed   = (cols[cFedP] || '').trim();
    const bloco = (fed && fed !== '#NULO#' && fed !== '-1') ? fed : sigla;
    const legPura = parseInt(cols[cLegP] || '0', 10) || 0;
    const conv    = parseInt(cols[cConvP] || '0', 10) || 0;
    const tleg    = parseInt(cols[cTlegP] || '0', 10) || 0;
    const nom     = parseInt(cols[cNomP]  || '0', 10) || 0;
    if (!legPartido[bloco]) legPartido[bloco] = { legPura: 0, conv: 0, tleg: 0, nom: 0 };
    legPartido[bloco].legPura += legPura;
    legPartido[bloco].conv    += conv;
    legPartido[bloco].tleg    += tleg;
    legPartido[bloco].nom     += nom;
  }

  // ── 2. CSV de candidatos ────────────────────────────────────────────────────
  process.stderr.write(`\n[2/2] CSV de CANDIDATOS\n`);
  const zipCand = await baixar(URL_CAND, 'cand.');
  const entCand = parsearCD(zipCand);
  const alvoCand = encontrarUF(entCand, UF);
  const rawCand = extrair(zipCand, alvoCand).toString('latin1');

  const linhasCand = rawCand.split(/\r?\n/);
  const hdrCand = split(linhasCand[0]);
  const colC = n => hdrCand.indexOf(n);

  // Mostrar cabeçalho completo pra identificar se há coluna de legenda
  process.stderr.write(`\nColunas do CSV de CANDIDATOS:\n`);
  hdrCand.forEach((c, i) => process.stderr.write(`  [${i}] ${c}\n`));

  const cCdC   = colC('CD_MUNICIPIO');
  const cCargC = colC('DS_CARGO');
  const cSiglC = colC('SG_PARTIDO');
  const cFedC  = colC('SG_FEDERACAO');
  const cNomC  = colC('QT_VOTOS_NOMINAIS_VALIDOS') >= 0 ? colC('QT_VOTOS_NOMINAIS_VALIDOS') : colC('QT_VOTOS_NOMINAIS');
  const cLegC  = colC('QT_VOTOS_LEGENDA_VALIDOS');       // pode não existir no arq. candidatos
  const cConvC = colC('QT_VOTOS_NOM_CONVR_LEG_VALIDOS');
  const cTlegC = colC('QT_TOTAL_VOTOS_LEG_VALIDOS');

  process.stderr.write(`\nColunas de legenda no CSV de candidatos:\n`);
  process.stderr.write(`  QT_VOTOS_LEGENDA_VALIDOS        → índice ${cLegC}\n`);
  process.stderr.write(`  QT_VOTOS_NOM_CONVR_LEG_VALIDOS  → índice ${cConvC}\n`);
  process.stderr.write(`  QT_TOTAL_VOTOS_LEG_VALIDOS       → índice ${cTlegC}\n`);

  const legCand = {}; // siglaBloco → { legPura, conv, tleg, nomSoma }

  for (let i = 1; i < linhasCand.length; i++) {
    const l = linhasCand[i].trim(); if (!l) continue;
    const cols = split(l);
    if (cCdC >= 0 && cols[cCdC] !== CD_MUN) continue;
    if ((cols[cCargC] || '').trim().toUpperCase() !== 'VEREADOR') continue;
    const sigla = (cols[cSiglC] || '').trim();
    const fed   = cFedC >= 0 ? (cols[cFedC] || '').trim() : '';
    const bloco = (fed && fed !== '#NULO#' && fed !== '-1') ? fed : sigla;
    const nom   = parseInt(cols[cNomC]  || '0', 10) || 0;
    const legP  = cLegC  >= 0 ? (parseInt(cols[cLegC]  || '0', 10) || 0) : 0;
    const conv  = cConvC >= 0 ? (parseInt(cols[cConvC] || '0', 10) || 0) : 0;
    const tleg  = cTlegC >= 0 ? (parseInt(cols[cTlegC] || '0', 10) || 0) : 0;
    if (!legCand[bloco]) legCand[bloco] = { legPura: 0, conv: 0, tleg: 0, nomSoma: 0 };
    legCand[bloco].legPura  += legP;
    legCand[bloco].conv     += conv;
    legCand[bloco].tleg     += tleg;
    legCand[bloco].nomSoma  += nom;
  }

  // ── 3. JSON salvo ───────────────────────────────────────────────────────────
  const jsonPath = path.join(__dirname, '..', 'data', 'tse', '2024_MA_8893_vereador.json');
  const jsonSalvo = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const legJSON = {};
  for (const p of jsonSalvo.partidos) legJSON[p.sigla] = p.votosLegenda;

  // ── 4. Tabela comparativa ───────────────────────────────────────────────────
  const blocos = [...new Set([...Object.keys(legPartido), ...Object.keys(legCand), ...Object.keys(legJSON)])].sort();

  console.log('\n=== TABELA COMPARATIVA — LEGENDA por entidade ===');
  console.log('(PART = CSV partidos · legenda pura | CONV = nominais convertidos em legenda | TLEG = legPura+conv)');
  console.log('(CAND = CSV candidatos · colunas de legenda se existirem)');
  console.log('(JSON = nosso arquivo · votosLegenda = QT_TOTAL_VOTOS_LEG_VALIDOS do CSV partidos)');
  console.log('');
  console.log(`${'ENTIDADE'.padEnd(22)} | ${'PART_legPura'.padStart(12)} | ${'PART_conv'.padStart(9)} | ${'PART_tleg'.padStart(9)} | ${'CAND_tleg'.padStart(9)} | ${'JSON_leg'.padStart(8)} | BATE?`);
  console.log('-'.repeat(100));

  let todasBatem = true;
  for (const b of blocos) {
    const p = legPartido[b] || { legPura: 0, conv: 0, tleg: 0 };
    const c = legCand[b]    || { legPura: 0, conv: 0, tleg: 0 };
    const j = legJSON[b]    !== undefined ? legJSON[b] : '—';
    const jNum = legJSON[b] !== undefined ? legJSON[b] : null;
    const bate = jNum !== null ? (p.tleg === jNum ? 'SIM' : `NÃO (diff ${jNum - p.tleg})`) : '—';
    if (jNum !== null && p.tleg !== jNum) todasBatem = false;
    console.log(`${b.padEnd(22)} | ${String(p.legPura).padStart(12)} | ${String(p.conv).padStart(9)} | ${String(p.tleg).padStart(9)} | ${String(c.tleg).padStart(9)} | ${String(j).padStart(8)} | ${bate}`);
  }

  console.log('-'.repeat(100));
  console.log(todasBatem
    ? '\n✓ JSON_leg == PART_tleg em todas as entidades.'
    : '\n✗ Há divergências entre JSON_leg e PART_tleg.');

  // Nota sobre CAND_tleg
  const temLegCand = cTlegC >= 0;
  console.log(`\nNota: CSV de candidatos ${temLegCand ? 'TEM' : 'NÃO TEM'} coluna QT_TOTAL_VOTOS_LEG_VALIDOS (índice ${cTlegC}).`);
  if (!temLegCand) console.log('  → Legenda oficial vem apenas do CSV de partidos.');

})().catch(e => { process.stderr.write(`ERRO: ${e.message}\n${e.stack}\n`); process.exit(1); });
