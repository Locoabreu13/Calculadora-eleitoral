# CLAUDE.md — Calculadora de Retotalização Eleitoral

## Quem é o usuário
Não é programador. Trabalha com direito eleitoral. Usa a calculadora para fundamentar petições e estudos jurídicos.
- Explicar tudo em linguagem simples, sem jargão técnico desnecessário.
- **Sempre mostrar o diff e aguardar aprovação explícita antes de editar qualquer arquivo.**
- Diagnóstico com dado real de execução antes de propor qualquer correção.
- Uma tarefa de cada vez, com aprovação a cada passo.

---

## REGRAS ABSOLUTAS

1. **NUNCA edite `js/engine.js` sem autorização expressa do usuário.** É o motor jurídico validado.
   Única alteração autorizada até hoje: art. 108 CE na Fase 1 (commit 83663d7, 08/10/2026), aprovada
   após conferência contra os eleitos oficiais do TSE.
2. **NUNCA edite sem aprovação.** Mostre o diff primeiro, espere "pode fazer" ou equivalente.
3. **Diagnóstico antes de teoria.** Rode comandos reais e mostre a saída antes de propor solução.
4. **NUNCA use `node scripts/processar-tse.js 2022 todas federal`** sem aprovação explícita — esse comando sobrescreve todos os JSONs inclusive os validados (CE e AP). Sempre rodar estado por estado.

---

## O que está validado e não pode regredir

### CE 2022 — Deputado Federal (`data/tse/2022_CE_federal.json`)
- 22 vagas, 28 partidos, 5.083.860 votos válidos, QE = 231.084
- Candidatos populados (todos os 28 partidos)
- Caso validado: cassação individual Heitor Freire (UNIAO, 48.888 votos nominais, modalidade `anular apenas nominais sem reatribuicao`) → PL 5→6, UNIAO 4→3

### AP 2022 — Deputado Federal (`data/tse/2022_AP_federal.json`)
- 8 vagas, 18 partidos/federações, 423.017 votos válidos, QE = 52.877
- Candidatos populados (todos os 18)
- Federações fundidas: `PT/PC do B/PV` (35.014 nom.), `PSOL/REDE` (35.668 nom.), `PSDB/CIDADANIA` (17.172 nom.)
- Fase 3 ativa; resultado bate com Resolução 620/2025 do TRE-AP (F2: PDT 2, PL 1, MDB 1; F3: PP, REPUBLICANOS, FE Brasil, PSOL/REDE)

### 25 demais estados — Deputado Federal 2022
- Todos os 27 arquivos `data/tse/2022_UF_federal.json` existem e foram validados, todos com candidatos
- Votos por partido + federações fundidas por `SG_FEDERACAO` — **exceto o CE**, cujo arquivo validado
  (antigo) traz PT, PC do B, PV, PSOL, REDE, PSDB e CIDADANIA separados. Não mexer sem decisão do usuário.
- Integridade verificada: QE em faixa 36 mil–333 mil, sem siglas duplicadas, 3 federações nacionais presentes

### 2026 — Eleições gerais (base TSE de 08/10/2026, preliminar)
- `data/tse/2026_UF_{federal,estadual,genero-raca}.json` (27/26/27) e `2026_DF_distrital.json`, com candidatos
- Conferência engine × eleitos oficiais do TSE: **513/513 federal, 1.059/1.059 estadual/distrital**
- 5 federações: `PT/PC do B/PV`, `PSOL/REDE`, `PSDB/CIDADANIA`, `UNIÃO/PP`, `PRD/SOLIDARIEDADE`.
  Em 2026 o TSE escreve o PC do B como `PCDOB`.
- Vagas 2026 iguais às de 2022 (conferido com `consulta_vagas_2026`)
- Caso de referência: anulação Ney Santos (CLAUDINEI ALVES DOS SANTOS, REPUBLICANOS, SP, 118.566 votos),
  modalidade `nominal_legenda` → vaga fica no REPUBLICANOS e vai para MARCO ANTONIO SCARASATI VINHOLI

---

## Arquitetura dos arquivos

```
js/engine.js          — Motor jurídico (INTOCÁVEL)
js/tse-direto.js      — Carregamento automático dos JSONs, cascata Ano→UF→Cargo,
                         cache IndexedDB com chave v3:ano:uf:cargo:gerado
js/ui.js              — Lógica de UI, validações, preenchimento de campos
js/presets.js         — Carrega data/presets.json
js/runner.js          — Testes unitários do engine
data/tse/             — JSONs pré-processados: {ano}_{UF}_{cargo}.json
data/presets.json     — Casos de estudo pré-definidos
scripts/processar-tse.js  — Gera os JSONs a partir dos CSVs do TSE (baixa ZIP do CDN)
app.html              — Interface principal
```

---

## Melhorias já implementadas

### MELHORIA A — Auto-preenchimento de vagas (commit 004fb7f)
`js/tse-direto.js` contém a constante `VAGAS` com o número oficial de cadeiras por UF e cargo:
- **Deputado Federal**: 513 cadeiras totais (TSE Res. 23.669/2021)
- **Deputado Estadual**: CF art. 27 (federal ≤ 12 → 3×fed; federal > 12 → 36 + (fed − 12))
- **Deputado Distrital**: DF = 24
- **Vereador**: omitido (varia por município)

O campo `input-vagas` é preenchido automaticamente ao selecionar UF + Cargo, e novamente ao clicar Carregar.

### MELHORIA B — Cache automático por versão (commit 8dde45f)
O `scripts/processar-tse.js` grava `meta.gerado` com timestamp ISO completo (ex: `"2026-05-26T03:10:29.890Z"`).
O `js/tse-direto.js` usa chave `v3:ano:uf:cargo:gerado` no IndexedDB. Quando o JSON é regerado, `gerado` muda → nova chave → cache antigo ignorado automaticamente, sem o usuário limpar nada na mão.

---

## Lição crítica — cache do IndexedDB
**Antes da MELHORIA B**, o cache era permanente e sem verificação de versão. Se um JSON fosse regerado, o browser servia a versão antiga. A solução implementada compara `meta.gerado` do arquivo com o valor armazenado no IDB — sem precisar de cabeçalho HTTP nem limpar na mão.

---

## Cascata por ano
`dadosReferenciaParaAno(ano)` (`js/cascata-referencia.js`) escolhe as referências: 2022 devolve o objeto
de sempre; 2026 usa TV da Portaria 473/2026, cláusula 2026 (inciso III, preliminar), elegíveis ao Fundo
Partidário 2026 e votos ponderados 2026 no FEFC, com os **valores do FEFC 2026 como referência**
(decisão do usuário, 08/10/2026). Na modalidade `nominal_legenda` os votos ficam no partido: FEFC/FP
descontam só o acréscimo do voto em dobro e a cláusula não registra perda (premissa exibida na tela e na peça).

## Federações (como funcionam)
O `scripts/processar-tse.js` agrupa votos por `SG_FEDERACAO` quando o partido pertence a uma federação (coluna `SG_FEDERACAO != '#NULO#'`). A sigla resultante é a da federação (ex: `PT/PC do B/PV`), não do partido individual. O campo `partidos` lista os membros. Isso está implementado e validado para todos os 27 estados.

---

## Script de processamento — uso correto

```bash
# CORRETO — estado por estado (nunca toca em outros estados)
node scripts/processar-tse.js 2022 CE federal
node scripts/processar-tse.js 2022 DF distrital

# PERIGOSO — só usar com aprovação explícita (sobrescreve TODOS os JSONs)
node scripts/processar-tse.js 2022 todas federal
```

O script baixa o ZIP do CDN do TSE (~25 MB para 2022 federal), extrai o CSV da UF solicitada e salva o JSON em `data/tse/`. Processa apenas votos por partido — candidatos requerem etapa separada:

```bash
node scripts/processar-tse.js 2026 SP federal          # votos por partido
echo s | node scripts/adicionar-candidatos.js 2026 SP federal   # candidatos (trava: soma exata)
node scripts/gerar-genero-raca.mjs 2026 SP federal      # gênero/raça (SÓ federal: o arquivo não tem cargo no nome)
```

Os mesmos scripts JS servem para `estadual` e `distrital` (reproduzem idênticos os JSONs 2022 feitos
pelos antigos scripts Python, que ficaram obsoletos).

**Armadilha do cache:** os scripts reutilizam para sempre o ZIP em `cache/`. Quando o TSE publicar uma
base nova, apagar o ZIP do ano em `cache/` antes de regerar. Nunca gerar a partir de arquivo do TSE
publicado só com cabeçalho (o script agora recusa gravar JSON sem votos).

**O TSE muda formatos entre eleições** (ex.: "sem federação" era `#NULO#` em 2022 e virou `#NULO` em
2026). Sempre conferir o resultado contra os eleitos oficiais (`DS_SIT_TOT_TURNO`) antes de usar.

---

## Tarefas pendentes
Ver `PENDENTE.md` na raiz do projeto.
