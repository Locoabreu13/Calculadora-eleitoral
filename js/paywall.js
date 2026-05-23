import { observarAuth, logout } from "./auth.js";
import { obterCreditos } from "./credits.js";

const TELA_AUTH   = "tela-auth";
const TELA_COMPRA = "tela-compra";
const TELA_APP    = "tela-app";

export const PACOTES = [
  { id: "starter",    nome: "Starter",    creditos: 5,  preco: "R$ 15", url: "#" },
  { id: "pro",        nome: "Pro",        creditos: 20, preco: "R$ 45", url: "#" },
  { id: "escritorio", nome: "Escritório", creditos: 50, preco: "R$ 90", url: "#" },
];

function mostrar(id) {
  [TELA_AUTH, TELA_COMPRA, TELA_APP].forEach(t => {
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
  container.innerHTML = PACOTES.map(p => `
    <div class="pacote-card">
      <h3>${p.nome}</h3>
      <p class="pacote-creditos">${p.creditos} créditos</p>
      <p class="pacote-preco">${p.preco}</p>
      <a href="${p.url}?uid=${uid}" target="_blank" class="btn-comprar">
        Comprar via Pix / Cartão
      </a>
    </div>
  `).join("");
}

export function iniciarPaywall() {
  observarAuth(async (user) => {
    if (!user) { mostrar(TELA_AUTH); return; }
    const creditos = await obterCreditos(user.uid);
    atualizarUI(user, creditos);
    if (creditos <= 0) {
      mostrar(TELA_COMPRA);
      renderizarPacotes(user.uid);
    } else {
      mostrar(TELA_APP);
    }
  });
}

export { logout };