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

// Cria documento apenas se não existir — ativo: false por padrão até liberação manual.
async function garantirPerfil(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDocFromServer(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      ativo: false,
      createdAt: serverTimestamp()
    });
  }
}

export async function cadastrarEmail(email, senha) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await garantirPerfil(cred.user);
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
  let initialResolved = false;

  // Timeout de segurança: só dispara o callback(null) uma única vez se o
  // Firebase não responder. Aumentado para 10s para cobrir cold-start lento.
  const timeoutId = setTimeout(() => {
    if (!initialResolved) {
      initialResolved = true;
      console.warn("[Auth] Timeout de 10 s — Firebase não respondeu. Exibindo tela de login.");
      callback(null);
    }
  }, 10000);

  return onAuthStateChanged(auth, (user) => {
    if (!initialResolved) {
      initialResolved = true;
      clearTimeout(timeoutId);
    }
    // Sempre repassa a mudança de estado (login, logout, login manual pós-timeout)
    callback(user);
  });
}
