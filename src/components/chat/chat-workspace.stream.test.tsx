// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { FEATURED_MODELS } from "@/lib/models";
import { ChatWorkspace } from "./chat-workspace";

vi.mock("@clerk/nextjs", () => ({ Show: () => null, UserButton: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({ language: "zh", t: (text: string) => text }), LanguageSwitcher: () => null,
}));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Chat workspace live SDK stream", () => {
  it("keeps the first response visible when a blank workspace creates its cloud conversation", async () => {
    const conversationId = "00000000-0000-4000-8000-000000000001";
    const branchId = "00000000-0000-4000-8000-000000000002";
    let finishStream!: () => void;
    const streamGate = new Promise<void>((resolve) => { finishStream = resolve; });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/conversations") {
        return Response.json({ conversation: { id: conversationId, branchId, title: "新对话" } });
      }
      if (url === "/api/chat") {
        expect(JSON.parse(init!.body as string)).toMatchObject({ conversationId, branchId });
        return createUIMessageStreamResponse({ stream: createUIMessageStream({
          execute: async ({ writer }) => {
            writer.write({ type: "start", messageId: "first-response" });
            writer.write({ type: "text-start", id: "answer" });
            writer.write({ type: "text-delta", id: "answer", delta: "Live first response" });
            await streamGate;
            writer.write({ type: "text-end", id: "answer" });
            writer.write({ type: "finish" });
          },
        }) });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatWorkspace models={FEATURED_MODELS} authEnabled={false} gatewayEnabled
      persistenceEnabled storageIdentity="stream-test:user" />);
    const input = screen.getByRole("textbox", { name: "消息" });
    fireEvent.change(input, { target: { value: "First cloud message" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    try {
      await screen.findByText("Live first response");
      expect(screen.getByText("First cloud message", { selector: "p" })).toBeInTheDocument();
    } finally {
      finishStream();
    }
    await waitFor(() => expect(input).toHaveValue(""));
    expect(screen.getByText("Live first response")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers a failed generation without duplicating the user message or rerunning an unknown result", async () => {
    const requests: Array<{ messages: Array<{ id: string; role: string }>; idempotencyKey: string }> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(init!.body as string));
      if (requests.length === 2) {
        return Response.json({ code: "GENERATION_TERMINAL", status: "failed", message: "Previous execution failed." }, { status: 409 });
      }
      const firstRequest = requests.length === 1;
      return createUIMessageStreamResponse({ stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: "start", messageId: firstRequest ? "failed-response" : "recovered-response" });
          writer.write({ type: "text-start", id: "answer" });
          writer.write({ type: "text-delta", id: "answer", delta: firstRequest ? "Partial result" : "Recovered result" });
          if (firstRequest) writer.write({ type: "error", errorText: "Synthetic model failure" });
          else {
            writer.write({ type: "text-end", id: "answer" });
            writer.write({ type: "finish" });
          }
        },
      }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatWorkspace models={FEATURED_MODELS} authEnabled={false} gatewayEnabled persistenceEnabled
      storageIdentity="recovery-test:user"
      initialConversationId="00000000-0000-4000-8000-000000000001"
      initialBranchId="00000000-0000-4000-8000-000000000002" />);
    const input = screen.getByRole("textbox", { name: "消息" });
    fireEvent.change(input, { target: { value: "Retry this task" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findAllByText("Synthetic model failure");
    expect(input).toHaveValue("Retry this task");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("Recovered result");
    await waitFor(() => expect(input).toHaveValue(""));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requests[1].idempotencyKey).toBe(requests[0].idempotencyKey);
    expect(requests[2].idempotencyKey).not.toBe(requests[0].idempotencyKey);
    const originalUser = requests[0].messages.find((message) => message.role === "user");
    for (const request of requests) {
      expect(request.messages.filter((message) => message.role === "user")).toMatchObject([originalUser]);
    }
    expect(screen.getAllByText("Retry this task", { selector: "p" })).toHaveLength(1);
  });
});
