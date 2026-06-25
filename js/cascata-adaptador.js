// Adaptador de leitura entre a saida do engine e a Cascata Eleitoral.
// Este modulo apenas le os objetos recebidos e monta deltas derivados.
// Nao modifica saidaEngineBase, saidaEngineCenario nem candidatos/partidos internos.

export function normalizarTexto(valor) {
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

export function gerarCenarioCascata(saidaEngineBase, saidaEngineCenario, categoria, uf, opts = {}) {
  const ufFinal = uf
    ? String(uf).toUpperCase().trim()
    : (saidaEngineBase && saidaEngineBase.meta && saidaEngineBase.meta.uf)
      ? String(saidaEngineBase.meta.uf).toUpperCase().trim()
      : "";

  const cenario = {
    tipo: categoria || "cassacao_sem_perda_votos",
    perdaDeVotos: false,
    categoriaClassificada: categoria || "indefinido",
    circunscricao: ufFinal,
    deltaCadeirasPorPartido: {},
    deltaVotosFEFCPorPartido: {},
    // Delta de votos SIMPLES (sem voto em dobro), por sigla individual, a ser
    // aplicado na UF da circunscricao. Consumido pela clausula na Etapa 3.
    deltaVotosClausulaPorPartido: {},
    // Avisos de voto em dobro nao garantido (ambiguo, ausente ou sem tabela).
    // A cascata e a peca exibem esses avisos; nunca se dobra em silencio.
    _avisosVotoEmDobro: []
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

  // ── Delta de votos a partir das cassacoes digitadas (Fase 5) ───────────────
  // Caminho recomendado: ler as cassacoes direto (opts.cassacoes), em vez de
  // comparar listas de candidatos (que a saida do engine nao expoe). Aplica o
  // voto em dobro da EC 111/2021 cruzando nome+partido normalizados contra a
  // tabela de genero/raca. So roda quando o chamador fornece opts.cassacoes;
  // sem isso, o comportamento e identico ao anterior (compatibilidade retroativa).
  const cassacoes = Array.isArray(opts.cassacoes) ? opts.cassacoes : null;
  if (cassacoes) {
    const cargoNormalizado = normalizarTexto(opts.cargo || "");
    // Votos do candidato cassado so integram FEFC 35% e clausula quando o cargo
    // for Deputado Federal. Se opts.cargo estiver ausente, assume federal (retrocompatibilidade).
    const ehDeputadoFederal = !cargoNormalizado || cargoNormalizado === "DEPUTADO FEDERAL";
    if (ehDeputadoFederal) {
    const tabela = (opts.tabelaGeneroRaca && opts.tabelaGeneroRaca.candidatos) || null;
    const votosNacionais = (opts.dadosReferencia && opts.dadosReferencia.fefc
      && opts.dadosReferencia.fefc.votosPorPartido) || null;

    // Indice normalizado das chaves nacionais do FEFC (ex.: "UNIAO" -> "UNIÃO";
    // "PC DO B" -> "PC do B"), para casar a sigla da cassacao com a base oficial
    // reaproveitando o mesmo normalizarTexto, sem inventar tabela de traducao.
    const indiceNacional = {};
    if (votosNacionais) {
      for (const chaveOficial of Object.keys(votosNacionais)) {
        indiceNacional[normalizarTexto(chaveOficial)] = chaveOficial;
      }
    }

    for (const cass of cassacoes) {
      const partidoCass = normalizarSigla(cass && (cass.partido || cass.sigla));
      const nomeCass = (cass && cass.candidato) ? String(cass.candidato) : "";
      const votosAnular = numeroSeguro(cass && cass.votosAnular);
      const modalidade = String((cass && cass.modalidade) || "");
      // DRAP nao remove votos nominais de um candidato especifico; ignorado aqui.
      if (!partidoCass || votosAnular <= 0 || modalidade === "cassacao_drap") continue;

      // Membros: para federacao (sigla com "/"), tentar cada partido individual.
      // ATENCAO: o caminho de FEDERACAO (mais de um membro) NAO e exercitado por
      // nenhum teste real nesta fase. O caso validado (Heitor, UNIAO) e partido
      // individual, entao membros = ["UNIAO"] e a federacao fica sem cobertura.
      const membros = partidoCass.split("/").map((s) => s.trim()).filter(Boolean);
      const ehFederacao = membros.length > 1;

      // Resolve o voto em dobro pela tabela. A correspondencia e por IGUALDADE
      // EXATA da chave "NOME|PARTIDO" normalizada (lookup de propriedade no
      // objeto tabela), nunca por substring/includes.
      let multiplicador = 1;
      let membroResolvido = membros[0];
      let statusDobro = "sem_tabela";
      if (tabela && nomeCass) {
        const achados = [];
        for (const membro of membros) {
          const chave = normalizarTexto(nomeCass) + "|" + normalizarTexto(membro);
          const entrada = tabela[chave];
          if (entrada) achados.push({ membro, entrada });
        }
        if (achados.length === 0) {
          statusDobro = "ausente";
        } else if (achados.some((a) => a.entrada.ambiguo)) {
          statusDobro = "ambiguo";
        } else if (new Set(achados.map((a) => !!a.entrada.votoEmDobro)).size > 1) {
          statusDobro = "ambiguo"; // membros divergem (so possivel em federacao)
        } else {
          statusDobro = "ok";
          membroResolvido = achados[0].membro;
          multiplicador = achados[0].entrada.votoEmDobro ? 2 : 1;
        }
      }

      // Nunca dobra em silencio: quando nao houver resposta garantida, registra
      // o aviso visivel e usa multiplicador 1 (condicao 1 do escopo aprovado).
      if (statusDobro !== "ok") {
        cenario._avisosVotoEmDobro.push({
          candidato: nomeCass, partido: partidoCass,
          motivo: statusDobro, federacao: ehFederacao
        });
      }

      // FEFC (fatia de 35%) e Fundo Partidario (faixa de 95%): delta PONDERADO
      // (com voto em dobro), base NACIONAL. Cassacao REMOVE votos, entao o delta
      // e NEGATIVO na chave do partido cassado.
      // Caso Heitor: votosAnular 48888 * multiplicador 2 = 97776 -> -97776 em "UNIÃO".
      const deltaPonderado = votosAnular * multiplicador;
      const chaveNacional = indiceNacional[normalizarTexto(membroResolvido)] || null;
      if (chaveNacional) {
        cenario.deltaVotosFEFCPorPartido[chaveNacional] =
          (cenario.deltaVotosFEFCPorPartido[chaveNacional] || 0) - deltaPonderado;
      } else if (votosNacionais) {
        cenario._avisosVotoEmDobro.push({
          candidato: nomeCass, partido: partidoCass,
          motivo: "sigla_nao_mapeada_no_fefc", federacao: ehFederacao
        });
      }

      // Clausula de desempenho: delta SIMPLES (SEM voto em dobro), por sigla
      // individual, representando a queda de votos DENTRO da UF da circunscricao
      // (cenario.circunscricao), NAO um total nacional. Tambem NEGATIVO.
      // A Etapa 3 deve aplicar este mesmo numero absoluto aos DOIS patamares da
      // clausula (percentual nacional e percentual minimo por UF), cada um com
      // SEU denominador; nunca somar como se fosse so um total nacional.
      //
      // VALIDACAO DE SIGLA ADIADA PARA A ETAPA 3 (deliberado): diferente do delta
      // de FEFC, que so e gravado quando a sigla casa com fefc.votosPorPartido,
      // este campo e gravado direto com membroResolvido, SEM verificar aqui se a
      // sigla e reconhecida pela clausula. A base de reconhecimento da clausula
      // (mapeamentoSiglaParaEntidade + cadeirasPorEntidadePorUF / statusVotosPorEntidade)
      // e propria da clausula, e a verificacao correta pertence a calcularClausula
      // (Etapa 3), que ja possui o mecanismo de _siglasNaoMapeadas para sinalizar
      // siglas desconhecidas com o mesmo padrao de aviso. Ate la, este campo pode
      // conter siglas ainda nao verificadas.
      cenario.deltaVotosClausulaPorPartido[membroResolvido] =
        (cenario.deltaVotosClausulaPorPartido[membroResolvido] || 0) - votosAnular;
    }
    } // fecha if (ehDeputadoFederal)
  }

  if (Object.keys(cenario.deltaVotosFEFCPorPartido).length > 0 ||
      Object.keys(cenario.deltaVotosClausulaPorPartido).length > 0 ||
      categoria === "cassacao_com_perda_votos") {
    cenario.perdaDeVotos = true;
  }

  return cenario;
}
