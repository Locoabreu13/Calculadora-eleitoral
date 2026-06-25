import fs from 'fs';

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function parsearLinha(linha) {
  const campos = [];
  let dentroAspas = false;
  let campo = '';
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      dentroAspas = !dentroAspas;
    } else if (c === ';' && !dentroAspas) {
      campos.push(campo);
      campo = '';
    } else {
      campo += c;
    }
  }
  campos.push(campo);
  return campos;
}

const estados = [
  'AC','AL','AM','AP','BA','DF','ES','GO',
  'MA','MG','MS','MT','PA','PB','PE','PI','PR',
  'RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

for (const uf of estados) {
  const csvPath = `cache/consulta_cand_2022/consulta_cand_2022_${uf}.csv`;
  const saida = `data/tse/2022_${uf}_genero-raca.json`;

  if (!fs.existsSync(csvPath)) {
    console.log(`AVISO: ${csvPath} nao encontrado.`);
    continue;
  }

  const linhas = fs.readFileSync(csvPath, 'latin1').split('\n');
  const cabecalho = parsearLinha(linhas[0].trim());

  const iCargo  = cabecalho.indexOf('DS_CARGO');
  const iNome   = cabecalho.indexOf('NM_CANDIDATO');
  const iSigla  = cabecalho.indexOf('SG_PARTIDO');
  const iGenero = cabecalho.indexOf('DS_GENERO');
  const iRaca   = cabecalho.indexOf('DS_COR_RACA');

  if ([iCargo, iNome, iSigla, iGenero, iRaca].includes(-1)) {
    console.log(`ERRO: coluna nao encontrada em ${uf}.`);
    continue;
  }

  const candidatos = {};
  let totalFederais = 0;
  let totalAmbiguos = 0;

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const campos = parsearLinha(linha);

    if (normalizarTexto(campos[iCargo]) !== 'DEPUTADO FEDERAL') continue;
    totalFederais++;

    const nome  = normalizarTexto(campos[iNome]);
    const sigla = normalizarTexto(campos[iSigla]);
    if (!nome || !sigla) continue;

    const chave  = nome + '|' + sigla;
    const genero = campos[iGenero];
    const raca   = campos[iRaca];
    const votoEmDobro =
      normalizarTexto(genero) === 'FEMININO' ||
      normalizarTexto(raca)   === 'PRETA'    ||
      normalizarTexto(raca)   === 'PARDA';

    if (candidatos[chave]) {
      if (!candidatos[chave].ambiguo) {
        candidatos[chave].ambiguo = true;
        totalAmbiguos++;
      }
    } else {
      candidatos[chave] = { genero, raca, votoEmDobro };
    }
  }

  const resultado = {
    meta: {
      ano: 2022, uf,
      cargo: 'Deputado Federal',
      gerado: new Date().toISOString(),
      fonte: `consulta_cand_2022_${uf}.csv`,
      regraDobro: 'EC 111/2021: genero FEMININO ou raca PRETA/PARDA',
      totalCandidatos: totalFederais,
      totalAmbiguos
    },
    candidatos
  };

  fs.writeFileSync(saida, JSON.stringify(resultado, null, 4), 'utf8');
  console.log(`${uf}: ${totalFederais} candidatos federais, ${Object.keys(candidatos).length} chaves, ${totalAmbiguos} ambiguos.`);
}

console.log('\nConcluido.');
