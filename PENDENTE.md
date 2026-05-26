# Tarefas Pendentes — Calculadora de Retotalização Eleitoral

## 1. Candidatos nos 27 estados — Deputado Federal 2022
**Status:** CE e AP completos. Os outros 25 têm votos por partido, mas sem lista de candidatos.

- Impacto: cassação individual só funciona nos estados com candidatos populados.
- Estratégia: completar sob demanda (quando um estado for necessário para um caso real),
  ou em lote se houver tempo — um estado de cada vez, com validação antes de commitar.
- Requer: baixar `votacao_candidato_munzona_2022_UF.zip` do TSE e integrar ao script.

## 2. Deputado Estadual — 27 estados
**Status:** tabela de vagas já existe em `js/tse-direto.js` (CF art. 27, fórmula validada).

- Requer:
  1. Adicionar "Deputado Estadual" como opção de cargo na interface (hoje só aparece Federal e Distrital).
  2. Gerar os 27 JSONs `2022_UF_estadual.json` via `processar-tse.js 2022 UF estadual`.
  3. Validar integridade (QE em faixa razoável) antes de commitar, lote por lote.

## 3. Deputado Distrital — DF (24 vagas)
**Status:** cargo já mapeado em `VAGAS['Deputado Distrital'] = { DF: 24 }`.

- Requer:
  1. Gerar `2022_DF_distrital.json` via `processar-tse.js 2022 DF distrital`.
  2. Validar QE (floor(votos_válidos / 24)).
  3. Interface já suporta o cargo (bloqueia UF = DF automaticamente).

## 4. Eleições 2024 — Vereador por município
**Status:** projeto separado, escopo grande.

- Requer: gerar JSONs por município (`votacao_partido_munzona_2024_UF.zip`),
  interface de seleção de município (já existe o seletor), e validação caso a caso.
- Não iniciar antes de fechar os itens 1–3.

---
*Última atualização: 2026-05-26*
