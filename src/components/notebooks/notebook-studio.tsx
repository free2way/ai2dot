"use client";

import {
  Archive,
  ArrowLeft,
  BookUp2,
  BookOpen,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Cloud,
  ExternalLink,
  FileSearch,
  FileText,
  Headphones,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Network,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { LanguageSwitcher } from "@/lib/i18n";
import type { KnowledgeSearchResult } from "@/lib/knowledge";
import type { ModelCatalogEntry } from "@/lib/models";
import type {
  GoogleNotebookProviderStatus,
  NotebookArtifactType,
  NotebookDetail,
  NotebookSummary,
} from "@/lib/notebooks";

type Tab = "sources" | "studio" | "provider";

const artifactOptions: { type: NotebookArtifactType; label: string; description: string }[] = [
  { type: "summary", label: "研究摘要", description: "提炼结论、依据与下一步" },
  { type: "faq", label: "常见问题", description: "生成带来源引用的问答" },
  { type: "timeline", label: "时间线", description: "按日期组织关键事件" },
  { type: "study_guide", label: "学习指南", description: "目标、要点与自测题" },
  { type: "mind_map", label: "思维导图", description: "层级化整理主题结构" },
];

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function providerTone(status: GoogleNotebookProviderStatus) {
  if (status.network === "unreachable") return "danger";
  if (status.network === "reachable") return "ready";
  if (status.enabled) return "attention";
  return "muted";
}

export function NotebookStudio({
  initialNotebooks,
  models,
  googleStatus: initialGoogleStatus,
}: {
  initialNotebooks: NotebookSummary[];
  models: ModelCatalogEntry[];
  googleStatus: GoogleNotebookProviderStatus;
}) {
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [selectedId, setSelectedId] = useState(initialNotebooks[0]?.id);
  const [detail, setDetail] = useState<NotebookDetail>();
  const [tab, setTab] = useState<Tab>("sources");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [createOpen, setCreateOpen] = useState(initialNotebooks.length === 0);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoTranscript, setVideoTranscript] = useState("");
  const [videoTranscriptOrigin, setVideoTranscriptOrigin] = useState<"pasted" | "subtitle_upload">("pasted");
  const [videoFileName, setVideoFileName] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [artifactType, setArtifactType] = useState<NotebookArtifactType>("summary");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [googleStatus, setGoogleStatus] = useState(initialGoogleStatus);
  const [editingArtifactId, setEditingArtifactId] = useState<string>();
  const [artifactDraftTitle, setArtifactDraftTitle] = useState("");
  const [artifactDraftContent, setArtifactDraftContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selected = notebooks.find((item) => item.id === selectedId);
  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelCatalogEntry[]>();
    for (const model of models) groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
    return [...groups.entries()];
  }, [models]);
  const videoDocumentIds = useMemo(
    () => new Set(detail?.videoSources.map((source) => source.knowledgeDocumentId) ?? []),
    [detail?.videoSources],
  );
  const regularDocuments = useMemo(
    () => detail?.documents.filter((document) => !videoDocumentIds.has(document.id)) ?? [],
    [detail?.documents, videoDocumentIds],
  );

  const refreshList = useCallback(async (preferredId?: string) => {
    const response = await fetch("/api/notebooks", { cache: "no-store" });
    if (!response.ok) throw new Error("研究空间列表刷新失败。");
    const payload = (await response.json()) as { notebooks: NotebookSummary[] };
    setNotebooks(payload.notebooks);
    setSelectedId((current) => {
      const candidate = preferredId ?? current;
      return payload.notebooks.some((item) => item.id === candidate)
        ? candidate
        : payload.notebooks[0]?.id;
    });
  }, []);

  const loadDetail = useCallback(async (notebookId: string) => {
    const response = await fetch(`/api/notebooks/${notebookId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("研究空间加载失败。");
    const payload = (await response.json()) as { notebook: NotebookDetail };
    setDetail(payload.notebook);
    return payload.notebook;
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void fetch(`/api/notebooks/${selectedId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { notebook: NotebookDetail };
      })
      .then((payload) => {
        if (!cancelled) setDetail(payload.notebook);
      })
      .catch(() => {
        if (!cancelled) setNotice("研究空间加载失败，请刷新后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const hasProcessingSources = detail?.documents.some(
    (document) =>
      document.status === "processing" ||
      document.embeddingStatus === "pending" ||
      document.embeddingStatus === "processing",
  );

  useEffect(() => {
    if (!selectedId || !hasProcessingSources) return;
    const timer = window.setInterval(() => {
      void loadDetail(selectedId).then(() => refreshList(selectedId)).catch(() => undefined);
    }, 1_800);
    return () => window.clearInterval(timer);
  }, [hasProcessingSources, loadDetail, refreshList, selectedId]);

  const createNotebook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: form.get("title"), description: form.get("description") }),
      });
      const payload = (await response.json()) as { notebook?: { id: string }; message?: string };
      if (!response.ok || !payload.notebook) throw new Error(payload.message || "创建失败。");
      await refreshList(payload.notebook.id);
      setCreateOpen(false);
      setNotice("研究空间已创建，可以开始添加来源。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建失败。");
    } finally {
      setBusy(false);
    }
  };

  const uploadSource = async (form: FormData) => {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/knowledge-bases/${detail.knowledgeBaseId}/documents`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "来源导入失败。");
      await Promise.all([loadDetail(detail.id), refreshList(detail.id)]);
      setPasteOpen(false);
      setNotice("来源已提交，正在解析并建立混合检索索引。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "来源导入失败。");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importVideoSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(`/api/notebooks/${detail.id}/video-sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: form.get("url"),
          language: form.get("language"),
          transcript: videoTranscript,
          transcriptOrigin: videoTranscriptOrigin,
          rightsConfirmed: form.get("rightsConfirmed") === "on",
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "视频来源导入失败。");
      await Promise.all([loadDetail(detail.id), refreshList(detail.id)]);
      setVideoOpen(false);
      setVideoTranscript("");
      setVideoTranscriptOrigin("pasted");
      setVideoFileName("");
      setNotice("视频字幕已保存为来源，可以进入 Studio 生成带时间戳的摘要。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "视频来源导入失败。");
    } finally {
      setBusy(false);
    }
  };

  const loadSubtitleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setNotice("字幕文件不能超过 4MB。");
      return;
    }
    try {
      setVideoTranscript(await file.text());
      setVideoTranscriptOrigin("subtitle_upload");
      setVideoFileName(file.name);
    } catch {
      setNotice("字幕文件读取失败。");
    }
  };

  const deleteSource = async (documentId: string, name: string) => {
    if (!detail || !window.confirm(`删除来源“${name}”？`)) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/knowledge-bases/${detail.knowledgeBaseId}/documents/${documentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      await Promise.all([loadDetail(detail.id), refreshList(detail.id)]);
      setNotice("来源已删除，已有研究产物会保留。");
    } catch {
      setNotice("来源删除失败。");
    } finally {
      setBusy(false);
    }
  };

  const searchSources = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !query.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/knowledge-bases/${detail.knowledgeBaseId}/search?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { results: KnowledgeSearchResult[] };
      setSearchResults(payload.results);
    } catch {
      setNotice("来源检索失败。");
    } finally {
      setBusy(false);
    }
  };

  const generateArtifact = async () => {
    if (!detail || !modelId) return;
    setBusy(true);
    setNotice("正在基于当前来源生成研究产物…");
    try {
      const response = await fetch(`/api/notebooks/${detail.id}/artifacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: artifactType, modelId }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "生成失败。");
      await Promise.all([loadDetail(detail.id), refreshList(detail.id)]);
      setNotice("研究产物已生成并保存。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "研究产物生成失败。");
    } finally {
      setBusy(false);
    }
  };

  const deleteArtifact = async (artifactId: string) => {
    if (!detail || !window.confirm("删除这个研究产物？")) return;
    const response = await fetch(`/api/notebooks/${detail.id}/artifacts/${artifactId}`, {
      method: "DELETE",
    });
    if (response.ok) await loadDetail(detail.id);
  };

  const beginArtifactEdit = (artifact: NotebookDetail["artifacts"][number]) => {
    setEditingArtifactId(artifact.id);
    setArtifactDraftTitle(artifact.title);
    setArtifactDraftContent(artifact.contentMarkdown);
  };

  const saveArtifact = async () => {
    if (!detail || !editingArtifactId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/notebooks/${detail.id}/artifacts/${editingArtifactId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: artifactDraftTitle,
            contentMarkdown: artifactDraftContent,
          }),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "保存失败。");
      await loadDetail(detail.id);
      setEditingArtifactId(undefined);
      setNotice("研究产物已保存。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };

  const publishArtifact = async (artifactId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/notebooks/${detail.id}/artifacts/${artifactId}/publish`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "发布失败。");
      await Promise.all([loadDetail(detail.id), refreshList(detail.id)]);
      setNotice("研究产物已发布到知识库，正在生成语义向量。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发布失败。");
    } finally {
      setBusy(false);
    }
  };

  const archiveNotebook = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notebooks/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!response.ok) throw new Error();
      await refreshList();
      setNotice("研究空间已归档。");
    } catch {
      setNotice("归档失败。");
    } finally {
      setBusy(false);
    }
  };

  const deleteCurrentNotebook = async () => {
    if (!detail || !window.confirm(`删除“${detail.title}”及其全部本地来源和研究产物？`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notebooks/${detail.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      await refreshList();
      setNotice("研究空间已删除。");
    } catch {
      setNotice("删除失败。");
    } finally {
      setBusy(false);
    }
  };

  const openNotebookChat = () => {
    if (!detail) return;
    window.localStorage.setItem("ai2dot.knowledge.selection.v1", JSON.stringify([detail.knowledgeBaseId]));
    router.push("/workspace");
  };

  const probeGoogle = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/notebook-providers/google/status?probe=true", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        status?: GoogleNotebookProviderStatus;
        message?: string;
      };
      if (!response.ok || !payload.status) throw new Error(payload.message || "检测失败。");
      setGoogleStatus(payload.status);
      setNotice(payload.status.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "检测失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="notebook-shell">
      <header className="admin-topbar">
        <BrandMark />
        <div className="admin-topbar-actions">
          <LanguageSwitcher />
          <Link href="/workspace"><ArrowLeft size={14} /> 返回对话</Link>
        </div>
      </header>

      <div className="notebook-layout">
        <aside className="notebook-navigation">
          <div className="notebook-navigation-head">
            <div><p className="eyebrow">NOTEBOOK STUDIO</p><h1>研究空间</h1></div>
            <button aria-label="新建研究空间" onClick={() => setCreateOpen(true)}><Plus size={17} /></button>
          </div>
          <p className="notebook-intro">围绕一个主题组织来源、对话和可复用研究成果。</p>
          <div className="notebook-list">
            {notebooks.map((notebook) => (
              <button
                data-active={notebook.id === selectedId}
                key={notebook.id}
                onClick={() => {
                  setSelectedId(notebook.id);
                  setTab("sources");
                  setSearchResults([]);
                }}
              >
                <BookOpen size={16} />
                <span><strong>{notebook.title}</strong><small>{notebook.documentCount} 来源 · {notebook.artifactCount} 产物</small></span>
                {notebook.id === selectedId && <ChevronRight size={14} />}
              </button>
            ))}
          </div>
          <button className="notebook-new-button" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> 新建研究空间
          </button>
        </aside>

        <section className="notebook-workspace">
          {detail && selected ? (
            <>
              <div className="notebook-heading">
                <div>
                  <p className="eyebrow">ACTIVE NOTEBOOK</p>
                  <h2>{detail.title}</h2>
                  <p>{detail.description || "为这个研究空间导入来源，然后开始检索、对话或生成研究产物。"}</p>
                </div>
                <button className="admin-primary" onClick={openNotebookChat}>
                  <MessageSquareText size={15} /> 与资料对话
                </button>
              </div>

              <div className="notebook-stats">
                <div><small>来源</small><strong>{detail.documentCount}</strong></div>
                <div><small>可检索片段</small><strong>{detail.chunkCount}</strong></div>
                <div><small>语义向量</small><strong>{detail.semanticChunkCount}</strong></div>
                <div><small>研究产物</small><strong>{detail.artifactCount}</strong></div>
              </div>

              <div className="notebook-tabs" role="tablist">
                <button aria-selected={tab === "sources"} role="tab" onClick={() => setTab("sources")}><FileText size={14} /> 来源</button>
                <button aria-selected={tab === "studio"} role="tab" onClick={() => setTab("studio")}><Sparkles size={14} /> Studio</button>
                <button aria-selected={tab === "provider"} role="tab" onClick={() => setTab("provider")}><Cloud size={14} /> Google Provider</button>
              </div>

              {tab === "sources" && (
                <div className="notebook-tab-panel">
                  <div className="notebook-panel-actions">
                    <form className="notebook-search" onSubmit={searchSources}>
                      <Search size={15} />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索当前研究空间" />
                      {query && <button type="button" aria-label="清除检索" onClick={() => { setQuery(""); setSearchResults([]); }}><X size={13} /></button>}
                      <button type="submit" disabled={busy || !query.trim()}>检索</button>
                    </form>
                    <input
                      ref={fileInputRef}
                      hidden
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const form = new FormData();
                        form.set("file", file);
                        void uploadSource(form);
                      }}
                    />
                    <button className="knowledge-secondary" disabled={busy} onClick={() => setVideoOpen(true)}><Clapperboard size={14} /> 视频链接</button>
                    <button className="knowledge-secondary" disabled={busy} onClick={() => setPasteOpen(true)}><FileText size={14} /> 粘贴文本</button>
                    <button className="admin-primary" disabled={busy} onClick={() => fileInputRef.current?.click()}><Upload size={14} /> 上传文件</button>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="notebook-search-results">
                      {searchResults.map((result) => (
                        <article key={result.chunkId}>
                          <div><FileSearch size={14} /><strong>{result.documentName}</strong><small>{result.retrievalMode} · {Math.round(result.score * 100)}%</small></div>
                          <p>{result.content}</p>
                        </article>
                      ))}
                    </div>
                  ) : detail.documents.length > 0 ? (
                    <div className="notebook-source-list">
                      {detail.videoSources.map((source) => {
                        const document = detail.documents.find((item) => item.id === source.knowledgeDocumentId);
                        return (
                          <div className="notebook-source-row" key={source.id}>
                            <span><Clapperboard size={16} /></span>
                            <div>
                              <strong>{source.title}</strong>
                              <small>
                                {source.platform === "youtube" ? "YouTube" : "Bilibili"}
                                {source.authorName ? ` · ${source.authorName}` : ""}
                                {" · "}
                                <a href={source.canonicalUrl} rel="noreferrer" target="_blank">打开原视频 <ExternalLink size={10} /></a>
                              </small>
                            </div>
                            <em data-status={document?.status === "failed" || document?.embeddingStatus === "failed" ? "failed" : document?.embeddingStatus === "ready" ? "ready" : "processing"}>
                              {document?.status === "failed" || document?.embeddingStatus === "failed" ? "失败" : document?.embeddingStatus === "ready" ? "可检索" : "处理中"}
                            </em>
                            <button aria-label={`删除 ${source.title}`} disabled={busy} title="删除视频来源" onClick={() => void deleteSource(source.knowledgeDocumentId, source.title)}><Trash2 size={14} /></button>
                          </div>
                        );
                      })}
                      {regularDocuments.map((document) => (
                        <div className="notebook-source-row" key={document.id}>
                          <span><FileText size={16} /></span>
                          <div><strong>{document.name}</strong><small>{formatBytes(document.byteSize)} · {document.chunkCount} 片段 · {document.embeddedChunkCount} 向量</small></div>
                          <em data-status={document.status === "failed" || document.embeddingStatus === "failed" ? "failed" : document.embeddingStatus === "ready" ? "ready" : "processing"}>
                            {document.status === "failed" || document.embeddingStatus === "failed" ? "失败" : document.embeddingStatus === "ready" ? "可检索" : "处理中"}
                          </em>
                          <button aria-label={`删除 ${document.name}`} disabled={busy} onClick={() => void deleteSource(document.id, document.name)}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notebook-empty"><BookOpen size={24} /><strong>添加第一份来源</strong><p>可导入 YouTube/Bilibili 视频字幕，或上传 PDF、DOCX、TXT、Markdown、CSV 和 JSON。</p><button className="admin-primary" onClick={() => setVideoOpen(true)}><Link2 size={14} /> 添加视频链接</button></div>
                  )}
                </div>
              )}

              {tab === "studio" && (
                <div className="notebook-tab-panel">
                  <div className="notebook-generator">
                    <div><p className="eyebrow">GENERATE</p><h3>基于当前来源生成</h3></div>
                    <div className="notebook-artifact-options">
                      {artifactOptions.map((option) => (
                        <button aria-pressed={artifactType === option.type} key={option.type} onClick={() => setArtifactType(option.type)}>
                          <span><Sparkles size={15} /></span><strong>{option.label}</strong><small>{option.description}</small>
                        </button>
                      ))}
                    </div>
                    <div className="notebook-generate-controls">
                      <label>
                        <span>生成模型</span>
                        <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
                          {groupedModels.map(([provider, providerModels]) => (
                            <optgroup label={provider} key={provider}>
                              {providerModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <button className="admin-primary" disabled={busy || detail.documentCount === 0 || !modelId} onClick={() => void generateArtifact()}>
                        {busy ? <LoaderCircle className="is-spinning" size={15} /> : <Sparkles size={15} />} 生成并保存
                      </button>
                    </div>
                  </div>

                  <div className="notebook-artifacts">
                    <div className="notebook-section-heading"><strong>已保存产物</strong><small>{detail.artifacts.length}</small></div>
                    {detail.artifacts.length > 0 ? detail.artifacts.map((artifact) => (
                      <article key={artifact.id}>
                        <header>
                          <div><strong>{artifact.title}</strong><small>{new Date(artifact.createdAt).toLocaleString("zh-CN")} · {artifact.status}{artifact.publishedDocumentId ? " · 已发布到知识库" : ""}</small></div>
                          <div className="notebook-artifact-actions">
                            {artifact.status === "ready" && !artifact.publishedDocumentId && editingArtifactId !== artifact.id && <button aria-label="编辑产物" title="编辑产物" onClick={() => beginArtifactEdit(artifact)}><Pencil size={14} /></button>}
                            {artifact.status === "ready" && !artifact.publishedDocumentId && editingArtifactId !== artifact.id && <button aria-label="发布到知识库" className="is-publish" disabled={busy} title="发布到知识库" onClick={() => void publishArtifact(artifact.id)}><BookUp2 size={14} /></button>}
                            <button aria-label="删除产物" title="删除产物" onClick={() => void deleteArtifact(artifact.id)}><Trash2 size={14} /></button>
                          </div>
                        </header>
                        {editingArtifactId === artifact.id ? (
                          <div className="notebook-artifact-editor">
                            <input aria-label="研究产物标题" maxLength={160} value={artifactDraftTitle} onChange={(event) => setArtifactDraftTitle(event.target.value)} />
                            <textarea aria-label="研究产物正文" maxLength={500000} rows={18} value={artifactDraftContent} onChange={(event) => setArtifactDraftContent(event.target.value)} />
                            <div><button className="knowledge-secondary" disabled={busy} onClick={() => setEditingArtifactId(undefined)}>取消</button><button className="admin-primary" disabled={busy || !artifactDraftTitle.trim() || !artifactDraftContent.trim()} onClick={() => void saveArtifact()}><Save size={14} /> 保存修改</button></div>
                          </div>
                        ) : artifact.contentMarkdown ? <div className="notebook-artifact-content"><MarkdownContent>{artifact.contentMarkdown}</MarkdownContent></div> : <p>{artifact.errorMessage || "等待生成。"}</p>}
                      </article>
                    )) : <div className="notebook-empty"><Sparkles size={24} /><strong>还没有研究产物</strong><p>选择一种模板，系统会严格基于当前来源生成并保存结果。</p></div>}
                  </div>
                </div>
              )}

              {tab === "provider" && (
                <div className="notebook-tab-panel">
                  <section className="notebook-provider-status" data-tone={providerTone(googleStatus)}>
                    <div className="notebook-provider-icon"><Network size={21} /></div>
                    <div>
                      <p className="eyebrow">OPTIONAL PROVIDER</p>
                      <h3>Gemini Notebook Enterprise</h3>
                      <p>{googleStatus.message}</p>
                    </div>
                    <button className="knowledge-secondary" disabled={busy || !googleStatus.enabled} onClick={() => void probeGoogle()}>
                      {busy ? <LoaderCircle className="is-spinning" size={14} /> : <Network size={14} />} 检测连接
                    </button>
                  </section>
                  <dl className="notebook-provider-grid">
                    <div><dt>功能开关</dt><dd>{googleStatus.enabled ? "已开启" : "已关闭"}</dd></div>
                    <div><dt>部署区域</dt><dd>{googleStatus.deploymentRegion}</dd></div>
                    <div><dt>Google 数据位置</dt><dd>{googleStatus.dataLocation || "未配置"}</dd></div>
                    <div><dt>服务器网络</dt><dd>{googleStatus.network === "reachable" ? "可达" : googleStatus.network === "unreachable" ? "不可达" : "未检测"}</dd></div>
                    <div><dt>项目</dt><dd>{googleStatus.projectConfigured ? "已配置" : "未配置"}</dd></div>
                    <div><dt>凭据</dt><dd>{googleStatus.credentialsConfigured ? "已配置" : "未配置"}</dd></div>
                  </dl>
                  {googleStatus.mainlandChinaDeployment && (
                    <div className="notebook-region-warning"><CircleAlert size={17} /><p><strong>中国境内部署说明</strong><span>Google 没有提供中国大陆 Notebook Enterprise 数据位置。即使 API 网络可达，也必须单独确认企业许可证、最终用户访问和跨境数据合规。</span></p></div>
                  )}
                  <div className="notebook-provider-note"><Headphones size={17} /><p><strong>Audio Overview 尚未启用</strong><span>需要完成 Google 企业租户 PoC、用户 OAuth 和 API 能力验证后才会开放同步与音频生成。</span></p></div>
                </div>
              )}

              <div className="notebook-danger-actions">
                <button disabled={busy} onClick={() => void archiveNotebook()}><Archive size={14} /> 归档</button>
                <button disabled={busy} onClick={() => void deleteCurrentNotebook()}><Trash2 size={14} /> 删除</button>
              </div>
            </>
          ) : (
            <div className="notebook-empty is-page"><BookOpen size={28} /><strong>创建第一个研究空间</strong><p>资料、检索、对话和研究成果会围绕同一个主题保持在一起。</p><button className="admin-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> 新建研究空间</button></div>
          )}
        </section>
      </div>

      {notice && <div className="knowledge-notice"><span>{notice}</span><button aria-label="关闭通知" onClick={() => setNotice(undefined)}><X size={14} /></button></div>}

      {createOpen && (
        <div className="knowledge-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && notebooks.length > 0) setCreateOpen(false); }}>
          <form className="knowledge-modal" onSubmit={createNotebook}>
            <div><span><BookOpen size={18} /></span><button type="button" disabled={notebooks.length === 0} onClick={() => setCreateOpen(false)}><X size={17} /></button></div>
            <h2>新建研究空间</h2><p>一个研究空间对应一个独立知识范围。</p>
            <label><span>名称</span><input autoFocus maxLength={100} name="title" placeholder="例如：Notebook Studio 产品研究" required /></label>
            <label><span>说明</span><textarea maxLength={500} name="description" placeholder="研究目标和资料范围" rows={3} /></label>
            <button className="admin-primary" disabled={busy} type="submit">{busy ? "正在创建…" : "创建研究空间"}</button>
          </form>
        </div>
      )}

      {videoOpen && detail && (
        <div className="knowledge-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setVideoOpen(false); }}>
          <form className="knowledge-modal is-wide notebook-video-modal" onSubmit={importVideoSource}>
            <div><span><Clapperboard size={18} /></span><button type="button" aria-label="关闭" onClick={() => setVideoOpen(false)}><X size={17} /></button></div>
            <h2>添加视频来源</h2><p>支持 YouTube 与 Bilibili。系统读取公开元数据，字幕由你粘贴或上传。</p>
            <label><span>视频地址</span><input autoFocus name="url" placeholder="https://www.youtube.com/watch?v=..." required type="url" /></label>
            <div className="notebook-video-options">
              <label><span>字幕语言</span><select defaultValue="zh-CN" name="language"><option value="zh-CN">中文</option><option value="en">English</option><option value="ja">日本語</option><option value="other">其他</option></select></label>
              <label className="notebook-video-file"><span>字幕文件</span><input accept=".srt,.vtt,.ass,.txt,text/plain,text/vtt" onChange={(event) => void loadSubtitleFile(event.target.files?.[0])} type="file" /><small>{videoFileName || "SRT、VTT、ASS 或 TXT，不超过 4MB"}</small></label>
            </div>
            <label><span>字幕或逐字稿</span><textarea maxLength={450000} onChange={(event) => { setVideoTranscript(event.target.value); if (!videoFileName) setVideoTranscriptOrigin("pasted"); }} placeholder="粘贴带时间戳的字幕，或在上方选择字幕文件…" required rows={13} value={videoTranscript} /></label>
            <label className="notebook-rights-confirm"><input name="rightsConfirmed" required type="checkbox" /><span>我确认有权处理并保存这份字幕或逐字稿。</span></label>
            <button className="admin-primary" disabled={busy || videoTranscript.trim().length < 20} type="submit">{busy ? <LoaderCircle className="is-spinning" size={15} /> : <Link2 size={15} />} 保存视频来源</button>
          </form>
        </div>
      )}

      {pasteOpen && detail && (
        <div className="knowledge-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setPasteOpen(false); }}>
          <form className="knowledge-modal is-wide" onSubmit={(event) => { event.preventDefault(); void uploadSource(new FormData(event.currentTarget)); }}>
            <div><span><FileText size={18} /></span><button type="button" onClick={() => setPasteOpen(false)}><X size={17} /></button></div>
            <h2>粘贴来源文本</h2><p>正文只作为资料处理，不会覆盖系统或助手指令。</p>
            <label><span>来源名称</span><input maxLength={160} name="name" placeholder="例如：访谈记录" required /></label>
            <label><span>正文</span><textarea maxLength={500000} name="content" placeholder="粘贴需要研究的内容…" required rows={11} /></label>
            <button className="admin-primary" disabled={busy} type="submit">{busy ? "正在处理…" : "保存并建立索引"}</button>
          </form>
        </div>
      )}
    </main>
  );
}
