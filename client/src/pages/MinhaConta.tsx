import { OrderChat } from "@/components/OrderChat";
import { SavedCards } from "@/components/SavedCards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Bell, BellOff, BellRing, ChevronDown, ChevronUp, Clock, CreditCard, Gift, Heart, Home, LogIn,
  Loader2, MapPin, Package, Plus, RotateCcw, Share2, ShoppingBag, Smartphone, Star, Tag, Ticket, Trash2,
  TrendingUp, Trophy, User, Zap, Crown, Truck, Pizza, CheckCircle, XCircle, QrCode, Receipt,
  ShoppingCart, AlertCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { ClientAlertsBanner } from "@/components/ClientAlertsBanner";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

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

// ─── Status Progress Bar ──────────────────────────────────────────────────────
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
              {i < info.step ? "✓" : i === info.step ? "●" : "○"}
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

// ─── Delivery Rating Section ──────────────────────────────────────────────────
function DeliveryRatingSection({ orderId }: { orderId: number }) {
  const { data: existing, isLoading, refetch } = trpc.ratings.getByOrder.useQuery({ orderId });
  const submitRating = trpc.ratings.submit.useMutation({
    onSuccess: () => { toast.success("Avaliação enviada! Obrigado pelo feedback ❤️"); refetch(); },
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
          <Star className="w-3.5 h-3.5 text-yellow-500" /> Sua Avaliação
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
            {submitRating.isPending ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Order Items Expand ───────────────────────────────────────────────────────
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

// ─── Abandoned Carts Tab ──────────────────────────────────────────────────────────────────────────────────────────────
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

// ─── Orders Tab ──────────────────────────────────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, { refetchInterval: 30000 });
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const orderRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Tratar parâmetro ?avaliar=X da URL (notificação push pós-entrega)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const avaliarId = params.get("avaliar");
    if (!avaliarId || !orders?.length) return;
    const orderId = parseInt(avaliarId);
    if (isNaN(orderId)) return;
    // Expandir o pedido e rolar até ele
    setExpandedId(orderId);
    setTimeout(() => {
      const el = orderRefs.current[orderId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    // Limpar o parâmetro da URL sem recarregar
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
      <p className="text-sm mt-2 mb-6">Faça seu primeiro pedido agora!</p>
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
                    <span>🏙️</span>Rastrear Entrega ao Vivo
                  </button>
                </Link>
              )}
              {order.status === "delivered" && order.driverId && <DeliveryRatingSection orderId={order.id} />}
              {["pending", "confirmed", "preparing", "out_for_delivery"].includes(order.status) && (
                <div className="mt-3">
                  <OrderChat orderId={order.id} currentUserRole="customer" currentUserName={user?.name?.split(" ")[0] ?? "Cliente"} currentUserAvatarUrl={(user as any)?.avatarUrl ?? null} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Loyalty Tab ──────────────────────────────────────────────────────────────
function LoyaltyTab() {
  const { data: points, isLoading: loadingPoints } = trpc.loyalty.points.useQuery();
  const { data: history, isLoading: loadingHistory } = trpc.loyalty.spendingHistory.useQuery();
  const { data: txHistory, isLoading: loadingTxHistory } = trpc.loyalty.history.useQuery();

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
              <span className="text-base leading-none mt-0.5">⭐</span>
              <span><strong>Ganhe pontos:</strong> A cada R$ 1,00 gasto em pedidos entregues, você recebe <strong>1 ponto</strong> automaticamente.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🎁</span>
              <span><strong>Use como desconto:</strong> Na tela de pagamento do pedido, use seus pontos. <strong>10 pontos = R$ 1,00</strong> de desconto.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">📋</span>
              <span><strong>Mínimo para resgatar:</strong> 50 pontos (equivale a R$ 5,00 de desconto).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🏆</span>
              <span><strong>Níveis:</strong> Bronze (0) → Prata (100) → Ouro (300) → Diamante (600) → VIP (1.000+). Quanto mais alto seu nível, mais benefícios em breve!</span>
            </div>
          </div>
          <a href="/checkout" className="inline-block mt-1 text-xs font-semibold text-yellow-700 underline underline-offset-2">Fazer um pedido agora →</a>
        </CardContent>
      </Card>

      {/* Extrato de Pontos */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Extrato de Pontos</CardTitle></CardHeader>
        <CardContent>
          {loadingTxHistory ? <Skeleton className="h-40 w-full" /> : !txHistory?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação de pontos ainda.</p>
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

// ─── Addresses Tab ────────────────────────────────────────────────────────────
function AddressesTab() {
  const { data: addresses, isLoading, refetch } = trpc.addresses.list.useQuery();
  const createAddress = trpc.addresses.create.useMutation({ onSuccess: () => { toast.success("Endereço salvo!"); refetch(); setOpen(false); resetForm(); }, onError: e => toast.error(e.message) });
  const deleteAddress = trpc.addresses.delete.useMutation({ onSuccess: () => { toast.success("Endereço removido."); refetch(); }, onError: e => toast.error(e.message) });
  const updateAddress = trpc.addresses.update.useMutation({ onSuccess: () => { toast.success("Endereço atualizado!"); refetch(); setOpen(false); setEditId(null); resetForm(); }, onError: e => toast.error(e.message) });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ label: "", address: "", cep: "", city: "", isDefault: false });

  function resetForm() { setForm({ label: "", address: "", cep: "", city: "", isDefault: false }); }

  function startEdit(a: typeof addresses extends (infer T)[] | undefined ? T : never) {
    if (!a) return;
    setEditId((a as any).id);
    setForm({ label: (a as any).label, address: (a as any).address, cep: (a as any).cep ?? "", city: (a as any).city ?? "", isDefault: (a as any).isDefault ?? false });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.label || !form.address) { toast.error("Preencha o nome e o endereço."); return; }
    if (editId) updateAddress.mutate({ id: editId, ...form });
    else createAddress.mutate(form);
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
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar Endereço" : "Novo Endereço"}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Nome (ex: Casa, Trabalho)</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Casa" />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço completo</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} placeholder="00000-000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                Definir como endereço padrão
              </label>
              <Button className="w-full" onClick={handleSubmit} disabled={createAddress.isPending || updateAddress.isPending}>
                {createAddress.isPending || updateAddress.isPending ? "Salvando..." : editId ? "Salvar Alterações" : "Adicionar Endereço"}
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
                    {(a.cep || a.city) && <p className="text-xs text-muted-foreground">{[a.cep, a.city].filter(Boolean).join(" · ")}</p>}
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

// ─── Notifications Tab ────────────────────────────────────────────────────────
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
                ? "Ativo — você recebe alertas sobre seus pedidos."
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
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });

  useEffect(() => {
    if (notifications?.some(n => !n.read)) markRead.mutate();
  }, [notifications?.length]);

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
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              {TYPE_ICONS[n.type] ?? <Bell className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">{n.title}</p>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              </div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
  const { data: profile, isLoading, refetch } = trpc.profile.me.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("Perfil atualizado!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadAvatar = trpc.avatar.upload.useMutation({
    onSuccess: (data) => { toast.success("Foto atualizada!"); setAvatarPreview(data.url); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", phone: "", savedAddress: "", savedCep: "", savedCity: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({ name: profile.name ?? "", phone: profile.phone ?? "", savedAddress: profile.savedAddress ?? "", savedCep: profile.savedCep ?? "", savedCity: profile.savedCity ?? "" });
    }
  }, [profile?.name, profile?.phone, profile?.savedAddress, profile?.savedCep, profile?.savedCity]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      uploadAvatar.mutate({ base64, mimeType: (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
    };
    reader.readAsDataURL(file);
  }

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const avatarSrc = avatarPreview ?? (profile as any)?.avatarUrl ?? null;

  return (
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
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline mt-1">Alterar foto de perfil</button>
          </div>
        </div>

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
        <div className="space-y-1.5">
          <Label>Endereço salvo</Label>
          <Input value={form.savedAddress} onChange={(e) => setForm((f) => ({ ...f, savedAddress: e.target.value }))} placeholder="Rua, número, bairro" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>CEP</Label>
            <Input value={form.savedCep} onChange={(e) => setForm((f) => ({ ...f, savedCep: e.target.value }))} placeholder="00000-000" />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={form.savedCity} onChange={(e) => setForm((f) => ({ ...f, savedCity: e.target.value }))} placeholder="Sua cidade" />
          </div>
        </div>
        <Button className="w-full" onClick={() => updateProfile.mutate(form)} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Salvando..." : "Salvar Dados"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Coupons Tab ──────────────────────────────────────────────────────────────
function CouponsTab() {
  const { data: coupons, isLoading } = trpc.profile.myCoupons.useQuery();
  const { data: allCoupons } = trpc.coupons.listActive.useQuery();
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
                      {c.minOrderValue && parseFloat(c.minOrderValue) > 0 && ` · Mínimo R$ ${parseFloat(c.minOrderValue).toFixed(2)}`}
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
            <Tag className="w-4 h-4" />Cupons Disponíveis
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
          <p className="text-sm mt-2">Fique de olho! Em breve teremos promoções exclusivas para você.</p>
        </div>
      )}
    </div>
  );
}

// ─── Promotions Tab ───────────────────────────────────────────────────────────
function PromotionsTab() {
  const { data: promotions, isLoading } = trpc.promotions.active.useQuery();
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

// ─── Raffles Tab ──────────────────────────────────────────────────────────────
function RafflesTab() {
  const { data: raffles, isLoading, refetch } = trpc.raffles.active.useQuery();
  const enterRaffle = trpc.raffles.enter.useMutation({
    onSuccess: (ok) => { if (ok) { toast.success("Você entrou no sorteio! Boa sorte! 🎉"); refetch(); } else toast.info("Você já está participando deste sorteio."); },
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
        <Card key={raffle.id} className="overflow-hidden border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Prêmio</p>
              <p className="font-bold text-lg text-primary flex items-center gap-2"><Gift className="w-5 h-5" />{raffle.prize}</p>
            </div>
            {raffle.endsAt && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Encerra em {new Date(raffle.endsAt).toLocaleDateString("pt-BR")}</p>}
            <Button className="w-full" onClick={() => enterRaffle.mutate({ raffleId: raffle.id })} disabled={enterRaffle.isPending}>
              <Ticket className="w-4 h-4 mr-2" />{enterRaffle.isPending ? "Participando..." : "Participar do Sorteio"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────
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
                      {" · "}
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
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
// ─── Club Member Tab ─────────────────────────────────────────────────────
function ClubMemberTab() {
  const { isAuthenticated } = useAuth();
  const { data: clubPlan, isLoading } = trpc.club.getMyPlan.useQuery(undefined, { enabled: isAuthenticated });
  const useFreePizza = trpc.club.useFreePizza.useMutation({
    onSuccess: () => toast.success("Pizza grátis marcada! Será aplicada no seu próximo pedido."),
    onError: (e) => toast.error(e.message),
  });
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

  // Não é membro — mostrar convite
  if (!clubPlan || (!isActive && !isPending)) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#2d0305] via-zinc-900 to-zinc-950 border border-[#3a0608]/50 shadow-2xl p-8 text-center">
          <Crown className="w-12 h-12 text-[#7d0f14] mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white mb-2">Você ainda não é membro</h2>
          <p className="text-zinc-400 mb-6">Assine o Clube do Bonatto e tenha descontos exclusivos, entrega grátis e uma pizza grátis todo mês!</p>
          <div className="flex gap-4 justify-center mb-6">
            <div className="bg-zinc-800 rounded-2xl p-4 text-center">
              <Crown className="w-5 h-5 text-[#7d0f14] mx-auto mb-1" />
              <p className="text-white font-black">Bonattão</p>
              <p className="text-[#a01218] font-black text-xl">R$ 19<span className="text-xs text-zinc-400">/mês</span></p>
              <p className="text-xs text-zinc-400 mt-1">20% OFF + Frete grátis + Pizza grátis</p>
            </div>
            <div className="bg-zinc-800 rounded-2xl p-4 text-center">
              <Star className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
              <p className="text-white font-black">Básico</p>
              <p className="text-zinc-300 font-black text-xl">R$ 9,99<span className="text-xs text-zinc-400">/mês</span></p>
              <p className="text-xs text-zinc-400 mt-1">15% OFF + Pizza grátis</p>
            </div>
          </div>
          <Link href="/clube">
            <Button className="bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white font-bold px-8 py-3 rounded-2xl">
              <Crown className="w-4 h-4 mr-2" /> Assinar agora
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
            <p className="text-xs text-yellow-600 mt-3">Plano: <strong>{clubPlan.plan === "bonattao" ? "Bonattão" : "Básico"}</strong></p>
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
          ? "bg-gradient-to-br from-[#5a0a0f] via-[#450709] to-zinc-900"
          : "bg-gradient-to-br from-blue-700 via-blue-800 to-zinc-900"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isBonattao ? <Crown className="w-8 h-8 text-yellow-300" /> : <Star className="w-8 h-8 text-blue-300" />}
            <div>
              <p className="text-white/70 text-sm">Plano ativo</p>
              <h2 className="text-2xl font-black">{isBonattao ? "Bonattão" : "Básico"}</h2>
            </div>
          </div>
          <span className="bg-green-400/20 border border-green-400/40 text-green-300 text-xs font-bold px-3 py-1 rounded-full">
            ✓ Ativo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-0.5">Membro desde</p>
            <p className="font-bold">{clubPlan.startDate ? new Date(clubPlan.startDate).toLocaleDateString("pt-BR") : "—"}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-0.5">Próxima renovação</p>
            <p className="font-bold">{clubPlan.nextBillingDate ? new Date(clubPlan.nextBillingDate).toLocaleDateString("pt-BR") : "—"}</p>
          </div>
        </div>
      </div>

      {/* Benefícios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#7d0f14]" /> Seus benefícios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-sm">{isBonattao ? "20%" : "15%"} de desconto em todos os pedidos</span>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200">{isBonattao ? "-20%" : "-15%"}</Badge>
          </div>
          {isBonattao && (
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
            clubPlan.freePizzaUsed
              ? "bg-gray-50 dark:bg-gray-900/30 border-gray-200"
              : "bg-orange-50 dark:bg-orange-950/30 border-orange-200"
          ].join(" ")}>
            <div className="flex items-center gap-2">
              <Pizza className={`w-5 h-5 ${clubPlan.freePizzaUsed ? "text-gray-400" : "text-orange-500"}`} />
              <div>
                <p className="font-medium text-sm">Pizza grátis do mês</p>
                <p className="text-xs text-muted-foreground">
                  {clubPlan.freePizzaUsed
                    ? `Já utilizada este mês${clubPlan.freePizzaResetAt ? ` — renova em ${new Date(clubPlan.freePizzaResetAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}` : ' — renova dia 1º'}`
                    : "Disponível! Será aplicada automaticamente no checkout."}
                </p>
              </div>
            </div>
            {clubPlan.freePizzaUsed
              ? <XCircle className="w-5 h-5 text-gray-400" />
              : <CheckCircle className="w-5 h-5 text-orange-500" />}
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/clube" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <Crown className="w-4 h-4" /> Ver detalhes do plano
          </Button>
        </Link>
        <Button
          variant="outline"
          className="flex-1 text-[#6E0D12] border-[#f9d0d0] hover:bg-[#fdf2f2]"
          onClick={() => {
            if (confirm("Tem certeza que deseja cancelar sua assinatura?")) {
              cancelSub.mutate();
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

// ─── Main Component ─────────────────────────────────────────────────────
export default function MinhaConta() {
  const { isAuthenticated, loading, user } = useAuth();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60000 });
  const { data: unreadAlerts } = trpc.clientAlerts.unreadCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60000 });
  const totalAvisosBadge = (unreadCount ?? 0) + (unreadAlerts ?? 0);
  const { data: points } = trpc.loyalty.points.useQuery(undefined, { enabled: isAuthenticated });
  const { data: orders } = trpc.orders.myOrders.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 30000 });

  const activeOrdersCount = orders?.filter(o => !["delivered","cancelled"].includes(o.status)).length ?? 0;
  const [activeTab, setActiveTab] = useState("pedidos");

  // Listener para navegação via menu hambúrguer
  useEffect(() => {
    function handleTabEvent(e: Event) {
      const tab = (e as CustomEvent).detail as string;
      if (tab) setActiveTab(tab);
    }
    window.addEventListener("minhaconta:tab", handleTabEvent);
    return () => window.removeEventListener("minhaconta:tab", handleTabEvent);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <img src={LOGO_URL} alt="Bonatto Pizza" className="w-24 h-24 rounded-full shadow-lg" />
      <div className="text-center">
        <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>Faça login para acessar sua conta</h2>
        <p className="text-muted-foreground">Crie sua conta gratuitamente e acesse cupons exclusivos, promoções e sorteios!</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/login?returnTo=/minha-conta">
          <Button size="lg" className="gap-2 w-full sm:w-auto"><LogIn className="w-4 h-4" />Entrar / Criar Conta</Button>
        </Link>
        <Link href="/cardapio">
          <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto"><ShoppingBag className="w-4 h-4" />Ver Cardápio</Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-black text-xl shrink-0 overflow-hidden">
            {(user as any)?.avatarUrl
              ? <img src={(user as any).avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : (user?.name ?? "U")[0].toUpperCase()
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Olá, {user?.name?.split(" ")[0] ?? "Cliente"}! 👋
            </h1>
            <p className="text-muted-foreground text-sm">Bem-vindo ao seu painel Bonatto Pizza</p>
          </div>
          {points !== undefined && points > 0 && (
            <div className="shrink-0 bg-primary/10 text-primary rounded-xl px-3 py-2 text-center">
              <p className="text-xs font-medium">Pontos</p>
              <p className="text-lg font-black">{points}</p>
            </div>
          )}
        </div>



        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Desktop: TabsList horizontal */}
          <TabsList className="hidden sm:grid w-full mb-6 grid-cols-12 h-auto gap-1">
            <TabsTrigger value="pedidos" className="relative flex flex-col gap-1 py-2 text-xs">
              <Package className="w-4 h-4" /><span>Pedidos</span>
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeOrdersCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fidelidade" className="flex flex-col gap-1 py-2 text-xs"><Trophy className="w-4 h-4" /><span>Pontos</span></TabsTrigger>
            <TabsTrigger value="enderecos" className="flex flex-col gap-1 py-2 text-xs"><MapPin className="w-4 h-4" /><span>Endereços</span></TabsTrigger>
            <TabsTrigger value="notificacoes" className="relative flex flex-col gap-1 py-2 text-xs">
              {totalAvisosBadge > 0 ? <BellRing className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4" />}
              <span>Avisos</span>
              {totalAvisosBadge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7d0f14] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{totalAvisosBadge}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cupons" className="flex flex-col gap-1 py-2 text-xs"><Tag className="w-4 h-4" /><span>Cupons</span></TabsTrigger>
            <TabsTrigger value="promocoes" className="flex flex-col gap-1 py-2 text-xs"><Gift className="w-4 h-4" /><span>Promoções</span></TabsTrigger>
            <TabsTrigger value="sorteios" className="flex flex-col gap-1 py-2 text-xs"><Ticket className="w-4 h-4" /><span>Sorteios</span></TabsTrigger>
            <TabsTrigger value="perfil" className="flex flex-col gap-1 py-2 text-xs"><User className="w-4 h-4" /><span>Perfil</span></TabsTrigger>
            <TabsTrigger value="clube" className="flex flex-col gap-1 py-2 text-xs"><Crown className="w-4 h-4 text-[#7d0f14]" /><span className="text-[#6E0D12] font-semibold">Clube</span></TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex flex-col gap-1 py-2 text-xs"><Receipt className="w-4 h-4" /><span>Pagamentos</span></TabsTrigger>
            <TabsTrigger value="cartoes" className="flex flex-col gap-1 py-2 text-xs"><CreditCard className="w-4 h-4" /><span>Cartões</span></TabsTrigger>
            <TabsTrigger value="carrinhos" className="relative flex flex-col gap-1 py-2 text-xs"><ShoppingCart className="w-4 h-4" /><span>Salvos</span></TabsTrigger>
          </TabsList>



          <TabsContent value="pedidos"><OrdersTab /></TabsContent>
          <TabsContent value="fidelidade"><LoyaltyTab /></TabsContent>
          <TabsContent value="enderecos"><AddressesTab /></TabsContent>
          <TabsContent value="notificacoes"><NotificationsTab /></TabsContent>
          <TabsContent value="cupons"><CouponsTab /></TabsContent>
          <TabsContent value="promocoes"><PromotionsTab /></TabsContent>
          <TabsContent value="sorteios"><RafflesTab /></TabsContent>
          <TabsContent value="perfil"><ProfileTab /></TabsContent>
          <TabsContent value="clube"><ClubMemberTab /></TabsContent>
          <TabsContent value="pagamentos"><PaymentsTab /></TabsContent>
          <TabsContent value="cartoes"><SavedCards /></TabsContent>
          <TabsContent value="carrinhos"><AbandonedCartsTab /></TabsContent>
        </Tabs>

        {/* Espaço para não sobrepor o rodapé fixo no mobile */}
        <div className="h-24 sm:hidden" />
      </div>

      {/* Barra de rodapé fixa no mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-5 h-16">
          {[
            { value: "pedidos", icon: <Package className="w-5 h-5" />, label: "Pedidos", badge: activeOrdersCount > 0 ? activeOrdersCount : null },
            { value: "fidelidade", icon: <Trophy className="w-5 h-5" />, label: "Pontos", badge: null },
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
