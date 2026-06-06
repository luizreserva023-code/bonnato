import { Request, Response } from "express";
import { getDb } from "./db";
import { journeys, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { startJourneyExecution } from "./automation";

/**
 * POST /api/automations/webhook/:token
 *
 * Recebe um disparo externo para uma jornada específica.
 * O token é único por jornada e gerado automaticamente ao criar um nó Webhook.
 *
 * Headers opcionais:
 *   X-Webhook-Secret: <secret>  — se a jornada tiver um secret configurado, ele deve bater.
 *
 * Body (JSON, opcional):
 *   { phone?: string; name?: string; metadata?: Record<string, unknown> }
 */
export async function handleAutomationWebhook(req: Request, res: Response) {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: "Token ausente" });
  }

  // Buscar a jornada pelo token
  const dbConn = await getDb();
  if (!dbConn) return res.status(503).json({ error: "Banco de dados indisponível" });

  const [journey] = await dbConn
    .select()
    .from(journeys)
    .where(eq(journeys.webhookToken, token))
    .limit(1);

  if (!journey) {
    return res.status(404).json({ error: "Jornada não encontrada" });
  }

  if (journey.status !== "active") {
    return res.status(422).json({ error: "Jornada inativa" });
  }

  // Verificar secret se configurado nos steps
  let steps: Array<Record<string, unknown>> = [];
  try {
    steps = JSON.parse(journey.steps ?? "[]");
  } catch {
    steps = [];
  }

  // Encontrar o nó webhook nos steps para verificar o secret
  const webhookStep = steps.find((s) => s.type === "webhook");
  const incomingSecret = (req.headers["x-webhook-secret"] as string | undefined) ?? "";
  const globalSecret = process.env.AUTOMATION_WEBHOOK_SECRET ?? "";

  // Em produção, exigir secret (per-step ou global). Sem secret configurado,
  // webhook não pode ser disparado externamente.
  if (process.env.NODE_ENV === "production") {
    const expected = (webhookStep?.secret as string | undefined) ?? globalSecret;
    if (!expected) {
      console.error(`[Webhook] Jornada ${journey.id} sem secret configurado em produção — rejeitando.`);
      return res.status(403).json({ error: "Webhook não configurado. Defina AUTOMATION_WEBHOOK_SECRET ou um secret na jornada." });
    }
    if (incomingSecret !== expected) {
      return res.status(401).json({ error: "Secret inválido" });
    }
  } else if (webhookStep?.secret) {
    if (incomingSecret !== webhookStep.secret) {
      return res.status(401).json({ error: "Secret inválido" });
    }
  } else if (globalSecret) {
    if (incomingSecret !== globalSecret) {
      return res.status(401).json({ error: "Secret inválido" });
    }
  }

  // Extrair dados do body
  const body = req.body as { phone?: string; name?: string; metadata?: Record<string, unknown> };

  console.log(`[Webhook] Jornada "${journey.name}" (id=${journey.id}) disparada via webhook`, {
    phone: body.phone,
    name: body.name,
    metadata: body.metadata,
    ip: req.ip,
    at: new Date().toISOString(),
  });

  // Resolver userId a partir do telefone fornecido
  let userId: number | null = null;
  if (body.phone) {
    const cleanPhone = body.phone.replace(/\D/g, "");
    const [userRow] = await dbConn
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, cleanPhone))
      .limit(1);
    if (userRow) userId = userRow.id;
  }

  // Executar a jornada de fato
  let executionId = -1;
  if (userId) {
    executionId = await startJourneyExecution(
      journey.id,
      userId,
      body.phone,
      body.metadata as Record<string, string> | undefined
    );
  } else {
    console.warn(`[Webhook] Nenhum usuário encontrado para phone=${body.phone}. Jornada não executada.`);
  }

  return res.json({
    ok: true,
    journey: journey.name,
    executionId,
    message: userId
      ? "Webhook recebido e jornada iniciada com sucesso."
      : "Webhook recebido, mas nenhum usuário encontrado para o telefone informado.",
    receivedAt: new Date().toISOString(),
  });
}
