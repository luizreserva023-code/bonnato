import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BonattoSectionHero } from "@/components/consumer/BonattoSectionHero";
import { toast } from "sonner";
import {
  Crown,
  Star,
  Pizza,
  Truck,
  Tag,
  CheckCircle2,
  Copy,
  RefreshCw,
  XCircle,
  ChevronLeft,
  Sparkles,
  Calendar,
  Gift,
} from "lucide-react";

// ── Componente de plano ────────────────────────────────────────────────────────
function PlanCard({
  plan,
  isPopular,
  selected,
  onSelect,
}: {
  plan: {
    id: string;
    name: string;
    badge: string;
    price: number;
    discountPercent: number;
    freeDelivery: boolean;
    freePizzaPerMonth: boolean;
    description: string;
    benefits: readonly string[];
  };
  isPopular: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const isBonattao = plan.id === "bonattao";
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-2xl border-2 cursor-pointer transition-all duration-200 p-6 ${
        selected
          ? "border-[#da1923] bg-[#fff7ed] shadow-[8px_8px_0_#da1923]"
          : "border-[#d8c7bd] bg-white hover:border-[#da1923]"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[#6E0D12] btn-bonatto text-white text-xs px-3 py-1 font-bold">
            {plan.badge.toUpperCase()}
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBonattao ? "bg-[#6E0D12] btn-bonatto" : "bg-zinc-700"}`}>
          {isBonattao ? <Crown className="w-5 h-5 text-white" /> : <Star className="w-5 h-5 text-white" />}
        </div>
        <div>
          <h3 className="text-[#211713] font-bold text-lg">{plan.name}</h3>
          <p className="text-[#75645d] text-xs">{plan.description.split(":")[0]}</p>
        </div>
      </div>

      <div className="mb-5">
        <span className="text-3xl font-black text-[#211713]">
          R$ {plan.price.toFixed(2).replace(".", ",")}
        </span>
        <span className="text-zinc-400 text-sm">/mês</span>
      </div>

      <ul className="space-y-2">
        {plan.benefits.map((benefit, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-[#51443f]">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            {benefit}
          </li>
        ))}
      </ul>

      <div className={`mt-5 w-full py-2 rounded-xl text-center text-sm font-bold transition-colors ${
        selected
          ? "bg-[#6E0D12] btn-bonatto text-white"
          : "bg-[#211713] text-white"
      }`}>
        {selected ? "✓ Selecionado" : "Selecionar"}
      </div>
    </div>
  );
}

// ── Componente PIX ─────────────────────────────────────────────────────────────
function PixPayment({
  paymentId,
  pixCode,
  pixQrCode,
  amount,
  planName,
  onConfirmed,
}: {
  paymentId: number;
  pixCode: string;
  pixQrCode: string;
  amount: number;
  planName: string;
  onConfirmed: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();
  const { selectedStore } = useStore();

  // Polling a cada 5s para verificar se admin confirmou
  const { data: paymentStatus } = trpc.club.checkPayment.useQuery(
    { paymentId, storeId: selectedStore?.id ?? 0 },
    { refetchInterval: 5000, enabled: Boolean(selectedStore?.id) }
  );

  useEffect(() => {
    if (paymentStatus?.status === "paid") {
      utils.club.getMyPlan.invalidate();
      onConfirmed();
    }
  }, [paymentStatus?.status]);

  const copyCode = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-[28px] border-2 border-[#211713] bg-white p-6 text-center shadow-[8px_8px_0_#211713]">
        <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        </div>
        <h3 className="text-[#211713] font-bold text-xl mb-1">Pague via PIX</h3>
        <p className="text-[#75645d] text-sm mb-6">
          Plano <strong className="text-white">{planName}</strong> — R$ {amount.toFixed(2).replace(".", ",")}
        </p>

        {/* QR Code */}
        <div className="bg-white rounded-xl p-3 inline-block mb-5">
          <img src={pixQrCode} alt="QR Code PIX" className="w-48 h-48" />
        </div>

        <p className="text-zinc-400 text-xs mb-3">Ou copie o código abaixo:</p>

        {/* Código copia-e-cola */}
        <div className="bg-[#f2e8de] rounded-xl p-3 mb-4 text-left">
          <p className="text-[#51443f] text-xs font-mono break-all leading-relaxed">
            {pixCode.substring(0, 60)}...
          </p>
        </div>

        <Button
          onClick={copyCode}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold mb-4"
        >
          {copied ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Copiado!</>
          ) : (
            <><Copy className="w-4 h-4 mr-2" /> Copiar Código PIX</>
          )}
        </Button>

        <div className="flex items-center justify-center gap-2 text-[#75645d] text-xs">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Aguardando confirmação do pagamento...
        </div>

        <p className="text-[#8b7971] text-xs mt-3">
          Após o pagamento, seu plano será ativado automaticamente.
        </p>
      </div>
    </div>
  );
}

// ── Dashboard do membro ────────────────────────────────────────────────────────
function MemberDashboard({
  myPlan,
}: {
  myPlan: {
    plan: string | null;
    status: string | null;
    startDate: Date | null;
    nextBillingDate: Date | null;
    freePizzaUsed: boolean;
    freePizzaResetAt: Date | null;
    planDetails: {
      name: string;
      price: number;
      discountPercent: number;
      freeDelivery: boolean;
      freePizzaPerMonth: boolean;
      benefits: readonly string[];
    } | null;
  };
}) {
  const [, navigate] = useLocation();
  const { selectedStore } = useStore();
  const cancelMutation = trpc.club.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Assinatura cancelada.");
      window.location.reload();
    },
  });

  const isBonattao = myPlan.plan === "bonattao";
  const statusColor = myPlan.status === "active" ? "bg-green-600" : myPlan.status === "pending" ? "bg-yellow-600" : "bg-zinc-600";
  const statusLabel = myPlan.status === "active" ? "Ativo" : myPlan.status === "pending" ? "Aguardando pagamento" : "Cancelado";
  const planDetails = myPlan.planDetails ?? {
    name: "Clube do Bonatto",
    price: 0,
    discountPercent: 0,
    freeDelivery: false,
    freePizzaPerMonth: false,
    benefits: [],
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header do plano */}
      <div className={`rounded-2xl p-6 ${isBonattao ? "bg-[#191412] border border-[#3a2b27]" : "bg-[#27201d] border border-[#4a3a35]"}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isBonattao ? "bg-[#6E0D12] btn-bonatto" : "bg-zinc-700"}`}>
              {isBonattao ? <Crown className="w-6 h-6 text-white" /> : <Star className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h3 className="text-white font-black text-xl">Plano {planDetails.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white">R$ {planDetails.price.toFixed(2).replace(".", ",")}</p>
            <p className="text-zinc-400 text-xs">/mês</p>
          </div>
        </div>
      </div>

      {/* Benefícios ativos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-center">
          <Tag className="w-6 h-6 text-[#7d0f14] mx-auto mb-2" />
          <p className="text-white font-bold text-lg">{planDetails.discountPercent}%</p>
          <p className="text-zinc-400 text-xs">desconto em pedidos</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${planDetails.freeDelivery ? "bg-green-950/30 border-green-800" : "bg-zinc-900 border-zinc-700 opacity-50"}`}>
          <Truck className={`w-6 h-6 mx-auto mb-2 ${planDetails.freeDelivery ? "text-green-500" : "text-zinc-600"}`} />
          <p className={`font-bold text-lg ${planDetails.freeDelivery ? "text-white" : "text-zinc-600"}`}>
            {planDetails.freeDelivery ? "Grátis" : "Não incluso"}
          </p>
          <p className="text-zinc-400 text-xs">entrega</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${!myPlan.freePizzaUsed ? "bg-orange-950/30 border-orange-800" : "bg-zinc-900 border-zinc-700 opacity-60"}`}>
          <Pizza className={`w-6 h-6 mx-auto mb-2 ${!myPlan.freePizzaUsed ? "text-orange-400" : "text-zinc-600"}`} />
          <p className={`font-bold text-lg ${!myPlan.freePizzaUsed ? "text-white" : "text-zinc-500"}`}>
            {myPlan.freePizzaUsed ? "Usada" : "Disponível"}
          </p>
          <p className="text-zinc-400 text-xs">pizza grátis do mês</p>
        </div>
      </div>

      {/* Datas */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
        {myPlan.startDate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Calendar className="w-4 h-4" />
              Membro desde
            </div>
            <span className="text-white text-sm font-medium">
              {new Date(myPlan.startDate).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}
        {myPlan.nextBillingDate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <RefreshCw className="w-4 h-4" />
              Próxima renovação
            </div>
            <span className="text-white text-sm font-medium">
              {new Date(myPlan.nextBillingDate).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}
        {myPlan.freePizzaResetAt && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Gift className="w-4 h-4" />
              Pizza grátis renova em
            </div>
            <span className="text-white text-sm font-medium">
              {new Date(myPlan.freePizzaResetAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate("/cardapio")}
          className="flex-1 bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white font-bold"
        >
          <Pizza className="w-4 h-4 mr-2" />
          Fazer Pedido com Desconto
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Tem certeza que deseja cancelar sua assinatura?")) {
              if (selectedStore?.id) cancelMutation.mutate({ storeId: selectedStore.id });
            }
          }}
          className="border-zinc-700 text-zinc-400 hover:text-[#a01218] hover:border-[#5a0a0f]"
        >
          <XCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Clube() {
  const { user, loading: authLoading } = useAuth();
  const { selectedStore } = useStore();
  const [, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<"bonattao" | "basico">("bonattao");
  const [step, setStep] = useState<"plans" | "pix" | "success">("plans");
  const [pixData, setPixData] = useState<{
    paymentId: number;
    pixCode: string;
    pixQrCode: string;
    amount: number;
    planName: string;
  } | null>(null);

  const { data: plans, isLoading: plansLoading } = trpc.club.getPlans.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: Boolean(selectedStore?.id) },
  );
  const { data: clubConfig } = trpc.club.getPublicConfig.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: Boolean(selectedStore?.id) },
  );
  const { data: myPlan, isLoading: myPlanLoading } = trpc.club.getMyPlan.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: !!user && Boolean(selectedStore?.id) }
  );

  const subscribeMutation = trpc.club.subscribe.useMutation({
    onSuccess: (data) => {
      setPixData({
        paymentId: data.paymentId,
        pixCode: data.pixCode,
        pixQrCode: data.pixQrCode,
        amount: data.amount,
        planName: data.plan.name,
      });
      setStep("pix");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao gerar PIX");
    },
  });

  const handleSubscribe = () => {
    if (!user) {
      window.location.href = getLoginUrl("/clube");
      return;
    }
    if (!selectedStore?.id) {
      toast.error("Selecione uma loja para continuar.");
      return;
    }
    subscribeMutation.mutate({ storeId: selectedStore.id, plan: selectedPlan });
  };

  if (authLoading || plansLoading || myPlanLoading) {
    return (
      <div className="min-h-screen bg-[#f5eee6] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6E0D12] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Se já é membro ativo ou pendente, mostra dashboard
  if (myPlan && (myPlan.status === "active" || myPlan.status === "pending")) {
    return (
      <div className="min-h-screen bg-[#f5eee6] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-[#75645d] hover:text-[#da1923] mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-[#6E0D12] btn-bonatto/20 border border-[#6E0D12]/40 rounded-full px-4 py-1.5 mb-4">
              <Crown className="w-4 h-4 text-[#a01218]" />
              <span className="text-[#a01218] text-sm font-medium">{clubConfig?.badgeLabel ?? "Clube do Bonatto"}</span>
            </div>
            <h1 className="text-3xl font-black text-[#211713]">Sua Assinatura</h1>
          </div>

          <MemberDashboard myPlan={myPlan} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5eee6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#75645d] hover:text-[#da1923] mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>

        <BonattoSectionHero
          eyebrow={clubConfig?.badgeLabel ?? "Clube do Bonatto"}
          title={clubConfig?.sectionTitle ?? "Assine, economize e ganhe pizza todo mês."}
          description={clubConfig?.sectionSubtitle ?? "Escolha um plano e veja os benefícios incluídos."}
          aside={<img src="/brand/dna/personagem-bonatto.png" alt="Personagem Bonatto" className="relative z-[1] h-full w-full object-contain p-2" />}
        />

        {/* Benefits configured by the store */}
        <div className="text-center mb-12">
          <div className="hidden">
            <Crown className="w-4 h-4 text-[#e63946]" />
            <span className="text-[#e63946] font-bold text-xs uppercase tracking-widest">{clubConfig?.badgeLabel ?? "Clube do Bonatto"}</span>
          </div>
          <h1 className="hidden"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {clubConfig?.sectionTitle ?? "Assine, economize e ganhe pizza todo mês."}
          </h1>
          <p className="hidden">
            {clubConfig?.sectionSubtitle ?? "Escolha um plano, pague via PIX e veja os benefícios incluídos."}
          </p>
          {/* Mini benefícios */}
          <div className="mt-5 flex flex-wrap justify-start gap-2">
            {(clubConfig?.highlightItems ?? ["Pizza grátis mensal", "Até 20% de desconto", "Entrega grátis no plano premium", "Cancele quando quiser"]).map((b) => (
              <span key={b} className="border-2 border-[#211713] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#211713]">{b}</span>
            ))}
          </div>
        </div>

        {step === "plans" && (
          <>
            {/* Planos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
              {plans?.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isPopular={clubConfig?.popularPlanId === plan.id}
                  selected={selectedPlan === plan.id}
                  onSelect={() => setSelectedPlan(plan.id as "bonattao" | "basico")}
                />
              ))}
            </div>

            {/* CTA */}
            <div className="text-center">
              <Button
                onClick={handleSubscribe}
                disabled={subscribeMutation.isPending}
                className="bg-[#da1923] hover:bg-[#bd111a] text-white font-black text-lg px-10 py-6 rounded-xl shadow-[6px_6px_0_#211713] transition-transform hover:-translate-y-0.5"
              >
                {subscribeMutation.isPending ? (
                  <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Gerando PIX...</>
                ) : (
                  <><Crown className="w-5 h-5 mr-2" /> {clubConfig?.ctaLabel ?? "Assinar agora via PIX"}</>
                )}
              </Button>
              <p className="text-zinc-500 text-xs mt-3">{clubConfig?.disclaimer ?? "Pagamento via PIX • Cancele quando quiser"}</p>
            </div>
          </>
        )}

        {step === "pix" && pixData && (
          <PixPayment
            paymentId={pixData.paymentId}
            pixCode={pixData.pixCode}
            pixQrCode={pixData.pixQrCode}
            amount={pixData.amount}
            planName={pixData.planName}
            onConfirmed={() => setStep("success")}
          />
        )}

        {step === "success" && (
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-3">{clubConfig?.successTitle ?? "Bem-vindo ao Clube!"}</h2>
            <p className="text-zinc-400 mb-8">
              {clubConfig?.successSubtitle ?? "Seu plano foi ativado e os benefícios já estão disponíveis."}
            </p>
            <Button
              onClick={() => navigate("/cardapio")}
              className="bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white font-bold px-8 py-4 rounded-xl"
            >
              <Pizza className="w-5 h-5 mr-2" />
              Fazer pedido com desconto
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
