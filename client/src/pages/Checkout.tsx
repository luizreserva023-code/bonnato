import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  QrCode,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Truck,
  Wallet,
  LogIn,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { isStoreOpenWithHours, nextOpenTimeWithHours, type DaySchedule } from "@/lib/storeUtils";
import { StoreClosedBanner } from "@/components/StoreClosedBanner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BonattoSectionHero } from "@/components/consumer/BonattoSectionHero";
import { TrendingDown, Zap, ShoppingCart as CartIcon, X as XIcon } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";
import { clearPendingCoupon, getPendingCoupon } from "@/lib/checkout-intent";
import { trackMetaEvent } from "@/lib/storeTracking";
import { getStoreAttribution } from "@/lib/marketingAttribution";
import { clearCheckoutIdempotencyKey, getCheckoutIdempotencyKey } from "@/lib/order-idempotency";
import { emitAnalyticsEvent } from "@/lib/analyticsTracking";
import { lookupCep, lookupNeighborhoodCep } from "@/lib/cep";

type PaymentMethod = "credit_card" | "debit_card" | "pix" | "cash";
type DeliveryMode = "delivery" | "pickup";
type PixCheckoutData = {
  chargeId: string;
  qrCodeImage: string;
  pixCopiaECola: string;
  expirationDate: string;
  value: number;
  autoConfirm?: boolean;
  instructions?: string;
};

type AlternativeDeliveryStoreView = {
  storeId: number;
  name: string;
  slug: string;
  city: string;
  distanceKm: number;
  deliveryFee: number;
  estimatedMinutes: number;
};

type DeliveryQuoteView = (
  | {
      available: true;
      zoneId: number;
      distanceKm: number;
      deliveryFee: number;
      estimatedMinutes: number;
    }
  | {
      available: false;
      reason: string;
      distanceKm?: number;
    }
) & {
  alternatives?: AlternativeDeliveryStoreView[];
};

function deliveryReasonMessage(reason: string) {
  const messages: Record<string, string> = {
    DELIVERY_DISABLED: "A entrega está temporariamente indisponível nesta unidade.",
    STORE_LOCATION_MISSING: "A unidade ainda não configurou a origem da entrega.",
    INVALID_ADDRESS: "Preencha CEP, rua, número, cidade e UF.",
    ADDRESS_NOT_FOUND: "Não conseguimos localizar este endereço. Confira rua e número.",
    LOW_CONFIDENCE_ADDRESS: "Não conseguimos localizar este endereço com confiança. Confira rua e número.",
    ROUTING_PROVIDER_UNAVAILABLE: "Não foi possível calcular a rota agora. Tente novamente em instantes.",
    OUTSIDE_DELIVERY_AREA: "Infelizmente este endereço está fora da nossa área de entrega.",
    NO_COVERAGE_ZONE: "Este endereço fica em uma área sem cobertura de entrega.",
    NO_DELIVERY_ZONES: "A entrega desta unidade ainda não foi configurada.",
  };
  return messages[reason] ?? "Não foi possível calcular a entrega.";
}

const STEPS = ["Entrega", "Pagamento", "Confirmar"] as const;
type Step = 0 | 1 | 2;

export default function Checkout() {
  const { items, subtotal, clearCart, replaceCart } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { selectedStore, bonattoConfig, stores, setSelectedStore } = useStore();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>(0);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");

  const [form, setForm] = useState({
    customerName: user?.name ?? "",
    customerEmail: user?.email ?? "",
    customerPhone: "",
    deliveryAddress: "",
    deliveryStreet: "",
    deliveryNumber: "",
    deliveryCep: "",
    deliveryCity: selectedStore?.city ?? "",
    deliveryState: "",
    deliveryComplement: "",
    notes: "",
    changeFor: "", // troco para
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponFreeDelivery, setCouponFreeDelivery] = useState(false);
  const [couponApplied, setCouponApplied] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [pointsApplied, setPointsApplied] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderStep, setOrderStep] = useState<"form" | "success">("form");
  const [savedItems, setSavedItems] = useState<typeof items>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [neighborhood, setNeighborhood] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuoteView | null>(null);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState<string | null>(null);

  // Upsell / Downsell state
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [upsellDismissed, setUpsellDismissed] = useState(false);
  const [showDownsellModal, setShowDownsellModal] = useState(false);

  const createOrder = trpc.orders.create.useMutation();
  const deliveryQuoteMutation = trpc.delivery.quote.useMutation();
  const createCheckoutSession = trpc.payments.createCheckoutSession.useMutation();
  const createManualPixCode = trpc.payments.createManualPixCode.useMutation();
  const checkoutWithSavedCard = trpc.payments.checkoutWithSavedCard.useMutation();
  const createPixAsaas = trpc.asaas.createPix.useMutation();
  // Estado do QR Code PIX Asaas
  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const pixStatusQuery = trpc.asaas.checkPixStatus.useQuery(
    { orderId: orderId ?? 0 },
    {
      enabled: !!orderId && !!pixData?.autoConfirm && !pixPaid,
      refetchInterval: pixData?.autoConfirm && !pixPaid ? 5000 : false,
    }
  );
  // Detectar pagamento confirmado via polling
  useEffect(() => {
    if (pixStatusQuery.data?.paid && !pixPaid) {
      setPixPaid(true);
      toast.success("PIX confirmado! Seu pedido foi pago com sucesso.");
    }
  }, [pixStatusQuery.data?.paid, pixPaid]);
  const savedCardsQuery = trpc.payments.listSavedCards.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [useSavedCard, setUseSavedCard] = useState(false);
  const validateCoupon = trpc.coupons.validate.useMutation();
  const pendingCouponHandled = useRef(false);
  const checkoutStepRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<Step>(step);
  // loyalty.redeem foi substituído — o débito agora acontece dentro do createOrder via pointsToRedeem
  const loyaltyPointsQuery = trpc.loyalty.points.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isAuthenticated && bonattoConfig.features.loyalty && Boolean(selectedStore?.id) },
  );
  const registerAbandonedCart = trpc.automations.registerAbandonedCart.useMutation();
  const profileQuery = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated });
  const savedAddressesQuery = trpc.addresses.list.useQuery(undefined, { enabled: isAuthenticated });

  const cartProductIds = useMemo(() => items.map((i) => i.productId), [items]);
  const upsellQuery = trpc.upsells.forCart.useQuery(
    { productIds: cartProductIds, cartTotal: subtotal, storeId: selectedStore?.id },
    { enabled: isAuthenticated && items.length > 0 && Boolean(selectedStore?.id) }
  );
  const productsQuery = trpc.products.list.useQuery({ storeId: selectedStore?.id }, { enabled: isAuthenticated && Boolean(selectedStore?.id) });
  const myClubPlan = trpc.club.getMyPlan.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: isAuthenticated && bonattoConfig.features.club && Boolean(selectedStore?.id) },
  );
  const clubConfigQuery = trpc.club.getPublicConfig.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: bonattoConfig.features.club && Boolean(selectedStore?.id) },
  );
  const paymentSettingsQuery = trpc.paymentSettings.getPublic.useQuery(
    { storeId: selectedStore?.id },
    {
      enabled: Boolean(selectedStore?.id),
      retry: 2,
      refetchOnMount: "always",
    },
  );
  const storeSettingsQuery = trpc.storeSettings.get.useQuery({ storeId: selectedStore?.id });
  const minOrderValue = storeSettingsQuery.data?.minOrderValue ? parseFloat(storeSettingsQuery.data.minOrderValue) : 0;
  const dbStoreHours = storeSettingsQuery.data?.storeHours
    ? (JSON.parse(storeSettingsQuery.data.storeHours as string) as Record<string, DaySchedule | null>)
    : undefined;
  const manualStoreOpen = storeSettingsQuery.data?.manualStoreOpen === "true";
  const clubPlan = myClubPlan.data;
  const clubConfig = clubConfigQuery.data;
  const paymentSettings = paymentSettingsQuery.data;
  const isPaymentSettingsLoading = !selectedStore?.id || (paymentSettingsQuery.isPending && !paymentSettings);
  const paymentOptions = useMemo(() => {
    const options: Array<{ value: PaymentMethod; label: string; icon: React.ReactNode; desc: string }> = [];
    if (!paymentSettings) return options;
    if (bonattoConfig.providers.payments.pix && paymentSettings?.config.orders.pixEnabled) {
      const desc =
        paymentSettings.config.orders.pixMode === "dynamic_asaas"
          ? "QR Code e aprovação automática"
          : "Copia e cola com chave da loja";
      options.push({ value: "pix", label: "PIX", icon: <QrCode className="w-5 h-5" />, desc });
    }
    if (bonattoConfig.providers.payments.card && paymentSettings?.config.orders.cardEnabled) {
      options.push({ value: "credit_card", label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, desc: "Pagamento online seguro" });
      options.push({ value: "debit_card", label: "Cartão de Débito", icon: <CreditCard className="w-5 h-5" />, desc: "Pagamento online seguro" });
    }
    if (bonattoConfig.providers.payments.cash && paymentSettings.config.orders.cashEnabled) {
      options.push({ value: "cash", label: "Dinheiro", icon: <Wallet className="w-5 h-5" />, desc: "Pagamento na entrega" });
    }
    return options;
  }, [paymentSettings, bonattoConfig.providers.payments]);
  const clubPlanDetails = clubPlan?.planDetails;
  const isClubActive = clubPlan?.status === "active";
  const clubDiscountPct = isClubActive ? Number(clubPlanDetails?.discountPercent ?? 0) : 0;
  const clubFreeDelivery = Boolean(isClubActive && clubPlanDetails?.freeDelivery);
  const clubFreePizzaAvailable = Boolean(isClubActive && clubPlanDetails?.freePizzaPerMonth && !clubPlan?.freePizzaUsed);

  // Restaurar carrinho abandonado via ?restore=cartId
  const restoreCartId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("restore");
    return v ? parseInt(v) : null;
  }, []);
  const restoreCartQuery = trpc.cart.getById.useQuery(
    { cartId: restoreCartId ?? 0 },
    { enabled: isAuthenticated && restoreCartId !== null }
  );
  useEffect(() => {
    if (!restoreCartQuery.data) return;
    const cart = restoreCartQuery.data;
    if (cart.items.length === 0) return;
    replaceCart(cart.items.map(i => ({
      productId: i.productId,
      productName: i.productName,
      productPrice: i.productPrice,
      quantity: i.quantity,
    })));
    if (cart.couponCode) setCouponCode(cart.couponCode);
    window.history.replaceState({}, "", window.location.pathname);
    toast.success("Carrinho restaurado! Finalize seu pedido.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreCartQuery.data]);

  // Pre-fill from saved profile
  useEffect(() => {
    if (profileQuery.data) {
      const p = profileQuery.data;
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || p.name || "",
        customerEmail: prev.customerEmail || p.email || "",
        customerPhone: prev.customerPhone || (p as any).phone || "",
        deliveryAddress: prev.deliveryAddress || (p as any).savedAddress || "",
        deliveryStreet: prev.deliveryStreet || (p as any).savedStreet || "",
        deliveryNumber: prev.deliveryNumber || (p as any).savedNumber || "",
        deliveryCep: prev.deliveryCep || (p as any).savedCep || "",
        deliveryCity: prev.deliveryCity || (p as any).savedCity || selectedStore?.city || "",
        deliveryState: prev.deliveryState || (p as any).savedState || "",
        deliveryComplement: prev.deliveryComplement || (p as any).savedComplement || "",
      }));
      if (!neighborhood && (p as any).savedNeighborhood) {
        setNeighborhood((p as any).savedNeighborhood);
      }
    }
  }, [profileQuery.data, selectedStore?.city, neighborhood]);

  useEffect(() => {
    if (!selectedStore?.city) return;
    setForm((prev) => (
      prev.deliveryCity.trim()
        ? prev
        : { ...prev, deliveryCity: selectedStore.city }
    ));
  }, [selectedStore?.city, selectedStore?.id]);

  useEffect(() => {
    if (!paymentOptions.length) return;
    if (!paymentOptions.some((option) => option.value === paymentMethod)) {
      setPaymentMethod(paymentOptions[0].value);
    }
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;

    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      checkoutStepRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      checkoutStepRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const applySavedAddress = (address: NonNullable<typeof savedAddressesQuery.data>[number]) => {
    // Mesmo com coordenadas salvas, não reutilizamos taxa/prazo antigos.
    // Alterar os campos invalida a cotação atual e o efeito abaixo chama delivery.quote novamente.
    setForm((prev) => ({
      ...prev,
      deliveryCep: address.cep ?? "",
      deliveryStreet: address.street ?? "",
      deliveryNumber: address.number ?? "",
      deliveryComplement: address.complement ?? "",
      deliveryCity: address.city ?? selectedStore?.city ?? "",
      deliveryState: address.state ?? "",
    }));
    setNeighborhood(address.neighborhood ?? "");
    setDeliveryQuote(null);
    setDeliveryQuoteError(null);
  };

  const handleCepBlur = async () => {
    const cep = form.deliveryCep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const data = await lookupCep(cep);
      if (!data) {
        toast.error("CEP não encontrado");
        return;
      }

      setForm((prev) => ({
        ...prev,
        deliveryCep: data.cep,
        deliveryStreet: data.street || prev.deliveryStreet,
        deliveryCity: data.city || prev.deliveryCity,
        deliveryState: data.state || prev.deliveryState,
      }));
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      toast.success("Endereço preenchido automaticamente!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP agora.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleNeighborhoodBlur = async () => {
    const typedNeighborhood = neighborhood.trim();
    const city = form.deliveryCity.trim() || selectedStore?.city?.trim() || "";
    if (typedNeighborhood.length < 2 || city.length < 2) return;

    setCepLoading(true);
    try {
      const data = await lookupNeighborhoodCep({
        neighborhood: typedNeighborhood,
        city,
        state: form.deliveryState,
      });
      if (!data) {
        toast.error("NÃ£o foi possÃ­vel identificar o CEP deste bairro.");
        return;
      }

      setNeighborhood(data.neighborhood || typedNeighborhood);
      setForm((prev) => ({
        ...prev,
        deliveryCep: data.cep,
        deliveryStreet: prev.deliveryStreet || data.street,
        deliveryCity: data.city || prev.deliveryCity,
        deliveryState: data.state || prev.deliveryState,
      }));
      toast.success("CEP identificado pelo bairro!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel identificar o CEP deste bairro agora.");
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => {
    setDeliveryQuote(null);
    setDeliveryQuoteError(null);

    if (deliveryMode !== "delivery" || !selectedStore?.id) return;

    const cep = form.deliveryCep.replace(/\D/g, "");
    const hasCompleteAddress =
      cep.length === 8 &&
      form.deliveryStreet.trim().length >= 2 &&
      form.deliveryNumber.trim().length >= 1 &&
      form.deliveryCity.trim().length >= 2 &&
      form.deliveryState.trim().length === 2;

    if (!hasCompleteAddress) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void deliveryQuoteMutation.mutateAsync({
        storeId: selectedStore.id,
        requestId: globalThis.crypto?.randomUUID?.(),
        address: {
          postalCode: cep,
          street: form.deliveryStreet.trim(),
          number: form.deliveryNumber.trim(),
          complement: form.deliveryComplement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: form.deliveryCity.trim(),
          state: form.deliveryState.trim().toUpperCase(),
        },
      }).then((quote) => {
        if (cancelled) return;
        setDeliveryQuote(quote);
        setDeliveryQuoteError(quote.available ? null : deliveryReasonMessage(quote.reason));
      }).catch((error: unknown) => {
        if (cancelled) return;
        setDeliveryQuote(null);
        setDeliveryQuoteError(error instanceof Error ? error.message : "Não foi possível calcular a entrega.");
      });
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    deliveryMode,
    selectedStore?.id,
    form.deliveryCep,
    form.deliveryStreet,
    form.deliveryNumber,
    form.deliveryComplement,
    form.deliveryCity,
    form.deliveryState,
    neighborhood,
  ]);

  const handleSwitchToAlternativeStore = (alternative: AlternativeDeliveryStoreView) => {
    const targetStore = stores.find((store) => store.id === alternative.storeId);
    if (!targetStore) {
      toast.error("Não foi possível localizar a unidade sugerida. Atualize a página e tente novamente.");
      return;
    }

    const confirmed = window.confirm(
      `A unidade ${alternative.name} atende este endereço a ${alternative.distanceKm.toFixed(1).replace(".", ",")} km. `
      + "Ao trocar de unidade, o carrinho atual será limpo porque os produtos e preços são específicos de cada loja. Deseja continuar?",
    );
    if (!confirmed) return;

    setSelectedStore(targetStore, {
      skipCartConfirmation: true,
      destinationPath: "/cardapio",
    });
    toast.success(`Unidade alterada para ${alternative.name}.`, {
      description: "Confira o cardápio desta unidade para montar o pedido.",
    });
  };

  const rawDeliveryFeeAmount = deliveryMode === "delivery" && deliveryQuote?.available
    ? deliveryQuote.deliveryFee
    : 0;
  const deliveryFeeAmount = clubFreeDelivery || couponFreeDelivery ? 0 : rawDeliveryFeeAmount;
  const clubDiscountAmount = clubDiscountPct > 0 ? ((subtotal - couponDiscount) * clubDiscountPct) / 100 : 0;
  const total = Math.max(0, subtotal - couponDiscount - pointsDiscount - clubDiscountAmount + deliveryFeeAmount);
  const checkoutTrackingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedStore?.id || items.length === 0) return;
    const key = `${selectedStore.id}:${items.map((item) => `${item.productId}x${item.quantity}`).join(",")}`;
    if (checkoutTrackingKeyRef.current === key) return;
    checkoutTrackingKeyRef.current = key;
    trackMetaEvent("InitiateCheckout", {
      value: total,
      currency: "BRL",
      content_type: "product",
      content_ids: items.map((item) => String(item.productId)),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      store_id: selectedStore.id,
      store_slug: selectedStore.slug,
      store_city: selectedStore.city,
    });

    // Um evento por produto permite medir o funil individual sem armazenar
    // dados pessoais. O funil global continua correto porque agrega sessões únicas.
    for (const productId of Array.from(new Set(items.map((item) => item.productId)))) {
      emitAnalyticsEvent({
        eventType: "CHECKOUT_STARTED",
        productId,
        metadata: { cart_item_count: items.length },
      });
    }
  }, [items, selectedStore?.city, selectedStore?.id, selectedStore?.slug, total]);

  const pointsBalance = loyaltyPointsQuery.data ?? 0;
  const maxRedeemable = Math.min(pointsBalance, Math.floor(total / 0.10)); // não pode descontar mais que o total

  const appliedPointsToRedeem = pointsApplied && pointsDiscount > 0
    ? Math.round(pointsDiscount / 0.10)
    : 0;

  const handleRedeemPoints = () => {
    const pts = parseInt(pointsToRedeem);
    if (!pts || pts < 50) { toast.error("Mínimo de 50 pontos para resgatar."); return; }
    if (pts > pointsBalance) { toast.error("Você não tem pontos suficientes."); return; }
    const effectivePts = Math.min(pts, maxRedeemable);
    if (effectivePts < 50) { toast.error("O total do pedido precisa permitir pelo menos R$ 5,00 de desconto."); return; }
    const discount = parseFloat((effectivePts * 0.10).toFixed(2));
    setPointsDiscount(discount);
    setPointsToRedeem(String(effectivePts));
    setPointsApplied(true);
    toast.success(`R$ ${discount.toFixed(2).replace(".",",")} de desconto reservado com ${effectivePts} pontos! O débito acontece ao confirmar o pedido.`);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const result = await validateCoupon.mutateAsync({
        code: couponCode,
        orderTotal: subtotal,
        storeId: selectedStore?.id,
        items: items.map((item) => ({
          productId: item.productId,
          productPrice: item.productPrice,
          quantity: item.quantity,
        })),
      });
      setCouponDiscount(result.discount);
      setCouponFreeDelivery(Boolean(result.rewardBenefit?.freeDelivery));
      setCouponApplied(true);
      toast.success(result.rewardBenefit?.freeDelivery
        ? "Cupom aplicado! A entrega será grátis."
        : `Cupom aplicado! Desconto de R$ ${result.discount.toFixed(2).replace(".", ",")}`);
    } catch (err: any) {
      toast.error(err.message ?? "Cupom inválido");
    }
  };

  useEffect(() => {
    if (pendingCouponHandled.current || subtotal <= 0 || !selectedStore?.id) return;
    const pendingCode = getPendingCoupon();
    if (!pendingCode) return;
    pendingCouponHandled.current = true;
    setCouponCode(pendingCode);

    void validateCoupon.mutateAsync({
      code: pendingCode,
      orderTotal: subtotal,
      storeId: selectedStore.id,
      items: items.map((item) => ({
        productId: item.productId,
        productPrice: item.productPrice,
        quantity: item.quantity,
      })),
    })
      .then((result) => {
        setCouponDiscount(result.discount);
        setCouponFreeDelivery(Boolean(result.rewardBenefit?.freeDelivery));
        setCouponApplied(true);
        clearPendingCoupon();
        toast.success(`Cupom ${pendingCode} aplicado automaticamente.`);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Cupom indisponível para este pedido";
        toast.warning(message);
      });
  }, [items, selectedStore?.id, subtotal]);

  const getDeliveryAddressText = () => {
    if (deliveryMode === "pickup") return "Retirada no local";
    const locality = [neighborhood.trim(), form.deliveryCity.trim(), form.deliveryState.trim().toUpperCase()]
      .filter(Boolean)
      .join(" - ");
    return [
      `${form.deliveryStreet.trim()}, ${form.deliveryNumber.trim()}`,
      form.deliveryComplement.trim(),
      locality,
      form.deliveryCep.trim(),
    ].filter(Boolean).join(", ");
  };

  const buildOrderFingerprint = () => JSON.stringify({
    storeId: selectedStore?.id ?? null,
    form,
    deliveryMode,
    deliveryAddress: getDeliveryAddressText(),
    neighborhood: neighborhood || null,
    paymentMethod,
    couponCode: couponApplied ? couponCode : null,
    pointsToRedeem: appliedPointsToRedeem >= 50 ? appliedPointsToRedeem : 0,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes ?? null,
      configuration: item.catalogSelection ?? null,
    })),
  });

  const getOrderIdempotencyKey = () => {
    if (!selectedStore?.id) throw new Error("Loja não selecionada.");
    return getCheckoutIdempotencyKey(selectedStore.id, buildOrderFingerprint());
  };

  const maybeClearIdempotencyAfterError = (error: any) => {
    if (!selectedStore?.id) return;
    const code = error?.data?.code ?? error?.shape?.data?.code;
    if (code && code !== "CONFLICT") {
      clearCheckoutIdempotencyKey(selectedStore.id);
    }
  };

  const doCreateOrder = async () => {
    if (!selectedStore?.id) {
      toast.error("Selecione uma unidade antes de finalizar o pedido.");
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        storeId: selectedStore.id,
        idempotencyKey: getOrderIdempotencyKey(),
        attribution: getStoreAttribution(selectedStore.id),
        ...form,
        serviceType: deliveryMode,
        deliveryCep: form.deliveryCep ? form.deliveryCep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") || undefined : undefined,
        deliveryAddress: getDeliveryAddressText(),
        deliveryStreet: deliveryMode === "delivery" ? form.deliveryStreet.trim() : undefined,
        deliveryNumber: deliveryMode === "delivery" ? form.deliveryNumber.trim() : undefined,
        deliveryNeighborhood: deliveryMode === "delivery" ? neighborhood.trim() || undefined : undefined,
        deliveryCity: deliveryMode === "delivery" ? form.deliveryCity.trim() || undefined : undefined,
        deliveryState: deliveryMode === "delivery" ? form.deliveryState.trim().toUpperCase() || undefined : undefined,
        deliveryComplement: deliveryMode === "delivery" ? form.deliveryComplement.trim() || undefined : undefined,
        paymentMethod,
        couponCode: couponApplied ? couponCode : undefined,
        pointsToRedeem: appliedPointsToRedeem >= 50 ? appliedPointsToRedeem : undefined,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productPrice: item.productPrice,
          quantity: Math.min(99, Math.max(1, Math.floor(item.quantity))),
          notes: item.notes,
          configuration: item.catalogSelection,
        })),
      });
      setOrderId(result.orderId);
      setSavedItems([...items]);
      clearCheckoutIdempotencyKey(selectedStore.id);
      trackMetaEvent("Purchase", {
        value: total,
        currency: "BRL",
        content_type: "product",
        content_ids: items.map((item) => String(item.productId)),
        order_id: String(result.orderId),
        store_id: selectedStore.id,
        store_slug: selectedStore.slug,
        store_city: selectedStore.city,
      });
      clearCart();

      // PIX: Asaas desabilitado temporariamente — pedido segue direto para sucesso.
      // O pagamento PIX pode ser combinado na entrega.
      if (paymentMethod === "credit_card" || paymentMethod === "debit_card") {
        try {
          toast.info("Redirecionando para o pagamento seguro...");
          let checkoutUrl: string | null | undefined;
          if (useSavedCard && selectedSavedCardId) {
            // Pay with saved card
            const session = await checkoutWithSavedCard.mutateAsync({
              orderId: result.orderId,
              paymentMethodId: selectedSavedCardId,
              origin: window.location.origin,
            });
            checkoutUrl = session.checkoutUrl;
          } else {
            // Regular Stripe Checkout (card entry)
            const session = await createCheckoutSession.mutateAsync({
              orderId: result.orderId,
              origin: window.location.origin,
            });
            checkoutUrl = session.checkoutUrl;
          }
          if (checkoutUrl) {
            window.open(checkoutUrl, "_blank");
          }
        } catch (stripeErr: any) {
          console.error("Stripe checkout error:", stripeErr);
          toast.warning("Pedido criado! Houve um problema ao abrir o pagamento online. Você pode pagar na entrega.");
        }
      }

      setOrderStep("success");
    } catch (err: any) {
      maybeClearIdempotencyAfterError(err);
      toast.error(err.message ?? "Erro ao realizar pedido");
    }
  };

  const submitOrder = async () => {
    if (!selectedStore?.id) {
      toast.error("Selecione uma unidade antes de finalizar o pedido.");
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        storeId: selectedStore.id,
        idempotencyKey: getOrderIdempotencyKey(),
        attribution: getStoreAttribution(selectedStore.id),
        ...form,
        serviceType: deliveryMode,
        deliveryCep: form.deliveryCep ? form.deliveryCep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") || undefined : undefined,
        deliveryAddress: getDeliveryAddressText(),
        deliveryStreet: deliveryMode === "delivery" ? form.deliveryStreet.trim() : undefined,
        deliveryNumber: deliveryMode === "delivery" ? form.deliveryNumber.trim() : undefined,
        deliveryNeighborhood: deliveryMode === "delivery" ? neighborhood.trim() || undefined : undefined,
        deliveryCity: deliveryMode === "delivery" ? form.deliveryCity.trim() || undefined : undefined,
        deliveryState: deliveryMode === "delivery" ? form.deliveryState.trim().toUpperCase() || undefined : undefined,
        deliveryComplement: deliveryMode === "delivery" ? form.deliveryComplement.trim() || undefined : undefined,
        paymentMethod,
        couponCode: couponApplied ? couponCode : undefined,
        pointsToRedeem: appliedPointsToRedeem >= 50 ? appliedPointsToRedeem : undefined,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productPrice: item.productPrice,
          quantity: Math.min(99, Math.max(1, Math.floor(item.quantity))),
          notes: item.notes,
          configuration: item.catalogSelection,
        })),
      });

      setOrderId(result.orderId);
      setSavedItems([...items]);
      clearCheckoutIdempotencyKey(selectedStore.id);
      trackMetaEvent("Purchase", {
        value: total,
        currency: "BRL",
        content_type: "product",
        content_ids: items.map((item) => String(item.productId)),
        order_id: String(result.orderId),
        store_id: selectedStore.id,
        store_slug: selectedStore.slug,
        store_city: selectedStore.city,
      });
      clearCart();

      if (paymentMethod === "credit_card" || paymentMethod === "debit_card") {
        try {
          toast.info("Redirecionando para o pagamento seguro...");
          let checkoutUrl: string | null | undefined;
          if (useSavedCard && selectedSavedCardId) {
            const session = await checkoutWithSavedCard.mutateAsync({
              orderId: result.orderId,
              paymentMethodId: selectedSavedCardId,
              origin: window.location.origin,
            });
            checkoutUrl = session.checkoutUrl;
          } else {
            const session = await createCheckoutSession.mutateAsync({
              orderId: result.orderId,
              origin: window.location.origin,
            });
            checkoutUrl = session.checkoutUrl;
          }
          if (checkoutUrl) {
            window.open(checkoutUrl, "_blank");
          }
        } catch (stripeErr: any) {
          console.error("Stripe checkout error:", stripeErr);
          toast.warning("Pedido criado! Houve um problema ao abrir o pagamento online. Você pode pagar na entrega.");
        }
      } else if (paymentMethod === "pix") {
        try {
          if (paymentSettings?.config.orders.pixMode === "dynamic_asaas") {
            const pix = await createPixAsaas.mutateAsync({ orderId: result.orderId });
            if (!pix.alreadyPaid) {
              setPixData({
                chargeId: pix.chargeId,
                qrCodeImage: pix.qrCodeImage,
                pixCopiaECola: pix.pixCopiaECola,
                expirationDate: pix.expirationDate,
                value: pix.value,
                autoConfirm: true,
              });
            } else {
              setPixPaid(true);
            }
          } else {
            const pix = await createManualPixCode.mutateAsync({ orderId: result.orderId });
            setPixData(pix);
          }
        } catch (pixErr: any) {
          console.error("PIX checkout error:", pixErr);
          toast.warning("Pedido criado, mas houve um problema ao preparar o PIX. Confira com a loja antes de pagar.");
        }
      }

      setOrderStep("success");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao realizar pedido");
    }
  };

  const validateStep0 = () => {
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      toast.error("Preencha nome e telefone");
      return false;
    }

    if (deliveryMode === "delivery") {
      const cep = form.deliveryCep.replace(/\D/g, "");
      if (
        cep.length !== 8 ||
        !form.deliveryStreet.trim() ||
        !form.deliveryNumber.trim() ||
        !form.deliveryCity.trim() ||
        form.deliveryState.trim().length !== 2
      ) {
        toast.error("Preencha CEP, rua, número, cidade e UF.");
        return false;
      }
      if (deliveryQuoteMutation.isPending) {
        toast.info("Aguarde o cálculo da entrega.");
        return false;
      }
      if (!deliveryQuote?.available) {
        toast.error(deliveryQuoteError || "Calcule a entrega antes de continuar.");
        return false;
      }
    }
    return true;
  };

  const completeStepAndSet = (nextStep: Step) => {
    if (nextStep > step) {
      emitAnalyticsEvent({
        eventType: "CHECKOUT_STEP_COMPLETED",
        metadata: {
          completed_step: step,
          next_step: nextStep,
          delivery_mode: deliveryMode,
          payment_method: step >= 1 ? paymentMethod : null,
        },
      });
    }
    setStep(nextStep);
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && isPaymentSettingsLoading) {
      toast.info("Aguarde enquanto carregamos as formas de pagamento.");
      return;
    }
    if (step === 1 && paymentSettingsQuery.isError) {
      toast.error("Não foi possível carregar as formas de pagamento. Tente novamente.");
      return;
    }
    if (step === 1 && paymentOptions.length === 0) {
      toast.error("Nenhum método de pagamento está disponível no momento.");
      return;
    }
    const nextStep = Math.min(step + 1, 2) as Step;
    // Quando o cliente chega no step de pagamento (step 1), registrar carrinho abandonado
    if (nextStep === 1 && isAuthenticated && items.length > 0 && selectedStore?.id && bonattoConfig.features.automations) {
      registerAbandonedCart.mutate({
        storeId: selectedStore.id,
        customerName: form.customerName,
        customerPhone: form.customerPhone || undefined,
        items: items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: Math.min(99, Math.max(1, Math.floor(i.quantity))),
          productPrice: i.productPrice,
        })),
        total: String(total.toFixed(2)),
      });
    }
    // Se estiver no step 1 (Pagamento) e houver upsell ativo, mostrar popup antes de avançar
    if (step === 1 && !upsellDismissed && upsellOffers.length > 0 && upsellProduct) {
      setShowUpsellModal(true);
      return;
    }
    completeStepAndSet(nextStep);
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0) as Step);

  // Auth guard
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
          <LogIn className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black mb-2">Faça login para continuar</h2>
          <p className="text-muted-foreground">Você precisa estar logado para finalizar seu pedido.</p>
          <p className="text-sm text-muted-foreground mt-1">Seu carrinho será mantido após o login.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/login?returnTo=/checkout">
            <Button size="lg" className="gap-2"><LogIn className="w-4 h-4" />Entrar / Criar Conta</Button>
          </Link>
          <Link href="/cardapio">
            <Button size="lg" variant="outline">Voltar ao Cardápio</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0 && orderStep !== "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground p-8">
        <ShoppingBag className="w-16 h-16 opacity-20" />
        <p className="text-xl font-medium">Seu carrinho está vazio</p>
        <Link href="/cardapio"><Button>Ver Cardápio</Button></Link>
      </div>
    );
  }

  if (orderStep === "success") {
    return <SuccessScreen orderId={orderId} paymentMethod={paymentMethod} deliveryMode={deliveryMode} total={total} items={savedItems} pixData={pixData} pixPaid={pixPaid} />;
  }

  // Upsell / Downsell data
  const allOffers = upsellQuery.data ?? [];
  const upsellOffers = allOffers.filter((u) => u.type === "upsell");
  const downsellOffers = allOffers.filter((u) => u.type === "downsell");
  const upsellOffer = !upsellDismissed ? upsellOffers[0] : null;
  const upsellProduct = upsellOffer?.suggestedProduct ?? null;
  const downsellOffer = downsellOffers[0] ?? null;
  const downsellProduct = downsellOffer?.suggestedProduct ?? null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Store closed warning */}
      {!manualStoreOpen && !isStoreOpenWithHours(dbStoreHours) && <StoreClosedBanner storeHours={dbStoreHours} />}
      <div className="py-8">
      <div className="container max-w-3xl">
        <BonattoSectionHero eyebrow="Último passo para o sabor" title="Fechar pedido" description="Confira entrega, pagamento e benefícios. O resto deixa com a cozinha." />
        {/* Header */}
        <div
          ref={checkoutStepRef}
          tabIndex={-1}
          className="flex items-center gap-3 mb-6 mt-10 scroll-mt-24 outline-none"
        >
          {step > 0 ? (
            <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />Voltar
            </button>
          ) : (
            <Link href="/cardapio">
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />Cardápio
              </button>
            </Link>
          )}
          <h2 className="text-2xl font-black uppercase">Revise os detalhes</h2>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < step ? "bg-primary border-primary text-primary-foreground" :
                  i === step ? "border-primary text-primary" :
                  "border-muted-foreground/30"
                }`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 transition-all ${i < step ? "bg-primary" : "bg-muted-foreground/20"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Steps */}
          <div className="lg:col-span-3 space-y-4">

            {/* STEP 0: Entrega */}
            {step === 0 && (
              <>
                {/* Modo de entrega */}
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <p className="text-sm font-semibold mb-3">Como você quer receber?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "delivery", label: "Entrega", icon: <Truck className="w-5 h-5" />, desc: "40–50 min" },
                        { value: "pickup", label: "Retirar na loja", icon: <Store className="w-5 h-5" />, desc: "Pronto em 20 min" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDeliveryMode(opt.value as DeliveryMode)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            deliveryMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                          }`}
                        >
                          <div className={`mb-1 ${deliveryMode === opt.value ? "text-primary" : "text-muted-foreground"}`}>{opt.icon}</div>
                          <p className="font-semibold text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Dados do cliente */}
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <p className="text-sm font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-primary" />Seus Dados</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Nome completo *</Label>
                        <Input id="name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Seu nome" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                        <Input id="phone" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="(37) 99999-9999" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">E-mail (opcional)</Label>
                      <Input id="email" type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} placeholder="seu@email.com" />
                    </div>
                  </CardContent>
                </Card>

                {/* Endereço — só para delivery */}
                {deliveryMode === "delivery" && (
                  <Card>
                    <CardContent className="pt-5 space-y-4">
                      <p className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Endereço de Entrega</p>

                      {(savedAddressesQuery.data?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          <Label>Usar endereço salvo</Label>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {savedAddressesQuery.data?.map((address) => (
                              <button
                                key={address.id}
                                type="button"
                                onClick={() => applySavedAddress(address)}
                                disabled={!address.street || !address.number || !address.cep || !address.city || !address.state}
                                className="min-w-[190px] rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold">{address.label}</span>
                                  {address.isDefault && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{address.address}</p>
                                {!address.latitude || !address.longitude ? (
                                  <p className="mt-1 text-[10px] text-amber-700">Edite este endereço para confirmar a localização.</p>
                                ) : null}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Ao selecionar, a distância, a taxa e o prazo são calculados novamente para esta unidade.</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_90px]">
                        <div className="space-y-1.5">
                          <Label htmlFor="cep">CEP * {cepLoading && <span className="text-xs text-muted-foreground">(buscando...)</span>}</Label>
                          <Input
                            id="cep"
                            value={form.deliveryCep}
                            onChange={(e) => setForm({ ...form, deliveryCep: e.target.value })}
                            onBlur={handleCepBlur}
                            placeholder="35680-000"
                            autoComplete="postal-code"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="city">Cidade *</Label>
                          <Input
                            id="city"
                            value={form.deliveryCity}
                            onChange={(e) => setForm({ ...form, deliveryCity: e.target.value })}
                            placeholder="Itaúna"
                            autoComplete="address-level2"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="state">UF *</Label>
                          <Input
                            id="state"
                            value={form.deliveryState}
                            maxLength={2}
                            onChange={(e) => setForm({ ...form, deliveryState: e.target.value.toUpperCase() })}
                            placeholder="MG"
                            autoComplete="address-level1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_130px]">
                        <div className="space-y-1.5">
                          <Label htmlFor="street">Rua *</Label>
                          <Input
                            id="street"
                            value={form.deliveryStreet}
                            onChange={(e) => setForm({ ...form, deliveryStreet: e.target.value })}
                            placeholder="Nome da rua"
                            autoComplete="address-line1"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="number">Número *</Label>
                          <Input
                            id="number"
                            value={form.deliveryNumber}
                            onChange={(e) => setForm({ ...form, deliveryNumber: e.target.value })}
                            placeholder="123"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="neighborhood">Bairro</Label>
                          <Input
                            id="neighborhood"
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            onBlur={handleNeighborhoodBlur}
                            placeholder="Centro"
                            autoComplete="address-level3"
                          />
                          <p className="text-[11px] text-muted-foreground">O bairro faz parte do endereço, mas não define taxa ou cobertura.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="complement">Complemento</Label>
                          <Input
                            id="complement"
                            value={form.deliveryComplement}
                            onChange={(e) => setForm({ ...form, deliveryComplement: e.target.value })}
                            placeholder="Apto, bloco, referência..."
                            autoComplete="address-line2"
                          />
                        </div>
                      </div>

                      <div aria-live="polite">
                        {deliveryQuoteMutation.isPending ? (
                          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3.5 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <div>
                              <p className="font-medium">Calculando entrega...</p>
                              <p className="text-xs text-muted-foreground">Estamos localizando o endereço e calculando a rota até esta unidade.</p>
                            </div>
                          </div>
                        ) : deliveryQuote?.available ? (
                          <div className="rounded-xl border border-green-200 bg-green-50 p-3.5">
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-[11px] text-green-700/70">Entrega</p>
                                <p className="mt-1 text-sm font-semibold text-green-800">
                                  {deliveryFeeAmount === 0 ? "Grátis" : `R$ ${deliveryFeeAmount.toFixed(2).replace(".", ",")}`}
                                </p>
                              </div>
                              <div className="border-x border-green-200">
                                <p className="text-[11px] text-green-700/70">Distância</p>
                                <p className="mt-1 text-sm font-semibold text-green-800">{deliveryQuote.distanceKm.toFixed(1).replace(".", ",")} km</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-green-700/70">Previsão</p>
                                <p className="mt-1 text-sm font-semibold text-green-800">~{deliveryQuote.estimatedMinutes} min</p>
                              </div>
                            </div>
                          </div>
                        ) : deliveryQuoteError ? (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                              <p className="text-sm font-medium text-red-800">{deliveryQuoteError}</p>
                              {(deliveryQuote?.reason === "OUTSIDE_DELIVERY_AREA" || deliveryQuote?.reason === "NO_COVERAGE_ZONE") && (
                                <button
                                  type="button"
                                  className="mt-2 text-xs font-semibold text-red-800 underline underline-offset-2"
                                  onClick={() => setDeliveryMode("pickup")}
                                >
                                  Retirar na loja
                                </button>
                              )}
                            </div>

                            {(deliveryQuote?.alternatives?.length ?? 0) > 0 && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                                <div className="flex items-start gap-2">
                                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                                  <div>
                                    <p className="text-sm font-semibold text-amber-950">
                                      Outra unidade entrega neste endereço
                                    </p>
                                    <p className="mt-0.5 text-xs text-amber-800">
                                      Encontramos {deliveryQuote?.alternatives?.length === 1 ? "uma unidade próxima" : "outras unidades"} dentro da área de entrega.
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 space-y-2">
                                  {deliveryQuote?.alternatives?.map((alternative) => (
                                    <div
                                      key={alternative.storeId}
                                      className="rounded-lg border border-amber-200 bg-white p-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-foreground">{alternative.name}</p>
                                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                            <span>{alternative.distanceKm.toFixed(1).replace(".", ",")} km</span>
                                            <span>
                                              {alternative.deliveryFee === 0
                                                ? "Entrega grátis"
                                                : `R$ ${alternative.deliveryFee.toFixed(2).replace(".", ",")}`}
                                            </span>
                                            <span>~{alternative.estimatedMinutes} min</span>
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-8 shrink-0 gap-1.5"
                                          onClick={() => handleSwitchToAlternativeStore(alternative)}
                                        >
                                          Trocar
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Preencha CEP, rua e número para calcular automaticamente taxa e prazo.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Observações */}
                <Card>
                  <CardContent className="pt-5 space-y-2">
                    <Label htmlFor="notes">Observações do pedido</Label>
                    <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Alguma observação especial?" rows={2} />
                  </CardContent>
                </Card>
              </>
            )}

            {/* STEP 1: Pagamento */}
            {step === 1 && (
              <>
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <p className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />Forma de Pagamento</p>
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      aria-live="polite"
                      aria-busy={isPaymentSettingsLoading}
                    >
                      {isPaymentSettingsLoading
                        ? Array.from({ length: 2 }).map((_, index) => (
                            <div key={index} className="h-[106px] animate-pulse rounded-xl border-2 border-border bg-muted/50" />
                          ))
                        : paymentOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPaymentMethod(opt.value as PaymentMethod)}
                              aria-pressed={paymentMethod === opt.value}
                              className={`p-4 rounded-xl border-2 text-left transition-all ${
                                paymentMethod === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                              }`}
                            >
                              <div className={`mb-1 ${paymentMethod === opt.value ? "text-primary" : "text-muted-foreground"}`}>{opt.icon}</div>
                              <p className="font-semibold text-sm">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </button>
                          ))}
                    </div>
                    {paymentSettingsQuery.isError && !isPaymentSettingsLoading && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        <p>Não foi possível carregar as formas de pagamento.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 bg-white"
                          onClick={() => void paymentSettingsQuery.refetch()}
                        >
                          Tentar novamente
                        </Button>
                      </div>
                    )}
                    {!isPaymentSettingsLoading && !paymentSettingsQuery.isError && paymentOptions.length === 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Nenhum método de pagamento está disponível agora. Tente novamente em instantes ou fale com a loja.
                      </div>
                    )}

                    {/* Cartões salvos — mostrar quando credit_card ou debit_card selecionado */}
                    {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && savedCardsQuery.data && savedCardsQuery.data.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cartões Salvos</p>
                          <button
                            type="button"
                            className="text-xs text-primary underline"
                            onClick={() => { setUseSavedCard(!useSavedCard); setSelectedSavedCardId(null); }}
                          >
                            {useSavedCard ? "Usar novo cartão" : "Usar cartão salvo"}
                          </button>
                        </div>
                        {useSavedCard && (
                          <div className="space-y-2">
                            {savedCardsQuery.data.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => setSelectedSavedCardId(card.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                                  selectedSavedCardId === card.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                                }`}
                              >
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedSavedCardId === card.id ? "border-primary" : "border-muted-foreground"
                                }`}>
                                  {selectedSavedCardId === card.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                                <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} •••• {card.last4}</p>
                                  <p className="text-xs text-muted-foreground">Expira {String(card.expMonth).padStart(2,"0")}/{String(card.expYear).slice(-2)}</p>
                                </div>
                                {selectedSavedCardId === card.id && (
                                  <Badge variant="default" className="text-xs flex-shrink-0">Selecionado</Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === "pix" && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                        {paymentSettings?.config.orders.pixMode === "dynamic_asaas"
                          ? "Após confirmar, vamos gerar um QR Code PIX com confirmação automática."
                          : "Após confirmar, vamos gerar o PIX da loja com QR Code e código copia e cola."}
                        {paymentSettings?.config.pix.instructions ? ` ${paymentSettings.config.pix.instructions}` : ""}
                      </div>
                    )}

                    {paymentMethod === "cash" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="changeFor">Troco para (opcional)</Label>
                        <Input
                          id="changeFor"
                          value={form.changeFor}
                          onChange={(e) => setForm({ ...form, changeFor: e.target.value })}
                          placeholder="Ex: R$ 50,00"
                        />
                        <p className="text-xs text-muted-foreground">Deixe em branco se não precisar de troco.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cupom */}
                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><Tag className="w-4 h-4 text-primary" />Cupom de Desconto</p>
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="CÓDIGO"
                        className="h-9 text-sm uppercase"
                        disabled={couponApplied}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={handleApplyCoupon} disabled={couponApplied || validateCoupon.isPending} className="shrink-0">
                        {validateCoupon.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : couponApplied ? "✓ Aplicado" : "Aplicar"}
                      </Button>
                    </div>
                    {couponDiscount > 0 && (
                      <p className="text-sm text-green-600 font-medium">Desconto de R$ {couponDiscount.toFixed(2).replace(".", ",")} aplicado!</p>
                    )}
                    {couponFreeDelivery && (
                      <p className="text-sm font-medium text-green-600">Entrega grátis aplicada por esta recompensa.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Resgate de Pontos */}
                {isAuthenticated && pointsBalance >= 50 && (
                  <Card>
                    <CardContent className="pt-5 space-y-3">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        Usar Pontos Bonatto
                        <span className="ml-auto text-xs font-normal text-muted-foreground bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full">
                          {pointsBalance.toLocaleString("pt-BR")} pts disponíveis
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">Cada 10 pontos = R$ 1,00 de desconto. Mínimo: 50 pontos (R$ 5,00).</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={50}
                          max={maxRedeemable}
                          step={10}
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(e.target.value)}
                          placeholder={`Mínimo 50, máximo ${maxRedeemable}`}
                          className="flex-1 h-9 px-3 border border-input rounded-md text-sm bg-background"
                          disabled={pointsApplied}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleRedeemPoints}
                          disabled={pointsApplied || !pointsToRedeem} className="shrink-0">
                          {pointsApplied ? "✓ Aplicado" : "Resgatar"}
                        </Button>
                      </div>
                      {pointsDiscount > 0 && (
                        <p className="text-sm text-green-600 font-medium">Desconto de R$ {pointsDiscount.toFixed(2).replace(".",",")} aplicado com pontos!</p>
                      )}
                    </CardContent>
                  </Card>
                )}

              </>
            )}

            {/* STEP 2: Confirmar */}
            {step === 2 && (
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <p className="text-sm font-semibold">Resumo do Pedido</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.productId} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.productName}</span>
                        <span className="font-medium shrink-0 ml-2">R$ {(parseFloat(item.productPrice) * item.quantity).toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R$ {subtotal.toFixed(2).replace(".", ",")}</span></div>
                    {couponDiscount > 0 && <div className="flex justify-between text-green-600"><span>Desconto cupom</span><span>- R$ {couponDiscount.toFixed(2).replace(".", ",")}</span></div>}
                    {pointsDiscount > 0 && <div className="flex justify-between text-yellow-600"><span>Desconto pontos</span><span>- R$ {pointsDiscount.toFixed(2).replace(".", ",")}</span></div>}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entrega</span>
                      <span className={deliveryFeeAmount === 0 ? "text-green-600" : ""}>
                        {deliveryMode === "pickup" ? "Retirada" : deliveryFeeAmount === 0 ? "Grátis" : `R$ ${deliveryFeeAmount.toFixed(2).replace(".", ",")}`}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-black text-lg"><span>Total</span><span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span></div>

                  {/* Aviso de pontos a ganhar */}
                  {isAuthenticated && (
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-700">
                      <Star className="w-4 h-4 shrink-0 text-yellow-500" />
                      <span>Você vai ganhar <strong>+{Math.floor(total)} pontos</strong> após a entrega deste pedido!</span>
                    </div>
                  )}

                  {minOrderValue > 0 && subtotal < minOrderValue && (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                      <span className="text-base">⚠️</span>
                      <span>Pedido mínimo: <strong>R$ {minOrderValue.toFixed(2).replace('.', ',')}</strong>. Faltam <strong>R$ {(minOrderValue - subtotal).toFixed(2).replace('.', ',')}</strong>.</span>
                    </div>
                  )}

                  <Separator />
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p><strong className="text-foreground">Nome:</strong> {form.customerName}</p>
                    <p><strong className="text-foreground">Telefone:</strong> {form.customerPhone}</p>
                    {deliveryMode === "delivery" ? (
                      <p><strong className="text-foreground">Endereço:</strong> {form.deliveryAddress}{form.deliveryComplement ? `, ${form.deliveryComplement}` : ""} — {form.deliveryCity}</p>
                    ) : (
                      <p><strong className="text-foreground">Retirada:</strong> na loja (pronto em ~20 min)</p>
                    )}
                    <p><strong className="text-foreground">Pagamento:</strong> {
                      { pix: "PIX", credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito", cash: "Dinheiro" }[paymentMethod]
                    }{paymentMethod === "cash" && form.changeFor ? ` (troco para ${form.changeFor})` : ""}</p>
                  </div>

                  <Button
                    className="w-full h-12 text-base font-bold"
                    onClick={submitOrder}
                    disabled={createOrder.isPending}
                  >
                    {createOrder.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" />Confirmar Pedido</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Navigation buttons */}
            {step < 2 && (
              <Button
                className="w-full h-12 text-base font-bold gap-2"
                onClick={handleNext}
                disabled={step === 1 && (isPaymentSettingsLoading || paymentSettingsQuery.isError || paymentOptions.length === 0)}
              >
                {step === 1 && isPaymentSettingsLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Carregando pagamentos...</>
                ) : (
                  <>Continuar <ChevronRight className="w-4 h-4" /></>
                )}
              </Button>
            )}
          </div>

          {/* RIGHT: Mini summary sticky */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <p className="font-semibold text-sm">Seu pedido</p>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div key={item.productId} className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.quantity}x {item.productName}</span>
                        <span className="shrink-0 ml-2">R$ {(parseFloat(item.productPrice) * item.quantity).toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))}
                  </div>
                  {isClubActive && (
                    <div className="rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 py-2">
                      <p className="text-xs font-semibold text-[#7d0f14]">
                        {clubConfig?.checkoutTitle ?? "Benefícios do seu clube"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {clubConfig?.checkoutSubtitle ?? "Seu plano ativo entra automaticamente no total deste pedido."}
                      </p>
                    </div>
                  )}
                  <Separator />
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Desconto cupom</span><span>- R$ {couponDiscount.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  {clubDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs text-[#7d0f14]">
                      <span>{clubConfig?.checkoutDiscountLabel ?? "Desconto do clube"} ({clubDiscountPct}%)</span>
                      <span>- R$ {clubDiscountAmount.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  {clubFreeDelivery && deliveryMode === "delivery" && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>{clubConfig?.checkoutDeliveryLabel ?? "Entrega grátis do clube"}</span>
                      <span>R$ 0,00</span>
                    </div>
                  )}
                  {deliveryFeeAmount > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Taxa de entrega</span>
                      <span>R$ {deliveryFeeAmount.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  {clubFreePizzaAvailable && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-500 bg-orange-50 dark:bg-orange-950/30 rounded-lg px-2 py-1.5">
                      <span className="font-medium">{clubConfig?.checkoutFreePizzaLabel ?? "Pizza grátis disponível para o próximo pedido."}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-base">
                    <span>Total</span>
                    <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {deliveryMode === "delivery" ? "Entrega: 40–50 min" : "Retirada: ~20 min"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Upsell popup modal - aparece ao clicar em Continuar no step 1 */}
      {upsellOffer && upsellProduct && (() => {
        const basePrice = parseFloat(upsellProduct.price);
        const discount = upsellOffer.discountPercent ?? 0;
        const finalPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
        const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
        const handleAccept = () => {
          window.dispatchEvent(new CustomEvent("cart:addItem", {
            detail: {
              productId: upsellProduct.id,
              productName: upsellProduct.name,
              productPrice: finalPrice.toFixed(2),
              imageUrl: upsellProduct.imageUrl ?? undefined,
              quantity: 1,
            }
          }));
          setUpsellDismissed(true);
          setShowUpsellModal(false);
          toast.success(`${upsellProduct.name} adicionado ao pedido!`);
          completeStepAndSet(2);
        };
        const handleDecline = () => {
          setUpsellDismissed(true);
          setShowUpsellModal(false);
          if (downsellOffer && downsellProduct) {
            setShowDownsellModal(true);
          } else {
            completeStepAndSet(2);
          }
        };
        return (
          <Dialog open={showUpsellModal} onOpenChange={(open) => { if (!open) handleDecline(); }}>
            <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
              {/* Header vermelho com urgência */}
              <div className="bg-primary px-5 pt-5 pb-4 text-white relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-xs font-black uppercase tracking-widest text-[#f9d0d0]">Antes de continuar</span>
                </div>
                <DialogTitle className="text-2xl font-black text-white leading-tight">{upsellOffer.title}</DialogTitle>
                <p className="text-sm text-[#fce8e8] mt-1 font-medium">
                  Você pode adicionar <strong className="text-white">{upsellProduct.name}</strong> ao seu pedido.
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Produto com preço */}
                <div className="flex gap-4 items-center bg-gray-50 rounded-2xl p-4">
                  {upsellProduct.imageUrl ? (
                    <img src={upsellProduct.imageUrl} alt={upsellProduct.name} className="w-20 h-20 rounded-xl object-cover shrink-0 shadow" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <CartIcon className="w-9 h-9 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-black text-xl leading-tight">{upsellProduct.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {discount > 0 && <span className="text-base text-muted-foreground line-through">{fmt(basePrice)}</span>}
                      <span className="font-black text-2xl text-primary">{fmt(finalPrice)}</span>
                      {discount > 0 && <Badge className="bg-green-100 text-green-700 border-0 font-bold text-xs px-2">-{discount}%</Badge>}
                    </div>
                  </div>
                </div>

                {/* Gatilho de urgência */}
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5 border border-amber-200">
                  <span className="text-base">⏳</span>
                  <span className="font-semibold">Disponível enquanto você estiver nesta etapa.</span>
                </div>

                {/* Prova social */}
                <p className="text-xs text-center text-muted-foreground">
                  Revise o item e o preço antes de adicionar.
                </p>

                {/* Botões */}
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    className="w-full h-12 gap-2 font-black text-base bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30"
                    onClick={handleAccept}
                  >
                    Adicionar ao pedido
                  </Button>
                  <button
                    onClick={handleDecline}
                    className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    {discount > 0
                      ? `"Não, prefiro perder ${fmt(basePrice - finalPrice)}"`
                      : "Continuar sem adicionar"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Downsell popup modal - aparece após recusar o upsell */}
      {downsellOffer && downsellProduct && (() => {
        const basePrice = parseFloat(downsellProduct.price);
        const discount = downsellOffer.discountPercent ?? 0;
        const finalPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
        const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
        return (
          <Dialog open={showDownsellModal} onOpenChange={(open) => { if (!open) { setShowDownsellModal(false); completeStepAndSet(2); } }}>
            <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
              {/* Header laranja com urgência */}
              <div className="bg-orange-500 px-5 pt-5 pb-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-orange-200" />
                  <span className="text-xs font-black uppercase tracking-widest text-orange-100">Outra opção</span>
                </div>
                <DialogTitle className="text-2xl font-black text-white leading-tight">{downsellOffer.title}</DialogTitle>
                <p className="text-sm text-orange-100 mt-1 font-medium">
                  Se preferir, você pode adicionar esta opção ao pedido.
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Produto com preço */}
                <div className="flex gap-4 items-center bg-gray-50 rounded-2xl p-4">
                  {downsellProduct.imageUrl ? (
                    <img src={downsellProduct.imageUrl} alt={downsellProduct.name} className="w-20 h-20 rounded-xl object-cover shrink-0 shadow" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <CartIcon className="w-9 h-9 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-black text-xl leading-tight">{downsellProduct.name}</p>
                    {downsellOffer.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{downsellOffer.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {discount > 0 && <span className="text-base text-muted-foreground line-through">{fmt(basePrice)}</span>}
                      <span className="font-black text-2xl text-primary">{fmt(finalPrice)}</span>
                      {discount > 0 && <Badge className="bg-green-100 text-green-700 border-0 font-bold text-xs px-2">-{discount}%</Badge>}
                    </div>
                  </div>
                </div>

                {/* Gatilho de escassez */}
                <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-xl px-4 py-2.5 border border-orange-200">
                  <span className="text-base">🔥</span>
                  <span className="font-semibold">Essa oferta desaparece quando você fechar essa tela</span>
                </div>

                {/* Botões */}
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    className="w-full h-12 gap-2 font-black text-base bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("cart:addItem", {
                        detail: {
                          productId: downsellProduct.id,
                          productName: downsellProduct.name,
                          productPrice: finalPrice.toFixed(2),
                          imageUrl: downsellProduct.imageUrl ?? undefined,
                          quantity: 1,
                        }
                      }));
                      setShowDownsellModal(false);
                      toast.success(`${downsellProduct.name} adicionado ao pedido!`);
                      completeStepAndSet(2);
                    }}
                  >
                    <CartIcon className="w-4 h-4" />
                    SIM, QUERO ESSA OFERTA!
                  </Button>
                  <button
                    className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => { setShowDownsellModal(false); completeStepAndSet(2); }}
                  >
                    {discount > 0
                      ? `"Não, prefiro perder ${fmt(basePrice - finalPrice)}"`
                      : '"Não, obrigado"'}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

// ─── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ orderId, paymentMethod, deliveryMode, total, items: orderItems, pixData, pixPaid }: {
  orderId: number | null;
  paymentMethod: PaymentMethod;
  deliveryMode: DeliveryMode;
  total: number;
  items?: Array<{ productName: string; quantity: number; productPrice: string }>;
  pixData?: PixCheckoutData | null;
  pixPaid?: boolean;
}) {
  const [pixCopied, setPixCopied] = useState(false);
  const handleCopyPix = () => {
    if (!pixData?.pixCopiaECola) return;
    navigator.clipboard.writeText(pixData.pixCopiaECola).then(() => {
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    });
  };
  const [showItems, setShowItems] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const WHATSAPP_NUMBER = "5537999999999";

  const handleRating = (star: number) => {
    setRating(star);
    setRatingDone(true);
    toast.success("Obrigado pela avaliação! 🍕");
  };

  // Estimated delivery: 40 min for delivery, 20 for pickup
  const estimatedMin = deliveryMode === "pickup" ? 20 : 40;

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* Hero banner — dark red gradient */}
      <div className="relative bg-[#191412] pt-14 pb-24 px-6 text-center overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.07),transparent_60%)]" />

        {/* Animated check */}
        <div
          className={`relative inline-flex items-center justify-center mb-5 transition-all duration-700 ${
            visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[#6E0D12]" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <h1
          className={`text-3xl font-black text-white mb-1.5 transition-all duration-700 delay-100 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Pedido Confirmado!
        </h1>
        <p
          className={`text-white/70 text-sm transition-all duration-700 delay-150 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Pedido <span className="font-bold text-white">#{orderId}</span> recebido com sucesso
        </p>
      </div>

      {/* Card flutuante sobre o banner */}
      <div className="container max-w-md mx-auto px-4 -mt-12 space-y-4 pb-12">

        {/* Delivery info card */}
        <div
          className={`bg-white rounded-2xl shadow-md border border-gray-100 p-5 transition-all duration-700 delay-200 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Tempo estimado</p>
              <p className="text-4xl font-black text-[#6E0D12] tabular-nums">{estimatedMin} min</p>
              <p className="text-xs text-gray-400 mt-1">
                {deliveryMode === "pickup" ? "🏪 Retirada na loja" : "🛵 Entrega no endereço"}
              </p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-[#fdf2f2] flex items-center justify-center text-3xl">
              {deliveryMode === "pickup" ? "🏪" : "🛵"}
            </div>
          </div>

          {/* Status steps */}
          <div className="mt-5 flex items-center gap-0">
            {[
              { label: "Recebido", done: true },
              { label: "Preparando", done: false },
              { label: "A caminho", done: false },
              { label: "Entregue", done: false },
            ].map((s, i, arr) => (
              <div key={s.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-full border-2 ${
                    s.done ? "bg-[#6E0D12] border-[#6E0D12]" : "bg-white border-gray-300"
                  }`} />
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    s.done ? "text-[#6E0D12]" : "text-gray-400"
                  }`}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-3.5 ${
                    s.done ? "bg-[#6E0D12]" : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* QR Code PIX Asaas */}
        {pixData && (
          <div
            className={`bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-all duration-700 delay-[250ms] ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {pixPaid ? (
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#fce8e8] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-[#6E0D12]" />
                </div>
                <p className="font-black text-gray-900 text-lg">PIX Confirmado!</p>
                <p className="text-sm text-gray-400 mt-1">Pagamento recebido com sucesso.</p>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <QrCode className="w-5 h-5 text-[#6E0D12]" />
                  <p className="font-bold text-gray-900">Pague com PIX</p>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    {pixData.autoConfirm ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {pixData.autoConfirm ? "Aguardando pagamento" : "Pagamento manual"}
                  </span>
                </div>
                {pixData.qrCodeImage && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={pixData.qrCodeImage.startsWith("data:") || pixData.qrCodeImage.startsWith("http")
                        ? pixData.qrCodeImage
                        : `data:image/png;base64,${pixData.qrCodeImage}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-xl border border-gray-100"
                    />
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-gray-400 mb-1 font-medium">PIX Copia e Cola</p>
                  <p className="text-xs text-gray-700 break-all font-mono leading-relaxed line-clamp-3">{pixData.pixCopiaECola}</p>
                </div>
                <button
                  onClick={handleCopyPix}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    pixCopied
                      ? "bg-[#fce8e8] text-[#6E0D12]"
                      : "bg-[#6E0D12] text-white hover:bg-[#5a0a0f]"
                  }`}
                >
                  {pixCopied ? "✓ Copiado!" : "Copiar código PIX"}
                </button>
                {pixData.instructions ? (
                  <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {pixData.instructions}
                  </div>
                ) : null}
                {pixData.expirationDate ? (
                  <p className="text-xs text-center text-gray-400 mt-2">
                    Válido até {new Date(pixData.expirationDate).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : (
                  <p className="text-xs text-center text-gray-400 mt-2">
                    Após pagar, aguarde a confirmação da loja se o PIX estiver em modo manual.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resumo do pedido */}
        {orderItems && orderItems.length > 0 && (
          <div
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-700 delay-300 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setShowItems((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#6E0D12]" />
                Resumo do pedido
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#6E0D12] font-black">R$ {total.toFixed(2).replace(".", ",")}</span>
                {showItems ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {showItems && (
              <div className="px-5 pb-4 space-y-2 border-t border-gray-100">
                {orderItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-600 pt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#fce8e8] text-[#6E0D12] text-xs font-bold flex items-center justify-center flex-shrink-0">{item.quantity}</span>
                      {item.productName}
                    </span>
                    <span className="font-medium text-gray-800">R$ {(parseFloat(item.productPrice) * item.quantity).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-black text-gray-900">
                  <span>Total</span>
                  <span className="text-[#6E0D12]">R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Avaliação */}
        <div
          className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center transition-all duration-700 delay-[400ms] ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {!ratingDone ? (
            <>
              <p className="font-semibold text-gray-800 mb-0.5">Como foi sua experiência?</p>
              <p className="text-xs text-gray-400 mb-4">Sua opinião nos ajuda a melhorar</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setRatingHover(star)}
                    onMouseLeave={() => setRatingHover(0)}
                    onClick={() => handleRating(star)}
                    className="transition-transform hover:scale-125"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= (ratingHover || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-200"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">{'⭐'.repeat(rating)}</p>
              <p className="font-semibold text-gray-800">Obrigado pela avaliação!</p>
              <p className="text-xs text-gray-400">Seu feedback é muito importante para nós.</p>
            </div>
          )}
        </div>

        {/* Botões de ação */}
        <div
          className={`space-y-3 transition-all duration-700 delay-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Fiz o pedido %23${orderId} pelo site Bonatto Pizza. 🍕`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold rounded-2xl h-14 transition-colors text-base shadow-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Acompanhar pelo WhatsApp
          </a>
          <div className="flex gap-3">
            <Link href="/minha-conta" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold rounded-2xl h-12 transition-colors text-sm">
                Meus Pedidos
              </button>
            </Link>
            <Link href="/cardapio" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 bg-[#6E0D12] hover:bg-[#5a0a0f] text-white font-semibold rounded-2xl h-12 transition-colors text-sm">
                Novo Pedido 🍕
              </button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
