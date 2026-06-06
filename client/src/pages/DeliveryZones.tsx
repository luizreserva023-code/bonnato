import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Clock,
  DollarSign,
  Search,
} from "lucide-react";

type Zone = {
  id: number;
  neighborhood: string;
  city: string;
  deliveryFee: string;
  estimatedMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ZoneForm = {
  neighborhood: string;
  city: string;
  deliveryFee: string;
  estimatedMinutes: string;
};

const emptyForm: ZoneForm = {
  neighborhood: "",
  city: "",
  deliveryFee: "5.00",
  estimatedMinutes: "45",
};

export default function DeliveryZones() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Zone | null>(null);

  const { data: zones = [], isLoading } = trpc.deliveryZones.list.useQuery();

  const createMutation = trpc.deliveryZones.create.useMutation({
    onSuccess: () => {
      utils.deliveryZones.list.invalidate();
      toast.success("Bairro adicionado com sucesso!");
      setShowDialog(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.deliveryZones.update.useMutation({
    onSuccess: () => {
      utils.deliveryZones.list.invalidate();
      toast.success("Bairro atualizado!");
      setShowDialog(false);
      setEditingZone(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.deliveryZones.delete.useMutation({
    onSuccess: () => {
      utils.deliveryZones.list.invalidate();
      toast.success("Bairro removido.");
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.deliveryZones.update.useMutation({
    onSuccess: () => utils.deliveryZones.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "manager"))) {
      navigate("/");
    }
  }, [loading, user, navigate]);

  if (loading) return null;
  if (!user || (user.role !== "admin" && user.role !== "manager")) return null;

  const filtered = zones.filter(
    (z) =>
      z.neighborhood.toLowerCase().includes(search.toLowerCase()) ||
      z.city.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditingZone(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(zone: Zone) {
    setEditingZone(zone);
    setForm({
      neighborhood: zone.neighborhood,
      city: zone.city,
      deliveryFee: zone.deliveryFee,
      estimatedMinutes: String(zone.estimatedMinutes),
    });
    setShowDialog(true);
  }

  function handleSave() {
    const fee = parseFloat(form.deliveryFee);
    const mins = parseInt(form.estimatedMinutes, 10);
    if (!form.neighborhood.trim()) return toast.error("Informe o nome do bairro.");
    if (isNaN(fee) || fee < 0) return toast.error("Taxa de entrega inválida.");
    if (isNaN(mins) || mins < 1) return toast.error("Tempo estimado inválido.");

    if (editingZone) {
      updateMutation.mutate({
        id: editingZone.id,
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        deliveryFee: fee.toFixed(2),
        estimatedMinutes: mins,
      });
    } else {
      createMutation.mutate({
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        deliveryFee: fee.toFixed(2),
        estimatedMinutes: mins,
      });
    }
  }

  const activeCount = zones.filter((z) => z.isActive).length;
  const avgFee =
    zones.length > 0
      ? (zones.reduce((s, z) => s + parseFloat(z.deliveryFee), 0) / zones.length).toFixed(2)
      : "0.00";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Zonas de Entrega
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{activeCount} bairros ativos</Badge>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Adicionar Bairro
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <MapPin className="w-8 h-8 text-primary bg-primary/10 rounded-lg p-1.5" />
              <div>
                <p className="text-2xl font-bold">{zones.length}</p>
                <p className="text-xs text-muted-foreground">Bairros cadastrados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-[#6E0D12] bg-[#fce8e8] rounded-lg p-1.5" />
              <div>
                <p className="text-2xl font-bold">R$ {avgFee}</p>
                <p className="text-xs text-muted-foreground">Taxa média de entrega</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-[#5a0a0f] bg-[#fdf5f5] rounded-lg p-1.5" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Bairros ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar bairro ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bairros Atendidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {search ? "Nenhum bairro encontrado para essa busca." : "Nenhum bairro cadastrado ainda. Clique em \"Adicionar Bairro\" para começar."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((zone) => (
                    <TableRow key={zone.id} className={!zone.isActive ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{zone.neighborhood}</TableCell>
                      <TableCell className="text-muted-foreground">{zone.city || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {parseFloat(zone.deliveryFee) === 0 ? (
                          <Badge variant="secondary" className="text-primary">Grátis</Badge>
                        ) : (
                          <span>R$ {parseFloat(zone.deliveryFee).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ~{zone.estimatedMinutes} min
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={zone.isActive}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: zone.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(zone)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(zone)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dica */}
        <Card className="border-primary/20 bg-[#fdf5f5]">
          <CardContent className="pt-4">
            <p className="text-sm text-[#5a0a0f]">
              <strong>Como funciona:</strong> quando o cliente digitar o bairro no checkout, o sistema busca automaticamente nessa lista e aplica a taxa correspondente. Se o bairro não estiver cadastrado, o pedido será bloqueado com uma mensagem orientando o cliente a entrar em contato.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de criar/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Editar Bairro" : "Adicionar Bairro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do Bairro *</Label>
              <Input
                placeholder="Ex: Juatuba, Centro, Vila Nova..."
                value={form.neighborhood}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input
                placeholder="Ex: Mateus Leme"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Taxa de Entrega (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="5.00"
                  value={form.deliveryFee}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFee: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Use 0 para entrega grátis</p>
              </div>
              <div className="space-y-1.5">
                <Label>Tempo Estimado (min)</Label>
                <Input
                  type="number"
                  min="1"
                  step="5"
                  placeholder="45"
                  value={form.estimatedMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmar exclusão */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Bairro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja remover <strong>{confirmDelete?.neighborhood}</strong>? Clientes desse bairro não conseguirão mais finalizar pedidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate({ id: confirmDelete.id })}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
