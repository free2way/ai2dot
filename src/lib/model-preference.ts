import type { ModelCatalogEntry } from "@/lib/models";

export const MODEL_PREFERENCE_KEY = "ai2dot.model.preference.v1";

export function getConversationModelPreferenceKey(conversationId: string) {
  return `${MODEL_PREFERENCE_KEY}.conversation.${conversationId}`;
}

export function resolvePreferredModelId({
  models,
  conversationPreference,
  assistantDefault,
  globalPreference,
}: {
  models: ModelCatalogEntry[];
  conversationPreference?: string | null;
  assistantDefault?: string | null;
  globalPreference?: string | null;
}) {
  const availableIds = new Set(models.map((model) => model.id));
  return (
    [conversationPreference, assistantDefault, globalPreference].find(
      (modelId): modelId is string =>
        Boolean(modelId) && availableIds.has(modelId!),
    ) ?? models[0]?.id
  );
}
