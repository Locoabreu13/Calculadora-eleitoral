'use strict';
const https = require('https');
const http  = require('http');
const zlib  = require('zlib');

const ANO = process.argv[2] || '2024';
const UF  = (process.argv[3] || 'MA').toUpperCase();
const MUN_ALVO = (process.argv[4] || '').toUpperCase(); // ex: "RIBAMAR" ou "8893"
const VAGAS = parseInt(process.argv[5] || '21', 10);
const URL = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_${ANO}.zip`;

function baixar(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const chunks = [];
    let received = 0, total = 0, lastPct = -1;
    function req(u) {
      proto.get(u, { headers: { 'User-Agent': 'inspecionar-csv/1.0' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return req(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        total = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', chunk => {
          chunks.push(chunk);
          received += chunk.length;
          const pct = total ? Math.round(received / total * 100) : -1;
          if (pct !== lastPct) {
            lastPct = pct;
            process.stderr.write(`\r  ↓ ${(received/1048576).toFixed(1)}/${total?(total/1048576).toFixed(1):'?'} MB${pct>=0?` (${pct}%)`:''}   `);
          }
        });
        res.on('end', () => { process.stderr.write('\n'); resolve(Buffer.concat(chunks)); });
        res.on('error', reject);
      }).on('error', reject);
    }
    req(url);
  });
}

function parsearCD(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--)
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  if (eocd < 0) throw new Error('EOCD não encontrado');
  const num = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const entradas = [];
  for (let i = 0; i < num; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const comp = buf.readUInt16LE(pos + 10);
    const tc   = buf.readUInt32LE(pos + 20);
    const to   = buf.readUInt32LE(pos + 24);
    const nl   = buf.readUInt16LE(pos + 28);
    const el   = buf.readUInt16LE(pos + 30);
    const cl   = buf.readUInt16LE(pos + 32);
    const off  = buf.readUInt32LE(pos + 42);
    const nome = buf.slice(pos + 46, pos + 46 + nl).toString('utf8');
    entradas.push({ nome, comp, tc, to, off });
    pos += 46 + nl + el + cl;
  }
  return entradas;
}

function extrair(buf, e) {
  const p = e.off;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('LFH inválido');
  const fn = buf.readUInt16LE(p + 26);
  const ex = buf.readUInt16LE(p + 28);
  const inicio = p + 30 + fn + ex;
  const raw = buf.slice(inicio, inicio + e.tc);
  if (e.comp === 0) return raw;
  if (e.comp === 8) return zlib.inflateRawSync(raw);
  throw new Error(`Compressão desconhecida: ${e.comp}`);
}

function parsearCSV(texto) {
  // Remove BOM se presente
  const s = texto.startsWith('﻿') ? texto.slice(1) : texto;
  const linhas = s.split('\n').filter(l => l.trim());
  const cabecalho = linhas[0].split(';').map(c => c.replace(/^"|"$/g, '').trim());
  const idx = {};
  cabecalho.forEach((c, i) => idx[c] = i);

  const campo = (linha, nome) => {
    const partes = linha.split(';');
    const v = partes[idx[nome]] || '';
    return v.replace(/^"|"$/g, '').trim();
  };

  return { linhas: linhas.slice(1), campo, cabecalho, idx };
}

(async () => {
  process.stderr.write(`Baixando ${URL}\n`);
  const zip = await baixar(URL);
  process.stderr.write(`ZIP: ${(zip.length/1048576).toFixed(1)} MB\n`);

  const entradas = parsearCD(zip);
  const alvo = entradas.find(e => e.nome.toUpperCase().includes(`_${UF}.CSV`) || e.nome.toUpperCase().endsWith(`${UF}.CSV`));
  if (!alvo) {
    process.stderr.write(`Entradas no ZIP:\n`);
    entradas.forEach(e => process.stderr.write(`  ${e.nome}\n`));
    throw new Error(`CSV do ${UF} não encontrado`);
  }
  process.stderr.write(`Entrada: ${alvo.nome}\n`);

  const raw = extrair(zip, alvo);
  const texto = raw.toString('latin1');
  const { linhas, campo } = parsearCSV(texto);

  // ── Filtrar: município alvo (por CD_MUNICIPIO para evitar problema de acentos) + Vereador ──
  // MUN_ALVO pode ser o código numérico (ex: "8893") ou parte do nome sem acento
  const linhasFiltradas = linhas.filter(l => {
    const cd = campo(l, 'CD_MUNICIPIO');
    const ds = campo(l, 'DS_CARGO').toUpperCase();
    const munOk = MUN_ALVO ? cd === MUN_ALVO : cd === '8893';
    return munOk && ds === 'VEREADOR';
  });

  // ── Zonas encontradas ──────────────────────────────────────────────────────
  const zonas = [...new Set(linhasFiltradas.map(l => campo(l, 'NR_ZONA')))].sort();
  console.log(`\n== ZONAS encontradas para SÃO JOSÉ DE RIBAMAR / Vereador: [${zonas.join(', ')}]`);
  console.log(`   Total de linhas brutas: ${linhasFiltradas.length}\n`);

  // ── Linhas brutas (diagnóstico completo) ──────────────────────────────────
  console.log('== LINHAS BRUTAS (uma por partido-por-zona) ==');
  console.log('ZONA | ENTIDADE (SG_FED ou SG_PART) | TP_AGREMIACAO | LEG_VAL | LEG_NOM_CONVR | TOTAL_LEG | NOM_VAL');
  linhasFiltradas.forEach(l => {
    const zona  = campo(l, 'NR_ZONA');
    const fed   = campo(l, 'SG_FEDERACAO');
    const part  = campo(l, 'SG_PARTIDO');
    const tp    = campo(l, 'TP_AGREMIACAO');
    const leg   = parseInt(campo(l, 'QT_VOTOS_LEGENDA_VALIDOS') || '0', 10);
    const conv  = parseInt(campo(l, 'QT_VOTOS_NOM_CONVR_LEG_VALIDOS') || '0', 10);
    const tleg  = parseInt(campo(l, 'QT_TOTAL_VOTOS_LEG_VALIDOS') || '0', 10);
    const nom   = parseInt(campo(l, 'QT_VOTOS_NOMINAIS_VALIDOS') || '0', 10);
    const entid = (fed && fed !== '#NULO#') ? fed : part;
    console.log(`${zona.padEnd(6)} | ${entid.padEnd(20)} | ${tp.padEnd(16)} | ${String(leg).padStart(7)} | ${String(conv).padStart(13)} | ${String(tleg).padStart(9)} | ${String(nom).padStart(7)}`);
  });

  // ── Fusão por entidade (SG_FEDERACAO ou SG_PARTIDO) ───────────────────────
  const entidades = {}; // chave → { sigla, tipo, nominais, legenda, membros }

  linhasFiltradas.forEach(l => {
    const fed  = campo(l, 'SG_FEDERACAO');
    const part = campo(l, 'SG_PARTIDO');
    const tp   = campo(l, 'TP_AGREMIACAO');
    const chave = (fed && fed !== '#NULO#') ? fed : part;
    const leg  = parseInt(campo(l, 'QT_VOTOS_LEGENDA_VALIDOS') || '0', 10);
    const conv = parseInt(campo(l, 'QT_VOTOS_NOM_CONVR_LEG_VALIDOS') || '0', 10);
    const tleg = parseInt(campo(l, 'QT_TOTAL_VOTOS_LEG_VALIDOS') || '0', 10);
    const nom  = parseInt(campo(l, 'QT_VOTOS_NOMINAIS_VALIDOS') || '0', 10);

    if (!entidades[chave]) {
      entidades[chave] = { sigla: chave, tipo: tp, nominais: 0, legenda: 0, conv: 0, tleg: 0, membros: new Set() };
    }
    entidades[chave].nominais += nom;
    entidades[chave].legenda  += leg;
    entidades[chave].conv     += conv;
    entidades[chave].tleg     += tleg;
    entidades[chave].membros.add(part);
  });

  // ── Cálculo de totais e ordenação ─────────────────────────────────────────
  const lista = Object.values(entidades).map(e => ({
    ...e,
    total: e.tleg + e.nominais,
  })).sort((a, b) => b.total - a.total);

  const somaValidos = lista.reduce((s, e) => s + e.total, 0);

  // QE — Art. 106 CE: desprezar fração ≤ 1/2, arredondar se > 1/2
  const qeExato = somaValidos / VAGAS;
  const qeFrac  = qeExato - Math.floor(qeExato);
  const qe      = qeFrac > 0.5 ? Math.ceil(qeExato) : Math.floor(qeExato);

  console.log('\n\n== ENTIDADES FUNDIDAS (total = legenda_total + nominais, ordem decrescente) ==');
  console.log(`${'ENTIDADE'.padEnd(24)} | ${'TIPO'.padEnd(16)} | ${'MEMBROS'.padEnd(30)} | ${'LEG'.padStart(6)} | ${'CONV'.padStart(5)} | ${'NOM'.padStart(7)} | ${'TOTAL'.padStart(8)}`);
  console.log('-'.repeat(110));
  lista.forEach(e => {
    const membros = [...e.membros].join('+');
    console.log(
      `${e.sigla.padEnd(24)} | ${e.tipo.padEnd(16)} | ${membros.padEnd(30)} | ${String(e.legenda).padStart(6)} | ${String(e.conv).padStart(5)} | ${String(e.nominais).padStart(7)} | ${String(e.total).padStart(8)}`
    );
  });

  console.log('-'.repeat(110));
  console.log(`${'TOTAL DE VOTOS VÁLIDOS'.padEnd(24)} | ${''.padEnd(16)} | ${''.padEnd(30)} | ${''.padStart(6)} | ${''.padStart(5)} | ${''.padStart(7)} | ${String(somaValidos).padStart(8)}`);
  console.log(`\nVagas: ${VAGAS}`);
  console.log(`QE exato: ${somaValidos} ÷ ${VAGAS} = ${qeExato.toFixed(6)}`);
  console.log(`Fração: ${qeFrac.toFixed(6)} ${qeFrac > 0.5 ? '> 0,5 → arredonda para cima' : '≤ 0,5 → despreza'}`);
  console.log(`QE = ${qe}`);
})().catch(e => { process.stderr.write(`ERRO: ${e.message}\n${e.stack}\n`); process.exit(1); });
