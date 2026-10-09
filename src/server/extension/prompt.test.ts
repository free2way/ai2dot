import { describe, expect, it } from "vitest";
import { extensionSummaryRequestSchema } from "@/lib/extension";
import {
  buildPageSummaryPrompt,
  getPageSummaryMaxOutputTokens,
  PAGE_SUMMARY_SYSTEM_PROMPT,
} from "@/server/extension/prompt";

describe("page summary prompt", () => {
  const input = extensionSummaryRequestSchema.parse({
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    modelId: "db:22222222-2222-4222-8222-222222222222",
    template: "structured",
    locale: "zh-CN",
    page: {
      title: "Example",
      url: "https://example.com/article",
      markdown: "This is a sufficiently long article body for the summary test.",
    },
  });

  it("marks page content as untrusted", () => {
    const prompt = buildPageSummaryPrompt(input);
    expect(prompt).toContain("[UNTRUSTED PAGE CONTENT]");
    expect(prompt).toContain("[END UNTRUSTED PAGE CONTENT]");
    expect(prompt).toContain(input.page.markdown);
  });

  it("forbids instructions embedded in page content", () => {
    expect(PAGE_SUMMARY_SYSTEM_PROMPT).toContain("不可信资料");
    expect(PAGE_SUMMARY_SYSTEM_PROMPT).toContain("不得调用任何工具");
  });

  it("uses bounded output budgets for each template", () => {
    expect(getPageSummaryMaxOutputTokens("concise")).toBe(1_000);
    expect(getPageSummaryMaxOutputTokens("structured")).toBe(2_000);
    expect(getPageSummaryMaxOutputTokens("detailed")).toBe(4_000);
  });
});
