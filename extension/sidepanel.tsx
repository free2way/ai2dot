import {
  ClerkProvider,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/chrome-extension";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getBootstrap,
  openKnowledgeBaseManagement,
  openModelManagement,
  summarizePage,
  uploadMarkdown,
  waitForKnowledgeDocument,
} from "~/lib/api-client";
import {
  composeMarkdownDocument,
  extractCurrentPage,
  markdownFileName,
} from "~/lib/extraction";
import {
  clearAccountDrafts,
  clearLegacyDraft,
  loadDraft,
  loadPreferences,
  saveDraft,
  savePreferences,
  type ExtensionStorageScope,
} from "~/lib/storage";
import type {
  BootstrapResponse,
  ExtractedPage,
  SummaryTemplate,
  SyncedPreferences,
} from "~/lib/types";
import "./style.css";
import { loadPublicAuthKey, normalizePublishableKey, savePublicAuthKey } from "~/lib/auth-config";

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST;

type WorkState =
  | "ready"
  | "extracting"
  | "summarizing"
  | "uploading"
  | "uploaded";

function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

function AuthenticatedPanel({ userId }: { userId: string }) {
  const { getToken } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [storageScope, setStorageScope] = useState<ExtensionStorageScope | null>(null);
  const [preferences, setPreferences] = useState<SyncedPreferences>({
    summaryTemplate: "structured",
  });
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [source, setSource] = useState<{ sourceUrl: string; sourceTitle: string } | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [state, setState] = useState<WorkState>("ready");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const selectedModel = useMemo(
    () => bootstrap?.models.find((model) => model.id === preferences.defaultModelId),
    [bootstrap?.models, preferences.defaultModelId],
  );

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    void (async () => {
      await clearLegacyDraft();
      const token = await getToken();
      if (!token) throw new Error("登录会话尚未就绪，请重新打开扩展。");
      const loaded = await getBootstrap(token);
      if (!active) return;
      const scope = { userId, workspaceId: loaded.workspace.id };
      const [storedPreferences, draft] = await Promise.all([
        loadPreferences(scope), loadDraft(scope),
      ]);
      if (!active) return;
      setStorageScope(scope);
      setBootstrap(loaded);
      setMarkdown(draft?.markdown ?? "");
      setSource(draft ? { sourceUrl: draft.sourceUrl, sourceTitle: draft.sourceTitle } : null);
      const next = {
        ...storedPreferences,
        defaultModelId:
          loaded.models.some((model) => model.id === storedPreferences.defaultModelId)
            ? storedPreferences.defaultModelId : loaded.models[0]?.id,
        defaultKnowledgeBaseId:
          loaded.knowledgeBases.some((base) => base.id === storedPreferences.defaultKnowledgeBaseId)
            ? storedPreferences.defaultKnowledgeBaseId : loaded.knowledgeBases[0]?.id,
      };
      setPreferences(next);
      await savePreferences(scope, next);
    })()
      .catch((loadError) => {
        if (active) setError(friendlyError(loadError));
      });
    return () => {
      active = false;
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [getToken, userId]);

  async function updatePreferences(next: SyncedPreferences) {
    if (!storageScope) return;
    setPreferences(next);
    await savePreferences(storageScope, next);
  }

  async function analyzeCurrentPage() {
    if (!bootstrap || !storageScope || !preferences.defaultModelId) return;
    setError("");
    setState("extracting");
    try {
      const extracted = await extractCurrentPage(
        Math.min(
          bootstrap.limits.maxPageCharacters,
          selectedModel?.contextWindow
            ? Math.max(4_000, Math.floor(selectedModel.contextWindow * 0.55))
            : bootstrap.limits.maxPageCharacters,
        ),
      );
      if (!mountedRef.current) return;
      setPage(extracted);
      setSource({ sourceUrl: extracted.url, sourceTitle: extracted.title });
      const token = await getToken();
      if (!mountedRef.current) return;
      if (!token) throw new Error("登录会话已失效，请重新登录。");
      const controller = new AbortController();
      abortRef.current = controller;
      setState("summarizing");
      const summary = await summarizePage({
        token,
        modelId: preferences.defaultModelId,
        page: extracted,
        template: preferences.summaryTemplate,
        signal: controller.signal,
        onDelta(value) {
          if (!mountedRef.current) return;
          const document = composeMarkdownDocument(
            extracted,
            value,
            selectedModel?.name || preferences.defaultModelId || "AI",
          );
          setMarkdown(document);
        },
      });
      if (!mountedRef.current) return;
      const document = composeMarkdownDocument(
        extracted,
        summary,
        selectedModel?.name || preferences.defaultModelId,
      );
      setMarkdown(document);
      await saveDraft(storageScope, {
        sourceUrl: extracted.url,
        sourceTitle: extracted.title,
        markdown: document,
        updatedAt: new Date().toISOString(),
      });
      setState("ready");
    } catch (analysisError) {
      if (!mountedRef.current) return;
      if ((analysisError as Error).name !== "AbortError") {
        setError(friendlyError(analysisError));
      }
      setState("ready");
    } finally {
      abortRef.current = null;
    }
  }

  async function handleUpload() {
    if (!markdown || !preferences.defaultKnowledgeBaseId) return;
    setError("");
    setState("uploading");
    try {
      const token = await getToken();
      if (!token) throw new Error("登录会话已失效，请重新登录。");
      const uploaded = await uploadMarkdown({
        token,
        knowledgeBaseId: preferences.defaultKnowledgeBaseId,
        name: markdownFileName(source?.sourceTitle || "网页摘要"),
        content: markdown,
      });
      await waitForKnowledgeDocument({
        token,
        knowledgeBaseId: preferences.defaultKnowledgeBaseId,
        documentId: uploaded.document.id,
      });
      setState("uploaded");
    } catch (uploadError) {
      setError(friendlyError(uploadError));
      setState("ready");
    }
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = markdownFileName(source?.sourceTitle || "网页摘要");
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const busy = state === "extracting" || state === "summarizing" || state === "uploading";

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div className="brand-mark">D</div>
        <div className="brand-copy">
          <strong>ai2dot</strong>
          <span>WEB CLIPPER</span>
        </div>
        <UserButton />
      </header>

      <section className="control-section">
        <div className="section-title">
          <div>
            <span>MODEL</span>
            <h1>页面分析</h1>
          </div>
          <button className="text-button" onClick={() => void openModelManagement()}>
            管理模型
          </button>
        </div>

        <label>
          AI 模型
          <select
            disabled={!bootstrap || busy}
            value={preferences.defaultModelId || ""}
            onChange={(event) =>
              void updatePreferences({
                ...preferences,
                defaultModelId: event.target.value,
              })
            }
          >
            {!bootstrap?.models.length ? <option value="">暂无可用模型</option> : null}
            {bootstrap?.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} · {model.provider}
              </option>
            ))}
          </select>
        </label>

        <div className="template-control" aria-label="总结模板">
          {(["concise", "structured", "detailed"] as SummaryTemplate[]).map(
            (template) => (
              <button
                className={preferences.summaryTemplate === template ? "active" : ""}
                disabled={busy}
                key={template}
                onClick={() =>
                  void updatePreferences({ ...preferences, summaryTemplate: template })
                }
              >
                {template === "concise"
                  ? "精简"
                  : template === "structured"
                    ? "结构化"
                    : "详细"}
              </button>
            ),
          )}
        </div>

        <button
          className="primary-button"
          disabled={busy || !preferences.defaultModelId}
          onClick={() => void analyzeCurrentPage()}
        >
          {state === "extracting"
            ? "正在提取页面"
            : state === "summarizing"
              ? "正在生成 Markdown"
              : "分析当前页面"}
        </button>
        {state === "summarizing" ? (
          <button className="secondary-button" onClick={() => abortRef.current?.abort()}>
            停止生成
          </button>
        ) : null}
      </section>

      {page ? (
        <section className="source-strip">
          <strong>{page.title}</strong>
          <span>
            {new URL(page.url).hostname} · {page.characterCount.toLocaleString()} 字符 · {page.mode}
          </span>
        </section>
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}

      <section className="editor-section">
        <div className="editor-heading">
          <span>MARKDOWN</span>
          <small>{markdown.length.toLocaleString()} 字符</small>
        </div>
        <textarea
          aria-label="Markdown 内容"
          disabled={state === "extracting"}
          onChange={(event) => {
            setMarkdown(event.target.value);
            if (state === "uploaded") setState("ready");
            if (source && storageScope) {
              void saveDraft(storageScope, {
                ...source,
                markdown: event.target.value,
                updatedAt: new Date().toISOString(),
              });
            }
          }}
          placeholder="分析结果会显示在这里。"
          spellCheck={false}
          value={markdown}
        />
      </section>

      <section className="save-section">
        <div className="save-heading">
          <span>DESTINATION</span>
          <button
            className="text-button"
            onClick={() => void openKnowledgeBaseManagement()}
          >
            管理知识库
          </button>
        </div>
        <label>
          目标知识库
          <select
            disabled={!bootstrap || busy}
            value={preferences.defaultKnowledgeBaseId || ""}
            onChange={(event) =>
              void updatePreferences({
                ...preferences,
                defaultKnowledgeBaseId: event.target.value,
              })
            }
          >
            {!bootstrap?.knowledgeBases.length ? (
              <option value="">暂无知识库</option>
            ) : null}
            {bootstrap?.knowledgeBases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name} · {base.documentCount} 文档
              </option>
            ))}
          </select>
        </label>
        <div className="save-actions">
          <button className="secondary-button" disabled={!markdown || busy} onClick={handleDownload}>
            下载 .md
          </button>
          <button
            className="primary-button"
            disabled={!markdown || !preferences.defaultKnowledgeBaseId || busy}
            onClick={() => void handleUpload()}
          >
            {state === "uploading"
              ? "正在上传并索引"
              : state === "uploaded"
                ? "已保存"
                : "保存到知识库"}
          </button>
        </div>
      </section>
    </main>
  );
}

function AuthGate() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const previousUserId = useRef<string | null>(null);
  const activeUserId = isSignedIn ? userId ?? null : null;
  const sidePanelUrl = chrome.runtime.getURL("sidepanel.html");

  useEffect(() => {
    if (!isLoaded) return;
    const previous = previousUserId.current;
    previousUserId.current = activeUserId;
    if (previous && previous !== activeUserId) {
      void clearAccountDrafts(previous).catch(() => undefined);
    }
    void clearLegacyDraft().catch(() => undefined);
  }, [activeUserId, isLoaded]);

  if (!isLoaded) {
    return (
      <main className="configuration-error">
        <strong>正在连接 ai2dot</strong>
        <p>正在恢复登录会话。</p>
      </main>
    );
  }

  if (isSignedIn && activeUserId) return <AuthenticatedPanel key={activeUserId} userId={activeUserId} />;

  return (
    <main className="sign-in-shell">
      <div className="sign-in-mark">D</div>
      <p>AI2DOT WEB CLIPPER</p>
      <h1>把当前页面整理成可用知识</h1>
      <SignInButton
        fallbackRedirectUrl={sidePanelUrl}
        mode="modal"
        signUpFallbackRedirectUrl={sidePanelUrl}
      >
        <button className="primary-button">登录 ai2dot</button>
      </SignInButton>
      <small>扩展只在你主动点击后读取当前页面。</small>
    </main>
  );
}

function SidePanel() {
  const [publishableKey, setPublishableKey] = useState<string | null>(normalizePublishableKey(PUBLISHABLE_KEY));
  const [loading, setLoading] = useState(!PUBLISHABLE_KEY);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (PUBLISHABLE_KEY) return;
    let active = true;
    void loadPublicAuthKey().then((key) => {
      if (active) setPublishableKey(key);
    }).catch(() => {
      if (active) setError("无法读取浏览器本地配置，请重试。");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <main className="configuration-error"><strong>正在读取本地登录配置…</strong></main>;
  if (!publishableKey || editing) {
    return (
      <main className="configuration-error">
        <strong>配置扩展登录</strong>
        <p>发布包不包含登录 key。请填写 ai2dot 对应的 Clerk 公开登录参数，仅保存在当前浏览器，不会上传到 GitHub。不要填写 Secret Key。</p>
        <form className="auth-config-form" onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          void savePublicAuthKey(value).then((key) => {
            setPublishableKey(key);
            setValue("");
            setEditing(false);
          }).catch((saveError) => setError(friendlyError(saveError))).finally(() => setSaving(false));
        }}>
          <label>Clerk Publishable Key<input autoComplete="off" spellCheck={false} value={value} onChange={(event) => setValue(event.target.value)} placeholder="公开登录参数" required /></label>
          {error && <p role="alert">{error}</p>}
          <button className="primary-button" disabled={saving}>{saving ? "正在保存…" : "保存并登录"}</button>
          {publishableKey && <button type="button" className="secondary-button" onClick={() => setEditing(false)}>取消</button>}
        </form>
      </main>
    );
  }

  return (
    <>
      <ClerkProvider publishableKey={publishableKey} syncHost={SYNC_HOST || "https://ai.ai2dot.com"}>
        <AuthGate />
      </ClerkProvider>
      <button className="auth-config-edit" onClick={() => { setValue(""); setError(""); setEditing(true); }}>登录配置</button>
    </>
  );
}

export default SidePanel;
