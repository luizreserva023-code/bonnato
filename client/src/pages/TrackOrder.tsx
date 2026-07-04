import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  Bike,
  Clock,
  MapPin,
  Navigation,
  RefreshCw,
  Timer,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { MapView, searchAddress, type LatLngLiteral, type MapMarker } from "@/components/Map";
import { trpc } from "@/lib/trpc";

const POLL_INTERVAL_MS = 5000;
const DEFAULT_CENTER: LatLngLiteral = { lat: -19.9833, lng: -44.0667 };
const ESTIMATED_DRIVER_SPEED_KMH = 28;

interface EtaInfo {
  durationText: string;
  distanceText: string;
}

function haversineDistanceKm(origin: LatLngLiteral, destination: LatLngLiteral) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(origin.lat)) *
      Math.cos(toRadians(destination.lat)) *
      Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDurationFromMinutes(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${Math.max(1, Math.round(totalMinutes))} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

function calculateEta(origin: LatLngLiteral | null, destination: LatLngLiteral | null): EtaInfo | null {
  if (!origin || !destination) return null;

  const distanceKm = haversineDistanceKm(origin, destination);
  const minutes = (distanceKm / ESTIMATED_DRIVER_SPEED_KMH) * 60;

  return {
    durationText: formatDurationFromMinutes(minutes),
    distanceText: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
  };
}

export default function TrackOrder() {
  const [, params] = useRoute("/rastrear/:orderId");
  const orderId = params?.orderId ? parseInt(params.orderId, 10) : 0;
  const { user } = useAuth();
  const [destinationPosition, setDestinationPosition] = useState<LatLngLiteral | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);

  const locationQuery = trpc.drivers.locationByOrder.useQuery(
    { orderId },
    {
      enabled: !!orderId && orderId > 0 && !!user,
      refetchInterval: POLL_INTERVAL_MS,
      retry: false,
    }
  );

  const orderQuery = trpc.orders.byId.useQuery(
    { id: orderId },
    { enabled: !!orderId && orderId > 0 }
  );

  useEffect(() => {
    const address = orderQuery.data?.deliveryAddress?.trim();
    if (!address) {
      setDestinationPosition(null);
      return;
    }

    let cancelled = false;
    setDestinationLoading(true);

    searchAddress(address)
      .then((results) => {
        if (cancelled) return;
        const firstMatch = results[0];
        setDestinationPosition(firstMatch ? { lat: firstMatch.lat, lng: firstMatch.lng } : null);
      })
      .catch(() => {
        if (!cancelled) setDestinationPosition(null);
      })
      .finally(() => {
        if (!cancelled) setDestinationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderQuery.data?.deliveryAddress]);

  const driverPosition = useMemo<LatLngLiteral | null>(() => {
    if (!locationQuery.data) return null;

    return {
      lat: parseFloat(locationQuery.data.lat),
      lng: parseFloat(locationQuery.data.lng),
    };
  }, [locationQuery.data]);

  const eta = useMemo(
    () => calculateEta(driverPosition, destinationPosition),
    [destinationPosition, driverPosition]
  );

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    if (driverPosition && locationQuery.data) {
      markers.push({
        id: `driver-${locationQuery.data.driverName}-${locationQuery.data.updatedAt?.toString?.() ?? "current"}`,
        position: driverPosition,
        title: locationQuery.data.driverName,
        label: locationQuery.data.driverName,
        popup: `${locationQuery.data.driverName} esta com seu pedido`,
        variant: "driver",
      });
    }

    if (destinationPosition) {
      markers.push({
        id: `destination-${orderId}`,
        position: destinationPosition,
        title: "Endereco de entrega",
        label: "Entrega",
        popup: orderQuery.data?.deliveryAddress ?? "Endereco de entrega",
        variant: "destination",
      });
    }

    return markers;
  }, [destinationPosition, driverPosition, locationQuery.data, orderId, orderQuery.data?.deliveryAddress]);

  const routePreview = useMemo(
    () => (driverPosition && destinationPosition ? [driverPosition, destinationPosition] : []),
    [destinationPosition, driverPosition]
  );

  const hasLocation = !!driverPosition;
  const isLoading = locationQuery.isLoading;
  const driverName = locationQuery.data?.driverName ?? "Motoboy";
  const lastUpdate = locationQuery.data?.updatedAt
    ? new Date(locationQuery.data.updatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const mapInitialCenter = driverPosition ?? destinationPosition ?? DEFAULT_CENTER;

  if (!orderId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0103]">
        <div className="px-6 text-center text-zinc-400">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#6E0D12]/20">
            <MapPin className="h-8 w-8 text-[#6E0D12]" />
          </div>
          <p className="mb-1 font-semibold text-white">Pedido nao encontrado</p>
          <p className="mb-4 text-sm text-zinc-500">Verifique o numero do pedido e tente novamente.</p>
          <Link href="/">
            <button className="rounded-xl bg-[#6E0D12] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8B1018]">
              Voltar ao inicio
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0103]">
      <div
        className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4"
        style={{ background: "linear-gradient(135deg, #1a0305 0%, #2d0609 100%)" }}
      >
        <Link href="/minha-conta">
          <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-white/20 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black leading-tight text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
              Rastrear Entrega
            </h1>
            <span className="rounded-full bg-[#6E0D12]/15 px-2 py-0.5 text-xs font-semibold text-[#6E0D12]">
              #{orderId}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5">
            {isLoading ? (
              <>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                <span className="text-xs text-zinc-400">Localizando...</span>
              </>
            ) : hasLocation ? (
              <>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">{driverName} esta a caminho</span>
                {lastUpdate && <span className="text-xs text-zinc-600">· {lastUpdate}</span>}
              </>
            ) : (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                <span className="text-xs text-zinc-500">Aguardando rastreamento</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => locationQuery.refetch()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50 transition-all hover:bg-white/20 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${locationQuery.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapView
          className="h-full w-full"
          initialCenter={mapInitialCenter}
          initialZoom={13}
          markers={mapMarkers}
          polyline={routePreview}
          fitToMarkers
        />

        {hasLocation && (
          <div className="pointer-events-none absolute left-3 right-3 top-3">
            <div
              className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(110, 13, 18, 0.92)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(110,13,18,0.4), 0 1px 0 rgba(255,255,255,0.08) inset",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Timer className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs leading-none text-white/60">Previsao de chegada</p>
                  {destinationLoading && !eta ? (
                    <div className="mt-1 h-5 w-20 animate-pulse rounded-lg bg-white/20" />
                  ) : eta ? (
                    <p className="text-xl font-black leading-none text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
                      ~{eta.durationText}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-white/50">Calculando...</p>
                  )}
                </div>
              </div>

              {eta?.distanceText && (
                <div className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                  <Bike className="h-3.5 w-3.5 text-white/70" />
                  <div>
                    <p className="text-sm font-bold leading-none text-white">{eta.distanceText}</p>
                    <p className="mt-0.5 text-xs leading-none text-white/50">estimados</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!hasLocation && !isLoading && (
          <div
            className="absolute inset-0 flex items-end justify-center pb-8"
            style={{ background: "linear-gradient(to top, rgba(13,1,3,0.85) 0%, transparent 60%)" }}
          >
            <div className="max-w-xs px-6 text-center">
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "rgba(110,13,18,0.3)", border: "1px solid rgba(110,13,18,0.5)" }}
              >
                <Navigation className="h-7 w-7 text-[#ff6b6b]" />
              </div>
              <h3 className="mb-1 text-base font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
                Rastreamento nao iniciado
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                O motoboy ainda nao iniciou o GPS. O mapa atualiza automaticamente quando ele sair para entrega.
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        className="shrink-0 px-4 pb-5 pt-3"
        style={{ background: "linear-gradient(180deg, #1a0305 0%, #0d0103 100%)" }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(110,13,18,0.3)", border: "1px solid rgba(110,13,18,0.4)" }}
          >
            <MapPin className="h-4 w-4 text-[#ff6b6b]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-500">Entregando em</p>
            <p className="truncate text-sm font-semibold leading-tight text-white">
              {orderQuery.data?.deliveryAddress ?? "Carregando..."}
            </p>
          </div>
          {hasLocation ? (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/60 px-2.5 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Em rota</span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">Aguardando</span>
            </div>
          )}
        </div>

        <div className="mb-3 h-px bg-white/5" />

        <div className="flex items-center justify-end">
          <p className="text-xs text-zinc-600">Atualiza a cada 5s</p>
        </div>
      </div>
    </div>
  );
}
