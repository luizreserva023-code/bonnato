import { describe, expect, it } from "vitest";
import {
  buildNominatimSearchAttempts,
  findDeliveryZoneForDistance,
  haversineMeters,
  isValidCoordinates,
  rankAlternativeDeliveryStores,
  resolveCommercialDistance,
  validateDeliveryZones,
  type DeliveryZoneInput,
} from "./delivery.ts";

const zones: DeliveryZoneInput[] = [
  { id: 1, minDistanceMeters: 0, maxDistanceMeters: 500, deliveryFeeCents: 590, estimatedMinutes: 25, active: true },
  { id: 2, minDistanceMeters: 500, maxDistanceMeters: 1000, deliveryFeeCents: 690, estimatedMinutes: 30, active: true },
  { id: 3, minDistanceMeters: 1000, maxDistanceMeters: 3000, deliveryFeeCents: 790, estimatedMinutes: 35, active: true },
  { id: 4, minDistanceMeters: 3000, maxDistanceMeters: 5000, deliveryFeeCents: 990, estimatedMinutes: 45, active: true },
];

describe("delivery geocoding search", () => {
  it("usa busca estruturada sem depender do bairro para endereços brasileiros", () => {
    const attempts = buildNominatimSearchAttempts({
      postalCode: "35670-000",
      street: "Avenida Prefeito José Surdo",
      number: "1032",
      complement: "Loja 02",
      neighborhood: "Nossa Senhora do Rosário",
      city: "Mateus Leme",
      state: "MG",
    });

    expect(attempts).toHaveLength(2);
    expect(attempts[0].get("street")).toBe("1032 Avenida Prefeito José Surdo");
    expect(attempts[0].get("city")).toBe("Mateus Leme");
    expect(attempts[0].get("state")).toBe("MG");
    expect(attempts[0].get("postalcode")).toBe("35670000");
    expect(attempts[0].has("q")).toBe(false);
    expect(attempts[0].toString()).not.toContain("Nossa+Senhora");
  });

  it("fallback textual também ignora bairro que pode divergir da base cartográfica", () => {
    const attempts = buildNominatimSearchAttempts({
      postalCode: "35670-000",
      street: "Avenida Prefeito José Surdo",
      number: "1032",
      neighborhood: "Nossa Senhora do Rosário",
      city: "Mateus Leme",
      state: "MG",
    });

    expect(attempts[1].get("q")).toContain("Avenida Prefeito José Surdo, 1032");
    expect(attempts[1].get("q")).toContain("Mateus Leme");
    expect(attempts[1].get("q")).not.toContain("Nossa Senhora do Rosário");
  });
});

describe("delivery alternative store ranking", () => {
  it("ordena primeiro pela menor distância de rota, depois taxa e prazo", () => {
    const ranked = rankAlternativeDeliveryStores([
      { storeId: 3, name: "Juatuba", slug: "juatuba", city: "Juatuba", distanceKm: 4, distanceMeters: 4000, deliveryFee: 9, deliveryFeeCents: 900, estimatedMinutes: 35 },
      { storeId: 2, name: "Itaúna", slug: "itauna", city: "Itaúna", distanceKm: 3, distanceMeters: 3000, deliveryFee: 12, deliveryFeeCents: 1200, estimatedMinutes: 30 },
      { storeId: 4, name: "Teste", slug: "teste", city: "Teste", distanceKm: 3, distanceMeters: 3000, deliveryFee: 10, deliveryFeeCents: 1000, estimatedMinutes: 40 },
    ]);

    expect(ranked.map((store) => store.storeId)).toEqual([4, 2, 3]);
  });
});

describe("delivery distance rules", () => {
  it("cliente a 0,3 km entra na primeira faixa", () => {
    expect(findDeliveryZoneForDistance(zones, 300)?.id).toBe(1);
  });

  it("cliente exatamente a 0,5 km fica na primeira faixa", () => {
    expect(findDeliveryZoneForDistance(zones, 500)?.id).toBe(1);
  });

  it("cliente 1 metro depois de 0,5 km entra na faixa seguinte", () => {
    expect(findDeliveryZoneForDistance(zones, 501)?.id).toBe(2);
  });

  it("cliente exatamente a 1 km fica na segunda faixa", () => {
    expect(findDeliveryZoneForDistance(zones, 1000)?.id).toBe(2);
  });

  it("cliente exatamente no limite máximo é atendido", () => {
    expect(findDeliveryZoneForDistance(zones, 5000)?.id).toBe(4);
  });

  it("cliente 1 metro além do limite não encontra faixa", () => {
    expect(findDeliveryZoneForDistance(zones, 5001)).toBeNull();
  });

  it("não aceita distância negativa", () => {
    expect(findDeliveryZoneForDistance(zones, -1)).toBeNull();
  });

  it("não aceita distância fracionária porque a autoridade interna é metro inteiro", () => {
    expect(findDeliveryZoneForDistance(zones, 500.1)).toBeNull();
  });

  it("ignora faixa desativada", () => {
    const disabled = zones.map((zone) => zone.id === 2 ? { ...zone, active: false } : zone);
    expect(findDeliveryZoneForDistance(disabled, 700)).toBeNull();
  });

  it("sem faixas cadastradas não há cobertura", () => {
    expect(findDeliveryZoneForDistance([], 300)).toBeNull();
  });

  it("detecta sobreposição", () => {
    const result = validateDeliveryZones([
      { minDistanceMeters: 0, maxDistanceMeters: 2000, deliveryFeeCents: 500, estimatedMinutes: 25 },
      { minDistanceMeters: 1000, maxDistanceMeters: 3000, deliveryFeeCents: 600, estimatedMinutes: 30 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("sobrepõem"))).toBe(true);
  });

  it("detecta gap sem invalidar a configuração", () => {
    const result = validateDeliveryZones([
      { minDistanceMeters: 0, maxDistanceMeters: 2000, deliveryFeeCents: 500, estimatedMinutes: 25 },
      { minDistanceMeters: 3000, maxDistanceMeters: 5000, deliveryFeeCents: 600, estimatedMinutes: 30 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.gaps).toEqual([{ fromMeters: 2000, toMeters: 3000 }]);
  });

  it("rejeita valor negativo", () => {
    const result = validateDeliveryZones([
      { minDistanceMeters: 0, maxDistanceMeters: 1000, deliveryFeeCents: -1, estimatedMinutes: 25 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("taxa inválida"))).toBe(true);
  });

  it("rejeita maxDistance menor ou igual ao mínimo", () => {
    const result = validateDeliveryZones([
      { minDistanceMeters: 1000, maxDistanceMeters: 1000, deliveryFeeCents: 500, estimatedMinutes: 25 },
    ]);
    expect(result.valid).toBe(false);
  });

  it("rejeita faixas iguais", () => {
    const result = validateDeliveryZones([
      { minDistanceMeters: 0, maxDistanceMeters: 1000, deliveryFeeCents: 500, estimatedMinutes: 25 },
      { minDistanceMeters: 0, maxDistanceMeters: 1000, deliveryFeeCents: 600, estimatedMinutes: 30 },
    ]);
    expect(result.valid).toBe(false);
  });

  it("valida latitude inválida", () => {
    expect(isValidCoordinates({ latitude: 90.0001, longitude: -44 })).toBe(false);
  });

  it("valida longitude inválida", () => {
    expect(isValidCoordinates({ latitude: -20, longitude: 180.0001 })).toBe(false);
  });

  it("aceita coordenadas válidas brasileiras", () => {
    expect(isValidCoordinates({ latitude: -20.075, longitude: -44.576 })).toBe(true);
  });

  it("Haversine retorna zero para a mesma origem/destino", () => {
    expect(haversineMeters({ latitude: -20, longitude: -44 }, { latitude: -20, longitude: -44 })).toBe(0);
  });

  it("usa distância rodoviária quando disponível, nunca a linha reta", () => {
    const result = resolveCommercialDistance({
      routeDistanceMeters: 4200,
      straightLineDistanceMeters: 3000,
      allowStraightLineFallback: true,
    });
    expect(result).toEqual({ available: true, distanceMeters: 4200, usedStraightLineFallback: false });
  });

  it("provider de rota indisponível bloqueia cotação por padrão", () => {
    expect(resolveCommercialDistance({
      routeDistanceMeters: null,
      straightLineDistanceMeters: 3000,
      allowStraightLineFallback: false,
    })).toEqual({ available: false });
  });

  it("Haversine só vira distância comercial quando fallback foi habilitado explicitamente", () => {
    expect(resolveCommercialDistance({
      routeDistanceMeters: null,
      straightLineDistanceMeters: 3000,
      allowStraightLineFallback: true,
    })).toEqual({ available: true, distanceMeters: 3000, usedStraightLineFallback: true });
  });

  it("configurações de unidades diferentes permanecem isoladas", () => {
    const juatuba = [{ ...zones[0], id: 101, deliveryFeeCents: 590 }];
    const itauna = [{ ...zones[0], id: 201, deliveryFeeCents: 790 }];
    expect(findDeliveryZoneForDistance(juatuba, 300)?.deliveryFeeCents).toBe(590);
    expect(findDeliveryZoneForDistance(itauna, 300)?.deliveryFeeCents).toBe(790);
  });

  it("alterar taxa depois da primeira cotação muda a próxima resolução", () => {
    const before = findDeliveryZoneForDistance(zones, 700);
    const changed = zones.map((zone) => zone.id === 2 ? { ...zone, deliveryFeeCents: 890 } : zone);
    const after = findDeliveryZoneForDistance(changed, 700);
    expect(before?.deliveryFeeCents).toBe(690);
    expect(after?.deliveryFeeCents).toBe(890);
  });
});
