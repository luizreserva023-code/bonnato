// Service Worker - Bonatto Pizza Web Push
// Versao 4.0 - push com notificacao nativa + ponte para som customizado em abas abertas

const DEFAULT_PUSH_SOUND_URL = "/manus-storage/notification-motoboy_31cd6501.mp3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function buildPushMetadata(tag) {
  const isDriverOrder = tag.startsWith("driver-order-");
  const isDriverUnassigned = tag.startsWith("driver-unassigned-");
  const isDriverMsg = tag.startsWith("driver-msg-");
  const isDeliveryConfirmed = tag.startsWith("delivery-confirmed-");

  const vibrate = isDriverOrder
    ? [300, 100, 300, 100, 300]
    : isDeliveryConfirmed
      ? [200, 150, 200, 150, 200]
      : [200, 100, 200];

  const actions = isDriverOrder
    ? [
        { action: "open_driver", title: "Ver Pedido" },
        { action: "dismiss", title: "Dispensar" },
      ]
    : isDriverMsg
      ? [{ action: "open_driver", title: "Ver Mensagem" }]
      : isDeliveryConfirmed
        ? [
            { action: "open_url", title: "Avaliar entrega" },
            { action: "dismiss", title: "Agora nao" },
          ]
        : [];

  return {
    requireInteraction: isDriverOrder || isDriverUnassigned || isDeliveryConfirmed,
    vibrate,
    actions,
  };
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data.json();
    } catch {
      data = { title: "Bonatto Pizza", body: event.data.text() };
    }

    const title = data.title || "Bonatto Pizza";
    const body = data.body || "";
    const tag = data.tag || "bonatto-push";
    const url = data.url || "/";
    const icon = data.icon || "/icon-192.png";
    const badge = data.badge || "/icon-192.png";
    const soundUrl = data.soundUrl || DEFAULT_PUSH_SOUND_URL;

    const meta = buildPushMetadata(tag);
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const hasVisibleClient = windowClients.some((client) => client.visibilityState === "visible");

    for (const client of windowClients) {
      client.postMessage({
        type: "BONATTO_PUSH_SOUND",
        title,
        body,
        tag,
        url,
        soundUrl,
      });
    }

    const options = {
      body,
      icon,
      badge,
      tag,
      data: { url, soundUrl },
      requireInteraction: meta.requireInteraction,
      actions: meta.actions,
      silent: hasVisibleClient,
      ...(hasVisibleClient ? {} : { vibrate: meta.vibrate }),
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const url = event.notification.data?.url || "/";

  if (action === "dismiss") return;

  let targetUrl = url;
  if (action === "open_driver") targetUrl = "/motoboy";
  if (action === "open_url") targetUrl = url;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (
            typeof client.url === "string" &&
            client.url.includes(self.location.origin) &&
            "focus" in client
          ) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener("notificationclose", () => {
  // Telemetria futura
});
