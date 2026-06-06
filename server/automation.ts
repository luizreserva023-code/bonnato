/**
 * Marketing Automation Engine
 * - Execução de jornadas sequenciais (etapas com delay, condições, ações)
 * - Job de tags automáticas de clientes (novo, recorrente, indeciso, inativo_15/30/60)
 * - Registro e recuperação de carrinhos abandonados
 */

import { getDb } from "./db";
import {
  customerTags,
  abandonedCarts,
  journeys,
  journeyExecutions,
  orders,
  users,
  customTags as customTagsTable,
  customCustomerTags,
  automationEvents,
  coupons,
  loyaltyTransactions,
  clientAlerts,
  clientNotifications,
} from "../drizzle/schema";
import { eq, and, lt, gte, sql, inArray, isNull, or } from "drizzle-orm";
import { sendWhatsApp } from "./whatsapp";
import { sendPushToUser } from "./push";
import { pickRandomTemplate } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JourneyStepType =
  | "wait"            // Aguardar X minutos
  | "send_whatsapp"   // Enviar mensagem WhatsApp
  | "send_push"       // Enviar notificação push
  | "condition"       // Verificar condição (ex: comprou desde o início da jornada?)
  | "add_tag"         // Adicionar tag ao cliente
  | "remove_tag"      // Remover tag do cliente
  | "webhook"         // Disparar via webhook externo
  | "send_coupon"     // Gerar e enviar cupom exclusivo
  | "update_loyalty"  // Adicionar/remover pontos de fidelidade
  | "send_alert"      // Criar alerta no painel do cliente
  | "split_ab"        // Divisão A/B — mensagem A para 50%, B para 50%
  | "pause_journey"   // Pausar outra jornada ativa
  | "notify_admin";   // Criar tarefa/notificação para o admin

export interface JourneyStep {
  id: string;
  type: JourneyStepType;
  label: string;
  // wait
  delayMinutes?: number;
  // send_whatsapp / send_push
  message?: string;
  title?: string;
  // condition
  condition?: "purchased_since_start" | "has_tag" | "has_min_orders" | "has_min_points";
  conditionTag?: string;
  conditionValue?: number; // para has_min_orders / has_min_points
  onTrue?: "continue" | "stop";  // o que fazer se condição for verdadeira
  onFalse?: "continue" | "stop"; // o que fazer se condição for falsa
  // add_tag / remove_tag
  tag?: string;
  // send_coupon
  couponDiscountType?: "percentage" | "fixed";
  couponDiscountValue?: number;
  couponExpiryDays?: number; // dias até expirar (0 = sem expiração)
  // update_loyalty
  loyaltyPoints?: number; // positivo = adicionar, negativo = remover
  loyaltyDescription?: string;
  // send_alert
  alertTitle?: string;
  alertMessage?: string;
  alertIcon?: string; // emoji ou nome do ícone
  alertUrl?: string;
  // split_ab
  messageA?: string; // mensagem para grupo A (50%)
  messageB?: string; // mensagem para grupo B (50%)
  titleA?: string;
  titleB?: string;
  splitChannel?: "whatsapp" | "push"; // canal do split
  // webhook
  webhookUrl?: string;
  secret?: string;
  // pause_journey
  pauseJourneyId?: number;
  // notify_admin
  adminTaskTitle?: string;
  adminTaskMessage?: string;
}

export type CustomerTagValue = "novo" | "recorrente" | "indeciso" | "inativo_15" | "inativo_30" | "inativo_60";

// ─── Tag Engine ───────────────────────────────────────────────────────────────

/**
 * Calcula e atualiza as tags de todos os clientes com base no histórico de pedidos.
 * Deve ser chamado periodicamente (ex: a cada hora).
 */
export async function refreshCustomerTags(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const newInactivityTriggers: Array<{ trigger: typeof journeys.$inferInsert["trigger"]; userId: number }> = [];

  // Buscar todos os usuários com estatísticas de pedidos entregues
  // Nota: LAG() OVER não é compatível com GROUP BY no TiDB/MySQL 5.x
  // Calculamos avgDaysBetween via subquery: (MAX - MIN) / (COUNT - 1)
  const userOrderStats = await db.execute(sql`
    SELECT
      u.id AS userId,
      COUNT(o.id) AS totalOrders,
      MAX(o.createdAt) AS lastOrderAt,
      MIN(o.createdAt) AS firstOrderAt,
      CASE
        WHEN COUNT(o.id) > 1
        THEN DATEDIFF(MAX(o.createdAt), MIN(o.createdAt)) / (COUNT(o.id) - 1)
        ELSE NULL
      END AS avgDaysBetween
    FROM users u
    LEFT JOIN orders o ON o.userId = u.id AND o.status = 'delivered'
    WHERE u.role = 'user'
    GROUP BY u.id
  `);

  const rows = (userOrderStats as unknown as [Array<{
    userId: number;
    totalOrders: number;
    lastOrderAt: Date | null;
    firstOrderAt: Date | null;
    avgDaysBetween: number | null;
  }>])[0];

  for (const row of rows) {
    const tags: CustomerTagValue[] = [];
    const total = Number(row.totalOrders ?? 0);
    const lastOrder = row.lastOrderAt ? new Date(row.lastOrderAt) : null;
    const daysSinceLast = lastOrder
      ? Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const avg = row.avgDaysBetween ? Number(row.avgDaysBetween) : null;

    if (total === 0) continue; // sem pedidos entregues, sem tag

    // Inatividade
    if (daysSinceLast !== null) {
      if (daysSinceLast >= 60) tags.push("inativo_60");
      else if (daysSinceLast >= 30) tags.push("inativo_30");
      else if (daysSinceLast >= 15) tags.push("inativo_15");
    }

    // Novo: até 5 pedidos
    if (total <= 5) tags.push("novo");

    // Recorrente: mais de 10 pedidos e pediu nos últimos 30 dias
    if (total > 10 && daysSinceLast !== null && daysSinceLast < 30) tags.push("recorrente");

    // Indeciso: compra com intervalo médio entre 12 e 20 dias
    if (avg !== null && avg >= 12 && avg <= 20 && total > 2) tags.push("indeciso");

    // Upsert tags
    for (const tag of tags) {
      const existing = await db
        .select()
        .from(customerTags)
        .where(and(eq(customerTags.userId, row.userId), eq(customerTags.tag, tag)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(customerTags).values({
          userId: row.userId,
          tag,
          assignedAt: now,
          updatedAt: now,
        });
      } else {
        await db
          .update(customerTags)
          .set({ updatedAt: now })
          .where(and(eq(customerTags.userId, row.userId), eq(customerTags.tag, tag)));
      }
    }

    // Remover tags que não se aplicam mais
    const allTags: CustomerTagValue[] = ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"];
    const toRemove = allTags.filter(t => !tags.includes(t));
    if (toRemove.length > 0) {
      await db
        .delete(customerTags)
        .where(
          and(
            eq(customerTags.userId, row.userId),
            inArray(customerTags.tag, toRemove)
          )
        );
    }

    // Fire automation triggers for inactivity tags (only when newly assigned)
    for (const tag of tags) {
      if (tag === "inativo_15" || tag === "inativo_30" || tag === "inativo_60") {
        const triggerName = `tag_${tag}` as typeof journeys.$inferInsert["trigger"];
        // Check if this tag was already present before (to avoid re-triggering)
        const wasAlreadyTagged = await db
          .select()
          .from(customerTags)
          .where(and(eq(customerTags.userId, row.userId), eq(customerTags.tag, tag)))
          .limit(1);
        if (!wasAlreadyTagged.length) {
          // Tag is new — fire the trigger (deferred to avoid circular call during iteration)
          newInactivityTriggers.push({ trigger: triggerName, userId: row.userId });
        }
      }
    }

    // ── tag_inativo_custom: verificar jornadas com N dias configurável ──────────
    if (row.lastOrderAt) {
      const daysSinceLast = Math.floor(
        (now.getTime() - new Date(row.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const customJourneys = await db
        .select()
        .from(journeys)
        .where(and(eq(journeys.trigger, "tag_inativo_custom"), eq(journeys.status, "active")));
      for (const cj of customJourneys) {
        const requiredDays = cj.daysInactive ?? 0;
        if (requiredDays > 0 && daysSinceLast >= requiredDays) {
          // Verificar se já existe execução ativa para este usuário nesta jornada
          const existingExec = await db
            .select({ id: journeyExecutions.id })
            .from(journeyExecutions)
            .where(and(
              eq(journeyExecutions.journeyId, cj.id),
              eq(journeyExecutions.userId, row.userId),
              inArray(journeyExecutions.status, ["running", "completed"])
            ))
            .limit(1);
          if (!existingExec.length) {
            await startJourneyExecution(cj.id, row.userId);
          }
        }
      }
    }
  }

  // Fire inactivity triggers after all tags are processed
  for (const { trigger, userId } of newInactivityTriggers) {
    fireJourneyTrigger(trigger, userId).catch((err: unknown) =>
      console.error(`[Automation] inactivity trigger ${trigger} failed for user ${userId}:`, err)
    );
  }
}

// ─── Abandoned Cart ───────────────────────────────────────────────────────────

export async function registerAbandonedCart(data: {
  userId: number;
  customerName: string;
  customerPhone?: string;
  items: Array<{ productId: number; productName: string; quantity: number; productPrice: string }>;
  total: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) return -1;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h

  // Verificar se já existe carrinho pendente para este usuário
  const existing = await db
    .select()
    .from(abandonedCarts)
    .where(and(eq(abandonedCarts.userId, data.userId), eq(abandonedCarts.status, "pending")))
    .limit(1);

  if (existing.length > 0) {
    // Atualizar o existente
    await db
      .update(abandonedCarts)
      .set({
        items: JSON.stringify(data.items),
        total: data.total,
        expiresAt,
        createdAt: now,
      })
      .where(eq(abandonedCarts.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(abandonedCarts).values({
    userId: data.userId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    items: JSON.stringify(data.items),
    total: data.total,
    status: "pending",
    createdAt: now,
    expiresAt,
  });
  return Number((result[0] as { insertId: number }).insertId);
}

export async function markCartRecovered(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(abandonedCarts)
    .set({ status: "recovered", recoveredAt: new Date() })
    .where(and(eq(abandonedCarts.userId, userId), eq(abandonedCarts.status, "pending")));
}

// ─── Journey Engine ───────────────────────────────────────────────────────────

/**
 * Inicia uma nova execução de jornada para um usuário.
 */
export async function startJourneyExecution(
  journeyId: number,
  userId: number,
  phone?: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  const db = await getDb();
  if (!db) return -1;

  // Verificar se já existe execução ativa para este usuário nesta jornada
  const existing = await db
    .select()
    .from(journeyExecutions)
    .where(
      and(
        eq(journeyExecutions.journeyId, journeyId),
        eq(journeyExecutions.userId, userId),
        eq(journeyExecutions.status, "running")
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id; // já está rodando

  const journey = await db.select().from(journeys).where(eq(journeys.id, journeyId)).limit(1);
  if (!journey.length || journey[0].status !== "active") return -1;

  const steps: JourneyStep[] = JSON.parse(journey[0].steps);
  const firstStep = steps[0];
  const nextStepAt = firstStep?.type === "wait" && firstStep.delayMinutes
    ? new Date(Date.now() + firstStep.delayMinutes * 60 * 1000)
    : new Date();

  const result = await db.insert(journeyExecutions).values({
    journeyId,
    userId,
    phone: phone ?? null,
    status: "running",
    currentStep: 0,
    metadata: metadata ? JSON.stringify(metadata) : null,
    startedAt: new Date(),
    nextStepAt,
    logs: JSON.stringify([{ at: new Date().toISOString(), msg: "Jornada iniciada" }]),
  });

  return Number((result[0] as { insertId: number }).insertId);
}

/**
 * Processa todas as execuções pendentes (nextStepAt <= agora).
 * Deve ser chamado periodicamente (ex: a cada 5 minutos).
 */
export async function processJourneyExecutions(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();

  const pending = await db
    .select()
    .from(journeyExecutions)
    .where(
      and(
        eq(journeyExecutions.status, "running"),
        lt(journeyExecutions.nextStepAt!, now)
      )
    )
    .limit(50);

  for (const exec of pending) {
    try {
      await processExecution(exec);
    } catch (err) {
      console.error(`[Automation] Erro ao processar execução ${exec.id}:`, err);
      await db
        .update(journeyExecutions)
        .set({ status: "failed" })
        .where(eq(journeyExecutions.id, exec.id));
    }
  }
}

async function processExecution(exec: typeof journeyExecutions.$inferSelect): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const journey = await db.select().from(journeys).where(eq(journeys.id, exec.journeyId)).limit(1);
  if (!journey.length) return;

  const steps: JourneyStep[] = JSON.parse(journey[0].steps);
  let currentStepIdx = exec.currentStep;
  const logs: Array<{ at: string; msg: string }> = exec.logs ? JSON.parse(exec.logs) : [];
  const metadata: Record<string, unknown> = exec.metadata ? JSON.parse(exec.metadata) : {};

  const log = (msg: string) => logs.push({ at: new Date().toISOString(), msg });

  while (currentStepIdx < steps.length) {
    const step = steps[currentStepIdx];

    // ── Exit Condition: encerrar se cliente fez pedido (se habilitado) ──────────
    if (journey[0].exitOnOrder) {
      const exitOrder = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.userId, exec.userId),
            gte(orders.createdAt, exec.startedAt),
            inArray(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"])
          )
        )
        .limit(1);
      if (exitOrder.length > 0) {
        log(`Exit Condition: cliente fez pedido #${exitOrder[0].id} — jornada encerrada automaticamente`);
        await db
          .update(journeyExecutions)
          .set({ status: "completed", completedAt: new Date(), currentStep: currentStepIdx, logs: JSON.stringify(logs) })
          .where(eq(journeyExecutions.id, exec.id));
        return;
      }
    }

    if (step.type === "wait") {
      // Já esperou, avançar
      currentStepIdx++;
      continue;
    }

    if (step.type === "send_whatsapp") {
      if (exec.phone && step.message) {
        await sendWhatsApp(exec.phone, step.message);
        log(`WhatsApp enviado: ${step.message.substring(0, 60)}`);
      }
      currentStepIdx++;
    } else if (step.type === "send_push") {
      if (step.title && step.message) {
        await sendPushToUser(exec.userId, {
          title: step.title,
          body: step.message,
          url: "/",
          tag: `journey-${exec.journeyId}-${exec.id}`,
        });
        log(`Push enviado: ${step.title}`);
      }
      currentStepIdx++;
    } else if (step.type === "add_tag") {
      if (step.tag) {
        // step.tag can be a custom tag ID (numeric string) or a system tag name
        const tagIdNum = Number(step.tag);
        if (!isNaN(tagIdNum) && tagIdNum > 0) {
          // Custom tag by ID
          const existingCustom = await db
            .select()
            .from(customCustomerTags)
            .where(and(eq(customCustomerTags.userId, exec.userId), eq(customCustomerTags.tagId, tagIdNum)))
            .limit(1);
          if (!existingCustom.length) {
            await db.insert(customCustomerTags).values({ userId: exec.userId, tagId: tagIdNum, assignedAt: new Date() });
          }
          log(`Tag personalizada adicionada: id=${tagIdNum}`);
        } else {
          // System tag by name
          const tag = step.tag as CustomerTagValue;
          const existing = await db
            .select()
            .from(customerTags)
            .where(and(eq(customerTags.userId, exec.userId), eq(customerTags.tag, tag)))
            .limit(1);
          if (!existing.length) {
            await db.insert(customerTags).values({ userId: exec.userId, tag, assignedAt: new Date(), updatedAt: new Date() });
          }
          log(`Tag do sistema adicionada: ${tag}`);
        }
      }
      currentStepIdx++;
    } else if (step.type === "remove_tag") {
      if (step.tag) {
        const tagIdNum = Number(step.tag);
        if (!isNaN(tagIdNum) && tagIdNum > 0) {
          // Custom tag by ID
          await db
            .delete(customCustomerTags)
            .where(and(eq(customCustomerTags.userId, exec.userId), eq(customCustomerTags.tagId, tagIdNum)));
          log(`Tag personalizada removida: id=${tagIdNum}`);
        } else {
          // System tag by name
          await db
            .delete(customerTags)
            .where(and(eq(customerTags.userId, exec.userId), eq(customerTags.tag, step.tag as CustomerTagValue)));
          log(`Tag do sistema removida: ${step.tag}`);
        }
      }
      currentStepIdx++;
    } else if (step.type === "condition") {
      let conditionMet = false;

      if (step.condition === "purchased_since_start") {
        // Verificar se o usuário fez um pedido desde o início da jornada
        const recentOrder = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.userId, exec.userId),
              gte(orders.createdAt, exec.startedAt),
              inArray(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"])
            )
          )
          .limit(1);
        conditionMet = recentOrder.length > 0;
      } else if (step.condition === "has_tag" && step.conditionTag) {
        const tagRow = await db
          .select()
          .from(customerTags)
          .where(and(eq(customerTags.userId, exec.userId), eq(customerTags.tag, step.conditionTag as CustomerTagValue)))
          .limit(1);
        conditionMet = tagRow.length > 0;
      }

      const action = conditionMet ? step.onTrue : step.onFalse;
      log(`Condição "${step.condition}": ${conditionMet ? "verdadeira" : "falsa"} → ${action}`);

      if (action === "stop") {
        await db
          .update(journeyExecutions)
          .set({ status: "completed", completedAt: new Date(), currentStep: currentStepIdx, logs: JSON.stringify(logs) })
          .where(eq(journeyExecutions.id, exec.id));
        return;
      }
      currentStepIdx++;
    } else if (step.type === "send_coupon") {
      // ── Gerar cupom exclusivo e notificar o cliente ──────────────────────────
      const discountType = step.couponDiscountType ?? "percentage";
      const discountValue = step.couponDiscountValue ?? 10;
      const expiryDays = step.couponExpiryDays ?? 7;
      // Código único: prefixo + userId + timestamp base36
      const code = `BONATTO${exec.userId}${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400 * 1000) : null;
      const discountLabel = discountType === "percentage"
        ? `${discountValue}% de desconto`
        : `R$ ${Number(discountValue).toFixed(2).replace(".", ",")} de desconto`;
      const validityLabel = expiryDays > 0 ? ` (válido por ${expiryDays} dia${expiryDays !== 1 ? "s" : ""})` : "";

      // 1. Persistir o cupom no banco (exclusivo para este usuário)
      await db.insert(coupons).values({
        code,
        discountType: discountType as "percentage" | "fixed",
        discountValue: String(discountValue),
        minOrderValue: "0",
        maxUses: 1,
        usedCount: 0,
        active: true,
        userId: exec.userId,
        expiresAt: expiresAt ?? undefined,
      });

      // 2. Notificação no app (painel do cliente)
      await db.insert(clientNotifications).values({
        userId: exec.userId,
        title: "🎁 Cupom exclusivo para você!",
        message: `Use o código ${code} e ganhe ${discountLabel}${validityLabel}. Válido no próximo pedido.`,
        type: "promo",
        read: false,
      });

      // 3. Push notification
      await sendPushToUser(exec.userId, {
        title: "🎁 Cupom exclusivo para você!",
        body: `Use ${code} e ganhe ${discountLabel}${validityLabel}.`,
        url: "/cardapio",
        tag: `coupon-${code}`,
      });

      // 4. WhatsApp (se tiver telefone cadastrado)
      if (exec.phone) {
        const appUrl = process.env.PUBLIC_APP_URL ?? "";
        await sendWhatsApp(
          exec.phone,
          `🎁 *Bonatto Pizza* — Olá! Preparamos um cupom exclusivo para você:\n\n` +
          `*Código:* ${code}\n` +
          `*Desconto:* ${discountLabel}${validityLabel}\n\n` +
          `Use no seu próximo pedido: ${appUrl}/cardapio`
        );
      }

      log(`Cupom gerado: ${code} (${discountType} ${discountValue}${validityLabel})`);
      currentStepIdx++;
    } else if (step.type === "update_loyalty") {
      // ── Adicionar ou remover pontos de fidelidade ────────────────────────────
      const points = step.loyaltyPoints ?? 0;
      if (points !== 0) {
        const userRow = await db.select({ loyaltyPoints: users.loyaltyPoints }).from(users).where(eq(users.id, exec.userId)).limit(1);
        const currentPoints = userRow[0]?.loyaltyPoints ?? 0;
        const newBalance = Math.max(0, currentPoints + points);
        const description = step.loyaltyDescription ?? `Automação: ${points > 0 ? "+" : ""}${points} pontos`;

        // 1. Atualizar saldo do usuário
        await db.update(users).set({ loyaltyPoints: newBalance }).where(eq(users.id, exec.userId));

        // 2. Registrar transação de fidelidade
        await db.insert(loyaltyTransactions).values({
          userId: exec.userId,
          type: "manual",
          points,
          description,
          balanceBefore: currentPoints,
          balanceAfter: newBalance,
        });

        // 3. Notificação no app
        const pointsLabel = points > 0 ? `+${points} pontos adicionados` : `${points} pontos removidos`;
        await db.insert(clientNotifications).values({
          userId: exec.userId,
          title: points > 0 ? "⭐ Pontos adicionados!" : "📉 Pontos removidos",
          message: `${pointsLabel}. Seu saldo atual é de ${newBalance} pontos. ${description}`,
          type: "system",
          read: false,
        });

        // 4. Push notification
        await sendPushToUser(exec.userId, {
          title: points > 0 ? "⭐ Você ganhou pontos!" : "📉 Pontos atualizados",
          body: `${pointsLabel}. Saldo atual: ${newBalance} pontos.`,
          url: "/minha-conta",
          tag: `loyalty-${exec.userId}-${Date.now()}`,
        });

        log(`Pontos de fidelidade: ${points > 0 ? "+" : ""}${points} (saldo: ${newBalance})`);
      }
      currentStepIdx++;
    } else if (step.type === "send_alert") {
      // ── Criar alerta personalizado no painel do cliente ──────────────────────
      const alertTitle = step.alertTitle ?? "Nova mensagem";
      const alertMsg = step.alertMessage ?? "";
      const alertIcon = step.alertIcon ?? "🔔";
      const alertUrl = step.alertUrl ?? null;

      // 1. Notificação no app (específica para este usuário)
      await db.insert(clientNotifications).values({
        userId: exec.userId,
        title: `${alertIcon} ${alertTitle}`,
        message: alertMsg,
        type: "system",
        read: false,
      });

      // 2. Push notification (se tiver mensagem)
      if (alertMsg) {
        await sendPushToUser(exec.userId, {
          title: `${alertIcon} ${alertTitle}`,
          body: alertMsg,
          url: alertUrl ?? "/",
          tag: `alert-${exec.journeyId}-${exec.id}`,
        });
      }

      log(`Alerta enviado ao usuário ${exec.userId}: ${alertTitle}`);
      currentStepIdx++;
    } else if (step.type === "split_ab") {
      // ── Teste A/B: IDs pares = Grupo A, IDs ímpares = Grupo B ────────────────
      const isGroupA = exec.userId % 2 === 0;
      const group = isGroupA ? "A" : "B";
      const channel = step.splitChannel ?? "push";
      const msgToSend = isGroupA ? (step.messageA ?? step.message ?? "") : (step.messageB ?? step.message ?? "");
      const titleToSend = isGroupA ? (step.titleA ?? step.title ?? "Bonatto Pizza") : (step.titleB ?? step.title ?? "Bonatto Pizza");

      if (msgToSend) {
        if (channel === "whatsapp" && exec.phone) {
          // WhatsApp A/B
          await sendWhatsApp(exec.phone, msgToSend);
        } else if (channel === "push") {
          // Push A/B
          await sendPushToUser(exec.userId, {
            title: titleToSend,
            body: msgToSend,
            url: "/",
            tag: `split-${exec.journeyId}-${exec.id}-${group}`,
          });
        }
      }

      // Registrar grupo no log e persistir no banco para análise A/B
      await db
        .update(journeyExecutions)
        .set({ abGroup: group })
        .where(eq(journeyExecutions.id, exec.id));
      log(`Split A/B: usuário ${exec.userId} → Grupo ${group} | canal: ${channel} | msg: ${msgToSend.substring(0, 60)}`);
      currentStepIdx++;
    } else if (step.type === "pause_journey") {
      // ── Pausar outra jornada ativa ───────────────────────────────────────────
      if (step.pauseJourneyId) {
        await db
          .update(journeys)
          .set({ status: "paused", updatedAt: new Date() })
          .where(and(eq(journeys.id, step.pauseJourneyId), eq(journeys.status, "active")));
        log(`Jornada #${step.pauseJourneyId} pausada automaticamente`);
      }
      currentStepIdx++;
    } else if (step.type === "notify_admin") {
      // ── Criar notificação/tarefa para o admin ────────────────────────────────
      const taskTitle = step.adminTaskTitle ?? "Ação manual necessária";
      const taskMsg = step.adminTaskMessage ?? `Cliente ${exec.userId} requer atenção (jornada #${exec.journeyId})`;
      // Notificar via sistema de notificações do owner
      const { notifyOwner } = await import("./_core/notification");
      await notifyOwner({ title: taskTitle, content: taskMsg });
      // Registrar no log da execução
      await db
        .update(journeyExecutions)
        .set({ adminTaskTitle: taskTitle })
        .where(eq(journeyExecutions.id, exec.id));
      log(`Tarefa criada para admin: ${taskTitle}`);
      currentStepIdx++;
    } else {
      currentStepIdx++;
    }

    // Verificar se o próximo passo é um "wait"
    if (currentStepIdx < steps.length && steps[currentStepIdx].type === "wait") {
      const delay = steps[currentStepIdx].delayMinutes ?? 0;
      const nextAt = new Date(Date.now() + delay * 60 * 1000);
      await db
        .update(journeyExecutions)
        .set({ currentStep: currentStepIdx, nextStepAt: nextAt, logs: JSON.stringify(logs) })
        .where(eq(journeyExecutions.id, exec.id));
      return; // Aguardar próximo ciclo
    }
  }

  // Jornada concluída
  await db
    .update(journeyExecutions)
    .set({ status: "completed", completedAt: new Date(), currentStep: currentStepIdx, logs: JSON.stringify(logs) })
    .where(eq(journeyExecutions.id, exec.id));
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export async function getCustomerTagsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerTags).where(eq(customerTags.userId, userId));
}

export async function getAllCustomerTagsWithUsers() {
  const db = await getDb();
  if (!db) return [[], []];
  return db.execute(sql`
    SELECT ct.userId, ct.tag, ct.assignedAt, u.name, u.email, u.phone
    FROM customer_tags ct
    JOIN users u ON u.id = ct.userId
    ORDER BY ct.assignedAt DESC
  `);
}

export async function listJourneys() {
  const db = await getDb();
  if (!db) return [];
  const list = await db.select().from(journeys).orderBy(journeys.createdAt);
  // Enrich with execution stats
  const enriched = await Promise.all(list.map(async (j) => {
    const execs = await db
      .select({ id: journeyExecutions.id, startedAt: journeyExecutions.startedAt })
      .from(journeyExecutions)
      .where(eq(journeyExecutions.journeyId, j.id));
    const execCount = execs.length;
    const lastRunAt = execs.length > 0
      ? execs.reduce((latest, e) =>
          new Date(e.startedAt) > new Date(latest) ? e.startedAt : latest,
          execs[0].startedAt
        )
      : null;
    return { ...j, execCount, lastRunAt };
  }));
  return enriched;
}

export async function getJourneyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(journeys).where(eq(journeys.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createJourney(data: {
  name: string;
  description?: string;
  trigger: typeof journeys.$inferInsert["trigger"];
  steps: JourneyStep[];
  daysInactive?: number;
}) {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(journeys).values({
    name: data.name,
    description: data.description ?? null,
    trigger: data.trigger,
    status: "draft",
    steps: JSON.stringify(data.steps),
    daysInactive: data.daysInactive ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number((result[0] as { insertId: number }).insertId);
}

export async function updateJourney(id: number, data: Partial<{
  name: string;
  description: string;
  trigger: typeof journeys.$inferInsert["trigger"];
  status: "active" | "paused" | "draft";
  steps: JourneyStep[];
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(journeys).set({
    ...data,
    steps: data.steps ? JSON.stringify(data.steps) : undefined,
    updatedAt: new Date(),
  }).where(eq(journeys.id, id));
}

export async function deleteJourney(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(journeyExecutions).where(eq(journeyExecutions.journeyId, id));
  await db.delete(journeys).where(eq(journeys.id, id));
}

export async function duplicateJourney(id: number): Promise<number> {
  const db = await getDb();
  if (!db) return -1;
  const original = await db.select().from(journeys).where(eq(journeys.id, id)).limit(1);
  if (!original[0]) return -1;
  const result = await db.insert(journeys).values({
    name: `${original[0].name} (cópia)`,
    description: original[0].description,
    trigger: original[0].trigger,
    status: "draft",
    steps: original[0].steps,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number((result[0] as { insertId: number }).insertId);
}

export async function listExecutions(journeyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (journeyId) {
    return db.select().from(journeyExecutions).where(eq(journeyExecutions.journeyId, journeyId)).orderBy(journeyExecutions.startedAt);
  }
  return db.select().from(journeyExecutions).orderBy(journeyExecutions.startedAt);
}

export async function cancelExecution(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(journeyExecutions).set({ status: "cancelled", completedAt: new Date() }).where(eq(journeyExecutions.id, id));
}

export async function listAbandonedCarts(status?: "pending" | "recovered" | "expired") {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(abandonedCarts).where(eq(abandonedCarts.status, status)).orderBy(abandonedCarts.createdAt);
  }
  return db.select().from(abandonedCarts).orderBy(abandonedCarts.createdAt);
}

/**
 * Fires all active journeys for a given trigger for a specific user.
 * Safe to call fire-and-forget (errors are logged, not thrown).
 */
export async function fireJourneyTrigger(
  trigger: typeof journeys.$inferInsert["trigger"],
  userId: number,
  phone?: string
): Promise<void> {
  const activeJourneys = await getActiveJourneysForTrigger(trigger);
  for (const journey of activeJourneys) {
    try {
      await startJourneyExecution(journey.id, userId, phone);
    } catch (err) {
      console.error(`[Automation] fireJourneyTrigger failed for journey ${journey.id}:`, err);
    }
  }
}

export async function getActiveJourneysForTrigger(trigger: typeof journeys.$inferInsert["trigger"]) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journeys).where(and(eq(journeys.trigger, trigger), eq(journeys.status, "active")));
}

// ─── Automation Events (auditoria anti-duplicação) ───────────────────────────

/**
 * Registra um evento de automação para auditoria e anti-duplicação.
 */
async function logAutomationEvent(
  db: Awaited<ReturnType<typeof getDb>>,
  params: {
    type: string;
    userId?: number;
    cartId?: number;
    orderId?: number;
    channel: "whatsapp" | "push" | "email";
    step?: number;
    status: "sent" | "failed";
    abVariant?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!db) return;
  await db.insert(automationEvents).values({
    type: params.type,
    userId: params.userId,
    cartId: params.cartId,
    orderId: params.orderId,
    channel: params.channel,
    step: params.step,
    status: params.status,
    abVariant: params.abVariant,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: new Date(),
  });
}

/**
 * Verifica se já foi enviado um evento deste tipo/step para este carrinho/usuário.
 * Garante anti-duplicação mesmo com jobs paralelos.
 */
async function alreadySent(
  db: Awaited<ReturnType<typeof getDb>>,
  type: string,
  step: number,
  cartId?: number,
  userId?: number
): Promise<boolean> {
  if (!db) return false;
  const conditions = [eq(automationEvents.type, type), eq(automationEvents.step, step)];
  if (cartId) conditions.push(eq(automationEvents.cartId, cartId));
  if (userId) conditions.push(eq(automationEvents.userId, userId));
  const existing = await db.select({ id: automationEvents.id }).from(automationEvents).where(and(...conditions)).limit(1);
  return existing.length > 0;
}

// ─── Geração de cupom de recuperação ─────────────────────────────────────────

async function generateRecoveryCoupon(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
  discountPercent: number,
  suffix: string
): Promise<string> {
  if (!db) return "VOLTA10";
  const code = `VOLTA${discountPercent}-${suffix.toUpperCase().replace(/\W/g, "").slice(0, 6)}`;
  // Verificar se já existe
  const existing = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  if (existing.length > 0) return code;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
  await db.insert(coupons).values({
    code,
    discountType: "percentage",
    discountValue: String(discountPercent),
    minOrderValue: "30.00",
    maxUses: 1,
    usedCount: 0,
    active: true,
    userId,
    expiresAt,
    createdAt: new Date(),
  });
  return code;
}

/**
 * Processa carrinhos abandonados:
 * - Etapa 1 (10min): urgência — "Sua pizza está esperando"
 * - Etapa 2 (20min): benefício — "Entrega grátis na próxima hora"
 * - Etapa 3 (30min): escassez + cupom — "Última chance + VOLTA10"
 * Anti-duplicação via automationEvents.
 */
export async function processAbandonedCarts(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();

  const pending = await db
    .select()
    .from(abandonedCarts)
    .where(and(eq(abandonedCarts.status, "pending"), lt(abandonedCarts.expiresAt, new Date(now.getTime() + 3 * 60 * 60 * 1000))))
    .limit(50);

  for (const cart of pending) {
    const minutesSinceCreated = (now.getTime() - new Date(cart.createdAt).getTime()) / (1000 * 60);

    // ── Etapa 1: 10 minutos — Urgência ──────────────────────────────────────
    if (minutesSinceCreated >= 10 && !cart.firstReminderSentAt) {
      const isDuplicate = await alreadySent(db, "cart_step1", 1, cart.id);
      if (!isDuplicate) {
        const items = JSON.parse(cart.items) as Array<{ productName: string; quantity: number }>;
        const itemsList = items.map(i => `• ${i.productName} x${i.quantity}`).join("\n");
        const msg = `Olá, ${cart.customerName}! 🍕\n\nVocê deixou sua pizza no forno! 😅\n\n${itemsList}\n\n*Total: R$ ${cart.total}*\n\nFinalize agora antes que esfrie:\n👉 https://bonattopizza.manus.space`;

        if (cart.customerPhone) {
          await sendWhatsApp(cart.customerPhone, msg);
          await logAutomationEvent(db, { type: "cart_step1", userId: cart.userId, cartId: cart.id, channel: "whatsapp", step: 1, status: "sent" });
        }
        // Push notification (usa template configurado no admin, com fallback)
        {
          const tpl = await pickRandomTemplate("cart_abandoned_step1", "push");
          const interpolate = (t: string) => t.replace(/\{\{total\}\}/g, cart.total).replace(/\{\{clientName\}\}/g, cart.customerName ?? "cliente");
          const pushTitle = tpl ? interpolate(tpl.title) : "🍕 Sua pizza está esperando!";
          const pushBody = tpl ? interpolate(tpl.body) : `Finalize seu pedido de R$ ${cart.total}`;
          await sendPushToUser(cart.userId, { title: pushTitle, body: pushBody, url: `/checkout?restore=${cart.id}`, tag: `abandoned-cart-${cart.id}` });
        }
        await logAutomationEvent(db, { type: "cart_step1", userId: cart.userId, cartId: cart.id, channel: "push", step: 1, status: "sent" });

        await db.update(abandonedCarts).set({ firstReminderSentAt: now, currentStep: 1 }).where(eq(abandonedCarts.id, cart.id));

        // Disparar jornadas de checkout_abandoned
        const activeJourneys = await getActiveJourneysForTrigger("checkout_abandoned");
        for (const j of activeJourneys) {
          await startJourneyExecution(j.id, cart.userId, cart.customerPhone ?? undefined, { cartId: cart.id, total: cart.total });
        }
      }
    }

    // ── Etapa 2: 20 minutos — Benefício ─────────────────────────────────────
    if (minutesSinceCreated >= 20 && cart.firstReminderSentAt && !cart.secondReminderSentAt) {
      const isDuplicate = await alreadySent(db, "cart_step2", 2, cart.id);
      if (!isDuplicate) {
        const msg = `${cart.customerName}, ainda dá tempo! 🔥\n\nSeu pedido de *R$ ${cart.total}* ainda está salvo.\n\n🛵 Entregamos em até 40 minutos!\n\nNão perca sua pizza favorita:\n👉 https://bonattopizza.manus.space`;

        if (cart.customerPhone) {
          await sendWhatsApp(cart.customerPhone, msg);
          await logAutomationEvent(db, { type: "cart_step2", userId: cart.userId, cartId: cart.id, channel: "whatsapp", step: 2, status: "sent" });
        }
        {
          const tpl = await pickRandomTemplate("cart_abandoned_step2", "push");
          const interpolate = (t: string) => t.replace(/\{\{total\}\}/g, cart.total).replace(/\{\{clientName\}\}/g, cart.customerName ?? "cliente");
          const pushTitle = tpl ? interpolate(tpl.title) : "🛵 Entrega em 40 minutos!";
          const pushBody = tpl ? interpolate(tpl.body) : `Seu pedido de R$ ${cart.total} está salvo`;
          await sendPushToUser(cart.userId, { title: pushTitle, body: pushBody, url: `/checkout?restore=${cart.id}`, tag: `abandoned-cart-${cart.id}` });
        }
        await logAutomationEvent(db, { type: "cart_step2", userId: cart.userId, cartId: cart.id, channel: "push", step: 2, status: "sent" });

        await db.update(abandonedCarts).set({ secondReminderSentAt: now, currentStep: 2 }).where(eq(abandonedCarts.id, cart.id));
      }
    }

    // ── Etapa 3: 30 minutos — Escassez + Cupom ───────────────────────────────
    if (minutesSinceCreated >= 30 && cart.secondReminderSentAt && !cart.thirdReminderSentAt) {
      const isDuplicate = await alreadySent(db, "cart_step3", 3, cart.id);
      if (!isDuplicate) {
        // Gerar cupom personalizado de 10% para este usuário
        const couponCode = await generateRecoveryCoupon(db, cart.userId, 10, cart.customerName);

        const msg = `⏰ ${cart.customerName}, última chance!\n\nSeu carrinho expira em breve e não queremos que você perca sua pizza! 🍕\n\n🎁 Use o cupom exclusivo *${couponCode}* e ganhe *10% de desconto*!\n\n⚡ Válido por apenas 48 horas!\n\n👉 https://bonattopizza.manus.space`;

        if (cart.customerPhone) {
          await sendWhatsApp(cart.customerPhone, msg);
          await logAutomationEvent(db, { type: "cart_step3", userId: cart.userId, cartId: cart.id, channel: "whatsapp", step: 3, status: "sent", metadata: { couponCode } });
        }
        {
          const tpl = await pickRandomTemplate("cart_abandoned_step3", "push");
          const interpolate = (t: string) => t.replace(/\{\{total\}\}/g, cart.total).replace(/\{\{clientName\}\}/g, cart.customerName ?? "cliente").replace(/\{\{coupon\}\}/g, couponCode);
          const pushTitle = tpl ? interpolate(tpl.title) : "⏰ Última chance! 10% OFF";
          const pushBody = tpl ? interpolate(tpl.body) : `Cupom ${couponCode} — válido 48h`;
          await sendPushToUser(cart.userId, { title: pushTitle, body: pushBody, url: `/checkout?restore=${cart.id}`, tag: `abandoned-cart-${cart.id}` });
        }
        await logAutomationEvent(db, { type: "cart_step3", userId: cart.userId, cartId: cart.id, channel: "push", step: 3, status: "sent", metadata: { couponCode } });

        await db.update(abandonedCarts).set({ thirdReminderSentAt: now, couponCode, currentStep: 3 }).where(eq(abandonedCarts.id, cart.id));
      }
    }

    // ── Expirar carrinhos antigos (> 2h) ─────────────────────────────────────
    if (new Date(cart.expiresAt) < now) {
      await db.update(abandonedCarts).set({ status: "expired" }).where(eq(abandonedCarts.id, cart.id));
    }
  }
}

// ─── Reativação de Clientes Inativos ─────────────────────────────────────────

const REACTIVATION_COPY: Record<string, { title: string; whatsapp: (name: string, coupon: string) => string; push: { title: string; body: string } }> = {
  inativo_15: {
    title: "Sentimos sua falta!",
    whatsapp: (name, coupon) =>
      `Oi, ${name}! 👋\n\nFaz uns dias que você não pede na Bonatto Pizza e a gente sentiu falta!\n\n🍕 Que tal uma pizza hoje? Use o cupom *${coupon}* e ganhe *5% de desconto* no seu próximo pedido!\n\n⏰ Válido por 72 horas.\n\n👉 https://bonattopizza.manus.space`,
    push: { title: "🍕 Sentimos sua falta!", body: "5% OFF no seu próximo pedido — válido 72h" },
  },
  inativo_30: {
    title: "Oferta especial para você",
    whatsapp: (name, coupon) =>
      `${name}, temos uma oferta especial para você! 🎁\n\nSabemos que faz um tempinho que você não pede na Bonatto Pizza. Que tal voltar com *10% de desconto*?\n\n🎟️ Cupom exclusivo: *${coupon}*\n\n⏰ Oferta por tempo limitado!\n\n👉 https://bonattopizza.manus.space`,
    push: { title: "🎁 10% OFF — Oferta exclusiva!", body: "Volte a pedir com desconto especial" },
  },
  inativo_60: {
    title: "Voltamos para você!",
    whatsapp: (name, coupon) =>
      `${name}! 😢\n\nA gente sente muito a sua falta na Bonatto Pizza.\n\nPara te receber de volta, preparamos um cupom especial de *15% de desconto*:\n\n🎟️ *${coupon}*\n\n🍕 Novidades no cardápio te esperam!\n\n👉 https://bonattopizza.manus.space`,
    push: { title: "😢 Voltamos para você! 15% OFF", body: "Cupom especial de 15% para seu retorno" },
  },
};

/**
 * Processa reativação de clientes inativos por segmento (15/30/60 dias).
 * Envia mensagem WhatsApp + Push com cupom personalizado.
 * Anti-duplicação: verifica automationEvents antes de enviar.
 */
export async function processReactivation(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();

  const segments: Array<{ tag: CustomerTagValue; type: string; discount: number; validHours: number }> = [
    { tag: "inativo_15", type: "reactivation_15d", discount: 5, validHours: 72 },
    { tag: "inativo_30", type: "reactivation_30d", discount: 10, validHours: 48 },
    { tag: "inativo_60", type: "reactivation_60d", discount: 15, validHours: 24 },
  ];

  for (const segment of segments) {
    // Buscar clientes com esta tag que ainda não receberam mensagem nas últimas 30 dias
    const taggedUsers = await db
      .select({ userId: customerTags.userId, assignedAt: customerTags.assignedAt })
      .from(customerTags)
      .where(eq(customerTags.tag, segment.tag))
      .limit(30);

    for (const tagged of taggedUsers) {
      // Anti-duplicação: não enviar se já enviou nos últimos 30 dias
      const recentlySent = await db
        .select({ id: automationEvents.id })
        .from(automationEvents)
        .where(
          and(
            eq(automationEvents.type, segment.type),
            eq(automationEvents.userId, tagged.userId),
            gte(automationEvents.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
          )
        )
        .limit(1);

      if (recentlySent.length > 0) continue;

      // Buscar dados do usuário
      const userRows = await db.select().from(users).where(eq(users.id, tagged.userId)).limit(1);
      if (userRows.length === 0) continue;
      const user = userRows[0];
      const phone = user.phone ?? "";
      if (!phone) continue;

      // Gerar cupom personalizado
      const suffix = `${user.id}-${segment.tag.replace("_", "")}`;
      const couponCode = await generateRecoveryCoupon(db, user.id, segment.discount, suffix);
      const name = user.name ?? "cliente";

      // Mapear tag para evento de template
      const tagToEvent: Record<string, string> = {
        inativo_15: "reactivation_15",
        inativo_30: "reactivation_30",
        inativo_60: "reactivation_60",
      };
      const templateEvent = tagToEvent[segment.tag] ?? "reactivation_15";
      const interpolate = (t: string) =>
        t.replace(/\{\{clientName\}\}/g, name)
         .replace(/\{\{coupon\}\}/g, couponCode);

      // Enviar WhatsApp (usa template configurado no admin, com fallback)
      const waTpl = await pickRandomTemplate(templateEvent, "whatsapp");
      const copy = REACTIVATION_COPY[segment.tag];
      const waMsg = waTpl ? interpolate(waTpl.body) : (copy ? copy.whatsapp(name, couponCode) : "");
      if (waMsg) {
        await sendWhatsApp(phone, waMsg);
        await logAutomationEvent(db, { type: segment.type, userId: user.id, channel: "whatsapp", step: 1, status: "sent", metadata: { couponCode, tag: segment.tag } });
      }

      // Enviar Push (usa template configurado no admin, com fallback)
      const pushTpl = await pickRandomTemplate(templateEvent, "push");
      const pushTitle = pushTpl ? interpolate(pushTpl.title) : (copy?.push.title ?? "🍕 Sentimos sua falta!");
      const pushBody = pushTpl ? interpolate(pushTpl.body) : (copy?.push.body ?? "Temos uma oferta especial para você!");
      await sendPushToUser(user.id, { title: pushTitle, body: pushBody, url: "/" });
      await logAutomationEvent(db, { type: segment.type, userId: user.id, channel: "push", step: 1, status: "sent", metadata: { couponCode, tag: segment.tag } });

      // Disparar jornada de reativação se existir
      await fireJourneyTrigger(segment.tag as typeof journeys.$inferInsert["trigger"], user.id, phone);

      console.log(`[Reactivation] Enviado para userId=${user.id} (${segment.tag}) cupom=${couponCode}`);
    }
  }
}

/**
 * Marca conversões: quando um cliente que tinha carrinho abandonado ou estava inativo faz um pedido,
 * atualiza journeyExecutions com convertedAt e conversionOrderId.
 */
export async function markConversions(userId: number, orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();

  // Marcar carrinho como recuperado
  await markCartRecovered(userId);

  // Atualizar execuções de jornada em andamento para este usuário
  await db
    .update(journeyExecutions)
    .set({ convertedAt: now, conversionOrderId: orderId, status: "completed", completedAt: now })
    .where(and(eq(journeyExecutions.userId, userId), eq(journeyExecutions.status, "running")));

  // Registrar evento de conversão
  await db.insert(automationEvents).values({
    type: "conversion",
    userId,
    orderId,
    channel: "whatsapp",
    step: 0,
    status: "converted",
    createdAt: now,
  });
}
