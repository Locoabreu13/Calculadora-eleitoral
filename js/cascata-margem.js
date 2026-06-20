// cascata-margem.js — Calcula a margem para virar a ultima cadeira (sobra D'Hondt).
//
// Modulo puro: sem DOM, sem imports. Recebe calcularFn por injecao.
//
// Funcao exportada:
//   calcularMargemUltimaCadeira(saidaEngine, cenarioOriginal, calcularFn)
//
// Parametros:
//   saidaEngine     — saida do engine para o cenario base (objeto ResultadoFinal)
//   cenarioOriginal — cenario original passado ao engine (objeto Cenario, nao modificado)
//   calcularFn      — referencia a funcao calcular do engine, injetada pelo chamador

function clonarProfundamente(valor) {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }
  return JSON.parse(JSON.stringify(valor));
}

function totalCadeirasDoPartido(saidaEngine, sigla) {
  const p = saidaEngine.partidos.find(x => x.sigla === sigla);
  return p ? (p.total || 0) : 0;
}

// A margem e calculada adicionando votos a votosLegenda do partido alvo, nao a um
// candidato individual. Isso e uma decisao de escopo: mede o quanto o partido
// precisaria crescer nas urnas (como legenda) para virar a cadeira, sem pressupor
// qual candidato receberia esses votos. Partidos travados pelo piso individual de
// 20% do QE na Fase 2 recebem votosNecessarios nulo porque adicionar votos de
// legenda nao altera a contagem de candidatos disponiveis com >= 20% QE, que e
// feita sobre os votos nominais individuais. Essa e uma limitacao de escopo
// declarada, nao uma falha do calculo.

function ganhouCadeiraAdicionandoVotos(cenarioOriginal, sigla, cadeirasOriginais, votosAdicionais, calcularFn) {
  const clone = clonarProfundamente(cenarioOriginal);
  const partido = clone.partidos.find(x => x.sigla === sigla);
  if (!partido) return false;
  partido.votosLegenda = (partido.votosLegenda || 0) + votosAdicionais;
  const resultado = calcularFn(clone);
  const pRes = resultado.partidos.find(x => x.sigla === sigla);
  return pRes ? pRes.total > cadeirasOriginais : false;
}

function buscarMargemMinima(cenarioOriginal, sigla, cadeirasOriginais, calcularFn) {
  const totalVotosBase = cenarioOriginal.partidos.reduce(
    (s, p) => s + (p.votosNominais || 0) + (p.votosLegenda || 0), 0
  );

  // Teto generoso: total de votos da eleicao. Qualquer partido com esse total
  // venceria todas as rodadas. Se nem assim ganhar, o motivo e estrutural
  // (ex.: sem candidatos disponiveis) e retornamos nulo.
  if (!ganhouCadeiraAdicionandoVotos(cenarioOriginal, sigla, cadeirasOriginais, totalVotosBase, calcularFn)) {
    return null;
  }

  let baixo = 1;
  let alto = totalVotosBase;

  while (baixo < alto) {
    const meio = Math.floor((baixo + alto) / 2);
    if (ganhouCadeiraAdicionandoVotos(cenarioOriginal, sigla, cadeirasOriginais, meio, calcularFn)) {
      alto = meio;
    } else {
      baixo = meio + 1;
    }
  }

  return baixo;
}

export function calcularMargemUltimaCadeira(saidaEngine, cenarioOriginal, calcularFn) {
  if (
    !saidaEngine ||
    !Array.isArray(saidaEngine.auditoria) ||
    saidaEngine.auditoria.length === 0
  ) {
    return {
      status: "sem_sobras",
      observacao: "Nenhuma sobra distribuida por D'Hondt. Todos os partidos atingiram QE exato ou o cenario nao gerou rodadas de sobra."
    };
  }

  const ultimaRodada = saidaEngine.auditoria[saidaEngine.auditoria.length - 1];
  const siglaVencedor = ultimaRodada.vencedor;
  const faseUltima = ultimaRodada.fase; // 2 ou 3 — lido uma vez, usado em classificarExclusao

  // Identificar o ultimo eleito do partido vencedor da ultima rodada.
  // A lista eleitos e construida pelo engine em ordem de convocacao:
  // os qp primeiros sao da Fase 1, os subsequentes sao das sobras.
  // O ultimo elemento e sempre o candidato da cadeira mais recem-distribuida.
  const partidoVencedor = saidaEngine.partidos.find(p => p.sigla === siglaVencedor);
  const ultimoEleito =
    partidoVencedor &&
    Array.isArray(partidoVencedor.eleitos) &&
    partidoVencedor.eleitos.length > 0
      ? partidoVencedor.eleitos[partidoVencedor.eleitos.length - 1]
      : null;

  // Classifica o motivo de exclusao de um partido nao-vencedor na ultima rodada.
  // A verificacao explicita de faseUltima garante que a regra do piso de 20% do QE
  // (exclusiva da Fase 2) nao seja aplicada por engano a rodadas de Fase 3,
  // onde esse piso nao existe e a exclusao tem outra causa.
  function classificarExclusao(m) {
    if (m.participaDaRodada) return null;
    if (faseUltima === 2 && !m.qualificado80) return "barreira_80";
    if (faseUltima === 2 && m.candidatos20disponiveis === 0) return "candidato_trava_20pct";
    if (faseUltima === 3) return "sem_candidatos_disponiveis";
    return "excluido_outros";
  }

  // Um partido e calculavel quando adicionar votos de legenda pode desbloqueio-lo:
  // - Participa da rodada (PARTICIPA): sim, votos a mais aumentam a media.
  // - Barrado pela barreira de 80% do QE: sim, votos a mais podem cruzar o limiar.
  // - Travado pelo piso individual de 20% do QE (Fase 2): NAO — a trava e sobre
  //   votos nominais individuais de candidatos, nao sobre o total de legenda.
  // - Sem candidatos disponiveis (Fase 3): NAO — a causa e estrutural, nao de votos.
  function ehCalculavel(tipoExclusao) {
    return tipoExclusao === null || tipoExclusao === "barreira_80";
  }

  const candidatos = [];

  for (const m of ultimaRodada.medias) {
    if (m.sigla === siglaVencedor) continue;

    const tipoExclusao = classificarExclusao(m);
    const calculavel = ehCalculavel(tipoExclusao);
    const cadeirasAtuais = totalCadeirasDoPartido(saidaEngine, m.sigla);

    let votosNecessarios = null;
    if (calculavel) {
      votosNecessarios = buscarMargemMinima(
        cenarioOriginal,
        m.sigla,
        cadeirasAtuais,
        calcularFn
      );
    }

    candidatos.push({
      sigla: m.sigla,
      votos: m.votos,
      cadeirasMaisUm: m.cadeirasMaisUm,
      media: m.media,
      participava: m.participaDaRodada,
      qualificado80: m.qualificado80,
      tipoExclusao,
      calculavel,
      cadeirasAtuais,
      votosNecessarios
    });
  }

  // Ordena pelo menor votosNecessarios (nulos ao final).
  candidatos.sort((a, b) => {
    if (a.votosNecessarios === null && b.votosNecessarios === null) return 0;
    if (a.votosNecessarios === null) return 1;
    if (b.votosNecessarios === null) return -1;
    return a.votosNecessarios - b.votosNecessarios;
  });

  const primeiroFora = candidatos.find(c => c.votosNecessarios !== null) || null;
  const demaisCandidatos = candidatos.filter(c => c !== primeiroFora);

  return {
    status: "ok",
    faseUltima,
    ultimaCadeira: {
      sigla: siglaVencedor,
      rodada: ultimaRodada.rodada,
      fase: faseUltima,
      media: ultimaRodada.mediaVencedor,
      cadeirasVencedor: totalCadeirasDoPartido(saidaEngine, siglaVencedor),
      ultimoEleito
    },
    primeiroFora,
    demaisCandidatos
  };
}
