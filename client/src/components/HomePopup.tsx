import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Tag, Clock, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ShinyButton } from "@/components/ui/shiny-button";

const POPUP_SESSION_KEY = "bonatto_popup_shown";
const POPUP_DELAY_MS = 60_000; // 1 minuto

export function HomePopup() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(15); // urgency countdown after popup opens
  const [, setLocation] = useLocation();

  const { data: couponData } = trpc.coupons.getHomePopupCoupon.useQuery(undefined, {
    staleTime: Infinity,
  });

  // Show popup after POPUP_DELAY_MS, only once per session
  useEffect(() => {
    if (sessionStorage.getItem(POPUP_SESSION_KEY)) return;

    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(POPUP_SESSION_KEY, "1");
    }, POPUP_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // Urgency countdown (15 → 0 minutes display)
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 60_000); // decrement every real minute
    return () => clearInterval(interval);
  }, [visible]);

  const handleClose = useCallback(() => setVisible(false), []);

  const handleCopy = useCallback(() => {
    if (!couponData?.code) return;
    navigator.clipboard.writeText(couponData.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [couponData]);

  const handleCTA = useCallback(() => {
    handleClose();
    setLocation("/cardapio");
  }, [handleClose, setLocation]);

  if (!visible || !couponData?.active) return null;

  const code = couponData.code;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Popup card — mobile: centralizado verticalmente com scroll se necessário */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Oferta exclusiva"
        className="fixed z-[9999] inset-0 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[90dvh] flex flex-col">

          {/* Header banner */}
          <div className="relative bg-gradient-to-br from-[#6E0D12] via-[#8B1016] to-[#4a0a0d] px-6 pt-8 pb-8 text-white text-center overflow-hidden flex-shrink-0">
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute -bottom-12 -left-6 w-40 h-40 bg-white/5 rounded-full" />

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Urgency badge */}
            <div className="inline-flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              Oferta por tempo limitado
            </div>

            {/* Headline */}
            <h2 className="text-2xl font-black leading-tight mb-2">
              Espera! 🍕<br />
              <span className="text-yellow-300">10% OFF</span> no seu<br />
              primeiro pedido
            </h2>

            <p className="text-white/80 text-sm leading-relaxed">
              Você ficou aqui e a gente notou.<br />
              Que tal uma pizza fresquinha com desconto especial?
            </p>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1">
            {/* Coupon section */}
            <div className="px-6 py-4 bg-[#fdf2f2]">
              <p className="text-xs text-gray-500 text-center mb-2 font-medium uppercase tracking-wide">
                Seu cupom exclusivo
              </p>

              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-between bg-white border-2 border-dashed border-[#6E0D12] rounded-xl px-4 py-3 group hover:bg-[#fce8e8] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#6E0D12]" />
                  <span className="text-xl font-black text-[#6E0D12] tracking-widest">{code}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-[#6E0D12]">
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </div>
              </button>

              <p className="text-xs text-gray-400 text-center mt-2">
                Clique para copiar · Use no checkout · Sem valor mínimo
              </p>
            </div>

            {/* Benefits list */}
            <div className="px-6 py-3">
              <ul className="space-y-1.5">
                {[
                  "✅ Desconto de 10% em qualquer pedido",
                  "🚀 Entrega em até 60 minutos",
                  "🔥 Massa artesanal feita na hora",
                ].map((item) => (
                  <li key={item} className="text-sm text-gray-600 flex items-start gap-2">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6 pt-3 space-y-2">
              <ShinyButton className="w-full h-14" onClick={handleCTA}>
                <span className="flex items-center justify-center gap-2">
                  Pedir Agora com 10% OFF
                  <ChevronRight className="w-5 h-5" />
                </span>
              </ShinyButton>

              {countdown > 0 && (
                <p className="text-center text-xs text-gray-400">
                  ⏰ Oferta válida por mais{" "}
                  <span className="font-semibold text-[#6E0D12]">{countdown} min</span>
                </p>
              )}

              <button
                onClick={handleClose}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
              >
                Não, obrigado
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
