import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ClipboardList, Gift, ShoppingBag, Tag, Users } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import {
  AdminEmptyState,
  AdminPage,
  AdminSearch,
  AdminStat,
  AdminStatGrid,
  AdminSurface,
  AdminTopbar,
} from "@/components/admin/ui";
import { JoinedPagination } from "@/components/ui/joined-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type CouponForm = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minOrderValue: string;
};

export function AdminUsersTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId, selectedStoreName } = useAdminStore();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin" | "manager">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "suspended" | "setup_pending">("all");
  const [clubFilter, setClubFilter] = useState<"all" | "active" | "pending" | "cancelled" | "none">("all");
  const [loginMethodFilter, setLoginMethodFilter] = useState<"all" | "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus">("all");
  const [ordersFilter, setOrdersFilter] = useState<"all" | "with_orders" | "without_orders">("all");
  const [sendCouponForm, setSendCouponForm] = useState<{ userId: number; userName: string } | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>({ code: "", discountType: "percentage", discountValue: "", minOrderValue: "" });
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, roleFilter, statusFilter, clubFilter, loginMethodFilter, ordersFilter, selectedStoreId]);

  const usersQueryInput = useMemo(() => ({
    page,
    pageSize: 100,
    search: deferredSearchQuery || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    clubStatus: clubFilter === "all" ? undefined : clubFilter,
    loginMethod: loginMethodFilter === "all" ? undefined : loginMethodFilter,
    hasOrders: ordersFilter === "all" ? undefined : ordersFilter,
    storeId: selectedStoreId,
  }), [page, deferredSearchQuery, roleFilter, statusFilter, clubFilter, loginMethodFilter, ordersFilter, selectedStoreId]);

  const { data: usersPage, isLoading, isFetching } = trpc.adminUsers.list.useQuery(usersQueryInput, {
    placeholderData: (previous) => previous,
  });

  const sendCoupon = trpc.adminUsers.sendCoupon.useMutation({
    onSuccess: () => {
      utils.adminUsers.list.invalidate();
      setSendCouponForm(null);
      setCouponForm({ code: "", discountType: "percentage", discountValue: "", minOrderValue: "" });
      toast.success("Cupom enviado para o cliente!");
    },
    onError: (error) => toast.error(error.message),
  });

  const users = usersPage?.items ?? [];
  const totalUsers = usersPage?.total ?? 0;
  const totalPages = usersPage?.totalPages ?? 1;

  const currentPageStats = useMemo(() => {
    return users.reduce((acc, user) => {
      if (user.totalOrders > 0) acc.withOrders += 1;
      if (user.clubStatus === "active") acc.clubActive += 1;
      if (user.role !== "user") acc.staffLike += 1;
      return acc;
    }, { withOrders: 0, clubActive: 0, staffLike: 0 });
  }, [users]);

  const formatMoney = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (value: string | Date | null | undefined, fallback = "—") => {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString("pt-BR");
  };
  const formatDateTime = (value: string | Date | null | undefined, fallback = "—") => {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString("pt-BR");
  };
  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "manager": return "Gerente";
      default: return "Cliente";
    }
  };
  const statusLabel = (status: string) => {
    switch (status) {
      case "active": return "Ativo";
      case "inactive": return "Inativo";
      case "suspended": return "Suspenso";
      case "setup_pending": return "Setup";
      default: return status;
    }
  };
  const loginMethodLabel = (loginMethod: string | null) => {
    switch (loginMethod) {
      case "email": return "E-mail";
      case "phone": return "Celular";
      case "google": return "Google";
      case "apple": return "Apple";
      case "facebook": return "Facebook";
      case "instagram": return "Instagram";
      case "manus": return "Portal";
      default: return "—";
    }
  };
  const clubStatusLabel = (clubStatus: string | null) => {
    switch (clubStatus) {
      case "active": return "Clube ativo";
      case "pending": return "Clube pendente";
      case "cancelled": return "Clube cancelado";
      default: return "Sem clube";
    }
  };

  return (
    <AdminPage>
      <AdminTopbar
        title="Usuários"
        subtitle={selectedStoreId ? `Clientes e contas vinculadas a ${selectedStoreName}` : "Clientes e contas da plataforma com busca e filtros úteis"}
      />

      <AdminStatGrid>
        <AdminStat label="Resultados" value={String(totalUsers)} icon={<Users className="w-4 h-4" />} />
        <AdminStat label="Página atual" value={String(users.length)} icon={<ClipboardList className="w-4 h-4" />} />
        <AdminStat label="Com pedidos" value={String(currentPageStats.withOrders)} icon={<ShoppingBag className="w-4 h-4" />} />
        <AdminStat label="Clube ativo" value={String(currentPageStats.clubActive)} icon={<Gift className="w-4 h-4" />} />
      </AdminStatGrid>

      <AdminSurface title="Pesquisa e filtros" subtitle="Paginação de 100 usuários por página com filtros por função, status, clube, login e histórico de compra">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nome, e-mail, telefone ou openId..." />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
            <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              <SelectItem value="user">Clientes</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="manager">Gerentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
              <SelectItem value="setup_pending">Setup pendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordersFilter} onValueChange={(value) => setOrdersFilter(value as typeof ordersFilter)}>
            <SelectTrigger><SelectValue placeholder="Pedidos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Com e sem pedidos</SelectItem>
              <SelectItem value="with_orders">Só quem já comprou</SelectItem>
              <SelectItem value="without_orders">Só sem pedidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <Select value={loginMethodFilter} onValueChange={(value) => setLoginMethodFilter(value as typeof loginMethodFilter)}>
            <SelectTrigger><SelectValue placeholder="Login" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os logins</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Celular</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="manus">Portal OAuth</SelectItem>
            </SelectContent>
          </Select>
          <Select value={clubFilter} onValueChange={(value) => setClubFilter(value as typeof clubFilter)}>
            <SelectTrigger><SelectValue placeholder="Clube" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clubes</SelectItem>
              <SelectItem value="active">Clube ativo</SelectItem>
              <SelectItem value="pending">Clube pendente</SelectItem>
              <SelectItem value="cancelled">Clube cancelado</SelectItem>
              <SelectItem value="none">Sem clube</SelectItem>
            </SelectContent>
          </Select>
          <div className="lg:col-span-2 flex items-center justify-between rounded-xl border border-[#ece8e6] bg-white px-4 py-2 text-sm text-muted-foreground">
            <span>{selectedStoreId ? `Escopo: ${selectedStoreName}` : "Escopo: todas as lojas"}</span>
            <span>{isFetching ? "Atualizando..." : `Página ${page} de ${totalPages}`}</span>
          </div>
        </div>
      </AdminSurface>

      {sendCouponForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Enviar Cupom para {sendCouponForm.userName}</CardTitle></CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendCoupon.mutate({
                  userId: sendCouponForm.userId,
                  code: couponForm.code.toUpperCase(),
                  discountType: couponForm.discountType,
                  discountValue: couponForm.discountValue,
                  minOrderValue: couponForm.minOrderValue || undefined,
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Código *</Label><Input value={couponForm.code} onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value }))} required placeholder="PROMO10" /></div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={couponForm.discountType} onValueChange={(value) => setCouponForm((current) => ({ ...current, discountType: value as "percentage" | "fixed" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" min="0" value={couponForm.discountValue} onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label>Pedido mínimo (R$)</Label><Input type="number" min="0" value={couponForm.minOrderValue} onChange={(e) => setCouponForm((f) => ({ ...f, minOrderValue: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={sendCoupon.isPending}>{sendCoupon.isPending ? "Enviando..." : "Enviar Cupom"}</Button>
                <Button type="button" variant="ghost" onClick={() => setSendCouponForm(null)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="admin-table-head">
                    <th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3 hidden lg:table-cell">Perfil</th>
                    <th className="text-left p-3 hidden md:table-cell">Compras</th>
                    <th className="text-left p-3 hidden xl:table-cell">Atividade</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 align-top">
                        <div className="flex items-start gap-3">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name ?? "Usuário"} className="w-11 h-11 rounded-full object-cover shrink-0 border border-[#ece8e6]" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-[#f7efee] text-[#6E0D12] font-bold flex items-center justify-center shrink-0">
                              {(user.name ?? "U").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[#1a1d23] truncate">{user.name ?? "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email ?? "Sem e-mail"}</p>
                            <p className="text-xs text-muted-foreground">{user.phone ?? "Sem celular"}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge className="bg-[#f3f4f6] text-[#1f2937] border-0 text-[11px]">{roleLabel(user.role)}</Badge>
                              <Badge className={user.status === "active" ? "bg-[#f0fdf4] text-[#166534] border-0 text-[11px]" : "bg-[#fce8e8] text-[#6E0D12] border-0 text-[11px]"}>{statusLabel(user.status)}</Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 align-top hidden lg:table-cell">
                        <div className="space-y-1 text-sm">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-[11px]">Login: {loginMethodLabel(user.loginMethod)}</Badge>
                            <Badge variant="outline" className="text-[11px]">{clubStatusLabel(user.clubStatus)}</Badge>
                            {user.clubPlan && <Badge variant="outline" className="text-[11px]">Plano: {user.clubPlan}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Pontos fidelidade: <span className="font-medium text-foreground">{user.loyaltyPoints ?? 0}</span></p>
                          <p className="text-xs text-muted-foreground">Bairro favorito: <span className="font-medium text-foreground">{user.favoriteNeighborhood ?? "—"}</span></p>
                        </div>
                      </td>
                      <td className="p-3 align-top hidden md:table-cell">
                        <div className="space-y-1 text-sm">
                          <p><span className="font-semibold">{user.totalOrders}</span> pedidos</p>
                          <p className="text-muted-foreground">{user.deliveredOrders} entregues</p>
                          <p className="text-muted-foreground">Total gasto: <span className="font-medium text-foreground">{formatMoney(user.totalSpent)}</span></p>
                          <p className="text-xs text-muted-foreground">Ticket médio: <span className="font-medium text-foreground">{formatMoney(user.averageTicket ?? 0)}</span></p>
                          <p className="text-xs text-muted-foreground">Produto favorito: <span className="font-medium text-foreground">{user.favoriteProductName ?? "—"}</span></p>
                        </div>
                      </td>
                      <td className="p-3 align-top hidden xl:table-cell">
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Cadastro: <span className="font-medium text-foreground">{formatDate(user.createdAt)}</span></p>
                          <p>Último login: <span className="font-medium text-foreground">{formatDateTime(user.lastSignedIn)}</span></p>
                          <p>Último pedido: <span className="font-medium text-foreground">{formatDateTime(user.lastOrderAt ?? user.metricsLastOrderAt)}</span></p>
                          <p>Primeiro pedido: <span className="font-medium text-foreground">{formatDate(user.firstOrderAt)}</span></p>
                        </div>
                      </td>
                      <td className="p-3 text-right align-top">
                        <Button size="sm" variant="outline" onClick={() => setSendCouponForm({ userId: user.id, userName: user.name ?? "Cliente" })}>
                          <Tag className="w-3.5 h-3.5 mr-1" />Cupom
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && (
                <AdminEmptyState icon={<Users className="w-8 h-8" />} title="Nenhum usuário encontrado" description="Ajuste a pesquisa ou os filtros para localizar clientes e contas da plataforma." />
              )}
            </div>
          </CardContent>
          {totalPages > 1 && (
            <div className="flex justify-center border-t py-4">
              <JoinedPagination
                currentPage={page}
                totalPages={totalPages}
                paginationItemsToDisplay={5}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      )}
    </AdminPage>
  );
}
