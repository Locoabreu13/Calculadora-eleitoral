import { calcularCascata } from "./cascata.js";
import { dadosReferencia } from "./cascata-referencia.js";
import { gerarCenarioCascata } from "./cascata-adaptador.js";
import { montarDadosPeca, abrirPecaParaImpressao } from "./cascata-peticao.js";
import { analisarDecisaoLitigio } from "./cascata-reverso.js";

const estadoCascata = {
  ultimaBase: null,
  ultimoCenario: null,
  ultimoCenarioOriginalBase: null,
  ultimosDadosRef: null,
  ultimosDadosCen: null,
  ultimoResultado: null,
  ultimoTempoCalculo: 0,
  grampoSuspenso: false
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

// Formata segundos com duas casas decimais, no padrao brasileiro de virgula.
// Usado para o dado em segundos reais do tempo de TV (art. 47 da Lei 9.504/97).
function formatarSegundos(valor) {
  if (typeof valor !== "number") return "0,00s";
  return valor.toFixed(2).replace(".", ",") + "s";
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

// Ordena os partidos pela fracao indicada (antes ou depois) e devolve um
// mapa sigla -> posicao no ranking (1 = maior fracao). Usado para mostrar
// se um partido subiu ou desceu no ranking de tempo de TV.
function calcularRanking(porPartido, chave) {
  const ordenado = Object.entries(porPartido)
    .sort((a, b) => b[1][chave] - a[1][chave]);
  const ranking = {};
  ordenado.forEach(([sigla], indice) => {
    ranking[sigla] = indice + 1;
  });
  return ranking;
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
      const rankingAntes = calcularRanking(nos.tempoTV.porPartido, 'fracaoAntes');
      const rankingDepois = calcularRanking(nos.tempoTV.porPartido, 'fracaoDepois');
      for (const sigla in nos.tempoTV.porPartido) {
        const p = nos.tempoTV.porPartido[sigla];
        if (p.deltaFracao !== 0) {
          temMudanca = true;
          const classe = classeValor(p.deltaFracao);

          // Variacao relativa: o quanto a mudanca representa sobre o que o
          // partido ja tinha, em vez de so a diferenca bruta em pontos.
          const variacaoRelativa = p.fracaoAntes > 0 ? (p.deltaFracao / p.fracaoAntes) : null;
          const textoRelativo = variacaoRelativa !== null
            ? `${sinal(variacaoRelativa)}${formatarPercentual(variacaoRelativa)} sobre o que já tinha`
            : null;

          // Mudanca de posicao no ranking de tempo de TV entre os partidos.
          const posicaoAntes = rankingAntes[sigla];
          const posicaoDepois = rankingDepois[sigla];
          const deltaPosicao = posicaoAntes - posicaoDepois;
          const textoRanking = deltaPosicao > 0
            ? `subiu ${deltaPosicao}ª posição${deltaPosicao > 1 ? "s" : ""} no ranking (${posicaoAntes}º → ${posicaoDepois}º)`
            : deltaPosicao < 0
              ? `desceu ${Math.abs(deltaPosicao)} posição${Math.abs(deltaPosicao) > 1 ? "ões" : ""} no ranking (${posicaoAntes}º → ${posicaoDepois}º)`
              : `manteve a ${posicaoDepois}ª posição no ranking`;

          // Segundos reais no bloco, o dado mais facil de entender, derivado da
          // mesma fracao ja validada (art. 47, par. 1o, II, "a", Lei 9.504/97).
          const textoSegundos = typeof p.deltaSegundos === "number"
            ? `${sinal(p.deltaSegundos)}${formatarSegundos(p.deltaSegundos)} no bloco`
            : null;

          const textoComplementar = [textoSegundos, textoRelativo, textoRanking].filter(Boolean).join(" · ");

          html += `
            <div class="cascata-row cascata-cols-2">
              <div class="cascata-party-cell">
                <span class="cascata-party-marker ${classe}"></span>
                <div>
                  <div class="cascata-party-name">${escaparHtml(sigla)}</div>
                  <div class="cascata-party-desc">${p.deltaFracao > 0 ? "Ganhou quota" : "Perdeu quota"}</div>
                  <div class="cascata-party-desc">${escaparHtml(textoComplementar)}</div>
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
    const limites = nos.clausula.limites || {};
    let html = `
      <div class="cascata-node-head">
        <div>
          <h2>Cláusula de <em>Desempenho</em></h2>
          <p><strong>Fundamentação Legal:</strong> Art. 17, § 3º da Constituição Federal (EC 97/2017).<br>
          <strong>Patamar aplicado:</strong> Eleições ${nos.clausula.anoEleicao || 2022} &mdash; mínimo de ${limites.deputadosMinimos || "?"} cadeiras em ${limites.ufsMinimas || "?"} estados</p>
        </div>
        <span class="cascata-status-pill ${classeStatus(nos.clausula.status)}">${textoStatus(nos.clausula.status)}</span>
      </div>
    `;
    if (nos.clausula.status === 'validado') {
      if (nos.clausula.temMudancaNaClausula && nos.clausula.mudancas && nos.clausula.mudancas.length > 0) {
        html += `<div class="cascata-table"><div class="cascata-row cascata-row-head cascata-cols-2"><div>Partido/Federação</div><div>Situação</div></div>`;
        nos.clausula.mudancas.forEach(m => {
          const cumpre = m.para === "CUMPRE";
          const classe = cumpre ? "pos" : "neg";
          const textoSituacao = cumpre ? "Passou a cumprir a cláusula" : "Deixou de cumprir a cláusula";

          const cad = m.detalheCadeiras;
          let textoComplementar = "";
          if (cad && cad.antes && cad.depois) {
            const cadAntes = cad.antes.cadeiras;
            const cadDepois = cad.depois.cadeiras;
            const ufsAntes = cad.antes.ufsComCadeira;
            const ufsDepois = cad.depois.ufsComCadeira;
            const minCad = limites.deputadosMinimos;
            const minUFs = limites.ufsMinimas;
            const textoMov = `cadeiras: ${cadAntes} → ${cadDepois} (min. ${minCad}) · UFs: ${ufsAntes} → ${ufsDepois} (min. ${minUFs})`;
            const distCad = cadDepois - (minCad || 0);
            const distUFs = ufsDepois - (minUFs || 0);
            let textoDistancia = "";
            if (!cumpre) {
              const partes = [];
              if (distCad < 0) partes.push(`${Math.abs(distCad)} cadeira${Math.abs(distCad) !== 1 ? "s" : ""} abaixo do mínimo`);
              if (distUFs < 0) partes.push(`${Math.abs(distUFs)} UF${Math.abs(distUFs) !== 1 ? "s" : ""} abaixo do mínimo`);
              if (partes.length) textoDistancia = partes.join(", ");
            } else {
              if (distCad >= 0) textoDistancia = `${distCad} cadeira${distCad !== 1 ? "s" : ""} acima do mínimo`;
            }
            textoComplementar = [textoMov, textoDistancia].filter(Boolean).join(" · ");
          }

          html += `
            <div class="cascata-row cascata-cols-2">
              <div class="cascata-party-cell">
                <span class="cascata-party-marker ${classe}"></span>
                <div>
                  <div class="cascata-party-name">${escaparHtml(m.entidade)}</div>
                  <div class="cascata-party-desc">${textoSituacao}</div>
                  ${textoComplementar ? `<div class="cascata-party-desc">${escaparHtml(textoComplementar)}</div>` : ""}
                </div>
              </div>
              <div class="cascata-value ${classe}">${cumpre ? "Cumpre" : "Não cumpre"}</div>
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
    const fp = nos.fundoPartidario;
    const valorTotal = fp.valorTotalAnual || 1185566089.46;
    const isPendente = fp.status !== 'validado';

    // Partidos afetados: aqueles com delta no FEFC (ganharam ou perderam cadeira)
    const partidosAfetados = nos.fefc && nos.fefc.porPartido
      ? Object.entries(nos.fefc.porPartido).filter(([, p]) => (p.deltaTotal || 0) !== 0).map(([s]) => s)
      : [];

    // Partidos cuja clausula mudou nesta retotalizacao (alerta de 5%)
    const comMudancaClausula = new Set(
      (nos.clausula && nos.clausula.mudancas ? nos.clausula.mudancas : []).map(m => m.entidade)
    );

    let html = `
      <div class="cascata-node-head">
        <div>
          <h2>Fundo <em>Partidário</em> (quota de 95%)</h2>
          <p><strong>Fundamentação Legal:</strong> Art. 41-A da Lei nº 9.096/1995.<br>
          <strong>Montante anual de referência:</strong> <span class="cascata-value">${formatarMoeda(valorTotal)}</span></p>
        </div>
        <span class="cascata-status-pill ${classeStatus(fp.status)}">${textoStatus(fp.status)}</span>
      </div>
    `;

    if (partidosAfetados.length > 0) {
      const labelCota = isPendente ? "Cota anual de referência (impacto nos votos pendente)" : "Cota anual base";
      html += `<div class="cascata-table"><div class="cascata-row cascata-row-head cascata-cols-2"><div>Partido</div><div>${labelCota}</div></div>`;
      for (const sigla of partidosAfetados) {
        const fracao = fp.fracoesBase && fp.fracoesBase[sigla];
        const cotaAnual = fracao ? ((fracao.fatia5 || 0) + (fracao.fatia95 || 0)) * valorTotal : null;
        const temClausula = fracao && (fracao.fatia5 || 0) > 0;
        const clausulaMudou = comMudancaClausula.has(sigla);
        const textoClausula = temClausula
          ? "Elegível para a cota de 5% (tem cláusula)"
          : "Sem acesso à cota de 5% — sem cláusula";
        const textoAlerta = clausulaMudou
          ? "Atenção: a cláusula foi alterada — a cota de 5% seria redistribuída entre os elegíveis"
          : null;
        const textoComplementar = [textoClausula, textoAlerta].filter(Boolean).join(" · ");
        html += `
          <div class="cascata-row cascata-cols-2">
            <div class="cascata-party-cell">
              <span class="cascata-party-marker"></span>
              <div>
                <div class="cascata-party-name">${escaparHtml(sigla)}</div>
                <div class="cascata-party-desc">${escaparHtml(textoComplementar)}</div>
              </div>
            </div>
            <div class="cascata-value">${cotaAnual !== null ? formatarMoeda(cotaAnual) : "—"}</div>
          </div>
        `;
      }
      html += `</div>`;
    } else {
      html += `<div class="cascata-table"><div class="cascata-empty">Nenhum partido afetado identificado no Fundo Partidário.</div></div>`;
    }

    if (!isPendente) {
      html += `<div class="cascata-note"><div><strong>Faixa de 95%:</strong> sem perda de votos nesta cassação, a proporção se mantém. <strong>Composição:</strong> 5% igualitários entre elegíveis com cláusula, 95% proporcional aos votos válidos.</div></div>`;
    } else {
      html += `<div class="cascata-note"><div><strong>Pendente:</strong> a cassação envolve perda de votos. O impacto na faixa de 95% depende da redistribuição de votos por estado, ainda não calculada. Os valores acima são a cota atual de referência.</div></div>`;
    }

    divFundo.innerHTML = html;
  }
}

// Popula o seletor "Meu partido" do modo reverso com as siglas presentes na
// base carregada (saidaEngineBase.partidos), preservando a seleção atual se
// ela ainda for válida. Confirmado em terminal antes de escrever esta função:
// saida.partidos é array e cada elemento tem a propriedade "sigla".
function popularSelectMeuPartido(saidaEngineBase) {
  const select = document.getElementById("sel-cascata-meu-partido");
  if (!select) return;

  const partidos = saidaEngineBase && Array.isArray(saidaEngineBase.partidos)
    ? saidaEngineBase.partidos
    : [];

  const valorAtual = select.value;
  const opcoes = partidos
    .map((p) => String((p && p.sigla) || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = '<option value="">-- Selecione o partido representado --</option>' +
    opcoes.map((sigla) => `<option value="${escaparHtml(sigla)}">${escaparHtml(sigla)}</option>`).join("");

  if (valorAtual && opcoes.includes(valorAtual)) {
    select.value = valorAtual;
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

  popularSelectMeuPartido(estadoCascata.ultimaBase);

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

// Ano da eleicao, mesma fonte de obtencao usada em gerarPecaPeticao.
function obterAnoCascata() {
  let fonte = {};
  try { fonte = (window.ImportTSE && window.ImportTSE.getFonteDados()) || {}; } catch (e) {}
  const anoSel = document.getElementById("tse-ano");
  if (anoSel && /^\d{4}$/.test(anoSel.value)) return Number(anoSel.value);
  const m = String(fonte.arquivo || "").match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : undefined;
}

// Carrega a tabela de genero/raca por UF (Fase 5), com cache em estadoCascata
// para nao baixar o mesmo arquivo duas vezes. 404 ou falha de rede nao bloqueia
// o calculo: registra aviso visivel e retorna null; o adaptador trata ausencia
// da tabela como comportamento sem voto em dobro.
async function carregarTabelaGeneroRaca(ano, uf) {
  if (!ano || !uf) return null;
  const ufNormalizada = String(uf).toUpperCase().trim();
  const chave = `${ano}_${ufNormalizada}`;

  if (!estadoCascata.cacheGeneroRaca) estadoCascata.cacheGeneroRaca = {};
  if (Object.prototype.hasOwnProperty.call(estadoCascata.cacheGeneroRaca, chave)) {
    return estadoCascata.cacheGeneroRaca[chave];
  }

  let tabela = null;
  try {
    const resp = await fetch(`data/tse/${ano}_${ufNormalizada}_genero-raca.json`);
    if (resp.ok) {
      tabela = await resp.json();
    } else {
      exibirAvisoCascata(`Tabela de gênero/raça não encontrada para ${ufNormalizada}/${ano} (HTTP ${resp.status}). O voto em dobro ficará pendente para os candidatos afetados.`);
    }
  } catch (e) {
    console.warn("Cascata: falha ao carregar tabela de genero/raca.", e);
    exibirAvisoCascata(`Não foi possível carregar a tabela de gênero/raça para ${ufNormalizada}/${ano}. O voto em dobro ficará pendente para os candidatos afetados.`);
  }

  estadoCascata.cacheGeneroRaca[chave] = tabela;
  return tabela;
}

function obterContainerAvisosCascata() {
  let container = document.getElementById("cascata-avisos-voto-dobro");
  if (!container) {
    container = document.createElement("div");
    container.id = "cascata-avisos-voto-dobro";
    container.setAttribute("role", "alert");
    container.setAttribute("aria-live", "polite");
    const conteudo = document.querySelector("#tela-cascata .cascata-content");
    if (conteudo) conteudo.insertBefore(container, conteudo.firstChild);
  }
  return container;
}

function limparAvisosCascata() {
  const container = document.getElementById("cascata-avisos-voto-dobro");
  if (container) container.innerHTML = "";
}

function exibirAvisoCascata(mensagem) {
  const container = obterContainerAvisosCascata();
  const div = document.createElement("div");
  div.className = "alerta info";
  div.innerHTML = `<div class="alerta-titulo">⚠ Aviso</div><p>${escaparHtml(mensagem)}</p>`;
  container.appendChild(div);
}

// Renderiza os avisos de voto em dobro nao garantido (Fase 5), no mesmo
// padrao visual dos demais alertas do projeto. Nunca dobra em silencio:
// se o adaptador nao confirmou o multiplicador, isso fica visivel aqui.
function renderizarAvisosVotoEmDobro(avisos) {
  if (!Array.isArray(avisos) || avisos.length === 0) return;
  const container = obterContainerAvisosCascata();
  const motivos = {
    ausente: "candidato não encontrado na tabela de gênero/raça",
    ambiguo: "registros divergentes para o candidato",
    sem_tabela: "tabela de gênero/raça não carregada",
    sigla_nao_mapeada_no_fefc: "sigla não reconhecida na base oficial do FEFC"
  };
  for (const av of avisos) {
    const motivo = motivos[av.motivo] || av.motivo;
    const div = document.createElement("div");
    div.className = "alerta info";
    div.innerHTML = `<div class="alerta-titulo">⚠ Voto em dobro não confirmado</div>` +
      `<p>${escaparHtml(av.candidato || "(sem nome)")} — ${escaparHtml(av.partido || "")}: ${escaparHtml(motivo)}. Calculado sem o dobro (multiplicador 1).</p>`;
    container.appendChild(div);
  }
}

// Descreve o status da cláusula de uma sigla para uma linha da tabela do modo
// reverso, no mesmo padrão textual do painel da cláusula direta.
function descreverClausulaLinha(clausula) {
  if (!clausula || clausula.status === "indisponivel") return "Cláusula indisponível";
  if (!clausula.mudou) {
    return clausula.cumpriuDepois === true
      ? "Mantém a cláusula de desempenho"
      : clausula.cumpriuDepois === false
        ? "Já não cumpre a cláusula de desempenho"
        : "Situação da cláusula pendente";
  }
  return clausula.cumpriuDepois ? "Passaria a cumprir a cláusula" : "Deixaria de cumprir a cláusula";
}

function linhaModoReverso(sigla, impacto, classe, rotuloEfeito) {
  const fefcTexto = impacto.fefc && impacto.fefc.status === "validado"
    ? sinal(impacto.fefc.deltaTotal) + formatarMoeda(impacto.fefc.deltaTotal)
    : "indisponível";
  const tvTexto = impacto.tempoTV && impacto.tempoTV.status === "validado"
    ? sinal(impacto.tempoTV.deltaFracao) + formatarPercentual(impacto.tempoTV.deltaFracao)
    : "indisponível";

  return `
    <div class="cascata-row cascata-cols-3">
      <div class="cascata-party-cell">
        <span class="cascata-party-marker ${classe}"></span>
        <div>
          <div class="cascata-party-name">${escaparHtml(sigla)}</div>
          <div class="cascata-party-desc">${escaparHtml(rotuloEfeito)}</div>
          <div class="cascata-party-desc">${escaparHtml(descreverClausulaLinha(impacto.clausula))}</div>
        </div>
      </div>
      <div class="cascata-value ${classeValor(impacto.fefc && impacto.fefc.deltaTotal)}">${fefcTexto}</div>
      <div class="cascata-value ${classeValor(impacto.tempoTV && impacto.tempoTV.deltaFracao)}">${tvTexto}</div>
    </div>
  `;
}

// Renderiza o painel do modo reverso (Fase 6): reorganiza os mesmos números
// já calculados por analisarDecisaoLitigio na ótica de quem decide se vale a
// pena litigar — sem recalcular nada, só formatando para exibição.
function renderizarModoReverso(analise) {
  const painel = document.getElementById("cascata-litigio-resultado");
  if (!painel || !analise) return;

  const divFragilidade = document.getElementById("cascata-litigio-fragilidade");
  if (divFragilidade) divFragilidade.innerHTML = `<p>${escaparHtml(analise.fraseFragilidade)}</p>`;

  const divImpacto = document.getElementById("cascata-litigio-impacto");
  if (divImpacto) divImpacto.innerHTML = `<p><strong>${escaparHtml(analise.fraseImpactoLitigio)}</strong></p>`;

  const divTabela = document.getElementById("cascata-litigio-tabela");
  if (divTabela) {
    let html = `<div class="cascata-row cascata-row-head cascata-cols-3"><div>Partido</div><div>FEFC</div><div>Tempo de TV</div></div>`;
    html += linhaModoReverso(analise.siglaPartidoProprio, analise.ganhosPartidoProprio, "pos", "Partido representado (ganho cogitado)");
    for (const sigla of analise.siglasPartidosAdversarios) {
      html += linhaModoReverso(sigla, analise.perdasPorAdversario[sigla], "neg", "Partido adversário (perda cogitada)");
    }
    divTabela.innerHTML = html;
  }

  const divAviso = document.getElementById("cascata-litigio-aviso-escopo");
  if (divAviso) {
    divAviso.innerHTML = `<div class="alerta info"><div class="alerta-titulo">⚠ Escopo do cálculo</div><p>${escaparHtml(analise.avisoEscopo)}</p></div>`;
  }

  painel.style.display = "";
}

// Executa o modo reverso (Fase 6): lê "Meu partido" e as cassações cogitadas
// já digitadas no formulário, reaproveita o mesmo encanamento da Fase 5
// (cassacoes, tabela de gênero/raça) e chama analisarDecisaoLitigio. Nunca
// recalcula a cascata por fora — só consome o que o módulo já valida.
async function executarModoReverso() {
  limparAvisosCascata();
  const selPartido = document.getElementById("sel-cascata-meu-partido");
  const siglaPartidoProprio = selPartido ? selPartido.value.trim() : "";

  if (!siglaPartidoProprio) {
    exibirAvisoCascata("Selecione o partido representado antes de calcular o retorno do litígio.");
    return;
  }

  const base = estadoCascata.ultimaBase;
  const cenarioMotor = estadoCascata.ultimoCenario;
  if (!base || !cenarioMotor) {
    exibirAvisoCascata("Resultados do motor indisponíveis para o modo reverso.");
    return;
  }

  let ufSelecionada = "";
  try { ufSelecionada = (window.ImportTSE?.getFonteDados()?.uf || "").trim(); } catch (e) {}
  if (!ufSelecionada) {
    const selUf = document.getElementById("sel-cascata-uf-overlay");
    ufSelecionada = selUf ? selUf.value.trim() : "";
  }

  const ano = obterAnoCascata();
  const cenarioOriginalBase = estadoCascata.ultimoCenarioOriginalBase || null;
  const calcularFn = window.ElectoralEngine && window.ElectoralEngine.calcular;
  if (typeof calcularFn !== "function") {
    exibirAvisoCascata("Motor de cálculo indisponível para o modo reverso.");
    return;
  }

  const btnCalcular = document.getElementById("btn-cascata-litigio-calcular");
  if (btnCalcular) { btnCalcular.disabled = true; btnCalcular.textContent = "Calculando..."; }
  estadoCascata.grampoSuspenso = true;
  try {
    const tabelaGeneroRaca = await carregarTabelaGeneroRaca(ano, ufSelecionada);

    if (!cenarioOriginalBase) {
      exibirAvisoCascata("Cenário original do motor indisponível: a fragilidade da última cadeira não pôde ser calculada.");
    }

    const analise = analisarDecisaoLitigio({
      saidaEngineBase: base,
      cenarioOriginalBase,
      saidaEngineCenario: cenarioMotor,
      calcularFn,
      dadosReferencia,
      categoria: "cassacao_com_perda_votos",
      uf: ufSelecionada,
      opts: {
        cassacoes: lerCassacoesDoFormulario(),
        tabelaGeneroRaca,
        dadosReferencia
      },
      siglaPartidoProprio
    });
    renderizarModoReverso(analise);
  } catch (e) {
    console.warn("Modo reverso: falha ao calcular.", e);
    exibirAvisoCascata("Não foi possível calcular o modo reverso: " + (e && e.message ? e.message : "erro desconhecido") + ".");
  } finally {
    estadoCascata.grampoSuspenso = false;
    if (btnCalcular) { btnCalcular.disabled = false; btnCalcular.textContent = "Calcular retorno do litígio"; }
  }
}

// Extraído do listener original de btn-cascata: recorte literal, sem nenhuma
// mudança de lógica, só transformado de arrow function anônima em função
// nomeada para poder ser reaproveitado também pelo botão de entrada do modo
// reverso (btn-litigio), que abre o mesmo overlay da cascata.
async function prepararEAbrirCascata() {
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

  const ano = obterAnoCascata();
  limparAvisosCascata();
  const tabelaGeneroRaca = await carregarTabelaGeneroRaca(ano, ufSelecionada);

  const opts = {
    cassacoes: lerCassacoesDoFormulario(),
    tabelaGeneroRaca,
    dadosReferencia
  };

  const dadosCenarioAdaptado = gerarCenarioCascata(base, cenarioMotor, "cassacao_com_perda_votos", ufSelecionada, opts);
  renderizarAvisosVotoEmDobro(dadosCenarioAdaptado._avisosVotoEmDobro);

  abrirCascata(base, cenarioMotor, dadosReferencia, dadosCenarioAdaptado);
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
  if (btnPdf) btnPdf.addEventListener("click", gerarPecaPeticao);

  document.querySelectorAll(".cascata-tab").forEach(aba => {
    aba.addEventListener("click", () => alternarAba(aba));
  });

  const btnCascataLitigioCalcular = document.getElementById("btn-cascata-litigio-calcular");
  if (btnCascataLitigioCalcular) btnCascataLitigioCalcular.addEventListener("click", executarModoReverso);

  const btnLitigio = document.getElementById("btn-litigio");
  if (btnLitigio) btnLitigio.addEventListener("click", () => prepararEAbrirCascata());

  const btnCascata = document.getElementById("btn-cascata");
  if (btnCascata) {
    btnCascata.addEventListener("click", prepararEAbrirCascata);
  }

  // Recalcula automaticamente quando o usuario troca a UF dentro do overlay
  const selUfOverlay = document.getElementById("sel-cascata-uf-overlay");
  if (selUfOverlay) {
    selUfOverlay.addEventListener("change", async () => {
      const base = estadoCascata.ultimaBase;
      const cenarioMotor = estadoCascata.ultimoCenario;
      if (!base || !cenarioMotor) return;
      const ufSelecionada = selUfOverlay.value.trim();

      const ano = obterAnoCascata();
      limparAvisosCascata();
      const tabelaGeneroRaca = await carregarTabelaGeneroRaca(ano, ufSelecionada);

      const opts = {
        cassacoes: lerCassacoesDoFormulario(),
        tabelaGeneroRaca,
        dadosReferencia
      };

      const dadosCenarioAdaptado = gerarCenarioCascata(base, cenarioMotor, "cassacao_com_perda_votos", ufSelecionada, opts);
      renderizarAvisosVotoEmDobro(dadosCenarioAdaptado._avisosVotoEmDobro);

      abrirCascata(base, cenarioMotor, dadosReferencia, dadosCenarioAdaptado);
    });
  }
}

function observarResultados() {
  const btnApresentacao = document.getElementById("btn-apresentacao");
  const btnCascata = document.getElementById("btn-cascata");
  const btnLitigio = document.getElementById("btn-litigio");

  if (btnApresentacao && btnCascata) {
    btnCascata.disabled = btnApresentacao.disabled;
    if (btnLitigio) btnLitigio.disabled = btnApresentacao.disabled;

    const observer = new MutationObserver(() => {
      btnCascata.disabled = btnApresentacao.disabled;
      if (btnLitigio) btnLitigio.disabled = btnApresentacao.disabled;
    });

    observer.observe(btnApresentacao, { attributes: true, attributeFilter: ["disabled"] });
  }
}

function instalarGrampoNoMotor() {
  if (window.ElectoralEngine && window.ElectoralEngine.calcular && !window.ElectoralEngine._grampoInstalado) {
    const calcularOriginal = window.ElectoralEngine.calcular;
    
    window.ElectoralEngine.calcular = function(cenario) {
      // Reentrância: a busca binária de calcularMargemUltimaCadeira chama o
      // engine dezenas de vezes durante o modo reverso. Essas chamadas são
      // sondagens internas, não cliques do usuário — não devem corromper o
      // estado capturado dos cálculos reais.
      if (estadoCascata.grampoSuspenso) {
        return calcularOriginal.call(this, cenario);
      }

      // Deixa o motor original fazer a conta normalmente
      const resultado = calcularOriginal.call(this, cenario);
      const agora = Date.now();
      
      // Se os cálculos ocorrerem na mesma fração de segundo (< 100ms), 
      // o primeiro foi a base e o segundo é o cenário retotalizado.
      // Se for um clique novo (> 100ms de intervalo), reseta o estado.
      if (agora - estadoCascata.ultimoTempoCalculo > 100) {
        estadoCascata.ultimaBase = resultado;
        estadoCascata.ultimoCenario = resultado;
        estadoCascata.ultimoCenarioOriginalBase = cenario;
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
      const limitesCopia = res.nos.clausula.limites || {};
      res.nos.clausula.mudancas.forEach(m => {
        const cumpre = m.para === "CUMPRE";
        const situacao = cumpre ? "Passou a cumprir a clausula" : "Deixou de atingir a clausula";
        let detalhe = "";
        const cad = m.detalheCadeiras;
        if (cad && cad.antes && cad.depois) {
          detalhe = ` (cadeiras: ${cad.antes.cadeiras} -> ${cad.depois.cadeiras}, min. ${limitesCopia.deputadosMinimos}; UFs: ${cad.antes.ufsComCadeira} -> ${cad.depois.ufsComCadeira}, min. ${limitesCopia.ufsMinimas})`;
        }
        texto += m.entidade + ": " + situacao + detalhe + "\n";
      });
    } else {
      texto += "Nenhuma alteracao na situacao da Clausula de Desempenho.\n";
    }
    texto += "\n";
  }

  if (res.nos.fundoPartidario) {
    texto += "4. Fundo Partidario (Quota de 95%)\n";
    texto += "Base legal: Art. 41-A da Lei 9.096/1995.\n";
    const fpCopia = res.nos.fundoPartidario;
    const valorTotalCopia = fpCopia.valorTotalAnual || 1185566089.46;
    const isPendenteCopia = fpCopia.status !== 'validado';
    if (isPendenteCopia) {
      texto += "Status: impacto na faixa de 95% pendente (cassacao com perda de votos).\n";
    }
    const comMudancaClausulaCopia = new Set(
      (res.nos.clausula && res.nos.clausula.mudancas ? res.nos.clausula.mudancas : []).map(m => m.entidade)
    );
    const partidosAfetadosCopia = res.nos.fefc && res.nos.fefc.porPartido
      ? Object.entries(res.nos.fefc.porPartido).filter(([, p]) => (p.deltaTotal || 0) !== 0).map(([s]) => s)
      : [];
    if (partidosAfetadosCopia.length > 0) {
      texto += "Cotas anuais de referencia (base 2024):\n";
      for (const sigla of partidosAfetadosCopia) {
        const fracao = fpCopia.fracoesBase && fpCopia.fracoesBase[sigla];
        const cotaAnual = fracao ? ((fracao.fatia5 || 0) + (fracao.fatia95 || 0)) * valorTotalCopia : null;
        const temClausula = fracao && (fracao.fatia5 || 0) > 0;
        const clausulaMudou = comMudancaClausulaCopia.has(sigla);
        let linha = sigla + ": " + (cotaAnual !== null ? formatarMoeda(cotaAnual) : "N/D");
        linha += temClausula ? " (tem clausula, elegivel para 5%)" : " (sem clausula)";
        if (clausulaMudou) linha += " [ATENCAO: clausula alterada — redistribuicao de 5%]";
        texto += linha + "\n";
      }
    } else {
      texto += "Nenhum partido afetado identificado.\n";
    }
    if (!isPendenteCopia) texto += "Faixa de 95%: sem perda de votos, a proporcao se mantem.\n";
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

// Le as cassacoes do formulario no DOM, na mesma forma que lerCenario monta o
// cenario (js/ui.js, mesma estrutura de campos). window.Estado nao e exposto, entao
// o formulario e a fonte confiavel da decisao real: candidato, partido, votos
// anulados e modalidade. Verificado no navegador com o caso Heitor Freire, CE 2022.
function lerCassacoesDoFormulario() {
  const cassacoes = [];
  for (const row of document.querySelectorAll(".cassacao-row")) {
    const partido = (row.querySelector(".cass-partido")?.value || "").trim();
    const candidato = (row.querySelector(".cass-candidato")?.value || "").trim();
    const votosAnular = parseInt(row.querySelector(".cass-votos")?.value, 10) || 0;
    const modalidade = row.querySelector(".cass-modalidade")?.value || "";
    if (partido && (votosAnular > 0 || modalidade === "cassacao_drap")) {
      cassacoes.push({ partido, candidato: candidato || undefined, votosAnular, modalidade });
    }
  }
  return cassacoes;
}

// Gera a peca de peticao para protocolo a partir da DECISAO REAL carregada na tela.
// Reaproveita o que calcularCascata ja produziu (estadoCascata.ultimoResultado) e o
// cenario adaptado (estadoCascata.ultimosDadosCen), sem recalcular nenhum no.
function gerarPecaPeticao() {
  const res = estadoCascata.ultimoResultado;
  if (!res || !res.nos) {
    alert("Nenhum resultado disponível para gerar a peça.");
    return;
  }

  let fonte = {};
  try {
    fonte = (window.ImportTSE && window.ImportTSE.getFonteDados()) || {};
  } catch (e) {
    console.warn("Cascata: falha ao obter a fonte de dados do TSE.", e);
  }

  let uf = String(fonte.uf || "").trim();
  if (!uf) {
    const selUf = document.getElementById("sel-cascata-uf-overlay");
    uf = selUf ? selUf.value.trim() : "";
  }

  // Ano: o seletor tse-ano e a fonte direta; o nome do arquivo serve de reforco.
  let ano;
  const anoSel = document.getElementById("tse-ano");
  if (anoSel && /^\d{4}$/.test(anoSel.value)) {
    ano = Number(anoSel.value);
  } else {
    const m = String(fonte.arquivo || "").match(/(?:19|20)\d{2}/);
    if (m) ano = Number(m[0]);
  }

  const vagasInput = document.getElementById("input-vagas");
  const vagas = vagasInput ? (parseInt(vagasInput.value, 10) || undefined) : undefined;

  const contexto = {
    cargo: fonte.cargo || undefined,
    uf,
    ano,
    vagas,
    dataGeracao: new Date(),
    decisao: { cassacoes: lerCassacoesDoFormulario() }
  };

  const dados = montarDadosPeca({
    resultadoCascata: res,
    dadosCenario: estadoCascata.ultimosDadosCen,
    contexto
  });
  abrirPecaParaImpressao(dados);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
