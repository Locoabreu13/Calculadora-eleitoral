/**
 * functions/index.js — Cloud Function: notificação de novo cadastro
 *
 * Dispara automaticamente quando um novo usuário se cadastra no Firebase Auth.
 * Envia e-mail para o administrador via Gmail (Nodemailer + Senha de App).
 *
 * Configurar antes do deploy:
 *   firebase functions:config:set \
 *     gmail.user="seu@gmail.com" \
 *     gmail.password="senha_de_app_16_caracteres" \
 *     admin.email="seu@gmail.com"
 */

const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

// ── Transporter Gmail ────────────────────────────────────────────────────────
function criarTransporter() {
  const config = functions.config();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.password,
    },
  });
}

// ── Formatar data/hora no fuso de Brasília ───────────────────────────────────
function formatarData(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

// ── Cloud Function: onCreate ─────────────────────────────────────────────────
exports.notificarNovoCadastro = functions
  .region('us-central1')
  .auth.user()
  .onCreate(async (user) => {
    const { email, displayName, uid, metadata } = user;
    const nome      = displayName || '(não informado)';
    const criacao   = metadata?.creationTime
      ? formatarData(new Date(metadata.creationTime))
      : formatarData(new Date());

    const config      = functions.config();
    const adminEmail  = config.admin.email;
    const transporter = criarTransporter();

    const mailOptions = {
      from: `"RetotalizaJE" <${config.gmail.user}>`,
      to: adminEmail,
      subject: `[RetotalizaJE] Novo cadastro — ${email}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto;
                    background: #1B2B4B; color: #E8EEF7; border-radius: 10px;
                    overflow: hidden;">
          <div style="background: #243656; padding: 20px 28px; border-bottom: 1px solid rgba(255,255,255,.12);">
            <span style="font-size: 13px; font-weight: 700; letter-spacing: .06em;
                         text-transform: uppercase; color: #8B9FC0;">Sistema RetotalizaJE</span>
            <h2 style="margin: 6px 0 0; font-size: 18px; color: #E8EEF7;">
              Novo usuário cadastrado
            </h2>
          </div>
          <div style="padding: 24px 28px;">
            <table style="width:100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #8B9FC0; width: 120px;">E-mail</td>
                <td style="padding: 8px 0; font-weight: 600;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8B9FC0;">Nome</td>
                <td style="padding: 8px 0;">${nome}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8B9FC0;">UID</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px; color: #8B9FC0;">${uid}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8B9FC0;">Cadastro</td>
                <td style="padding: 8px 0;">${criacao} (Brasília)</td>
              </tr>
            </table>
          </div>
          <div style="padding: 14px 28px; border-top: 1px solid rgba(255,255,255,.08);
                      font-size: 11px; color: #8B9FC0; text-align: center;">
            RetotalizaJE · retotalizaje.com.br · Notificação automática
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ E-mail enviado para ${adminEmail} — novo usuário: ${email}`);
    } catch (err) {
      console.error('❌ Erro ao enviar e-mail:', err);
    }
  });
