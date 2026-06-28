import { COOKIE_NAME, DEFAULT_SESSION_MS } from "../../shared/const.ts";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as db from "../db.ts";
import { getSessionCookieOptions } from "./cookies.ts";
import { ENV } from "./env.ts";
import { sdk } from "./sdk.ts";
import { fireJourneyTrigger } from "../automation.ts";

type SupportedOAuthProvider = "google";

type OAuthStatePayload = {
  provider?: SupportedOAuthProvider;
  redirectUri: string;
  returnPath: string;
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
};

type GoogleUserInfo = {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
};

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getStateSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || "bonatto-oauth-state-dev-secret");
}

function buildBaseAppUrl(req: Request) {
  return (ENV.publicAppUrl || `${req.protocol}://${req.get("host") ?? ""}`).replace(/\/+$/, "");
}

function buildCallbackUrl(req: Request) {
  return `${buildBaseAppUrl(req)}/api/oauth/callback`;
}

function sanitizeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

async function signOAuthState(payload: OAuthStatePayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getStateSecret());
}

async function parseSignedState(state: string): Promise<OAuthStatePayload> {
  const { payload } = await jwtVerify(state, getStateSecret(), {
    algorithms: ["HS256"],
  });

  const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
  const returnPath = typeof payload.returnPath === "string" ? payload.returnPath : "/";
  const provider =
    payload.provider === "google"
      ? payload.provider
      : undefined;

  if (!redirectUri) {
    throw new Error("Invalid OAuth state payload");
  }

  return {
    provider,
    redirectUri,
    returnPath: sanitizeReturnPath(returnPath),
  };
}

function parseLegacyOAuthState(state: string): OAuthStatePayload {
  const decoded = Buffer.from(state, "base64").toString("utf-8");
  const [redirectUri = "", returnPath = "/"] = decoded.split("|");

  if (!redirectUri) {
    throw new Error("Invalid OAuth state payload");
  }

  return {
    redirectUri,
    returnPath: sanitizeReturnPath(returnPath),
  };
}

async function parseOAuthState(state: string) {
  try {
    return await parseSignedState(state);
  } catch {
    return parseLegacyOAuthState(state);
  }
}

async function exchangeGoogleCodeForTokens(code: string, redirectUri: string) {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const body = new URLSearchParams({
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google userinfo failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GoogleUserInfo;
}

async function resolveGoogleUser(profile: GoogleUserInfo) {
  const providerUserId = profile.sub;
  const normalizedEmail = profile.email?.trim().toLowerCase();

  let user = await db.getUserByAuthProvider("google", providerUserId);
  let isNew = false;

  if (!user && normalizedEmail && profile.email_verified) {
    user = await db.getUserByEmail(normalizedEmail);
  }

  if (!user) {
    const openId = `google:${providerUserId}`;
    await db.upsertUser({
      openId,
      name: profile.name ?? "Cliente Bonatto",
      email: normalizedEmail ?? null,
      loginMethod: "google",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(openId);
    isNew = true;
  }

  if (!user) {
    throw new Error("Failed to resolve Google user");
  }

  await db.updateUserSocialProfile(user.id, {
    name: !user.name && profile.name ? profile.name : undefined,
    email: !user.email && normalizedEmail && profile.email_verified ? normalizedEmail : undefined,
    avatarUrl: profile.picture ?? undefined,
    loginMethod: "google",
    emailVerified: profile.email_verified === true ? true : undefined,
    lastSignedIn: new Date(),
  });

  await db.linkCustomerAuthProvider({
    userId: user.id,
    provider: "google",
    providerUserId,
    providerEmail: normalizedEmail ?? null,
    isPrimary: user.loginMethod === "google" || !user.loginMethod,
  });

  const refreshedUser = await db.getUserById(user.id);
  if (!refreshedUser) {
    throw new Error("Failed to reload Google user");
  }

  return { user: refreshedUser, isNew };
}

async function finalizeLogin(req: Request, res: Response, openId: string, name: string, returnPath: string) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: DEFAULT_SESSION_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
  res.redirect(302, sanitizeReturnPath(returnPath));
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/google/start", async (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).json({ error: "Google OAuth is not configured" });
      return;
    }

    try {
      const redirectUri = buildCallbackUrl(req);
      const returnPath = sanitizeReturnPath(getQueryParam(req, "returnTo"));
      const state = await signOAuthState({
        provider: "google",
        redirectUri,
        returnPath,
      });

      const url = new URL(GOOGLE_AUTH_ENDPOINT);
      url.searchParams.set("client_id", ENV.googleClientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");

      res.redirect(302, url.toString());
    } catch (error) {
      console.error("[OAuth] Google start failed", error);
      res.status(500).json({ error: "Google OAuth start failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const parsedState = await parseOAuthState(state);
      const expectedCallback = buildCallbackUrl(req);

      if (!parsedState.redirectUri || parsedState.redirectUri !== expectedCallback) {
        return res.status(400).json({ error: "Invalid OAuth redirect target" });
      }

      if (parsedState.provider === "google") {
        const tokenResponse = await exchangeGoogleCodeForTokens(code, expectedCallback);
        const profile = await fetchGoogleUserInfo(tokenResponse.access_token);

        if (!profile.sub) {
          res.status(400).json({ error: "Google user id missing" });
          return;
        }

        const { user, isNew } = await resolveGoogleUser(profile);

        if (isNew) {
          fireJourneyTrigger("new_user", user.id, user.phone ?? undefined).catch((error) =>
            console.error("[OAuth] new_user trigger failed", error)
          );
        }

        await finalizeLogin(req, res, user.openId, user.name ?? "Cliente Bonatto", parsedState.returnPath);
        return;
      }

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

      if (isNew) {
        const newUser = await db.getUserByOpenId(userInfo.openId);
        if (newUser) {
          fireJourneyTrigger("new_user", newUser.id, newUser.phone ?? undefined).catch(
            (error) => console.error("[OAuth] new_user trigger failed", error)
          );
        }
      }

      await finalizeLogin(req, res, userInfo.openId, userInfo.name || "", parsedState.returnPath);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
