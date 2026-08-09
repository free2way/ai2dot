import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_ID,
  FEATURED_MODELS,
  formatContextWindow,
  isFeaturedModel,
} from "./models";

describe("featured model catalog", () => {
  it("contains unique, selectable models from three providers", () => {
    expect(FEATURED_MODELS).toHaveLength(3);
    expect(new Set(FEATURED_MODELS.map((model) => model.id)).size).toBe(3);
    expect(new Set(FEATURED_MODELS.map((model) => model.provider)).size).toBe(3);
    expect(isFeaturedModel(DEFAULT_MODEL_ID)).toBe(true);
  });

  it("formats context windows for the UI", () => {
    expect(formatContextWindow(1_100_000)).toBe("1.1M");
    expect(formatContextWindow(128_000)).toBe("128K");
  });
});
