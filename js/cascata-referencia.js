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

  // Portaria TSE 739/2022, anexo.
  // Fonte local: data/tse/anexo-portaria-739-2022.pdf
  // Base para tempo de propaganda eleitoral gratuita em radio e TV:
  // representacao na Camara dos Deputados, total 507.
  // No anexo, todos os listados tem "sim" na coluna "Alcancou requisito art. 17 §3º CF",
  // entao todos participam da divisao do tempo. Porta de entrada do tempo de TV:
  // ter ao menos uma cadeira na Camara. Um partido que perca sua ultima cadeira
  // numa retotalizacao sai inteiro da divisao, nao perde so uma fracao.
  // Este e o limiar de maior alavancagem do no.
  // A outra tabela do PDF, "Representacao no Congresso Nacional", total 588,
  // e usada para participacao em debates, nao para tempo de TV.
  // Notas do anexo: PR virou PL; PRB virou Republicanos; PPS virou Cidadania;
  // PRP foi incorporado pelo Patriota; PHS foi incorporado pelo Pode;
  // PPL foi incorporado pelo PCdoB; DEM e PSL formaram Uniao Brasil.
  tempoTVCamara2022: {
    totalCamara: 507,
    cadeirasPorPartido: {
      "AVANTE": 7,
      "FEDERAÇÃO BRASIL DA ESPERANÇA": 70, // PT, PC do B, PV
      "FEDERAÇÃO PSDB CIDADANIA": 37, // PSDB, Cidadania
      "FEDERAÇÃO PSOL REDE": 11, // PSOL, Rede
      "MDB": 34,
      "NOVO": 8,
      "PATRIOTA": 9,
      "PDT": 28,
      "PL": 33,
      "PODE": 17,
      "PP": 38,
      "PROS": 8,
      "PSB": 32,
      "PSC": 7,
      "PSD": 35,
      "PTB": 10,
      "REPUBLICANOS": 29,
      "SOLIDARIEDADE": 13,
      "UNIÃO": 81
    }
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

  vagasDeputadoFederal2022PorUF: {
    fonte: "js/tse-direto.js, objeto VAGAS, chave 'Deputado Federal'; soma 513",
    porUF: {
      AC:  8, AL:  9, AM:  8, AP:  8, BA: 39, CE: 22, DF:  8,
      ES: 10, GO: 17, MA: 18, MG: 53, MS:  8, MT:  8, PA: 17,
      PB: 12, PE: 25, PI: 10, PR: 30, RJ: 46, RN:  8, RO:  8,
      RR:  8, RS: 31, SC: 16, SE:  8, SP: 70, TO:  8
    }
  },

  clausula: {
    fonteLegal: "EC 97/2017, art. 3, paragrafo unico; art. 17, paragrafo 3, da CF/1988",
    observacao: "O patamar que governa o acesso numa legislatura e o da eleicao geral anterior. A legislatura seguinte as eleicoes de 2022 vai ate fevereiro de 2027; ate la vale o patamar de 2022 (inciso II). Os criterios sao alternativos: votos OU cadeiras. Ambos exigem espalhamento em ufsMinimas estados.",
    patamaresPorEleicao: {
      2018: {
        votosValidosPct: 1.5,
        votosMinimoPorUFPct: 1.0,
        ufsMinimas: 9,
        deputadosMinimos: 9,
        incisoEC97: "I"
      },
      2022: {
        votosValidosPct: 2.0,
        votosMinimoPorUFPct: 1.0,
        ufsMinimas: 9,
        deputadosMinimos: 11,
        incisoEC97: "II"
      },
      2026: {
        votosValidosPct: 2.5,
        votosMinimoPorUFPct: 1.5,
        ufsMinimas: 9,
        deputadosMinimos: 13,
        incisoEC97: "III"
      },
      2030: {
        votosValidosPct: 3.0,
        votosMinimoPorUFPct: 2.0,
        ufsMinimas: 9,
        deputadosMinimos: 15,
        incisoEC97: "caput (regime pleno)"
      }
    },
    gabarito2022: {
      fonte: "Portaria TSE no 10/2023",
      atingiramPelasUrnas: ["FE Brasil (PT/PCdoB/PV)", "PSDB/Cidadania", "PSOL/Rede", "MDB", "PDT", "PL", "PODE", "PP", "PSB", "PSD", "REPUBLICANOS", "UNIAO"],
      naoAtingiramComDeputados: ["AVANTE", "PSC", "SOLIDARIEDADE", "PATRIOTA", "PTB", "NOVO", "PROS"],
      naoAtingiramSemDeputados: ["AGIR", "DC", "PCB", "PCO", "PMB", "PMN", "PRTB", "PSTU", "UP"],
      nota: "AVANTE e SOLIDARIEDADE entraram na lista oficial so em 2023, por incorporacao do PROS, nao por desempenho nas urnas. Para validar este no, vale o resultado das urnas."
    }
  },

  cortes: {
    // Data de corte do FEFC conforme regra oficial aplicavel.
    fefc: "primeiro_dia_util_junho",

    // Data de corte do tempo de TV conforme regra oficial aplicavel.
    tempoTV: "20_julho"
  }
};
