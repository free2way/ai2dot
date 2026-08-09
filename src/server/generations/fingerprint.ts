import { createHash } from "node:crypto";
import type { UIMessage } from "ai";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function fingerprintGenerationRequest(input: {
  conversationId: string;
  branchId: string;
  modelId: string;
  messages: UIMessage[];
}) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

