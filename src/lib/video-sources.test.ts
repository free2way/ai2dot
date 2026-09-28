import { describe, expect, it } from "vitest";
import { buildVideoKnowledgeMarkdown, normalizeVideoTranscript, parseVideoUrl } from "./video-sources";

describe("video sources", () => {
  it("normalizes supported YouTube and Bilibili URLs", () => {
    expect(parseVideoUrl("https://youtu.be/MMl3GU9k8A0?t=12")).toMatchObject({
      platform: "youtube",
      externalId: "MMl3GU9k8A0",
      canonicalUrl: "https://www.youtube.com/watch?v=MMl3GU9k8A0",
    });
    expect(parseVideoUrl("https://www.bilibili.com/video/BV1xx411c7mD?p=2")).toMatchObject({
      platform: "bilibili",
      externalId: "BV1xx411c7mD",
    });
  });

  it("rejects arbitrary and malformed URLs", () => {
    expect(parseVideoUrl("https://example.com/watch?v=MMl3GU9k8A0")).toBeNull();
    expect(parseVideoUrl("not-a-url")).toBeNull();
  });

  it("converts SRT and ASS captions to timestamped text", () => {
    expect(
      normalizeVideoTranscript("1\n00:00:01,200 --> 00:00:03,000\n第一句话\n\n2\n00:01:02,000 --> 00:01:04,000\n第二句话"),
    ).toBe("[00:00:01] 第一句话\n[00:01:02] 第二句话");
    expect(
      normalizeVideoTranscript("[Events]\nDialogue: 0,0:00:05.20,0:00:08.00,Default,,0,0,0,,Hello\\Nworld"),
    ).toBe("[00:00:05] Hello world");
  });

  it("keeps provenance in the indexed markdown", () => {
    expect(
      buildVideoKnowledgeMarkdown({
        platform: "youtube",
        title: "Attention 入门",
        authorName: "Teacher",
        canonicalUrl: "https://www.youtube.com/watch?v=MMl3GU9k8A0",
        language: "zh-CN",
        transcript: "[00:00:01] 开始",
      }),
    ).toContain("- 原始地址：https://www.youtube.com/watch?v=MMl3GU9k8A0");
  });
});
