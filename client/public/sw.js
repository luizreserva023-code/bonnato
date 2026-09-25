// Service Worker - Bonatto Pizza Web Push
// Versao 10.0 - push com imagem + deduplicação + cache de assets versionados.
// v10 mantém popup apenas em background e aceita imagem rica no Web Push.

const DEFAULT_PUSH_SOUND_URL = "";
const ASSET_CACHE = "bonatto-assets-v10";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("bonatto-assets-") && key !== ASSET_CACHE).map((key) => caches.delete(key)))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isVersionedAsset = url.pathname.startsWith("/assets/");
  if (!isVersionedAsset) return;

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
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
    const image = data.image || data.imageUrl || "";
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
        image,
        soundUrl,
      });
    }

    // When the app is already visible, the in-app notification center
    // handles the update. Showing an OS notification as well creates a duplicate.
    if (hasVisibleClient) return;

    const options = {
      body,
      icon,
      badge,
      ...(image ? { image } : {}),
      tag,
      data: { url, soundUrl, image },
      requireInteraction: meta.requireInteraction,
      actions: meta.actions,
      silent: false,
      vibrate: meta.vibrate,
      renotify: false,
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
