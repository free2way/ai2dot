import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURED_MODELS } from "@/lib/models";
import { POST } from "./route";

const messages = [
  {
    id: "user-1",
    role: "user" as const,
    parts: [{ type: "text" as const, text: "测试演示流" }],
  },
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/chat", () => {
  it("returns a valid demo UI stream when Gateway is not configured", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, modelId: FEATURED_MODELS[0].id }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ai2dot-mode")).toBe("demo");
    const body = await response.text();
    expect(body).toContain('"type":"text-start"');
    const text = body
      .split("\n")
      .filter((line) => line.startsWith("data: {") && line.includes('"text-delta"'))
      .map((line) => JSON.parse(line.slice(6)) as { delta: string })
      .map((part) => part.delta)
      .join("");
    expect(text).toContain("测试演示流");
  });

  it("rejects models that are not enabled", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, modelId: "unknown/model" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });
  });
});
