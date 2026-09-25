import { SavedCards } from "@/components/SavedCards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { loadMagnificAvatarPresets, type MagnificAvatarPreset } from "@/lib/magnific-assets";
import { trpc } from "@/lib/trpc";
import { uploadImageFile } from "@/lib/imageUpload";
import { lookupCep } from "@/lib/cep";
import {
  Bell, BellOff, BellRing, ChevronDown, ChevronUp, Clock, CreditCard, Gift, Heart, Home, LogIn,
  Loader2, MapPin, Package, Plus, RotateCcw, Share2, ShoppingBag, Smartphone, Star, Tag, Ticket, Trash2,
  TrendingUp, Trophy, User, Zap, Crown, Truck, Pizza, CheckCircle, XCircle, QrCode, Receipt,
  ShoppingCart, AlertCircle, Archive, CheckCheck, MonitorSmartphone, LogOut, ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { ClientAlertsBanner } from "@/components/ClientAlertsBanner";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { BonattoSectionHero } from "@/components/consumer/BonattoSectionHero";
import { SocialConnections } from "@/components/SocialConnections";
import { RewardsCatalog } from "@/features/rewards/RewardsCatalog";

const LOGO_URL = "/brand/bonatto-logo-driver.jpg";

const STATUS_LABELS: Record<string, { label: string; color: string; step: number }> = {
  pending:          { label: "Aguardando",      color: "bg-yellow-100 text-yellow-800",  step: 0 },
  confirmed:        { label: "Confirmado",       color: "bg-blue-100 text-blue-800",      step: 1 },
  preparing:        { label: "Preparando",       color: "bg-orange-100 text-orange-800",  step: 2 },
  out_for_delivery: { label: "Saiu p/ Entrega",  color: "bg-purple-100 text-purple-800",  step: 3 },
  delivered:        { label: "Entregue",         color: "bg-green-100 text-green-800",    step: 4 },
  cancelled:        { label: "Cancelado",        color: "bg-[#fce8e8] text-[#450709]",        step: -1 },
};

const STATUS_STEPS = ["Aguardando", "Confirmado", "Preparando", "Em Rota", "Entregue"];

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Cartão de Crédito",
  debit_card:  "Cartão de Débito",
  pix:         "PIX",
  cash:        "Dinheiro",
};

const ACCOUNT_TABS = [
  { value: "pedidos", label: "Pedidos", icon: Package },
  { value: "fidelidade", label: "Pontos", icon: Trophy },
  { value: "recompensas", label: "Recompensas", icon: Gift },
  { value: "enderecos", label: "Endereços", icon: MapPin },
  { value: "notificacoes", label: "Avisos", icon: Bell },
  { value: "cupons", label: "Cupons", icon: Tag },
  { value: "promocoes", label: "Promoções", icon: Gift },
  { value: "sorteios", label: "Sorteios", icon: Ticket },
  { value: "perfil", label: "Perfil", icon: User },
  { value: "clube", label: "Clube", icon: Crown },
  { value: "pagamentos", label: "Pagamentos", icon: Receipt },
  { value: "cartoes", label: "Cartões", icon: CreditCard },
  { value: "carrinhos", label: "Salvos", icon: ShoppingCart },
] as const;

type AccountTabValue = (typeof ACCOUNT_TABS)[number]["value"];

//  Status Progress Bar 
function StatusProgressBar({ status }: { status: string }) {
  const info = STATUS_LABELS[status];
  if (!info || info.step < 0) return null;
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1.5">
        {STATUS_STEPS.map((step, i) => (
          <div key={step} className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i <= info.step ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-muted text-muted-foreground"
            }`}>
              {i < info.step ? "" : i === info.step ? "" : ""}
            </div>
            <span className={`text-[9px] text-center leading-tight hidden sm:block ${i <= info.step ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${(info.step / 4) * 100}%` }}
        />
      </div>
    </div>
  );
}

function OrderReviewSection({ orderId }: { orderId: number }) {
  const utils = trpc.useUtils();
  const review = trpc.ratings.orderReviewByOrder.useQuery({ orderId });
  const offer = trpc.rewards.reviewOffer.useQuery({ orderId });
  const order = trpc.orders.byId.useQuery({ id: orderId }, { enabled: !review.data });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [itemRatings, setItemRatings] = useState<Record<number, number>>({});

  const submit = trpc.ratings.submitOrderReview.useMutation({
    onSuccess: async (result) => {
      if (result.reward?.awarded && result.reward.points > 0) {
        toast.success(`Avaliação enviada! +${result.reward.points} pontos foram adicionados ao seu saldo.`);
      } else {
        toast.success("Avaliação do pedido enviada. Obrigado!");
      }
      await Promise.all([
        review.refetch(),
        offer.refetch(),
        utils.loyalty.points.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (review.isLoading) {
    return <div className="mt-3 border-t pt-3"><Skeleton className="h-16 w-full" /></div>;
  }

  if (review.data) {
    return (
      <div className="mt-3 border-t pt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sua experiência</p>
        <div className="flex gap-1">
          {[1,2,3,4,5].map((star) => (
            <Star key={star} className={`h-5 w-5 ${star <= review.data!.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          ))}
        </div>
        {review.data.comment && <p className="mt-1 text-sm text-muted-foreground">{review.data.comment}</p>}
        {review.data.reward?.alreadyAwarded && review.data.reward.awardedPoints > 0 && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100">
                <Gift className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">+{review.data.reward.awardedPoints} pontos recebidos</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  Cashback de {review.data.reward.cashbackPercent}% creditado automaticamente pela sua avaliação deste pedido.
                </p>
                {review.data.reward.externalReviewEnabled && review.data.reward.externalReviewUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100"
                    onClick={() => window.open(review.data!.reward!.externalReviewUrl, "_blank", "noopener,noreferrer")}
                  >
                    {review.data.reward.externalReviewLabel}
                  </Button>
                )}
                <p className="mt-2 text-[11px] leading-4 text-emerald-700">
                  O link externo é opcional e não altera os pontos já recebidos.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const items = order.data?.items ?? [];
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {offer.data?.enabled && offer.data.open && offer.data.estimatedPoints > 0 && (
        <div className="rounded-2xl border border-[#ead3cd] bg-[#fff8f5] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7e6e1] text-[#7d0f14]">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#3b1618]">
                Avalie e receba {offer.data.estimatedPoints} pontos
              </p>
              <p className="mt-1 text-xs leading-5 text-[#765f5b]">
                Este pedido gera {offer.data.cashbackPercent}% de cashback convertido em pontos automaticamente após o envio da avaliação.
              </p>
              {offer.data.expiresAt && (
                <p className="mt-2 text-[11px] font-semibold text-[#7d0f14]">
                  Disponível até {new Date(offer.data.expiresAt).toLocaleDateString("pt-BR")}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {offer.data?.enabled
        && offer.data.open
        && offer.data.campaignMode === "google_request"
        && offer.data.externalReviewEnabled
        && offer.data.externalReviewUrl && (
          <div className="rounded-2xl border border-[#ead3cd] bg-[#fff8f5] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7e6e1] text-[#7d0f14]">
                <Star className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#3b1618]">Avalie sua experiência no Google</p>
                <p className="mt-1 text-xs leading-5 text-[#765f5b]">
                  Sua avaliação é voluntária e ajuda outras pessoas a conhecerem a loja.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.open(offer.data!.externalReviewUrl, "_blank", "noopener,noreferrer")}
                >
                  {offer.data.externalReviewLabel || "Avaliar no Google"}
                </Button>
              </div>
            </div>
          </div>
        )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como foi seu pedido?</p>
        <div className="mt-2 flex gap-1">
          {[1,2,3,4,5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} estrelas`}>
              <Star className={`h-7 w-7 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Avalie os itens (opcional)</p>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
              <span className="min-w-0 truncate text-sm font-medium">{item.productName}</span>
              <div className="flex shrink-0 gap-0.5">
                {[1,2,3,4,5].map((star) => (
                  <button key={star} type="button" onClick={() => setItemRatings((current) => ({ ...current, [item.id]: star }))}>
                    <Star className={`h-5 w-5 ${star <= (itemRatings[item.id] ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1200} placeholder="Conte como foi sua experiência (opcional)" />
      <Button
        className="w-full"
        disabled={rating === 0 || submit.isPending}
        onClick={() => submit.mutate({
          orderId,
          rating,
          comment: comment.trim() || undefined,
          items: Object.entries(itemRatings)
            .filter(([, value]) => value > 0)
            .map(([orderItemId, value]) => ({ orderItemId: Number(orderItemId), rating: value })),
        })}
      >
        {submit.isPending ? "Enviando..." : "Enviar avaliação do pedido"}
      </Button>
    </div>
  );
}

//  Delivery Rating Section 
function DeliveryRatingSection({ orderId }: { orderId: number }) {
  const { data: existing, isLoading, refetch } = trpc.ratings.getByOrder.useQuery({ orderId });
  const submitRating = trpc.ratings.submit.useMutation({
    onSuccess: () => { toast.success("Avaliação enviada! Obrigado pelo feedback."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");

  if (isLoading) return <div className="mt-3 pt-3 border-t"><Skeleton className="h-8 w-full" /></div>;

  if (existing) {
    return (
      <div className="mt-3 pt-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-yellow-500" /> Sua avaliação
        </p>
        <div className="flex items-center gap-1 mb-1">
          {[1,2,3,4,5].map(s => (
            <Star key={s} className={`w-5 h-5 ${s <= existing.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          ))}
        </div>
        {existing.comment && <p className="text-sm text-muted-foreground italic">"{existing.comment}"</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
        <Star className="w-3.5 h-3.5 text-yellow-500" /> Avaliar Entrega
      </p>
      <div className="flex items-center gap-1 mb-2">
        {[1,2,3,4,5].map(s => (
          <button key={s} type="button" onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} onClick={() => setSelected(s)}>
            <Star className={`w-7 h-7 transition-colors ${s <= (hovered || selected) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      {selected > 0 && (
        <>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentário opcional sobre a entrega..." className="w-full text-sm border rounded-md p-2 resize-none bg-background text-foreground mb-2" rows={2} />
          <Button size="sm" className="w-full" disabled={submitRating.isPending} onClick={() => submitRating.mutate({ orderId, rating: selected, comment: comment || undefined })}>
            {submitRating.isPending ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </>
      )}
    </div>
  );
}

//  Order Items Expand 
function OrderItemsDetail({ orderId, onReorder }: { orderId: number; onReorder: (items: { productId: number; productName: string; quantity: number; productPrice: string }[]) => void }) {
  const { data, isLoading } = trpc.orders.byId.useQuery({ id: orderId });
  if (isLoading) return <div className="mt-3 pt-3 border-t space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>;
  if (!data?.items?.length) return <p className="mt-3 pt-3 border-t text-sm text-muted-foreground">Nenhum item encontrado.</p>;
  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens do Pedido</p>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onReorder(data.items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, productPrice: i.productPrice })))}>
          <RotateCcw className="w-3 h-3" /> Pedir Novamente
        </Button>
      </div>
      <div className="space-y-2">
        {data.items.map((item) => (
          <div key={item.id} className="flex justify-between items-start text-sm">
            <div>
              <span className="font-medium">{item.quantity}x {item.productName}</span>
              {item.notes && <p className="text-xs text-muted-foreground mt-0.5">Obs: {item.notes}</p>}
            </div>
            <span className="font-bold text-primary shrink-0 ml-3">R$ {parseFloat(item.subtotal).toFixed(2).replace(".", ",")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

//  Abandoned Carts Tab 
function AbandonedCartsTab() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: carts, isLoading } = trpc.cart.myAbandoned.useQuery();
  const dismiss = trpc.cart.dismiss.useMutation({
    onSuccess: () => {
      utils.cart.myAbandoned.invalidate();
      toast.success("Carrinho descartado.");
    },
  });

  function handleFinalize(cartId: number) {
    navigate(`/checkout?restore=${cartId}`);
  }

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-1/3 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>)}
    </div>
  );

  if (!carts?.length) return (
    <div className="text-center py-14 text-muted-foreground">
      <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Nenhum carrinho salvo</p>
      <p className="text-sm mt-1">Quando você iniciar um pedido e não finalizar, ele aparecerá aqui.</p>
      <Link href="/cardapio">
        <Button className="mt-5 gap-2"><ShoppingBag className="w-4 h-4" />Ver Cardápio</Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <p className="text-sm text-muted-foreground">Você tem {carts.length} carrinho{carts.length > 1 ? "s" : ""} salvo{carts.length > 1 ? "s" : ""}. Finalize antes que expire!</p>
      </div>
      {carts.map(cart => {
        const expiresIn = Math.max(0, Math.round((new Date(cart.expiresAt).getTime() - Date.now()) / 60000));
        return (
          <Card key={cart.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-base">Carrinho #{cart.id}</p>
                  <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">R$ {cart.total}</span></p>
                  {cart.couponCode && (
                    <Badge variant="outline" className="mt-1 text-xs border-green-500 text-green-700"><Tag className="w-3 h-3 mr-1" />{cart.couponCode}</Badge>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Expira em</p>
                  <p className={`text-sm font-bold ${expiresIn <= 30 ? "text-red-600" : "text-amber-600"}`}>{expiresIn}min</p>
                </div>
              </div>
              <div className="space-y-1 mb-4">
                {cart.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Pizza className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate">{item.productName}</span>
                    <span className="text-muted-foreground shrink-0">x{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleFinalize(cart.id)}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Finalizar Pedido
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-red-600 hover:border-red-300"
                  disabled={dismiss.isPending}
                  onClick={() => {
                    if (confirm("Descartar este carrinho?")) dismiss.mutate({ cartId: cart.id });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

//  Orders Tab 
function OrdersTab() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { selectedStore } = useStore();
  const utils = trpc.useUtils();
  useOrderRealtime({
    enabled: Boolean(selectedStore?.id),
    onEvent: () => {
      void utils.orders.myOrders.invalidate();
      void utils.orders.byId.invalidate();
      void utils.ratings.orderReviewByOrder.invalidate();
    },
    onFallback: () => {
      void utils.orders.myOrders.invalidate();
    },
    fallbackIntervalMs: 15_000,
  });
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(
    { storeId: selectedStore?.id },
    { enabled: Boolean(selectedStore?.id), refetchInterval: false },
  );
  const [, navigate] = useLocation();
  const orderRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Tratar parmetro ?avaliar=X da URL (notificao push ps-entrega)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const avaliarId = params.get("avaliar");
    if (!avaliarId || !orders?.length) return;
    const orderId = parseInt(avaliarId);
    if (isNaN(orderId)) return;
    // Expandir o pedido e rolar at ele
    setExpandedId(orderId);
    setTimeout(() => {
      const el = orderRefs.current[orderId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    // Limpar o parmetro da URL sem recarregar
    const newUrl = window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [orders]);

  const activeOrders = orders?.filter(o => !["delivered","cancelled"].includes(o.status)) ?? [];

  function handleReorder(items: { productId: number; productName: string; quantity: number; productPrice: string }[]) {
    const cart = items.map(i => ({ id: i.productId, name: i.productName, price: parseFloat(i.productPrice), quantity: i.quantity }));
    localStorage.setItem("bonatto_reorder_cart", JSON.stringify(cart));
    toast.success("Itens adicionados ao carrinho!");
    navigate("/cardapio");
  }

  if (isLoading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-3" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
      ))}
    </div>
  );

  if (!orders?.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
      <p className="text-xl font-medium">Nenhum pedido ainda</p>
      <p className="text-sm mt-2 mb-6">Seu histórico de pedidos vai aparecer aqui.</p>
      <Link href="/cardapio"><Button className="gap-2"><ShoppingBag className="w-4 h-4" />Ver Cardápio</Button></Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {activeOrders.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <p className="text-sm font-semibold text-primary">{activeOrders.length} pedido{activeOrders.length > 1 ? "s" : ""} em andamento</p>
        </div>
      )}
      {orders.map((order) => {
        const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-800", step: 0 };
        const isExpanded = expandedId === order.id;
        const isActive = !["delivered","cancelled"].includes(order.status);
        return (
          <Card key={order.id} ref={(el) => { orderRefs.current[order.id] = el; }} className={`hover:shadow-md transition-shadow ${isActive ? "border-primary/30 ring-1 ring-primary/10" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Pedido #{order.id}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(order.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge className={`${statusInfo.color} border-0 shrink-0`}>{statusInfo.label}</Badge>
              </div>
              {isActive && <StatusProgressBar status={order.status} />}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Endereço</p><p className="font-medium">{order.deliveryAddress}</p></div>
                <div><p className="text-muted-foreground">Pagamento</p><p className="font-medium">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p></div>
              </div>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : order.id)} className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isExpanded ? "Ocultar itens" : "Ver itens do pedido"}
              </button>
              {isExpanded && <OrderItemsDetail orderId={order.id} onReorder={handleReorder} />}
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="font-black text-primary text-lg">R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}</span>
              </div>
              {order.status === "out_for_delivery" && (
                <Link href={`/rastrear/${order.id}`}>
                  <button className="mt-3 w-full flex items-center justify-center gap-2 bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                    <span>&gt;</span>Rastrear Entrega ao Vivo
                  </button>
                </Link>
              )}
              {order.status === "delivered" && <OrderReviewSection orderId={order.id} />}
              {order.status === "delivered" && order.driverId && <DeliveryRatingSection orderId={order.id} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

//  Loyalty Tab 
function LoyaltyTab() {
  const { selectedStore } = useStore();
  const storeInput = { storeId: selectedStore?.id };
  const queryOptions = { enabled: Boolean(selectedStore?.id) };
  const { data: points, isLoading: loadingPoints } = trpc.loyalty.points.useQuery(storeInput, queryOptions);
  const { data: history, isLoading: loadingHistory } = trpc.loyalty.spendingHistory.useQuery(storeInput, queryOptions);
  const { data: txHistory, isLoading: loadingTxHistory } = trpc.loyalty.history.useQuery(storeInput, queryOptions);

  const LEVELS = [
    { name: "Bronze", min: 0,   max: 100,  color: "text-amber-700",  bg: "bg-amber-100" },
    { name: "Prata",  min: 100, max: 300,  color: "text-slate-600",  bg: "bg-slate-100" },
    { name: "Ouro",   min: 300, max: 600,  color: "text-yellow-600", bg: "bg-yellow-100" },
    { name: "Diamante", min: 600, max: 1000, color: "text-blue-600", bg: "bg-blue-100" },
    { name: "VIP",    min: 1000, max: 9999, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  const pts = points ?? 0;
  const currentLevel = LEVELS.findLast(l => pts >= l.min) ?? LEVELS[0];
  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1];
  const progress = nextLevel ? ((pts - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100 : 100;

  return (
    <div className="space-y-6">
      {/* Points Card */}
      <Card className="text-white border-0 overflow-hidden" style={{ background: "linear-gradient(160deg, #9b1520 0%, #6E0D12 50%, #5a0a0f 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.3)" }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/70 text-sm font-medium">Seus Pontos</p>
              {loadingPoints ? <Skeleton className="h-10 w-24 bg-white/20 mt-1" /> : (
                <p className="text-4xl font-black">{pts.toLocaleString("pt-BR")}</p>
              )}
            </div>
            <div className={`px-3 py-1.5 rounded-full ${currentLevel.bg} ${currentLevel.color} font-bold text-sm`}>
              <Trophy className="w-4 h-4 inline mr-1" />{currentLevel.name}
            </div>
          </div>
          {nextLevel && (
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>{pts} pts</span>
                <span>{nextLevel.min} pts para {nextLevel.name}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>
          )}
          <p className="text-white/60 text-xs mt-3">Ganhe 1 ponto por R$1 gasto em pedidos entregues</p>
        </CardContent>
      </Card>

      {/* Como usar os pontos */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-bold text-yellow-800 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-600" />
            Como funcionam os Pontos Bonatto
          </p>
          <div className="space-y-2 text-sm text-yellow-800">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">P</span>
              <span><strong>Ganhe pontos:</strong> A cada R$ 1,00 gasto em pedidos entregues, você recebe <strong>1 ponto</strong> automaticamente.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">&gt;</span>
              <span><strong>Use como desconto:</strong> Na tela de pagamento do pedido, use seus pontos. <strong>10 pontos = R$ 1,00</strong> de desconto.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">=</span>
              <span><strong>Mínimo para resgatar:</strong> 50 pontos (equivale a R$ 5,00 de desconto).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">&gt;</span>
              <span><strong>Níveis:</strong> Bronze (0) - Prata (100) - Ouro (300) - Diamante (600) - VIP (1.000+). Quanto mais alto seu nível, mais benefícios em breve!</span>
            </div>
          </div>
          <a href="/checkout" className="inline-block mt-1 text-xs font-semibold text-yellow-700 underline underline-offset-2">Fazer um pedido agora </a>
        </CardContent>
      </Card>

      {/* Extrato de Pontos */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Extrato de Pontos</CardTitle></CardHeader>
        <CardContent>
          {loadingTxHistory ? <Skeleton className="h-40 w-full" /> : !txHistory?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimenta??o de pontos ainda.</p>
          ) : (
            <div className="space-y-1">
              {txHistory.map((tx: { id: number; type: string; points: number; description: string | null; createdAt: Date | string }) => {
                const isEarn = tx.type === 'earn';
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isEarn ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isEarn ? '+' : '-'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description ?? (isEarn ? 'Pontos ganhos' : 'Pontos resgatados')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${ isEarn ? 'text-primary' : 'text-muted-foreground' }`}>
                      {isEarn ? '+' : ''}{tx.points} pts
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spending History Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Histórico de Gastos por Mês</CardTitle></CardHeader>
        <CardContent>
          {loadingHistory ? <Skeleton className="h-40 w-full" /> : !history?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido entregue ainda.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h: { month: string; total: string | number; count: number }) => {
                const maxTotal = Math.max(...history.map((x: { total: string | number }) => Number(x.total)));
                const pct = (Number(h.total) / maxTotal) * 100;
                const [year, month] = h.month.split("-");
                const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("pt-BR", { month: "short" });
                return (
                  <div key={h.month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-10 shrink-0 capitalize">{monthName}/{year.slice(2)}</span>
                    <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                      <div className="h-full bg-primary/80 rounded-md transition-all flex items-center px-2" style={{ width: `${pct}%` }}>
                        {pct > 30 && <span className="text-xs text-white font-semibold">R$ {Number(h.total).toFixed(0)}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{h.count}x</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

//  Addresses Tab 
function AddressesTab() {
  const { data: addresses, isLoading, refetch } = trpc.addresses.list.useQuery();
  const createAddress = trpc.addresses.create.useMutation({ onSuccess: () => { toast.success("Endereço salvo e localizado!"); refetch(); setOpen(false); resetForm(); }, onError: e => toast.error(e.message) });
  const deleteAddress = trpc.addresses.delete.useMutation({ onSuccess: () => { toast.success("Endereço removido."); refetch(); }, onError: e => toast.error(e.message) });
  const updateAddress = trpc.addresses.update.useMutation({ onSuccess: () => { toast.success("Endereço atualizado e localizado!"); refetch(); setOpen(false); setEditId(null); resetForm(); }, onError: e => toast.error(e.message) });

  const emptyForm = { label: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", isDefault: false };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function resetForm() { setForm(emptyForm); }

  function startEdit(a: typeof addresses extends (infer T)[] | undefined ? T : never) {
    if (!a) return;
    const address = a as any;
    setEditId(address.id);
    setForm({
      label: address.label ?? "",
      cep: address.cep ?? "",
      street: address.street ?? "",
      number: address.number ?? "",
      complement: address.complement ?? "",
      neighborhood: address.neighborhood ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      isDefault: address.isDefault ?? false,
    });
    setOpen(true);
  }

  async function handleCepBlur() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const data = await lookupCep(cep);
      if (!data) {
        toast.error("CEP não encontrado");
        return;
      }
      setForm((current) => ({
        ...current,
        street: data.street || current.street,
        neighborhood: data.neighborhood || current.neighborhood,
        city: data.city || current.city,
        state: data.state || current.state,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP agora.");
    } finally {
      setCepLoading(false);
    }
  }

  function handleSubmit() {
    if (!form.label.trim() || !form.cep.trim() || !form.street.trim() || !form.number.trim() || !form.city.trim() || form.state.trim().length !== 2) {
      toast.error("Preencha nome, CEP, rua, número, cidade e UF.");
      return;
    }
    const payload = {
      label: form.label.trim(),
      cep: form.cep.trim(),
      street: form.street.trim(),
      number: form.number.trim(),
      complement: form.complement.trim() || undefined,
      neighborhood: form.neighborhood.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      isDefault: form.isDefault,
    };
    if (editId) updateAddress.mutate({ id: editId, ...payload });
    else createAddress.mutate(payload);
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{addresses?.length ?? 0} endereço{(addresses?.length ?? 0) !== 1 ? "s" : ""} salvo{(addresses?.length ?? 0) !== 1 ? "s" : ""}</p>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Adicionar</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editId ? "Editar Endereço" : "Novo Endereço"}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Nome (ex: Casa, Trabalho)</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Casa" />
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} onBlur={handleCepBlur} placeholder="00000-000" />
                    {cepLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Input value={form.state} maxLength={2} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} placeholder="MG" />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="space-y-1.5">
                  <Label>Rua</Label>
                  <Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Rua..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="123" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} placeholder="Centro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))} placeholder="Apto, bloco, referência..." />
              </div>
              <p className="text-xs text-muted-foreground">Ao salvar, o endereço é geocodificado no servidor. A taxa de entrega nunca fica salva aqui: ela é recalculada no checkout.</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                Definir como endereço padrão
              </label>
              <Button className="w-full" onClick={handleSubmit} disabled={createAddress.isPending || updateAddress.isPending}>
                {createAddress.isPending || updateAddress.isPending ? "Localizando e salvando..." : editId ? "Salvar alterações" : "Adicionar endereço"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!addresses?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum endereço salvo</p>
          <p className="text-sm mt-1">Adicione endereços para agilizar seus pedidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <Card key={a.id} className={a.isDefault ? "border-primary/40 bg-primary/5" : ""}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${a.isDefault ? "bg-primary text-white" : "bg-muted"}`}>
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{a.label}</p>
                      {a.isDefault && <Badge className="bg-primary/10 text-primary border-0 text-xs py-0">Padrão</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.address}</p>
                    {(a.cep || a.city) && <p className="text-xs text-muted-foreground">{[a.cep, a.city, a.state].filter(Boolean).join(" • ")}</p>}
                    {a.latitude && a.longitude && <p className="mt-1 text-[11px] text-green-700">Endereço localizado ✓</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(a as any)}>
                    <MapPin className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteAddress.mutate({ id: a.id })} disabled={deleteAddress.isPending}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

//  Notifications Tab 
function PushToggle() {
  const { isSubscribed, isLoading, isSupported, permission, subscribe, unsubscribe } = usePushNotifications();
  return (
    <Card className="mb-4 border-primary/20">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {isSubscribed ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div>
            <p className="font-semibold text-sm">Notificações Push</p>
            <p className="text-xs text-muted-foreground">
              {!isSupported
                ? "Abra o app pela tela inicial (PWA) para ativar."
                : permission === "denied"
                ? "Bloqueado no navegador. Habilite nas configurações."
                : isSubscribed
                ? "Ativo: você recebe alertas sobre seus pedidos."
                : "Receba alertas quando seu pedido mudar de status."}
            </p>
          </div>
        </div>
        {isSupported && permission !== "denied" && (
          <Button
            size="sm"
            variant={isSubscribed ? "outline" : "default"}
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className="shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSubscribed ? "Desativar" : "Ativar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const { selectedStore } = useStore();
  const utils = trpc.useUtils();
  const queryInput = { storeId: selectedStore?.id };
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    queryInput,
    { enabled: Boolean(selectedStore?.id) },
  );

  const refreshNotificationState = async () => {
    await Promise.all([
      utils.notifications.list.invalidate(queryInput),
      utils.notifications.unreadCount.invalidate(queryInput),
    ]);
  };

  const markAllRead = trpc.notifications.markRead.useMutation({
    onMutate: async () => {
      await utils.notifications.list.cancel(queryInput);
      const previous = utils.notifications.list.getData(queryInput);
      utils.notifications.list.setData(queryInput, (current) => current?.map((item) => ({ ...item, read: true })));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) utils.notifications.list.setData(queryInput, context.previous);
    },
    onSettled: refreshNotificationState,
  });

  const markOneRead = trpc.notifications.markOneRead.useMutation({
    onMutate: async ({ notificationId }) => {
      await utils.notifications.list.cancel(queryInput);
      const previous = utils.notifications.list.getData(queryInput);
      utils.notifications.list.setData(queryInput, (current) => current?.map((item) => item.id === notificationId ? { ...item, read: true } : item));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) utils.notifications.list.setData(queryInput, context.previous);
    },
    onSettled: refreshNotificationState,
  });

  const archiveNotification = trpc.notifications.archive.useMutation({
    onMutate: async ({ notificationId }) => {
      await utils.notifications.list.cancel(queryInput);
      const previous = utils.notifications.list.getData(queryInput);
      utils.notifications.list.setData(queryInput, (current) => current?.filter((item) => item.id !== notificationId));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) utils.notifications.list.setData(queryInput, context.previous);
      toast.error("Não foi possível arquivar a notificação.");
    },
    onSettled: refreshNotificationState,
  });

  const unreadCount = (notifications ?? []).filter((item) => !item.read).length;

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    order:  <Package className="w-4 h-4 text-blue-500" />,
    promo:  <Tag className="w-4 h-4 text-green-500" />,
    system: <Zap className="w-4 h-4 text-yellow-500" />,
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-3">
      <ClientAlertsBanner maxVisible={5} />
      <PWAInstallBanner />
      <PushToggle />
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate({ storeId: selectedStore?.id })}
            className="gap-2"
          >
            {markAllRead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Marcar todas como lidas
          </Button>
        </div>
      )}
      {!notifications?.length && (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-xl font-medium">Nenhuma notificação</p>
          <p className="text-sm mt-2">Você será notificado sobre seus pedidos e promoções.</p>
        </div>
      )}
      {(notifications ?? []).map((n) => (
        <Card key={n.id} className={n.read ? "opacity-70" : "border-primary/20 bg-primary/5"}>
          <CardContent className="p-4 flex items-start gap-3">
            {n.imageUrl ? (
              <img src={n.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" loading="lazy" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                {TYPE_ICONS[n.type] ?? <Bell className="w-4 h-4" />}
              </div>
            )}
            <div className="flex-1 min-w-0">
            <p className="mb-2 inline-flex rounded-full border border-[#f0d6d0] bg-[#fff7f4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d0f14]">Minha conta</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">{n.title}</p>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              </div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
                {n.url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!n.read) markOneRead.mutate({ notificationId: n.id, storeId: selectedStore?.id });
                      if (/^https?:\/\//i.test(n.url!)) window.open(n.url!, "_blank", "noopener,noreferrer");
                      else window.location.href = n.url!;
                    }}
                    className="h-8 gap-1.5 px-3 text-xs font-semibold"
                  >
                    Abrir
                  </Button>
                )}
                {!n.read && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={markOneRead.isPending}
                    onClick={() => markOneRead.mutate({ notificationId: n.id, storeId: selectedStore?.id })}
                    className="h-8 gap-1.5 px-2 text-xs"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar lida
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={archiveNotification.isPending}
                  onClick={() => archiveNotification.mutate({ notificationId: n.id, storeId: selectedStore?.id })}
                  className="h-8 gap-1.5 px-2 text-xs"
                >
                  <Archive className="h-3.5 w-3.5" /> Arquivar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

//  Profile Tab 
function ProfileTab() {
  const { data: profile, isLoading, refetch } = trpc.profile.me.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("Perfil atualizado!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateAvatar = trpc.avatar.update.useMutation({
    onSuccess: () => { toast.success("Avatar atualizado!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    savedStreet: "",
    savedNumber: "",
    savedComplement: "",
    savedNeighborhood: "",
    savedCep: "",
    savedCity: "",
    savedState: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPresets, setAvatarPresets] = useState<MagnificAvatarPreset[]>([]);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        savedStreet: profile.savedStreet ?? "",
        savedNumber: profile.savedNumber ?? "",
        savedComplement: profile.savedComplement ?? "",
        savedNeighborhood: profile.savedNeighborhood ?? "",
        savedCep: profile.savedCep ?? "",
        savedCity: profile.savedCity ?? "",
        savedState: profile.savedState ?? "",
      });
    }
  }, [
    profile?.name,
    profile?.phone,
    profile?.savedStreet,
    profile?.savedNumber,
    profile?.savedComplement,
    profile?.savedNeighborhood,
    profile?.savedCep,
    profile?.savedCity,
    profile?.savedState,
  ]);

  useEffect(() => {
    let cancelled = false;

    loadMagnificAvatarPresets()
      .then((items) => {
        if (!cancelled) setAvatarPresets(items);
      })
      .catch(() => {
        if (!cancelled) setAvatarPresets([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setAvatarUploading(true);
    try {
      const data = await uploadImageFile({ file, scope: "avatar" });
      setAvatarPreview(data.url);
      await refetch();
      toast.success("Foto atualizada!");
    } catch (error) {
      setAvatarPreview((profile as any)?.avatarUrl ?? null);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setAvatarUploading(false);
      URL.revokeObjectURL(localPreview);
      if (e.target) e.target.value = "";
    }
  }

  function handlePresetAvatarSelect(preset: MagnificAvatarPreset) {
    setAvatarPreview(preset.src);
    updateAvatar.mutate({ avatarUrl: preset.src });
  }

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const avatarSrc = avatarPreview ?? (profile as any)?.avatarUrl ?? null;
  const selectedAvatarPreset = avatarPresets.find((preset) => preset.src === avatarSrc) ?? null;

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />Meu Perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary flex items-center justify-center text-white font-black text-2xl shrink-0 ring-2 ring-primary/20">
              {avatarSrc ? <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" /> : (form.name || "U")[0].toUpperCase()}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-semibold">Alterar</span>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div>
            <p className="font-semibold">{form.name || "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline">Alterar foto de perfil</button>
              {avatarPresets.length > 0 && (
                <Dialog open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1 rounded-full border border-[#ead7d1] bg-[#fff7f4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7d0f14] transition-colors hover:bg-[#fff1ec]">
                      <Star className="h-3.5 w-3.5" />
                      Avatares da casa
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[680px]">
                    <DialogHeader>
                      <DialogTitle>Escolha um avatar com cara de Bonatto</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <p className="text-sm text-muted-foreground">Selecao mais quente e artesanal para combinar melhor com o universo da marca.</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {avatarPresets.map((preset) => {
                          const isSelected = avatarSrc === preset.src;

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                handlePresetAvatarSelect(preset);
                                setAvatarPickerOpen(false);
                              }}
                              disabled={updateAvatar.isPending}
                              className={`overflow-hidden rounded-[22px] border bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                isSelected ? "bg-primary/[0.03] shadow-sm ring-1 ring-primary/20" : "border-border/70"
                              }`}
                              title={`Usar avatar ${preset.label}`}
                            >
                              <img src={preset.src} alt={preset.label} className="h-32 w-full object-cover" />
                              <div className="space-y-1 p-3">
                                <p className="text-sm font-semibold text-foreground">{preset.label}</p>
                                <p className="text-xs text-muted-foreground">{isSelected ? "Avatar em uso" : "Aplicar este estilo"}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {avatarPresets.length > 0 && (
          <div className="rounded-2xl border border-[#ead7d1] bg-[#fffaf8] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Curadoria Bonatto</p>
                <p className="text-xs text-muted-foreground">Os avatares prontos agora ficam mais discretos e com uma linha visual mais quente.</p>
              </div>
              {(avatarUploading || updateAvatar.isPending) && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
            {selectedAvatarPreset && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/90 p-2.5">
                <img src={selectedAvatarPreset.src} alt={selectedAvatarPreset.label} className="h-12 w-12 rounded-2xl object-cover" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{selectedAvatarPreset.label}</p>
                  <p className="truncate text-xs text-muted-foreground">Avatar atual selecionado na colecao Bonatto.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Seu nome" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Endereço salvo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Guardamos a localização para facilitar o preenchimento. Taxa e prazo são recalculados sempre que você fizer um pedido.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_90px]">
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input value={form.savedCep} onChange={(e) => setForm((f) => ({ ...f, savedCep: e.target.value }))} placeholder="00000-000" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input maxLength={2} value={form.savedState} onChange={(e) => setForm((f) => ({ ...f, savedState: e.target.value.toUpperCase() }))} placeholder="MG" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label>Rua</Label>
              <Input value={form.savedStreet} onChange={(e) => setForm((f) => ({ ...f, savedStreet: e.target.value }))} placeholder="Nome da rua" />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={form.savedNumber} onChange={(e) => setForm((f) => ({ ...f, savedNumber: e.target.value }))} placeholder="123" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.savedNeighborhood} onChange={(e) => setForm((f) => ({ ...f, savedNeighborhood: e.target.value }))} placeholder="Centro" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.savedCity} onChange={(e) => setForm((f) => ({ ...f, savedCity: e.target.value }))} placeholder="Sua cidade" />
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label>Complemento</Label>
            <Input value={form.savedComplement} onChange={(e) => setForm((f) => ({ ...f, savedComplement: e.target.value }))} placeholder="Apto, bloco ou referência" />
          </div>
          {profile?.savedLatitude && profile?.savedLongitude && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Localização validada em {profile.savedGeocodedAt ? new Date(profile.savedGeocodedAt).toLocaleDateString("pt-BR") : "cadastro anterior"}.
            </p>
          )}
        </div>
        <Button className="w-full" onClick={() => updateProfile.mutate(form)} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Salvando..." : "Salvar Dados"}
        </Button>
      </CardContent>
    </Card>
    <SocialConnections />
    <SecuritySessionsCard />
    </div>
  );
}

const TWO_FACTOR_UI_ENABLED = import.meta.env.VITE_ENABLE_2FA === "true";

function SecuritySessionsCard() {
  const utils = trpc.useUtils();
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  const sessions = trpc.auth.sessions.useQuery(undefined, {
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const twoFactor = trpc.auth.twoFactorStatus.useQuery(undefined, {
    enabled: TWO_FACTOR_UI_ENABLED,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const revokeSession = trpc.auth.revokeSession.useMutation({
    onSuccess: async (result) => {
      if (result.currentSessionRevoked) {
        window.location.replace("/login");
        return;
      }
      await sessions.refetch();
      toast.success("Sessão encerrada.");
    },
    onError: (error) => toast.error(error.message),
  });
  const logoutAll = trpc.auth.logoutAll.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      window.location.replace("/login");
    },
    onError: (error) => toast.error(error.message),
  });

  const beginTwoFactor = trpc.auth.beginTwoFactorSetup.useMutation({
    onSuccess: (data) => {
      setTotpSetup(data);
      setTotpCode("");
      toast.success("Autenticador pronto para configurar.");
    },
    onError: (error) => toast.error(error.message),
  });

  const confirmTwoFactor = trpc.auth.confirmTwoFactorSetup.useMutation({
    onSuccess: async () => {
      setTotpSetup(null);
      setTotpCode("");
      await Promise.all([twoFactor.refetch(), sessions.refetch()]);
      toast.success("Autenticação em duas etapas ativada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const disableTwoFactor = trpc.auth.disableTwoFactor.useMutation({
    onSuccess: async () => {
      setTotpCode("");
      setDisablePassword("");
      await Promise.all([twoFactor.refetch(), sessions.refetch()]);
      toast.success("Autenticação em duas etapas desativada.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Segurança e sessões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Veja onde sua conta está conectada e encerre acessos que você não reconhece.
        </p>

        {TWO_FACTOR_UI_ENABLED && (
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Autenticação em duas etapas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Proteja sua conta com Google Authenticator, Microsoft Authenticator ou outro app TOTP.
              </p>
            </div>
            <Badge variant={twoFactor.data?.enabled ? "default" : "secondary"}>
              {twoFactor.data?.enabled ? "Ativada" : "Desativada"}
            </Badge>
          </div>

          {!twoFactor.data?.enabled && !totpSetup && (
            <Button
              className="mt-4"
              variant="outline"
              disabled={beginTwoFactor.isPending || twoFactor.isLoading}
              onClick={() => beginTwoFactor.mutate()}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Ativar 2FA
            </Button>
          )}

          {!twoFactor.data?.enabled && totpSetup && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Adicione a chave abaixo no seu autenticador e depois confirme com o código de 6 dígitos.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={totpSetup.secret} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(totpSetup.secret);
                    toast.success("Chave copiada.");
                  }}
                >
                  Copiar
                </Button>
              </div>
              <a href={totpSetup.uri} className="inline-block text-xs font-semibold text-primary hover:underline">
                Abrir no aplicativo autenticador
              </a>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  disabled={confirmTwoFactor.isPending || totpCode.length !== 6}
                  onClick={() => confirmTwoFactor.mutate({ code: totpCode })}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          )}

          {twoFactor.data?.enabled && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Para desativar, confirme um código atual do autenticador
                {twoFactor.data.hasPassword ? " e sua senha." : "."}
              </p>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Código de 6 dígitos"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {twoFactor.data.hasPassword && (
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={disablePassword}
                  onChange={(event) => setDisablePassword(event.target.value)}
                />
              )}
              <Button
                variant="destructive"
                disabled={
                  disableTwoFactor.isPending ||
                  totpCode.length !== 6 ||
                  (twoFactor.data.hasPassword && !disablePassword)
                }
                onClick={() => {
                  if (!window.confirm("Desativar a autenticação em duas etapas?")) return;
                  disableTwoFactor.mutate({
                    code: totpCode,
                    password: twoFactor.data.hasPassword ? disablePassword : undefined,
                  });
                }}
              >
                Desativar 2FA
              </Button>
            </div>
          )}
        </div>
        )}

        {sessions.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {sessions.isError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
            Não foi possível carregar suas sessões.
            <Button variant="link" className="h-auto px-2" onClick={() => sessions.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {(sessions.data ?? []).map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="flex min-w-0 items-start gap-3">
                <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{session.deviceLabel}</p>
                    {session.isCurrent && <Badge variant="secondary">Este dispositivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ativa em {new Date(session.lastSeenAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={revokeSession.isPending}
                onClick={() => revokeSession.mutate({ sessionId: session.id })}
              >
                Sair
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="destructive"
          className="w-full"
          disabled={logoutAll.isPending}
          onClick={() => {
            if (window.confirm("Encerrar sua conta em todos os dispositivos?")) logoutAll.mutate();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair de todos os dispositivos
        </Button>
      </CardContent>
    </Card>
  );
}

//  Coupons Tab 
function CouponsTab() {
  const { selectedStore } = useStore();
  const { data: coupons, isLoading } = trpc.profile.myCoupons.useQuery({ storeId: selectedStore?.id });
  const { data: allCoupons } = trpc.coupons.listActive.useQuery({ storeId: selectedStore?.id });
  const publicCoupons = allCoupons?.filter((c) => !c.userId && c.active) ?? [];

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      {coupons && coupons.length > 0 && (
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />Cupons Exclusivos para Você
          </h3>
          <div className="grid gap-3">
            {coupons.map((c) => (
              <Card key={c.id} className="border-2 border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-lg text-primary tracking-widest">{c.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.discountType === "percentage" ? `${parseFloat(c.discountValue)}% de desconto` : `R$ ${parseFloat(c.discountValue).toFixed(2)} de desconto`}
                      {c.minOrderValue && parseFloat(c.minOrderValue) > 0 && `  Mínimo R$ ${parseFloat(c.minOrderValue).toFixed(2)}`}
                    </p>
                    {c.expiresAt && <p className="text-xs text-muted-foreground mt-0.5">Válido até {new Date(c.expiresAt).toLocaleDateString("pt-BR")}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Cupom copiado!"); }}>Copiar</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {publicCoupons.length > 0 && (
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />Cupons Disponveis
          </h3>
          <div className="grid gap-3">
            {publicCoupons.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-lg tracking-widest">{c.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.discountType === "percentage" ? `${parseFloat(c.discountValue)}% de desconto` : `R$ ${parseFloat(c.discountValue).toFixed(2)} de desconto`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Cupom copiado!"); }}>Copiar</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {(!coupons?.length && !publicCoupons.length) && (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-xl font-medium">Nenhum cupom disponível</p>
          <p className="text-sm mt-2">Quando houver novas promoções, elas vão aparecer aqui.</p>
        </div>
      )}
    </div>
  );
}

//  Promotions Tab 
function PromotionsTab() {
  const { selectedStore } = useStore();
  const { data: promotions, isLoading } = trpc.promotions.active.useQuery({ storeId: selectedStore?.id });
  if (isLoading) return <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>;
  if (!promotions?.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Gift className="w-16 h-16 mx-auto mb-4 opacity-20" />
      <p className="text-xl font-medium">Nenhuma promoção ativa</p>
      <p className="text-sm mt-2">Novas promoções em breve!</p>
    </div>
  );
  return (
    <div className="grid gap-4">
      {promotions.map((promo) => (
        <Card key={promo.id} className="overflow-hidden">
          {promo.imageUrl && <img src={promo.imageUrl} alt={promo.title} className="w-full h-40 object-cover" />}
          <CardContent className="p-4">
            <h3 className="font-bold text-lg mb-1">{promo.title}</h3>
            {promo.description && <p className="text-muted-foreground text-sm mb-3">{promo.description}</p>}
            {promo.endsAt && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Válido até {new Date(promo.endsAt).toLocaleDateString("pt-BR")}</p>}
            {promo.couponCode && (
              <div className="flex items-center gap-2">
                <span className="font-black text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-lg">{promo.couponCode}</span>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(promo.couponCode!); toast.success("Cupom copiado!"); }}>Copiar cupom</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

//  Raffles Tab 
function RafflesTab() {
  const { selectedStore } = useStore();
  const { data: raffles, isLoading, refetch } = trpc.raffles.active.useQuery({ storeId: selectedStore?.id });
  const enterRaffle = trpc.raffles.enter.useMutation({
    onSuccess: (ok) => { if (ok) { toast.success("Você entrou no sorteio! Boa sorte!"); refetch(); } else toast.info("Você já está participando deste sorteio."); },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <div className="grid gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>;
  if (!raffles?.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Ticket className="w-16 h-16 mx-auto mb-4 opacity-20" />
      <p className="text-xl font-medium">Nenhum sorteio ativo</p>
      <p className="text-sm mt-2">Fique atento! Em breve teremos sorteios incríveis.</p>
    </div>
  );
  return (
    <div className="grid gap-4">
      {raffles.map((raffle) => (
        <Card key={raffle.id} className="overflow-hidden border-2 border-[#eadbd2] bg-[#fffaf6]">
          {raffle.imageUrl && <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-40 object-cover" />}
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-lg">{raffle.title}</h3>
                {raffle.description && <p className="text-muted-foreground text-sm mt-1">{raffle.description}</p>}
              </div>
              <Badge className="bg-yellow-400 text-yellow-900 border-0 shrink-0">Ativo</Badge>
            </div>
            <div className="bg-white rounded-xl p-3 mb-4 border border-yellow-200">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Prmio</p>
              <p className="font-bold text-lg text-primary flex items-center gap-2"><Gift className="w-5 h-5" />{raffle.prize}</p>
            </div>
            {raffle.endsAt && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Encerra em {new Date(raffle.endsAt).toLocaleDateString("pt-BR")}</p>}
            <Button className="w-full" onClick={() => enterRaffle.mutate({ raffleId: raffle.id, storeId: selectedStore?.id })} disabled={enterRaffle.isPending}>
              <Ticket className="w-4 h-4 mr-2" />{enterRaffle.isPending ? "Participando..." : "Participar do Sorteio"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

//  Payments Tab 
function PaymentsTab() {
  const { data: transactions, isLoading } = trpc.payments.getMyTransactions.useQuery();

  const METHOD_LABELS: Record<string, string> = {
    card: "Cartão",
    pix: "PIX",
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito",
    cash: "Dinheiro",
  };

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    succeeded: { label: "Confirmado", color: "bg-green-100 text-green-700" },
    pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
    failed: { label: "Falhou", color: "bg-[#fce8e8] text-[#5a0a0f]" },
    refunded: { label: "Reembolsado", color: "bg-blue-100 text-blue-700" },
  };

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </div>
  );

  if (!transactions?.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Receipt className="w-16 h-16 mx-auto mb-4 opacity-20" />
      <p className="text-xl font-medium">Nenhum pagamento ainda</p>
      <p className="text-sm mt-2">Seus pagamentos online aparecerão aqui.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        Histórico de pagamentos realizados via cartão ou PIX.
      </p>
      {transactions.map((tx) => {
        const status = STATUS_CONFIG[tx.status] ?? { label: tx.status, color: "bg-gray-100 text-gray-700" };
        const isCard = tx.paymentMethod === "card" || tx.paymentMethod === "credit_card" || tx.paymentMethod === "debit_card";
        return (
          <Card key={tx.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCard ? "bg-blue-50" : "bg-green-50"}`}>
                    {isCard
                      ? <CreditCard className="w-5 h-5 text-blue-500" />
                      : <QrCode className="w-5 h-5 text-green-500" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Pedido #{tx.orderId}</p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABELS[tx.paymentMethod ?? ""] ?? tx.paymentMethod ?? "Online"}
                      {"  "}
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-base text-gray-900">
                    R$ {parseFloat(tx.amount ?? "0").toFixed(2).replace(".", ",")}
                  </p>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
// Club Member Tab
function ClubMemberTab() {
  const { isAuthenticated } = useAuth();
  const { selectedStore } = useStore();
  const { data: clubPlan, isLoading } = trpc.club.getMyPlan.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: isAuthenticated && Boolean(selectedStore?.id) },
  );
  const { data: clubConfig } = trpc.club.getPublicConfig.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: Boolean(selectedStore?.id) },
  );
  const cancelSub = trpc.club.cancelSubscription.useMutation({
    onSuccess: () => toast.success("Assinatura cancelada. Você ainda terá acesso até o fim do período."),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const isActive = clubPlan?.status === "active";
  const isPending = clubPlan?.status === "pending";
  const isBonattao = clubPlan?.plan === "bonattao";
  const planDetails = clubPlan?.planDetails;
  const planName = planDetails?.name ?? (isBonattao ? "Sócio Bonatto" : "Fã Bonatto");
  const planDiscount = Number(planDetails?.discountPercent ?? 0);
  const hasFreeDelivery = Boolean(planDetails?.freeDelivery);
  const hasFreePizza = Boolean(planDetails?.freePizzaPerMonth);
  const planBenefits = planDetails?.benefits ?? [];
  const freePizzaAvailable = hasFreePizza && !clubPlan?.freePizzaUsed;
  const guestPlans = clubConfig?.plans ?? [];

  // No  membro  mostrar convite
  if (!clubPlan || (!isActive && !isPending)) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden bg-[#191412] border border-[#3a2b27] shadow-2xl p-8 text-center">
          <Crown className="w-12 h-12 text-[#7d0f14] mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white mb-2">
            {clubConfig?.profileGuestTitle ?? "Você ainda não é membro"}
          </h2>
          <p className="text-zinc-400 mb-6">
            {clubConfig?.profileGuestSubtitle ??
              "Assine o Clube do Bonatto para ter descontos, entrega grátis nos planos elegíveis e uma pizza grátis por mês."}
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            {guestPlans.map((plan) => (
              <div key={plan.id} className="bg-zinc-800 rounded-2xl p-4 text-center w-full max-w-[220px]">
                {plan.id === "bonattao" ? (
                  <Crown className="w-5 h-5 text-[#7d0f14] mx-auto mb-1" />
                ) : (
                  <Star className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                )}
                <p className="text-white font-black">{plan.name}</p>
                <p className={plan.id === "bonattao" ? "text-[#a01218] font-black text-xl" : "text-zinc-300 font-black text-xl"}>
                  R$ {Number(plan.price).toFixed(2).replace(".", ",")}
                  <span className="text-xs text-zinc-400">/mês</span>
                </p>
                <p className="text-xs text-zinc-400 mt-1">{plan.benefits.slice(0, 3).join(" + ")}</p>
              </div>
            ))}
          </div>
          <Link href="/clube">
            <Button className="bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white font-bold px-8 py-3 rounded-2xl">
              <Crown className="w-4 h-4 mr-2" /> {clubConfig?.ctaLabel ?? "Assinar agora via PIX"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Pagamento pendente
  if (isPending) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-10 h-10 text-yellow-600 mx-auto mb-3 animate-spin" />
            <h3 className="font-black text-lg text-yellow-800 mb-2">Pagamento PIX aguardando confirmação</h3>
            <p className="text-yellow-700 text-sm">Seu pagamento está sendo verificado pelo nosso time. Assim que confirmado, seu plano será ativado automaticamente!</p>
            <p className="text-xs text-yellow-600 mt-3">Plano: <strong>{clubPlan.plan === "bonattao" ? "Bonatto" : "Básico"}</strong></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Membro ativo
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header do plano */}
      <div className={`rounded-3xl p-6 text-white ${
        isBonattao
          ? "bg-[#971117]"
          : "bg-[#27201d]"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isBonattao ? <Crown className="w-8 h-8 text-yellow-300" /> : <Star className="w-8 h-8 text-blue-300" />}
            <div>
              <p className="text-white/70 text-sm">Plano ativo</p>
              <h2 className="text-2xl font-black">{isBonattao ? "Bonatto" : "Básico"}</h2>
            </div>
          </div>
          <span className="bg-green-400/20 border border-green-400/40 text-green-300 text-xs font-bold px-3 py-1 rounded-full">
             Ativo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-0.5">Membro desde</p>
            <p className="font-bold">{clubPlan.startDate ? new Date(clubPlan.startDate).toLocaleDateString("pt-BR") : ""}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-0.5">Próxima renovação</p>
            <p className="font-bold">{clubPlan.nextBillingDate ? new Date(clubPlan.nextBillingDate).toLocaleDateString("pt-BR") : ""}</p>
          </div>
        </div>
      </div>

      {/* Benefcios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#7d0f14]" /> {clubConfig?.profileBenefitsTitle ?? "Seus benefícios"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-sm">{planDiscount}% de desconto em todos os pedidos</span>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200">-{planDiscount}%</Badge>
          </div>
          {hasFreeDelivery && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-sm">Entrega grátis em todos os pedidos</span>
              </div>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">Grátis</Badge>
            </div>
          )}
          <div className={[
            "flex items-center justify-between p-3 rounded-xl border-2",
            freePizzaAvailable
              ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200"
              : "bg-gray-50 dark:bg-gray-900/30 border-gray-200"
          ].join(" ")}>
            <div className="flex items-center gap-2">
              <Pizza className={`w-5 h-5 ${freePizzaAvailable ? "text-orange-500" : "text-gray-400"}`} />
              <div>
                <p className="font-medium text-sm">Pizza grátis do mês</p>
                <p className="text-xs text-muted-foreground">
                  {clubPlan.freePizzaUsed
                    ? `Já utilizada este mês${clubPlan.freePizzaResetAt ? ` • renova em ${new Date(clubPlan.freePizzaResetAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}` : ""}`
                    : clubConfig?.checkoutFreePizzaLabel ?? "Pizza grátis disponível para o próximo pedido."}
                </p>
              </div>
            </div>
            {freePizzaAvailable
              ? <CheckCircle className="w-5 h-5 text-orange-500" />
              : <XCircle className="w-5 h-5 text-gray-400" />}
          </div>
          {planBenefits.length > 0 && (
            <div className="rounded-2xl border border-[#f0dfdb] bg-[#fff8f6] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d0f14]">Resumo do plano</p>
              <div className="space-y-2">
                {planBenefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2 text-sm text-[#3b1618]">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7d0f14]" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aes */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/clube" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <Crown className="w-4 h-4" /> {clubConfig?.profilePrimaryActionLabel ?? "Ver detalhes do plano"}
          </Button>
        </Link>
        <Button
          variant="outline"
          className="flex-1 text-[#6E0D12] border-[#f9d0d0] hover:bg-[#fdf2f2]"
          onClick={() => {
            if (confirm("Tem certeza que deseja cancelar sua assinatura?")) {
              if (selectedStore?.id) cancelSub.mutate({ storeId: selectedStore.id });
            }
          }}
          disabled={cancelSub.isPending}
        >
          {cancelSub.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
          Cancelar assinatura
        </Button>
      </div>
    </div>
  );
}

//  Main Component 
export default function MinhaConta() {
  const { isAuthenticated, loading, user } = useAuth();
  const { bonattoConfig } = useStore();
  const { selectedStore } = useStore();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isAuthenticated && Boolean(selectedStore?.id), refetchInterval: 60000 },
  );
  const { data: unreadAlerts } = trpc.clientAlerts.unreadCount.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: isAuthenticated && Boolean(selectedStore?.id), refetchInterval: 60000 },
  );
  const totalAvisosBadge = (unreadCount ?? 0) + (unreadAlerts ?? 0);
  const { data: points } = trpc.loyalty.points.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isAuthenticated && bonattoConfig.features.loyalty && Boolean(selectedStore?.id) },
  );
  const { data: orders } = trpc.orders.myOrders.useQuery({ storeId: selectedStore?.id }, { enabled: isAuthenticated && Boolean(selectedStore?.id), refetchInterval: 30000 });

  const activeOrdersCount = orders?.filter(o => !["delivered","cancelled"].includes(o.status)).length ?? 0;
  const ordersCount = orders?.length ?? 0;
  const [activeTab, setActiveTab] = useState<AccountTabValue>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return ACCOUNT_TABS.some((tab) => tab.value === requested) ? requested as AccountTabValue : "pedidos";
  });
  const initialRewardId = Number(new URLSearchParams(window.location.search).get("reward")) || undefined;

  const summaryCards = [
    {
      label: "Pedidos ativos",
      value: activeOrdersCount,
      helper: activeOrdersCount > 0 ? "Acompanhando em tempo real" : "Nenhum pedido em andamento",
      icon: Package,
      className: "border border-[#eadbd5] bg-white text-[#261817]",
      iconWrapClassName: "bg-[#f8e8e6] text-[#b51620]",
      mutedClassName: "text-[#887672]",
    },
    {
      label: "Avisos pendentes",
      value: totalAvisosBadge,
      helper: totalAvisosBadge > 0 ? "Atualizações esperando por você" : "Tudo em dia no momento",
      icon: BellRing,
      className: "border border-[#eadbd5] bg-white text-[#261817]",
      iconWrapClassName: "bg-[#f8e8e6] text-[#b51620]",
      mutedClassName: "text-[#7b676b]",
    },
    {
      label: `Pontos ${bonattoConfig.brand.shortName}`,
      value: points ?? 0,
      helper: points ? "Prontos para desconto e benefícios" : "Faça pedidos para começar a acumular",
      icon: Trophy,
      className: "border border-[#eadbd5] bg-white text-[#261817]",
      iconWrapClassName: "bg-[#f8e8e6] text-[#b51620]",
      mutedClassName: "text-[#887672]",
    },
  ].filter((card) => bonattoConfig.features.loyalty || card.icon !== Trophy);

  const getTabBadge = (value: AccountTabValue) => {
    if (value === "pedidos" && activeOrdersCount > 0) return activeOrdersCount;
    if (value === "notificacoes" && totalAvisosBadge > 0) return totalAvisosBadge;
    return null;
  };

  // Listener para navegação via menu hambúrguer
  useEffect(() => {
    function handleTabEvent(e: Event) {
      const tab = (e as CustomEvent).detail as AccountTabValue;
      if (tab) setActiveTab(tab);
    }
    window.addEventListener("minhaconta:tab", handleTabEvent);
    return () => window.removeEventListener("minhaconta:tab", handleTabEvent);
  }, []);

  useEffect(() => {
    const unavailable =
      ((activeTab === "fidelidade" || activeTab === "recompensas") && !bonattoConfig.features.loyalty) ||
      (activeTab === "clube" && !bonattoConfig.features.club) ||
      (activeTab === "promocoes" && !bonattoConfig.features.adminTabs.promotions) ||
      (activeTab === "sorteios" && !bonattoConfig.features.adminTabs.raffles) ||
      (activeTab === "cupons" && !bonattoConfig.features.adminTabs.coupons);
    if (unavailable) setActiveTab("pedidos");
  }, [activeTab, bonattoConfig.features]);

  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6efec]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f6efec] px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(154,21,32,0.12),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(246,239,236,0.92))]" />
      <div className="container relative flex min-h-[calc(100dvh-5rem)] max-w-4xl items-center justify-center">
        <div className="grid w-full gap-6 rounded-[32px] border border-[#e8d6d1] bg-white/90 p-6 shadow-[0_24px_80px_rgba(83,23,23,0.12)] backdrop-blur sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f0d6d0] bg-[#fff6f2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7d0f14]">
              <User className="h-3.5 w-3.5" />
              Minha conta {bonattoConfig.brand.shortName}
            </div>
            <div className="space-y-3">
              {bonattoConfig.brand.logos.icon ? <img src={bonattoConfig.brand.logos.icon} alt={bonattoConfig.brand.name} className="h-20 w-20 rounded-[24px] object-contain shadow-lg" /> : <div className="flex h-20 w-20 items-center justify-center rounded-[24px] text-xl font-black text-white shadow-lg" style={{ backgroundColor: bonattoConfig.brand.colors.primary }}>{bonattoConfig.brand.shortName.slice(0, 2).toUpperCase()}</div>}
              <h2 className="max-w-[14ch] text-3xl font-black leading-[0.95] text-[#210608]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {"Fa\u00e7a login para acompanhar seus pedidos e benef\u00edcios."}
              </h2>
              <p className="max-w-[52ch] text-sm leading-relaxed text-[#6d5a5d]">
                {`Entre na sua área para rever pedidos, salvar endereços e acompanhar pagamentos na ${bonattoConfig.brand.name}.`}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={getLoginUrl("/minha-conta")} className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 rounded-2xl bg-[#6E0D12] px-6 hover:bg-[#5a0a0f] sm:w-auto">
                  <LogIn className="h-4 w-4" />
                  Entrar ou criar conta
                </Button>
              </a>
              <Link href="/cardapio">
                <Button size="lg" variant="outline" className="w-full gap-2 rounded-2xl border-[#e7c7c7] bg-white sm:w-auto">
                  <ShoppingBag className="h-4 w-4" />
                  {"Ver card\u00e1pio"}
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: "Cupons", helper: "Ofertas e vantagens exclusivas", icon: Tag },
              { label: "Sorteios", helper: "Participa\u00e7\u00f5es e novidades da casa", icon: Ticket },
              { label: "Clube", helper: "Descontos mensais e pizza gr\u00e1tis", icon: Crown },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-[#efe1db] bg-[#fffaf8] p-4">
                <item.icon className="mb-3 h-5 w-5 text-[#7d0f14]" />
                <p className="text-sm font-semibold text-[#210608]">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#7b676b]">{item.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-[#f6efec] py-4 sm:py-10">
      <div className="container max-w-6xl space-y-4 px-3 sm:space-y-6 sm:px-6">
                {/* Header */}
        <div className="space-y-4">
          <BonattoSectionHero
            eyebrow="Seu pedaço da Bonatto"
            title={<>Olá, {user?.name?.split(" ")[0] ?? "Cliente"}!</>}
            description={`Pedidos, cupons, pontos e benefícios reunidos sem economizar sabor.`}
            aside={<div className="relative z-[1] grid h-full w-full place-items-center p-5"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#fff8ee] text-3xl font-black text-[#da1923] shadow-[0_12px_0_rgba(129,16,23,0.16)]">{(user as any)?.avatarUrl ? <img src={(user as any).avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : (user?.name ?? "U")[0].toUpperCase()}</div></div>}
          />
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            {summaryCards.map((card) => (
              <div key={card.label} className={`rounded-[18px] px-4 py-3 shadow-[0_4px_14px_rgba(57,27,24,0.04)] ${card.className}`}>
                <div className="flex items-center gap-3">
                  <div className={`inline-flex shrink-0 rounded-full p-2 ${card.iconWrapClassName}`}><card.icon className="h-3.5 w-3.5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${card.mutedClassName}`}>{card.label}</p>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <p className="text-xl font-black leading-none">{card.value}</p>
                      <p className={`truncate text-[11px] ${card.mutedClassName}`}>{card.helper}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {false && <div className="grid gap-4 rounded-[30px] border border-[#ead7d1] bg-white/90 p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-primary text-xl font-black text-white shadow-lg shadow-[#6E0D12]/20">
              {(user as any)?.avatarUrl
                ? <img src={(user as any).avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                : (user?.name ?? "U")[0].toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-2 inline-flex rounded-full border border-[#f0d6d0] bg-[#fff7f4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d0f14]">Minha conta</p>
              <h1 className="text-3xl font-black leading-[0.95] text-[#210608] sm:text-4xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {"Ol\u00e1, "}{user?.name?.split(" ")[0] ?? "Cliente"}!
              </h1>
              <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-[#6d5a5d] sm:text-base">
                {`Seu espaço para acompanhar pedidos, revisar pagamentos e aproveitar o que a ${bonattoConfig.brand.name} preparou para você.`}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {summaryCards.map((card) => (
              <div key={card.label} className={`rounded-[24px] p-4 shadow-sm ${card.className}`}>
                <div className={`inline-flex rounded-[18px] p-2 ${card.iconWrapClassName}`}>
                  <card.icon className="h-4 w-4" />
                </div>
                <p className={`mt-4 text-xs uppercase tracking-[0.16em] ${card.mutedClassName}`}>{card.label}</p>
                <p className="mt-1 text-3xl font-black">{card.value}</p>
                <p className={`mt-1 text-xs leading-relaxed ${card.mutedClassName}`}>{card.helper}</p>
              </div>
            ))}
          </div>
        </div>}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AccountTabValue)} className="space-y-4">
          {/* Desktop: TabsList horizontal */}
          <div className="hidden rounded-[28px] border border-[#ead7d1] bg-white/90 p-3 shadow-[0_18px_50px_rgba(83,23,23,0.08)] backdrop-blur sm:block">
          <TabsList className="hidden sm:grid w-full grid-cols-4 md:grid-cols-6 xl:grid-cols-12 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger value="pedidos" className="relative flex flex-col gap-1 py-2 text-xs">
              <Package className="w-4 h-4" /><span>Pedidos</span>
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeOrdersCount}</span>
              )}
            </TabsTrigger>
            {bonattoConfig.features.loyalty && <TabsTrigger value="fidelidade" className="flex flex-col gap-1 py-2 text-xs"><Trophy className="w-4 h-4" /><span>Pontos</span></TabsTrigger>}
            {bonattoConfig.features.loyalty && <TabsTrigger value="recompensas" className="flex flex-col gap-1 py-2 text-xs"><Gift className="w-4 h-4" /><span>Recompensas</span></TabsTrigger>}
            <TabsTrigger value="enderecos" className="flex flex-col gap-1 py-2 text-xs"><MapPin className="w-4 h-4" /><span>Endereços</span></TabsTrigger>
            <TabsTrigger value="notificacoes" className="relative flex flex-col gap-1 py-2 text-xs">
              {totalAvisosBadge > 0 ? <BellRing className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4" />}
              <span>Avisos</span>
              {totalAvisosBadge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7d0f14] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{totalAvisosBadge}</span>
              )}
            </TabsTrigger>
            {bonattoConfig.features.adminTabs.coupons && <TabsTrigger value="cupons" className="flex flex-col gap-1 py-2 text-xs"><Tag className="w-4 h-4" /><span>Cupons</span></TabsTrigger>}
            {bonattoConfig.features.adminTabs.promotions && <TabsTrigger value="promocoes" className="flex flex-col gap-1 py-2 text-xs"><Gift className="w-4 h-4" /><span>Promoções</span></TabsTrigger>}
            {bonattoConfig.features.adminTabs.raffles && <TabsTrigger value="sorteios" className="flex flex-col gap-1 py-2 text-xs"><Ticket className="w-4 h-4" /><span>Sorteios</span></TabsTrigger>}
            <TabsTrigger value="perfil" className="flex flex-col gap-1 py-2 text-xs"><User className="w-4 h-4" /><span>Perfil</span></TabsTrigger>
            {bonattoConfig.features.club && <TabsTrigger value="clube" className="flex flex-col gap-1 py-2 text-xs"><Crown className="w-4 h-4 text-[#7d0f14]" /><span className="text-[#6E0D12] font-semibold">Clube</span></TabsTrigger>}
            <TabsTrigger value="pagamentos" className="flex flex-col gap-1 py-2 text-xs"><Receipt className="w-4 h-4" /><span>Pagamentos</span></TabsTrigger>
            <TabsTrigger value="cartoes" className="flex flex-col gap-1 py-2 text-xs"><CreditCard className="w-4 h-4" /><span>Cartões</span></TabsTrigger>
            <TabsTrigger value="carrinhos" className="relative flex flex-col gap-1 py-2 text-xs"><ShoppingCart className="w-4 h-4" /><span>Salvos</span></TabsTrigger>
          </TabsList>
          </div>



          <div className="min-w-0 overflow-hidden rounded-[20px] border border-[#ead7d1] bg-white/90 p-2 shadow-[0_18px_50px_rgba(83,23,23,0.08)] backdrop-blur sm:rounded-[28px] sm:p-4">
            <TabsContent value="pedidos" className="mt-0"><OrdersTab /></TabsContent>
          {bonattoConfig.features.loyalty && <TabsContent value="fidelidade" className="mt-0"><LoyaltyTab /></TabsContent>}
          {bonattoConfig.features.loyalty && selectedStore?.id && <TabsContent value="recompensas" className="mt-0"><RewardsCatalog storeId={selectedStore.id} initialRewardId={initialRewardId} /></TabsContent>}
          <TabsContent value="enderecos" className="mt-0"><AddressesTab /></TabsContent>
          <TabsContent value="notificacoes" className="mt-0"><NotificationsTab /></TabsContent>
          {bonattoConfig.features.adminTabs.coupons && <TabsContent value="cupons" className="mt-0"><CouponsTab /></TabsContent>}
          {bonattoConfig.features.adminTabs.promotions && <TabsContent value="promocoes" className="mt-0"><PromotionsTab /></TabsContent>}
          {bonattoConfig.features.adminTabs.raffles && <TabsContent value="sorteios" className="mt-0"><RafflesTab /></TabsContent>}
          <TabsContent value="perfil" className="mt-0"><ProfileTab /></TabsContent>
          {bonattoConfig.features.club && <TabsContent value="clube" className="mt-0"><ClubMemberTab /></TabsContent>}
          <TabsContent value="pagamentos" className="mt-0"><PaymentsTab /></TabsContent>
          <TabsContent value="cartoes" className="mt-0"><SavedCards /></TabsContent>
          <TabsContent value="carrinhos" className="mt-0"><AbandonedCartsTab /></TabsContent>
          </div>
        </Tabs>

        {/* Espa?o para n?o sobrepor o rodap? fixo no mobile */}
        <div className="h-[calc(5rem+env(safe-area-inset-bottom))] sm:hidden" />
      </div>

      {/* Barra de rodap? fixa no mobile */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#ead7d1] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
        <div className="grid h-16 grid-cols-5">
          {[
            { value: "pedidos", icon: <Package className="w-5 h-5" />, label: "Pedidos", badge: activeOrdersCount > 0 ? activeOrdersCount : null },
            bonattoConfig.features.loyalty
              ? { value: "fidelidade", icon: <Trophy className="w-5 h-5" />, label: "Pontos", badge: null }
              : { value: "enderecos", icon: <MapPin className="w-5 h-5" />, label: "Endereços", badge: null },
            { href: "/cardapio", icon: <ShoppingBag className="w-6 h-6" />, label: "Cardápio", badge: null, isLink: true },
            { value: "notificacoes", icon: totalAvisosBadge > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />, label: "Avisos", badge: totalAvisosBadge > 0 ? totalAvisosBadge : null },
            { value: "perfil", icon: <User className="w-5 h-5" />, label: "Perfil", badge: null },
          ].map((item, idx) =>
            (item as any).isLink ? (
              <Link key={idx} href={(item as any).href} className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-md -mt-4">
                  {item.icon}
                </div>
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </Link>
            ) : (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTab((item as any).value)}
                className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  activeTab === (item as any).value ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.badge !== null && (
                  <span className="absolute top-2 right-[calc(50%-18px)] min-w-[16px] h-[16px] bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">{item.badge}</span>
                )}
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
