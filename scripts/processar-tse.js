#!/usr/bin/env node
/**
 * scripts/processar-tse.js
 *
 * Baixa o ZIP do TSE, extrai o CSV da UF solicitada e salva JSON compacto
 * em data/tse/{ano}_{UF}_{cargo}.json
 *
 * Zero dependências externas — usa apenas módulos built-in do Node.js.
 *
 * Uso:
 *   node scripts/processar-tse.js 2022 CE federal
 *   node scripts/processar-tse.js 2022 AP federal
 *   node scripts/processar-tse.js 2022 todas federal
 *   node scripts/processar-tse.js 2024 SP vereador
 *
 * O ZIP do TSE 2022 contém um CSV por estado (ex: votacao_..._CE.csv).
 * O script localiza a entrada correta, extrai só ela e parseia.
 */
'use strict';

const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');

/* ── Configuração ─────────────────────────────────────────────────────────── */

const CDN_URL = ano =>
  `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_${ano}.zip`;

const UFS_VALIDAS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

const CARGO_MAP_CSV = {
  'DEPUTADO FEDERAL':   'Deputado Federal',
  'DEPUTADO ESTADUAL':  'Deputado Estadual',
  'DEPUTADO DISTRITAL': 'Deputado Distrital',
  'VEREADOR':           'Vereador',
};

const CARGO_SLUG = {
  'Deputado Federal':   'federal',
  'Deputado Estadual':  'estadual',
  'Deputado Distrital': 'distrital',
  'Vereador':           'vereador',
};

const SLUG_PARA_CARGO = Object.fromEntries(
  Object.entries(CARGO_SLUG).map(([k, v]) => [v, k])
);

/* ── Download ─────────────────────────────────────────────────────────────── */

function baixar(url) {
  return new Promise((resolve, reject) => {
    const protocolo = url.startsWith('https') ? https : http;
    const chunks = [];
    let received = 0;
    let total = 0;
    let lastPct = -1;

    function req(u) {
      protocolo.get(u, { headers: { 'User-Agent': 'processar-tse/1.0 (Node.js)' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return req(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} em ${u}`));
        total = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', chunk => {
          chunks.push(chunk);
          received += chunk.length;
          const pct = total ? Math.round(received / total * 100) : -1;
          if (pct !== lastPct) {
            lastPct = pct;
            const mb    = (received / 1048576).toFixed(1);
            const totMB = total ? `/${(total / 1048576).toFixed(1)} MB` : ' MB';
            process.stdout.write(`\r  ↓ ${mb}${totMB}${pct >= 0 ? ` (${pct}%)` : ''}   `);
          }
        });
        res.on('end', () => { process.stdout.write('\n'); resolve(Buffer.concat(chunks)); });
        res.on('error', reject);
      }).on('error', reject);
    }
    req(url);
  });
}

/* ── Parse ZIP (built-in, sem dependências externas) ─────────────────────── */

function parsearDiretorioCentral(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD não encontrado — ZIP corrompido.');

  const numEntradas = buf.readUInt16LE(eocd + 10);
  const cdOffset    = buf.readUInt32LE(eocd + 16);

  const CD_SIG = 0x02014b50;
  const entradas = [];
  let pos = cdOffset;

  for (let i = 0; i < numEntradas; i++) {
    if (buf.length - pos < 46 || buf.readUInt32LE(pos) !== CD_SIG) break;
    const compressao     = buf.readUInt16LE(pos + 10);
    const tamComprimido  = buf.readUInt32LE(pos + 20);
    const tamOriginal    = buf.readUInt32LE(pos + 24);
    const nomeLen        = buf.readUInt16LE(pos + 28);
    const extraLen       = buf.readUInt16LE(pos + 30);
    const comentLen      = buf.readUInt16LE(pos + 32);
    const offsetLocal    = buf.readUInt32LE(pos + 42);
    const nome           = buf.slice(pos + 46, pos + 46 + nomeLen).toString('utf8');
    entradas.push({ nome, compressao, tamComprimido, tamOriginal, offsetLocal });
    pos += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function extrairEntrada(buf, entrada) {
  const LFH_SIG = 0x04034b50;
  const p = entrada.offsetLocal;
  if (buf.readUInt32LE(p) !== LFH_SIG) throw new Error(`LFH inválido para "${entrada.nome}"`);
  const fnLen  = buf.readUInt16LE(p + 26);
  const exLen  = buf.readUInt16LE(p + 28);
  const inicio = p + 30 + fnLen + exLen;
  // Usa tamComprimido do central directory (LFH pode ser 0 com data descriptor)
  const dados  = buf.slice(inicio, inicio + entrada.tamComprimido);
  if (entrada.compressao === 0) return dados;
  if (entrada.compressao === 8) return zlib.inflateRawSync(dados, { maxOutputLength: 512 * 1024 * 1024 });
  throw new Error(`Compressão ${entrada.compressao} não suportada.`);
}

/* ── Parse CSV ────────────────────────────────────────────────────────────── */

function splitLinha(linha) {
  return linha.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
}

/**
 * Parseia um CSV de partidos de UF única e retorna agrupado por cargo.
 * Retorna Map("cargo" → { estado: {sigla→dados}, muns: {mun→{sigla→dados}} })
 */
function parsearCSVdeUF(texto, uf) {
  const linhas = texto.split(/\r?\n/);
  if (linhas.length < 2) throw new Error('CSV vazio ou inválido.');

  const header = splitLinha(linhas[0]);
  const col = nome => header.indexOf(nome);

  const cCargo = col('DS_CARGO');
  const cUF    = col('SG_UF');
  const cMun   = col('NM_MUNICIPIO');
  const cSigla = col('SG_PARTIDO');
  const cNome  = col('NM_PARTIDO');
  const cNom   = col('QT_VOTOS_NOMINAIS_VALIDOS') >= 0
    ? col('QT_VOTOS_NOMINAIS_VALIDOS') : col('QT_VOTOS_NOMINAIS');
  const cLeg   = col('QT_TOTAL_VOTOS_LEG_VALIDOS') >= 0
    ? col('QT_TOTAL_VOTOS_LEG_VALIDOS')
    : col('QT_VOTOS_LEGENDA_VALIDOS') >= 0
      ? col('QT_VOTOS_LEGENDA_VALIDOS') : col('QT_VOTOS_LEGENDA');
  const cSgFed = col('SG_FEDERACAO');
  const cNmFed = col('NM_FEDERACAO');

  if (cCargo < 0 || cSigla < 0 || cNom < 0 || cLeg < 0) {
    throw new Error(`Colunas obrigatórias ausentes.\nHeader: ${header.slice(0, 10).join(' | ')}`);
  }

  // Map("cargo" → { estado: {sigla→p}, muns: {mun→{sigla→p}} })
  const por_cargo = new Map();
  let nProc = 0, nIgn = 0;

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const cols = splitLinha(linha);
    if (cols.length < 5) { nIgn++; continue; }

    const cargoRaw = (cols[cCargo] || '').trim().toUpperCase();
    const cargo    = CARGO_MAP_CSV[cargoRaw];
    if (!cargo) { nIgn++; continue; }

    // Filtra por UF quando o CSV tem múltiplas UFs (ex: arquivo BRASIL)
    if (cUF >= 0) {
      const csvUF = (cols[cUF] || '').trim().toUpperCase();
      if (csvUF && csvUF !== uf && uf !== 'BRASIL' && uf !== 'BR') {
        nIgn++; continue;
      }
    }

    const sigla = (cols[cSigla] || '').trim();
    const nome  = cNome >= 0 ? (cols[cNome] || '').trim() : sigla;
    const mun   = cMun  >= 0 ? (cols[cMun]  || '').trim() : '';
    if (!sigla) { nIgn++; continue; }

    const nom = parseInt(cols[cNom] || '0', 10) || 0;
    const leg = parseInt(cols[cLeg] || '0', 10) || 0;

    // Agrupa por federação quando o partido pertence a uma (SG_FEDERACAO != '#NULO#')
    const sgFed = cSgFed >= 0 ? (cols[cSgFed] || '').trim() : '';
    const nmFed = cNmFed >= 0 ? (cols[cNmFed] || '').trim() : '';
    const emFed = sgFed && sgFed !== '#NULO#' && sgFed !== '-1';
    const chave = emFed ? sgFed : sigla;
    const nomeEntidade = emFed ? nmFed : nome;

    if (!por_cargo.has(cargo)) por_cargo.set(cargo, { estado: {}, muns: {} });
    const g = por_cargo.get(cargo);

    if (!g.estado[chave]) {
      g.estado[chave] = { sigla: chave, nome: nomeEntidade, votosNominais: 0, votosLegenda: 0 };
      if (emFed) g.estado[chave].partidos = [];
    }
    g.estado[chave].votosNominais += nom;
    g.estado[chave].votosLegenda  += leg;
    if (emFed && !g.estado[chave].partidos.includes(sigla)) {
      g.estado[chave].partidos.push(sigla);
    }

    if (cargo === 'Vereador' && mun) {
      if (!g.muns[mun]) g.muns[mun] = {};
      if (!g.muns[mun][chave]) g.muns[mun][chave] = { sigla: chave, nome: nomeEntidade, votosNominais: 0, votosLegenda: 0 };
      g.muns[mun][chave].votosNominais += nom;
      g.muns[mun][chave].votosLegenda  += leg;
    }
    nProc++;
  }

  process.stdout.write(`    linhas: ${nProc.toLocaleString('pt-BR')} úteis, ${nIgn.toLocaleString('pt-BR')} ignoradas\n`);
  return por_cargo;
}

/* ── Salvar JSON ──────────────────────────────────────────────────────────── */

function salvarJSON(ano, uf, cargo, por_cargo) {
  const dados = por_cargo.get(cargo);
  if (!dados) {
    console.warn(`    ⚠  Sem dados para cargo "${cargo}" — pulando.`);
    return null;
  }

  const partidos = Object.values(dados.estado)
    .sort((a, b) => (b.votosNominais + b.votosLegenda) - (a.votosNominais + a.votosLegenda));

  const json = { meta: { ano, uf, cargo, gerado: new Date().toISOString() }, partidos };

  if (cargo === 'Vereador') {
    json.municipios = Object.keys(dados.muns).sort();
    json.dadosMun = {};
    for (const [mun, ps] of Object.entries(dados.muns)) {
      json.dadosMun[mun] = Object.values(ps)
        .sort((a, b) => (b.votosNominais + b.votosLegenda) - (a.votosNominais + a.votosLegenda));
    }
  }

  const dir    = path.join(__dirname, '..', 'data', 'tse');
  const fname  = `${ano}_${uf}_${CARGO_SLUG[cargo]}.json`;
  const fpath  = path.join(dir, fname);
  fs.mkdirSync(dir, { recursive: true });

  const conteudo = JSON.stringify(json);
  fs.writeFileSync(fpath, conteudo, 'utf8');

  const kb     = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
  const aviso  = parseFloat(kb) > 100 ? ' ⚠  > 100 KB' : '';
  console.log(`    ✓  ${fname}  (${kb} KB, ${partidos.length} partidos)${aviso}`);
  return fpath;
}

/* ── Processar uma UF ─────────────────────────────────────────────────────── */

function encontrarEntradaUF(entradas, uf, ano) {
  // Padrão esperado: votacao_partido_munzona_{ano}_{uf}.csv
  const padraoUF = new RegExp(`_${uf}\\.csv$`, 'i');
  return entradas.find(e => padraoUF.test(e.nome) && e.nome.toLowerCase().endsWith('.csv'));
}

async function processarUF(buf, entradas, ano, uf, cargo) {
  process.stdout.write(`\n  ▶ ${uf}…\n`);

  const entry = encontrarEntradaUF(entradas, uf, ano);
  if (!entry) {
    console.warn(`    ⚠  CSV para UF ${uf} não encontrado no ZIP. Entradas disponíveis:`);
    entradas.filter(e => e.nome.endsWith('.csv')).forEach(e => console.warn(`       ${e.nome}`));
    return;
  }

  process.stdout.write(`    extraindo ${entry.nome} (${(entry.tamComprimido / 1024).toFixed(0)} KB comprimido)…\n`);
  const raw  = extrairEntrada(buf, entry);
  const text = raw.toString('latin1');

  const por_cargo = parsearCSVdeUF(text, uf);
  salvarJSON(ano, uf, cargo, por_cargo);
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('\nUso:  node scripts/processar-tse.js <ano> <UF|todas> <cargo>\n');
    console.log('Exemplos:');
    console.log('  node scripts/processar-tse.js 2022 CE federal');
    console.log('  node scripts/processar-tse.js 2022 AP federal');
    console.log('  node scripts/processar-tse.js 2022 todas federal');
    console.log('  node scripts/processar-tse.js 2024 SP vereador\n');
    console.log('Cargos: federal, estadual, distrital, vereador\n');
    process.exit(1);
  }

  const ano     = args[0];
  const ufArg   = (args[1] || '').toUpperCase();
  const slugArg = (args[2] || 'federal').toLowerCase();
  const cargo   = SLUG_PARA_CARGO[slugArg];

  if (!cargo) {
    console.error(`Cargo inválido: "${slugArg}". Use: federal, estadual, distrital, vereador`);
    process.exit(1);
  }

  const ufsAlvo = ufArg === 'TODAS' ? [...UFS_VALIDAS] : [ufArg];
  for (const u of ufsAlvo) {
    if (!UFS_VALIDAS.includes(u)) {
      console.error(`UF inválida: "${u}". Válidas: ${UFS_VALIDAS.join(', ')}`);
      process.exit(1);
    }
  }

  console.log('\n══ TSE Processador ════════════════════════════════════════════');
  console.log(`  Ano: ${ano} | UFs: ${ufsAlvo.join(', ')} | Cargo: ${cargo}`);
  console.log(`  Fonte: ${CDN_URL(ano)}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Download do ZIP (uma vez, mesmo para múltiplas UFs)
  console.log('\n▶ Baixando ZIP do TSE…');
  const buf = await baixar(CDN_URL(ano));
  console.log(`  Tamanho: ${(buf.length / 1048576).toFixed(1)} MB`);

  // Parse do central directory (mapa de entradas)
  console.log('\n▶ Lendo estrutura do ZIP…');
  const entradas = parsearDiretorioCentral(buf);
  const csvs = entradas.filter(e => e.nome.toLowerCase().endsWith('.csv') && !e.nome.toLowerCase().includes('readme'));
  console.log(`  CSVs encontrados: ${csvs.map(e => e.nome).join(', ')}`);

  // Processa cada UF
  console.log('\n▶ Processando UFs…');
  for (const u of ufsAlvo) {
    await processarUF(buf, entradas, ano, u, cargo);
  }

  console.log('\n✅ Concluído.\n');
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
