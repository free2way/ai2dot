import { describe, expect, it } from "vitest";
import { buildNotebookSourceContext, MAX_NOTEBOOK_SOURCE_CHARACTERS, MAX_NOTEBOOK_SOURCE_CHUNKS } from "./source-context";

const chunk = { documentId: "fixture-a", documentName: "A", documentUpdatedAt: new Date(0), chunkIndex: 0, content: "First" };

describe("complete notebook source context", () => {
  it("preserves all source content and stable citation numbering", () => {
    const result = buildNotebookSourceContext([chunk, { ...chunk, chunkIndex: 1, content: "Second" },
      { ...chunk, documentId: "fixture-b", documentName: "B", content: "Last" }]);
    expect(result.sourceText).toBe("## 来源 1：A\nFirst\n\n## 来源 1：A\nSecond\n\n## 来源 2：B\nLast");
  });
  it("detects content changes even when timestamps are unchanged", () => {
    expect(buildNotebookSourceContext([chunk]).snapshotHash)
      .not.toBe(buildNotebookSourceContext([{ ...chunk, content: "Changed" }]).snapshotHash);
  });
  it("accepts exactly the chunk limit but rejects the extra sentinel row", () => {
    const rows = Array.from({ length: MAX_NOTEBOOK_SOURCE_CHUNKS }, (_, index) => ({ ...chunk, chunkIndex: index }));
    expect(buildNotebookSourceContext(rows).sourceText).toContain("First");
    expect(() => buildNotebookSourceContext([...rows, chunk])).toThrow("120");
  });
  it("counts headers in the character limit and never slices a source", () => {
    const headerLength = "## 来源 1：A\n".length;
    const boundary = { ...chunk, content: "x".repeat(MAX_NOTEBOOK_SOURCE_CHARACTERS - headerLength) };
    expect(buildNotebookSourceContext([boundary]).sourceText).toHaveLength(MAX_NOTEBOOK_SOURCE_CHARACTERS);
    expect(() => buildNotebookSourceContext([{ ...boundary, content: `${boundary.content}x` }])).toThrow("60,000");
  });
  it("returns an empty context when no source is ready", () => {
    expect(buildNotebookSourceContext([]).sourceText).toBe("");
  });
});
