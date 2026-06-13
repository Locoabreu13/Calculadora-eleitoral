import { observarAuth, logout } from "./auth.js?v=9";
import { obterAcesso } from "./credits.js?v=9";

const TELA_AUTH   = "tela-auth";
const TELA_COMPRA = "tela-compra";
const TELA_APP    = "tela-app";
const TELA_DASH   = "tela-dashboard";

function mostrar(id) {
  [TELA_AUTH, TELA_COMPRA, TELA_APP, TELA_DASH].forEach(t => {
    const el = document.getElementById(t);
    if (el) el.style.display = (t === id) ? "" : "none";
  });
}

function atualizarUI(user) {
  document.querySelectorAll(".usuario-email").forEach(el => el.textContent = user.email);
}

let _paywallSeq = 0;

export function iniciarPaywall() {
  observarAuth(async (user) => {
    if (!user) { mostrar(TELA_AUTH); return; }

    const seq = ++_paywallSeq;

    console.log(`[Paywall] seq=${seq} user=${user.email} uid=${user.uid}`);
    try {
      const ativo = await obterAcesso(user.uid);

      if (seq !== _paywallSeq) {
        console.log(`[Paywall] seq=${seq} descartado (atual=${_paywallSeq})`);
        return;
      }

      atualizarUI(user);
      if (ativo) {
        console.log('[Dashboard] mostrando tela-dashboard', { seq, uid: user.uid });
        mostrar(TELA_DASH);
        if (typeof window.dashInit === 'function') {
          window.dashInit(user);
        }
      } else {
        mostrar(TELA_COMPRA);
      }
    } catch (err) {
      console.error("[Paywall] Falha ao verificar acesso:", err);
      if (seq === _paywallSeq) mostrar(TELA_AUTH);
    }
  });
}

export { logout };
