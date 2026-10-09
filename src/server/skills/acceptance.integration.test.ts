import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { MockLanguageModelV4 } from "ai/test";
import type { WorkspaceContext } from "@/server/db/workspace";
import type { SkillSelection } from "@/lib/skill-selection";
import type { AssistantInput } from "@/lib/assistants";
import { getDb } from "@/server/db";
import { assistants, skills, skillVersions, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { createAssistant, getAssistant, updateAssistant } from "@/server/assistants/store";
import { createConversation, getConversation, getEffectiveBranchSkillSelection, updateConversationBranchSkillSelection } from "@/server/chat/store";
import { beginGeneration, getGenerationSkillDetails } from "@/server/generations/store";
import { createSkill, deleteSkill, installCatalogSkill, listSkills, resolveExplicitSkillVersions, updateSkill } from "./store";
import { resolveSkillsForGeneration } from "./resolve";
import { POST } from "@/app/api/chat/route";

const mocks = vi.hoisted(() => ({
  context: null as WorkspaceContext | null,
  resolveModel: vi.fn(),
}));
vi.mock("@/server/db/workspace", () => ({
  getWorkspaceContext: async () => mocks.context,
  isPersistenceConfigured: () => true,
}));
vi.mock("@/server/providers/store", () => ({ resolveChatModel: mocks.resolveModel }));
vi.mock("@/server/knowledge/store", () => ({ searchKnowledge: async () => [] }));
vi.mock("@/server/mcp/store", () => ({ getEnabledMcpTools: async () => null }));

// This suite can only use an explicitly named, separate test database.
const testDatabaseName = process.env.AI2DOT_SKILL_TEST_DATABASE;
const enabled = Boolean(testDatabaseName);
let contextA: WorkspaceContext;
let contextB: WorkspaceContext;
let firstSkill: Awaited<ReturnType<typeof createSkill>>;
let upgradedSkill: Awaited<ReturnType<typeof updateSkill>>;
let model: MockLanguageModelV4;
let assistantId: string;
let oldConversation: NonNullable<Awaited<ReturnType<typeof createConversation>>>;
let chat: NonNullable<Awaited<ReturnType<typeof createConversation>>>;
let generationId: string;
let requestBody: Record<string, unknown>;

const selection = (skill: typeof firstSkill): SkillSelection => ({
  mode: "manual", refs: [{ skillId: skill.id, versionId: skill.versionId! }],
  contextTarget: "current_message",
});
const assistantInput = (skill: typeof firstSkill): AssistantInput => ({
  name: "Fixture assistant", avatar: "FX", systemPrompt: "Fixture assistant rules",
  knowledgeBaseIds: [], mcpSourceIds: [], skillSelection: selection(skill),
});
const apiRequest = (body: Record<string, unknown>) => POST(new Request("http://fixture/api/chat", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));

describe.skipIf(!enabled)("Skill acceptance with isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!/^ai2dot_skill_test_[a-z0-9_]+$/.test(testDatabaseName ?? "")) {
      throw new Error("AI2DOT_SKILL_TEST_DATABASE must name an isolated ai2dot_skill_test_* database.");
    }
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${testDatabaseName}`;
    vi.stubEnv("DATABASE_URL", url.toString());
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("AI2DOT_ENABLE_EXPLICIT_SKILLS", "true");
    vi.stubEnv("AI2DOT_CHAT_RATE_LIMIT_PER_MINUTE", "100");
    await migrate(getDb(), { migrationsFolder: "./drizzle" });
    const makeContext = async (name: string): Promise<WorkspaceContext> => {
      const [user] = await getDb().insert(users).values({ externalAuthId: `fixture-${name}-${randomUUID()}` }).returning();
      const [workspace] = await getDb().insert(workspaces).values({ name: `Skill test ${name}`, ownerId: user.id }).returning();
      await getDb().insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
      return { workspaceId: workspace.id, userId: user.id, role: "owner" };
    };
    contextA = await makeContext("A");
    contextB = await makeContext("B");
    mocks.context = contextA;
    firstSkill = await createSkill(contextA, {
      name: "Fixture context review", version: "1.0.0", autoLoad: false,
      markdown: "# Context review\nfixture:context-review-v1", keywords: ["fixture"],
    });
    model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({ start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "text-1" });
          controller.enqueue({ type: "text-delta", id: "text-1", delta: "Fixture result" });
          controller.enqueue({ type: "text-end", id: "text-1" });
          controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: {
            inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 10, text: 10, reasoning: 0 },
          } });
          controller.close();
        } }),
      }),
    });
    mocks.resolveModel.mockResolvedValue({ languageModel: model, available: true, gatewayRouted: false, contextWindow: 32_000 });
  }, 30_000);

  afterAll(async () => {
    if (enabled) await getDb().$client.end();
    vi.unstubAllEnvs();
  });

  it("loads an explicit non-autoLoad Skill without requiring a keyword", async () => {
    const result = await resolveSkillsForGeneration({ context: contextA, selection: selection(firstSkill),
      trigger: "message", query: "Unrelated question", allowedMcpSourceIds: [], contextWindow: 32_000 });
    expect(result.prompt).toContain("fixture:context-review-v1");
    expect(result.included[0].versionId).toBe(firstSkill.versionId);
  });

  it("rejects the other workspace's Skill without revealing its content", async () => {
    await expect(resolveSkillsForGeneration({ context: contextB, selection: selection(firstSkill),
      trigger: "message", query: "test", allowedMcpSourceIds: [] }))
      .rejects.toMatchObject({ code: "SKILL_NOT_AVAILABLE", status: 404 });
  });

  it("deduplicates concurrent catalog installs and builtin initialization", async () => {
    const installed = await Promise.all(Array.from({ length: 5 }, () => installCatalogSkill(contextA, "context-review", "1.0.0")));
    expect(new Set(installed.map((item) => item?.id)).size).toBe(1);
    expect(new Set(installed.map((item) => item?.versionId)).size).toBe(1);
    expect((await listSkills(contextA)).filter((item) => item.catalogId === "context-review")).toHaveLength(1);
    expect((await listSkills(contextA)).filter((item) => item.slug.startsWith("builtin-"))).toHaveLength(4);
  });

  it("freezes the assistant selection in the new conversation", async () => {
    const assistant = await createAssistant(contextA, assistantInput(firstSkill));
    assistantId = assistant.id;
    oldConversation = (await createConversation(contextA, { assistantId }))!;
    expect((await getConversation(contextA, oldConversation.id))?.assistantSnapshot?.skillSelection).toEqual(selection(firstSkill));
  });

  it("creates a new immutable version even when the display version is unchanged", async () => {
    upgradedSkill = await updateSkill(contextA, firstSkill.id, {
      name: firstSkill.name, version: "1.0.0", markdown: "# Context review\nfixture:context-review-v2",
      enabled: true, autoLoad: false, keywords: ["fixture"],
    });
    expect(upgradedSkill?.versionId).not.toBe(firstSkill.versionId);
    const [old] = await getDb().select().from(skillVersions).where(eq(skillVersions.id, firstSkill.versionId!));
    expect(old.instructions).toContain("fixture:context-review-v1");
    await updateAssistant(contextA, assistantId, assistantInput(upgradedSkill!));
    expect((await getConversation(contextA, oldConversation.id))?.assistantSnapshot?.skillSelection).toEqual(selection(firstSkill));
    const fresh = (await createConversation(contextA, { assistantId }))!;
    expect((await getConversation(contextA, fresh.id))?.assistantSnapshot?.skillSelection).toEqual(selection(upgradedSkill!));
  });

  it("rolls back assistant mode and relationships when the Skill reference fails", async () => {
    const before = await getAssistant(contextA, assistantId);
    const invalid = { ...assistantInput(firstSkill), name: "Must roll back", skillSelection: {
      ...selection(firstSkill), refs: [{ skillId: firstSkill.id, versionId: randomUUID() }],
    } };
    await expect(updateAssistant(contextA, assistantId, invalid)).rejects.toThrow();
    expect(await getAssistant(contextA, assistantId)).toEqual(before);
    const count = (await getDb().select().from(assistants).where(eq(assistants.workspaceId, contextA.workspaceId))).length;
    await expect(createAssistant(contextA, invalid)).rejects.toThrow();
    expect((await getDb().select().from(assistants).where(eq(assistants.workspaceId, contextA.workspaceId))).length).toBe(count);
  });

  it("allows one CAS update and rejects the concurrent stale revision", async () => {
    chat = (await createConversation(contextA))!;
    const results = await Promise.all([firstSkill, upgradedSkill!].map((skill) => updateConversationBranchSkillSelection({
      context: contextA, conversationId: chat.id, branchId: chat.branchId,
      expectedRevision: 0, selection: selection(skill),
    })));
    expect(results.map((result) => result.kind).sort()).toEqual(["conflict", "updated"]);
    expect((await getEffectiveBranchSkillSelection(contextA, chat.id, chat.branchId))?.revision).toBe(1);
  });

  it("captures the selected version at the model boundary and persists the same snapshot", async () => {
    requestBody = {
      modelId: "fixture-model", conversationId: chat.id, branchId: chat.branchId,
      idempotencyKey: randomUUID(), skillSelection: selection(firstSkill),
      messages: [{ id: "fixture-current", role: "user", parts: [{ type: "text", text: "CURRENT_ONLY_001" }] }],
    };
    const response = await apiRequest(requestBody);
    expect(response.status).toBe(200);
    generationId = response.headers.get("x-ai2dot-generation-id")!;
    expect(await response.text()).toContain('"type":"data-skill-resolution"');
    expect(model.doStreamCalls).toHaveLength(1);
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("fixture:context-review-v1");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("fixture:context-review-v2");
    const details = await getGenerationSkillDetails(contextA, generationId);
    expect(details?.status).toBe("completed");
    expect(details?.invocations[0].versionId).toBe(firstSkill.versionId);
    expect(details?.invocations[0].status).toBe("completed");
    expect(details?.resolution?.skills[0].status).toBe("completed");
    expect(await getGenerationSkillDetails(contextB, generationId)).toBeNull();
  });

  it("replays the old snapshot after branch changes without a second model call", async () => {
    await updateConversationBranchSkillSelection({ context: contextA, conversationId: chat.id,
      branchId: chat.branchId, expectedRevision: 1, selection: selection(upgradedSkill!) });
    const response = await apiRequest(requestBody);
    expect(response.headers.get("x-ai2dot-mode")).toBe("replay");
    expect(await response.text()).toContain(firstSkill.versionId!);
    expect(model.doStreamCalls).toHaveLength(1);
    const conflict = await apiRequest({ ...requestBody, skillSelection: selection(upgradedSkill!) });
    expect(conflict.status).toBe(409);
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("deduplicates ten concurrent identical requests at the model boundary", async () => {
    const body = { ...requestBody, idempotencyKey: randomUUID() };
    const responses = await Promise.all(Array.from({ length: 10 }, () => apiRequest(body)));
    await Promise.all(responses.map((response) => response.text()));
    expect(responses.every((response) => [200, 409].includes(response.status))).toBe(true);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it("allows only one child execution for the same tool approval parent", async () => {
    const children = await Promise.all(Array.from({ length: 5 }, () => beginGeneration({
      context: contextA, conversationId: chat.id, branchId: chat.branchId,
      idempotencyKey: randomUUID(), payloadHash: "fixture-continuation", providerModelId: "fixture-model",
      parentGenerationId: generationId,
    })));
    expect(children.filter((child) => child?.kind === "created")).toHaveLength(1);
    expect(children.filter((child) => child?.kind === "continuation_conflict")).toHaveLength(4);
  });

  it("rejects a disabled Skill without a model call", async () => {
    await getDb().update(skills).set({ enabled: false }).where(eq(skills.id, firstSkill.id));
    const response = await apiRequest({ ...requestBody, idempotencyKey: randomUUID() });
    expect(response.status).toBe(404);
    expect(model.doStreamCalls).toHaveLength(2);
    const historical = await getGenerationSkillDetails(contextA, generationId);
    expect(historical?.invocations[0].snapshot.instructions).toContain("fixture:context-review-v1");
  });

  it("preserves version snapshots when the workspace installation is archived", async () => {
    await deleteSkill(contextA, firstSkill.id);
    expect(await resolveExplicitSkillVersions(contextA, selection(firstSkill).refs, "message")).toEqual([null]);
    const versions = await getDb().select().from(skillVersions).where(and(
      eq(skillVersions.skillId, firstSkill.id), eq(skillVersions.id, firstSkill.versionId!),
    ));
    expect(versions).toHaveLength(1);
    expect((await getGenerationSkillDetails(contextA, generationId))?.invocations).toHaveLength(1);
  });

  it("keeps a model stream failure failed rather than marking it completed on stream end", async () => {
    const skill = await installCatalogSkill(contextA, "context-review", "1.0.0");
    model.doStream = async () => ({ stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "stream-start", warnings: [] });
      controller.enqueue({ type: "error", error: new Error("fixture provider failure") });
      controller.close();
    } }) });
    const response = await apiRequest({ ...requestBody, idempotencyKey: randomUUID(), skillSelection: selection(skill!) });
    const failedId = response.headers.get("x-ai2dot-generation-id")!;
    await response.text();
    await expect.poll(async () => (await getGenerationSkillDetails(contextA, failedId))?.status).toBe("failed");
    expect((await getGenerationSkillDetails(contextA, failedId))?.invocations[0].status).toBe("failed");
  });
});
