# BRIEFING-VISUAL.md — RetotalizaJE Landing Page
## Etapa 6 — Montagem da Identidade Visual

Este arquivo contém todas as instruções para reconstruir o `index.html`
com a nova identidade visual. Todas as decisões de design foram tomadas
previamente. Não invente nenhum valor de cor, fonte ou espaçamento —
tudo está definido em `css/tokens.css`.

---

## REGRAS ABSOLUTAS — LER ANTES DE QUALQUER COISA

### Arquivos que NÃO EXISTEM para esta tarefa
```
js/engine.js       — NUNCA tocar (motor jurídico validado)
js/import.js       — NUNCA tocar
js/tse-direto.js   — NUNCA tocar
js/ui.js           — NUNCA tocar
js/presets.js      — NUNCA tocar
js/runner.js       — NUNCA tocar
app.html           — NUNCA tocar (interface da calculadora)
data/              — NUNCA tocar
scripts/           — NUNCA tocar
```

### Arquivos de trabalho desta tarefa
```
index.html         — reconstrução da landing page
css/styles.css     — estilos específicos da landing page
css/tokens.css     — JÁ EXISTE, apenas importar, nunca sobrescrever
```

### Regras de código
1. Nunca usar valores de cor, fonte ou espaçamento hardcoded
2. Sempre usar variáveis CSS do `tokens.css` (ex: `var(--cor-profundo)`)
3. Mostrar o código de cada seção antes de aplicar
4. Uma seção de cada vez — aguardar aprovação antes de avançar
5. Após cada seção, abrir no browser e mostrar resultado

---

## PASSO 0 — Preparação (fazer antes de qualquer seção)

### Adicionar no `<head>` do `index.html`, antes do `styles.css`:

```html
<link rel="stylesheet" href="css/tokens.css">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
```

### Padrão do wordmark — usar em todo o site:
```html
<span class="wordmark">
  <span class="wordmark-base">Retotaliza</span><span class="wordmark-je">JE</span>
</span>
```

---

## ALTERNÂNCIA DE FUNDOS — seguir esta sequência exatamente

| Bloco      | Cor de fundo                | Aparência |
|------------|----------------------------|-----------|
| Navbar     | `var(--cor-profundo)`       | Escuro    |
| Seção 01   | `var(--cor-profundo)`       | Escuro    |
| Seção 02   | `var(--cor-fundo-neutro)`   | Neutro    |
| Seção 03   | `var(--cor-fundo-principal)`| Claro     |
| Seção 04   | `var(--cor-fundo-neutro)`   | Neutro    |
| Seção 05   | `var(--cor-fundo-principal)`| Claro     |
| Seção 06   | `var(--cor-fundo-neutro)`   | Neutro    |
| Seção 07   | `var(--cor-fundo-principal)`| Claro     |
| Seção 08   | `var(--cor-confiante)`      | Azul      |
| Footer     | `var(--cor-profundo)`       | Escuro    |

---

## NAVBAR

**Fundo:** `var(--cor-profundo)`
**Altura:** `var(--navbar-altura)` (64px)
**Posição:** sticky, top: 0, z-index: 100

**Conteúdo:**
- Esquerda: wordmark usando padrão `.wordmark` acima
- Centro: links "Como funciona" "Casos validados" "Fundamento jurídico" — cor `var(--cor-texto-inv-suave)`, hover `var(--cor-texto-inv)`
- Direita: botão "Acessar sistema" — classe `.botao` linkando para `app.html`

**Mobile:** esconder links do centro, manter wordmark e botão

---

## SEÇÃO 01 — HERO

**Fundo:** `var(--cor-profundo)`
**Padding:** `var(--secao-padding-v)`
**Layout:** grid 2 colunas iguais, gap `var(--grid-gap-lg)`, align-items center

**Coluna esquerda (máx 520px):**

1. Label: `ADIs 7.228 · 7.263 · 7.325 · STF 13/03/2025`
   - Classe `.label`, cor `var(--cor-ambar)`

2. H1: `Enquanto o TRE ainda processa, você já tem a resposta.`
   - `font-family: var(--fonte-titulo)`
   - `font-size: var(--texto-hero)` (desktop) / `var(--texto-hero-mobile)` (mobile)
   - `font-weight: var(--peso-black)`
   - `color: var(--cor-texto-inv)`
   - `letter-spacing: var(--tracking-titulo)`
   - `line-height: var(--linha-titulo)`

3. Parágrafo: `O único sistema que implementa fielmente as ADIs 7.228, 7.263 e 7.325 do STF. Calcule o resultado de uma cassação em segundos, com precisão validada contra decisões reais de TRE.`
   - `color: var(--cor-texto-inv-medio)`
   - `font-size: var(--texto-base)`

4. Botões (flex, gap `var(--espaco-12)`):
   - Primário: `Calcular agora →` — classe `.botao`, href `app.html`
   - Secundário: `Ver casos validados` — classe `.botao .botao--sec`

5. Strip de métricas (flex, gap `var(--espaco-32)`, border-top `1px solid var(--cor-profundo-borda)`, margin-top `var(--espaco-40)`, padding-top `var(--espaco-32)`):
   - Item 1: número `3` / label `Fases do algoritmo`
   - Item 2: número `100%` / label `Fiel às ADIs STF`
   - Item 3: número `27` / label `Estados disponíveis`
   - Números: `var(--fonte-titulo)` `var(--peso-black)` `var(--texto-3xl)` `var(--cor-ambar)`
   - Labels: classe `.label` `var(--cor-texto-inv-suave)`

**Coluna direita — frame de browser com screenshot:**

```html
<div class="browser-frame">
  <div class="browser-chrome">
    <div class="browser-dots">
      <span style="background:#FF5F57"></span>
      <span style="background:#FEBC2E"></span>
      <span style="background:#28C840"></span>
    </div>
    <div class="browser-url">retotalizaje.com.br/app.html</div>
  </div>
  <div class="browser-content">
    <img src="css/hero-screenshot.png" alt="RetotalizaJE calculando o caso Ceará 2022">
  </div>
</div>
```

- Frame: `border-radius: var(--raio-lg)`, `overflow: hidden`, `border: 1px solid var(--cor-profundo-borda)`
- Chrome: `background: var(--cor-profundo-meio)`, padding `var(--espaco-8) var(--espaco-12)`, flex, gap `var(--espaco-8)`
- Pontos: círculos 10px de diâmetro
- URL: flex 1, `background: var(--cor-profundo)`, border-radius `var(--raio-sm)`, padding `var(--espaco-4) var(--espaco-8)`, `font-size: var(--texto-xs)`, `color: var(--cor-texto-inv-suave)`, text-align center

**Nota:** se `css/hero-screenshot.png` não existir ainda, usar um placeholder
com `background: var(--cor-profundo-meio)` e height de 400px.
Instruções para capturar o screenshot estão no final deste arquivo.

**Mobile:** coluna única, ocultar coluna do browser, `font-size: var(--texto-hero-mobile)`

---

## SEÇÃO 02 — O PROBLEMA

**Fundo:** `var(--cor-fundo-neutro)`
**Padding:** `var(--secao-padding-v)`
**Layout:** coluna única, max-width `var(--largura-texto)`, centralizado

**H2:** `A retotalização envolve dados dispersos, cálculos em fases e regras jurídicas específicas.`

**Corpo:** `Para chegar ao resultado correto, é necessário localizar e filtrar os dados oficiais do TSE, aplicar o Quociente Eleitoral, calcular o Quociente Partidário e distribuir as sobras conforme as ADIs 7.228, 7.263 e 7.325, fase por fase, com precisão técnica. Um processo que, sem a ferramenta adequada, exige horas de trabalho manual e abre margem para erros metodológicos em cada etapa.`

---

## SEÇÃO 03 — COMO FUNCIONA

**Fundo:** `var(--cor-fundo-principal)`
**Padding:** `var(--secao-padding-v)`

**Label:** `Fluxo de uso`

**H2:** `Dos dados do TSE ao resultado em minutos.`
- Centralizado, max-width `var(--largura-texto)`, margin-bottom `var(--espaco-48)`

**Grid de 4 cards** (grid-template-columns: repeat(4, 1fr), gap `var(--grid-gap)`):

Cada card usa classe `.card`. Estrutura interna:
```
Número (01, 02, 03, 04)
  — font-family: var(--fonte-titulo)
  — font-weight: var(--peso-black)
  — font-size: var(--texto-2xl)
  — color: var(--cor-confiante)
  — margin-bottom: var(--espaco-12)

Título
  — font-weight: var(--peso-bold)
  — font-size: var(--texto-lg)
  — color: var(--cor-texto)
  — margin-bottom: var(--espaco-8)

Descrição
  — font-size: var(--texto-sm)
  — color: var(--cor-texto-suave)
```

| Card | Título                   | Descrição                                              |
|------|--------------------------|--------------------------------------------------------|
| 01   | Selecione o estado e cargo | Ano, UF e cargo nos menus. Os dados do TSE são carregados automaticamente. |
| 02   | Configure a cassação     | Escolha o candidato, os votos e a modalidade. O QE é recalculado automaticamente. |
| 03   | Calcule com um clique    | O algoritmo de três fases processa a distribuição conforme as ADIs. |
| 04   | Analise e exporte        | Tabela de resultados, auditoria D'Hondt e exportação em PDF e CSV. |

**Mobile:** grid 2x2

---

## SEÇÃO 04 — RESULTADO

**Fundo:** `var(--cor-fundo-neutro)`
**Padding:** `var(--secao-padding-v)`
**Layout:** grid 2 colunas iguais, gap `var(--grid-gap-lg)`, align-items start

**Coluna esquerda:**

H2: `Calcule o resultado antes da publicação oficial e oriente o cliente com precisão.`

Corpo: `Entre a decisão judicial e a publicação do resultado pelo Tribunal existe um intervalo relevante. É nesse intervalo que o advogado precisa orientar o cliente, o candidato precisa tomar decisões e o partido precisa se reorganizar. Com o RetotalizaJE, esse intervalo deixa de ser uma zona de incerteza.`

**Coluna direita — bloco `.destaque-ambar`:**

```html
<div class="destaque-ambar">
  <p class="label" style="color: var(--cor-ambar); margin-bottom: var(--espaco-8);">
    Caso Ceará · Cassação Heitor Freire · 2022
  </p>
  <p>A decisão judicial foi proferida em 21 de maio. A retotalização oficial do TRE 
  foi publicada em 29 de maio. O RetotalizaJE apresentou o resultado correto 8 dias 
  antes, com distribuição de vagas idêntica à publicada oficialmente.</p>
</div>
```

**Mobile:** coluna única, bloco âmbar abaixo do texto

---

## SEÇÃO 05 — PROVA

**Fundo:** `var(--cor-fundo-principal)`
**Padding:** `var(--secao-padding-v)`

**Label:** `Casos validados`

**H2:** `Três casos reais. Três resultados confirmados.`

**Corpo (centralizado, max-width `var(--largura-texto)`, margin-bottom `var(--espaco-48)`):**
`O RetotalizaJE foi validado por confronto direto com resoluções e publicações oficiais de Tribunais Regionais Eleitorais. Os casos do Ceará, do Amapá e do Distrito Federal foram processados pelo sistema e produziram resultado idêntico ao publicado oficialmente. A validação foi realizada sobre os arquivos reais do TSE, não sobre dados sintéticos.`

**Grid de 3 cards** (grid-template-columns: repeat(3, 1fr), gap `var(--grid-gap)`):

**Card Ceará:**
```
Título: Ceará 2022 — Cassação Heitor Freire
Subtítulo: Deputado Federal
Métricas: 22 vagas · QE 231.084 · Barreira 80%: 183.089
Resultado: PL +1 (5→6) · UNIÃO −1 (4→3) · Republicanos barrado
```

**Card Amapá:**
```
Título: Amapá 2022 — TRE-AP Res. 620/2025
Subtítulo: Deputado Federal
Métricas: 8 vagas · QE 52.877 · 3 federações
Resultado: F2: PDT 2, PL 1, MDB 1 · F3: PP, Rep., FE Brasil, PSOL/REDE
```

**Card Distrito Federal:**
```
Título: Distrito Federal 2022 — Pós-ADIs
Subtítulo: Deputado Federal
Métricas: 8 vagas · QE 259.752 · Fase 3 ativada
Resultado: PSB obteve 1 vaga via Fase 3 sem barreira
```

Estrutura de cada card:
- Classe `.card`
- Título: `var(--texto-lg)` `var(--peso-bold)` `var(--cor-texto)`
- Subtítulo: `var(--texto-sm)` `var(--cor-confiante)` `var(--peso-medio)`
- Divider: `1px solid var(--cor-borda-suave)` margin `var(--espaco-16) 0`
- Métricas: `var(--texto-xs)` `var(--cor-texto-suave)` linha por linha
- Resultado: `var(--texto-sm)` `var(--cor-texto-medio)` margin-top `var(--espaco-12)`

**Mobile:** cards empilhados (1 coluna)

---

## SEÇÃO 06 — RISCO

**Fundo:** `var(--cor-fundo-neutro)`
**Padding:** `var(--secao-padding-v)`
**Layout:** coluna única, max-width `var(--largura-texto)`, centralizado

**H2:** `A consequência de um resultado incorreto vai além do erro técnico.`

**Corpo:** `Uma orientação equivocada sobre o resultado de uma retotalização compromete o planejamento do candidato, a estratégia do partido e a credibilidade profissional do advogado. O cliente toma decisões financeiras, políticas e organizacionais com base na informação que recebe. Um resultado incorreto, ainda que involuntário, gera consequências que se estendem além do processo judicial.`

---

## SEÇÃO 07 — POSICIONAMENTO

**Fundo:** `var(--cor-fundo-principal)`
**Padding:** `var(--secao-padding-v)`
**Layout:** coluna única, max-width `var(--largura-texto)`, centralizado

**H2:** `Não é um simulador de cenários. É um instrumento de precisão jurídica.`

**Corpo:** `Simuladores calculam hipóteses. O RetotalizaJE implementa o algoritmo que o STF determinou nas ADIs 7.228, 7.263 e 7.325, as mesmas regras que o Tribunal Regional Eleitoral aplicará. O resultado obtido no sistema não é uma estimativa: é a aplicação direta das normas vigentes, validada contra resoluções publicadas por TREs e dados oficiais do TSE.`

---

## SEÇÃO 08 — CTA FINAL

**Fundo:** `var(--cor-confiante)`
**Padding:** `var(--secao-padding-v)`
**Layout:** centralizado, max-width `var(--largura-estreita)`

**H2:** `Pronto para calcular com precisão jurídica?`
- `var(--fonte-titulo)` `var(--peso-black)` `var(--cor-texto-inv)` `var(--tracking-titulo)`

**Parágrafo:** `Dados oficiais do TSE. Algoritmo validado pelo STF. Resultado antes da publicação oficial.`
- `var(--cor-texto-inv)` com `opacity: 0.75`

**Botão:** `Calcular agora →`
- `background: var(--cor-texto-inv)`, `color: var(--cor-confiante)`
- Classe `.botao`, href `app.html`

---

## FOOTER

**Fundo:** `var(--cor-profundo)`
**Padding:** `var(--secao-padding-v-pequeno)`
**Layout:** flex, justify-content space-between, align-items center

**Esquerda:** wordmark padrão, `font-size: var(--texto-lg)`

**Centro:** links "Como funciona" · "Casos validados" · "Fundamento jurídico"
- `var(--cor-texto-inv-suave)` `var(--texto-sm)`, hover `var(--cor-texto-inv)`

**Direita:** `Art. 109 CE · ADIs 7.228/7.263/7.325 · STF 2025`
- `var(--texto-xs)` `var(--cor-texto-inv-suave)`

**Linha inferior** (border-top `1px solid var(--cor-profundo-borda)`, margin-top `var(--espaco-24)`, padding-top `var(--espaco-16)`):
`© 2025 RetotalizaJE · Ferramenta técnico-jurídica de apoio · Não substitui decisão da Justiça Eleitoral`
- Centralizado, `var(--texto-xs)` `var(--cor-texto-inv-suave)`

**Mobile:** flex-direction column, gap `var(--espaco-16)`, tudo centralizado

---

## CAPTURAR O SCREENSHOT DO HERO

Após o sistema estar funcionando, executar os seguintes passos no Mac:

1. Abrir o `app.html` no browser (Chrome ou Safari)
2. Selecionar: Ano **2022**, Estado **CE**, Cargo **Deputado Federal**
3. Clicar em **Carregar**
4. Configurar a cassação: partido UNIÃO, candidato Heitor Freire, 48.888 votos, modalidade **Total**
5. Clicar em **Calcular**
6. Pressionar `Cmd + Shift + 4` para capturar área específica
7. Selecionar a área do painel de resultados com a tabela de distribuição
8. Salvar o arquivo como `css/hero-screenshot.png`
9. Voltar ao Claude Code e pedir para substituir o placeholder pelo screenshot real

---

## ORDEM DE IMPLEMENTAÇÃO

Seguir esta ordem, uma por vez, aguardando aprovação a cada passo:

```
1.  Passo 0     — importar tokens.css e fonte no index.html
2.  Navbar      — sticky, wordmark + links + botão
3.  Seção 01    — Hero (com placeholder no browser-frame)
4.  Seção 02    — O problema
5.  Seção 03    — Como funciona (4 cards)
6.  Seção 04    — Resultado (com bloco âmbar)
7.  Seção 05    — Prova (3 cards de casos)
8.  Seção 06    — Risco
9.  Seção 07    — Posicionamento
10. Seção 08    — CTA final
11. Footer
12. Screenshot  — substituir placeholder pelo screenshot real
13. Mobile      — ajustes de responsividade
```

---

## COMO INICIAR NO CLAUDE CODE (instruções para o usuário)

No Terminal do Mac:

```bash
cd /Users/luizhenrique/Desktop/Calculadora-eleitoral/RetotalizaJE/Calculadora-eleitoral
claude
```

Quando o Claude Code abrir, enviar esta mensagem como primeiro prompt:

> "Leia o arquivo BRIEFING-VISUAL.md que está na raiz do projeto.
> Confirme que entendeu as regras absolutas e me diga quais arquivos
> você NÃO vai tocar nesta tarefa. Depois disso, execute apenas o Passo 0."
```
