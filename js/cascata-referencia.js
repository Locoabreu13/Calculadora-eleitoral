export const dadosReferencia = {
  // Valor total do FEFC a ser obtido em dado oficial do TSE para o ciclo eleitoral analisado.
  valorTotalFEFC: null,

  // Valor total do Fundo Partidario a ser obtido em dado oficial do TSE ou fonte normativa aplicavel.
  valorTotalFundoPartidario: null,

  // Tempo total de propaganda a ser obtido nas regras oficiais de distribuicao da eleicao analisada.
  tempoTotalTV: null,

  // Bancada do Senado por partido a ser preenchida a partir de dado oficial do TSE/Senado na data de corte aplicavel.
  bancadaSenadoPorPartido: {},

  // Votos validos da Camara por partido a serem preenchidos a partir da totalizacao oficial do TSE.
  votosCamaraPorPartido: {},

  // Cadeiras da Camara por partido a serem preenchidas a partir da totalizacao oficial do TSE.
  cadeirasCamaraPorPartido: {},

  clausula: {
    // Ano da regra vigente da clausula de desempenho, conforme legislacao eleitoral aplicavel.
    anoVigente: null,

    // Percentual nacional de votos exigido, conforme legislacao eleitoral aplicavel.
    percentualVotos: 0,

    // Numero minimo de estados exigido, conforme legislacao eleitoral aplicavel.
    minimoEstados: 0,

    // Percentual minimo por estado exigido, conforme legislacao eleitoral aplicavel.
    percentualMinimoPorEstado: 0,

    // Numero minimo de deputados exigido, conforme legislacao eleitoral aplicavel.
    minimoDeputados: 0
  },

  cortes: {
    // Data de corte do FEFC conforme regra oficial aplicavel.
    fefc: "primeiro_dia_util_junho",

    // Data de corte do tempo de TV conforme regra oficial aplicavel.
    tempoTV: "20_julho"
  }
};
