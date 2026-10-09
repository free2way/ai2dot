import type { SyncedPreferences } from "~/lib/types";

const PREFERENCES_KEY = "ai2dot.preferences.v1";
const DRAFT_KEY = "ai2dot.draft.v1";

export type ExtensionDraft = {
  sourceUrl: string;
  sourceTitle: string;
  markdown: string;
  updatedAt: string;
};

export async function loadPreferences(): Promise<SyncedPreferences> {
  const stored = await chrome.storage.sync.get(PREFERENCES_KEY);
  return {
    summaryTemplate: "structured",
    ...(stored[PREFERENCES_KEY] as Partial<SyncedPreferences> | undefined),
  };
}

export async function savePreferences(preferences: SyncedPreferences) {
  await chrome.storage.sync.set({ [PREFERENCES_KEY]: preferences });
}

export async function loadDraft(): Promise<ExtensionDraft | null> {
  const stored = await chrome.storage.session.get(DRAFT_KEY);
  return (stored[DRAFT_KEY] as ExtensionDraft | undefined) ?? null;
}

export async function saveDraft(draft: ExtensionDraft | null) {
  if (draft) await chrome.storage.session.set({ [DRAFT_KEY]: draft });
  else await chrome.storage.session.remove(DRAFT_KEY);
}
