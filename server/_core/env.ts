const IS_PRODUCTION = process.env.NODE_ENV === "production";

const rawJwtSecret = process.env.JWT_SECRET ?? "";

if (IS_PRODUCTION && rawJwtSecret.length < 32) {
  // Warn loudly but do not crash — the platform may inject a short secret.
  // Sessions signed with a short key are weaker but the app remains functional.
  console.warn(
    "[env] JWT_SECRET is missing or too short (" + rawJwtSecret.length + " chars). Set a random string of at least 32 chars for production security."
  );
}

if (!rawJwtSecret) {
  // In dev, warn loudly so it's obvious sessions are effectively unsigned.
  console.warn(
    "[env] JWT_SECRET is empty — sessions are signed with an empty key (dev only). Set JWT_SECRET for real auth."
  );
}

export const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";

function deriveSessionAppId() {
  const explicitAppId = process.env.VITE_APP_ID?.trim();
  if (explicitAppId) return explicitAppId;

  if (PUBLIC_APP_URL) {
    try {
      const hostname = new URL(PUBLIC_APP_URL).hostname.replace(/^www\./, "");
      if (hostname) return hostname;
    } catch {
      // Fall through to the static fallback below.
    }
  }

  return "bonatto-web";
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  sessionAppId: deriveSessionAppId(),
  cookieSecret: rawJwtSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: IS_PRODUCTION,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Bonatto Pizza <onboarding@resend.dev>",
  publicAppUrl: PUBLIC_APP_URL,
};
