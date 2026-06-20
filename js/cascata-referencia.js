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
    },
    votosPorPartido: {
      "AGIR": 252112,
      "AVANTE": 3194896,
      "CIDADANIA": 2129202,
      "DC": 141390,
      "MDB": 10761792,
      "MISSÃO": 104610,
      "MOBILIZA": 370667,
      "NOVO": 1723908,
      "PC do B": 2151919,
      "PCB": 139627,
      "PCO": 9688,
      "PDT": 5581426,
      "PL": 24852355,
      "PODE": 7440504,
      "PP": 12221833,
      "PRD": 3942190,
      "PRTB": 378549,
      "PSB": 6102326,
      "PSD": 10586856,
      "PSDB": 4132346,
      "PSOL": 5904436,
      "PSTU": 39386,
      "PT": 18596095,
      "PV": 1220262,
      "REDE": 1220382,
      "REPUBLICANOS": 11085138,
      "SOLIDARIEDADE": 3788568,
      "UNIÃO": 14582207,
      "UP": 98906
    }
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
    // Duracao legal do bloco de propaganda de deputado federal: 12min30s
    // (750 segundos), por bloco, igual para qualquer unidade da federacao.
    // Base legal: art. 47, par. 1o, inciso II, alinea "a" da Lei 9.504/1997
    // (redacao dada pela Lei 13.165/2015). Validado contra o cronograma
    // oficial do TRE-CE e do TRE-DF, Eleicoes 2022 (mesmos horarios,
    // 7h12m30 as 7h25 e 12h12m30 as 12h25, em ambos os tribunais).
    totalSegundosBloco: 750,
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

  // Federacoes vigentes no ciclo eleitoral de 2022, usadas para traduzir a
  // sigla individual de partido (como aparece nos arquivos de estado, ex. CE)
  // para a sigla combinada da federacao usada na tabela tempoTVCamara2022.
  federacoesTV2022: {
    "FEDERAÇÃO BRASIL DA ESPERANÇA": ["PT", "PC do B", "PV"],
    "FEDERAÇÃO PSDB CIDADANIA": ["PSDB", "CIDADANIA"],
    "FEDERAÇÃO PSOL REDE": ["PSOL", "REDE"]
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

  clausulaLinhaDeBase2022: {
  "fonte": "Resultado TSE 2022 processado via conferencia-clausula-base.mjs; soma cadeiras = 513",
  "anoEleicao": 2022,
  "mapeamentoSiglaParaEntidade": {
    "PT": "FE Brasil (PT/PC do B/PV)",
    "PC do B": "FE Brasil (PT/PC do B/PV)",
    "PV": "FE Brasil (PT/PC do B/PV)",
    "PT/PC do B/PV": "FE Brasil (PT/PC do B/PV)",
    "PSDB": "PSDB/Cidadania",
    "CIDADANIA": "PSDB/Cidadania",
    "PSDB/CIDADANIA": "PSDB/Cidadania",
    "PSOL": "PSOL/Rede",
    "REDE": "PSOL/Rede",
    "PSOL/REDE": "PSOL/Rede"
  },
  "totalVotosPorUF": {
    "AC": 434253,
    "AL": 1626009,
    "AM": 1976477,
    "AP": 423017,
    "BA": 7958431,
    "CE": 5083860,
    "DF": 1607519,
    "ES": 2084430,
    "GO": 3439644,
    "MA": 3707930,
    "MG": 11181098,
    "MS": 1353024,
    "MT": 1730277,
    "PA": 4521516,
    "PB": 2209355,
    "PE": 4969863,
    "PI": 1957483,
    "PR": 6038642,
    "RJ": 8575988,
    "RN": 1864825,
    "RO": 869148,
    "RR": 291714,
    "RS": 6149822,
    "SC": 3969848,
    "SE": 1191617,
    "SP": 23302342,
    "TO": 830140
  },
  "cadeirasPorEntidadePorUF": {
    "FE Brasil (PT/PC do B/PV)": {
      "AL": 1,
      "AP": 1,
      "BA": 10,
      "CE": 3,
      "DF": 2,
      "ES": 2,
      "GO": 2,
      "MA": 2,
      "MG": 10,
      "MS": 2,
      "PA": 2,
      "PB": 1,
      "PE": 3,
      "PI": 5,
      "PR": 6,
      "RJ": 6,
      "RN": 2,
      "RS": 7,
      "SC": 2,
      "SE": 1,
      "SP": 11
    },
    "PSDB/Cidadania": {
      "AM": 1,
      "BA": 1,
      "GO": 1,
      "MG": 2,
      "MS": 3,
      "PR": 1,
      "RS": 3,
      "SC": 1,
      "SP": 5
    },
    "PSOL/Rede": {
      "AP": 1,
      "MG": 1,
      "PE": 1,
      "RJ": 5,
      "RS": 1,
      "SP": 6
    },
    "PP": {
      "AC": 3,
      "AL": 4,
      "AP": 1,
      "BA": 4,
      "CE": 1,
      "ES": 2,
      "GO": 2,
      "MA": 2,
      "MG": 3,
      "MS": 1,
      "PB": 2,
      "PE": 4,
      "PI": 2,
      "PR": 4,
      "RJ": 3,
      "RS": 3,
      "SE": 1,
      "SP": 4,
      "TO": 1
    },
    "UNIÃO": {
      "AC": 3,
      "AL": 1,
      "AM": 2,
      "BA": 6,
      "CE": 4,
      "GO": 2,
      "MA": 2,
      "MG": 3,
      "MT": 2,
      "PA": 1,
      "PB": 1,
      "PE": 3,
      "PR": 4,
      "RJ": 6,
      "RN": 2,
      "RO": 3,
      "RR": 2,
      "RS": 1,
      "SC": 1,
      "SE": 2,
      "SP": 6,
      "TO": 1
    },
    "REPUBLICANOS": {
      "AC": 2,
      "AL": 1,
      "AM": 2,
      "AP": 1,
      "BA": 3,
      "DF": 2,
      "ES": 2,
      "GO": 1,
      "MA": 1,
      "MG": 2,
      "PB": 3,
      "PE": 2,
      "PR": 1,
      "RJ": 3,
      "RR": 3,
      "RS": 3,
      "SE": 1,
      "SP": 5,
      "TO": 3
    },
    "MDB": {
      "AL": 2,
      "AP": 1,
      "BA": 1,
      "CE": 1,
      "DF": 1,
      "GO": 2,
      "MA": 1,
      "MG": 2,
      "MT": 2,
      "PA": 9,
      "PE": 1,
      "PR": 1,
      "RJ": 2,
      "RO": 2,
      "RR": 2,
      "RS": 3,
      "SC": 3,
      "SP": 5
    },
    "PSD": {
      "AM": 2,
      "BA": 6,
      "CE": 3,
      "GO": 1,
      "MA": 1,
      "MG": 4,
      "PA": 2,
      "PI": 3,
      "PR": 6,
      "RJ": 4,
      "RR": 1,
      "RS": 1,
      "SC": 2,
      "SE": 2,
      "SP": 3
    },
    "PDT": {
      "AP": 2,
      "BA": 2,
      "CE": 5,
      "GO": 1,
      "MA": 1,
      "MG": 2,
      "RJ": 1,
      "RS": 2
    },
    "PODE": {
      "BA": 1,
      "ES": 2,
      "MA": 1,
      "MG": 2,
      "PR": 2,
      "RJ": 1,
      "RO": 1,
      "RS": 1,
      "SP": 3,
      "TO": 1
    },
    "PSB": {
      "BA": 1,
      "DF": 1,
      "ES": 1,
      "MA": 1,
      "PB": 1,
      "PE": 5,
      "PR": 1,
      "RJ": 1,
      "RS": 1,
      "SP": 2
    },
    "SOLIDARIEDADE": {
      "MG": 1,
      "PE": 1,
      "RJ": 1,
      "SP": 1
    },
    "PATRIOTA": {
      "MA": 1,
      "MG": 3
    },
    "PROS": {
      "MG": 1,
      "PR": 1,
      "RJ": 1
    },
    "PSC": {
      "GO": 1,
      "MA": 1,
      "MG": 1,
      "PB": 2,
      "SP": 1
    },
    "PTB": {
      "RJ": 1
    },
    "AVANTE": {
      "BA": 1,
      "MG": 5,
      "PE": 1
    },
    "PL": {
      "AM": 1,
      "AP": 1,
      "BA": 3,
      "CE": 5,
      "DF": 2,
      "ES": 1,
      "GO": 4,
      "MA": 4,
      "MG": 11,
      "MS": 2,
      "MT": 4,
      "PA": 3,
      "PB": 2,
      "PE": 4,
      "PR": 3,
      "RJ": 11,
      "RN": 4,
      "RO": 2,
      "RS": 4,
      "SC": 6,
      "SE": 1,
      "SP": 17,
      "TO": 2
    },
    "NOVO": {
      "RS": 1,
      "SC": 1,
      "SP": 1
    }
  },
  "statusVotosPorEntidade": {
    "FE Brasil (PT/PC do B/PV)": {
      "cumpriuPorVotos": true,
      "pctNacional": 14.034,
      "ufsComPctMinimo": 27
    },
    "PSDB/Cidadania": {
      "cumpriuPorVotos": true,
      "pctNacional": 4.5023,
      "ufsComPctMinimo": 22
    },
    "PSOL/Rede": {
      "cumpriuPorVotos": true,
      "pctNacional": 4.2389,
      "ufsComPctMinimo": 15
    },
    "PP": {
      "cumpriuPorVotos": true,
      "pctNacional": 7.9271,
      "ufsComPctMinimo": 25
    },
    "UNIÃO": {
      "cumpriuPorVotos": true,
      "pctNacional": 9.3421,
      "ufsComPctMinimo": 26
    },
    "REPUBLICANOS": {
      "cumpriuPorVotos": true,
      "pctNacional": 6.9602,
      "ufsComPctMinimo": 27
    },
    "MDB": {
      "cumpriuPorVotos": true,
      "pctNacional": 7.2712,
      "ufsComPctMinimo": 24
    },
    "PSD": {
      "cumpriuPorVotos": true,
      "pctNacional": 7.5849,
      "ufsComPctMinimo": 24
    },
    "PDT": {
      "cumpriuPorVotos": true,
      "pctNacional": 3.5011,
      "ufsComPctMinimo": 18
    },
    "PODE": {
      "cumpriuPorVotos": true,
      "pctNacional": 3.3033,
      "ufsComPctMinimo": 17
    },
    "PSB": {
      "cumpriuPorVotos": true,
      "pctNacional": 3.818,
      "ufsComPctMinimo": 22
    },
    "SOLIDARIEDADE": {
      "cumpriuPorVotos": false,
      "pctNacional": 1.557,
      "ufsComPctMinimo": 10
    },
    "PATRIOTA": {
      "cumpriuPorVotos": false,
      "pctNacional": 1.3961,
      "ufsComPctMinimo": 6
    },
    "PROS": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.7313,
      "ufsComPctMinimo": 4
    },
    "PSC": {
      "cumpriuPorVotos": false,
      "pctNacional": 1.7784,
      "ufsComPctMinimo": 11
    },
    "AGIR": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.1453,
      "ufsComPctMinimo": 0
    },
    "PMN": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.2346,
      "ufsComPctMinimo": 2
    },
    "PTB": {
      "cumpriuPorVotos": false,
      "pctNacional": 1.301,
      "ufsComPctMinimo": 11
    },
    "AVANTE": {
      "cumpriuPorVotos": true,
      "pctNacional": 2.0051,
      "ufsComPctMinimo": 9
    },
    "UP": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.0499,
      "ufsComPctMinimo": 0
    },
    "PSTU": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.0256,
      "ufsComPctMinimo": 0
    },
    "PMB": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.0589,
      "ufsComPctMinimo": 0
    },
    "DC": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.0894,
      "ufsComPctMinimo": 0
    },
    "PCO": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.0067,
      "ufsComPctMinimo": 0
    },
    "PRTB": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.2184,
      "ufsComPctMinimo": 3
    },
    "PL": {
      "cumpriuPorVotos": true,
      "pctNacional": 16.6021,
      "ufsComPctMinimo": 25
    },
    "NOVO": {
      "cumpriuPorVotos": false,
      "pctNacional": 1.2389,
      "ufsComPctMinimo": 6
    },
    "PCB": {
      "cumpriuPorVotos": false,
      "pctNacional": 0.0782,
      "ufsComPctMinimo": 0
    }
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

  fundoPartidario: {
    fonteLegal: "Lei 9.096/1995, art. 41-A (redação Lei 13.165/2015); EC 111/2019 (voto em dobro)",
    valorTotalAnual: null, // Parâmetro a ser preenchido com o valor real do ano analisado
    entidadesElegiveis5Pct: [
      "PT", "PC do B", "PV",
      "PSDB", "CIDADANIA",
      "PSOL", "REDE",
      "MDB", "PDT", "PL", "PODE", "PP", "PRD", "PSB", "PSD",
      "REPUBLICANOS", "SOLIDARIEDADE", "UNIÃO",
      "AVANTE"
    ],
    observacao: "A base dos 95% usa a mesma contagem de votos ponderados do FEFC 35% (fefc.votosPorPartido). O conjunto de elegíveis aos 5% vem de quem superou a cláusula pelas urnas."
  },

  cortes: {
    // Data de corte do FEFC conforme regra oficial aplicavel.
    fefc: "primeiro_dia_util_junho",

    // Data de corte do tempo de TV conforme regra oficial aplicavel.
    tempoTV: "20_julho"
  }
};
