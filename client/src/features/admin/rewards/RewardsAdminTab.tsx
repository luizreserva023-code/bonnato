import { useEffect, useMemo, useState } from "react";
import { Archive, Download, Eye, Gift, Loader2, Pencil, Plus, RefreshCw, Ticket, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { trpc } from "@/lib/trpc";

type RewardType = "discount" | "product" | "free_delivery" | "cashback";

type RewardForm = {
  name: string;
  description: string;
  rewardType: RewardType;
  pointsCost: string;
  value: string;
  productId: string;
  category: string;
  icon: string;
  imageUrl: string;
  badgeText: string;
  buttonText: string;
  stock: string;
  maxRedemptionsPerUser: string;
  active: boolean;
  featured: boolean;
  sortOrder: string;
  startsAt: string;
  expiresAt: string;
};

const emptyForm: RewardForm = {
  name: "",
  description: "",
  rewardType: "discount",
  pointsCost: "300",
  value: "0",
  productId: "",
  category: "",
  icon: "",
  imageUrl: "",
  badgeText: "Recompensa",
  buttonText: "Resgatar",
  stock: "",
  maxRedemptionsPerUser: "",
  active: true,
  featured: false,
  sortOrder: "0",
  startsAt: "",
  expiresAt: "",
};

const statusLabels: Record<string, string> = {
  available: "Disponível",
  reserved: "Reservado",
  redeemed: "Resgatado",
  used: "Utilizado",
  expired: "Expirado",
  cancelled: "Cancelado",
  completed: "Concluído",
  refunded: "Estornado",
};

function localInputDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function RewardsAdminTab() {
  const { selectedStoreId } = useAdminStore();
  const utils = trpc.useUtils();
  const [selectedRewardId, setSelectedRewardId] = useState<number | null>(null);
  const [editingRewardId, setEditingRewardId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<RewardForm>(emptyForm);
  const [couponCodes, setCouponCodes] = useState("");
  const [couponExpiry, setCouponExpiry] = useState("");
  const [generator, setGenerator] = useState({ prefix: "CLUBE-", quantity: "20", codeLength: "8", expiresAt: "" });
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const rewardsQuery = trpc.rewards.admin.list.useQuery(
    { storeId: selectedStoreId ?? 0 },
    { enabled: Boolean(selectedStoreId) },
  );
  const productsQuery = trpc.products.list.useQuery(
    { storeId: selectedStoreId },
    { enabled: Boolean(selectedStoreId) },
  );
  const couponsQuery = trpc.rewards.admin.coupons.useQuery(
    { storeId: selectedStoreId ?? 0, rewardId: selectedRewardId ?? 0 },
    { enabled: Boolean(selectedStoreId && selectedRewardId) },
  );
  const redemptionsQuery = trpc.rewards.admin.redemptions.useQuery(
    { storeId: selectedStoreId ?? 0, rewardId: selectedRewardId ?? undefined },
    { enabled: Boolean(selectedStoreId) },
  );

  const selectedReward = rewardsQuery.data?.find((reward) => reward.id === selectedRewardId) ?? null;

  useEffect(() => {
    if (selectedRewardId || !rewardsQuery.data?.length) return;
    setSelectedRewardId(rewardsQuery.data[0].id);
  }, [rewardsQuery.data, selectedRewardId]);

  const refresh = async () => {
    if (!selectedStoreId) return;
    await Promise.all([
      utils.rewards.admin.list.invalidate({ storeId: selectedStoreId }),
      utils.rewards.list.invalidate({ storeId: selectedStoreId }),
      selectedRewardId ? utils.rewards.admin.coupons.invalidate({ storeId: selectedStoreId, rewardId: selectedRewardId }) : Promise.resolve(),
      utils.rewards.admin.redemptions.invalidate(),
    ]);
  };

  const createReward = trpc.rewards.admin.create.useMutation({ onSuccess: async () => { toast.success("Recompensa criada."); setEditorOpen(false); await refresh(); } });
  const updateReward = trpc.rewards.admin.update.useMutation({ onSuccess: async () => { toast.success("Recompensa atualizada."); setEditorOpen(false); await refresh(); } });
  const archiveReward = trpc.rewards.admin.archive.useMutation({ onSuccess: async () => { toast.success("Recompensa arquivada sem apagar o histórico."); await refresh(); } });
  const addCoupons = trpc.rewards.admin.addCoupons.useMutation({ onSuccess: async (result) => { toast.success(`${result.inserted} cupom(ns) cadastrado(s).`); setCouponCodes(""); await refresh(); } });
  const generateCoupons = trpc.rewards.admin.generateCoupons.useMutation({ onSuccess: async (result) => { toast.success(`${result.inserted} código(s) gerado(s).`); await refresh(); } });
  const revealCoupon = trpc.rewards.admin.revealCoupon.useMutation();
  const exportCoupons = trpc.rewards.admin.exportCoupons.useMutation();
  const cancelRedemption = trpc.rewards.admin.cancelRedemption.useMutation({
    onSuccess: async (result) => {
      toast.success(result.alreadyCancelled ? "O resgate já estava cancelado." : `${result.refundedPoints} pontos estornados.`);
      setCancelTarget(null);
      setCancelReason("");
      await refresh();
    },
  });

  const busy = createReward.isPending || updateReward.isPending;

  const openCreate = () => {
    setEditingRewardId(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (reward: NonNullable<typeof rewardsQuery.data>[number]) => {
    setEditingRewardId(reward.id);
    setForm({
      name: reward.name,
      description: reward.description ?? "",
      rewardType: reward.rewardType,
      pointsCost: String(reward.pointsCost),
      value: String(reward.value),
      productId: reward.productId ? String(reward.productId) : "",
      category: reward.category ?? "",
      icon: reward.icon ?? "",
      imageUrl: reward.imageUrl ?? "",
      badgeText: reward.badgeText ?? "",
      buttonText: reward.buttonText,
      stock: reward.stock == null ? "" : String(reward.stock),
      maxRedemptionsPerUser: reward.maxRedemptionsPerUser == null ? "" : String(reward.maxRedemptionsPerUser),
      active: reward.active,
      featured: reward.featured,
      sortOrder: String(reward.sortOrder),
      startsAt: localInputDate(reward.startsAt),
      expiresAt: localInputDate(reward.expiresAt),
    });
    setEditorOpen(true);
  };

  const rewardPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || null,
    rewardType: form.rewardType,
    pointsCost: Number(form.pointsCost),
    value: Number(form.value || 0),
    productId: form.productId ? Number(form.productId) : null,
    category: form.category.trim() || null,
    icon: form.icon.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    badgeText: form.badgeText.trim() || null,
    buttonText: form.buttonText.trim() || "Resgatar",
    stock: form.stock === "" ? null : Number(form.stock),
    maxRedemptionsPerUser: form.maxRedemptionsPerUser === "" ? null : Number(form.maxRedemptionsPerUser),
    active: form.active,
    featured: form.featured,
    sortOrder: Number(form.sortOrder || 0),
    startsAt: form.startsAt ? new Date(form.startsAt) : null,
    expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
  });

  const submitReward = () => {
    if (!selectedStoreId) return;
    const payload = rewardPayload();
    if (!payload.name || !Number.isInteger(payload.pointsCost) || payload.pointsCost < 1) {
      toast.error("Informe nome e custo em pontos válidos.");
      return;
    }
    if (editingRewardId) updateReward.mutate({ storeId: selectedStoreId, rewardId: editingRewardId, ...payload });
    else createReward.mutate({ storeId: selectedStoreId, ...payload });
  };

  const importCodes = () => {
    if (!selectedStoreId || !selectedRewardId) return;
    const codes = couponCodes.split(/[;,\n\r]+/).map((code) => code.trim()).filter(Boolean);
    if (!codes.length) return toast.error("Cole ou importe pelo menos um código.");
    addCoupons.mutate({ storeId: selectedStoreId, rewardId: selectedRewardId, codes, expiresAt: couponExpiry ? new Date(couponExpiry) : null });
  };

  const readCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const codes = text.split(/[,;\n\r]+/).map((code) => code.replace(/^"|"$/g, "").trim()).filter(Boolean);
      setCouponCodes(codes.join("\n"));
      toast.success(`${codes.length} código(s) lido(s) do arquivo.`);
    };
    reader.onerror = () => toast.error("Não foi possível ler o CSV.");
    reader.readAsText(file);
  };

  const downloadCsv = async () => {
    if (!selectedStoreId || !selectedRewardId) return;
    const rows = await exportCoupons.mutateAsync({ storeId: selectedStoreId, rewardId: selectedRewardId });
    const csv = [
      ["codigo", "status", "usuario", "email", "resgatado_em", "validade"].join(","),
      ...rows.map((row) => [row.code, row.status, row.userName, row.userEmail, row.redeemedAt, row.expiresAt].map(csvEscape).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `recompensa-${selectedRewardId}-cupons.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => ({
    rewards: rewardsQuery.data?.length ?? 0,
    active: rewardsQuery.data?.filter((reward) => reward.active && !reward.archivedAt).length ?? 0,
    coupons: rewardsQuery.data?.reduce((total, reward) => total + reward.couponStats.available, 0) ?? 0,
    redemptions: rewardsQuery.data?.reduce((total, reward) => total + reward.totalRedemptions, 0) ?? 0,
  }), [rewardsQuery.data]);

  if (!selectedStoreId) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Selecione uma loja para administrar as recompensas.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#DA1923]">Fidelidade e retenção</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Clube de Recompensas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Benefícios, cupons únicos, resgates e estornos em um fluxo auditável.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => refresh()}><RefreshCw className="mr-2 size-4" />Atualizar</Button><Button onClick={openCreate}><Plus className="mr-2 size-4" />Nova recompensa</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Recompensas', summary.rewards], ['Ativas', summary.active], ['Cupons disponíveis', summary.coupons], ['Resgates', summary.redemptions]].map(([label, value]) => (
          <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></CardContent></Card>
        ))}
      </div>

      {rewardsQuery.isPending ? (
        <div className="grid min-h-64 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>
      ) : rewardsQuery.isError ? (
        <Card><CardContent className="p-8 text-center"><p className="font-semibold">Falha ao carregar recompensas.</p><Button className="mt-3" variant="outline" onClick={() => rewardsQuery.refetch()}>Tentar novamente</Button></CardContent></Card>
      ) : rewardsQuery.data?.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center"><Gift className="mx-auto size-9 text-muted-foreground" /><h2 className="mt-3 font-black">Comece criando a primeira recompensa</h2><p className="mt-1 text-sm text-muted-foreground">Depois, carregue os cupons únicos que serão entregues aos clientes.</p><Button className="mt-4" onClick={openCreate}>Criar recompensa</Button></CardContent></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.7fr)]">
          <div className="space-y-3">
            {rewardsQuery.data?.map((reward) => (
              <button key={reward.id} type="button" onClick={() => setSelectedRewardId(reward.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedRewardId === reward.id ? "border-[#DA1923] bg-[#fff5f2] shadow-sm" : "border-border bg-white hover:border-[#d8b6b0]"}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-black">{reward.name}</p><p className="mt-1 text-xs text-muted-foreground">{reward.pointsCost.toLocaleString("pt-BR")} pontos · {reward.totalRedemptions} resgates</p></div><Badge variant={reward.active && !reward.archivedAt ? "default" : "secondary"}>{reward.archivedAt ? "Arquivada" : reward.active ? "Ativa" : "Inativa"}</Badge></div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px] text-muted-foreground"><span>{reward.couponStats.available} disponíveis</span><span>{reward.couponStats.redeemed} resgatados</span><span>{reward.couponStats.used} usados</span></div>
              </button>
            ))}
          </div>

          {selectedReward && (
            <Card className="min-w-0 rounded-[24px]">
              <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>{selectedReward.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{selectedReward.description || "Sem descrição"}</p></div><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Editar recompensa" onClick={() => openEdit(selectedReward)}><Pencil className="size-4" /></Button><Button size="icon" variant="outline" aria-label="Arquivar recompensa" disabled={Boolean(selectedReward.archivedAt)} onClick={() => archiveReward.mutate({ storeId: selectedStoreId, rewardId: selectedReward.id })}><Archive className="size-4" /></Button></div></CardHeader>
              <CardContent>
                <Tabs defaultValue="coupons" className="space-y-4">
                  <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-3"><TabsTrigger value="coupons">Cupons</TabsTrigger><TabsTrigger value="redemptions">Resgates</TabsTrigger><TabsTrigger value="rules">Regras</TabsTrigger></TabsList>
                  <TabsContent value="coupons" className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card className="border-dashed"><CardHeader><CardTitle className="text-base">Importar códigos</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={couponCodes} onChange={(event) => setCouponCodes(event.target.value)} rows={5} placeholder={'CLUBE-ABC123\nCLUBE-DEF456'} /><div><Label htmlFor="coupon-expiry">Validade opcional</Label><Input id="coupon-expiry" type="datetime-local" value={couponExpiry} onChange={(event) => setCouponExpiry(event.target.value)} /></div><div className="flex flex-wrap gap-2"><Button onClick={importCodes} disabled={addCoupons.isPending}><Upload className="mr-2 size-4" />Cadastrar</Button><label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium"><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => event.target.files?.[0] && readCsv(event.target.files[0])} />Ler CSV</label></div></CardContent></Card>
                      <Card className="border-dashed"><CardHeader><CardTitle className="text-base">Gerar automaticamente</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div><Label>Prefixo</Label><Input value={generator.prefix} onChange={(event) => setGenerator((value) => ({ ...value, prefix: event.target.value.toUpperCase() }))} /></div><div><Label>Quantidade</Label><Input type="number" min="1" max="1000" value={generator.quantity} onChange={(event) => setGenerator((value) => ({ ...value, quantity: event.target.value }))} /></div><div><Label>Tamanho aleatório</Label><Input type="number" min="4" max="24" value={generator.codeLength} onChange={(event) => setGenerator((value) => ({ ...value, codeLength: event.target.value }))} /></div><div><Label>Validade</Label><Input type="datetime-local" value={generator.expiresAt} onChange={(event) => setGenerator((value) => ({ ...value, expiresAt: event.target.value }))} /></div><Button className="sm:col-span-2" onClick={() => generateCoupons.mutate({ storeId: selectedStoreId, rewardId: selectedReward.id, prefix: generator.prefix, quantity: Number(generator.quantity), codeLength: Number(generator.codeLength), expiresAt: generator.expiresAt ? new Date(generator.expiresAt) : null })} disabled={generateCoupons.isPending}><Ticket className="mr-2 size-4" />Gerar códigos seguros</Button></CardContent></Card>
                    </div>
                    <div className="flex items-center justify-between"><h3 className="font-black">Inventário de cupons</h3><Button variant="outline" size="sm" onClick={downloadCsv} disabled={exportCoupons.isPending}><Download className="mr-2 size-4" />Exportar CSV</Button></div>
                    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/60 text-left"><tr><th className="p-3">Código</th><th className="p-3">Status</th><th className="p-3">Cliente</th><th className="p-3">Validade</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{couponsQuery.data?.map((coupon) => <tr key={coupon.id} className="border-t"><td className="p-3 font-mono font-bold">{coupon.maskedCode}</td><td className="p-3"><Badge variant="secondary">{statusLabels[coupon.status] ?? coupon.status}</Badge></td><td className="p-3">{coupon.userName || coupon.userEmail || "—"}</td><td className="p-3">{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString("pt-BR") : "Sem prazo"}</td><td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={async () => { const result = await revealCoupon.mutateAsync({ storeId: selectedStoreId, couponId: coupon.id }); await navigator.clipboard.writeText(result.code); toast.success("Código revelado e copiado. A ação foi auditada."); }}><Eye className="mr-2 size-4" />Revelar</Button></td></tr>)}{!couponsQuery.isPending && !couponsQuery.data?.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum cupom cadastrado.</td></tr>}</tbody></table></div>
                  </TabsContent>
                  <TabsContent value="redemptions">
                    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/60 text-left"><tr><th className="p-3">Cliente</th><th className="p-3">Cupom</th><th className="p-3">Pontos</th><th className="p-3">Status</th><th className="p-3">Data</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{redemptionsQuery.data?.map((redemption) => <tr key={redemption.id} className="border-t"><td className="p-3"><p className="font-semibold">{redemption.userName || "Cliente"}</p><p className="text-xs text-muted-foreground">{redemption.userEmail}</p></td><td className="p-3 font-mono">{redemption.couponCode || "—"}</td><td className="p-3">{redemption.pointsSpent}</td><td className="p-3"><Badge variant="secondary">{statusLabels[redemption.status] ?? redemption.status}</Badge></td><td className="p-3">{new Date(redemption.redeemedAt).toLocaleString("pt-BR")}</td><td className="p-3 text-right"><Button size="sm" variant="outline" disabled={redemption.status !== "completed" || redemption.couponStatus === "used"} onClick={() => setCancelTarget(redemption.id)}>Cancelar e estornar</Button></td></tr>)}{!redemptionsQuery.isPending && !redemptionsQuery.data?.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum resgate para esta recompensa.</td></tr>}</tbody></table></div>
                  </TabsContent>
                  <TabsContent value="rules"><div className="grid gap-3 sm:grid-cols-2"><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Custo</p><p className="mt-1 text-xl font-black">{selectedReward.pointsCost.toLocaleString("pt-BR")} pontos</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Estoque</p><p className="mt-1 text-xl font-black">{selectedReward.stock == null ? "Ilimitado" : `${selectedReward.totalRedemptions}/${selectedReward.stock}`}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Limite por cliente</p><p className="mt-1 text-xl font-black">{selectedReward.maxRedemptionsPerUser ?? "Ilimitado"}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Período</p><p className="mt-1 text-sm font-bold">{selectedReward.startsAt ? new Date(selectedReward.startsAt).toLocaleString("pt-BR") : "Imediato"} até {selectedReward.expiresAt ? new Date(selectedReward.expiresAt).toLocaleString("pt-BR") : "sem prazo"}</p></CardContent></Card></div></TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => !busy && setEditorOpen(open)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRewardId ? "Editar recompensa" : "Nova recompensa"}</DialogTitle><DialogDescription>Configure o benefício; saldo, custo e status serão validados novamente no servidor.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="reward-name">Título</Label><Input id="reward-name" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></div>
            <div className="sm:col-span-2"><Label htmlFor="reward-description">Descrição</Label><Textarea id="reward-description" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></div>
            <div><Label>Tipo</Label><Select value={form.rewardType} onValueChange={(rewardType: RewardType) => setForm((value) => ({ ...value, rewardType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="discount">Desconto fixo</SelectItem><SelectItem value="free_delivery">Entrega grátis</SelectItem><SelectItem value="product">Produto grátis</SelectItem><SelectItem value="cashback">Crédito/desconto</SelectItem></SelectContent></Select></div>
            <div><Label htmlFor="reward-points">Custo em pontos</Label><Input id="reward-points" type="number" min="1" value={form.pointsCost} onChange={(event) => setForm((value) => ({ ...value, pointsCost: event.target.value }))} /></div>
            <div><Label htmlFor="reward-value">Valor máximo do benefício (R$)</Label><Input id="reward-value" type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm((value) => ({ ...value, value: event.target.value }))} /></div>
            <div><Label>Produto vinculado</Label><Select value={form.productId || "none"} onValueChange={(productId) => setForm((value) => ({ ...value, productId: productId === "none" ? "" : productId }))}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{productsQuery.data?.map((product) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="reward-category">Categoria</Label><Input id="reward-category" value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} /></div>
            <div><Label htmlFor="reward-badge">Badge</Label><Input id="reward-badge" value={form.badgeText} onChange={(event) => setForm((value) => ({ ...value, badgeText: event.target.value }))} /></div>
            <div><Label htmlFor="reward-image">URL da imagem</Label><Input id="reward-image" value={form.imageUrl} onChange={(event) => setForm((value) => ({ ...value, imageUrl: event.target.value }))} placeholder="/uploads/... ou https://..." /></div>
            <div><Label htmlFor="reward-button">Texto do botão</Label><Input id="reward-button" value={form.buttonText} onChange={(event) => setForm((value) => ({ ...value, buttonText: event.target.value }))} /></div>
            <div><Label htmlFor="reward-stock">Estoque (vazio = ilimitado)</Label><Input id="reward-stock" type="number" min="0" value={form.stock} onChange={(event) => setForm((value) => ({ ...value, stock: event.target.value }))} /></div>
            <div><Label htmlFor="reward-limit">Limite por cliente</Label><Input id="reward-limit" type="number" min="1" value={form.maxRedemptionsPerUser} onChange={(event) => setForm((value) => ({ ...value, maxRedemptionsPerUser: event.target.value }))} /></div>
            <div><Label htmlFor="reward-order">Ordem</Label><Input id="reward-order" type="number" value={form.sortOrder} onChange={(event) => setForm((value) => ({ ...value, sortOrder: event.target.value }))} /></div>
            <div><Label htmlFor="reward-start">Início</Label><Input id="reward-start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((value) => ({ ...value, startsAt: event.target.value }))} /></div>
            <div><Label htmlFor="reward-end">Expiração</Label><Input id="reward-end" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((value) => ({ ...value, expiresAt: event.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-xl border p-3"><Label htmlFor="reward-active">Ativa</Label><Switch id="reward-active" checked={form.active} onCheckedChange={(active) => setForm((value) => ({ ...value, active }))} /></div>
            <div className="flex items-center justify-between rounded-xl border p-3"><Label htmlFor="reward-featured">Destaque</Label><Switch id="reward-featured" checked={form.featured} onCheckedChange={(featured) => setForm((value) => ({ ...value, featured }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)} disabled={busy}>Cancelar</Button><Button onClick={submitReward} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar recompensa</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !cancelRedemption.isPending && !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Cancelar resgate e estornar pontos</DialogTitle><DialogDescription>O cupom será invalidado e não voltará automaticamente ao estoque.</DialogDescription></DialogHeader><div><Label htmlFor="cancel-reason">Motivo obrigatório</Label><Textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Explique o motivo do cancelamento" /></div><DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button><Button variant="destructive" disabled={cancelReason.trim().length < 5 || cancelRedemption.isPending} onClick={() => cancelTarget && cancelRedemption.mutate({ storeId: selectedStoreId, redemptionId: cancelTarget, reason: cancelReason.trim() })}>{cancelRedemption.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Cancelar e estornar</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

export default RewardsAdminTab;
