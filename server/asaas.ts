/**
 * Asaas Payment Gateway — PIX automático
 *
 * Para usar em produção:
 *   ASAAS_API_KEY=sua_chave_aqui          (produção: $aact_...)
 *   ASAAS_SANDBOX=false                   (ou omitir)
 *
 * Para testes (sandbox):
 *   ASAAS_API_KEY=sua_chave_sandbox       (sandbox: $aact_YTU5YTE0M...)
 *   ASAAS_SANDBOX=true
 *
 * Obtenha sua chave em: https://www.asaas.com/apiKeys
 */

const ASAAS_BASE_URL =
  process.env.ASAAS_SANDBOX === "true"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";

function getHeaders() {
  const apiKey = process.env.ASAAS_API_KEY ?? "";
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
  };
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
}

export interface AsaasPixCharge {
  id: string;
  status: "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | "CANCELLED";
  value: number;
  netValue: number;
  encodedImage: string; // base64 do QR Code
  payload: string;      // código copia-e-cola
  expirationDate: string;
}

// ─── Criar ou recuperar cliente no Asaas ────────────────────────────────────
export async function getOrCreateAsaasCustomer(opts: {
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
}): Promise<string> {
  // Buscar por email se disponível
  if (opts.email) {
    const searchRes = await fetch(
      `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(opts.email)}&limit=1`,
      { headers: getHeaders() }
    );
    if (searchRes.ok) {
      const data = (await searchRes.json()) as { data: AsaasCustomer[] };
      if (data.data.length > 0) return data.data[0].id;
    }
  }

  // Criar novo cliente
  const body: Record<string, string> = { name: opts.name };
  if (opts.email) body.email = opts.email;
  if (opts.phone) body.phone = opts.phone.replace(/\D/g, "");
  if (opts.cpfCnpj) body.cpfCnpj = opts.cpfCnpj.replace(/\D/g, "");

  const res = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas create customer error: ${res.status} ${err}`);
  }
  const customer = (await res.json()) as AsaasCustomer;
  return customer.id;
}

// ─── Criar cobrança PIX ──────────────────────────────────────────────────────
export async function createPixCharge(opts: {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string; // orderId
  dueDate?: string; // YYYY-MM-DD, default: hoje
}): Promise<AsaasPixCharge> {
  const dueDate =
    opts.dueDate ??
    new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).split("/").reverse().join("-");

  const body = {
    customer: opts.customerId,
    billingType: "PIX",
    value: opts.value,
    dueDate,
    description: opts.description,
    externalReference: opts.externalReference ?? "",
  };

  const res = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas create payment error: ${res.status} ${err}`);
  }
  const payment = (await res.json()) as { id: string; status: AsaasPixCharge["status"]; value: number; netValue: number; dueDate: string };

  // Buscar QR Code
  const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${payment.id}/pixQrCode`, {
    headers: getHeaders(),
  });
  if (!qrRes.ok) {
    const err = await qrRes.text();
    throw new Error(`Asaas QR Code error: ${qrRes.status} ${err}`);
  }
  const qr = (await qrRes.json()) as { encodedImage: string; payload: string; expirationDate: string };

  return {
    id: payment.id,
    status: payment.status,
    value: payment.value,
    netValue: payment.netValue,
    encodedImage: qr.encodedImage,
    payload: qr.payload,
    expirationDate: qr.expirationDate,
  };
}

// ─── Consultar status de cobrança ────────────────────────────────────────────
export async function getChargeStatus(chargeId: string): Promise<AsaasPixCharge["status"]> {
  const res = await fetch(`${ASAAS_BASE_URL}/payments/${chargeId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Asaas get payment error: ${res.status}`);
  const data = (await res.json()) as { status: AsaasPixCharge["status"] };
  return data.status;
}

// ─── Verificar assinatura do webhook Asaas ───────────────────────────────────
export function verifyAsaasWebhook(token: string): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!expected) {
    // Fail-closed em produção: sem token configurado, rejeitar tudo.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Asaas] ASAAS_WEBHOOK_TOKEN não configurado em produção — rejeitando webhook."
      );
      return false;
    }
    console.warn(
      "[Asaas] ASAAS_WEBHOOK_TOKEN vazio — aceitando webhook em ambiente de desenvolvimento."
    );
    return true;
  }
  if (!token) return false;
  // Timing-safe comparison
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
