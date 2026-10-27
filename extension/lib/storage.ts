import type { SyncedPreferences } from "~/lib/types";

const PREFERENCES_KEY = "ai2dot.preferences.v2";
const DRAFT_KEY = "ai2dot.draft.v2";
const LEGACY_DRAFT_KEY = "ai2dot.draft.v1";

export type ExtensionStorageScope = {
  userId: string;
  workspaceId: string;
};

function scopedKey(base: string, scope: ExtensionStorageScope) {
  if (!scope.userId || !scope.workspaceId) throw new Error("登录工作区尚未就绪。");
  return `${base}:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.workspaceId)}`;
}

export type ExtensionDraft = {
  sourceUrl: string;
  sourceTitle: string;
  markdown: string;
  updatedAt: string;
};

export async function loadPreferences(scope: ExtensionStorageScope): Promise<SyncedPreferences> {
  const key = scopedKey(PREFERENCES_KEY, scope);
  const stored = await chrome.storage.sync.get(key);
  return {
    summaryTemplate: "structured",
    ...(stored[key] as Partial<SyncedPreferences> | undefined),
  };
}

export async function savePreferences(scope: ExtensionStorageScope, preferences: SyncedPreferences) {
  await chrome.storage.sync.set({ [scopedKey(PREFERENCES_KEY, scope)]: preferences });
}

export async function clearLegacyDraft() {
  // The old entry has no owner metadata, so assigning it to a user is unsafe.
  await chrome.storage.session.remove(LEGACY_DRAFT_KEY);
}

export async function clearAccountDrafts(userId: string) {
  const prefix = `${DRAFT_KEY}:${encodeURIComponent(userId)}:`;
  const stored = await chrome.storage.session.get(null);
  const keys = Object.keys(stored).filter((key) => key === LEGACY_DRAFT_KEY || key.startsWith(prefix));
  if (keys.length > 0) await chrome.storage.session.remove(keys);
}

export async function loadDraft(scope: ExtensionStorageScope): Promise<ExtensionDraft | null> {
  await clearLegacyDraft();
  const key = scopedKey(DRAFT_KEY, scope);
  const stored = await chrome.storage.session.get(key);
  return (stored[key] as ExtensionDraft | undefined) ?? null;
}

export async function saveDraft(scope: ExtensionStorageScope, draft: ExtensionDraft | null) {
  const key = scopedKey(DRAFT_KEY, scope);
  if (draft) await chrome.storage.session.set({ [key]: draft });
  else await chrome.storage.session.remove(key);
}
