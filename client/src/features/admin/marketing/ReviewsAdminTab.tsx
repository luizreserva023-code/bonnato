import { useEffect, useState, type ReactNode } from "react";
import { BellRing, ExternalLink, Link2, Loader2, Save, Star, Timer, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { AdminEmptyState, AdminPage, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { trpc } from "@/lib/trpc";

type ReviewCashbackForm = {
  enabled: boolean;
  campaignMode: "order_reward" | "order_reward_plus_google" | "google_request";
  cashbackPercent: string;
  pointsPerRealCashback: string;
  rewardBase: "paid_products" | "order_total";
  minimumOrderValue: string;
  maxPointsPerOrder: string;
  validityEnabled: boolean;
  offerValidityDays: string;
  notificationDelayMinutes: string;
  notificationTitle: string;
  notificationMessage: string;
  externalReviewUrl: string;
  externalReviewLabel: string;
};

const defaultForm: ReviewCashbackForm = {
  enabled: false,
  campaignMode: "order_reward",
  cashbackPercent: "5",
  pointsPerRealCashback: "10",
  rewardBase: "paid_products",
  minimumOrderValue: "0",
  maxPointsPerOrder: "",
  validityEnabled: true,
  offerValidityDays: "7",
  notificationDelayMinutes: "60",
  notificationTitle: "Avalie seu pedido e ganhe {{cashbackPercent}}% em pontos",
  notificationMessage: "Avalie o pedido #{{orderNumber}} e receba {{estimatedPoints}} pontos.",
  externalReviewUrl: "",
  externalReviewLabel: "Avaliar também no Google",
};

function toForm(config: any): ReviewCashbackForm {
  return {
    enabled: Boolean(config.enabled),
    campaignMode:
      config.campaignMode === "google_request"
        ? "google_request"
        : config.campaignMode === "order_reward_plus_google"
          ? "order_reward_plus_google"
          : "order_reward",
    cashbackPercent: String(config.cashbackPercent ?? 5),
    pointsPerRealCashback: String(config.pointsPerRealCashback ?? 10),
    rewardBase: config.rewardBase === "order_total" ? "order_total" : "paid_products",
    minimumOrderValue: String(config.minimumOrderValue ?? 0),
    maxPointsPerOrder: config.maxPointsPerOrder == null ? "" : String(config.maxPointsPerOrder),
    validityEnabled: Boolean(config.validityEnabled),
    offerValidityDays: String(config.offerValidityDays ?? 7),
    notificationDelayMinutes: String(config.notificationDelayMinutes ?? 60),
    notificationTitle: String(config.notificationTitle ?? defaultForm.notificationTitle),
    notificationMessage: String(config.notificationMessage ?? defaultForm.notificationMessage),
    externalReviewUrl: String(config.externalReviewUrl ?? ""),
    externalReviewLabel: String(config.externalReviewLabel ?? defaultForm.externalReviewLabel),
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-semibold text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function ReviewsAdminTab() {
  const { selectedStoreId, selectedStoreName } = useAdminStore();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ReviewCashbackForm>(defaultForm);

  const configQuery = trpc.rewards.admin.reviewCashbackConfig.useQuery(
    { storeId: selectedStoreId ?? 0 },
    { enabled: Boolean(selectedStoreId) },
  );
  const statsQuery = trpc.rewards.admin.reviewCashbackStats.useQuery(
    { storeId: selectedStoreId ?? 0 },
    { enabled: Boolean(selectedStoreId) },
  );

  useEffect(() => {
    if (configQuery.data) setForm(toForm(configQuery.data));
  }, [configQuery.data]);

  const saveMutation = trpc.rewards.admin.saveReviewCashbackConfig.useMutation({
    onSuccess: async () => {
      toast.success("Configuração de avaliações salva.");
      if (!selectedStoreId) return;
      await Promise.all([
        utils.rewards.admin.reviewCashbackConfig.invalidate({ storeId: selectedStoreId }),
        utils.rewards.admin.reviewCashbackStats.invalidate({ storeId: selectedStoreId }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (!selectedStoreId) {
    return (
      <AdminPage>
        <AdminTopbar title="Avaliações" subtitle="Configure a automação de avaliações por loja." />
        <AdminSurface>
          <AdminEmptyState
            icon={<Star className="h-8 w-8" />}
            title="Selecione uma loja"
            description="Cada unidade possui sua própria regra, mensagem e link de avaliação."
          />
        </AdminSurface>
      </AdminPage>
    );
  }

  const save = () => {
    const cashbackPercent = Number(form.cashbackPercent);
    const pointsPerRealCashback = Number(form.pointsPerRealCashback);
    const minimumOrderValue = Number(form.minimumOrderValue || 0);
    const maxPointsPerOrder = form.maxPointsPerOrder.trim() ? Number(form.maxPointsPerOrder) : null;
    const offerValidityDays = Number(form.offerValidityDays || 7);
    const notificationDelayMinutes = Number(form.notificationDelayMinutes || 0);

    if (form.campaignMode !== "google_request") {
      if (!Number.isFinite(cashbackPercent) || cashbackPercent < 0 || cashbackPercent > 30) {
        toast.error("Informe um cashback entre 0% e 30%.");
        return;
      }
      if (!Number.isFinite(pointsPerRealCashback) || pointsPerRealCashback <= 0) {
        toast.error("Informe uma conversão válida de pontos.");
        return;
      }
    }
    if (
      form.campaignMode !== "order_reward"
      && !/^https?:\/\//i.test(form.externalReviewUrl.trim())
    ) {
      toast.error("Informe um link de avaliação válido.");
      return;
    }

    saveMutation.mutate({
      storeId: selectedStoreId,
      enabled: form.enabled,
      campaignMode: form.campaignMode,
      cashbackPercent,
      pointsPerRealCashback,
      rewardBase: form.rewardBase,
      minimumOrderValue,
      maxPointsPerOrder: maxPointsPerOrder == null ? null : Math.max(1, Math.floor(maxPointsPerOrder)),
      validityEnabled: form.validityEnabled,
      offerValidityDays: Math.max(1, Math.floor(offerValidityDays)),
      notificationDelayMinutes: Math.max(0, Math.floor(notificationDelayMinutes)),
      notificationTitle: form.notificationTitle.trim(),
      notificationMessage: form.notificationMessage.trim(),
      externalReviewEnabled: googleEnabled,
      externalReviewUrl: form.externalReviewUrl.trim(),
      externalReviewLabel: form.externalReviewLabel.trim() || (form.campaignMode === "google_request" ? "Avaliar no Google" : "Avaliar também no Google"),
    });
  };

  const reset = () => {
    if (configQuery.data) setForm(toForm(configQuery.data));
  };

  const changeCampaignMode = (campaignMode: ReviewCashbackForm["campaignMode"]) => {
    setForm((current) => {
      if (campaignMode === "google_request") {
        return {
          ...current,
          campaignMode,
          notificationTitle: "Como foi sua experiência?",
          notificationMessage: "Avalie sua experiência no Google. Sua opinião ajuda nossa loja.",
          externalReviewLabel: "Avaliar no Google",
        };
      }

      return {
        ...current,
        campaignMode,
        notificationTitle: "Avalie seu pedido e ganhe {{cashbackPercent}}% em pontos",
        notificationMessage: "Avalie o pedido #{{orderNumber}} e receba {{estimatedPoints}} pontos.",
        externalReviewLabel: "Avaliar também no Google",
      };
    });
  };

  const rewardsEnabled = form.campaignMode !== "google_request";
  const googleEnabled = form.campaignMode !== "order_reward";
  const cashback = Number(form.cashbackPercent) || 0;
  const pointsPerReal = Number(form.pointsPerRealCashback) || 0;
  const previewPoints = Math.floor(100 * (cashback / 100) * pointsPerReal);
  const stats = statsQuery.data;

  return (
    <AdminPage>
      <AdminTopbar
        title="Avaliações"
        subtitle="Defina onde o cliente avalia, quando a solicitação é enviada e como a campanha funciona."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={form.enabled ? "default" : "secondary"} className="h-8 px-3">
              {form.enabled ? "Automação ativa" : "Automação pausada"}
            </Badge>
            <Button onClick={save} disabled={saveMutation.isPending || configQuery.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </Button>
          </div>
        }
      />

      <AdminStatGrid>
        <AdminStat label="Avaliações premiadas" value={(stats?.rewardsGranted ?? 0).toLocaleString("pt-BR")} />
        <AdminStat label="Clientes alcançados" value={(stats?.uniqueCustomers ?? 0).toLocaleString("pt-BR")} />
        <AdminStat label="Pontos concedidos" value={(stats?.pointsGranted ?? 0).toLocaleString("pt-BR")} />
        <AdminStat label="Cashback concedido" value={(stats?.cashbackValue ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
      </AdminStatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <AdminSurface className="p-0">
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-sm font-bold">Regra da campanha</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Configuração de {selectedStoreName || "esta loja"}.</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm((value) => ({ ...value, enabled }))} aria-label="Ativar automação de avaliações" />
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Tipo de campanha" hint="Escolha o fluxo que será usado depois da entrega.">
                  <Select value={form.campaignMode} onValueChange={(value: ReviewCashbackForm["campaignMode"]) => changeCampaignMode(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order_reward">Avaliação do pedido: libera os pontos</SelectItem>
                      <SelectItem value="order_reward_plus_google">Avaliação do pedido + convite para o Google</SelectItem>
                      <SelectItem value="google_request">Somente avaliação no Google</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.campaignMode === "google_request" ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
                    Neste modo o cliente é direcionado ao Google, mas o sistema não condiciona pontos à publicação da avaliação. O Google não permite incentivos em troca de avaliações.
                  </div>
                ) : null}
              </div>

              <Field label="Cashback" hint={rewardsEnabled ? "Percentual convertido em pontos após a avaliação do pedido." : "Não se aplica ao modo Google."}>
                <div className="relative">
                  <Input disabled={!rewardsEnabled} type="number" min="0" max="30" step="0.1" value={form.cashbackPercent} onChange={(event) => setForm((value) => ({ ...value, cashbackPercent: event.target.value }))} className="pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </Field>

              <Field label="Conversão em pontos" hint={rewardsEnabled ? "Ex.: 10 pontos = R$ 1,00 de cashback." : "Não se aplica ao modo Google."}>
                <Input disabled={!rewardsEnabled} type="number" min="0.1" step="0.1" value={form.pointsPerRealCashback} onChange={(event) => setForm((value) => ({ ...value, pointsPerRealCashback: event.target.value }))} />
              </Field>

              <Field label="Base de cálculo">
                <Select disabled={!rewardsEnabled} value={form.rewardBase} onValueChange={(rewardBase: "paid_products" | "order_total") => setForm((value) => ({ ...value, rewardBase }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid_products">Produtos pagos</SelectItem>
                    <SelectItem value="order_total">Total do pedido</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Pedido mínimo">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input disabled={!rewardsEnabled} type="number" min="0" step="0.01" value={form.minimumOrderValue} onChange={(event) => setForm((value) => ({ ...value, minimumOrderValue: event.target.value }))} className="pl-9" />
                </div>
              </Field>

              <Field label="Limite por pedido" hint={rewardsEnabled ? "Deixe vazio para não limitar." : "Não se aplica ao modo Google."}>
                <Input disabled={!rewardsEnabled} type="number" min="1" placeholder="Sem limite" value={form.maxPointsPerOrder} onChange={(event) => setForm((value) => ({ ...value, maxPointsPerOrder: event.target.value }))} />
              </Field>

              <Field label="Enviar após">
                <div className="relative">
                  <Input type="number" min="0" value={form.notificationDelayMinutes} onChange={(event) => setForm((value) => ({ ...value, notificationDelayMinutes: event.target.value }))} className="pr-16" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">minutos</span>
                </div>
              </Field>
            </div>
          </AdminSurface>

          <AdminSurface className="p-0">
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Timer className="size-4 text-primary" />
                <h2 className="text-sm font-bold">Validade</h2>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{rewardsEnabled ? "Prazo para receber os pontos" : "Prazo da solicitação"}</p>
                  <p className="text-xs text-muted-foreground">{rewardsEnabled ? "Após o prazo, a avaliação não gera o benefício." : "Define por quanto tempo a solicitação fica válida após a entrega."}</p>
                </div>
                <Switch checked={form.validityEnabled} onCheckedChange={(validityEnabled) => setForm((value) => ({ ...value, validityEnabled }))} />
              </div>
              <div className="w-full sm:w-40">
                <Input type="number" min="1" max="365" disabled={!form.validityEnabled} value={form.offerValidityDays} onChange={(event) => setForm((value) => ({ ...value, offerValidityDays: event.target.value }))} />
                <p className="mt-1 text-[11px] text-muted-foreground">dias</p>
              </div>
            </div>
          </AdminSurface>

          <AdminSurface className="p-0">
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                <h2 className="text-sm font-bold">Notificação</h2>
              </div>
            </div>
            <div className="grid gap-4 p-5">
              <Field label="Título">
                <Input value={form.notificationTitle} onChange={(event) => setForm((value) => ({ ...value, notificationTitle: event.target.value }))} />
              </Field>
              <Field label="Mensagem" hint={rewardsEnabled ? "Use {{orderNumber}}, {{estimatedPoints}} e {{cashbackPercent}} quando precisar." : "Use {{orderNumber}} para identificar o pedido, se quiser."}>
                <Textarea rows={3} value={form.notificationMessage} onChange={(event) => setForm((value) => ({ ...value, notificationMessage: event.target.value }))} />
              </Field>
            </div>
          </AdminSurface>

          {googleEnabled ? (
            <AdminSurface className="p-0">
              <div className="border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 text-primary" />
                  <div>
                    <h2 className="text-sm font-bold">Link do Google</h2>
                    <p className="text-xs text-muted-foreground">Use o link de avaliação específico desta unidade.</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
                <Field label="URL da avaliação">
                  <Input type="url" inputMode="url" placeholder="https://g.page/r/.../review" value={form.externalReviewUrl} onChange={(event) => setForm((value) => ({ ...value, externalReviewUrl: event.target.value }))} />
                </Field>
                <Field label="Texto do botão">
                  <Input value={form.externalReviewLabel} onChange={(event) => setForm((value) => ({ ...value, externalReviewLabel: event.target.value }))} />
                </Field>
              </div>
            </AdminSurface>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset} disabled={!configQuery.data || saveMutation.isPending}>Descartar</Button>
            <Button onClick={save} disabled={saveMutation.isPending || configQuery.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar configuração
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <AdminSurface className="p-5">
            <div className="flex items-center gap-2">
              <WalletCards className="size-4 text-primary" />
              <h2 className="text-sm font-bold">Resumo da regra</h2>
            </div>
            <div className="mt-4 divide-y rounded-xl border">
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Fluxo</span>
                <strong className="text-right">
                  {form.campaignMode === "google_request"
                    ? "Google"
                    : form.campaignMode === "order_reward_plus_google"
                      ? "Pedido + Google"
                      : "Avaliação do pedido"}
                </strong>
              </div>
              {rewardsEnabled ? (
                <>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Cashback</span>
                    <strong>{cashback.toLocaleString("pt-BR")}%</strong>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Pedido de R$ 100</span>
                    <strong>+{previewPoints.toLocaleString("pt-BR")} pts</strong>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">Disparo</span>
                <strong>{Number(form.notificationDelayMinutes || 0).toLocaleString("pt-BR")} min</strong>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">Validade</span>
                <strong>{form.validityEnabled ? `${form.offerValidityDays || "0"} dias` : "Sem prazo"}</strong>
              </div>
            </div>
          </AdminSurface>

          <AdminSurface className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                <h2 className="text-sm font-bold">Prévia da notificação</h2>
              </div>
              <Badge variant="outline">Cliente</Badge>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{form.notificationTitle || "Título da notificação"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{form.notificationMessage || "Mensagem da notificação"}</p>
              {googleEnabled && form.externalReviewUrl ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <ExternalLink className="size-3.5" />
                  {form.externalReviewLabel || "Avaliar também no Google"}
                </div>
              ) : null}
            </div>
          </AdminSurface>
        </div>
      </div>
    </AdminPage>
  );
}
