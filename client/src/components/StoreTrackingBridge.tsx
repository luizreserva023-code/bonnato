import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/contexts/StoreContext";
import { trpc } from "@/lib/trpc";
import { setActiveMetaPixel, trackMetaEvent } from "@/lib/storeTracking";
import { captureStoreAttribution } from "@/lib/marketingAttribution";
import {
  BONATTO_ANALYTICS_EVENT,
  createAnalyticsEventId,
  getDeviceType,
  type BonattoAnalyticsEventDetail,
} from "@/lib/analyticsTracking";

export function StoreTrackingBridge() {
  const { selectedStore } = useStore();
  const [location] = useLocation();
  const tracking = trpc.stores.tracking.useQuery(
    { storeId: selectedStore?.id ?? 0 },
    { enabled: Boolean(selectedStore?.id), staleTime: 5 * 60 * 1000 },
  );
  const analyticsTrack = trpc.analytics.track.useMutation();
  const analyticsMutateRef = useRef(analyticsTrack.mutate);
  const lastAutomaticEventRef = useRef<string | null>(null);
  analyticsMutateRef.current = analyticsTrack.mutate;

  const sendAnalyticsEvent = useCallback((detail: BonattoAnalyticsEventDetail) => {
    if (!selectedStore?.id) return;
    try {
      const attribution = captureStoreAttribution(selectedStore.id);
      if (!attribution.sessionId) return;

      analyticsMutateRef.current({
        eventId: createAnalyticsEventId(detail.eventType.toLowerCase()),
        eventType: detail.eventType,
        storeId: selectedStore.id,
        sessionId: attribution.sessionId,
        visitorId: attribution.visitorId,
        productId: detail.productId,
        categoryId: detail.categoryId,
        source: "web",
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
        deviceType: getDeviceType(),
        metadata: detail.metadata,
      });
    } catch {
      // Analytics is best effort and must never affect customer flows.
    }
  }, [selectedStore?.id]);

  useEffect(() => {
    if (!selectedStore?.id) return;
    try {
      captureStoreAttribution(selectedStore.id);
    } catch {
      // Attribution is best effort.
    }
  }, [selectedStore?.id, location]);

  useEffect(() => {
    const settings = tracking.data;
    const pixelId = settings?.metaPixelEnabled ? settings.metaPixelId : null;
    setActiveMetaPixel(pixelId);

    if (!selectedStore?.id || !pixelId) return;
    trackMetaEvent("PageView", {
      store_id: selectedStore.id,
      store_slug: selectedStore.slug,
      store_city: selectedStore.city,
      page_path: location,
    });
  }, [location, selectedStore?.city, selectedStore?.id, selectedStore?.slug, tracking.data]);

  useEffect(() => {
    if (!selectedStore?.id) return;
    const path = window.location.pathname;
    const storeRoot = `/${selectedStore.slug}`;

    let eventType: BonattoAnalyticsEventDetail["eventType"] | null = null;
    if (path === "/" || path === storeRoot || path === `${storeRoot}/`) eventType = "STORE_VIEW";
    else if (path === "/cardapio" || path === `${storeRoot}/cardapio`) eventType = "MENU_VIEW";
    else if (path === "/checkout" || path === `${storeRoot}/checkout`) eventType = "CHECKOUT_STARTED";

    if (!eventType) return;

    const automaticEventKey = `${selectedStore.id}:${eventType}:${path}`;
    if (lastAutomaticEventRef.current === automaticEventKey) return;
    lastAutomaticEventRef.current = automaticEventKey;

    sendAnalyticsEvent({ eventType, metadata: { page_path: path } });
  }, [location, selectedStore?.id, selectedStore?.slug, sendAnalyticsEvent]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BonattoAnalyticsEventDetail>).detail;
      if (!detail?.eventType) return;
      sendAnalyticsEvent(detail);
    };
    window.addEventListener(BONATTO_ANALYTICS_EVENT, listener);
    return () => window.removeEventListener(BONATTO_ANALYTICS_EVENT, listener);
  }, [sendAnalyticsEvent]);

  return null;
}
