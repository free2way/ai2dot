"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CircleDollarSign,
  CloudCog,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import {
  McpSourceManager,
  type McpSourceSummary,
} from "@/components/admin/mcp-source-manager";
import {
  SkillManager,
  type SkillSummary,
} from "@/components/admin/skill-manager";
import {
  EMPTY_OPERATIONS_OVERVIEW,
  type ProviderHealthStatus,
  type WorkspaceOperationsOverview,
} from "@/lib/operations";

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
  connectionId: string;
  providerModelId: string;
  name: string;
  connectionName: string;
  connectionType: "gateway" | "openai_compatible" | "native";
  contextWindow: number | null;
  enabled: boolean;
};

type Props = {
  infrastructureReady: boolean;
  configuration: {
    authReady: boolean;
    databaseReady: boolean;
    encryptionReady: boolean;
  };
  initialProviders?: ProviderSummary[];
  initialModels?: ProviderModelSummary[];
  initialOperations?: WorkspaceOperationsOverview;
  initialMcpSources?: McpSourceSummary[];
  initialSkills?: SkillSummary[];
};

type ProviderTemplate = {
  id: string;
  name: string;
  shortName: string;
  baseUrl: string;
  description: string;
};

type ProviderForm = {
  name: string;
  baseUrl: string;
  secret: string;
  enabled: boolean;
};

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OA",
    baseUrl: "https://api.openai.com/v1",
    description: "GPT 与 o 系列模型",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OR",
    baseUrl: "https://openrouter.ai/api/v1",
    description: "一个密钥连接多家模型",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DS",
    baseUrl: "https://api.deepseek.com",
    description: "DeepSeek 对话与推理模型",
  },
  {
    id: "zenmux",
    name: "ZenMux",
    shortName: "ZM",
    baseUrl: "https://zenmux.ai/api/v1",
    description: "统一接入全球主流模型",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    shortName: "GM",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    description: "Gemini 多模态与推理模型",
  },
  {
    id: "custom",
    name: "自定义接口",
    shortName: "API",
    baseUrl: "",
    description: "任意 OpenAI-compatible 服务",
  },
];

const EMPTY_FORM: ProviderForm = {
  name: "",
  baseUrl: "",
  secret: "",
  enabled: true,
};

const HEALTH_LABELS: Record<ProviderHealthStatus, string> = {
  healthy: "稳定",
  degraded: "波动",
  unavailable: "异常",
  ready: "已连接",
  unknown: "待检测",
  disabled: "已停用",
};

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function ProviderManager({
  infrastructureReady,
  configuration,
  initialProviders = [],
  initialModels = [],
  initialOperations = EMPTY_OPERATIONS_OVERVIEW,
  initialMcpSources = [],
  initialSkills = [],
}: Props) {
  const { t } = useLanguage();
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [selectedProviderId, setSelectedProviderId] = useState(
    initialProviders[0]?.id,
  );
  const [editingId, setEditingId] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<ProviderForm>(EMPTY_FORM);
  const [showSecret, setShowSecret] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [operations, setOperations] = useState(initialOperations);

  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ??
    providers[0];
  const visibleModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return models.filter(
      (model) =>
        (!selectedProvider || model.connectionId === selectedProvider.id) &&
        (!query ||
          model.name.toLowerCase().includes(query) ||
          model.providerModelId.toLowerCase().includes(query)),
    );
  }, [modelSearch, models, selectedProvider]);
  const providerHealthById = useMemo(
    () => new Map(operations.providers.map((health) => [health.connectionId, health])),
    [operations.providers],
  );

  const refreshProviders = async () => {
    const response = await fetch("/api/admin/providers", { cache: "no-store" });
    if (!response.ok) throw new Error("无法读取供应商列表。");
    const payload = (await response.json()) as {
      providers: ProviderSummary[];
      models: ProviderModelSummary[];
      operations: WorkspaceOperationsOverview;
    };
    setProviders(payload.providers);
    setModels(payload.models);
    setOperations(payload.operations);
    setSelectedProviderId((current) =>
      payload.providers.some((provider) => provider.id === current)
        ? current
        : payload.providers[0]?.id,
    );
  };

  const openCreate = (template = PROVIDER_TEMPLATES.at(-1)!) => {
    if (!infrastructureReady) return;
    setEditingId(undefined);
    setFormState({
      name: template.name === "自定义接口" ? "" : template.name,
      baseUrl: template.baseUrl,
      secret: "",
      enabled: true,
    });
    setShowSecret(false);
    setFormOpen(true);
  };

  const openEdit = (provider: ProviderSummary) => {
    setEditingId(provider.id);
    setFormState({
      name: provider.name,
      baseUrl: provider.baseUrl ?? "",
      secret: "",
      enabled: provider.enabled,
    });
    setShowSecret(false);
    setFormOpen(true);
  };

  const syncProvider = async (providerId: string, quiet = false) => {
    setBusyId(providerId);
    if (!quiet) setNotice(undefined);
    try {
      const response = await fetch(`/api/admin/providers/${providerId}/sync`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        discovered?: number;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || "连接测试失败。");
      await refreshProviders();
      setSelectedProviderId(providerId);
      setNotice(`连接正常，已同步 ${payload.discovered ?? 0} 个模型。`);
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `${quiet ? "配置已保存，但" : ""}连接测试失败：${error.message}`
          : "连接测试失败。",
      );
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const saveProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("save");
    setNotice(undefined);

    try {
      const response = await fetch(
        editingId ? `/api/admin/providers/${editingId}` : "/api/admin/providers",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            editingId
              ? formState
              : { ...formState, type: "openai_compatible" },
          ),
        },
      );
      const payload = (await response.json()) as {
        connection?: { id: string };
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || "供应商保存失败。");

      const providerId = editingId ?? payload.connection?.id;
      setFormOpen(false);
      await refreshProviders();
      if (providerId) await syncProvider(providerId, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "供应商保存失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const deleteProvider = async (provider: ProviderSummary) => {
    if (!window.confirm(`删除“${provider.name}”及其全部模型？此操作无法撤销。`)) {
      return;
    }
    setBusyId(provider.id);
    setNotice(undefined);
    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("供应商删除失败。");
      await refreshProviders();
      setNotice(`已删除供应商“${provider.name}”。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "供应商删除失败。");
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
        <div className="admin-topbar-actions"><LanguageSwitcher /><Link href="/"><ArrowLeft size={15} /> {t("返回工作台")}</Link></div>
      </header>

      <div className="admin-content">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">MODEL OPERATIONS</p>
            <h1>{t("模型供应商")}</h1>
            <p>{t("使用自己的 API Key 直连模型服务，不依赖 Vercel AI Gateway。")}</p>
          </div>
          <button
            className="admin-primary"
            disabled={!infrastructureReady}
            onClick={() => openCreate()}
            title={infrastructureReady ? undefined : t("请先完成下方基础配置")}
          >
            <Plus size={16} /> {t("添加供应商")}
          </button>
        </div>

        {!infrastructureReady && (
          <section className="admin-readiness" aria-label="基础配置状态">
            <div className="admin-readiness-copy">
              <span><CloudCog size={21} /></span>
              <div><strong>{t("管理界面已就绪")}</strong><small>{t("完成缺失的基础配置后，即可安全保存 API Key。")}</small></div>
            </div>
            <div className="admin-readiness-items" aria-label={t("基础配置状态")}>
              <div data-ready={configuration.authReady}><ShieldCheck size={15} /> {t("登录鉴权")}</div>
              <div data-ready={configuration.databaseReady}><Database size={15} /> {t("配置存储")}</div>
              <div data-ready={configuration.encryptionReady}><KeyRound size={15} /> {t("密钥加密")}</div>
            </div>
          </section>
        )}

        {infrastructureReady && (
          <section className="operations-overview" aria-label="模型用量概览">
            <div className="operations-heading">
              <div><p className="eyebrow">WORKSPACE USAGE</p><h2>{t("运行概览")}</h2></div>
              <small>{t("过去 {{count}} 天 · 每位用户每分钟 {{rate}} 次请求", { count: operations.periodDays, rate: operations.rateLimitPerMinute })}</small>
            </div>
            <div className="operations-metrics">
              <div><span><BarChart3 size={15} /> {t("请求")}</span><strong>{formatCompactNumber(operations.requestCount)}</strong><small>{operations.successRate}% {t("成功")}</small></div>
              <div><span><Activity size={15} /> {t("平均耗时")}</span><strong>{operations.averageLatencyMs ? `${(operations.averageLatencyMs / 1_000).toFixed(1)}s` : "—"}</strong><small>{t("已完成生成")}</small></div>
              <div><span><CloudCog size={15} /> Token</span><strong>{formatCompactNumber(operations.inputTokens + operations.outputTokens)}</strong><small>{formatCompactNumber(operations.inputTokens)} {t("输入")} · {formatCompactNumber(operations.outputTokens)} {t("输出")}</small></div>
              <div><span><CircleDollarSign size={15} /> {t("预估费用")}</span><strong>${operations.estimatedCostUsd.toFixed(4)}</strong><small>{t("按模型目录单价估算")}</small></div>
            </div>
          </section>
        )}

        <section className="provider-quickstart" aria-label="供应商快捷模板">
          <div className="provider-section-heading">
            <div><p className="eyebrow">DIRECT CONNECTION</p><h2>{t("选择接入方式")}</h2></div>
            <small>{t("接口需兼容 OpenAI Chat Completions 与 Models API")}</small>
          </div>
          <div className="provider-template-list">
            {PROVIDER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                disabled={!infrastructureReady}
                onClick={() => openCreate(template)}
              >
                <span>{template.shortName}</span>
                <div><strong>{template.name}</strong><small>{t(template.description)}</small></div>
                <Plus size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className="admin-metrics">
          <div><small>{t("直连供应商")}</small><strong>{providers.length}</strong></div>
          <div><small>{t("已启用模型")}</small><strong>{models.filter((model) => model.enabled).length} / {models.length}</strong></div>
          <div><small>{t("凭据策略")}</small><strong>AES-256</strong></div>
        </section>

        <section className="provider-table" aria-label="供应商列表">
          <div className="provider-table-head"><span>{t("连接")}</span><span>{t("健康 / 目录")}</span><span>{t("安全")}</span><span>{t("操作")}</span></div>
          {providers.length === 0 ? (
            <div className="provider-empty"><ServerCog size={24} /><strong>{t("还没有供应商连接")}</strong><p>{t("从上方选择模板，填写 API Key 后自动测试并同步模型。")}</p></div>
          ) : providers.map((provider) => {
            const health = providerHealthById.get(provider.id);
            const healthStatus = health?.status ?? (provider.enabled ? "unknown" : "disabled");
            return (
              <div className="provider-row" data-selected={selectedProvider?.id === provider.id} key={provider.id}>
                <button className="provider-main" onClick={() => setSelectedProviderId(provider.id)}>
                  <i data-enabled={provider.enabled} />
                  <span><strong>{provider.name}</strong><small>{provider.baseUrl ?? "托管接口"}</small></span>
                </button>
                <div className="provider-health-cell">
                  <strong data-health={healthStatus}><i /> {t(HEALTH_LABELS[healthStatus])}</strong>
                  <small>{health?.requestCount ? `${health.requestCount} 次调用 · ${health.averageLatencyMs ? `${(health.averageLatencyMs / 1_000).toFixed(1)}s` : "等待耗时"}` : `${provider.modelCount} 个模型`}</small>
                </div>
                <div className="provider-security">{provider.secretConfigured ? <><Check size={14} /> {t("服务端加密")}</> : t("未配置密钥")}</div>
                <div className="provider-actions">
                  <button title="测试连接并同步模型" disabled={Boolean(busyId)} onClick={() => void syncProvider(provider.id)}><RefreshCw className={busyId === provider.id ? "is-spinning" : ""} size={15} /></button>
                  <button title="修改配置" disabled={Boolean(busyId)} onClick={() => openEdit(provider)}><Pencil size={14} /></button>
                  <button className="is-danger" title="删除供应商" disabled={Boolean(busyId)} onClick={() => void deleteProvider(provider)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="model-operations">
          <div className="model-operations-head">
            <div><p className="eyebrow">DISCOVERED MODELS</p><h2>{selectedProvider ? `${selectedProvider.name} ${t("模型")}` : t("模型目录")}</h2></div>
            <label className="model-admin-search"><Search size={14} /><input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder={t("搜索模型 ID")} /></label>
          </div>
          {visibleModels.length > 0 ? (
            <div className="model-grid">
              {visibleModels.map((model) => (
                <div className="model-admin-row" key={model.id}>
                  <div><strong>{model.name}</strong><small>{model.providerModelId}{model.contextWindow ? ` · ${model.contextWindow.toLocaleString()} context` : ""}</small></div>
                  <button className="model-switch" aria-label={`${model.enabled ? "停用" : "启用"} ${model.name}`} aria-pressed={model.enabled} disabled={busyId === model.id} onClick={() => void toggleModel(model)}><span /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="model-empty"><RefreshCw size={20} /><strong>{selectedProvider ? t("还没有同步到模型") : t("添加供应商后显示模型")}</strong><small>{selectedProvider ? t("点击供应商右侧的同步按钮重新读取目录。") : t("启用后的模型会出现在聊天工作台。")}</small></div>
          )}
        </section>

        <McpSourceManager
          infrastructureReady={infrastructureReady}
          initialSources={initialMcpSources}
        />

        <SkillManager
          infrastructureReady={infrastructureReady}
          initialSkills={initialSkills}
        />

        {notice && <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice(undefined)} aria-label="关闭提示"><X size={14} /></button></div>}
      </div>

      {formOpen && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <form className="admin-modal" onSubmit={saveProvider}>
            <div className="admin-modal-head"><div><p className="eyebrow">{editingId ? "EDIT CONNECTION" : "NEW CONNECTION"}</p><h2>{editingId ? t("修改供应商") : t("添加模型供应商")}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label={t("关闭")}><X size={18} /></button></div>
            <label>{t("显示名称")}<input value={formState.name} onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))} required minLength={2} placeholder={t("例如：团队 OpenRouter")} /></label>
            <label>Base URL <span>{t("填写 API 的版本根地址，末尾不要加 /chat/completions")}</span><input value={formState.baseUrl} onChange={(event) => setFormState((state) => ({ ...state, baseUrl: event.target.value }))} required type="url" placeholder="https://api.example.com/v1" /></label>
            <label>API Key <span>{editingId ? t("留空表示继续使用当前密钥") : t("仅发送到 AI2Dot 服务端")}</span><div className="secret-field"><input value={formState.secret} onChange={(event) => setFormState((state) => ({ ...state, secret: event.target.value }))} required={!editingId} type={showSecret ? "text" : "password"} autoComplete="new-password" placeholder="sk-••••••••••••" /><button type="button" onClick={() => setShowSecret((visible) => !visible)} aria-label={showSecret ? t("隐藏密钥") : t("显示密钥")}>{showSecret ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
            {editingId && <label className="provider-enabled"><input checked={formState.enabled} onChange={(event) => setFormState((state) => ({ ...state, enabled: event.target.checked }))} type="checkbox" /><span><strong>{t("启用此连接")}</strong><small>{t("停用后，该连接下的模型不会出现在聊天工作台。")}</small></span></label>}
            <p className="secret-hint"><ShieldCheck size={14} /> {t("API Key 使用 AES-256-GCM 加密，浏览器不会再次读取明文。")}</p>
            <button className="admin-primary" disabled={busyId === "save"} type="submit">{busyId === "save" ? t("正在验证…") : t("保存并测试连接")}</button>
          </form>
        </div>
      )}
    </main>
  );
}
