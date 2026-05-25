import { db } from "./firebase-init.js?v=8";
import { doc, getDocFromServer, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function obterCreditos(uid) {
  const snap = await getDocFromServer(doc(db, "users", uid));
  if (!snap.exists()) return 0;
  return snap.data().credits ?? 0;
}

export async function debitarCredito(uid) {
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