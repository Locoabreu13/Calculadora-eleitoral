export const dadosReferencia = {
  // Valor total do FEFC a ser obtido em dado oficial do TSE para o ciclo eleitoral analisado.
  valorTotalFEFC: null,

  fefc: {
    valorTotal: 4961519777,
    poolDois: 99230395.50,
    poolVotos: 1736531922,
    poolCadeiras: 2381529493,
    poolSenado: 744227966.60,
    percentuais: { dois: 0.02, votos: 0.35, cadeiras: 0.48, senado: 0.15 },
    totalCadeiras: 513,
    totalSenadores: 81,
    totalPartidosRegistrados: 30,
    cadeirasPorPartido: {
      "AGIR":0,"AVANTE":7,"CIDADANIA":5,"DC":0,"DEMOCRATA":0,"MDB":41,
      "MISSÃO":0,"MOBILIZA":0,"NOVO":3,"PC do B":7,"PCB":0,"PCO":0,"PDT":16,
      "PL":98,"PODE":20,"PP":47,"PRD":5,"PRTB":0,"PSB":15,"PSD":42,"PSDB":13,
      "PSOL":13,"PSTU":0,"PT":68,"PV":6,"REDE":2,"REPUBLICANOS":41,
      "SOLIDARIEDADE":7,"UNIÃO":57,"UP":0
    },
    senadoresPorPartido: {
      "CIDADANIA":1,"MDB":9,"PDT":3,"PL":15,"PODE":7,"PP":6,"PSB":1,"PSD":11,
      "PSDB":4,"PT":9,"REDE":1,"REPUBLICANOS":3,"SOLIDARIEDADE":1,"UNIÃO":10
    }
    // votosPorPartido fica pendente: depende do voto em dobro (EC 117), TC-01b.
  },

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
