import { observarAuth, logout } from "./auth.js?v=9";
import { obterAcesso } from "./credits.js?v=9";

const TELA_AUTH   = "tela-auth";
const TELA_COMPRA = "tela-compra";
const TELA_APP    = "tela-app";
const TELA_DASH   = "tela-dashboard";

export const PACOTES = [
  { id: "avulso",        nome: "Avulso",        url: "https://mpago.la/21BVAc7" },
  { id: "escritorio",    nome: "Escritório",    url: "https://mpago.la/2yu38tB" },
  { id: "especializado", nome: "Especializado", url: "https://mpago.la/1KBNzpa" },
  { id: "tribunal",      nome: "Avançado",      url: "https://mpago.la/2kE1eh6" },
];

function mostrar(id) {
  [TELA_AUTH, TELA_COMPRA, TELA_APP, TELA_DASH].forEach(t => {
    const el = document.getElementById(t);
    if (el) el.style.display = (t === id) ? "" : "none";
  });
}

function atualizarUI(user) {
  document.querySelectorAll(".usuario-email").forEach(el => el.textContent = user.email);
}

function renderizarPacotes(uid) {
  const container = document.getElementById("pacotes-container");
  if (!container) return;
  container.innerHTML = PACOTES.map(p => `
    <div class="pacote-card">
      <h3>${p.nome}</h3>
      <a href="${p.url}?uid=${uid}" target="_blank" class="btn-comprar">
        Adquirir via Pix / Cartão
      </a>
    </div>
  `).join("");
}

let _paywallSeq = 0;

export function iniciarPaywall() {
  observarAuth(async (user) => {
    const seq = ++_paywallSeq;

    if (!user) { mostrar(TELA_AUTH); return; }

    console.log(`[Paywall] seq=${seq} user=${user.email} uid=${user.uid}`);
    try {
      const ativo = await obterAcesso(user.uid);

      if (seq !== _paywallSeq) {
        console.log(`[Paywall] seq=${seq} descartado (atual=${_paywallSeq})`);
        return;
      }

      atualizarUI(user);
      if (ativo) {
        mostrar(TELA_DASH);
        if (typeof window.dashInit === 'function') {
          window.dashInit(user);
        }
      } else {
        mostrar(TELA_COMPRA);
        renderizarPacotes(user.uid);
      }
    } catch (err) {
      console.error("[Paywall] Falha ao verificar acesso:", err);
      if (seq === _paywallSeq) mostrar(TELA_AUTH);
    }
  });

  window._renderizarPacotes = renderizarPacotes;
}

export { logout };
