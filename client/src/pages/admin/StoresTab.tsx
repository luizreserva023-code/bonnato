/**
 * StoresTab  aba de gerenciamento de lojas (unidades) no painel admin
 * Tema claro com identidade visual Bonatto (bordô #6E0D12 + branco)
 * v51.0: Adicionada seção de dados fiscais (NFC-e) no modal de edição
 */
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Store, Plus, Pencil, Trash2, Users, MapPin, Phone,
  Building2, Star, UserPlus, UserMinus, ChevronDown, ChevronRight,
  Search, CheckCircle2, XCircle, FileText, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRouter } from "../../../../server/routers";

interface StoreFormData {
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  active: boolean;
  isDefault: boolean;
  // Dados fiscais
  cnpj: string;
  inscricaoEstadual: string;
  regimeTributario: string;
  csc: string;
  cscId: string;
  focusNfeToken: string;
  nfceEnabled: boolean;
}

const emptyForm: StoreFormData = {
  name: "", slug: "", city: "", address: "", phone: "", active: true, isDefault: false,
  cnpj: "", inscricaoEstadual: "", regimeTributario: "1", csc: "", cscId: "", focusNfeToken: "", nfceEnabled: false,
};

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AdminStoreRecord = RouterOutputs["stores"]["listAll"][number];
type StoreManagerRecord = RouterOutputs["stores"]["getManagers"][number];

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function StoresTab() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: storesData, isLoading } = trpc.stores.listAll.useQuery(undefined, { enabled: isAdmin });
  const createStore = trpc.stores.create.useMutation({
    onSuccess: () => { utils.stores.listAll.invalidate(); toast.success("Loja criada!"); setShowForm(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateStore = trpc.stores.update.useMutation({
    onSuccess: () => { utils.stores.listAll.invalidate(); toast.success("Loja atualizada!"); setShowForm(false); setEditingId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteStore = trpc.stores.delete.useMutation({
    onSuccess: () => { utils.stores.listAll.invalidate(); toast.success("Loja desativada!"); },
    onError: (e) => toast.error(e.message),
  });
  const addManager = trpc.stores.addManager.useMutation({
    onSuccess: () => {
      utils.stores.getManagers.invalidate();
      toast.success("Gerente adicionado com sucesso!");
      setManagerEmail("");
      setSearchEmail("");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeManager = trpc.stores.removeManager.useMutation({
    onSuccess: () => { utils.stores.getManagers.invalidate(); toast.success("Gerente removido!"); },
    onError: (e) => toast.error(e.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<StoreFormData>(emptyForm);
  const [expandedStore, setExpandedStore] = useState<number | null>(null);
  const [managerEmail, setManagerEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [showFiscal, setShowFiscal] = useState(false);

  // Managers da loja expandida
  const { data: managersData = [] } = trpc.stores.getManagers.useQuery(
    { storeId: expandedStore! },
    { enabled: expandedStore !== null }
  );
  const stores: AdminStoreRecord[] = storesData ?? [];
  const managers: StoreManagerRecord[] = managersData ?? [];

  // Buscar usuário por email
  const findUser = trpc.stores.findUserByEmail.useQuery(
    { email: searchEmail },
    { enabled: searchEmail.includes("@") && searchEmail.length > 5 }
  );

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowFiscal(false);
    setShowForm(true);
  }

  function openEdit(store: AdminStoreRecord) {
    setForm({
      name: store.name,
      slug: store.slug,
      city: store.city,
      address: store.address ?? "",
      phone: store.phone ?? "",
      active: store.active,
      isDefault: store.isDefault,
      cnpj: store.cnpj ?? "",
      inscricaoEstadual: store.inscricaoEstadual ?? "",
      regimeTributario: String(store.regimeTributario ?? "1"),
      csc: store.csc ?? "",
      cscId: store.cscId ?? "",
      focusNfeToken: store.focusNfeToken ?? "",
      nfceEnabled: store.nfceEnabled ?? false,
    });
    setEditingId(store.id);
    // Expandir seção fiscal automaticamente se já tiver CNPJ
    setShowFiscal(!!(store.cnpj || store.focusNfeToken));
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name || !form.slug || !form.city) {
      toast.error("Preencha nome, slug e cidade");
      return;
    }
    const fiscalData = {
      cnpj: form.cnpj || null,
      inscricaoEstadual: form.inscricaoEstadual || null,
      regimeTributario: form.regimeTributario ? parseInt(form.regimeTributario) : null,
      csc: form.csc || null,
      cscId: form.cscId || null,
      focusNfeToken: form.focusNfeToken || null,
      nfceEnabled: form.nfceEnabled,
    };
    if (editingId) {
      updateStore.mutate({
        id: editingId,
        name: form.name,
        slug: form.slug,
        city: form.city,
        address: form.address || undefined,
        phone: form.phone || undefined,
        active: form.active,
        isDefault: form.isDefault,
        ...fiscalData,
      });
    } else {
      createStore.mutate({
        name: form.name,
        slug: form.slug,
        city: form.city,
        address: form.address || undefined,
        phone: form.phone || undefined,
        active: form.active,
        isDefault: form.isDefault,
      });
    }
  }

  function handleSearchUser() {
    if (!managerEmail.includes("@")) {
      toast.error("Digite um e-mail válido");
      return;
    }
    setSearchEmail(managerEmail);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-poppins flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#6E0D12]" />
            Unidades / Lojas
          </h2>
          <p className="text-gray-500 text-sm mt-1">Gerencie as unidades da Bonatto Pizza e seus gerentes</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#6E0D12] hover:bg-[#8B1A1A] text-white gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Loja
        </Button>
      </div>

      {/* Lista de lojas */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma loja cadastrada</p>
          <p className="text-sm mt-1">Clique em "Nova Loja" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div
              key={store.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Card da loja */}
              <div className="p-4 flex items-center gap-4">
                {/* Ícone */}
                <div className="w-12 h-12 rounded-xl bg-[#6E0D12]/10 flex items-center justify-center flex-shrink-0 border border-[#6E0D12]/20">
                  <Store className="w-6 h-6 text-[#6E0D12]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 font-poppins text-base">{store.name}</span>
                    {store.isDefault && (
                      <Badge className="bg-[#fce8e8] text-[#6E0D12] border-[#f9d0d0] text-xs gap-1 font-medium">
                        <Star className="w-3 h-3" /> Padrão
                      </Badge>
                    )}
                    <Badge className={cn(
                      "text-xs font-medium",
                      store.active
                        ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]"
                        : "bg-[#fce8e8] text-[#450709] border-[#f9d0d0]"
                    )}>
                      {store.active ? "Ativa" : "Inativa"}
                    </Badge>
                    {store.nfceEnabled && (
                      <Badge className="bg-[#fce8e8] text-[#6E0D12] border-[#f9d0d0] text-xs gap-1 font-medium">
                        <FileText className="w-3 h-3" /> NFC-e
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="text-gray-500 text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#6E0D12]" />
                      {store.city}{store.address ? `  ${store.address}` : ""}
                    </span>
                    {store.phone && (
                      <span className="text-gray-500 text-sm flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#6E0D12]" />
                        {store.phone}
                      </span>
                    )}
                    {store.cnpj && (
                      <span className="text-gray-400 text-xs font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        CNPJ: {store.cnpj}
                      </span>
                    )}
                    <span className="text-gray-400 text-xs font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                      /{store.slug}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                    className="text-gray-500 hover:text-[#6E0D12] hover:bg-[#6E0D12]/5 gap-1.5 h-9 px-3"
                    title="Gerentes"
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-xs hidden sm:inline">Gerentes</span>
                    {expandedStore === store.id
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(store)}
                    className="text-gray-500 hover:text-[#6E0D12] hover:bg-[#6E0D12]/5 h-9 w-9 p-0"
                    title="Editar loja"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Desativar a loja "${store.name}"?`)) deleteStore.mutate({ id: store.id });
                    }}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-9 w-9 p-0"
                    title="Desativar loja"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Painel de gerentes (expandível) */}
              {expandedStore === store.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/80 space-y-4">
                  <h4 className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#6E0D12]" />
                    Gerentes desta unidade
                  </h4>

                  {/* Buscar e adicionar gerente por email */}
                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-medium">Adicionar gerente por e-mail</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="email"
                          placeholder="email@exemplo.com"
                          value={managerEmail}
                          onChange={e => {
                            setManagerEmail(e.target.value);
                          }}
                          onKeyDown={e => e.key === "Enter" && handleSearchUser()}
                          className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSearchUser}
                        disabled={findUser.isFetching}
                        className="h-9 border-gray-200 text-gray-600 hover:text-[#6E0D12] hover:border-[#6E0D12]/30"
                      >
                        {findUser.isFetching ? "Buscando..." : "Buscar"}
                      </Button>
                    </div>

                    {/* Resultado da busca */}
                    {searchEmail && !findUser.isFetching && (
                      findUser.data ? (
                        <div className="flex items-center justify-between bg-white border border-[#6E0D12]/20 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-[#166534] flex-shrink-0" />
                            <div>
                              <p className="text-gray-900 text-sm font-medium">{findUser.data.name ?? "Sem nome"}</p>
                              <p className="text-gray-500 text-xs">{findUser.data.email}
                                {findUser.data.role !== "user" && (
                                  <span className="ml-1.5 text-[#6E0D12] font-medium">· {findUser.data.role}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addManager.mutate({ storeId: store.id, userId: findUser.data!.id })}
                            disabled={addManager.isPending}
                            className="bg-[#6E0D12] hover:bg-[#8B1A1A] text-white gap-1.5 h-8 text-xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Adicionar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <XCircle className="w-4 h-4 flex-shrink-0" />
                          Nenhum usuário encontrado com este e-mail. O usuário precisa ter feito login pelo menos uma vez.
                        </div>
                      )
                    )}
                  </div>

                  {/* Lista de gerentes */}
                  {managers.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-2">Nenhum gerente cadastrado nesta unidade</p>
                  ) : (
                    <div className="space-y-2">
                      {managers.map((m: StoreManagerRecord) => (
                        <div key={m.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#6E0D12]/10 flex items-center justify-center">
                              <Users className="w-4 h-4 text-[#6E0D12]" />
                            </div>
                            <div>
                              <p className="text-gray-900 text-sm font-medium">{m.userName ?? `Usuário #${m.userId}`}</p>
                              <p className="text-gray-500 text-xs">{m.userEmail ?? ""}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeManager.mutate({ storeId: store.id, userId: m.userId })}
                            disabled={removeManager.isPending}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            title="Remover gerente"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-white border border-gray-200 text-gray-900 max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 font-poppins font-bold text-lg flex items-center gap-2">
              <Store className="w-5 h-5 text-[#6E0D12]" />
              {editingId ? "Editar Loja" : "Nova Loja"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/*  Dados básicos  */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Nome da Loja *</Label>
              <Input
                value={form.name}
                onChange={e => {
                  const name = e.target.value;
                  setForm(f => ({ ...f, name, slug: editingId ? f.slug : slugify(name) }));
                }}
                placeholder="Ex: Bonatto Pizza - Joatuba"
                className="border-gray-200 text-gray-900 focus:border-[#6E0D12] focus:ring-[#6E0D12]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Slug (URL) *</Label>
              <Input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="Ex: joatuba"
                className="border-gray-200 text-gray-900 font-mono focus:border-[#6E0D12] focus:ring-[#6E0D12]/20"
              />
              <p className="text-gray-400 text-xs">Apenas letras minúsculas, números e hífens</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Cidade *</Label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Ex: Joatuba"
                className="border-gray-200 text-gray-900 focus:border-[#6E0D12] focus:ring-[#6E0D12]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Endereço</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Ex: Rua Principal, 123 - Centro"
                className="border-gray-200 text-gray-900 focus:border-[#6E0D12] focus:ring-[#6E0D12]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ex: (37) 99999-9999"
                className="border-gray-200 text-gray-900 focus:border-[#6E0D12] focus:ring-[#6E0D12]/20"
              />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 accent-[#6E0D12] rounded"
                />
                <span className="text-gray-700 text-sm font-medium">Ativa</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="w-4 h-4 accent-[#6E0D12] rounded"
                />
                <span className="text-gray-700 text-sm font-medium">Loja padrão</span>
              </label>
            </div>

            {/*  Seção de Dados Fiscais (NFC-e)  colapsável  */}
            {editingId && (
              <div className="border border-[#6E0D12]/20 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFiscal(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#fce8e8]/60 hover:bg-[#fce8e8] transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6E0D12]" />
                    <span className="text-sm font-semibold text-[#6E0D12]">Dados Fiscais (NFC-e)</span>
                    {form.nfceEnabled && (
                      <Badge className="bg-[#6E0D12] text-white text-[10px] px-1.5 py-0 font-bold">ATIVO</Badge>
                    )}
                  </div>
                  {showFiscal
                    ? <ChevronUp className="w-4 h-4 text-[#6E0D12]" />
                    : <ChevronDown className="w-4 h-4 text-[#6E0D12]" />
                  }
                </button>

                {showFiscal && (
                  <div className="p-4 space-y-4 bg-white">
                    <p className="text-xs text-gray-500 bg-[#fdf5f5] border border-[#f9d0d0] rounded-lg px-3 py-2">
                      Preencha os dados fiscais para habilitar a emissão automática de NFC-e via Focus NFe ao confirmar pedidos.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-gray-700 font-medium text-sm">CNPJ</Label>
                        <Input
                          value={form.cnpj}
                          onChange={e => setForm(f => ({ ...f, cnpj: formatCnpj(e.target.value) }))}
                          placeholder="00.000.000/0001-00"
                          maxLength={18}
                          className="border-gray-200 text-gray-900 font-mono focus:border-[#6E0D12]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-gray-700 font-medium text-sm">Inscrição Estadual</Label>
                        <Input
                          value={form.inscricaoEstadual}
                          onChange={e => setForm(f => ({ ...f, inscricaoEstadual: e.target.value }))}
                          placeholder="Ex: 123456789"
                          className="border-gray-200 text-gray-900 focus:border-[#6E0D12]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-gray-700 font-medium text-sm">Regime Tributário</Label>
                        <Select
                          value={form.regimeTributario}
                          onValueChange={v => setForm(f => ({ ...f, regimeTributario: v }))}
                        >
                          <SelectTrigger className="border-gray-200 text-gray-900 focus:border-[#6E0D12]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Simples Nacional</SelectItem>
                            <SelectItem value="2">Simples Nacional  Excesso</SelectItem>
                            <SelectItem value="3">Regime Normal (Lucro Real)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-gray-700 font-medium text-sm">CSC (Código de Segurança)</Label>
                        <Input
                          value={form.csc}
                          onChange={e => setForm(f => ({ ...f, csc: e.target.value }))}
                          placeholder="Token CSC da SEFAZ"
                          className="border-gray-200 text-gray-900 font-mono text-xs focus:border-[#6E0D12]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-gray-700 font-medium text-sm">ID do CSC</Label>
                        <Input
                          value={form.cscId}
                          onChange={e => setForm(f => ({ ...f, cscId: e.target.value }))}
                          placeholder="Ex: 000001"
                          className="border-gray-200 text-gray-900 font-mono focus:border-[#6E0D12]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-gray-700 font-medium text-sm">Token Focus NFe (desta loja)</Label>
                      <Input
                        value={form.focusNfeToken}
                        onChange={e => setForm(f => ({ ...f, focusNfeToken: e.target.value }))}
                        placeholder="Token de acesso da API Focus NFe"
                        type="password"
                        className="border-gray-200 text-gray-900 font-mono text-xs focus:border-[#6E0D12]"
                      />
                      <p className="text-gray-400 text-xs">Obtido em app.focusnfe.com.br   Configurações   Token de Acesso</p>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-[#6E0D12]/30 hover:bg-[#fdf5f5] transition-colors">
                      <input
                        type="checkbox"
                        checked={form.nfceEnabled}
                        onChange={e => setForm(f => ({ ...f, nfceEnabled: e.target.checked }))}
                        className="w-4 h-4 accent-[#6E0D12] rounded"
                      />
                      <div>
                        <span className="text-gray-800 text-sm font-semibold">Habilitar emissão de NFC-e</span>
                        <p className="text-gray-400 text-xs mt-0.5">Ativa o botão "Emitir NFC-e" no painel de pedidos</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createStore.isPending || updateStore.isPending}
              className="bg-[#6E0D12] hover:bg-[#8B1A1A] text-white"
            >
              {editingId ? "Salvar alterações" : "Criar Loja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

