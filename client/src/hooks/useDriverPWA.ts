/**
 * useDriverPWA
 *
 * Hook responsável por:
 * 1. Injetar dinamicamente o manifest e meta tags do app do motoboy
 *    quando a rota /motoboy estiver ativa.
 * 2. Capturar o evento `beforeinstallprompt` (Android/Chrome) para
 *    exibir um banner de instalação personalizado no DriverApp.
 * 3. Detectar iOS para exibir instruções manuais de instalação.
 * 4. Limpar as meta tags ao desmontar (quando o usuário sai de /motoboy).
 */

import { useState, useEffect, useCallback } from "react";

// Evento nativo do Chrome para instalação PWA
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PWAInstallState =
  | "idle"          // ainda não detectado
  | "available"     // Android: prompt disponível
  | "ios"           // iOS: mostrar instruções manuais
  | "installed"     // já instalado (standalone)
  | "unsupported";  // browser não suporta

export function useDriverPWA() {
  const [installState, setInstallState] = useState<PWAInstallState>("idle");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem("driver_pwa_dismissed") === "1"
  );

  // ── 1. Injetar manifest e meta tags do motoboy ──────────────────────────────
  useEffect(() => {
    const injected: HTMLElement[] = [];

    function injectTag(tag: string, attrs: Record<string, string>) {
      const el = document.createElement(tag) as HTMLLinkElement & HTMLMetaElement;
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.setAttribute("data-driver-pwa", "1");
      document.head.appendChild(el);
      injected.push(el);
    }

    // Substituir manifest principal pelo do motoboy
    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (existingManifest) existingManifest.setAttribute("href", "/driver-manifest.json");

    // Meta tags específicas do motoboy
    injectTag("meta", { name: "apple-mobile-web-app-title", content: "Motoboy" });
    injectTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    injectTag("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
    injectTag("meta", { name: "theme-color", content: "#6E0D12" });
    injectTag("link", { rel: "apple-touch-icon", href: "/driver-apple-touch-icon.png" });

    // Atualizar título da aba
    const prevTitle = document.title;
    document.title = "Bonatto Motoboy";

    return () => {
      // Restaurar manifest original
      if (existingManifest) existingManifest.setAttribute("href", "/manifest.json");
      // Remover tags injetadas
      injected.forEach((el) => el.remove());
      // Restaurar título
      document.title = prevTitle;
    };
  }, []);

  // ── 2. Detectar estado de instalação ───────────────────────────────────────
  useEffect(() => {
    // Já instalado como PWA standalone
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstallState("installed");
      return;
    }

    // iOS: Safari não suporta beforeinstallprompt
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    if (isIOS) {
      setInstallState("ios");
      return;
    }

    // Android/Chrome: aguardar beforeinstallprompt
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState("available");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Detectar se foi instalado durante a sessão
    function handleAppInstalled() {
      setInstallState("installed");
      setDeferredPrompt(null);
      localStorage.setItem("driver_pwa_dismissed", "1");
    }
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // ── 3. Acionar prompt de instalação (Android) ──────────────────────────────
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallState("installed");
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  // ── 4. Dispensar banner ────────────────────────────────────────────────────
  const dismissInstall = useCallback(() => {
    localStorage.setItem("driver_pwa_dismissed", "1");
    setInstallDismissed(true);
  }, []);

  const showBanner =
    !installDismissed &&
    (installState === "available" || installState === "ios");

  return {
    installState,
    showBanner,
    promptInstall,
    dismissInstall,
  };
}
