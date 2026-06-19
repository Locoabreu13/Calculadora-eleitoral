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

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarPercentual(valor) {
  if (typeof valor !== "number") return "0,0000%";
  return (valor * 100).toFixed(4).replace(".", ",") + "%";
}

function formatarMoedaCompacta(valor) {
  if (typeof valor !== "number") return "—";
  const abs = Math.abs(valor);
  if (abs >= 1000000) return "R$ " + (valor / 1000000).toFixed(2).replace(".", ",") + "M";
  if (abs >= 1000) return "R$ " + (valor / 1000).toFixed(1).replace(".", ",") + " mil";
  return formatarMoeda(valor);
}

function classeValor(valor) {
  if (valor > 0) return "pos";
  if (valor < 0) return "neg";
  return "";
}

function sinal(valor) {
  return valor > 0 ? "+" : "";
}

function textoStatus(status) {
  if (status === "validado") return "Calculado";
  if (status && status.includes("pendente")) return "Pendente";
  return "Indisponível";
}

function classeStatus(status) {
  if (status === "validado") return "";
  if (status && status.includes("pendente")) return "warn";
  return "neutral";
}

function deltaCadeiras() {
  const delta = estadoCascata.ultimosDadosCen && estadoCascata.ultimosDadosCen.deltaCadeirasPorPartido;
  return delta && typeof delta === "object" ? delta : {};
}

function descreverDeltaCadeiras() {
  const pares = Object.entries(deltaCadeiras()).filter(([, valor]) => valor);
  if (!pares.length) return { total: "0", desc: "Sem transferência de cadeira" };
  const perdas = pares.filter(([, v]) => v < 0).map(([s]) => s);
  const ganhos = pares.filter(([, v]) => v > 0).map(([s]) => s);
  const total = pares.reduce((acc, [, v]) => acc + Math.max(0, v), 0);
  const desc = perdas.length && ganhos.length
    ? `${perdas.join(", ")} → ${ganhos.join(", ")}`
    : "Comparação entre cenários";
  return { total: String(total), desc };
}

function obterDeltaFundo(valor, totalAnual) {
  if (typeof valor === "number") return valor;
  if (valor && typeof valor === "object") {
    const f5 = typeof valor.deltaFatia5 === "number" ? valor.deltaFatia5 : 0;
    const f95 = typeof valor.deltaFatia95 === "number" ? valor.deltaFatia95 : 0;
    return (f5 + f95) * (typeof totalAnual === "number" ? totalAnual : 0);
  }
  return 0;
}

function atualizarResumoCascata(resultado) {
  if (!resultado || !resultado.nos) return;

  const cad = descreverDeltaCadeiras();
  const kpiCad = document.getElementById("cascata-kpi-cadeiras");
  const kpiCadDesc = document.getElementById("cascata-kpi-cadeiras-desc");
  if (kpiCad) kpiCad.textContent = cad.total;
  if (kpiCadDesc) kpiCadDesc.textContent = cad.desc;

  const contexto = document.getElementById("cascata-contexto");
  if (contexto) {
    let uf = "";
    try { uf = (window.ImportTSE?.getFonteDados()?.uf || "").trim(); } catch(e) {}
    contexto.textContent = `Resultado da retotalização atual${uf ? " · " + uf : ""}${cad.desc !== "Sem transferência de cadeira" ? " · " + cad.desc : ""}`;
  }

  const fefc = resultado.nos.fefc;
  const totalFefc = fefc && fefc.porPartido
    ? Object.values(fefc.porPartido).reduce((acc, p) => acc + Math.max(0, p.deltaTotal || 0), 0)
    : 0;
  const kpiFefc = document.getElementById("cascata-kpi-fefc");
  const kpiFefcDesc = document.getElementById("cascata-kpi-fefc-desc");
  if (kpiFefc) kpiFefc.textContent = totalFefc ? formatarMoedaCompacta(totalFefc) : "Sem impacto";
  if (kpiFefcDesc) kpiFefcDesc.textContent = totalFefc ? formatarMoeda(totalFefc) : "Art. 16-D";

  const tv = resultado.nos.tempoTV;
  const mudouTv = tv && tv.porPartido && Object.values(tv.porPartido).some(p => p.deltaFracao !== 0);
  const kpiTv = document.getElementById("cascata-kpi-tv");
  const kpiTvDesc = document.getElementById("cascata-kpi-tv-desc");
  if (kpiTv) kpiTv.textContent = mudouTv ? "Redistr." : "Sem impacto";
  if (kpiTvDesc) kpiTvDesc.textContent = "90% por cadeira";

  const fundo = resultado.nos.fundoPartidario;
  const totalFundo = fundo && fundo.deltas
    ? Object.values(fundo.deltas).reduce((acc, v) => acc + Math.max(0, obterDeltaFundo(v, fundo.valorTotalAnual)), 0)
    : 0;
  const kpiFundo = document.getElementById("cascata-kpi-fundo");
  const kpiFundoDesc = document.getElementById("cascata-kpi-fundo-desc");
  if (kpiFundo) kpiFundo.textContent = totalFundo ? formatarMoedaCompacta(totalFundo) : "Anual";
  if (kpiFundoDesc) kpiFundoDesc.textContent = fundo && fundo.status ? textoStatus(fundo.status) : "Art. 41-A";
}

function renderizarCascata(resultado) {
  if (!resultado || !resultado.nos) return;
  const nos = resultado.nos;

  // 1. FEFC
  const divFefc = document.getElementById('cascata-fefc');
  if (divFefc && nos.fefc) {
    let html = `
      <div class="cascata-node-head">
        <div>
          <h2>Fundo Especial de Financiamento de Campanha <em>(FEFC)</em></h2>
          <p><strong>Fundamentação Legal:</strong> Art. 16-D, incisos II e III da Lei nº 9.504/1997.<br>
          <strong>Base de cálculo (cadeira na Câmara):</strong> <span class="cascata-value">${formatarMoeda(nos.fefc.unidadeCadeira || 4642357.69)}</span></p>
        </div>
        <span class="cascata-status-pill ${classeStatus(nos.fefc.status)}">${textoStatus(nos.fefc.status)}</span>
      </div>
      <div class="cascata-table">
        <div class="cascata-row cascata-row-head cascata-cols-3"><div>Partido</div><div>Impacto (48% cadeiras)</div><div>Impacto Total</div></div>
    `;

    if (nos.fefc.status === 'validado' || nos.fefc.status === 'parcial_35_pendente') {
      let temMudanca = false;
      for (const sigla in nos.fefc.porPartido) {
        const p = nos.fefc.porPartido[sigla];
        if (p.deltaTotal !== 0) {
          temMudanca = true;
          const classe = classeValor(p.deltaTotal);
          html += `
            <div class="cascata-row cascata-cols-3">
              <div class="cascata-party-cell">
                <span class="cascata-party-marker ${classe}"></span>
                <div>
                  <div class="cascata-party-name">${escaparHtml(sigla)}</div>
                  <div class="cascata-party-desc">${p.deltaTotal > 0 ? "Ganhou impacto financeiro" : "Perdeu impacto financeiro"}</div>
                </div>
              </div>
              <div class="cascata-value ${classe}">${sinal(p.delta48 || 0)}${formatarMoeda(p.delta48 || 0)}</div>
              <div class="cascata-value ${classe}">${sinal(p.deltaTotal)}${formatarMoeda(p.deltaTotal)}</div>
            </div>
          `;
        }
      }
      if (!temMudanca) {
        html += `<div class="cascata-empty">Nenhum partido sofreu impacto financeiro na retotalização atual.</div>`;
      }
    } else {
      html += `<div class="cascata-unavailable">Cálculo indisponível. Motivo: ${escaparHtml(String(nos.fefc.status || "").replace(/_/g, " "))}</div>`;
    }
    html += `</div>
      <div class="cascata-note"><div><strong>Cálculo proporcional:</strong> a fração de cadeiras do FEFC é redistribuída conforme a mudança de cadeiras na Câmara, preservando a base oficial de referência.</div></div>`;
    divFefc.innerHTML = html;
  }

  // 2. Tempo de TV
  const divTv = document.getElementById('cascata-tv');
  if (divTv && nos.tempoTV) {
    let html = `
      <div class="cascata-node-head">
        <div>
          <h2>Tempo de <em>Propaganda</em> (TV e Rádio)</h2>
          <p><strong>Fundamentação Legal:</strong> Art. 47, § 1º, inciso II da Lei nº 9.504/1997.<br>
          <strong>Impacto na distribuição proporcional:</strong> 90% do tempo total.</p>
        </div>
        <span class="cascata-status-pill ${classeStatus(nos.tempoTV.status)}">${textoStatus(nos.tempoTV.status)}</span>
      </div>
      <div class="cascata-table">
        <div class="cascata-row cascata-row-head cascata-cols-2"><div>Partido</div><div>Variação na quota</div></div>
    `;
    if (nos.tempoTV.status === 'validado') {
      let temMudanca = false;
      for (const sigla in nos.tempoTV.porPartido) {
        const p = nos.tempoTV.porPartido[sigla];
        if (p.deltaFracao !== 0) {
          temMudanca = true;
          const classe = classeValor(p.deltaFracao);
          html += `
            <div class="cascata-row cascata-cols-2">
              <div class="cascata-party-cell">
                <span class="cascata-party-marker ${classe}"></span>
                <div>
                  <div class="cascata-party-name">${escaparHtml(sigla)}</div>
                  <div class="cascata-party-desc">${p.deltaFracao > 0 ? "Ganhou quota" : "Perdeu quota"}</div>
                </div>
              </div>
              <div class="cascata-value ${classe}">${sinal(p.deltaFracao)}${formatarPercentual(p.deltaFracao)}</div>
            </div>
          `;
        }
      }
      if (!temMudanca) {
        html += `<div class="cascata-empty">Sem impacto no tempo de TV para a retotalização atual.</div>`;
      }
    } else {
      html += `<div class="cascata-unavailable">Cálculo indisponível. Motivo: ${escaparHtml(String(nos.tempoTV.status || "").replace(/_/g, " "))}</div>`;
    }
    html += `</div>
      <div class="cascata-note"><div><strong>Nota técnica:</strong> a fórmula 90/10 do art. 47 é aplicada em fração, para medir o impacto da retotalização sobre a divisão do tempo.</div></div>`;
    divTv.innerHTML = html;
  }

  // 3. Cláusula de Desempenho
  const divClausula = document.getElementById('cascata-clausula');
  if (divClausula && nos.clausula) {
    let html = `
      <div class="cascata-node-head">
        <div>
          <h2>Cláusula de <em>Desempenho</em></h2>
          <p><strong>Fundamentação Legal:</strong> Art. 17, § 3º da Constituição Federal (EC 97/2017).<br>
          <strong>Patamar aplicado:</strong> Eleições ${nos.clausula.anoEleicao || 2022}</p>
        </div>
        <span class="cascata-status-pill ${classeStatus(nos.clausula.status)}">${textoStatus(nos.clausula.status)}</span>
      </div>
    `;
    if (nos.clausula.status === 'validado') {
      if (nos.clausula.temMudancaNaClausula && nos.clausula.mudancas && nos.clausula.mudancas.length > 0) {
        html += `<div class="cascata-table"><div class="cascata-row cascata-row-head cascata-cols-2"><div>Partido/Federação</div><div>Situação nova</div></div>`;
        nos.clausula.mudancas.forEach(m => {
          const atingiu = m.atingiuDepois;
          const classe = atingiu ? "pos" : "neg";
          const texto = atingiu ? 'Passou a atingir a cláusula' : 'Deixou de atingir a cláusula';
          html += `
            <div class="cascata-row cascata-cols-2">
              <div class="cascata-party-cell"><span class="cascata-party-marker ${classe}"></span><div class="cascata-party-name">${escaparHtml(m.sigla)}</div></div>
              <div class="cascata-value ${classe}">${texto}</div>
            </div>
          `;
        });
        html += `</div>`;
      } else {
        html += `<div class="cascata-table"><div class="cascata-empty">Nenhuma alteração na situação da Cláusula de Desempenho dos partidos nesta retotalização.</div></div>`;
      }
    } else {
      html += `<div class="cascata-table"><div class="cascata-unavailable">Cálculo indisponível. Motivo: ${escaparHtml(String(nos.clausula.status || "").replace(/_/g, " "))}</div></div>`;
    }
    html += `<div class="cascata-note"><div><strong>Importância:</strong> a cláusula é um nó de alta alavancagem. Uma única cadeira pode afetar acesso a recursos e tempo de propaganda.</div></div>`;
    divClausula.innerHTML = html;
  }

  // 4. Fundo Partidário
  const divFundo = document.getElementById('cascata-fundo');
  if (divFundo && nos.fundoPartidario) {
    let html = `
      <div class="cascata-node-head">
        <div>
          <h2>Fundo <em>Partidário</em> (quota de 95%)</h2>
          <p><strong>Fundamentação Legal:</strong> Art. 41-A da Lei nº 9.096/1995.<br>
          <strong>Montante anual de referência:</strong> <span class="cascata-value">${formatarMoeda(nos.fundoPartidario.valorTotalAnual || 1185566089.46)}</span></p>
        </div>
        <span class="cascata-status-pill ${classeStatus(nos.fundoPartidario.status)}">${textoStatus(nos.fundoPartidario.status)}</span>
      </div>
      <div class="cascata-table">
        <div class="cascata-row cascata-row-head cascata-cols-2"><div>Partido</div><div>Impacto financeiro estimado</div></div>
    `;
    if (nos.fundoPartidario.status === 'validado') {
      let temMudanca = false;
      for (const sigla in nos.fundoPartidario.deltas) {
        const valor = obterDeltaFundo(nos.fundoPartidario.deltas[sigla], nos.fundoPartidario.valorTotalAnual);
        if (valor !== 0) {
          temMudanca = true;
          const classe = classeValor(valor);
          html += `
            <div class="cascata-row cascata-cols-2">
              <div class="cascata-party-cell">
                <span class="cascata-party-marker ${classe}"></span>
                <div class="cascata-party-name">${escaparHtml(sigla)}</div>
              </div>
              <div class="cascata-value ${classe}">${sinal(valor)}${formatarMoeda(valor)}</div>
            </div>
          `;
        }
      }
      if (!temMudanca) {
        html += `<div class="cascata-empty">Nenhum partido sofreu impacto financeiro no Fundo Partidário.</div>`;
      }
    } else {
      html += `<div class="cascata-unavailable">Cálculo indisponível. Motivo: ${escaparHtml(String(nos.fundoPartidario.status || "").replace(/_/g, " "))}</div>`;
    }
    html += `</div>
      <div class="cascata-note"><div><strong>Composição:</strong> 5% são distribuídos igualmente entre partidos com cláusula, e 95% proporcionalmente aos votos válidos.</div></div>`;
    divFundo.innerHTML = html;
  }
}

export function abrirCascata(saidaEngineBase, saidaEngineCenario, dadosReferencia, dadosCenario) {
  if (saidaEngineBase) estadoCascata.ultimaBase = saidaEngineBase;
  if (saidaEngineCenario) estadoCascata.ultimoCenario = saidaEngineCenario;
  if (dadosReferencia) estadoCascata.ultimosDadosRef = dadosReferencia;
  if (dadosCenario) estadoCascata.ultimosDadosCen = dadosCenario;

  const app = document.getElementById("app");
  const telaCascata = document.getElementById("tela-cascata");
  if (app) app.style.display = "none";
  if (telaCascata) {
    telaCascata.style.display = "flex";
    const conteudo = telaCascata.querySelector(".cascata-content");
    if (conteudo) conteudo.scrollTop = 0;
  }

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
  atualizarResumoCascata(resultado);
}

window.CascataUI = { abrirCascata };

function alternarAba(abaClicada) {
  document.querySelectorAll(".cascata-tab").forEach(aba => {
    aba.classList.remove("active");
  });
  abaClicada.classList.add("active");

  const alvoId = abaClicada.dataset.target;
  document.querySelectorAll(".cascata-panel").forEach(painel => {
    painel.style.display = painel.id === alvoId ? "block" : "none";
  });
}

function fecharOverlay() {
  const telaCascata = document.getElementById("tela-cascata");
  const app = document.getElementById("app");
  if (telaCascata) telaCascata.style.display = "none";
  if (app) app.style.display = "";
}

function configurarEventos() {
  const btnFechar = document.getElementById("cascata-fechar");
  if (btnFechar) btnFechar.addEventListener("click", fecharOverlay);

  [
    "btn-cascata-voltar-calculo",
    "btn-cascata-voltar-calculo-rail",
    "btn-cascata-voltar-calculo-breadcrumb",
    "btn-cascata-voltar-resultado"
  ].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", fecharOverlay);
  });

  [
    "btn-cascata-voltar-painel",
    "btn-cascata-voltar-painel-logo",
    "btn-cascata-voltar-painel-topo"
  ].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", () => {
        fecharOverlay();
        if (typeof window.voltarDashboard === "function") window.voltarDashboard();
      });
    }
  });

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
    const fundoOriginal = btn.style.background;
    const corOriginal = btn.style.color;
    btn.innerText = "Copiado!";
    btn.style.background = "#28a745";
    btn.style.color = "#fff";
    setTimeout(() => {
      btn.innerText = textoOriginal;
      btn.style.background = fundoOriginal;
      btn.style.color = corOriginal;
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
