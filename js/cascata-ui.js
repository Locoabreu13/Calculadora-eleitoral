import { calcularCascata } from "./cascata.js";

const estadoCascata = {
  ultimaBase: null,
  ultimoCenario: null,
  ultimosDadosRef: null,
  ultimosDadosCen: null,
  ultimoResultado: null
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
            <th style="padding: 10px; border: 1px solid #ddd;">Impacto (Cadeiras)</th>
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
      const cenario = window.Estado ? window.Estado.resultado : estadoCascata.ultimoCenario;
      abrirCascata(base, cenario, estadoCascata.ultimosDadosRef, estadoCascata.ultimosDadosCen);
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

function iniciar() {
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
  
  if (typeof window.pdfMake === 'undefined') {
    alert("Biblioteca PDF não encontrada. Certifique-se de estar conectado à internet para carregar os módulos necessários.");
    return;
  }

  const conteudo = [
    { text: 'IMPACTO FINANCEIRO E DE TEMPO DE PROPAGANDA DA RETOTALIZAÇÃO', style: 'header', margin: [0, 0, 0, 10] },
    { text: 'Anexo Técnico - Cascata Eleitoral', style: 'subheader', margin: [0, 0, 0, 20] }
  ];

  // FEFC
  if (res.nos.fefc && (res.nos.fefc.status === 'validado' || res.nos.fefc.status === 'parcial_35_pendente')) {
    conteudo.push({ text: '1. Fundo Especial de Financiamento de Campanha (FEFC)', style: 'secaoTitulo' });
    conteudo.push({ text: 'Base legal: Art. 16-D, incisos II e III da Lei nº 9.504/1997.', style: 'baseLegal' });
    
    let tabela = { table: { headerRows: 1, widths: ['*', 'auto'], body: [[{text: 'Partido', bold: true}, {text: 'Impacto Financeiro', bold: true}]] }, layout: 'lightHorizontalLines', margin: [0, 10, 0, 20] };
    let mudou = false;
    
    for (const sigla in res.nos.fefc.porPartido) {
      const p = res.nos.fefc.porPartido[sigla];
      if (p.deltaTotal !== 0) {
        mudou = true;
        tabela.table.body.push([sigla, (p.deltaTotal > 0 ? "+" : "") + formatarMoeda(p.deltaTotal)]);
      }
    }
    if (mudou) conteudo.push(tabela);
    else conteudo.push({ text: 'Nenhum impacto financeiro verificado nesta rubrica.', style: 'italicoMensagem' });
  }

  // Tempo de TV
  if (res.nos.tempoTV && res.nos.tempoTV.status === 'validado') {
    conteudo.push({ text: '2. Tempo de Propaganda Eleitoral Gratuita', style: 'secaoTitulo' });
    conteudo.push({ text: 'Base legal: Art. 47, § 1º, inciso II da Lei nº 9.504/1997.', style: 'baseLegal' });
    
    let tabela = { table: { headerRows: 1, widths: ['*', 'auto'], body: [[{text: 'Partido', bold: true}, {text: 'Variação na Quota', bold: true}]] }, layout: 'lightHorizontalLines', margin: [0, 10, 0, 20] };
    let mudou = false;
    
    for (const sigla in res.nos.tempoTV.porPartido) {
      const p = res.nos.tempoTV.porPartido[sigla];
      if (p.deltaFracao !== 0) {
        mudou = true;
        tabela.table.body.push([sigla, (p.deltaFracao > 0 ? "+" : "") + (p.deltaFracao * 100).toFixed(4).replace('.', ',') + "%"]);
      }
    }
    if (mudou) conteudo.push(tabela);
    else conteudo.push({ text: 'Nenhum impacto no tempo de propaganda verificado.', style: 'italicoMensagem' });
  }

  const docDefinition = {
    content: conteudo,
    styles: {
      header: { fontSize: 16, bold: true, alignment: 'center' },
      subheader: { fontSize: 12, alignment: 'center', color: '#666' },
      secaoTitulo: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
      baseLegal: { fontSize: 10, italics: true, color: '#444' },
      italicoMensagem: { fontSize: 11, italics: true, margin: [0, 5, 0, 20] }
    },
    defaultStyle: { fontSize: 11 }
  };

  window.pdfMake.createPdf(docDefinition).download('Parecer_Cascata_Eleitoral.pdf');
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
