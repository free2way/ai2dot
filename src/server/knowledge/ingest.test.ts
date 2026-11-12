import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/knowledge/store", () => ({
  MAX_KNOWLEDGE_DOCUMENT_CHARACTERS: 500_000,
  createKnowledgeDocument: vi.fn(),
  failKnowledgeDocument: vi.fn(),
  indexKnowledgeDocument: vi.fn(),
}));
vi.mock("@/server/knowledge/embedding-jobs", () => ({ processKnowledgeEmbeddingJobs: vi.fn() }));

const { prepareKnowledgeUpload, isKnowledgeRequestTooLarge } = await import("./ingest");

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("knowledge upload preparation", () => {
  it("stores pasted Markdown as text/markdown with a sanitized name", async () => {
    const upload = await prepareKnowledgeUpload(form({ name: " a/b\u0001 note.md ", content: "# Title" }));
    expect(upload).toMatchObject({ ok: true, name: "a_b_ note.md", mimeType: "text/markdown", content: "# Title" });
  });

  it("keeps plain pasted text as text/plain", async () => {
    expect(await prepareKnowledgeUpload(form({ name: "notes", content: "body" }))).toMatchObject({ ok: true, mimeType: "text/plain" });
  });

  it("rejects missing fields, oversized text and unsupported files", async () => {
    expect(await prepareKnowledgeUpload(form({ name: "only-name" }))).toMatchObject({ ok: false, status: 400, code: "INVALID_DOCUMENT" });
    expect(await prepareKnowledgeUpload(form({ name: "big.md", content: "x".repeat(500_001) }))).toMatchObject({ ok: false, status: 413 });
    const binary = new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" });
    expect(await prepareKnowledgeUpload(form({ file: binary }))).toMatchObject({ ok: false, status: 415, code: "UNSUPPORTED_FILE_TYPE" });
  });

  it("reads a supported file upload", async () => {
    const file = new File(["hello"], "readme.md", { type: "" });
    const upload = await prepareKnowledgeUpload(form({ file }));
    expect(upload).toMatchObject({ ok: true, name: "readme.md", byteSize: 5 });
    expect(upload.ok && upload.fileBytes?.byteLength).toBe(5);
  });

  it("detects declared oversized requests", () => {
    const request = (length: string) => new Request("http://fixture", { method: "POST", headers: { "content-length": length }, body: "x" });
    expect(isKnowledgeRequestTooLarge(request(String(6 * 1024 * 1024)))).toBe(true);
    expect(isKnowledgeRequestTooLarge(request("10"))).toBe(false);
  });
});
