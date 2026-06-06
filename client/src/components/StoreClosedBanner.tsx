import { Clock, AlertTriangle } from "lucide-react";
import { DEFAULT_STORE_HOURS, DAY_NAMES, nextOpenTimeWithHours, type DaySchedule } from "@/lib/storeUtils";

interface StoreClosedBannerProps {
  variant?: "banner" | "card";
  /** Horários dinâmicos do banco. Se não fornecido, usa os padrão. */
  storeHours?: Record<string, DaySchedule | null>;
}

export function StoreClosedBanner({ variant = "banner", storeHours }: StoreClosedBannerProps) {
  const openTime = nextOpenTimeWithHours(storeHours);
  const hours = storeHours ?? (DEFAULT_STORE_HOURS as Record<string, DaySchedule | null>);

  if (variant === "card") {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <p className="font-bold text-orange-800 text-sm">Estamos fechados no momento</p>
          <p className="text-orange-700 text-xs mt-0.5">
            Abrimos {openTime}. Você pode montar seu pedido agora e finalizar quando abrirmos!
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {Object.entries(hours).map(([day, schedule]) => (
              <div key={day} className="text-[10px] text-orange-700">
                <span className="font-semibold">{DAY_NAMES[parseInt(day)]?.substring(0, 3) ?? day}</span>:{" "}
                {schedule ? `${schedule.open}–${schedule.close}` : "Fechado"}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-500 text-white">
      <div className="container py-2.5 flex items-center gap-2 flex-wrap">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          Estamos fechados agora. Abrimos {openTime}.
        </span>
        <span className="text-orange-200 text-xs hidden sm:inline">
          Horário: {Object.entries(hours)
            .filter(([, s]) => s !== null)
            .map(([d, s]) => `${DAY_NAMES[parseInt(d)]?.substring(0, 3) ?? d} ${(s as DaySchedule)?.open}–${(s as DaySchedule)?.close}`)
            .join(' · ')}
        </span>
      </div>
    </div>
  );
}
