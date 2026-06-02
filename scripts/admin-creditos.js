/**
 * admin-creditos.js — Adicionar ou remover créditos de um usuário.
 * Uso: node scripts/admin-creditos.js
 * Requer: chave-firebase.json na raiz do projeto.
 */

const path = require('path');
const readline = require('readline');

// ── Carrega a chave de serviço ─────────────────────────────────────────────
const chaveArquivo = path.join(__dirname, '..', 'chave-firebase.json');
let serviceAccount;
try {
  serviceAccount = require(chaveArquivo);
} catch (e) {
  console.error('\n❌ Arquivo "chave-firebase.json" não encontrado na pasta do projeto.');
  console.error('   Baixe em: Firebase Console → Configurações → Contas de serviço → Gerar nova chave.');
  process.exit(1);
}

// ── Inicializa o Admin SDK usando a chave ─────────────────────────────────
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Interface de pergunta ─────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// ── Função principal ──────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  RetotalizaJE — Gerenciar Créditos       ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 1. E-mail do usuário
  const email = (await ask('E-mail do usuário: ')).trim();
  if (!email) { console.log('E-mail não pode ser vazio.'); rl.close(); return; }

  // 2. Buscar UID pelo e-mail (via Firebase Auth)
  let uid;
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    uid = userRecord.uid;
    console.log(`✔ Usuário encontrado: ${userRecord.displayName || '(sem nome)'} [${uid}]`);
  } catch (e) {
    console.error(`\n❌ Usuário não encontrado com o e-mail "${email}".`);
    rl.close(); return;
  }

  // 3. Saldo atual
  const snap = await db.collection('usuarios').doc(uid).get();
  const saldoAtual = snap.exists ? (snap.data().creditos ?? 0) : 0;
  const ilimitado  = saldoAtual >= 9999;
  console.log(`   Saldo atual: ${ilimitado ? '∞ (ilimitado)' : saldoAtual} crédito(s)\n`);

  // 4. Quanto adicionar
  const resposta = (await ask('Quantos créditos adicionar? (ex: 5, 10, 9999 para ilimitado): ')).trim();
  const qtd = parseInt(resposta, 10);
  if (isNaN(qtd) || qtd <= 0) {
    console.log('\n❌ Número inválido. Informe um número inteiro positivo.');
    rl.close(); return;
  }

  // 5. Confirmação
  const confirmMsg = qtd >= 9999
    ? `\nIsso vai deixar o usuário com créditos ILIMITADOS. Confirmar? (sim/não): `
    : `\nAdicionar ${qtd} crédito(s) para ${email}? (sim/não): `;
  const conf = (await ask(confirmMsg)).trim().toLowerCase();
  if (conf !== 'sim' && conf !== 's') {
    console.log('\nOperação cancelada.');
    rl.close(); return;
  }

  // 6. Aplica no Firestore
  const novoValor = qtd >= 9999 ? 9999 : admin.firestore.FieldValue.increment(qtd);
  await db.collection('usuarios').doc(uid).set(
    { creditos: novoValor },
    { merge: true }
  );

  const snapNovo = await db.collection('usuarios').doc(uid).get();
  const saldoNovo = snapNovo.data().creditos ?? 0;
  console.log(`\n✅ Feito! "${email}" agora tem ${saldoNovo >= 9999 ? '∞ (ilimitado)' : saldoNovo} crédito(s).\n`);

  rl.close();
}

main().catch(e => {
  console.error('\n❌ Erro inesperado:', e.message);
  rl.close();
  process.exit(1);
});
