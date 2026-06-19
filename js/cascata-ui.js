import { calcularCascata } from "./cascata.js";
import { dadosReferencia } from "./cascata-referencia.js";
import { gerarCenarioCascata } from "./cascata-adaptador.js";

const estadoCascata = {
  ultimaBase: null,
  ultimoCenario: null,
  ultimosDadosRef: null,
  ultimosDadosCen: null,
  ultimoResultado: null,
  ultimoTempoCalculo: 0
};

function formatarMoeda(valor) {
  if (typeof valor !== 'number') return 'R$ 0,00';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderizarCascata(resultado) {
  if (!resultado || !resultado.nos) return;
  const nos = resultado.nos;

  // 1. FEFC
  const divFefc = document.getElementById('cascata-fefc');
  if (divFefc && nos.fefc) {
    let html = `
      <h3 style="color: #333; margin-top: 0; margin-bottom: 8px;">Fundo Especial de Financiamento de Campanha (FEFC)</h3>
      <p style="color: #444; font-size: 0.95rem; margin-bottom: 16px; line-height: 1.4;">
        <strong>Fundamentação Legal:</strong> Art. 16-D, incisos II e III da Lei nº 9.504/1997.<br>
        <strong>Base de cálculo (Cadeira na Câmara):</strong> ${formatarMoeda(nos.fefc.unidadeCadeira || 4642357.69)}
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <thead>
          <tr style="background: #f8f9fa; text-align: left; border-bottom: 2px solid #ccc;">
            <th style="padding: 10px; border: 1px solid #ddd;">Partido</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Impacto Financeiro (48% cadeiras)</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Impacto Financeiro Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (nos.fefc.status === 'validado' || nos.fefc.status === 'parcial_35_pendente') {
      let temMudanca = false;
      for (const sigla in nos.fefc.porPartido) {
        const p = nos.fefc.porPartido[sigla];
        if (p.deltaTotal !== 0) {
          temMudanca = true;
          const ganhou = p.deltaTotal > 0;
          const corFonte = ganhou ? '#155724' : '#721c24';
          const corFundo = ganhou ? '#d4edda' : '#f8d7da';
          const sinal = ganhou ? '+' : '';
          
          html += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${sigla}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${formatarMoeda(p.delta48)}</td>
              <td style="padding: 10px; border: 1px solid #ddd; background: ${corFundo}; color: ${corFonte}; font-weight: bold;">
                ${sinal}${formatarMoeda(p.deltaTotal)}
              </td>
            </tr>
          `;
        }
      }
      if (!temMudanca) {
        html += `<tr><td colspan="3" style="padding: 10px; text-align: center; color: #666; font-style: italic;">Nenhum partido sofreu impacto financeiro na retotalização atual.</td></tr>`;
      }
    } else {
      html += `<tr><td colspan="3" style="padding: 10px; text-align: center; color: #666;">Cálculo indisponível. Motivo: ${nos.fefc.status.replace(/_/g, ' ')}</td></tr>`;
    }
    html += `</tbody></table>`;
    divFefc.innerHTML = html;
  }

  // 2. Tempo de TV
  const divTv = document.getElementById('cascata-tv');
  if (divTv && nos.tempoTV) {
    let html = `
      <h3 style="color: #333; margin-top: 0; margin-bottom: 8px;">Tempo de Propaganda (TV e Rádio)</h3>
      <p style="color: #444; font-size: 0.95rem; margin-bottom: 16px; line-height: 1.4;">
        <strong>Fundamentação Legal:</strong> Art. 47, § 1º, inciso II da Lei nº 9.504/1997.<br>
        <strong>Impacto na distribuição proporcional (90% do tempo total)</strong>
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <thead>
          <tr style="background: #f8f9fa; text-align: left; border-bottom: 2px solid #ccc;">
            <th style="padding: 10px; border: 1px solid #ddd;">Partido</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Variação na Quota</th>
          </tr>
        </thead>
        <tbody>
    `;
    if (nos.tempoTV.status === 'validado') {
      let temMudanca = false;
      for (const sigla in nos.tempoTV.porPartido) {
        const p = nos.tempoTV.porPartido[sigla];
        if (p.deltaFracao !== 0) {
          temMudanca = true;
          const ganhou = p.deltaFracao > 0;
          const corFonte = ganhou ? '#155724' : '#721c24';
          const corFundo = ganhou ? '#d4edda' : '#f8d7da';
          const sinal = ganhou ? '+' : '';
          const percentual = (p.deltaFracao * 100).toFixed(4).replace('.', ',');
          html += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${sigla}</td>
              <td style="padding: 10px; border: 1px solid #ddd; background: ${corFundo}; color: ${corFonte}; font-weight: bold;">
                ${sinal}${percentual}%
              </td>
            </tr>
          `;
        }
      }
      if (!temMudanca) {
        html += `<tr><td colspan="2" style="padding: 10px; text-align: center; color: #666; font-style: italic;">Sem impacto no tempo de TV para a retotalização atual.</td></tr>`;
      }
    } else {
      html += `<tr><td colspan="2" style="padding: 10px; text-align: center; color: #666;">Cálculo indisponível. Motivo: ${nos.tempoTV.status.replace(/_/g, ' ')}</td></tr>`;
    }
    html += `</tbody></table>`;
    divTv.innerHTML = html;
  }

  // 3. Cláusula de Desempenho
  const divClausula = document.getElementById('cascata-clausula');
  if (divClausula && nos.clausula) {
    let html = `
      <h3 style="color: #333; margin-top: 0; margin-bottom: 8px;">Cláusula de Desempenho</h3>
      <p style="color: #444; font-size: 0.95rem; margin-bottom: 16px; line-height: 1.4;">
        <strong>Fundamentação Legal:</strong> Art. 17, § 3º da Constituição Federal (EC 97/2017).<br>
        <strong>Patamar Aplicado:</strong> Eleições ${nos.clausula.anoEleicao || 2022}
      </p>
    `;
    if (nos.clausula.status === 'validado') {
      if (nos.clausula.temMudancaNaClausula && nos.clausula.mudancas && nos.clausula.mudancas.length > 0) {
        html += `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
            <thead>
              <tr style="background: #f8f9fa; text-align: left; border-bottom: 2px solid #ccc;">
                <th style="padding: 10px; border: 1px solid #ddd;">Partido/Federação</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Situação Nova</th>
              </tr>
            </thead>
            <tbody>
        `;
        nos.clausula.mudancas.forEach(m => {
          const atingiu = m.atingiuDepois;
          const corFonte = atingiu ? '#155724' : '#721c24';
          const corFundo = atingiu ? '#d4edda' : '#f8d7da';
          const texto = atingiu ? 'Passou a atingir a cláusula' : 'Deixou de atingir a cláusula';
          html += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${m.sigla}</td>
              <td style="padding: 10px; border: 1px solid #ddd; background: ${corFundo}; color: ${corFonte}; font-weight: bold;">${texto}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      } else {
        html += `<div style="padding: 16px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; color: #555; text-align: center; font-style: italic;">Nenhuma alteração na situação da Cláusula de Desempenho dos partidos nesta retotalização.</div>`;
      }
    } else {
      html += `<div style="padding: 16px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; color: #555; text-align: center;">Cálculo indisponível. Motivo: ${nos.clausula.status.replace(/_/g, ' ')}</div>`;
    }
    divClausula.innerHTML = html;
  }

  // 4. Fundo Partidário
  const divFundo = document.getElementById('cascata-fundo');
  if (divFundo && nos.fundoPartidario) {
    let html = `
      <h3 style="color: #333; margin-top: 0; margin-bottom: 8px;">Fundo Partidário (Quota de 95%)</h3>
      <p style="color: #444; font-size: 0.95rem; margin-bottom: 16px; line-height: 1.4;">
        <strong>Fundamentação Legal:</strong> Art. 41-A da Lei nº 9.096/1995.<br>
        <strong>Montante Anual de Referência:</strong> ${formatarMoeda(nos.fundoPartidario.valorTotalAnual || 1185566089.46)}
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <thead>
          <tr style="background: #f8f9fa; text-align: left; border-bottom: 2px solid #ccc;">
            <th style="padding: 10px; border: 1px solid #ddd;">Partido</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Impacto Financeiro (Estimativa Anual)</th>
          </tr>
        </thead>
        <tbody>
    `;
    if (nos.fundoPartidario.status === 'validado') {
      let temMudanca = false;
      for (const sigla in nos.fundoPartidario.deltas) {
        const valor = nos.fundoPartidario.deltas[sigla];
        if (valor !== 0) {
          temMudanca = true;
          const ganhou = valor > 0;
          const corFonte = ganhou ? '#155724' : '#721c24';
          const corFundo = ganhou ? '#d4edda' : '#f8d7da';
          const sinal = ganhou ? '+' : '';
          html += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${sigla}</td>
              <td style="padding: 10px; border: 1px solid #ddd; background: ${corFundo}; color: ${corFonte}; font-weight: bold;">
                ${sinal}${formatarMoeda(valor)}
              </td>
            </tr>
          `;
        }
      }
      if (!temMudanca) {
        html += `<tr><td colspan="2" style="padding: 10px; text-align: center; color: #666; font-style: italic;">Nenhum partido sofreu impacto financeiro no Fundo Partidário.</td></tr>`;
      }
    } else {
      html += `<tr><td colspan="2" style="padding: 10px; text-align: center; color: #666;">Cálculo indisponível. Motivo: ${nos.fundoPartidario.status.replace(/_/g, ' ')}</td></tr>`;
    }
    html += `</tbody></table>`;
    divFundo.innerHTML = html;
  }
}

export function abrirCascata(saidaEngineBase, saidaEngineCenario, dadosReferencia, dadosCenario) {
  if (saidaEngineBase) estadoCascata.ultimaBase = saidaEngineBase;
  if (saidaEngineCenario) estadoCascata.ultimoCenario = saidaEngineCenario;
  if (dadosReferencia) estadoCascata.ultimosDadosRef = dadosReferencia;
  if (dadosCenario) estadoCascata.ultimosDadosCen = dadosCenario;

  const overlay = document.getElementById("cascata-overlay");
  if (overlay) overlay.style.display = "flex";

  // Auto-detectar UF e configurar visibilidade do seletor
  const ufContainer = document.getElementById("cascata-uf-container");
  const selUfOv = document.getElementById("sel-cascata-uf-overlay");
  let ufAuto = "";
  try { ufAuto = (window.ImportTSE?.getFonteDados()?.uf || "").trim(); } catch(e) {}
  if (ufAuto && selUfOv) selUfOv.value = ufAuto;
  if (ufContainer) ufContainer.style.display = ufAuto ? "none" : "flex";

  if (!estadoCascata.ultimaBase || !estadoCascata.ultimoCenario) {
    console.warn("Cascata: Faltam dados do motor para o cálculo inicial.");
    return;
  }

  const resultado = calcularCascata(
    estadoCascata.ultimaBase,
    estadoCascata.ultimoCenario,
    estadoCascata.ultimosDadosRef,
    estadoCascata.ultimosDadosCen
  );

  estadoCascata.ultimoResultado = resultado;
  renderizarCascata(resultado);
}

window.CascataUI = { abrirCascata };

function alternarAba(abaClicada) {
  document.querySelectorAll(".cascata-tab").forEach(aba => {
    aba.classList.remove("active");
    aba.style.background = "transparent";
    aba.style.fontWeight = "normal";
  });
  abaClicada.classList.add("active");
  abaClicada.style.background = "#fff";
  abaClicada.style.fontWeight = "bold";

  const alvoId = abaClicada.dataset.target;
  document.querySelectorAll(".cascata-panel").forEach(painel => {
    painel.style.display = painel.id === alvoId ? "block" : "none";
  });
}

function fecharOverlay() {
  const overlay = document.getElementById("cascata-overlay");
  if (overlay) overlay.style.display = "none";
}

function configurarEventos() {
  const btnFechar = document.getElementById("cascata-fechar");
  if (btnFechar) btnFechar.addEventListener("click", fecharOverlay);

  const btnCopiar = document.getElementById("btn-cascata-copiar");
  if (btnCopiar) btnCopiar.addEventListener("click", copiarTextoPeticao);

  const btnPdf = document.getElementById("btn-cascata-pdf");
  if (btnPdf) btnPdf.addEventListener("click", exportarPdfCascata);

  document.querySelectorAll(".cascata-tab").forEach(aba => {
    aba.addEventListener("click", () => alternarAba(aba));
  });

  const btnCascata = document.getElementById("btn-cascata");
  if (btnCascata) {
    btnCascata.addEventListener("click", () => {
      const base = window.Estado ? window.Estado.resultadoOriginal : estadoCascata.ultimaBase;
      const cenarioMotor = window.Estado ? window.Estado.resultado : estadoCascata.ultimoCenario;
      
      if (!base || !cenarioMotor) {
        console.warn("Cascata: Resultados do motor indisponíveis.");
        return;
      }

      // Aciona o perito para extrair os deltas e aplicar o voto em dobro
      let ufSelecionada = "";
      try { ufSelecionada = (window.ImportTSE?.getFonteDados()?.uf || "").trim(); } catch(e) {}
      if (!ufSelecionada) {
        const selUf = document.getElementById("sel-cascata-uf-overlay");
        ufSelecionada = selUf ? selUf.value.trim() : "";
      }
      const dadosCenarioAdaptado = gerarCenarioCascata(base, cenarioMotor, "cassacao_com_perda_votos", ufSelecionada);
      
      abrirCascata(base, cenarioMotor, dadosReferencia, dadosCenarioAdaptado);
    });
  }

  // Recalcula automaticamente quando o usuario troca a UF dentro do overlay
  const selUfOverlay = document.getElementById("sel-cascata-uf-overlay");
  if (selUfOverlay) {
    selUfOverlay.addEventListener("change", () => {
      const base = estadoCascata.ultimaBase;
      const cenarioMotor = estadoCascata.ultimoCenario;
      if (!base || !cenarioMotor) return;
      const ufSelecionada = selUfOverlay.value.trim();
      const dadosCenarioAdaptado = gerarCenarioCascata(base, cenarioMotor, "cassacao_com_perda_votos", ufSelecionada);
      abrirCascata(base, cenarioMotor, dadosReferencia, dadosCenarioAdaptado);
    });
  }
}

function observarResultados() {
  const btnApresentacao = document.getElementById("btn-apresentacao");
  const btnCascata = document.getElementById("btn-cascata");

  if (btnApresentacao && btnCascata) {
    btnCascata.disabled = btnApresentacao.disabled;

    const observer = new MutationObserver(() => {
      btnCascata.disabled = btnApresentacao.disabled;
    });

    observer.observe(btnApresentacao, { attributes: true, attributeFilter: ["disabled"] });
  }
}

function instalarGrampoNoMotor() {
  if (window.ElectoralEngine && window.ElectoralEngine.calcular && !window.ElectoralEngine._grampoInstalado) {
    const calcularOriginal = window.ElectoralEngine.calcular;
    
    window.ElectoralEngine.calcular = function(cenario) {
      // Deixa o motor original fazer a conta normalmente
      const resultado = calcularOriginal.call(this, cenario);
      const agora = Date.now();
      
      // Se os cálculos ocorrerem na mesma fração de segundo (< 100ms), 
      // o primeiro foi a base e o segundo é o cenário retotalizado.
      // Se for um clique novo (> 100ms de intervalo), reseta o estado.
      if (agora - estadoCascata.ultimoTempoCalculo > 100) {
        estadoCascata.ultimaBase = resultado;
        estadoCascata.ultimoCenario = resultado;
      } else {
        estadoCascata.ultimaBase = estadoCascata.ultimoCenario;
        estadoCascata.ultimoCenario = resultado;
      }
      
      estadoCascata.ultimoTempoCalculo = agora;
      return resultado;
    };
    
    window.ElectoralEngine._grampoInstalado = true;
  }
}

function iniciar() {
  instalarGrampoNoMotor();
  configurarEventos();
  observarResultados();
}

function copiarTextoPeticao() {
  const res = estadoCascata.ultimoResultado;
  if (!res || !res.nos) {
    alert("Nenhum resultado disponível para cópia.");
    return;
  }
  
  let texto = "IMPACTO FINANCEIRO E DE TEMPO DE PROPAGANDA DA RETOTALIZAÇÃO\n\n";
  
  if (res.nos.fefc && (res.nos.fefc.status === 'validado' || res.nos.fefc.status === 'parcial_35_pendente')) {
    texto += "1. Fundo Especial de Financiamento de Campanha (FEFC)\n";
    texto += "Base legal: Art. 16-D, incisos II e III da Lei 9.504/1997.\n";
    let temMudanca = false;
    for (const sigla in res.nos.fefc.porPartido) {
      const p = res.nos.fefc.porPartido[sigla];
      if (p.deltaTotal !== 0) {
        temMudanca = true;
        texto += sigla + ": " + (p.deltaTotal > 0 ? "+" : "") + formatarMoeda(p.deltaTotal) + "\n";
      }
    }
    if (!temMudanca) texto += "Nenhum impacto financeiro verificado.\n";
    texto += "\n";
  }

  if (res.nos.tempoTV && res.nos.tempoTV.status === 'validado') {
    texto += "2. Tempo de Propaganda Eleitoral Gratuita\n";
    texto += "Base legal: Art. 47, parágrafo 1º, inciso II da Lei 9.504/1997.\n";
    let temMudanca = false;
    for (const sigla in res.nos.tempoTV.porPartido) {
      const p = res.nos.tempoTV.porPartido[sigla];
      if (p.deltaFracao !== 0) {
        temMudanca = true;
        texto += sigla + ": " + (p.deltaFracao > 0 ? "+" : "") + (p.deltaFracao * 100).toFixed(4).replace('.', ',') + "%\n";
      }
    }
    if (!temMudanca) texto += "Nenhum impacto no tempo de propaganda verificado.\n";
    texto += "\n";
  }

  if (res.nos.clausula && res.nos.clausula.status === 'validado') {
    texto += "3. Clausula de Desempenho\n";
    texto += "Base legal: Art. 17, paragrafo 3o da Constituicao Federal (EC 97/2017). Patamar: Eleicoes " + (res.nos.clausula.anoEleicao || 2022) + ".\n";
    if (res.nos.clausula.temMudancaNaClausula && res.nos.clausula.mudancas && res.nos.clausula.mudancas.length > 0) {
      res.nos.clausula.mudancas.forEach(m => {
        const situacao = m.atingiuDepois ? "Passou a atingir a clausula" : "Deixou de atingir a clausula";
        texto += m.sigla + ": " + situacao + "\n";
      });
    } else {
      texto += "Nenhuma alteracao na situacao da Clausula de Desempenho.\n";
    }
    texto += "\n";
  }

  if (res.nos.fundoPartidario && res.nos.fundoPartidario.status === 'validado') {
    texto += "4. Fundo Partidario (Quota de 95%)\n";
    texto += "Base legal: Art. 41-A da Lei 9.096/1995.\n";
    let temMudancaFundo = false;
    for (const sigla in res.nos.fundoPartidario.deltas) {
      const valor = res.nos.fundoPartidario.deltas[sigla];
      if (valor !== 0) {
        temMudancaFundo = true;
        texto += sigla + ": " + (valor > 0 ? "+" : "") + formatarMoeda(valor) + "\n";
      }
    }
    if (!temMudancaFundo) texto += "Nenhum impacto verificado no Fundo Partidario.\n";
    texto += "\n";
  }

  navigator.clipboard.writeText(texto).then(() => {
    const btn = document.getElementById("btn-cascata-copiar");
    const textoOriginal = btn.innerText;
    btn.innerText = "Copiado!";
    btn.style.background = "#28a745";
    setTimeout(() => {
      btn.innerText = textoOriginal;
      btn.style.background = "#0056b3";
    }, 2000);
  }).catch(err => {
    console.error("Erro ao copiar texto: ", err);
    alert("Não foi possível copiar o texto.");
  });
}

function exportarPdfCascata() {
  const res = estadoCascata.ultimoResultado;
  if (!res || !res.nos) {
    alert("Nenhum resultado disponível para exportação.");
    return;
  }

  let secoes = "";

  // FEFC
  if (res.nos.fefc && (res.nos.fefc.status === "validado" || res.nos.fefc.status === "parcial_35_pendente")) {
    secoes += `
      <h2>1. Fundo Especial de Financiamento de Campanha (FEFC)</h2>
      <p class="base-legal">Base legal: Art. 16-D, incisos II e III da Lei n&ordm; 9.504/1997.</p>
      <table>
        <thead><tr><th>Partido</th><th>Impacto Financeiro</th></tr></thead>
        <tbody>`;
    let mudou = false;
    for (const sigla in res.nos.fefc.porPartido) {
      const p = res.nos.fefc.porPartido[sigla];
      if (p.deltaTotal !== 0) {
        mudou = true;
        const sinal = p.deltaTotal > 0 ? "+" : "";
        const cls = p.deltaTotal > 0 ? "positivo" : "negativo";
        secoes += `<tr><td class="partido">${sigla}</td><td class="${cls}">${sinal}${formatarMoeda(p.deltaTotal)}</td></tr>`;
      }
    }
    if (!mudou) secoes += `<tr><td colspan="2" class="sem-impacto">Nenhum impacto financeiro verificado nesta rúbrica.</td></tr>`;
    secoes += `</tbody></table>`;
  }

  // Tempo de TV
  if (res.nos.tempoTV && res.nos.tempoTV.status === "validado") {
    secoes += `
      <h2>2. Tempo de Propaganda Eleitoral Gratuita</h2>
      <p class="base-legal">Base legal: Art. 47, &sect; 1&ordm;, inciso II da Lei n&ordm; 9.504/1997.</p>
      <table>
        <thead><tr><th>Partido</th><th>Varia&ccedil;&atilde;o na Quota</th></tr></thead>
        <tbody>`;
    let mudou = false;
    for (const sigla in res.nos.tempoTV.porPartido) {
      const p = res.nos.tempoTV.porPartido[sigla];
      if (p.deltaFracao !== 0) {
        mudou = true;
        const sinal = p.deltaFracao > 0 ? "+" : "";
        const cls = p.deltaFracao > 0 ? "positivo" : "negativo";
        const pct = (p.deltaFracao * 100).toFixed(4).replace(".", ",");
        secoes += `<tr><td class="partido">${sigla}</td><td class="${cls}">${sinal}${pct}%</td></tr>`;
      }
    }
    if (!mudou) secoes += `<tr><td colspan="2" class="sem-impacto">Nenhum impacto no tempo de propaganda verificado.</td></tr>`;
    secoes += `</tbody></table>`;
  }

  // Clausula
  if (res.nos.clausula && res.nos.clausula.status === "validado") {
    secoes += `
      <h2>3. Cl&aacute;usula de Desempenho</h2>
      <p class="base-legal">Base legal: Art. 17, &sect; 3&ordm; da Constitui&ccedil;&atilde;o Federal (EC 97/2017). Patamar: Elei&ccedil;&otilde;es ${res.nos.clausula.anoEleicao || 2022}.</p>`;
    if (res.nos.clausula.temMudancaNaClausula && res.nos.clausula.mudancas && res.nos.clausula.mudancas.length > 0) {
      secoes += `<table><thead><tr><th>Partido</th><th>Situa&ccedil;&atilde;o</th></tr></thead><tbody>`;
      res.nos.clausula.mudancas.forEach(m => {
        const cls = m.atingiuDepois ? "positivo" : "negativo";
        const texto = m.atingiuDepois ? "Passou a atingir a cl&aacute;usula" : "Deixou de atingir a cl&aacute;usula";
        secoes += `<tr><td class="partido">${m.sigla}</td><td class="${cls}">${texto}</td></tr>`;
      });
      secoes += `</tbody></table>`;
    } else {
      secoes += `<p class="sem-impacto">Nenhuma altera&ccedil;&atilde;o na situa&ccedil;&atilde;o da Cl&aacute;usula de Desempenho nesta retotaliza&ccedil;&atilde;o.</p>`;
    }
  }

  // Fundo Partidario
  if (res.nos.fundoPartidario && res.nos.fundoPartidario.status === "validado") {
    secoes += `
      <h2>4. Fundo Partid&aacute;rio (Quota de 95%)</h2>
      <p class="base-legal">Base legal: Art. 41-A da Lei n&ordm; 9.096/1995.</p>
      <table>
        <thead><tr><th>Partido</th><th>Impacto Financeiro (Estimativa Anual)</th></tr></thead>
        <tbody>`;
    let mudou = false;
    for (const sigla in res.nos.fundoPartidario.deltas) {
      const valor = res.nos.fundoPartidario.deltas[sigla];
      if (valor !== 0) {
        mudou = true;
        const sinal = valor > 0 ? "+" : "";
        const cls = valor > 0 ? "positivo" : "negativo";
        secoes += `<tr><td class="partido">${sigla}</td><td class="${cls}">${sinal}${formatarMoeda(valor)}</td></tr>`;
      }
    }
    if (!mudou) secoes += `<tr><td colspan="2" class="sem-impacto">Nenhum impacto verificado no Fundo Partid&aacute;rio.</td></tr>`;
    secoes += `</tbody></table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Parecer Cascata Eleitoral</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 2cm; }
  h1 { font-size: 14pt; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
  .subtitulo { text-align: center; font-size: 10pt; color: #555; margin-bottom: 24px; }
  h2 { font-size: 12pt; margin-top: 20px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .base-legal { font-size: 9pt; font-style: italic; color: #444; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f0f0f0; padding: 8px; border: 1px solid #ccc; text-align: left; font-size: 10pt; }
  td { padding: 8px; border: 1px solid #ddd; font-size: 10pt; }
  td.partido { font-weight: bold; }
  td.positivo { color: #155724; font-weight: bold; }
  td.negativo { color: #721c24; font-weight: bold; }
  td.sem-impacto { text-align: center; font-style: italic; color: #666; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body>
<h1>Impacto Financeiro e de Tempo de Propaganda da Retotaliza&ccedil;&atilde;o</h1>
<p class="subtitulo">Anexo T&eacute;cnico &mdash; Cascata Eleitoral / RetotalizaJE</p>
${secoes}
</body>
</html>`;

  const janela = window.open("", "_blank");
  if (!janela) {
    alert("O navegador bloqueou a abertura da janela. Permita pop-ups para este site e tente novamente.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
