import "server-only";

import { and, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { getDb } from "@/server/db";
import { mcpToolAuditLogs } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import type { ExposedMcpTool } from "@/server/mcp/store";

const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[-_]?key)/i;

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof value === "string") return value.slice(0, 1_000);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(item, depth + 1),
        ]),
    );
  }
  return value;
}

function summarize(value: unknown) {
  try {
    return JSON.stringify(redactValue(value)).slice(0, 2_000);
  } catch {
    return "[UNSERIALIZABLE]";
  }
}

type AuditContext = {
  workspace: WorkspaceContext;
  conversationId?: string;
  generationId?: string;
};

export async function recordToolApprovalRequest({
  context,
  approvalId,
  toolCallId,
  toolName,
  input,
  metadata,
}: {
  context: AuditContext;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  metadata: ExposedMcpTool;
}) {
  await getDb()
    .insert(mcpToolAuditLogs)
    .values({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      conversationId: context.conversationId,
      generationId: context.generationId,
      mcpSourceId: metadata.sourceId,
      approvalId,
      toolCallId,
      toolName,
      risk: metadata.risk,
      status: metadata.risk === "read" ? "approved" : "requested",
      input: redactValue(input),
      ...(metadata.risk === "read"
        ? { approvedByUserId: context.workspace.userId }
        : {}),
    })
    .onConflictDoUpdate({
      target: [mcpToolAuditLogs.workspaceId, mcpToolAuditLogs.toolCallId],
      set: {
        approvalId,
        generationId: context.generationId,
        input: redactValue(input),
        updatedAt: new Date(),
      },
    });
}

export async function recordApprovalResponses(
  context: WorkspaceContext,
  messages: UIMessage[],
) {
  for (const message of messages) {
    for (const part of message.parts) {
      const toolPart = part as unknown as {
        type: string;
        state?: string;
        approval?: { id: string; approved: boolean };
      };
      if (
        !(toolPart.type === "dynamic-tool" || toolPart.type.startsWith("tool-")) ||
        toolPart.state !== "approval-responded" ||
        !toolPart.approval
      ) continue;
      await getDb()
        .update(mcpToolAuditLogs)
        .set({
          status: toolPart.approval.approved ? "approved" : "denied",
          approvedByUserId: context.userId,
          completedAt: toolPart.approval.approved ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mcpToolAuditLogs.workspaceId, context.workspaceId),
            eq(mcpToolAuditLogs.userId, context.userId),
            eq(mcpToolAuditLogs.approvalId, toolPart.approval.id),
            eq(mcpToolAuditLogs.status, "requested"),
          ),
        );
    }
  }
}

export async function markToolExecutionStarted(
  context: AuditContext,
  toolCall: { toolCallId: string; toolName: string; input: unknown },
  metadata: ExposedMcpTool,
) {
  await getDb()
    .insert(mcpToolAuditLogs)
    .values({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      conversationId: context.conversationId,
      generationId: context.generationId,
      mcpSourceId: metadata.sourceId,
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      risk: metadata.risk,
      status: "running",
      input: redactValue(toolCall.input),
      startedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mcpToolAuditLogs.workspaceId, mcpToolAuditLogs.toolCallId],
      set: {
        status: "running",
        generationId: context.generationId,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

export async function markToolExecutionFinished({
  context,
  toolCallId,
  output,
  error,
}: {
  context: WorkspaceContext;
  toolCallId: string;
  output?: unknown;
  error?: unknown;
}) {
  await getDb()
    .update(mcpToolAuditLogs)
    .set({
      status: error === undefined ? "succeeded" : "failed",
      outputSummary: output === undefined ? null : summarize(output),
      errorMessage: error === undefined ? null : summarize(error),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mcpToolAuditLogs.workspaceId, context.workspaceId),
        eq(mcpToolAuditLogs.toolCallId, toolCallId),
      ),
    );
}
