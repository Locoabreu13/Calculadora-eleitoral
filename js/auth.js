import { auth, db } from "./firebase-init.js?v=9";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDocFromServer, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

// Notificação por e-mail via EmailJS quando novo usuário se cadastra
async function notificarCadastro(email) {
  try {
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:      'RetotalizaJE',
        template_id:     'template_3ufd0xs',
        user_id:         'HFnAf7EsVdqnh3pHA',
        template_params: { email, horario: agora }
      })
    });
    console.log('[EmailJS] Notificação enviada para', email);
  } catch(e) {
    console.warn('[EmailJS] Falha ao notificar:', e);
  }
}

// Cria documento apenas se não existir — ativo: true imediato (controle por créditos).
// `dados` (opcional): { nome, cpf, consentimento } — gravados no cadastro por e-mail.
async function garantirPerfil(user, dados = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDocFromServer(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      ativo: true,
      createdAt: serverTimestamp(),
      ...(dados.nome          ? { nome: dados.nome }                   : {}),
      ...(dados.cpf           ? { cpf: dados.cpf }                     : {}),
      ...(dados.consentimento ? { consentimento: dados.consentimento } : {}),
    });
    // Notifica apenas no primeiro cadastro (documento recém-criado)
    await notificarCadastro(user.email);
  }
}

export async function cadastrarEmail(email, senha, dados = {}) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await garantirPerfil(cred.user, dados);
  return cred.user;
}

export async function loginEmail(email, senha) {
  // Não chama garantirPerfil aqui: email login só funciona para usuários já
  // cadastrados (cadastrarEmail já criou o documento). Chamar garantirPerfil
  // em cada login criava race condition com onAuthStateChanged do paywall.
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

export async function loginGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  // Google login pode ser o primeiro acesso — garante documento sem sobrescrever.
  await garantirPerfil(cred.user);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function observarAuth(callback) {
  let debounceTimer  = null;
  let safetyFired    = false;

  // Se o Firebase não responder em 10 s (cold start muito lento), mostra login.
  const safetyTimeout = setTimeout(() => {
    if (!safetyFired) {
      safetyFired = true;
      clearTimeout(debounceTimer);
      console.warn("[Auth] Timeout de 10 s — Firebase não respondeu.");
      callback(null);
    }
  }, 10000);

  return onAuthStateChanged(auth, (user) => {
    // Cancela o safety timeout na primeira resposta real do Firebase.
    if (!safetyFired) {
      safetyFired = true;
      clearTimeout(safetyTimeout);
    }
    // Debounce de 300 ms: colapsa oscilações user→null→user que o Firebase
    // emite durante signInWithPopup / refresh de token. Só o estado final importa.
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(user), 300);
  });
}
