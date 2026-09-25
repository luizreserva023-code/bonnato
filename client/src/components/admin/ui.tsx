import * as React from "react";
import { ArrowDown, ArrowUp, Minus, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Primitivos do Design System administrativo Bonatto.
 * A aparência premium é aplicada somente dentro de .bonatto-admin.
 */

// ── Topbar contextual ──────────────────────────────────────────────────────
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
      className={cn("admin-topbar flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5", className)}
    >
      <div className="min-w-0">
        <h1 className="admin-topbar__title truncate">{title}</h1>
        {subtitle && <p className="admin-topbar__subtitle break-words">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
        {actions}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-9 w-full gap-1.5 rounded-[10px] border-[var(--admin-border-strong)] bg-white px-3 text-xs font-semibold text-[var(--admin-text-primary)] shadow-none hover:bg-[var(--admin-surface-alt)] sm:w-auto"
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
  return <div className={cn("admin-page min-w-0 max-w-full", className)}>{children}</div>;
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
          {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
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


export function AdminInsightCard({
  eyebrow = "Bonatto Intelligence",
  title,
  description,
  icon,
  tone = "brand",
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  children?: React.ReactNode;
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    brand: "text-[var(--admin-brand-800)] bg-[var(--admin-brand-50)]",
    success: "text-[var(--admin-success)] bg-[var(--admin-success-bg)]",
    warning: "text-[var(--admin-warning)] bg-[var(--admin-warning-bg)]",
    danger: "text-[var(--admin-danger)] bg-[var(--admin-danger-bg)]",
    info: "text-[var(--admin-info)] bg-[var(--admin-info-bg)]",
  };
  return (
    <section className={cn("admin-intelligence p-5", className)}>
      <div className="flex items-start gap-3">
        {icon && <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", toneClass[tone])}>{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="admin-intelligence__eyebrow">{eyebrow}</p>
          <h3 className="mt-1 text-[16px] font-semibold leading-6 text-[var(--admin-text-primary)]">{title}</h3>
          {description && <p className="mt-1 text-[13px] leading-5 text-[var(--admin-text-secondary)]">{description}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export function AdminDataTableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("admin-data-table-wrap", className)}>{children}</div>;
}

export function AdminSkeleton({
  className,
}: {
  className?: string;
}) {
  return <div aria-hidden="true" className={cn("admin-skeleton h-10 w-full", className)} />;
}

export function AdminCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("admin-surface p-5", className)}>
      <AdminSkeleton className="h-3 w-24" />
      <AdminSkeleton className="mt-5 h-8 w-32" />
      <AdminSkeleton className="mt-4 h-3 w-40" />
    </div>
  );
}

export function AdminChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("admin-surface p-5", className)}>
      <AdminSkeleton className="h-4 w-40" />
      <AdminSkeleton className="mt-3 h-3 w-64 max-w-full" />
      <AdminSkeleton className="mt-8 h-[260px] w-full rounded-[14px]" />
    </div>
  );
}
