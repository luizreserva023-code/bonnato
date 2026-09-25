import { createHash } from "crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { deliveryZones, orders } from "../../drizzle/schema.ts";
import { getDb } from "../db.ts";
import { haversineMeters, type Coordinates } from "./delivery.ts";

export type CoverageNeighborhood = {
  name: string;
  latitude: number;
  longitude: number;
  straightLineDistanceMeters: number;
  routeDistanceMeters: number | null;
  sourceType: "place" | "boundary" | "known" | "sampled";
};

export type DeliveryCoveragePreview = {
  polygon: Coordinates[];
  neighborhoods: CoverageNeighborhood[];
  approximate: true;
  routingProvider: "osrm";
  neighborhoodProvider: string;
  generatedAt: string;
};

type CacheEntry = {
  expiresAt: number;
  value: DeliveryCoveragePreview;
};

const coverageCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_MS = 15 * 60 * 1000;
const MAX_NEIGHBORHOODS = 80;
const MAX_TABLE_DESTINATIONS = 45;
const COVERAGE_BEARINGS = 32;
const COVERAGE_ITERATIONS = 4;

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cacheKey(input: {
  storeId: number;
  city: string;
  state: string;
  origin: Coordinates;
  maxDistanceMeters: number;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      storeId: input.storeId,
      city: normalizeName(input.city),
      state: input.state.trim().toUpperCase(),
      lat: Number(input.origin.latitude.toFixed(5)),
      lon: Number(input.origin.longitude.toFixed(5)),
      maxDistanceMeters: input.maxDistanceMeters,
    }))
    .digest("hex");
}

function destinationPoint(origin: Coordinates, distanceMeters: number, bearingDegrees: number): Coordinates {
  const earthRadius = 6_371_000;
  const delta = distanceMeters / earthRadius;
  const theta = (bearingDegrees * Math.PI) / 180;
  const phi1 = (origin.latitude * Math.PI) / 180;
  const lambda1 = (origin.longitude * Math.PI) / 180;

  const sinPhi2 =
    Math.sin(phi1) * Math.cos(delta)
    + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2);
  const lambda2 = lambda1 + Math.atan2(y, x);

  return {
    latitude: (phi2 * 180) / Math.PI,
    longitude: (((lambda2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

function fallbackCircle(origin: Coordinates, radiusMeters: number) {
  return Array.from({ length: COVERAGE_BEARINGS }, (_, index) =>
    destinationPoint(origin, radiusMeters, (360 / COVERAGE_BEARINGS) * index));
}

async function osrmTableDistances(origin: Coordinates, destinations: Coordinates[]) {
  if (destinations.length === 0) return [] as Array<number | null>;

  const baseUrl = process.env.DELIVERY_OSRM_BASE_URL?.trim() || "https://router.project-osrm.org";
  const coordinates = [origin, ...destinations]
    .map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`)
    .join(";");

  const url = new URL(`/table/v1/driving/${coordinates}`, baseUrl);
  url.searchParams.set("sources", "0");
  url.searchParams.set(
    "destinations",
    destinations.map((_, index) => String(index + 1)).join(";"),
  );
  url.searchParams.set("annotations", "distance");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "BonattoDelivery/1.0 (+https://bonatto-pizza.netlify.app)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OSRM table HTTP ${response.status}`);

  const body = await response.json() as {
    code?: string;
    distances?: Array<Array<number | null>>;
  };

  const row = body.distances?.[0];
  if (!Array.isArray(row)) throw new Error("OSRM table did not return distances");
  return row.map((value) => Number.isFinite(value) ? Math.round(Number(value)) : null);
}

async function routeDistancesInChunks(origin: Coordinates, destinations: Coordinates[]) {
  const distances: Array<number | null> = [];
  for (let index = 0; index < destinations.length; index += MAX_TABLE_DESTINATIONS) {
    const chunk = destinations.slice(index, index + MAX_TABLE_DESTINATIONS);
    const chunkDistances = await osrmTableDistances(origin, chunk);
    distances.push(...chunkDistances);
  }
  return distances;
}

async function buildRoadCoveragePolygon(origin: Coordinates, maxDistanceMeters: number) {
  const bearings = Array.from(
    { length: COVERAGE_BEARINGS },
    (_, index) => (360 / COVERAGE_BEARINGS) * index,
  );

  const low = bearings.map(() => 0);
  const high = bearings.map(() => maxDistanceMeters);

  for (let iteration = 0; iteration < COVERAGE_ITERATIONS; iteration += 1) {
    const mid = bearings.map((_, index) => (low[index] + high[index]) / 2);
    const candidates = bearings.map((bearing, index) =>
      destinationPoint(origin, mid[index], bearing));
    const routeDistances = await routeDistancesInChunks(origin, candidates);

    routeDistances.forEach((routeDistance, index) => {
      if (routeDistance !== null && routeDistance <= maxDistanceMeters) {
        low[index] = mid[index];
      } else {
        high[index] = mid[index];
      }
    });
  }

  return bearings.map((bearing, index) =>
    destinationPoint(origin, Math.max(80, low[index]), bearing));
}



type ReverseNeighborhoodSample = {
  name: string;
  latitude: number;
  longitude: number;
  sourceType: "sampled";
};

const photonReverseCache = new Map<string, {
  expiresAt: number;
  value: ReverseNeighborhoodSample[];
}>();

async function photonReverseNeighborhoods(point: Coordinates): Promise<ReverseNeighborhoodSample[]> {
  const key = `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
  const cached = photonReverseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const baseUrl = process.env.DELIVERY_PHOTON_BASE_URL?.trim() || "https://photon.komoot.io";
  const url = new URL("/reverse", baseUrl);
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("limit", "4");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "BonattoDelivery/1.0 (+https://bonatto-pizza.netlify.app)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Photon reverse HTTP ${response.status}`);

  const body = await response.json() as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        district?: string;
        city?: string;
        locality?: string;
        suburb?: string;
        neighbourhood?: string;
      };
    }>;
  };

  const names = new Map<string, ReverseNeighborhoodSample>();
  for (const feature of body.features ?? []) {
    const properties = feature.properties ?? {};
    const name = (
      properties.district
      || properties.suburb
      || properties.neighbourhood
      || properties.locality
    )?.trim();
    if (!name) continue;

    const longitude = Number(feature.geometry?.coordinates?.[0] ?? point.longitude);
    const latitude = Number(feature.geometry?.coordinates?.[1] ?? point.latitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const normalized = normalizeName(name);
    if (!normalized) continue;
    names.set(normalized, {
      name,
      latitude,
      longitude,
      sourceType: "sampled",
    });
  }

  const value = [...names.values()];
  photonReverseCache.set(key, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    value,
  });
  return value;
}

async function discoverNeighborhoodsBySampling(origin: Coordinates, maxDistanceMeters: number) {
  const samples: Coordinates[] = [origin];
  const ringFractions = [0.25, 0.5, 0.75, 1];
  const bearings = Array.from({ length: 8 }, (_, index) => index * 45);

  for (const fraction of ringFractions) {
    const distance = Math.max(150, maxDistanceMeters * fraction);
    for (const bearing of bearings) {
      samples.push(destinationPoint(origin, distance, bearing));
    }
  }

  const aggregate = new Map<string, {
    name: string;
    latitudeTotal: number;
    longitudeTotal: number;
    count: number;
  }>();

  for (let index = 0; index < samples.length; index += 6) {
    const batch = samples.slice(index, index + 6);
    const results = await Promise.allSettled(
      batch.map((point) => photonReverseNeighborhoods(point)),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const neighborhood of result.value) {
        const key = normalizeName(neighborhood.name);
        const current = aggregate.get(key) ?? {
          name: neighborhood.name,
          latitudeTotal: 0,
          longitudeTotal: 0,
          count: 0,
        };
        current.latitudeTotal += neighborhood.latitude;
        current.longitudeTotal += neighborhood.longitude;
        current.count += 1;
        aggregate.set(key, current);
      }
    }
  }

  return [...aggregate.values()]
    .map((item) => ({
      name: item.name,
      latitude: item.latitudeTotal / item.count,
      longitude: item.longitudeTotal / item.count,
      sourceType: "sampled" as const,
    }))
    .sort((a, b) =>
      haversineMeters(origin, a) - haversineMeters(origin, b)
      || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, MAX_NEIGHBORHOODS);
}

type KnownNeighborhoodPoint = {
  name: string;
  latitude: number;
  longitude: number;
  sourceType: "known";
};

const photonNeighborhoodCache = new Map<string, {
  expiresAt: number;
  value: KnownNeighborhoodPoint | null;
}>();

async function photonGeocodeNeighborhood(input: {
  name: string;
  city: string;
  state: string;
  origin: Coordinates;
  maxDistanceMeters: number;
}): Promise<KnownNeighborhoodPoint | null> {
  const key = normalizeName([input.name, input.city, input.state].join("|"));
  const cached = photonNeighborhoodCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const baseUrl = process.env.DELIVERY_PHOTON_BASE_URL?.trim() || "https://photon.komoot.io";
  const url = new URL("/api/", baseUrl);
  url.searchParams.set("q", `${input.name}, ${input.city}, ${input.state}, Brasil`);
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "pt");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "BonattoDelivery/1.0 (+https://bonatto-pizza.netlify.app)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);

  const body = await response.json() as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        name?: string;
        city?: string;
        district?: string;
        state?: string;
        type?: string;
      };
    }>;
  };

  const requestedName = normalizeName(input.name);
  const requestedCity = normalizeName(input.city);

  const candidates = (body.features ?? [])
    .map((feature) => {
      const longitude = Number(feature.geometry?.coordinates?.[0]);
      const latitude = Number(feature.geometry?.coordinates?.[1]);
      const properties = feature.properties ?? {};
      const displayName = properties.name?.trim() || input.name;
      const featureCity = normalizeName(properties.city || "");
      const featureDistrict = normalizeName(properties.district || "");
      const featureName = normalizeName(displayName);
      const point = { latitude, longitude };

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const straightDistanceMeters = haversineMeters(input.origin, point);
      if (straightDistanceMeters > Math.max(input.maxDistanceMeters * 1.7, 12_000)) return null;

      let score = 0;
      if (featureName && (featureName.includes(requestedName) || requestedName.includes(featureName))) score += 5;
      if (featureDistrict && (featureDistrict.includes(requestedName) || requestedName.includes(featureDistrict))) score += 4;
      if (requestedCity && featureCity && (featureCity.includes(requestedCity) || requestedCity.includes(featureCity))) score += 3;
      if (["district", "locality", "city"].includes(properties.type || "")) score += 2;
      score -= straightDistanceMeters / 100_000;

      return {
        score,
        value: {
          name: displayName,
          latitude,
          longitude,
          sourceType: "known" as const,
        },
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.score - a.score);

  const value = candidates[0]?.value ?? null;
  photonNeighborhoodCache.set(key, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    value,
  });
  return value;
}

async function discoverKnownNeighborhoods(input: {
  storeId: number;
  city: string;
  state: string;
  origin: Coordinates;
  maxDistanceMeters: number;
}) {
  const db = await getDb();
  if (!db) return [] as KnownNeighborhoodPoint[];

  const [legacyRows, historicalRows] = await Promise.all([
    db
      .select({ name: deliveryZones.neighborhood })
      .from(deliveryZones)
      .where(eq(deliveryZones.storeId, input.storeId)),
    db
      .select({
        name: orders.deliveryNeighborhood,
        latitude: sql<number | null>`AVG(${orders.deliveryLatitude})`,
        longitude: sql<number | null>`AVG(${orders.deliveryLongitude})`,
      })
      .from(orders)
      .where(and(
        eq(orders.storeId, input.storeId),
        isNotNull(orders.deliveryNeighborhood),
      ))
      .groupBy(orders.deliveryNeighborhood),
  ]);

  const names = new Map<string, {
    name: string;
    latitude?: number;
    longitude?: number;
  }>();

  for (const row of legacyRows) {
    const name = row.name?.trim();
    if (!name) continue;
    names.set(normalizeName(name), { name });
  }

  for (const row of historicalRows) {
    const name = row.name?.trim();
    if (!name) continue;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const key = normalizeName(name);
    const current = names.get(key) ?? { name };
    names.set(key, {
      ...current,
      name,
      latitude: Number.isFinite(latitude) ? latitude : current.latitude,
      longitude: Number.isFinite(longitude) ? longitude : current.longitude,
    });
  }

  const resolved = new Map<string, KnownNeighborhoodPoint>();
  const unresolved: string[] = [];

  for (const [key, entry] of names) {
    if (
      Number.isFinite(entry.latitude)
      && Number.isFinite(entry.longitude)
      && haversineMeters(input.origin, {
        latitude: entry.latitude as number,
        longitude: entry.longitude as number,
      }) <= Math.max(input.maxDistanceMeters * 1.7, 12_000)
    ) {
      resolved.set(key, {
        name: entry.name,
        latitude: entry.latitude as number,
        longitude: entry.longitude as number,
        sourceType: "known",
      });
    } else {
      unresolved.push(entry.name);
    }
  }

  const capped = unresolved.slice(0, 36);
  for (let index = 0; index < capped.length; index += 6) {
    const batch = capped.slice(index, index + 6);
    const batchResults = await Promise.allSettled(batch.map((name) =>
      photonGeocodeNeighborhood({
        name,
        city: input.city,
        state: input.state,
        origin: input.origin,
        maxDistanceMeters: input.maxDistanceMeters,
      })));

    batchResults.forEach((result) => {
      if (result.status !== "fulfilled" || !result.value) return;
      resolved.set(normalizeName(result.value.name), result.value);
    });
  }

  const values = [...resolved.values()]
    .sort((a, b) =>
      haversineMeters(input.origin, a) - haversineMeters(input.origin, b)
      || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, MAX_NEIGHBORHOODS);

  return values;
}

async function discoverNeighborhoods(origin: Coordinates, radiusMeters: number) {
  const baseUrl =
    process.env.DELIVERY_OVERPASS_BASE_URL?.trim()
    || "https://overpass-api.de/api/interpreter";
  const searchRadius = Math.min(Math.max(Math.ceil(radiusMeters * 1.15), 1_500), 30_000);

  const query = `
[out:json][timeout:20];
(
  node["place"~"suburb|neighbourhood|quarter"](around:${searchRadius},${origin.latitude},${origin.longitude});
  way["place"~"suburb|neighbourhood|quarter"](around:${searchRadius},${origin.latitude},${origin.longitude});
  relation["place"~"suburb|neighbourhood|quarter"](around:${searchRadius},${origin.latitude},${origin.longitude});
  relation["boundary"="administrative"]["admin_level"~"10|11"](around:${searchRadius},${origin.latitude},${origin.longitude});
);
out center tags;
`.trim();

  const body = new URLSearchParams({ data: query });
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "BonattoDelivery/1.0 (+https://bonatto-pizza.netlify.app)",
    },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);

  const result = await response.json() as {
    elements?: Array<{
      type?: string;
      lat?: number;
      lon?: number;
      center?: { lat?: number; lon?: number };
      tags?: Record<string, string | undefined>;
    }>;
  };

  const deduped = new Map<string, {
    name: string;
    latitude: number;
    longitude: number;
    sourceType: "place" | "boundary";
  }>();

  for (const element of result.elements ?? []) {
    const name = element.tags?.name?.trim();
    if (!name) continue;

    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const point = { latitude, longitude };
    if (haversineMeters(origin, point) > searchRadius) continue;

    const key = normalizeName(name);
    if (!key) continue;

    const sourceType: "place" | "boundary" =
      element.tags?.place ? "place" : "boundary";

    const existing = deduped.get(key);
    if (!existing || (existing.sourceType === "boundary" && sourceType === "place")) {
      deduped.set(key, { name, latitude, longitude, sourceType });
    }
  }

  return [...deduped.values()]
    .sort((a, b) =>
      haversineMeters(origin, a) - haversineMeters(origin, b)
      || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, MAX_NEIGHBORHOODS);
}

export async function buildDeliveryCoveragePreview(input: {
  storeId: number;
  city: string;
  state: string;
  origin: Coordinates;
  maxDistanceMeters: number;
}): Promise<DeliveryCoveragePreview> {
  if (
    !Number.isFinite(input.origin.latitude)
    || !Number.isFinite(input.origin.longitude)
    || input.maxDistanceMeters <= 0
  ) {
    return {
      polygon: [],
      neighborhoods: [],
      approximate: true,
      routingProvider: "osrm",
      neighborhoodProvider: "photon-reverse+bonatto+openstreetmap",
      generatedAt: new Date().toISOString(),
    };
  }

  const key = cacheKey(input);
  const cached = coverageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [polygonResult, knownResult, sampledResult, overpassResult] = await Promise.allSettled([
    buildRoadCoveragePolygon(input.origin, input.maxDistanceMeters),
    discoverKnownNeighborhoods(input),
    discoverNeighborhoodsBySampling(input.origin, input.maxDistanceMeters),
    discoverNeighborhoods(input.origin, input.maxDistanceMeters),
  ]);

  const polygon =
    polygonResult.status === "fulfilled" && polygonResult.value.length >= 3
      ? polygonResult.value
      : fallbackCircle(input.origin, input.maxDistanceMeters);

  const merged = new Map<string, {
    name: string;
    latitude: number;
    longitude: number;
    sourceType: "place" | "boundary" | "known" | "sampled";
  }>();

  if (overpassResult.status === "fulfilled") {
    for (const neighborhood of overpassResult.value) {
      merged.set(normalizeName(neighborhood.name), neighborhood);
    }
  }

  if (sampledResult.status === "fulfilled") {
    for (const neighborhood of sampledResult.value) {
      merged.set(normalizeName(neighborhood.name), neighborhood);
    }
  }

  if (knownResult.status === "fulfilled") {
    for (const neighborhood of knownResult.value) {
      merged.set(normalizeName(neighborhood.name), neighborhood);
    }
  }

  const discovered = [...merged.values()]
    .sort((a, b) =>
      haversineMeters(input.origin, a) - haversineMeters(input.origin, b)
      || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, MAX_NEIGHBORHOODS);

  let routeDistances: Array<number | null> = [];
  try {
    routeDistances = await routeDistancesInChunks(
      input.origin,
      discovered.map(({ latitude, longitude }) => ({ latitude, longitude })),
    );
  } catch {
    routeDistances = discovered.map(() => null);
  }

  const neighborhoods = discovered.map((neighborhood, index) => ({
    ...neighborhood,
    straightLineDistanceMeters: haversineMeters(input.origin, neighborhood),
    routeDistanceMeters: routeDistances[index] ?? null,
  }));

  const value: DeliveryCoveragePreview = {
    polygon,
    neighborhoods,
    approximate: true,
    routingProvider: "osrm",
    neighborhoodProvider: "photon-reverse+bonatto+openstreetmap",
    generatedAt: new Date().toISOString(),
  };

  coverageCache.set(key, {
    expiresAt: Date.now() + DEFAULT_CACHE_MS,
    value,
  });

  return value;
}
