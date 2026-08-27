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

async function extractDocxContent(bytes: Uint8Array) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("DOCX 文件格式不正确。");
  }
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
