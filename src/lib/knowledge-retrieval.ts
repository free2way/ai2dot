import type { KnowledgeSearchResult } from "@/lib/knowledge";

type KnowledgeCandidate = Omit<
  KnowledgeSearchResult,
  "keywordScore" | "retrievalMode" | "score" | "semanticScore"
>;

export type KeywordKnowledgeCandidate = KnowledgeCandidate & {
  keywordScore: number;
};

export type SemanticKnowledgeCandidate = KnowledgeCandidate & {
  semanticScore: number;
};

const RRF_K = 60;

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function rerankHybridKnowledgeResults(
  keywordCandidates: KeywordKnowledgeCandidate[],
  semanticCandidates: SemanticKnowledgeCandidate[],
  limit: number,
) {
  const candidates = new Map<
    string,
    KnowledgeCandidate & {
      keywordRank?: number;
      keywordScore?: number;
      semanticRank?: number;
      semanticScore?: number;
    }
  >();

  keywordCandidates.forEach((candidate, index) => {
    candidates.set(candidate.chunkId, {
      ...candidate,
      keywordRank: index + 1,
      keywordScore: candidate.keywordScore,
    });
  });
  semanticCandidates.forEach((candidate, index) => {
    const current = candidates.get(candidate.chunkId);
    candidates.set(candidate.chunkId, {
      ...(current ?? candidate),
      semanticRank: index + 1,
      semanticScore: candidate.semanticScore,
    });
  });

  const ranked = [...candidates.values()]
    .map((candidate) => {
      const reciprocalRank =
        (candidate.keywordRank ? 1 / (RRF_K + candidate.keywordRank) : 0) +
        (candidate.semanticRank ? 1 / (RRF_K + candidate.semanticRank) : 0);
      const normalizedRrf = reciprocalRank * (RRF_K + 1) / 2;
      const keywordScore = candidate.keywordScore ?? 0;
      const semanticScore = candidate.semanticScore ?? 0;
      const hasBoth = candidate.keywordRank && candidate.semanticRank;
      const signalScore = hasBoth
        ? keywordScore * 0.35 + semanticScore * 0.65
        : candidate.semanticRank
          ? semanticScore * 0.82
          : keywordScore * 0.82;
      const score = clampScore(signalScore + normalizedRrf * 0.18);

      return {
        chunkId: candidate.chunkId,
        documentId: candidate.documentId,
        documentName: candidate.documentName,
        mimeType: candidate.mimeType,
        knowledgeBaseId: candidate.knowledgeBaseId,
        knowledgeBaseName: candidate.knowledgeBaseName,
        content: candidate.content,
        score,
        retrievalMode: hasBoth
          ? "hybrid" as const
          : candidate.semanticRank
            ? "semantic" as const
            : "keyword" as const,
        ...(candidate.keywordRank ? { keywordScore } : {}),
        ...(candidate.semanticRank ? { semanticScore } : {}),
      } satisfies KnowledgeSearchResult;
    })
    .sort((left, right) => right.score - left.score);

  const selected: KnowledgeSearchResult[] = [];
  const perDocument = new Map<string, number>();
  for (const candidate of ranked) {
    const count = perDocument.get(candidate.documentId) ?? 0;
    if (count >= 2) continue;
    selected.push(candidate);
    perDocument.set(candidate.documentId, count + 1);
    if (selected.length >= Math.min(limit, 10)) break;
  }
  return selected;
}
