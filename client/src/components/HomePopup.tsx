import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ChevronRight, Clock, Copy, Flame, Tag, Truck, X } from "lucide-react";

import { trpc } from "@/lib/trpc";

const POPUP_SESSION_KEY = "bonatto_popup_shown";
const POPUP_DELAY_MS = 60_000;

export function HomePopup() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [couponQueryEnabled, setCouponQueryEnabled] = useState(false);
  const [, setLocation] = useLocation();

  const { data: couponData } = trpc.coupons.getHomePopupCoupon.useQuery(undefined, {
    enabled: couponQueryEnabled,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (sessionStorage.getItem(POPUP_SESSION_KEY)) return;

    // The popup only appears after one minute. Do not spend critical startup
    // bandwidth on its coupon; prefetch shortly before it can become visible.
    const prefetchTimer = window.setTimeout(
      () => setCouponQueryEnabled(true),
      Math.max(0, POPUP_DELAY_MS - 10_000),
    );
    const showTimer = window.setTimeout(() => {
      setCouponQueryEnabled(true);
      setVisible(true);
      sessionStorage.setItem(POPUP_SESSION_KEY, "1");
    }, POPUP_DELAY_MS);

    return () => {
      window.clearTimeout(prefetchTimer);
      window.clearTimeout(showTimer);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [visible]);

  const handleClose = useCallback(() => setVisible(false), []);

  const handleCopy = useCallback(() => {
    if (!couponData?.code) return;
    void navigator.clipboard.writeText(couponData.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    });
  }, [couponData?.code]);

  const handleCTA = useCallback(() => {
    handleClose();
    setLocation("/cardapio");
  }, [handleClose, setLocation]);

  if (!visible || !couponData?.active) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cupom de primeiro pedido"
        className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-md animate-in flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl slide-in-from-bottom-4 duration-300 sm:max-h-[min(92dvh,680px)] sm:rounded-[28px] sm:zoom-in-95">
          <header className="relative flex-shrink-0 overflow-hidden bg-[var(--bonatto-header,#DA1923)] px-5 pb-5 pt-7 text-center text-white sm:px-8 sm:pb-7 sm:pt-8">
            <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#b51620]" />
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#ffca32] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5c3400] sm:text-xs">
              <Clock className="h-3.5 w-3.5" />
              Cupom de boas-vindas
            </div>
            <h2 className="relative mx-auto flex max-w-full flex-col items-center uppercase">
              <span className="text-[2.65rem] font-black leading-none tracking-[-0.035em] text-[#ffca32] sm:text-[3.25rem]">
                10% OFF
              </span>
              <span className="mt-1 whitespace-nowrap text-[1.55rem] font-black leading-none tracking-[-0.025em] text-white sm:text-[1.9rem]">
                no primeiro pedido
              </span>
            </h2>
            <p className="relative mx-auto mt-3 max-w-[32ch] text-xs leading-relaxed text-white/75 sm:text-sm">
              Use o cupom abaixo no checkout do seu primeiro pedido.
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <section className="bg-[#fff5f1] px-4 py-4 sm:px-6">
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#786966]">
                Seu cupom
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border-2 border-dashed border-[#971117] bg-white px-3 py-3 hover:bg-[#fff0ec] sm:px-4"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Tag className="h-5 w-5 shrink-0 text-[#971117]" />
                  <strong className="truncate text-lg tracking-[0.12em] text-[#971117] sm:text-xl">{couponData.code}</strong>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#971117] sm:text-sm">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </span>
              </button>
              <p className="mt-2 text-center text-[11px] text-[#a0908c]">Toque para copiar e use no checkout.</p>
            </section>

            <ul className="grid gap-2 px-4 py-3 text-xs text-[#62534e] sm:grid-cols-3 sm:px-6">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#da1923]" />10% de desconto</li>
              <li className="flex items-center gap-2"><Truck className="h-4 w-4 shrink-0 text-[#da1923]" />Entrega rápida</li>
              <li className="flex items-center gap-2"><Flame className="h-4 w-4 shrink-0 text-[#da1923]" />Feita na hora</li>
            </ul>

            <footer className="space-y-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={handleCTA}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#211713] px-4 font-bold text-white shadow-[0_5px_0_#971117] hover:-translate-y-0.5"
              >
                Pedir agora com 10% OFF
                <ChevronRight className="ml-2 h-5 w-5" />
              </button>
              {countdown > 0 && (
                <p className="text-center text-[11px] text-[#9c8d89]">
                  Oferta válida por mais <strong className="text-[#971117]">{countdown} min</strong>
                </p>
              )}
              <button type="button" onClick={handleClose} className="w-full py-1 text-xs text-[#9c8d89] hover:text-[#62534e]">
                Não, obrigado
              </button>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
