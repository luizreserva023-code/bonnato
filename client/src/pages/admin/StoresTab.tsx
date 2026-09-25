import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { Building2, ChevronDown, ChevronRight, MapPin, Pencil, Phone, Search, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppRouter } from "../../../../server/routers";
import { AdminCardSkeleton, AdminPage, AdminSurface, AdminTopbar } from "@/components/admin/ui";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type StoreRecord = RouterOutputs["stores"]["listAll"][number];
type AccessRecord = RouterOutputs["stores"]["getAccess"][number];
type AccessRole = "admin" | "manager" | "cashier" | "kitchen" | "marketing" | "finance" | "viewer";

const ROLE_LABELS: Record<AccessRole, string> = {
  admin: "Administrador", manager: "Gerente", cashier: "Caixa", kitchen: "Cozinha",
  marketing: "Marketing", finance: "Financeiro", viewer: "Somente leitura",
};

type StoreForm = {
  name: string; slug: string; city: string; address: string; phone: string; email: string;
  active: boolean; isDefault: boolean; cnpj: string; inscricaoEstadual: string;
  regimeTributario: string; csc: string; cscId: string; focusNfeToken: string; nfceEnabled: boolean;
};

type TrackingForm = {
  metaPixelEnabled: boolean;
  metaPixelId: string;
};

const EMPTY_TRACKING: TrackingForm = { metaPixelEnabled: false, metaPixelId: "" };

function toForm(store: StoreRecord): StoreForm {
  return {
    name: store.name, slug: store.slug, city: store.city, address: store.address ?? "", phone: store.phone ?? "",
    email: store.email ?? "", active: store.active, isDefault: store.isDefault, cnpj: store.cnpj ?? "",
    inscricaoEstadual: store.inscricaoEstadual ?? "", regimeTributario: String(store.regimeTributario ?? 1),
    csc: store.csc ?? "", cscId: store.cscId ?? "", focusNfeToken: store.focusNfeToken ?? "", nfceEnabled: store.nfceEnabled ?? false,
  };
}
export function StoresTab() {
  const utils = trpc.useUtils();
  const { data: stores = [], isLoading } = trpc.stores.listAll.useQuery();
  const [editing, setEditing] = useState<StoreRecord | null>(null);
  const [form, setForm] = useState<StoreForm | null>(null);
  const [trackingForm, setTrackingForm] = useState<TrackingForm>(EMPTY_TRACKING);
  const [expandedStoreId, setExpandedStoreId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [role, setRole] = useState<AccessRole>("manager");

  const updateStore = trpc.stores.update.useMutation({
    onSuccess: async () => { await utils.stores.listAll.invalidate(); toast.success("Unidade atualizada."); setEditing(null); setForm(null); },
    onError: (error) => toast.error(error.message),
  });
  const updateTracking = trpc.stores.updateTracking.useMutation({
    onSuccess: async () => { await utils.stores.tracking.invalidate(); },
    onError: (error) => toast.error(`Erro ao salvar Pixel: ${error.message}`),
  });
  const trackingQuery = trpc.stores.tracking.useQuery(
    { storeId: editing?.id ?? 0 },
    { enabled: Boolean(editing?.id) },
  );
  const grantAccess = trpc.stores.grantAccess.useMutation({
    onSuccess: async () => { await utils.stores.getAccess.invalidate(); toast.success("Acesso atualizado."); setEmail(""); setLookupEmail(""); },
    onError: (error) => toast.error(error.message),
  });
  const removeAccess = trpc.stores.removeAccess.useMutation({
    onSuccess: async () => { await utils.stores.getAccess.invalidate(); toast.success("Acesso removido."); },
    onError: (error) => toast.error(error.message),
  });
  const { data: access = [] } = trpc.stores.getAccess.useQuery(
    { storeId: expandedStoreId ?? 0 }, { enabled: Boolean(expandedStoreId) },
  );
  const findUser = trpc.stores.findUserByEmail.useQuery(
    { email: lookupEmail }, { enabled: lookupEmail.includes("@") && lookupEmail.length > 5 },
  );
  useEffect(() => {
    if (!trackingQuery.data) return;
    setTrackingForm({
      metaPixelEnabled: trackingQuery.data.metaPixelEnabled,
      metaPixelId: trackingQuery.data.metaPixelId ?? "",
    });
  }, [trackingQuery.data]);

  function openEdit(store: StoreRecord) {
    setEditing(store);
    setForm(toForm(store));
    setTrackingForm(EMPTY_TRACKING);
  }
  function saveStore() {
    if (!editing || !form) return;
    updateStore.mutate({
      id: editing.id, name: form.name, slug: form.slug, city: form.city, address: form.address || null,
      phone: form.phone || null, email: form.email || null, active: form.active, isDefault: form.isDefault,
      cnpj: form.cnpj || null, inscricaoEstadual: form.inscricaoEstadual || null,
      regimeTributario: Number(form.regimeTributario) || null, csc: form.csc || null, cscId: form.cscId || null,
      focusNfeToken: form.focusNfeToken || null, nfceEnabled: form.nfceEnabled,
    });
    updateTracking.mutate({
      storeId: editing.id,
      metaPixelEnabled: trackingForm.metaPixelEnabled,
      metaPixelId: trackingForm.metaPixelId.trim() || null,
    });
  }
  function searchUser() {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) { toast.error("Digite um e-mail válido."); return; }
    setLookupEmail(normalized);
  }
  function confirmAccess() {
    if (!expandedStoreId || !findUser.data) { toast.error("Localize primeiro um usuário cadastrado."); return; }
    grantAccess.mutate({ storeId: expandedStoreId, userId: findUser.data.id, role });
  }

  if (isLoading) {
    return (
      <AdminPage>
        <AdminTopbar title="Unidades Bonatto" subtitle="Dados, acessos e tracking por loja." />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => <AdminCardSkeleton key={index} className="h-32" />)}
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminTopbar
        title="Unidades Bonatto"
        subtitle="Edite os dados operacionais, controle acessos da equipe e configure o tracking de cada unidade."
      />
      <div className="grid gap-4">
        {stores.map((store) => {
          const expanded = expandedStoreId === store.id;
          return <AdminSurface key={store.id} flush className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-gray-900">{store.name}</h3>
                  {store.isDefault && <Badge variant="secondary">Padrão</Badge>}
                  <Badge variant={store.active ? "default" : "outline"}>{store.active ? "Ativa" : "Inativa"}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{store.city}</span>
                  {store.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{store.phone}</span>}
                </div>
              </div>              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(store)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                <Button variant="outline" size="sm" onClick={() => setExpandedStoreId(expanded ? null : store.id)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />Acessos {expanded ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            </div>
            {expanded && <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-alt)] p-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_190px_auto]">
                <div className="flex gap-2">
                  <Input value={email} onChange={(event) => { setEmail(event.target.value); setLookupEmail(""); }} placeholder="E-mail do usuário cadastrado" />
                  <Button type="button" variant="outline" onClick={searchUser}><Search className="h-4 w-4" /></Button>
                </div>
                <Select value={role} onValueChange={(value) => setRole(value as AccessRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={confirmAccess} disabled={!findUser.data || grantAccess.isPending}><UserPlus className="mr-2 h-4 w-4" />Conceder acesso</Button>
              </div>
              {lookupEmail && <p className="mt-2 text-xs text-gray-500">{findUser.isFetching ? "Buscando usuário..." : findUser.data ? `Usuário encontrado: ${findUser.data.name ?? findUser.data.email}` : "Nenhum usuário cadastrado com esse e-mail."}</p>}
              <div className="mt-5 space-y-2">
                {(access as AccessRecord[]).length === 0 ? <p className="text-sm text-gray-500">Nenhum acesso específico cadastrado.</p> : (access as AccessRecord[]).map((item) =>
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div><p className="text-sm font-semibold text-gray-900">{item.userName ?? item.userEmail ?? `Usuário #${item.userId}`}</p><p className="text-xs text-gray-500">{item.userEmail} · {ROLE_LABELS[item.accessRole as AccessRole]}</p></div>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeAccess.mutate({ storeId: store.id, userId: item.userId })}><UserMinus className="mr-2 h-4 w-4" />Remover</Button>
                  </div>
                )}
              </div>
            </div>}
          </AdminSurface>;
        })}
      </div>
      <Dialog open={Boolean(editing && form)} onOpenChange={(open) => { if (!open) { setEditing(null); setForm(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Editar {editing?.name}</DialogTitle></DialogHeader>
          {form && <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            <div><Label>Inscrição estadual</Label><Input value={form.inscricaoEstadual} onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })} /></div>
            <div><Label>Regime tributário</Label><Select value={form.regimeTributario} onValueChange={(value) => setForm({ ...form, regimeTributario: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Simples Nacional</SelectItem><SelectItem value="3">Regime normal</SelectItem></SelectContent></Select></div>
            <div><Label>CSC ID</Label><Input value={form.cscId} onChange={(e) => setForm({ ...form, cscId: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>CSC</Label><Input value={form.csc} onChange={(e) => setForm({ ...form, csc: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Token Focus NFe</Label><Input type="password" value={form.focusNfeToken} onChange={(e) => setForm({ ...form, focusNfeToken: e.target.value })} /></div>
            <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3">
                <p className="text-sm font-bold text-gray-900">Meta Pixel desta unidade</p>
                <p className="text-xs text-gray-500">Eventos desta loja serão enviados somente para este Pixel.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" checked={trackingForm.metaPixelEnabled} onChange={(e) => setTrackingForm({ ...trackingForm, metaPixelEnabled: e.target.checked })} />
                  Pixel ativo
                </label>
                <div><Label>ID do Meta Pixel</Label><Input value={trackingForm.metaPixelId} onChange={(e) => setTrackingForm({ ...trackingForm, metaPixelId: e.target.value })} placeholder="Ex.: 123456789012345" /></div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Unidade ativa</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />Unidade padrão</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.nfceEnabled} onChange={(e) => setForm({ ...form, nfceEnabled: e.target.checked })} />NFC-e habilitada</label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => { setEditing(null); setForm(null); }}>Cancelar</Button><Button onClick={saveStore} disabled={updateStore.isPending}>Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}