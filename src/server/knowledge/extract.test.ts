import { describe, expect, it } from "vitest";
import {
  assertDocxArchiveBudget,
  formatPdfPages,
  resolveKnowledgeFileKind,
  sanitizeKnowledgeFileName,
} from "./extract";

function buildZipDirectory(entries: number, uncompressedSize: number) {
  const name = "a";
  const entrySize = 46 + name.length;
  const centralSize = entrySize * entries;
  const buffer = new Uint8Array(centralSize + 22);
  const view = new DataView(buffer.buffer);

  for (let index = 0; index < entries; index += 1) {
    const offset = index * entrySize;
    view.setUint32(offset, 0x02014b50, true);
    view.setUint32(offset + 20, 10, true);
    view.setUint32(offset + 24, uncompressedSize, true);
    view.setUint16(offset + 28, name.length, true);
  }

  const eocd = centralSize;
  view.setUint32(eocd, 0x06054b50, true);
  view.setUint16(eocd + 8, entries, true);
  view.setUint16(eocd + 10, entries, true);
  view.setUint32(eocd + 12, centralSize, true);
  view.setUint32(eocd + 16, 0, true);
  return buffer;
}

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

  it("accepts a DOCX archive within the decompression budget", () => {
    expect(() => assertDocxArchiveBudget(buildZipDirectory(3, 1_024))).not.toThrow();
  });

  it("rejects DOCX bombs and archives with too many entries", () => {
    expect(() =>
      assertDocxArchiveBudget(buildZipDirectory(1, 33 * 1024 * 1024)),
    ).toThrow("过大");
    expect(() => assertDocxArchiveBudget(buildZipDirectory(2_001, 1))).toThrow(
      "数量过多",
    );
    expect(() => assertDocxArchiveBudget(new Uint8Array(4))).toThrow();
  });
});
