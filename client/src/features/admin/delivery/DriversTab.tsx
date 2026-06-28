import { useMemo, useState } from "react";
import { Bike, CheckCircle, Copy, Loader2, MapPin, Phone, PlusCircle, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { AdminPage, AdminTopbar } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/Map";

function ActiveDriversMap({ storeId }: { storeId?: number }) {
  const { data: locations } = trpc.drivers.allLocations.useQuery(
    { storeId },
    { refetchInterval: 5000 },
  );

  const mapInitialCenter = locations && locations.length > 0
    ? { lat: parseFloat(locations[0].lat), lng: parseFloat(locations[0].lng) }
    : { lat: -19.9833, lng: -44.0667 };

  const driverMarkers = useMemo(
    () =>
      (locations ?? []).map((location) => ({
        id: `driver-${location.driverId}`,
        position: { lat: parseFloat(location.lat), lng: parseFloat(location.lng) },
        title: location.driverName,
        label: location.driverName,
        popup: `${location.driverName} está em rota agora.`,
        variant: "driver" as const,
      })),
    [locations],
  );

  return (
    <Card className="overflow-hidden border-[var(--admin-card-border)] shadow-[var(--admin-shadow-soft)]">
      <CardHeader className="border-b border-[var(--admin-card-border)] bg-[linear-gradient(135deg,rgba(146,0,0,0.08),rgba(146,0,0,0.02))] pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4 text-[#7d0f14]" />
              Motoboys em rota
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Mapa vivo com atualização automática a cada 5 segundos.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--admin-card-border)] bg-white/80 px-2.5 py-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Ao vivo</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative p-0">
        <MapView
          className="w-full h-[350px]"
          initialCenter={mapInitialCenter}
          initialZoom={13}
          markers={driverMarkers}
          fitToMarkers
        />
        {(!locations || locations.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
            <p className="text-sm text-muted-foreground">Nenhum motoboy com localização ativa no momento.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DriversTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const { data: drivers, isLoading } = trpc.drivers.list.useQuery({ storeId: selectedStoreId });
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<number | null>(null);
  const [newTokens, setNewTokens] = useState<Record<number, string>>({});

  const createMutation = trpc.drivers.create.useMutation({
    onSuccess: (data) => {
      setNewTokens((current) => ({ ...current, [data.id]: data.accessToken }));
      setNewName("");
      setNewPhone("");
      setShowForm(false);
      utils.drivers.list.invalidate();
      toast.success("Motoboy cadastrado!", { description: "Copie o token e envie para o motoboy." });
    },
    onError: () => toast.error("Erro ao cadastrar motoboy"),
  });

  const updateMutation = trpc.drivers.update.useMutation({
    onSuccess: () => {
      utils.drivers.list.invalidate();
      utils.drivers.allLocations.invalidate();
      toast.success("Motoboy atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar motoboy"),
  });

  const deleteMutation = trpc.drivers.delete.useMutation({
    onSuccess: () => {
      utils.drivers.list.invalidate();
      utils.drivers.allLocations.invalidate();
      toast.success("Motoboy removido!");
    },
    onError: () => toast.error("Erro ao remover motoboy"),
  });

  const handleCopyToken = (token: string, id: number) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success("Token copiado!");
  };

  const appUrl = `${window.location.origin}/motoboy`;
  const driverList = drivers ?? [];
  const activeDrivers = driverList.filter((driver) => driver.active).length;

  return (
    <AdminPage>
      <AdminTopbar
        title="Motoboys"
        subtitle="Gerencie entregadores, acessos e acompanhe a operação em rota"
        actions={
          <Button onClick={() => setShowForm((current) => !current)} className="gap-1.5 h-9 text-xs">
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancelar" : "Novo motoboy"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="border-[#6E0D12]/15 bg-[linear-gradient(135deg,rgba(110,13,18,0.10),rgba(255,255,255,0.96))] shadow-[var(--admin-shadow-soft)]">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#6E0D12] p-3 text-white shadow-lg">
                <Bike className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6E0D12]/70">App do motoboy</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Distribua o acesso da equipe de entrega com um link único.</p>
                <p className="mt-2 break-all text-xs text-muted-foreground">{appUrl}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => {
                  navigator.clipboard.writeText(appUrl);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Card className="border-[var(--admin-card-border)] shadow-[var(--admin-shadow-soft)]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cadastrados</p>
              <p className="mt-2 text-3xl font-black text-[var(--admin-text-heading)]">{driverList.length}</p>
            </CardContent>
          </Card>
          <Card className="border-[var(--admin-card-border)] shadow-[var(--admin-shadow-soft)]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ativos agora</p>
              <p className="mt-2 text-3xl font-black text-[#920000]">{activeDrivers}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {showForm && (
        <Card className="border-[var(--admin-card-border)] shadow-[var(--admin-shadow-soft)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastrar novo motoboy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome do motoboy" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="(35) 99999-9999" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate({ name: newName, phone: newPhone || undefined, storeId: selectedStoreId })}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cadastrar"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
        </div>
      ) : !driverList.length ? (
        <Card className="border-[var(--admin-card-border)] shadow-[var(--admin-shadow-soft)]">
          <CardContent className="py-12 text-center">
            <Bike className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum motoboy cadastrado.</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>Cadastrar primeiro motoboy</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {driverList.map((driver) => (
            <Card key={driver.id} className={`border-[var(--admin-card-border)] shadow-[var(--admin-shadow-soft)] ${driver.active ? "" : "opacity-60"}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${driver.active ? "bg-[#fce8e8]" : "bg-zinc-100"}`}>
                    <Bike className={`w-5 h-5 ${driver.active ? "text-[#6E0D12]" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{driver.name}</p>
                      <Badge variant={driver.active ? "default" : "secondary"} className="text-xs">
                        {driver.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {driver.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{driver.phone}</span>
                      </div>
                    )}

                    {newTokens[driver.id] && (
                      <div className="mt-2 rounded-2xl border border-[#e8b4b8] bg-[#fce8e8] p-2.5">
                        <p className="mb-1 text-xs font-medium text-[#5a0a0f]">Token de acesso:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[#f9d0d0] px-2 py-1 text-xs text-[#450709]">
                            {newTokens[driver.id]}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 border-[#e8b4b8] text-xs"
                            onClick={() => handleCopyToken(newTokens[driver.id], driver.id)}
                          >
                            {copiedToken === driver.id ? <CheckCircle className="w-3 h-3 text-[#166534]" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => updateMutation.mutate({ id: driver.id, active: !driver.active })}
                    >
                      {driver.active ? <XCircle className="w-3 h-3 mr-1 text-[#7d0f14]" /> : <CheckCircle className="w-3 h-3 mr-1 text-[#166534]" />}
                      {driver.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-[#7d0f14] hover:text-[#5a0a0f] hover:bg-[#fdf2f2]"
                      onClick={() => {
                        if (confirm(`Remover ${driver.name}?`)) {
                          deleteMutation.mutate({ id: driver.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ActiveDriversMap storeId={selectedStoreId} />
    </AdminPage>
  );
}
