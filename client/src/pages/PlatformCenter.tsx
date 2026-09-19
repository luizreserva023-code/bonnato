import { useState } from "react";
import { Activity, BrainCircuit, Building2, ChefHat, Clock3, Copy, CreditCard, Gift, PlugZap, Plus, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminEmptyState, AdminPage, AdminPill, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

type Section = "tenancy" | "commerce" | "operations" | "growth" | "integrations" | "intelligence";

const sections: Array<{ id: Section; label: string; icon: typeof ChefHat }> = [
  { id: "tenancy", label: "White label", icon: Building2 },
  { id: "commerce", label: "Cardápio inteligente", icon: Sparkles },
  { id: "operations", label: "Cozinha e estoque", icon: ChefHat },
  { id: "growth", label: "Fidelização", icon: Gift },
  { id: "integrations", label: "Integrações", icon: PlugZap },
  { id: "intelligence", label: "Inteligência", icon: BrainCircuit },
];

export default function PlatformCenter() {
  const [section, setSection] = useState<Section>("commerce");
  const { selectedStoreId, selectedStoreName } = useAdminStore();
  const { user } = useAuth();
  if (!selectedStoreId) return <AdminEmptyState title="Selecione uma loja" description="Escolha uma unidade para abrir a central operacional." />;

  return (
    <AdminPage>
      <AdminTopbar title="Central de crescimento" subtitle={`Operação, receita e inteligência de ${selectedStoreName}.`} />
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Módulos da plataforma">
        {sections.filter((item) => item.id !== "tenancy" || user?.role === "admin").map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={section === id ? "default" : "outline"} className="shrink-0" onClick={() => setSection(id)}>
            <Icon className="mr-2 h-4 w-4" />{label}
          </Button>
        ))}
      </nav>
      {section === "tenancy" && user?.role === "admin" && <TenancyPanel />}
      {section === "commerce" && <CommercePanel storeId={selectedStoreId} />}
      {section === "operations" && <OperationsPanel storeId={selectedStoreId} />}
      {section === "growth" && <GrowthPanel storeId={selectedStoreId} />}
      {section === "integrations" && <IntegrationsPanel storeId={selectedStoreId} />}
      {section === "intelligence" && <IntelligencePanel storeId={selectedStoreId} />}
    </AdminPage>
  );
}

function TenancyPanel() {
  const utils = trpc.useUtils();
  const overview = trpc.platform.tenancy.overview.useQuery();
  const planCatalog = trpc.platform.tenancy.plans.useQuery();
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [tenantForm, setTenantForm] = useState({ tenantKey: "", legalName: "", displayName: "", document: "", planId: "" });
  const [domain, setDomain] = useState("");
  const saveTenant = trpc.platform.tenancy.saveTenant.useMutation({ onSuccess: async () => { await utils.platform.tenancy.overview.invalidate(); toast.success("Empresa white label salva."); setTenantForm({ tenantKey: "", legalName: "", displayName: "", document: "", planId: "" }); } });
  const addDomain = trpc.platform.tenancy.addDomain.useMutation({ onSuccess: async (result) => { await utils.platform.tenancy.overview.invalidate(); setDomain(""); await navigator.clipboard?.writeText(result.dns.value); toast.success("Domínio registrado. Token DNS copiado."); } });
  const selected = overview.data?.find((item) => item.id === tenantId) ?? overview.data?.[0];
  const plans = planCatalog.data ?? [];
  return <div className="space-y-4">
    <PlatformPlansPanel />
    <AdminStatGrid><AdminStat label="Empresas" value={overview.data?.length ?? 0} /><AdminStat label="Ativas" value={overview.data?.filter((item) => item.status === "active").length ?? 0} /><AdminStat label="Domínios ativos" value={overview.data?.flatMap((item) => item.domains).filter((item) => item.status === "active").length ?? 0} /><AdminStat label="Unidades" value={overview.data?.flatMap((item) => item.stores).length ?? 0} /></AdminStatGrid>
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <AdminSurface><div className="flex items-center justify-between"><div><h3 className="font-bold">Empresas da plataforma</h3><p className="text-sm text-muted-foreground">Cada empresa mantém lojas, marca, domínio e assinatura isolados.</p></div><Button variant="outline" size="sm" onClick={() => overview.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div><div className="mt-4 space-y-2">{overview.data?.map((tenant) => <button type="button" key={tenant.id} onClick={() => setTenantId(tenant.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selected?.id === tenant.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}><div className="flex items-center justify-between"><strong>{tenant.displayName}</strong><AdminPill>{tenant.status}</AdminPill></div><p className="mt-1 text-sm text-muted-foreground">{tenant.tenantKey} · {tenant.stores.length} unidade(s) · {tenant.domains.length} domínio(s)</p></button>)}</div></AdminSurface>
      <AdminSurface><h3 className="font-bold">Cadastrar empresa</h3><div className="mt-4 grid gap-3"><div><Label>Identificador</Label><Input value={tenantForm.tenantKey} onChange={(e) => setTenantForm((form) => ({ ...form, tenantKey: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="pizzaria-do-joao" /></div><div><Label>Nome comercial</Label><Input value={tenantForm.displayName} onChange={(e) => setTenantForm((form) => ({ ...form, displayName: e.target.value }))} /></div><div><Label>Razão social</Label><Input value={tenantForm.legalName} onChange={(e) => setTenantForm((form) => ({ ...form, legalName: e.target.value }))} /></div><div><Label>Documento</Label><Input value={tenantForm.document} onChange={(e) => setTenantForm((form) => ({ ...form, document: e.target.value }))} /></div><div><Label>Plano</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={tenantForm.planId} onChange={(e) => setTenantForm((form) => ({ ...form, planId: e.target.value }))}><option value="">Sem plano inicial</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div><Button disabled={saveTenant.isPending || tenantForm.tenantKey.length < 3 || !tenantForm.displayName || !tenantForm.legalName} onClick={() => saveTenant.mutate({ tenantKey: tenantForm.tenantKey, displayName: tenantForm.displayName, legalName: tenantForm.legalName, document: tenantForm.document || undefined, status: "setup_pending", planId: tenantForm.planId ? Number(tenantForm.planId) : undefined })}><Plus className="mr-2 h-4 w-4" />Criar empresa</Button></div></AdminSurface>
    </div>
    {selected && <AdminSurface><div className="flex flex-wrap items-end gap-3"><div className="min-w-72 flex-1"><Label>Novo domínio de {selected.displayName}</Label><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="pedidos.suapizzaria.com.br" /></div><Button disabled={!domain || addDomain.isPending} onClick={() => addDomain.mutate({ tenantId: selected.id, hostname: domain, kind: "custom_domain" })}><Plus className="mr-2 h-4 w-4" />Registrar domínio</Button></div><div className="mt-4 space-y-2">{selected.domains.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><strong>{item.hostname}</strong><p className="text-xs text-muted-foreground">TXT: _bonatto-verification.{item.hostname}</p></div><div className="flex items-center gap-2"><AdminPill>{item.status}</AdminPill><Button variant="ghost" size="icon" title="Copiar token" onClick={() => navigator.clipboard?.writeText(item.verificationToken)}><Copy className="h-4 w-4" /></Button></div></div>)}</div></AdminSurface>}
  </div>;
}

const defaultPlanEntitlements = {
  studio: true,
  automations: false,
  integrations: false,
  multiStore: false,
  advancedReports: false,
};

const defaultPlanLimits = {
  stores: 1,
  staffUsers: 5,
  monthlyOrders: 2_000,
  monthlyMessages: 500,
};

function PlatformPlansPanel() {
  const utils = trpc.useUtils();
  const overview = trpc.platform.tenancy.overview.useQuery();
  const planCatalog = trpc.platform.tenancy.plans.useQuery();
  const tenants = overview.data ?? [];
  const plans = planCatalog.data ?? [];
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({
    code: "",
    name: "",
    monthlyPrice: "",
    entitlements: defaultPlanEntitlements,
    limits: defaultPlanLimits,
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    planId: "",
    status: "trialing" as "trialing" | "active" | "past_due" | "suspended" | "cancelled",
    trialDays: "14",
    graceDays: "7",
  });

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0];
  const audit = trpc.platform.tenancy.audit.useQuery(
    { tenantId: selectedTenant?.id ?? 0, limit: 8 },
    { enabled: Boolean(selectedTenant?.id) },
  );
  const savePlan = trpc.platform.tenancy.savePlan.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.platform.tenancy.overview.invalidate(), utils.platform.tenancy.plans.invalidate()]);
      setPlanForm({ code: "", name: "", monthlyPrice: "", entitlements: defaultPlanEntitlements, limits: defaultPlanLimits });
      toast.success("Plano salvo com recursos e limites.");
    },
    onError: (error) => toast.error(error.message),
  });
  const setSubscription = trpc.platform.tenancy.setSubscription.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.platform.tenancy.overview.invalidate(), audit.refetch()]);
      toast.success("Assinatura da empresa atualizada.");
    },
    onError: (error) => toast.error(error.message),
  });
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AdminSurface className="overflow-hidden border-[#eaded8] bg-[#191412] text-white">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ffca28]">Controle comercial</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">Planos, limites e assinaturas</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">Defina o que cada empresa pode usar sem alterar código nem expor configurações de outra marca.</p>
            </div>
            <ShieldCheck className="size-7 shrink-0 text-[#ffca28]" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {plans.length ? plans.map((plan) => {
              const enabled = Object.values(plan.entitlements).filter(Boolean).length;
              return <button key={plan.id} type="button" onClick={() => setSubscriptionForm((form) => ({ ...form, planId: String(plan.id) }))} className={`rounded-2xl border p-4 text-left transition ${subscriptionForm.planId === String(plan.id) ? "border-[#ffca28] bg-white/10" : "border-white/10 bg-white/[.045] hover:bg-white/[.07]"}`}>
                <div className="flex items-center justify-between gap-3"><strong>{plan.name}</strong><span className="text-sm font-black text-[#ffca28]">{money.format(Number(plan.monthlyPrice))}</span></div>
                <p className="mt-2 text-xs text-white/45">{enabled} recursos · {Number(plan.limits.stores ?? 1)} loja(s) · {Number(plan.limits.monthlyOrders ?? 0).toLocaleString("pt-BR")} pedidos/mês</p>
              </button>;
            }) : <p className="text-sm text-white/45">Cadastre o primeiro plano para começar a vender o white label.</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 text-[#211719]">
          <div className="flex items-center gap-2"><CreditCard className="size-4 text-[#6e0d12]" /><h4 className="font-black">Nova oferta</h4></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>Código</Label><Input value={planForm.code} onChange={(event) => setPlanForm((form) => ({ ...form, code: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))} placeholder="pro" /></div>
            <div><Label>Nome</Label><Input value={planForm.name} onChange={(event) => setPlanForm((form) => ({ ...form, name: event.target.value }))} placeholder="Profissional" /></div>
            <div><Label>Mensalidade</Label><Input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={(event) => setPlanForm((form) => ({ ...form, monthlyPrice: event.target.value }))} /></div>
            <div><Label>Pedidos por mês</Label><Input type="number" min="0" value={planForm.limits.monthlyOrders} onChange={(event) => setPlanForm((form) => ({ ...form, limits: { ...form.limits, monthlyOrders: Number(event.target.value) } }))} /></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(planForm.entitlements).map(([key, enabled]) => <button type="button" key={key} onClick={() => setPlanForm((form) => ({ ...form, entitlements: { ...form.entitlements, [key]: !enabled } }))} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${enabled ? "border-[#6e0d12] bg-[#6e0d12] text-white" : "border-[#ded5cf] text-[#756b66]"}`}>{key}</button>)}
          </div>
          <Button className="mt-4 w-full" disabled={savePlan.isPending || planForm.code.length < 2 || planForm.name.length < 2 || planForm.monthlyPrice === ""} onClick={() => savePlan.mutate({ code: planForm.code, name: planForm.name, monthlyPrice: Number(planForm.monthlyPrice), entitlements: planForm.entitlements, limits: planForm.limits, active: true })}>Salvar plano</Button>
        </div>
      </div>

      {selectedTenant ? <div className="mt-6 grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-2">
        <div>
          <Label className="text-white/70">Empresa</Label>
          <select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white" value={selectedTenant.id} onChange={(event) => setSelectedTenantId(Number(event.target.value))}>{tenants.map((tenant) => <option className="text-black" key={tenant.id} value={tenant.id}>{tenant.displayName}</option>)}</select>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><Label className="text-white/70">Plano</Label><select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white" value={subscriptionForm.planId || selectedTenant.subscription?.planId || ""} onChange={(event) => setSubscriptionForm((form) => ({ ...form, planId: event.target.value }))}><option className="text-black" value="">Selecione</option>{plans.filter((plan) => plan.active).map((plan) => <option className="text-black" key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div>
            <div><Label className="text-white/70">Status</Label><select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white" value={subscriptionForm.status} onChange={(event) => setSubscriptionForm((form) => ({ ...form, status: event.target.value as typeof form.status }))}>{["trialing", "active", "past_due", "suspended", "cancelled"].map((status) => <option className="text-black" key={status} value={status}>{status}</option>)}</select></div>
            <div><Label className="text-white/70">Teste (dias)</Label><Input className="border-white/10 bg-white/10 text-white" type="number" min="0" max="365" value={subscriptionForm.trialDays} onChange={(event) => setSubscriptionForm((form) => ({ ...form, trialDays: event.target.value }))} /></div>
            <div><Label className="text-white/70">Carência (dias)</Label><Input className="border-white/10 bg-white/10 text-white" type="number" min="0" max="90" value={subscriptionForm.graceDays} onChange={(event) => setSubscriptionForm((form) => ({ ...form, graceDays: event.target.value }))} /></div>
          </div>
          <Button className="mt-3 bg-[#e51b23] hover:bg-[#c9141b]" disabled={setSubscription.isPending || !(subscriptionForm.planId || selectedTenant.subscription?.planId)} onClick={() => setSubscription.mutate({ tenantId: selectedTenant.id, planId: Number(subscriptionForm.planId || selectedTenant.subscription?.planId), status: subscriptionForm.status, trialDays: Number(subscriptionForm.trialDays), graceDays: Number(subscriptionForm.graceDays) })}>Atualizar assinatura</Button>
        </div>
        <div>
          <div className="flex items-center gap-2"><Clock3 className="size-4 text-[#ffca28]" /><h4 className="font-black">Atividade recente</h4></div>
          <div className="mt-3 space-y-2">{audit.data?.length ? audit.data.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.055] px-3 py-2"><div><p className="text-xs font-bold">{item.action}</p><p className="text-[10px] text-white/40">{item.resourceType} #{item.resourceId ?? "-"}</p></div><time className="text-[10px] text-white/35">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</time></div>) : <p className="text-sm text-white/45">As próximas alterações críticas aparecerão aqui.</p>}</div>
        </div>
      </div> : null}
    </AdminSurface>
  );
}

function CommercePanel({ storeId }: { storeId: number }) {
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const products = trpc.products.listAll.useQuery({ storeId });
  const filteredProducts = (products.data ?? []).filter((product) => product.name.toLowerCase().includes(productSearch.toLowerCase()));
  const query = trpc.platform.commerce.adminConfiguration.useQuery(
    { storeId, productId: Number(productId) },
    { enabled: Number(productId) > 0 },
  );
  return <AdminSurface>
    <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
      <div><Label htmlFor="platform-product-search">Buscar produto</Label><Input id="platform-product-search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nome do produto" /></div>
      <div><Label htmlFor="platform-product">Produto</Label><select id="platform-product" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione um produto</option>{filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · R$ {Number(product.price).toFixed(2)}</option>)}</select></div>
      <AdminPill>{query.data?.length ?? 0} grupos configurados</AdminPill>
    </div>
    {products.isError ? <AdminEmptyState title="Não foi possível carregar os produtos" description={products.error.message} /> : !productId ? <AdminEmptyState title={products.isLoading ? "Carregando produtos" : products.data?.length ? "Escolha um produto" : "Nenhum produto cadastrado nesta loja"} description="Configure tamanhos, sabores, bordas e adicionais sem alterar os produtos existentes." /> : query.isLoading ? <Loading /> :
      <div className="mt-5 grid gap-3 md:grid-cols-2">{query.data?.map((group) => <div key={group.id} className="rounded-2xl border p-4"><strong>{group.name}</strong><p className="text-sm text-muted-foreground">{group.kind} · {group.required ? "obrigatório" : "opcional"} · até {group.maxSelections}</p><div className="mt-3 flex flex-wrap gap-2">{group.options.map((option) => <AdminPill key={option.id}>{option.name} {Number(option.priceDelta) > 0 ? `+ R$ ${Number(option.priceDelta).toFixed(2)}` : ""}</AdminPill>)}</div></div>)}</div>}
  </AdminSurface>;
}

function OperationsPanel({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const board = trpc.platform.operations.board.useQuery({ storeId }, { refetchInterval: 15_000 });
  const stock = trpc.platform.operations.stockRisk.useQuery({ storeId });
  const transition = trpc.platform.operations.transitionTicket.useMutation({ onSuccess: () => utils.platform.operations.board.invalidate() });
  const tickets = board.data ?? [];
  return <div className="space-y-4"><AdminStatGrid><AdminStat label="Na fila" value={tickets.filter((item) => item.status === "queued").length} /><AdminStat label="Em preparo" value={tickets.filter((item) => item.status === "preparing").length} /><AdminStat label="Atrasados" value={tickets.filter((item) => item.delayed).length} /><AdminStat label="Estoque crítico" value={stock.data?.filter((item) => item.critical).length ?? 0} /></AdminStatGrid>
    <div className="grid gap-4 lg:grid-cols-3">{(["queued", "preparing", "ready"] as const).map((status) => <AdminSurface key={status}><h3 className="mb-3 font-bold">{status === "queued" ? "Aguardando" : status === "preparing" ? "Preparando" : "Prontos"}</h3>{tickets.filter((item) => item.status === status).map((ticket) => <div key={ticket.id} className={`mb-3 rounded-2xl border p-4 ${ticket.delayed ? "border-red-400 bg-red-50" : "bg-white"}`}><div className="flex justify-between"><strong>Pedido #{ticket.orderId}</strong><AdminPill>{ticket.elapsedMinutes} min</AdminPill></div><p className="mt-1 text-sm text-muted-foreground">{ticket.order?.customerName ?? "Cliente"}</p>{status !== "ready" && <Button size="sm" className="mt-3 w-full" onClick={() => transition.mutate({ storeId, ticketId: ticket.id, status: status === "queued" ? "preparing" : "ready" })}>{status === "queued" ? "Iniciar preparo" : "Marcar pronto"}</Button>}</div>)}</AdminSurface>)}</div>
  </div>;
}

function GrowthPanel({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const settings = trpc.platform.growth.settings.useQuery({ storeId });
  const [cashback, setCashback] = useState("");
  const [points, setPoints] = useState("");
  const save = trpc.platform.growth.saveSettings.useMutation({ onSuccess: async () => { await utils.platform.growth.settings.invalidate(); toast.success("Regras de fidelização salvas."); } });
  const currentCashback = cashback || String(settings.data?.cashbackPercent ?? "0");
  const currentPoints = points || String(settings.data?.pointsPerReal ?? "1");
  return <div className="grid gap-4 lg:grid-cols-2">
    <AdminSurface>
      <h3 className="font-bold">Economia de fidelização</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><Label>Cashback (%)</Label><Input type="number" min="0" max="30" value={currentCashback} onChange={(e) => setCashback(e.target.value)} /></div>
        <div><Label>Pontos por real</Label><Input type="number" min="0" max="100" value={currentPoints} onChange={(e) => setPoints(e.target.value)} /></div>
      </div>
      <Button className="mt-4" disabled={save.isPending} onClick={() => save.mutate({ storeId, cashbackPercent: Number(currentCashback), pointsPerReal: Number(currentPoints), referralReferrerPoints: settings.data?.referralReferrerPoints ?? 100, referralReferredPoints: settings.data?.referralReferredPoints ?? 50, npsEnabled: settings.data?.npsEnabled ?? true })}>Salvar regras</Button>
    </AdminSurface>
    <AdminSurface>
      <Gift className="h-6 w-6 text-primary" />
      <h3 className="mt-3 font-bold">Clube de Recompensas</h3>
      <p className="mt-2 text-sm text-muted-foreground">A criação, o estoque de códigos, os resgates e os estornos ficam centralizados no módulo seguro do clube.</p>
      <Link href="/admin?tab=rewards"><Button className="mt-4">Abrir Clube de Recompensas</Button></Link>
    </AdminSurface>
  </div>;
}

function IntegrationsPanel({ storeId }: { storeId: number }) {
  const health = trpc.platform.integrations.health.useQuery({ storeId });
  return <><AdminStatGrid><AdminStat label="Conectadas" value={health.data?.healthy ?? 0} /><AdminStat label="Com falha" value={health.data?.degraded ?? 0} /><AdminStat label="Desconectadas" value={health.data?.disconnected ?? 0} /></AdminStatGrid><AdminSurface><h3 className="font-bold">Saúde dos provedores</h3>{health.data?.connections.length ? <div className="mt-3 space-y-2">{health.data.connections.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border p-3"><span className="font-medium">{item.provider}</span><AdminPill><Activity className="mr-1 h-3 w-3" />{item.status}</AdminPill></div>)}</div> : <AdminEmptyState title="Nenhuma conexão registrada" description="As credenciais continuam em variáveis seguras; esta central guarda somente referências e estado operacional." />}</AdminSurface></>;
}

function IntelligencePanel({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const dashboard = trpc.platform.intelligence.dashboard.useQuery({ storeId });
  const generate = trpc.platform.intelligence.generateSuggestions.useMutation({ onSuccess: async (data) => { await utils.platform.intelligence.dashboard.invalidate(); toast.success(`${data.created} recomendação(ões) atualizada(s).`); } });
  const summary = dashboard.data?.summary as Record<string, string | number> | undefined;
  return <><div className="mb-4 flex justify-end"><Button onClick={() => generate.mutate({ storeId })}><RefreshCw className="mr-2 h-4 w-4" />Atualizar recomendações</Button></div><AdminStatGrid><AdminStat label="Pedidos em 30 dias" value={Number(summary?.totalOrders ?? 0)} /><AdminStat label="Ticket médio" value={`R$ ${Number(summary?.averageTicket ?? 0).toFixed(2)}`} /><AdminStat label="Tempo médio de cozinha" value={`${Number(summary?.averageKitchenMinutes ?? 0)} min`} /><AdminStat label="Cancelamentos" value={Number(summary?.cancelledOrders ?? 0)} /></AdminStatGrid><div className="grid gap-3">{dashboard.data?.suggestions.map((suggestion) => <AdminSurface key={suggestion.id}><div className="flex gap-3"><BrainCircuit className="mt-1 h-5 w-5 text-primary" /><div><strong>{suggestion.title}</strong><p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p><AdminPill className="mt-3">Confiança: {suggestion.confidence}%</AdminPill></div></div></AdminSurface>)}</div></>;
}

function Loading() { return <div className="py-12 text-center text-sm text-muted-foreground" role="status">Carregando dados...</div>; }
