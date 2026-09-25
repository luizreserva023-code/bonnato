import express, { type Express, type Request, type Response } from "express";
import { TRPCError } from "@trpc/server";

import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
  isAllowedImageMimeType,
} from "../shared/imageUpload.ts";
import { authorizeStaffProcedure, hasActiveStaffAccess } from "./accessControl.ts";
import { storagePutAdapter } from "./adapters/storage.ts";
import { sdk } from "./_core/sdk.ts";
import { updateUserAvatar } from "./db.ts";
import { compressToWebP } from "./imageUtils.ts";
import { recordStoreAudit } from "./storeAudit.ts";
import { resolveRequiredStoreId } from "./storeUtils.ts";

type ImageScope =
  | "product"
  | "category"
  | "banner"
  | "carousel"
  | "notification"
  | "avatar";

const scopeConfig: Record<Exclude<ImageScope, "avatar">, {
  permissionPath: string;
  folder: string;
  quality: number;
  maxWidth: number;
}> = {
  product: { permissionPath: "products.uploadImage", folder: "products", quality: 82, maxWidth: 1200 },
  category: { permissionPath: "categories.uploadImage", folder: "categories", quality: 82, maxWidth: 1400 },
  banner: { permissionPath: "menuSlides.uploadImage", folder: "banners", quality: 85, maxWidth: 1920 },
  carousel: { permissionPath: "carousel.uploadImage", folder: "carousel", quality: 85, maxWidth: 1920 },
  notification: { permissionPath: "notificationTemplates.uploadImage", folder: "notifications", quality: 84, maxWidth: 1200 },
};

function requestOriginHost(req: Request) {
  const source = String(req.headers.origin || req.headers.referer || "").trim();
  if (!source) return null;
  try { return new URL(source).hostname.toLowerCase(); } catch { return null; }
}

function expectedHosts(req: Request) {
  const hosts = new Set<string>();
  const host = String(req.headers.host || "").split(":")[0].trim().toLowerCase();
  if (host) hosts.add(host);
  for (const value of [process.env.PUBLIC_APP_URL, process.env.APP_URL]) {
    if (!value) continue;
    try { hosts.add(new URL(value).hostname.toLowerCase()); } catch {}
  }
  for (const configuredHost of (process.env.ALLOWED_ORIGIN_HOSTS ?? "").split(",")) {
    const value = configuredHost.trim().toLowerCase();
    if (!value) continue;
    try {
      hosts.add(value.includes("://") ? new URL(value).hostname.toLowerCase() : value.split(":")[0]);
    } catch {}
  }
  return hosts;
}

function hasTrustedOrigin(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const originHost = requestOriginHost(req);
  if (!originHost) return false;
  return expectedHosts(req).has(originHost);
}
function requestedStoreId(req: Request) {
  const raw = Array.isArray(req.query.storeId) ? req.query.storeId[0] : req.query.storeId;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function requestedScope(req: Request): ImageScope | null {
  const raw = Array.isArray(req.query.scope) ? req.query.scope[0] : req.query.scope;
  const scope = String(raw || "");
  return ["product", "category", "banner", "carousel", "notification", "avatar"].includes(scope)
    ? scope as ImageScope
    : null;
}

function statusForError(error: unknown) {
  if (error instanceof TRPCError) {
    if (error.code === "UNAUTHORIZED") return 401;
    if (error.code === "FORBIDDEN") return 403;
    if (error.code === "NOT_FOUND") return 404;
    if (error.code === "BAD_REQUEST") return 400;
  }
  return 500;
}

export function registerImageUploadRoute(app: Express, limiter: express.RequestHandler) {
  app.post(
    "/api/uploads/image",
    limiter,
    express.raw({ type: "*/*", limit: MAX_IMAGE_UPLOAD_BYTES }),
    async (req: Request, res: Response) => {
      if (!hasTrustedOrigin(req)) {
        return res.status(403).json({ error: "Origem não autorizada." });
      }

      const scope = requestedScope(req);
      if (!scope) {
        return res.status(400).json({ error: "Tipo de upload inválido." });
      }

      const mimeType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!isAllowedImageMimeType(mimeType)) {
        return res.status(415).json({ error: "Use JPG, PNG, WebP ou GIF." });
      }

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!buffer.length) {
        return res.status(400).json({ error: "Arquivo vazio ou inválido." });
      }
      if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
        return res.status(413).json({ error: `A imagem deve ter no máximo ${MAX_IMAGE_UPLOAD_LABEL}.` });
      }

      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Sessão inválida ou expirada." });
      }

      try {
        if (scope === "avatar") {
          const compressed = await compressToWebP(buffer, 84, 768);
          const key = `avatars/user-${user.id}-${Date.now()}.${compressed.ext}`;
          const saved = await storagePutAdapter(key, compressed.buffer, compressed.mimeType);
          await updateUserAvatar(user.id, saved.url);
          return res.json({
            url: saved.url,
            originalBytes: buffer.length,
            storedBytes: compressed.buffer.length,
          });
        }

        const config = scopeConfig[scope];
        const candidateStoreId = requestedStoreId(req);
        if (user.role !== "admin" && user.role !== "manager") {
          if (!await hasActiveStaffAccess(user.id)) {
            return res.status(403).json({ error: "Você não possui acesso administrativo." });
          }
          await authorizeStaffProcedure({
            user,
            path: config.permissionPath,
            type: "mutation",
            rawInput: { storeId: candidateStoreId },
          });
        }

        const storeId = await resolveRequiredStoreId(user, candidateStoreId);
        const compressed = await compressToWebP(buffer, config.quality, config.maxWidth);
        const key = `stores/${storeId}/${config.folder}/image-${Date.now()}.${compressed.ext}`;
        const saved = await storagePutAdapter(key, compressed.buffer, compressed.mimeType);

        await recordStoreAudit({
          storeId,
          actorUserId: user.id,
          action: "image.upload",
          resourceType: scope,
          metadata: {
            originalBytes: buffer.length,
            storedBytes: compressed.buffer.length,
            mimeType,
          },
        });

        return res.json({
          url: saved.url,
          originalBytes: buffer.length,
          storedBytes: compressed.buffer.length,
        });
      } catch (error) {
        console.error("[ImageUpload] failed", error);
        const status = statusForError(error);
        return res.status(status).json({
          error: status === 500
            ? "Não foi possível enviar a imagem."
            : error instanceof Error ? error.message : "Upload recusado.",
        });
      }
    },
  );
}
