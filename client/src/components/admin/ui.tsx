import * as React from "react";
import { ArrowDown, ArrowUp, Minus, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Design system primitives do painel admin — visual Nexus Dashboard (cruip.com)
 * com cor de destaque Bonatto (#6E0D12) no lugar do violet-500.
 * Todas as variações visuais são controladas por CSS variables (`--admin-*`)
 * declaradas em `index.css` no :root.
 */

// ── Topbar (barra superior fixa 60px, backdrop blur) ──────────────────────
export type AdminTopbarProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
  className?: string;
};
export function AdminTopbar({ title, subtitle, onRefresh, refreshing, actions, className }: AdminTopbarProps) {
  return (
    <div
      className={cn("sticky top-0 z-20 flex items-center justify-between gap-4 px-6", className)}
      style={{
        height: 60,
        background: "var(--admin-header-bg, var(--admin-bg))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--admin-divider)",
      }}
    >
      <div className="min-w-0">
        <h1
          className="truncate"
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--admin-text-heading)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 1 }}>{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs font-medium"
            style={{
              background: "var(--admin-card-bg)",
              borderColor: "var(--admin-card-border)",
              color: "var(--admin-text-heading)",
            }}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Atualizar
          </Button>
        )}
      </div>
    </div>
  );
}

// ── PageHeader (legado — usar AdminTopbar para novas abas) ─────────────────
export type AdminPageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};
export function AdminPageHeader({ title, subtitle, eyebrow, actions, className }: AdminPageHeaderProps) {
  return (
    <header className={cn("admin-page-header", className)}>
      <div className="admin-page-header__titles">
        {eyebrow && <p className="admin-page-header__eyebrow">{eyebrow}</p>}
        <h2 className="admin-page-header__title">{title}</h2>
        {subtitle && <p className="admin-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </header>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────
export function AdminPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("admin-page", className)}>{children}</div>;
}

// ── Surface (card com header opcional) ────────────────────────────────────
export type AdminSurfaceProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  hover?: boolean;
  flush?: boolean;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};
export function AdminSurface({
  title, subtitle, actions, hover, flush, footer, className, bodyClassName, children,
}: AdminSurfaceProps) {
  const hasHeader = !!(title || actions);
  return (
    <section
      className={cn("admin-surface", hover && "admin-surface--hover", className)}
      style={{ boxShadow: "var(--admin-card-shadow)" }}
    >
      {hasHeader && (
        <div className="admin-surface__header">
          <div className="min-w-0">
            {title && <h3 className="admin-surface__title">{title}</h3>}
            {subtitle && <p className="admin-surface__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn(flush ? "" : "admin-surface__body", bodyClassName)}>{children}</div>
      {footer && <div className="admin-surface__footer">{footer}</div>}
    </section>
  );
}

// ── Stat / Metric card (Nexus-style) ──────────────────────────────────────
export type AdminStatProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Ícone exibido no canto superior direito dentro de um círculo colorido. */
  icon?: React.ReactNode;
  /** Texto auxiliar abaixo do valor (ex: "vs ontem"). */
  sub?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  /** Texto do badge de variação percentual (ex: "+12%"). */
  trendLabel?: React.ReactNode;
  className?: string;
};
export function AdminStat({ label, value, icon, sub, trend = "neutral", trendLabel, className }: AdminStatProps) {
  const trendClass =
    trend === "up" ? "admin-stat__trend--up" :
    trend === "down" ? "admin-stat__trend--down" :
    "admin-stat__trend--neutral";
  const TrendIcon =
    trend === "up" ? ArrowUp :
    trend === "down" ? ArrowDown :
    Minus;

  return (
    <div
      className={cn("admin-stat", className)}
      style={{ boxShadow: "var(--admin-card-shadow)" }}
    >
      {/* Linha topo: label uppercase + ícone colorido */}
      <div className="admin-stat__top">
        <span className="admin-stat__label">{label}</span>
        {icon && (
          <span className="admin-stat__icon">
            {icon}
          </span>
        )}
      </div>
      {/* Valor grande */}
      <div>
        <p className="admin-stat__value">{value}</p>
        {/* Badge de variação + texto auxiliar */}
        {(trendLabel || sub) && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {trendLabel && (
              <span className={cn("admin-stat__trend", trendClass)}>
                <TrendIcon className="w-3 h-3" />
                {trendLabel}
              </span>
            )}
            {sub && <span className="admin-stat__sub">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat grid (4 colunas responsivas) ─────────────────────────────────────
export function AdminStatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {children}
    </div>
  );
}

// ── Toolbar (busca + chips) ────────────────────────────────────────────────
export type AdminSearchProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};
export function AdminSearch({ value, onChange, placeholder, className }: AdminSearchProps) {
  return (
    <div className={cn("admin-toolbar__search", className)}>
      <Search
        className="w-4 h-4"
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--admin-text-muted)",
          pointerEvents: "none",
        }}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Buscar..."}
        className="pl-9 h-9"
        style={{
          background: "var(--admin-input-bg)",
          borderColor: "var(--admin-input-border)",
          color: "var(--admin-text)",
        }}
      />
    </div>
  );
}

// ── Filter chips (Nexus: dark pill ativo, gray inativo) ────────────────────
export type AdminChipGroupItem<T extends string = string> = { value: T; label: React.ReactNode };
export type AdminChipGroupProps<T extends string = string> = {
  value: T;
  onChange: (v: T) => void;
  items: readonly AdminChipGroupItem<T>[];
  size?: "sm" | "md";
  className?: string;
};
export function AdminChipGroup<T extends string = string>({
  value, onChange, items, size = "md", className,
}: AdminChipGroupProps<T>) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          data-active={value === item.value}
          className={cn("admin-chip", size === "sm" && "text-[11px] px-2.5 py-1")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
export type AdminEmptyStateProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};
export function AdminEmptyState({ icon, title, description, action, className }: AdminEmptyStateProps) {
  return (
    <div className={cn("admin-empty-state", className)}>
      {icon && <div className="text-[34px]">{icon}</div>}
      {title && <p className="admin-empty-state__title">{title}</p>}
      {description && <p className="admin-empty-state__body">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────
export type AdminPillTone = "success" | "danger" | "neutral" | "brand" | "warning" | "info";
export function AdminPill({
  tone = "neutral", children, className,
}: { tone?: AdminPillTone; children: React.ReactNode; className?: string }) {
  const toneMap: Record<AdminPillTone, string> = {
    success: "admin-pill--success",
    danger: "admin-pill--danger",
    neutral: "admin-pill--neutral",
    brand: "admin-pill--brand",
    warning: "admin-pill--warning",
    info: "admin-pill--info",
  };
  return (
    <span className={cn("admin-pill", toneMap[tone] ?? "admin-pill--neutral", className)}>
      {children}
    </span>
  );
}

// ── Section divider label (eyebrow uppercase) ──────────────────────────────
export function AdminSectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn("text-[11px] font-semibold uppercase tracking-widest", className)}
      style={{ color: "var(--admin-text-muted)", letterSpacing: "0.08em" }}
    >
      {children}
    </p>
  );
}

// ── Toolbar wrapper ────────────────────────────────────────────────────────
export function AdminToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("admin-toolbar", className)}>
      {children}
    </div>
  );
}
