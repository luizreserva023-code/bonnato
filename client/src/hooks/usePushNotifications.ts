import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  // Buscar chave VAPID do servidor (mais confiável que variável de ambiente no frontend)
  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery();
  const vapidPublicKey = vapidData?.key ?? import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

  // Verificar suporte e estado inicial
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission as PushPermission);
      // Verificar se já tem subscription ativa
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error("Seu navegador não suporta notificações push.");
      return;
    }
    if (!vapidPublicKey) {
      toast.error("Chave VAPID não configurada. Contate o suporte.");
      return;
    }

    setIsLoading(true);
    try {
      // Registrar Service Worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Pedir permissão
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== "granted") {
        toast.error("Permissão para notificações negada.");
        return;
      }

      // Criar subscription
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = sub.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: subJson.endpoint!,
        p256dh: (subJson.keys as any)?.p256dh ?? "",
        auth: (subJson.keys as any)?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      toast.success("Notificações ativadas! Você receberá alertas de novos pedidos.");
    } catch (err) {
      console.error("[Push] Erro ao ativar notificações:", err);
      toast.error("Não foi possível ativar as notificações.");
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
      }
      setIsSubscribed(false);
      toast.success("Notificações desativadas.");
    } catch (err) {
      console.error("[Push] Erro ao desativar notificações:", err);
      toast.error("Não foi possível desativar as notificações.");
    } finally {
      setIsLoading(false);
    }
  }, [unsubscribeMutation]);

  return { permission, isSubscribed, isLoading, isSupported, subscribe, unsubscribe };
}
