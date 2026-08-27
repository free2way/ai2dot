import type { SourceDocumentUIPart, UIMessage } from "ai";
import type { KnowledgeSearchResult } from "@/lib/knowledge";

export function createKnowledgeSourceParts(
  results: KnowledgeSearchResult[],
): SourceDocumentUIPart[] {
  const documents = new Map<string, KnowledgeSearchResult>();
  for (const result of results) {
    if (!documents.has(result.documentId)) {
      documents.set(result.documentId, result);
    }
  }
  return [...documents.values()].map((result) => ({
    type: "source-document",
    sourceId: `knowledge:${result.documentId}`,
    mediaType: result.mimeType,
    title: result.documentName,
    filename: result.documentName,
  }));
}

export function getKnowledgeSourceParts(message: UIMessage) {
  return message.parts.filter(
    (part): part is SourceDocumentUIPart =>
      part.type === "source-document" &&
      part.sourceId.startsWith("knowledge:"),
  );
}
