import { createHash } from "crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import {
  deliveryDistanceZones,
  deliveryGeocodingCache,
  deliveryRouteCache,
  storeDeliverySettings,
  stores,
} from "../../drizzle/schema.ts";
import { getDb } from "../db.ts";

export type DeliveryAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeocodingResult = Coordinates & {
  provider: string;
  confidence: number;
  normalizedAddress?: string | null;
};

export type RoutingResult = {
  provider: string;
  routeDistanceMeters: number;
};

export interface GeocodingProvider {
  readonly name: string;
  geocode(address: DeliveryAddress): Promise<GeocodingResult | null>;
}

export interface RoutingProvider {
  readonly name: string;
  calculateDistance(origin: Coordinates, destination: Coordinates): Promise<RoutingResult | null>;
}

export type DeliveryZoneInput = {
  id?: number;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  deliveryFeeCents: number;
  estimatedMinutes: number;
  sortOrder?: number;
  active?: boolean;
};

export type DeliveryCoverageGap = {
  fromMeters: number;
  toMeters: number;
};

export type DeliveryQuoteReason =
  | "DELIVERY_DISABLED"
  | "STORE_LOCATION_MISSING"
  | "INVALID_ADDRESS"
  | "ADDRESS_NOT_FOUND"
  | "LOW_CONFIDENCE_ADDRESS"
  | "ROUTING_PROVIDER_UNAVAILABLE"
  | "OUTSIDE_DELIVERY_AREA"
  | "NO_COVERAGE_ZONE"
  | "NO_DELIVERY_ZONES";

export type AlternativeDeliveryStore = {
  storeId: number;
  name: string;
  slug: string;
  city: string;
  distanceKm: number;
  distanceMeters: number;
  deliveryFee: number;
  deliveryFeeCents: number;
  estimatedMinutes: number;
};

export type DeliveryQuote =
  | {
      available: true;
      storeId: number;
      zoneId: number;
      distanceKm: number;
      distanceMeters: number;
      straightLineDistanceKm: number;
      straightLineDistanceMeters: number;
      routeDistanceKm: number | null;
      routeDistanceMeters: number | null;
      deliveryFee: number;
      deliveryFeeCents: number;
      estimatedMinutes: number;
      destination: Coordinates;
      origin: Coordinates;
      geocodingProvider: string;
      routingProvider: string | null;
      usedStraightLineFallback: boolean;
    }
  | {
      available: false;
      storeId: number;
      reason: DeliveryQuoteReason;
      distanceKm?: number;
      distanceMeters?: number;
      straightLineDistanceKm?: number;
      straightLineDistanceMeters?: number;
      routeDistanceKm?: number | null;
      routeDistanceMeters?: number | null;
      geocodingProvider?: string;
      routingProvider?: string | null;
    };

const DEFAULT_GEOCODE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_ROUTE_TTL_SECONDS = 24 * 60 * 60;

function envPositiveInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BRAZILIAN_STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

function stateMatches(requestedState: string, address: Record<string, unknown>) {
  const requestedUf = normalizeText(requestedState);
  const requestedName = normalizeText(BRAZILIAN_STATE_NAMES[requestedState.toUpperCase()]);
  const resultState = normalizeText(String(address.state ?? ""));
  const resultIso = normalizeText(String(address["ISO3166-2-lvl4"] ?? address["ISO3166-2-lvl3"] ?? ""));

  return Boolean(
    requestedUf
    && (
      resultState === requestedUf
      || (requestedName && resultState === requestedName)
      || resultIso === `br ${requestedUf}`
      || resultIso.endsWith(` ${requestedUf}`)
    )
  );
}

export function buildNominatimSearchAttempts(address: DeliveryAddress) {
  const normalized = normalizeDeliveryAddress(address);
  const structured = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "br",
    street: `${normalized.number} ${normalized.street}`.trim(),
    city: normalized.city,
    state: normalized.state,
    postalcode: normalized.postalCode,
    country: "Brasil",
  });

  const fallbackQuery = [
    `${normalized.street}, ${normalized.number}`,
    normalized.city,
    normalized.state,
    normalized.postalCode,
    "Brasil",
  ].filter(Boolean).join(", ");
  const fallback = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "br",
    q: fallbackQuery,
  });

  return [structured, fallback];
}

export function normalizeDeliveryAddress(address: DeliveryAddress) {
  return {
    postalCode: address.postalCode.replace(/\D/g, ""),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement?.trim() || null,
    neighborhood: address.neighborhood?.trim() || null,
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
  };
}

export function isValidCoordinates(coords: Coordinates) {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

export function haversineMeters(origin: Coordinates, destination: Coordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(destination.latitude);
  const deltaLat = toRad(destination.latitude - origin.latitude);
  const deltaLon = toRad(destination.longitude - origin.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return Math.max(0, Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function addressCacheKey(address: DeliveryAddress) {
  const normalized = normalizeDeliveryAddress(address);
  return hash(`geocode-v2:${JSON.stringify(normalized)}`);
}

function routeCacheKey(storeId: number, provider: string, origin: Coordinates, destination: Coordinates) {
  const round = (value: number) => Number(value.toFixed(6));
  return hash(JSON.stringify({
    storeId,
    provider,
    origin: [round(origin.latitude), round(origin.longitude)],
    destination: [round(destination.latitude), round(destination.longitude)],
  }));
}

function getNominatimConfidence(raw: any, requested: DeliveryAddress) {
  const address = raw?.address ?? {};
  let score = 0;
  const requestedStreet = normalizeText(requested.street);
  const resultStreet = normalizeText(address.road || address.pedestrian || address.residential || address.neighbourhood);
  if (requestedStreet && resultStreet && (resultStreet.includes(requestedStreet) || requestedStreet.includes(resultStreet))) score += 0.35;

  if (address.house_number) score += 0.15;

  const requestedCity = normalizeText(requested.city);
  const resultCity = normalizeText(address.city || address.town || address.village || address.municipality || address.county);
  if (requestedCity && resultCity && (resultCity.includes(requestedCity) || requestedCity.includes(resultCity))) score += 0.25;

  if (stateMatches(requested.state, address)) score += 0.15;

  const requestedPostalCode = requested.postalCode.replace(/\D/g, "");
  const resultPostalCode = String(address.postcode ?? "").replace(/\D/g, "");
  if (requestedPostalCode && resultPostalCode && requestedPostalCode.slice(0, 5) === resultPostalCode.slice(0, 5)) score += 0.10;

  return Math.min(1, Number(score.toFixed(4)));
}

class NominatimGeocodingProvider implements GeocodingProvider {
  readonly name = "nominatim";
  private readonly baseUrl = process.env.DELIVERY_NOMINATIM_BASE_URL?.trim() || "https://nominatim.openstreetmap.org";

  async geocode(address: DeliveryAddress): Promise<GeocodingResult | null> {
    const normalized = normalizeDeliveryAddress(address);
    const attempts = buildNominatimSearchAttempts(normalized);

    for (let index = 0; index < attempts.length; index += 1) {
      const url = new URL("/search", this.baseUrl);
      url.search = attempts[index].toString();

      const response = await fetch(url, {
        headers: {
          "User-Agent": process.env.DELIVERY_GEOCODING_USER_AGENT?.trim() || "BonattoDelivery/1.0 (+https://bonatto-pizza.netlify.app)",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);

      const rows = await response.json() as any[];
      const candidates = rows
        .map((row) => {
          const latitude = Number(row.lat);
          const longitude = Number(row.lon);
          const confidence = getNominatimConfidence(row, normalized);
          return {
            latitude,
            longitude,
            confidence,
            displayName: typeof row.display_name === "string" ? row.display_name : null,
          };
        })
        .filter((row) => isValidCoordinates(row));

      if (!candidates.length) continue;
      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0];

      return {
        latitude: best.latitude,
        longitude: best.longitude,
        confidence: best.confidence,
        normalizedAddress: best.displayName,
        provider: index === 0 ? this.name : `${this.name}-fallback`,
      };
    }

    return null;
  }
}

class OsrmRoutingProvider implements RoutingProvider {
  readonly name = "osrm";
  private readonly baseUrl = process.env.DELIVERY_OSRM_BASE_URL?.trim() || "https://router.project-osrm.org";

  async calculateDistance(origin: Coordinates, destination: Coordinates): Promise<RoutingResult | null> {
    const path = `/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("overview", "false");
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("steps", "false");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "BonattoDelivery/1.0 (+https://bonatto-pizza.netlify.app)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const body = await response.json() as any;
    const distance = Number(body?.routes?.[0]?.distance);
    if (!Number.isFinite(distance) || distance < 0) return null;
    return { provider: this.name, routeDistanceMeters: Math.round(distance) };
  }
}

export function getGeocodingProvider(): GeocodingProvider {
  const provider = (process.env.DELIVERY_GEOCODING_PROVIDER ?? "nominatim").trim().toLowerCase();
  if (provider === "nominatim") return new NominatimGeocodingProvider();
  throw new Error(`Unsupported geocoding provider: ${provider}`);
}

export function getRoutingProvider(): RoutingProvider {
  const provider = (process.env.DELIVERY_ROUTING_PROVIDER ?? "osrm").trim().toLowerCase();
  if (provider === "osrm") return new OsrmRoutingProvider();
  throw new Error(`Unsupported routing provider: ${provider}`);
}

export function findDeliveryZoneForDistance<T extends {
  minDistanceMeters: number;
  maxDistanceMeters: number;
  active?: boolean;
}>(zones: T[], distanceMeters: number): T | null {
  if (!Number.isInteger(distanceMeters) || distanceMeters < 0) return null;
  const candidates = [...zones]
    .filter((zone) => zone.active !== false)
    .sort((a, b) => a.minDistanceMeters - b.minDistanceMeters || a.maxDistanceMeters - b.maxDistanceMeters);

  return candidates.find((candidate) => {
    // Convenção: a primeira faixa inclui zero e seu limite superior.
    // Nas demais, o limite inferior é exclusivo e o superior é inclusivo.
    const lowerOk = candidate.minDistanceMeters === 0
      ? distanceMeters >= 0
      : distanceMeters > candidate.minDistanceMeters;
    return lowerOk && distanceMeters <= candidate.maxDistanceMeters;
  }) ?? null;
}

export function rankAlternativeDeliveryStores(alternatives: AlternativeDeliveryStore[]) {
  return [...alternatives].sort((a, b) =>
    a.distanceMeters - b.distanceMeters
    || a.deliveryFeeCents - b.deliveryFeeCents
    || a.estimatedMinutes - b.estimatedMinutes
    || a.storeId - b.storeId
  );
}

export function resolveCommercialDistance(input: {
  routeDistanceMeters: number | null;
  straightLineDistanceMeters: number;
  allowStraightLineFallback: boolean;
}) {
  if (Number.isInteger(input.routeDistanceMeters) && (input.routeDistanceMeters ?? -1) >= 0) {
    return {
      available: true as const,
      distanceMeters: input.routeDistanceMeters as number,
      usedStraightLineFallback: false,
    };
  }

  if (input.allowStraightLineFallback && Number.isInteger(input.straightLineDistanceMeters) && input.straightLineDistanceMeters >= 0) {
    return {
      available: true as const,
      distanceMeters: input.straightLineDistanceMeters,
      usedStraightLineFallback: true,
    };
  }

  return { available: false as const };
}

export function validateDeliveryZones(zones: DeliveryZoneInput[]) {
  const errors: string[] = [];
  const gaps: DeliveryCoverageGap[] = [];
  const normalized = zones
    .filter((zone) => zone.active !== false)
    .map((zone, index) => ({ ...zone, _index: index }))
    .sort((a, b) => a.minDistanceMeters - b.minDistanceMeters || a.maxDistanceMeters - b.maxDistanceMeters);

  for (const zone of normalized) {
    if (!Number.isInteger(zone.minDistanceMeters) || zone.minDistanceMeters < 0) errors.push(`Faixa ${zone._index + 1}: distância mínima inválida.`);
    if (!Number.isInteger(zone.maxDistanceMeters) || zone.maxDistanceMeters <= zone.minDistanceMeters) errors.push(`Faixa ${zone._index + 1}: distância máxima deve ser maior que a mínima.`);
    if (!Number.isInteger(zone.deliveryFeeCents) || zone.deliveryFeeCents < 0) errors.push(`Faixa ${zone._index + 1}: taxa inválida.`);
    if (!Number.isInteger(zone.estimatedMinutes) || zone.estimatedMinutes <= 0) errors.push(`Faixa ${zone._index + 1}: tempo estimado inválido.`);
  }

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (current.minDistanceMeters < previous.maxDistanceMeters) {
      errors.push(
        `As faixas ${previous.minDistanceMeters / 1000}–${previous.maxDistanceMeters / 1000} km e ${current.minDistanceMeters / 1000}–${current.maxDistanceMeters / 1000} km se sobrepõem.`,
      );
    } else if (current.minDistanceMeters > previous.maxDistanceMeters) {
      gaps.push({ fromMeters: previous.maxDistanceMeters, toMeters: current.minDistanceMeters });
    }
  }

  return { valid: errors.length === 0, errors, gaps };
}

async function geocodeWithCache(address: DeliveryAddress, requestId?: string): Promise<GeocodingResult | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const key = addressCacheKey(address);
  const now = new Date();
  const [cached] = await db
    .select()
    .from(deliveryGeocodingCache)
    .where(and(eq(deliveryGeocodingCache.addressKey, key), gt(deliveryGeocodingCache.expiresAt, now)))
    .limit(1);
  if (cached) {
    return {
      latitude: Number(cached.latitude),
      longitude: Number(cached.longitude),
      confidence: Number(cached.confidence ?? "1"),
      provider: cached.provider,
      normalizedAddress: null,
    };
  }

  const provider = getGeocodingProvider();
  const startedAt = Date.now();
  try {
    const result = await provider.geocode(address);
    console.info("[DeliveryGeocoding]", JSON.stringify({
      requestId: requestId ?? null,
      provider: provider.name,
      status: result ? "ok" : "not_found",
      durationMs: Date.now() - startedAt,
    }));
    if (!result) return null;

    const ttlSeconds = envPositiveInt("DELIVERY_GEOCODING_CACHE_TTL_SECONDS", DEFAULT_GEOCODE_TTL_SECONDS);
    await db.insert(deliveryGeocodingCache)
      .values({
        addressKey: key,
        latitude: result.latitude.toFixed(7),
        longitude: result.longitude.toFixed(7),
        confidence: result.confidence.toFixed(4),
        provider: result.provider,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: deliveryGeocodingCache.addressKey,
        set: {
          latitude: result.latitude.toFixed(7),
          longitude: result.longitude.toFixed(7),
          confidence: result.confidence.toFixed(4),
          provider: result.provider,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
          updatedAt: now,
        },
      });
    return result;
  } catch (error) {
    console.error("[DeliveryGeocoding]", JSON.stringify({
      requestId: requestId ?? null,
      provider: provider.name,
      status: "error",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}

async function routeWithCache(
  storeId: number,
  origin: Coordinates,
  destination: Coordinates,
  straightLineDistanceMeters: number,
  requestId?: string,
): Promise<RoutingResult | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const provider = getRoutingProvider();
  const key = routeCacheKey(storeId, provider.name, origin, destination);
  const now = new Date();
  const [cached] = await db
    .select()
    .from(deliveryRouteCache)
    .where(and(eq(deliveryRouteCache.routeKey, key), gt(deliveryRouteCache.expiresAt, now)))
    .limit(1);
  if (cached) {
    return { provider: cached.provider, routeDistanceMeters: cached.routeDistanceMeters };
  }

  const startedAt = Date.now();
  try {
    const result = await provider.calculateDistance(origin, destination);
    console.info("[DeliveryRouting]", JSON.stringify({
      requestId: requestId ?? null,
      storeId,
      provider: provider.name,
      status: result ? "ok" : "no_route",
      durationMs: Date.now() - startedAt,
    }));
    if (!result) return null;

    const ttlSeconds = envPositiveInt("DELIVERY_ROUTE_CACHE_TTL_SECONDS", DEFAULT_ROUTE_TTL_SECONDS);
    await db.insert(deliveryRouteCache)
      .values({
        routeKey: key,
        storeId,
        routeDistanceMeters: result.routeDistanceMeters,
        straightLineDistanceMeters,
        provider: result.provider,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: deliveryRouteCache.routeKey,
        set: {
          routeDistanceMeters: result.routeDistanceMeters,
          straightLineDistanceMeters,
          provider: result.provider,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
          updatedAt: now,
        },
      });
    return result;
  } catch (error) {
    console.error("[DeliveryRouting]", JSON.stringify({
      requestId: requestId ?? null,
      storeId,
      provider: provider.name,
      status: "error",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}

export async function geocodeDeliveryAddress(address: DeliveryAddress, requestId?: string) {
  const normalized = normalizeDeliveryAddress(address);
  if (
    normalized.street.length < 2 ||
    normalized.number.length < 1 ||
    normalized.city.length < 2 ||
    normalized.state.length !== 2 ||
    normalized.postalCode.length < 8
  ) {
    return { ok: false as const, reason: "INVALID_ADDRESS" as const };
  }

  try {
    const result = await geocodeWithCache(normalized, requestId);
    if (!result) return { ok: false as const, reason: "ADDRESS_NOT_FOUND" as const };
    const minimumConfidence = Number(process.env.DELIVERY_MIN_GEOCODING_CONFIDENCE ?? "0.55");
    if (!Number.isFinite(minimumConfidence) || result.confidence < minimumConfidence) {
      return { ok: false as const, reason: "LOW_CONFIDENCE_ADDRESS" as const, result };
    }
    return { ok: true as const, result };
  } catch {
    return { ok: false as const, reason: "ADDRESS_NOT_FOUND" as const };
  }
}

export async function getDeliveryConfiguration(storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [[store], [settings], zones] = await Promise.all([
    db.select({
      id: stores.id,
      name: stores.name,
      city: stores.city,
      address: stores.address,
      latitude: stores.latitude,
      longitude: stores.longitude,
    }).from(stores).where(eq(stores.id, storeId)).limit(1),
    db.select().from(storeDeliverySettings).where(eq(storeDeliverySettings.storeId, storeId)).limit(1),
    db.select().from(deliveryDistanceZones)
      .where(eq(deliveryDistanceZones.storeId, storeId))
      .orderBy(asc(deliveryDistanceZones.sortOrder), asc(deliveryDistanceZones.minDistanceMeters)),
  ]);
  const validation = validateDeliveryZones(zones);
  return { store: store ?? null, settings: settings ?? null, zones, gaps: validation.gaps, errors: validation.errors };
}

export async function findAlternativeDeliveryStores(input: {
  selectedStoreId: number;
  address: DeliveryAddress;
  requestId?: string;
}): Promise<AlternativeDeliveryStore[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const candidateStores = await db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      city: stores.city,
    })
    .from(stores)
    .where(eq(stores.active, true));

  const alternatives = await Promise.allSettled(
    candidateStores
      .filter((store) => store.id !== input.selectedStoreId)
      .map(async (store) => {
        const quote = await quoteDelivery({
          storeId: store.id,
          address: input.address,
          requestId: input.requestId ? `${input.requestId}:alt:${store.id}` : undefined,
        });

        if (!quote.available) return null;

        return {
          storeId: store.id,
          name: store.name,
          slug: store.slug,
          city: store.city,
          distanceKm: quote.distanceKm,
          distanceMeters: quote.distanceMeters,
          deliveryFee: quote.deliveryFee,
          deliveryFeeCents: quote.deliveryFeeCents,
          estimatedMinutes: quote.estimatedMinutes,
        } satisfies AlternativeDeliveryStore;
      }),
  );

  return rankAlternativeDeliveryStores(
    alternatives.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : []
    ),
  );
}

export async function quoteDelivery(input: {
  storeId: number;
  address: DeliveryAddress;
  requestId?: string;
}): Promise<DeliveryQuote> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [settings] = await db
    .select()
    .from(storeDeliverySettings)
    .where(eq(storeDeliverySettings.storeId, input.storeId))
    .limit(1);

  if (!settings?.deliveryEnabled) {
    return { available: false, storeId: input.storeId, reason: "DELIVERY_DISABLED" };
  }

  const origin = {
    latitude: Number(settings.latitude),
    longitude: Number(settings.longitude),
  };
  if (!isValidCoordinates(origin) || settings.maxDeliveryDistanceMeters <= 0) {
    return { available: false, storeId: input.storeId, reason: "STORE_LOCATION_MISSING" };
  }

  const geocoded = await geocodeDeliveryAddress(input.address, input.requestId);
  if (!geocoded.ok) {
    return {
      available: false,
      storeId: input.storeId,
      reason: geocoded.reason,
      geocodingProvider: "result" in geocoded && geocoded.result ? geocoded.result.provider : undefined,
    };
  }

  const destination = {
    latitude: geocoded.result.latitude,
    longitude: geocoded.result.longitude,
  };
  const straightLineDistanceMeters = haversineMeters(origin, destination);

  let route: RoutingResult | null = null;
  try {
    route = await routeWithCache(input.storeId, origin, destination, straightLineDistanceMeters, input.requestId);
  } catch {
    route = null;
  }

  const allowStraightLineFallback =
    (process.env.DELIVERY_ALLOW_STRAIGHT_LINE_FALLBACK ?? "false").trim().toLowerCase() === "true";

  const commercialDistance = resolveCommercialDistance({
    routeDistanceMeters: route?.routeDistanceMeters ?? null,
    straightLineDistanceMeters,
    allowStraightLineFallback,
  });
  if (!commercialDistance.available) {
    return {
      available: false,
      storeId: input.storeId,
      reason: "ROUTING_PROVIDER_UNAVAILABLE",
      straightLineDistanceKm: straightLineDistanceMeters / 1000,
      straightLineDistanceMeters,
      routeDistanceKm: null,
      routeDistanceMeters: null,
      geocodingProvider: geocoded.result.provider,
      routingProvider: null,
    };
  }

  const commercialDistanceMeters = commercialDistance.distanceMeters;
  if (commercialDistanceMeters > settings.maxDeliveryDistanceMeters) {
    return {
      available: false,
      storeId: input.storeId,
      reason: "OUTSIDE_DELIVERY_AREA",
      distanceKm: commercialDistanceMeters / 1000,
      distanceMeters: commercialDistanceMeters,
      straightLineDistanceKm: straightLineDistanceMeters / 1000,
      straightLineDistanceMeters,
      routeDistanceKm: route ? route.routeDistanceMeters / 1000 : null,
      routeDistanceMeters: route?.routeDistanceMeters ?? null,
      geocodingProvider: geocoded.result.provider,
      routingProvider: route?.provider ?? null,
    };
  }

  const zones = await db
    .select()
    .from(deliveryDistanceZones)
    .where(and(eq(deliveryDistanceZones.storeId, input.storeId), eq(deliveryDistanceZones.active, true)))
    .orderBy(asc(deliveryDistanceZones.minDistanceMeters), asc(deliveryDistanceZones.sortOrder));

  if (!zones.length) {
    return {
      available: false,
      storeId: input.storeId,
      reason: "NO_DELIVERY_ZONES",
      distanceKm: commercialDistanceMeters / 1000,
      distanceMeters: commercialDistanceMeters,
    };
  }

  const zone = findDeliveryZoneForDistance(zones, commercialDistanceMeters);

  if (!zone) {
    return {
      available: false,
      storeId: input.storeId,
      reason: "NO_COVERAGE_ZONE",
      distanceKm: commercialDistanceMeters / 1000,
      distanceMeters: commercialDistanceMeters,
      straightLineDistanceKm: straightLineDistanceMeters / 1000,
      straightLineDistanceMeters,
      routeDistanceKm: route ? route.routeDistanceMeters / 1000 : null,
      routeDistanceMeters: route?.routeDistanceMeters ?? null,
      geocodingProvider: geocoded.result.provider,
      routingProvider: route?.provider ?? null,
    };
  }

  return {
    available: true,
    storeId: input.storeId,
    zoneId: zone.id,
    distanceKm: commercialDistanceMeters / 1000,
    distanceMeters: commercialDistanceMeters,
    straightLineDistanceKm: straightLineDistanceMeters / 1000,
    straightLineDistanceMeters,
    routeDistanceKm: route ? route.routeDistanceMeters / 1000 : null,
    routeDistanceMeters: route?.routeDistanceMeters ?? null,
    deliveryFee: zone.deliveryFeeCents / 100,
    deliveryFeeCents: zone.deliveryFeeCents,
    estimatedMinutes: zone.estimatedMinutes,
    destination,
    origin,
    geocodingProvider: geocoded.result.provider,
    routingProvider: route?.provider ?? null,
    usedStraightLineFallback: commercialDistance.usedStraightLineFallback,
  };
}
