# Tarefas Pendentes — Calculadora de Retotalização Eleitoral

## Status geral dos dados

### 2022 — Deputado Federal (27 UFs)
**Status:** ✅ Completo — todos os 27 estados com partidos e candidatos.

### 2022 — Deputado Estadual (26 estados + DF)
**Status:** ✅ Completo em 26 estados. DF: arquivo existe mas sem candidatos (0 partidos).
- `2022_DF_estadual.json` está vazio — porém o DF já tem Distrital (27 partidos, 578 cands), que é o cargo equivalente.
- Ação: verificar se o dropdown do DF oculta corretamente a opção "Estadual" e exibe só "Distrital".

### 2022 — Deputado Distrital (DF)
**Status:** ✅ Completo — 27 partidos, 578 candidatos.

### 2024 — Vereador por município (Supabase)
**Status:** ✅ Carga concluída em 26 UFs (AC AL AM AP BA CE ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO).
- Interface de busca por município já integrada.
- Vagas automáticas via tabela `municipios_2024`.

---

## Pendências reais

### 1. `2022_DF_estadual.json` vazio
Arquivo existe mas sem dados (0 partidos, 0 candidatos). Não é um problema prático porque
o DF usa Deputado Distrital — mas vale confirmar que a interface não permite selecionar
"Estadual" para o DF.

### 2. Verificação funcional — Vereador 2024
Confirmar na interface que:
- A busca por município retorna resultados para UFs recém-carregadas.
- As vagas são preenchidas automaticamente.
- Os dados ficam bloqueados após importação.

---
*Última atualização: 2026-05-29*
