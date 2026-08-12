import { describe, expect, it } from "vitest";
import { FEATURED_MODELS } from "@/lib/models";
import {
  getConversationModelPreferenceKey,
  resolvePreferredModelId,
} from "./model-preference";

describe("model preference", () => {
  it("restores a conversation-specific selection first", () => {
    expect(
      resolvePreferredModelId({
        models: FEATURED_MODELS,
        conversationPreference: FEATURED_MODELS[1].id,
        assistantDefault: FEATURED_MODELS[2].id,
        globalPreference: FEATURED_MODELS[0].id,
      }),
    ).toBe(FEATURED_MODELS[1].id);
  });

  it("uses the assistant default before the global preference", () => {
    expect(
      resolvePreferredModelId({
        models: FEATURED_MODELS,
        assistantDefault: FEATURED_MODELS[2].id,
        globalPreference: FEATURED_MODELS[0].id,
      }),
    ).toBe(FEATURED_MODELS[2].id);
  });

  it("ignores a removed model and safely falls back", () => {
    expect(
      resolvePreferredModelId({
        models: FEATURED_MODELS,
        conversationPreference: "db:removed-model",
        globalPreference: FEATURED_MODELS[1].id,
      }),
    ).toBe(FEATURED_MODELS[1].id);
  });

  it("creates a stable per-conversation storage key", () => {
    expect(getConversationModelPreferenceKey("conversation-id")).toBe(
      "ai2dot.model.preference.v1.conversation.conversation-id",
    );
  });
});
