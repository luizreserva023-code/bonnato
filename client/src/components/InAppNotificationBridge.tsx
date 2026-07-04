import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type AppNotice = {
  id: string;
  title: string;
  body: string;
  url?: string | null;
};

function playLocalNoticeSound() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;

    [880, 1174].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.08);
      gain.gain.setValueAtTime(0.16, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7 + index * 0.08);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + 0.75 + index * 0.08);
    });
  } catch {
    // Audio can be blocked until the first user interaction.
  }
}

function showLocalNotice(notice: AppNotice) {
  playLocalNoticeSound();

  if (navigator.vibrate) {
    navigator.vibrate([180, 90, 180]);
  }

  if (
    document.visibilityState !== "visible" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    const notification = new Notification(notice.title, {
      body: notice.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: notice.id,
    });

    notification.onclick = () => {
      window.focus();
      if (notice.url) window.location.href = notice.url;
      notification.close();
    };
    return;
  }

  toast(notice.title, {
    description: notice.body,
    action: notice.url
      ? {
          label: "Abrir",
          onClick: () => {
            window.location.href = notice.url ?? "/";
          },
        }
      : undefined,
  });
}

export function InAppNotificationBridge() {
  const { isAuthenticated } = useAuth();
  const initializedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const notificationsQuery = trpc.notifications.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  });

  const alertsQuery = trpc.clientAlerts.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      initializedRef.current = false;
      seenRef.current.clear();
      return;
    }

    const notices: AppNotice[] = [
      ...(notificationsQuery.data ?? []).map((item) => ({
        id: `notification:${item.id}`,
        title: item.title,
        body: item.message,
        url: item.type === "order" ? "/minha-conta" : undefined,
      })),
      ...(alertsQuery.data ?? []).map((item) => ({
        id: `alert:${item.id}`,
        title: item.title,
        body: item.message,
        url: item.url,
      })),
    ];

    if (!initializedRef.current) {
      seenRef.current = new Set(notices.map((notice) => notice.id));
      initializedRef.current = true;
      return;
    }

    for (const notice of notices) {
      if (seenRef.current.has(notice.id)) continue;
      seenRef.current.add(notice.id);
      showLocalNotice(notice);
    }
  }, [alertsQuery.data, isAuthenticated, notificationsQuery.data]);

  return null;
}
