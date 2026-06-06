export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type SocialProvider = "google" | "facebook" | "apple" | "instagram";

// Generate login URL at runtime so redirect URI reflects the current origin.
// Pass returnPath (e.g. "/checkout") to redirect back after login.
export const getLoginUrl = (returnPath?: string, provider?: SocialProvider) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (!oauthPortalUrl || !appId) {
    return returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : "/login";
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
