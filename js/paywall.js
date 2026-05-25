import { observarAuth, logout } from "./auth.js?v=8";
import { obterCreditos } from "./credits.js?v=9";

const TELA_AUTH   = "tela-auth";
const TELA_COMPRA = "tela-compra";
const TELA_APP    = "tela-app";
const TELA_DASH   = "tela-dashboard";

export const PACOTES = [
  { id: "avulso",        nome: "Avulso",        creditos: 1,  preco: "R$ 200",   detalhe: "R$ 200 por cálculo", url: "https://mpago.la/21BVAc7" },
  { id: "escritorio",    nome: "Escritório",    creditos: 5,  preco: "R$ 750",   detalhe: "R$ 150 por cálculo", url: "https://mpago.la/2yu38tB" },
  { id: "especializado", nome: "Especializado", creditos: 10, preco: "R$ 1.200", detalhe: "R$ 120 por cálculo", url: "https://mpago.la/1KBNzpa" },
  { id: "tribunal",      nome: "Avançado",      creditos: 25, preco: "R$ 2.500", detalhe: "R$ 100 por cálculo", url: "https://mpago.la/2kE1eh6" },
];

function mostrar(id) {
  [TELA_AUTH, TELA_COMPRA, TELA_APP, TELA_DASH].forEach(t => {
    const el = document.getElementById(t);
    if (el) el.style.display = (t === id) ? "" : "none";
  });
}

function atualizarUI(user, creditos) {
  document.querySelectorAll(".usuario-email").forEach(el => el.textContent = user.email);
  document.querySelectorAll(".saldo-creditos").forEach(el => el.textContent = creditos);
}

function renderizarPacotes(uid) {
  const container = document.getElementById("pacotes-container");
  if (!container) return;
  container.innerHTML = PACOTES.map((p, i) => `
    <div class="pacote-card ${i === 2 ? 'pacote-destaque' : ''}">
      ${i === 2 ? '<div class="pacote-badge">Mais escolhido</div>' : ''}
      <h3>${p.nome}</h3>
      <p class="pacote-creditos">${p.creditos} ${p.creditos === 1 ? 'cálculo' : 'cálculos'}</p>
      <p class="pacote-preco">${p.preco}</p>
      <p class="pacote-detalhe">${p.detalhe}</p>
      <a href="${p.url}?uid=${uid}" target="_blank" class="btn-comprar">
        Adquirir via Pix / Cartão
      </a>
    </div>
  `).join("");
}

export function iniciarPaywall() {
  observarAuth(async (user) => {
    if (!user) { mostrar(TELA_AUTH); return; }

    try {
      const creditos = await obterCreditos(user.uid);
      atualizarUI(user, creditos);
      if (!creditos || creditos <= 0) {
  mostrar(TELA_COMPRA);
  renderizarPacotes(user.uid);
      } else {
        mostrar(TELA_DASH);
        if (typeof window.dashInit === 'function') {
          window.dashInit(user, creditos);
        }
      }
    } catch (err) {
      console.error("[Paywall] Falha ao obter créditos:", err);
      mostrar(TELA_AUTH);
    }
  });

  // Expõe renderizarPacotes para o dashboard acionar
  window._renderizarPacotes = renderizarPacotes;
}

export { logout };
