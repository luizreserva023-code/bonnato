import { describe, expect, it } from "vitest";
import {
  buildDriverDestinationText,
  buildDriverNavigationUrl,
} from "./driverNavigation";

describe("driver navigation", () => {
  const order = {
    deliveryAddress: "Avenida Prefeito José Surdo, 1032",
    deliveryComplement: "Loja 02",
    deliveryNeighborhood: "Centro",
    deliveryCity: "Mateus Leme",
    deliveryState: "MG",
    deliveryCep: "35670-000",
    deliveryLatitude: "-19.9910691",
    deliveryLongitude: "-44.4239334",
  };

  it("prioriza coordenadas para Google Maps", () => {
    expect(buildDriverNavigationUrl(order, "google_maps")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-19.9910691%2C-44.4239334&travelmode=driving",
    );
  });

  it("prioriza coordenadas para Waze", () => {
    expect(buildDriverNavigationUrl(order, "waze")).toBe(
      "https://waze.com/ul?ll=-19.9910691%2C-44.4239334&navigate=yes",
    );
  });

  it("usa endereço completo como fallback quando não há coordenadas", () => {
    const withoutCoordinates = {
      ...order,
      deliveryLatitude: null,
      deliveryLongitude: null,
    };

    expect(buildDriverDestinationText(withoutCoordinates)).toContain("Mateus Leme");
    expect(buildDriverNavigationUrl(withoutCoordinates, "google_maps"))
      .toContain(encodeURIComponent("Avenida Prefeito José Surdo, 1032"));
  });
});
