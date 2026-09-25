import type { Express, Request, Response } from "express";

import { authorizeStaffProcedure } from "../accessControl.ts";
import { getOrderById } from "../db.ts";
import { sdk } from "../_core/sdk.ts";
import {
  subscribeToOrderEvents,
  type OrderRealtimeEvent,
} from "./orderEvents.ts";

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function publicEvent(event: OrderRealtimeEvent) {
  const { userId: _userId, origin: _origin, ...safe } = event;
  return safe;
}

function writeEvent(res: Response, event: OrderRealtimeEvent) {
  res.write(`id: ${event.eventId}\n`);
  res.write("event: order\n");
  res.write(`data: ${JSON.stringify(publicEvent(event))}\n\n`);
}
export function registerOrderRealtimeRoutes(app: Express) {
  app.get("/api/realtime/orders", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const storeId = positiveInt(req.query.storeId);
    const orderId = positiveInt(req.query.orderId);

    try {
      if (storeId) {
        await authorizeStaffProcedure({
          user,
          path: "orders.list",
          type: "query",
          rawInput: { storeId },
        });
      } else if (orderId) {
        const order = await getOrderById(orderId);
        if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.userId !== user.id) {
          await authorizeStaffProcedure({
            user,
            path: "orders.byId",
            type: "query",
            rawInput: { storeId: order.storeId ?? undefined },
          });
        }
      }
    } catch {
      return res.status(403).json({ error: "Sem permissão para este stream." });
    }
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Content-Encoding", "identity");
    res.flushHeaders?.();
    res.socket?.setTimeout(0);

    res.write("retry: 3000\n");
    res.write(`event: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    const unsubscribe = subscribeToOrderEvents((event) => {
      if (storeId && event.storeId !== storeId) return;
      if (orderId && event.orderId !== orderId) return;
      if (!storeId && !orderId && event.userId !== user.id) return;
      writeEvent(res, event);
    });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping ${Date.now()}\n\n`);
    }, 20_000);
    heartbeat.unref?.();

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) res.end();
    });
  });
}
