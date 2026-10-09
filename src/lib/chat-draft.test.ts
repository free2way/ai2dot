import { describe, expect, it } from "vitest";
import { chatDraftKey, parseChatDraft, safeChatReturnPath } from "./chat-draft";

describe("Chat drafts", () => {
  it("isolates drafts by identity, conversation and branch", () => {
    expect(chatDraftKey("workspace-a:user-a", "chat", "branch-a"))
      .not.toBe(chatDraftKey("workspace-a:user-b", "chat", "branch-a"));
    expect(chatDraftKey("workspace-a:user-a", "chat", "branch-a"))
      .not.toBe(chatDraftKey("workspace-a:user-a", "chat", "branch-b"));
  });
  it("restores the draft and exact selection, but rejects expired or malformed data", () => {
    const draft = { input: "unfinished", selection: { mode: "manual", refs: [], contextTarget: "conversation" },
      scope: "message", overrideDirty: true, savedAt: 100_000_000 };
    expect(parseChatDraft(JSON.stringify(draft), 100_000_001)).toEqual(draft);
    expect(parseChatDraft(JSON.stringify(draft), 200_000_000)).toBeNull();
    expect(parseChatDraft("{}", 100_000_001)).toBeNull();
    expect(parseChatDraft("broken")).toBeNull();
  });
  it("allows only local chat return paths", () => {
    expect(safeChatReturnPath("https://example.com")).toBe("/workspace");
    expect(safeChatReturnPath("//example.com")).toBe("/workspace");
    const path = "/chat/00000000-0000-4000-8000-000000000001?branch=00000000-0000-4000-8000-000000000002";
    expect(safeChatReturnPath(path)).toBe(path);
  });
});
