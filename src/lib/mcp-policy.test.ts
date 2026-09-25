import { describe, expect, it } from "vitest";
import { classifyMcpToolRisk } from "./mcp-policy";

describe("classifyMcpToolRisk", () => {
  it("only treats explicitly read-only tools as safe to auto-approve", () => {
    expect(classifyMcpToolRisk({ readOnlyHint: true })).toBe("read");
    expect(classifyMcpToolRisk({ readOnlyHint: false })).toBe("write");
    expect(classifyMcpToolRisk({ destructiveHint: true, readOnlyHint: true })).toBe(
      "destructive",
    );
    expect(classifyMcpToolRisk()).toBe("unknown");
  });
});
