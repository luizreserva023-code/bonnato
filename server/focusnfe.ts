/**
 * Focus NFe — Emissão automática de NFC-e (Nota Fiscal ao Consumidor Eletrônica)
 *
 * Documentação: https://focusnfe.com.br/doc/#nfce
 * Ambiente homologação: https://homologacao.focusnfe.com.br
 * Ambiente produção:    https://api.focusnfe.com.br
 *
 * A NFC-e é processada de forma SÍNCRONA — a resposta já informa se foi autorizada.
 */

import { getDb } from "./db";
import { orders, stores, orderItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFocusNfeBaseUrl(): string {
  const env = process.env.FOCUS_NFE_ENV || "homologacao";
  return env === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function mapPaymentMethod(method: string): string {
  switch (method) {
    case "credit_card": return "03";
    case "debit_card":  return "04";
    case "pix":         return "17";
    case "cash":        return "01";
    default:            return "99";
  }
}

// ---------------------------------------------------------------------------
// Emissão de NFC-e
// ---------------------------------------------------------------------------

export async function emitirNfce(orderId: number): Promise<{
  success: boolean;
  chave?: string;
  urlDanfe?: string;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, error: "DB indisponível" };

  // Buscar pedido
  const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!orderRow) return { success: false, error: "Pedido não encontrado" };

  // Buscar itens do pedido
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Buscar dados fiscais da loja
  const storeRow = orderRow.storeId
    ? (await db.select().from(stores).where(eq(stores.id, orderRow.storeId)))[0]
    : null;

  if (!storeRow?.nfceEnabled) {
    return { success: false, error: "NFC-e não habilitada para esta loja" };
  }

  if (!storeRow.focusNfeToken || !storeRow.cnpj || !storeRow.csc || !storeRow.cscId) {
    return { success: false, error: "Dados fiscais da loja incompletos (token, CNPJ, CSC)" };
  }

  // Montar itens da nota
  const nfceItems = items.map((item, idx) => ({
    numero_item: idx + 1,
    codigo_produto: String(item.productId),
    descricao: item.productName,
    cfop: "5102",
    unidade_comercial: "UN",
    quantidade_comercial: item.quantity,
    valor_unitario_comercial: parseFloat(String(item.productPrice)),
    valor_bruto: parseFloat(String(item.subtotal)),
    icms_situacao_tributaria: "102",
    icms_origem: 0,
    pis_situacao_tributaria: "07",
    cofins_situacao_tributaria: "07",
  }));

  const subtotal = parseFloat(String(orderRow.subtotal));
  const discount = parseFloat(String(orderRow.discountAmount || 0))
    + parseFloat(String(orderRow.pointsDiscount || 0));
  const deliveryFee = parseFloat(String(orderRow.deliveryFee || 0));
  const total = parseFloat(String(orderRow.total));

  const referencia = `bonatto_${orderId}_${Date.now()}`;

  const payload: Record<string, unknown> = {
    numero: orderId,
    serie: "001",
    data_emissao: new Date().toISOString(),
    consumidor_final: 1,
    presenca_comprador: 4,
    natureza_operacao: "Venda ao consumidor",
    forma_pagamento: 0,
    cnpj_emitente: storeRow.cnpj.replace(/\D/g, ""),
    inscricao_estadual_emitente: storeRow.inscricaoEstadual || "ISENTO",
    regime_tributario_emitente: storeRow.regimeTributario || 1,
    csc_emitente: storeRow.csc,
    id_token_csc_emitente: storeRow.cscId,
    items: nfceItems,
    formas_pagamento: [
      {
        forma_pagamento: mapPaymentMethod(orderRow.paymentMethod),
        valor_pagamento: total,
      },
    ],
    valor_produtos: subtotal,
    valor_desconto: discount > 0 ? discount : 0,
    valor_total: total,
    valor_frete: deliveryFee,
  };

  if (orderRow.customerCpf) {
    payload.cpf_destinatario = orderRow.customerCpf.replace(/\D/g, "");
    payload.nome_destinatario = orderRow.customerName;
  }

  const baseUrl = getFocusNfeBaseUrl();
  const url = `${baseUrl}/v2/nfce?ref=${referencia}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${storeRow.focusNfeToken}:`).toString("base64"),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as Record<string, any>;

    if (data.status === "autorizado" || data.status === "processado") {
      await db.update(orders).set({
        nfceKey: data.chave_nfe,
        nfceStatus: "authorized",
        nfceUrl: data.url_danfe || data.caminho_danfe,
      }).where(eq(orders.id, orderId));

      return {
        success: true,
        chave: data.chave_nfe,
        urlDanfe: data.url_danfe || data.caminho_danfe,
      };
    }

    const errorMsg = data.mensagem_sefaz
      || (Array.isArray(data.erros) ? data.erros.map((e: any) => e.mensagem).join("; ") : null)
      || `Status: ${data.status}`;

    await db.update(orders).set({ nfceStatus: "error" }).where(eq(orders.id, orderId));
    return { success: false, error: errorMsg };
  } catch (err: any) {
    console.error("[FocusNFe] Erro ao emitir NFC-e:", err);
    return { success: false, error: err.message || "Erro de conexão com Focus NFe" };
  }
}

// ---------------------------------------------------------------------------
// Cancelamento de NFC-e
// ---------------------------------------------------------------------------

export async function cancelarNfce(orderId: number, justificativa: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, error: "DB indisponível" };

  const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!orderRow?.nfceKey) return { success: false, error: "NFC-e não emitida para este pedido" };

  const storeRow = orderRow.storeId
    ? (await db.select().from(stores).where(eq(stores.id, orderRow.storeId)))[0]
    : null;

  if (!storeRow?.focusNfeToken) return { success: false, error: "Token Focus NFe não configurado" };

  const referencia = `bonatto_${orderId}`;
  const baseUrl = getFocusNfeBaseUrl();
  const url = `${baseUrl}/v2/nfce/${referencia}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${storeRow.focusNfeToken}:`).toString("base64"),
      },
      body: JSON.stringify({ justificativa }),
    });

    const data = await response.json() as Record<string, any>;

    if (data.status === "cancelado") {
      await db.update(orders).set({ nfceStatus: "cancelled" }).where(eq(orders.id, orderId));
      return { success: true };
    }

    return { success: false, error: data.mensagem_sefaz || "Erro ao cancelar NFC-e" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
