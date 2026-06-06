import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, ArrowLeft, RefreshCw, MessageCircle, Timer, Bike, CheckCircle2, Clock } from "lucide-react";
import { OrderChat } from "@/components/OrderChat";
import { useAuth } from "@/_core/hooks/useAuth";

const POLL_INTERVAL_MS = 5000;
const ETA_RECALC_INTERVAL_MS = 30_000;

interface EtaInfo {
  durationText: string;
  durationSecs: number;
  distanceText: string;
  distanceMeters: number;
  calculatedAt: number;
}

export default function TrackOrder() {
  const [, params] = useRoute("/rastrear/:orderId");
  const orderId = params?.orderId ? parseInt(params.orderId) : 0;
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const lastLatLngRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastEtaCalcRef = useRef<number>(0);

  const [eta, setEta] = useState<EtaInfo | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);

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

  const handleMapReady = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
    setMapReady(true);

    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#6E0D12",
        strokeWeight: 5,
        strokeOpacity: 0.9,
      },
    });
    renderer.setMap(map);
    directionsRendererRef.current = renderer;
  }, []);

  const calcEta = useCallback(
    (origin: google.maps.LatLng, destination: string) => {
      const now = Date.now();
      if (now - lastEtaCalcRef.current < ETA_RECALC_INTERVAL_MS) return;
      lastEtaCalcRef.current = now;
      setEtaLoading(true);

      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS,
          },
        },
        (result, status) => {
          setEtaLoading(false);
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current?.setDirections(result);

            const leg = result.routes[0]?.legs[0];
            if (leg) {
              setEta({
                durationText: leg.duration_in_traffic?.text ?? leg.duration?.text ?? "—",
                durationSecs: leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0,
                distanceText: leg.distance?.text ?? "—",
                distanceMeters: leg.distance?.value ?? 0,
                calculatedAt: now,
              });
            }

            const destLatLng = result.routes[0]?.legs[0]?.end_location;
            if (destLatLng && mapInstance) {
              if (!destinationMarkerRef.current) {
                destinationMarkerRef.current = new google.maps.Marker({
                  position: destLatLng,
                  map: mapInstance,
                  title: "Seu endereço",
                  icon: {
                    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#00000066"/>
                        </filter>
                        <path d="M22 2C13.16 2 6 9.16 6 18c0 12 16 32 16 32s16-20 16-32c0-8.84-7.16-16-16-16z" fill="#1e293b" stroke="white" stroke-width="2" filter="url(#shadow)"/>
                        <text x="22" y="22" text-anchor="middle" font-size="14" fill="white">🏠</text>
                      </svg>
                    `),
                    scaledSize: new google.maps.Size(44, 52),
                    anchor: new google.maps.Point(22, 50),
                  },
                });
              } else {
                destinationMarkerRef.current.setPosition(destLatLng);
              }
            }
          }
        }
      );
    },
    [mapInstance]
  );

  useEffect(() => {
    if (!mapReady || !mapInstance || !locationQuery.data) return;

    const { lat, lng } = locationQuery.data;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const newPos = new google.maps.LatLng(latNum, lngNum);

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: newPos,
        map: mapInstance,
        title: locationQuery.data.driverName,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#6E0D1280"/>
              </filter>
              <circle cx="24" cy="24" r="22" fill="#6E0D12" stroke="white" stroke-width="2.5" filter="url(#shadow)"/>
              <text x="24" y="31" text-anchor="middle" font-size="20" fill="white">🏍️</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        },
        animation: google.maps.Animation.DROP,
      });
      mapInstance.setCenter(newPos);
      mapInstance.setZoom(15);
    } else {
      driverMarkerRef.current.setPosition(newPos);
    }

    lastLatLngRef.current = { lat: latNum, lng: lngNum };

    const address = orderQuery.data?.deliveryAddress;
    if (address) {
      calcEta(newPos, address);
    }
  }, [locationQuery.data, mapReady, mapInstance, orderQuery.data?.deliveryAddress, calcEta]);

  // Forçar primeiro cálculo de ETA ao entrar na aba (sem throttle na primeira vez)
  useEffect(() => {
    if (mapReady && locationQuery.data && orderQuery.data?.deliveryAddress) {
      lastEtaCalcRef.current = 0; // reset para forçar cálculo imediato
    }
  }, [mapReady]);

  useEffect(() => {
    return () => {
      driverMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
      directionsRendererRef.current?.setMap(null);
    };
  }, []);

  const hasLocation = !!locationQuery.data;
  const isLoading = locationQuery.isLoading;
  const driverName = locationQuery.data?.driverName ?? "Motoboy";
  const lastUpdate = locationQuery.data?.updatedAt
    ? new Date(locationQuery.data.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#0d0103] flex items-center justify-center">
        <div className="text-center text-zinc-400 px-6">
          <div className="w-16 h-16 rounded-full bg-[#6E0D12]/20 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-[#6E0D12]" />
          </div>
          <p className="text-white font-semibold mb-1">Pedido não encontrado</p>
          <p className="text-zinc-500 text-sm mb-4">Verifique o número do pedido e tente novamente.</p>
          <Link href="/">
            <button className="bg-[#6E0D12] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#8B1018] transition-colors">
              Voltar ao início
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0103] flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #1a0305 0%, #2d0609 100%)" }}
      >
        <Link href="/minha-conta">
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-black text-base leading-tight" style={{ fontFamily: "Poppins, sans-serif" }}>
              Rastrear Entrega
            </h1>
            <span className="text-[#6E0D12] text-xs font-semibold bg-[#6E0D12]/15 px-2 py-0.5 rounded-full">
              #{orderId}
            </span>
          </div>

          {/* Status inline no header */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {isLoading ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-zinc-400 text-xs">Localizando...</span>
              </>
            ) : hasLocation ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-medium">{driverName} está a caminho</span>
                {lastUpdate && (
                  <span className="text-zinc-600 text-xs">· {lastUpdate}</span>
                )}
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="text-zinc-500 text-xs">Aguardando rastreamento</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => locationQuery.refetch()}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 hover:text-white transition-all shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${locationQuery.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Mapa (ocupa todo o espaço disponível) ── */}
      <div className="flex-1 relative min-h-0">
        <MapView
          onMapReady={handleMapReady}
          className="w-full h-full"
          initialCenter={{ lat: -19.9833, lng: -44.0667 }}
          initialZoom={13}
        />

        {/* ETA Overlay — flutuante sobre o mapa */}
        {hasLocation && (
          <div className="absolute top-3 left-3 right-3 pointer-events-none">
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              style={{
                background: "rgba(110, 13, 18, 0.92)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(110,13,18,0.4), 0 1px 0 rgba(255,255,255,0.08) inset",
              }}
            >
              {/* Tempo estimado */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Timer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white/60 text-xs leading-none mb-0.5">Previsão de chegada</p>
                  {etaLoading && !eta ? (
                    <div className="w-20 h-5 bg-white/20 rounded-lg animate-pulse mt-1" />
                  ) : eta ? (
                    <p className="text-white font-black text-xl leading-none" style={{ fontFamily: "Poppins, sans-serif" }}>
                      ~{eta.durationText}
                    </p>
                  ) : (
                    <p className="text-white/50 text-sm font-semibold">Calculando...</p>
                  )}
                </div>
              </div>

              {/* Distância */}
              {eta?.distanceText && (
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 shrink-0">
                  <Bike className="w-3.5 h-3.5 text-white/70" />
                  <div>
                    <p className="text-white font-bold text-sm leading-none">{eta.distanceText}</p>
                    <p className="text-white/50 text-xs leading-none mt-0.5">restantes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Overlay sem rastreamento */}
        {!hasLocation && !isLoading && (
          <div className="absolute inset-0 flex items-end justify-center pb-8"
            style={{ background: "linear-gradient(to top, rgba(13,1,3,0.85) 0%, transparent 60%)" }}
          >
            <div className="text-center px-6 max-w-xs">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(110,13,18,0.3)", border: "1px solid rgba(110,13,18,0.5)" }}
              >
                <Navigation className="w-7 h-7 text-[#ff6b6b]" />
              </div>
              <h3 className="text-white font-bold text-base mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                Rastreamento não iniciado
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                O motoboy ainda não iniciou o GPS. O mapa atualiza automaticamente quando ele sair para entrega.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Rodapé ── */}
      <div
        className="shrink-0 px-4 pt-3 pb-5"
        style={{ background: "linear-gradient(180deg, #1a0305 0%, #0d0103 100%)" }}
      >
        {/* Endereço + badge */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(110,13,18,0.3)", border: "1px solid rgba(110,13,18,0.4)" }}
          >
            <MapPin className="w-4 h-4 text-[#ff6b6b]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-500 text-xs">Entregando em</p>
            <p className="text-white text-sm font-semibold truncate leading-tight">
              {orderQuery.data?.deliveryAddress ?? "Carregando..."}
            </p>
          </div>
          {hasLocation ? (
            <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/50 rounded-full px-2.5 py-1 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-semibold">Em rota</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-full px-2.5 py-1 shrink-0">
              <Clock className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-500 text-xs">Aguardando</span>
            </div>
          )}
        </div>

        {/* Divisor */}
        <div className="h-px bg-white/5 mb-3" />

        {/* Chat + atualização */}
        <div className="flex items-center justify-between">
          {user ? (
            <button
              onClick={() => setShowChat(v => !v)}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: showChat ? "#ff6b6b" : "#a01218" }}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{showChat ? "Fechar chat" : "Falar com o restaurante"}</span>
            </button>
          ) : (
            <div />
          )}
          <p className="text-zinc-600 text-xs">Atualiza a cada 5s</p>
        </div>

        {/* Chat expandido */}
        {showChat && user && (
          <div className="mt-3">
            <OrderChat
              orderId={orderId}
              currentUserRole="customer"
              currentUserName={user.name ?? "Cliente"}
              inline
            />
          </div>
        )}
      </div>
    </div>
  );
}
