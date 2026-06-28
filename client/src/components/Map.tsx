import { type ReactNode, useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string | number;
  position: LatLngLiteral;
  title?: string;
  popup?: ReactNode;
  label?: string;
  variant?: "default" | "driver" | "destination";
}

interface SearchAddressResult {
  displayName: string;
  lat: number;
  lng: number;
}

interface MapViewProps {
  className?: string;
  initialCenter?: LatLngLiteral;
  initialZoom?: number;
  markers?: MapMarker[];
  polyline?: LatLngLiteral[];
  fitToMarkers?: boolean;
}

const DEFAULT_CENTER: LatLngLiteral = { lat: -19.9167, lng: -43.9345 };

function createMarkerIcon(marker: MapMarker) {
  const palette =
    marker.variant === "driver"
      ? {
          emoji: "🏍️",
          background: "#6E0D12",
          border: "#ffffff",
          labelBg: "rgba(15, 23, 42, 0.92)",
        }
      : marker.variant === "destination"
        ? {
            emoji: "🏠",
            background: "#1e293b",
            border: "#ffffff",
            labelBg: "rgba(110, 13, 18, 0.92)",
          }
        : {
            emoji: "📍",
            background: "#b91c1c",
            border: "#ffffff",
            labelBg: "rgba(30, 41, 59, 0.9)",
          };

  const labelHtml = marker.label
    ? `<div style="margin-top:6px;padding:4px 8px;border-radius:999px;background:${palette.labelBg};color:#fff;font:600 11px/1.2 Inter,sans-serif;white-space:nowrap;box-shadow:0 4px 14px rgba(15,23,42,.18);">${marker.label}</div>`
    : "";

  return L.divIcon({
    className: "bonatto-leaflet-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
        <div style="width:42px;height:42px;border-radius:999px;background:${palette.background};border:3px solid ${palette.border};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(15,23,42,.22);font-size:18px;">
          ${palette.emoji}
        </div>
        ${labelHtml}
      </div>
    `,
    iconSize: [42, 58],
    iconAnchor: [21, 42],
    popupAnchor: [0, -34],
  });
}

function MapViewportController({
  center,
  zoom,
  markers,
  fitToMarkers,
}: {
  center: LatLngLiteral;
  zoom: number;
  markers: MapMarker[];
  fitToMarkers: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (fitToMarkers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((marker) => [marker.position.lat, marker.position.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      return;
    }

    map.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, fitToMarkers, map, markers, zoom]);

  return null;
}

export async function searchAddress(address: string): Promise<SearchAddressResult[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(address)}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Nao foi possivel localizar o endereco no OpenStreetMap.");
  }

  const results = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return results.map((result) => ({
    displayName: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
  }));
}

export function MapView({
  className,
  initialCenter = DEFAULT_CENTER,
  initialZoom = 13,
  markers = [],
  polyline = [],
  fitToMarkers = false,
}: MapViewProps) {
  const center = markers[0]?.position ?? initialCenter;
  const leafletMarkers = useMemo(
    () =>
      markers.map((marker) => ({
        ...marker,
        icon: createMarkerIcon(marker),
      })),
    [markers]
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-muted/20",
        className
      )}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={initialZoom}
        className="h-full min-h-[420px] w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportController
          center={center}
          zoom={initialZoom}
          markers={markers}
          fitToMarkers={fitToMarkers}
        />

        {polyline.length > 1 && (
          <Polyline
            positions={polyline.map((point) => [point.lat, point.lng] as [number, number])}
            pathOptions={{ color: "#6E0D12", weight: 5, opacity: 0.9 }}
          />
        )}

        {leafletMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={marker.icon}
            title={marker.title}
          >
            {(marker.popup || marker.title) && (
              <Popup>
                {marker.popup ?? <span className="text-sm font-medium">{marker.title}</span>}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-[400] -translate-x-1/2">
        <div className="rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
          OpenStreetMap ativo
        </div>
      </div>
    </div>
  );
}
