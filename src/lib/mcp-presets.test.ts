import { describe, expect, it } from "vitest";
import {
  getAvailableMcpTemplateIdsFromSources,
  MCP_PRESETS,
  resolveMcpTemplateId,
  summarizeMcpDependencySource,
} from "@/lib/mcp-presets";

describe("MCP template resolution", () => {
  const source = {
    id: "source-1",
    enabled: true,
    templateId: null,
    url: "https://mcp.exa.ai/mcp/",
    tools: [{}, {}],
    lastError: null,
  };

  it("prefers the explicit template and falls back to a known preset URL", () => {
    expect(resolveMcpTemplateId({ templateId: "github", url: "https://mcp.exa.ai/mcp" })).toBe("github");
    expect(resolveMcpTemplateId({ templateId: null, url: "https://mcp.exa.ai/mcp/" })).toBe("exa");
    expect(resolveMcpTemplateId({ templateId: null, url: "https://example.com/mcp" })).toBeNull();
  });

  it("only counts allowed, enabled, synced sources", () => {
    const summary = summarizeMcpDependencySource(source);
    expect([...getAvailableMcpTemplateIdsFromSources([summary], ["source-1"])]).toEqual(["exa"]);
    expect(getAvailableMcpTemplateIdsFromSources([summary], []).size).toBe(0);
    for (const broken of [
      { ...summary, enabled: false },
      { ...summary, toolCount: 0 },
      { ...summary, hasError: true },
    ]) {
      expect(getAvailableMcpTemplateIdsFromSources([broken], ["source-1"]).size).toBe(0);
    }
  });

  it("omits connection details from client-facing dependency status", () => {
    expect(summarizeMcpDependencySource({ ...source, lastError: "request failed" })).toEqual({
      id: "source-1", enabled: true, templateId: "exa", toolCount: 2, hasError: true,
    });
  });
});

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
