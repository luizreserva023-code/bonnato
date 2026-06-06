import {
  Handle, Position, NodeProps,
  BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps,
} from "@xyflow/react";
import React, { useState } from "react";
import {
  Clock, MessageCircle, Bell, GitBranch, Tag, Zap,
  ShoppingCart, Users, Play, Webhook, Star,
  AlertCircle, TagIcon, Gift, Coins, Megaphone, Shuffle,
  CheckCircle2, XCircle, PackageCheck, PackageX, Cake,
  Trophy, Star as StarIcon, Timer,
} from "lucide-react";

// ─── Design System: Nexus Dashboard ──────────────────────────────────────────
// Canvas bg         : #f0f2f5
// Card bg           : #ffffff
// Card border       : #e8ebf0  (resting)
// Card border hover : #6E0D12  (hover — Bonatto accent)
// Card border sel   : #6E0D12  (selected)
// Card shadow       : 0 1px 3px rgba(0,0,0,0.06)
// Card shadow hover : 0 4px 12px rgba(110,13,18,0.12)
// Icon bg           : #fdf2f2  (light red tint)
// Icon color        : #6E0D12  (Bonatto red)
// Text primary      : #1a1d23
// Text secondary    : #8a92a0
// Handle            : #6E0D12
// Warning           : #dc2626
// Category colors (badge):
//   messaging  : #6E0D12 / #fdf2f2
//   logic      : #1d4ed8 / #eff6ff
//   action     : #15803d / #f0fdf4
//   timing     : #92400e / #fffbeb
// ─────────────────────────────────────────────────────────────────────────────

type NodeCategory = "trigger" | "messaging" | "logic" | "action" | "timing";

const CATEGORY_COLORS: Record<NodeCategory, { bg: string; text: string; border: string }> = {
  trigger:   { bg: "#fdf2f2", text: "#6E0D12", border: "#fca5a5" },
  messaging: { bg: "#fdf2f2", text: "#6E0D12", border: "#fca5a5" },
  logic:     { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  action:    { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  timing:    { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function NodeHandle({ type, position, id, color = "#6E0D12" }: {
  type: "source" | "target";
  position: Position;
  id?: string;
  color?: string;
}) {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      style={{
        width: 10,
        height: 10,
        background: color,
        border: "2px solid #FFFFFF",
        borderRadius: "50%",
        boxShadow: `0 0 0 1px ${color}`,
      }}
    />
  );
}

function IconBox({ children, category = "messaging" }: {
  children: React.ReactNode;
  category?: NodeCategory;
}) {
  const c = CATEGORY_COLORS[category];
  return (
    <div style={{
      width: 38,
      height: 38,
      borderRadius: 9,
      background: c.bg,
      border: `1px solid ${c.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      color: c.text,
    }}>
      {children}
    </div>
  );
}

function CategoryBadge({ label, category }: { label: string; category: NodeCategory }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      fontFamily: "'Inter', sans-serif",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: c.text,
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 4,
      padding: "1px 5px",
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function BaseCard({
  selected,
  children,
  warning,
}: {
  selected: boolean;
  children: React.ReactNode;
  warning?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF",
        border: `1.5px solid ${selected ? "#6E0D12" : hovered ? "#6E0D12" : "#e8ebf0"}`,
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: 268,
        minHeight: 62,
        boxShadow: selected
          ? "0 0 0 3px rgba(110,13,18,0.10), 0 4px 12px rgba(110,13,18,0.10)"
          : hovered
          ? "0 4px 12px rgba(110,13,18,0.10)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        position: "relative",
      }}
    >
      {warning && (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          background: "#dc2626",
          borderRadius: "50%",
          width: 16,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <AlertCircle size={10} color="#fff" />
        </div>
      )}
      {children}
    </div>
  );
}

function NodeContent({ title, subtitle, badge }: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
        <div style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 600,
          fontSize: 12.5,
          color: "#1a1d23",
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
          minWidth: 0,
        }}>
          {title}
        </div>
        {badge}
      </div>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 10.5,
        color: "#8a92a0",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {subtitle}
      </div>
    </div>
  );
}

// ─── TRIGGER NODE ─────────────────────────────────────────────────────────────
const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  first_order:       <Star size={17} />,
  checkout_abandoned: <ShoppingCart size={17} />,
  new_user:          <Users size={17} />,
  manual:            <Play size={17} />,
  tag_inativo_15:    <Clock size={17} />,
  tag_inativo_30:    <Clock size={17} />,
  tag_inativo_60:    <Clock size={17} />,
  club_subscriber:   <Tag size={17} />,
  order_delivered:   <PackageCheck size={17} />,
  order_cancelled:   <PackageX size={17} />,
  birthday:          <Cake size={17} />,
  loyalty_milestone: <Trophy size={17} />,
  rating_submitted:  <StarIcon size={17} />,
  rating_negative:   <XCircle size={17} />,
  club_expiring:     <Timer size={17} />,
  tag_inativo_custom: <Clock size={17} />,
  first_order_month: <CheckCircle2 size={17} />,
};

const TRIGGER_LABELS: Record<string, string> = {
  first_order:        "Primeiro Pedido",
  checkout_abandoned: "Carrinho Abandonado",
  new_user:           "Novo Usuário",
  manual:             "Disparo Manual",
  tag_inativo_15:     "Inativo 15 dias",
  tag_inativo_30:     "Inativo 30 dias",
  tag_inativo_60:     "Inativo 60 dias",
  club_subscriber:    "Assinou o Clube",
  order_delivered:    "Pedido Entregue",
  order_cancelled:    "Pedido Cancelado",
  birthday:           "Aniversário",
  loyalty_milestone:  "Marco de Pontos",
  rating_submitted:   "Avaliação Enviada",
  rating_negative:    "Avaliação Negativa",
  club_expiring:      "Clube Expirando",
  tag_inativo_custom: "Inativo (personalizado)",
  first_order_month:  "1º Pedido do Mês",
};

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as { trigger?: string; label?: string };
  const icon = TRIGGER_ICONS[d.trigger ?? ""] ?? <Zap size={17} />;
  const label = d.label ?? TRIGGER_LABELS[d.trigger ?? ""] ?? "Gatilho";

  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected}>
        <IconBox category="trigger">{icon}</IconBox>
        <NodeContent
          title={label}
          subtitle="Ponto de entrada da jornada"
          badge={<CategoryBadge label="Gatilho" category="trigger" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── WAIT NODE ────────────────────────────────────────────────────────────────
export function WaitNode({ data, selected }: NodeProps) {
  const d = data as { delayMinutes?: number };
  const mins = d.delayMinutes ?? 0;
  const subtitle = mins > 0
    ? mins >= 1440 ? `Aguardar ${Math.round(mins / 1440)}d` : mins >= 60 ? `Aguardar ${Math.round(mins / 60)}h` : `Aguardar ${mins} min`
    : "Duração não configurada";

  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={mins === 0}>
        <IconBox category="timing"><Clock size={17} /></IconBox>
        <NodeContent
          title="Aguardar"
          subtitle={subtitle}
          badge={<CategoryBadge label="Tempo" category="timing" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── WHATSAPP NODE ────────────────────────────────────────────────────────────
export function WhatsAppNode({ data, selected }: NodeProps) {
  const d = data as { message?: string };
  const hasMsg = !!d.message;
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!hasMsg}>
        <IconBox category="messaging"><MessageCircle size={17} /></IconBox>
        <NodeContent
          title="WhatsApp"
          subtitle={hasMsg ? d.message!.substring(0, 30) + (d.message!.length > 30 ? "…" : "") : "Mensagem não configurada"}
          badge={<CategoryBadge label="Mensagem" category="messaging" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── PUSH NODE ────────────────────────────────────────────────────────────────
export function PushNode({ data, selected }: NodeProps) {
  const d = data as { title?: string; message?: string };
  const hasContent = !!d.title;
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!hasContent}>
        <IconBox category="messaging"><Bell size={17} /></IconBox>
        <NodeContent
          title="Push"
          subtitle={hasContent ? d.title! : "Notificação não configurada"}
          badge={<CategoryBadge label="Mensagem" category="messaging" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── CONDITION NODE ───────────────────────────────────────────────────────────
const CONDITION_LABELS: Record<string, string> = {
  purchased_since_start: "Comprou desde o início",
  has_tag: "Tem a tag",
  has_min_orders: "Mín. de pedidos",
  has_min_points: "Mín. de pontos",
};

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as { condition?: string; conditionTag?: string; conditionValue?: number };
  const hasCondition = !!d.condition;
  const condLabel = d.condition ? CONDITION_LABELS[d.condition] ?? d.condition : "Não configurada";
  const detail = d.condition === "has_tag" && d.conditionTag ? `: ${d.conditionTag}` :
    (d.condition === "has_min_orders" || d.condition === "has_min_points") && d.conditionValue != null ? ` ≥ ${d.conditionValue}` : "";

  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="yes" style={{
        left: "32%", width: 10, height: 10,
        background: "#15803d", border: "2px solid #FFFFFF", borderRadius: "50%",
        boxShadow: "0 0 0 1px #15803d",
      }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{
        left: "68%", width: 10, height: 10,
        background: "#9CA3AF", border: "2px solid #FFFFFF", borderRadius: "50%",
        boxShadow: "0 0 0 1px #9CA3AF",
      }} />
      <BaseCard selected={!!selected} warning={!hasCondition}>
        <IconBox category="logic"><GitBranch size={17} /></IconBox>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#1a1d23", flex: 1 }}>
              Condição
            </div>
            <CategoryBadge label="Lógica" category="logic" />
          </div>
          <div style={{ fontSize: 10.5, color: "#8a92a0", fontFamily: "'Inter', sans-serif", marginBottom: 5 }}>
            {condLabel}{detail}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, color: "#15803d", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
              <CheckCircle2 size={10} /> SIM
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, color: "#9CA3AF", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
              <XCircle size={10} /> NÃO
            </span>
          </div>
        </div>
      </BaseCard>
    </div>
  );
}

// ─── ADD TAG NODE ─────────────────────────────────────────────────────────────
export function AddTagNode({ data, selected }: NodeProps) {
  const d = data as { tag?: string };
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!d.tag}>
        <IconBox category="action"><Tag size={17} /></IconBox>
        <NodeContent
          title="Adicionar Tag"
          subtitle={d.tag ?? "Tag não configurada"}
          badge={<CategoryBadge label="Ação" category="action" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── REMOVE TAG NODE ──────────────────────────────────────────────────────────
export function RemoveTagNode({ data, selected }: NodeProps) {
  const d = data as { tag?: string };
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!d.tag}>
        <IconBox category="action"><TagIcon size={17} /></IconBox>
        <NodeContent
          title="Remover Tag"
          subtitle={d.tag ?? "Tag não configurada"}
          badge={<CategoryBadge label="Ação" category="action" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── WEBHOOK NODE ─────────────────────────────────────────────────────────────
export function WebhookNode({ data, selected }: NodeProps) {
  const d = data as { webhookUrl?: string; url?: string };
  const url = d.webhookUrl ?? d.url;
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!url}>
        <IconBox category="action"><Webhook size={17} /></IconBox>
        <NodeContent
          title="Webhook"
          subtitle={url ? url.replace(/^https?:\/\//, "").substring(0, 28) + "…" : "URL não configurada"}
          badge={<CategoryBadge label="Ação" category="action" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── SEND COUPON NODE ─────────────────────────────────────────────────────────
export function SendCouponNode({ data, selected }: NodeProps) {
  const d = data as { couponDiscountType?: string; couponDiscountValue?: number; couponExpiryDays?: number };
  const hasConfig = d.couponDiscountValue != null;
  const subtitle = hasConfig
    ? `${d.couponDiscountType === "fixed" ? "R$" : ""} ${d.couponDiscountValue}${d.couponDiscountType === "percentage" ? "%" : ""} · ${d.couponExpiryDays ?? 7}d`
    : "Desconto não configurado";
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!hasConfig}>
        <IconBox category="action"><Gift size={17} /></IconBox>
        <NodeContent
          title="Enviar Cupom"
          subtitle={subtitle}
          badge={<CategoryBadge label="Ação" category="action" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── UPDATE LOYALTY NODE ──────────────────────────────────────────────────────
export function UpdateLoyaltyNode({ data, selected }: NodeProps) {
  const d = data as { loyaltyPoints?: number; loyaltyDescription?: string };
  const pts = d.loyaltyPoints ?? 0;
  const hasConfig = pts !== 0;
  const subtitle = hasConfig
    ? `${pts > 0 ? "+" : ""}${pts} pontos${d.loyaltyDescription ? ` · ${d.loyaltyDescription.substring(0, 18)}` : ""}`
    : "Pontos não configurados";
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!hasConfig}>
        <IconBox category="action"><Coins size={17} /></IconBox>
        <NodeContent
          title="Pontos de Fidelidade"
          subtitle={subtitle}
          badge={<CategoryBadge label="Ação" category="action" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── SEND ALERT NODE ──────────────────────────────────────────────────────────
export function SendAlertNode({ data, selected }: NodeProps) {
  const d = data as { alertTitle?: string; alertMessage?: string; alertIcon?: string };
  const hasConfig = !!d.alertTitle;
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!hasConfig}>
        <IconBox category="messaging"><Megaphone size={17} /></IconBox>
        <NodeContent
          title={`${d.alertIcon ?? "🔔"} Alerta no App`}
          subtitle={hasConfig ? d.alertTitle! : "Título não configurado"}
          badge={<CategoryBadge label="Mensagem" category="messaging" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── SPLIT A/B NODE ───────────────────────────────────────────────────────────
export function SplitAbNode({ data, selected }: NodeProps) {
  const d = data as { messageA?: string; messageB?: string; splitChannel?: string };
  const hasConfig = !!d.messageA && !!d.messageB;
  const channel = d.splitChannel === "whatsapp" ? "WhatsApp" : "Push";
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="a" style={{
        left: "32%", width: 10, height: 10,
        background: "#6E0D12", border: "2px solid #FFFFFF", borderRadius: "50%",
        boxShadow: "0 0 0 1px #6E0D12",
      }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{
        left: "68%", width: 10, height: 10,
        background: "#8a92a0", border: "2px solid #FFFFFF", borderRadius: "50%",
        boxShadow: "0 0 0 1px #8a92a0",
      }} />
      <BaseCard selected={!!selected} warning={!hasConfig}>
        <IconBox category="logic"><Shuffle size={17} /></IconBox>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#1a1d23", flex: 1 }}>
              Teste A/B
            </div>
            <CategoryBadge label="Lógica" category="logic" />
          </div>
          <div style={{ fontSize: 10.5, color: "#8a92a0", fontFamily: "'Inter', sans-serif", marginBottom: 5 }}>
            {hasConfig ? `${channel} · 50% / 50%` : "Mensagens não configuradas"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: 9.5, color: "#6E0D12", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>GRUPO A</span>
            <span style={{ fontSize: 9.5, color: "#8a92a0", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>GRUPO B</span>
          </div>
        </div>
      </BaseCard>
    </div>
  );
}

// ─── PAUSE JOURNEY NODE ─────────────────────────────────────────────────────────────────────────────────
export function PauseJourneyNode({ data, selected }: NodeProps) {
  const d = data as { label?: string };
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <BaseCard selected={!!selected}>
        <IconBox category="logic">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        </IconBox>
        <NodeContent
          title={d.label ?? "Pausar Jornada"}
          subtitle="Encerra a jornada para este cliente"
          badge={<CategoryBadge label="Controle" category="logic" />}
        />
      </BaseCard>
    </div>
  );
}

// ─── NOTIFY ADMIN NODE ─────────────────────────────────────────────────────────────────────────────────
export function NotifyAdminNode({ data, selected }: NodeProps) {
  const d = data as { adminTaskTitle?: string; adminTaskPriority?: string };
  const hasConfig = !!d.adminTaskTitle;
  const priorityColors: Record<string, string> = { high: "#dc2626", normal: "#92400e", low: "#15803d" };
  const priorityLabels: Record<string, string> = { high: "🔴 Alta", normal: "🟡 Normal", low: "🟢 Baixa" };
  const prio = d.adminTaskPriority ?? "normal";
  return (
    <div style={{ position: "relative" }}>
      <NodeHandle type="target" position={Position.Top} />
      <NodeHandle type="source" position={Position.Bottom} />
      <BaseCard selected={!!selected} warning={!hasConfig}>
        <IconBox category="action">
          <Bell size={17} />
        </IconBox>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#1a1d23", flex: 1 }}>
              Tarefa Admin
            </div>
            <CategoryBadge label="Ação" category="action" />
          </div>
          <div style={{ fontSize: 10.5, color: "#8a92a0", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>
            {hasConfig ? d.adminTaskTitle!.substring(0, 28) + (d.adminTaskTitle!.length > 28 ? "…" : "") : "Tarefa não configurada"}
          </div>
          {hasConfig && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: priorityColors[prio], fontFamily: "'Inter', sans-serif" }}>
              {priorityLabels[prio] ?? "🟡 Normal"}
            </span>
          )}
        </div>
      </BaseCard>
    </div>
  );
}

// ─── nodeTypes export ─────────────────────────────────────────────────────────────────────────────────
// ─── Custom Edge: animada + botão × ─────────────────────────────────────────
export function BonattoDeletableEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const onDelete = (data as { onDelete?: (id: string) => void })?.onDelete;

  return (
    <>
      {/* Camada de glow — linha mais grossa e transparente por baixo */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{
          stroke: "rgba(110,13,18,0.25)",
          strokeWidth: 6,
          filter: "blur(3px)",
        }}
      />
      {/* Linha sólida principal */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: "#6E0D12",
          strokeWidth: 2,
          strokeDasharray: "none",
          animation: "bonatto-edge-glow 2s ease-in-out infinite",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <button
            onClick={() => onDelete?.(id)}
            title="Remover conexão"
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              border: "1.5px solid #6E0D12",
              color: "#6E0D12",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 4px rgba(110,13,18,0.18)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#6E0D12";
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              (e.currentTarget as HTMLButtonElement).style.color = "#6E0D12";
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = {
  bonatto: BonattoDeletableEdge,
};

export const nodeTypes = {
  trigger:        TriggerNode,
  wait:           WaitNode,
  send_whatsapp:  WhatsAppNode,
  send_push:      PushNode,
  condition:      ConditionNode,
  add_tag:        AddTagNode,
  remove_tag:     RemoveTagNode,
  webhook:        WebhookNode,
  send_coupon:    SendCouponNode,
  update_loyalty: UpdateLoyaltyNode,
  send_alert:     SendAlertNode,
  split_ab:       SplitAbNode,
  pause_journey:  PauseJourneyNode,
  notify_admin:   NotifyAdminNode,
  // legacy aliases
  whatsapp:       WhatsAppNode,
  push:           PushNode,
  addTag:         AddTagNode,
  removeTag:      RemoveTagNode,
};
