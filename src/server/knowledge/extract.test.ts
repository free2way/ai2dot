import { describe, expect, it } from "vitest";
import {
  formatPdfPages,
  resolveKnowledgeFileKind,
  sanitizeKnowledgeFileName,
} from "./extract";

describe("knowledge file extraction", () => {
  it("recognizes supported document formats", () => {
    expect(resolveKnowledgeFileKind("guide.pdf", "")).toBe("pdf");
    expect(resolveKnowledgeFileKind("guide.docx", "application/octet-stream")).toBe(
      "docx",
    );
    expect(resolveKnowledgeFileKind("notes.md", "text/markdown")).toBe("text");
    expect(resolveKnowledgeFileKind("archive.zip", "application/zip")).toBeNull();
  });

  it("keeps PDF page boundaries for later citations", () => {
    expect(formatPdfPages(["第一页", "", "第三页"])).toBe(
      "--- 第 1 页 ---\n第一页\n\n--- 第 3 页 ---\n第三页",
    );
  });

  it("removes path separators and control characters from file names", () => {
    expect(sanitizeKnowledgeFileName("../操作\u0000手册.pdf")).toBe(".._操作_手册.pdf");
  });
});
