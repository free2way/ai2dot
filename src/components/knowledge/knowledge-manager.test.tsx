// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FeedbackProvider } from "@/lib/feedback";
import { KnowledgeManager } from "./knowledge-manager";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const fixtureBase = { id: "fixture-base", name: "Fixture", description: "",
  documentCount: 1, chunkCount: 1, semanticChunkCount: 0, updatedAt: new Date(0).toISOString() };
const failedEmbeddingDocument = {
  id: "fixture-document", name: "Fixture", byteSize: 20, characterCount: 20, chunkCount: 1,
  embeddedChunkCount: 0, status: "ready", embeddingStatus: "failed", errorMessage: null,
  embeddingError: "Embedding provider timeout",
};

describe("knowledge indexing status", () => {
  it("shows keyword search without polling forever when semantics are disabled", async () => {
    const fetchMock = vi.fn(async () => Response.json({ documents: [{
      id: "fixture-document", name: "Fixture", byteSize: 20, characterCount: 20, chunkCount: 1,
      embeddedChunkCount: 0, status: "ready", embeddingStatus: "disabled", errorMessage: null,
      embeddingError: "语义索引服务未配置，仍可使用关键词检索。",
    }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KnowledgeManager initialKnowledgeBases={[fixtureBase]} />);
    expect(await screen.findByText("关键词检索", { selector: "em" })).toHaveAttribute("data-status", "ready");
    expect(screen.queryByText("语义索引中")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /重新索引/ })).not.toBeInTheDocument();
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("labels embedding failures and re-queues them via the retry button", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ retried: true }, { status: 202 })
        : Response.json({ documents: [failedEmbeddingDocument] }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FeedbackProvider>
        <KnowledgeManager initialKnowledgeBases={[fixtureBase]} />
      </FeedbackProvider>,
    );
    expect(await screen.findByText("语义索引失败", { selector: "em" })).toHaveAttribute("data-status", "failed");
    fireEvent.click(screen.getByRole("button", { name: "重新索引 Fixture" }));
    expect(await screen.findByText("已重新加入语义索引队列。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/knowledge-bases/fixture-base/documents/fixture-document",
      { method: "POST" },
    );
  });

  it("only deletes a document after the confirm dialog is accepted", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Response.json({ deleted: true })
        : Response.json({ documents: [failedEmbeddingDocument] }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FeedbackProvider>
        <KnowledgeManager initialKnowledgeBases={[fixtureBase]} />
      </FeedbackProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "删除 Fixture" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("删除“Fixture”？");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "删除 Fixture" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true),
    );
  });
});
