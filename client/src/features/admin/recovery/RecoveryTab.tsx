import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { RefreshCcw } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { AdminChipGroup, AdminEmptyState, AdminPage, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppRouter } from "../../../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RecoveryCart = RouterOutputs["recovery"]["abandonedCarts"][number] & {
  currentStep?: number;
  couponCode?: string | null;
};

export function RecoveryTab() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const { data: stats, isLoading, refetch } = trpc.recovery.stats.useQuery({ period });
  const triggerReactivation = trpc.recovery.triggerReactivation.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const { data: carts, isLoading: cartsLoading } = trpc.recovery.abandonedCarts.useQuery({ limit: 20 });
  const abandonedCarts: RecoveryCart[] = carts ?? [];
  const periodLabels = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

  return (
    <AdminPage>
      <AdminTopbar
        title="Recuperacao de receita"
        subtitle="Carrinhos abandonados, reativacao de clientes e conversoes automaticas"
        actions={
          <>
            <AdminChipGroup
              size="sm"
              value={period}
              onChange={setPeriod}
              items={[
                { value: "7d", label: periodLabels["7d"] },
                { value: "30d", label: periodLabels["30d"] },
                { value: "90d", label: periodLabels["90d"] },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerReactivation.mutate()}
              disabled={triggerReactivation.isPending}
              className="gap-2 h-9"
            >
              <RefreshCcw className={`w-4 h-4 ${triggerReactivation.isPending ? "animate-spin" : ""}`} />
              Disparar reativacao
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => (
            <Card key={index} className="animate-pulse"><CardContent className="p-6 h-24 bg-muted/30 rounded-lg" /></Card>
          ))}
        </div>
      ) : stats ? (
        <>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Carrinho abandonado</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Total abandonados</p>
                  <p className="text-3xl font-bold mt-1">{stats.carts.total}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Recuperados</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{stats.carts.recovered}</p>
                  <p className="text-xs text-primary mt-1">R$ {stats.carts.recoveredRevenue.toFixed(2).replace(".", ",")}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Taxa de recuperacao</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{stats.carts.recoveryRate}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-3xl font-bold mt-1 text-muted-foreground">{stats.carts.pending}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {stats.steps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance por etapa</h3>
              <div className="grid grid-cols-3 gap-4">
                {stats.steps.map((step) => (
                  <Card key={step.step}>
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground">Etapa {step.step} ({step.step === 1 ? "10min" : step.step === 2 ? "20min" : "30min"})</p>
                      <p className="text-2xl font-bold mt-1">{step.sent} enviados</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${step.conversionRate}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-primary">{step.conversionRate}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Reativacao de clientes inativos</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inativos 15 dias</p>
                  <p className="text-3xl font-bold mt-1">{stats.reactivation.sent15d}</p>
                  <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inativos 30 dias</p>
                  <p className="text-3xl font-bold mt-1">{stats.reactivation.sent30d}</p>
                  <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inativos 60 dias</p>
                  <p className="text-3xl font-bold mt-1">{stats.reactivation.sent60d}</p>
                  <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Conversoes por automacao</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{stats.conversions.total}</p>
                  <p className="text-xs text-primary mt-1">R$ {stats.conversions.revenue.toFixed(2).replace(".", ",")} recuperados</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Carrinhos recentes</h3>
            <Card>
              <CardContent className="p-0">
                {cartsLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Carregando...</div>
                ) : abandonedCarts.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhum carrinho abandonado registrado ainda</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Etapa</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cupom</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abandonedCarts.map((cart: RecoveryCart) => (
                          <tr key={cart.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{cart.customerName}</div>
                              <div className="text-xs text-muted-foreground">{cart.customerPhone ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold">R$ {Number(cart.total).toFixed(2).replace(".", ",")}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                cart.status === "recovered" ? "bg-[#f0fdf4] text-[#166534]" :
                                cart.status === "expired" ? "bg-muted text-muted-foreground" :
                                "bg-[#fce8e8] text-[#6E0D12]"
                              }`}>
                                {cart.status === "recovered" ? "Recuperado" : cart.status === "expired" ? "Expirado" : "Pendente"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {cart.currentStep ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                  {cart.currentStep}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3">
                              {cart.couponCode ? (
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{cart.couponCode}</code>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {new Date(cart.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <AdminSurface>
          <AdminEmptyState
            icon={<RefreshCcw className="w-8 h-8" />}
            title="Sem dados no periodo"
            description="Nenhum dado de recuperacao disponivel para o periodo selecionado."
          />
        </AdminSurface>
      )}
    </AdminPage>
  );
}
