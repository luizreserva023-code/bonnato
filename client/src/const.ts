export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type SocialProvider = "google" | "facebook" | "apple" | "instagram";

export const getCurrentReturnPath = () => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

// Generate login URL at runtime so redirect URI reflects the current origin.
// Pass returnPath (e.g. "/checkout") to redirect back after login.
export const getLoginUrl = (returnPath?: string, provider?: SocialProvider) => {
  if (provider) {
    const url = new URL(`/api/oauth/${provider}/start`, window.location.origin);
    if (returnPath) {
      url.searchParams.set("returnTo", returnPath);
    }
    return url.toString();
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (!oauthPortalUrl || !appId) {
    return returnPath ? `/login?returnTo=${encodeURIComponent(returnPath)}` : "/login";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  // Encode returnPath into state: "<redirectUri>|<returnPath>"
  const statePayload = returnPath ? `${redirectUri}|${returnPath}` : redirectUri;
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  if (provider) {
    url.searchParams.set("provider", provider);
  }

  return url.toString();
};

export const getSocialConnectUrl = (provider: SocialProvider, returnPath = "/minha-conta?tab=perfil") => {
  const url = new URL(`/api/oauth/${provider}/start`, window.location.origin);
  url.searchParams.set("mode", "connect");
  url.searchParams.set("returnTo", returnPath);
  return url.toString();
};
