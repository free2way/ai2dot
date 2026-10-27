// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { chatDraftKey } from "@/lib/chat-draft";
import { FEATURED_MODELS } from "@/lib/models";
import { ChatWorkspace } from "./chat-workspace";

const mocks = vi.hoisted(() => ({
  send: vi.fn(), setMessages: vi.fn(), onError: null as ((error: Error) => void) | null,
  messages: [] as Array<{ id: string; role: string; parts: Array<{ type: string; text: string }> }>,
}));
vi.mock("@ai-sdk/react", () => ({ useChat: (options: { onError: (error: Error) => void }) => {
  mocks.onError = options.onError;
  return { messages: mocks.messages, sendMessage: mocks.send, status: "ready",
    setMessages: mocks.setMessages, stop: vi.fn(), regenerate: vi.fn(),
    addToolApprovalResponse: vi.fn(), clearError: vi.fn() };
} }));
vi.mock("@clerk/nextjs", () => ({ Show: () => null, UserButton: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({ language: "zh", t: (text: string) => text }), LanguageSwitcher: () => null,
}));

const props = { models: FEATURED_MODELS, authEnabled: false, gatewayEnabled: false,
  persistenceEnabled: true, storageIdentity: "workspace:user",
  initialConversationId: "00000000-0000-4000-8000-000000000001",
  initialBranchId: "00000000-0000-4000-8000-000000000002" };

beforeEach(() => {
  mocks.send.mockReset();
  mocks.messages = [];
  localStorage.clear(); sessionStorage.clear();
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Chat workspace recovery", () => {
  it.each([{ isComposing: true }, { keyCode: 229 }])("does not submit an IME confirmation key %#", async (nativeEvent) => {
    render(<ChatWorkspace {...props} />);
    const input = screen.getByRole("textbox", { name: "消息" });
    fireEvent.change(input, { target: { value: "正在输入中文" } });
    fireEvent.keyDown(input, { key: "Enter", ...nativeEvent });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(input).toHaveValue("正在输入中文");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  });

  it("keeps the selected conversation scope when editing context or mode", () => {
    render(<ChatWorkspace {...props} initialSkills={[{
      id: "00000000-0000-4000-8000-000000000003",
      versionId: "00000000-0000-4000-8000-000000000004",
      name: "Context review", description: "Review the context", slug: "context-review",
      catalogId: "context-review", category: "productivity", version: "1.0.0",
      enabled: true, autoLoad: false, dependencies: [],
    }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Skills 自动" }));
    fireEvent.click(screen.getByRole("button", { name: /Context review.*v1/ }));
    fireEvent.click(screen.getByRole("button", { name: "当前会话" }));
    fireEvent.change(screen.getByRole("combobox", { name: "处理范围" }), { target: { value: "conversation" } });
    expect(screen.getByRole("button", { name: "保存到会话" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "混合" }));
    expect(screen.getByRole("button", { name: "保存到会话" })).toBeInTheDocument();
  });

  it("retains a failed SDK draft and reuses the original idempotency key", async () => {
    mocks.send.mockImplementation(async () => { mocks.onError?.(new Error("network unavailable")); });
    render(<ChatWorkspace {...props} />);
    const input = screen.getByRole("textbox", { name: "消息" });
    fireEvent.change(input, { target: { value: "unfinished task" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("network unavailable");
    expect(input).toHaveValue("unfinished task");
    const first = mocks.send.mock.calls[0];
    mocks.send.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await waitFor(() => expect(input).toHaveValue(""));
    const second = mocks.send.mock.calls[1];
    expect(second[1].body.idempotencyKey).toBe(first[1].body.idempotencyKey);
    expect(second[0].id).toBe(first[0].id);
  });

  it.each(["failed", "stopped"])("uses a fresh key only after the server confirms a %s execution", async (status) => {
    mocks.send.mockImplementationOnce(async () => { mocks.onError?.(new Error("network unavailable")); });
    render(<ChatWorkspace {...props} />);
    const input = screen.getByRole("textbox", { name: "消息" });
    fireEvent.change(input, { target: { value: "recover this request" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("network unavailable");

    mocks.send.mockImplementationOnce(async () => {
      mocks.onError?.(new Error(JSON.stringify({ code: "GENERATION_TERMINAL", status, message: "Previous execution ended." })));
    });
    mocks.send.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await waitFor(() => expect(input).toHaveValue(""));

    expect(mocks.send).toHaveBeenCalledTimes(3);
    const [first, replay, fresh] = mocks.send.mock.calls;
    expect(replay[1].body.idempotencyKey).toBe(first[1].body.idempotencyKey);
    expect(fresh[1].body.idempotencyKey).not.toBe(first[1].body.idempotencyKey);
    expect(fresh[0].id).toBe(first[0].id);
  });

  it("does not rerun an execution whose outcome is still in progress", async () => {
    mocks.send.mockImplementation(async () => {
      mocks.onError?.(new Error(JSON.stringify({ code: "GENERATION_IN_PROGRESS", message: "Still running." })));
    });
    render(<ChatWorkspace {...props} />);
    const input = screen.getByRole("textbox", { name: "消息" });
    fireEvent.change(input, { target: { value: "wait for original" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("Still running.");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("wait for original");
  });

  it("restores a scoped Library draft including a manual empty selection", async () => {
    sessionStorage.setItem(chatDraftKey(props.storageIdentity, props.initialConversationId, props.initialBranchId), JSON.stringify({
      input: "saved draft", selection: { mode: "manual", refs: [], contextTarget: "conversation" },
      scope: "message", overrideDirty: true, savedAt: Date.now(),
    }));
    mocks.send.mockResolvedValue(undefined);
    render(<ChatWorkspace {...props} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("saved draft"));
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalled());
    expect(mocks.send.mock.calls[0][1].body.skillSelection).toEqual({
      mode: "manual", refs: [], contextTarget: "conversation",
    });
  });

  it("adds browser speech recognition results to the composer", async () => {
    class FakeSpeechRecognition {
      static latest: FakeSpeechRecognition;
      continuous = false;
      interimResults = false;
      lang = "";
      onstart: (() => void) | null = null;
      onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() { FakeSpeechRecognition.latest = this; }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    vi.stubGlobal("webkitSpeechRecognition", FakeSpeechRecognition);

    render(<ChatWorkspace {...props} />);
    const voiceButton = await screen.findByRole("button", { name: "语音输入" });
    await waitFor(() => expect(voiceButton).toBeEnabled());
    fireEvent.click(voiceButton);
    expect(screen.getByRole("button", { name: "停止语音输入" })).toHaveAttribute("aria-pressed", "true");

    act(() => {
      FakeSpeechRecognition.latest.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "帮我整理会议纪要" } }],
      });
    });
    expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("帮我整理会议纪要");

    fireEvent.click(screen.getByRole("button", { name: "停止语音输入" }));
    expect(screen.getByRole("button", { name: "语音输入" })).toHaveAttribute("aria-pressed", "false");
  });

  it("explains when browser speech recognition is unavailable", async () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    render(<ChatWorkspace {...props} />);

    const voiceButton = screen.getByRole("button", { name: "语音输入" });
    await waitFor(() => expect(voiceButton).toBeEnabled());
    fireEvent.click(voiceButton);

    expect(screen.getByRole("status")).toHaveTextContent("当前浏览器不支持语音输入");
  });
});

it("automatically restores unsent text after remount and keeps identities separate", async () => {
  const key = chatDraftKey(props.storageIdentity, props.initialConversationId, props.initialBranchId);
  const first = render(<ChatWorkspace {...props} />);
  await waitFor(() => expect(localStorage.getItem(key)).not.toBeNull());
  fireEvent.change(screen.getByRole("textbox", { name: "消息" }), { target: { value: "unfinished text" } });
  expect(JSON.parse(localStorage.getItem(key)!).input).toBe("unfinished text");
  first.unmount();
  const second = render(<ChatWorkspace {...props} />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("unfinished text"));
  second.unmount();
  render(<ChatWorkspace {...props} storageIdentity="workspace:other" />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue(""));
});
