import { useEffect, useState } from "react";
import { Link } from "wouter";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PagamentoCancelado() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get("orderId"));
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f2] to-white flex items-center justify-center p-4">
      <div
        className={`max-w-md w-full text-center space-y-6 transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Ícone */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-full bg-[#fce8e8] flex items-center justify-center shadow-lg">
            <XCircle className="w-14 h-14 text-[#a01218]" strokeWidth={2} />
          </div>
        </div>

        {/* Título */}
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Pagamento Cancelado</h1>
          <p className="text-gray-500 text-lg">
            Você cancelou o pagamento. Seu pedido ainda está salvo e pode ser pago a qualquer momento.
          </p>
        </div>

        {/* Info */}
        {orderId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Pedido <strong className="text-gray-700">#{orderId}</strong> aguardando pagamento.
            </p>
          </div>
        )}

        {/* Opções */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
          <p className="text-sm text-blue-700 font-medium mb-1">💡 O que você pode fazer?</p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>• Tentar novamente com outro cartão</li>
            <li>• Escolher pagar em dinheiro na entrega</li>
            <li>• Entrar em contato pelo WhatsApp</li>
          </ul>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-3">
          {orderId && (
            <Link href="/minha-conta">
              <Button className="w-full gap-2" size="lg">
                <RefreshCw className="w-4 h-4" />
                Ver Meu Pedido
              </Button>
            </Link>
          )}
          <Link href="/cardapio">
            <Button variant="outline" className="w-full gap-2" size="lg">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Cardápio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
