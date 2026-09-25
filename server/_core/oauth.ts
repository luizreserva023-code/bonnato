import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import {
  createRemoteJWKSet,
  EncryptJWT,
  importPKCS8,
  jwtDecrypt,
  jwtVerify,
  SignJWT,
} from "jose";
import { COOKIE_NAME, DEFAULT_SESSION_MS } from "../../shared/const.ts";
import * as db from "../db.ts";
import { fireJourneyTrigger } from "../automation.ts";
import { getSessionCookieOptions } from "./cookies.ts";
import { ENV } from "./env.ts";
import { decryptOAuthToken, encryptOAuthToken } from "./oauthCrypto.ts";
import { sdk } from "./sdk.ts";
import { createTwoFactorChallenge } from "../twoFactor.ts";

export type SocialOAuthProvider = "google" | "facebook" | "apple" | "instagram";
type OAuthMode = "login" | "connect";

type OAuthStatePayload = {
  provider?: SocialOAuthProvider;
  redirectUri: string;
  returnPath: string;
  mode?: OAuthMode;
  connectUserId?: number;
  codeVerifier?: string;
  nonce?: string;
  consentVersion?: string;
};

type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  idToken?: string;
  scope?: string;
};

type SocialProfile = {
  providerUserId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified: boolean;
  avatarUrl?: string;
  username?: string;
  accountType?: string;
  raw: Record<string, unknown>;
};

const OAUTH_CONSENT_VERSION = "2026-08-01";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const APPLE_AUTH_ENDPOINT = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_ENDPOINT = "https://appleid.apple.com/auth/revoke";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const INSTAGRAM_AUTH_ENDPOINT = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";

function getQueryParam(req: Request, key: string): string | undefined {
  const queryValue = req.query[key];
  if (typeof queryValue === "string") return queryValue;
  const bodyValue = (req.body as Record<string, unknown> | undefined)?.[key];
  return typeof bodyValue === "string" ? bodyValue : undefined;
}

function getProvider(value: unknown): SocialOAuthProvider | undefined {
  return value === "google" || value === "facebook" || value === "apple" || value === "instagram"
    ? value
    : undefined;
}

function getStateSecret() {
  const secret = ENV.cookieSecret || "bonatto-oauth-state-dev-secret";
  return crypto.createHash("sha256").update(`bonatto:oauth-state:${secret}`).digest();
}

function buildBaseAppUrl(req: Request) {
  return (ENV.publicAppUrl || `${req.protocol}://${req.get("host") ?? ""}`).replace(/\/+$/, "");
}

function buildCallbackUrl(req: Request) {
  return `${buildBaseAppUrl(req)}/api/oauth/callback`;
}

function sanitizeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function randomBase64Url(size = 32) {
  return crypto.randomBytes(size).toString("base64url");
}

function createPkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function encryptOAuthState(payload: OAuthStatePayload) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .encrypt(getStateSecret());
}

async function parseOAuthState(state: string): Promise<OAuthStatePayload> {
  try {
    const { payload } = await jwtDecrypt(state, getStateSecret(), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    const provider = getProvider(payload.provider);
    const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
    if (!provider || !redirectUri) throw new Error("Invalid OAuth state");
    return {
      provider,
      redirectUri,
      returnPath: sanitizeReturnPath(typeof payload.returnPath === "string" ? payload.returnPath : "/"),
      mode: payload.mode === "connect" ? "connect" : "login",
      connectUserId: typeof payload.connectUserId === "number" ? payload.connectUserId : undefined,
      codeVerifier: typeof payload.codeVerifier === "string" ? payload.codeVerifier : undefined,
      nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
      consentVersion: typeof payload.consentVersion === "string" ? payload.consentVersion : undefined,
    };
  } catch {
    try {
      const { payload } = await jwtVerify(state, getStateSecret(), { algorithms: ["HS256"] });
      const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
      if (!redirectUri) throw new Error("Invalid OAuth state");
      return {
        provider: getProvider(payload.provider) ?? "google",
        redirectUri,
        returnPath: sanitizeReturnPath(typeof payload.returnPath === "string" ? payload.returnPath : "/"),
        mode: "login",
      };
    } catch {
      const decoded = Buffer.from(state, "base64").toString("utf8");
      const [redirectUri = "", returnPath = "/"] = decoded.split("|");
      if (!redirectUri) throw new Error("Invalid OAuth state");
      return { provider: "google", redirectUri, returnPath: sanitizeReturnPath(returnPath), mode: "login" };
    }
  }
}

export function isSocialProviderConfigured(provider: SocialOAuthProvider) {
  const secureRuntime = !ENV.isProduction || (ENV.cookieSecret.length >= 32 && ENV.oauthEncryptionKey.length >= 32);
  if (!secureRuntime) return false;
  if (provider === "google") return Boolean(ENV.googleClientId && ENV.googleClientSecret);
  if (provider === "facebook") return Boolean(ENV.facebookAppId && ENV.facebookAppSecret);
  if (provider === "apple") {
    return Boolean(ENV.appleClientId && ENV.appleTeamId && ENV.appleKeyId && ENV.applePrivateKey);
  }
  return Boolean(ENV.instagramAppId && ENV.instagramAppSecret);
}

export function getSocialProviderConfiguration() {
  return {
    google: isSocialProviderConfigured("google"),
    facebook: isSocialProviderConfigured("facebook"),
    apple: isSocialProviderConfigured("apple"),
    instagram: isSocialProviderConfigured("instagram"),
  };
}

async function buildAuthorizationUrl(provider: SocialOAuthProvider, state: string, redirectUri: string, codeVerifier: string, nonce: string) {
  if (provider === "google") {
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createPkceChallenge(codeVerifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url;
  }

  if (provider === "facebook") {
    const url = new URL(`https://www.facebook.com/${ENV.metaGraphApiVersion}/dialog/oauth`);
    url.search = new URLSearchParams({
      client_id: ENV.facebookAppId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "public_profile,email",
      state,
    }).toString();
    return url;
  }

  if (provider === "apple") {
    const url = new URL(APPLE_AUTH_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: ENV.appleClientId,
      redirect_uri: redirectUri,
      response_type: "code id_token",
      response_mode: "form_post",
      scope: "name email",
      state,
      nonce,
    }).toString();
    return url;
  }

  const url = new URL(INSTAGRAM_AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: ENV.instagramAppId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic",
    state,
  }).toString();
  return url;
}

async function createAppleClientSecret() {
  const privateKey = ENV.applePrivateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: ENV.appleKeyId })
    .setIssuer(ENV.appleTeamId)
    .setSubject(ENV.appleClientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

async function exchangeCode(provider: SocialOAuthProvider, code: string, state: OAuthStatePayload): Promise<OAuthTokens> {
  if (provider === "google") {
    const body = new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: state.redirectUri,
    });
    if (state.codeVerifier) body.set("code_verifier", state.codeVerifier);
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`);
    const value = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string };
    return { accessToken: value.access_token, refreshToken: value.refresh_token, expiresIn: value.expires_in, idToken: value.id_token, scope: value.scope };
  }

  if (provider === "facebook") {
    const url = new URL(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/oauth/access_token`);
    url.search = new URLSearchParams({ client_id: ENV.facebookAppId, client_secret: ENV.facebookAppSecret, redirect_uri: state.redirectUri, code }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Facebook token exchange failed (${response.status})`);
    const value = await response.json() as { access_token: string; expires_in?: number };
    return { accessToken: value.access_token, expiresIn: value.expires_in, scope: "public_profile,email" };
  }

  if (provider === "apple") {
    const body = new URLSearchParams({
      client_id: ENV.appleClientId,
      client_secret: await createAppleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: state.redirectUri,
    });
    const response = await fetch(APPLE_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error(`Apple token exchange failed (${response.status})`);
    const value = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number; id_token: string };
    return { accessToken: value.access_token, refreshToken: value.refresh_token, expiresIn: value.expires_in, idToken: value.id_token, scope: "name email" };
  }

  const body = new URLSearchParams({
    client_id: ENV.instagramAppId,
    client_secret: ENV.instagramAppSecret,
    grant_type: "authorization_code",
    redirect_uri: state.redirectUri,
    code,
  });
  const response = await fetch(INSTAGRAM_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Instagram token exchange failed (${response.status})`);
  const value = await response.json() as { access_token: string; user_id?: string; permissions?: string[] };
  return { accessToken: value.access_token, scope: value.permissions?.join(" ") ?? "instagram_business_basic" };
}

async function fetchGoogleProfile(tokens: OAuthTokens, nonce?: string): Promise<SocialProfile> {
  if (!tokens.idToken) throw new Error("Google identity token missing");
  await jwtVerify(tokens.idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.googleClientId,
    ...(nonce ? { requiredClaims: ["nonce"] } : {}),
  }).then(({ payload }) => {
    if (nonce && payload.nonce !== nonce) throw new Error("Google nonce mismatch");
  });
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  if (!response.ok) throw new Error(`Google userinfo failed (${response.status})`);
  const raw = await response.json() as Record<string, unknown>;
  return {
    providerUserId: String(raw.sub ?? ""),
    name: typeof raw.name === "string" ? raw.name : undefined,
    firstName: typeof raw.given_name === "string" ? raw.given_name : undefined,
    lastName: typeof raw.family_name === "string" ? raw.family_name : undefined,
    email: typeof raw.email === "string" ? raw.email.toLowerCase() : undefined,
    emailVerified: raw.email_verified === true,
    avatarUrl: typeof raw.picture === "string" ? raw.picture : undefined,
    raw,
  };
}

async function fetchFacebookProfile(tokens: OAuthTokens): Promise<SocialProfile> {
  const debugUrl = new URL(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/debug_token`);
  debugUrl.search = new URLSearchParams({ input_token: tokens.accessToken, access_token: `${ENV.facebookAppId}|${ENV.facebookAppSecret}` }).toString();
  const debugResponse = await fetch(debugUrl);
  const debug = await debugResponse.json() as { data?: { is_valid?: boolean; app_id?: string; user_id?: string } };
  if (!debugResponse.ok || !debug.data?.is_valid || debug.data.app_id !== ENV.facebookAppId) {
    throw new Error("Facebook access token validation failed");
  }
  const profileUrl = new URL(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/me`);
  profileUrl.search = new URLSearchParams({ fields: "id,name,first_name,last_name,email,picture.type(large)", access_token: tokens.accessToken }).toString();
  const response = await fetch(profileUrl);
  if (!response.ok) throw new Error(`Facebook userinfo failed (${response.status})`);
  const raw = await response.json() as Record<string, any>;
  if (String(raw.id ?? "") !== debug.data.user_id) throw new Error("Facebook user id mismatch");
  return {
    providerUserId: String(raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : undefined,
    firstName: typeof raw.first_name === "string" ? raw.first_name : undefined,
    lastName: typeof raw.last_name === "string" ? raw.last_name : undefined,
    email: typeof raw.email === "string" ? raw.email.toLowerCase() : undefined,
    emailVerified: false,
    avatarUrl: typeof raw.picture?.data?.url === "string" ? raw.picture.data.url : undefined,
    raw,
  };
}

async function fetchAppleProfile(tokens: OAuthTokens, nonce?: string, callbackUser?: string): Promise<SocialProfile> {
  if (!tokens.idToken) throw new Error("Apple identity token missing");
  const { payload } = await jwtVerify(tokens.idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: ENV.appleClientId,
  });
  if (nonce && payload.nonce !== nonce) throw new Error("Apple nonce mismatch");
  let supplied: { name?: { firstName?: string; lastName?: string }; email?: string } = {};
  if (callbackUser) {
    try { supplied = JSON.parse(callbackUser) as typeof supplied; } catch { supplied = {}; }
  }
  const firstName = supplied.name?.firstName;
  const lastName = supplied.name?.lastName;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : supplied.email?.toLowerCase();
  return {
    providerUserId: String(payload.sub ?? ""),
    name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
    firstName,
    lastName,
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    raw: { sub: payload.sub, email, email_verified: payload.email_verified, is_private_email: payload.is_private_email, name: supplied.name },
  };
}

async function fetchInstagramProfile(tokens: OAuthTokens): Promise<SocialProfile> {
  const url = new URL("https://graph.instagram.com/me");
  url.search = new URLSearchParams({ fields: "user_id,username,name,account_type,profile_picture_url", access_token: tokens.accessToken }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Instagram userinfo failed (${response.status})`);
  const raw = await response.json() as Record<string, unknown>;
  const accountType = typeof raw.account_type === "string" ? raw.account_type.toUpperCase() : "";
  if (accountType !== "BUSINESS" && accountType !== "CREATOR") {
    throw new Error("Instagram professional account required");
  }
  return {
    providerUserId: String(raw.user_id ?? raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : undefined,
    username: typeof raw.username === "string" ? raw.username : undefined,
    avatarUrl: typeof raw.profile_picture_url === "string" ? raw.profile_picture_url : undefined,
    accountType,
    emailVerified: false,
    raw,
  };
}

async function fetchProfile(provider: SocialOAuthProvider, tokens: OAuthTokens, state: OAuthStatePayload, req?: Request) {
  if (provider === "google") return fetchGoogleProfile(tokens, state.nonce);
  if (provider === "facebook") return fetchFacebookProfile(tokens);
  if (provider === "apple") return fetchAppleProfile(tokens, state.nonce, req ? getQueryParam(req, "user") : undefined);
  return fetchInstagramProfile(tokens);
}

async function resolveUser(req: Request, state: OAuthStatePayload, provider: SocialOAuthProvider, profile: SocialProfile) {
  if (!profile.providerUserId) throw new Error("Provider user id missing");
  if (state.mode === "connect") {
    const sessionUser = await sdk.authenticateRequest(req);
    if (!state.connectUserId || sessionUser.id !== state.connectUserId) throw new Error("OAuth connection session mismatch");
    const owner = await db.getUserByAuthProvider(provider, profile.providerUserId);
    if (owner && owner.id !== sessionUser.id) throw new Error("Social account already linked to another user");
    return { user: sessionUser, isNew: false };
  }

  let user = await db.getUserByAuthProvider(provider, profile.providerUserId);
  let isNew = false;
  if (!user && profile.email && profile.emailVerified) user = await db.getUserByEmail(profile.email);
  if (!user) {
    const openId = `${provider}:${profile.providerUserId}`;
    await db.upsertUser({
      openId,
      name: profile.name ?? profile.username ?? "Cliente Bonatto",
      email: profile.email ?? null,
      loginMethod: provider,
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(openId);
    isNew = true;
  }
  if (!user) throw new Error("Failed to resolve social user");
  return { user, isNew };
}

async function persistSocialAccount(
  userId: number,
  provider: SocialOAuthProvider,
  profile: SocialProfile,
  tokens: OAuthTokens,
  state: OAuthStatePayload,
  requestContext?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const user = await db.getUserById(userId);
  if (!user) throw new Error("User not found");
  const existingAccount = await db.getCustomerAuthProvider(userId, provider);
  await db.updateUserSocialProfile(userId, {
    name: !user.name && profile.name ? profile.name : undefined,
    firstName: !user.firstName && profile.firstName ? profile.firstName : undefined,
    lastName: !user.lastName && profile.lastName ? profile.lastName : undefined,
    email: !user.email && profile.email && profile.emailVerified ? profile.email : undefined,
    username: !user.username && profile.username ? profile.username : undefined,
    avatarUrl: !user.avatarUrl && profile.avatarUrl ? profile.avatarUrl : undefined,
    loginMethod: state.mode === "login" ? provider : undefined,
    emailVerified: profile.emailVerified || user.emailVerified,
    profileCompleted: Boolean(user.name || profile.name) && Boolean(user.email || profile.email),
    lastSignedIn: new Date(),
  });
  await db.linkCustomerAuthProvider({
    userId,
    provider,
    providerUserId: profile.providerUserId,
    providerEmail: profile.email ?? null,
    providerUsername: profile.username ?? null,
    displayName: profile.name ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    accountType: profile.accountType ?? null,
    accessTokenEncrypted: encryptOAuthToken(tokens.accessToken, ENV.oauthEncryptionKey),
    refreshTokenEncrypted: tokens.refreshToken
      ? encryptOAuthToken(tokens.refreshToken, ENV.oauthEncryptionKey)
      : existingAccount?.refreshTokenEncrypted ?? null,
    tokenExpiresAt: tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : existingAccount?.tokenExpiresAt ?? null,
    grantedScopes: tokens.scope?.split(/[ ,]+/).filter(Boolean) ?? [],
    rawProfileJson: JSON.stringify(profile.raw),
    isPrimary: state.mode === "login" && (user.loginMethod === provider || !user.loginMethod),
    consentVersion: state.consentVersion ?? OAUTH_CONSENT_VERSION,
    consentedAt: new Date(),
    lastSyncedAt: new Date(),
  });
  if (state.redirectUri) {
    await db.recordUserConsent({
      userId,
      kind: "social_sync",
      version: state.consentVersion ?? OAUTH_CONSENT_VERSION,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
    });
  }
}

async function finalizeLogin(req: Request, res: Response, openId: string, name: string, returnPath: string) {
  const user = await db.getUserByOpenId(openId);
  const twoFactorEnabled = process.env.TWO_FACTOR_FEATURE_ENABLED === "true";
  if (twoFactorEnabled && user?.totpEnabled) {
    const challengeToken = await createTwoFactorChallenge(user.id);
    const target = new URL("/login", buildBaseAppUrl(req));
    target.searchParams.set("twoFactorChallenge", challengeToken);
    target.searchParams.set("returnTo", sanitizeReturnPath(returnPath));
    res.redirect(302, target.pathname + target.search);
    return;
  }

  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: DEFAULT_SESSION_MS,
    trackSession: true,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: DEFAULT_SESSION_MS });
  res.redirect(302, sanitizeReturnPath(returnPath));
}

function callbackError(res: Response, state: OAuthStatePayload | undefined, error: unknown) {
  const message = error instanceof Error ? error.message : "OAuth failed";
  const code = message === "Instagram professional account required" ? "instagram_professional_required" : "oauth_failed";
  const path = state?.mode === "connect" ? "/minha-conta?tab=perfil" : "/login";
  const separator = path.includes("?") ? "&" : "?";
  res.redirect(302, `${path}${separator}oauthError=${encodeURIComponent(code)}`);
}

async function handleOAuthCallback(req: Request, res: Response) {
  const code = getQueryParam(req, "code");
  const stateValue = getQueryParam(req, "state");
  if (!code || !stateValue) return res.status(400).json({ error: "code and state are required" });
  let state: OAuthStatePayload | undefined;
  try {
    state = await parseOAuthState(stateValue);
    const provider = state.provider;
    if (!provider || state.redirectUri !== buildCallbackUrl(req)) throw new Error("Invalid OAuth redirect target");
    const tokens = await exchangeCode(provider, code, state);
    const profile = await fetchProfile(provider, tokens, state, req);
    const { user, isNew } = await resolveUser(req, state, provider, profile);
    await persistSocialAccount(user.id, provider, profile, tokens, state, {
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
    await db.recordAuthEvent({
      userId: user.id,
      provider,
      event: state.mode === "connect" ? "provider_connected" : "login_success",
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
    if (isNew) fireJourneyTrigger("new_user", user.id, user.phone ?? undefined).catch(console.error);
    if (state.mode === "connect") return res.redirect(302, `${state.returnPath}${state.returnPath.includes("?") ? "&" : "?"}oauthConnected=${provider}`);
    const refreshed = await db.getUserById(user.id);
    return finalizeLogin(req, res, refreshed?.openId ?? user.openId, refreshed?.name ?? "Cliente Bonatto", state.returnPath);
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    await db.recordAuthEvent({ provider: state?.provider, event: "login_failure", ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null }).catch(console.error);
    return callbackError(res, state, error);
  }
}

export async function syncSocialProvider(userId: number, provider: SocialOAuthProvider) {
  if (provider === "apple") throw new Error("Apple profile requires reconnection");
  const account = await db.getCustomerAuthProvider(userId, provider);
  if (!account?.accessTokenEncrypted) throw new Error("Social connection has no reusable token");
  let accessToken = decryptOAuthToken(account.accessTokenEncrypted, ENV.oauthEncryptionKey);
  const refreshToken = decryptOAuthToken(account.refreshTokenEncrypted, ENV.oauthEncryptionKey) ?? undefined;
  if (!accessToken) throw new Error("Social connection token unavailable");
  let refreshedExpiresIn: number | undefined;
  if (provider === "google" && account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now() + 60_000) {
    if (!refreshToken) throw new Error("Google reconnection required");
    const body = new URLSearchParams({ client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, grant_type: "refresh_token", refresh_token: refreshToken });
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error("Google token refresh failed");
    const refreshed = await response.json() as { access_token: string; expires_in?: number; scope?: string };
    accessToken = refreshed.access_token;
    refreshedExpiresIn = refreshed.expires_in;
  } else if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now()) {
    throw new Error("Social provider reconnection required");
  }
  const tokens: OAuthTokens = { accessToken, refreshToken, expiresIn: refreshedExpiresIn, scope: account.grantedScopes ? JSON.parse(account.grantedScopes).join(" ") : undefined };
  const profile = await fetchProfile(provider, tokens, { provider, redirectUri: "", returnPath: "/", mode: "connect" });
  await persistSocialAccount(userId, provider, profile, tokens, { provider, redirectUri: "", returnPath: "/", mode: "connect", consentVersion: account.consentVersion ?? OAUTH_CONSENT_VERSION });
  await db.recordAuthEvent({ userId, provider, event: "profile_synced" });
  return profile;
}

export async function revokeSocialProvider(provider: SocialOAuthProvider, accessTokenEncrypted: string | null, refreshTokenEncrypted: string | null) {
  const accessToken = decryptOAuthToken(accessTokenEncrypted, ENV.oauthEncryptionKey);
  const refreshToken = decryptOAuthToken(refreshTokenEncrypted, ENV.oauthEncryptionKey);
  if (!accessToken && !refreshToken) return;
  if (provider === "google") {
    const body = new URLSearchParams({ token: refreshToken ?? accessToken ?? "" });
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  } else if (provider === "facebook") {
    await fetch(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/me/permissions?access_token=${encodeURIComponent(accessToken ?? "")}`, { method: "DELETE" });
  } else if (provider === "apple") {
    const body = new URLSearchParams({ client_id: ENV.appleClientId, client_secret: await createAppleClientSecret(), token: refreshToken ?? accessToken ?? "", token_type_hint: refreshToken ? "refresh_token" : "access_token" });
    await fetch(APPLE_REVOKE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  }
}

export function registerOAuthRoutes(app: Express) {
  const startHandler = async (req: Request, res: Response, forcedProvider?: SocialOAuthProvider) => {
    const provider = forcedProvider ?? getProvider((req.params as Record<string, string | undefined>).provider);
    if (!provider || !isSocialProviderConfigured(provider)) return res.status(503).json({ error: "OAuth provider is not configured" });
    const mode: OAuthMode = getQueryParam(req, "mode") === "connect" ? "connect" : "login";
    if (provider === "instagram" && mode !== "connect") return res.status(400).json({ error: "Instagram is available only as a professional account connection" });
    try {
      const connectUser = mode === "connect" ? await sdk.authenticateRequest(req) : null;
      const redirectUri = buildCallbackUrl(req);
      const returnPath = sanitizeReturnPath(getQueryParam(req, "returnTo") ?? (mode === "connect" ? "/minha-conta?tab=perfil" : "/"));
      const codeVerifier = randomBase64Url(48);
      const nonce = randomBase64Url(24);
      const state = await encryptOAuthState({ provider, redirectUri, returnPath, mode, connectUserId: connectUser?.id, codeVerifier, nonce, consentVersion: OAUTH_CONSENT_VERSION });
      const url = await buildAuthorizationUrl(provider, state, redirectUri, codeVerifier, nonce);
      return res.redirect(302, url.toString());
    } catch (error) {
      console.error(`[OAuth] ${provider} start failed`, error);
      return res.status(mode === "connect" ? 401 : 500).json({ error: "OAuth start failed" });
    }
  };

  app.get("/api/oauth/google/start", (req, res) => startHandler(req, res, "google"));
  app.get("/api/oauth/:provider/start", (req, res) => startHandler(req, res));
  app.get("/api/oauth/callback", handleOAuthCallback);
  app.post("/api/oauth/callback", handleOAuthCallback);
}
