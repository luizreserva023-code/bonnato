import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function canUsePushNotifications() {
  const hasCoreSupport =
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  if (!hasCoreSupport) return false;
  if (isIOSDevice() && !isStandalonePWA()) return false;
  return true;
}

export function useDriverPushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const saveMutation = trpc.drivers.savePushSubscription.useMutation();
  const removeMutation = trpc.drivers.removePushSubscription.useMutation();

  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery();
  const vapidPublicKey = vapidData?.key ?? import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    const supported = canUsePushNotifications();
    setIsSupported(supported);

    if (!supported) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PushPermission);

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => null)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch(() => {
        setIsSubscribed(false);
      });
  }, []);

  const subscribe = useCallback(
    async (token: string) => {
      if (!isSupported) {
        if (isIOSDevice() && !isStandalonePWA()) {
          toast.error("No iPhone, abra o app pela Tela de Inicio para ativar notificacoes.");
          return;
        }

        toast.error("Seu navegador nao suporta notificacoes push.");
        return;
      }

      if (!vapidPublicKey) {
        toast.error("Chave VAPID não configurada. Contate o suporte.");
        return;
      }

      if (!token) {
        toast.error("Você precisa estar autenticado para ativar notificações.");
        return;
      }

      setIsLoading(true);
      try {
        const perm =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();

        setPermission(perm as PushPermission);

        if (perm !== "granted") {
          toast.error("Permissão para notificações negada.", {
            description: "Você pode ativar nas configurações do navegador.",
          });
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        await reg.update().catch(() => undefined);

        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));

        const json = sub.toJSON();
        const keys = (json.keys as Record<string, string> | undefined) ?? {};

        if (!json.endpoint || !keys.p256dh || !keys.auth) {
          throw new Error("Subscription inválida: chaves ausentes.");
        }

        await saveMutation.mutateAsync({
          token,
          endpoint: json.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: navigator.userAgent,
        });

        setIsSubscribed(true);
        toast.success("Notificações ativadas! Você receberá alertas de novos pedidos.");
      } catch (err) {
        console.error("[DriverPush] Erro ao ativar notificacoes:", err);
        toast.error("Não foi possível ativar as notificações.", {
          description: err instanceof Error ? err.message : "Tente novamente.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isSupported, saveMutation, vapidPublicKey]
  );

  const unsubscribe = useCallback(
    async (token: string) => {
      setIsLoading(true);
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          await removeMutation.mutateAsync({ token, endpoint: sub.endpoint });
          await sub.unsubscribe();
        }

        setIsSubscribed(false);
        toast.success("Notificacoes desativadas.");
      } catch (err) {
        console.error("[DriverPush] Erro ao desativar notificacoes:", err);
        toast.error("Nao foi possivel desativar as notificacoes.");
      } finally {
        setIsLoading(false);
      }
    },
    [removeMutation]
  );

  return { permission, isSubscribed, isLoading, isSupported, subscribe, unsubscribe };
}
