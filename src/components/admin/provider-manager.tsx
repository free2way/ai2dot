"use client";

import {
  ArrowLeft,
  Check,
  Database,
  KeyRound,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/brand-mark";

type ProviderSummary = {
  id: string;
  name: string;
  type: "gateway" | "openai_compatible" | "native";
  baseUrl: string | null;
  enabled: boolean;
  secretConfigured: boolean;
  lastSyncedAt: Date | string | null;
  modelCount: number;
};

type ProviderModelSummary = {
  id: string;
  providerModelId: string;
  name: string;
  connectionName: string;
  connectionType: "gateway" | "openai_compatible" | "native";
  contextWindow: number | null;
  enabled: boolean;
};

type Props = {
  infrastructureReady: boolean;
  initialProviders?: ProviderSummary[];
  initialModels?: ProviderModelSummary[];
};

const PROVIDER_LABELS = {
  gateway: "Vercel AI Gateway",
  openai_compatible: "OpenAI Compatible",
  native: "Native API",
};

export function ProviderManager({
  infrastructureReady,
  initialProviders = [],
  initialModels = [],
}: Props) {
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refreshProviders = async () => {
    const response = await fetch("/api/admin/providers", { cache: "no-store" });
    if (!response.ok) throw new Error("无法读取供应商列表。");
    const payload = (await response.json()) as {
      providers: ProviderSummary[];
      models: ProviderModelSummary[];
    };
    setProviders(payload.providers);
    setModels(payload.models);
  };

  const createProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("create");
    setNotice(undefined);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          type: form.get("type"),
          baseUrl: form.get("baseUrl"),
          secret: form.get("secret"),
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "供应商保存失败。");
      await refreshProviders();
      setFormOpen(false);
      setNotice("供应商已保存，可以开始刷新模型目录。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "供应商保存失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const syncProvider = async (providerId: string) => {
    setBusyId(providerId);
    setNotice(undefined);
    try {
      const response = await fetch(`/api/admin/providers/${providerId}/sync`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        discovered?: number;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || "目录刷新失败。");
      await refreshProviders();
      setNotice(`目录刷新完成，发现 ${payload.discovered ?? 0} 个模型。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "目录刷新失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const toggleModel = async (model: ProviderModelSummary) => {
    setBusyId(model.id);
    setNotice(undefined);
    try {
      const response = await fetch(`/api/admin/models/${model.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !model.enabled }),
      });
      if (!response.ok) throw new Error("模型状态更新失败。");
      setModels((items) =>
        items.map((item) =>
          item.id === model.id ? { ...item, enabled: !item.enabled } : item,
        ),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "模型状态更新失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <BrandMark />
        <Link href="/"><ArrowLeft size={15} /> 返回工作台</Link>
      </header>

      <div className="admin-content">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">MODEL OPERATIONS</p>
            <h1>模型供应商</h1>
            <p>集中管理连接凭据、模型发现与可用状态。</p>
          </div>
          {infrastructureReady && (
            <button className="admin-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> 添加供应商
            </button>
          )}
        </div>

        {!infrastructureReady ? (
          <section className="admin-setup-panel">
            <div className="setup-copy">
              <span className="setup-icon"><ServerCog size={24} /></span>
              <p className="eyebrow">INFRASTRUCTURE REQUIRED</p>
              <h2>后台功能已经就位，等待连接云服务</h2>
              <p>完成下面三项配置后，供应商密钥将加密入库，模型目录可以随时在线刷新。</p>
            </div>
            <div className="setup-checklist">
              <div><Database size={18} /><span><strong>Neon PostgreSQL</strong><small>配置 DATABASE_URL 并运行数据库迁移</small></span></div>
              <div><ShieldCheck size={18} /><span><strong>Clerk Authentication</strong><small>配置 publishable key 与 secret key</small></span></div>
              <div><KeyRound size={18} /><span><strong>AES-256 encryption</strong><small>生成 PROVIDER_SECRET_ENCRYPTION_KEY</small></span></div>
            </div>
            <code>openssl rand -base64 32</code>
          </section>
        ) : (
          <>
            <section className="admin-metrics">
              <div><small>供应商</small><strong>{providers.length}</strong></div>
              <div><small>已启用模型</small><strong>{models.filter((model) => model.enabled).length} / {models.length}</strong></div>
              <div><small>凭据策略</small><strong>AES-256</strong></div>
            </section>

            <section className="provider-table" aria-label="供应商列表">
              <div className="provider-table-head"><span>连接</span><span>目录状态</span><span>安全</span><span /></div>
              {providers.length === 0 ? (
                <div className="provider-empty"><ServerCog size={24} /><strong>还没有供应商连接</strong><p>建议先添加 Vercel AI Gateway，一次接入主流模型。</p></div>
              ) : providers.map((provider) => (
                <div className="provider-row" key={provider.id}>
                  <div><i data-enabled={provider.enabled} /><span><strong>{provider.name}</strong><small>{PROVIDER_LABELS[provider.type]}</small></span></div>
                  <div><strong>{provider.modelCount} 个模型</strong><small>{provider.lastSyncedAt ? `更新于 ${new Date(provider.lastSyncedAt).toLocaleString("zh-CN")}` : "尚未刷新"}</small></div>
                  <div className="provider-security">{provider.secretConfigured ? <><Check size={14} /> 已加密</> : "使用环境密钥"}</div>
                  <button disabled={Boolean(busyId)} onClick={() => void syncProvider(provider.id)}>
                    <RefreshCw className={busyId === provider.id ? "is-spinning" : ""} size={15} /> 刷新目录
                  </button>
                </div>
              ))}
            </section>

            {models.length > 0 && (
              <section className="model-operations">
                <div className="model-operations-head"><div><p className="eyebrow">DISCOVERED MODELS</p><h2>模型启停</h2></div><small>启用后会出现在工作台模型选择器中</small></div>
                <div className="model-grid">
                  {models.map((model) => (
                    <div className="model-admin-row" key={model.id}>
                      <div><strong>{model.name}</strong><small>{model.connectionName} · {model.providerModelId}</small></div>
                      <button className="model-switch" aria-label={`${model.enabled ? "停用" : "启用"} ${model.name}`} aria-pressed={model.enabled} disabled={busyId === model.id} onClick={() => void toggleModel(model)}><span /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {notice && <div className="admin-notice" role="status">{notice}</div>}
      </div>

      {formOpen && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={createProvider}>
            <div className="admin-modal-head"><div><p className="eyebrow">NEW CONNECTION</p><h2>添加模型供应商</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="关闭"><X size={18} /></button></div>
            <label>显示名称<input name="name" required minLength={2} placeholder="例如：团队 AI Gateway" /></label>
            <label>接口类型<select name="type" defaultValue="gateway"><option value="gateway">Vercel AI Gateway</option><option value="openai_compatible">OpenAI Compatible</option><option value="native">Native API</option></select></label>
            <label>Base URL <span>Gateway 可留空</span><input name="baseUrl" type="url" placeholder="https://api.example.com/v1" /></label>
            <label>API Key <span>留空则使用服务器环境变量</span><input name="secret" type="password" autoComplete="new-password" placeholder="••••••••••••" /></label>
            <p className="secret-hint"><ShieldCheck size={14} /> 凭据仅在服务端使用 AES-256-GCM 加密后保存。</p>
            <button className="admin-primary" disabled={busyId === "create"} type="submit">{busyId === "create" ? "保存中…" : "保存连接"}</button>
          </form>
        </div>
      )}
    </main>
  );
}
