import {
  getPendingScheduledNotifications,
  markScheduledNotificationSent,
  createScheduledNotification,
  getDb,
} from "./db";
import { sendPushToAllUsers } from "./push";
import { sendWhatsApp } from "./whatsapp";

/**
 * Get user IDs filtered by audience segment and optional neighborhood filter.
 * neighborhoodFilter: array of neighborhood names, or null = all neighborhoods.
 */
async function getUserIdsBySegment(
  segment: string,
  neighborhoodFilter?: string[] | null
): Promise<number[] | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const { users, orders } = await import("../drizzle/schema");
  const { eq, gte, or, like } = await import("drizzle-orm");

  // Helper: filter a list of user IDs to only those who ordered from given neighborhoods
  async function applyNeighborhoodFilter(ids: number[] | null): Promise<number[] | undefined> {
    if (!neighborhoodFilter || neighborhoodFilter.length === 0) {
      return ids === null ? undefined : ids; // null means "all"
    }
    const neighborhoodConditions = neighborhoodFilter.map((n) =>
      like(orders.deliveryAddress, `%${n}%`)
    );
    const rows = await db!
      .selectDistinct({ userId: orders.userId })
      .from(orders)
      .where(or(...neighborhoodConditions));
    const neighborhoodUserIds = rows
      .map((r: { userId: number | null }) => r.userId)
      .filter(Boolean) as number[];
    if (ids === null) return neighborhoodUserIds; // "all" case — return only neighborhood users
    return ids.filter((id) => neighborhoodUserIds.includes(id));
  }

  if (segment === "all") {
    return applyNeighborhoodFilter(null);
  }

  if (segment === "club") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clubStatus as any, "active"));
    const ids = rows.map((r: { id: number }) => r.id);
    return applyNeighborhoodFilter(ids);
  }

  if (segment === "active") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const rows = await db
      .select({ userId: orders.userId })
      .from(orders)
      .where(gte(orders.createdAt, since))
      .groupBy(orders.userId);
    const ids = rows.map((r: { userId: number | null }) => r.userId).filter(Boolean) as number[];
    return applyNeighborhoodFilter(ids);
  }

  if (segment === "inactive") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const activeRows = await db
      .select({ userId: orders.userId })
      .from(orders)
      .where(gte(orders.createdAt, since))
      .groupBy(orders.userId);
    const activeIds = activeRows.map((r: { userId: number | null }) => r.userId).filter(Boolean) as number[];
    const allRows = await db.select({ id: users.id }).from(users);
    const allIds = allRows.map((r: { id: number }) => r.id);
    const inactiveIds = allIds.filter((id) => !activeIds.includes(id));
    return applyNeighborhoodFilter(inactiveIds);
  }

  return undefined;
}

/**
 * Get phone numbers filtered by audience segment and optional neighborhood filter.
 */
async function getPhonesBySegment(
  segment: string,
  neighborhoodFilter?: string[] | null
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const { users, orders } = await import("../drizzle/schema");
  const { gte, isNotNull, or, like } = await import("drizzle-orm");

  // Helper: filter phone rows by neighborhood
  async function applyNeighborhoodFilterToPhones(
    phoneRows: { phone: string | null; userId: number }[]
  ): Promise<string[]> {
    if (!neighborhoodFilter || neighborhoodFilter.length === 0) {
      return phoneRows.map((r) => r.phone).filter(Boolean) as string[];
    }
    const neighborhoodConditions = neighborhoodFilter.map((n) =>
      like(orders.deliveryAddress, `%${n}%`)
    );
    const rows = await db!
      .selectDistinct({ userId: orders.userId })
      .from(orders)
      .where(or(...neighborhoodConditions));
    const neighborhoodUserIds = new Set(
      rows.map((r: { userId: number | null }) => r.userId).filter(Boolean) as number[]
    );
    return phoneRows
      .filter((r) => neighborhoodUserIds.has(r.userId))
      .map((r) => r.phone)
      .filter(Boolean) as string[];
  }

  if (segment === "all") {
    const rows = await db
      .select({ phone: users.phone, userId: users.id })
      .from(users)
      .where(isNotNull(users.phone));
    return applyNeighborhoodFilterToPhones(rows as { phone: string | null; userId: number }[]);
  }

  if (segment === "active") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const allRows = await db
      .select({ phone: users.phone, userId: users.id })
      .from(users)
      .where(isNotNull(users.phone));
    const activeRows = await db
      .select({ userId: orders.userId })
      .from(orders)
      .where(gte(orders.createdAt, since))
      .groupBy(orders.userId);
    const activeIds = new Set(
      activeRows.map((r: { userId: number | null }) => r.userId).filter(Boolean) as number[]
    );
    const activePhones = (allRows as { phone: string | null; userId: number }[]).filter(
      (r) => activeIds.has(r.userId)
    );
    return applyNeighborhoodFilterToPhones(activePhones);
  }

  // For inactive and club, fall back to all phones with neighborhood filter
  const rows = await db
    .select({ phone: users.phone, userId: users.id })
    .from(users)
    .where(isNotNull(users.phone));
  return applyNeighborhoodFilterToPhones(rows as { phone: string | null; userId: number }[]);
}

/**
 * Processes pending scheduled notifications.
 * Called every minute by the background job in server/_core/index.ts.
 */
export async function processScheduledNotifications(): Promise<void> {
  const pending = await getPendingScheduledNotifications();
  if (pending.length === 0) return;

  for (const notification of pending) {
    try {
      let sentCount = 0;

      // Parse neighborhood filter
      const neighborhoodFilter: string[] | null = notification.neighborhoodFilter
        ? JSON.parse(notification.neighborhoodFilter)
        : null;

      // Send push notifications
      if (notification.channel === "push" || notification.channel === "both") {
        const userIds = await getUserIdsBySegment(notification.targetAudience, neighborhoodFilter);
        const result = await sendPushToAllUsers(
          {
            title: notification.title,
            body: notification.message,
            url: "/",
            tag: `scheduled-${notification.id}`,
          },
          userIds
        );
        sentCount += result.sent;
      }

      // Send WhatsApp notifications
      if (notification.channel === "whatsapp" || notification.channel === "both") {
        const phones = await getPhonesBySegment(notification.targetAudience, neighborhoodFilter);
        for (const phone of phones) {
          try {
            await sendWhatsApp(phone, `*${notification.title}*\n\n${notification.message}`);
            sentCount++;
          } catch {
            // Ignore individual WhatsApp send errors
          }
        }
      }

      // Mark as sent
      await markScheduledNotificationSent(notification.id, sentCount);

      // Handle recurrence: schedule next occurrence
      if (notification.recurrence === "daily") {
        const nextDate = new Date(notification.scheduledAt);
        nextDate.setDate(nextDate.getDate() + 1);
        await createScheduledNotification({
          title: notification.title,
          message: notification.message,
          channel: notification.channel,
          targetAudience: notification.targetAudience,
          scheduledAt: nextDate,
          recurrence: "daily",
          neighborhoodFilter: notification.neighborhoodFilter,
          status: "pending",
          sentCount: 0,
          createdBy: notification.createdBy,
        });
      } else if (notification.recurrence === "weekly") {
        const nextDate = new Date(notification.scheduledAt);
        nextDate.setDate(nextDate.getDate() + 7);
        await createScheduledNotification({
          title: notification.title,
          message: notification.message,
          channel: notification.channel,
          targetAudience: notification.targetAudience,
          scheduledAt: nextDate,
          recurrence: "weekly",
          neighborhoodFilter: notification.neighborhoodFilter,
          status: "pending",
          sentCount: 0,
          createdBy: notification.createdBy,
        });
      }

      const neighborhoodInfo =
        neighborhoodFilter && neighborhoodFilter.length > 0
          ? ` [bairros: ${neighborhoodFilter.join(", ")}]`
          : "";
      console.log(
        `[ScheduledNotifications] Sent #${notification.id}: "${notification.title}" (${sentCount} recipients)${neighborhoodInfo}`
      );
    } catch (err) {
      console.error(`[ScheduledNotifications] Error processing #${notification.id}:`, err);
    }
  }
}
