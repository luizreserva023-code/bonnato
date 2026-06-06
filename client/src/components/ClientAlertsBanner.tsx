import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { X, Bell, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface AlertCardProps {
  alert: {
    id: number;
    type: string;
    title: string;
    message: string;
    icon: string | null;
    url: string | null;
    read: boolean;
    createdAt: Date;
  };
  onDismiss: (id: number) => void;
}

function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const dismissMutation = trpc.clientAlerts.dismiss.useMutation({
    onSuccess: () => {
      void utils.clientAlerts.list.invalidate();
      void utils.clientAlerts.unreadCount.invalidate();
    },
  });

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissMutation.mutate({ alertId: alert.id });
    onDismiss(alert.id);
  };

  const handleClick = () => {
    if (!alert.read) {
      dismissMutation.mutate({ alertId: alert.id });
    }
    if (alert.url) {
      setLocation(alert.url);
    }
  };

  const typeStyles: Record<string, { border: string; bg: string; title: string; text: string }> = {
    promotion: {
      border: "border-l-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      title: "text-orange-900 dark:text-orange-100",
      text: "text-orange-700 dark:text-orange-300",
    },
    raffle: {
      border: "border-l-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      title: "text-purple-900 dark:text-purple-100",
      text: "text-purple-700 dark:text-purple-300",
    },
    coupon: {
      border: "border-l-green-500",
      bg: "bg-green-50 dark:bg-green-950/40",
      title: "text-green-900 dark:text-green-100",
      text: "text-green-700 dark:text-green-300",
    },
    club: {
      border: "border-l-yellow-500",
      bg: "bg-yellow-50 dark:bg-yellow-950/40",
      title: "text-yellow-900 dark:text-yellow-100",
      text: "text-yellow-700 dark:text-yellow-300",
    },
    custom: {
      border: "border-l-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      title: "text-blue-900 dark:text-blue-100",
      text: "text-blue-700 dark:text-blue-300",
    },
  };

  const styles = typeStyles[alert.type] ?? {
    border: "border-l-gray-400",
    bg: "bg-gray-50 dark:bg-gray-800/40",
    title: "text-gray-900 dark:text-gray-100",
    text: "text-gray-600 dark:text-gray-400",
  };

  return (
    <div
      className={`relative flex items-start gap-3 p-3.5 rounded-xl border-l-4 cursor-pointer transition-all hover:brightness-95 active:scale-[0.99] ${styles.border} ${styles.bg} ${!alert.read ? "shadow-sm ring-1 ring-black/5" : "opacity-75"}`}
      onClick={handleClick}
    >
      {/* Ícone */}
      <span className="text-xl flex-shrink-0 mt-0.5 leading-none">{alert.icon ?? "🔔"}</span>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-semibold text-sm leading-tight ${styles.title}`}>{alert.title}</p>
          {!alert.read && (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          )}
        </div>
        <p className={`text-xs mt-1 leading-snug line-clamp-2 ${styles.text}`}>
          {alert.message.replace(/\*\*/g, "")}
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
        {alert.url && <ChevronRight className="w-4 h-4 text-gray-400" />}
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-full hover:bg-black/10 active:bg-black/20 transition-colors"
          title="Dispensar"
          aria-label="Dispensar alerta"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
    </div>
  );
}

interface ClientAlertsBannerProps {
  /** Número máximo de alertas a exibir (padrão: 3) */
  maxVisible?: number;
  /** Classe extra para o container */
  className?: string;
}

export function ClientAlertsBanner({ maxVisible = 3, className = "" }: ClientAlertsBannerProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const { data: alerts = [] } = trpc.clientAlerts.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000, // atualiza a cada 1 min
  });

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  const unread = visible.filter((a) => !a.read);

  if (!user || visible.length === 0) return null;

  const toShow = expanded ? visible : visible.slice(0, maxVisible);
  const hasMore = visible.length > maxVisible;

  const handleDismiss = (id: number) => {
    setDismissed((prev) => { const next = new Set(prev); next.add(id); return next; });
  };

  return (
    <div className={`mb-4 ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Novidades</span>
          {unread.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
              {unread.length}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {toShow.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
        ))}
      </div>

      {/* Ver mais / menos */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-center text-muted-foreground hover:text-foreground py-2 transition-colors mt-1"
        >
          {expanded ? "Ver menos ▲" : `Ver mais ${visible.length - maxVisible} alertas ▼`}
        </button>
      )}
    </div>
  );
}
