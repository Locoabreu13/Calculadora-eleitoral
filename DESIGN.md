# DESIGN.md — Sistema Visual RetotalizaJE

> **Regra absoluta:** nunca use valores brutos de cor, fonte ou espaçamento.
> Sempre referencie as variáveis abaixo via `var(--nome)`.
> A fonte de verdade é `css/tokens.css` (landing) e `css/tokens-vars.css` (app).

---

## 1. Fontes

| Uso | Família | Peso | Variável |
|-----|---------|------|----------|
| Títulos, números grandes, wordmark | **Syne** | 700 / 800 | `var(--fonte-titulo)` |
| Corpo, labels, botões, UI | **DM Sans** | 400 / 500 | `var(--fonte-corpo)` |

**Import Google Fonts:**
```html
family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;1,400
```

**Pesos:**
```
--peso-normal:  400
--peso-medio:   500
--peso-bold:    700
--peso-black:   800
```

---

## 2. Escala Tipográfica

| Variável | px equiv. | Uso típico |
|----------|-----------|------------|
| `--texto-xs`    | 11px | Labels, badges, small caps |
| `--texto-sm`    | 13px | Texto de apoio, descrições |
| `--texto-base`  | 16px | Corpo principal |
| `--texto-lg`    | 18px | Subtítulos |
| `--texto-xl`    | 22px | Títulos de card |
| `--texto-2xl`   | 28px | Títulos de seção, welcome title |
| `--texto-3xl`   | 36px | Títulos grandes, dashboard greeting |
| `--texto-hero`  | 48px | Hero desktop |

**Altura de linha:**
```
--linha-titulo:   1.15   (títulos)
--linha-corpo:    1.7    (parágrafos)
--linha-compacta: 1.4    (cards)
```

**Letter-spacing:**
```
--tracking-titulo: -0.03em   (Syne fica mais elegante)
--tracking-label:   0.08em   (labels small caps)
```

---

## 3. Paleta de Cores

### Fundos escuros — sidebar, navbar, hero, footer
```
--cor-profundo:        #0C1D30   ← fundo escuro principal
--cor-profundo-meio:   #1E3347   ← hover em elementos escuros
--cor-profundo-borda:  #2C4A63   ← bordas sobre fundo escuro
```

### Azul — botões CTA, links, ações principais
```
--cor-confiante:       #1A56DB
--cor-confiante-hover: #1445B8
--cor-confiante-claro: #EBF2FF
```

### Âmbar — "JE" do wordmark, destaques, badges ativos
```
--cor-ambar:           #D4A017
--cor-ambar-claro:     #FDF3D8
```

### Fundos claros — seções, cards, main content
```
--cor-fundo-principal: #F7F9FC   ← off-white, área principal
--cor-fundo-neutro:    #EEF2F7   ← alternância de seções
--cor-fundo-card:      #FFFFFF   ← branco puro, cards
```

### Texto sobre fundo claro
```
--cor-texto:           #0C1D30   ← texto principal
--cor-texto-medio:     #374151
--cor-texto-suave:     #64748B   ← texto secundário
--cor-texto-label:     #94A3B8   ← labels, dicas
```

### Texto sobre fundo escuro
```
--cor-texto-inv:       #F7F9FC   ← texto principal na sidebar
--cor-texto-inv-medio: #7A8FA0
--cor-texto-inv-suave: #3A5A78
```

### Bordas
```
--cor-borda:       #CBD5E1   ← bordas normais
--cor-borda-suave: #E2E8F0   ← bordas sutis (cards)
```

---

## 4. Espaçamento

Base 4px — sempre use os tokens, nunca valores soltos.

```
--espaco-4:   4px
--espaco-8:   8px
--espaco-12:  12px
--espaco-16:  16px
--espaco-20:  20px
--espaco-24:  24px
--espaco-32:  32px
--espaco-40:  40px
--espaco-48:  48px
--espaco-64:  64px
--espaco-80:  80px
--espaco-96:  96px
--espaco-128: 128px
```

---

## 5. Bordas e Cantos

```
--raio-sm:   4px    (badges, inputs pequenos)
--raio-md:   8px    (botões, inputs)
--raio-lg:   12px   (cards menores)
--raio-xl:   16px   (cards principais, painéis)
--raio-pill: 999px  (tags arredondadas)
```

---

## 6. Layout Bipartido (padrão do app)

O padrão visual central do sistema:

```
┌─────────────────┬────────────────────────────────────┐
│  SIDEBAR ESCURA │  ÁREA PRINCIPAL CLARA               │
│  400px fixo     │  flex: 1 — fundo cor-fundo-principal│
│  cor-profundo   │  overflow-y: auto                   │
└─────────────────┴────────────────────────────────────┘
```

**CSS:**
```css
.sidebar  { background: var(--cor-profundo); width: 400px; }
.main-content { background: var(--cor-fundo-principal); flex: 1; }
```

---

## 7. Padrões de Componentes

### Wordmark
```html
Retotaliza<span style="color:var(--cor-ambar)">JE</span>
```
- Fonte: `var(--fonte-titulo)` peso 700
- "JE" sempre em `var(--cor-ambar)`

### Card padrão (fundo claro)
```css
background: var(--cor-fundo-card);
border: 1px solid var(--cor-borda-suave);
border-radius: var(--raio-xl);
padding: var(--espaco-24);
```

### Card com hover âmbar
```css
transition: all .18s ease;
/* hover: */
border-color: var(--cor-ambar);
box-shadow: 0 4px 20px rgba(212,160,23,.1);
transform: translateY(-2px);
```

### Badge de UF / número de destaque
```css
background: var(--cor-profundo);
color: var(--cor-ambar);
font-family: var(--fonte-titulo);
font-weight: 800;
border-radius: var(--raio-md);
```

### Label small caps
```css
font-family: var(--fonte-corpo);
font-size: 10px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: .08em;
color: var(--cor-texto-label);
```

### Botão primário (azul CTA)
```css
background: var(--cor-confiante);
color: var(--cor-texto-inv);
font-family: var(--fonte-corpo);
font-weight: var(--peso-medio);
border-radius: var(--raio-md);
padding: 6px 14px;
/* hover: background: var(--cor-confiante-hover) */
```

### Botão dark (ação secundária escura)
```css
background: var(--cor-profundo);
color: var(--cor-texto-inv);
border: 1px solid var(--cor-profundo-borda);
border-radius: var(--raio-md);
```

### Número grande (métricas, KPIs)
```css
font-family: var(--fonte-titulo);
font-size: 22px;  /* ou --texto-2xl para destaque maior */
font-weight: 800;
color: var(--cor-texto);
```

### Tab ativa (navegação de fases)
```css
/* Inativo: */
color: var(--cor-texto-suave);
background: transparent;
border: 1px solid transparent;

/* Ativo: */
background: var(--cor-profundo);
color: var(--cor-texto-inv);
border-color: var(--cor-profundo);
border-radius: var(--raio-md);
```

---

## 8. Alternância de Fundos (sequência)

```
Navbar / Sidebar:   var(--cor-profundo)         escuro
Hero:               var(--cor-profundo)         escuro
Seção par:          var(--cor-fundo-neutro)     cinza suave
Seção ímpar:        var(--cor-fundo-principal)  off-white
CTA final:          var(--cor-confiante)        azul
Footer:             var(--cor-profundo)         escuro
```

---

## 9. Arquivos CSS

| Arquivo | Uso |
|---------|-----|
| `css/tokens.css` | Fonte de verdade — todas as variáveis + reset + utilitários |
| `css/tokens-vars.css` | Apenas o bloco `:root {}` — importar no `app.html` sem quebrar layout |
| `css/styles.css` | Estilos específicos do app (calculadora, dashboard, resultados) |
| `index.html` (inline) | Estilos da landing page embutidos no `<style>` |

**Regra de importação no app.html:**
```html
<link rel="stylesheet" href="css/tokens-vars.css" />
<link rel="stylesheet" href="css/styles.css?v=N" />
```
> ⚠️ Nunca importar `tokens.css` no app — ele tem reset global que quebra o layout.

---

## 10. Cache Busting

Sempre incrementar `?v=N` no link do `styles.css` após mudanças de CSS no app.
Versão atual: `?v=15`
