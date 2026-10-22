import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

export const MAX_KNOWLEDGE_FILE_SIZE = 4 * 1024 * 1024;
export const MAX_PDF_PAGES = 200;

export type KnowledgeFileKind = "text" | "pdf" | "docx";

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json)$/i;
const PDF_EXTENSION = /\.pdf$/i;
const DOCX_EXTENSION = /\.docx$/i;

export function resolveKnowledgeFileKind(
  name: string,
  mimeType: string,
): KnowledgeFileKind | null {
  const normalizedType = mimeType.toLowerCase().split(";", 1)[0].trim();
  if (PDF_EXTENSION.test(name) || normalizedType === "application/pdf") {
    return "pdf";
  }
  if (
    DOCX_EXTENSION.test(name) ||
    normalizedType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    TEXT_EXTENSIONS.test(name) ||
    normalizedType.startsWith("text/") ||
    normalizedType === "application/json" ||
    normalizedType === "text/csv"
  ) {
    return "text";
  }
  return null;
}

export function sanitizeKnowledgeFileName(name: string) {
  return name
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function formatPdfPages(pages: string[]) {
  return pages
    .map((page, index) => {
      const content = page.trim();
      return content ? `--- 第 ${index + 1} 页 ---\n${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

async function extractPdfContent(bytes: Uint8Array) {
  if (
    bytes.length < 5 ||
    new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-"
  ) {
    throw new Error("PDF 文件格式不正确。");
  }
  const pdf = await getDocumentProxy(bytes);
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`PDF 不能超过 ${MAX_PDF_PAGES} 页。`);
  }
  const { text } = await extractText(pdf, { mergePages: false });
  return formatPdfPages(text);
}

const DOCX_MAX_ENTRIES = 2_000;
const DOCX_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;

/**
 * DOCX is a ZIP container. Check the central directory before handing it to
 * mammoth so a tiny compressed file cannot expand into a memory bomb.
 */
export function assertDocxArchiveBudget(bytes: Uint8Array) {
  if (bytes.length < 22) {
    throw new Error("DOCX 文件格式不正确。");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocdOffset = Math.max(0, bytes.length - 65_557);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= minEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("DOCX 文件格式不正确。");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  if (entryCount > DOCX_MAX_ENTRIES) {
    throw new Error("DOCX 包含的文件数量过多。");
  }

  let offset = view.getUint32(eocdOffset + 16, true);
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("DOCX 文件结构不正确。");
    }
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("暂不支持 ZIP64 格式的 DOCX。");
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > DOCX_MAX_UNCOMPRESSED_BYTES) {
      throw new Error("DOCX 解压后内容过大。");
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }
}

async function extractDocxContent(bytes: Uint8Array) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("DOCX 文件格式不正确。");
  }
  assertDocxArchiveBudget(bytes);
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value.trim();
}

export async function extractKnowledgeFileContent(input: {
  bytes: Uint8Array;
  kind: KnowledgeFileKind;
}) {
  if (input.kind === "pdf") return extractPdfContent(input.bytes);
  if (input.kind === "docx") return extractDocxContent(input.bytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(input.bytes).trim();
}
