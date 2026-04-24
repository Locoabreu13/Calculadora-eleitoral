# Calculadora de Retotalização Eleitoral

Ferramenta técnico-jurídica para cálculo e retotalização de eleições proporcionais brasileiras, implementando rigorosamente o art. 109 do Código Eleitoral (Lei nº 14.211/2021) e a interpretação conforme fixada pelo STF nas **ADIs 7.228, 7.263 e 7.325** (julgamento de mérito e ED de 13/03/2025, redator Min. Flávio Dino).

## Uso

Abra `index.html` diretamente no navegador. Nenhuma instalação ou servidor necessário.

```
calculadora-eleitoral/
├── index.html
├── css/styles.css
├── js/
│   ├── engine.js      ← algoritmo puro (testável isoladamente)
│   ├── ui.js          ← manipulação de DOM
│   ├── presets.js     ← casos de estudo
│   ├── export.js      ← PDF / CSV / URL
│   └── i18n.js        ← formatação pt-BR
├── data/presets.json
└── tests/engine.test.js
```

## Executar os testes

```bash
node tests/engine.test.js
```

Sem dependências externas. Requer Node.js ≥ 14.

## Adicionar um preset

Edite `data/presets.json` e acrescente um objeto no array `presets`:

```json
{
  "id": "meu_preset",
  "rotulo": "Deputado Estadual — SP 2026",
  "vagas": 70,
  "partidos": [
    {
      "sigla": "PL",
      "nome": "Partido Liberal",
      "votosNominais": 1234567,
      "votosLegenda": 12345,
      "candidatos": [
        { "nome": "Fulano de Tal", "partido": "PL", "votos": 345678 }
      ]
    }
  ]
}
```

Campos obrigatórios: `id`, `rotulo`, `vagas`, `partidos[]` com `sigla`, `votosNominais`, `votosLegenda`.  
Campos opcionais: `candidatos[]`, `cassacoes[]`, `notas`.

## Estender o algoritmo

O módulo `js/engine.js` é puro (sem DOM). A função principal:

```js
const resultado = ElectoralEngine.calcular(cenario);
```

Onde `cenario` é `{ rotulo, vagas, partidos[], cassacoes[] }`.

**Extensões futuras sugeridas:**

- **Cota de gênero (Súmula 73/TSE):** após a convocação de cada candidato, verificar a proporção acumulada de gênero e, se necessário, pular para o próximo candidato elegível do gênero sub-representado.
- **Eleição majoritária:** implementar módulo separado (`engine-majoritario.js`) — a lógica é independente.
- **Sanções pós-eleição:** adicionar campo `{ cassado: true }` nos candidatos e chamar `aplicarCassacoes()` com a modalidade adequada.
- **Comparação multi-cenário:** chamar `calcular()` N vezes e usar `compararResultados()` em pares.

## Notas jurídicas

### Fase 2 — Barreira 80/20 (constitucional)

O STF, nas ADIs 7.228/7.263/7.325, **manteve** a constitucionalidade da dupla cláusula de barreira na Fase 2:
- Trava partidária: votos ≥ 80% do QE
- Trava individual: candidato disponível com ≥ 20% do QE

### Fase 3 — Sem barreira (inconstitucional pelo STF)

A exigência de 80% do QE **na Fase 3** foi declarada inconstitucional (art. 13 da Res. TSE 23.677/2021). Todos os partidos concorrem pelas maiores médias, independentemente de desempenho.

### Eficácia retroativa (ex tunc)

Os embargos de declaração acolhidos em 13/03/2025 confirmaram eficácia *ex tunc*, alcançando as eleições de 2022. O Ato nº 209/2025 da Mesa da Câmara executou a decisão no caso DF 2022 (Rollemberg/PSB).

### Art. 111 CE — Inconstitucional

O "distritão residual" foi declarado inconstitucional pelas mesmas ADIs. A calculadora nunca recorre a ele.

## Disclaimer

Esta ferramenta é um instrumento de apoio técnico para advogados eleitorais, assessores legislativos e pesquisadores. **Não substitui decisão da Justiça Eleitoral.** Os dados dos presets são aproximações para fins de demonstração; os dados oficiais devem ser obtidos diretamente dos sistemas TSE/TREs.
