"use client";

import { useChat } from "@ai-sdk/react";
import { Show, UserButton } from "@clerk/nextjs";
import {
  Archive,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  FileText,
  Gauge,
  GitBranch,
  History,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { BrandMark } from "@/components/brand-mark";
import { MarkdownContent } from "@/components/chat/markdown-content";
import type {
  ConversationBranch,
  ConversationListItem,
} from "@/lib/conversations";
import {
  DEFAULT_MODEL_ID,
  formatContextWindow,
  type ModelCatalogEntry,
} from "@/lib/models";

const WELCOME_MESSAGES: UIMessage[] = [
  {
    id: "dot-welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "晚上好，Jacky。\n\n我已经准备好和你一起思考、写作或推进项目。今天想先处理什么？",
      },
    ],
  },
];

const QUICK_STARTS = [
  { icon: Sparkles, text: "帮我梳理今天最重要的三件事" },
  { icon: FileText, text: "把一个模糊想法整理成执行方案" },
  { icon: Zap, text: "快速分析一段代码或技术问题" },
];

const STORAGE_KEY = "ai2dot.demo.messages.v1";
const CHAT_TRANSPORT = new DefaultChatTransport({ api: "/api/chat" });

type ChatWorkspaceProps = {
  models: ModelCatalogEntry[];
  authEnabled: boolean;
  gatewayEnabled: boolean;
  persistenceEnabled?: boolean;
  initialConversationId?: string;
  initialBranchId?: string;
  initialMessages?: UIMessage[];
  initialConversations?: ConversationListItem[];
  initialBranches?: ConversationBranch[];
};

function formatConversationTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function ChatWorkspace({
  models,
  authEnabled,
  gatewayEnabled,
  persistenceEnabled = false,
  initialConversationId,
  initialBranchId,
  initialMessages = WELCOME_MESSAGES,
  initialConversations = [],
  initialBranches = [],
}: ChatWorkspaceProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id ?? DEFAULT_MODEL_ID);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [historyReady, setHistoryReady] = useState(persistenceEnabled);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [activeBranchId, setActiveBranchId] = useState(initialBranchId);
  const [conversationList, setConversationList] = useState(initialConversations);
  const [branches, setBranches] = useState(initialBranches);
  const [cloudError, setCloudError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    error,
    clearError,
  } = useChat({
    id: activeConversationId ?? "demo-workspace",
    messages: initialMessages.length > 0 ? initialMessages : WELCOME_MESSAGES,
    transport: CHAT_TRANSPORT,
    throttle: 24,
  });

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? models[0];
  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (persistenceEnabled) {
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as UIMessage[]) : null;
      if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHistoryReady(true);
    }
  }, [persistenceEnabled, setMessages]);

  useEffect(() => {
    if (historyReady && !persistenceEnabled) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [historyReady, messages, persistenceEnabled]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const createCloudConversation = async () => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!response.ok) throw new Error("云端会话创建失败，请重新登录后再试。");

    const payload = (await response.json()) as {
      conversation: { id: string; title: string; branchId: string };
    };
    const conversation = {
      ...payload.conversation,
      updatedAt: new Date().toISOString(),
      archived: false,
    };
    setConversationList((items) => [conversation, ...items]);
    setActiveConversationId(conversation.id);
    setActiveBranchId(payload.conversation.branchId);
    setBranches([
      {
        id: payload.conversation.branchId,
        conversationId: conversation.id,
        parentBranchId: null,
        forkedFromClientMessageId: null,
        name: "主分支",
        isDefault: true,
        createdAt: new Date().toISOString(),
        messageCount: 0,
      },
    ]);
    window.history.replaceState(null, "", `/chat/${conversation.id}`);
    return { conversationId: conversation.id, branchId: payload.conversation.branchId };
  };

  const submit = async (text = input) => {
    const value = text.trim();
    if (!value || isBusy) return;
    clearError();
    setCloudError(undefined);

    try {
      const created =
        persistenceEnabled && !activeConversationId
          ? await createCloudConversation()
          : undefined;
      const conversationId = created?.conversationId ?? activeConversationId;
      const branchId = created?.branchId ?? activeBranchId;

      await sendMessage(
        { text: value },
        {
          body: {
            modelId: selectedModelId,
            conversationId,
            branchId,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      );
    } catch (submitError) {
      setCloudError(
        submitError instanceof Error ? submitError.message : "消息发送失败。",
      );
    }
    setInput("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const startNewChat = async () => {
    stop();
    if (persistenceEnabled) {
      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as { conversation: { id: string } };
        router.push(`/chat/${payload.conversation.id}`);
      } catch {
        setCloudError("新建云端会话失败，请稍后重试。");
      }
      return;
    }

    setMessages(WELCOME_MESSAGES);
    window.localStorage.removeItem(STORAGE_KEY);
    setSidebarOpen(false);
  };

  const switchBranch = async (branchId: string) => {
    if (!activeConversationId || branchId === activeBranchId || isBusy) return;
    setCloudError(undefined);
    try {
      const response = await fetch(
        `/api/conversations/${activeConversationId}?branch=${encodeURIComponent(branchId)}`,
      );
      if (!response.ok) throw new Error("分支加载失败。");
      const payload = (await response.json()) as { messages: UIMessage[] };
      stop();
      setMessages(payload.messages);
      setActiveBranchId(branchId);
      window.history.replaceState(
        null,
        "",
        `/chat/${activeConversationId}?branch=${branchId}`,
      );
    } catch (branchError) {
      setCloudError(
        branchError instanceof Error ? branchError.message : "分支加载失败。",
      );
    }
  };

  const regenerateAsBranch = async (assistantMessageId: string) => {
    if (isBusy) return;
    clearError();
    setCloudError(undefined);

    if (!persistenceEnabled || !activeConversationId || !activeBranchId) {
      await regenerate({
        messageId: assistantMessageId,
        body: { modelId: selectedModelId },
      });
      return;
    }

    const assistantIndex = messages.findIndex(
      (message) => message.id === assistantMessageId,
    );
    const sourceMessage = [...messages.slice(0, assistantIndex)]
      .reverse()
      .find((message) => message.role === "user");
    if (!sourceMessage) {
      setCloudError("找不到这次回答对应的问题。");
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations/${activeConversationId}/branches`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceBranchId: activeBranchId,
            fromMessageId: sourceMessage.id,
          }),
        },
      );
      if (!response.ok) throw new Error("创建重试分支失败。");
      const payload = (await response.json()) as {
        branch: ConversationBranch;
        messages: UIMessage[];
      };
      setBranches((items) => [...items, payload.branch]);
      setActiveBranchId(payload.branch.id);
      window.history.replaceState(
        null,
        "",
        `/chat/${activeConversationId}?branch=${payload.branch.id}`,
      );
      await regenerate({
        messageId: assistantMessageId,
        body: {
          modelId: selectedModelId,
          conversationId: activeConversationId,
          branchId: payload.branch.id,
          idempotencyKey: crypto.randomUUID(),
        },
      });
    } catch (branchError) {
      setCloudError(
        branchError instanceof Error
          ? branchError.message
          : "创建重试分支失败。",
      );
    }
  };

  return (
    <main className="workspace-shell">
      <button
        className="mobile-scrim"
        data-visible={sidebarOpen || inspectorOpen}
        onClick={() => {
          setSidebarOpen(false);
          setInspectorOpen(false);
        }}
        aria-label="关闭面板"
      />

      <aside className="sidebar" data-open={sidebarOpen}>
        <div className="sidebar-top">
          <BrandMark />
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="关闭会话栏">
            <X size={18} />
          </button>
        </div>
        <button className="new-chat-button" onClick={() => void startNewChat()}>
          <Plus size={17} /> 新对话 <kbd>⌘ K</kbd>
        </button>
        <label className="sidebar-search">
          <Search size={15} />
          <input aria-label="搜索会话" placeholder="搜索会话" />
        </label>
        <nav className="primary-nav" aria-label="主导航">
          <button className="nav-row is-active"><MessageSquareText size={17} /> 对话 <span>{conversationList.length || 1}</span></button>
          <button className="nav-row"><Bot size={17} /> 助手</button>
          <button className="nav-row"><Archive size={17} /> 知识库 <em>即将推出</em></button>
          <Link className="nav-row" href="/admin"><Settings2 size={17} /> 模型管理</Link>
        </nav>
        <div className="history-heading"><span>最近</span><History size={14} /></div>
        <div className="history-list">
          {conversationList.length > 0 ? conversationList.map((chat) => (
            <Link className="history-row" data-active={chat.id === activeConversationId} href={`/chat/${chat.id}`} key={chat.id}>
              <span>{chat.title}</span><small>{formatConversationTime(chat.updatedAt)}</small>
            </Link>
          )) : (
            <p className="history-empty">{persistenceEnabled ? "还没有云端会话" : "当前会话保存在此浏览器"}</p>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="usage-line"><span>{persistenceEnabled ? "云端同步" : "本地存储"}</span><strong>{messages.length} 条消息</strong></div>
          <div className="usage-track"><span /></div>
          <button className="profile-row">
            <span className="avatar">J</span>
            <span><strong>{authEnabled ? "个人账户" : "Jacky"}</strong><small>{persistenceEnabled ? "云端已同步" : "本地演示"}</small></span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>

      <section className="chat-stage">
        <header className="chat-header">
          <div className="header-left">
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="打开会话栏">
              <Menu size={19} />
            </button>
            <div><p>新对话</p><span><i className={gatewayEnabled ? "status-live" : "status-demo"} />{gatewayEnabled ? "AI Gateway 已连接" : "演示模式"}</span></div>
          </div>
          <div className="header-actions">
            <div className="model-picker">
              <button className="model-trigger" onClick={() => setModelMenuOpen((open) => !open)} aria-expanded={modelMenuOpen}>
                <span className="model-dot" style={{ background: selectedModel?.accent }} />
                <span><small>{selectedModel?.provider}</small>{selectedModel?.name}</span>
                <ChevronDown size={15} />
              </button>
              {modelMenuOpen && (
                <div className="model-menu">
                  <div className="model-menu-title"><span>选择模型</span><small>{models.length} 个已启用</small></div>
                  {models.map((model) => (
                    <button key={model.id} onClick={() => { setSelectedModelId(model.id); setModelMenuOpen(false); }}>
                      <i style={{ background: model.accent }} />
                      <span><strong>{model.name}</strong><small>{model.description}</small></span>
                      {model.id === selectedModelId && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-button inspector-toggle" onClick={() => setInspectorOpen(true)} aria-label="打开会话设置"><PanelRight size={18} /></button>
            {authEnabled ? <Show when="signed-in" fallback={<Link className="sign-in-link" href="/sign-in">登录</Link>}><UserButton /></Show> : <Link className="sign-in-link" href="/sign-in">登录</Link>}
          </div>
        </header>

        <div className="conversation-scroll">
          <div className="conversation-inner">
            <div className="conversation-date">今天</div>
            {messages.map((message, messageIndex) => (
              <article className="message" data-role={message.role} key={message.id}>
                <div className="message-rail">{message.role === "assistant" ? <BrandMark compact /> : <span className="user-mark">J</span>}</div>
                <div className="message-body">
                  <div className="message-meta"><strong>{message.role === "assistant" ? "Dot" : "你"}</strong><span>{message.role === "assistant" ? selectedModel?.name : "刚刚"}</span></div>
                  <div className="message-content">
                    {message.parts.map((part, partIndex) => part.type === "text" ? <MarkdownContent key={`${message.id}-${partIndex}`}>{part.text}</MarkdownContent> : null)}
                    {isBusy && messageIndex === messages.length - 1 && message.role === "assistant" && <span className="stream-caret" />}
                  </div>
                  {message.role === "assistant" && message.id !== "dot-welcome" && (
                    <div className="message-actions">
                      <button onClick={() => navigator.clipboard.writeText(message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n"))}><Copy size={14} /> 复制</button>
                  <button onClick={() => void regenerateAsBranch(message.id)}><RotateCcw size={14} /> {persistenceEnabled ? "分支重试" : "重试"}</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="quick-starts">
                {QUICK_STARTS.map(({ icon: Icon, text }) => (
                  <button key={text} onClick={() => void submit(text)}><Icon size={16} /><span>{text}</span><ArrowUp size={14} /></button>
                ))}
              </div>
            )}
            {error && <div className="chat-error" role="alert"><CircleHelp size={17} /><span>{error.message || "请求失败，请稍后重试。"}</span><button onClick={clearError}>关闭</button></div>}
            {cloudError && <div className="chat-error" role="alert"><CircleHelp size={17} /><span>{cloudError}</span><button onClick={() => setCloudError(undefined)}>关闭</button></div>}
            <div ref={endRef} />
          </div>
        </div>

        <footer className="composer-dock">
          <form className="composer" onSubmit={handleSubmit}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="给 Dot 发消息…" rows={1} aria-label="消息" />
            <div className="composer-toolbar">
              <div><button type="button" aria-label="添加附件"><Paperclip size={17} /></button><button type="button" className="tool-chip"><Sparkles size={14} /> 深度思考</button></div>
              {isBusy ? (
                <button className="send-button stop-button" type="button" onClick={stop} aria-label="停止生成"><Square size={14} fill="currentColor" /></button>
              ) : (
                <button className="send-button" type="submit" disabled={!input.trim()} aria-label="发送消息"><ArrowUp size={18} /></button>
              )}
            </div>
          </form>
          <p>Dot 可能会犯错。重要信息请核实。</p>
        </footer>
      </section>

      <aside className="inspector" data-open={inspectorOpen}>
        <div className="inspector-header"><span>会话设置</span><button className="icon-button" onClick={() => setInspectorOpen(false)} aria-label="关闭会话设置"><X size={17} /></button></div>
        <section className="inspector-section current-model">
          <p className="eyebrow">CURRENT MODEL</p>
          <div className="current-model-name"><i style={{ background: selectedModel?.accent }} /><span><strong>{selectedModel?.name}</strong><small>{selectedModel?.provider}</small></span></div>
          <p>{selectedModel?.description}</p>
        </section>
        <section className="inspector-section metric-list">
          <div><span><Gauge size={15} /> 上下文窗口</span><strong>{formatContextWindow(selectedModel?.contextWindow ?? 0)}</strong></div>
          <div><span><Clock3 size={15} /> 本次上下文</span><strong>{Math.max(messages.length * 84, 312)} tokens</strong></div>
          <div><span><Zap size={15} /> 连接状态</span><strong>{gatewayEnabled ? "实时" : "演示"}</strong></div>
        </section>
        {persistenceEnabled && branches.length > 0 && (
          <section className="inspector-section">
            <div className="section-title"><span>对话分支</span><small>{branches.length}</small></div>
            <div className="branch-list">
              {branches.map((branch) => (
                <button
                  data-active={branch.id === activeBranchId}
                  disabled={isBusy}
                  key={branch.id}
                  onClick={() => void switchBranch(branch.id)}
                >
                  <GitBranch size={14} />
                  <span><strong>{branch.name}</strong><small>{branch.messageCount} 条消息</small></span>
                  {branch.id === activeBranchId && <Check size={14} />}
                </button>
              ))}
            </div>
            <p className="branch-help">分支重试会保留原答案，并从同一问题生成另一条路径。</p>
          </section>
        )}
        <section className="inspector-section">
          <div className="section-title"><span>助手指令</span><Settings2 size={15} /></div>
          <p className="instruction-copy">可靠、简洁且主动。优先给出明确结论，再补充必要解释。</p>
        </section>
        <section className="inspector-section">
          <div className="section-title"><span>当前能力</span><small>{selectedModel?.capabilities.length}</small></div>
          <div className="capability-list">{selectedModel?.capabilities.map((capability) => <span key={capability}><Check size={12} /> {capability}</span>)}</div>
        </section>
        <div className="inspector-note"><span className={gatewayEnabled ? "status-live" : "status-demo"} /><p>{gatewayEnabled ? "请求通过 Vercel AI Gateway OIDC 安全转发。" : authEnabled ? "登录后即可使用真实模型。" : "连接 Vercel OIDC 或 Gateway API Key 后启用真实模型。"}</p></div>
      </aside>
    </main>
  );
}
