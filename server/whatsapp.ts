/**
 * Módulo de notificações WhatsApp
 * Suporta Z-API e Twilio (configurável via variável WHATSAPP_PROVIDER)
 *
 * Variáveis de ambiente:
 *   WHATSAPP_PROVIDER = "zapi" | "twilio" | "none"  (padrão: "none")
 *
 *   Z-API:
 *     ZAPI_INSTANCE_ID  = ID da instância Z-API
 *     ZAPI_TOKEN        = Token de segurança Z-API
 *     ZAPI_CLIENT_TOKEN = Client-Token Z-API (header)
 *
 *   Twilio:
 *     TWILIO_ACCOUNT_SID   = Account SID
 *     TWILIO_AUTH_TOKEN    = Auth Token
 *     TWILIO_WHATSAPP_FROM = Número Twilio (ex: whatsapp:+14155238886)
 */

interface WhatsAppProvider {
  send(to: string, message: string): Promise<void>;
}

// ─── Z-API ────────────────────────────────────────────────────────────────────
class ZApiProvider implements WhatsAppProvider {
  private instanceId: string;
  private token: string;
  private clientToken: string;

  constructor() {
    this.instanceId = process.env.ZAPI_INSTANCE_ID ?? "";
    this.token = process.env.ZAPI_TOKEN ?? "";
    this.clientToken = process.env.ZAPI_CLIENT_TOKEN ?? "";
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.instanceId || !this.token) {
      console.warn("[WhatsApp/Z-API] Credenciais não configuradas. Mensagem não enviada.");
      return;
    }

    // Normalizar número: remover caracteres não numéricos, garantir código do país
    const phone = to.replace(/\D/g, "");

    const url = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}/send-text`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.clientToken ? { "Client-Token": this.clientToken } : {}),
      },
      body: JSON.stringify({ phone, message }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[WhatsApp/Z-API] Erro ao enviar: ${response.status} ${body}`);
    } else {
      console.log(`[WhatsApp/Z-API] Mensagem enviada para ${phone}`);
    }
  }
}

// ─── TWILIO ───────────────────────────────────────────────────────────────────
class TwilioProvider implements WhatsAppProvider {
  async send(to: string, message: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

    if (!accountSid || !authToken) {
      console.warn("[WhatsApp/Twilio] Credenciais não configuradas. Mensagem não enviada.");
      return;
    }

    const phone = to.replace(/\D/g, "");
    const toWhatsApp = `whatsapp:+${phone}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ From: from, To: toWhatsApp, Body: message });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const respBody = await response.text();
      console.error(`[WhatsApp/Twilio] Erro ao enviar: ${response.status} ${respBody}`);
    } else {
      console.log(`[WhatsApp/Twilio] Mensagem enviada para ${toWhatsApp}`);
    }
  }
}

// ─── NO-OP ────────────────────────────────────────────────────────────────────
class NoOpProvider implements WhatsAppProvider {
  async send(to: string, message: string): Promise<void> {
    console.log(`[WhatsApp/NoOp] Mensagem para ${to}: ${message.substring(0, 60)}...`);
  }
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────
function getProvider(): WhatsAppProvider {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "none").toLowerCase();
  if (provider === "zapi") return new ZApiProvider();
  if (provider === "twilio") return new TwilioProvider();
  return new NoOpProvider();
}

/**
 * Envia uma mensagem WhatsApp para o número informado.
 * O número deve estar no formato brasileiro (ex: 37999998888 ou 5537999998888).
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  if (!to) return;
  const provider = getProvider();
  try {
    await provider.send(to, message);
  } catch (err) {
    console.error("[WhatsApp] Falha ao enviar mensagem:", err);
  }
}

// ─── TEMPLATES ───────────────────────────────────────────────────────────────
export const WhatsAppTemplates = {
  orderConfirmed: (customerName: string, orderId: number, total: string) =>
    `🍕 *Bonatto Pizza* — Olá, ${customerName}!\n\nSeu pedido *#${orderId}* foi *confirmado* com sucesso! 🎉\n\n💰 Total: R$ ${total}\n\nAcompanhe o status do seu pedido em: https://bonattopizza.manus.space/minha-conta\n\nObrigado pela preferência! 🙏`,

  orderPreparing: (customerName: string, orderId: number) =>
    `🍕 *Bonatto Pizza* — Olá, ${customerName}!\n\nSeu pedido *#${orderId}* está sendo *preparado* com carinho pela nossa equipe! 👨‍🍳\n\nEm breve sairá para entrega. Aguarde!`,

  orderOutForDelivery: (customerName: string, orderId: number, driverName?: string) =>
    `🛵 *Bonatto Pizza* — Olá, ${customerName}!\n\nSeu pedido *#${orderId}* saiu para entrega!${driverName ? ` O motoboy *${driverName}* está a caminho.` : ""}\n\nAcompanhe: https://bonattopizza.manus.space/rastrear/${orderId}`,

  orderDelivered: (customerName: string, orderId: number) =>
    `✅ *Bonatto Pizza* — Olá, ${customerName}!\n\nSeu pedido *#${orderId}* foi *entregue*! Esperamos que aproveite muito! 😋\n\nQue tal avaliar nossa entrega? Acesse: https://bonattopizza.manus.space/minha-conta\n\nVolte sempre! 🍕❤️`,

  orderCancelled: (customerName: string, orderId: number) =>
    `❌ *Bonatto Pizza* — Olá, ${customerName}.\n\nInfelizmente seu pedido *#${orderId}* foi *cancelado*.\n\nEntre em contato conosco para mais informações. Pedimos desculpas pelo inconveniente.`,
};
