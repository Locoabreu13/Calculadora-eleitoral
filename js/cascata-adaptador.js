// Adaptador de leitura entre a saida do engine e a Cascata Eleitoral.
// Este modulo apenas le os objetos recebidos e monta deltas derivados.
// Nao modifica saidaEngineBase, saidaEngineCenario nem candidatos/partidos internos.

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function normalizarSigla(valor) {
  return String(valor || "").trim();
}

function numeroSeguro(valor) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? n : 0;
}

function listaPartidos(saidaEngine) {
  return saidaEngine && Array.isArray(saidaEngine.partidos)
    ? saidaEngine.partidos
    : [];
}

function siglaDoPartido(partido) {
  return normalizarSigla(
    partido &&
    (partido.sigla || partido.partido || partido.sgPartido || partido.SG_PARTIDO)
  );
}

function cadeirasDoPartido(partido) {
  if (!partido) return 0;
  return numeroSeguro(
    partido.total ??
    partido.cadeiras ??
    partido.vagas ??
    partido.eleitos ??
    partido.qtdCadeiras
  );
}

function candidatosDoPartido(partido) {
  return partido && Array.isArray(partido.candidatos)
    ? partido.candidatos
    : [];
}

function listaCandidatosComPartido(saidaEngine) {
  const candidatos = [];

  for (const partido of listaPartidos(saidaEngine)) {
    const sigla = siglaDoPartido(partido);
    for (const candidato of candidatosDoPartido(partido)) {
      candidatos.push({ candidato, siglaPartido: sigla });
    }
  }

  if (saidaEngine && Array.isArray(saidaEngine.candidatos)) {
    for (const candidato of saidaEngine.candidatos) {
      candidatos.push({
        candidato,
        siglaPartido: normalizarSigla(
          candidato.partido ||
          candidato.sigla ||
          candidato.sgPartido ||
          candidato.SG_PARTIDO
        )
      });
    }
  }

  return candidatos;
}

function idDoCandidato(candidato, siglaPartido) {
  if (!candidato) return "";

  const idPreferencial =
    candidato.sq ??
    candidato.sqCandidato ??
    candidato.SQ_CANDIDATO ??
    candidato.id ??
    candidato.identificador;

  if (idPreferencial !== undefined && idPreferencial !== null && String(idPreferencial).trim() !== "") {
    return "ID:" + String(idPreferencial).trim();
  }

  const numero =
    candidato.numero ??
    candidato.nrCandidato ??
    candidato.NR_CANDIDATO;

  if (numero !== undefined && numero !== null && String(numero).trim() !== "") {
    return "NUM:" + normalizarSigla(siglaPartido) + ":" + String(numero).trim();
  }

  const nome =
    candidato.nome ??
    candidato.NM_CANDIDATO ??
    candidato.nomeUrna ??
    candidato.NM_URNA_CANDIDATO;

  if (nome !== undefined && nome !== null && String(nome).trim() !== "") {
    return "NOME:" + normalizarSigla(siglaPartido) + ":" + normalizarTexto(nome);
  }

  return "";
}

function votosNominaisDoCandidato(candidato) {
  if (!candidato) return 0;
  return numeroSeguro(
    candidato.votosNominaisValidos ??
    candidato.votosNominais ??
    candidato.votos ??
    candidato.QT_VOTOS_NOMINAIS_VALIDOS ??
    candidato.QT_VOTOS_NOMINAIS
  );
}

function partidoDoCandidato(candidato, siglaPartidoHerdada) {
  return normalizarSigla(
    (candidato &&
      (candidato.partido ||
       candidato.sigla ||
       candidato.sgPartido ||
       candidato.SG_PARTIDO)) ||
    siglaPartidoHerdada
  );
}

function candidatoEhMulher(candidato) {
  const genero = normalizarTexto(
    candidato &&
    (candidato.genero ||
     candidato.dsGenero ||
     candidato.DS_GENERO ||
     candidato.sexo)
  );

  return genero === "FEMININO" || genero === "MULHER";
}

function candidatoEhNegro(candidato) {
  const corRaca = normalizarTexto(
    candidato &&
    (candidato.corRaca ||
     candidato.raca ||
     candidato.dsCorRaca ||
     candidato.DS_COR_RACA)
  );

  return corRaca === "PRETA" || corRaca === "PARDA";
}

function candidatoTemVotoEmDobro(candidato) {
  return candidatoEhMulher(candidato) || candidatoEhNegro(candidato);
}

export function gerarCenarioCascata(saidaEngineBase, saidaEngineCenario, categoria) {
  const cenario = {
    tipo: categoria || "cassacao_sem_perda_votos",
    perdaDeVotos: false,
    categoriaClassificada: categoria || "indefinido",
    deltaCadeirasPorPartido: {},
    deltaVotosFEFCPorPartido: {}
  };

  const partidosBase = listaPartidos(saidaEngineBase);
  const partidosCenario = listaPartidos(saidaEngineCenario);

  const cadeirasBase = {};
  const cadeirasCenario = {};
  const siglas = new Set();

  for (const partido of partidosBase) {
    const sigla = siglaDoPartido(partido);
    if (!sigla) continue;
    cadeirasBase[sigla] = cadeirasDoPartido(partido);
    siglas.add(sigla);
  }

  for (const partido of partidosCenario) {
    const sigla = siglaDoPartido(partido);
    if (!sigla) continue;
    cadeirasCenario[sigla] = cadeirasDoPartido(partido);
    siglas.add(sigla);
  }

  for (const sigla of siglas) {
    const delta = (cadeirasCenario[sigla] || 0) - (cadeirasBase[sigla] || 0);
    if (delta !== 0) {
      cenario.deltaCadeirasPorPartido[sigla] = delta;
    }
  }

  const candidatosBase = new Map();

  for (const item of listaCandidatosComPartido(saidaEngineBase)) {
    const chave = idDoCandidato(item.candidato, item.siglaPartido);
    if (!chave) continue;
    candidatosBase.set(chave, item);
  }

  for (const itemCenario of listaCandidatosComPartido(saidaEngineCenario)) {
    const chave = idDoCandidato(itemCenario.candidato, itemCenario.siglaPartido);
    if (!chave) continue;

    const itemBase = candidatosBase.get(chave);
    if (!itemBase) continue;

    const votosBase = votosNominaisDoCandidato(itemBase.candidato);
    const votosCenario = votosNominaisDoCandidato(itemCenario.candidato);
    const deltaVotos = votosCenario - votosBase;

    if (deltaVotos === 0) continue;

    const multiplicador = candidatoTemVotoEmDobro(itemCenario.candidato) ? 2 : 1;
    const deltaPonderado = deltaVotos * multiplicador;
    const sigla = partidoDoCandidato(itemCenario.candidato, itemCenario.siglaPartido);

    if (!sigla) continue;

    cenario.deltaVotosFEFCPorPartido[sigla] =
      (cenario.deltaVotosFEFCPorPartido[sigla] || 0) + deltaPonderado;
  }

  if (Object.keys(cenario.deltaVotosFEFCPorPartido).length > 0 || categoria === "cassacao_com_perda_votos") {
    cenario.perdaDeVotos = true;
  }

  return cenario;
}
