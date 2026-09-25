import { useEffect, useMemo, useState } from "react";
import { History, Search, ShieldCheck } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useDebouncedValue, usePersistentFilters } from "@/hooks/use-professional-ux";
import { AdminDataTableShell, AdminEmptyState, AdminSurface } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JoinedPagination } from "@/components/ui/joined-pagination";

const DEFAULT_FILTERS = {
  search: "",
  action: "",
  resourceType: "",
};

function parseMetadata(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const entries = Object.entries(parsed).slice(0, 5);
    return entries.length ? entries : null;
  } catch {
    return null;
  }
}
function readable(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "order.status_changed": "Status do pedido alterado",
    "menu.recommendation.dismiss": "Recomendação de cardápio dispensada",
  };
  return labels[action] ?? action.replaceAll(".", " · ");
}

export function AuditLogPanel({ storeId }: { storeId?: number }) {
  const { filters, setFilters, clearFilters } = usePersistentFilters(
    "audit_log",
    DEFAULT_FILTERS,
  );
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.search.trim(), 300);
  const action = useDebouncedValue(filters.action.trim(), 300);
  const resourceType = useDebouncedValue(filters.resourceType.trim(), 300);

  useEffect(() => {
    setPage(1);
  }, [storeId, search, action, resourceType]);
  const query = trpc.analytics.auditLog.useQuery(
    {
      storeId,
      page,
      pageSize: 25,
      search: search || undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
    },
    {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      placeholderData: (previous) => previous,
    },
  );

  const range = useMemo(() => {
    const pagination = query.data?.pagination;
    if (!pagination || pagination.total === 0) return "0 registros";
    const from = (pagination.page - 1) * pagination.pageSize + 1;
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total);
    return `${from}–${to} de ${pagination.total.toLocaleString("pt-BR")} registros`;
  }, [query.data?.pagination]);

  return (
    <AdminSurface
      title="Audit Log"
      subtitle="Histórico de ações críticas para rastreabilidade e controle operacional."
      actions={
        <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>
          Atualizar
        </Button>
      }
    >
      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_190px_190px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <Input
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Buscar ação, entidade ou usuário..."
            className="pl-9"
            aria-label="Buscar no histórico de auditoria"
          />
        </div>
        <Input
          value={filters.action}
          onChange={(event) => setFilters({ ...filters, action: event.target.value })}
          placeholder="Filtrar por ação"
          aria-label="Filtrar auditoria por ação"
        />
        <Input
          value={filters.resourceType}
          onChange={(event) => setFilters({ ...filters, resourceType: event.target.value })}
          placeholder="Filtrar por entidade"
          aria-label="Filtrar auditoria por entidade"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={clearFilters}
          disabled={!filters.search && !filters.action && !filters.resourceType}
        >
          Limpar filtros
        </Button>
      </div>
      {query.isLoading && !query.data ? (
        <div className="grid min-h-48 place-items-center" role="status">
          <div className="text-sm text-[var(--admin-text-secondary)]">Carregando histórico...</div>
        </div>
      ) : query.isError ? (
        <AdminEmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="Não foi possível carregar o histórico"
          description="Tente atualizar os dados. Nenhuma alteração foi realizada."
          action={<Button onClick={() => query.refetch()}>Tentar novamente</Button>}
        />
      ) : !query.data?.rows.length ? (
        <AdminEmptyState
          icon={<History className="h-8 w-8" />}
          title="Nenhum evento encontrado"
          description="Não há ações de auditoria que correspondam aos filtros selecionados."
          action={
            filters.search || filters.action || filters.resourceType
              ? <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
              : undefined
          }
        />
      ) : (
        <>
          <AdminDataTableShell>
            <table className="admin-data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Responsável</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => {
                  const metadata = parseMetadata(row.metadata);
                  return (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td>
                        <p className="font-semibold">{actionLabel(row.action)}</p>
                        <p className="text-[11px] text-[var(--admin-text-muted)]">{row.action}</p>
                      </td>
                      <td>
                        <p className="font-medium">{row.resourceType}</p>
                        <p className="text-[11px] text-[var(--admin-text-muted)]">
                          {row.resourceId ? `#${row.resourceId}` : "Sem identificador"}
                        </p>
                      </td>
                      <td>
                        <p className="font-medium">{row.actorName || "Sistema"}</p>
                        {row.actorEmail && (
                          <p className="text-[11px] text-[var(--admin-text-muted)]">{row.actorEmail}</p>
                        )}
                      </td>
                      <td className="max-w-[340px]">
                        {metadata ? (
                          <div className="space-y-0.5 text-xs text-[var(--admin-text-secondary)]">
                            {metadata.map(([key, value]) => (
                              <p key={key} className="truncate" title={readable(value)}>
                                <span className="font-semibold">{key}:</span> {readable(value)}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--admin-text-muted)]">Sem detalhes adicionais</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminDataTableShell>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--admin-text-muted)]" aria-live="polite">{range}</p>
            <JoinedPagination
              currentPage={query.data.pagination.page}
              totalPages={query.data.pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </AdminSurface>
  );
}

export default AuditLogPanel;
