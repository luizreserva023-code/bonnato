export type OrderAttributionPayload = {
  visitorId?: string;
  sessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  referrer?: string;
  landingPage?: string;
  firstTouchSource?: string;
  firstTouchMedium?: string;
  firstTouchCampaign?: string;
  lastTouchSource?: string;
  lastTouchMedium?: string;
  lastTouchCampaign?: string;
};

type Touch = {
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
  utmContent?: string; utmTerm?: string; fbclid?: string; gclid?: string; ttclid?: string;
  referrer?: string; landingPage?: string;
};
type StoredAttribution = { first: Touch; last: Touch; visitorId: string };

const VISITOR_KEY = "bonatto_visitor_id_v1";
const STORE_KEY = (storeId: number) => `bonatto_attribution_v1_${storeId}`;
const SESSION_KEY = (storeId: number) => `bonatto_session_v1_${storeId}`;

function makeId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) { id = makeId("v"); localStorage.setItem(VISITOR_KEY, id); }
  return id;
}

function getSessionId(storeId: number) {
  const key = SESSION_KEY(storeId);
  let id = sessionStorage.getItem(key);
  if (!id) { id = makeId("s"); sessionStorage.setItem(key, id); }
  return id;
}
function currentTouch(): Touch {
  const params = new URLSearchParams(window.location.search);
  const take = (key: string) => params.get(key)?.trim() || undefined;
  return {
    utmSource: take("utm_source"),
    utmMedium: take("utm_medium"),
    utmCampaign: take("utm_campaign"),
    utmContent: take("utm_content"),
    utmTerm: take("utm_term"),
    fbclid: take("fbclid"),
    gclid: take("gclid"),
    ttclid: take("ttclid"),
    referrer: document.referrer || undefined,
    landingPage: `${window.location.pathname}${window.location.search}`,
  };
}

function hasCampaignData(touch: Touch) {
  return Boolean(
    touch.utmSource || touch.utmMedium || touch.utmCampaign ||
    touch.utmContent || touch.utmTerm || touch.fbclid || touch.gclid || touch.ttclid,
  );
}
export function captureStoreAttribution(storeId: number): OrderAttributionPayload {
  const key = STORE_KEY(storeId);
  const visitorId = getVisitorId();
  const touch = currentTouch();
  let stored: StoredAttribution | null = null;
  try {
    const raw = localStorage.getItem(key);
    stored = raw ? JSON.parse(raw) as StoredAttribution : null;
  } catch {
    stored = null;
  }

  if (!stored) {
    stored = { first: touch, last: touch, visitorId };
  } else if (hasCampaignData(touch)) {
    stored.last = { ...stored.last, ...touch };
  }
  localStorage.setItem(key, JSON.stringify(stored));

  const last = stored.last;
  return {
    visitorId: stored.visitorId,
    sessionId: getSessionId(storeId),
    ...last,
    firstTouchSource: stored.first.utmSource,
    firstTouchMedium: stored.first.utmMedium,
    firstTouchCampaign: stored.first.utmCampaign,
    lastTouchSource: last.utmSource,
    lastTouchMedium: last.utmMedium,
    lastTouchCampaign: last.utmCampaign,
  };
}

export function getStoreAttribution(storeId: number) {
  return captureStoreAttribution(storeId);
}
