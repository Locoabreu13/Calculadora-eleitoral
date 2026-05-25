import { db, auth } from "./firebase-init.js?v=9";
import { doc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function _aguardarToken() {
  const user = auth.currentUser;
  if (user) await user.getIdToken();
}

export async function obterAcesso(uid) {
  await _aguardarToken();
  const snap = await getDocFromServer(doc(db, "users", uid));
  const existe = snap.exists();
  const ativo = existe ? snap.data()?.ativo === true : false;
  console.log(`[Acesso] uid=${uid} exists=${existe} ativo=${ativo}`);
  return ativo;
}
