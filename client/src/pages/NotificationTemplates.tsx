import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Smartphone,
  MessageCircle,
  Layers,
  ToggleLeft,
  ToggleRight,
  Shuffle,
  Info,
  Send,
  Link2,
  Users,
  Megaphone,
  CalendarClock,
  Clock,
  XCircle,
  CheckCircle2,
  AlarmClock,
  Repeat,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

// ─── Constantes ───────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  order_confirmed: "✅ Pedido Confirmado",
  order_preparing: "👨‍🍳 Preparando",
  order_out_for_delivery: "🛵 Saiu para Entrega",
  order_delivered: "🎉 Entregue",
  order_cancelled: "❌ Cancelado",
  cart_abandoned_step1: "🛒 Carrinho Abandonado — Etapa 1 (10 min)",
  cart_abandoned_step2: "🛒 Carrinho Abandonado — Etapa 2 (20 min)",
  cart_abandoned_step3: "🛒 Carrinho Abandonado — Etapa 3 (30 min + cupom)",
  reactivation_15: "💤 Reativação — Inativo 15 dias (5% OFF)",
  reactivation_30: "💤 Reativação — Inativo 30 dias (10% OFF)",
  reactivation_60: "💤 Reativação — Inativo 60 dias (15% OFF)",
  custom: "📣 Personalizada",
};

const EVENT_ORDER = [
  "order_confirmed",
  "order_preparing",
  "order_out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "cart_abandoned_step1",
  "cart_abandoned_step2",
  "cart_abandoned_step3",
  "reactivation_15",
  "reactivation_30",
  "reactivation_60",
  "custom",
];

const CHANNEL_LABELS: Record<string, string> = {
  push: "Push",
  whatsapp: "WhatsApp",
  both: "Ambos",
};

const CHANNEL_ICONS: Record<string, React.ReactElement> = {
  push: <Smartphone className="w-3 h-3" />,
  whatsapp: <MessageCircle className="w-3 h-3" />,
  both: <Layers className="w-3 h-3" />,
};

const CHANNEL_COLORS: Record<string, string> = {
  push: "bg-[#fce8e8] text-[#6E0D12] border-[#f9d0d0]",
  whatsapp: "bg-[#fdf5f5] text-[#5a0a0f] border-[#fce8e8]",
  both: "bg-[#f9d0d0] text-[#450709] border-[#f5b8b8]",
};

const VARIABLES_HINT = "Variáveis: {{clientName}}, {{orderId}}, {{total}}, {{coupon}}";

// Atalhos de tela para redirecionamento
const REDIRECT_SHORTCUTS = [
  { label: "🏠 Início", value: "/" },
  { label: "🍕 Cardápio", value: "/cardapio" },
  { label: "🏷️ Promoções", value: "/promocoes" },
  { label: "👤 Minha Conta", value: "/minha-conta" },
  { label: "📦 Meus Pedidos", value: "/minha-conta#pedidos" },
  { label: "🎁 Sorteios", value: "/sorteios" },
  { label: "🔗 URL personalizada", value: "custom" },
];

// Tags de segmento disponíveis
const SEGMENT_OPTIONS = [
  { label: "👥 Todos os clientes", value: "all" },
  { label: "🆕 Novos (1 pedido)", value: "novo" },
  { label: "🔁 Recorrentes (2+ pedidos)", value: "recorrente" },
  { label: "🤔 Indecisos (carrinho abandonado)", value: "indeciso" },
  { label: "😴 Inativos 15 dias", value: "inativo_15" },
  { label: "💤 Inativos 30 dias", value: "inativo_30" },
  { label: "🚫 Inativos 60 dias", value: "inativo_60" },
];

type Template = {
  id: number;
  event: string;
  channel: string;
  title: string;
  body: string;
  redirectUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Template Form Dialog ─────────────────────────────────────────────────────

function TemplateFormDialog({
  open,
  onClose,
  editTemplate,
}: {
  open: boolean;
  onClose: () => void;
  editTemplate?: Template | null;
}) {
  const utils = trpc.useUtils();
  const [event, setEvent] = useState(editTemplate?.event ?? "order_confirmed");
  const [channel, setChannel] = useState(editTemplate?.channel ?? "both");
  const [title, setTitle] = useState(editTemplate?.title ?? "");
  const [body, setBody] = useState(editTemplate?.body ?? "");
  const [redirectShortcut, setRedirectShortcut] = useState<string>(() => {
    const url = editTemplate?.redirectUrl ?? "";
    const found = REDIRECT_SHORTCUTS.find((s) => s.value === url && s.value !== "custom");
    return found ? found.value : url ? "custom" : "/";
  });
  const [customUrl, setCustomUrl] = useState<string>(() => {
    const url = editTemplate?.redirectUrl ?? "";
    const found = REDIRECT_SHORTCUTS.find((s) => s.value === url && s.value !== "custom");
    return found ? "" : url;
  });

  const isEdit = !!editTemplate;
  const finalRedirectUrl = redirectShortcut === "custom" ? customUrl : redirectShortcut;

  const createMutation = trpc.notificationTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("Template criado!");
      utils.notificationTemplates.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.notificationTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("Template atualizado!");
      utils.notificationTemplates.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha o título e o corpo da mensagem.");
      return;
    }
    if (isEdit && editTemplate) {
      updateMutation.mutate({
        id: editTemplate.id,
        title,
        body,
        channel: channel as "push" | "whatsapp" | "both",
        redirectUrl: finalRedirectUrl || undefined,
      });
    } else {
      createMutation.mutate({
        event: event as "order_confirmed" | "order_preparing" | "order_out_for_delivery" | "order_delivered" | "order_cancelled" | "cart_abandoned_step1" | "cart_abandoned_step2" | "cart_abandoned_step3" | "reactivation_15" | "reactivation_30" | "reactivation_60" | "custom",
        channel: channel as "push" | "whatsapp" | "both",
        title,
        body,
        redirectUrl: finalRedirectUrl || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#6E0D12]" />
            {isEdit ? "Editar Template" : "Novo Template"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Evento</label>
              <Select value={event} onValueChange={setEvent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_ORDER.map((e) => (
                    <SelectItem key={e} value={e}>{EVENT_LABELS[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Canal</label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push">📱 Push (notificação no celular)</SelectItem>
                <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                <SelectItem value="both">🔀 Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Título {channel !== "whatsapp" && <span className="text-gray-400 font-normal">(Push)</span>}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 🍕 Seu pedido está a caminho!"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Mensagem</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ex: Olá, {{clientName}}! Seu pedido #{{orderId}} saiu para entrega. 🛵"
              rows={4}
            />
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" /> {VARIABLES_HINT}
            </p>
          </div>

          {/* Redirecionamento */}
          {(channel === "push" || channel === "both") && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> Ao tocar na notificação, abrir
              </label>
              <Select value={redirectShortcut} onValueChange={setRedirectShortcut}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REDIRECT_SHORTCUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {redirectShortcut === "custom" && (
                <Input
                  className="mt-2"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Ex: /cardapio?categoria=pizzas ou https://..."
                />
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Send Custom Dialog ───────────────────────────────────────────────────────

function SendCustomDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [redirectShortcut, setRedirectShortcut] = useState("/");
  const [customUrl, setCustomUrl] = useState("");
  const [segment, setSegment] = useState("");

  const finalRedirectUrl = redirectShortcut === "custom" ? customUrl : redirectShortcut;

  const sendMutation = trpc.notificationTemplates.sendCustom.useMutation({
    onSuccess: (data) => {
      if ('skipped' in data && data.skipped) {
        toast.warning("Nenhum cliente encontrado nesse segmento.");
      } else {
        toast.success(`Notificação enviada! ✅ ${data.sent} entregues, ${data.failed} falhas.`);
      }
      onClose();
      setTitle("");
      setBody("");
      setRedirectShortcut("/");
      setCustomUrl("");
      setSegment("");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    if (redirectShortcut === "custom" && !customUrl.trim()) {
      toast.error("Informe a URL de destino.");
      return;
    }
    if (!confirm(`Enviar notificação para ${segment ? SEGMENT_OPTIONS.find(s => s.value === segment)?.label : "todos os clientes"}?`)) return;
    sendMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      redirectUrl: finalRedirectUrl || "/",
      tag: segment === "all" ? undefined : segment || undefined,
    });
  };

  // Prévia da notificação
  const previewTitle = title || "Título da notificação";
  const previewBody = body || "Mensagem da notificação aparecerá aqui...";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#6E0D12]" />
            Enviar Notificação Personalizada
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Prévia */}
          <div className="bg-[#1a0305] rounded-xl p-4">
            <p className="text-xs text-[#f9d0d0]/60 mb-2 font-medium uppercase tracking-wide">Prévia</p>
            <div className="bg-[#2d0508] rounded-xl p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#6E0D12] flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold truncate">{previewTitle}</div>
                <div className="text-[#f9d0d0]/80 text-xs mt-0.5 line-clamp-2">{previewBody}</div>
                <div className="text-[#f9d0d0]/40 text-xs mt-1 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {finalRedirectUrl || "/"}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 🍕 Oferta especial só hoje!"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Mensagem</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ex: Aproveite 20% de desconto em todas as pizzas grandes. Válido até meia-noite! 🔥"
              rows={3}
            />
          </div>

          {/* Destino */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" /> Ao tocar, abrir
            </label>
            <Select value={redirectShortcut} onValueChange={setRedirectShortcut}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REDIRECT_SHORTCUTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {redirectShortcut === "custom" && (
              <Input
                className="mt-2"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Ex: /cardapio?categoria=pizzas"
              />
            )}
          </div>

          {/* Segmento */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Enviar para
            </label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              Apenas clientes com notificação push ativa receberão.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
              onClick={handleSend}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending
                ? <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                : <Send className="w-4 h-4 mr-1" />
              }
              Enviar Agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
}: {
  template: Template;
  onEdit: (t: Template) => void;
}) {
  const utils = trpc.useUtils();

  const toggleMutation = trpc.notificationTemplates.update.useMutation({
    onSuccess: () => utils.notificationTemplates.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.notificationTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template removido");
      utils.notificationTemplates.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const previewBody = template.body
    .replace(/\{\{clientName\}\}/g, "João")
    .replace(/\{\{orderId\}\}/g, "42")
    .replace(/\{\{total\}\}/g, "89,90");

  const shortcutLabel = REDIRECT_SHORTCUTS.find(
    (s) => s.value === template.redirectUrl && s.value !== "custom"
  )?.label;

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        template.isActive
          ? "border-gray-200 bg-white"
          : "border-gray-100 bg-gray-50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${CHANNEL_COLORS[template.channel]}`}
            >
              {CHANNEL_ICONS[template.channel]}
              {CHANNEL_LABELS[template.channel]}
            </span>
            {template.redirectUrl && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-[#fce8e8] text-[#7d0f14] border-[#f9d0d0]">
                <Link2 className="w-3 h-3" />
                {shortcutLabel ?? template.redirectUrl}
              </span>
            )}
            {!template.isActive && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inativo</span>
            )}
          </div>
          <div className="font-medium text-sm text-foreground truncate">{template.title}</div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{previewBody}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toggleMutation.mutate({ id: template.id, isActive: !template.isActive })}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1"
            title={template.isActive ? "Desativar" : "Ativar"}
          >
            {template.isActive
              ? <ToggleRight className="w-5 h-5 text-primary" />
              : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
            }
          </button>
          <button
            onClick={() => onEdit(template)}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm("Remover este template?")) {
                deleteMutation.mutate({ id: template.id });
              }
            }}
            className="text-gray-400 hover:text-[#7d0f14] transition-colors p-1"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scheduled Notifications ─────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Todos os clientes",
  active: "Clientes ativos",
  inactive: "Clientes inativos",
  club: "Membros do Clube",
};

const RECURRENCE_LABELS: Record<string, string> = {
  once: "Uma vez",
  daily: "Diário",
  weekly: "Semanal",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  pending: { label: "Agendada", color: "bg-[#fce8e8] text-[#6E0D12] border-[#f9d0d0]", icon: <Clock className="w-3 h-3" /> },
  sent: { label: "Enviada", color: "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]", icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: "Cancelada", color: "bg-muted text-muted-foreground border-border", icon: <XCircle className="w-3 h-3" /> },
  failed: { label: "Falhou", color: "bg-[#fce8e8] text-[#450709] border-[#f9d0d0]", icon: <XCircle className="w-3 h-3" /> },
};

function ScheduleFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("push");
  const [audience, setAudience] = useState("all");
  const [recurrence, setRecurrence] = useState("once");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState("");

  // Fetch delivery zones for neighborhood selection
  const { data: deliveryZones } = trpc.deliveryZones.list.useQuery();
  const activeZones = (deliveryZones ?? []).filter((z: any) => z.isActive);
  const filteredZones = neighborhoodSearch.trim()
    ? activeZones.filter((z: any) => z.neighborhood.toLowerCase().includes(neighborhoodSearch.toLowerCase()))
    : activeZones;

  function toggleNeighborhood(name: string) {
    setSelectedNeighborhoods((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  const createMutation = trpc.notifications.scheduleCreate.useMutation({
    onSuccess: () => {
      toast.success("Notificação agendada com sucesso!");
      utils.notifications.scheduleList.invalidate();
      onClose();
      setTitle(""); setMessage(""); setScheduledDate(""); setScheduledTime("");
      setSelectedNeighborhoods([]); setNeighborhoodSearch("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledDate || !scheduledTime) { toast.error("Informe a data e hora"); return; }
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (scheduledAt <= new Date()) { toast.error("A data/hora deve ser no futuro"); return; }
    createMutation.mutate({
      title, message,
      channel: channel as "push" | "whatsapp" | "both",
      targetAudience: audience as "all" | "active" | "inactive" | "club",
      scheduledAt,
      recurrence: recurrence as "once" | "daily" | "weekly",
      neighborhoodFilter: selectedNeighborhoods.length > 0 ? selectedNeighborhoods : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#6E0D12]" />
            Agendar Notificação
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Título *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Promoção de sexta!" required maxLength={200} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem *</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Texto da notificação..." required rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Canal</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">📱 Push</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="both">📡 Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Público-alvo</label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">👥 Todos</SelectItem>
                  <SelectItem value="active">✅ Ativos</SelectItem>
                  <SelectItem value="inactive">😴 Inativos</SelectItem>
                  <SelectItem value="club">⭐ Clube</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Data *</label>
              <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Hora *</label>
              <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Recorrência</label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">🔂 Uma vez</SelectItem>
                <SelectItem value="daily">📅 Diário</SelectItem>
                <SelectItem value="weekly">🗓️ Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Bairro */}
          {activeZones.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1">
                📍 Filtrar por bairro
                <span className="text-xs font-normal text-gray-400 ml-1">(opcional — vazio = todos os bairros)</span>
              </label>
              {selectedNeighborhoods.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedNeighborhoods.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1 text-xs bg-[#fce8e8] text-[#6E0D12] border border-[#f5c6c8] rounded-full px-2 py-0.5 font-medium">
                      {n}
                      <button type="button" onClick={() => toggleNeighborhood(n)} className="hover:text-red-700 ml-0.5">×</button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setSelectedNeighborhoods([])} className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Limpar
                  </button>
                </div>
              )}
              <Input
                placeholder="Buscar bairro..."
                value={neighborhoodSearch}
                onChange={e => setNeighborhoodSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="max-h-36 overflow-y-auto border rounded-lg divide-y">
                {filteredZones.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Nenhum bairro encontrado</p>
                ) : filteredZones.map((z: any) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => toggleNeighborhood(z.neighborhood)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      selectedNeighborhoods.includes(z.neighborhood) ? 'bg-[#fdf2f2]' : ''
                    }`}
                  >
                    <span className={selectedNeighborhoods.includes(z.neighborhood) ? 'font-medium text-[#6E0D12]' : 'text-gray-700'}>
                      {z.neighborhood}
                      {z.city ? <span className="text-gray-400 font-normal"> — {z.city}</span> : null}
                    </span>
                    {selectedNeighborhoods.includes(z.neighborhood) && (
                      <span className="text-[#6E0D12] text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white" disabled={createMutation.isPending}>
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CalendarClock className="w-4 h-4 mr-1" />}
              Agendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScheduledNotificationsSection() {
  const utils = trpc.useUtils();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { data: scheduled, isLoading } = trpc.notifications.scheduleList.useQuery();

  const cancelMutation = trpc.notifications.scheduleCancel.useMutation({
    onSuccess: () => { toast.success("Agendamento cancelado"); utils.notifications.scheduleList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.notifications.scheduleDelete.useMutation({
    onSuccess: () => { toast.success("Agendamento removido"); utils.notifications.scheduleList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const pending = (scheduled ?? []).filter(s => s.status === 'pending');

  return (
    <>
      <Card className="mb-6 border-[#fce8e8] bg-gradient-to-r from-[#fdf2f2] to-[#fdf5f5]">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#6E0D12] flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-0.5">Notificações Agendadas</h3>
              <p className="text-sm text-gray-600">
                Programe notificações para envio automático em data e hora específicas. Suporte a recorrência diária ou semanal.
              </p>
              {pending.length > 0 && (
                <p className="text-xs text-[#6E0D12] font-medium mt-1">
                  {pending.length} agendamento{pending.length > 1 ? 's' : ''} pendente{pending.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Button size="sm" className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white flex-shrink-0" onClick={() => setScheduleOpen(true)}>
              <AlarmClock className="w-4 h-4 mr-1" />
              Agendar
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isLoading && (scheduled ?? []).length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6E0D12]" />
              Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {(scheduled ?? []).map(s => {
              const status = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
              const dt = new Date(s.scheduledAt);
              return (
                <div key={s.id} className="border rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${status.color}`}>
                        {status.icon}{status.label}
                      </span>
                      {s.recurrence !== 'once' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-[#fce8e8] text-[#5a0a0f] border-[#f9d0d0]">
                          <Repeat className="w-3 h-3" />{RECURRENCE_LABELS[s.recurrence]}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{CHANNEL_LABELS[s.channel]}</span>
                    </div>
                    <div className="font-medium text-sm text-foreground truncate">{s.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.message}</div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-1 flex-wrap">
                      <CalendarClock className="w-3 h-3" />
                      {dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      <span className="mx-1">·</span>
                      <Users className="w-3 h-3" />{AUDIENCE_LABELS[s.targetAudience] ?? s.targetAudience}
                      {s.neighborhoodFilter && (() => {
                        try {
                          const neighborhoods: string[] = JSON.parse(s.neighborhoodFilter);
                          if (neighborhoods.length > 0) return (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <span className="mx-0.5">·</span>
                              📍 {neighborhoods.length === 1 ? neighborhoods[0] : `${neighborhoods.length} bairros`}
                            </span>
                          );
                        } catch { return null; }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {s.status === 'pending' && (
                      <button onClick={() => { if (confirm('Cancelar este agendamento?')) cancelMutation.mutate({ id: s.id }); }} className="text-muted-foreground hover:text-primary transition-colors p-1" title="Cancelar">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => { if (confirm('Remover este agendamento?')) deleteMutation.mutate({ id: s.id }); }} className="text-gray-400 hover:text-[#7d0f14] transition-colors p-1" title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <ScheduleFormDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationTemplates() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sendCustomOpen, setSendCustomOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);

  const { data: templates, isLoading } = trpc.notificationTemplates.list.useQuery();
  const utils = trpc.useUtils();

  const seedMutation = trpc.notificationTemplates.seed.useMutation({
    onSuccess: () => {
      toast.success("Templates padrão carregados!");
      utils.notificationTemplates.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "admin" && user.role !== "manager"))) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading) return null;
  if (!user || (user.role !== "admin" && user.role !== "manager")) return null;

  const grouped = EVENT_ORDER.reduce<Record<string, Template[]>>((acc, ev) => {
    acc[ev] = (templates ?? []).filter((t) => t.event === ev);
    return acc;
  }, {});

  const totalActive = (templates ?? []).filter((t) => t.isActive).length;
  const totalTemplates = (templates ?? []).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fce8e8] flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#6E0D12]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Templates de Notificação</h1>
              <p className="text-sm text-gray-500">
                {totalActive} ativos de {totalTemplates} — sorteio aleatório a cada disparo
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {totalTemplates === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                <Shuffle className={`w-4 h-4 mr-1 ${seedMutation.isPending ? "animate-spin" : ""}`} />
                Carregar Padrões
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-[#f9d0d0] text-[#5a0a0f] hover:bg-[#fdf2f2]"
              onClick={() => setSendCustomOpen(true)}
            >
              <Megaphone className="w-4 h-4 mr-1" />
              Enviar Personalizada
            </Button>
            <Button
              size="sm"
              className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white"
              onClick={() => { setEditTemplate(null); setDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Template
            </Button>
          </div>
        </div>

        {/* Destaque: Notificação Personalizada */}
        <Card className="mb-6 border-[#fce8e8] bg-gradient-to-r from-[#fdf2f2] to-[#fdf5f5]">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#6E0D12] flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-0.5">Notificação Personalizada</h3>
                <p className="text-sm text-gray-600">
                  Envie uma mensagem push para todos os clientes ou para um segmento específico (novos, inativos, etc.) com redirecionamento para qualquer tela do app.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white flex-shrink-0"
                onClick={() => setSendCustomOpen(true)}
              >
                <Send className="w-4 h-4 mr-1" />
                Enviar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notificações Agendadas */}
        <ScheduledNotificationsSection />

        {/* Info banner */}
        <div className="bg-[#fdf5f5] border border-[#fce8e8] rounded-lg p-3 mb-6 flex items-start gap-2">
          <Shuffle className="w-4 h-4 text-[#6E0D12] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[#5a0a0f]">
            <strong>Como funciona:</strong> Para cada evento (ex: pedido entregue), cadastre várias versões de mensagem.
            A cada disparo, o sistema sorteia uma aleatoriamente. Use{" "}
            <code className="bg-[#fce8e8] px-1 rounded">{"{{clientName}}"}</code>,{" "}
            <code className="bg-[#fce8e8] px-1 rounded">{"{{orderId}}"}</code> e{" "}
            <code className="bg-[#fce8e8] px-1 rounded">{"{{total}}"}</code> para personalizar.
            Agora você também pode definir para qual tela a notificação redireciona ao ser tocada.
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-[#6E0D12]" />
          </div>
        ) : (
          <div className="space-y-6">
            {EVENT_ORDER.map((ev) => {
              const list = grouped[ev] ?? [];
              return (
                <Card key={ev}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{EVENT_LABELS[ev]}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {list.filter((t) => t.isActive).length} ativo{list.filter((t) => t.isActive).length !== 1 ? "s" : ""}
                          {" / "}{list.length} total
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-[#6E0D12] hover:text-[#5a0a0f] hover:bg-[#fdf2f2]"
                          onClick={() => {
                            setEditTemplate(null);
                            setDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Adicionar variação
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {list.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-lg">
                        Nenhum template para este evento.{" "}
                        <button
                          className="text-[#6E0D12] hover:underline"
                          onClick={() => { setEditTemplate(null); setDialogOpen(true); }}
                        >
                          Criar agora
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {list.map((t) => (
                          <TemplateCard
                            key={t.id}
                            template={t}
                            onEdit={(tmpl) => { setEditTemplate(tmpl); setDialogOpen(true); }}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <TemplateFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTemplate(null); }}
        editTemplate={editTemplate}
      />

      <SendCustomDialog
        open={sendCustomOpen}
        onClose={() => setSendCustomOpen(false)}
      />
    </div>
  );
}
