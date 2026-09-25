import { useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import {
  AdminDataTableShell,
  AdminEmptyState,
  AdminStat,
  AdminStatGrid,
  AdminSurface,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { JoinedPagination } from "@/components/ui/joined-pagination";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ReliabilityPanel() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const summary = trpc.operations.reliability.summary.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const jobs = trpc.operations.reliability.failedJobs.useQuery({
    page,
    pageSize: 25,
    status: showDiscarded ? "discarded" : "failed",
  });
  const webhooks = trpc.operations.reliability.webhookFailures.useQuery({
    limit: 50,
  });

  const refresh = async () => {
    await Promise.all([
      utils.operations.reliability.summary.invalidate(),
      utils.operations.reliability.failedJobs.invalidate(),
      utils.operations.reliability.webhookFailures.invalidate(),
    ]);
  };

  const retryJob = trpc.operations.reliability.retryJob.useMutation({
    onSuccess: async () => {
      toast.success("Job reenfileirado.");
      await refresh();
    },
    onError: (error) => toast.error("Não foi possível reenfileirar.", {
      description: error.message,
    }),
  });
  const discardJob = trpc.operations.reliability.discardJob.useMutation({
    onSuccess: async () => {
      toast.success("Job descartado da fila ativa.");
      await refresh();
    },
    onError: (error) => toast.error("Não foi possível descartar.", {
      description: error.message,
    }),
  });

  const outbox = summary.data?.outbox ?? {};
  const webhookCounts = summary.data?.webhooks ?? {};
  const failedJobs = Number(outbox.failed ?? 0);
  const processingJobs = Number(outbox.processing ?? 0);
  const pendingJobs = Number(outbox.pending ?? 0);
  const failedWebhooks = Number(webhookCounts.failed ?? 0);

  return (
    <div className="space-y-5">
      <AdminStatGrid>
        <AdminStat
          label="Jobs pendentes"
          value={pendingJobs.toLocaleString("pt-BR")}
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <AdminStat
          label="Em processamento"
          value={processingJobs.toLocaleString("pt-BR")}
          icon={<RotateCcw className="h-4 w-4" />}
        />
        <AdminStat
          label="Jobs falhos"
          value={failedJobs.toLocaleString("pt-BR")}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <AdminStat
          label="Webhooks falhos"
          value={failedWebhooks.toLocaleString("pt-BR")}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </AdminStatGrid>

      <AdminSurface
        title="Fila de falhas"
        subtitle="Jobs que excederam as tentativas automáticas ou precisam de intervenção."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setPage(1);
                setShowDiscarded((value) => !value);
              }}
            >
              {showDiscarded ? "Ver falhos" : "Ver descartados"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        }
      >
        {jobs.isLoading ? (
          <div className="py-10 text-center text-sm text-[var(--admin-text-secondary)]">
            Carregando fila...
          </div>
        ) : !jobs.data?.rows.length ? (
          <AdminEmptyState
            title={showDiscarded ? "Nenhum job descartado" : "Nenhum job falho"}
            description={
              showDiscarded
                ? "Não há eventos descartados manualmente."
                : "A fila não possui eventos que exigem intervenção."
            }
          />
        ) : (
          <>
            <AdminDataTableShell>
              <table className="admin-data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Entidade</th>
                    <th>Tentativas</th>
                    <th>Última atualização</th>
                    <th>Erro</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.data.rows.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <p className="font-semibold">{job.eventType}</p>
                        <p className="text-[11px] text-[var(--admin-text-muted)]">
                          {job.eventKey}
                        </p>
                      </td>
                      <td>
                        <p>{job.aggregateType}</p>
                        <p className="text-[11px] text-[var(--admin-text-muted)]">
                          #{job.aggregateId}
                        </p>
                      </td>
                      <td>{job.attempts}</td>
                      <td className="whitespace-nowrap">{formatDate(job.updatedAt)}</td>
                      <td className="max-w-[320px]">
                        <p className="truncate text-xs" title={job.lastError ?? ""}>
                          {job.lastError || "Sem detalhe registrado"}
                        </p>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retryJob.isPending}
                            onClick={() => retryJob.mutate({ id: job.id })}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reprocessar
                          </Button>
                          {!showDiscarded && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={discardJob.isPending}
                              onClick={() => discardJob.mutate({ id: job.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Descartar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminDataTableShell>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--admin-text-muted)]">
                {jobs.data.pagination.total.toLocaleString("pt-BR")} registro(s)
              </p>
              <JoinedPagination
                currentPage={jobs.data.pagination.page}
                totalPages={jobs.data.pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </AdminSurface>
      <AdminSurface
        title="Falhas de webhook"
        subtitle="Eventos de pagamento que falharam e permanecem elegíveis para retry seguro do provedor."
      >
        {webhooks.isLoading ? (
          <div className="py-10 text-center text-sm text-[var(--admin-text-secondary)]">
            Carregando webhooks...
          </div>
        ) : !webhooks.data?.length ? (
          <AdminEmptyState
            title="Nenhuma falha de webhook"
            description="Stripe e Asaas não possuem eventos falhos registrados."
          />
        ) : (
          <AdminDataTableShell>
            <table className="admin-data-table min-w-[780px]">
              <thead>
                <tr>
                  <th>Provedor</th>
                  <th>Evento</th>
                  <th>Tentativas</th>
                  <th>Atualização</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.data.map((event) => (
                  <tr key={event.id}>
                    <td className="font-semibold uppercase">{event.provider}</td>
                    <td>
                      <p>{event.eventType || "Evento"}</p>
                      <p className="text-[11px] text-[var(--admin-text-muted)]">
                        {event.eventId}
                      </p>
                    </td>
                    <td>{event.attempts}</td>
                    <td className="whitespace-nowrap">{formatDate(event.updatedAt)}</td>
                    <td className="max-w-[380px]">
                      <p className="truncate text-xs" title={event.lastError ?? ""}>
                        {event.lastError || "Sem detalhe registrado"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTableShell>
        )}
      </AdminSurface>
    </div>
  );
}

export default ReliabilityPanel;
