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
});
