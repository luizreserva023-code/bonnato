import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  Globe2,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  WHITE_LABEL_ADMIN_TABS,
  WHITE_LABEL_PAGE_KEYS,
  TENANT_LEGACY_FEATURES,
  type WhiteLabelAdminTab,
  type WhiteLabelFeatureFlags,
  type WhiteLabelPageKey,
  type WhiteLabelRuntimeConfig,
} from "@shared/whiteLabel";

type BrandAssetKind = "logo" | "wordmark" | "favicon" | "waiter";
type BrandLogoKey = keyof WhiteLabelRuntimeConfig["brand"]["logos"];
type FeatureKey = Exclude<keyof WhiteLabelFeatureFlags, "adminTabs">;

const PAGE_LABELS: Record<WhiteLabelPageKey, string> = {
  home: "Página inicial",
  menu: "Cardápio",
  checkout: "Checkout",
  orders: "Meus pedidos",
  profile: "Minha conta",
  club: "Clube",
  tracking: "Rastreamento",
  driver: "Aplicativo do motoboy",
  waiter: "Aplicativo do garçom",
};

const ADMIN_TAB_LABELS: Record<WhiteLabelAdminTab, string> = {
  dashboard: "Dashboard",
  orders: "Pedidos",
  menu: "Cardápio",
  club: "Clube",
  inventory: "Estoque",
  staff: "Equipe",
  dining: "Salão e mesas",
  coupons: "Cupons",
  reports: "Relatórios",
  network: "Rede e financeiro",
  distribution: "Centro de distribuição",
  promotions: "Promoções",
  raffles: "Sorteios",
  upsells: "Venda adicional",
  users: "Clientes",
  drivers: "Motoboys",
  marketplaces: "Integrações",
  payments: "Pagamentos",
  settings: "Configurações",
  platform: "Central de Crescimento",
  stores: "Unidades",
  recovery: "Recuperação",
};

const FEATURE_LABELS: Array<{ key: FeatureKey; label: string; description: string }> = [
  { key: "crm", label: "CRM", description: "Segmentação e histórico dos clientes." },
  { key: "automations", label: "Automações", description: "Jornadas e ações programadas." },
  { key: "notifications", label: "Notificações", description: "Push e avisos operacionais." },
  { key: "deliveryZones", label: "Zonas de entrega", description: "Regras de área, distância e taxa." },
  { key: "salesDashboard", label: "Dashboard comercial", description: "Indicadores avançados de vendas." },
  { key: "waiterApp", label: "Aplicativo do garçom", description: "Mesas, comandas, gorjetas e alertas." },
  { key: "driverApp", label: "Aplicativo do motoboy", description: "Fila e acompanhamento de entregas." },
  { key: "loyalty", label: "Fidelidade", description: "Pontos e resgate em pedidos." },
  { key: "club", label: "Clube de assinatura", description: "Planos e benefícios recorrentes." },
  { key: "inventory", label: "Estoque", description: "Ingredientes, fichas técnicas e baixas." },
  { key: "diningRoom", label: "Salão", description: "Operação de mesas e comandas." },
  { key: "marketplaces", label: "Marketplaces", description: "Conexões com canais de delivery." },
  { key: "auditTrail", label: "Auditoria", description: "Rastreamento das ações administrativas." },
  { key: "healthPanel", label: "Saúde do sistema", description: "Status de serviços e integrações." },
  { key: "globalSearch", label: "Busca global", description: "Pedido, cliente, mesa e conversa." },
];

const BRAND_ASSETS: Array<{ kind: BrandAssetKind; key: BrandLogoKey; label: string }> = [
  { kind: "logo", key: "icon", label: "Símbolo / logo" },
  { kind: "wordmark", key: "wordmark", label: "Logo horizontal" },
  { kind: "favicon", key: "favicon", label: "Ícone do navegador" },
  { kind: "waiter", key: "waiter", label: "Logo operacional" },
];

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={`Ativar ${label}`} />
    </div>
  );
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export function WhiteLabelEditor({
  storeId,
  storeName,
  open,
  onOpenChange,
}: {
  storeId: number | null;
  storeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [config, setConfig] = useState<WhiteLabelRuntimeConfig | null>(null);
  const isPrimaryTenant = config?.tenantKey === "bonatto";
  const [uploadingKind, setUploadingKind] = useState<BrandAssetKind | null>(null);
  const [editorEmail, setEditorEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAssetRef = useRef<{ kind: BrandAssetKind; key: BrandLogoKey } | null>(null);
  const tenantLegacyFeatures = new Set<string>(TENANT_LEGACY_FEATURES);
  const { data, isLoading, error } = trpc.stores.whiteLabelConfig.useQuery(
    { storeId: storeId ?? 0 },
    { enabled: open && storeId !== null },
  );

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const save = trpc.stores.saveWhiteLabelConfig.useMutation({
    onSuccess: (saved) => {
      if (saved) setConfig(saved);
      utils.stores.resolveTenant.invalidate();
      utils.stores.whiteLabelConfig.invalidate({ storeId: storeId ?? 0 });
      toast.success("Identidade e plataforma atualizadas.");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const upload = trpc.stores.uploadBrandAsset.useMutation({
    onSuccess: (result) => {
      const target = pendingAssetRef.current;
      if (!target) return;
      setConfig((current) => current ? {
        ...current,
        brand: {
          ...current.brand,
          logos: { ...current.brand.logos, [target.key]: result.url },
        },
      } : current);
      toast.success("Imagem enviada. Salve para aplicar a alteração.");
    },
    onError: (mutationError) => toast.error(mutationError.message),
    onSettled: () => {
      setUploadingKind(null);
      pendingAssetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const grantEditor = trpc.siteStudio.grantEditor.useMutation({
    onSuccess: () => { setEditorEmail(""); toast.success("Acesso ao Studio concedido."); },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  function updateBrand<K extends keyof WhiteLabelRuntimeConfig["brand"]>(key: K, value: WhiteLabelRuntimeConfig["brand"][K]) {
    setConfig((current) => current ? { ...current, brand: { ...current.brand, [key]: value } } : current);
  }

  function updatePage(key: WhiteLabelPageKey, patch: Partial<WhiteLabelRuntimeConfig["pages"][WhiteLabelPageKey]>) {
    setConfig((current) => current ? {
      ...current,
      pages: { ...current.pages, [key]: { ...current.pages[key], ...patch } },
    } : current);
  }

  function updateFeature(key: FeatureKey, value: boolean) {
    setConfig((current) => current ? {
      ...current,
      features: { ...current.features, [key]: value },
    } : current);
  }

  function updateAdminTab(key: WhiteLabelAdminTab, value: boolean) {
    setConfig((current) => current ? {
      ...current,
      features: {
        ...current.features,
        adminTabs: { ...current.features.adminTabs, [key]: value },
      },
    } : current);
  }

  function selectAsset(kind: BrandAssetKind, key: BrandLogoKey) {
    pendingAssetRef.current = { kind, key };
    fileInputRef.current?.click();
  }

  function handleAssetFile(file?: File) {
    const target = pendingAssetRef.current;
    if (!file || !target || storeId === null) return;
    if (!(["image/jpeg", "image/png", "image/webp", "image/gif"] as string[]).includes(file.type)) {
      toast.error("Use uma imagem JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 3 MB.");
      return;
    }
    setUploadingKind(target.kind);
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = String(reader.result ?? "").split(",")[1];
      if (!encoded) {
        setUploadingKind(null);
        toast.error("Não foi possível ler a imagem.");
        return;
      }
      upload.mutate({
        storeId,
        kind: target.kind,
        base64: encoded,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!config) return;
    const { storeSlug: _storeSlug, ...payload } = config;
    save.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden border-slate-200 bg-[#f7f8fa] p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Palette className="size-5 text-[#6E0D12]" />
                Marca e plataforma
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{storeName}: identidade, páginas, módulos e canais independentes.</p>
            </div>
            {config && (
              <div className="flex items-center gap-2 pr-8">
                <Badge variant="outline" className="bg-slate-50 uppercase">{config.plan}</Badge>
                <Badge className={config.status === "active" ? "bg-emerald-600" : "bg-amber-600"}>
                  {config.status === "active" ? "Ativa" : config.status === "inactive" ? "Inativa" : "Em configuração"}
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-[520px] items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-5 animate-spin" /> Carregando configuração...
          </div>
        ) : error ? (
          <div className="flex h-[520px] items-center justify-center px-8 text-center text-sm text-red-600">{error.message}</div>
        ) : config ? (
          <Tabs defaultValue="brand" className="min-h-0 flex-1 gap-0 overflow-hidden">
            <div className="border-b border-slate-200 bg-white px-4 py-2">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
                <TabsTrigger value="brand"><Palette /> Identidade</TabsTrigger>
                <TabsTrigger value="pages"><LayoutTemplate /> Páginas</TabsTrigger>
                <TabsTrigger value="features"><Settings2 /> Recursos</TabsTrigger>
                <TabsTrigger value="providers"><CreditCard /> Provedores</TabsTrigger>
                <TabsTrigger value="domain"><Globe2 /> Publicação</TabsTrigger>
                <TabsTrigger value="studio"><LayoutTemplate /> Studio</TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
              <TabsContent value="brand" className="mt-0 space-y-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Nome da marca"><Input value={config.brand.name} onChange={(event) => updateBrand("name", event.target.value)} /></FormField>
                      <FormField label="Nome curto"><Input value={config.brand.shortName} onChange={(event) => updateBrand("shortName", event.target.value)} /></FormField>
                      <FormField label="Título do painel"><Input value={config.brand.adminTitle} onChange={(event) => updateBrand("adminTitle", event.target.value)} /></FormField>
                      <FormField label="Texto de entrega"><Input value={config.brand.deliveryLabel} onChange={(event) => updateBrand("deliveryLabel", event.target.value)} /></FormField>
                    </div>
                    <FormField label="Assinatura da marca"><Textarea value={config.brand.tagline} onChange={(event) => updateBrand("tagline", event.target.value)} /></FormField>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      {Object.entries(config.brand.colors).map(([key, value]) => (
                        <FormField key={key} label={{ primary: "Primária", primaryDark: "Primária escura", accent: "Destaque", background: "Fundo", text: "Texto" }[key] ?? key}>
                          <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-2">
                            <input
                              type="color"
                              value={value}
                              onChange={(event) => updateBrand("colors", { ...config.brand.colors, [key]: event.target.value })}
                              className="size-6 cursor-pointer border-0 bg-transparent p-0"
                              aria-label={`Selecionar cor ${key}`}
                            />
                            <Input
                              value={value}
                              onChange={(event) => updateBrand("colors", { ...config.brand.colors, [key]: event.target.value })}
                              className="h-8 border-0 px-0 font-mono text-xs shadow-none focus-visible:ring-0"
                            />
                          </div>
                        </FormField>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {BRAND_ASSETS.map((asset) => (
                        <div key={asset.kind} className="rounded-xl border border-slate-200 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold">{asset.label}</Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => selectAsset(asset.kind, asset.key)} disabled={uploadingKind !== null}>
                              {uploadingKind === asset.kind ? <Loader2 className="animate-spin" /> : <ImagePlus />} Enviar
                            </Button>
                          </div>
                          <Input
                            value={config.brand.logos[asset.key]}
                            onChange={(event) => updateBrand("logos", { ...config.brand.logos, [asset.key]: event.target.value })}
                            placeholder="https://... ou /arquivo"
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => handleAssetFile(event.target.files?.[0])} />
                  </section>

                  <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="h-28" style={{ background: `linear-gradient(135deg, ${config.brand.colors.primary}, ${config.brand.colors.primaryDark})` }} />
                    <div className="relative px-5 pb-5">
                      <div className="-mt-8 flex size-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg">
                        {config.brand.logos.icon ? <img src={config.brand.logos.icon} alt="Prévia da logo" className="size-full object-contain" /> : <span className="text-xl font-black" style={{ color: config.brand.colors.primary }}>{config.brand.shortName.slice(0, 2).toUpperCase()}</span>}
                      </div>
                      <h3 className="mt-4 text-xl font-black" style={{ color: config.brand.colors.text }}>{config.brand.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{config.brand.tagline}</p>
                      <Button className="mt-5 w-full text-white" style={{ backgroundColor: config.brand.colors.primary }}>Ver cardápio</Button>
                      <p className="mt-3 text-center text-xs text-slate-400">Prévia rápida da identidade</p>
                    </div>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent value="pages" className="mt-0 space-y-3">
                {WHITE_LABEL_PAGE_KEYS.map((pageKey) => {
                  const page = config.pages[pageKey];
                  return (
                    <section key={pageKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{PAGE_LABELS[pageKey]}</h3>
                          <p className="text-xs text-slate-500">/{pageKey === "home" ? "" : pageKey}</p>
                        </div>
                        <Switch checked={page.enabled} onCheckedChange={(checked) => updatePage(pageKey, { enabled: checked })} disabled={!isPrimaryTenant && pageKey === "club"} aria-label={`Ativar ${PAGE_LABELS[pageKey]}`} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField label="Título"><Input value={page.title} onChange={(event) => updatePage(pageKey, { title: event.target.value })} /></FormField>
                        <FormField label="Imagem de destaque"><Input value={page.heroImage} onChange={(event) => updatePage(pageKey, { heroImage: event.target.value })} placeholder="https://..." /></FormField>
                        <div className="md:col-span-2"><FormField label="Descrição"><Textarea value={page.description} onChange={(event) => updatePage(pageKey, { description: event.target.value })} /></FormField></div>
                      </div>
                    </section>
                  );
                })}
              </TabsContent>

              <TabsContent value="features" className="mt-0 space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2"><BadgeCheck className="size-4 text-[#6E0D12]" /><h3 className="text-sm font-bold">Módulos contratados</h3></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {FEATURE_LABELS.map((feature) => {
                      const unavailable = !isPrimaryTenant && tenantLegacyFeatures.has(feature.key);
                      return <ToggleRow key={feature.key} label={feature.label} description={unavailable ? `${feature.description} Disponível somente na operação principal até concluir o isolamento do módulo.` : feature.description} checked={config.features[feature.key]} disabled={unavailable} onCheckedChange={(checked) => updateFeature(feature.key, checked)} />;
                    })}
                  </div>
                </section>
                <section>
                  <div className="mb-3 flex items-center gap-2"><LayoutTemplate className="size-4 text-[#6E0D12]" /><h3 className="text-sm font-bold">Abas do painel administrativo</h3></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {WHITE_LABEL_ADMIN_TABS.map((tab) => {
                      const unavailable = !isPrimaryTenant && tab === "club";
                      return <ToggleRow key={tab} label={ADMIN_TAB_LABELS[tab]} checked={config.features.adminTabs[tab] ?? false} disabled={unavailable} onCheckedChange={(checked) => updateAdminTab(tab, checked)} />;
                    })}
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="providers" className="mt-0 space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-[#6E0D12]" /> Login social</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["google", "apple", "facebook", "instagram"] as const).map((provider) => (
                      <ToggleRow key={provider} label={provider[0].toUpperCase() + provider.slice(1)} checked={config.providers.auth[provider]} onCheckedChange={(checked) => setConfig({ ...config, providers: { ...config.providers, auth: { ...config.providers.auth, [provider]: checked } } })} />
                    ))}
                  </div>
                </section>
                <section className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-bold">Pagamentos aceitos</h3>
                    {(["pix", "card", "cash"] as const).map((method) => (
                      <ToggleRow key={method} label={{ pix: "PIX", card: "Cartão", cash: "Dinheiro" }[method]} checked={config.providers.payments[method]} onCheckedChange={(checked) => setConfig({ ...config, providers: { ...config.providers, payments: { ...config.providers.payments, [method]: checked } } })} />
                    ))}
                    <FormField label="Processador"><Select value={config.providers.payments.provider} onValueChange={(provider: "manual" | "stripe" | "asaas") => setConfig({ ...config, providers: { ...config.providers, payments: { ...config.providers.payments, provider } } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="stripe">Stripe</SelectItem><SelectItem value="asaas">Asaas</SelectItem></SelectContent></Select></FormField>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-bold">Comunicação e mapas</h3>
                    <ToggleRow label="Push web" checked={config.providers.push.enabled} onCheckedChange={(enabled) => setConfig({ ...config, providers: { ...config.providers, push: { ...config.providers.push, enabled, provider: enabled ? "vapid" : "none" } } })} />
                    <ToggleRow label="E-mail transacional" checked={config.providers.email.enabled} onCheckedChange={(enabled) => setConfig({ ...config, providers: { ...config.providers, email: { ...config.providers.email, enabled, provider: enabled && config.providers.email.provider === "none" ? "resend" : config.providers.email.provider } } })} />
                    <FormField label="Mapa"><Select value={config.providers.maps.provider} onValueChange={(provider: "openstreetmap" | "google") => setConfig({ ...config, providers: { ...config.providers, maps: { provider } } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openstreetmap">OpenStreetMap</SelectItem><SelectItem value="google">Google Maps</SelectItem></SelectContent></Select></FormField>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="domain" className="mt-0 space-y-5">
                <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
                  <FormField label="Status da plataforma"><Select value={config.status} onValueChange={(status: WhiteLabelRuntimeConfig["status"]) => setConfig({ ...config, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="setup_pending">Em configuração</SelectItem><SelectItem value="active">Ativa</SelectItem><SelectItem value="inactive">Inativa</SelectItem></SelectContent></Select></FormField>
                  <FormField label="Plano"><Select value={config.plan} onValueChange={(plan: WhiteLabelRuntimeConfig["plan"]) => setConfig({ ...config, plan })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="essential">Essencial</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select></FormField>
                  <FormField label="Domínio próprio" hint="Ex.: pedidos.pizzariadojoao.com.br. Aponte o DNS para a hospedagem antes de ativar."><Input value={config.domain ?? ""} onChange={(event) => setConfig({ ...config, domain: event.target.value || null })} placeholder="pedidos.suamarca.com.br" /></FormField>
                  <FormField label="Subdomínio" hint="Identificador exclusivo, sem espaços ou acentos."><Input value={config.subdomain ?? ""} onChange={(event) => setConfig({ ...config, subdomain: event.target.value || null })} placeholder="pizzaria-do-joao" /></FormField>
                </section>
                <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
                  <FormField label="E-mail de suporte"><Input type="email" value={config.contact.supportEmail} onChange={(event) => setConfig({ ...config, contact: { ...config.contact, supportEmail: event.target.value } })} /></FormField>
                  <FormField label="Telefone"><Input value={config.contact.supportPhone} onChange={(event) => setConfig({ ...config, contact: { ...config.contact, supportPhone: event.target.value } })} /></FormField>
                  <FormField label="WhatsApp"><Input value={config.contact.whatsapp} onChange={(event) => setConfig({ ...config, contact: { ...config.contact, whatsapp: event.target.value } })} /></FormField>
                  <FormField label="Instagram"><Input value={config.contact.instagram} onChange={(event) => setConfig({ ...config, contact: { ...config.contact, instagram: event.target.value } })} /></FormField>
                </section>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                  Chaves secretas de pagamento, login e e-mail não ficam nesta tela nem são enviadas ao navegador. Elas continuam protegidas nas variáveis do servidor.
                </div>
              </TabsContent>

              <TabsContent value="studio" className="mt-0 space-y-5">
                <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-[1.2fr_.8fr]">
                  <div>
                    <div className="flex items-center gap-2"><LayoutTemplate className="size-5 text-[#6E0D12]"/><h3 className="font-bold">Editor visual independente</h3></div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Monte páginas com blocos seguros, prévia responsiva, rascunho, publicação e histórico. O Studio abre fora do painel operacional.</p>
                    <Button type="button" className="mt-5 gap-2 bg-[#6E0D12] text-white hover:bg-[#450709]" onClick={() => { window.location.href = "/studio"; }}>Abrir Studio <ExternalLink className="size-4"/></Button>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-black uppercase tracking-[.18em] text-white/45">Publicação segura</p><p className="mt-3 text-sm text-white/70">Editar não altera o site. Somente uma publicação explícita troca a versão visível, e qualquer versão pode ser restaurada.</p></div>
                </section>
                {user?.role === "admin" && <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2"><UserPlus className="size-5 text-[#6E0D12]"/><h3 className="font-bold">Conceder acesso separado</h3></div>
                  <p className="mt-1 text-sm text-slate-500">O usuário precisa ter criado uma conta com este e-mail. Ele não receberá acesso global à plataforma.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <FormField label="E-mail do usuário"><Input type="email" value={editorEmail} onChange={(event)=>setEditorEmail(event.target.value)} placeholder="editor@pizzaria.com"/></FormField>
                    <Button type="button" disabled={!editorEmail || grantEditor.isPending || storeId === null} onClick={()=>storeId&&grantEditor.mutate({storeId,email:editorEmail,role:"site_editor"})}>{grantEditor.isPending?<Loader2 className="animate-spin"/>:<UserPlus/>}Conceder acesso de editor</Button>
                  </div>
                </section>}
              </TabsContent>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4">
              <p className="hidden text-xs text-slate-500 sm:block">As mudanças afetam somente esta loja.</p>
              <Button onClick={handleSave} disabled={save.isPending} className="ml-auto gap-2 bg-[#6E0D12] text-white hover:bg-[#450709]">
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar configuração
              </Button>
            </div>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
