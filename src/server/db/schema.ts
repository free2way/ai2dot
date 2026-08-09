import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
]);
export const messageRole = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
  "tool",
]);
export const messageStatus = pgEnum("message_status", [
  "pending",
  "streaming",
  "completed",
  "stopped",
  "failed",
]);
export const generationStatus = pgEnum("generation_status", [
  "pending",
  "streaming",
  "completed",
  "stopped",
  "failed",
  "unresolved",
]);
export const providerType = pgEnum("provider_type", [
  "gateway",
  "openai_compatible",
  "native",
]);
export const knowledgeDocumentStatus = pgEnum("knowledge_document_status", [
  "processing",
  "ready",
  "failed",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalAuthId: text("external_auth_id").notNull(),
    displayName: text("display_name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_external_auth_id_idx").on(table.externalAuthId)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

export const providerConnections = pgTable(
  "provider_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: providerType("type").notNull(),
    baseUrl: text("base_url"),
    encryptedSecret: text("encrypted_secret"),
    enabled: boolean("enabled").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("provider_connections_workspace_idx").on(table.workspaceId)],
);

export const models = pgTable(
  "models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => providerConnections.id, { onDelete: "cascade" }),
    providerModelId: text("provider_model_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    contextWindow: integer("context_window"),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    pricing: jsonb("pricing").$type<Record<string, string>>(),
    enabled: boolean("enabled").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("models_connection_provider_model_idx").on(
      table.connectionId,
      table.providerModelId,
    ),
  ],
);

export const assistants = pgTable(
  "assistants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    systemPrompt: text("system_prompt").notNull().default(""),
    defaultModelId: uuid("default_model_id").references(() => models.id),
    ...timestamps,
  },
  (table) => [index("assistants_workspace_idx").on(table.workspaceId)],
);

export const knowledgeBases = pgTable(
  "knowledge_bases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [index("knowledge_bases_workspace_idx").on(table.workspaceId)],
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeBaseId: uuid("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull().default("text/plain"),
    byteSize: integer("byte_size").notNull().default(0),
    characterCount: integer("character_count").notNull().default(0),
    status: knowledgeDocumentStatus("status").notNull().default("processing"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    index("knowledge_documents_base_updated_idx").on(
      table.knowledgeBaseId,
      table.updatedAt,
    ),
  ],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeBaseId: uuid("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_chunks_document_index_idx").on(
      table.documentId,
      table.chunkIndex,
    ),
    index("knowledge_chunks_base_idx").on(table.knowledgeBaseId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id").references(() => assistants.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("新对话"),
    summary: text("summary"),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("conversations_workspace_user_updated_idx").on(
      table.workspaceId,
      table.userId,
      table.updatedAt,
    ),
  ],
);

export const conversationBranches = pgTable(
  "conversation_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    parentBranchId: uuid("parent_branch_id"),
    forkedFromClientMessageId: text("forked_from_client_message_id"),
    name: text("name").notNull().default("主分支"),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("conversation_branches_conversation_idx").on(table.conversationId),
    uniqueIndex("conversation_branches_default_idx")
      .on(table.conversationId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientMessageId: text("client_message_id").notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => conversationBranches.id, {
      onDelete: "cascade",
    }),
    parentId: uuid("parent_id"),
    role: messageRole("role").notNull(),
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    modelSnapshot: jsonb("model_snapshot").$type<Record<string, unknown>>(),
    status: messageStatus("status").notNull().default("pending"),
    sequence: integer("sequence").notNull(),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("messages_branch_client_id_idx").on(
      table.branchId,
      table.clientMessageId,
    ),
    uniqueIndex("messages_branch_sequence_idx").on(table.branchId, table.sequence),
    index("messages_conversation_idx").on(table.conversationId),
    index("messages_parent_idx").on(table.parentId),
  ],
);

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => conversationBranches.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => models.id, {
      onDelete: "set null",
    }),
    providerModelId: text("provider_model_id").notNull(),
    status: generationStatus("status").notNull().default("pending"),
    responseMessage: jsonb("response_message").$type<Record<string, unknown>>(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("generations_workspace_idempotency_idx").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("generations_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("generations_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: text("request_id").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => models.id, {
      onDelete: "set null",
    }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 18, scale: 8 })
      .notNull()
      .default("0"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_events_request_id_idx").on(table.requestId),
    index("usage_events_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);
