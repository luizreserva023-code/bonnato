import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_DOCUMENT, DEFAULT_SITE_THEME, SITE_BLOCK_TYPES, createSiteBlock, parseSiteDocument } from "./siteBuilder";

describe("siteBuilder", () => {
  it("cria apenas blocos registrados no renderer", () => {
    for (const type of SITE_BLOCK_TYPES) {
      const block = createSiteBlock(type, `test-${type}`);
      expect(block.type).toBe(type);
      expect(block.visible).toBe(true);
      expect(block.style.spacing).toBe("normal");
    }
  });

  it("usa documento seguro quando o conteúdo é inválido", () => {
    expect(parseSiteDocument(null)).toEqual(DEFAULT_HOME_DOCUMENT);
    expect(parseSiteDocument({ schemaVersion: 2, blocks: [] })).toEqual(DEFAULT_HOME_DOCUMENT);
  });

  it("descarta blocos desconhecidos", () => {
    const parsed = parseSiteDocument({
      schemaVersion: 1,
      blocks: [createSiteBlock("hero", "hero-safe"), { id: "script", type: "custom-script" }],
    });
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].id).toBe("hero-safe");
    expect(parsed.theme).toEqual(DEFAULT_SITE_THEME);
  });

  it("preserva o tema global e completa campos antigos", () => {
    const parsed = parseSiteDocument({
      schemaVersion: 1,
      theme: { primary: "#111111", buttonStyle: "square" },
      blocks: [],
    });
    expect(parsed.theme.primary).toBe("#111111");
    expect(parsed.theme.buttonStyle).toBe("square");
    expect(parsed.theme.accent).toBe(DEFAULT_SITE_THEME.accent);
  });

  it("completa ajustes responsivos em documentos antigos", () => {
    const parsed = parseSiteDocument({
      schemaVersion: 1,
      blocks: [{ ...createSiteBlock("hero", "legacy-hero"), responsive: undefined }],
    });

    expect(parsed.blocks[0].responsive).toEqual({ desktop: {}, tablet: {}, mobile: {} });
  });

  it("preserva visibilidade e espaçamento por dispositivo", () => {
    const block = createSiteBlock("promotions", "responsive-promotions");
    block.responsive = { mobile: { spacing: "compact", hidden: true } };
    const parsed = parseSiteDocument({ schemaVersion: 1, blocks: [block] });

    expect(parsed.blocks[0].responsive?.mobile).toEqual({ spacing: "compact", hidden: true });
  });
});
