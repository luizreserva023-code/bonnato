import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Plus, Play, Pause, Trash2, Edit, Zap, Users, ShoppingCart,
  Clock, MessageCircle, Bell, GitBranch, Tag, Save, ArrowLeft,
  RefreshCw, CheckCircle, Webhook, Copy, ListChecks, ChevronDown, ChevronUp,
  AlertCircle, Star, X, FlaskConical, Loader2, TrendingUp, Activity,
  Gift, Coins, Megaphone, Shuffle, PackageCheck, PackageX, Cake, Trophy, Timer,
} from "lucide-react";
import { nodeTypes, edgeTypes } from "@/components/flow/FlowNodes";

// ─── Types ───────────────────────────────────────────────────────────────────
type StepType = "wait" | "send_whatsapp" | "send_push" | "condition" | "add_tag" | "remove_tag" | "webhook" | "send_coupon" | "update_loyalty" | "send_alert" | "split_ab" | "pause_journey" | "notify_admin";
type TriggerType = "checkout_abandoned" | "tag_inativo_15" | "tag_inativo_30" | "tag_inativo_60" | "tag_inativo_custom" | "first_order" | "new_user" | "club_subscriber" | "manual" | "order_delivered" | "order_cancelled" | "birthday" | "loyalty_milestone" | "rating_submitted" | "rating_negative" | "club_expiring" | "first_order_month";
type JourneyStatus = "active" | "paused" | "draft";

interface JourneyStep {
  id: string;
  type: StepType;
  label: string;
  delayMinutes?: number;
  message?: string;
  title?: string;
  condition?: "purchased_since_start" | "has_tag" | "has_min_orders" | "has_min_points";
  conditionTag?: string;
  conditionValue?: number;
  onTrue?: "continue" | "stop";
  onFalse?: "continue" | "stop";
  tag?: string;
  webhookUrl?: string;
  secret?: string;
  couponDiscountType?: "percentage" | "fixed";
  couponDiscountValue?: number;
  couponExpiryDays?: number;
  loyaltyPoints?: number;
  loyaltyDescription?: string;
  alertTitle?: string;
  alertMessage?: string;
  alertIcon?: string;
  alertUrl?: string;
  messageA?: string;
  messageB?: string;
  titleA?: string;
  titleB?: string;
  splitChannel?: "whatsapp" | "push";
  // pause_journey
  pauseJourneyId?: number;
  // notify_admin
  adminTaskTitle?: string;
  adminTaskMessage?: string;
  adminTaskPriority?: "low" | "normal" | "high";
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  checkout_abandoned: "Carrinho Abandonado",
  tag_inativo_15: "Inativo 15 dias",
  tag_inativo_30: "Inativo 30 dias",
  tag_inativo_60: "Inativo 60 dias",
  first_order: "Primeiro Pedido",
  new_user: "Novo Usuário",
  club_subscriber: "Clube do Bonatto",
  manual: "Manual",
  order_delivered: "Pedido Entregue",
  order_cancelled: "Pedido Cancelado",
  birthday: "Aniversário",
  loyalty_milestone: "Marco de Pontos",
  rating_submitted: "Avaliação Enviada",
  rating_negative: "Avaliação Negativa",
  club_expiring: "Clube Expirando",
  first_order_month: "1º Pedido do Mês",
  tag_inativo_custom: "Inativo N dias",
};

const TRIGGER_DESCRIPTIONS: Record<TriggerType, string> = {
  checkout_abandoned: "Dispara quando cliente abandona o carrinho sem finalizar",
  tag_inativo_15: "Dispara quando cliente fica 15 dias sem pedir",
  tag_inativo_30: "Dispara quando cliente fica 30 dias sem pedir",
  tag_inativo_60: "Dispara quando cliente fica 60 dias sem pedir",
  first_order: "Dispara após o primeiro pedido entregue",
  new_user: "Dispara quando um novo usuário se cadastra",
  club_subscriber: "Dispara quando cliente assina o Clube do Bonatto",
  manual: "Disparado manualmente pelo admin",
  order_delivered: "Dispara quando um pedido é marcado como entregue",
  order_cancelled: "Dispara quando um pedido é cancelado",
  birthday: "Dispara no aniversário do cliente (requer data de nascimento)",
  loyalty_milestone: "Dispara quando cliente atinge 50, 100 ou 200 pontos",
  rating_submitted: "Dispara quando cliente envia uma avaliação",
  rating_negative: "Dispara quando cliente dá nota ≤3 na avaliação",
  club_expiring: "Dispara 3 dias antes do clube expirar",
  first_order_month: "Dispara no primeiro pedido entregue do mês corrente",
  tag_inativo_custom: "Dispara quando cliente fica N dias sem pedir (configurável)",
};

const TRIGGER_ICONS: Record<TriggerType, React.ReactNode> = {
  checkout_abandoned: <ShoppingCart className="w-4 h-4" />,
  tag_inativo_15: <Clock className="w-4 h-4" />,
  tag_inativo_30: <Clock className="w-4 h-4" />,
  tag_inativo_60: <Clock className="w-4 h-4" />,
  first_order: <Star className="w-4 h-4" />,
  new_user: <Users className="w-4 h-4" />,
  club_subscriber: <Tag className="w-4 h-4" />,
  manual: <Play className="w-4 h-4" />,
  order_delivered: <PackageCheck className="w-4 h-4" />,
  order_cancelled: <PackageX className="w-4 h-4" />,
  birthday: <Cake className="w-4 h-4" />,
  loyalty_milestone: <Trophy className="w-4 h-4" />,
  rating_submitted: <Star className="w-4 h-4" />,
  rating_negative: <AlertCircle className="w-4 h-4" />,
  club_expiring: <Timer className="w-4 h-4" />,
  first_order_month: <Trophy className="w-4 h-4" />,
  tag_inativo_custom: <Clock className="w-4 h-4" />,
};

// ─── Trigger color accent per type (Nexus light) ─────────────────────────────
const TRIGGER_ACCENT: Record<TriggerType, { bg: string; icon: string; border: string }> = {
  checkout_abandoned: { bg: "bg-[#fdf2f2]", icon: "text-[#6E0D12]", border: "border-[#fca5a5]" },
  tag_inativo_15:     { bg: "bg-[#fffbeb]", icon: "text-[#92400e]", border: "border-[#fcd34d]" },
  tag_inativo_30:     { bg: "bg-[#fffbeb]", icon: "text-[#92400e]", border: "border-[#fcd34d]" },
  tag_inativo_60:     { bg: "bg-[#fffbeb]", icon: "text-[#92400e]", border: "border-[#fcd34d]" },
  first_order:        { bg: "bg-[#fdf2f2]", icon: "text-[#6E0D12]", border: "border-[#fca5a5]" },
  new_user:           { bg: "bg-[#eff6ff]", icon: "text-[#1d4ed8]", border: "border-[#93c5fd]" },
  club_subscriber:    { bg: "bg-[#f0fdf4]", icon: "text-[#15803d]", border: "border-[#86efac]" },
  manual:             { bg: "bg-[#f8fafc]", icon: "text-[#475569]", border: "border-[#cbd5e1]" },
  order_delivered:    { bg: "bg-[#f0fdf4]", icon: "text-[#15803d]", border: "border-[#86efac]" },
  order_cancelled:    { bg: "bg-[#fdf2f2]", icon: "text-[#6E0D12]", border: "border-[#fca5a5]" },
  birthday:           { bg: "bg-[#fdf4ff]", icon: "text-[#7c3aed]", border: "border-[#d8b4fe]" },
  loyalty_milestone:  { bg: "bg-[#fffbeb]", icon: "text-[#92400e]", border: "border-[#fcd34d]" },
  rating_submitted:   { bg: "bg-[#fdf2f2]", icon: "text-[#6E0D12]", border: "border-[#fca5a5]" },
  rating_negative:    { bg: "bg-[#fdf2f2]", icon: "text-[#6E0D12]", border: "border-[#fca5a5]" },
  club_expiring:      { bg: "bg-[#fff7ed]", icon: "text-[#c2410c]", border: "border-[#fdba74]" },
  first_order_month:  { bg: "bg-[#fffbeb]", icon: "text-[#92400e]", border: "border-[#fcd34d]" },
  tag_inativo_custom: { bg: "bg-[#fffbeb]", icon: "text-[#92400e]", border: "border-[#fcd34d]" },
};

const STATUS_COLORS: Record<JourneyStatus, string> = {
  active: "bg-[#f0fdf4] text-[#15803d] border-[#86efac]",
  paused: "bg-[#fffbeb] text-[#92400e] border-[#fcd34d]",
  draft:  "bg-[#f8fafc] text-[#475569] border-[#cbd5e1]",
};

const STATUS_LABELS: Record<JourneyStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  draft: "Rascunho",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function stepsToNodes(steps: JourneyStep[], trigger: TriggerType): Node[] {
  const nodes: Node[] = [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 80, y: 40 },
      data: { label: TRIGGER_LABELS[trigger] ?? trigger, trigger },
    },
  ];
  steps.forEach((step, i) => {
    nodes.push({
      id: step.id,
      type: step.type,
      position: { x: 80, y: 160 + i * 160 },
      data: { ...(step as unknown as Record<string, unknown>) },
    });
  });
  return nodes;
}

function stepsToEdges(steps: JourneyStep[]): Edge[] {
  const edges: Edge[] = [];
  const allIds = ["trigger", ...steps.map((s) => s.id)];
  for (let i = 0; i < allIds.length - 1; i++) {
    edges.push({
      id: `e-${allIds[i]}-${allIds[i + 1]}`,
      source: allIds[i],
      target: allIds[i + 1],
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6E0D12" },
      style: { stroke: "#6E0D12", strokeWidth: 1.5, strokeDasharray: "6 4", opacity: 0.6 },
    });
  }
  return edges;
}

function nodesToSteps(nodes: Node[]): JourneyStep[] {
  return nodes
    .filter((n) => n.id !== "trigger")
    .sort((a, b) => a.position.y - b.position.y)
    .map((n) => ({ ...(n.data as unknown as JourneyStep), id: n.id }));
}// ─── Step palette items (Nexus light) ─────────────────────────────────────────────────
const PALETTE: { type: StepType; label: string; icon: React.ReactNode; group: string }[] = [
  // Mensagens
  { type: "send_whatsapp", label: "WhatsApp",  icon: <MessageCircle className="w-3.5 h-3.5" />, group: "msg" },
  { type: "send_push",     label: "Push",       icon: <Bell className="w-3.5 h-3.5" />,          group: "msg" },
  { type: "send_alert",   label: "Alerta App", icon: <Megaphone className="w-3.5 h-3.5" />,     group: "msg" },
  // Lógica
  { type: "condition",    label: "Condição",  icon: <GitBranch className="w-3.5 h-3.5" />,     group: "logic" },
  { type: "split_ab",     label: "Teste A/B",  icon: <Shuffle className="w-3.5 h-3.5" />,       group: "logic" },
  // Ações
  { type: "send_coupon",    label: "Cupom",      icon: <Gift className="w-3.5 h-3.5" />,          group: "action" },
  { type: "update_loyalty", label: "Pontos",     icon: <Coins className="w-3.5 h-3.5" />,         group: "action" },
  { type: "add_tag",      label: "Add Tag",    icon: <Tag className="w-3.5 h-3.5" />,            group: "action" },
  { type: "remove_tag",   label: "Rem Tag",    icon: <Tag className="w-3.5 h-3.5" />,            group: "action" },
  { type: "webhook",      label: "Webhook",    icon: <Webhook className="w-3.5 h-3.5" />,        group: "action" },
  // Controle
  { type: "pause_journey", label: "Pausar Jornada", icon: <Pause className="w-3.5 h-3.5" />,     group: "action" },
  { type: "notify_admin",  label: "Tarefa Admin",  icon: <Bell className="w-3.5 h-3.5" />,        group: "action" },
  // Tempo
  { type: "wait",         label: "Aguardar",   icon: <Clock className="w-3.5 h-3.5" />,          group: "timing" },
];

const PALETTE_GROUP_COLORS: Record<string, string> = {
  msg:    "text-[#6E0D12] border-[#fca5a5] hover:bg-[#fdf2f2] hover:border-[#6E0D12]",
  logic:  "text-[#1d4ed8] border-[#93c5fd] hover:bg-[#eff6ff] hover:border-[#1d4ed8]",
  action: "text-[#15803d] border-[#86efac] hover:bg-[#f0fdf4] hover:border-[#15803d]",
  timing: "text-[#92400e] border-[#fcd34d] hover:bg-[#fffbeb] hover:border-[#92400e]",
};// ─── TagSelect ────────────────────────────────────────────────────────────────
function TagSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: customTags } = trpc.crm.listCustomTags.useQuery();
  const tags = customTags ?? [];
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Selecione uma tag..." />
      </SelectTrigger>
      <SelectContent>
        {tags.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">Nenhuma tag criada. Crie no CRM → Tags.</div>
        )}
        {tags.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
              #{t.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Node editor panel ────────────────────────────────────────────────────────
function NodeEditor({ node, onSave, onDelete, onClose, journeyId }: {
  node: Node;
  onSave: (id: string, data: Partial<JourneyStep>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  journeyId?: number;
}) {
  const d = node.data as unknown as JourneyStep;
  const [form, setForm] = useState<Partial<JourneyStep & { webhookUrl?: string; secret?: string }>>({ ...d });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const generateToken = trpc.automations.generateWebhookToken.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/api/automations/webhook/${data.token}`;
      setForm((f) => ({ ...f, webhookUrl: url }));
      toast.success("URL do webhook gerada!");
    },
    onError: () => toast.error("Erro ao gerar URL do webhook"),
  });

  return (
    <div className="space-y-4 p-1">
      {/* Label */}
      <div>
        <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Rótulo</Label>
        <Input value={form.label ?? ""} onChange={(e) => set("label", e.target.value)} className="mt-1 border-[#f9d0d0] focus:border-[#6E0D12]" placeholder="Nome do passo" />
      </div>

      {node.type === "wait" && (
        <div>
          <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Aguardar (minutos)</Label>
          <Input
            type="number" min={1}
            value={form.delayMinutes ?? 15}
            onChange={(e) => set("delayMinutes", Number(e.target.value))}
            className="mt-1 border-[#f9d0d0] focus:border-[#6E0D12]"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {form.delayMinutes && form.delayMinutes >= 60
              ? `= ${(form.delayMinutes / 60).toFixed(1)} hora(s)`
              : `${form.delayMinutes ?? 15} minutos`}
          </p>
        </div>
      )}

      {(node.type === "send_whatsapp" || node.type === "send_push") && (
        <>
          {node.type === "send_push" && (
            <div>
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Título da notificação</Label>
              <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className="mt-1 border-[#f9d0d0] focus:border-[#6E0D12]" placeholder="Título" />
            </div>
          )}
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Mensagem</Label>
            <Textarea
              value={form.message ?? ""}
              onChange={(e) => set("message", e.target.value)}
              className="mt-1 min-h-[100px] text-sm border-[#f9d0d0] focus:border-[#6E0D12]"
              placeholder={node.type === "send_whatsapp" ? "Use {nome}, {pedido}, {link}..." : "Corpo da notificação..."}
            />
            {node.type === "send_whatsapp" && (
              <p className="text-[11px] text-gray-400 mt-1">Variáveis: {"{nome}"} {"{pedido}"} {"{link}"}</p>
            )}
            {!form.message && (
              <p className="text-[11px] text-[#6E0D12] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Mensagem obrigatória
              </p>
            )}
          </div>
        </>
      )}

      {node.type === "condition" && (
        <>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Condição</Label>
            <Select value={form.condition ?? ""} onValueChange={(v) => set("condition", v)}>
              <SelectTrigger className="mt-1 border-[#f9d0d0]"><SelectValue placeholder="Escolha..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="purchased_since_start">Comprou desde o início da jornada?</SelectItem>
                <SelectItem value="has_tag">Tem a tag?</SelectItem>
                <SelectItem value="has_min_orders">Tem mínimo de pedidos?</SelectItem>
                <SelectItem value="has_min_points">Tem mínimo de pontos?</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.condition === "has_tag" && (
            <div>
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Tag</Label>
              <Input value={form.conditionTag ?? ""} onChange={(e) => set("conditionTag", e.target.value)} className="mt-1 border-[#f9d0d0]" placeholder="nome-da-tag" />
            </div>
          )}
          {(form.condition === "has_min_orders" || form.condition === "has_min_points") && (
            <div>
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">
                {form.condition === "has_min_orders" ? "Mínimo de pedidos" : "Mínimo de pontos"}
              </Label>
              <Input type="number" min={1} value={form.conditionValue ?? 1}
                onChange={(e) => set("conditionValue", Number(e.target.value))}
                className="mt-1 border-[#f9d0d0]" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-bold text-[#166534] uppercase tracking-wider">Se VERDADEIRO</Label>
              <Select value={form.onTrue ?? "continue"} onValueChange={(v) => set("onTrue", v)}>
                <SelectTrigger className="mt-1 border-[#bbf7d0]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continuar</SelectItem>
                  <SelectItem value="stop">Parar jornada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-[#7d0f14] uppercase tracking-wider">Se FALSO</Label>
              <Select value={form.onFalse ?? "continue"} onValueChange={(v) => set("onFalse", v)}>
                <SelectTrigger className="mt-1 border-[#f9d0d0]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continuar</SelectItem>
                  <SelectItem value="stop">Parar jornada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {(node.type === "add_tag" || node.type === "remove_tag") && (
        <div>
          <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">
            {node.type === "add_tag" ? "Tag a adicionar" : "Tag a remover"}
          </Label>
          <TagSelect value={form.tag ?? ""} onChange={(v) => set("tag", v)} />
          {!form.tag && (
            <p className="text-[11px] text-[#6E0D12] mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Selecione uma tag
            </p>
          )}
        </div>
      )}

      {node.type === "webhook" && (
        <>
          <div className="rounded-xl border border-[#fce8e8] bg-[#fdf2f2] p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-[#6E0D12]" />
              <span className="text-xs font-bold text-[#5a0a0f] uppercase tracking-wider">Endpoint do Webhook</span>
            </div>
            {(form as Record<string, unknown>).webhookUrl ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Input readOnly value={(form as Record<string, unknown>).webhookUrl as string} className="text-[11px] font-mono bg-white border-[#f9d0d0]" />
                  <Button size="sm" variant="outline" className="border-[#c0606a] text-[#6E0D12] hover:bg-[#fce8e8] shrink-0"
                    onClick={() => { navigator.clipboard.writeText((form as Record<string, unknown>).webhookUrl as string); toast.success("URL copiada!"); }}>
                    Copiar
                  </Button>
                </div>
                <p className="text-[11px] text-[#6E0D12]/70">Envie um POST para esta URL para disparar a jornada externamente.</p>
                <Button size="sm" variant="outline" className="border-[#c0606a] text-[#6E0D12] hover:bg-[#fce8e8] w-full text-xs"
                  onClick={() => journeyId && generateToken.mutate({ id: journeyId })}
                  disabled={generateToken.isPending || !journeyId}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${generateToken.isPending ? "animate-spin" : ""}`} /> Regenerar URL
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-[#6E0D12]/70">Gere uma URL única para receber chamadas externas (Zapier, Make, etc).</p>
                <Button size="sm" className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white w-full text-xs"
                  onClick={() => journeyId && generateToken.mutate({ id: journeyId })}
                  disabled={generateToken.isPending || !journeyId}>
                  {generateToken.isPending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Webhook className="w-3 h-3 mr-1" />}
                  Gerar URL do Webhook
                </Button>
                {!journeyId && <p className="text-[10px] text-gray-400">Salve a jornada primeiro para gerar a URL.</p>}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Secret (opcional)</Label>
            <Input value={(form as Record<string, unknown>).secret as string ?? ""} onChange={(e) => set("secret", e.target.value)}
              className="mt-1 font-mono border-[#f9d0d0]" placeholder="chave-secreta-para-validacao" />
            <p className="text-[11px] text-gray-400 mt-1">Se preenchido, o header X-Webhook-Secret deve bater.</p>
          </div>
        </>
      )}

      {node.type === "send_coupon" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Tipo de desconto</Label>
              <Select value={form.couponDiscountType ?? "percentage"} onValueChange={(v) => set("couponDiscountType", v)}>
                <SelectTrigger className="mt-1 border-[#f9d0d0]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">
                {form.couponDiscountType === "fixed" ? "Valor (R$)" : "Desconto (%)"}
              </Label>
              <Input type="number" min={1} max={form.couponDiscountType === "percentage" ? 100 : undefined}
                value={form.couponDiscountValue ?? 10}
                onChange={(e) => set("couponDiscountValue", Number(e.target.value))}
                className="mt-1 border-[#f9d0d0]" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Validade (dias)</Label>
            <Input type="number" min={0} value={form.couponExpiryDays ?? 7}
              onChange={(e) => set("couponExpiryDays", Number(e.target.value))}
              className="mt-1 border-[#f9d0d0]" />
            <p className="text-[11px] text-gray-400 mt-1">0 = sem vencimento. O código é gerado automaticamente e enviado via Push + WhatsApp.</p>
          </div>
        </>
      )}

      {node.type === "update_loyalty" && (
        <>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Pontos (positivo = adicionar, negativo = remover)</Label>
            <Input type="number" value={form.loyaltyPoints ?? 10}
              onChange={(e) => set("loyaltyPoints", Number(e.target.value))}
              className="mt-1 border-[#f9d0d0]" />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Descrição (opcional)</Label>
            <Input value={form.loyaltyDescription ?? ""}
              onChange={(e) => set("loyaltyDescription", e.target.value)}
              className="mt-1 border-[#f9d0d0]" placeholder="Ex: Bônus de aniversário" />
          </div>
        </>
      )}

      {node.type === "send_alert" && (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Emoji</Label>
              <Input value={form.alertIcon ?? "🔔"} onChange={(e) => set("alertIcon", e.target.value)}
                className="mt-1 border-[#f9d0d0] text-center text-lg" maxLength={2} />
            </div>
            <div className="col-span-3">
              <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Título</Label>
              <Input value={form.alertTitle ?? ""} onChange={(e) => set("alertTitle", e.target.value)}
                className="mt-1 border-[#f9d0d0]" placeholder="Ex: Novidade especial para você!" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Mensagem</Label>
            <Textarea value={form.alertMessage ?? ""} onChange={(e) => set("alertMessage", e.target.value)}
              className="mt-1 min-h-[80px] text-sm border-[#f9d0d0]" placeholder="Conteúdo do alerta no app..." />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">URL de destino (opcional)</Label>
            <Input value={form.alertUrl ?? ""} onChange={(e) => set("alertUrl", e.target.value)}
              className="mt-1 border-[#f9d0d0]" placeholder="/cardapio" />
          </div>
        </>
      )}

      {node.type === "split_ab" && (
        <>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Canal</Label>
            <Select value={form.splitChannel ?? "push"} onValueChange={(v) => set("splitChannel", v)}>
              <SelectTrigger className="mt-1 border-[#f9d0d0]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="push">Push Notification</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.splitChannel !== "whatsapp" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Título A</Label>
                <Input value={form.titleA ?? ""} onChange={(e) => set("titleA", e.target.value)}
                  className="mt-1 border-[#f9d0d0]" placeholder="Versão A" />
              </div>
              <div>
                <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Título B</Label>
                <Input value={form.titleB ?? ""} onChange={(e) => set("titleB", e.target.value)}
                  className="mt-1 border-[#f9d0d0]" placeholder="Versão B" />
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Mensagem A (50% dos usuários)</Label>
            <Textarea value={form.messageA ?? ""} onChange={(e) => set("messageA", e.target.value)}
              className="mt-1 min-h-[70px] text-sm border-[#f9d0d0]" placeholder="Texto da versão A..." />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Mensagem B (50% dos usuários)</Label>
            <Textarea value={form.messageB ?? ""} onChange={(e) => set("messageB", e.target.value)}
              className="mt-1 min-h-[70px] text-sm border-[#f9d0d0]" placeholder="Texto da versão B..." />
          </div>
          <p className="text-[11px] text-gray-400">IDs pares = Grupo A, IDs ímpares = Grupo B.</p>
        </>
      )}

      {node.type === "pause_journey" && (
        <>
          <div className="rounded-xl border border-[#fce8e8] bg-[#fdf5f5] px-4 py-3 text-sm text-[#5a0a0f]">
            <p className="font-bold mb-1 flex items-center gap-1.5"><Pause className="w-3.5 h-3.5" /> Pausar esta jornada</p>
            <p className="text-xs text-gray-500">Quando este passo for executado, a jornada atual será pausada automaticamente para o cliente. Útil como condição de saída após atingir o objetivo.</p>
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Rótulo do passo</Label>
            <Input value={form.label ?? "Pausar jornada"} onChange={(e) => set("label", e.target.value)}
              className="mt-1 border-[#f9d0d0]" placeholder="Ex: Objetivo atingido, pausar" />
          </div>
        </>
      )}

      {node.type === "notify_admin" && (
        <>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Título da tarefa</Label>
            <Input value={form.adminTaskTitle ?? ""} onChange={(e) => set("adminTaskTitle", e.target.value)}
              className="mt-1 border-[#f9d0d0]" placeholder="Ex: Ligar para cliente VIP" />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Mensagem / instruções</Label>
            <Textarea value={form.adminTaskMessage ?? ""} onChange={(e) => set("adminTaskMessage", e.target.value)}
              className="mt-1 min-h-[80px] text-sm border-[#f9d0d0]" placeholder="Descreva o que o admin deve fazer..." />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Prioridade</Label>
            <Select value={form.adminTaskPriority ?? "normal"} onValueChange={(v) => set("adminTaskPriority", v)}>
              <SelectTrigger className="mt-1 border-[#f9d0d0]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Baixa</SelectItem>
                <SelectItem value="normal">🟡 Normal</SelectItem>
                <SelectItem value="high">🔴 Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-gray-400">Uma notificação será enviada ao admin com o nome do cliente e as instruções acima.</p>
        </>
      )}

      <div className="flex gap-2 pt-3 border-t border-[#fce8e8]">
        <Button size="sm" className="flex-1 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-bold"
          onClick={() => { onSave(node.id, form); onClose(); }}>
          <Save className="w-3 h-3 mr-1" /> Salvar passo
        </Button>
        <Button size="sm" variant="outline" className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2]"
          onClick={() => { onDelete(node.id); onClose(); }}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Execution Log Dialog ─────────────────────────────────────────────────────
function ExecutionLogDialog({ execId, onClose }: { execId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.automations.getExecutionLogs.useQuery({ executionId: execId });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-[#6E0D12]">
            <ListChecks className="w-4 h-4" /> Logs da Execução #{execId}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#6E0D12]" /> Carregando...
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-gray-400 text-sm">Execução não encontrada</div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3 text-sm items-center">
              <span className="font-semibold text-gray-600">Status:</span>
              <Badge className={
                data.status === "completed" ? "bg-[#f0fdf4] text-[#166534]" :
                data.status === "running" ? "bg-[#fce8e8] text-[#6E0D12]" :
                data.status === "failed" ? "bg-[#fce8e8] text-[#450709]" :
                "bg-gray-100 text-gray-700"
              }>
                {data.status === "completed" ? "Concluída" :
                 data.status === "running" ? "Em andamento" :
                 data.status === "failed" ? "Falhou" :
                 data.status === "cancelled" ? "Cancelada" : data.status}
              </Badge>
              <span className="text-gray-400 text-xs">Passo {data.currentStep}</span>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 max-h-64 overflow-y-auto space-y-1">
              {data.logs.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum log registrado</p>
              ) : (
                data.logs.map((log, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <span className="text-gray-400 shrink-0">{new Date(log.at).toLocaleTimeString("pt-BR")}</span>
                    <span className="text-gray-700">{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2]">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Executions Panel ─────────────────────────────────────────────────────────
function ExecutionsPanel({ journeyId, journeyName }: { journeyId: number; journeyName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [viewLogId, setViewLogId] = useState<number | null>(null);
  const { data: executions, refetch } = trpc.automations.listExecutions.useQuery({ journeyId });
  const cancelMutation = trpc.automations.cancelExecution.useMutation({
    onSuccess: () => { refetch(); toast.success("Execução cancelada"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
  const execs = executions ?? [];
  const running = execs.filter((e) => e.status === "running").length;

  return (
    <div className="rounded-xl border border-[#e8ebf0] overflow-hidden" style={{ background: "#ffffff" }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f8fafc] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1a1d23]">
          <Activity className="w-4 h-4 text-[#6E0D12]" />
          Execuções de <span className="text-[#6E0D12]">{journeyName}</span>
          <span className="text-[#8a92a0] font-normal">({execs.length})</span>
          {running > 0 && (
            <span className="flex items-center gap-1 text-xs bg-[#fdf2f2] text-[#6E0D12] border border-[#fca5a5] px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6E0D12] animate-pulse" />
              {running} ativa{running !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#8a92a0]" /> : <ChevronDown className="w-4 h-4 text-[#8a92a0]" />}
      </button>
      {expanded && (
        <div className="divide-y divide-[#f0f2f5] max-h-72 overflow-y-auto">
          {execs.length === 0 ? (
            <div className="py-6 text-center text-[#8a92a0] text-sm">Nenhuma execução registrada</div>
          ) : (
            [...execs].reverse().map((exec) => (
              <div key={exec.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f8fafc]">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    exec.status === "running" ? "bg-[#6E0D12] animate-pulse" :
                    exec.status === "completed" ? "bg-[#15803d]" :
                    exec.status === "failed" ? "bg-[#dc2626]" : "bg-[#8a92a0]"
                  }`} />
                  <div>
                    <div className="text-xs font-medium text-[#1a1d23]">
                      Usuário #{exec.userId} · Passo {exec.currentStep}
                    </div>
                    <div className="text-[11px] text-[#8a92a0]">
                      {new Date(exec.startedAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className={`text-[10px] ${
                    exec.status === "running" ? "bg-[#fdf2f2] text-[#6E0D12] border border-[#fca5a5]" :
                    exec.status === "completed" ? "bg-[#f0fdf4] text-[#15803d] border border-[#86efac]" :
                    exec.status === "failed" ? "bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]" :
                    "bg-[#f8fafc] text-[#8a92a0] border border-[#e8ebf0]"
                  }`}>
                    {exec.status === "running" ? "Ativa" :
                     exec.status === "completed" ? "Concluída" :
                     exec.status === "failed" ? "Falhou" :
                     exec.status === "cancelled" ? "Cancelada" : exec.status}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-[#c0606a]"
                    onClick={() => setViewLogId(exec.id)} title="Ver logs">
                    <ListChecks className="w-3 h-3" />
                  </Button>
                  {exec.status === "running" && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-[#c0606a]"
                      onClick={() => cancelMutation.mutate({ id: exec.id })}
                      disabled={cancelMutation.isPending} title="Cancelar">
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {viewLogId && <ExecutionLogDialog execId={viewLogId} onClose={() => setViewLogId(null)} />}
    </div>
  );
}// ─── A/B Stats Panel ─────────────────────────────────────────────────────────────────────────────────
function AbStatsPanel({ journeyId }: { journeyId: number }) {
  const { data: stats } = trpc.automations.getAbStats.useQuery({ journeyId });
  if (!stats || (stats.groupA === 0 && stats.groupB === 0)) return null;
  const total = stats.groupA + stats.groupB;
  const pctA = total > 0 ? Math.round((stats.groupA / total) * 100) : 50;
  const pctB = 100 - pctA;
  return (
    <div className="rounded-xl border border-[#e8ebf0] bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[#e8ebf0]">
        <Shuffle className="w-4 h-4 text-[#1d4ed8]" />
        <span className="text-sm font-bold text-[#1a1d23]">Resultados do Teste A/B</span>
        <span className="text-xs text-[#8a92a0] ml-auto">{total} usuários no total</span>
      </div>
      <div className="px-4 py-4 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6E0D12] uppercase tracking-wider">Grupo A</span>
            <span className="text-xs text-[#8a92a0]">{stats.groupA} usuários ({pctA}%)</span>
          </div>
          <div className="h-2 rounded-full bg-[#fce8e8] overflow-hidden">
            <div className="h-full rounded-full bg-[#6E0D12] transition-all" style={{ width: `${pctA}%` }} />
          </div>
          {stats.conversionA > 0 && (
            <p className="text-xs text-[#8a92a0]">{stats.conversionA} conversões ({stats.groupA > 0 ? Math.round((stats.conversionA / stats.groupA) * 100) : 0}%)</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8a92a0] uppercase tracking-wider">Grupo B</span>
            <span className="text-xs text-[#8a92a0]">{stats.groupB} usuários ({pctB}%)</span>
          </div>
          <div className="h-2 rounded-full bg-[#e8ebf0] overflow-hidden">
            <div className="h-full rounded-full bg-[#8a92a0] transition-all" style={{ width: `${pctB}%` }} />
          </div>
          {stats.conversionB > 0 && (
            <p className="text-xs text-[#8a92a0]">{stats.conversionB} conversões ({stats.groupB > 0 ? Math.round((stats.conversionB / stats.groupB) * 100) : 0}%)</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PaletteDropdown ────────────────────────────────────────────────────────────────────────────
function PaletteDropdown({
  label, icon, colorClass, items, onAdd,
}: {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  items: { type: StepType; label: string; icon: React.ReactNode }[];
  onAdd: (type: StepType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useCallback(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Element && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all bg-white ${colorClass}`}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#e8ebf0] rounded-xl shadow-lg py-1 min-w-[150px]">
          {items.map((item) => (
            <button
              key={item.type}
              onClick={() => { onAdd(item.type); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#1a1d23] hover:bg-[#f0f2f5] transition-colors text-left"
            >
              <span className="opacity-60">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Flow Editor ─────────────────────────────────────────────────────────────────────────────────
function FlowEditor({ journey, onBack }: {
  journey: { id: number; name: string; trigger: string; steps: JourneyStep[]; status: string };
  onBack: () => void;
}) {
  const trigger = journey.trigger as TriggerType;
  const [nodes, setNodes, onNodesChange] = useNodesState(stepsToNodes(journey.steps, trigger));
  const [edges, setEdges, onEdgesChange] = useEdgesState(stepsToEdges(journey.steps));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showExecutions, setShowExecutions] = useState(false);
  const [localStatus, setLocalStatus] = useState(journey.status);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const idCounter = useRef(journey.steps.length + 1);
  const utils = trpc.useUtils();

  const testTriggerMutation = trpc.automations.testTrigger.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "Gatilho disparado com sucesso!");
      setTestDialogOpen(false);
      setTestPhone("");
    },
    onError: (err) => toast.error(`Erro ao testar gatilho: ${err.message}`),
  });

  const updateMutation = trpc.automations.updateJourney.useMutation({
    onSuccess: () => {
      utils.automations.listJourneys.invalidate();
      toast.success("Jornada salva com sucesso!");
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const toggleMutation = trpc.automations.toggleJourney.useMutation({
    onSuccess: (_, vars) => {
      setLocalStatus(vars.status);
      utils.automations.listJourneys.invalidate();
      toast.success(vars.status === "active" ? "Jornada ativada!" : "Jornada pausada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  const makeEdgeData = useCallback(() => ({ onDelete: deleteEdge }), [deleteEdge]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: "bonatto",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6E0D12" },
      data: { onDelete: deleteEdge },
    }, eds));
  }, [setEdges, deleteEdge]);

  const addNode = (type: StepType) => {
    const id = `step-${Date.now()}-${idCounter.current++}`;
    const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y), 0);
    const defaultData: Partial<JourneyStep> = {
      id, type,
      label: PALETTE.find((p) => p.type === type)?.label ?? type,
      delayMinutes: type === "wait" ? 15 : undefined,
      message: (type === "send_whatsapp" || type === "send_push") ? "" : undefined,
      onTrue: type === "condition" ? "continue" : undefined,
      onFalse: type === "condition" ? "stop" : undefined,
    };
    const newNode: Node = { id, type, position: { x: 80, y: maxY + 160 }, data: defaultData };
    setNodes((nds) => [...nds, newNode]);
    const lastId = nodes[nodes.length - 1]?.id;
    if (lastId) {
      setEdges((eds) => addEdge({
        id: `e-${lastId}-${id}`, source: lastId, target: id,
        type: "bonatto",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6E0D12" },
        data: { onDelete: deleteEdge },
      }, eds));
    }
  };

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id === "trigger") return;
    setSelectedNode(node);
    setSheetOpen(true);
  };

  const saveNodeData = (id: string, data: Partial<JourneyStep>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
  };

  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleSave = () => {
    const steps = nodesToSteps(nodes);
    updateMutation.mutate({ id: journey.id, steps });
  };

  const handleToggle = () => {
    const newStatus = localStatus === "active" ? "paused" : "active";
    toggleMutation.mutate({ id: journey.id, status: newStatus });
  };

  const stepCount = nodes.filter(n => n.id !== "trigger").length;

  return (
    <div className="flex flex-col h-screen" style={{
      background: "#f0f2f5",
      backgroundImage: "radial-gradient(circle, #c8cdd6 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    }}>
      {/* ── Toolbar ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          background: "#ffffff",
          borderColor: "#e8ebf0",
        }}
      >
        {/* Left: back + info */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}
            className="text-[#6E0D12] hover:text-[#6E0D12] hover:bg-[#fdf2f2] border border-[#fca5a5] bg-transparent">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="w-px h-6 bg-[#e8ebf0]" />
          <div>
            <div className="text-[#1a1d23] font-bold text-sm tracking-tight" style={{ fontFamily: "Poppins, sans-serif" }}>
              {journey.name}
            </div>
            <div className="text-[#8a92a0] text-xs flex items-center gap-1">
              {TRIGGER_ICONS[trigger]}
              <span>{TRIGGER_LABELS[trigger] ?? journey.trigger}</span>
              <span className="text-[#e8ebf0] mx-1">·</span>
              <span>{stepCount} passo{stepCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${STATUS_COLORS[localStatus as JourneyStatus]}`}>
            {STATUS_LABELS[localStatus as JourneyStatus] ?? localStatus}
          </Badge>
        </div>

        {/* Right: palette + actions */}
        <div className="flex items-center gap-2">
          {/* Step palette — grouped dropdowns */}
          <div className="flex gap-1.5">
            {([
              { group: "msg",    label: "Mensagem",  icon: <MessageCircle className="w-3.5 h-3.5" />, color: "text-[#6E0D12] border-[#fca5a5] hover:bg-[#fdf2f2] hover:border-[#6E0D12]" },
              { group: "logic",  label: "Lógica",    icon: <GitBranch className="w-3.5 h-3.5" />,     color: "text-[#1d4ed8] border-[#93c5fd] hover:bg-[#eff6ff] hover:border-[#1d4ed8]" },
              { group: "action", label: "Ação",      icon: <Zap className="w-3.5 h-3.5" />,           color: "text-[#15803d] border-[#86efac] hover:bg-[#f0fdf4] hover:border-[#15803d]" },
              { group: "timing", label: "Tempo",     icon: <Clock className="w-3.5 h-3.5" />,         color: "text-[#92400e] border-[#fcd34d] hover:bg-[#fffbeb] hover:border-[#92400e]" },
            ] as const).map((grp) => {
              const items = PALETTE.filter((p) => p.group === grp.group);
              return (
                <PaletteDropdown key={grp.group} label={grp.label} icon={grp.icon} colorClass={grp.color} items={items} onAdd={addNode} />
              );
            })}
          </div>
          <div className="w-px h-5 bg-[#e8ebf0] mx-0.5" />

          <Button size="sm" variant="outline" onClick={() => setTestDialogOpen(true)}
            className="border-[#e8ebf0] text-[#8a92a0] hover:text-[#6E0D12] hover:border-[#fca5a5] hover:bg-[#fdf2f2]">
            <FlaskConical className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Testar</span>
          </Button>

          <Button size="sm" variant="outline" onClick={() => setShowExecutions(v => !v)}
            className={`border-[#e8ebf0] text-[#8a92a0] hover:text-[#6E0D12] hover:border-[#fca5a5] hover:bg-[#fdf2f2] ${showExecutions ? "!bg-[#fdf2f2] !border-[#fca5a5] !text-[#6E0D12]" : ""}`}>
            <ListChecks className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Execuções</span>
          </Button>

          <Button size="sm" variant="outline" onClick={handleToggle} disabled={toggleMutation.isPending}
            className="border-[#e8ebf0] text-[#8a92a0] hover:text-[#6E0D12] hover:border-[#fca5a5] hover:bg-[#fdf2f2]">
            {toggleMutation.isPending
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              : localStatus === "active"
              ? <Pause className="w-3.5 h-3.5 mr-1" />
              : <Play className="w-3.5 h-3.5 mr-1" />}
            <span className="hidden sm:inline">{localStatus === "active" ? "Pausar" : "Ativar"}</span>
          </Button>

          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}
            className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-bold shadow-sm transition-all">
            {updateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Executions + A/B panel */}
      {showExecutions && (
        <div className="px-4 py-3 border-b space-y-3" style={{ background: "#f8fafc", borderColor: "#e8ebf0" }}>
          <ExecutionsPanel journeyId={journey.id} journeyName={journey.name} />
          <AbStatsPanel journeyId={journey.id} />
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{
            type: "bonatto",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6E0D12" },
            data: makeEdgeData(),
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#D1D5DB" style={{ background: "#F5F5F5" }} />
          <Controls className="!bg-white !border-[#E5E7EB] !rounded-xl shadow-sm [&_button]:!bg-white [&_button]:!border-[#E5E7EB] [&_button]:!text-[#6B7280] [&_button:hover]:!bg-[#FEF2F2] [&_button:hover]:!text-[#B91C1C]" />
          <MiniMap
            nodeColor={() => "#B91C1C"}
            nodeBorderRadius={8}
            className="!bg-white !border-[#E5E7EB] !rounded-xl shadow-sm"
          />
          <Panel position="bottom-center">
            <div className="text-[#6B7280] text-xs px-3 py-1.5 rounded-full border"
              style={{ background: "rgba(255,255,255,0.95)", borderColor: "#E5E7EB" }}>
              Clique em um nó para editar · Arraste para reposicionar · Conecte as alças para criar fluxo
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node editor sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-80 bg-white overflow-y-auto border-l border-[#fce8e8]">
          <SheetHeader className="border-b border-[#fce8e8] pb-3">
            <SheetTitle className="text-[#6E0D12] font-black" style={{ fontFamily: "Poppins, sans-serif" }}>
              Editar passo
            </SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <div className="mt-4">
              <NodeEditor
                node={selectedNode}
                journeyId={journey.id}
                onSave={(id, data) => {
                  saveNodeData(id, data);
                  setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
                }}
                onDelete={deleteNode}
                onClose={() => setSheetOpen(false)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Test Trigger Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-[#6E0D12]" style={{ fontFamily: "Poppins, sans-serif" }}>
              <FlaskConical className="w-5 h-5 text-[#6E0D12]" />
              Testar Gatilho
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-[#fce8e8] bg-[#fdf5f5] px-4 py-3 text-sm text-[#5a0a0f]">
              <p className="font-bold mb-1">Modo de teste</p>
              <p>Dispara a jornada <strong>{journey.name}</strong> imediatamente para o seu usuário admin, ignorando o gatilho original.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-phone" className="text-sm font-bold text-[#6E0D12]">Telefone para envio (opcional)</Label>
              <Input id="test-phone" placeholder="Ex: 11999999999" value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)} className="border-[#f9d0d0] focus:border-[#6E0D12]" />
              <p className="text-xs text-gray-500">Se vazio, usa o telefone cadastrado no seu perfil.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)} disabled={testTriggerMutation.isPending}
              className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2]">
              Cancelar
            </Button>
            <Button
              onClick={() => testTriggerMutation.mutate({ journeyId: journey.id, trigger: journey.trigger as TriggerType, phone: testPhone.trim() || undefined })}
              disabled={testTriggerMutation.isPending}
              className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-bold"
            >
              {testTriggerMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Disparando...</>
                : <><FlaskConical className="w-4 h-4 mr-2" />Disparar Teste</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Journey List (main page) ─────────────────────────────────────────────────
export default function Automacoes() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  if (!authLoading && (!user || user.role !== "admin")) {
    return <Redirect to="/" />;
  }

  const [editingJourney, setEditingJourney] = useState<null | {
    id: number; name: string; trigger: string; steps: JourneyStep[]; status: string;
  }>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState<TriggerType>("checkout_abandoned");
  const [newDescription, setNewDescription] = useState("");
  const [newDaysInactive, setNewDaysInactive] = useState(20);
  const [showMetrics, setShowMetrics] = useState(false);

  const { data: journeys, isLoading } = trpc.automations.listJourneys.useQuery();
  const { data: executions } = trpc.automations.listExecutions.useQuery({ journeyId: undefined });
  const { data: globalMetrics } = trpc.automations.getGlobalMetrics.useQuery();

  const createMutation = trpc.automations.createJourney.useMutation({
    onSuccess: (data) => {
      utils.automations.listJourneys.invalidate();
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      toast.success("Jornada criada! Configure os passos no editor.");
      setEditingJourney({ id: data.id, name: newName.trim(), trigger: newTrigger, steps: [], status: "draft" });
    },
    onError: (err) => toast.error(`Erro ao criar jornada: ${err.message}`),
  });

  const toggleMutation = trpc.automations.toggleJourney.useMutation({
    onSuccess: (_, vars) => {
      utils.automations.listJourneys.invalidate();
      toast.success(vars.status === "active" ? "Jornada ativada!" : "Jornada pausada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.automations.deleteJourney.useMutation({
    onSuccess: () => { utils.automations.listJourneys.invalidate(); toast.success("Jornada removida"); },
    onError: (err) => toast.error(`Erro ao remover: ${err.message}`),
  });

  const duplicateMutation = trpc.automations.duplicateJourney.useMutation({
    onSuccess: () => { utils.automations.listJourneys.invalidate(); toast.success("Jornada duplicada!"); },
    onError: (err) => toast.error(`Erro ao duplicar: ${err.message}`),
  });

  const execToday = executions?.filter((e: { startedAt: Date | string }) => {
    const d = new Date(e.startedAt);
    return d.toDateString() === new Date().toDateString();
  }).length ?? 0;

  const activeCount = journeys?.filter((j: { status: string }) => j.status === "active").length ?? 0;

  if (editingJourney) {
    return (
      <FlowEditor
        journey={editingJourney}
        onBack={() => { setEditingJourney(null); utils.automations.listJourneys.invalidate(); }}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{
      background: "#f0f2f5",
      backgroundImage: "radial-gradient(circle, #c8cdd6 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#fdf2f2] border border-[#fca5a5] rounded-xl">
              <Zap className="w-5 h-5 text-[#6E0D12]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1a1d23] tracking-tight" style={{ fontFamily: "Poppins, sans-serif" }}>
                Automações
              </h1>
              <p className="text-[#8a92a0] text-sm">
                Jornadas automáticas de WhatsApp, Push e ações para engajar e recuperar clientes
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-[#6E0D12] hover:bg-[#5a0a0f] shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Nova Jornada
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Jornadas ativas",   value: activeCount,           icon: <Play className="w-5 h-5 text-[#15803d]" />, accent: "bg-[#f0fdf4] border-[#86efac]" },
            { label: "Execuções hoje",    value: execToday,             icon: <Activity className="w-5 h-5 text-[#6E0D12]" />, accent: "bg-[#fdf2f2] border-[#fca5a5]" },
            { label: "Total de jornadas", value: journeys?.length ?? 0, icon: <TrendingUp className="w-5 h-5 text-[#1d4ed8]" />, accent: "bg-[#eff6ff] border-[#93c5fd]" },
          ].map((s) => (
            <Card key={s.label} className="border border-[#e8ebf0] bg-white shadow-none hover:border-[#6E0D12] hover:shadow-[0_4px_16px_rgba(110,13,18,0.06)] transition-all">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${s.accent}`}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-black text-[#1a1d23]" style={{ fontFamily: "Poppins, sans-serif" }}>
                    {s.value}
                  </div>
                  <div className="text-xs text-[#8a92a0] font-medium">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Métricas Globais ── */}
        <div className="mb-6 bg-white border border-[#e8ebf0] rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fdf5f5] transition-colors"
            onClick={() => setShowMetrics(v => !v)}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-[#fdf2f2] border border-[#fca5a5] rounded-lg">
                <TrendingUp className="w-3.5 h-3.5 text-[#6E0D12]" />
              </div>
              <span className="font-bold text-sm text-[#1a1d23]">Métricas Globais de Automações</span>
            </div>
            {showMetrics ? <ChevronUp className="w-4 h-4 text-[#8a92a0]" /> : <ChevronDown className="w-4 h-4 text-[#8a92a0]" />}
          </button>
          {showMetrics && (
            <div className="px-5 pb-5 pt-2 border-t border-[#e8ebf0]">
              {!globalMetrics ? (
                <div className="flex items-center gap-2 py-4 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin text-[#6E0D12]" /> Carregando métricas...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  {[
                    { label: "Execuções no mês", value: globalMetrics.totalExecutions, icon: <Activity className="w-4 h-4 text-[#6E0D12]" />, accent: "bg-[#fdf2f2] border-[#fca5a5]" },
                    { label: "Taxa de conversão", value: `${globalMetrics.conversionRate}%`, icon: <CheckCircle className="w-4 h-4 text-[#15803d]" />, accent: "bg-[#f0fdf4] border-[#86efac]" },
                    { label: "Conversões", value: globalMetrics.conversions, icon: <Gift className="w-4 h-4 text-[#92400e]" />, accent: "bg-[#fffbeb] border-[#fcd34d]" },
                    { label: "Receita atribuída", value: `R$ ${globalMetrics.attributedRevenue.toFixed(2)}`, icon: <Coins className="w-4 h-4 text-[#1d4ed8]" />, accent: "bg-[#eff6ff] border-[#93c5fd]" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl border border-[#e8ebf0] bg-[#f8fafc]">
                      <div className={`p-2 rounded-lg border ${m.accent}`}>{m.icon}</div>
                      <div>
                        <div className="text-xl font-black text-[#1a1d23]" style={{ fontFamily: "Poppins, sans-serif" }}>{m.value}</div>
                        <div className="text-[11px] text-[#8a92a0] font-medium">{m.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {globalMetrics && globalMetrics.topJourneys.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-[#8a92a0] uppercase tracking-wider mb-2">Top jornadas por execuções</p>
                  <div className="space-y-1.5">
                    {globalMetrics.topJourneys.map((j: { id: number; name: string; executions: number; conversions: number }) => (
                      <div key={j.id} className="flex items-center justify-between text-sm">
                        <span className="text-[#1a1d23] font-medium truncate max-w-[200px]">{j.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[#8a92a0] text-xs">{j.executions} exec.</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold bg-[#f0fdf4] text-[#15803d] border-[#86efac]">{j.conversions} conversões</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Info box ── */}
        <div className="mb-6 p-4 bg-white border border-[#e8ebf0] rounded-xl text-sm text-[#1a1d23]">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-[#fdf2f2] border border-[#fca5a5] rounded-lg shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-[#6E0D12]" />
            </div>
            <div>
              <strong className="font-semibold text-[#6E0D12]">Como funcionam as automações:</strong>{" "}
              Crie uma jornada, configure os passos (WhatsApp, Push, Cupom, Pontos, Alerta, Teste A/B, Condição, Tag, Webhook) e ative-a.
              O sistema processa execuções automaticamente a cada 2 minutos.
              Para disparar manualmente, abra a jornada e clique em "Testar".
            </div>
          </div>
        </div>

        {/* ── Journey list ── */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#6E0D12]" /> Carregando jornadas...
          </div>
        ) : !journeys?.length ? (
          <div className="border-2 border-dashed border-[#e8ebf0] rounded-2xl py-16 text-center bg-white">
            <div className="p-4 bg-[#fdf2f2] border border-[#fca5a5] rounded-2xl w-fit mx-auto mb-4">
              <Zap className="w-10 h-10 text-[#6E0D12]" />
            </div>
            <p className="text-gray-700 font-bold text-lg" style={{ fontFamily: "Poppins, sans-serif" }}>
              Nenhuma jornada criada ainda
            </p>
            <p className="text-gray-400 text-sm mt-1 mb-5">
              Crie sua primeira automação para engajar clientes automaticamente
            </p>
            <Button onClick={() => setCreateOpen(true)} className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-bold px-6">
              <Plus className="w-4 h-4 mr-2" /> Criar primeira jornada
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {(journeys as Array<{
              id: number; name: string; trigger: string; steps: JourneyStep[];
              status: string; execCount?: number; lastRunAt?: string | null;
            }>).map((j) => {
              const accent = TRIGGER_ACCENT[j.trigger as TriggerType] ?? TRIGGER_ACCENT.manual;
              return (
                <Card key={j.id}
                  className="border border-[#e8ebf0] hover:border-[#6E0D12] hover:shadow-[0_4px_20px_rgba(110,13,18,0.06)] transition-all duration-200 bg-white">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: icon + info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Accent bar */}
                        <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#6E0D12] to-[#9b1520] shrink-0" />
                        <div className={`p-3 ${accent.bg} rounded-xl border ${accent.border} shrink-0`}>
                          <span className={accent.icon}>
                            {TRIGGER_ICONS[j.trigger as TriggerType] ?? <Zap className="w-4 h-4" />}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-black text-gray-900 text-base" style={{ fontFamily: "Poppins, sans-serif" }}>
                              {j.name}
                            </h3>
                            <Badge className={`text-[10px] px-2 py-0.5 border font-bold ${STATUS_COLORS[j.status as JourneyStatus] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {STATUS_LABELS[j.status as JourneyStatus] ?? j.status}
                            </Badge>
                          </div>
                          <p className="text-gray-500 text-sm">
                            <span className="font-semibold text-[#6E0D12]">
                              {TRIGGER_LABELS[j.trigger as TriggerType] ?? j.trigger}
                            </span>
                            <span className="text-gray-300 mx-1.5">·</span>
                            <span>{j.steps?.length ?? 0} passo{(j.steps?.length ?? 0) !== 1 ? "s" : ""}</span>
                          </p>
                          <p className="text-gray-400 text-xs mt-0.5">
                            {TRIGGER_DESCRIPTIONS[j.trigger as TriggerType] ?? ""}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            {(j.execCount ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-[#6E0D12]" />
                                {j.execCount} {(j.execCount ?? 0) !== 1 ? "execuções" : "execução"}
                              </span>
                            )}
                            {j.lastRunAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Última: {new Date(j.lastRunAt).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            {j.status === "draft" && (
                              <span className="flex items-center gap-1 text-[#6E0D12] font-medium">
                                <AlertCircle className="w-3 h-3" /> Rascunho — configure os passos e ative
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setEditingJourney(j)}
                          className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2] hover:border-[#c0606a] font-semibold">
                          <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateMutation.mutate({ id: j.id })}
                          disabled={duplicateMutation.isPending} title="Duplicar"
                          className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2] hover:border-[#c0606a] w-8 h-8 p-0">
                          {duplicateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => toggleMutation.mutate({ id: j.id, status: j.status === "active" ? "paused" : "active" })}
                          disabled={toggleMutation.isPending}
                          className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2] hover:border-[#c0606a] w-8 h-8 p-0"
                          title={j.status === "active" ? "Pausar" : "Ativar"}>
                          {j.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { if (confirm(`Remover "${j.name}"?`)) deleteMutation.mutate({ id: j.id }); }}
                          disabled={deleteMutation.isPending}
                          className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2] hover:border-[#c0606a] w-8 h-8 p-0" title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-[#6E0D12]" style={{ fontFamily: "Poppins, sans-serif" }}>
              <div className="p-1.5 bg-[#fce8e8] rounded-lg">
                <Zap className="w-4 h-4 text-[#6E0D12]" />
              </div>
              Nova Jornada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-bold text-[#6E0D12]">Nome da jornada</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Recuperação de carrinho"
                className="mt-1.5 border-[#f9d0d0] focus:border-[#6E0D12]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim())
                    createMutation.mutate({ name: newName.trim(), description: newDescription || undefined, trigger: newTrigger, steps: [] });
                }}
              />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#6E0D12]">Descrição (opcional)</Label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Breve descrição do objetivo"
                className="mt-1.5 border-[#f9d0d0] focus:border-[#6E0D12]" />
            </div>
            <div>
              <Label className="text-sm font-bold text-[#6E0D12]">Gatilho</Label>
              <Select value={newTrigger} onValueChange={(v) => setNewTrigger(v as TriggerType)}>
                <SelectTrigger className="mt-1.5 border-[#f9d0d0] focus:border-[#6E0D12]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">{TRIGGER_ICONS[k]} {v}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newTrigger && (
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-[#6E0D12]" />
                  {TRIGGER_DESCRIPTIONS[newTrigger]}
                </p>
              )}
            </div>
            {newTrigger === "tag_inativo_custom" && (
              <div>
                <Label className="text-sm font-bold text-[#6E0D12]">Dias de inatividade</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    type="number" min={1} max={365}
                    value={newDaysInactive}
                    onChange={(e) => setNewDaysInactive(Number(e.target.value))}
                    className="w-24 border-[#f9d0d0] focus:border-[#6E0D12]"
                  />
                  <span className="text-sm text-gray-500">dias sem pedir</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">O gatilho disparará quando o cliente ficar exatamente {newDaysInactive} dias sem fazer um pedido.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}
              className="border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2]">
              Cancelar
            </Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription || undefined, trigger: newTrigger, steps: [], daysInactive: newTrigger === "tag_inativo_custom" ? newDaysInactive : undefined })}
              className="bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-bold"
            >
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Criar e Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
