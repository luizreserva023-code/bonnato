import { describe, expect, it } from "vitest";

import {
  ESSENTIAL_FEATURE_FLAGS,
  enforceTenantSafeFeatures,
  mergeWhiteLabelFeatures,
  mergeWhiteLabelPages,
  mergeWhiteLabelProviders,
} from "../shared/whiteLabel.ts";

describe("white-label runtime configuration", () => {
  it("keeps tenant defaults isolated from the Bonatto feature set", () => {
    const features = mergeWhiteLabelFeatures(undefined, false);

    expect(features.adminTabs.orders).toBe(true);
    expect(features.adminTabs.menu).toBe(true);
    expect(features.club).toBe(false);
    expect(features.automations).toBe(false);
  });

  it("preserves modules after tenant isolation", () => {
    const requested = mergeWhiteLabelFeatures({
      ...ESSENTIAL_FEATURE_FLAGS,
      automations: true,
      loyalty: true,
      club: true,
      adminTabs: { ...ESSENTIAL_FEATURE_FLAGS.adminTabs, club: true },
    }, false);

    const safe = enforceTenantSafeFeatures(requested);

    expect(safe.automations).toBe(true);
    expect(safe.loyalty).toBe(true);
    expect(safe.club).toBe(true);
    expect(safe.adminTabs.club).toBe(true);
    expect(safe.notifications).toBe(true);
  });

  it("merges nested provider and page configuration without dropping defaults", () => {
    const providers = mergeWhiteLabelProviders({
      payments: { pix: false, card: false, cash: true, provider: "manual" },
    });
    const pages = mergeWhiteLabelPages({
      home: { enabled: true, title: "Minha pizzaria", description: "Delivery local", heroImage: "" },
    });

    expect(providers.payments.pix).toBe(false);
    expect(providers.payments.cash).toBe(true);
    expect(providers.maps.provider).toBe("openstreetmap");
    expect(pages.home.title).toBe("Minha pizzaria");
    expect(pages.home.enabled).toBe(true);
    expect(pages.checkout.enabled).toBe(true);
  });
});
