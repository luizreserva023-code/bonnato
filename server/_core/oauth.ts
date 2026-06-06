import { COOKIE_NAME, DEFAULT_SESSION_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { fireJourneyTrigger } from "../automation";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const { isNew } = await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Fire new_user automation trigger for first-time registrations
      if (isNew) {
        const newUser = await db.getUserByOpenId(userInfo.openId);
        if (newUser) {
          fireJourneyTrigger("new_user", newUser.id, newUser.phone ?? undefined).catch(
            (err) => console.error("[OAuth] new_user trigger failed", err)
          );
        }
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: DEFAULT_SESSION_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });

      // Decode returnTo from state if present
      let returnTo = "/";
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        // state format: "<redirectUri>|<returnPath>"
        const parts = decoded.split("|");
        if (parts.length >= 2 && parts[1]) {
          const path = parts[1];
          // Only allow relative paths for security
          if (path.startsWith("/")) {
            returnTo = path;
          }
        }
      } catch {
        // ignore decode errors, fall back to "/"
      }

      res.redirect(302, returnTo);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
