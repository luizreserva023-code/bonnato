import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Plus,
  Receipt,
  Sparkles,
  UserRound,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantConfig } from "@/shared/tenant/use-tenant-config";

const LOGO_URL = "/brand/bonatto-logo-driver.jpg";

type WaiterDraft = {
  productId: string;
  quantity: string;
  notes: string;
  tipAmount: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatSessionStatus(status: string) {
  const labels: Record<string, string> = {
    open: "Aberta",
    awaiting_closure: "Fechamento",
    closed: "Fechada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function formatItemStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    preparing: "Preparando",
    ready: "Pronto",
    served: "Entregue",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

function useSessionAlerts(sessions: Array<any>) {
  const previousRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};

    for (const session of sessions) {
      for (const item of session.items ?? []) {
        const key = `${session.id}:${item.id}`;
        next[key] = item.status;

        if (previousRef.current[key] && previousRef.current[key] !== item.status && item.status === "ready") {
          toast.success(`Mesa ${session.tableName}: ${item.productName} está pronto.`);
          navigator.vibrate?.([180, 80, 180]);
        }
      }
    }

    previousRef.current = next;
  }, [sessions]);
}

export default function WaiterApp() {
  const tenant = useTenantConfig();
  const [token, setToken] = useState(() => localStorage.getItem("waiterToken") ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [itemDrafts, setItemDrafts] = useState<Record<number, WaiterDraft>>({});
  const openSessionRef = useRef<HTMLDivElement | null>(null);
  const sessionsRef = useRef<HTMLDivElement | null>(null);

  const meQuery = trpc.waiters.me.useQuery({ token }, { enabled: !!token, retry: false });
  const tablesQuery = trpc.waiters.tables.useQuery({ token }, { enabled: !!token, refetchInterval: 15000 });
  const sessionsQuery = trpc.waiters.sessions.useQuery({ token }, { enabled: !!token, refetchInterval: 5000 });
  const menuQuery = trpc.waiters.menu.useQuery({ token }, { enabled: !!token, staleTime: 30000 });

  const openSession = trpc.waiters.openSession.useMutation({
    onSuccess: async () => {
      setTableId("");
      setCustomerName("");
      setGuestCount("2");
      await Promise.all([tablesQuery.refetch(), sessionsQuery.refetch()]);
      toast.success("Comanda aberta.");
    },
    onError: (error) => toast.error(error.message),
  });

  const addItem = trpc.waiters.addItem.useMutation({
    onSuccess: async (_, variables) => {
      setItemDrafts((current) => ({
        ...current,
        [variables.tableSessionId]: {
          productId: "",
          quantity: "1",
          notes: "",
          tipAmount: current[variables.tableSessionId]?.tipAmount ?? "0.00",
        },
      }));
      await sessionsQuery.refetch();
      toast.success("Item lancado na comanda.");
    },
    onError: (error) => toast.error(error.message),
  });

  const closeSession = trpc.waiters.closeSession.useMutation({
    onSuccess: async () => {
      await Promise.all([tablesQuery.refetch(), sessionsQuery.refetch()]);
      toast.success("Conta fechada com sucesso.");
    },
    onError: (error) => toast.error(error.message),
  });

  const sessions = (sessionsQuery.data ?? []) as any[];
  useSessionAlerts(sessions);
  const preferredSession = sessions.find((session) => session.waiterStaffId === meQuery.data?.id) ?? sessions[0] ?? null;

  const availableTables = useMemo(
    () => ((tablesQuery.data ?? []) as any[]).filter((table: any) => table.status === "free" || table.status === "reserved"),
    [tablesQuery.data],
  );

  function getDraft(sessionId: number): WaiterDraft {
    return itemDrafts[sessionId] ?? { productId: "", quantity: "1", notes: "", tipAmount: "0.00" };
  }

  function setDraft(sessionId: number, next: Partial<WaiterDraft>) {
    setItemDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...getDraft(sessionId),
        ...next,
      },
    }));
  }

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const next = tokenInput.trim();
    if (!next) return;
    localStorage.setItem("waiterToken", next);
    setToken(next);
  }

  function handleLogout() {
    localStorage.removeItem("waiterToken");
    setToken("");
    setTokenInput("");
  }

  function scrollToElement(target: HTMLElement | null) {
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleQuickOpenTable() {
    scrollToElement(openSessionRef.current);
  }

  function handleQuickLaunchItem() {
    if (!preferredSession) {
      toast.info("Abra uma mesa primeiro para lançar itens.");
      scrollToElement(openSessionRef.current);
      return;
    }
    scrollToElement(document.getElementById(`waiter-session-${preferredSession.id}`));
  }

  function handleQuickCloseSession() {
    if (!preferredSession) {
      toast.info("Nenhuma comanda aberta para fechar agora.");
      return;
    }
    scrollToElement(document.getElementById(`waiter-close-${preferredSession.id}`));
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#140305] p-5 text-white flex items-center justify-center">
        <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#25070b] p-6 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <img src={tenant.brand.logos.waiter || LOGO_URL} alt={tenant.brand.shortName} className="h-12 w-12 rounded-full border border-white/20 object-cover" />
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/60">Garçom</p>
              <h1 className="text-2xl font-black">Acesso do salão</h1>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">Token de acesso</Label>
              <Input
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                aria-label="Token de acesso do garçom"
                placeholder="Cole o token do garçom"
                className="border-white/10 bg-black/20 text-white"
              />
            </div>
            <Button type="submit" className="w-full bg-[#8B1018] hover:bg-[#a21520]">
              Entrar no app
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#140305] text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <div className="min-h-screen bg-[#140305] p-5 text-white flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded-[28px] border border-red-500/30 bg-[#25070b] p-6 text-center">
          <p className="text-lg font-bold">Token inválido</p>
          <p className="text-sm text-white/60">Peça um novo token ao administrador da loja.</p>
          <Button onClick={handleLogout} variant="outline" className="w-full border-white/15 bg-transparent text-white">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mx-auto max-w-md bg-[#0f0204] text-white">
      <div className="bg-gradient-to-b from-[#6E0D12] to-[#43080b] px-4 pb-6 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={tenant.brand.logos.waiter || LOGO_URL} alt={tenant.brand.shortName} className="h-11 w-11 rounded-full border-2 border-white/25 object-cover" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/60">Salão {tenant.brand.shortName}</p>
              <h1 className="text-xl font-black">{meQuery.data.name}</h1>
              <p className="text-sm text-white/60">Garçom em operação</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={handleLogout} className="text-white hover:bg-white/10">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <UtensilsCrossed className="mx-auto mb-1 h-4 w-4 text-white/80" />
            <p className="text-xl font-black">{sessions.length}</p>
            <p className="text-[11px] text-white/60">Comandas</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <Receipt className="mx-auto mb-1 h-4 w-4 text-white/80" />
            <p className="text-xl font-black">{sessions.reduce((sum, session) => sum + Number(session.itemCount ?? 0), 0)}</p>
            <p className="text-[11px] text-white/60">Itens</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <Wallet className="mx-auto mb-1 h-4 w-4 text-emerald-300" />
            <p className="text-lg font-black text-emerald-300">
              {formatCurrency(sessions.reduce((sum, session) => sum + Number(session.computedTotal ?? session.total ?? 0), 0))}
            </p>
            <p className="text-[11px] text-white/60">Em aberto</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 pb-28">
        <div ref={openSessionRef} className="space-y-3 rounded-[24px] border border-white/10 bg-[#1d0609] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#ff7777]" />
            <h2 className="font-bold">Abrir nova comanda</h2>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">Mesa</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger aria-label="Selecionar mesa" className="border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Selecione a mesa" />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map((table: any) => (
                  <SelectItem key={table.id} value={String(table.id)}>
                    {table.name} - {table.capacity} lugares
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableTables.length === 0 && (
              <p className="text-xs text-white/55">
                Não há mesas livres agora. Se existir uma comanda aberta sem responsável, ela aparecerá logo abaixo.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-white/70">Cliente</Label>
              <Input aria-label="Nome do cliente da mesa" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="border-white/10 bg-black/20 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Pessoas</Label>
              <Input aria-label="Quantidade de pessoas na mesa" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} className="border-white/10 bg-black/20 text-white" />
            </div>
          </div>

          <Button
            className="w-full bg-[#8B1018] hover:bg-[#a21520]"
            disabled={openSession.isPending || !tableId}
            onClick={() =>
              openSession.mutate({
                token,
                tableId: Number(tableId),
                customerName: customerName || undefined,
                guestCount: Number(guestCount || 1),
              })
            }
          >
            {openSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Abrir comanda
          </Button>
        </div>

        <div ref={sessionsRef} className="space-y-3">
          {sessions.map((session) => {
            const draft = getDraft(session.id);
            const isOwner = session.waiterStaffId === meQuery.data.id;

            return (
              <div id={`waiter-session-${session.id}`} key={session.id} className="space-y-4 rounded-[24px] border border-white/10 bg-[#1d0609] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{session.tableName}</p>
                    <p className="text-sm text-white/60">
                      {session.customerName || "Sem nome"} - {session.guestCount} pessoa(s)
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {isOwner ? "Responsável: você" : "Comanda sem responsável definido"}
                    </p>
                  </div>
                  <Badge className="border-0 bg-white/10 text-white">{formatSessionStatus(session.status)}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-[11px] text-white/55">Consumo</p>
                    <p className="font-bold">{formatCurrency(Number(session.computedTotal ?? session.total ?? 0))}</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-[11px] text-white/55">Itens</p>
                    <p className="font-bold">{session.itemCount ?? 0}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-white/70">Produto</Label>
                    <Select value={draft.productId} onValueChange={(value) => setDraft(session.id, { productId: value })}>
                      <SelectTrigger aria-label={`Selecionar produto da comanda ${session.id}`} className="border-white/10 bg-black/20 text-white">
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {((menuQuery.data ?? []) as any[]).map((product: any) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name} - {formatCurrency(Number(product.price))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-white/70">Quantidade</Label>
                      <Input aria-label={`Quantidade do item da comanda ${session.id}`} value={draft.quantity} onChange={(event) => setDraft(session.id, { quantity: event.target.value })} className="border-white/10 bg-black/20 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70">Gorjeta</Label>
                      <Input aria-label={`Gorjeta da comanda ${session.id}`} value={draft.tipAmount} onChange={(event) => setDraft(session.id, { tipAmount: event.target.value })} className="border-white/10 bg-black/20 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/70">Observação</Label>
                    <Input
                      value={draft.notes}
                      onChange={(event) => setDraft(session.id, { notes: event.target.value })}
                      aria-label={`Observações do item da comanda ${session.id}`}
                      className="border-white/10 bg-black/20 text-white"
                      placeholder="Sem cebola, dividir..."
                    />
                  </div>

                  <Button
                    className="w-full bg-white text-[#6E0D12] hover:bg-white/90"
                    disabled={addItem.isPending || !draft.productId}
                    onClick={() =>
                      addItem.mutate({
                        token,
                        tableSessionId: session.id,
                        productId: Number(draft.productId),
                        quantity: Number(draft.quantity || 1),
                        notes: draft.notes || undefined,
                      })
                    }
                  >
                    Lançar pedido da mesa
                  </Button>
                </div>

                <div className="space-y-2">
                  {(session.items ?? []).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 p-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {item.productName} - {item.quantity}x
                        </p>
                        <p className="text-xs text-white/55">
                          {new Date(item.requestedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {item.readyAt
                            ? ` - pronto ${new Date(item.readyAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="mb-1 border-0 bg-white/10 text-white">{formatItemStatus(item.status)}</Badge>
                        <p className="text-sm font-bold">{formatCurrency(Number(item.lineTotal ?? 0))}</p>
                      </div>
                    </div>
                  ))}
                  {(session.items ?? []).length === 0 && (
                    <p className="text-sm text-white/55">Nenhum item lançado nesta comanda ainda.</p>
                  )}
                </div>

                <Button
                  id={`waiter-close-${session.id}`}
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                  disabled={closeSession.isPending}
                  onClick={() => closeSession.mutate({ token, id: session.id, tipAmount: draft.tipAmount || "0.00" })}
                >
                  {closeSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Fechar conta e apresentar comanda
                </Button>
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-[#1d0609] p-6 text-center">
              <UserRound className="mx-auto mb-2 h-8 w-8 text-white/35" />
              <p className="font-semibold">Nenhuma comanda em aberto agora</p>
              <p className="mt-1 text-sm text-white/55">Abra uma mesa para começar a lançar os pedidos do salão.</p>
            </div>
          )}
        </div>

        <Link href="/admin">
          <Button variant="outline" className="w-full border-white/10 bg-transparent text-white">
            Voltar ao admin
          </Button>
        </Link>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#120305]/95 p-3 backdrop-blur md:left-1/2 md:max-w-md md:-translate-x-1/2">
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={handleQuickOpenTable}>
            Abrir mesa
          </Button>
          <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={handleQuickLaunchItem}>
            Lançar item
          </Button>
          <Button type="button" className="bg-[#8B1018] hover:bg-[#a21520]" onClick={handleQuickCloseSession}>
            Fechar conta
          </Button>
        </div>
      </div>
    </div>
  );
}
