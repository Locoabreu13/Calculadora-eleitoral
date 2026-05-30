const functions = require('firebase-functions/v1');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

admin.initializeApp();
const db = admin.firestore();

// ─── Planos disponíveis ────────────────────────────────────────────────────
const PLANOS = {
  unitario: { nome: 'Unitário',          creditos: 1,   preco: 197.00 },
  pack5:    { nome: 'Pack 5',            creditos: 5,   preco: 790.00 },
  pack10:   { nome: 'Pack 10',           creditos: 10,  preco: 1490.00 },
  ciclo2026:{ nome: 'Ciclo Eleitoral 2026', creditos: 9999, preco: 2490.00 },
};

// ─── Notificação de novo cadastro ──────────────────────────────────────────
exports.notificarNovoCadastro = functions
  .runWith({ secrets: ['GMAIL_USER', 'GMAIL_PASSWORD', 'ADMIN_EMAIL'] })
  .auth.user()
  .onCreate(async (user) => {
    const email = user.email || 'sem-email';
    const uid   = user.uid   || '';

    // Cria documento do usuário no Firestore com 1 crédito grátis
    await db.collection('usuarios').doc(uid).set({
      email,
      creditos: 1,
      plano: 'gratis',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Envia e-mail de aviso ao admin
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

// ─── Criar preferência de pagamento no Mercado Pago ───────────────────────
exports.criarPagamento = functions
  .runWith({ secrets: ['MP_ACCESS_TOKEN'] })
  .https.onCall(async (data, context) => {
    // Exige autenticação
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
        back_urls: {
          success: 'https://retotalizaje.com.br/app.html?pagamento=sucesso',
          failure: 'https://retotalizaje.com.br/app.html?pagamento=falha',
          pending: 'https://retotalizaje.com.br/app.html?pagamento=pendente',
        },
        auto_return: 'approved',
        notification_url: 'https://us-central1-calculadora-eleitoral-60f59.cloudfunctions.net/webhookMP',
      },
    });

    return { url: result.init_point };
  });

// ─── Webhook do Mercado Pago ───────────────────────────────────────────────
exports.webhookMP = functions
  .runWith({ secrets: ['MP_ACCESS_TOKEN'] })
  .https.onRequest(async (req, res) => {
    // MP envia POST com o evento
    const { type, data } = req.body;

    if (type !== 'payment') {
      return res.status(200).send('ok');
    }

    try {
      const mp      = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const payment = new Payment(mp);
      const pag     = await payment.get({ id: data.id });

      // Só processa pagamentos aprovados
      if (pag.status !== 'approved') {
        return res.status(200).send('status: ' + pag.status);
      }

      // external_reference = "uid|planoId"
      const [uid, planoId] = (pag.external_reference || '').split('|');
      const plano = PLANOS[planoId];
      if (!uid || !plano) {
        return res.status(400).send('referencia invalida');
      }

      const paymentId = String(pag.id);
      const pagRef    = db.collection('pagamentos').doc(paymentId);
      const pagSnap   = await pagRef.get();

      // Idempotência — não processa o mesmo pagamento duas vezes
      if (pagSnap.exists) {
        return res.status(200).send('ja processado');
      }

      // Registra o pagamento e credita o usuário atomicamente
      const batch = db.batch();

      batch.set(pagRef, {
        uid,
        planoId,
        creditos: plano.creditos,
        valor: plano.preco,
        status: 'approved',
        processadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      batch.set(
        db.collection('usuarios').doc(uid),
        { creditos: admin.firestore.FieldValue.increment(plano.creditos), plano: planoId },
        { merge: true }
      );

      await batch.commit();
      console.log('Creditado: uid=' + uid + ' plano=' + planoId + ' creditos=' + plano.creditos);

      return res.status(200).send('ok');
    } catch (e) {
      console.error('Erro no webhook:', e);
      return res.status(500).send('erro');
    }
  });
