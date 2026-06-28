import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";

import { OrderChat } from "@/components/OrderChat";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  preparing: "Preparando",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export function MessagesTab({ initialOrderId }: { initialOrderId?: number | null }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const { data: conversations, isLoading, refetch } = trpc.chat.ordersWithMessages.useQuery(
    { storeId: selectedStoreId },
    { refetchInterval: 10000 },
  );
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const totalUnread = (conversations ?? []).reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  useEffect(() => {
    if (!initialOrderId || selectedOrderId) return;
    if (conversations?.some((conversation) => conversation.orderId === initialOrderId)) {
      setSelectedOrderId(initialOrderId);
    }
  }, [initialOrderId, conversations, selectedOrderId]);

  function handleSelectOrder(orderId: number) {
    setSelectedOrderId(orderId);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "messages");
      params.set("order", String(orderId));
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
    utils.chat.totalUnread.invalidate();
    utils.chat.ordersWithMessages.invalidate();
  }

  return (
    <div className="grid h-[calc(100vh-120px)] grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-[var(--admin-card-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-soft)]">
        <div className="border-b border-[var(--admin-card-border)] bg-[linear-gradient(135deg,rgba(146,0,0,0.08),rgba(146,0,0,0.02))] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#920000]/70">Central de atendimento</p>
              <h2 className="mt-1 text-lg font-extrabold" style={{ fontFamily: "'Inter', sans-serif", color: "var(--admin-text-heading)" }}>
                Mensagens
              </h2>
            </div>
            <button
              onClick={() => refetch()}
              className="rounded-full border border-[var(--admin-card-border)] bg-white/80 p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Atualizar conversas"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[var(--admin-card-border)] bg-white/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Conversas</p>
              <p className="mt-1 text-xl font-black text-[#1f1f1f]">{conversations?.length ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[var(--admin-card-border)] bg-white/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Não lidas</p>
              <p className="mt-1 text-xl font-black text-[#920000]">{totalUnread}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}
            </div>
          )}

          {!isLoading && (!conversations || conversations.length === 0) && (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageCircle className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhuma conversa ainda</p>
            </div>
          )}

          <div className="space-y-2">
            {conversations?.map((conversation) => (
              <button
                key={conversation.orderId}
                onClick={() => handleSelectOrder(conversation.orderId)}
                className={`w-full rounded-2xl border p-3 text-left transition-all ${
                  selectedOrderId === conversation.orderId
                    ? "border-[#920000]/50 bg-[linear-gradient(135deg,rgba(146,0,0,0.08),rgba(146,0,0,0.02))] shadow-sm"
                    : conversation.unreadCount > 0
                    ? "border-[#920000]/20 bg-[#fff7f7] hover:bg-[#fff1f1]"
                    : "border-border bg-white/70 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{conversation.customerName}</span>
                      {conversation.aiPaused && (
                        <span className="shrink-0 rounded-full bg-[#fce8e8] px-1.5 py-0.5 text-[10px] font-medium text-[#6E0D12]">Humano</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Pedido #{conversation.orderId} - {STATUS_LABELS[conversation.status] ?? conversation.status}
                    </p>
                    <p className="mt-1 truncate text-xs italic text-muted-foreground">
                      {conversation.lastMessage.length > 60 ? `${conversation.lastMessage.slice(0, 60)}...` : conversation.lastMessage}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(conversation.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {conversation.unreadCount > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[28px] border border-[var(--admin-card-border)] bg-card shadow-[var(--admin-shadow-soft)]">
        {selectedOrderId ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[var(--admin-card-border)] px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Conversa em andamento</p>
              <p className="mt-1 text-sm font-semibold text-[var(--admin-text-heading)]">Pedido #{selectedOrderId}</p>
            </div>
            <div className="min-h-0 flex-1">
              <OrderChat
                orderId={selectedOrderId}
                currentUserRole="admin"
                currentUserName={user?.name ?? "Admin"}
                currentUserAvatarUrl={user?.avatarUrl ?? undefined}
                inline
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="rounded-full bg-[#f7e8e8] p-4 text-[#920000]">
              <MessageCircle className="w-16 h-16 opacity-90" />
            </div>
            <p className="text-base font-medium">Selecione uma conversa</p>
            <p className="max-w-sm text-center text-sm opacity-70">Escolha um pedido na coluna ao lado para abrir o chat e acompanhar o atendimento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
