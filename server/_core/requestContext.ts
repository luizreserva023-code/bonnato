import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type RequestContextValue = {
  requestId: string;
  ipAddress: string | null;
};

const requestContext = new AsyncLocalStorage<RequestContextValue>();

export function getRequestContext(): RequestContextValue | undefined {
  return requestContext.getStore();
}

function makeRequestId() {
  return `req_${randomUUID().replaceAll("-", "")}`;
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = makeRequestId();
  const ipAddress = req.ip?.slice(0, 64) || null;
  const startedAt = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  requestContext.run({ requestId, ipAddress }, () => {
    res.on("finish", () => {
      if (!req.path.startsWith("/api/") && !req.path.startsWith("/health")) return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.log(JSON.stringify({
        level: "info",
        event: "http_request",
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      }));
    });

    next();
  });
}
