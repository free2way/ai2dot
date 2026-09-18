"use client";

import { useChat } from "@ai-sdk/react";
import { Show, UserButton } from "@clerk/nextjs";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookPlus,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  History,
  Link2,
  Menu,
  MessageSquareText,
  MoreHorizontal,
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
import { getKnowledgeSourceParts } from "@/lib/chat-sources";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import type {
  ConversationBranch,
  ConversationListItem,
} from "@/lib/conversations";
import { filterConversations } from "@/lib/conversations";
import type { KnowledgeBaseSummary } from "@/lib/knowledge";
import {
  DEFAULT_MODEL_ID,
  formatContextWindow,
  type ModelCatalogEntry,
} from "@/lib/models";
import {
  getConversationModelPreferenceKey,
  MODEL_PREFERENCE_KEY,
  resolvePreferredModelId,
} from "@/lib/model-preference";

const WELCOME_MESSAGES: UIMessage[] = [
  {
    id: "dot-welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "晚上好，访客。\n\n我已经准备好和你一起思考、写作或推进项目。今天想先处理什么？",
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
  initialContextCompacted?: boolean;
  initialModelId?: string;
  initialKnowledgeBaseIds?: string[];
  initialAssistant?: { name: string; description?: string | null };
  initialUserName?: string | null;
  initialKnowledgeBases?: KnowledgeBaseSummary[];
  initialMcpSources?: {
    id: string;
    name: string;
    transport: "http" | "sse";
    enabled: boolean;
    toolCount: number;
  }[];
  initialSkills?: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    autoLoad: boolean;
  }[];
};

function formatConversationTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function MessageKnowledgeSources({ message }: { message: UIMessage }) {
  const { t } = useLanguage();
  const sources = getKnowledgeSourceParts(message);
  if (sources.length === 0) return null;

  return (
    <div className="message-knowledge-sources">
      <span><FileSearch size={13} /> {t("参考资料")}</span>
      <div>
        {sources.map((source) => (
          <Link href="/knowledge" key={source.sourceId} title={t("在知识库中查看")}>
            <FileText size={13} />
            <span>{source.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ChatWorkspace({
  models,
  authEnabled,
  gatewayEnabled,
  persistenceEnabled = false,
  initialConversationId,
  initialBranchId,
  initialMessages,
  initialConversations = [],
  initialBranches = [],
  initialContextCompacted = false,
  initialModelId,
  initialKnowledgeBaseIds = [],
  initialAssistant,
  initialUserName,
  initialKnowledgeBases = [],
  initialMcpSources = [],
  initialSkills = [],
}: ChatWorkspaceProps) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(
    models.some((model) => model.id === initialModelId)
      ? initialModelId!
      : models[0]?.id ?? DEFAULT_MODEL_ID,
  );
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
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<string[]>(
    initialKnowledgeBaseIds.slice(0, 3),
  );
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [contextCompacted, setContextCompacted] = useState(
    initialContextCompacted,
  );
  const welcomeName = initialUserName?.trim() || t("访客");
  const profileName = initialUserName?.trim() || t("访客");
  const profileInitial = profileName.slice(0, 1).toUpperCase();
  const welcomeMessages = useMemo<UIMessage[]>(
    () => language === "en"
      ? [{ ...WELCOME_MESSAGES[0], parts: [{ type: "text", text: `Good evening, ${welcomeName}.\n\nI’m ready to think, write, or move a project forward with you. What should we tackle first?` }] }]
      : [{ ...WELCOME_MESSAGES[0], parts: [{ type: "text", text: `晚上好，${welcomeName}。\n\n我已经准备好和你一起思考、写作或推进项目。今天想先处理什么？` }] }],
    [language, welcomeName],
  );
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

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
    messages: initialMessages && initialMessages.length > 0 ? initialMessages : welcomeMessages,
    transport: CHAT_TRANSPORT,
    throttle: 24,
  });

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? models[0];
  const supportsDeepThinking = selectedModel?.capabilities.includes("reasoning") ?? false;
  const useDeepThinking = deepThinkingEnabled && supportsDeepThinking;
  const visibleConversations = useMemo(
    () => filterConversations(conversationList, conversationSearch),
    [conversationList, conversationSearch],
  );
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
  const assistantName = initialAssistant?.name ?? "Dot";
  const turnCount = messages.filter((message) => message.role === "user").length;
  const turnNumbers = useMemo(() => {
    const result = new Map<string, number>();
    let currentTurn = 0;
    for (const message of messages) {
      if (message.role === "user") currentTurn += 1;
      result.set(message.id, currentTurn);
    }
    return result;
  }, [messages]);
  const estimatedContextCharacters = useMemo(
    () => messages.reduce(
      (total, message) =>
        total +
        message.parts.reduce(
          (partTotal, part) =>
            partTotal + (part.type === "text" ? part.text.length : 0),
          0,
        ),
      0,
    ),
    [messages],
  );
  const estimatedContextTokens = Math.max(
    1,
    Math.ceil(estimatedContextCharacters / 3),
  ).toLocaleString("zh-CN");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const conversationPreference = activeConversationId
        ? window.localStorage.getItem(
            getConversationModelPreferenceKey(activeConversationId),
          )
        : null;
      const globalPreference = window.localStorage.getItem(
        MODEL_PREFERENCE_KEY,
      );
      const preferredModelId = resolvePreferredModelId({
        models,
        conversationPreference,
        assistantDefault: initialModelId,
        globalPreference,
      });

      if (preferredModelId) setSelectedModelId(preferredModelId);
      if (conversationPreference && !models.some((model) => model.id === conversationPreference)) {
        window.localStorage.removeItem(
          getConversationModelPreferenceKey(activeConversationId!),
        );
      }
      if (globalPreference && !models.some((model) => model.id === globalPreference)) {
        window.localStorage.removeItem(MODEL_PREFERENCE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeConversationId, initialModelId, models]);

  const selectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setModelMenuOpen(false);
    window.localStorage.setItem(MODEL_PREFERENCE_KEY, modelId);
    if (activeConversationId) {
      window.localStorage.setItem(
        getConversationModelPreferenceKey(activeConversationId),
        modelId,
      );
    }
  };

  useEffect(() => {
    if (persistenceEnabled) {
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as UIMessage[]) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed.map((message) => message.id === "dot-welcome" ? welcomeMessages[0] : message));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHistoryReady(true);
    }
  }, [persistenceEnabled, setMessages, welcomeMessages]);

  useEffect(() => {
    if (historyReady && !persistenceEnabled) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [historyReady, messages, persistenceEnabled]);

  useEffect(() => {
    if (
      !persistenceEnabled ||
      initialKnowledgeBases.length === 0 ||
      initialAssistant
    ) return;
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
  }, [initialAssistant, initialKnowledgeBases, persistenceEnabled]);

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
    const textarea = composerTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 42), 160);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!isNearBottom && status !== "submitted") return;
    const frame = window.requestAnimationFrame(() => {
      const scroll = conversationScrollRef.current;
      scroll?.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isNearBottom, messages, status]);

  const handleConversationScroll = () => {
    const scroll = conversationScrollRef.current;
    if (!scroll) return;
    const distanceFromBottom =
      scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
    setIsNearBottom(distanceFromBottom < 96);
  };

  const scrollToBottom = () => {
    setIsNearBottom(true);
    const scroll = conversationScrollRef.current;
    scroll?.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
  };

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
        hasContextSummary: false,
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
    setIsNearBottom(true);

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
            reasoning: useDeepThinking ? "high" : "provider-default",
          },
        },
      );
      if (
        messages.length + 1 > 18 ||
        estimatedContextCharacters + value.length > 28_000
      ) {
        setContextCompacted(true);
      }
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

    setMessages(welcomeMessages);
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
      const payload = (await response.json()) as {
        messages: UIMessage[];
        branches?: ConversationBranch[];
      };
      stop();
      setMessages(payload.messages);
      setActiveBranchId(branchId);
      setContextCompacted(
        payload.branches?.find((branch) => branch.id === branchId)
          ?.hasContextSummary ?? false,
      );
      setIsNearBottom(true);
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
        body: {
          modelId: selectedModelId,
          knowledgeBaseIds: selectedKnowledgeBaseIds,
          reasoning: useDeepThinking ? "high" : "provider-default",
        },
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
          reasoning: useDeepThinking ? "high" : "provider-default",
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
            aria-label={t("关闭面板")}
      />

      <aside className="sidebar" data-open={sidebarOpen}>
        <div className="sidebar-top">
          <BrandMark />
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label={t("关闭会话栏")}>
            <X size={18} />
          </button>
        </div>
        <button className="new-chat-button" onClick={() => void startNewChat()}>
          <Plus size={17} /> {t("新对话")} <kbd>⌘ K</kbd>
        </button>
        <label className="sidebar-search">
          <Search size={15} />
          <input
            aria-label={t("搜索会话")}
            placeholder={t("搜索会话")}
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
          />
        </label>
        <nav className="primary-nav" aria-label={t("主导航")}>
          <button className="nav-row is-active"><MessageSquareText size={17} /> {t("对话")} <span>{conversationList.length || 1}</span></button>
          <Link className="nav-row" href="/assistants"><Bot size={17} /> {t("助手")}</Link>
          <Link className="nav-row" href="/knowledge"><Archive size={17} /> {t("知识库")} <span>{initialKnowledgeBases.length}</span></Link>
          <Link className="nav-row" href="/admin"><Settings2 size={17} /> {t("模型管理")}</Link>
        </nav>
        <div className="history-heading"><span>{conversationSearch.trim() ? `${t("搜索结果")} ${visibleConversations.length}` : t("最近")}</span><History size={14} /></div>
        <div className="history-list">
          {visibleConversations.length > 0 ? visibleConversations.map((chat) => (
            <div className="history-item" data-menu-open={sessionMenuId === chat.id} key={chat.id}>
              {renamingConversationId === chat.id ? (
                <form className="history-rename" onSubmit={(event) => void renameConversation(event, chat.id)}>
                  <input aria-label={t("会话名称")} autoFocus maxLength={120} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                  <button aria-label={t("保存名称")} disabled={sessionBusyId === chat.id || !renameValue.trim()} type="submit"><Check size={13} /></button>
                  <button aria-label={t("取消重命名")} onClick={() => setRenamingConversationId(undefined)} type="button"><X size={13} /></button>
                </form>
              ) : (
                <>
                  <Link className="history-row" data-active={chat.id === activeConversationId} href={`/chat/${chat.id}`} onClick={() => setSidebarOpen(false)}>
                    <span>{chat.title}</span><small>{formatConversationTime(chat.updatedAt)}</small>
                  </Link>
                  {persistenceEnabled && (
                    <button className="history-more" aria-expanded={sessionMenuId === chat.id} aria-label={`${t("管理")} ${chat.title}`} onClick={() => { setSessionMenuId((current) => current === chat.id ? undefined : chat.id); setKnowledgeMenuId(undefined); }}><MoreHorizontal size={15} /></button>
                  )}
                  {sessionMenuId === chat.id && (
                    <div className="session-menu">
                      <button disabled={sessionBusyId === chat.id} onClick={() => beginRenameConversation(chat)}><Pencil size={13} /> {t("重命名")}</button>
                      <button disabled={sessionBusyId === chat.id || initialKnowledgeBases.length === 0} onClick={() => setKnowledgeMenuId((current) => current === chat.id ? undefined : chat.id)}><BookPlus size={13} /> {t("保存到知识库")} <ChevronDown size={12} /></button>
                      {knowledgeMenuId === chat.id && (
                        <div className="session-knowledge-list">
                          {initialKnowledgeBases.map((base) => (
                            <button disabled={sessionBusyId === chat.id} key={base.id} onClick={() => void saveConversationToKnowledge(chat, base)}><Archive size={12} /><span>{base.name}</span><small>{base.documentCount}</small></button>
                          ))}
                        </div>
                      )}
                      {initialKnowledgeBases.length === 0 && <Link href="/knowledge">{t("先创建知识库")}</Link>}
                      <button className="is-danger" disabled={sessionBusyId === chat.id} onClick={() => void removeConversation(chat)}><Trash2 size={13} /> {t("删除会话")}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )) : (
            <p className="history-empty">{conversationSearch.trim() ? t("没有找到匹配的会话") : persistenceEnabled ? t("还没有云端会话") : t("当前会话保存在此浏览器")}</p>
          )}
        </div>
        {sessionNotice && <div className="session-notice"><Check size={12} /><span>{sessionNotice}</span><button onClick={() => setSessionNotice(undefined)}><X size={12} /></button></div>}
        <div className="sidebar-footer">
          <div className="usage-line"><span>{persistenceEnabled ? t("云端同步") : t("本地存储")}</span><strong>{messages.length} {t("条消息")}</strong></div>
          <div className="usage-track"><span /></div>
          <button className="profile-row">
            <span className="avatar">{profileInitial}</span>
            <span><strong>{profileName}</strong><small>{persistenceEnabled ? t("云端已同步") : t("本地演示")}</small></span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>

      <section className="chat-stage">
        <header className="chat-header">
          <div className="header-left">
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label={t("打开会话栏")}>
              <Menu size={19} />
            </button>
            <div><p>{activeConversation?.title ?? t("新对话")}</p><span><i className={gatewayEnabled ? "status-live" : "status-demo"} />{gatewayEnabled ? t("模型服务已连接") : t("演示模式")}</span></div>
          </div>
          <div className="header-actions">
            <div className="model-picker">
              <button className="model-trigger" onClick={() => setModelMenuOpen((open) => !open)} aria-expanded={modelMenuOpen}>
                <span className="model-dot" style={{ background: selectedModel?.accent }} />
                <span><small>{selectedModel?.provider}</small>{selectedModel?.name}</span>
                <ChevronDown size={15} />
              </button>
              {modelMenuOpen && (
                <div className="model-menu" role="listbox" aria-label={t("按供应商选择模型")}>
                  <div className="model-menu-title"><span>{t("选择模型")}</span><small>{models.length} {t("个已启用")}</small></div>
                  <div className="model-provider-groups">
                    {groupedModels.map(([provider, providerModels]) => (
                      <section className="model-provider-group" key={provider}>
                        <div className="model-provider-heading"><span>{provider}</span><small>{providerModels.length}</small></div>
                        {providerModels.map((model) => (
                          <button aria-selected={model.id === selectedModelId} key={model.id} role="option" onClick={() => selectModel(model.id)}>
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
            <LanguageSwitcher />
            <button className="icon-button inspector-toggle" onClick={() => setInspectorOpen(true)} aria-label={t("打开会话设置")}><PanelRight size={18} /></button>
            {authEnabled ? <Show when="signed-in" fallback={<Link className="sign-in-link" href="/sign-in">{t("登录")}</Link>}><UserButton /></Show> : <Link className="sign-in-link" href="/sign-in">{t("登录")}</Link>}
          </div>
        </header>

        <div className="conversation-viewport">
          <div
            className="conversation-scroll"
            onScroll={handleConversationScroll}
            ref={conversationScrollRef}
          >
            <div className="conversation-inner">
            <div className="conversation-date">{t("今天")}</div>
            <div className="conversation-context-strip">
              <span><MessageSquareText size={13} /> {turnCount} {t("轮对话")}</span>
              <span><BrainCircuit size={13} /> {contextCompacted ? t("较早内容已压缩") : t("上下文自动管理")}</span>
            </div>
            {messages.map((message, messageIndex) => (
              <article className="message" data-role={message.role} key={message.id}>
                <div className="message-rail">{message.role === "assistant" ? <BrandMark compact /> : <span className="user-mark">{profileInitial}</span>}</div>
                <div className="message-body">
                  <div className="message-meta"><strong>{message.role === "assistant" ? assistantName : t("你")}</strong><span>{message.role === "assistant" ? selectedModel?.name : t("第 {{count}} 轮", { count: turnNumbers.get(message.id) ?? 1 })}</span></div>
                  <div className="message-content">
                    {message.parts.map((part, partIndex) => part.type === "text" ? <MarkdownContent key={`${message.id}-${partIndex}`}>{part.text}</MarkdownContent> : null)}
                    {isBusy && messageIndex === messages.length - 1 && message.role === "assistant" && <span className="stream-caret" />}
                  </div>
                  <MessageKnowledgeSources message={message} />
                  {message.role === "assistant" && message.id !== "dot-welcome" && (
                    <div className="message-actions">
                      <button onClick={() => navigator.clipboard.writeText(message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n"))}><Copy size={14} /> {t("复制")}</button>
                  <button onClick={() => void regenerateAsBranch(message.id)}><RotateCcw size={14} /> {persistenceEnabled ? t("分支重试") : t("重试")}</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="quick-starts">
                {QUICK_STARTS.map(({ icon: Icon, text }) => (
                  <button key={text} onClick={() => void submit(t(text))}><Icon size={16} /><span>{t(text)}</span><ArrowUp size={14} /></button>
                ))}
              </div>
            )}
            {error && <div className="chat-error" role="alert"><CircleHelp size={17} /><span>{error.message || "请求失败，请稍后重试。"}</span><button onClick={clearError}>关闭</button></div>}
            {cloudError && <div className="chat-error" role="alert"><CircleHelp size={17} /><span>{cloudError}</span><button onClick={() => setCloudError(undefined)}>关闭</button></div>}
            </div>
          </div>
          {!isNearBottom && (
            <button
              className="scroll-to-bottom"
              onClick={scrollToBottom}
              type="button"
            >
              <ArrowDown size={15} /> {t("回到底部")}
            </button>
          )}
        </div>

        <footer className="composer-dock">
          <div className="composer-session-label">
            <span>{t("继续这个会话")}</span>
            <small>{useDeepThinking ? t("深度思考已开启 · 回答可能更慢") : contextCompacted ? t("已携带滚动摘要与最近消息") : t("自动携带当前会话上下文")}</small>
          </div>
          <form className="composer" onSubmit={handleSubmit}>
            <textarea ref={composerTextareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={`${t("继续提问，或让{{name}}完善上面的结果…", { name: assistantName })}`} rows={1} aria-label={t("消息")} />
            <div className="composer-toolbar">
              <div><button type="button" className={`tool-chip${useDeepThinking ? " is-active" : ""}`} disabled={!supportsDeepThinking} aria-pressed={useDeepThinking} title={supportsDeepThinking ? t("为下一次回答使用高强度推理") : t("当前模型不支持深度思考")} onClick={() => setDeepThinkingEnabled((enabled) => !enabled)}><Sparkles size={14} /> {t("深度思考")}</button>{selectedKnowledgeBases.length > 0 && <button type="button" className="tool-chip is-active" onClick={() => setInspectorOpen(true)}><Archive size={14} /> {t("知识库 {{count}}", { count: selectedKnowledgeBases.length })}</button>}</div>
              {isBusy ? (
                <button className="send-button stop-button" type="button" onClick={stop} aria-label={t("停止生成")}><Square size={14} fill="currentColor" /></button>
              ) : (
                <button className="send-button" type="submit" disabled={!input.trim()} aria-label={t("发送消息")}><ArrowUp size={18} /></button>
              )}
            </div>
          </form>
          <p>{t("Dot 可能会犯错。重要信息请核实。")}</p>
        </footer>
      </section>

      <aside className="inspector" data-open={inspectorOpen}>
        <div className="inspector-header"><span>{t("会话设置")}</span><button className="icon-button" onClick={() => setInspectorOpen(false)} aria-label={t("关闭会话设置")}><X size={17} /></button></div>
        <section className="inspector-section current-model">
          <p className="eyebrow">CURRENT MODEL</p>
          <div className="current-model-name"><i style={{ background: selectedModel?.accent }} /><span><strong>{selectedModel?.name}</strong><small>{selectedModel?.provider}</small></span></div>
          <p>{initialAssistant?.description || selectedModel?.description}</p>
        </section>
        <section className="inspector-section metric-list">
          <div><span><Gauge size={15} /> {t("上下文窗口")}</span><strong>{formatContextWindow(selectedModel?.contextWindow ?? 0)}</strong></div>
          <div><span><Clock3 size={15} /> {t("会话估算")}</span><strong>{t("约 {{count}} tokens", { count: estimatedContextTokens })}</strong></div>
          <div><span><BrainCircuit size={15} /> {t("历史管理")}</span><strong>{contextCompacted ? t("滚动摘要") : t("完整上下文")}</strong></div>
          <div><span><Zap size={15} /> {t("连接状态")}</span><strong>{gatewayEnabled ? t("实时") : t("演示")}</strong></div>
        </section>
        {persistenceEnabled && branches.length > 0 && (
          <section className="inspector-section">
            <div className="section-title"><span>{t("对话分支")}</span><small>{branches.length}</small></div>
            <div className="branch-list">
              {branches.map((branch) => (
                <button
                  data-active={branch.id === activeBranchId}
                  disabled={isBusy}
                  key={branch.id}
                  onClick={() => void switchBranch(branch.id)}
                >
                  <GitBranch size={14} />
                  <span><strong>{branch.name}</strong><small>{branch.messageCount} {t("条消息")}</small></span>
                  {branch.id === activeBranchId && <Check size={14} />}
                </button>
              ))}
            </div>
            <p className="branch-help">{t("分支重试会保留原答案，并从同一问题生成另一条路径。")}</p>
          </section>
        )}
        {persistenceEnabled && (
          <section className="inspector-section">
            <div className="section-title"><span>{t("外部 MCP")}</span><small>{initialMcpSources.filter((source) => source.enabled).length}</small></div>
            {initialMcpSources.filter((source) => source.enabled).length > 0 ? (
              <div className="mcp-inspector-list">
                {initialMcpSources.filter((source) => source.enabled).map((source) => (
                  <div key={source.id}><Link2 size={14} /><span><strong>{source.name}</strong><small>{source.transport.toUpperCase()} · {source.toolCount} 个工具</small></span></div>
                ))}
              </div>
            ) : (
              <p className="branch-help">{t("还没有启用的外部 MCP。可在模型管理中添加。")}</p>
            )}
            <Link className="knowledge-manage-link" href="/admin#mcp-sources">{t("管理 MCP 来源")}</Link>
          </section>
        )}
        {persistenceEnabled && (
          <section className="inspector-section">
            <div className="section-title"><span>外部 Skill</span><small>{initialSkills.filter((skill) => skill.enabled).length}</small></div>
            {initialSkills.filter((skill) => skill.enabled).length > 0 ? (
              <div className="skill-inspector-list">
                {initialSkills.filter((skill) => skill.enabled).map((skill) => (
                  <div key={skill.id}><BookOpen size={14} /><span><strong>{skill.name}</strong><small>{skill.autoLoad ? "自动按问题匹配" : "已启用"}</small></span></div>
                ))}
              </div>
            ) : (
              <p className="branch-help">还没有启用的外部 Skill，可在模型管理中添加。</p>
            )}
            <Link className="knowledge-manage-link" href="/admin#skills">管理外部 Skill</Link>
          </section>
        )}
        {persistenceEnabled && (
          <section className="inspector-section">
            <div className="section-title"><span>{t("知识库")}</span><small>{selectedKnowledgeBases.length} / 3</small></div>
            {initialKnowledgeBases.length > 0 ? (
              <div className="knowledge-selector">
                {initialKnowledgeBases.map((base) => {
                  const active = selectedKnowledgeBaseIds.includes(base.id);
                  return (
                    <button aria-pressed={active} data-active={active} key={base.id} onClick={() => toggleKnowledgeBase(base.id)}>
                      <Archive size={14} />
                  <span><strong>{base.name}</strong><small>{base.documentCount} {t("文档")} · {base.chunkCount} {t("片段")}</small></span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="branch-help">{t("还没有知识库。创建并导入资料后，可让回答基于你的私有内容。")}</p>
            )}
            <Link className="knowledge-manage-link" href="/knowledge">{t("管理知识库")}</Link>
          </section>
        )}
        <section className="inspector-section">
          <div className="section-title"><span>{t("助手指令")}</span><Settings2 size={15} /></div>
          <p className="instruction-copy">{initialAssistant ? t("当前会话由“{{name}}”的专用指令驱动。", { name: assistantName }) : t("可靠、简洁且主动。优先给出明确结论，再补充必要解释。")}</p>
        </section>
        <section className="inspector-section">
          <div className="section-title"><span>{t("当前能力")}</span><small>{selectedModel?.capabilities.length}</small></div>
          <div className="capability-list">{selectedModel?.capabilities.map((capability) => <span key={capability}><Check size={12} /> {capability}</span>)}</div>
        </section>
        <div className="inspector-note"><span className={gatewayEnabled ? "status-live" : "status-demo"} /><p>{gatewayEnabled ? t("请求通过工作区配置的模型供应商安全转发。") : authEnabled ? t("前往模型管理，添加自己的 API Key 后启用真实模型。") : t("登录后可配置自己的模型供应商。")}</p></div>
      </aside>
    </main>
  );
}
