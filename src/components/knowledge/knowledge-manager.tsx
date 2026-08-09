"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  FileSearch,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import type {
  KnowledgeBaseSummary,
  KnowledgeDocumentSummary,
  KnowledgeSearchResult,
} from "@/lib/knowledge";

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function KnowledgeManager({
  initialKnowledgeBases,
}: {
  initialKnowledgeBases: KnowledgeBaseSummary[];
}) {
  const [knowledgeBases, setKnowledgeBases] = useState(initialKnowledgeBases);
  const [selectedId, setSelectedId] = useState(initialKnowledgeBases[0]?.id);
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [newBaseOpen, setNewBaseOpen] = useState(initialKnowledgeBases.length === 0);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedBase = knowledgeBases.find((base) => base.id === selectedId);

  const refresh = async (nextSelectedId = selectedId) => {
    const response = await fetch("/api/knowledge-bases", { cache: "no-store" });
    if (!response.ok) throw new Error("知识库刷新失败。");
    const payload = (await response.json()) as { knowledgeBases: KnowledgeBaseSummary[] };
    setKnowledgeBases(payload.knowledgeBases);
    const resolvedId = payload.knowledgeBases.some((base) => base.id === nextSelectedId)
      ? nextSelectedId
      : payload.knowledgeBases[0]?.id;
    setSelectedId(resolvedId);
  };

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void fetch(`/api/knowledge-bases/${selectedId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { documents: KnowledgeDocumentSummary[] };
      })
      .then((payload) => {
        if (!cancelled) setDocuments(payload.documents);
      })
      .catch(() => {
        if (!cancelled) setNotice("文档列表加载失败，请刷新后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const createBase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
        }),
      });
      const payload = (await response.json()) as { knowledgeBase?: { id: string }; message?: string };
      if (!response.ok || !payload.knowledgeBase) throw new Error(payload.message || "创建失败。");
      await refresh(payload.knowledgeBase.id);
      setNewBaseOpen(false);
      setNotice("知识库已创建，可以开始添加资料。");
      event.currentTarget.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建失败。");
    } finally {
      setBusy(false);
    }
  };

  const uploadDocument = async (form: FormData) => {
    if (!selectedId) return;
    setBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch(`/api/knowledge-bases/${selectedId}/documents`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "文档导入失败。");
      const detail = await fetch(`/api/knowledge-bases/${selectedId}`, { cache: "no-store" });
      const detailPayload = (await detail.json()) as { documents: KnowledgeDocumentSummary[] };
      setDocuments(detailPayload.documents);
      await refresh(selectedId);
      setPasteOpen(false);
      setNotice("文档已完成分块并可用于会话检索。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文档导入失败。");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    void uploadDocument(form);
  };

  const pasteDocument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void uploadDocument(new FormData(event.currentTarget));
  };

  const removeDocument = async (document: KnowledgeDocumentSummary) => {
    if (!selectedId || !window.confirm(`删除“${document.name}”？`)) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/knowledge-bases/${selectedId}/documents/${document.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      setDocuments((items) => items.filter((item) => item.id !== document.id));
      await refresh(selectedId);
      setNotice("文档已删除。");
    } catch {
      setNotice("文档删除失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const removeBase = async () => {
    if (!selectedBase || !window.confirm(`删除知识库“${selectedBase.name}”及全部文档？`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/knowledge-bases/${selectedBase.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      await refresh(undefined);
      setNotice("知识库已删除。");
    } catch {
      setNotice("知识库删除失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !query.trim()) {
      setResults([]);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/knowledge-bases/${selectedId}/search?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { results: KnowledgeSearchResult[] };
      setResults(payload.results);
    } catch {
      setNotice("检索失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="knowledge-shell">
      <header className="admin-topbar">
        <BrandMark />
        <Link href="/"><ArrowLeft size={14} /> 返回对话</Link>
      </header>
      <div className="knowledge-layout">
        <aside className="knowledge-navigation">
          <div className="knowledge-navigation-head">
            <div><p className="eyebrow">KNOWLEDGE</p><h1>知识库</h1></div>
            <button onClick={() => setNewBaseOpen(true)} aria-label="新建知识库"><Plus size={17} /></button>
          </div>
          <p className="knowledge-intro">将稳定资料交给 Dot，在回答中获得可追溯的上下文。</p>
          <div className="knowledge-base-list">
            {knowledgeBases.map((base) => (
              <button data-active={base.id === selectedId} key={base.id} onClick={() => { setSelectedId(base.id); setQuery(""); setResults([]); }}>
                <BookOpen size={16} />
                <span><strong>{base.name}</strong><small>{base.documentCount} 个文档 · {base.chunkCount} 个片段</small></span>
                {base.id === selectedId && <Check size={14} />}
              </button>
            ))}
          </div>
          <button className="knowledge-new-base" onClick={() => setNewBaseOpen(true)}><Plus size={15} /> 新建知识库</button>
        </aside>

        <section className="knowledge-workspace">
          {selectedBase ? (
            <>
              <div className="knowledge-heading">
                <div><p className="eyebrow">ACTIVE LIBRARY</p><h2>{selectedBase.name}</h2><p>{selectedBase.description || "为这个知识库导入资料，然后在对话设置中启用它。"}</p></div>
                <div className="knowledge-heading-actions">
                  <input ref={fileInputRef} hidden type="file" accept=".txt,.md,.markdown,.csv,.json,text/*" onChange={(event) => handleFile(event.target.files?.[0])} />
                  <button className="knowledge-secondary" disabled={busy} onClick={() => setPasteOpen(true)}><FileText size={15} /> 粘贴文本</button>
                  <button className="admin-primary" disabled={busy} onClick={() => fileInputRef.current?.click()}>{busy ? <LoaderCircle className="is-spinning" size={15} /> : <Upload size={15} />} 上传文档</button>
                </div>
              </div>

              <div className="knowledge-stats">
                <div><small>文档</small><strong>{selectedBase.documentCount}</strong></div>
                <div><small>可检索片段</small><strong>{selectedBase.chunkCount}</strong></div>
                <div><small>状态</small><strong><i /> 已就绪</strong></div>
              </div>

              <form className="knowledge-search" onSubmit={search}>
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="测试知识检索，例如：产品的部署方式" />
                {query && <button type="button" onClick={() => { setQuery(""); setResults([]); }} aria-label="清除检索"><X size={14} /></button>}
                <button type="submit" disabled={busy || !query.trim()}>检索</button>
              </form>

              {results.length > 0 ? (
                <section className="knowledge-results">
                  <div className="knowledge-section-title"><span>检索结果</span><small>{results.length} 个相关片段</small></div>
                  {results.map((result) => (
                    <article key={result.chunkId}>
                      <div><FileSearch size={15} /><strong>{result.documentName}</strong><small>相关度 {Math.round(result.score * 100)}%</small></div>
                      <p>{result.content}</p>
                    </article>
                  ))}
                </section>
              ) : (
                <section className="knowledge-documents">
                  <div className="knowledge-section-title"><span>文档</span><small>TXT / Markdown / CSV / JSON，单文件不超过 2MB</small></div>
                  {documents.length > 0 ? documents.map((document) => (
                    <div className="knowledge-document-row" key={document.id}>
                      <span className="knowledge-file-icon"><FileText size={17} /></span>
                      <span><strong>{document.name}</strong><small>{formatBytes(document.byteSize)} · {document.characterCount.toLocaleString()} 字符 · {document.chunkCount} 个片段</small></span>
                      <em data-status={document.status}>{document.status === "ready" ? "可检索" : document.status === "processing" ? "处理中" : "失败"}</em>
                      <button disabled={busy} onClick={() => void removeDocument(document)} aria-label={`删除 ${document.name}`}><Trash2 size={15} /></button>
                    </div>
                  )) : (
                    <div className="knowledge-empty"><BookOpen size={24} /><strong>还没有文档</strong><p>上传文件或粘贴文本，系统会自动切分为适合模型检索的片段。</p></div>
                  )}
                </section>
              )}
              <button className="knowledge-delete-base" disabled={busy} onClick={() => void removeBase()}><Trash2 size={14} /> 删除当前知识库</button>
            </>
          ) : (
            <div className="knowledge-empty is-page"><BookOpen size={28} /><strong>创建第一个知识库</strong><p>按项目、产品或主题组织资料，并在任意对话中按需启用。</p><button className="admin-primary" onClick={() => setNewBaseOpen(true)}><Plus size={15} /> 新建知识库</button></div>
          )}
          {notice && <div className="knowledge-notice"><span>{notice}</span><button onClick={() => setNotice(undefined)}><X size={14} /></button></div>}
        </section>
      </div>

      {newBaseOpen && (
        <div className="knowledge-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && knowledgeBases.length > 0) setNewBaseOpen(false); }}>
          <form className="knowledge-modal" onSubmit={createBase}>
            <div><span><BookOpen size={18} /></span><button type="button" onClick={() => setNewBaseOpen(false)} disabled={knowledgeBases.length === 0}><X size={17} /></button></div>
            <h2>新建知识库</h2><p>使用清晰的主题名称，方便在对话中快速选择。</p>
            <label><span>名称</span><input name="name" maxLength={80} required autoFocus placeholder="例如：AI2Dot 产品资料" /></label>
            <label><span>说明</span><textarea name="description" maxLength={240} rows={3} placeholder="这个知识库包含哪些资料？" /></label>
            <button className="admin-primary" disabled={busy} type="submit">{busy ? "正在创建…" : "创建知识库"}</button>
          </form>
        </div>
      )}

      {pasteOpen && (
        <div className="knowledge-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setPasteOpen(false); }}>
          <form className="knowledge-modal is-wide" onSubmit={pasteDocument}>
            <div><span><FileText size={18} /></span><button type="button" onClick={() => setPasteOpen(false)}><X size={17} /></button></div>
            <h2>粘贴文本</h2><p>适合会议纪要、产品说明、FAQ 或暂时没有文件的资料。</p>
            <label><span>文档名称</span><input name="name" maxLength={160} required placeholder="例如：部署操作手册" /></label>
            <label><span>正文</span><textarea name="content" maxLength={500000} rows={10} required placeholder="在这里粘贴需要检索的内容…" /></label>
            <button className="admin-primary" disabled={busy} type="submit">{busy ? "正在处理…" : "保存并建立索引"}</button>
          </form>
        </div>
      )}
    </main>
  );
}
