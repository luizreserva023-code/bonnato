import type { Express, RequestHandler } from "express";

export type PostalCodeAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  provider: "brasilapi" | "viacep";
};

function normalizeCep(value: string) {
  return value.replace(/\D/g, "");
}

async function fetchJson(url: string, timeoutMs = 4_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json() as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function lookupBrasilApi(cep: string): Promise<PostalCodeAddress | null> {
  const data = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!data || typeof data.city !== "string" || typeof data.state !== "string") {
    return null;
  }

  return {
    cep,
    street: typeof data.street === "string" ? data.street : "",
    neighborhood: typeof data.neighborhood === "string" ? data.neighborhood : "",
    city: data.city,
    state: data.state.toUpperCase(),
    provider: "brasilapi",
  };
}

async function lookupViaCep(cep: string): Promise<PostalCodeAddress | null> {
  const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
  if (!data || data.erro === true || data.erro === "true") return null;
  if (typeof data.localidade !== "string" || typeof data.uf !== "string") return null;

  return {
    cep,
    street: typeof data.logradouro === "string" ? data.logradouro : "",
    neighborhood: typeof data.bairro === "string" ? data.bairro : "",
    city: data.localidade,
    state: data.uf.toUpperCase(),
    provider: "viacep",
  };
}
export async function lookupPostalCode(rawCep: string): Promise<PostalCodeAddress | null> {
  const cep = normalizeCep(rawCep);
  if (!/^\d{8}$/.test(cep)) return null;

  // BrasilAPI agrega múltiplas fontes e cobre CEPs que o ViaCEP pode não resolver.
  return (await lookupBrasilApi(cep)) ?? (await lookupViaCep(cep));
}

export async function lookupNeighborhoodPostalCode(input: {
  neighborhood: string;
  city: string;
  state?: string;
}): Promise<PostalCodeAddress | null> {
  const neighborhood = input.neighborhood.trim();
  const city = input.city.trim();
  const state = input.state?.trim().toUpperCase() ?? "";
  if (neighborhood.length < 2 || city.length < 2) return null;

  const query = [neighborhood, city, state, "Brasil"].filter(Boolean).join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "BonattoPlatform/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const results = await response.json() as Array<{
      address?: {
        postcode?: string;
        road?: string;
        suburb?: string;
        neighbourhood?: string;
        city_district?: string;
        city?: string;
        town?: string;
        municipality?: string;
        "ISO3166-2-lvl4"?: string;
      };
    }>;

    for (const result of results) {
      const rawPostcode = result.address?.postcode ?? "";
      const cep = normalizeCep(rawPostcode);
      if (cep.length !== 8) continue;
      const canonical = await lookupPostalCode(cep);
      if (canonical) return canonical;

      const address = result.address ?? {};
      const isoState = address["ISO3166-2-lvl4"]?.split("-").pop()?.toUpperCase();
      return {
        cep,
        street: address.road ?? "",
        neighborhood: address.suburb ?? address.neighbourhood ?? address.city_district ?? neighborhood,
        city: address.city ?? address.town ?? address.municipality ?? city,
        state: isoState || state,
        provider: "viacep",
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function registerPostalCodeRoute(app: Express, limiter: RequestHandler) {
  app.get("/api/cep/:cep", limiter, async (req, res) => {
    const cep = normalizeCep(req.params.cep ?? "");
    if (!/^\d{8}$/.test(cep)) {
      return res.status(400).json({ error: "CEP inválido." });
    }

    const address = await lookupPostalCode(cep);
    if (!address) {
      return res.status(404).json({ error: "CEP não encontrado." });
    }

    res.setHeader("Cache-Control", "public, max-age=86400, stale-if-error=604800");
    return res.json(address);
  });

  app.get("/api/neighborhood-cep", limiter, async (req, res) => {
    const neighborhood = String(req.query.neighborhood ?? "").trim();
    const city = String(req.query.city ?? "").trim();
    const state = String(req.query.state ?? "").trim().toUpperCase();
    if (neighborhood.length < 2 || city.length < 2) {
      return res.status(400).json({ error: "Informe bairro e cidade." });
    }

    const address = await lookupNeighborhoodPostalCode({ neighborhood, city, state });
    if (!address) {
      return res.status(404).json({ error: "NÃ£o foi possÃ­vel identificar o CEP deste bairro." });
    }

    res.setHeader("Cache-Control", "public, max-age=86400, stale-if-error=604800");
    return res.json(address);
  });

}
