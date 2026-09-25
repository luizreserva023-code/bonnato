type MetaEventParams = Record<string, string | number | boolean | string[] | number[] | null | undefined>;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
    __bonattoMetaPixelId?: string | null;
  }
}

const initializedPixels = new Set<string>();

function ensureFbq() {
  if (window.fbq) return window.fbq;

  const fbq = function (...args: any[]) {
    const target = fbq as any;
    if (target.callMethod) target.callMethod(...args);
    else target.queue.push(args);
  } as any;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  if (!document.querySelector('script[data-bonatto-meta-pixel="true"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.bonattoMetaPixel = "true";
    document.head.appendChild(script);
  }

  return fbq as (...args: any[]) => void;
}

export function setActiveMetaPixel(pixelId: string | null | undefined) {
  const normalized = pixelId?.trim() || null;
  window.__bonattoMetaPixelId = normalized;
  if (!normalized) return;

  const fbq = ensureFbq();
  if (!initializedPixels.has(normalized)) {
    fbq("init", normalized);
    initializedPixels.add(normalized);
  }
}

export function trackMetaEvent(eventName: string, params: MetaEventParams = {}) {
  const pixelId = window.__bonattoMetaPixelId;
  if (!pixelId) return;
  const fbq = ensureFbq();
  fbq("trackSingle", pixelId, eventName, params);
}
