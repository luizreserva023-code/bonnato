import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LockKeyhole,
  PackageCheck,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPage, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { useAdminStore } from "@/contexts/AdminStoreContext";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type IfoodStatus = RouterOutputs["integrations"]["ifood"]["status"];
type IfoodOrder = RouterOutputs["integrations"]["ifood"]["orders"][number];
type IfoodOrderStatus = IfoodOrder["status"];

const STATUS_COPY: Record<IfoodStatus["status"], { label: string; className: string }> = {
  disconnected: { label: "Não conectado", className: "border-slate-200 bg-slate-100 text-slate-700" },
  connecting: { label: "Conectando", className: "border-amber-200 bg-amber-50 text-amber-700" },
  connected: { label: "Conectado", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  error: { label: "Erro", className: "border-red-200 bg-red-50 text-red-700" },
};

const ORDER_STATUS_COPY: Record<IfoodOrderStatus, { label: string; className: string }> = {
  novo: { label: "Novo", className: "border-blue-200 bg-blue-50 text-blue-700" },
  confirmado: { label: "Confirmado", className: "border-amber-200 bg-amber-50 text-amber-700" },
  em_preparo: { label: "Em preparo", className: "border-orange-200 bg-orange-50 text-orange-700" },
  saiu_para_entrega: { label: "Saiu para entrega", className: "border-purple-200 bg-purple-50 text-purple-700" },
  concluido: { label: "Concluído", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelado: { label: "Cancelado", className: "border-red-200 bg-red-50 text-red-700" },
};

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Ainda não conectado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPayloadItems(order: IfoodOrder) {
  const items = order.payload.items;
  return Array.isArray(items) ? items : [];
}

function getDeliveryAddress(order: IfoodOrder) {
  const delivery = order.payload.delivery as { address?: string; complement?: string } | undefined;
  return [delivery?.address, delivery?.complement].filter(Boolean).join(" • ") || "Endereço simulado não informado";
}

function getPaymentMethod(order: IfoodOrder) {
  const payment = order.payload.payment as { method?: string } | undefined;
  return payment?.method ?? "Pagamento simulado";
}

function IntegrationWizard({
  open,
  step,
  status,
  connecting,
  onClose,
  onStep,
  onConnect,
  onGenerateOrder,
  onShowOrders,
}: {
  open: boolean;
  step: 1 | 2 | 3;
  status?: IfoodStatus;
  connecting: boolean;
  onClose: () => void;
  onStep: (step: 1 | 2 | 3) => void;
  onConnect: () => void;
  onGenerateOrder: () => void;
  onShowOrders: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f151b]">Conexão segura</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">iFood para Bonatto</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={`h-2 rounded-full ${item <= step ? "bg-[#8f151b]" : "bg-slate-100"}`}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-black text-slate-950">Conectar sua loja iFood</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Para conectar sua loja, você não precisa informar sua senha do iFood. A autorização deve ser feita de
                  forma segura pelo Portal do Parceiro iFood. Assim, o sistema poderá receber pedidos e atualizar status
                  sem acessar suas credenciais pessoais.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Não pedimos sua senha do iFood",
                  "A autorização é feita pelo ambiente oficial do iFood",
                  "Você poderá desconectar quando quiser",
                  "Cada loja será vinculada a uma loja iFood específica",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                Nunca informe sua senha do iFood neste sistema. A conexão oficial será feita por autorização segura no
                Portal do Parceiro iFood.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-black text-slate-950">Autorizar integração</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  No ambiente real, você seria direcionado para o Portal do Parceiro iFood para autorizar este sistema.
                  Nesta versão, vamos simular essa autorização para você testar o fluxo.
                </p>
              </div>
              <div className="rounded-[24px] border border-dashed border-[#8f151b]/40 bg-[#fff7f7] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f151b]">Código de conexão</p>
                <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">IFOOD-TEST-1234</p>
                <p className="mt-2 text-sm text-slate-600">Código mock apenas para validar a experiência de autorização.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-950">iFood conectado com sucesso</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Sua loja foi conectada em modo simulado. Agora você já pode testar o recebimento de pedidos e o
                    gerenciamento de status dentro do sistema.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Status" value="Conectado" />
                <InfoRow label="Modo" value="Simulado" />
                <InfoRow label="Loja iFood" value={status?.merchantName ?? "Restaurante iFood Simulado"} />
                <InfoRow label="Merchant ID" value={status?.merchantId ?? "mock-merchant-001"} />
                <InfoRow label="Última conexão" value={dateTime(status?.lastConnectedAt)} wide />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => onStep(2)}>Continuar</Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => onStep(1)}>Voltar</Button>
              <Button onClick={onConnect} disabled={connecting}>
                {connecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                {connecting ? "Autorizando..." : "Simular autorização segura"}
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={onGenerateOrder}>Gerar pedido teste</Button>
              <Button variant="outline" onClick={onShowOrders}>Ir para pedidos iFood</Button>
              <Button onClick={onClose}>Fechar</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50 p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function OrderActions({
  order,
  loading,
  onAction,
}: {
  order: IfoodOrder;
  loading: boolean;
  onAction: (action: "confirm" | "startPreparation" | "dispatch" | "conclude" | "cancel") => void;
}) {
  type OrderActionButton = {
    action: "confirm" | "startPreparation" | "dispatch" | "conclude" | "cancel";
    label: string;
    variant?: "outline";
  };

  const buttons = useMemo<OrderActionButton[]>(() => {
    if (order.status === "novo") return [
      { action: "confirm" as const, label: "Confirmar" },
      { action: "cancel" as const, label: "Cancelar", variant: "outline" as const },
    ];
    if (order.status === "confirmado") return [
      { action: "startPreparation" as const, label: "Iniciar preparo" },
      { action: "cancel" as const, label: "Cancelar", variant: "outline" as const },
    ];
    if (order.status === "em_preparo") return [
      { action: "dispatch" as const, label: "Despachar" },
      { action: "cancel" as const, label: "Cancelar", variant: "outline" as const },
    ];
    if (order.status === "saiu_para_entrega") return [
      { action: "conclude" as const, label: "Concluir" },
    ];
    return [];
  }, [order.status]);

  if (!buttons.length) {
    return <p className="text-xs font-medium text-slate-500">Pedido finalizado sem ações pendentes.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((button) => (
        <Button
          key={button.action}
          size="sm"
          variant={button.variant ?? "default"}
          disabled={loading}
          onClick={() => onAction(button.action)}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
}

export function MarketplacesTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId, selectedStoreName } = useAdminStore();
  const queryInput = { storeId: selectedStoreId };
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [showOrders, setShowOrders] = useState(true);

  const statusQuery = trpc.integrations.ifood.status.useQuery(queryInput);
  const ordersQuery = trpc.integrations.ifood.orders.useQuery(queryInput);
  const logsQuery = trpc.integrations.ifood.logs.useQuery(queryInput);

  const invalidateIfood = async () => {
    await Promise.all([
      utils.integrations.ifood.status.invalidate(queryInput),
      utils.integrations.ifood.orders.invalidate(queryInput),
      utils.integrations.ifood.logs.invalidate(queryInput),
    ]);
  };

  const connect = trpc.integrations.ifood.connect.useMutation({
    onSuccess: async () => {
      await invalidateIfood();
      setWizardStep(3);
      toast.success("iFood conectado em modo simulado.");
    },
    onError: (error) => toast.error(error.message),
  });

  const disconnect = trpc.integrations.ifood.disconnect.useMutation({
    onSuccess: async () => {
      await invalidateIfood();
      toast.success("Integração iFood desconectada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const generateOrder = trpc.integrations.ifood.generateTestOrder.useMutation({
    onSuccess: async () => {
      await invalidateIfood();
      setShowOrders(true);
      toast.success("Pedido teste iFood gerado.");
    },
    onError: (error) => toast.error(error.message),
  });

  const confirmOrder = trpc.integrations.ifood.confirmOrder.useMutation({ onSuccess: invalidateIfood, onError: (e) => toast.error(e.message) });
  const startPreparation = trpc.integrations.ifood.startPreparation.useMutation({ onSuccess: invalidateIfood, onError: (e) => toast.error(e.message) });
  const dispatch = trpc.integrations.ifood.dispatch.useMutation({ onSuccess: invalidateIfood, onError: (e) => toast.error(e.message) });
  const conclude = trpc.integrations.ifood.conclude.useMutation({ onSuccess: invalidateIfood, onError: (e) => toast.error(e.message) });
  const cancel = trpc.integrations.ifood.cancel.useMutation({ onSuccess: invalidateIfood, onError: (e) => toast.error(e.message) });

  const status = statusQuery.data;
  const statusMeta = STATUS_COPY[status?.status ?? "disconnected"];
  const orders = ordersQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const connected = status?.status === "connected";
  const marketplaceRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const integrationsWithError = status?.status === "error" ? 1 : 0;
  const statusActionLabel = connected ? "Gerenciar integração" : status?.status === "error" ? "Verificar conexão" : "Conectar iFood";
  const pendingMutation =
    confirmOrder.isPending || startPreparation.isPending || dispatch.isPending || conclude.isPending || cancel.isPending;

  function handlePrimaryAction() {
    setWizardOpen(true);
    setWizardStep(connected ? 3 : 1);
  }

  function handleOrderAction(order: IfoodOrder, action: "confirm" | "startPreparation" | "dispatch" | "conclude" | "cancel") {
    if (action === "cancel" && !window.confirm(`Cancelar o pedido iFood #${order.displayId}?`)) return;
    const input = { id: order.id, storeId: selectedStoreId };
    if (action === "confirm") confirmOrder.mutate(input);
    if (action === "startPreparation") startPreparation.mutate(input);
    if (action === "dispatch") dispatch.mutate(input);
    if (action === "conclude") conclude.mutate(input);
    if (action === "cancel") cancel.mutate(input);
  }

  const integrationCards = [
    {
      name: "iFood",
      description: "Receba, acompanhe e gerencie pedidos do iFood diretamente pelo sistema.",
      status: connected ? "Conectado" : "Modo simulado",
      tone: connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-purple-200 bg-purple-50 text-purple-700",
      orders: orders.length,
      revenue: marketplaceRevenue,
    },
    { name: "WhatsApp", description: "Conversas e pedidos manuais vindos do atendimento.", status: "Não configurado", tone: "border-slate-200 bg-slate-100 text-slate-700", orders: 0, revenue: 0 },
    { name: "App próprio", description: "Pedidos feitos pelo aplicativo/webapp Bonatto.", status: "Ativo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", orders: 0, revenue: 0 },
    { name: "Site próprio", description: "Pedidos diretos via domínio e cardápio online.", status: "Ativo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", orders: 0, revenue: 0 },
    { name: "Balcão/manual", description: "Pedidos criados por operador, salão ou telefone.", status: "Em breve", tone: "border-amber-200 bg-amber-50 text-amber-700", orders: 0, revenue: 0 },
  ];

  if (statusQuery.isLoading) {
    return (
      <AdminPage className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="max-w-7xl space-y-5">
      <AdminTopbar
        title="Marketplaces e Integrações"
        subtitle="Centralize seus canais de venda e acompanhe tudo em uma única operação."
        onRefresh={() => {
          void statusQuery.refetch();
          void ordersQuery.refetch();
          void logsQuery.refetch();
        }}
        refreshing={statusQuery.isRefetching || ordersQuery.isRefetching || logsQuery.isRefetching}
        actions={
          <Badge className="border border-[#f2caca] bg-[#fff7f7] text-[#8f151b]">
            Loja: {selectedStoreName}
          </Badge>
        }
      />

      <AdminStatGrid>
        <AdminStat label="Canais conectados" value={connected ? 3 : 2} icon={<PlugZap className="h-4 w-4" />} sub="App e site já ativos" />
        <AdminStat label="Pedidos de marketplaces" value={orders.length} icon={<PackageCheck className="h-4 w-4" />} sub="iFood em modo simulado" />
        <AdminStat label="Receita marketplaces" value={brl(marketplaceRevenue)} icon={<ShieldCheck className="h-4 w-4" />} sub="Somente pedidos simulados" />
        <AdminStat label="Última sincronização" value={dateTime(status?.lastSyncAt ?? status?.lastConnectedAt)} icon={<Clock3 className="h-4 w-4" />} sub={`${integrationsWithError} integração com erro`} />
      </AdminStatGrid>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {integrationCards.map((card) => (
          <div key={card.name} className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-slate-950">{card.name}</h3>
              <Badge className={`border ${card.tone}`}>{card.status}</Badge>
            </div>
            <p className="mt-2 min-h-[44px] text-xs leading-5 text-slate-500">{card.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="font-black text-slate-950">{card.orders}</p>
                <p className="text-slate-500">Pedidos</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="font-black text-slate-950">{brl(card.revenue)}</p>
                <p className="text-slate-500">Receita</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-4">
          <AdminSurface
            title="iFood"
            subtitle="Receba e gerencie pedidos do iFood diretamente pelo sistema."
            actions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge className={`border ${statusMeta.className}`}>{statusMeta.label}</Badge>
                <Badge className="border border-purple-200 bg-purple-50 text-purple-700">Modo simulado</Badge>
              </div>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="relative overflow-hidden rounded-[28px] bg-[#ea1d2c] p-5 text-white shadow-[0_22px_60px_rgba(234,29,44,0.28)]">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Canal externo</p>
                  <p className="mt-8 text-4xl font-black tracking-tight">iFood</p>
                  <p className="mt-2 text-sm text-white/85">Autorização segura pelo Portal do Parceiro.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>
                      Nunca informe sua senha do iFood neste sistema. A conexão oficial será feita por autorização segura
                      no Portal do Parceiro iFood.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Status" value={statusMeta.label} />
                  <InfoRow label="Modo" value="Simulado" />
                  <InfoRow label="Pedidos iFood" value={String(orders.length)} />
                  <InfoRow label="Receita iFood" value={brl(marketplaceRevenue)} />
                  <InfoRow label="Loja iFood" value={status?.merchantName ?? "Não vinculada"} />
                  <InfoRow label="Merchant ID" value={status?.merchantId ?? "Aguardando conexão"} />
                  <InfoRow label="Última sincronização" value={dateTime(status?.lastSyncAt ?? status?.lastConnectedAt)} wide />
                  {status?.lastError && <InfoRow label="Último erro" value={status.lastError} wide />}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handlePrimaryAction}>
                    <PlugZap className="h-4 w-4" />
                    {statusActionLabel}
                  </Button>
                  {connected && (
                    <>
                      <Button
                        variant="outline"
                        disabled={generateOrder.isPending}
                        onClick={() => generateOrder.mutate(queryInput)}
                      >
                        {generateOrder.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                        Gerar pedido teste
                      </Button>
                      <Button variant="outline" onClick={() => setShowOrders((value) => !value)}>
                        Ver pedidos iFood
                      </Button>
                      <Button
                        variant="outline"
                        disabled={disconnect.isPending}
                        onClick={() => {
                          if (window.confirm("Desconectar o iFood desta loja? O histórico será mantido.")) {
                            disconnect.mutate(queryInput);
                          }
                        }}
                      >
                        Desconectar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </AdminSurface>

          <AdminSurface title="Como conectar sua loja no ambiente real" subtitle="Fluxo futuro preparado para OAuth/API oficial.">
            <ol className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              {[
                "O restaurante acessa a aba Integrações.",
                "Clica em Conectar iFood.",
                "É direcionado ao Portal do Parceiro iFood.",
                "Autoriza o aplicativo.",
                "O sistema vincula a loja iFood à loja cadastrada no painel.",
                "A partir disso, os pedidos passam a aparecer automaticamente no sistema.",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#8f151b] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </AdminSurface>

          {showOrders && (
            <AdminSurface
              title="Pedidos iFood simulados"
              subtitle="Lista operacional com status, itens, entrega, pagamento e ações por etapa."
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!connected || generateOrder.isPending}
                  onClick={() => generateOrder.mutate(queryInput)}
                >
                  Gerar pedido teste
                </Button>
              }
            >
              {ordersQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <Truck className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 font-bold text-slate-950">Nenhum pedido iFood simulado ainda</p>
                  <p className="mt-1 text-sm text-slate-500">Conecte o iFood e gere um pedido teste para validar o fluxo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const statusStyle = ORDER_STATUS_COPY[order.status];
                    return (
                      <div key={order.id} className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-black text-slate-950">#{order.displayId}</p>
                              <Badge className={`border ${statusStyle.className}`}>{statusStyle.label}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{order.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-[#8f151b]">{brl(order.totalAmount)}</p>
                            <p className="text-xs text-slate-500">{dateTime(order.createdAt)}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Itens</p>
                            <div className="mt-2 space-y-1 text-sm text-slate-700">
                              {getPayloadItems(order).map((item, index) => {
                                const typedItem = item as { quantity?: number; name?: string; options?: string[] };
                                return (
                                  <p key={`${order.id}-${index}`}>
                                    {typedItem.quantity ?? 1}x {typedItem.name ?? "Item iFood"}
                                    {typedItem.options?.length ? (
                                      <span className="block text-xs text-slate-500">{typedItem.options.join(", ")}</span>
                                    ) : null}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Entrega</p>
                            <p className="mt-2 text-sm text-slate-700">{getDeliveryAddress(order)}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Pagamento</p>
                            <p className="mt-2 text-sm text-slate-700">{getPaymentMethod(order)}</p>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <OrderActions order={order} loading={pendingMutation} onAction={(action) => handleOrderAction(order, action)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminSurface>
          )}
        </div>

        <div className="space-y-4">
          <AdminSurface title="Checklist de segurança" subtitle="O que já fica protegido desde o mock.">
            <div className="space-y-3 text-sm">
              {[
                "Não pede e-mail ou senha do iFood.",
                "Não expõe clientSecret, token ou credenciais no frontend.",
                "Fluxo modelado como autorização, não como login falso.",
                "Sem scraping e sem chamada real à API iFood neste modo.",
                "Pronto para trocar MockIfoodProvider por ProductionIfoodProvider.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </AdminSurface>

          <AdminSurface title="Logs da integração" subtitle="Histórico operacional por loja.">
            {logsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Store className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Sem logs ainda</p>
              </div>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-950">{log.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{log.action}</span>
                      <span>•</span>
                      <span>{dateTime(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminSurface>

          <AdminSurface title="Ambiente real" subtitle="Preparação para produção futura.">
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                O `ProductionIfoodProvider` já existe como placeholder seguro. Quando houver app aprovado, clientId,
                clientSecret e merchantId real, a troca acontece no backend com `IFOOD_MODE=production`.
              </p>
              <Button asChild variant="outline" className="w-full">
                <a href="https://developer.ifood.com.br/" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Portal oficial iFood
                </a>
              </Button>
            </div>
          </AdminSurface>
        </div>
      </div>

      <IntegrationWizard
        open={wizardOpen}
        step={wizardStep}
        status={status}
        connecting={connect.isPending}
        onClose={() => setWizardOpen(false)}
        onStep={setWizardStep}
        onConnect={() => connect.mutate(queryInput)}
        onGenerateOrder={() => generateOrder.mutate(queryInput)}
        onShowOrders={() => {
          setShowOrders(true);
          setWizardOpen(false);
        }}
      />
    </AdminPage>
  );
}
