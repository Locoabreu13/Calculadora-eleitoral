/**
 * engine.js — Algoritmo de distribuição proporcional de cadeiras
 *
 * Implementa o art. 109 do Código Eleitoral (Lei 14.211/2021)
 * com interpretação conforme fixada pelo STF nas ADIs 7.228, 7.263 e 7.325
 * (julgamento de mérito e ED de 13/03/2025, redator Min. Flávio Dino).
 *
 * Puro: nenhuma dependência de DOM. Input → Output.
 *
 * @typedef {Object} Candidato
 * @property {string} nome
 * @property {string} partido - sigla do partido/federação
 * @property {number} votos
 * @property {boolean} [cassado]
 *
 * @typedef {Object} Partido
 * @property {string} sigla
 * @property {string} nome
 * @property {number} votosNominais
 * @property {number} votosLegenda
 * @property {Candidato[]} [candidatos]
 * @property {string[]} [partidos] - para federações, lista de siglas componentes
 *
 * @typedef {Object} Cenario
 * @property {string} rotulo
 * @property {number} vagas
 * @property {Partido[]} partidos
 * @property {Cassacao[]} [cassacoes]
 *
 * @typedef {Object} Cassacao
 * @property {string} partido - sigla
 * @property {string} [candidato] - nome do candidato cassado
 * @property {number} votosAnular - votos a anular
 * @property {'nominal_legenda'|'total'|'nominal'} modalidade
 *   nominal_legenda: anula nominais e reatribui à legenda
 *   total: anula nominais + proporção de legenda
 *   nominal: anula apenas nominais sem reatribuição
 *
 * @typedef {Object} RodadaAuditoria
 * @property {number} rodada
 * @property {number} fase - 2 ou 3
 * @property {MediaPartido[]} medias
 * @property {string} vencedor
 * @property {number} mediaVencedor
 * @property {Candidato|null} candidatoConvocado
 * @property {string} fundamentacao
 *
 * @typedef {Object} MediaPartido
 * @property {string} sigla
 * @property {number} votos
 * @property {number} cadeirasMaisUm
 * @property {number} media
 * @property {boolean} qualificado80
 * @property {number} candidatos20disponiveis
 * @property {boolean} participaDaRodada
 *
 * @typedef {Object} ResultadoPartido
 * @property {string} sigla
 * @property {string} nome
 * @property {number} votos
 * @property {number} percentualQE - votos/QE em decimal
 * @property {number} qp - cadeiras fase 1
 * @property {number} sobrasF2 - cadeiras fase 2
 * @property {number} sobrasF3 - cadeiras fase 3
 * @property {number} total
 * @property {string} status
 * @property {Candidato[]} eleitos
 * @property {number} candidatos20Disponiveis
 *
 * @typedef {Object} ResultadoFinal
 * @property {string} rotulo
 * @property {number} vagas
 * @property {number} votosValidos
 * @property {number} qe
 * @property {number} barreira80
 * @property {number} piso20
 * @property {number} totalQPs
 * @property {number} sobras
 * @property {ResultadoPartido[]} partidos
 * @property {RodadaAuditoria[]} auditoria
 * @property {boolean} fase3Ativada
 * @property {string} fase3Motivo
 * @property {string[]} alertas
 */

'use strict';

// ─── Utilidades ────────────────────────────────────────────────────────────────

/**
 * Parte inteira de uma divisão (truncamento, não arredondamento).
 * @param {number} dividendo
 * @param {number} divisor
 * @returns {number}
 */
function parteInteira(dividendo, divisor) {
  return Math.floor(dividendo / divisor);
}

/**
 * Aplica cassações ao cenário, ajustando votos dos partidos.
 * @param {Partido[]} partidos
 * @param {Cassacao[]} cassacoes
 * @returns {Partido[]} nova lista com votos ajustados (deep copy)
 */
function aplicarCassacoes(partidos, cassacoes) {
  // deep copy
  const result = partidos.map(p => ({
    ...p,
    candidatos: p.candidatos ? p.candidatos.map(c => ({ ...c })) : [],
  }));

  for (const cassacao of (cassacoes || [])) {
    const partido = result.find(p => p.sigla === cassacao.partido);
    if (!partido) continue;

    const candidato = partido.candidatos
      ? partido.candidatos.find(c => c.nome === cassacao.candidato)
      : null;

    const votosAnular = cassacao.votosAnular;

    switch (cassacao.modalidade) {
      case 'nominal_legenda':
        // Anula os votos nominais do candidato e os move para legenda
        partido.votosNominais -= votosAnular;
        partido.votosLegenda += votosAnular;
        if (candidato) {
          candidato.votos -= votosAnular;
          candidato.cassado = true;
        }
        break;
      case 'total':
        // Anula nominais + proporção de legenda
        partido.votosNominais -= votosAnular;
        if (candidato) {
          candidato.votos -= votosAnular;
          candidato.cassado = true;
        }
        break;
      case 'nominal':
      default:
        // Anula apenas nominais, sem reatribuição
        partido.votosNominais -= votosAnular;
        if (candidato) {
          candidato.votos -= votosAnular;
          candidato.cassado = true;
        }
        break;
    }

    // Garantir que não fique negativo
    partido.votosNominais = Math.max(0, partido.votosNominais);
    partido.votosLegenda = Math.max(0, partido.votosLegenda);
  }

  return result;
}

/**
 * Calcula os votos válidos de um partido (nominais + legenda).
 * @param {Partido} partido
 * @returns {number}
 */
function votosValidos(partido) {
  return partido.votosNominais + partido.votosLegenda;
}

/**
 * Conta candidatos com votos >= piso20 que ainda não foram eleitos/convocados.
 * Exclui candidatos já em jáEleitos (eleitos na Fase 1).
 * @param {Partido} partido
 * @param {number} piso20
 * @param {Set<string>} jáEleitos
 * @returns {number|null} null = sem lista de candidatos
 */
function contarCandidatos20(partido, piso20, jáEleitos = new Set()) {
  if (!partido.candidatos || partido.candidatos.length === 0) return null; // sem lista
  return partido.candidatos.filter(
    c => !c.cassado && c.votos >= piso20 && !jáEleitos.has(c.nome)
  ).length;
}

/**
 * Convoca (marca como eleito) o próximo candidato com >= piso20 do partido.
 * @param {Partido} partido
 * @param {number} piso20
 * @param {Set<string>} jáEleitos - nomes já convocados
 * @returns {Candidato|null}
 */
function convocarCandidato(partido, piso20, jáEleitos) {
  if (!partido.candidatos) return null;
  const ordenados = [...partido.candidatos]
    .filter(c => !c.cassado && c.votos >= piso20 && !jáEleitos.has(c.nome))
    .sort((a, b) => b.votos - a.votos);
  if (ordenados.length === 0) return null;
  jáEleitos.add(ordenados[0].nome);
  return ordenados[0];
}

/**
 * Convoca qualquer próximo candidato disponível (sem restrição de piso).
 * Usado nas fases 1 e 3.
 */
function convocarCandidatoQualquer(partido, jáEleitos) {
  if (!partido.candidatos) return null;
  const ordenados = [...partido.candidatos]
    .filter(c => !c.cassado && !jáEleitos.has(c.nome))
    .sort((a, b) => b.votos - a.votos);
  if (ordenados.length === 0) return null;
  jáEleitos.add(ordenados[0].nome);
  return ordenados[0];
}

// ─── Algoritmo principal ────────────────────────────────────────────────────────

/**
 * Executa a distribuição proporcional completa.
 * @param {Cenario} cenario
 * @returns {ResultadoFinal}
 */
function calcular(cenario) {
  const alertas = [];
  const auditoria = [];

  // 1. Aplicar cassações
  const partidos = aplicarCassacoes(cenario.partidos, cenario.cassacoes);

  // 2. Votos válidos totais
  const votosValidos_ = partidos.reduce((s, p) => s + votosValidos(p), 0);

  // 3. Quociente Eleitoral — art. 106 CE
  const qe = parteInteira(votosValidos_, cenario.vagas);

  if (qe === 0) {
    alertas.push('ATENÇÃO: Quociente Eleitoral calculado como 0. Verifique o número de votos e vagas.');
  }

  const barreira80 = qe * 0.8; // 80% do QE
  const piso20 = qe * 0.2;     // 20% do QE

  // 4. Fase 1 — Quocientes Partidários
  const estado = partidos.map(p => {
    const vv = votosValidos(p);
    const qp = qe > 0 ? parteInteira(vv, qe) : 0;
    return {
      ...p,
      votosValidos: vv,
      cadeiras: qp,
      qp,
      sobrasF2: 0,
      sobrasF3: 0,
      eleitos: [],
    };
  });

  const totalQPs = estado.reduce((s, p) => s + p.qp, 0);
  let sobrasTotais = cenario.vagas - totalQPs;

  // Rastreamento de eleitos
  const jáEleitos = new Set();

  // Convocar candidatos para as vagas da Fase 1
  for (const p of estado) {
    for (let i = 0; i < p.qp; i++) {
      const c = convocarCandidatoQualquer(p, jáEleitos);
      if (c) p.eleitos.push(c);
    }
  }

  // Verificar se algum partido atingiu o QE (para edge case art. 111)
  const algumAtingiu = estado.some(p => p.votosValidos >= qe && qe > 0);

  // 5. Fase 2 — D'Hondt com barreira 80/20
  let rodada = 0;
  let sobrasRestantes = sobrasTotais;

  // Mapa de candidatos20 disponíveis por partido
  // Candidatos 20% disponíveis APÓS a Fase 1 (exclui já eleitos)
  const cands20Disponiveis = {};
  for (const p of estado) {
    const n = contarCandidatos20(p, piso20, jáEleitos);
    // null = sem lista de candidatos (modo sem rastreamento)
    cands20Disponiveis[p.sigla] = n;
  }

  let fase3Ativada = false;
  let fase3Motivo = '';

  while (sobrasRestantes > 0) {
    rodada++;

    // Determinar partidos elegíveis para esta rodada
    const qualificados = estado.filter(p => {
      // Barreira 80% QE
      if (p.votosValidos < barreira80) return false;
      // Trava individual 20% QE: só se tiver candidatos disponíveis
      // Se não há lista de candidatos (null), presume-se que há candidatos disponíveis
      const disp = cands20Disponiveis[p.sigla];
      if (disp !== null && disp !== undefined && disp <= 0) return false;
      return true;
    });

    if (qualificados.length === 0) {
      // Fase 2 esgotada — ativar Fase 3
      if (!fase3Ativada) {
        fase3Ativada = true;
        fase3Motivo = determinarMotivoFase3(estado, barreira80, cands20Disponiveis);
        alertas.push(`FASE 3 ATIVADA: ${fase3Motivo}`);
      }

      // Fase 3 — D'Hondt sem barreira, todos os partidos
      const participantesFase3 = estado.filter(p => {
        // Na fase 3 não há barreira partidária (STF ADIs 7.228/7.263/7.325)
        // Mas ainda precisa ter candidatos disponíveis (qualquer um)
        if (p.candidatos && p.candidatos.length > 0) {
          const disponiveis = p.candidatos.filter(c => !c.cassado && !jáEleitos.has(c.nome));
          return disponiveis.length > 0;
        }
        return true; // sem lista de candidatos, presume disponível
      });

      if (participantesFase3.length === 0) {
        alertas.push('AVISO: Sem candidatos disponíveis para Fase 3. Vagas não distribuídas: ' + sobrasRestantes);
        break;
      }

      const mediasF3 = participantesFase3.map(p => ({
        sigla: p.sigla,
        votos: p.votosValidos,
        cadeirasMaisUm: p.cadeiras + 1,
        media: p.votosValidos / (p.cadeiras + 1),
        qualificado80: p.votosValidos >= barreira80,
        candidatos20disponiveis: cands20Disponiveis[p.sigla] ?? -1,
        participaDaRodada: true,
      }));

      // Adicionar partidos excluídos da rodada para exibição completa
      const excluidosF3 = estado.filter(p => !participantesFase3.includes(p)).map(p => ({
        sigla: p.sigla,
        votos: p.votosValidos,
        cadeirasMaisUm: p.cadeiras + 1,
        media: p.votosValidos / (p.cadeiras + 1),
        qualificado80: p.votosValidos >= barreira80,
        candidatos20disponiveis: cands20Disponiveis[p.sigla] ?? -1,
        participaDaRodada: false,
      }));

      const todasMediasF3 = [...mediasF3, ...excluidosF3].sort((a, b) => b.media - a.media);

      // Vencedor = maior média entre participantes
      const vencedorF3 = mediasF3.reduce((max, p) =>
        p.media > max.media ? p : max, mediasF3[0]);

      const partidoVencedorF3 = estado.find(p => p.sigla === vencedorF3.sigla);
      partidoVencedorF3.cadeiras++;
      partidoVencedorF3.sobrasF3++;

      const candidatoConvocadoF3 = convocarCandidatoQualquer(partidoVencedorF3, jáEleitos);
      if (candidatoConvocadoF3) partidoVencedorF3.eleitos.push(candidatoConvocadoF3);

      auditoria.push({
        rodada,
        fase: 3,
        medias: todasMediasF3,
        vencedor: vencedorF3.sigla,
        mediaVencedor: vencedorF3.media,
        candidatoConvocado: candidatoConvocadoF3,
        fundamentacao: 'Fase 3 — art. 109, III, CE. Sem barreira partidária (ADIs 7.228/7.263/7.325 STF).',
      });

      sobrasRestantes--;
      continue;
    }

    // Fase 2 normal
    const todasMediasF2 = estado.map(p => {
      const eQualificado = p.votosValidos >= barreira80;
      const disp = cands20Disponiveis[p.sigla];
      const temCandidato20 = disp === null || disp === undefined || disp > 0;
      const participa = eQualificado && temCandidato20;
      return {
        sigla: p.sigla,
        votos: p.votosValidos,
        cadeirasMaisUm: p.cadeiras + 1,
        media: p.votosValidos / (p.cadeiras + 1),
        qualificado80: eQualificado,
        candidatos20disponiveis: disp ?? -1,
        participaDaRodada: participa,
      };
    }).sort((a, b) => b.media - a.media);

    const vencedorF2 = qualificados.reduce((max, p) => {
      const media = p.votosValidos / (p.cadeiras + 1);
      const maxMedia = max.votosValidos / (max.cadeiras + 1);
      return media > maxMedia ? p : max;
    }, qualificados[0]);

    vencedorF2.cadeiras++;
    vencedorF2.sobrasF2++;

    // Convocar candidato com >= 20% QE
    const candidatoConvocadoF2 = convocarCandidato(vencedorF2, piso20, jáEleitos);
    if (candidatoConvocadoF2) vencedorF2.eleitos.push(candidatoConvocadoF2);

    // Decrementar contador de candidatos 20% disponíveis
    if (cands20Disponiveis[vencedorF2.sigla] !== null && cands20Disponiveis[vencedorF2.sigla] !== undefined) {
      if (candidatoConvocadoF2) {
        cands20Disponiveis[vencedorF2.sigla]--;
      } else {
        // Sem candidato 20% encontrado, zerar para forçar exclusão na próxima rodada
        cands20Disponiveis[vencedorF2.sigla] = 0;
      }
    }

    const mediaVencedorF2 = vencedorF2.votosValidos / vencedorF2.cadeiras; // já incrementado

    auditoria.push({
      rodada,
      fase: 2,
      medias: todasMediasF2,
      vencedor: vencedorF2.sigla,
      mediaVencedor: vencedorF2.votosValidos / vencedorF2.cadeiras,
      candidatoConvocado: candidatoConvocadoF2,
      fundamentacao: 'Fase 2 — art. 109, II, CE. Barreira 80% QE e piso individual 20% QE (Lei 14.211/2021, constitucional — STF).',
    });

    sobrasRestantes--;
  }

  // 6. Montar resultado por partido
  const resultadoPartidos = estado.map(p => {
    const percentualQE = qe > 0 ? p.votosValidos / qe : 0;
    let status;
    if (p.votosValidos < barreira80 && p.cadeiras === 0) {
      status = 'barrado_80';
    } else if (p.cadeiras > 0 && p.sobrasF3 > 0 && p.qp === 0 && p.sobrasF2 === 0) {
      status = 'fase3_apenas';
    } else if (p.cadeiras > 0) {
      status = 'eleito';
    } else if (p.votosValidos >= barreira80) {
      status = 'qualificado_sem_vaga';
    } else {
      status = 'barrado_80';
    }

    return {
      sigla: p.sigla,
      nome: p.nome,
      votos: p.votosValidos,
      percentualQE,
      qp: p.qp,
      sobrasF2: p.sobrasF2,
      sobrasF3: p.sobrasF3,
      total: p.cadeiras,
      status,
      eleitos: p.eleitos,
      candidatos20Disponiveis: cands20Disponiveis[p.sigla] ?? -1,
    };
  }).sort((a, b) => b.votos - a.votos);

  // 7. Alertas adicionais
  verificarAlertas(estado, barreira80, qe, auditoria, alertas);

  return {
    rotulo: cenario.rotulo,
    vagas: cenario.vagas,
    votosValidos: votosValidos_,
    qe,
    barreira80,
    piso20,
    totalQPs,
    sobras: sobrasTotais,
    partidos: resultadoPartidos,
    auditoria,
    fase3Ativada,
    fase3Motivo,
    alertas,
  };
}

/**
 * Determina o motivo de ativação da Fase 3.
 */
function determinarMotivoFase3(estado, barreira80, cands20Disponiveis) {
  const semBarreira80 = estado.filter(p => p.votosValidos < barreira80);
  const comBarreira80 = estado.filter(p => p.votosValidos >= barreira80);

  if (comBarreira80.length === 0) {
    return 'Nenhum partido atingiu 80% do Quociente Eleitoral. Todos os partidos participam da Fase 3 (STF ADIs 7.228/7.263/7.325).';
  }

  const esgotados = comBarreira80.filter(p => {
    const disp = cands20Disponiveis[p.sigla];
    return disp !== null && disp !== undefined && disp <= 0;
  });

  if (esgotados.length === comBarreira80.length) {
    return `Todos os partidos qualificados (≥ 80% QE) esgotaram seus candidatos com ≥ 20% QE: ${esgotados.map(p => p.sigla).join(', ')}. Fase 3 ativada sem barreira partidária.`;
  }

  return 'Partidos qualificados esgotaram candidatos com 20% QE disponíveis para as sobras restantes.';
}

/**
 * Verifica e registra alertas não-triviais.
 */
function verificarAlertas(estado, barreira80, qe, auditoria, alertas) {
  // Partido barrado que teria maior média que o último vencedor da Fase 2
  const ultimaRodadaF2 = [...auditoria].reverse().find(r => r.fase === 2);
  if (ultimaRodadaF2) {
    const barradosComMediaAlta = estado.filter(p =>
      p.votosValidos < barreira80 &&
      (p.votosValidos / (p.cadeiras + 1)) > ultimaRodadaF2.mediaVencedor
    );
    for (const b of barradosComMediaAlta) {
      alertas.push(
        `ALERTA JURÍDICO: ${b.sigla} foi barrado pela cláusula dos 80% do QE, mas teria média ` +
        `(${(b.votosValidos / (b.cadeiras + 1)).toFixed(2)}) maior que a do último vencedor da Fase 2 ` +
        `(${ultimaRodadaF2.mediaVencedor.toFixed(2)} — ${ultimaRodadaF2.vencedor}). ` +
        `Este é o cenário central das ADIs 7.228/7.263/7.325.`
      );
    }
  }
}

/**
 * Compara dois ResultadoFinal e retorna a variação por partido.
 * @param {ResultadoFinal} original
 * @param {ResultadoFinal} retotalizado
 * @returns {Object} mapa sigla → variação
 */
function compararResultados(original, retotalizado) {
  const variacao = {};
  const siglas = new Set([
    ...original.partidos.map(p => p.sigla),
    ...retotalizado.partidos.map(p => p.sigla),
  ]);

  for (const sigla of siglas) {
    const orig = original.partidos.find(p => p.sigla === sigla);
    const reto = retotalizado.partidos.find(p => p.sigla === sigla);
    const origTotal = orig ? orig.total : 0;
    const retoTotal = reto ? reto.total : 0;
    variacao[sigla] = retoTotal - origTotal;
  }

  return variacao;
}

// ─── Exports ────────────────────────────────────────────────────────────────────

// Compatível com Node.js (testes) e browser (global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcular, compararResultados, aplicarCassacoes, parteInteira };
} else {
  window.ElectoralEngine = { calcular, compararResultados, aplicarCassacoes, parteInteira };
}
