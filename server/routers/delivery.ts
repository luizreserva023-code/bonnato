import { TRPCError } from "@trpc/server";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  deliveryDistanceZones,
  storeDeliverySettings,
  stores,
} from "../../drizzle/schema.ts";
import { publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import { getDb } from "../db.ts";
import { recordStoreAudit } from "../storeAudit.ts";
import { resolveRequiredStoreId } from "../storeUtils.ts";
import {
  findAlternativeDeliveryStores,
  geocodeDeliveryAddress,
  getDeliveryConfiguration,
  isValidCoordinates,
  quoteDelivery,
  validateDeliveryZones,
  type DeliveryAddress,
} from "../services/delivery.ts";
import { buildDeliveryCoveragePreview } from "../services/deliveryCoverage.ts";

const addressSchema = z.object({
  postalCode: z.string().trim().min(8).max(10),
  street: z.string().trim().min(2).max(240),
  number: z.string().trim().min(1).max(40),
  complement: z.string().trim().max(160).nullable().optional(),
  neighborhood: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
});

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const zoneSchema = z.object({
  id: z.number().int().positive().optional(),
  minDistanceMeters: z.number().int().min(0),
  maxDistanceMeters: z.number().int().positive(),
  deliveryFeeCents: z.number().int().min(0),
  estimatedMinutes: z.number().int().min(1).max(360),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

function mapGeocodingFailure(reason: string) {
  if (reason === "INVALID_ADDRESS") return "Preencha CEP, rua, número, cidade e UF corretamente.";
  if (reason === "LOW_CONFIDENCE_ADDRESS") return "Não conseguimos localizar este endereço com confiança. Confira rua e número.";
  return "Não conseguimos localizar este endereço. Confira rua e número.";
}

async function resolveAdminOrigin(input: {
  originAddress: DeliveryAddress;
  confirmedOrigin?: { latitude: number; longitude: number };
  requestId?: string;
}) {
  if (input.confirmedOrigin) {
    if (!isValidCoordinates(input.confirmedOrigin)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Coordenadas inválidas para a origem da entrega." });
    }
    return {
      coordinates: input.confirmedOrigin,
      provider: "admin-map-confirmed",
      normalizedAddress: null as string | null,
    };
  }

  const geocoded = await geocodeDeliveryAddress(input.originAddress, input.requestId);
  if (!geocoded.ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: mapGeocodingFailure(geocoded.reason) });
  }

  const coordinates = {
    latitude: geocoded.result.latitude,
    longitude: geocoded.result.longitude,
  };
  if (!isValidCoordinates(coordinates)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Coordenadas inválidas para a origem da entrega." });
  }

  return {
    coordinates,
    provider: geocoded.result.provider,
    normalizedAddress: geocoded.result.normalizedAddress ?? null,
  };
}

export const deliveryRouter = router({
  quote: publicProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      address: addressSchema,
      requestId: z.string().trim().max(96).optional(),
    }))
    .mutation(async ({ input }) => {
      const startedAt = Date.now();
      const address = input.address as DeliveryAddress;
      const result = await quoteDelivery({
        storeId: input.storeId,
        address,
        requestId: input.requestId,
      });

      const alternativeReasons = new Set([
        "DELIVERY_DISABLED",
        "STORE_LOCATION_MISSING",
        "OUTSIDE_DELIVERY_AREA",
        "NO_COVERAGE_ZONE",
        "NO_DELIVERY_ZONES",
      ]);
      const alternatives = !result.available && alternativeReasons.has(result.reason)
        ? await findAlternativeDeliveryStores({
            selectedStoreId: input.storeId,
            address,
            requestId: input.requestId,
          })
        : [];

      console.info("[DeliveryQuote]", JSON.stringify({
        requestId: input.requestId ?? null,
        storeId: input.storeId,
        status: result.available ? "available" : result.reason,
        alternativeStoreIds: alternatives.map((alternative) => alternative.storeId),
        durationMs: Date.now() - startedAt,
      }));
      return { ...result, alternatives };
    }),

  adminGetConfiguration: staffProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return getDeliveryConfiguration(storeId);
    }),

  adminCoveragePreview: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      origin: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
      city: z.string().trim().min(2).max(120),
      state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
      maxDistanceMeters: z.number().int().min(100).max(100_000),
    }))
    .query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return buildDeliveryCoveragePreview({
        storeId,
        city: input.city,
        state: input.state,
        origin: input.origin,
        maxDistanceMeters: input.maxDistanceMeters,
      });
    }),

  adminPreviewOrigin: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      address: addressSchema,
      requestId: z.string().trim().max(96).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await resolveRequiredStoreId(ctx.user, input.storeId);
      const geocoded = await geocodeDeliveryAddress(input.address as DeliveryAddress, input.requestId);
      if (!geocoded.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: mapGeocodingFailure(geocoded.reason),
        });
      }
      return {
        latitude: geocoded.result.latitude,
        longitude: geocoded.result.longitude,
        confidence: geocoded.result.confidence,
        provider: geocoded.result.provider,
        normalizedAddress: geocoded.result.normalizedAddress ?? null,
      };
    }),

  adminSaveSettings: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      deliveryEnabled: z.boolean(),
      maxDeliveryDistanceMeters: z.number().int().min(0).max(100_000),
      originAddress: addressSchema,
      confirmedOrigin: coordinatesSchema.optional(),
      requestId: z.string().trim().max(96).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const originResolution = await resolveAdminOrigin({
        originAddress: input.originAddress as DeliveryAddress,
        confirmedOrigin: input.confirmedOrigin,
        requestId: input.requestId,
      });
      const coordinates = originResolution.coordinates;

      const db = await requireDb();
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(73001, ${storeId})`);
        await tx.insert(storeDeliverySettings)
          .values({
            storeId,
            deliveryEnabled: input.deliveryEnabled,
            maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
            originPostalCode: input.originAddress.postalCode.replace(/\D/g, ""),
            originStreet: input.originAddress.street,
            originNumber: input.originAddress.number,
            originComplement: input.originAddress.complement ?? null,
            originNeighborhood: input.originAddress.neighborhood ?? null,
            originCity: input.originAddress.city,
            originState: input.originAddress.state,
            latitude: coordinates.latitude.toFixed(7),
            longitude: coordinates.longitude.toFixed(7),
            geocodedAddress: originResolution.normalizedAddress,
            geocodingProvider: originResolution.provider,
            geocodedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: storeDeliverySettings.storeId,
            set: {
              deliveryEnabled: input.deliveryEnabled,
              maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
              originPostalCode: input.originAddress.postalCode.replace(/\D/g, ""),
              originStreet: input.originAddress.street,
              originNumber: input.originAddress.number,
              originComplement: input.originAddress.complement ?? null,
              originNeighborhood: input.originAddress.neighborhood ?? null,
              originCity: input.originAddress.city,
              originState: input.originAddress.state,
              latitude: coordinates.latitude.toFixed(7),
              longitude: coordinates.longitude.toFixed(7),
              geocodedAddress: originResolution.normalizedAddress,
              geocodingProvider: originResolution.provider,
              geocodedAt: now,
              updatedAt: now,
            },
          });

        await tx.update(stores)
          .set({
            latitude: coordinates.latitude.toFixed(7),
            longitude: coordinates.longitude.toFixed(7),
            serviceRadiusKm: (input.maxDeliveryDistanceMeters / 1000).toFixed(2),
            updatedAt: now,
          })
          .where(eq(stores.id, storeId));
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "delivery.settings.updated",
        resourceType: "store_delivery_settings",
        resourceId: storeId,
        requestId: input.requestId ?? null,
        metadata: {
          deliveryEnabled: input.deliveryEnabled,
          maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
          geocodingProvider: originResolution.provider,
        },
      });

      return {
        success: true,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        provider: originResolution.provider,
      };
    }),

  adminSaveConfiguration: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      deliveryEnabled: z.boolean(),
      maxDeliveryDistanceMeters: z.number().int().min(0).max(100_000),
      originAddress: addressSchema,
      confirmedOrigin: coordinatesSchema.optional(),
      zones: z.array(zoneSchema).max(100),
      requestId: z.string().trim().max(96).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const validation = validateDeliveryZones(input.zones);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.join(" "),
          cause: { errors: validation.errors, gaps: validation.gaps },
        });
      }

      const activeZones = input.zones.filter((zone) => zone.active !== false);
      const furthestZoneMeters = activeZones.reduce((max, zone) => Math.max(max, zone.maxDistanceMeters), 0);
      if (furthestZoneMeters > input.maxDeliveryDistanceMeters) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O raio máximo da unidade não pode ser menor que a maior faixa de entrega.",
        });
      }

      const originResolution = await resolveAdminOrigin({
        originAddress: input.originAddress as DeliveryAddress,
        confirmedOrigin: input.confirmedOrigin,
        requestId: input.requestId,
      });
      const coordinates = originResolution.coordinates;

      const db = await requireDb();
      const now = new Date();
      const savedZones = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(73003, ${storeId})`);

        const [existingStore] = await tx
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1);
        if (!existingStore) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
        }

        await tx.insert(storeDeliverySettings)
          .values({
            storeId,
            deliveryEnabled: input.deliveryEnabled,
            maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
            originPostalCode: input.originAddress.postalCode.replace(/\D/g, ""),
            originStreet: input.originAddress.street,
            originNumber: input.originAddress.number,
            originComplement: input.originAddress.complement ?? null,
            originNeighborhood: input.originAddress.neighborhood ?? null,
            originCity: input.originAddress.city,
            originState: input.originAddress.state,
            latitude: coordinates.latitude.toFixed(7),
            longitude: coordinates.longitude.toFixed(7),
            geocodedAddress: originResolution.normalizedAddress,
            geocodingProvider: originResolution.provider,
            geocodedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: storeDeliverySettings.storeId,
            set: {
              deliveryEnabled: input.deliveryEnabled,
              maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
              originPostalCode: input.originAddress.postalCode.replace(/\D/g, ""),
              originStreet: input.originAddress.street,
              originNumber: input.originAddress.number,
              originComplement: input.originAddress.complement ?? null,
              originNeighborhood: input.originAddress.neighborhood ?? null,
              originCity: input.originAddress.city,
              originState: input.originAddress.state,
              latitude: coordinates.latitude.toFixed(7),
              longitude: coordinates.longitude.toFixed(7),
              geocodedAddress: originResolution.normalizedAddress,
              geocodingProvider: originResolution.provider,
              geocodedAt: now,
              updatedAt: now,
            },
          });

        await tx.update(stores)
          .set({
            latitude: coordinates.latitude.toFixed(7),
            longitude: coordinates.longitude.toFixed(7),
            serviceRadiusKm: (input.maxDeliveryDistanceMeters / 1000).toFixed(2),
            updatedAt: now,
          })
          .where(eq(stores.id, storeId));

        const existing = await tx
          .select({ id: deliveryDistanceZones.id })
          .from(deliveryDistanceZones)
          .where(eq(deliveryDistanceZones.storeId, storeId));
        const existingIds = new Set(existing.map((row) => row.id));

        for (const zone of input.zones) {
          if (zone.id && !existingIds.has(zone.id)) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Uma das faixas não pertence à unidade selecionada." });
          }
        }

        const incomingIds = input.zones.flatMap((zone) => zone.id ? [zone.id] : []);
        const idsToDelete = existing.map((row) => row.id).filter((id) => !incomingIds.includes(id));
        if (idsToDelete.length > 0) {
          await tx.delete(deliveryDistanceZones).where(inArray(deliveryDistanceZones.id, idsToDelete));
        }

        for (let index = 0; index < input.zones.length; index += 1) {
          const zone = input.zones[index];
          const values = {
            minDistanceMeters: zone.minDistanceMeters,
            maxDistanceMeters: zone.maxDistanceMeters,
            deliveryFeeCents: zone.deliveryFeeCents,
            estimatedMinutes: zone.estimatedMinutes,
            sortOrder: zone.sortOrder ?? index,
            active: zone.active ?? true,
            updatedAt: now,
          };
          if (zone.id) {
            await tx.update(deliveryDistanceZones)
              .set(values)
              .where(eq(deliveryDistanceZones.id, zone.id));
          } else {
            await tx.insert(deliveryDistanceZones).values({ storeId, ...values });
          }
        }

        return tx.select().from(deliveryDistanceZones)
          .where(eq(deliveryDistanceZones.storeId, storeId))
          .orderBy(asc(deliveryDistanceZones.sortOrder), asc(deliveryDistanceZones.minDistanceMeters));
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "delivery.configuration.saved",
        resourceType: "delivery_configuration",
        resourceId: storeId,
        requestId: input.requestId ?? null,
        metadata: {
          deliveryEnabled: input.deliveryEnabled,
          maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
          zoneCount: savedZones.length,
          gaps: validation.gaps,
          geocodingProvider: originResolution.provider,
        },
      });

      return {
        success: true,
        settings: {
          deliveryEnabled: input.deliveryEnabled,
          maxDeliveryDistanceMeters: input.maxDeliveryDistanceMeters,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          geocodingProvider: originResolution.provider,
        },
        zones: savedZones,
        gaps: validation.gaps,
      };
    }),

  adminReplaceZones: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      zones: z.array(zoneSchema).max(100),
      requestId: z.string().trim().max(96).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const validation = validateDeliveryZones(input.zones);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.join(" "),
          cause: { errors: validation.errors, gaps: validation.gaps },
        });
      }

      const db = await requireDb();
      const saved = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(73002, ${storeId})`);
        const existing = await tx
          .select({ id: deliveryDistanceZones.id })
          .from(deliveryDistanceZones)
          .where(eq(deliveryDistanceZones.storeId, storeId));
        const existingIds = new Set(existing.map((row) => row.id));

        for (const zone of input.zones) {
          if (zone.id && !existingIds.has(zone.id)) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Uma das faixas não pertence à unidade selecionada." });
          }
        }

        const incomingIds = input.zones.flatMap((zone) => zone.id ? [zone.id] : []);
        const idsToDelete = existing.map((row) => row.id).filter((id) => !incomingIds.includes(id));
        if (idsToDelete.length > 0) {
          await tx.delete(deliveryDistanceZones)
            .where(inArray(deliveryDistanceZones.id, idsToDelete));
        }

        for (let index = 0; index < input.zones.length; index += 1) {
          const zone = input.zones[index];
          const values = {
            minDistanceMeters: zone.minDistanceMeters,
            maxDistanceMeters: zone.maxDistanceMeters,
            deliveryFeeCents: zone.deliveryFeeCents,
            estimatedMinutes: zone.estimatedMinutes,
            sortOrder: zone.sortOrder ?? index,
            active: zone.active ?? true,
            updatedAt: new Date(),
          };
          if (zone.id) {
            await tx.update(deliveryDistanceZones)
              .set(values)
              .where(eq(deliveryDistanceZones.id, zone.id));
          } else {
            await tx.insert(deliveryDistanceZones)
              .values({ storeId, ...values });
          }
        }

        return tx.select().from(deliveryDistanceZones)
          .where(eq(deliveryDistanceZones.storeId, storeId))
          .orderBy(asc(deliveryDistanceZones.sortOrder), asc(deliveryDistanceZones.minDistanceMeters));
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "delivery.zones.replaced",
        resourceType: "delivery_distance_zones",
        resourceId: storeId,
        requestId: input.requestId ?? null,
        metadata: {
          zoneCount: saved.length,
          gaps: validation.gaps,
        },
      });

      return { zones: saved, gaps: validation.gaps };
    }),
});
