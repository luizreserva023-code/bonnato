/**
 * dailyReport.ts
 * Job de relatório diário de vendas enviado via WhatsApp para o admin.
 * Dispara todo dia às 23:30 (horário de Brasília = UTC-3 → 02:30 UTC).
 * Configuração: DAILY_REPORT_PHONE=55379XXXXXXXX (número do admin)
 */

import { getDb } from "./db.ts";
import { orders } from "../drizzle/schema.ts";
import { sendWhatsApp } from "./whatsapp.ts";
import { and, gte, lt, eq, sql } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBrasiliaDateRange(): { start: Date; end: Date } {
  // UTC-3: agora em Brasília
  const now = new Date();
  const brasiliaOffset = -3 * 60; // minutos
  const brasiliaMs = now.getTime() + brasiliaOffset * 60 * 1000;
  const brasilia = new Date(brasiliaMs);

  const year = brasilia.getUTCFullYear();
  const month = brasilia.getUTCMonth();
  const day = brasilia.getUTCDate();

  // Início do dia em Brasília → UTC
  const startBrasilia = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const startUTC = new Date(startBrasilia.getTime() - brasiliaOffset * 60 * 1000);

  // Fim do dia em Brasília → UTC
  const endBrasilia = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  const endUTC = new Date(endBrasilia.getTime() - brasiliaOffset * 60 * 1000);

  return { start: startUTC, end: endUTC };
}

// ─── Query de vendas do dia ────────────────────────────────────────────────────

export async function getDailySalesData() {
  const { start, end } = getBrasiliaDateRange();

  const db = await getDb();
  if (!db) return { date: start, total: 0, delivered: 0, cancelled: 0, pending: 0, revenue: 0, deliveredRevenue: 0, avgTicket: 0, byPayment: {} };
  const rows = await db
    .select({
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lt(orders.createdAt, end)
      )
    );

  type Row = { status: string | null; paymentMethod: string | null; total: string | null; createdAt: Date | null };
  const typedRows = rows as Row[];

  const total = typedRows.length;
  const delivered = typedRows.filter((r) => r.status === "delivered").length;
  const cancelled = typedRows.filter((r) => r.status === "cancelled").length;
  const pending = typedRows.filter((r) => !["delivered", "cancelled"].includes(r.status ?? "")).length;

  const revenue = rows
    .filter((r: Row) => r.status !== "cancelled")
    .reduce((sum: number, r: Row) => sum + parseFloat(r.total ?? "0"), 0);

  const deliveredRevenue = rows
    .filter((r: Row) => r.status === "delivered")
    .reduce((sum: number, r: Row) => sum + parseFloat(r.total ?? "0"), 0);

  // Contagem por método de pagamento
  const byPayment: Record<string, number> = {};
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const method = r.paymentMethod ?? "outros";
    byPayment[method] = (byPayment[method] ?? 0) + 1;
  }

  // Ticket médio
  const nonCancelled = rows.filter((r: Row) => r.status !== "cancelled");
  const avgTicket = nonCancelled.length > 0 ? revenue / nonCancelled.length : 0;

  return {
    date: start,
    total,
    delivered,
    cancelled,
    pending,
    revenue,
    deliveredRevenue,
    avgTicket,
    byPayment,
  };
}

// ─── Formatação da mensagem ───────────────────────────────────────────────────

function formatDailyReport(data: Awaited<ReturnType<typeof getDailySalesData>>): string {
  const dateStr = data.date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const paymentLines = Object.entries(data.byPayment)
    .map(([method, count]) => {
      const labels: Record<string, string> = {
        pix: "PIX",
        credit_card: "Cartão de Crédito",
        debit_card: "Cartão de Débito",
        cash: "Dinheiro",
      };
      return `  • ${labels[method] ?? method}: ${count}x`;
    })
    .join("\n");

  return `📊 *Relatório Diário — Bonatto Pizza*
📅 ${dateStr}

━━━━━━━━━━━━━━━━━━━━
🛒 *Pedidos*
  • Total: *${data.total}*
  • Entregues: ✅ ${data.delivered}
  • Cancelados: ❌ ${data.cancelled}
  • Em andamento: 🔄 ${data.pending}

💰 *Faturamento*
  • Receita total: *R$ ${data.revenue.toFixed(2).replace(".", ",")}*
  • Receita entregue: R$ ${data.deliveredRevenue.toFixed(2).replace(".", ",")}
  • Ticket médio: R$ ${data.avgTicket.toFixed(2).replace(".", ",")}

💳 *Formas de Pagamento*
${paymentLines || "  • Nenhum pedido hoje"}
━━━━━━━━━━━━━━━━━━━━
_Bonatto Pizza — Sistema de Gestão_`;
}

// ─── Envio do relatório ───────────────────────────────────────────────────────

export async function sendDailyReport(): Promise<void> {
  const phone = process.env.DAILY_REPORT_PHONE;
  if (!phone) {
    console.warn("[DailyReport] DAILY_REPORT_PHONE não configurado. Relatório não enviado.");
    return;
  }

  try {
    const data = await getDailySalesData();
    const message = formatDailyReport(data);
    await sendWhatsApp(phone, message);
    console.log(`[DailyReport] Relatório enviado para ${phone}`);
  } catch (err) {
    console.error("[DailyReport] Erro ao gerar/enviar relatório:", err);
  }
}

// ─── Scheduler (verifica a cada minuto se é hora de enviar) ──────────────────

let lastReportDate: string | null = null;

export function startDailyReportJob(): void {
  // Verifica a cada minuto se é hora de enviar (23:30 horário de Brasília)
  setInterval(async () => {
    const now = new Date();
    // Converter para horário de Brasília (UTC-3)
    const brasiliaMs = now.getTime() + (-3 * 60 * 60 * 1000);
    const brasilia = new Date(brasiliaMs);
    const hours = brasilia.getUTCHours();
    const minutes = brasilia.getUTCMinutes();
    const today = brasilia.toISOString().slice(0, 10);

    // Enviar às 23:30 (uma vez por dia)
    if (hours === 23 && minutes === 30 && lastReportDate !== today) {
      lastReportDate = today;
      await sendDailyReport();
    }
  }, 60 * 1000); // verifica a cada 1 minuto

  console.log("[DailyReport] Job de relatório diário iniciado (dispara às 23:30 horário de Brasília)");
}
