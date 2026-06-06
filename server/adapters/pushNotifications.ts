/**
 * Push Notifications Adapter — troca de provedor sem alterar o restante do código.
 *
 * Para usar na Manus (padrão — notifica apenas o dono do projeto):
 *   PUSH_PROVIDER=manus  (ou deixar em branco)
 *
 * Para usar VAPID próprio na sua VPS (notifica usuários via Web Push):
 *   PUSH_PROVIDER=vapid
 *   VAPID_PUBLIC_KEY=...    (gerado com: npx web-push generate-vapid-keys)
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:contato@bonattopizza.com.br
 *
 * Nota: O provider "manus" só suporta notificações para o dono do projeto.
 * Para notificações para usuários finais (clientes), use "vapid".
 * O projeto já tem web-push instalado e server/push.ts com toda a lógica VAPID.
 */

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export interface PushResult {
  success: boolean;
  provider: string;
  sent?: number;
  failed?: number;
  error?: string;
}

// ─── Manus built-in (owner notifications only) ───────────────────────────────
async function notifyOwnerManus(payload: PushNotificationPayload): Promise<PushResult> {
  try {
    const { notifyOwner } = await import("../_core/notification");
    const success = await notifyOwner({
      title: payload.title,
      content: payload.body,
    });
    return { success, provider: "manus" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "manus", error: message };
  }
}

// ─── VAPID (web-push, para VPS própria) ──────────────────────────────────────
async function sendVapidToUser(
  userId: number,
  payload: PushNotificationPayload
): Promise<PushResult> {
  try {
    const { sendPushToUser } = await import("../push");
    await sendPushToUser(userId, payload);
    return { success: true, provider: "vapid", sent: 1, failed: 0 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "vapid", error: message };
  }
}

async function sendVapidToAdmins(payload: PushNotificationPayload): Promise<PushResult> {
  try {
    const { sendPushToAdmins } = await import("../push");
    await sendPushToAdmins(payload);
    return { success: true, provider: "vapid" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "vapid", error: message };
  }
}

async function sendVapidToAll(
  payload: PushNotificationPayload,
  userIds?: number[]
): Promise<PushResult> {
  try {
    const { sendPushToAllUsers } = await import("../push");
    const { sent, failed } = await sendPushToAllUsers(payload, userIds);
    return { success: sent > 0, provider: "vapid", sent, failed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "vapid", error: message };
  }
}

// ─── Ponto de entrada único ───────────────────────────────────────────────────

/**
 * Notifica o dono do projeto (admin).
 * No provider "manus": usa notifyOwner da Manus.
 * No provider "vapid": envia push para todos os admins com subscription ativa.
 */
export async function notifyOwnerAdapter(
  payload: PushNotificationPayload
): Promise<PushResult> {
  const provider = (process.env.PUSH_PROVIDER ?? "manus").toLowerCase();

  switch (provider) {
    case "vapid":
      return sendVapidToAdmins(payload);
    case "manus":
    default:
      return notifyOwnerManus(payload);
  }
}

/**
 * Notifica um usuário específico via push.
 * No provider "manus": fallback para notifyOwner (sem userId específico).
 * No provider "vapid": envia push para as subscriptions do userId.
 */
export async function notifyUserAdapter(
  userId: number,
  payload: PushNotificationPayload
): Promise<PushResult> {
  const provider = (process.env.PUSH_PROVIDER ?? "manus").toLowerCase();

  switch (provider) {
    case "vapid":
      return sendVapidToUser(userId, payload);
    case "manus":
    default:
      // Manus não suporta notificação por userId — notifica o owner como fallback
      return notifyOwnerManus(payload);
  }
}

/**
 * Notifica todos os usuários (ou um subconjunto por userId).
 * No provider "manus": fallback para notifyOwner.
 * No provider "vapid": envia push para todos com subscription ativa.
 */
export async function notifyAllUsersAdapter(
  payload: PushNotificationPayload,
  userIds?: number[]
): Promise<PushResult> {
  const provider = (process.env.PUSH_PROVIDER ?? "manus").toLowerCase();

  switch (provider) {
    case "vapid":
      return sendVapidToAll(payload, userIds);
    case "manus":
    default:
      return notifyOwnerManus(payload);
  }
}
