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
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");

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

  it("rejects unsupported reasoning levels", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages,
          modelId: FEATURED_MODELS[0].id,
          reasoning: "unlimited",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("returns the Skill-specific contract for malformed selections", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages,
          skillSelection: {
            mode: "auto",
            refs: [{ skillId: "not-a-uuid", versionId: "not-a-uuid" }],
            contextTarget: "recent_messages",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_SKILL_SELECTION",
    });
  });

  it("does not silently ignore explicit Skills when the feature is disabled", async () => {
    vi.stubEnv("AI2DOT_ENABLE_EXPLICIT_SKILLS", "false");
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages,
          skillSelection: {
            mode: "manual",
            refs: [],
            contextTarget: "recent_messages",
          },
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "SKILL_FEATURE_DISABLED",
    });
  });
});
