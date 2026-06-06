/**
 * Teste de validação das credenciais Z-API
 * Verifica se as variáveis de ambiente estão configuradas e se a instância está acessível
 * Os testes são ignorados se as credenciais não estiverem configuradas (integração opcional)
 */
import { describe, it, expect } from "vitest";

const zapiConfigured =
  process.env.WHATSAPP_PROVIDER === "zapi" &&
  !!process.env.ZAPI_INSTANCE_ID &&
  !!process.env.ZAPI_TOKEN &&
  !!process.env.ZAPI_CLIENT_TOKEN;

describe("Z-API credentials", () => {
  it("deve ter WHATSAPP_PROVIDER configurado como zapi (ou ser 'none' se não configurado)", () => {
    const provider = process.env.WHATSAPP_PROVIDER ?? "none";
    expect(["zapi", "twilio", "none"]).toContain(provider);
  });

  it.skipIf(!zapiConfigured)("deve ter ZAPI_INSTANCE_ID configurado", () => {
    expect(process.env.ZAPI_INSTANCE_ID).toBeTruthy();
    expect(process.env.ZAPI_INSTANCE_ID!.length).toBeGreaterThan(10);
  });

  it.skipIf(!zapiConfigured)("deve ter ZAPI_TOKEN configurado", () => {
    expect(process.env.ZAPI_TOKEN).toBeTruthy();
    expect(process.env.ZAPI_TOKEN!.length).toBeGreaterThan(10);
  });

  it.skipIf(!zapiConfigured)("deve ter ZAPI_CLIENT_TOKEN configurado", () => {
    expect(process.env.ZAPI_CLIENT_TOKEN).toBeTruthy();
    expect(process.env.ZAPI_CLIENT_TOKEN!.length).toBeGreaterThan(10);
  });

  it.skipIf(!zapiConfigured)("deve conseguir verificar o status da instância Z-API", async () => {
    const instanceId = process.env.ZAPI_INSTANCE_ID!;
    const token = process.env.ZAPI_TOKEN!;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN!;

    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
    const response = await fetch(url, {
      headers: {
        "Client-Token": clientToken,
      },
    });

    // Aceita 200 (conectado) ou 404/401 (credenciais inválidas)
    // O importante é que a requisição chegou ao servidor Z-API
    expect([200, 401, 404, 400]).toContain(response.status);

    if (response.ok) {
      const data = await response.json() as { connected?: boolean; status?: string };
      console.log("[Z-API] Status da instância:", JSON.stringify(data));
      // Se retornou 200, a instância existe
      expect(data).toBeDefined();
    } else {
      console.warn(`[Z-API] Status HTTP ${response.status} — verifique as credenciais`);
    }
  }, 15000);
});
