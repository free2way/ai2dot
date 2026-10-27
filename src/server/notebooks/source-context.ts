import { createHash } from "node:crypto";

export const MAX_NOTEBOOK_SOURCE_CHUNKS = 120;
export const MAX_NOTEBOOK_SOURCE_CHARACTERS = 60_000;

type SourceChunk = {
  documentId: string;
  documentName: string;
  documentUpdatedAt: Date;
  chunkIndex: number;
  content: string;
};

export function buildNotebookSourceContext(rows: SourceChunk[]) {
  if (rows.length > MAX_NOTEBOOK_SOURCE_CHUNKS) {
    throw new Error("来源超过单次生成上限（120 个片段），请将资料拆分到多个研究空间后重试；本次未调用模型。");
  }
  const sourceNumbers = new Map<string, number>();
  const excerpts: string[] = [];
  let usedCharacters = 0;
  for (const row of rows) {
    const sourceNumber = sourceNumbers.get(row.documentId) ?? sourceNumbers.size + 1;
    sourceNumbers.set(row.documentId, sourceNumber);
    const excerpt = `## 来源 ${sourceNumber}：${row.documentName}\n${row.content}`;
    usedCharacters += excerpt.length + (excerpts.length > 0 ? 2 : 0);
    if (usedCharacters > MAX_NOTEBOOK_SOURCE_CHARACTERS) {
      throw new Error("来源超过单次生成上限（60,000 字符，含来源标题），请减少资料或拆分研究空间后重试；本次未调用模型。");
    }
    excerpts.push(excerpt);
  }
  return {
    sourceText: excerpts.join("\n\n"),
    snapshotHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
  };
}
