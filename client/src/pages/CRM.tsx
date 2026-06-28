import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Search,
  Tag,
  ShoppingBag,
  Clock,
  ChevronRight,
  X,
  Plus,
  Zap,
  RefreshCw,
  Crown,
  Star,
  Send,
  CheckCircle2,
  Hourglass,
  MessageSquare,
  Pencil,
  Trash2,
  Palette,
} from "lucide-react";
import { JoinedPagination } from "@/components/ui/joined-pagination";
import { AdminStoreProvider, useAdminStore } from "@/contexts/AdminStoreContext";
import type { AppRouter } from "../../../server/routers";

// ─── Tag helpers ─────────────────────────────────────────────────────────────

const TAG_LABELS: Record<string, string> = {
  novo: "Novo",
  recorrente: "Recorrente",
  indeciso: "Indeciso",
  inativo_15: "Inativo 15d",
  inativo_30: "Inativo 30d",
  inativo_60: "Inativo 60d",
};

const TAG_COLORS: Record<string, string> = {
  novo: "bg-[#fce8e8] text-[#6E0D12] border-[#f9d0d0]",
  recorrente: "bg-[#fdf5f5] text-[#5a0a0f] border-[#fce8e8]",
  indeciso: "bg-[#fce8e8]/60 text-[#7d0f14] border-[#f9d0d0]/60",
  inativo_15: "bg-[#f9d0d0] text-[#450709] border-[#f5b8b8]",
  inativo_30: "bg-[#fce8e8] text-[#450709] border-[#f9d0d0]",
  inativo_60: "bg-muted text-muted-foreground border-border",
};

const ALL_TAGS = ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"];
type RouterOutputs = inferRouterOutputs<AppRouter>;
type CrmCustomerDetail = NonNullable<RouterOutputs["crm"]["getCustomerDetail"]>;
type CrmCustomerOrder = CrmCustomerDetail["orders"][number];
type ClubMemberRecord = RouterOutputs["club"]["getMembers"][number];
type PendingClubPaymentRecord = RouterOutputs["club"]["getPendingPayments"][number];

function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TAG_COLORS[tag] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
    >
      {TAG_LABELS[tag] ?? tag}
    </span>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  preparing: "Preparando",
  out_for_delivery: "Na Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[#fce8e8] text-[#6E0D12]",
  confirmed: "bg-[#fdf5f5] text-[#5a0a0f]",
  preparing: "bg-[#f9d0d0] text-[#450709]",
  out_for_delivery: "bg-[#fce8e8] text-[#7d0f14]",
  delivered: "bg-[#f0fdf4] text-[#166534]",
  cancelled: "bg-muted text-muted-foreground",
};

// ─── Stats Cards ─────────────────────────────────────────────────────────────

function StatsCards({ storeId }: { storeId?: number }) {
  const { data: stats } = trpc.crm.getStats.useQuery({ storeId });

  if (!stats) return null;

  const tagStats = [
    { label: "Novos", value: stats.tagNovo, color: "text-[#6E0D12]", bg: "bg-[#fce8e8]" },
    { label: "Recorrentes", value: stats.tagRecorrente, color: "text-[#5a0a0f]", bg: "bg-[#fdf5f5]" },
    { label: "Indecisos", value: stats.tagIndeciso, color: "text-[#7d0f14]", bg: "bg-[#fce8e8]/60" },
    { label: "Inativos 15d", value: stats.tagInativo15, color: "text-[#450709]", bg: "bg-[#f9d0d0]" },
    { label: "Inativos 30d", value: stats.tagInativo30, color: "text-[#6E0D12]", bg: "bg-[#fdf2f2]" },
    { label: "Inativos 60d", value: stats.tagInativo60, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      <Card className="col-span-1 border-t-2" style={{ borderTopColor: '#6E0D12' }}>
        <CardContent className="p-4 flex flex-col items-center justify-center">
          <Users className="w-6 h-6 text-[#6E0D12] mb-1" />
          <div className="text-2xl font-extrabold text-[#6E0D12]">{Number(stats.totalCustomers)}</div>
          <div className="text-xs text-muted-foreground">Clientes</div>
        </CardContent>
      </Card>
      {tagStats.map((s) => (
        <Card key={s.label} className={`col-span-1 border-0 ${s.bg}`}>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className={`text-2xl font-extrabold ${s.color}`}>{Number(s.value)}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Customer Detail Dialog ───────────────────────────────────────────────────

function CustomerDetailDialog({
  userId,
  storeId,
  onClose,
}: {
  userId: number;
  storeId?: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [addTagValue, setAddTagValue] = useState("");
  const [addCustomTagId, setAddCustomTagId] = useState("");
  const [triggerJourneyId, setTriggerJourneyId] = useState("");

  const { data, isLoading, refetch } = trpc.crm.getCustomerDetail.useQuery({ userId, storeId });
  const { data: journeysData } = trpc.automations.listJourneys.useQuery();
  const { data: allCustomTags } = trpc.crm.listCustomTags.useQuery();
  const { data: customerCustomTags, refetch: refetchCustomTags } = trpc.crm.getCustomTagsForCustomer.useQuery({ userId });

  const triggerJourneyForCustomer = trpc.crm.triggerJourneyForCustomer.useMutation({
    onSuccess: () => {
      toast.success("Jornada disparada para este cliente!");
      setTriggerJourneyId("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignTag = trpc.crm.assignTag.useMutation({
    onSuccess: () => {
      toast.success("Tag adicionada com sucesso");
      refetch();
      utils.crm.listCustomers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTag = trpc.crm.removeTag.useMutation({
    onSuccess: () => {
      toast.success("Tag removida");
      refetch();
      utils.crm.listCustomers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignCustomTag = trpc.crm.assignCustomTag.useMutation({
    onSuccess: () => {
      toast.success("Tag personalizada adicionada!");
      setAddCustomTagId("");
      refetchCustomTags();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeCustomTag = trpc.crm.removeCustomTag.useMutation({
    onSuccess: () => {
      toast.success("Tag personalizada removida");
      refetchCustomTags();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Carregando cliente</DialogTitle>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[#6E0D12]" />
        </div>
      </DialogContent>
    );
  }

  if (!data) return null;

  const { user, orders, tags, executions, carts } = data;
  const customerOrders: CrmCustomerOrder[] = orders;

  const totalSpent = customerOrders
    .filter((order: CrmCustomerOrder) => order.status === "delivered")
    .reduce((acc: number, order: CrmCustomerOrder) => acc + parseFloat(order.total), 0);

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#fce8e8] flex items-center justify-center text-[#5a0a0f] font-bold text-lg">
            {(user.name ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <div>{user.name ?? "Sem nome"}</div>
            <div className="text-sm font-normal text-muted-foreground">{user.email ?? user.phone ?? "—"}</div>
          </div>
        </DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Visão Geral</TabsTrigger>
          <TabsTrigger value="orders" className="flex-1">Pedidos ({customerOrders.length})</TabsTrigger>
          <TabsTrigger value="journeys" className="flex-1">Jornadas ({executions.length})</TabsTrigger>
          <TabsTrigger value="carts" className="flex-1">Carrinhos ({carts.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#fce8e8] rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold text-[#6E0D12]">{customerOrders.length}</div>
              <div className="text-xs text-muted-foreground">Pedidos</div>
            </div>
            <div className="bg-[#fdf5f5] rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold text-[#5a0a0f]">R$ {totalSpent.toFixed(2).replace(".", ",")}</div>
              <div className="text-xs text-muted-foreground">Total gasto</div>
            </div>
            <div className="bg-[#fce8e8] rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold text-[#6E0D12]">{user.loyaltyPoints}</div>
              <div className="text-xs text-muted-foreground">Pontos fidelidade</div>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{user.phone ?? "—"}</span></div>
            <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{user.email ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Cadastro:</span> <span className="font-medium">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Último acesso:</span> <span className="font-medium">{new Date(user.lastSignedIn).toLocaleDateString("pt-BR")}</span></div>
          </div>

          {/* Tags */}
          <div>
            <div className="text-sm font-semibold text-foreground mb-2">Tags do cliente</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma tag atribuída</span>}
              {tags.map((t) => (
                <div key={t.tag} className="flex items-center gap-1">
                  <TagBadge tag={t.tag} />
                  <button
                    onClick={() => removeTag.mutate({ userId, tag: t.tag })}
                    className="text-gray-400 hover:text-[#7d0f14] transition-colors"
                    title="Remover tag"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={addTagValue} onValueChange={setAddTagValue}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Adicionar tag..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TAGS.filter((t) => !tags.find((x) => x.tag === t)).map((t) => (
                    <SelectItem key={t} value={t}>{TAG_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!addTagValue || assignTag.isPending}
                onClick={() => {
                  if (addTagValue) {
                    assignTag.mutate({ userId, tag: addTagValue });
                    setAddTagValue("");
                  }
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Tags Personalizadas */}
          <div>
            <div className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
              <Palette className="w-4 h-4 text-[#6E0D12]" /> Tags Personalizadas
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(!customerCustomTags || customerCustomTags.length === 0) && <span className="text-sm text-muted-foreground">Nenhuma tag personalizada</span>}
              {(customerCustomTags ?? []).map((ct) => (
                <div key={ct.id} className="flex items-center gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: ct.color }}>
                    #{ct.name}
                  </span>
                  <button
                    onClick={() => removeCustomTag.mutate({ userId, tagId: ct.id })}
                    className="text-gray-400 hover:text-[#7d0f14] transition-colors"
                    title="Remover tag"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={addCustomTagId} onValueChange={setAddCustomTagId}>
                <SelectTrigger className="w-52 h-8 text-sm">
                  <SelectValue placeholder="Adicionar tag personalizada..." />
                </SelectTrigger>
                <SelectContent>
                  {(allCustomTags ?? []).filter((t) => !(customerCustomTags ?? []).find((x) => x.id === t.id)).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                        #{t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!addCustomTagId || assignCustomTag.isPending}
                onClick={() => {
                  if (addCustomTagId) assignCustomTag.mutate({ userId, tagId: Number(addCustomTagId) });
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Disparar Jornada */}
          <div className="border rounded-lg p-3 bg-[#fdf2f2] border-[#fce8e8]">
            <div className="text-sm font-semibold text-[#5a0a0f] mb-2 flex items-center gap-1">
              <Zap className="w-4 h-4" /> Disparar Jornada para este Cliente
            </div>
            <div className="flex gap-2">
              <Select value={triggerJourneyId} onValueChange={setTriggerJourneyId}>
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Selecione uma jornada..." />
                </SelectTrigger>
                <SelectContent>
                  {(journeysData ?? []).map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>
                      {j.name}
                      {j.status !== "active" && <span className="ml-1 text-xs text-gray-400">({j.status})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
                disabled={!triggerJourneyId || triggerJourneyForCustomer.isPending}
                onClick={() => {
                  if (triggerJourneyId) {
                    triggerJourneyForCustomer.mutate({ journeyId: Number(triggerJourneyId), userId });
                  }
                }}
              >
                {triggerJourneyForCustomer.isPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3 mr-1" />
                )}
                Disparar
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders" className="mt-4">
          <div className="space-y-2">
            {customerOrders.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Nenhum pedido encontrado</p>}
            {customerOrders.map((order: CrmCustomerOrder) => (
              <div key={order.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Pedido #{order.id}</div>
                  <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? ""}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span className="font-semibold text-sm">R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Journeys */}
        <TabsContent value="journeys" className="mt-4">
          <div className="space-y-2">
            {executions.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Nenhuma jornada executada</p>}
            {executions.map((exec) => (
              <div key={exec.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm">{exec.journeyName ?? `Jornada #${exec.journeyId}`}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    exec.status === "completed" ? "bg-[#f0fdf4] text-[#166534]" :
                    exec.status === "running" ? "bg-[#fce8e8] text-[#6E0D12]" :
                    exec.status === "failed" ? "bg-[#fce8e8] text-[#450709]" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {exec.status === "completed" ? "Concluída" :
                     exec.status === "running" ? "Em andamento" :
                     exec.status === "failed" ? "Falhou" : "Cancelada"}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Iniciada em {new Date(exec.startedAt).toLocaleString("pt-BR")}
                  {exec.completedAt && ` · Concluída em ${new Date(exec.completedAt).toLocaleString("pt-BR")}`}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Abandoned Carts */}
        <TabsContent value="carts" className="mt-4">
          <div className="space-y-2">
            {carts.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Nenhum carrinho abandonado</p>}
            {carts.map((cart) => (
              <div key={cart.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm">Carrinho #{cart.id} — R$ {cart.total}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cart.status === "recovered" ? "bg-[#f0fdf4] text-[#166534]" :
                    cart.status === "expired" ? "bg-muted text-muted-foreground" :
                    "bg-[#fce8e8] text-[#6E0D12]"
                  }`}>
                    {cart.status === "recovered" ? "Recuperado" : cart.status === "expired" ? "Expirado" : "Pendente"}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(cart.createdAt).toLocaleString("pt-BR")}
                  {cart.firstReminderSentAt && " · 1º lembrete enviado"}
                  {cart.secondReminderSentAt && " · 2º lembrete enviado"}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

// ─── Clube do Bonatto Admin Tab ──────────────────────────────────────────────

function ClubTab() {
  const [promoMessage, setPromoMessage] = useState("");
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [planFilter, setPlanFilter] = useState<"all" | "bonattao" | "basico">("all");
  const utils = trpc.useUtils();

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = trpc.club.getMembers.useQuery();
  const { data: pendingPayments, isLoading: paymentsLoading, refetch: refetchPayments } = trpc.club.getPendingPayments.useQuery();

  const confirmPayment = trpc.club.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento confirmado! Plano ativado.");
      refetchMembers();
      refetchPayments();
      utils.club.getMembers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendPromotion = trpc.club.sendPromotion.useMutation({
    onSuccess: (r) => {
      toast.success(`Promoção enviada para ${r.sent} membro(s)!`);
      setShowPromoModal(false);
      setPromoMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  const memberList: ClubMemberRecord[] = members ?? [];
  const pendingPaymentList: PendingClubPaymentRecord[] = pendingPayments ?? [];
  const filteredMembers = memberList.filter((member: ClubMemberRecord) => {
    if (planFilter === "all") return true;
    return member.clubPlan === planFilter;
  });

  const activeCount = memberList.filter((member: ClubMemberRecord) => member.clubStatus === "active").length;
  const bonattaoCount = memberList.filter((member: ClubMemberRecord) => member.clubPlan === "bonattao" && member.clubStatus === "active").length;
  const basicoCount = memberList.filter((member: ClubMemberRecord) => member.clubPlan === "basico" && member.clubStatus === "active").length;
  const pendingCount = pendingPaymentList.length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#fdf2f2] to-[#fce8e8] border border-[#f9d0d0] rounded-xl p-4">
          <Crown className="w-5 h-5 text-[#6E0D12] mb-1" />
          <p className="text-2xl font-black text-[#5a0a0f]">{activeCount}</p>
          <p className="text-xs text-[#6E0D12]">Membros ativos</p>
        </div>
        <div className="bg-gradient-to-br from-[#fdf5f5] to-[#fce8e8] border border-[#f9d0d0] rounded-xl p-4">
          <Crown className="w-5 h-5 text-[#5a0a0f] mb-1" />
          <p className="text-2xl font-black text-[#5a0a0f]">{bonattaoCount}</p>
          <p className="text-xs text-[#6E0D12]">Plano Bonattão</p>
        </div>
        <div className="bg-gradient-to-br from-muted to-muted/60 border border-border rounded-xl p-4">
          <Star className="w-5 h-5 text-muted-foreground mb-1" />
          <p className="text-2xl font-black text-foreground">{basicoCount}</p>
          <p className="text-xs text-muted-foreground">Plano Básico</p>
        </div>
        <div className="bg-gradient-to-br from-[#fce8e8] to-[#f9d0d0] border border-[#f5b8b8] rounded-xl p-4">
          <Hourglass className="w-5 h-5 text-[#7d0f14] mb-1" />
          <p className="text-2xl font-black text-[#7d0f14]">{pendingCount}</p>
          <p className="text-xs text-[#7d0f14]">Pagamentos pendentes</p>
        </div>
      </div>

      {/* Pagamentos PIX pendentes */}
      {pendingCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-[#6E0D12]">
              <Hourglass className="w-4 h-4" />
              Pagamentos PIX Pendentes ({pendingCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-[#6E0D12]" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPaymentList.map((p: PendingClubPaymentRecord) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{p.userName ?? "—"}</div>
                          <div className="text-xs text-gray-400">{p.userEmail ?? "—"}</div>
                          {p.userPhone && <div className="text-xs text-gray-400">{p.userPhone}</div>}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.plan === "bonattao" ? "bg-[#fce8e8] text-[#5a0a0f]" : "bg-muted text-muted-foreground"
                          }`}>
                            {p.plan === "bonattao" ? <Crown className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                            {p.plan === "bonattao" ? "Bonattão" : "Básico"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          R$ {Number(p.amount).toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white text-xs"
                            disabled={confirmPayment.isPending}
                            onClick={() => confirmPayment.mutate({ paymentId: p.id })}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Confirmar PIX
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {(["all", "bonattao", "basico"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPlanFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                planFilter === f
                  ? "bg-[#6E0D12] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "Todos" : f === "bonattao" ? "Bonattão" : "Básico"}
            </button>
          ))}
        </div>
        <Button
          className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
          size="sm"
          onClick={() => setShowPromoModal(true)}
          disabled={activeCount === 0}
        >
          <Send className="w-4 h-4 mr-1" />
          Enviar Promoção
        </Button>
      </div>

      {/* Tabela de membros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#6E0D12]" />
            Membros do Clube ({filteredMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-[#6E0D12]" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Crown className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Nenhum membro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Membro desde</TableHead>
                    <TableHead>Pizza grátis</TableHead>
                    <TableHead>Próx. renovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((m: ClubMemberRecord) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#fce8e8] flex items-center justify-center text-[#5a0a0f] font-bold text-sm flex-shrink-0">
                            {(m.name ?? "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              {m.name ?? "Sem nome"}
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fce8e8] text-[#5a0a0f]">
                                <Crown className="w-2.5 h-2.5" /> Clube
                              </span>
                            </div>
                            <div className="text-xs text-gray-400">#{m.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{m.phone ?? "—"}</div>
                        <div className="text-xs text-gray-400">{m.email ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          m.clubPlan === "bonattao" ? "bg-[#fce8e8] text-[#5a0a0f]" : "bg-muted text-muted-foreground"
                        }`}>
                          {m.clubPlan === "bonattao" ? <Crown className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                          {m.clubPlan === "bonattao" ? "Bonattão" : "Básico"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.clubStatus === "active" ? "bg-[#f0fdf4] text-[#166534]" :
                          m.clubStatus === "pending" ? "bg-[#fce8e8] text-[#6E0D12]" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {m.clubStatus === "active" ? "Ativo" : m.clubStatus === "pending" ? "Pendente" : "Cancelado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {m.clubStartDate ? new Date(m.clubStartDate).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${
                          m.clubFreePizzaUsed ? "text-muted-foreground" : "text-primary"
                        }`}>
                          {m.clubFreePizzaUsed ? "Usada" : "Disponível"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {m.clubNextBillingDate ? new Date(m.clubNextBillingDate).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de promoção */}
      <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#6E0D12]" />
              Enviar Promoção para Membros
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Mensagem (será enviada via WhatsApp)
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#7d0f14]"
                rows={5}
                placeholder="Ex: 🍕 Hoje tem 30% OFF em todas as pizzas especiais! Só para membros do Clube do Bonatto. Peça agora!"
                value={promoMessage}
                onChange={(e) => setPromoMessage(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{promoMessage.length}/1000 caracteres</p>
            </div>
            <div className="bg-[#fdf2f2] border border-[#f9d0d0] rounded-xl p-3 text-xs text-[#5a0a0f]">
              <strong>Atenção:</strong> A mensagem será enviada para todos os <strong>{activeCount} membros ativos</strong> do clube via WhatsApp.
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPromoModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
                disabled={!promoMessage.trim() || sendPromotion.isPending}
                onClick={() => sendPromotion.mutate({ message: promoMessage })}
              >
                {sendPromotion.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                Enviar para {activeCount} membros
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────

function CRMContent() {
  const { user, loading: authLoading } = useAuth();
  const { selectedStoreId, selectedStoreName, stores, isManager, setSelectedStoreId } = useAdminStore();

  // Guard: apenas admins podem acessar
  if (!authLoading && (!user || user.role !== "admin")) {
    return <Redirect to="/" />;
  }

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [triggerJourneyDialog, setTriggerJourneyDialog] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
  const [selectedTagForJourney, setSelectedTagForJourney] = useState<string>("");

  // Tags personalizadas
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTag, setEditingTag] = useState<{ id: number; name: string; color: string; description?: string } | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#ef4444");
  const [newTagDescription, setNewTagDescription] = useState("");

  const utils = trpc.useUtils();

  // Debounce search
  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout((window as unknown as { _searchTimeout?: ReturnType<typeof setTimeout> })._searchTimeout);
    (window as unknown as { _searchTimeout?: ReturnType<typeof setTimeout> })._searchTimeout = setTimeout(() => setDebouncedSearch(v), 400);
  };

  const { data, isLoading, refetch } = trpc.crm.listCustomers.useQuery({
    search: debouncedSearch || undefined,
    tag: tagFilter !== "all" ? tagFilter : undefined,
    limit: 100,
    storeId: selectedStoreId,
  });

  const { data: journeysData } = trpc.automations.listJourneys.useQuery();

  const refreshTags = trpc.automations.refreshTags.useMutation({
    onSuccess: () => {
      toast.success("Tags atualizadas com sucesso!");
      refetch();
      utils.crm.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Queries e mutations de tags personalizadas
  const { data: customTagsData, refetch: refetchCustomTags } = trpc.crm.listCustomTags.useQuery();
  const customTags = customTagsData ?? [];

  const createCustomTag = trpc.crm.createCustomTag.useMutation({
    onSuccess: () => {
      toast.success("Tag criada com sucesso!");
      setNewTagName("");
      setNewTagColor("#ef4444");
      setNewTagDescription("");
      refetchCustomTags();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCustomTag = trpc.crm.updateCustomTag.useMutation({
    onSuccess: () => {
      toast.success("Tag atualizada!");
      setEditingTag(null);
      refetchCustomTags();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCustomTag = trpc.crm.deleteCustomTag.useMutation({
    onSuccess: () => {
      toast.success("Tag excluída!");
      refetchCustomTags();
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerJourneyForTag = trpc.crm.triggerJourneyForTag.useMutation({
    onSuccess: (result) => {
      toast.success(`Jornada disparada para ${result.started} de ${result.total} clientes!`);
      setTriggerJourneyDialog(false);
      setSelectedJourneyId("");
      setSelectedTagForJourney("");
    },
    onError: (e) => toast.error(e.message),
  });

  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;

  // Paginação de clientes
  const CUSTOMERS_PER_PAGE = 15;
  const [customerPage, setCustomerPage] = useState(1);
  const totalCustomerPages = Math.max(1, Math.ceil(customers.length / CUSTOMERS_PER_PAGE));
  const paginatedCustomers = customers.slice(
    (customerPage - 1) * CUSTOMERS_PER_PAGE,
    customerPage * CUSTOMERS_PER_PAGE,
  );

  const lastOrderAgo = (lastOrderAt: Date | null) => {
    if (!lastOrderAt) return "Nunca pediu";
    const days = Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    return `${days}d atrás`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-border">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif", color: '#6E0D12' }}>
            <Users className="w-7 h-7" />
            CRM de Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus clientes, tags e automações de marketing
          </p>
        </div>
        <div className="flex gap-2">
          {isManager ? (
            <div className="hidden md:flex items-center rounded-lg border bg-[#fce8e8] px-3 py-2 text-xs font-semibold text-[#6E0D12]">
              Loja: {selectedStoreName}
            </div>
          ) : (
            <Select
              value={selectedStoreId ? String(selectedStoreId) : "all"}
              onValueChange={(value) => setSelectedStoreId(value === "all" ? undefined : Number(value))}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todas as lojas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={String(store.id)}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshTags.mutate()}
            disabled={refreshTags.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshTags.isPending ? "animate-spin" : ""}`} />
            Atualizar Tags
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagManager(true)}
          >
            <Palette className="w-4 h-4 mr-1" />
            Gerenciar Tags
          </Button>
          <Button
            size="sm"
            className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
            onClick={() => setTriggerJourneyDialog(true)}
          >
            <Zap className="w-4 h-4 mr-1" />
            Disparar Jornada
          </Button>
        </div>
      </div>

      {/* Abas principais */}
      <Tabs defaultValue="clientes" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="clientes" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="clube" className="flex items-center gap-1.5">
            <Crown className="w-4 h-4" /> Clube do Bonatto
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-1.5">
            <Tag className="w-4 h-4" /> Tags ({customTags.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">

      {/* Stats */}
      <StatsCards storeId={selectedStoreId} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-52">
              <Tag className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar por tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {ALL_TAGS.map((t) => (
              <SelectItem key={t} value={t}>{TAG_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <span>
              {tagFilter !== "all"
                ? `Clientes com tag "${TAG_LABELS[tagFilter] ?? tagFilter}"`
                : "Todos os clientes"}
              {" "}
              <span className="text-muted-foreground font-normal text-sm">({total} total)</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Total gasto</TableHead>
                    <TableHead>Último pedido</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedUserId(c.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#fce8e8] flex items-center justify-center text-[#5a0a0f] font-bold text-sm flex-shrink-0">
                            {(c.name ?? "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{c.name ?? "Sem nome"}</div>
                            <div className="text-xs text-muted-foreground">#{c.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{c.phone ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.email ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <InlineTagsCell tags={c.tags} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ShoppingBag className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{Number(c.totalOrders)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-primary">
                          R$ {Number(c.totalSpent).toFixed(2).replace(".", ",")}
                          {/* valor total gasto */}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {lastOrderAgo(c.lastOrderAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        {totalCustomerPages > 1 && (
          <div className="flex justify-center py-4 border-t">
            <JoinedPagination
              currentPage={customerPage}
              totalPages={totalCustomerPages}
              paginationItemsToDisplay={5}
              onPageChange={setCustomerPage}
            />
          </div>
        )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="clube">
          <ClubTab />
        </TabsContent>

        {/* Aba de Tags Personalizadas */}
        <TabsContent value="tags">
          <div className="space-y-6">
            {/* Criar nova tag */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#6E0D12]" />
                  Criar Nova Tag
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Nome da tag (ex: VIP, Aniversariante)..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1"
                    maxLength={100}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 whitespace-nowrap">Cor:</label>
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-10 h-9 rounded cursor-pointer border border-gray-200"
                    />
                  </div>
                  <Input
                    placeholder="Descrição (opcional)..."
                    value={newTagDescription}
                    onChange={(e) => setNewTagDescription(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white whitespace-nowrap"
                    disabled={!newTagName.trim() || createCustomTag.isPending}
                    onClick={() => createCustomTag.mutate({ name: newTagName.trim(), color: newTagColor, description: newTagDescription || undefined })}
                  >
                    {createCustomTag.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Criar Tag
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags Personalizadas ({customTags.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {customTags.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma tag personalizada criada ainda.</p>
                    <p className="text-xs mt-1">Crie tags para segmentar seus clientes nas automações.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customTags.map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                        {editingTag?.id === tag.id ? (
                          <div className="flex flex-1 items-center gap-2 mr-2">
                            <Input
                              value={editingTag.name}
                              onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                              className="h-8 text-sm flex-1"
                              maxLength={100}
                            />
                            <input
                              type="color"
                              value={editingTag.color}
                              onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                            />
                            <Input
                              value={editingTag.description ?? ""}
                              onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                              placeholder="Descrição..."
                              className="h-8 text-sm flex-1"
                            />
                            <Button size="sm" className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white h-8"
                              disabled={updateCustomTag.isPending}
                              onClick={() => updateCustomTag.mutate({ id: editingTag.id, name: editingTag.name, color: editingTag.color, description: editingTag.description })}
                            >
                              Salvar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingTag(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 flex-1">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              #{tag.name}
                            </span>
                            {tag.description && (
                              <span className="text-sm text-gray-500">{tag.description}</span>
                            )}
                          </div>
                        )}
                        {editingTag?.id !== tag.id && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                              onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color, description: tag.description ?? undefined })}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-[#6E0D12]"
                              disabled={deleteCustomTag.isPending}
                              onClick={() => { if (confirm(`Excluir a tag "${tag.name}"? Ela será removida de todos os clientes.`)) deleteCustomTag.mutate({ id: tag.id }); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tag Manager Dialog (acesso rápido pelo botão no header) */}
      <Dialog open={showTagManager} onOpenChange={setShowTagManager}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#6E0D12]" />
              Gerenciar Tags Personalizadas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input placeholder="Nome da tag..." value={newTagName} onChange={(e) => setNewTagName(e.target.value)} className="flex-1" maxLength={100} />
              <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-10 h-9 rounded cursor-pointer border border-gray-200" />
              <Button className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white" disabled={!newTagName.trim() || createCustomTag.isPending}
                onClick={() => createCustomTag.mutate({ name: newTagName.trim(), color: newTagColor, description: undefined })}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {customTags.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhuma tag criada ainda.</p>}
              {customTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between p-2 rounded border">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: tag.color }}>#{tag.name}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-[#6E0D12]" disabled={deleteCustomTag.isPending}
                    onClick={() => { if (confirm(`Excluir "${tag.name}"?`)) deleteCustomTag.mutate({ id: tag.id }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      {selectedUserId !== null && (
        <Dialog open={true} onOpenChange={() => setSelectedUserId(null)}>
          <CustomerDetailDialog userId={selectedUserId} storeId={selectedStoreId} onClose={() => setSelectedUserId(null)} />
        </Dialog>
      )}

      {/* Trigger Journey Dialog */}
      <Dialog open={triggerJourneyDialog} onOpenChange={setTriggerJourneyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#6E0D12]" />
              Disparar Jornada para Segmento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Jornada
              </label>
              <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma jornada..." />
                </SelectTrigger>
                <SelectContent>
                  {(journeysData ?? []).map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>
                      {j.name}
                      {j.status !== "active" && (
                        <span className="ml-2 text-xs text-gray-400">({j.status})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Segmento (Tag)
              </label>
              <Select value={selectedTagForJourney} onValueChange={setSelectedTagForJourney}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma tag..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TAGS.map((t) => (
                    <SelectItem key={t} value={t}>{TAG_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">
              A jornada será disparada para todos os clientes com a tag selecionada. Clientes que já estão em execução nesta jornada serão ignorados.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setTriggerJourneyDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
                disabled={!selectedJourneyId || !selectedTagForJourney || triggerJourneyForTag.isPending}
                onClick={() => {
                  if (selectedJourneyId && selectedTagForJourney) {
                    triggerJourneyForTag.mutate({
                      journeyId: Number(selectedJourneyId),
                      tag: selectedTagForJourney,
                    });
                  }
                }}
              >
                {triggerJourneyForTag.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Zap className="w-4 h-4 mr-1" />
                )}
                Disparar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Inline Tags Cell (usa tags do listCustomers, sem N+1) ────────────────────────

function InlineTagsCell({ tags }: { tags: string | null }) {
  const tagList = tags ? tags.split(',').filter(Boolean) : [];
  if (tagList.length === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tagList.slice(0, 3).map((t) => (
        <TagBadge key={t} tag={t} />
      ))}
      {tagList.length > 3 && (
        <span className="text-xs text-gray-400">+{tagList.length - 3}</span>
      )}
    </div>
  );
}

export default function CRM() {
  return (
    <AdminStoreProvider>
      <CRMContent />
    </AdminStoreProvider>
  );
}
