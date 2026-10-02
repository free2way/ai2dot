import { z } from "zod";
import { skillSelectionSchema } from "@/lib/skill-selection";

const draftSchema = z.object({
  input: z.string().max(100_000),
  selection: skillSelectionSchema,
  scope: z.enum(["message", "branch"]),
  overrideDirty: z.boolean(),
  savedAt: z.number(),
});

export type ChatDraft = z.infer<typeof draftSchema>;

export function chatDraftKey(identity: string, conversationId?: string, branchId?: string) {
  return `ai2dot.chat.draft.v1:${identity}:${conversationId ?? "new"}:${branchId ?? "default"}`;
}

export function parseChatDraft(raw: string | null, now = Date.now()) {
  try {
    const parsed = draftSchema.safeParse(raw ? JSON.parse(raw) : null);
    if (!parsed.success || now - parsed.data.savedAt > 86_400_000 || parsed.data.savedAt > now) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function safeChatReturnPath(value?: string) {
  if (value === "/workspace") return value;
  return value && /^\/chat\/[0-9a-f-]{36}(?:\?branch=[0-9a-f-]{36})?$/i.test(value)
    ? value : "/workspace";
}
