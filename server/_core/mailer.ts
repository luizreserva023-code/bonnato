import { Resend } from "resend";
import { ENV } from "./env";

// Graceful: não travar se a chave Resend não estiver configurada
const resend = ENV.resendApiKey ? new Resend(ENV.resendApiKey) : null;

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  if (!resend) { console.warn("[Mailer] Resend not configured, skipping email."); return; }
  const { error } = await resend.emails.send({
    from: ENV.emailFrom,
    to,
    subject: "Redefinir senha — Bonatto Pizza",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
                  <!-- Header -->
                  <tr>
                    <td style="background:#c0392b;padding:32px 40px;text-align:center;">
                      <div style="font-size:32px;margin-bottom:8px;">🍕</div>
                      <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Bonatto Pizza</div>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;">Olá, ${name}!</h1>
                      <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                        Recebemos uma solicitação para redefinir a senha da sua conta na Bonatto Pizza.
                        Clique no botão abaixo para criar uma nova senha.
                      </p>
                      <div style="text-align:center;margin:32px 0;">
                        <a href="${resetUrl}"
                           style="background:#c0392b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
                          Redefinir minha senha
                        </a>
                      </div>
                      <p style="color:#666;font-size:13px;line-height:1.6;margin:0;">
                        Este link expira em <strong style="color:#aaa;">1 hora</strong>.<br/>
                        Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
                      <p style="color:#555;font-size:12px;margin:0;">
                        © ${new Date().getFullYear()} Bonatto Pizza · Mateus Leme/MG
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("[Mailer] Failed to send password reset email:", error);
    throw new Error("Falha ao enviar e-mail de redefinição de senha");
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  if (!resend) { console.warn("[Mailer] Resend not configured, skipping email."); return; }
  await resend.emails.send({
    from: ENV.emailFrom,
    to,
    subject: "Bem-vindo à Bonatto Pizza! 🍕",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
                  <tr>
                    <td style="background:#c0392b;padding:32px 40px;text-align:center;">
                      <div style="font-size:32px;margin-bottom:8px;">🍕</div>
                      <div style="color:#fff;font-size:22px;font-weight:700;">Bonatto Pizza</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;">Bem-vindo, ${name}! 🎉</h1>
                      <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                        Sua conta foi criada com sucesso. Agora você pode fazer pedidos, acompanhar entregas
                        e aproveitar cupons exclusivos para clientes cadastrados.
                      </p>
                      <div style="background:#111;border:1px solid #2a2a2a;border-radius:10px;padding:20px;margin-bottom:24px;">
                        <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 8px;">🎁 Seu cupom de boas-vindas</p>
                        <div style="background:#c0392b;color:#fff;font-size:20px;font-weight:700;letter-spacing:2px;text-align:center;padding:12px;border-radius:6px;">
                          PRIMEIROSITE10
                        </div>
                        <p style="color:#aaa;font-size:12px;margin:8px 0 0;text-align:center;">10% de desconto no seu primeiro pedido</p>
                      </div>
                      <p style="color:#666;font-size:13px;line-height:1.6;margin:0;">
                        Dúvidas? Fale com a gente pelo WhatsApp.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
                      <p style="color:#555;font-size:12px;margin:0;">© ${new Date().getFullYear()} Bonatto Pizza · Mateus Leme/MG</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}
