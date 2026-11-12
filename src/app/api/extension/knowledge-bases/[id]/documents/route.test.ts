import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listDocuments: vi.fn(),
  start: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/server/extension/auth", () => ({
  getChromeExtensionWorkspaceContext: mocks.auth,
  extensionAuthErrorResponse: (result: { code: string; message: string; status: number }) =>
    Response.json({ code: result.code, message: result.message }, { status: result.status }),
}));
vi.mock("@/server/knowledge/store", () => ({
  MAX_KNOWLEDGE_DOCUMENT_CHARACTERS: 500_000,
  listKnowledgeDocuments: mocks.listDocuments,
  createKnowledgeDocument: vi.fn(),
  failKnowledgeDocument: vi.fn(),
  indexKnowledgeDocument: vi.fn(),
}));
vi.mock("@/server/knowledge/ingest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/knowledge/ingest")>()),
  startKnowledgeIngestion: mocks.start,
}));

const { GET, POST } = await import("./route");

const context = { userId: "fixture-user", workspaceId: "fixture-workspace", role: "owner" };
const params = { params: Promise.resolve({ id: "base-1" }) };
const upload = () => {
  const body = new FormData();
  body.set("name", "page.md");
  body.set("content", "# Page");
  return new Request("http://fixture/api/extension/knowledge-bases/base-1/documents", { method: "POST", body });
};

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ ok: true, context });
  mocks.listDocuments.mockReset();
  mocks.start.mockReset();
  mocks.after.mockReset();
});

describe("extension knowledge upload route", () => {
  it("rejects requests that fail extension authentication", async () => {
    mocks.auth.mockResolvedValue({ ok: false, code: "EXTENSION_ORIGIN_FORBIDDEN", status: 403, message: "forbidden" });
    const response = await POST(upload(), params);
    expect(response.status).toBe(403);
    expect(mocks.start).not.toHaveBeenCalled();
    expect((await GET(new Request("http://fixture"), params)).status).toBe(403);
  });

  it("starts ingestion in the authenticated workspace", async () => {
    const run = vi.fn();
    mocks.start.mockResolvedValue({ document: { id: "doc-1" }, run });
    const response = await POST(upload(), params);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ document: { id: "doc-1", status: "processing" } });
    expect(mocks.start).toHaveBeenCalledWith(
      context, "base-1", expect.objectContaining({ mimeType: "text/markdown" }), "extension",
    );
    expect(mocks.after).toHaveBeenCalledWith(run);
  });

  it("returns 404 for knowledge bases outside the workspace", async () => {
    mocks.start.mockResolvedValue(null);
    expect((await POST(upload(), params)).status).toBe(404);
    mocks.listDocuments.mockResolvedValue(null);
    expect((await GET(new Request("http://fixture"), params)).status).toBe(404);
  });

  it("returns a minimal document status list", async () => {
    mocks.listDocuments.mockResolvedValue([{
      id: "doc-1", name: "page.md", status: "ready", errorMessage: null,
      embeddingStatus: "disabled", byteSize: 6, knowledgeBaseId: "base-1",
    }]);
    const response = await GET(new Request("http://fixture"), params);
    expect(await response.json()).toEqual({ documents: [{
      id: "doc-1", name: "page.md", status: "ready", errorMessage: null, embeddingStatus: "disabled",
    }] });
    expect(mocks.listDocuments).toHaveBeenCalledWith(context, "base-1");
  });
});
