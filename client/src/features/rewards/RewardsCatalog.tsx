import { useEffect, useRef, useState } from "react";
import { Check, Copy, Gift, Loader2, PackageOpen, Tag, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

type RewardAvailability =
  | "available"
  | "insufficient_points"
  | "upcoming"
  | "expired"
  | "sold_out"
  | "limit_reached"
  | "inactive";

type RewardView = {
  id: number;
  name: string;
  description: string | null;
  rewardType: "discount" | "product" | "free_delivery" | "cashback";
  pointsCost: number;
  category: string | null;
  icon: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  buttonText: string;
  expiresAt: Date | null;
  availability: RewardAvailability;
  availableCoupons: number;
  balance: number | null;
};

const availabilityLabels: Record<RewardAvailability, string> = {
  available: "Disponível",
  insufficient_points: "Saldo insuficiente",
  upcoming: "Em breve",
  expired: "Expirada",
  sold_out: "Esgotada",
  limit_reached: "Limite atingido",
  inactive: "Indisponível",
};

const redemptionLabels: Record<string, string> = {
  pending: "Processando",
  completed: "Disponível para uso",
  cancelled: "Cancelado",
  refunded: "Estornado",
  expired: "Expirado",
};

function RewardGlyph({ type }: { type: RewardView["rewardType"] }) {
  const Icon = type === "free_delivery" ? Truck : type === "product" ? Gift : Tag;
  return <Icon className="size-8" strokeWidth={1.8} aria-hidden="true" />;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sem prazo definido";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replaceAll("-", "");
  }
  return `reward_${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;
}

export function RewardsCatalog({ storeId, initialRewardId }: { storeId: number; initialRewardId?: number }) {
  const utils = trpc.useUtils();
  const overview = trpc.rewards.myOverview.useQuery({ storeId }, { staleTime: 15_000 });
  const [selectedReward, setSelectedReward] = useState<RewardView | null>(null);
  const [success, setSuccess] = useState<{ rewardName: string; couponCode: string; pointsSpent: number } | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const initialRewardHandled = useRef(false);

  const redeem = trpc.rewards.redeem.useMutation({
    onSuccess: async (result) => {
      setSuccess({
        rewardName: result.rewardName,
        couponCode: result.couponCode ?? "",
        pointsSpent: result.pointsSpent,
      });
      setSelectedReward(null);
      idempotencyKey.current = null;
      await Promise.all([
        utils.rewards.myOverview.invalidate({ storeId }),
        utils.rewards.myRedemptions.invalidate({ storeId }),
        utils.rewards.list.invalidate({ storeId }),
        utils.loyalty.points.invalidate({ storeId }),
      ]);
    },
    onError: (error) => {
      idempotencyKey.current = null;
      toast.error(error.message || "Não foi possível concluir o resgate.");
    },
  });

  const rewards = (overview.data?.rewards ?? []) as RewardView[];
  const redemptions = overview.data?.redemptions ?? [];
  const balance = Number(overview.data?.balance ?? 0);

  useEffect(() => {
    if (!initialRewardId || initialRewardHandled.current || !rewards.length) return;
    initialRewardHandled.current = true;
    const requested = rewards.find((reward) => reward.id === initialRewardId);
    if (requested) setSelectedReward(requested);
  }, [initialRewardId, rewards]);

  const openReward = (reward: RewardView) => {
    idempotencyKey.current = null;
    setSelectedReward(reward);
  };

  const confirmRedeem = () => {
    if (!selectedReward || redeem.isPending) return;
    idempotencyKey.current ??= newIdempotencyKey();
    redeem.mutate({ storeId, rewardId: selectedReward.id, idempotencyKey: idempotencyKey.current });
  };

  const copyCoupon = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Cupom copiado.");
  };

  if (overview.isPending) {
    return (
      <div className="grid min-h-56 place-items-center rounded-[24px] border border-[#eadbd5] bg-white">
        <Loader2 className="size-7 animate-spin text-[#DA1923]" aria-label="Carregando recompensas" />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-[24px] border border-[#eadbd5] bg-white px-5 text-center">
        <XCircle className="size-8 text-[#DA1923]" />
        <p className="font-bold text-[#261817]">Não foi possível carregar as recompensas.</p>
        <Button variant="outline" onClick={() => overview.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="catalog" className="space-y-5">
        <div className="flex flex-col gap-3 rounded-[24px] bg-[#181311] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffca32]">Seus pontos valem sabor</p>
            <h2 className="mt-1 text-3xl uppercase leading-none text-white">Clube de Recompensas</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-widest text-white/65">Seu saldo</p>
            <p className="text-2xl font-black">{balance.toLocaleString("pt-BR")} pts</p>
          </div>
        </div>

        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-[#f1e7e2] p-1">
          <TabsTrigger value="catalog" className="rounded-xl py-2.5">Recompensas</TabsTrigger>
          <TabsTrigger value="redemptions" className="rounded-xl py-2.5">Meus resgates ({redemptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-0">
          {rewards.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-[24px] border border-dashed border-[#d8c6c0] bg-white px-5 text-center">
              <div>
                <PackageOpen className="mx-auto size-9 text-[#a38e88]" />
                <p className="mt-3 font-bold text-[#261817]">Nenhuma recompensa disponível agora.</p>
                <p className="mt-1 text-sm text-[#887672]">Novos benefícios aparecerão aqui quando forem liberados.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rewards.map((reward) => {
                const canRedeem = reward.availability === "available";
                return (
                  <Card key={reward.id} className="overflow-hidden rounded-[24px] border-[#dcbfc0] bg-[#96111a] text-white shadow-[0_18px_45px_-34px_rgba(75,8,14,.85)]">
                    <div className="relative grid h-36 place-items-center overflow-hidden bg-[#a71721]">
                      {reward.imageUrl ? (
                        <img src={reward.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid size-20 place-items-center rounded-full bg-white/12 text-[#ffca32]">
                          <RewardGlyph type={reward.rewardType} />
                        </div>
                      )}
                      <Badge className="absolute left-4 top-4 border-0 bg-black/20 text-white hover:bg-black/20">
                        {reward.badgeText || reward.category || "Recompensa"}
                      </Badge>
                    </div>
                    <CardContent className="flex min-h-56 flex-col p-5">
                      <h3 className="text-2xl uppercase leading-none text-white">{reward.name}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/72">{reward.description || "Benefício exclusivo do clube."}</p>
                      <div className="mt-auto pt-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <strong>{reward.pointsCost.toLocaleString("pt-BR")} pontos</strong>
                          {!canRedeem && <span className="text-xs font-bold text-[#ffca32]">{availabilityLabels[reward.availability]}</span>}
                        </div>
                        <Button
                          className="w-full bg-white font-black text-[#96111a] hover:bg-[#fff3ef]"
                          disabled={!canRedeem}
                          onClick={() => openReward(reward)}
                        >
                          {canRedeem ? reward.buttonText : availabilityLabels[reward.availability]}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="redemptions" className="mt-0 space-y-3">
          {redemptions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#d8c6c0] bg-white p-8 text-center text-[#887672]">
              Você ainda não resgatou nenhuma recompensa.
            </div>
          ) : redemptions.map((redemption) => (
            <Card key={redemption.id} className="rounded-[22px] border-[#eadbd5] bg-white">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-[#261817]">{redemption.rewardName}</h3>
                    <Badge variant="secondary">{redemptionLabels[redemption.status] ?? redemption.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[#887672]">{redemption.pointsSpent.toLocaleString("pt-BR")} pontos · resgatado em {formatDate(redemption.redeemedAt)}</p>
                  <p className="text-sm text-[#887672]">Validade: {formatDate(redemption.expiresAt)}</p>
                </div>
                {redemption.couponCode && redemption.status === "completed" && (
                  <Button variant="outline" className="justify-between gap-3 border-[#d9b3b5] font-mono font-bold" onClick={() => copyCoupon(redemption.couponCode!)}>
                    {redemption.couponCode}<Copy className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedReward)} onOpenChange={(open) => !open && !redeem.isPending && setSelectedReward(null)}>
        <DialogContent className="max-w-md rounded-[28px] border-[#e3cbc5]">
          {selectedReward && (
            <>
              <DialogHeader>
                <DialogTitle className="text-3xl uppercase leading-none text-[#261817]">Confirmar resgate</DialogTitle>
                <DialogDescription>{selectedReward.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-2xl bg-[#f7efeb] p-4 text-sm">
                <div className="flex justify-between"><span>Valor</span><strong>{selectedReward.pointsCost.toLocaleString("pt-BR")} pontos</strong></div>
                <div className="flex justify-between"><span>Saldo atual</span><strong>{balance.toLocaleString("pt-BR")} pontos</strong></div>
                <div className="flex justify-between border-t border-[#e4d1ca] pt-3"><span>Saldo após o resgate</span><strong>{Math.max(0, balance - selectedReward.pointsCost).toLocaleString("pt-BR")} pontos</strong></div>
                <div className="flex justify-between"><span>Validade</span><strong>{formatDate(selectedReward.expiresAt)}</strong></div>
              </div>
              <p className="text-xs leading-relaxed text-[#887672]">O cupom será exclusivo da sua conta e poderá ser usado uma única vez em um pedido elegível. O resgate não pode ser desfeito pelo cliente.</p>
              <Button className="h-12 bg-[#DA1923] font-black text-white hover:bg-[#b8151d]" onClick={confirmRedeem} disabled={redeem.isPending}>
                {redeem.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Processando resgate</> : "Confirmar resgate"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(success)} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent className="max-w-md rounded-[28px] text-center">
          {success && (
            <>
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-8" /></div>
              <DialogHeader>
                <DialogTitle className="text-center text-3xl uppercase leading-none">Recompensa resgatada!</DialogTitle>
                <DialogDescription className="text-center">{success.rewardName} · {success.pointsSpent.toLocaleString("pt-BR")} pontos</DialogDescription>
              </DialogHeader>
              <button type="button" onClick={() => copyCoupon(success.couponCode)} className="flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-[#DA1923] bg-[#fff6f3] px-4 py-4 font-mono text-lg font-black text-[#96111a]">
                {success.couponCode}<Copy className="size-5" />
              </button>
              <p className="text-sm text-[#887672]">Use este código no checkout. Ele continuará disponível em “Meus resgates”.</p>
              <Button className="bg-[#DA1923] hover:bg-[#b8151d]" onClick={() => setSuccess(null)}>Continuar navegando</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
