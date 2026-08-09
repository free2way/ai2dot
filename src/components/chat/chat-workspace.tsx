"use client";

import { useChat } from "@ai-sdk/react";
import { Show, UserButton } from "@clerk/nextjs";
import {
  Archive,
  ArrowUp,
  BookPlus,
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
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
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
import type { KnowledgeBaseSummary } from "@/lib/knowledge";
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
const KNOWLEDGE_SELECTION_KEY = "ai2dot.knowledge.selection.v1";
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
  initialKnowledgeBases?: KnowledgeBaseSummary[];
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
  initialKnowledgeBases = [],
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
  const [sessionNotice, setSessionNotice] = useState<string>();
  const [sessionMenuId, setSessionMenuId] = useState<string>();
  const [knowledgeMenuId, setKnowledgeMenuId] = useState<string>();
  const [renamingConversationId, setRenamingConversationId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [sessionBusyId, setSessionBusyId] = useState<string>();
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<string[]>([]);
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
  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelCatalogEntry[]>();
    for (const model of models) {
      groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
    }
    return [...groups.entries()];
  }, [models]);
  const selectedKnowledgeBases = initialKnowledgeBases.filter((base) =>
    selectedKnowledgeBaseIds.includes(base.id),
  );
  const activeConversation = conversationList.find(
    (conversation) => conversation.id === activeConversationId,
  );
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
    if (!persistenceEnabled || initialKnowledgeBases.length === 0) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          window.localStorage.getItem(KNOWLEDGE_SELECTION_KEY) ?? "[]",
        ) as string[];
        setSelectedKnowledgeBaseIds(
          saved.filter((id) => initialKnowledgeBases.some((base) => base.id === id)).slice(0, 3),
        );
      } catch {
        window.localStorage.removeItem(KNOWLEDGE_SELECTION_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialKnowledgeBases, persistenceEnabled]);

  const toggleKnowledgeBase = (knowledgeBaseId: string) => {
    setSelectedKnowledgeBaseIds((current) => {
      const next = current.includes(knowledgeBaseId)
        ? current.filter((id) => id !== knowledgeBaseId)
        : [...current, knowledgeBaseId].slice(-3);
      window.localStorage.setItem(KNOWLEDGE_SELECTION_KEY, JSON.stringify(next));
      return next;
    });
  };

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
            knowledgeBaseIds: selectedKnowledgeBaseIds,
            conversationId,
            branchId,
            idempotencyKey: crypto.randomUUID(),
          },
        },
      );
      if (conversationId) {
        setConversationList((items) => {
          const current = items.find((item) => item.id === conversationId);
          if (!current) return items;
          const updated = {
            ...current,
            title: current.title === "新对话" ? value.slice(0, 48) : current.title,
            updatedAt: new Date().toISOString(),
          };
          return [updated, ...items.filter((item) => item.id !== conversationId)];
        });
      }
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
        body: { modelId: selectedModelId, knowledgeBaseIds: selectedKnowledgeBaseIds },
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
          knowledgeBaseIds: selectedKnowledgeBaseIds,
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

  const beginRenameConversation = (conversation: ConversationListItem) => {
    setRenamingConversationId(conversation.id);
    setRenameValue(conversation.title);
    setSessionMenuId(undefined);
  };

  const renameConversation = async (
    event: FormEvent<HTMLFormElement>,
    conversationId: string,
  ) => {
    event.preventDefault();
    const title = renameValue.trim();
    if (!title) return;
    setSessionBusyId(conversationId);
    setCloudError(undefined);
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("会话重命名失败。");
      setConversationList((items) =>
        items.map((item) =>
          item.id === conversationId ? { ...item, title } : item,
        ),
      );
      setRenamingConversationId(undefined);
      setSessionNotice("会话名称已更新。");
    } catch (renameError) {
      setCloudError(
        renameError instanceof Error ? renameError.message : "会话重命名失败。",
      );
    } finally {
      setSessionBusyId(undefined);
    }
  };

  const removeConversation = async (conversation: ConversationListItem) => {
    if (!window.confirm(`删除会话“${conversation.title}”及其全部消息？`)) return;
    setSessionBusyId(conversation.id);
    setCloudError(undefined);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("会话删除失败。");
      setConversationList((items) =>
        items.filter((item) => item.id !== conversation.id),
      );
      setSessionMenuId(undefined);
      setSessionNotice("会话已删除。");
      if (conversation.id === activeConversationId) {
        stop();
        router.push("/");
      }
    } catch (deleteError) {
      setCloudError(
        deleteError instanceof Error ? deleteError.message : "会话删除失败。",
      );
    } finally {
      setSessionBusyId(undefined);
    }
  };

  const saveConversationToKnowledge = async (
    conversation: ConversationListItem,
    knowledgeBase: KnowledgeBaseSummary,
  ) => {
    setSessionBusyId(conversation.id);
    setCloudError(undefined);
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/knowledge`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            knowledgeBaseId: knowledgeBase.id,
            ...(conversation.id === activeConversationId && activeBranchId
              ? { branchId: activeBranchId }
              : {}),
          }),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "保存到知识库失败。");
      setSessionNotice(`已将“${conversation.title}”保存到“${knowledgeBase.name}”。`);
      setSessionMenuId(undefined);
      setKnowledgeMenuId(undefined);
    } catch (saveError) {
      setCloudError(
        saveError instanceof Error ? saveError.message : "保存到知识库失败。",
      );
    } finally {
      setSessionBusyId(undefined);
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
          <Link className="nav-row" href="/knowledge"><Archive size={17} /> 知识库 <span>{initialKnowledgeBases.length}</span></Link>
          <Link className="nav-row" href="/admin"><Settings2 size={17} /> 模型管理</Link>
        </nav>
        <div className="history-heading"><span>最近</span><History size={14} /></div>
        <div className="history-list">
          {conversationList.length > 0 ? conversationList.map((chat) => (
            <div className="history-item" data-menu-open={sessionMenuId === chat.id} key={chat.id}>
              {renamingConversationId === chat.id ? (
                <form className="history-rename" onSubmit={(event) => void renameConversation(event, chat.id)}>
                  <input aria-label="会话名称" autoFocus maxLength={120} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                  <button aria-label="保存名称" disabled={sessionBusyId === chat.id || !renameValue.trim()} type="submit"><Check size={13} /></button>
                  <button aria-label="取消重命名" onClick={() => setRenamingConversationId(undefined)} type="button"><X size={13} /></button>
                </form>
              ) : (
                <>
                  <Link className="history-row" data-active={chat.id === activeConversationId} href={`/chat/${chat.id}`} onClick={() => setSidebarOpen(false)}>
                    <span>{chat.title}</span><small>{formatConversationTime(chat.updatedAt)}</small>
                  </Link>
                  {persistenceEnabled && (
                    <button className="history-more" aria-expanded={sessionMenuId === chat.id} aria-label={`管理 ${chat.title}`} onClick={() => { setSessionMenuId((current) => current === chat.id ? undefined : chat.id); setKnowledgeMenuId(undefined); }}><MoreHorizontal size={15} /></button>
                  )}
                  {sessionMenuId === chat.id && (
                    <div className="session-menu">
                      <button disabled={sessionBusyId === chat.id} onClick={() => beginRenameConversation(chat)}><Pencil size={13} /> 重命名</button>
                      <button disabled={sessionBusyId === chat.id || initialKnowledgeBases.length === 0} onClick={() => setKnowledgeMenuId((current) => current === chat.id ? undefined : chat.id)}><BookPlus size={13} /> 保存到知识库 <ChevronDown size={12} /></button>
                      {knowledgeMenuId === chat.id && (
                        <div className="session-knowledge-list">
                          {initialKnowledgeBases.map((base) => (
                            <button disabled={sessionBusyId === chat.id} key={base.id} onClick={() => void saveConversationToKnowledge(chat, base)}><Archive size={12} /><span>{base.name}</span><small>{base.documentCount}</small></button>
                          ))}
                        </div>
                      )}
                      {initialKnowledgeBases.length === 0 && <Link href="/knowledge">先创建知识库</Link>}
                      <button className="is-danger" disabled={sessionBusyId === chat.id} onClick={() => void removeConversation(chat)}><Trash2 size={13} /> 删除会话</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )) : (
            <p className="history-empty">{persistenceEnabled ? "还没有云端会话" : "当前会话保存在此浏览器"}</p>
          )}
        </div>
        {sessionNotice && <div className="session-notice"><Check size={12} /><span>{sessionNotice}</span><button onClick={() => setSessionNotice(undefined)}><X size={12} /></button></div>}
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
            <div><p>{activeConversation?.title ?? "新对话"}</p><span><i className={gatewayEnabled ? "status-live" : "status-demo"} />{gatewayEnabled ? "模型服务已连接" : "演示模式"}</span></div>
          </div>
          <div className="header-actions">
            <div className="model-picker">
              <button className="model-trigger" onClick={() => setModelMenuOpen((open) => !open)} aria-expanded={modelMenuOpen}>
                <span className="model-dot" style={{ background: selectedModel?.accent }} />
                <span><small>{selectedModel?.provider}</small>{selectedModel?.name}</span>
                <ChevronDown size={15} />
              </button>
              {modelMenuOpen && (
                <div className="model-menu" role="listbox" aria-label="按供应商选择模型">
                  <div className="model-menu-title"><span>选择模型</span><small>{models.length} 个已启用</small></div>
                  <div className="model-provider-groups">
                    {groupedModels.map(([provider, providerModels]) => (
                      <section className="model-provider-group" key={provider}>
                        <div className="model-provider-heading"><span>{provider}</span><small>{providerModels.length}</small></div>
                        {providerModels.map((model) => (
                          <button aria-selected={model.id === selectedModelId} key={model.id} role="option" onClick={() => { setSelectedModelId(model.id); setModelMenuOpen(false); }}>
                            <i style={{ background: model.accent }} />
                            <span><strong>{model.name}</strong><small>{model.description}</small></span>
                            {model.id === selectedModelId && <Check size={16} />}
                          </button>
                        ))}
                      </section>
                    ))}
                  </div>
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
              <div><button type="button" aria-label="添加附件"><Paperclip size={17} /></button><button type="button" className="tool-chip"><Sparkles size={14} /> 深度思考</button>{selectedKnowledgeBases.length > 0 && <button type="button" className="tool-chip is-active" onClick={() => setInspectorOpen(true)}><Archive size={14} /> 知识库 {selectedKnowledgeBases.length}</button>}</div>
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
        {persistenceEnabled && (
          <section className="inspector-section">
            <div className="section-title"><span>知识库</span><small>{selectedKnowledgeBases.length} / 3</small></div>
            {initialKnowledgeBases.length > 0 ? (
              <div className="knowledge-selector">
                {initialKnowledgeBases.map((base) => {
                  const active = selectedKnowledgeBaseIds.includes(base.id);
                  return (
                    <button aria-pressed={active} data-active={active} key={base.id} onClick={() => toggleKnowledgeBase(base.id)}>
                      <Archive size={14} />
                      <span><strong>{base.name}</strong><small>{base.documentCount} 个文档 · {base.chunkCount} 个片段</small></span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="branch-help">还没有知识库。创建并导入资料后，可让回答基于你的私有内容。</p>
            )}
            <Link className="knowledge-manage-link" href="/knowledge">管理知识库</Link>
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
        <div className="inspector-note"><span className={gatewayEnabled ? "status-live" : "status-demo"} /><p>{gatewayEnabled ? "请求通过工作区配置的模型供应商安全转发。" : authEnabled ? "前往模型管理，添加自己的 API Key 后启用真实模型。" : "登录后可配置自己的模型供应商。"}</p></div>
      </aside>
    </main>
  );
}
