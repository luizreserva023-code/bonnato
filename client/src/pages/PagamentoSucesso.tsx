import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function PagamentoSucesso() {
  const [, setLocation] = useLocation();
  const [orderId, setOrderId] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId");
    if (id) setOrderId(parseInt(id));
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const { data: order, isLoading } = trpc.orders.byId.useQuery(
    { id: orderId! },
    { enabled: !!orderId }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div
        className={`max-w-md w-full text-center space-y-6 transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Ícone animado */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-full bg-green-100 flex items-center justify-center shadow-lg">
            <CheckCircle className="w-14 h-14 text-green-500" strokeWidth={2} />
          </div>
        </div>

        {/* Título */}
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Pagamento Confirmado! 🎉</h1>
          <p className="text-gray-500 text-lg">
            Seu pagamento foi processado com sucesso e o pedido já está sendo preparado.
          </p>
        </div>

        {/* Detalhes do pedido */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : order ? (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Pedido</span>
              <span className="font-bold text-gray-900">#{order.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Confirmado
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total pago</span>
              <span className="font-black text-lg text-green-600">
                R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Pagamento</span>
              <span className="font-medium text-gray-700">
                {order.paymentStatus === "paid" ? "✅ Pago" : "⏳ Aguardando confirmação"}
              </span>
            </div>
          </div>
        ) : orderId ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-gray-500 text-sm">Pedido #{orderId} registrado com sucesso.</p>
          </div>
        ) : null}

        {/* Mensagem de próximos passos */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-left">
          <p className="text-sm text-orange-700 font-medium mb-1">🍕 O que acontece agora?</p>
          <ul className="text-sm text-orange-600 space-y-1">
            <li>• Seu pedido foi confirmado automaticamente</li>
            <li>• A cozinha já está preparando sua pizza</li>
            <li>• Você pode acompanhar o status em "Meus Pedidos"</li>
          </ul>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-3">
          <Link href="/minha-conta">
            <Button className="w-full gap-2" size="lg">
              <ShoppingBag className="w-4 h-4" />
              Ver Meus Pedidos
            </Button>
          </Link>
          <Link href="/cardapio">
            <Button variant="outline" className="w-full gap-2" size="lg">
              Voltar ao Cardápio
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
