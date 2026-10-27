// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { KnowledgeManager } from "./knowledge-manager";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("knowledge indexing status", () => {
  it("shows keyword search without polling forever when semantics are disabled", async () => {
    const fetchMock = vi.fn(async () => Response.json({ documents: [{
      id: "fixture-document", name: "Fixture", byteSize: 20, characterCount: 20, chunkCount: 1,
      embeddedChunkCount: 0, status: "ready", embeddingStatus: "disabled", errorMessage: null,
      embeddingError: "语义索引服务未配置，仍可使用关键词检索。",
    }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KnowledgeManager initialKnowledgeBases={[{ id: "fixture-base", name: "Fixture", description: "",
      documentCount: 1, chunkCount: 1, semanticChunkCount: 0, updatedAt: new Date(0).toISOString() }]} />);
    expect(await screen.findByText("关键词检索", { selector: "em" })).toHaveAttribute("data-status", "ready");
    expect(screen.queryByText("语义索引中")).not.toBeInTheDocument();
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
