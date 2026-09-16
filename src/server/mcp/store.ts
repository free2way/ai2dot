import "server-only";

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { mcpSources, type McpToolSummary } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import { assertSafeProviderBaseUrl } from "@/server/providers/catalog";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "@/server/providers/secret";

export type McpSourceSummary = {
  id: string;
  name: string;
  description: string | null;
  transport: "http" | "sse";
  url: string;
  enabled: boolean;
  secretConfigured: boolean;
  tools: McpToolSummary[];
  lastSyncedAt: Date | null;
  lastError: string | null;
};

function toSummary(source: typeof mcpSources.$inferSelect): McpSourceSummary {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    transport: source.transport,
    url: source.url,
    enabled: source.enabled,
    secretConfigured: Boolean(source.encryptedSecret),
    tools: source.tools ?? [],
    lastSyncedAt: source.lastSyncedAt,
    lastError: source.lastError,
  };
}

export async function listMcpSources(
  context: WorkspaceContext,
): Promise<McpSourceSummary[]> {
  const rows = await getDb()
    .select()
    .from(mcpSources)
    .where(eq(mcpSources.workspaceId, context.workspaceId))
    .orderBy(desc(mcpSources.updatedAt));
  return rows.map(toSummary);
}

async function getOwnedSource(context: WorkspaceContext, sourceId: string) {
  const [source] = await getDb()
    .select()
    .from(mcpSources)
    .where(
      and(
        eq(mcpSources.id, sourceId),
        eq(mcpSources.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  return source ?? null;
}

export async function createMcpSource(
  context: WorkspaceContext,
  input: {
    name: string;
    description?: string;
    transport: "http" | "sse";
    url: string;
    secret?: string;
  },
) {
  await assertSafeProviderBaseUrl(input.url);
  const encryptedSecret = input.secret
    ? await encryptProviderSecret(input.secret)
    : null;
  const [source] = await getDb()
    .insert(mcpSources)
    .values({
      workspaceId: context.workspaceId,
      name: input.name,
      description: input.description || null,
      transport: input.transport,
      url: input.url,
      encryptedSecret,
    })
    .returning();
  return source ? toSummary(source) : null;
}

export async function updateMcpSource(
  context: WorkspaceContext,
  sourceId: string,
  input: {
    name: string;
    description?: string;
    transport: "http" | "sse";
    url: string;
    secret?: string;
    enabled: boolean;
  },
) {
  await assertSafeProviderBaseUrl(input.url);
  const source = await getOwnedSource(context, sourceId);
  if (!source) return null;

  const encryptedSecret = input.secret
    ? await encryptProviderSecret(input.secret)
    : undefined;
  const [updated] = await getDb()
    .update(mcpSources)
    .set({
      name: input.name,
      description: input.description || null,
      transport: input.transport,
      url: input.url,
      enabled: input.enabled,
      ...(encryptedSecret ? { encryptedSecret } : {}),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(mcpSources.id, sourceId))
    .returning();
  return updated ? toSummary(updated) : null;
}

export async function deleteMcpSource(
  context: WorkspaceContext,
  sourceId: string,
) {
  const [deleted] = await getDb()
    .delete(mcpSources)
    .where(
      and(
        eq(mcpSources.id, sourceId),
        eq(mcpSources.workspaceId, context.workspaceId),
      ),
    )
    .returning({ id: mcpSources.id });
  return deleted ?? null;
}

async function connectSource(source: typeof mcpSources.$inferSelect) {
  const secret = source.encryptedSecret
    ? await decryptProviderSecret(source.encryptedSecret)
    : undefined;
  const client = await createMCPClient({
    transport: {
      type: source.transport,
      url: source.url,
      ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}),
    },
    maxRetries: 1,
    initializationOptions: { timeout: 15_000 },
    clientName: "ai2dot",
    version: "0.1.0",
  });
  return client;
}

export async function syncMcpSource(
  context: WorkspaceContext,
  sourceId: string,
) {
  const source = await getOwnedSource(context, sourceId);
  if (!source) return null;

  let client: MCPClient | undefined;
  try {
    client = await connectSource(source);
    const listed = await client.listTools({ options: { timeout: 15_000 } });
    const tools: McpToolSummary[] = listed.tools.map((tool) => ({
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
    }));
    const [updated] = await getDb()
      .update(mcpSources)
      .set({ tools, lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(mcpSources.id, sourceId))
      .returning();
    return updated ? toSummary(updated) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP 连接失败。";
    await getDb()
      .update(mcpSources)
      .set({ lastError: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(mcpSources.id, sourceId));
    throw new Error(message);
  } finally {
    await client?.close().catch(() => undefined);
  }
}

/**
 * Creates one short-lived client per source so MCP tool calls stay isolated
 * by workspace and do not leak credentials across requests.
 */
export async function getEnabledMcpTools(context: WorkspaceContext) {
  const sources = await getDb()
    .select()
    .from(mcpSources)
    .where(
      and(
        eq(mcpSources.workspaceId, context.workspaceId),
        eq(mcpSources.enabled, true),
      ),
    );
  const clients: MCPClient[] = [];
  const toolSets: ToolSet = {};

  for (const source of sources) {
    let client: MCPClient | undefined;
    try {
      client = await connectSource(source);
      const tools = await client.tools();
      clients.push(client);
      for (const [name, tool] of Object.entries(tools)) {
        toolSets[
          `mcp_${source.id.replaceAll("-", "").slice(0, 8)}_${name}`
        ] = tool as ToolSet[string];
      }
    } catch (error) {
      // A single unavailable source should not take down ordinary chat.
      console.warn("[mcp] source unavailable", source.id, error);
      await client?.close().catch(() => undefined);
    }
  }

  return {
    tools: toolSets,
    close: async () => {
      await Promise.all(clients.map((client) => client.close().catch(() => undefined)));
    },
  };
}
