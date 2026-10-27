import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccountDrafts,
  loadDraft,
  loadPreferences,
  saveDraft,
  savePreferences,
} from "~/lib/storage";

const session: Record<string, unknown> = {};
const sync: Record<string, unknown> = {};
function area(values: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string | null) => key === null ? { ...values } : { [key]: values[key] }),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(values, items); }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    }),
  };
}
const accountA = { userId: "account-a", workspaceId: "workspace-a" };
const accountB = { userId: "account-b", workspaceId: "workspace-a" };
const otherWorkspace = { userId: "account-a", workspaceId: "workspace-b" };
const draft = { sourceUrl: "https://example.com", sourceTitle: "Private source", markdown: "Private draft", updatedAt: "2026-10-27T00:00:00Z" };

beforeEach(() => {
  for (const key of Object.keys(session)) delete session[key];
  for (const key of Object.keys(sync)) delete sync[key];
  vi.stubGlobal("chrome", { storage: { session: area(session), sync: area(sync) } });
});

describe("account-scoped extension storage", () => {
  it("never restores another account or workspace draft", async () => {
    await saveDraft(accountA, draft);
    await expect(loadDraft(accountA)).resolves.toEqual(draft);
    await expect(loadDraft(accountB)).resolves.toBeNull();
    await expect(loadDraft(otherWorkspace)).resolves.toBeNull();
  });

  it("separates model and knowledge-base preferences by account and workspace", async () => {
    const preferences = { defaultModelId: "private-model", defaultKnowledgeBaseId: "private-library", summaryTemplate: "detailed" as const };
    await savePreferences(accountA, preferences);
    await expect(loadPreferences(accountA)).resolves.toEqual(preferences);
    await expect(loadPreferences(accountB)).resolves.toEqual({ summaryTemplate: "structured" });
    await expect(loadPreferences(otherWorkspace)).resolves.toEqual({ summaryTemplate: "structured" });
  });

  it("discards ownerless legacy drafts instead of assigning them to the next login", async () => {
    session["ai2dot.draft.v1"] = draft;
    await expect(loadDraft(accountB)).resolves.toBeNull();
    expect(session).not.toHaveProperty("ai2dot.draft.v1");
  });

  it("clears the departing account drafts without deleting another account drafts", async () => {
    await saveDraft(accountA, draft);
    await saveDraft(otherWorkspace, draft);
    await saveDraft(accountB, { ...draft, markdown: "Other account" });
    await clearAccountDrafts(accountA.userId);
    await expect(loadDraft(accountA)).resolves.toBeNull();
    await expect(loadDraft(otherWorkspace)).resolves.toBeNull();
    await expect(loadDraft(accountB)).resolves.toMatchObject({ markdown: "Other account" });
  });
});
