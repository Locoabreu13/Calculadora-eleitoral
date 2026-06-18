// Adaptador de leitura entre o engine e a cascata.
// Le a saida do engine (somente leitura) e devolve o objeto cenario
// que a cascata consome, com deltaCadeirasPorPartido preenchido.
// Nunca modifica o engine. Se este arquivo for apagado, o engine segue identico.

import { compararResultados } from "./engine.js";

// Normaliza apenas para COMPARAR siglas (tira acento, caixa e espacos).
function chaveNormalizada(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

// Monta um indice: grafia normalizada -> grafia oficial da referencia.
function indiceGrafiaOficial(dadosReferencia) {
  const indice = {};
  const tabela =
    dadosReferencia &&
    dadosReferencia.fefc &&
    dadosReferencia.fefc.cadeirasPorPartido
      ? dadosReferencia.fefc.cadeirasPorPartido
      : {};
  for (const siglaOficial of Object.keys(tabela)) {
    indice[chaveNormalizada(siglaOficial)] = siglaOficial;
  }
  return indice;
}

// Recebe as duas saidas do engine e devolve o delta por partido,
// ja com a grafia oficial da referencia como chave, descartando os zeros.
export function montarDeltaCadeiras(saidaEngineBase, saidaEngineCenario, dadosReferencia) {
  const variacao = compararResultados(saidaEngineBase, saidaEngineCenario);
  const indice = indiceGrafiaOficial(dadosReferencia);
  const delta = {};
  const naoMapeadas = [];

  for (const [siglaEngine, valor] of Object.entries(variacao)) {
    if (!valor) continue; // descarta variacao zero
    const chave = chaveNormalizada(siglaEngine);
    const siglaOficial = indice[chave];
    if (siglaOficial) {
      delta[siglaOficial] = (delta[siglaOficial] || 0) + valor;
    } else {
      // nao achou correspondente na referencia: registra para auditoria,
      // mas mantem a sigla do engine para nao perder o valor silenciosamente.
      delta[siglaEngine] = (delta[siglaEngine] || 0) + valor;
      naoMapeadas.push(siglaEngine);
    }
  }

  return { delta, naoMapeadas };
}

// Monta o objeto cenario completo que a cascata consome.
// dadosCenario traz os campos juridicos conhecidos: tipo, perdaDeVotos, circunscricao.
export function montarCenarioCascata(saidaEngineBase, saidaEngineCenario, dadosReferencia, dadosCenario = {}) {
  const { delta, naoMapeadas } = montarDeltaCadeiras(
    saidaEngineBase,
    saidaEngineCenario,
    dadosReferencia
  );

  return {
    tipo: dadosCenario.tipo,
    perdaDeVotos: dadosCenario.perdaDeVotos,
    circunscricao: dadosCenario.circunscricao,
    deltaCadeirasPorPartido: delta,
    _siglasNaoMapeadas: naoMapeadas
  };
}
