import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, Clock, LogIn, Package, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmado", color: "bg-blue-100 text-blue-800" },
  preparing: { label: "Preparando", color: "bg-orange-100 text-orange-800" },
  out_for_delivery: { label: "Saiu p/ Entrega", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", color: "bg-[#fce8e8] text-[#450709]" },
};

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  pix: "PIX",
  cash: "Dinheiro",
};

function OrderItemsDetail({ orderId }: { orderId: number }) {
  const { data, isLoading } = trpc.orders.byId.useQuery({ id: orderId });
  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (!data?.items?.length) {
    return <p className="mt-3 pt-3 border-t text-sm text-muted-foreground">Nenhum item encontrado.</p>;
  }
  return (
    <div className="mt-3 pt-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Itens do Pedido</p>
      <div className="space-y-2">
        {data.items.map((item) => (
          <div key={item.id} className="flex justify-between items-start text-sm">
            <div>
              <span className="font-medium">{item.quantity}x {item.productName}</span>
              {item.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">Obs: {item.notes}</p>
              )}
            </div>
            <span className="font-bold text-primary shrink-0 ml-3">
              R$ {parseFloat(item.subtotal).toFixed(2).replace(".", ",")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MeusPedidos() {
  const { isAuthenticated, loading } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Poll every 30s so the customer can see status updates in real time
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
        <LogIn className="w-16 h-16 text-muted-foreground opacity-30" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Faça login para ver seus pedidos</h2>
          <p className="text-muted-foreground">Acesse sua conta para acompanhar o histórico de pedidos</p>
        </div>
        <Link href="/login?returnTo=/meus-pedidos">
          <Button size="lg" className="gap-2">
            <LogIn className="w-4 h-4" />
            Entrar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-3xl">
        <h1 className="text-3xl font-black mb-8" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Meus Pedidos
        </h1>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/3 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">Nenhum pedido ainda</p>
            <p className="text-sm mt-2 mb-6">Faça seu primeiro pedido agora!</p>
            <Link href="/cardapio">
              <Button className="gap-2">
                <ShoppingBag className="w-4 h-4" />
                Ver Cardápio
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders?.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-800" };
              const isExpanded = expandedId === order.id;
              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Pedido #{order.id}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(order.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Badge className={`${statusInfo.color} border-0 shrink-0`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Endereço</p>
                        <p className="font-medium">{order.deliveryAddress}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pagamento</p>
                        <p className="font-medium">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
                      </div>
                    </div>

                    {/* Expand items */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? "Ocultar itens" : "Ver itens do pedido"}
                    </button>
                    {isExpanded && <OrderItemsDetail orderId={order.id} />}

                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <span className="text-muted-foreground text-sm">Total</span>
                      <span className="font-black text-primary text-lg">
                        R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    {order.status === "out_for_delivery" && (
                      <Link href={`/rastrear/${order.id}`}>
                        <button className="mt-3 w-full flex items-center justify-center gap-2 bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                          <span>🏍️</span>
                          Rastrear Entrega ao Vivo
                        </button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
