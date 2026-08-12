# Tarefas Pendentes — Calculadora de Retotalização Eleitoral

## Status geral dos dados

### 2022 — Deputado Federal (27 UFs)
**Status:** ✅ Completo — todos os 27 estados com partidos e candidatos.

### 2022 — Deputado Estadual (26 estados + DF)
**Status:** ✅ Completo em 26 estados. DF: arquivo existe mas sem candidatos (0 partidos),
porque o DF usa Deputado Distrital como cargo equivalente (27 partidos, 578 cands).
Confirmado em 2026-08-12, direto no código (`js/tse-direto.js:213-217`), que o dropdown de
cargo já oculta "Deputado Estadual" quando a UF é DF e só mostra "Deputado Distrital". Nada a
corrigir.

### 2022 — Deputado Distrital (DF)
**Status:** ✅ Completo — 27 partidos, 578 candidatos.

### 2024 — Vereador por município (Supabase)
**Status:** ✅ Carga concluída e verificação funcional feita em 2026-08-12, com consulta real
ao banco (não só leitura de código):
- Cobertura das 26 UFs confirmada por contagem exata: 5.544 municípios, nenhuma UF faltando.
- Busca por nome testada (GO, texto "GOIAN") — retornou os municípios esperados.
- Preenchimento automático de vagas testado (Goianira/GO) — campo populado corretamente.
- Bloqueio dos dados após importação confirmado no código (`js/import.js:44`): reaproveita o
  mesmo mecanismo (`modo-tse`) já usado para os dados de 2022, não é um caminho separado.

---

## Fases do roteiro de diferenciação (ver histórico de commits para detalhe)

Registrado aqui porque documentos anteriores (`PENDENTE.md` e a memória do projeto) chegaram a
indicar as Fases 5–7 como "a iniciar", o que estava desatualizado. Confirmado em 2026-08-12
rodando as conferências reais:

- **Fase 5 — captura do delta de votos do cassado:** implementada e validada
  (`conferencia-fase5-heitor.mjs` → APROVADO). Cruzamento por nome; tabela de gênero/raça em
  arquivo separado por UF (`data/tse/{ano}_{UF}_genero-raca.json`).
- **Fase 6 — modo reverso ("vale a pena litigar"):** implementada e validada
  (`conferencia-reverso-heitor.mjs` → APROVADO).
- **Fase 7 — publicação:** feita. App no ar em `retotalizaje.com.br` (GitHub Pages, HTTPS
  válido até 21/10/2026).

---

## Pendências reais

### 1. Tempo de TV 2026 — calibragem, passo 2
Em 2026-08-12, a Portaria TSE nº 473/2026 (tabela de representatividade para TV/rádio das
Eleições 2026, 510 cadeiras) foi adicionada como dado de referência em
`js/cascata-referencia.js` (`tempoTVCamara2026`, `federacoesTV2026`). Ainda **não conectada**
ao cálculo — `calcularTempoTV` e `calcularDominoTempoTV`, em `js/cascata.js`, seguem fixos na
tabela de 2022. Falta: 1) ensinar o código a escolher a tabela pelo ano do cenário; 2) um caso
eleitoral real de 2026 carregado no sistema para validar contra número oficial. Hoje
`data/tse/` só tem 2022 e 2024 — não iniciar antes de haver dado de 2026 para testar.

### 2. Tradução de sigla de federação entre FEFC (2026) e Tempo de TV
Só necessária quando um caso real mover cadeira de partido que esteja em federação e as duas
tabelas (FEFC e Tempo de TV) nomearem a federação de formas diferentes. Não iniciar sem caso
concreto.

---

## Pequenos ajustes concluídos em 2026-08-12
- Comentário "VERIFICAR referência legal" removido de `js/cascata.js` (a referência ao art. 17
  §3º da CF e art. 3º da EC 97/2017 já havia sido conferida contra o texto oficial).
- Frase da síntese com "de...de" repetido corrigida em `js/cascata-sintese.js`
  (`gerarSintese`), mantendo a conferência `conferencia-sintese-ce2022.mjs` aprovada.

---
*Última atualização: 2026-08-12*
