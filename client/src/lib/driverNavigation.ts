export type DriverNavigationProvider = "google_maps" | "waze";

export type DriverNavigationOrder = {
  deliveryAddress?: string | null;
  deliveryComplement?: string | null;
  deliveryNeighborhood?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryCep?: string | null;
  deliveryLatitude?: string | number | null;
  deliveryLongitude?: string | number | null;
};

function finiteCoordinate(value: string | number | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildDriverDestinationText(order: DriverNavigationOrder) {
  return [
    order.deliveryAddress,
    order.deliveryComplement,
    order.deliveryNeighborhood,
    order.deliveryCity,
    order.deliveryState,
    order.deliveryCep,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildDriverNavigationUrl(
  order: DriverNavigationOrder,
  provider: DriverNavigationProvider,
) {
  const latitude = finiteCoordinate(order.deliveryLatitude);
  const longitude = finiteCoordinate(order.deliveryLongitude);
  const hasCoordinates =
    latitude !== null
    && longitude !== null
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0);

  if (provider === "google_maps") {
    const destination = hasCoordinates
      ? `${latitude},${longitude}`
      : buildDriverDestinationText(order);

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  }

  if (hasCoordinates) {
    return `https://waze.com/ul?ll=${encodeURIComponent(`${latitude},${longitude}`)}&navigate=yes`;
  }

  return `https://waze.com/ul?q=${encodeURIComponent(buildDriverDestinationText(order))}&navigate=yes`;
}
