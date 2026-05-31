const functions = require('firebase-functions/v1');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

admin.initializeApp();
const db = admin.firestore();

// ─── Planos disponíveis ────────────────────────────────────────────────────
const PLANOS = {
  unitario:  { nome: 'Unitário',               creditos: 1,    preco: 197.00  },
  pack5:     { nome: 'Pack 5',                 creditos: 5,    preco: 790.00  },
  pack10:    { nome: 'Pack 10',                creditos: 10,   preco: 1490.00 },
  ciclo2026: { nome: 'Ciclo Eleitoral 2026',   creditos: 9999, preco: 2490.00 },
};

// ─── Helper: credita usuário (usado por processarPagamento e webhookMP) ────
async function _creditarUsuario(uid, planoId, paymentId, plano) {
  const pagRef  = db.collection('pagamentos').doc(paymentId);
  const pagSnap = await pagRef.get();
  if (pagSnap.exists) return; // idempotência

  const batch = db.batch();

  // Registra o pagamento
  batch.set(pagRef, {
    uid, planoId,
    creditos: plano.creditos,
    valor: plano.preco,
    status: 'approved',
    processadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Credita na coleção 'usuarios' (créditos do sistema)
  batch.set(
    db.collection('usuarios').doc(uid),
    { creditos: admin.firestore.FieldValue.increment(plano.creditos), plano: planoId },
    { merge: true }
  );

  // Libera acesso na coleção 'users' (verificada pelo paywall)
  batch.set(
    db.collection('users').doc(uid),
    { ativo: true, plano: planoId, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  await batch.commit();
  console.log('Creditado: uid=' + uid + ' plano=' + planoId + ' creditos=' + plano.creditos);
}

// ─── Notificação de novo cadastro ──────────────────────────────────────────
exports.notificarNovoCadastro = functions
  .runWith({ secrets: ['GMAIL_USER', 'GMAIL_PASSWORD', 'ADMIN_EMAIL'] })
  .auth.user()
  .onCreate(async (user) => {
    const email = user.email || 'sem-email';
    const uid   = user.uid   || '';

    const batch = db.batch();

    // Cria perfil com 1 crédito grátis
    batch.set(db.collection('usuarios').doc(uid), {
      email, creditos: 1, plano: 'gratis',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Libera acesso imediato (paywall)
    batch.set(db.collection('users').doc(uid), {
      ativo: true, email,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASSWORD },
    });
    try {
      await t.sendMail({
        from: 'RetotalizaJE <' + process.env.GMAIL_USER + '>',
        to: process.env.ADMIN_EMAIL,
        subject: '[RetotalizaJE] Novo cadastro - ' + email,
        text: 'Novo usuário cadastrado: ' + email + '\nUID: ' + uid,
      });
    } catch (e) {
      console.error('Erro ao enviar e-mail:', e);
    }
  });

// ─── Criar preferência (retorna preferenceId para o Checkout Brick) ────────
exports.criarPagamento = functions
  .runWith({ secrets: ['MP_ACCESS_TOKEN'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro.');
    }

    const { planoId } = data;
    const plano = PLANOS[planoId];
    if (!plano) {
      throw new functions.https.HttpsError('invalid-argument', 'Plano inválido.');
    }

    const uid   = context.auth.uid;
    const email = context.auth.token.email || '';

    const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(mp);

    const result = await preference.create({
      body: {
        items: [{
          title: 'RetotalizaJE — ' + plano.nome,
          quantity: 1,
          unit_price: plano.preco,
          currency_id: 'BRL',
        }],
        payer: { email },
        external_reference: uid + '|' + planoId,
        notification_url: 'https://us-central1-calculadora-eleitoral-60f59.cloudfunctions.net/webhookMP',
      },
    });

    return {
      preferenceId: result.id,
      amount: plano.preco,
      nome: plano.nome,
    };
  });

// ─── Processar pagamento (chamado pelo Checkout Brick via onSubmit) ─────────
exports.processarPagamento = functions
  .runWith({ secrets: ['MP_ACCESS_TOKEN'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro.');
    }

    const { planoId, formData } = data;
    const plano = PLANOS[planoId];
    if (!plano) {
      throw new functions.https.HttpsError('invalid-argument', 'Plano inválido.');
    }

    const uid   = context.auth.uid;
    const email = context.auth.token.email || '';

    const mp      = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const payment = new Payment(mp);

    const paymentBody = {
      transaction_amount: plano.preco,
      description: 'RetotalizaJE — ' + plano.nome,
      payment_method_id: formData.payment_method_id,
      external_reference: uid + '|' + planoId,
      payer: {
        email: formData.payer?.email || email,
        identification: formData.payer?.identification,
      },
    };

    // Campos exclusivos de cartão
    if (formData.token) {
      paymentBody.token        = formData.token;
      paymentBody.issuer_id    = formData.issuer_id;
      paymentBody.installments = formData.installments || 1;
    }

    const result = await payment.create({ body: paymentBody });

    // Cartão aprovado na hora → credita imediatamente
    if (result.status === 'approved') {
      await _creditarUsuario(uid, planoId, String(result.id), plano);
    }

    return {
      status:        result.status,
      statusDetail:  result.status_detail,
      paymentId:     result.id,
      // PIX: contém o QR code (o Brick exibe automaticamente)
      pointOfInteraction: result.point_of_interaction || null,
    };
  });

// ─── Webhook do Mercado Pago (PIX e boleto confirmados depois) ─────────────
exports.webhookMP = functions
  .runWith({ secrets: ['MP_ACCESS_TOKEN'] })
  .https.onRequest(async (req, res) => {
    const { type, data } = req.body;
    if (type !== 'payment') return res.status(200).send('ok');

    try {
      const mp      = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const payment = new Payment(mp);
      const pag     = await payment.get({ id: data.id });

      if (pag.status !== 'approved') return res.status(200).send('status: ' + pag.status);

      const [uid, planoId] = (pag.external_reference || '').split('|');
      const plano = PLANOS[planoId];
      if (!uid || !plano) return res.status(400).send('referencia invalida');

      await _creditarUsuario(uid, planoId, String(pag.id), plano);
      return res.status(200).send('ok');
    } catch (e) {
      console.error('Erro no webhook:', e);
      return res.status(500).send('erro');
    }
  });
