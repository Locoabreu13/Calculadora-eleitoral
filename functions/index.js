const functions = require('firebase-functions/v1');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

admin.initializeApp();

exports.notificarNovoCadastro = functions
  .runWith({ secrets: ['GMAIL_USER', 'GMAIL_PASSWORD', 'ADMIN_EMAIL'] })
  .auth.user()
  .onCreate(async (user) => {
    const email = user.email || 'sem-email';
    const uid = user.uid || '';
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASSWORD;
    const adminMail = process.env.ADMIN_EMAIL;
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    try {
      await t.sendMail({
        from: 'RetotalizaJE <' + gmailUser + '>',
        to: adminMail,
        subject: '[RetotalizaJE] Novo cadastro - ' + email,
        text: 'Novo usuario cadastrado: ' + email + '\nUID: ' + uid,
      });
      console.log('E-mail enviado: ' + email);
    } catch (e) {
      console.error('Erro:', e);
    }
  });
