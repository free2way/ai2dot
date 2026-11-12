import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizePage, uploadMarkdown, waitForKnowledgeDocument } from "./api-client";
import type { ExtractedPage } from "./types";

afterEach(() => vi.unstubAllGlobals());
const summarize = (onDelta = vi.fn()) => summarizePage({
  token: "synthetic-credential", modelId: "fixture-model", template: "structured",
  page: { title: "Fixture", url: "https://example.com/fixture", markdown: "Fixture page" } as ExtractedPage,
  signal: new AbortController().signal, onDelta,
});
function mockResponse(text: string, framed = true, splitBytes = false) {
  const bytes = new TextEncoder().encode(text);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) {
    if (splitBytes) for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    else controller.enqueue(bytes);
    controller.close();
  } }), { headers: { "content-type": framed ? "application/x-ndjson" : "text/plain" } })));
}
describe("summary completion and failure", () => {
  it("decodes fragmented JSON and UTF-8 and returns only completed output", async () => {
    mockResponse('{"type":"delta","text":"中文\\nSummary"}\n{"type":"done"}\n', true, true);
    const onDelta = vi.fn();
    await expect(summarize(onDelta)).resolves.toBe("中文\nSummary");
    expect(onDelta).toHaveBeenLastCalledWith("中文\nSummary");
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ accept: "application/x-ndjson" });
  });
  it("rejects a server error after partial text", async () => {
    mockResponse('{"type":"delta","text":"Partial"}\n{"type":"error","message":"private details"}\n');
    await expect(summarize()).rejects.toMatchObject({ code: "SUMMARY_FAILED" });
  });
  it.each([
    '{"type":"delta","text":"Partial"}\n',
    '{"type":"delta","text":"Partial"}\n{"type":"done"}',
    '{"type":"done"}\n',
    '{"type":"unexpected"}\n',
    'not-json\n',
  ])("rejects incomplete, empty or malformed streams %#", async (text) => {
    mockResponse(text);
    await expect(summarize()).rejects.toThrow();
  });
  it("supports old successful plain-text servers", async () => {
    mockResponse("Legacy summary", false);
    await expect(summarize()).resolves.toBe("Legacy summary");
  });
  it("rejects empty legacy output", async () => {
    mockResponse("   ", false);
    await expect(summarize()).rejects.toMatchObject({ code: "INCOMPLETE_RESPONSE" });
  });
  it("rejects HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "RATE_LIMITED", message: "Retry later" }, { status: 429 })));
    await expect(summarize()).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });
});
describe("knowledge upload endpoints", () => {
  it("uploads and polls through the extension-authenticated API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ document: { id: "doc-1", status: "processing" } }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ documents: [{ id: "doc-1", status: "ready", errorMessage: null }] }));
    vi.stubGlobal("fetch", fetchMock);
    const uploaded = await uploadMarkdown({ token: "synthetic-credential", knowledgeBaseId: "base-1", name: "page.md", content: "# Page" });
    await waitForKnowledgeDocument({ token: "synthetic-credential", knowledgeBaseId: "base-1", documentId: uploaded.document.id });
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/\/api\/extension\/knowledge-bases\/base-1\/documents$/);
      expect(init.headers).toMatchObject({ Authorization: "Bearer synthetic-credential" });
    }
  });
});

