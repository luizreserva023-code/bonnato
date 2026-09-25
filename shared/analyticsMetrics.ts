export function safePercentage(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function calculateAverageTicket(revenue: number, orderCount: number): number {
  if (!Number.isFinite(revenue) || !Number.isFinite(orderCount) || orderCount <= 0) return 0;
  return revenue / orderCount;
}

export function calculatePeriodVariation(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildSequentialFunnelCounts<T extends string>(
  orderedStages: readonly T[],
  events: readonly { sessionKey: string; eventType: T }[],
): Map<T, number> {
  const progressBySession = new Map<string, number>();

  for (const event of events) {
    const progress = progressBySession.get(event.sessionKey) ?? 0;
    if (progress >= orderedStages.length) continue;
    if (event.eventType === orderedStages[progress]) {
      progressBySession.set(event.sessionKey, progress + 1);
    }
  }

  const counts = new Map<T, number>(orderedStages.map((stage) => [stage, 0]));
  for (const reachedStages of progressBySession.values()) {
    for (let index = 0; index < reachedStages; index += 1) {
      const stage = orderedStages[index];
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildFunnelSeries<T extends string>(
  orderedStages: readonly T[],
  counts: ReadonlyMap<T, number>,
): Array<{ eventType: T; value: number; rate: number }> {
  const top = counts.get(orderedStages[0]) ?? 0;
  return orderedStages.map((eventType) => {
    const value = counts.get(eventType) ?? 0;
    return { eventType, value, rate: safePercentage(value, top) };
  });
}

export function rankProductsBySales<T extends { soldQuantity: number; revenue: number; views: number }>(
  rows: readonly T[],
  direction: "best" | "worst",
): T[] {
  const copy = [...rows];
  if (direction === "best") {
    return copy.sort((a, b) =>
      b.soldQuantity - a.soldQuantity ||
      b.revenue - a.revenue ||
      b.views - a.views
    );
  }
  // "Menos vendidos" mantém o contexto de exposição: entre produtos com a
  // mesma quantidade vendida, o que recebeu mais visualizações aparece antes.
  return copy.sort((a, b) =>
    a.soldQuantity - b.soldQuantity ||
    b.views - a.views ||
    a.revenue - b.revenue
  );
}
