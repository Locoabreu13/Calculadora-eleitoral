#!/usr/bin/env node
/**
 * scripts/adicionar-candidatos.js
 *
 * Baixa o ZIP de candidatos do TSE, extrai o CSV da UF solicitada
 * e ADICIONA o campo `candidatos` ao JSON já existente em data/tse/,
 * sem alterar nenhum outro campo (meta, sigla, nome, votosNominais,
 * votosLegenda, partidos).
 *
 * Regra de validação: soma dos votos dos candidatos deve bater EXATAMENTE
 * com votosNominais de cada partido. Qualquer divergência de 1 voto ou mais
 * encerra sem gravar nada.
 *
 * Uso:
 *   node scripts/adicionar-candidatos.js 2022 CE federal
 *   node scripts/adicionar-candidatos.js 2022 MG federal
 */
'use strict';

const https    = require('https');
const http     = require('http');
const zlib     = require('zlib');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

/* ── Configuração ─────────────────────────────────────────────────────────── */

const CDN_URL_CAND = ano =>
  `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_${ano}.zip`;

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

/* ── Utilitários ──────────────────────────────────────────────────────────── */

function fmt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function splitLinha(linha) {
  return linha.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
}

/* ── Download (idêntico ao processar-tse.js) ─────────────────────────────── */

function baixar(url) {
  return new Promise((resolve, reject) => {
    const protocolo = url.startsWith('https') ? https : http;
    const chunks = [];
    let received = 0, total = 0, lastPct = -1;
    function req(u) {
      protocolo.get(u, { headers: { 'User-Agent': 'adicionar-candidatos/1.0 (Node.js)' } }, res => {
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

/* ── Parse ZIP (idêntico ao processar-tse.js) ────────────────────────────── */

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
    const compressao    = buf.readUInt16LE(pos + 10);
    const tamComprimido = buf.readUInt32LE(pos + 20);
    const tamOriginal   = buf.readUInt32LE(pos + 24);
    const nomeLen       = buf.readUInt16LE(pos + 28);
    const extraLen      = buf.readUInt16LE(pos + 30);
    const comentLen     = buf.readUInt16LE(pos + 32);
    const offsetLocal   = buf.readUInt32LE(pos + 42);
    const nome          = buf.slice(pos + 46, pos + 46 + nomeLen).toString('utf8');
    entradas.push({ nome, compressao, tamComprimido, tamOriginal, offsetLocal });
    pos += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function extrairParaArquivo(buf, entrada, destPath) {
  return new Promise((resolve, reject) => {
    const LFH_SIG = 0x04034b50;
    const p = entrada.offsetLocal;
    if (buf.readUInt32LE(p) !== LFH_SIG) return reject(new Error(`LFH inválido para "${entrada.nome}"`));
    const fnLen  = buf.readUInt16LE(p + 26);
    const exLen  = buf.readUInt16LE(p + 28);
    const inicio = p + 30 + fnLen + exLen;
    const dados  = buf.slice(inicio, inicio + entrada.tamComprimido);
    const out    = fs.createWriteStream(destPath);
    if (entrada.compressao === 0) {
      out.end(dados);
    } else if (entrada.compressao === 8) {
      const inflate = zlib.createInflateRaw();
      inflate.pipe(out);
      inflate.end(dados);
    } else {
      return reject(new Error(`Compressão ${entrada.compressao} não suportada.`));
    }
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

function encontrarEntradaUF(entradas, uf) {
  const padrao = new RegExp(`_${uf}\\.csv$`, 'i');
  return entradas.find(e => padrao.test(e.nome) && e.nome.toLowerCase().endsWith('.csv'));
}

/* ── Parse CSV de candidatos ─────────────────────────────────────────────── */

function parsearCSVCandidatosArquivo(filePath, uf, cargoAlvo, mapaFederacao) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'latin1' });
    const rl     = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let cCargo, cUF, cNome, cNum, cSigla, cVotos;
    const porBloco = {};
    let nProc = 0, nIgn = 0;
    let primeiraLinha = true;

    rl.on('line', linha => {
      if (primeiraLinha) {
        primeiraLinha = false;
        const header = splitLinha(linha);
        const col    = nome => header.indexOf(nome);
        cCargo = col('DS_CARGO');
        cUF    = col('SG_UF');
        cNome  = col('NM_CANDIDATO');
        cNum   = col('NR_CANDIDATO');
        cSigla = col('SG_PARTIDO');
        cVotos = col('QT_VOTOS_NOMINAIS_VALIDOS') >= 0
          ? col('QT_VOTOS_NOMINAIS_VALIDOS')
          : col('QT_VOTOS_NOMINAIS');
        if (cNome < 0 || cSigla < 0 || cVotos < 0) {
          rl.close();
          return reject(new Error(
            'Colunas obrigatórias não encontradas (NM_CANDIDATO, SG_PARTIDO, votos). ' +
            'Confirme que é o arquivo votacao_candidato_munzona do TSE.'
          ));
        }
        return;
      }
      linha = linha.trim();
      if (!linha) return;
      const cols = splitLinha(linha);
      if (cols.length < 5) { nIgn++; return; }
      if (cUF >= 0 && cols[cUF].trim().toUpperCase() !== uf) { nIgn++; return; }
      const cargoRaw = (cols[cCargo] || '').trim().toUpperCase();
      if (CARGO_MAP_CSV[cargoRaw] !== cargoAlvo) { nIgn++; return; }
      const siglaPartido = (cols[cSigla] || '').trim();
      const nomeCand     = (cols[cNome]  || '').trim();
      const numCand      = cNum >= 0 ? (cols[cNum] || '').trim() : '';
      const votos        = parseInt(cols[cVotos] || '0', 10) || 0;
      if (!siglaPartido || !nomeCand) { nIgn++; return; }
      const blocoKey = mapaFederacao[siglaPartido] || siglaPartido;
      if (!porBloco[blocoKey]) porBloco[blocoKey] = {};
      const chave = `${numCand}_${nomeCand}`;
      if (!porBloco[blocoKey][chave]) {
        porBloco[blocoKey][chave] = { nome: nomeCand, votos: 0, partido: siglaPartido };
      }
      porBloco[blocoKey][chave].votos += votos;
      nProc++;
    });

    rl.on('close', () => {
      process.stdout.write(`    linhas: ${fmt(nProc)} úteis, ${fmt(nIgn)} ignoradas\n`);
      const resultado = {};
      for (const [bloco, cands] of Object.entries(porBloco)) {
        resultado[bloco] = Object.values(cands).sort((a, b) => b.votos - a.votos);
      }
      resolve(resultado);
    });

    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/* ── Validação: margem zero ───────────────────────────────────────────────── */

function validarSomas(partidos, candidatosPorBloco) {
  const divergencias = [];
  for (const p of partidos) {
    if (p.votosNominais === 0) continue;
    const cands = candidatosPorBloco[p.sigla];
    const soma  = cands ? cands.reduce((s, c) => s + c.votos, 0) : 0;
    if (soma !== p.votosNominais) {
      divergencias.push({
        sigla:    p.sigla,
        esperado: p.votosNominais,
        obtido:   soma,
        diff:     soma - p.votosNominais,
      });
    }
  }
  return divergencias;
}

/* ── Confirmação interativa ───────────────────────────────────────────────── */

function confirmar(pergunta) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pergunta, resp => { rl.close(); resolve(resp.trim().toLowerCase()); });
  });
}

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  const args    = process.argv.slice(2);
  const ano     = args[0];
  const ufArg   = (args[1] || '').toUpperCase().trim();
  const slugArg = (args[2] || 'federal').toLowerCase().trim();

  if (args.length < 2) {
    console.log('\nUso:  node scripts/adicionar-candidatos.js <ano> <UF> <cargo>');
    console.log('Ex.:  node scripts/adicionar-candidatos.js 2022 CE federal\n');
    console.log('Cargos: federal, estadual, distrital, vereador\n');
    process.exit(1);
  }

  if (['TODAS', 'TODOS', 'ALL', 'BR', 'BRASIL'].includes(ufArg)) {
    console.error('\n❌ Este script aceita apenas UMA UF por vez.');
    console.error('   "todas" é proibido aqui para proteger os dados já validados (CE, AP).');
    console.error('   Use a sigla do estado, ex: CE, AP, MG.\n');
    process.exit(1);
  }

  if (!UFS_VALIDAS.includes(ufArg)) {
    console.error(`\n❌ UF inválida: "${ufArg}"`);
    console.error(`   Válidas: ${UFS_VALIDAS.join(', ')}\n`);
    process.exit(1);
  }

  const cargo = SLUG_PARA_CARGO[slugArg];
  if (!cargo) {
    console.error(`\n❌ Cargo inválido: "${slugArg}". Use: federal, estadual, distrital, vereador\n`);
    process.exit(1);
  }

  const cargoSlug = CARGO_SLUG[cargo];
  const jsonPath  = path.join(__dirname, '..', 'data', 'tse', `${ano}_${ufArg}_${cargoSlug}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`\n❌ JSON base não encontrado: ${path.basename(jsonPath)}`);
    console.error(`   Rode primeiro: node scripts/processar-tse.js ${ano} ${ufArg} ${slugArg}\n`);
    process.exit(1);
  }

  console.log('\n══ Adicionar Candidatos ═══════════════════════════════════════');
  console.log(`  Ano: ${ano} | UF: ${ufArg} | Cargo: ${cargo}`);
  console.log(`  JSON base: ${path.basename(jsonPath)}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const jsonExistente = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const partidos      = jsonExistente.partidos;

  const mapaFederacao = {};
  for (const p of partidos) {
    if (Array.isArray(p.partidos) && p.partidos.length > 0) {
      for (const membro of p.partidos) mapaFederacao[membro] = p.sigla;
    } else {
      mapaFederacao[p.sigla] = p.sigla;
    }
  }

  const cacheDir  = path.join(__dirname, '..', 'cache');
  const cachePath = path.join(cacheDir, `votacao_candidato_munzona_${ano}.zip`);
  const urlCand   = CDN_URL_CAND(ano);
  let buf;
  if (fs.existsSync(cachePath)) {
    console.log(`\n▶ Usando ZIP em cache local…`);
    console.log(`  ${cachePath}`);
    buf = fs.readFileSync(cachePath);
    console.log(`  Tamanho: ${(buf.length / 1048576).toFixed(1)} MB`);
  } else {
    console.log(`\n▶ Baixando ZIP de candidatos do TSE…`);
    console.log(`  ${urlCand}`);
    buf = await baixar(urlCand);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, buf);
    console.log(`  Tamanho: ${(buf.length / 1048576).toFixed(1)} MB`);
    console.log(`  Salvo em cache: ${cachePath}`);
  }

  console.log('\n▶ Lendo estrutura do ZIP…');
  const entradas = parsearDiretorioCentral(buf);
  const csvs     = entradas.filter(e => e.nome.toLowerCase().endsWith('.csv'));
  console.log(`  CSVs encontrados: ${csvs.map(e => path.basename(e.nome)).join(', ')}`);

  const entry = encontrarEntradaUF(entradas, ufArg);
  if (!entry) {
    console.error(`\n❌ CSV para UF ${ufArg} não encontrado no ZIP.`);
    process.exit(1);
  }
  console.log(`\n▶ Extraindo ${path.basename(entry.nome)} para arquivo temporário…`);
  const tempPath = path.join(cacheDir, `temp_${ufArg}_${ano}.csv`);
  fs.mkdirSync(cacheDir, { recursive: true });
  await extrairParaArquivo(buf, entry, tempPath);

  console.log('\n▶ Processando candidatos…');
  let candidatosPorBloco;
  try {
    candidatosPorBloco = await parsearCSVCandidatosArquivo(tempPath, ufArg, cargo, mapaFederacao);
  } finally {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }

  const totalCands = Object.values(candidatosPorBloco).reduce((s, a) => s + a.length, 0);
  console.log(`    total de candidatos encontrados: ${fmt(totalCands)}`);

  console.log('\n▶ Validando somas de votos (margem: 0 voto)…');
  const divergencias = validarSomas(partidos, candidatosPorBloco);

  if (divergencias.length > 0) {
    console.error('\n❌ VALIDAÇÃO FALHOU — nenhum arquivo foi alterado.\n');
    console.error('   Partidos com divergência:');
    const maxSigla = Math.max(...divergencias.map(d => d.sigla.length));
    for (const d of divergencias) {
      const sinal = d.diff > 0 ? '+' : '';
      console.error(
        `   ${d.sigla.padEnd(maxSigla + 2)}` +
        `esperado: ${fmt(d.esperado).padStart(10)}  ` +
        `obtido: ${fmt(d.obtido).padStart(10)}  ` +
        `diff: ${sinal}${fmt(d.diff)}`
      );
    }
    console.error('\n   Verifique os dados antes de prosseguir.\n');
    process.exit(1);
  }
  console.log('    ✓  Todas as somas batem exatamente.\n');

  console.log('══ PRÉVIA DAS MUDANÇAS ════════════════════════════════════════');
  console.log(`  Arquivo: ${path.basename(jsonPath)}\n`);
  for (const p of partidos) {
    const novos      = candidatosPorBloco[p.sigla] || [];
    const jaTemCands = Array.isArray(p.candidatos) && p.candidatos.length > 0;
    const acao       = jaTemCands
      ? `substitui ${p.candidatos.length} →`
      : 'adiciona         ';
    const top        = novos[0] ? `  (maior: ${novos[0].nome}, ${fmt(novos[0].votos)} votos)` : '';
    console.log(`  ${p.sigla.padEnd(22)} ${acao} ${String(novos.length).padStart(3)} candidatos${top}`);
  }
  console.log('\n  Campos NÃO alterados: meta, sigla, nome, votosNominais, votosLegenda, partidos');
  console.log('══════════════════════════════════════════════════════════════\n');

  const resp = await confirmar('Confirma gravação? [s/N] ');
  if (resp !== 's') {
    console.log('\nOperação cancelada. Nenhum arquivo foi alterado.\n');
    process.exit(0);
  }

  for (const p of partidos) {
    p.candidatos = candidatosPorBloco[p.sigla] || [];
  }

  const conteudo = JSON.stringify(jsonExistente, null, 4);
  fs.writeFileSync(jsonPath, conteudo, 'utf8');

  const kb = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
  console.log(`\n✅ Gravado: ${path.basename(jsonPath)} (${kb} KB)\n`);
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
