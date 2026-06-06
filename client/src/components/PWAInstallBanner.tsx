import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Smartphone } from "lucide-react";

/**
 * Banner de instalacao PWA para iOS.
 * Aparece apenas em dispositivos iOS que:
 *  - NAO estao rodando como PWA instalado (standalone)
 *  - NAO suportam Web Push nativamente (iOS < 16.4 ou Safari sem PWA)
 *  - O usuario nao dispensou o banner antes
 */
export function PWAInstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa_banner_dismissed") === "1"
  );

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
  const pushSupported =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  // Ocultar se: dispensado, não é iOS, já está em modo standalone, ou push já suportado
  if (dismissed || !isIOS || isStandalone || pushSupported) return null;

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">
              Ative as notificacoes no iPhone
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 mb-3">
              Para receber alertas dos seus pedidos, instale o app na tela inicial:
            </p>
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">1</span>
                <span>Toque no icone <Share2 className="w-3 h-3 inline mx-0.5 align-middle" /> <strong>Compartilhar</strong> na barra inferior do Safari</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">2</span>
                <span>Role para baixo e toque em <strong>"Adicionar a Tela de Inicio"</strong></span>
              </li>
              <li className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">3</span>
                <span>Abra o app instalado e volte aqui para ativar as notificacoes</span>
              </li>
            </ol>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-blue-600 dark:text-blue-400 h-7 px-2"
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
