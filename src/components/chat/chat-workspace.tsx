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
  LogOut,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Wrench,
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
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { BrandMark } from "@/components/brand-mark";
import { MarkdownContent } from "@/components/chat/markdown-content";
import {
  SkillPicker,
  type ChatSkillItem,
} from "@/components/chat/skill-picker";
import { getKnowledgeSourceParts } from "@/lib/chat-sources";
import { chatDraftKey, parseChatDraft } from "@/lib/chat-draft";
import { getMessageSkillResolution, hasPendingToolApproval } from "@/lib/skill-execution";
import { createClientUuid } from "@/lib/client-uuid";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import type {
  ConversationBranch,
  ConversationListItem,
} from "@/lib/conversations";
import { filterConversations } from "@/lib/conversations";
import { getGreetingText } from "@/lib/greeting";
import type { KnowledgeBaseSummary } from "@/lib/knowledge";
import {
  DEFAULT_SKILL_SELECTION,
  parseSkillTokens,
  type SkillSelection,
} from "@/lib/skill-selection";
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
        text: "你好，访客。\n\n我已经准备好和你一起思考、写作或推进项目。今天想先处理什么？",
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
const RECENT_SKILLS_KEY = "ai2dot.skills.recent.v1";
const CHAT_TRANSPORT = new DefaultChatTransport({ api: "/api/chat" });

type ChatWorkspaceProps = {
  models: ModelCatalogEntry[];
  authEnabled: boolean;
  authProvider?: "clerk" | "local" | "disabled";
  signedIn?: boolean;
  gatewayEnabled: boolean;
  persistenceEnabled?: boolean;
  storageIdentity?: string;
  explicitSkillsEnabled?: boolean;
  initialConversationId?: string;
  initialBranchId?: string;
  initialMessages?: UIMessage[];
  initialConversations?: ConversationListItem[];
  initialBranches?: ConversationBranch[];
  initialContextCompacted?: boolean;
  initialModelId?: string;
  initialKnowledgeBaseIds?: string[];
  initialMcpSourceIds?: string[];
  initialAssistant?: {
    name: string;
    description?: string | null;
    skillSelection?: SkillSelection;
  };
  initialUserName?: string | null;
  initialKnowledgeBases?: KnowledgeBaseSummary[];
  initialMcpSources?: {
    id: string;
    name: string;
    transport: "http" | "sse";
    enabled: boolean;
    toolCount: number;
    templateId: string | null;
  }[];
  initialSkills?: ChatSkillItem[];
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

function MessageSkillResolution({ message }: { message: UIMessage }) {
  const resolution = getMessageSkillResolution(message);
  if (!resolution) {
    return <p className="message-skill-unrecorded"><BookOpen size={12} /> Skills：未记录</p>;
  }
  const included = resolution.skills.filter((skill) =>
    ["included", "awaiting_approval", "completed", "failed", "stopped"].includes(skill.status),
  );
  const omitted = resolution.skills.filter((skill) => skill.status === "omitted");
  return (
    <details className="message-skill-resolution">
      <summary><BookOpen size={13} /> Skills：{included.length > 0 ? included.map((skill) => `${skill.name} v${skill.version}`).join(" · ") : "本次未调用"}</summary>
      <div>
        <p>{resolution.mode === "auto" ? "自动" : resolution.mode === "manual" ? "手动" : "混合"} · {resolution.contextTarget === "current_message" ? "当前消息" : resolution.contextTarget === "recent_messages" ? "最近消息" : "可用会话上下文"} · 预算 {resolution.budgetTokens.toLocaleString("zh-CN")} tokens（估算）</p>
        {resolution.skills.map((skill) => <span data-status={skill.status} key={skill.versionId}><strong>{skill.name} v{skill.version}</strong><small>{skill.status === "omitted" ? `未调用：${skill.statusReason ?? "策略省略"}` : `已注入工作流 · 约 ${skill.estimatedInputTokens} tokens`}</small></span>)}
        {omitted.length > 0 && <p>有 {omitted.length} 个自动匹配项因依赖或预算未注入。</p>}
      </div>
    </details>
  );
}

type ToolMessagePart = {
  type: string;
  toolName?: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
    isAutomatic?: boolean;
  };
};

function getToolMessagePart(
  part: UIMessage["parts"][number],
): ToolMessagePart | null {
  if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) return null;
  return part as unknown as ToolMessagePart;
}

function formatToolValue(value: unknown) {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2).slice(0, 2_000);
  } catch {
    return String(value).slice(0, 2_000);
  }
}

function ToolActivity({
  part,
  onApproval,
}: {
  part: ToolMessagePart;
  onApproval: (approvalId: string, approved: boolean) => void;
}) {
  const toolName = part.toolName ?? part.type.slice("tool-".length);
  const approval = part.approval;
  const waitingForUser =
    part.state === "approval-requested" && !approval?.isAutomatic;
  const status = waitingForUser
    ? "等待确认"
    : part.state === "output-available"
      ? "已完成"
      : part.state === "output-error"
        ? "执行失败"
        : part.state === "output-denied" ||
            (part.state === "approval-responded" && approval?.approved === false)
          ? "已拒绝"
          : "处理中";

  return (
    <div className="tool-activity">
      <div className="tool-activity-head">
        <span><Wrench size={14} /><strong>{toolName}</strong></span>
        <small data-state={part.state}>{status}</small>
      </div>
      {part.input !== undefined && (
        <details>
          <summary>查看工具参数</summary>
          <pre>{formatToolValue(part.input)}</pre>
        </details>
      )}
      {waitingForUser && approval && (
        <div className="tool-approval-actions">
          <p><ShieldCheck size={15} />此工具可能读取或修改外部数据，确认后才会执行。</p>
          <div>
            <button onClick={() => onApproval(approval.id, false)} type="button"><X size={14} />拒绝</button>
            <button className="is-approve" onClick={() => onApproval(approval.id, true)} type="button"><Check size={14} />允许执行</button>
          </div>
        </div>
      )}
      {part.state === "output-error" && <p className="tool-error">{part.errorText}</p>}
      {part.state === "output-available" && part.output !== undefined && (
        <details>
          <summary>查看执行结果</summary>
          <pre>{formatToolValue(part.output)}</pre>
        </details>
      )}
    </div>
  );
}

export function ChatWorkspace({
  models,
  authEnabled,
  authProvider = "disabled",
  signedIn = false,
  gatewayEnabled,
  persistenceEnabled = false,
  storageIdentity,
  explicitSkillsEnabled = true,
  initialConversationId,
  initialBranchId,
  initialMessages,
  initialConversations = [],
  initialBranches = [],
  initialContextCompacted = false,
  initialModelId,
  initialKnowledgeBaseIds = [],
  initialMcpSourceIds = [],
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
  const [selectedMcpSourceIds, setSelectedMcpSourceIds] = useState<string[]>(
    initialMcpSourceIds.slice(0, 10),
  );
  const initialBranch = initialBranches.find(
    (branch) => branch.id === initialBranchId,
  );
  const inheritedSkillSelection =
    initialBranch?.skillSelection ??
    initialAssistant?.skillSelection ??
    DEFAULT_SKILL_SELECTION;
  const [persistedSkillSelection, setPersistedSkillSelection] =
    useState<SkillSelection>(inheritedSkillSelection);
  const [skillSelection, setSkillSelection] =
    useState<SkillSelection>(inheritedSkillSelection);
  const [skillScope, setSkillScope] = useState<"message" | "branch">("message");
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillSaving, setSkillSaving] = useState(false);
  const [skillOverrideDirty, setSkillOverrideDirty] = useState(false);
  const [skillRevision, setSkillRevision] = useState(
    initialBranch?.skillSelectionRevision ?? 0,
  );
  const [recentSkillVersionIds, setRecentSkillVersionIds] = useState<string[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [contextCompacted, setContextCompacted] = useState(
    initialContextCompacted,
  );
  const [localHour, setLocalHour] = useState<number | null>(null);
  const welcomeName = initialUserName?.trim() || t("访客");
  const profileName = initialUserName?.trim() || t("访客");
  const profileInitial = profileName.slice(0, 1).toUpperCase();
  const greeting = getGreetingText(language, localHour);
  const welcomeMessages = useMemo<UIMessage[]>(
    () => language === "en"
      ? [{ ...WELCOME_MESSAGES[0], parts: [{ type: "text", text: `${greeting}, ${welcomeName}.\n\nI’m ready to think, write, or move a project forward with you. What should we tackle first?` }] }]
      : [{ ...WELCOME_MESSAGES[0], parts: [{ type: "text", text: `${greeting}，${welcomeName}。\n\n我已经准备好和你一起思考、写作或推进项目。今天想先处理什么？` }] }],
    [greeting, language, welcomeName],
  );
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sendErrorRef = useRef<Error | null>(null);
  const retryRef = useRef<{ intent: string; key: string; messageId: string } | null>(null);
  // Creating the persisted conversation must not replace an in-flight SDK chat.
  const [chatInstanceId] = useState(initialConversationId ?? "demo-workspace");

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    setMessages,
    error,
    clearError,
  } = useChat({
    id: chatInstanceId,
    messages: initialMessages && initialMessages.length > 0 ? initialMessages : welcomeMessages,
    transport: CHAT_TRANSPORT,
    throttle: 24,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (error) => { sendErrorRef.current = error; },
  });

  useEffect(() => {
    const updateLocalHour = () => setLocalHour(new Date().getHours());
    updateLocalHour();
    const timer = window.setInterval(updateLocalHour, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMessages((current) =>
      current.map((message) =>
        message.id === "dot-welcome" ? welcomeMessages[0] : message,
      ),
    );
  }, [setMessages, welcomeMessages]);

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
  const availableMcpTemplateIds = initialMcpSources
    .filter(
      (source) =>
        source.enabled &&
        source.toolCount > 0 &&
        source.templateId &&
        selectedMcpSourceIds.includes(source.id),
    )
    .map((source) => source.templateId!)
    .filter((id, index, items) => items.indexOf(id) === index);
  const activeConversation = conversationList.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const isBusy = status === "submitted" || status === "streaming";
  const approvalMessage = messages.at(-1);
  const isAwaitingApproval = Boolean(approvalMessage?.role === "assistant" && hasPendingToolApproval(approvalMessage));
  const skillControlsLocked = isBusy || isAwaitingApproval || skillSaving;
  const recentSkillsKey = `${RECENT_SKILLS_KEY}:${storageIdentity ?? "demo"}`;
  const draftKey = storageIdentity ? chatDraftKey(storageIdentity, activeConversationId, activeBranchId) : undefined;
  const returnTo = activeConversationId && activeBranchId
    ? `/chat/${activeConversationId}?branch=${activeBranchId}` : "/workspace";

  const saveComposerDraft = () => {
    if (!draftKey) return;
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify({
        input, selection: skillSelection, scope: skillScope,
        overrideDirty: skillOverrideDirty, savedAt: Date.now(),
      }));
    } catch { /* Draft storage is optional when browser storage is unavailable. */ }
  };

  useEffect(() => {
    if (!draftKey) return;
    const timer = window.setTimeout(() => {
      try {
      const draft = parseChatDraft(window.sessionStorage.getItem(draftKey));
      if (draft) {
        setInput(draft.input);
        setSkillSelection(draft.selection);
        setSkillScope(draft.scope);
        setSkillOverrideDirty(draft.overrideDirty);
      }
      window.sessionStorage.removeItem(draftKey);
      } catch { /* Browsers may disable session storage. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);
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

  const toggleMcpSource = (sourceId: string) => {
    if (initialAssistant) return;
    setSelectedMcpSourceIds((current) =>
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId].slice(-10),
    );
  };

  const approvalRequestOptions = (message: UIMessage) => {
    const parentGenerationId = getMessageSkillResolution(message)?.generationId;
    if (persistenceEnabled && !parentGenerationId) {
      throw new Error("此工具请求没有可恢复的执行记录，请重新发起任务。");
    }
    return {
    body: {
      modelId: selectedModelId,
      knowledgeBaseIds: selectedKnowledgeBaseIds,
      mcpSourceIds: selectedMcpSourceIds,
      conversationId: activeConversationId,
      branchId: activeBranchId,
      idempotencyKey: createClientUuid(),
      reasoning: useDeepThinking ? "high" : "provider-default",
      ...(parentGenerationId ? { continuation: { parentGenerationId } } : {}),
    },
    };
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
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(
          window.localStorage.getItem(recentSkillsKey) ?? "[]",
        ) as string[];
        setRecentSkillVersionIds(
          stored
            .filter((id) => initialSkills.some((skill) => skill.versionId === id))
            .slice(0, 6),
        );
      } catch {
        window.localStorage.removeItem(recentSkillsKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSkills, recentSkillsKey]);

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
        skillSelection: null,
        skillSelectionRevision: 0,
      },
    ]);
    setPersistedSkillSelection(DEFAULT_SKILL_SELECTION);
    setSkillSelection(DEFAULT_SKILL_SELECTION);
    setSkillRevision(0);
    setSkillOverrideDirty(false);
    window.history.replaceState(null, "", `/chat/${conversation.id}`);
    return { conversationId: conversation.id, branchId: payload.conversation.branchId };
  };

  const saveBranchSkillSelection = async (
    selection: SkillSelection | null = skillSelection,
    conversationId = activeConversationId,
    branchId = activeBranchId,
  ) => {
    if (!conversationId || !branchId) return false;
    setSkillSaving(true);
    setCloudError(undefined);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/branches/${branchId}/skills`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: skillRevision, selection }),
        },
      );
      const payload = (await response.json()) as {
        code?: string;
        message?: string;
        selection?: SkillSelection;
        savedSelection?: SkillSelection | null;
        revision?: number;
      };
      if (!response.ok || !payload.selection || payload.revision === undefined) {
        throw new Error(
          payload.message ||
            (payload.code === "SKILL_SELECTION_CONFLICT"
              ? "Skill 配置已被其他窗口更新，请刷新后重试。"
              : "Skill 配置保存失败。"),
        );
      }
      setSkillRevision(payload.revision);
      setPersistedSkillSelection(payload.selection);
      setSkillSelection(payload.selection);
      setSkillOverrideDirty(false);
      setBranches((items) =>
        items.map((branch) =>
          branch.id === branchId
            ? {
                ...branch,
                skillSelection: payload.savedSelection ?? null,
                skillSelectionRevision: payload.revision!,
              }
            : branch,
        ),
      );
      setSessionNotice(
        selection ? "当前会话的 Skill 配置已保存。" : "已恢复助手或自动配置。",
      );
      return true;
    } catch (saveError) {
      setCloudError(
        saveError instanceof Error ? saveError.message : "Skill 配置保存失败。",
      );
      return false;
    } finally {
      setSkillSaving(false);
    }
  };

  const submit = async (text = input) => {
    const originalValue = text.trim();
    const parsedTokens = parseSkillTokens(originalValue);
    const value = parsedTokens.text;
    if (!originalValue || isBusy || isAwaitingApproval) return;
    clearError();
    setCloudError(undefined);
    setIsNearBottom(true);
    let sent = false;

    try {
      let requestSkillSelection = skillSelection;
      let hasMessageOverride = skillOverrideDirty;
      if (parsedTokens.slugs.length > 0) {
        const tokenSkills = parsedTokens.slugs.map((slug) =>
          initialSkills.find(
            (skill) =>
              skill.slug === slug ||
              skill.catalogId === slug ||
              skill.slug.replace(/^(builtin|catalog)-/, "") === slug,
          ),
        );
        const missingSlug = parsedTokens.slugs.find(
          (_slug, index) => !tokenSkills[index],
        );
        if (missingSlug) {
          throw new Error(
            `未找到已安装的 Skill“${missingSlug}”，请从选择器中确认。`,
          );
        }
        const refs = [...requestSkillSelection.refs];
        for (const skill of tokenSkills) {
          if (!skill) continue;
          if (!refs.some((reference) => reference.versionId === skill.versionId)) {
            refs.push({ skillId: skill.id, versionId: skill.versionId });
          }
        }
        if (refs.length > 3) {
          throw new Error("每次最多选择 3 个 Skill，请先移除一个再发送。");
        }
        requestSkillSelection = {
          ...requestSkillSelection,
          mode: "manual",
          refs,
        };
        hasMessageOverride = true;
        setSkillSelection(requestSkillSelection);
      }
      const created =
        persistenceEnabled && !activeConversationId
          ? await createCloudConversation()
          : undefined;
      const conversationId = created?.conversationId ?? activeConversationId;
      const branchId = created?.branchId ?? activeBranchId;
      if (created && hasMessageOverride) {
        setSkillSelection(requestSkillSelection);
        setSkillOverrideDirty(true);
      }

      if (skillScope === "branch" && hasMessageOverride) {
        const saved = await saveBranchSkillSelection(
          requestSkillSelection,
          conversationId,
          branchId,
        );
        if (!saved) return;
        hasMessageOverride = false;
      }
      const body = {
        modelId: selectedModelId,
        knowledgeBaseIds: selectedKnowledgeBaseIds,
        mcpSourceIds: selectedMcpSourceIds,
        conversationId,
        branchId,
        reasoning: useDeepThinking ? "high" : "provider-default",
        ...(hasMessageOverride ? { skillSelection: requestSkillSelection } : {}),
      };
      const intent = JSON.stringify({ text: originalValue, body });
      const retry = retryRef.current?.intent === intent
        ? retryRef.current
        : { intent, key: createClientUuid(), messageId: createClientUuid() };
      retryRef.current = retry;
      sendErrorRef.current = null;
      await sendMessage(
        {
          id: retry.messageId,
          role: "user",
          parts: [{ type: "text", text: originalValue }],
          ...(messages.some((message) => message.id === retry.messageId)
            ? { messageId: retry.messageId } : {}),
        },
        {
          body: { ...body, idempotencyKey: retry.key },
        },
      );
      if (sendErrorRef.current) throw sendErrorRef.current;
      retryRef.current = null;
      sent = true;
      if (requestSkillSelection.refs.length > 0) {
        const recent = [
          ...requestSkillSelection.refs.map((reference) => reference.versionId),
          ...recentSkillVersionIds,
        ].filter((id, index, items) => items.indexOf(id) === index).slice(0, 6);
        setRecentSkillVersionIds(recent);
        window.localStorage.setItem(recentSkillsKey, JSON.stringify(recent));
      }
      if (hasMessageOverride && skillScope === "message") {
        setSkillSelection(persistedSkillSelection);
        setSkillOverrideDirty(false);
      }
      if (
        messages.length + 1 > 18 ||
        estimatedContextCharacters + originalValue.length > 28_000
      ) {
        setContextCompacted(true);
      }
      if (conversationId) {
        setConversationList((items) => {
          const current = items.find((item) => item.id === conversationId);
          if (!current) return items;
          const updated = {
            ...current,
            title: current.title === "新对话" ? (value || originalValue).slice(0, 48) : current.title,
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
    if (sent) setInput("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      skillPickerOpen &&
      ["Enter", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)
    ) {
      event.preventDefault();
      return;
    }
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
      const nextBranch = payload.branches?.find(
        (branch) => branch.id === branchId,
      );
      const nextSkillSelection =
        nextBranch?.skillSelection ??
        initialAssistant?.skillSelection ??
        DEFAULT_SKILL_SELECTION;
      setPersistedSkillSelection(nextSkillSelection);
      setSkillSelection(nextSkillSelection);
      setSkillRevision(nextBranch?.skillSelectionRevision ?? 0);
      setSkillOverrideDirty(false);
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
          mcpSourceIds: selectedMcpSourceIds,
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
      const forkSkillSelection =
        payload.branch.skillSelection ??
        initialAssistant?.skillSelection ??
        DEFAULT_SKILL_SELECTION;
      setPersistedSkillSelection(forkSkillSelection);
      setSkillSelection(forkSkillSelection);
      setSkillRevision(payload.branch.skillSelectionRevision);
      setSkillOverrideDirty(false);
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
          mcpSourceIds: selectedMcpSourceIds,
          conversationId: activeConversationId,
          branchId: payload.branch.id,
          idempotencyKey: createClientUuid(),
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
          <Link className="nav-row" href="/notebooks"><BookOpen size={17} /> {t("研究空间")}</Link>
          <Link className="nav-row" href="/assistants"><Bot size={17} /> {t("助手")}</Link>
          <Link className="nav-row" href={`/skills?returnTo=${encodeURIComponent(returnTo)}`} onClick={saveComposerDraft}><BookOpen size={17} /> Skills <span>{initialSkills.length}</span></Link>
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
            {authProvider === "clerk" ? (
              <Show
                when="signed-in"
                fallback={<Link className="sign-in-link" href="/sign-in">{t("登录")}</Link>}
              >
                <UserButton />
              </Show>
            ) : signedIn ? (
              <form action="/api/auth/sign-out" method="post">
                <button
                  aria-label={t("退出登录")}
                  className="icon-button"
                  title={t("退出登录")}
                  type="submit"
                >
                  <LogOut size={17} />
                </button>
              </form>
            ) : (
              <Link className="sign-in-link" href="/sign-in">{t("登录")}</Link>
            )}
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
                    {message.parts.map((part, partIndex) => {
                      if (part.type === "text") {
                        return <MarkdownContent key={`${message.id}-${partIndex}`}>{part.text}</MarkdownContent>;
                      }
                      const toolPart = getToolMessagePart(part);
                      if (!toolPart) return null;
                      return (
                        <ToolActivity
                          key={`${message.id}-${partIndex}`}
                          part={toolPart}
                          onApproval={(approvalId, approved) => {
                            try {
                              void addToolApprovalResponse({
                                id: approvalId,
                                approved,
                                options: approvalRequestOptions(message),
                              });
                            } catch (approvalError) {
                              setCloudError(approvalError instanceof Error ? approvalError.message : "工具确认失败。");
                            }
                          }}
                        />
                      );
                    })}
                    {isBusy && messageIndex === messages.length - 1 && message.role === "assistant" && <span className="stream-caret" />}
                  </div>
                  <MessageKnowledgeSources message={message} />
                  {message.role === "assistant" && message.id !== "dot-welcome" && !message.id.startsWith("assistant-welcome-") && <MessageSkillResolution message={message} />}
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
            {skillSelection.refs.length > 0 && (
              <div className="composer-skill-tags">
                {skillSelection.refs.map((reference) => {
                  const skill = initialSkills.find(
                    (item) => item.versionId === reference.versionId,
                  );
                  return skill ? <button disabled={skillControlsLocked} key={reference.versionId} onClick={() => { setSkillSelection((current) => ({ ...current, mode: "manual", refs: current.refs.filter((item) => item.versionId !== reference.versionId) })); setSkillOverrideDirty(true); }} type="button"><BookOpen size={11} />{skill.name}<X size={11} /></button> : null;
                })}
              </div>
            )}
            <textarea ref={composerTextareaRef} value={input} onChange={(event) => { setInput(event.target.value); if (/(^|\s)\/skill\s*$/.test(event.target.value)) setSkillPickerOpen(true); }} onKeyDown={handleComposerKeyDown} placeholder={`${t("继续提问，或让{{name}}完善上面的结果…", { name: assistantName })}`} rows={1} aria-label={t("消息")} />
            <div className="composer-toolbar">
              <div><button type="button" className={`tool-chip${useDeepThinking ? " is-active" : ""}`} disabled={!supportsDeepThinking} aria-pressed={useDeepThinking} title={supportsDeepThinking ? t("为下一次回答使用高强度推理") : t("当前模型不支持深度思考")} onClick={() => setDeepThinkingEnabled((enabled) => !enabled)}><Sparkles size={14} /> {t("深度思考")}</button><button type="button" className={`tool-chip${skillSelection.refs.length > 0 || skillSelection.mode === "manual" ? " is-active" : ""}`} aria-expanded={skillPickerOpen} disabled={!persistenceEnabled || !explicitSkillsEnabled || skillControlsLocked} onClick={() => setSkillPickerOpen((open) => !open)}><BookOpen size={14} /> Skills {skillSelection.refs.length > 0 ? skillSelection.refs.length : skillSelection.mode === "auto" ? "自动" : ""}</button>{selectedKnowledgeBases.length > 0 && <button type="button" className="tool-chip is-active" onClick={() => setInspectorOpen(true)}><Archive size={14} /> {t("知识库 {{count}}", { count: selectedKnowledgeBases.length })}</button>}</div>
              {isBusy ? (
                <button className="send-button stop-button" type="button" onClick={stop} aria-label={t("停止生成")}><Square size={14} fill="currentColor" /></button>
              ) : (
                <button className="send-button" type="submit" disabled={!input.trim() || isAwaitingApproval} aria-label={t("发送消息")}><ArrowUp size={18} /></button>
              )}
            </div>
            <SkillPicker
              open={skillPickerOpen && !skillControlsLocked && explicitSkillsEnabled}
              libraryHref={`/skills?returnTo=${encodeURIComponent(returnTo)}`}
              onNavigate={saveComposerDraft}
              skills={initialSkills}
              selection={skillSelection}
              scope={skillScope}
              availableMcpTemplateIds={availableMcpTemplateIds}
              recentSkillVersionIds={recentSkillVersionIds}
              canSaveBranch={Boolean(activeConversationId && activeBranchId)}
              saving={skillSaving}
              onOpenChange={setSkillPickerOpen}
              onSelectionChange={(selection) => { setSkillSelection(selection); setSkillOverrideDirty(true); setInput((current) => current.replace(/(^|\s)\/skill\s*/g, "$1").trimStart()); }}
              onScopeChange={setSkillScope}
              onSaveBranch={() => void saveBranchSkillSelection()}
              onRestoreInherited={() => void saveBranchSkillSelection(null)}
              onRestoreDefault={() => { setSkillSelection(persistedSkillSelection); setSkillOverrideDirty(false); }}
            />
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
            <div className="section-title"><span>{t("外部 MCP")}</span><small>{selectedMcpSourceIds.length} / {initialMcpSources.filter((source) => source.enabled).length}</small></div>
            {initialMcpSources.filter((source) => source.enabled).length > 0 ? (
              <div className="mcp-inspector-list">
                {initialMcpSources.filter((source) => source.enabled).map((source) => (
                  <button
                    aria-pressed={selectedMcpSourceIds.includes(source.id)}
                    data-active={selectedMcpSourceIds.includes(source.id)}
                    disabled={Boolean(initialAssistant)}
                    key={source.id}
                    onClick={() => toggleMcpSource(source.id)}
                    type="button"
                  >
                    <Link2 size={14} />
                    <span><strong>{source.name}</strong><small>{source.transport.toUpperCase()} · {source.toolCount} 个工具</small></span>
                    {selectedMcpSourceIds.includes(source.id) && <Check size={14} />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="branch-help">{t("还没有启用的外部 MCP。可在模型管理中添加。")}</p>
            )}
            <p className="branch-help">{initialAssistant ? t("MCP 白名单由当前助手配置锁定。") : t("只有明确选中的 MCP 来源会提供给模型。")}</p>
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
