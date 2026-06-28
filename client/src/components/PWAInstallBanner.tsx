import { useState } from "react";
import { Share2, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PWAInstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa_banner_dismissed") === "1"
  );

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const hasPushApiSupport =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const requiresInstalledPWA = isIOS && !isStandalone;

  if (dismissed || !requiresInstalledPWA || !hasPushApiSupport) return null;

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
            <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Ative as notificacoes no iPhone
            </p>
            <p className="mb-3 mt-0.5 text-xs text-blue-700 dark:text-blue-300">
              Para o push funcionar no iPhone, abra este site como app instalado na Tela de Inicio:
            </p>
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  1
                </span>
                <span>
                  Toque no icone <Share2 className="mx-0.5 inline h-3 w-3 align-middle" />{" "}
                  <strong>Compartilhar</strong> no Safari
                </span>
              </li>
              <li className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  2
                </span>
                <span>
                  Toque em <strong>Adicionar a Tela de Inicio</strong>
                </span>
              </li>
              <li className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  3
                </span>
                <span>Abra o app instalado e volte na aba de notificacoes para ativar o push</span>
              </li>
            </ol>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400"
            onClick={() => {
              localStorage.setItem("pwa_banner_dismissed", "1");
              setDismissed(true);
            }}
          >
            Entendi, fechar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
