import { describe, expect, it } from "vitest";
import {
  HELP_TOPICS,
  resolveAdminActionHelp,
  searchAdminHelp,
} from "@/help/adminHelpCatalog";

describe("admin help catalog", () => {
  it("prioritizes an explicit help id", () => {
    expect(resolveAdminActionHelp({
      helpId: "orders.cancel",
      label: "Qualquer texto",
      activeTab: "orders",
    })?.id).toBe("orders.cancel");
  });

  it("resolves order advancement by its dynamic label", () => {
    expect(resolveAdminActionHelp({
      label: "Avançar para: Preparando",
      activeTab: "orders",
    })?.id).toBe("orders.advance");
  });

  it("resolves generic save actions while preserving the visible label", () => {
    const topic = resolveAdminActionHelp({
      label: "Salvar recompensa",
      activeTab: "rewards",
    });
    expect(topic?.id).toBe("common.save");
    expect(topic?.title).toBe("Salvar recompensa");
  });

  it("resolves screen navigation labels", () => {
    expect(resolveAdminActionHelp({
      label: "Pedidos",
      activeTab: "dashboard",
    })?.id).toBe("screen.orders");
  });

  it("finds carousel documentation through search", () => {
    const ids = searchAdminHelp("carrossel").map((topic) => topic.id);
    expect(ids).toContain("menu.carousel.destination");
    expect(ids).toContain("menu.carousel.image");
  });

  it("keeps key tutorial-linked topics available", () => {
    expect(HELP_TOPICS["orders.confirmPix"].relatedTutorialId).toBe("orders");
    expect(HELP_TOPICS["catalog.replicate"].relatedTutorialId).toBe("catalog");
  });
});
