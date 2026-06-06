/**
 * useDriverPushNotifications
 *
 * Hook dedicado para o app do motoboy.
 * Usa trpc.drivers.savePushSubscription / removePushSubscription
 * em vez do endpoint genérico de usuário (trpc.push.*).
 *
 * Expõe:
 *  - permission: "default" | "granted" | "denied" | "unsupported"
 *  - isSubscribed: boolean
 *  - isLoading: boolean
 *  - isSupported: boolean
 *  - subscribe(token): Promise<void>  — pede permissão e salva subscription
 *  - unsubscribe(token): Promise<void> — remove subscription
 */

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

export function useDriverPushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const saveMutation = trpc.drivers.savePushSubscription.useMutation();
  const removeMutation = trpc.drivers.removePushSubscription.useMutation();

  // Buscar chave VAPID do servidor (mais confiável que variável de ambiente)
  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery();
  const vapidPublicKey = vapidData?.key ?? (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ?? "";

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
    } else {
      setPermission("unsupported");
    }
  }, []);

  /**
   * Pede permissão ao browser, cria a subscription e salva no backend.
   * @param token — token de autenticação do motoboy
   */
  const subscribe = useCallback(
    async (token: string) => {
      if (!isSupported) {
        toast.error("Seu navegador não suporta notificações push.");
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
        // Registrar Service Worker (idempotente — não recria se já existe)
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Pedir permissão ao usuário
        const perm = await Notification.requestPermission();
        setPermission(perm as PushPermission);

        if (perm !== "granted") {
          toast.error("Permissão para notificações negada.", {
            description: "Você pode ativar nas configurações do navegador.",
          });
          return;
        }

        // Criar ou recuperar subscription existente
        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));

        const json = sub.toJSON();
        if (!json.endpoint || !(json.keys as Record<string, string>)?.p256dh || !(json.keys as Record<string, string>)?.auth) {
          throw new Error("Subscription inválida — chaves ausentes.");
        }

        await saveMutation.mutateAsync({
          token,
          endpoint: json.endpoint,
          p256dh: (json.keys as Record<string, string>).p256dh,
          auth: (json.keys as Record<string, string>).auth,
          userAgent: navigator.userAgent,
        });

        setIsSubscribed(true);
        toast.success("Notificações ativadas! 🔔", {
          description: "Você receberá alertas instantâneos de novos pedidos.",
        });
      } catch (err) {
        console.error("[DriverPush] Erro ao ativar notificações:", err);
        toast.error("Não foi possível ativar as notificações.", {
          description: err instanceof Error ? err.message : "Tente novamente.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isSupported, vapidPublicKey, saveMutation]
  );

  /**
   * Remove a subscription do browser e do backend.
   * @param token — token de autenticação do motoboy
   */
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
        toast.success("Notificações desativadas.");
      } catch (err) {
        console.error("[DriverPush] Erro ao desativar notificações:", err);
        toast.error("Não foi possível desativar as notificações.");
      } finally {
        setIsLoading(false);
      }
    },
    [removeMutation]
  );

  return { permission, isSubscribed, isLoading, isSupported, subscribe, unsubscribe };
}
