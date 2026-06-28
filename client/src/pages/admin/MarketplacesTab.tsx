import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowRightCircle, ExternalLink, Link2, Package, RefreshCw, ShoppingBag, Store, Tag } from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminPage, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MarketplaceOverview = RouterOutputs["marketplaces"]["overview"];
type MarketplaceProvider = MarketplaceOverview["providers"][number];
type MarketplaceProviderId = MarketplaceProvider["id"];

type ProviderFormState = {
  enabled: boolean;
  merchantId: string;
  externalStoreId: string;
  regionHint: string;
  aggregationIdsText: string;
  notes: string;
};

const CAPABILITY_LABELS: Record<MarketplaceProvider["capabilities"][number], string> = {
  orders: "Pedidos",
  catalog: "Catalogo",
  promotions: "Promocoes",
  status_updates: "Status",
  webhooks: "Webhooks",
  polling: "Polling",
  store_sync: "Lojas",
  delivery_status: "Entrega",
};

const CONNECTION_LABELS: Record<MarketplaceProvider["runtime"]["connectionState"], { label: string; tone: string }> = {
  ready: { label: "Pronto", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  credentials_ready: { label: "Credenciais prontas", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  missing_credentials: { label: "Faltam credenciais", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  disabled: { label: "Desativado", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  planned: { label: "Base pronta", tone: "bg-violet-50 text-violet-700 border-violet-200" },
};

const ONBOARDING_LABELS: Record<MarketplaceProvider["onboarding"], string> = {
  public_docs: "Docs publicas",
  partner_program: "Programa de parceiros",
  restricted_partner: "Acesso restrito a parceiro",
};

const ACCESS_MODE_LABELS: Record<MarketplaceProvider["accessMode"], string> = {
  oauth_login: "Login oficial",
  partner_portal: "Portal do parceiro",
  partner_request: "Solicitacao manual",
};

function providerToForm(provider: MarketplaceProvider): ProviderFormState {
  return {
    enabled: provider.config.enabled,
    merchantId: provider.config.merchantId,
    externalStoreId: provider.config.externalStoreId,
    regionHint: provider.config.regionHint,
    aggregationIdsText: provider.config.aggregationIds.join(", "),
    notes: provider.config.notes,
  };
}

function parseAggregationIds(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MarketplacesTab() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.marketplaces.overview.useQuery();
  const providers = overviewQuery.data?.providers ?? [];
  const [selectedProviderId, setSelectedProviderId] = useState<MarketplaceProviderId>("ifood");
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const [form, setForm] = useState<ProviderFormState | null>(null);

  useEffect(() => {
    if (!selectedProvider) return;
    setForm(providerToForm(selectedProvider));
  }, [selectedProvider]);

  const saveConfig = trpc.marketplaces.saveConfig.useMutation({
    onSuccess: async () => {
      await utils.marketplaces.overview.invalidate();
      toast.success("Configuracao do marketplace salva.");
    },
    onError: (error) => toast.error(error.message),
  });

  const testConnection = trpc.marketplaces.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.message(result.message);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const syncCatalog = trpc.marketplaces.syncCatalog.useMutation({
    onSuccess: async (result) => {
      await utils.marketplaces.overview.invalidate();
      const totals = result.merchants.reduce(
        (acc, merchant) => {
          acc.products += merchant.productsImported + merchant.productsUpdated;
          acc.categories += merchant.categoriesImported + merchant.categoriesUpdated;
          return acc;
        },
        { products: 0, categories: 0 },
      );
      toast.success(`Catalogo sincronizado: ${totals.products} produto(s) e ${totals.categories} categoria(s).`);
    },
    onError: (error) => toast.error(error.message),
  });

  const syncPromotions = trpc.marketplaces.syncPromotions.useMutation({
    onSuccess: async (result) => {
      await utils.marketplaces.overview.invalidate();
      const totalPromotions = result.merchants.reduce(
        (acc, merchant) => acc + merchant.promotionsImported + merchant.promotionsUpdated,
        0,
      );
      toast.success(`Promocoes sincronizadas: ${totalPromotions} registro(s).`);
      if (result.note) toast.message(result.note);
    },
    onError: (error) => toast.error(error.message),
  });

  const pullOrders = trpc.marketplaces.pullOrders.useMutation({
    onSuccess: () => toast.success("Importacao de eventos executada."),
    onError: (error) => toast.error(error.message),
  });

  const capabilitySummary = useMemo(() => {
    return selectedProvider?.capabilities.map((capability) => CAPABILITY_LABELS[capability]) ?? [];
  }, [selectedProvider]);

  if (overviewQuery.isLoading || !selectedProvider || !form) {
    return (
      <AdminPage>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminPage>
    );
  }

  const selectedConnectionTone = CONNECTION_LABELS[selectedProvider.runtime.connectionState];

  return (
    <AdminPage className="max-w-7xl space-y-5">
      <AdminTopbar
        title="Marketplaces de delivery"
        subtitle="Hub unico para mapear, ativar e operar integracoes com as principais plataformas de delivery."
        onRefresh={() => {
          void overviewQuery.refetch();
        }}
        refreshing={overviewQuery.isRefetching}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Docs oficiais
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={selectedProvider.portalUrl} target="_blank" rel="noreferrer">
                <ArrowRightCircle className="w-4 h-4" />
                {selectedProvider.accessLabel}
              </a>
            </Button>
          </div>
        }
      />

      <AdminStatGrid>
        <AdminStat
          label="Plataformas mapeadas"
          value={providers.length}
          icon={<ShoppingBag className="w-4 h-4" />}
          sub="Top 10 hubs pesquisados"
        />
        <AdminStat
          label="Prontas para operar"
          value={overviewQuery.data?.readyCount ?? 0}
          icon={<Link2 className="w-4 h-4" />}
          sub="Com credenciais e habilitacao"
        />
        <AdminStat
          label="Implementadas nativamente"
          value={overviewQuery.data?.implementedCount ?? 0}
          icon={<Store className="w-4 h-4" />}
          sub="Fluxos reais no backend"
        />
        <AdminStat
          label="Na fila de ativacao"
          value={overviewQuery.data?.plannedCount ?? 0}
          icon={<RefreshCw className="w-4 h-4" />}
          sub="Aguardando credenciais de parceiro"
        />
      </AdminStatGrid>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AdminSurface
          title="Plataformas"
          subtitle="Selecione a integracao para ver requisitos e configuracoes."
          bodyClassName="space-y-2"
        >
          {providers.map((provider) => {
            const state = CONNECTION_LABELS[provider.runtime.connectionState];
            const selected = provider.id === selectedProvider.id;
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProviderId(provider.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-[#6E0D12] bg-[#fff7f7] shadow-sm"
                    : "border-border bg-background hover:border-[#d8b1b4] hover:bg-[#fffafb]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{provider.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                  <Badge className={`border ${state.tone}`}>{state.label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{provider.implemented ? "Nativo" : "Preparado"}</Badge>
                  <Badge variant="outline">{ONBOARDING_LABELS[provider.onboarding]}</Badge>
                </div>
              </button>
            );
          })}
        </AdminSurface>

        <div className="space-y-4">
          <AdminSurface
            title={selectedProvider.name}
            subtitle={selectedProvider.description}
            actions={<Badge className={`border ${selectedConnectionTone.tone}`}>{selectedConnectionTone.label}</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cobertura</p>
                  <p className="mt-1 text-sm text-foreground">{selectedProvider.regions.join(" • ")}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Onboarding</p>
                  <p className="mt-1 text-sm text-foreground">{ONBOARDING_LABELS[selectedProvider.onboarding]}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fluxo de acesso</p>
                  <p className="mt-1 text-sm text-foreground">{ACCESS_MODE_LABELS[selectedProvider.accessMode]}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedProvider.accessHelp}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Credenciais esperadas</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProvider.requiredEnv.map((variableName) => (
                      <code
                        key={variableName}
                        className="rounded-lg border bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700"
                      >
                        {variableName}
                      </code>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Capacidades</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {capabilitySummary.map((capability) => (
                      <Badge key={capability} variant="outline">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-border bg-slate-50/70 p-4 text-sm text-muted-foreground">
                  {selectedProvider.implemented
                    ? "Esta integracao ja tem fluxo nativo no backend Bonatto e pode executar acoes reais quando as credenciais estiverem prontas."
                    : "A base de configuracao, governanca e status ja esta pronta. A ativacao operacional depende da liberacao do programa de parceiros e das credenciais oficiais da plataforma."}
                </div>
                <div className="rounded-2xl border border-[#eadfdf] bg-[#fff8f8] p-4 text-sm text-[#6E0D12]">
                  Clique em <strong>{selectedProvider.accessLabel}</strong> para entrar no fluxo oficial dessa plataforma. Onde houver OAuth ou login direto, esse botao sera a base do conector. Onde a plataforma exigir homologacao, ele leva para o portal certo sem tirar o operador do caminho.
                </div>
              </div>
            </div>
          </AdminSurface>

          <AdminSurface
            title="Configuracao da loja"
            subtitle="Campos seguros para persistir referencias operacionais sem expor segredos no navegador."
            actions={
              <Button
                size="sm"
                onClick={() => {
                  saveConfig.mutate({
                    providerId: selectedProvider.id,
                    config: {
                      enabled: form.enabled,
                      merchantId: form.merchantId,
                      externalStoreId: form.externalStoreId,
                      regionHint: form.regionHint,
                      aggregationIds: parseAggregationIds(form.aggregationIdsText),
                      notes: form.notes,
                    },
                  });
                }}
                disabled={saveConfig.isPending}
              >
                {saveConfig.isPending ? "Salvando..." : "Salvar configuracao"}
              </Button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                  <div>
                    <p className="font-medium">Ativar marketplace</p>
                    <p className="text-sm text-muted-foreground">Define se a loja quer operar este canal.</p>
                  </div>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) => setForm((current) => current ? { ...current, enabled: checked } : current)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketplace-merchant">Merchant ID / Store ID principal</Label>
                  <Input
                    id="marketplace-merchant"
                    value={form.merchantId}
                    onChange={(event) => setForm((current) => current ? { ...current, merchantId: event.target.value } : current)}
                    placeholder="Ex.: merchant oficial da plataforma"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketplace-store">Referencia externa da loja</Label>
                  <Input
                    id="marketplace-store"
                    value={form.externalStoreId}
                    onChange={(event) => setForm((current) => current ? { ...current, externalStoreId: event.target.value } : current)}
                    placeholder="Codigo da loja no parceiro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketplace-region">Regiao / observacao operacional</Label>
                  <Input
                    id="marketplace-region"
                    value={form.regionHint}
                    onChange={(event) => setForm((current) => current ? { ...current, regionHint: event.target.value } : current)}
                    placeholder="Ex.: BH centro, zona sul, dark kitchen 02"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="marketplace-aggregation">Aggregation IDs / codigos auxiliares</Label>
                  <Textarea
                    id="marketplace-aggregation"
                    value={form.aggregationIdsText}
                    onChange={(event) => setForm((current) => current ? { ...current, aggregationIdsText: event.target.value } : current)}
                    placeholder="Use virgula ou quebra de linha para separar IDs auxiliares."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketplace-notes">Notas internas</Label>
                  <Textarea
                    id="marketplace-notes"
                    value={form.notes}
                    onChange={(event) => setForm((current) => current ? { ...current, notes: event.target.value } : current)}
                    placeholder="Webhook configurado via parceiro, taxa diferenciada, conta homologacao, etc."
                    rows={5}
                  />
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Segredos sensiveis ficam apenas em variaveis de ambiente do servidor. Esta tela salva so metadados operacionais por seguranca.
                </div>
              </div>
            </div>
          </AdminSurface>

          <AdminSurface
            title="Acoes operacionais"
            subtitle="Ferramentas de teste e sincronizacao do canal selecionado."
            bodyClassName="space-y-3"
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => testConnection.mutate({ providerId: selectedProvider.id })}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? "Testando..." : "Testar conexao"}
              </Button>

              {selectedProvider.id === "ifood" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      syncCatalog.mutate({
                        providerId: selectedProvider.id,
                        merchantId: form.merchantId || undefined,
                      })
                    }
                    disabled={syncCatalog.isPending}
                  >
                    <Package className="w-4 h-4" />
                    {syncCatalog.isPending ? "Sincronizando catalogo..." : "Sincronizar catalogo"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() =>
                      syncPromotions.mutate({
                        providerId: selectedProvider.id,
                        merchantId: form.merchantId || undefined,
                        aggregationIds: parseAggregationIds(form.aggregationIdsText),
                      })
                    }
                    disabled={syncPromotions.isPending}
                  >
                    <Tag className="w-4 h-4" />
                    {syncPromotions.isPending ? "Sincronizando promocoes..." : "Sincronizar promocoes"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => pullOrders.mutate({ providerId: selectedProvider.id })}
                    disabled={pullOrders.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 ${pullOrders.isPending ? "animate-spin" : ""}`} />
                    {pullOrders.isPending ? "Importando pedidos..." : "Puxar eventos agora"}
                  </Button>
                </>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Fluxo de pedidos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedProvider.capabilities.includes("orders")
                    ? "Canal mapeado para ingestao de pedidos."
                    : "Sem fluxo oficial de pedidos para esta plataforma."}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Catalogo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedProvider.capabilities.includes("catalog")
                    ? "Canal com trilha de sincronizacao de menu/catalogo."
                    : "Sem sincronizacao nativa de catalogo no momento."}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Observabilidade</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedProvider.runtime.canExecuteNativeActions
                    ? "Backend apto a executar acoes reais neste ambiente."
                    : "Ainda faltam credenciais ou implementacao nativa para a operacao completa."}
                </p>
              </div>
            </div>
          </AdminSurface>
        </div>
      </div>
    </AdminPage>
  );
}
