// ── Store hours & delivery zone utilities ──

export type DaySchedule = { open: string; close: string } | null; // null = fechado

// Horários de funcionamento padrão (fallback se o banco não tiver configuração)
// Formato: "HH:MM" (24h)
export const DEFAULT_STORE_HOURS: Record<number, DaySchedule> = {
  0: null,                              // Domingo — fechado
  1: { open: "18:00", close: "23:00" }, // Segunda
  2: { open: "18:00", close: "23:00" }, // Terça
  3: { open: "18:00", close: "23:00" }, // Quarta
  4: { open: "18:00", close: "23:00" }, // Quinta
  5: { open: "18:00", close: "23:30" }, // Sexta
  6: { open: "18:00", close: "23:30" }, // Sábado
};

// Alias para compatibilidade com código existente (StoreClosedBanner, etc.)
export const STORE_HOURS = DEFAULT_STORE_HOURS;

export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Retorna hora e dia da semana no timezone de Brasília (America/Sao_Paulo) */
export function getBrasiliaTime(): { day: number; totalMinutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const dayName = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() ?? '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  const dayMap: Record<string, number> = {
    'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3,
    'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6,
  };
  return { day: dayMap[dayName] ?? now.getDay(), totalMinutes: hour * 60 + minute };
}

/**
 * Verifica se a pizzaria está aberta agora com base nos horários fornecidos.
 * Se não forem fornecidos, usa os horários padrão (hardcoded).
 * Aceita tanto Record<number, ...> quanto Record<string, ...> (formato do banco).
 */
export function isStoreOpenWithHours(hours?: Record<string, DaySchedule | null>): boolean {
  const { day, totalMinutes } = getBrasiliaTime();
  const storeHours = hours ?? (DEFAULT_STORE_HOURS as Record<string, DaySchedule | null>);
  const schedule = storeHours[String(day)];
  if (!schedule) return false;
  const [openH, openM] = schedule.open.split(':').map(Number);
  const [closeH, closeM] = schedule.close.split(':').map(Number);
  return totalMinutes >= openH * 60 + openM && totalMinutes < closeH * 60 + closeM;
}

/** Retorna se a pizzaria está aberta agora (timezone: America/Sao_Paulo) — usa horários padrão */
export function isStoreOpen(): boolean {
  return isStoreOpenWithHours();
}

/**
 * Retorna o próximo horário de abertura como string legível.
 * Aceita horários dinâmicos do banco.
 */
export function nextOpenTimeWithHours(hours?: Record<string, DaySchedule | null>): string {
  const { day: today, totalMinutes: nowMinutes } = getBrasiliaTime();
  const storeHours = hours ?? (DEFAULT_STORE_HOURS as Record<string, DaySchedule | null>);
  for (let i = 0; i <= 7; i++) {
    const day = (today + i) % 7;
    const schedule = storeHours[String(day)];
    if (!schedule) continue;
    if (i === 0) {
      const [openH, openM] = schedule.open.split(':').map(Number);
      if (nowMinutes < openH * 60 + openM) {
        return `hoje às ${schedule.open}`;
      }
    } else {
      return `${DAY_NAMES[day]} às ${schedule.open}`;
    }
  }
  return 'em breve';
}

/** Retorna o próximo horário de abertura como string legível (timezone: America/Sao_Paulo) */
export function nextOpenTime(): string {
  return nextOpenTimeWithHours();
}

// CEP é apenas parte do endereço. Cobertura, taxa e prazo são calculados
// exclusivamente pelo backend a partir da rota entre a unidade e o destino.

/** Formata o CEP no padrão 00000-000 */
export function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "").substring(0, 8);
  if (clean.length > 5) return `${clean.substring(0, 5)}-${clean.substring(5)}`;
  return clean;
}
