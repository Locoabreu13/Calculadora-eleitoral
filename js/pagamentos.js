import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { getFirestore, doc, onSnapshot, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth } from './firebase-init.js?v=9';

const functions = getFunctions(auth.app, 'us-central1');
const db        = getFirestore(auth.app);

const MP_PUBLIC_KEY = 'APP_USR-fdea3f88-2b58-416e-bd5d-6b59371b4c60';

// ─── Ouve créditos do usuário em tempo real ────────────────────────────────
let _unsubCreditos = null;

export function ouvirCreditos(uid, callback) {
  if (_unsubCreditos) _unsubCreditos();
  _unsubCreditos = onSnapshot(
    doc(db, 'usuarios', uid),
    (snap) => callback(snap.exists() ? (snap.data().creditos ?? 0) : 0)
  );
}

export function pararOuvirCreditos() {
  if (_unsubCreditos) { _unsubCreditos(); _unsubCreditos = null; }
}

// ─── Verifica e consome crédito ────────────────────────────────────────────
export async function verificarCredito(uid) {
  const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? (snap.data().creditos ?? 0) > 0 : false;
}

export async function consumirCredito(uid) {
  await updateDoc(doc(db, 'usuarios', uid), { creditos: increment(-1) });
}

// ─── Autoriza e consome 1 crédito por cálculo (servidor = fonte da verdade) ──
// Chama a Cloud Function consumirCalculo, que verifica e desconta de forma
// atômica no backend. Retorna { ok, creditos, motivo? }. ok=false => sem saldo.
export async function autorizarCalculo() {
  const fn = httpsCallable(functions, 'consumirCalculo');
  const { data } = await fn();
  return data;
}

// ─── Carrega o SDK do Mercado Pago uma vez ─────────────────────────────────
let _mpSDKPromise = null;
function _carregarSDK() {
  if (_mpSDKPromise) return _mpSDKPromise;
  _mpSDKPromise = new Promise((resolve, reject) => {
    if (window.MercadoPago) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _mpSDKPromise;
}

// ─── Abre modal e inicializa o Checkout Brick ──────────────────────────────
export async function iniciarPagamento(planoId) {
  const user = auth.currentUser;
  if (!user) { alert('Faça login para contratar um plano.'); return; }

  // Mostra modal com spinner
  _abrirModal({ loading: true });

  try {
    // 1. Cria preferência no backend
    const criarPagamento = httpsCallable(functions, 'criarPagamento');
    const { data } = await criarPagamento({ planoId });
    const { preferenceId, amount, nome } = data;

    // 2. Carrega SDK
    await _carregarSDK();

    // 3. Atualiza modal com o container do brick
    _abrirModal({ loading: false, nome, amount });

    // 4. Inicializa o Payment Brick
    const mp      = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    const builder = mp.bricks();

    await builder.create('payment', 'mp-brick-container', {
      initialization: {
        amount,
        preferenceId,
        payer: { email: user.email },
      },
      customization: {
        paymentMethods: {
          creditCard:   'all',
          debitCard:    'all',
          ticket:       'all',   // boleto
          bankTransfer: 'all',   // PIX
          maxInstallments: 12,
        },
        visual: {
          style: {
            theme: 'default',
            customVariables: {
              baseColor:      '#1A56DB',
              baseColorFirstVariant:  '#1445B8',
              baseColorSecondVariant: '#EBF2FF',
              borderRadiusLarge: '12px',
              borderRadiusMedium: '8px',
              fontSizeSmall: '13px',
            },
          },
        },
      },
      callbacks: {
        onReady: () => {
          document.getElementById('mp-brick-loading')?.remove();
        },
        onSubmit: async ({ formData }) => {
          const processarPagamento = httpsCallable(functions, 'processarPagamento');
          const res = await processarPagamento({ planoId, formData });
          const { status, statusDetail } = res.data;

          if (status === 'approved') {
            _mostrarResultado('sucesso', 'Pagamento aprovado! Seus créditos já estão disponíveis.');
          } else if (status === 'pending' || status === 'in_process') {
            _mostrarResultado('pendente', 'Pagamento pendente. Você será notificado quando confirmado.');
          } else {
            _mostrarResultado('falha', 'Pagamento não aprovado (' + statusDetail + '). Tente novamente.');
            return Promise.reject(new Error(statusDetail));
          }
        },
        onError: (error) => {
          console.error('Brick error:', error);
        },
      },
    });

  } catch (e) {
    console.error('Erro ao iniciar pagamento:', e);
    _fecharModal();
    alert('Não foi possível abrir o checkout. Tente novamente.');
  }
}

// ─── Helpers do modal ──────────────────────────────────────────────────────
function _abrirModal({ loading, nome, amount }) {
  let modal = document.getElementById('mp-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mp-modal';
    modal.innerHTML = `
      <div class="mp-modal-overlay" id="mp-modal-overlay"></div>
      <div class="mp-modal-box">
        <button class="mp-modal-fechar" id="mp-modal-fechar">✕</button>
        <div id="mp-modal-body"></div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('mp-modal-overlay').addEventListener('click', _fecharModal);
    document.getElementById('mp-modal-fechar').addEventListener('click', _fecharModal);
  }

  const body = document.getElementById('mp-modal-body');

  if (loading) {
    body.innerHTML = `<div class="mp-modal-loading"><div class="mp-spinner"></div><p>Preparando checkout…</p></div>`;
  } else {
    body.innerHTML = `
      <div class="mp-modal-header">
        <div class="mp-modal-plano">${nome}</div>
        <div class="mp-modal-valor">R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      </div>
      <div id="mp-brick-loading" class="mp-modal-loading"><div class="mp-spinner"></div><p>Carregando formas de pagamento…</p></div>
      <div id="mp-brick-container"></div>`;
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function _fecharModal() {
  const modal = document.getElementById('mp-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function _mostrarResultado(tipo, mensagem) {
  const body = document.getElementById('mp-modal-body');
  if (!body) return;
  const icones = { sucesso: '✓', pendente: '⏳', falha: '✕' };
  body.innerHTML = `
    <div class="mp-resultado mp-resultado--${tipo}">
      <div class="mp-resultado-ico">${icones[tipo]}</div>
      <p class="mp-resultado-msg">${mensagem}</p>
      <button class="mp-resultado-btn" onclick="document.getElementById('mp-modal').style.display='none';document.body.style.overflow=''">
        ${tipo === 'sucesso' ? 'Continuar' : 'Fechar'}
      </button>
    </div>`;
}
