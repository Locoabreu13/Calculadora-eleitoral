import { db, auth } from "./firebase-init.js?v=9";
import { doc, getDocFromServer, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function _aguardarToken() {
  const user = auth.currentUser;
  if (user) await user.getIdToken();
}

export async function obterCreditos(uid) {
  await _aguardarToken();
  const snap = await getDocFromServer(doc(db, "users", uid));
  const existe = snap.exists();
  const dados = existe ? snap.data() : null;
  const creditos = dados?.credits ?? 0;
  console.log(`[Credits] uid=${uid} exists=${existe} data=${JSON.stringify(dados)} credits=${creditos}`);
  if (!existe) return 0;
  return creditos;
}

export async function debitarCredito(uid) {
  await _aguardarToken();
  const ref = doc(db, "users", uid);
  try {
    await runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      const atual = snap.data()?.credits ?? 0;
      if (atual <= 0) throw new Error("sem_credito");
      t.update(ref, { credits: atual - 1 });
    });
    return true;
  } catch (e) {
    if (e.message === "sem_credito") return false;
    throw e;
  }
}
