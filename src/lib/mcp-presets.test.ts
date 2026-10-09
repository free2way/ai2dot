import { describe, expect, it } from "vitest";
import { MCP_PRESETS } from "@/lib/mcp-presets";

describe("MCP presets", () => {
  it("has unique identifiers and HTTPS documentation links", () => {
    expect(new Set(MCP_PRESETS.map((preset) => preset.id)).size).toBe(
      MCP_PRESETS.length,
    );
    for (const preset of MCP_PRESETS) {
      expect(new URL(preset.docsUrl).protocol).toBe("https:");
    }
  });

  it("only exposes presets that can be configured by endpoint and optional bearer key", () => {
    for (const preset of MCP_PRESETS) {
      if (preset.available) {
        expect(preset.auth).not.toBe("oauth");
        expect(new URL(preset.url ?? "").protocol).toBe("https:");
      }
      if (preset.auth === "bearer") {
        expect(preset.secretLabel).toBeTruthy();
        expect(preset.secretPlaceholder).toBeTruthy();
      }
      if (preset.auth === "oauth") {
        expect(preset.available).toBe(false);
      }
    }
  });
});
