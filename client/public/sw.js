// Service Worker — Bonatto Pizza Web Push
// Versão: 3.0 — suporte a notificações do motoboy, cliente e avaliação pós-entrega

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Receber notificação push ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Bonatto Pizza", body: event.data.text() };
  }

  const title = data.title || "Bonatto Pizza";
  const tag = data.tag || "bonatto-push";
  const url = data.url || "/";

  // Detectar tipo de notificação pelo tag para personalizar comportamento
  const isDriverOrder = tag.startsWith("driver-order-");
  const isDriverUnassigned = tag.startsWith("driver-unassigned-");
  const isDriverMsg = tag.startsWith("driver-msg-");
  const isDeliveryConfirmed = tag.startsWith("delivery-confirmed-");

  // Vibração diferenciada por tipo
  const vibrate = isDriverOrder
    ? [300, 100, 300, 100, 300]   // Urgente — 3 pulsos
    : isDeliveryConfirmed
    ? [200, 150, 200, 150, 200]   // Entrega confirmada — 3 pulsos suaves
    : isDriverMsg
    ? [200, 100, 200]              // Mensagem — 2 pulsos
    : [200, 100, 200];             // Padrão

  // Ações específicas por tipo
  const actions = isDriverOrder
    ? [
        { action: "open_driver", title: "📱 Ver Pedido" },
        { action: "dismiss", title: "Dispensar" },
      ]
    : isDriverMsg
    ? [
        { action: "open_driver", title: "💬 Ver Mensagem" },
      ]
    : isDeliveryConfirmed
    ? [
        { action: "open_url", title: "⭐ Avaliar entrega" },
        { action: "dismiss", title: "Agora não" },
      ]
    : [];

  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag,
    data: { url },
    requireInteraction: isDriverOrder || isDriverUnassigned || isDeliveryConfirmed,
    vibrate,
    actions,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Clicar na notificação ou em uma ação ────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const url = event.notification.data?.url || "/";

  // Ação "dispensar" — apenas fecha
  if (action === "dismiss") return;

  // Roteamento por ação
  let targetUrl = url; // padrão: URL da notificação
  if (action === "open_driver") targetUrl = "/motoboy";
  if (action === "open_url") targetUrl = url; // usa a URL da notificação (ex: /meus-pedidos?avaliar=X)

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Procurar aba já aberta no domínio
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
        // Nenhuma aba aberta → abrir nova
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Fechar notificação sem clicar ───────────────────────────────────────────
self.addEventListener("notificationclose", () => {
  // Telemetria futura: registrar que o motoboy dispensou sem ver
});
