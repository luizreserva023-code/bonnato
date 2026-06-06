/**
 * Utilitário central de timezone para o projeto Bonatto Pizza.
 *
 * REGRA: Todos os timestamps são armazenados em UTC no banco de dados.
 * Para exibição ou filtros de "hoje", usa-se sempre America/Sao_Paulo.
 *
 * Não usa bibliotecas externas — apenas Intl nativo do Node.js/browser.
 */

export const TZ = "America/Sao_Paulo";

/**
 * Retorna o offset em minutos de America/Sao_Paulo em relação ao UTC
 * para um dado instante (considera horário de verão automaticamente).
 *
 * Exemplo: BRT = UTC-3 → retorna -180
 *          BRST = UTC-2 → retorna -120
 */
export function getBrasilOffsetMinutes(date: Date = new Date()): number {
  // Formata a data nos dois fusos e calcula a diferença
  const utcMs = date.getTime();

  // Obtém a data local em Sao_Paulo como string e reconstrói como UTC
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));

  return Math.round((localMs - utcMs) / 60_000);
}

/**
 * Retorna o offset em formato ±HH:MM para uso no CONVERT_TZ do MySQL.
 * Exemplo: "-03:00" ou "-02:00" (horário de verão)
 */
export function getBrasilTzOffset(date: Date = new Date()): string {
  const offsetMinutes = getBrasilOffsetMinutes(date);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/**
 * Retorna o início do dia de hoje (00:00:00.000) em America/Sao_Paulo,
 * convertido para UTC (para uso em queries WHERE createdAt >= todayStartUtc).
 */
export function getTodayStartUtc(date: Date = new Date()): Date {
  const offsetMinutes = getBrasilOffsetMinutes(date);

  // Data local em Sao_Paulo
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);

  // Meia-noite local em Sao_Paulo como UTC
  const midnightLocalMs = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0, 0);
  // Subtrair o offset para converter para UTC
  return new Date(midnightLocalMs - offsetMinutes * 60_000);
}

/**
 * Retorna o fim do dia de hoje (23:59:59.999) em America/Sao_Paulo,
 * convertido para UTC.
 */
export function getTodayEndUtc(date: Date = new Date()): Date {
  const start = getTodayStartUtc(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Retorna o início de N dias atrás (00:00:00.000 em Sao_Paulo → UTC).
 */
export function getNDaysAgoStartUtc(days: number, date: Date = new Date()): Date {
  const todayStart = getTodayStartUtc(date);
  return new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Formata uma data UTC para exibição no fuso America/Sao_Paulo.
 * Retorna string no formato "DD/MM/YYYY HH:mm".
 */
export function formatBrasil(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Retorna "hoje", "ontem" ou a data formatada em pt-BR (America/Sao_Paulo).
 */
export function formatRelativeDateBrasil(date: Date | string | number): string {
  const d = new Date(date);
  const todayStart = getTodayStartUtc();
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  if (d >= todayStart) return "hoje";
  if (d >= yesterdayStart) return "ontem";

  return d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}
