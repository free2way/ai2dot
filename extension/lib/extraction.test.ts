import { describe, expect, it } from "vitest";
import {
  composeMarkdownDocument,
  extractCapturedPage,
  markdownFileName,
} from "~/lib/extraction";
import type { ExtractedPage } from "~/lib/types";

describe("Markdown document composition", () => {
  const page: ExtractedPage = {
    version: 1,
    mode: "article",
    title: "A useful page",
    url: "https://example.com/article",
    canonicalUrl: null,
    siteName: "Example",
    author: "Lin",
    publishedAt: null,
    language: "en",
    excerpt: null,
    markdown: "Original body",
    characterCount: 13,
    extractedAt: "2026-09-24T00:00:00.000Z",
  };

  it("adds deterministic metadata and source", () => {
    const output = composeMarkdownDocument(page, "## Summary\n\nUseful.", "Model");
    expect(output).toContain('source: "https://example.com/article"');
    expect(output).toContain('summary_model: "Model"');
    expect(output).toContain("[原始页面](https://example.com/article)");
  });

  it("sanitizes download file names", () => {
    expect(markdownFileName('A/B: C*D? "E"')).toBe("A-B- C-D- -E-.md");
  });
});

describe("captured page extraction", () => {
  it("prefers a deliberate page selection and resolves relative links", () => {
    const extracted = extractCapturedPage(
      {
        title: "Fallback title",
        url: "https://example.com/guides/start",
        language: "zh-CN",
        html: "<html><body><main><h1>Full article</h1><p>This is the full page body with enough text for Readability.</p></main></body></html>",
        selectionHtml:
          '<h2>Selected section</h2><p>This selected paragraph contains the important content.</p><a href="/docs">Docs</a>',
        metadata: {
          canonicalUrl: "https://example.com/canonical",
          siteName: "Example",
          author: "Lin",
          publishedAt: "2026-09-24",
          description: "Description",
        },
      },
      10_000,
    );

    expect(extracted.mode).toBe("selection");
    expect(extracted.markdown).toContain("## Selected section");
    expect(extracted.markdown).toContain("https://example.com/docs");
    expect(extracted.canonicalUrl).toBe("https://example.com/canonical");
  });

  it("rejects content that exceeds the active model limit", () => {
    expect(() =>
      extractCapturedPage(
        {
          title: "Large page",
          url: "https://example.com/large",
          language: "en",
          html: `<html><body><article><p>${"word ".repeat(80)}</p></article></body></html>`,
          selectionHtml: null,
          metadata: {
            canonicalUrl: null,
            siteName: null,
            author: null,
            publishedAt: null,
            description: null,
          },
        },
        50,
      ),
    ).toThrow("页面正文超过");
  });
});
