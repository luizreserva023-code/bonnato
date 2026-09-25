import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupNeighborhoodPostalCode, lookupPostalCode } from "./postalCode.ts";

describe("postal code lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses BrasilAPI data for CEP 35680000", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        cep: "35680000",
        state: "MG",
        city: "Itaúna",
        neighborhood: "Centro",
        street: "Rua Tiradentes",
      }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupPostalCode("35680-000")).resolves.toEqual({
      cep: "35680000",
      state: "MG",
      city: "Itaúna",
      neighborhood: "Centro",
      street: "Rua Tiradentes",
      provider: "brasilapi",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to ViaCEP when BrasilAPI does not resolve", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          cep: "30140071",
          logradouro: "Rua dos Aimorés",
          bairro: "Funcionários",
          localidade: "Belo Horizonte",
          uf: "MG",
        }), { status: 200, headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupPostalCode("30140-071");
    expect(result?.provider).toBe("viacep");
    expect(result?.city).toBe("Belo Horizonte");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolves a CEP from neighborhood, city and state", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{
          address: {
            postcode: "35680-000",
            suburb: "Centro",
            city: "ItaÃºna",
            "ISO3166-2-lvl4": "BR-MG",
          },
        }]), { status: 200, headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          cep: "35680000",
          state: "MG",
          city: "ItaÃºna",
          neighborhood: "Centro",
          street: "Rua Tiradentes",
        }), { status: 200, headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupNeighborhoodPostalCode({
      neighborhood: "Centro",
      city: "ItaÃºna",
      state: "MG",
    })).resolves.toEqual({
      cep: "35680000",
      state: "MG",
      city: "ItaÃºna",
      neighborhood: "Centro",
      street: "Rua Tiradentes",
      provider: "brasilapi",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed CEPs without external requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupPostalCode("123")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
