import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth } from './firebase-init.js?v=9';

const functions = getFunctions(auth.app, 'us-central1');
const db        = getFirestore(auth.app);

// ─── Ouve créditos do usuário em tempo real ────────────────────────────────
let _unsubCreditos = null;

export function ouvirCreditos(uid, callback) {
  if (_unsubCreditos) _unsubCreditos();
  _unsubCreditos = onSnapshot(
    doc(db, 'usuarios', uid),
    (snap) => {
      const creditos = snap.exists() ? (snap.data().creditos ?? 0) : 0;
      callback(creditos);
    }
  );
}

export function pararOuvirCreditos() {
  if (_unsubCreditos) { _unsubCreditos(); _unsubCreditos = null; }
}

// ─── Inicia pagamento — redireciona para o Mercado Pago ───────────────────
export async function iniciarPagamento(planoId) {
  const criarPagamento = httpsCallable(functions, 'criarPagamento');
  try {
    const result = await criarPagamento({ planoId });
    window.location.href = result.data.url;
  } catch (e) {
    console.error('Erro ao criar pagamento:', e);
    alert('Não foi possível iniciar o pagamento. Tente novamente.');
  }
}

// ─── Verifica se usuário tem créditos suficientes ─────────────────────────
export async function verificarCredito(uid) {
  const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return false;
  return (snap.data().creditos ?? 0) > 0;
}

// ─── Consome 1 crédito após cálculo concluído ─────────────────────────────
export async function consumirCredito(uid) {
  const { updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await updateDoc(doc(db, 'usuarios', uid), {
    creditos: increment(-1),
  });
}
