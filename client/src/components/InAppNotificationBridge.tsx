import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useStore } from "@/contexts/StoreContext";

type AppNotice = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
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
      ...(notice.imageUrl ? { image: notice.imageUrl } : {}),
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

const MAX_PERSISTED_NOTICE_IDS = 250;

function seenStorageKey(userId: number, storeId: number) {
  return `bonatto-notifications-seen:${userId}:${storeId}`;
}

function loadPersistedSeen(userId: number, storeId: number) {
  try {
    const raw = localStorage.getItem(seenStorageKey(userId, storeId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function persistSeen(userId: number, storeId: number, seen: Set<string>) {
  try {
    const ids = Array.from(seen).slice(-MAX_PERSISTED_NOTICE_IDS);
    localStorage.setItem(seenStorageKey(userId, storeId), JSON.stringify(ids));
  } catch {
    // Storage can be blocked in private browsing; in-memory dedupe still works.
  }
}

export function InAppNotificationBridge() {
  const { isAuthenticated, user } = useAuth();
  const { selectedStore } = useStore();
  const initializedRef = useRef(false);
  const initializedScopeRef = useRef("");
  const seenRef = useRef<Set<string>>(new Set());

  const queryEnabled = isAuthenticated && Boolean(user?.id) && Boolean(selectedStore?.id);

  const notificationsQuery = trpc.notifications.list.useQuery({ storeId: selectedStore?.id }, {
    enabled: queryEnabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const alertsQuery = trpc.clientAlerts.list.useQuery({ storeId: selectedStore?.id ?? 0 }, {
    enabled: queryEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!queryEnabled || !user?.id || !selectedStore?.id) {
      initializedRef.current = false;
      initializedScopeRef.current = "";
      seenRef.current.clear();
      return;
    }

    // Critical: do not initialize from undefined/partial query data. Previously
    // the bridge initialized with an empty list, then treated every existing
    // notification as new when the queries finished loading.
    if (
      notificationsQuery.isLoading
      || notificationsQuery.isFetching && notificationsQuery.data === undefined
      || alertsQuery.isLoading
      || alertsQuery.isFetching && alertsQuery.data === undefined
    ) {
      return;
    }

    const scope = `${user.id}:${selectedStore.id}`;
    const notices: AppNotice[] = [
      ...(notificationsQuery.data ?? [])
        .filter((item) => !item.read)
        .map((item) => ({
          id: `notification:${item.id}`,
          title: item.title,
          body: item.message,
          imageUrl: item.imageUrl,
          url: item.url ?? (item.type === "order" ? "/minha-conta" : undefined),
        })),
      ...(alertsQuery.data ?? []).map((item) => ({
        id: `alert:${item.id}`,
        title: item.title,
        body: item.message,
        imageUrl: item.imageUrl,
        url: item.url,
      })),
    ];

    if (!initializedRef.current || initializedScopeRef.current !== scope) {
      seenRef.current = loadPersistedSeen(user.id, selectedStore.id);
      // Existing notices are part of the initial snapshot. They stay visible in
      // the notification center, but opening/reloading the app must not replay
      // them as fresh browser notifications/toasts.
      for (const notice of notices) seenRef.current.add(notice.id);
      persistSeen(user.id, selectedStore.id, seenRef.current);
      initializedScopeRef.current = scope;
      initializedRef.current = true;
      return;
    }

    let changed = false;
    for (const notice of notices) {
      if (seenRef.current.has(notice.id)) continue;
      seenRef.current.add(notice.id);
      changed = true;
      showLocalNotice(notice);
    }

    if (changed) persistSeen(user.id, selectedStore.id, seenRef.current);
  }, [
    alertsQuery.data,
    alertsQuery.isFetching,
    alertsQuery.isLoading,
    notificationsQuery.data,
    notificationsQuery.isFetching,
    notificationsQuery.isLoading,
    queryEnabled,
    selectedStore?.id,
    user?.id,
  ]);

  return null;
}
