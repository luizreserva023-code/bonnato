import type { Express } from "express";
import { z } from "zod";
import { bootstrapAdminAndDriver } from "../bootstrapAccess";

const bootstrapSchema = z.object({
  adminEmail: z.string().email().optional(),
  adminName: z.string().min(2).max(120).optional(),
  adminPassword: z.string().min(8).max(120).optional(),
  driverName: z.string().min(2).max(120).optional(),
  driverPhone: z.string().max(30).nullable().optional(),
});

export function registerBootstrapRoute(app: Express): void {
  app.post("/api/bootstrap/access", async (req, res) => {
    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (!expectedSecret) {
      return res.status(404).json({ error: "Not found" });
    }

    const providedSecret =
      (req.headers["x-bootstrap-secret"] as string | undefined)?.trim() ||
      ((req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, "").trim() ?? "");

    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = bootstrapSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Payload invalido",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    try {
      const result = await bootstrapAdminAndDriver(parsed.data);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("[bootstrap-route] erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao criar acessos",
      });
    }
  });
}
