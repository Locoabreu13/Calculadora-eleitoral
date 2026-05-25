import { auth, db } from "./firebase-init.js?v=9";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

async function garantirPerfil(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      credits: 1,
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
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  await garantirPerfil(cred.user);
  return cred.user;
}

export async function loginGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await garantirPerfil(cred.user);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function observarAuth(callback) {
  let resolvido = false;

  const timeoutId = setTimeout(() => {
    if (!resolvido) {
      resolvido = true;
      console.warn("[Auth] Timeout de 2 s — Firebase não respondeu. Exibindo tela de login.");
      callback(null);
    }
  }, 2000);

  return onAuthStateChanged(auth, (user) => {
    if (!resolvido) {
      resolvido = true;
      clearTimeout(timeoutId);
    }
    callback(user);
  });
}
