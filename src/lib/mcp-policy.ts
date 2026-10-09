export type McpToolRisk = "read" | "write" | "destructive" | "unknown";

export function classifyMcpToolRisk(annotations?: {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}): McpToolRisk {
  if (annotations?.destructiveHint === true) return "destructive";
  if (annotations?.readOnlyHint === true) return "read";
  if (annotations?.readOnlyHint === false) return "write";
  return "unknown";
}
