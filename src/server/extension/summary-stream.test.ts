import { describe, expect, it } from "vitest";
import { streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { createSummaryResponse } from "./summary-stream";

const response = (parts: Array<{ type: string; text?: string; finishReason?: string }>, framed = true) =>
  createSummaryResponse(new ReadableStream({ start(controller) {
    for (const part of parts) controller.enqueue(part);
    controller.close();
  } }), framed, {});

describe("extension summary stream", () => {
  it("frames deltas and explicit successful completion", async () => {
    const result = response([{ type: "text-delta", text: "总结\n内容" }, { type: "finish" }]);
    expect(result.headers.get("content-type")).toContain("application/x-ndjson");
    expect((await result.text()).trim().split("\n").map((line) => JSON.parse(line))).toEqual([
      { type: "delta", text: "总结\n内容" }, { type: "done" },
    ]);
  });
  it.each(["error", "abort"])("never completes a partial %s stream", async (type) => {
    const text = await response([{ type: "text-delta", text: "Partial" }, { type }, { type: "finish" }]).text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain('"type":"done"');
  });
  it("rejects an unsuccessful finish reason even if no separate error chunk arrived", async () => {
    const text = await response([{ type: "text-delta", text: "Partial" }, { type: "finish", finishReason: "error" }]).text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain('"type":"done"');
  });
  it.each([
    { parts: [] }, { parts: [{ type: "finish" }] },
    { parts: [{ type: "text-delta", text: "Partial" }] },
  ])(
    "rejects empty or incomplete output %#", async ({ parts }) => {
      expect(await response(parts).text()).toContain('"type":"error"');
    },
  );
  it("preserves successful plain text for old clients", async () => {
    expect(await response([{ type: "text-delta", text: "Legacy result" }, { type: "finish" }], false).text()).toBe("Legacy result");
  });
  it("errors the legacy body rather than silently accepting partial output", async () => {
    await expect(response([{ type: "text-delta", text: "Partial" }, { type: "error" }], false).text()).rejects.toThrow();
  });
  it("carries real SDK provider errors through the framed response without disclosing details", async () => {
    const model = new MockLanguageModelV4({ doStream: async () => ({ stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-start", id: "summary" });
        controller.enqueue({ type: "text-delta", id: "summary", delta: "Partial" });
        controller.enqueue({ type: "error", error: new Error("synthetic private provider details") });
        controller.close();
      },
    }) }) });
    const result = streamText({ model, messages: [{ role: "user", content: "fixture" }], onError() {} });
    const text = await createSummaryResponse(result.stream, true, {}).text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain('"type":"done"');
    expect(text).not.toContain("private provider details");
  });
});
