import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@/styles/admin-system.css";

import { useAuth } from "@/_core/hooks/useAuth";
import {
  AdminCardSkeleton,
  AdminEmptyState,
  AdminPage,
  AdminPill,
  AdminSurface,
  AdminTopbar,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { trpc } from "@/lib/trpc";
import { lookupCep, lookupNeighborhoodCep } from "@/lib/cep";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DollarSign,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type OriginForm = {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type ZoneDraft = {
  key: string;
  id?: number;
  minKm: string;
  maxKm: string;
  fee: string;
  estimatedMinutes: string;
  active: boolean;
};

type Coordinates = { latitude: number; longitude: number };

function MapOriginPicker({ onPick }: { onPick: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onPick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });
  return null;
}

const EMPTY_ORIGIN: OriginForm = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function numberFromInput(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function kmToMeters(value: string) {
  const km = numberFromInput(value);
  return Number.isFinite(km) ? Math.round(km * 1000) : Number.NaN;
}

function moneyToCents(value: string) {
  const amount = numberFromInput(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

function metersToKmInput(meters: number) {
  return (meters / 1000).toFixed(meters % 1000 === 0 ? 1 : 3).replace(/0+$/, "").replace(/,$/, "");
}

function centsToMoneyInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function originSignature(origin: OriginForm) {
  return JSON.stringify({
    postalCode: origin.postalCode.replace(/\D/g, ""),
    street: origin.street.trim().toLowerCase(),
    number: origin.number.trim().toLowerCase(),
    complement: origin.complement.trim().toLowerCase(),
    neighborhood: origin.neighborhood.trim().toLowerCase(),
    city: origin.city.trim().toLowerCase(),
    state: origin.state.trim().toUpperCase(),
  });
}

function analyzeZones(zones: ZoneDraft[], maxDistanceMeters: number) {
  const errors: string[] = [];
  const gaps: Array<{ fromMeters: number; toMeters: number }> = [];

  const parsed = zones
    .map((zone, index) => ({
      index,
      active: zone.active,
      min: kmToMeters(zone.minKm),
      max: kmToMeters(zone.maxKm),
      fee: moneyToCents(zone.fee),
      minutes: Number.parseInt(zone.estimatedMinutes, 10),
    }))
    .filter((zone) => zone.active)
    .sort((a, b) => a.min - b.min);

  for (const zone of parsed) {
    if (!Number.isInteger(zone.min) || zone.min < 0) errors.push(`Faixa ${zone.index + 1}: distância mínima inválida.`);
    if (!Number.isInteger(zone.max) || zone.max <= zone.min) errors.push(`Faixa ${zone.index + 1}: limite máximo deve ser maior que o mínimo.`);
    if (!Number.isInteger(zone.fee) || zone.fee < 0) errors.push(`Faixa ${zone.index + 1}: taxa inválida.`);
    if (!Number.isInteger(zone.minutes) || zone.minutes <= 0) errors.push(`Faixa ${zone.index + 1}: informe um tempo válido.`);
  }

  const validBounds = parsed.filter((zone) => Number.isInteger(zone.min) && Number.isInteger(zone.max) && zone.max > zone.min);
  if (validBounds.length > 0 && validBounds[0].min > 0) {
    gaps.push({ fromMeters: 0, toMeters: validBounds[0].min });
  }

  for (let index = 1; index < validBounds.length; index += 1) {
    const previous = validBounds[index - 1];
    const current = validBounds[index];
    if (current.min < previous.max) {
      errors.push(
        `As faixas ${(previous.min / 1000).toLocaleString("pt-BR")}–${(previous.max / 1000).toLocaleString("pt-BR")} km e ${(current.min / 1000).toLocaleString("pt-BR")}–${(current.max / 1000).toLocaleString("pt-BR")} km se sobrepõem.`,
      );
    } else if (current.min > previous.max) {
      gaps.push({ fromMeters: previous.max, toMeters: current.min });
    }
  }

  const furthest = validBounds.reduce((value, zone) => Math.max(value, zone.max), 0);
  if (maxDistanceMeters > 0 && furthest > maxDistanceMeters) {
    errors.push("O raio máximo da unidade é menor que a maior faixa ativa.");
  } else if (maxDistanceMeters > furthest && furthest > 0) {
    gaps.push({ fromMeters: furthest, toMeters: maxDistanceMeters });
  }

  return { errors: Array.from(new Set(errors)), gaps };
}

function formatGap(gap: { fromMeters: number; toMeters: number }) {
  return `${(gap.fromMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} km a ${(gap.toMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} km`;
}

export default function DeliveryZones() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const {
    selectedStoreId,
    setSelectedStoreId,
    selectedStoreName,
    stores,
    isLoading: storesLoading,
  } = useAdminStore();

  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [origin, setOrigin] = useState<OriginForm>(EMPTY_ORIGIN);
  const [zones, setZones] = useState<ZoneDraft[]>([]);
  const [selectedZoneKeys, setSelectedZoneKeys] = useState<Set<string>>(new Set());
  const [previewCoordinates, setPreviewCoordinates] = useState<Coordinates | null>(null);
  const [previewProvider, setPreviewProvider] = useState<string | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [hydratedStoreId, setHydratedStoreId] = useState<number | null>(null);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);

  const configQuery = trpc.delivery.adminGetConfiguration.useQuery(
    { storeId: selectedStoreId ?? 0 },
    { enabled: Boolean(selectedStoreId) },
  );

  const previewMutation = trpc.delivery.adminPreviewOrigin.useMutation();
  const saveMutation = trpc.delivery.adminSaveConfiguration.useMutation();

  const previewMaxDistanceMeters = kmToMeters(maxDistanceKm);
  const previewOriginIsCurrent =
    Boolean(previewCoordinates)
    && previewSignature === originSignature(origin);
  const coverageQuery = trpc.delivery.adminCoveragePreview.useQuery(
    {
      storeId: selectedStoreId ?? 0,
      origin: previewCoordinates ?? { latitude: 0, longitude: 0 },
      city: origin.city || configQuery.data?.store?.city || "Cidade",
      state: origin.state || configQuery.data?.settings?.originState || "MG",
      maxDistanceMeters:
        Number.isInteger(previewMaxDistanceMeters) && previewMaxDistanceMeters >= 100
          ? previewMaxDistanceMeters
          : 100,
    },
    {
      enabled: Boolean(
        selectedStoreId
        && previewCoordinates
        && previewOriginIsCurrent
        && Number.isInteger(previewMaxDistanceMeters)
        && previewMaxDistanceMeters >= 100,
      ),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: 1,
    },
  );

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "admin" && user.role !== "manager"))) {
      navigate("/admin");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!selectedStoreId || !configQuery.data || hydratedStoreId === selectedStoreId) return;

    const { settings, store } = configQuery.data;
    const nextOrigin: OriginForm = {
      postalCode: settings?.originPostalCode ?? "",
      street: settings?.originStreet ?? "",
      number: settings?.originNumber ?? "",
      complement: settings?.originComplement ?? "",
      neighborhood: settings?.originNeighborhood ?? "",
      city: settings?.originCity ?? store?.city ?? "",
      state: settings?.originState ?? "",
    };

    setDeliveryEnabled(Boolean(settings?.deliveryEnabled));
    setMaxDistanceKm(settings?.maxDeliveryDistanceMeters
      ? metersToKmInput(settings.maxDeliveryDistanceMeters)
      : "");
    setOrigin(nextOrigin);
    setZones(configQuery.data.zones.map((zone) => ({
      key: `zone-${zone.id}`,
      id: zone.id,
      minKm: metersToKmInput(zone.minDistanceMeters),
      maxKm: metersToKmInput(zone.maxDistanceMeters),
      fee: centsToMoneyInput(zone.deliveryFeeCents),
      estimatedMinutes: String(zone.estimatedMinutes),
      active: zone.active,
    })));
    setSelectedZoneKeys(new Set());

    const latitude = Number(settings?.latitude ?? store?.latitude);
    const longitude = Number(settings?.longitude ?? store?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setPreviewCoordinates({ latitude, longitude });
      setPreviewProvider(settings?.geocodingProvider ?? "salvo");
      setPreviewSignature(originSignature(nextOrigin));
    } else {
      setPreviewCoordinates(null);
      setPreviewProvider(null);
      setPreviewSignature(null);
    }
    setHydratedStoreId(selectedStoreId);
  }, [configQuery.data, hydratedStoreId, selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId) return;
    if (hydratedStoreId !== selectedStoreId) return;
    setHydratedStoreId(null);
  }, [selectedStoreId]);

  if (authLoading || storesLoading) return null;
  if (!user || (user.role !== "admin" && user.role !== "manager")) return null;

  const maxDistanceMeters = kmToMeters(maxDistanceKm);
  const analysis = analyzeZones(zones, Number.isFinite(maxDistanceMeters) ? maxDistanceMeters : 0);
  const currentOriginSignature = originSignature(origin);
  const originNeedsPreview = previewSignature !== currentOriginSignature;

  const updateOrigin = (field: keyof OriginForm, value: string) => {
    setOrigin((current) => ({ ...current, [field]: field === "state" ? value.toUpperCase() : value }));
    setPreviewSignature(null);
  };

  const handleOriginCepBlur = async () => {
    const cep = origin.postalCode.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setAddressLookupLoading(true);
    try {
      const data = await lookupCep(cep);
      if (!data) {
        toast.error("CEP nÃ£o encontrado.");
        return;
      }
      setOrigin((current) => ({
        ...current,
        postalCode: data.cep,
        street: data.street || current.street,
        neighborhood: data.neighborhood || current.neighborhood,
        city: data.city || current.city,
        state: data.state || current.state,
      }));
      setPreviewSignature(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel consultar o CEP agora.");
    } finally {
      setAddressLookupLoading(false);
    }
  };

  const handleOriginNeighborhoodBlur = async () => {
    const neighborhood = origin.neighborhood.trim();
    const city = origin.city.trim() || configQuery.data?.store?.city?.trim() || "";
    if (neighborhood.length < 2 || city.length < 2) return;
    setAddressLookupLoading(true);
    try {
      const data = await lookupNeighborhoodCep({ neighborhood, city, state: origin.state });
      if (!data) {
        toast.error("NÃ£o foi possÃ­vel identificar o CEP deste bairro.");
        return;
      }
      setOrigin((current) => ({
        ...current,
        postalCode: data.cep,
        street: current.street || data.street,
        neighborhood: data.neighborhood || current.neighborhood,
        city: data.city || current.city,
        state: data.state || current.state,
      }));
      setPreviewSignature(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel identificar o CEP deste bairro agora.");
    } finally {
      setAddressLookupLoading(false);
    }
  };

  const updateZone = (key: string, patch: Partial<ZoneDraft>) => {
    setZones((current) => current.map((zone) => zone.key === key ? { ...zone, ...patch } : zone));
  };

  const addZone = () => {
    const activeSorted = [...zones]
      .filter((zone) => zone.active)
      .sort((a, b) => kmToMeters(a.maxKm) - kmToMeters(b.maxKm));
    const previous = activeSorted[activeSorted.length - 1];
    const minKm = previous?.maxKm || "0";
    setZones((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        minKm,
        maxKm: "",
        fee: "",
        estimatedMinutes: "",
        active: true,
      },
    ]);
  };

  const removeZone = (key: string) => {
    setZones((current) => current.filter((zone) => zone.key !== key));
    setSelectedZoneKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const targetZoneKeys = () => selectedZoneKeys.size > 0
    ? selectedZoneKeys
    : new Set(zones.map((zone) => zone.key));

  const adjustZones = (kind: "minutes" | "fee", delta: number) => {
    const targets = targetZoneKeys();
    setZones((current) => current.map((zone) => {
      if (!targets.has(zone.key)) return zone;
      if (kind === "minutes") {
        const currentValue = Number.parseInt(zone.estimatedMinutes, 10);
        const next = Math.max(1, (Number.isFinite(currentValue) ? currentValue : 0) + delta);
        return { ...zone, estimatedMinutes: String(next) };
      }
      const currentCents = moneyToCents(zone.fee);
      const nextCents = Math.max(0, (Number.isFinite(currentCents) ? currentCents : 0) + delta);
      return { ...zone, fee: centsToMoneyInput(nextCents) };
    }));
  };

  const handlePreviewOrigin = async () => {
    if (!selectedStoreId) return;
    try {
      const result = await previewMutation.mutateAsync({
        storeId: selectedStoreId,
        address: {
          postalCode: origin.postalCode,
          street: origin.street,
          number: origin.number,
          complement: origin.complement || null,
          neighborhood: origin.neighborhood || null,
          city: origin.city,
          state: origin.state,
        },
        requestId: globalThis.crypto?.randomUUID?.(),
      });
      setPreviewCoordinates({ latitude: result.latitude, longitude: result.longitude });
      setPreviewProvider(result.provider);
      setPreviewSignature(currentOriginSignature);
      toast.success("Localização encontrada. Confira o marcador no mapa antes de salvar.");
    } catch (error) {
      setPreviewCoordinates(null);
      setPreviewProvider(null);
      setPreviewSignature(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível localizar a unidade.");
    }
  };

  const handleSave = async () => {
    if (!selectedStoreId) return;
    if (originNeedsPreview || !previewCoordinates) {
      toast.error("Atualize e confirme a localização da unidade antes de salvar.");
      return;
    }
    if (analysis.errors.length > 0) {
      toast.error(analysis.errors[0]);
      return;
    }

    const normalizedMaxMeters = kmToMeters(maxDistanceKm);
    if (!Number.isInteger(normalizedMaxMeters) || normalizedMaxMeters < 0) {
      toast.error("Informe um raio máximo válido.");
      return;
    }

    const payloadZones = zones.map((zone, index) => ({
      id: zone.id,
      minDistanceMeters: kmToMeters(zone.minKm),
      maxDistanceMeters: kmToMeters(zone.maxKm),
      deliveryFeeCents: moneyToCents(zone.fee),
      estimatedMinutes: Number.parseInt(zone.estimatedMinutes, 10),
      sortOrder: index,
      active: zone.active,
    }));

    try {
      await saveMutation.mutateAsync({
        storeId: selectedStoreId,
        deliveryEnabled,
        maxDeliveryDistanceMeters: normalizedMaxMeters,
        originAddress: {
          postalCode: origin.postalCode,
          street: origin.street,
          number: origin.number,
          complement: origin.complement || null,
          neighborhood: origin.neighborhood || null,
          city: origin.city,
          state: origin.state,
        },
        confirmedOrigin: previewCoordinates,
        zones: payloadZones,
        requestId: globalThis.crypto?.randomUUID?.(),
      });
      setHydratedStoreId(null);
      await configQuery.refetch();
      await utils.stores.listAll.invalidate();
      toast.success("Configurações de entrega atualizadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    }
  };

  const mapCenter = previewCoordinates
    ? [previewCoordinates.latitude, previewCoordinates.longitude] as [number, number]
    : null;

  const mapZones = zones
    .filter((zone) => zone.active)
    .map((zone) => ({ ...zone, maxMeters: kmToMeters(zone.maxKm) }))
    .filter((zone) => Number.isInteger(zone.maxMeters) && zone.maxMeters > 0)
    .sort((a, b) => b.maxMeters - a.maxMeters);

  const parsedActiveZones = zones
    .filter((zone) => zone.active)
    .map((zone) => ({
      ...zone,
      minMeters: kmToMeters(zone.minKm),
      maxMeters: kmToMeters(zone.maxKm),
      feeCents: moneyToCents(zone.fee),
      minutes: Number.parseInt(zone.estimatedMinutes, 10),
    }))
    .filter((zone) =>
      Number.isInteger(zone.minMeters)
      && Number.isInteger(zone.maxMeters)
      && zone.maxMeters > zone.minMeters)
    .sort((a, b) => a.minMeters - b.minMeters);

  const zoneForDistance = (distanceMeters: number) =>
    parsedActiveZones.find((zone) => {
      const lowerOk = zone.minMeters === 0
        ? distanceMeters >= 0
        : distanceMeters > zone.minMeters;
      return lowerOk && distanceMeters <= zone.maxMeters;
    }) ?? null;

  const coveragePolygon = (coverageQuery.data?.polygon ?? [])
    .map((point) => [point.latitude, point.longitude] as [number, number]);

  const mappedNeighborhoods = (coverageQuery.data?.neighborhoods ?? [])
    .map((neighborhood) => {
      const distanceMeters =
        neighborhood.routeDistanceMeters
        ?? neighborhood.straightLineDistanceMeters;
      const zone = zoneForDistance(distanceMeters);
      return {
        ...neighborhood,
        distanceMeters,
        zone,
        usesRouteDistance: neighborhood.routeDistanceMeters !== null,
        insideMaxDistance:
          Number.isInteger(maxDistanceMeters)
          && maxDistanceMeters > 0
          && distanceMeters <= maxDistanceMeters,
      };
    })
    .filter((neighborhood) => neighborhood.insideMaxDistance)
    .sort((a, b) => a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name, "pt-BR"));

  const coveredNeighborhoods = mappedNeighborhoods.filter((neighborhood) => neighborhood.zone);
  const activeMinutes = parsedActiveZones.map((zone) => zone.minutes).filter(Number.isFinite);
  const activeFees = parsedActiveZones.map((zone) => zone.feeCents).filter(Number.isFinite);
  const minMinutes = activeMinutes.length ? Math.min(...activeMinutes) : null;
  const maxMinutes = activeMinutes.length ? Math.max(...activeMinutes) : null;
  const minFeeCents = activeFees.length ? Math.min(...activeFees) : null;
  const maxFeeCents = activeFees.length ? Math.max(...activeFees) : null;

  const allSelected = zones.length > 0 && selectedZoneKeys.size === zones.length;

  return (
    <div className="bonatto-admin min-h-screen">
      <main className="admin-main min-h-screen">
        <div className="admin-content-frame">
          <AdminPage>
            <AdminTopbar
              title="Configurações de entrega"
              subtitle="Defina como funciona a logística desta unidade. Taxa e prazo são calculados por distância de rota."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedStoreId ? String(selectedStoreId) : undefined}
                    onValueChange={(value) => setSelectedStoreId(Number(value))}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={String(store.id)}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSave} disabled={saveMutation.isPending || configQuery.isLoading} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
                  </Button>
                </div>
              }
            />

            {configQuery.isLoading || !selectedStoreId ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <AdminCardSkeleton className="h-[420px]" />
                <AdminCardSkeleton className="h-[420px]" />
              </div>
            ) : configQuery.isError ? (
              <AdminSurface>
                <AdminEmptyState
                  icon={<AlertTriangle className="h-8 w-8" />}
                  title="Não foi possível carregar a entrega"
                  description={configQuery.error.message}
                  action={<Button onClick={() => configQuery.refetch()}>Tentar novamente</Button>}
                />
              </AdminSurface>
            ) : (
              <>
                <AdminSurface
                  title="Entrega própria"
                  subtitle={`${selectedStoreName} • cada unidade possui regras independentes`}
                  actions={
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-[var(--admin-text-secondary)]">
                        {deliveryEnabled ? "Ativa" : "Inativa"}
                      </span>
                      <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
                    </div>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="max-distance">Raio máximo de entrega</Label>
                      <div className="relative">
                        <Input
                          id="max-distance"
                          inputMode="decimal"
                          value={maxDistanceKm}
                          onChange={(event) => setMaxDistanceKm(event.target.value)}
                          placeholder="Ex.: 5"
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--admin-text-muted)]">km</span>
                      </div>
                    </div>
                    <p className="text-xs leading-5 text-[var(--admin-text-secondary)]">
                      O raio máximo é um limite de segurança. Dentro dele, somente distâncias cobertas por uma faixa ativa podem receber pedidos.
                    </p>
                  </div>
                </AdminSurface>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
                  <AdminSurface
                    title="Mapa de cobertura"
                    subtitle="Visualização aproximada das faixas. Clique no mapa para ajustar manualmente o ponto exato da loja."
                    actions={previewProvider ? <AdminPill tone="neutral">{previewProvider}</AdminPill> : undefined}
                  >
                    {mapCenter ? (
                      <div className="overflow-hidden rounded-[16px] border border-[var(--admin-border)]">
                        <MapContainer
                          key={`${mapCenter[0]}:${mapCenter[1]}:${maxDistanceMeters}`}
                          center={mapCenter}
                          zoom={13}
                          scrollWheelZoom
                          className="h-[430px] w-full"
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <MapOriginPicker
                            onPick={(coordinates) => {
                              setPreviewCoordinates(coordinates);
                              setPreviewProvider("mapa-confirmado");
                              setPreviewSignature(currentOriginSignature);
                              toast.success("Ponto exato da unidade confirmado no mapa.");
                            }}
                          />
                          {coveragePolygon.length >= 3 && (
                            <Polygon
                              positions={coveragePolygon}
                              pathOptions={{
                                color: "#8b1e2d",
                                weight: 2,
                                opacity: 0.9,
                                fillColor: "#c14a63",
                                fillOpacity: 0.2,
                              }}
                            >
                              <Tooltip>
                                Área estimada alcançável pela malha viária até o limite configurado
                              </Tooltip>
                            </Polygon>
                          )}
                          {Number.isInteger(maxDistanceMeters) && maxDistanceMeters > 0 && (
                            <Circle
                              center={mapCenter}
                              radius={maxDistanceMeters}
                              pathOptions={{
                                color: "var(--admin-brand-800)",
                                weight: 2,
                                dashArray: "7 7",
                                fillOpacity: 0.02,
                              }}
                            />
                          )}
                          {mapZones.map((zone, index) => (
                            <Circle
                              key={zone.key}
                              center={mapCenter}
                              radius={zone.maxMeters}
                              pathOptions={{
                                color: "var(--admin-brand-700)",
                                weight: 1,
                                opacity: 0.35,
                                fillColor: "var(--admin-brand-100)",
                                fillOpacity: Math.min(0.012 + index * 0.004, 0.035),
                              }}
                            >
                              <Tooltip>
                                Até {zone.maxKm} km • R$ {zone.fee || "—"} • {zone.estimatedMinutes || "—"} min
                              </Tooltip>
                            </Circle>
                          ))}
                          {mappedNeighborhoods.slice(0, 30).map((neighborhood) => (
                            <CircleMarker
                              key={`${neighborhood.name}-${neighborhood.latitude}-${neighborhood.longitude}`}
                              center={[neighborhood.latitude, neighborhood.longitude]}
                              radius={5}
                              pathOptions={{
                                color: "#ffffff",
                                weight: 2,
                                fillColor: neighborhood.zone ? "#8b1e2d" : "#d97706",
                                fillOpacity: 1,
                              }}
                            >
                              <Tooltip
                                direction="top"
                                permanent={mappedNeighborhoods.length <= 10}
                                offset={[0, -4]}
                              >
                                <div>
                                  <strong>{neighborhood.name}</strong>
                                  <br />
                                  {(neighborhood.distanceMeters / 1000).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })} km
                                  {neighborhood.zone
                                    ? ` • R$ ${neighborhood.zone.fee || "0,00"} • ${neighborhood.zone.estimatedMinutes || "—"} min`
                                    : " • sem faixa configurada"}
                                </div>
                              </Tooltip>
                            </CircleMarker>
                          ))}
                          <CircleMarker
                            center={mapCenter}
                            radius={8}
                            pathOptions={{
                              color: "#fff",
                              weight: 3,
                              fillColor: "var(--admin-brand-800)",
                              fillOpacity: 1,
                            }}
                          >
                            <Tooltip permanent direction="top" offset={[0, -8]}>
                              {selectedStoreName}
                            </Tooltip>
                          </CircleMarker>
                        </MapContainer>

                        <div className="grid gap-2 border-t border-[var(--admin-border)] bg-white p-3 sm:grid-cols-4">
                          <div className="rounded-[10px] bg-[var(--admin-surface-alt)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">Cobertura</p>
                            <p className="mt-1 text-sm font-semibold">
                              {Number.isInteger(maxDistanceMeters) && maxDistanceMeters > 0
                                ? `${(maxDistanceMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-[10px] bg-[var(--admin-surface-alt)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">Bairros mapeados</p>
                            <p className="mt-1 text-sm font-semibold">{mappedNeighborhoods.length}</p>
                          </div>
                          <div className="rounded-[10px] bg-[var(--admin-surface-alt)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">Tempo</p>
                            <p className="mt-1 text-sm font-semibold">
                              {minMinutes !== null && maxMinutes !== null ? `${minMinutes}–${maxMinutes} min` : "—"}
                            </p>
                          </div>
                          <div className="rounded-[10px] bg-[var(--admin-surface-alt)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">Taxa</p>
                            <p className="mt-1 text-sm font-semibold">
                              {minFeeCents !== null && maxFeeCents !== null
                                ? `R$ ${centsToMoneyInput(minFeeCents)}–${centsToMoneyInput(maxFeeCents)}`
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-[var(--admin-border)] bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[var(--admin-text-primary)]">Bairros dentro da área</p>
                              <p className="text-[11px] leading-4 text-[var(--admin-text-secondary)]">
                                O bairro é apenas uma visualização. Taxa e disponibilidade continuam sendo calculadas pela rota do endereço real.
                              </p>
                            </div>
                            {coverageQuery.isFetching && <AdminPill tone="neutral">Mapeando...</AdminPill>}
                          </div>

                          {coverageQuery.isError ? (
                            <p className="text-xs text-[var(--admin-warning)]">
                              Não foi possível mapear os bairros agora. As faixas de entrega continuam funcionando normalmente.
                            </p>
                          ) : mappedNeighborhoods.length === 0 ? (
                            <p className="text-xs text-[var(--admin-text-secondary)]">
                              {coverageQuery.isFetching
                                ? "Consultando bairros e malha viária..."
                                : "Nenhum bairro identificado dentro do limite atual."}
                            </p>
                          ) : (
                            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                              {mappedNeighborhoods.map((neighborhood) => (
                                <div
                                  key={`coverage-${neighborhood.name}-${neighborhood.latitude}-${neighborhood.longitude}`}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                                    neighborhood.zone
                                      ? "border-[var(--admin-success)]/25 bg-[var(--admin-success-bg)] text-[var(--admin-text-primary)]"
                                      : "border-[var(--admin-warning)]/25 bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]"
                                  }`}
                                  title={neighborhood.usesRouteDistance ? "Distância rodoviária" : "Distância aproximada"}
                                >
                                  <span className="font-semibold">{neighborhood.name}</span>
                                  {" · "}
                                  {(neighborhood.distanceMeters / 1000).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })} km
                                  {neighborhood.zone
                                    ? ` · R$ ${neighborhood.zone.fee || "0,00"} · ${neighborhood.zone.estimatedMinutes || "—"} min`
                                    : " · sem faixa"}
                                </div>
                              ))}
                            </div>
                          )}

                          {mappedNeighborhoods.length > 0 && coveredNeighborhoods.length < mappedNeighborhoods.length && (
                            <p className="mt-2 text-[11px] text-[var(--admin-warning)]">
                              {mappedNeighborhoods.length - coveredNeighborhoods.length} bairro(s) estão dentro do limite máximo, mas caem em uma área sem faixa ativa.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <AdminEmptyState
                        icon={<MapPin className="h-8 w-8" />}
                        title="Origem ainda não confirmada"
                        description="Preencha o endereço da unidade e clique em Atualizar localização para visualizar a cobertura."
                      />
                    )}
                  </AdminSurface>

                  <AdminSurface title="Origem da entrega" subtitle="A localização precisa ser confirmada antes de salvar.">
                    <div className="space-y-4">
                      <div className="rounded-[12px] bg-[var(--admin-surface-alt)] p-3">
                        <p className="text-xs text-[var(--admin-text-secondary)]">Unidade</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--admin-text-primary)]">{selectedStoreName}</p>
                      </div>

                      <div className="grid grid-cols-[1fr_88px] gap-3">
                        <div className="space-y-1.5">
                          <Label>CEP {addressLookupLoading && <span className="text-[11px] text-[var(--admin-text-muted)]">(buscando...)</span>}</Label>
                          <Input value={origin.postalCode} onChange={(event) => updateOrigin("postalCode", event.target.value)} onBlur={handleOriginCepBlur} placeholder="35680-000" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>UF</Label>
                          <Input value={origin.state} maxLength={2} onChange={(event) => updateOrigin("state", event.target.value)} placeholder="MG" />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_100px] gap-3">
                        <div className="space-y-1.5">
                          <Label>Rua</Label>
                          <Input value={origin.street} onChange={(event) => updateOrigin("street", event.target.value)} placeholder="Rua da unidade" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Número</Label>
                          <Input value={origin.number} onChange={(event) => updateOrigin("number", event.target.value)} placeholder="123" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Bairro</Label>
                          <Input value={origin.neighborhood} onChange={(event) => updateOrigin("neighborhood", event.target.value)} onBlur={handleOriginNeighborhoodBlur} placeholder="Centro" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cidade</Label>
                          <Input value={origin.city} onChange={(event) => updateOrigin("city", event.target.value)} placeholder="Itaúna" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input value={origin.complement} onChange={(event) => updateOrigin("complement", event.target.value)} placeholder="Referência opcional" />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handlePreviewOrigin}
                        disabled={previewMutation.isPending}
                      >
                        <LocateFixed className="h-4 w-4" />
                        {previewMutation.isPending ? "Localizando..." : "Atualizar localização"}
                      </Button>

                      {previewCoordinates && !originNeedsPreview ? (
                        <div className="rounded-[12px] border border-[var(--admin-success)]/20 bg-[var(--admin-success-bg)] p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-success)]">
                            <CheckCircle2 className="h-4 w-4" />
                            Localização confirmada
                          </div>
                          <p className="mt-2 font-mono text-[11px] text-[var(--admin-text-secondary)]">
                            {previewCoordinates.latitude.toFixed(7)}, {previewCoordinates.longitude.toFixed(7)}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--admin-text-secondary)]">
                            Se o marcador não estiver exatamente na porta da loja, clique no ponto correto do mapa.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-[12px] border border-[var(--admin-warning)]/20 bg-[var(--admin-warning-bg)] p-3 text-xs leading-5 text-[var(--admin-warning)]">
                          Confirme a localização no mapa antes de salvar alterações no endereço.
                        </div>
                      )}
                    </div>
                  </AdminSurface>
                </div>

                <AdminSurface
                  title="Tempo e taxa por distância"
                  subtitle="A primeira faixa inclui o zero; nas demais, o limite inferior é exclusivo e o superior é inclusivo."
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminPill tone="neutral">
                        {selectedZoneKeys.size > 0 ? `${selectedZoneKeys.size} selecionada(s)` : "Todas as faixas"}
                      </AdminPill>
                      <Button variant="outline" size="sm" onClick={() => adjustZones("minutes", -5)}>
                        <Minus className="mr-1 h-3.5 w-3.5" /> 5 min
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => adjustZones("minutes", 5)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> 5 min
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => adjustZones("fee", -100)}>
                        <Minus className="mr-1 h-3.5 w-3.5" /> R$ 1
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => adjustZones("fee", 100)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> R$ 1
                      </Button>
                    </div>
                  }
                >
                  {analysis.errors.length > 0 && (
                    <div className="mb-4 rounded-[12px] border border-[var(--admin-danger)]/20 bg-[var(--admin-danger-bg)] p-3">
                      <div className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]" />
                        <div className="space-y-1">
                          {analysis.errors.map((error) => (
                            <p key={error} className="text-xs text-[var(--admin-danger)]">{error}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {analysis.gaps.length > 0 && (
                    <div className="mb-4 rounded-[12px] border border-[var(--admin-warning)]/20 bg-[var(--admin-warning-bg)] p-3">
                      <div className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]" />
                        <div>
                          <p className="text-xs font-semibold text-[var(--admin-warning)]">Áreas sem cobertura</p>
                          {analysis.gaps.map((gap) => (
                            <p key={`${gap.fromMeters}-${gap.toMeters}`} className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                              Área sem cobertura entre {formatGap(gap)}.
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {zones.length === 0 ? (
                    <AdminEmptyState
                      icon={<Truck className="h-8 w-8" />}
                      title="Nenhuma faixa cadastrada"
                      description="Adicione a primeira faixa para definir taxa e prazo por distância."
                      action={<Button onClick={addZone}><Plus className="mr-2 h-4 w-4" />Adicionar faixa</Button>}
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="admin-data-table min-w-[820px]">
                        <thead>
                          <tr>
                            <th className="w-12">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={(checked) => {
                                  setSelectedZoneKeys(checked === true
                                    ? new Set(zones.map((zone) => zone.key))
                                    : new Set());
                                }}
                                aria-label="Selecionar todas as faixas"
                              />
                            </th>
                            <th>De</th>
                            <th>Até</th>
                            <th><Clock3 className="mr-1 inline h-3.5 w-3.5" />Tempo</th>
                            <th><DollarSign className="mr-1 inline h-3.5 w-3.5" />Taxa</th>
                            <th>Status</th>
                            <th className="w-20">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zones.map((zone, index) => (
                            <tr key={zone.key}>
                              <td>
                                <Checkbox
                                  checked={selectedZoneKeys.has(zone.key)}
                                  onCheckedChange={(checked) => {
                                    setSelectedZoneKeys((current) => {
                                      const next = new Set(current);
                                      if (checked === true) next.add(zone.key);
                                      else next.delete(zone.key);
                                      return next;
                                    });
                                  }}
                                  aria-label={`Selecionar faixa ${index + 1}`}
                                />
                              </td>
                              <td>
                                <div className="relative w-28">
                                  <Input
                                    inputMode="decimal"
                                    value={zone.minKm}
                                    onChange={(event) => updateZone(zone.key, { minKm: event.target.value })}
                                    className="pr-9"
                                    aria-label={`Distância mínima da faixa ${index + 1}`}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--admin-text-muted)]">km</span>
                                </div>
                              </td>
                              <td>
                                <div className="relative w-28">
                                  <Input
                                    inputMode="decimal"
                                    value={zone.maxKm}
                                    onChange={(event) => updateZone(zone.key, { maxKm: event.target.value })}
                                    className="pr-9"
                                    placeholder="—"
                                    aria-label={`Distância máxima da faixa ${index + 1}`}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--admin-text-muted)]">km</span>
                                </div>
                              </td>
                              <td>
                                <div className="relative w-28">
                                  <Input
                                    inputMode="numeric"
                                    value={zone.estimatedMinutes}
                                    onChange={(event) => updateZone(zone.key, { estimatedMinutes: event.target.value })}
                                    className="pr-10"
                                    placeholder="—"
                                    aria-label={`Tempo da faixa ${index + 1}`}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--admin-text-muted)]">min</span>
                                </div>
                              </td>
                              <td>
                                <div className="relative w-32">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--admin-text-muted)]">R$</span>
                                  <Input
                                    inputMode="decimal"
                                    value={zone.fee}
                                    onChange={(event) => updateZone(zone.key, { fee: event.target.value })}
                                    className="pl-9"
                                    placeholder="0,00"
                                    aria-label={`Taxa da faixa ${index + 1}`}
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Switch checked={zone.active} onCheckedChange={(active) => updateZone(zone.key, { active })} />
                                  <span className="text-xs text-[var(--admin-text-secondary)]">{zone.active ? "Ativa" : "Pausada"}</span>
                                </div>
                              </td>
                              <td>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeZone(zone.key)}
                                  aria-label={`Excluir faixa ${index + 1}`}
                                  className="text-[var(--admin-danger)] hover:bg-[var(--admin-danger-bg)]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {zones.length > 0 && (
                    <Button variant="outline" className="mt-4 gap-2" onClick={addZone}>
                      <Plus className="h-4 w-4" />
                      Adicionar faixa
                    </Button>
                  )}
                </AdminSurface>

                <AdminSurface
                  title="Como a cobrança funciona"
                  subtitle="Resumo da nova regra de entrega."
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[12px] border border-[var(--admin-border)] p-4">
                      <MapPin className="h-5 w-5 text-[var(--admin-brand-800)]" />
                      <p className="mt-3 text-sm font-semibold text-[var(--admin-text-primary)]">1. Localizamos o endereço</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">CEP ajuda a preencher, mas a geocodificação valida rua e número.</p>
                    </div>
                    <div className="rounded-[12px] border border-[var(--admin-border)] p-4">
                      <Truck className="h-5 w-5 text-[var(--admin-brand-800)]" />
                      <p className="mt-3 text-sm font-semibold text-[var(--admin-text-primary)]">2. Calculamos a rota</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">A distância rodoviária é comparada com as faixas desta unidade.</p>
                    </div>
                    <div className="rounded-[12px] border border-[var(--admin-border)] p-4">
                      <DollarSign className="h-5 w-5 text-[var(--admin-brand-800)]" />
                      <p className="mt-3 text-sm font-semibold text-[var(--admin-text-primary)]">3. Aplicamos taxa e prazo</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">O backend recalcula tudo na finalização e salva um snapshot no pedido.</p>
                    </div>
                  </div>
                </AdminSurface>
              </>
            )}
          </AdminPage>
        </div>
      </main>
    </div>
  );
}
