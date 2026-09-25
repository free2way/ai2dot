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
  loadDraft,
  loadPreferences,
  saveDraft,
  savePreferences,
} from "~/lib/storage";
import type {
  BootstrapResponse,
  ExtractedPage,
  SummaryTemplate,
  SyncedPreferences,
} from "~/lib/types";
import "./style.css";

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

function AuthenticatedPanel() {
  const { getToken } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [preferences, setPreferences] = useState<SyncedPreferences>({
    summaryTemplate: "structured",
  });
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [state, setState] = useState<WorkState>("ready");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const selectedModel = useMemo(
    () => bootstrap?.models.find((model) => model.id === preferences.defaultModelId),
    [bootstrap?.models, preferences.defaultModelId],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([loadPreferences(), loadDraft()])
      .then(async ([storedPreferences, draft]) => {
        if (!active) return;
        setPreferences(storedPreferences);
        if (draft) setMarkdown(draft.markdown);
        const token = await getToken();
        if (!token) throw new Error("登录会话尚未就绪，请重新打开扩展。");
        const loaded = await getBootstrap(token);
        if (!active) return;
        setBootstrap(loaded);
        const next = {
          ...storedPreferences,
          defaultModelId:
            storedPreferences.defaultModelId || loaded.models[0]?.id,
          defaultKnowledgeBaseId:
            storedPreferences.defaultKnowledgeBaseId ||
            loaded.knowledgeBases[0]?.id,
        };
        setPreferences(next);
        await savePreferences(next);
      })
      .catch((loadError) => {
        if (active) setError(friendlyError(loadError));
      });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [getToken]);

  async function updatePreferences(next: SyncedPreferences) {
    setPreferences(next);
    await savePreferences(next);
  }

  async function analyzeCurrentPage() {
    if (!bootstrap || !preferences.defaultModelId) return;
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
      setPage(extracted);
      const token = await getToken();
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
          const document = composeMarkdownDocument(
            extracted,
            value,
            selectedModel?.name || preferences.defaultModelId || "AI",
          );
          setMarkdown(document);
        },
      });
      const document = composeMarkdownDocument(
        extracted,
        summary,
        selectedModel?.name || preferences.defaultModelId,
      );
      setMarkdown(document);
      await saveDraft({
        sourceUrl: extracted.url,
        sourceTitle: extracted.title,
        markdown: document,
        updatedAt: new Date().toISOString(),
      });
      setState("ready");
    } catch (analysisError) {
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
        name: markdownFileName(page?.title || "网页摘要"),
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
    anchor.download = markdownFileName(page?.title || "网页摘要");
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
            if (page) {
              void saveDraft({
                sourceUrl: page.url,
                sourceTitle: page.title,
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
  const { isLoaded, isSignedIn } = useAuth();
  const sidePanelUrl = chrome.runtime.getURL("sidepanel.html");

  if (!isLoaded) {
    return (
      <main className="configuration-error">
        <strong>正在连接 ai2dot</strong>
        <p>正在恢复登录会话。</p>
      </main>
    );
  }

  if (isSignedIn) return <AuthenticatedPanel />;

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
  if (!PUBLISHABLE_KEY) {
    return (
      <main className="configuration-error">
        <strong>扩展尚未配置</strong>
        <p>请设置 PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY 后重新构建。</p>
      </main>
    );
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
    >
      <AuthGate />
    </ClerkProvider>
  );
}

export default SidePanel;
