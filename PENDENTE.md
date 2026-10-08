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

### 2026 — Eleições gerais
**Status:** ✅ Federal (27), estadual (26), distrital (DF) e gênero/raça (27) gerados com a base do TSE
de 08/10/2026 e conferidos contra os eleitos oficiais (513/513 e 1.059/1.059). Cascata 2026 ligada.
Commits b8fc1f0, 83663d7, cd8e740, 4083c1b (locais, **não publicados**).

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

### 1. Publicar 2026 no site
Os 4 commits de 2026 estão só no computador local. Publicar (push) quando o usuário decidir.

### 2. Regerar 2026 com a base definitiva do TSE
A base usada é de 08/10/2026 (preliminar). Quando o TSE atualizar: apagar os ZIPs 2026 de `cache/`,
regerar estado por estado e repetir a conferência contra os eleitos oficiais.

### 3. Cláusula de desempenho 2026 — conferir com a lista oficial
`clausulaLinhaDeBase2026` é preliminar (calculada). Pela base atual: PSOL/REDE não cumpre (8 UFs ≥ 1,5%,
6 UFs com cadeira) e o NOVO cumpre no limite (exatamente 9 UFs). Conferir quando o TSE publicar a portaria.

### 4. Arredondamento do QE (art. 106 CE) — ✅ resolvido em 08/10/2026
O engine passou a seguir o texto literal do art. 106 (fração > 0,5 vale um), por decisão do usuário.
O TRE-CE não divulga o QE; em 108 circunscrições reais (2022/2026) truncar ou arredondar nunca
mudou nenhum eleito. Efeitos: QE CE 2022 231.084 → 231.085; margem do caso Heitor 5.704 → 5.705.

### 5. Pequenos ajustes conhecidos
- Dica da coluna QP em `js/ui.js` ("votos ÷ QE = qp") fica inexata quando o art. 108 reduz o QP
  (ex.: PSOL/REDE SP 2026: 9 calculados, 6 preenchidos). `ui.js` é protegido: só com autorização.
- `conferencia-tempotv-pontaaponta.mjs` está quebrada desde antes (importa `montarCenarioCascata`, que não existe).
- Testes do navegador (`js/runner.js`, Shift+Click no título): TC-01 e TC-03 falham desde antes desta
  sessão só porque procuram a palavra "Gatilho" nos alertas, que o engine não usa (a distribuição está certa).
- `conferencia-clausula-base.mjs` regrava `clausula-linhaDeBase2022.json` ao rodar; restaurar com
  `git checkout -- clausula-linhaDeBase2022.json` (com o art. 108, PR muda PSD 6→7, PODE 2→1).
- Dados do TSE 2026: MA "FABIO HERNIQUE DIAS DE MACEDO" (erro de digitação do TSE no arquivo de votação)
  não casa com a tabela de gênero/raça; AL "IVON BERTO TIBURCIO DE LIMA" (PRD) tem raça ambígua.
- Caminho de federação no adaptador ainda sem caso real testado (ex.: candidato do `PCDOB`).

### 6. Tradução de sigla de federação entre FEFC (2026) e Tempo de TV
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
*Última atualização: 2026-10-08*
