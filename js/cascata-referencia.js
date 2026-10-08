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

  // Portaria TSE 473/2026, publicada no DJE/TSE em 04/08/2026.
  // Tabela de representatividade dos partidos para calculo da distribuicao
  // do tempo de propaganda eleitoral gratuita em radio e TV, Eleicoes 2026.
  // Total 510 (tres deputados desconsiderados por nao atingir o requisito
  // do inciso II do art. 3 da EC 97/2017). Duas federacoes novas em relacao
  // ao ciclo de 2022: Federacao Renovacao Solidaria (PRD, Solidariedade) e
  // Federacao Uniao Progressista (Uniao, PP).
  // A outra tabela do anexo, "Participacao em Debates Eleitorais" (total
  // 591, soma de deputados e senadores), e usada para debates, nao para
  // tempo de TV.
  // AINDA NAO CONECTADA ao calculo: calcularTempoTV e calcularDominoTempoTV,
  // em js/cascata.js, seguem fixos em tempoTVCamara2022. Falta 1) ensinar
  // js/cascata.js a escolher a tabela pelo ano do cenario, e 2) um caso real
  // de 2026 carregado no sistema para validar contra numero oficial, no
  // padrao do caso Heitor Freire usado para o ciclo de 2022.
  tempoTVCamara2026: {
    totalCamara: 510,
    // Duracao legal do bloco (art. 47, par. 1o, inciso II, alinea "a" da
    // Lei 9.504/1997) nao foi alterada por esta portaria; mantido o mesmo
    // valor de tempoTVCamara2022 ate confirmacao em contrario.
    totalSegundosBloco: 750,
    cadeirasPorPartido: {
      "AVANTE": 7,
      "FEDERAÇÃO BRASIL DA ESPERANÇA": 81, // PT, PC do B, PV
      "FEDERAÇÃO PSDB CIDADANIA": 18, // PSDB, Cidadania
      "FEDERAÇÃO PSOL REDE": 15, // PSOL, Rede
      "FEDERAÇÃO RENOVAÇÃO SOLIDÁRIA": 12, // PRD, Solidariedade
      "FEDERAÇÃO UNIÃO PROGRESSISTA": 104, // União, PP
      "MDB": 41,
      "PDT": 16,
      "PL": 98,
      "PODE": 20,
      "PSB": 15,
      "PSD": 42,
      "REPUBLICANOS": 41
    }
  },

  // Federacoes vigentes no ciclo eleitoral de 2026 (Portaria TSE 473/2026),
  // usadas para traduzir a sigla individual de partido (como aparece nos
  // arquivos de estado) para a sigla combinada da federacao usada na
  // tabela tempoTVCamara2026.
  federacoesTV2026: {
    "FEDERAÇÃO BRASIL DA ESPERANÇA": ["PT", "PC do B", "PV"],
    "FEDERAÇÃO PSDB CIDADANIA": ["PSDB", "CIDADANIA"],
    "FEDERAÇÃO PSOL REDE": ["PSOL", "REDE"],
    "FEDERAÇÃO RENOVAÇÃO SOLIDÁRIA": ["PRD", "SOLIDARIEDADE"],
    "FEDERAÇÃO UNIÃO PROGRESSISTA": ["UNIÃO", "PP"]
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

  // Linha de base da clausula de desempenho para casos da eleicao de 2026
  // (EC 97/2017, art. 3, par. unico, inciso III). Mesmo formato e mesmo metodo
  // de clausulaLinhaDeBase2022, gerada dos 27 data/tse/2026_UF_federal.json
  // (513/513 eleitos conferidos com o TSE). PRELIMINAR: o TSE ainda nao publicou
  // a lista oficial de 2026; substituir/conferir quando sair.
  clausulaLinhaDeBase2026: {
    "fonte": "Resultado TSE 2026 (base de 08/10/2026, preliminar) processado de data/tse/2026_UF_federal.json; soma cadeiras = 513",
    "anoEleicao": 2026,
    "preliminar": true,
    "mapeamentoSiglaParaEntidade": {
      "PP": "UNIÃO/PP",
      "UNIÃO": "UNIÃO/PP",
      "UNIÃO/PP": "UNIÃO/PP",
      "PCDOB": "PT/PC do B/PV",
      "PV": "PT/PC do B/PV",
      "PT": "PT/PC do B/PV",
      "PT/PC do B/PV": "PT/PC do B/PV",
      "PC do B": "PT/PC do B/PV",
      "CIDADANIA": "PSDB/CIDADANIA",
      "PSDB": "PSDB/CIDADANIA",
      "PSDB/CIDADANIA": "PSDB/CIDADANIA",
      "PRD": "PRD/SOLIDARIEDADE",
      "SOLIDARIEDADE": "PRD/SOLIDARIEDADE",
      "PRD/SOLIDARIEDADE": "PRD/SOLIDARIEDADE",
      "PSOL": "PSOL/REDE",
      "REDE": "PSOL/REDE",
      "PSOL/REDE": "PSOL/REDE"
    },
    "totalVotosPorUF": {
      "AC": 462485,
      "AL": 1798341,
      "AM": 2119252,
      "AP": 459680,
      "BA": 8281816,
      "CE": 5521642,
      "DF": 1659057,
      "ES": 2134985,
      "GO": 3607744,
      "MA": 3970967,
      "MG": 11380151,
      "MS": 1420762,
      "MT": 1901719,
      "PA": 4832237,
      "PB": 2399949,
      "PE": 5264503,
      "PI": 2109063,
      "PR": 6217229,
      "RJ": 8743753,
      "RN": 1967700,
      "RO": 932939,
      "RR": 318821,
      "RS": 6081271,
      "SC": 4231498,
      "SE": 1283700,
      "SP": 23674188,
      "TO": 902567
    },
    "cadeirasPorEntidadePorUF": {
      "UNIÃO/PP": {
        "AC": 4,
        "AL": 4,
        "AM": 2,
        "AP": 3,
        "BA": 8,
        "CE": 3,
        "ES": 3,
        "GO": 4,
        "MA": 3,
        "MG": 6,
        "MS": 2,
        "MT": 2,
        "PA": 1,
        "PB": 3,
        "PE": 4,
        "PI": 1,
        "PR": 6,
        "RJ": 6,
        "RN": 2,
        "RO": 2,
        "RR": 2,
        "RS": 5,
        "SC": 1,
        "SE": 3,
        "SP": 5,
        "TO": 2
      },
      "MDB": {
        "AC": 1,
        "AL": 2,
        "AM": 2,
        "BA": 1,
        "CE": 2,
        "DF": 1,
        "GO": 2,
        "MA": 5,
        "MG": 1,
        "PA": 6,
        "PE": 1,
        "PI": 2,
        "PR": 1,
        "RJ": 1,
        "RS": 3,
        "SC": 1,
        "SP": 4
      },
      "REPUBLICANOS": {
        "AC": 1,
        "AM": 1,
        "BA": 3,
        "CE": 1,
        "DF": 1,
        "ES": 1,
        "GO": 1,
        "MA": 1,
        "MG": 3,
        "MS": 2,
        "MT": 1,
        "PB": 3,
        "PE": 2,
        "PI": 1,
        "PR": 2,
        "RJ": 1,
        "RR": 3,
        "RS": 2,
        "SC": 1,
        "SE": 1,
        "SP": 6,
        "TO": 3
      },
      "PL": {
        "AC": 1,
        "AM": 2,
        "AP": 1,
        "BA": 4,
        "CE": 4,
        "DF": 3,
        "ES": 2,
        "GO": 4,
        "MA": 4,
        "MG": 21,
        "MS": 3,
        "MT": 3,
        "PA": 3,
        "PB": 2,
        "PE": 2,
        "PR": 5,
        "RJ": 15,
        "RN": 3,
        "RO": 3,
        "RR": 1,
        "RS": 8,
        "SC": 7,
        "SP": 19,
        "TO": 1
      },
      "PT/PC do B/PV": {
        "AC": 1,
        "AP": 1,
        "BA": 10,
        "CE": 3,
        "DF": 2,
        "ES": 2,
        "GO": 2,
        "MA": 2,
        "MG": 13,
        "MS": 1,
        "MT": 1,
        "PA": 2,
        "PB": 2,
        "PE": 4,
        "PI": 4,
        "PR": 6,
        "RJ": 8,
        "RN": 3,
        "RS": 6,
        "SC": 3,
        "SE": 1,
        "SP": 11
      },
      "PSD": {
        "AL": 2,
        "AM": 1,
        "BA": 6,
        "CE": 3,
        "GO": 2,
        "MG": 2,
        "PA": 2,
        "PB": 1,
        "PE": 2,
        "PI": 2,
        "PR": 4,
        "RJ": 4,
        "RO": 1,
        "RS": 2,
        "SC": 1,
        "SE": 2,
        "SP": 6
      },
      "PSDB/CIDADANIA": {
        "AL": 1,
        "BA": 2,
        "MA": 1,
        "MG": 1,
        "RJ": 4,
        "SP": 1,
        "TO": 1
      },
      "PDT": {
        "AP": 2,
        "BA": 1,
        "MA": 1,
        "RJ": 1,
        "RS": 1
      },
      "PODE": {
        "AP": 1,
        "ES": 1,
        "GO": 1,
        "MG": 1,
        "MT": 1,
        "PA": 2,
        "PB": 1,
        "PE": 3,
        "PR": 2,
        "RO": 2,
        "RR": 2,
        "RS": 2,
        "SC": 1,
        "SP": 6,
        "TO": 1
      },
      "AVANTE": {
        "BA": 3,
        "MG": 1,
        "PE": 1
      },
      "PSB": {
        "BA": 1,
        "CE": 4,
        "ES": 1,
        "MG": 1,
        "PA": 1,
        "PE": 4,
        "SE": 1,
        "SP": 2
      },
      "PRD/SOLIDARIEDADE": {
        "CE": 2,
        "GO": 1,
        "MA": 1,
        "MG": 1,
        "RJ": 1,
        "SP": 1
      },
      "PSOL/REDE": {
        "DF": 1,
        "MG": 2,
        "PE": 1,
        "RJ": 4,
        "RS": 1,
        "SP": 6
      },
      "NOVO": {
        "PE": 1,
        "PR": 4,
        "RJ": 1,
        "RS": 1,
        "SC": 1,
        "SP": 2
      },
      "MISSÃO": {
        "SP": 1
      }
    },
    "statusVotosPorEntidade": {
      "UNIÃO/PP": {
        "cumpriuPorVotos": true,
        "pctNacional": 13.6086,
        "ufsComPctMinimo": 27
      },
      "MDB": {
        "cumpriuPorVotos": true,
        "pctNacional": 6.941,
        "ufsComPctMinimo": 20
      },
      "REPUBLICANOS": {
        "cumpriuPorVotos": true,
        "pctNacional": 6.9598,
        "ufsComPctMinimo": 24
      },
      "PL": {
        "cumpriuPorVotos": true,
        "pctNacional": 22.7175,
        "ufsComPctMinimo": 27
      },
      "PT/PC do B/PV": {
        "cumpriuPorVotos": true,
        "pctNacional": 15.3239,
        "ufsComPctMinimo": 27
      },
      "PSDB/CIDADANIA": {
        "cumpriuPorVotos": true,
        "pctNacional": 2.7544,
        "ufsComPctMinimo": 14
      },
      "PDT": {
        "cumpriuPorVotos": false,
        "pctNacional": 1.6436,
        "ufsComPctMinimo": 8
      },
      "PRD/SOLIDARIEDADE": {
        "cumpriuPorVotos": false,
        "pctNacional": 1.8648,
        "ufsComPctMinimo": 7
      },
      "NOVO": {
        "cumpriuPorVotos": true,
        "pctNacional": 2.5637,
        "ufsComPctMinimo": 9
      },
      "AVANTE": {
        "cumpriuPorVotos": false,
        "pctNacional": 1.5904,
        "ufsComPctMinimo": 6
      },
      "PODE": {
        "cumpriuPorVotos": true,
        "pctNacional": 5.179,
        "ufsComPctMinimo": 16
      },
      "PSOL/REDE": {
        "cumpriuPorVotos": false,
        "pctNacional": 4.8903,
        "ufsComPctMinimo": 8
      },
      "PSB": {
        "cumpriuPorVotos": true,
        "pctNacional": 4.4052,
        "ufsComPctMinimo": 13
      },
      "DEMOCRATA": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.0239,
        "ufsComPctMinimo": 0
      },
      "PSD": {
        "cumpriuPorVotos": true,
        "pctNacional": 8.2613,
        "ufsComPctMinimo": 20
      },
      "MISSÃO": {
        "cumpriuPorVotos": false,
        "pctNacional": 1.0763,
        "ufsComPctMinimo": 1
      },
      "DC": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.1006,
        "ufsComPctMinimo": 0
      },
      "UP": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.04,
        "ufsComPctMinimo": 0
      },
      "MOBILIZA": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.0301,
        "ufsComPctMinimo": 0
      },
      "PSTU": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.0164,
        "ufsComPctMinimo": 0
      },
      "PCO": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.0027,
        "ufsComPctMinimo": 0
      },
      "AGIR": {
        "cumpriuPorVotos": false,
        "pctNacional": 0.0063,
        "ufsComPctMinimo": 0
      }
    }
  },

  // FEFC, fatia de 35%: votos nacionais ponderados (voto em dobro, EC 111/2021)
  // por partido na eleicao de 2026, mesmo metodo de fefc.votosPorPartido
  // (conferencia-fefc-35-final.mjs, reproduzido 29/29 para 2022).
  fefcVotosPorPartido2026: {
    "AGIR": 11666,
    "AVANTE": 2880296,
    "CIDADANIA": 412918,
    "DC": 166388,
    "DEMOCRATA": 39782,
    "MDB": 10869921,
    "MISSÃO": 1526367,
    "MOBILIZA": 52856,
    "NOVO": 3716106,
    "PCDOB": 2119541,
    "PCO": 4156,
    "PDT": 2518074,
    "PL": 32781560,
    "PODE": 8186715,
    "PP": 10448047,
    "PRD": 1750812,
    "PSB": 7692147,
    "PSD": 12717617,
    "PSDB": 3807096,
    "PSOL": 9700168,
    "PSTU": 27600,
    "PT": 22045106,
    "PV": 2001177,
    "REDE": 316732,
    "REPUBLICANOS": 11584802,
    "SOLIDARIEDADE": 1315132,
    "UNIÃO": 12052145,
    "UP": 76327
  },

  // Fundo Partidario, faixa de 5%: partidos das entidades que cumprem a
  // clausula 2026 pela linha de base acima (preliminar).
  fundoPartidarioElegiveis2026: ["PP", "UNIÃO", "MDB", "REPUBLICANOS", "PL", "PCDOB", "PV", "PT", "CIDADANIA", "PSDB", "NOVO", "PODE", "PSB", "PSD"],

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

// Monta as referencias da cascata para o ano da eleicao do caso.
// 2022 (e qualquer ano sem dados proprios): devolve o MESMO objeto de sempre,
// sem nenhuma alteracao. 2026: tempo de TV pela Portaria 473/2026, clausula e
// fundo partidario pela linha de base 2026, e FEFC com os VALORES do FEFC 2026
// como referencia (o montante do proximo ciclo ainda nao foi fixado), mas com
// a base de votos ponderados do resultado de 2026.
export function dadosReferenciaParaAno(ano) {
  if (Number(ano) !== 2026) return dadosReferencia;
  return {
    ...dadosReferencia,
    anoBase: 2026,
    fefc: {
      ...dadosReferencia.fefc,
      votosPorPartido: dadosReferencia.fefcVotosPorPartido2026,
      avisoReferencia: "Valores do FEFC 2026 usados como referência; o montante do próximo ciclo ainda não foi fixado. Base de votos: resultado de 2026 (preliminar)."
    },
    fundoPartidario: {
      ...dadosReferencia.fundoPartidario,
      entidadesElegiveis5Pct: dadosReferencia.fundoPartidarioElegiveis2026
    }
  };
}
