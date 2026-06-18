'use strict';

const { calcular } = require('../js/engine.js');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Replica a lógica interna de contarCandidatos20 do engine (sem tocar no engine.js)
function contarCandidatos20(partido, piso20) {
  const cands = partido.candidatos;
  if (!cands || cands.length === 0) return null;
  return cands.filter(c => c.votos >= piso20).length;
}

function logEntrada(label, partidos, piso20) {
  console.log('\n' + '═'.repeat(70));
  console.log(`ENTRADA ENGINE — ${label}`);
  console.log('─'.repeat(70));
  for (const p of partidos) {
    const n = p.candidatos === undefined ? 'undefined (sem lista)'
            : p.candidatos === null      ? 'null'
            : `${p.candidatos.length} item(s)`;
    console.log(`  ${p.sigla.padEnd(22)} nominais=${String(p.votosNominais).padStart(7)}  candidatos=${n}`);
  }

  console.log('\nCANDS20 DISPONÍVEIS (simula contarCandidatos20 do engine, piso20=' + piso20 + ')');
  console.log('─'.repeat(70));
  for (const p of partidos) {
    const disp = contarCandidatos20(p, piso20);
    const nota = disp === null
      ? 'null  ← [] ou undefined → engine trata como ILIMITADO'
      : disp === 0
        ? '0     ← esgotado → bloqueia na Fase 2'
        : String(disp) + '     ← disponíveis';
    console.log(`  ${p.sigla.padEnd(22)} ${nota}`);
  }
}

function rodar(label, partidos, vagas) {
  // QE e piso20 para o AP 2022 federal (8 vagas, total=419.464)
  // Calculado pelo engine internamente; aqui só estimamos para o log de entrada
  const totalValidos = partidos.reduce((s, p) => s + (p.votosNominais || 0) + (p.votosLegenda || 0), 0);
  const qe    = totalValidos / vagas;
  const piso20 = qe * 0.20;

  logEntrada(label, partidos, Math.round(piso20));

  const resultado = calcular({ partidos, vagas, cassacoes: [] });

  console.log('\nRESULTADO CALCULADORA');
  console.log('─'.repeat(70));
  console.log('  fase3Ativada :', resultado.fase3Ativada);
  console.log('  fase3Motivo  :', resultado.fase3Motivo || '(não ativada)');
  console.log('  QE           :', resultado.qe);
  console.log('  barreira80   :', resultado.barreira80);
  console.log('  piso20       :', resultado.piso20);
  console.log('\n  Distribuição (partidos com ≥1 vaga):');
  for (const p of (resultado.partidos || [])) {
    const total = (p.qp || 0) + (p.sobrasF2 || 0) + (p.sobrasF3 || 0);
    if (total > 0) {
      console.log(`    ${p.sigla.padEnd(22)} ${total} vaga(s)  (F1=${p.qp}  F2=${p.sobrasF2||0}  F3=${p.sobrasF3||0})`);
    }
  }
  console.log('\n' + '═'.repeat(70));
}

/* ─────────────────────────────────────────────────────────────────────────
   CENÁRIO A — Modo automático (cache antigo: candidatos: [] em todos)
───────────────────────────────────────────────────────────────────────── */
const jsonAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tse/2022_AP_federal.json'), 'utf8').replace(/^﻿/, ''));
const partidosA = jsonAP.partidos.map(p => ({
  sigla:         p.sigla,
  nome:          p.nome,
  votosNominais: p.votosNominais,
  votosLegenda:  p.votosLegenda,
  candidatos:    [],          // ← simula o cache criado ANTES dos candidatos serem adicionados
  ...(p.partidos ? { partidos: p.partidos } : {}),
}));

/* ─────────────────────────────────────────────────────────────────────────
   CENÁRIO B — Modo CSV manual / preset (candidatos reais em PDT, PL, MDB)
───────────────────────────────────────────────────────────────────────── */
const presetsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/presets.json'), 'utf8'));
const preset = presetsJson.presets.find(p => p.id === 'ap2022_retotalizacao_tse_real');
if (!preset) { console.error('Preset ap2022_retotalizacao_tse_real não encontrado'); process.exit(1); }

const partidosB = preset.partidos.map(p => {
  const obj = {
    sigla:         p.sigla,
    nome:          p.nome,
    votosNominais: p.votosNominais,
    votosLegenda:  p.votosLegenda,
  };
  if (p.candidatos !== undefined) obj.candidatos = p.candidatos;   // undefined nos demais
  if (p.partidos   !== undefined) obj.partidos   = p.partidos;
  return obj;
});

/* ─────────────────────────────────────────────────────────────────────────
   RODAR OS DOIS CENÁRIOS
───────────────────────────────────────────────────────────────────────── */
rodar('CENÁRIO A — Automático (cache antigo, candidatos: [])', partidosA, 8);
rodar('CENÁRIO B — CSV Manual (preset, candidatos reais PDT/PL/MDB)',  partidosB, 8);
