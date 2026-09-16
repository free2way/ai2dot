"use client";

import {
  Check,
  Eye,
  EyeOff,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";

export type McpSourceSummary = {
  id: string;
  name: string;
  description: string | null;
  transport: "http" | "sse";
  url: string;
  enabled: boolean;
  secretConfigured: boolean;
  tools: { name: string; description?: string }[];
  lastSyncedAt: Date | string | null;
  lastError: string | null;
};

type Props = {
  infrastructureReady: boolean;
  initialSources?: McpSourceSummary[];
};

type FormState = {
  name: string;
  description: string;
  transport: "http" | "sse";
  url: string;
  secret: string;
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  transport: "http",
  url: "",
  secret: "",
  enabled: true,
};

export function McpSourceManager({
  infrastructureReady,
  initialSources = [],
}: Props) {
  const [sources, setSources] = useState(initialSources);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [showSecret, setShowSecret] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refreshSources = async () => {
    const response = await fetch("/api/admin/mcp-sources", { cache: "no-store" });
    if (!response.ok) throw new Error("无法读取 MCP 来源列表。");
    const payload = (await response.json()) as { sources: McpSourceSummary[] };
    setSources(payload.sources);
  };

  const openCreate = () => {
    if (!infrastructureReady) return;
    setEditingId(undefined);
    setFormState(EMPTY_FORM);
    setShowSecret(false);
    setFormOpen(true);
  };

  const openEdit = (source: McpSourceSummary) => {
    setEditingId(source.id);
    setFormState({
      name: source.name,
      description: source.description ?? "",
      transport: source.transport,
      url: source.url,
      secret: "",
      enabled: source.enabled,
    });
    setShowSecret(false);
    setFormOpen(true);
  };

  const syncSource = async (sourceId: string, quiet = false) => {
    setBusyId(sourceId);
    if (!quiet) setNotice(undefined);
    try {
      const response = await fetch(`/api/admin/mcp-sources/${sourceId}/sync`, {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; source?: McpSourceSummary };
      if (!response.ok) throw new Error(payload.message || "MCP 工具同步失败。");
      await refreshSources();
      setNotice(`连接正常，已发现 ${payload.source?.tools.length ?? 0} 个工具。`);
    } catch (error) {
      setNotice(error instanceof Error ? `同步失败：${error.message}` : "MCP 工具同步失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const saveSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("save");
    setNotice(undefined);
    try {
      const response = await fetch(
        editingId ? `/api/admin/mcp-sources/${editingId}` : "/api/admin/mcp-sources",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formState),
        },
      );
      const payload = (await response.json()) as { message?: string; source?: McpSourceSummary };
      if (!response.ok) throw new Error(payload.message || "MCP 来源保存失败。");
      setFormOpen(false);
      await refreshSources();
      if (payload.source?.id) await syncSource(payload.source.id, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MCP 来源保存失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const toggleSource = async (source: McpSourceSummary) => {
    setBusyId(source.id);
    try {
      const response = await fetch(`/api/admin/mcp-sources/${source.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: source.name,
          description: source.description ?? "",
          transport: source.transport,
          url: source.url,
          enabled: !source.enabled,
        }),
      });
      if (!response.ok) throw new Error("MCP 来源状态更新失败。");
      setSources((items) => items.map((item) => item.id === source.id ? { ...item, enabled: !item.enabled } : item));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MCP 来源状态更新失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const deleteSource = async (source: McpSourceSummary) => {
    if (!window.confirm(`删除“${source.name}”及其工具配置？`)) return;
    setBusyId(source.id);
    try {
      const response = await fetch(`/api/admin/mcp-sources/${source.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("MCP 来源删除失败。");
      await refreshSources();
      setNotice(`已删除 MCP 来源“${source.name}”。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MCP 来源删除失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="mcp-manager" id="mcp-sources" aria-label="外部 MCP 来源">
      <div className="provider-section-heading">
        <div><p className="eyebrow">MODEL CONTEXT PROTOCOL</p><h2>外部 MCP 来源</h2></div>
        <div className="mcp-heading-actions">
          <small>连接远程 HTTP / SSE MCP 服务，启用后自动提供给聊天助手</small>
          <button className="admin-primary" disabled={!infrastructureReady} onClick={openCreate}><Plus size={15} /> 添加 MCP</button>
        </div>
      </div>
      {!infrastructureReady && <p className="mcp-help">完成登录、数据库和密钥加密配置后，才能保存外部 MCP 凭据。</p>}
      {sources.length === 0 ? (
        <div className="mcp-empty"><Link2 size={22} /><strong>还没有外部 MCP 来源</strong><p>添加一个兼容 Streamable HTTP 或 SSE 的 MCP 地址，例如团队工具、搜索或自动化服务。</p></div>
      ) : (
        <div className="mcp-source-list">
          {sources.map((source) => (
            <div className="mcp-source-row" key={source.id}>
              <div className="mcp-source-main"><i data-enabled={source.enabled} /><div><strong>{source.name}</strong><small>{source.transport.toUpperCase()} · {source.url}</small>{source.description && <p>{source.description}</p>}</div></div>
              <div className="mcp-source-tools"><strong>{source.tools.length}</strong><small>个工具</small>{source.lastError ? <em title={source.lastError}>连接异常</em> : source.lastSyncedAt ? <span><Check size={12} /> 已同步</span> : <span>待检测</span>}</div>
              <div className="mcp-source-actions">
                <button title="测试连接并同步工具" disabled={Boolean(busyId)} onClick={() => void syncSource(source.id)}><RefreshCw className={busyId === source.id ? "is-spinning" : ""} size={14} /></button>
                <button title={source.enabled ? "停用来源" : "启用来源"} disabled={Boolean(busyId)} onClick={() => void toggleSource(source)}><span className="mcp-toggle" data-active={source.enabled}><span /></span></button>
                <button title="修改配置" disabled={Boolean(busyId)} onClick={() => openEdit(source)}><Pencil size={14} /></button>
                <button className="is-danger" title="删除来源" disabled={Boolean(busyId)} onClick={() => void deleteSource(source)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <div className="mcp-notice" role="status">{notice}<button onClick={() => setNotice(undefined)} aria-label="关闭提示"><X size={13} /></button></div>}

      {formOpen && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <form className="admin-modal" onSubmit={saveSource}>
            <div className="admin-modal-head"><div><p className="eyebrow">{editingId ? "EDIT MCP SOURCE" : "NEW MCP SOURCE"}</p><h2>{editingId ? "修改 MCP 来源" : "添加外部 MCP"}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="关闭"><X size={18} /></button></div>
            <label>显示名称<input required minLength={2} maxLength={80} value={formState.name} onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))} placeholder="例如：公司知识库工具" /></label>
            <label>传输方式<select value={formState.transport} onChange={(event) => setFormState((state) => ({ ...state, transport: event.target.value as "http" | "sse" }))}><option value="http">Streamable HTTP（推荐）</option><option value="sse">SSE（兼容旧服务）</option></select></label>
            <label>服务器地址<span>必须使用 HTTPS，填写 MCP endpoint</span><input required type="url" value={formState.url} onChange={(event) => setFormState((state) => ({ ...state, url: event.target.value }))} placeholder="https://mcp.example.com/mcp" /></label>
            <label>描述（可选）<input maxLength={240} value={formState.description} onChange={(event) => setFormState((state) => ({ ...state, description: event.target.value }))} placeholder="这个来源可以做什么？" /></label>
            <label>Bearer Token（可选）<div className="secret-field"><input value={formState.secret} onChange={(event) => setFormState((state) => ({ ...state, secret: event.target.value }))} type={showSecret ? "text" : "password"} autoComplete="new-password" placeholder={editingId ? "留空表示继续使用当前 Token" : "token-••••••••"} /><button type="button" onClick={() => setShowSecret((visible) => !visible)} aria-label={showSecret ? "隐藏密钥" : "显示密钥"}>{showSecret ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
            {editingId && <label className="provider-enabled"><input checked={formState.enabled} onChange={(event) => setFormState((state) => ({ ...state, enabled: event.target.checked }))} type="checkbox" /><span><strong>启用此来源</strong><small>启用后，聊天时会把同步到的工具提供给模型。</small></span></label>}
            <p className="secret-hint"><ShieldCheck size={14} /> Token 使用 AES-256-GCM 加密，仅在服务端连接 MCP 时解密。</p>
            <button className="admin-primary" disabled={busyId === "save"} type="submit">{busyId === "save" ? "正在保存…" : "保存并测试连接"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
