export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export async function lookupCep(rawCep: string): Promise<CepAddress | null> {
  const cep = rawCep.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) return null;

  const response = await fetch(`/api/cep/${cep}`, {
    method: "GET",
    headers: { accept: "application/json" },
    credentials: "same-origin",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP agora.");
  }

  const data = await response.json() as Partial<CepAddress>;
  if (!data.city || !data.state) return null;

  return {
    cep,
    street: data.street ?? "",
    neighborhood: data.neighborhood ?? "",
    city: data.city,
    state: data.state,
  };
}

export async function lookupNeighborhoodCep(input: {
  neighborhood: string;
  city: string;
  state?: string;
}): Promise<CepAddress | null> {
  const neighborhood = input.neighborhood.trim();
  const city = input.city.trim();
  if (neighborhood.length < 2 || city.length < 2) return null;

  const params = new URLSearchParams({ neighborhood, city });
  if (input.state?.trim()) params.set("state", input.state.trim().toUpperCase());

  const response = await fetch("/api/neighborhood-cep?" + params.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    credentials: "same-origin",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("NÃ£o foi possÃ­vel identificar o CEP deste bairro agora.");
  }

  const data = await response.json() as Partial<CepAddress>;
  if (!data.cep || !data.city || !data.state) return null;
  return {
    cep: data.cep.replace(/\D/g, ""),
    street: data.street ?? "",
    neighborhood: data.neighborhood ?? neighborhood,
    city: data.city,
    state: data.state,
  };
}
