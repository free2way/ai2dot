"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Check,
  Database,
  MessageSquareText,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import {
  ORACLE_ASSISTANT_TEMPLATE,
  type AssistantInput,
  type AssistantSummary,
} from "@/lib/assistants";
import type { KnowledgeBaseSummary } from "@/lib/knowledge";
import type { ModelCatalogEntry } from "@/lib/models";

type Props = {
  initialAssistants: AssistantSummary[];
  models: ModelCatalogEntry[];
  knowledgeBases: KnowledgeBaseSummary[];
};

function formFromAssistant(assistant: AssistantSummary): AssistantInput {
  return {
    name: assistant.name,
    avatar: assistant.avatar,
    description: assistant.description ?? "",
    systemPrompt: assistant.systemPrompt,
    welcomeMessage: assistant.welcomeMessage ?? "",
    defaultModelKey: assistant.defaultModelKey ?? "",
    knowledgeBaseIds: assistant.knowledgeBaseIds,
  };
}

export function AssistantManager({
  initialAssistants,
  models,
  knowledgeBases,
}: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [assistants, setAssistants] = useState(initialAssistants);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialAssistants[0]?.id,
  );
  const [form, setForm] = useState<AssistantInput>(() =>
    initialAssistants[0]
      ? formFromAssistant(initialAssistants[0])
      : {
          ...ORACLE_ASSISTANT_TEMPLATE,
          defaultModelKey: models[0]?.id ?? "",
        },
  );
  const [isCreating, setIsCreating] = useState(initialAssistants.length === 0);
  const [dirty, setDirty] = useState(initialAssistants.length === 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const selectedAssistant = assistants.find((assistant) => assistant.id === selectedId);
  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelCatalogEntry[]>();
    for (const model of models) {
      groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
    }
    return [...groups.entries()];
  }, [models]);

  const updateForm = <Key extends keyof AssistantInput>(
    key: Key,
    value: AssistantInput[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice(undefined);
  };

  const selectAssistant = (assistant: AssistantSummary) => {
    setSelectedId(assistant.id);
    setForm(formFromAssistant(assistant));
    setIsCreating(false);
    setDirty(false);
    setNotice(undefined);
  };

  const createNew = () => {
    setSelectedId(undefined);
    setForm({
      ...ORACLE_ASSISTANT_TEMPLATE,
      defaultModelKey: models[0]?.id ?? "",
    });
    setIsCreating(true);
    setDirty(true);
    setNotice(undefined);
  };

  const persistAssistant = async () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) {
      setNotice("请填写助手名称和系统提示词。");
      return undefined;
    }
    setBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch(
        isCreating ? "/api/assistants" : `/api/assistants/${selectedId}`,
        {
          method: isCreating ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const payload = (await response.json()) as {
        assistant?: AssistantSummary;
        message?: string;
      };
      if (!response.ok || !payload.assistant) {
        throw new Error(payload.message || "助手保存失败。");
      }
      const saved = payload.assistant;
      setAssistants((items) => [
        saved,
        ...items.filter((assistant) => assistant.id !== saved.id),
      ]);
      setSelectedId(saved.id);
      setForm(formFromAssistant(saved));
      setIsCreating(false);
      setDirty(false);
      setNotice("助手配置已保存。");
      return saved;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "助手保存失败。");
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void persistAssistant();
  };

  const startConversation = async () => {
    const assistant = dirty || isCreating
      ? await persistAssistant()
      : selectedAssistant;
    if (!assistant) return;

    setBusy(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assistantId: assistant.id }),
      });
      const payload = (await response.json()) as {
        conversation?: { id: string };
        message?: string;
      };
      if (!response.ok || !payload.conversation) {
        throw new Error(payload.message || "会话创建失败。");
      }
      router.push(`/chat/${payload.conversation.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "会话创建失败。");
      setBusy(false);
    }
  };

  const removeAssistant = async () => {
    if (!selectedAssistant) return;
    if (!window.confirm(`删除助手“${selectedAssistant.name}”？已有会话会保留。`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assistants/${selectedAssistant.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("助手删除失败。");
      const remaining = assistants.filter((assistant) => assistant.id !== selectedAssistant.id);
      setAssistants(remaining);
      if (remaining[0]) selectAssistant(remaining[0]);
      else createNew();
      setNotice("助手已删除，历史会话不受影响。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "助手删除失败。");
    } finally {
      setBusy(false);
    }
  };

  const toggleKnowledgeBase = (id: string) => {
    const next = form.knowledgeBaseIds.includes(id)
      ? form.knowledgeBaseIds.filter((item) => item !== id)
      : [...form.knowledgeBaseIds, id].slice(-3);
    updateForm("knowledgeBaseIds", next);
  };

  return (
    <main className="assistant-shell">
      <header className="admin-topbar">
        <BrandMark />
        <div className="admin-topbar-actions"><LanguageSwitcher /><Link href="/"><ArrowLeft size={14} /> {t("返回对话")}</Link></div>
      </header>

      <div className="assistant-layout">
        <aside className="assistant-navigation">
          <div className="assistant-navigation-head">
            <div><p className="eyebrow">ASSISTANTS</p><h1>{t("助手")}</h1></div>
            <button onClick={createNew} aria-label={t("新建助手")}><Plus size={17} /></button>
          </div>
          <p className="assistant-intro">{t("保存角色、模型和知识，让每次新会话从正确的上下文开始。")}</p>
          <div className="assistant-list">
            {assistants.map((assistant) => (
              <button
                data-active={!isCreating && assistant.id === selectedId}
                key={assistant.id}
                onClick={() => selectAssistant(assistant)}
              >
                <span className="assistant-avatar">{assistant.avatar}</span>
                <span><strong>{assistant.name}</strong><small>{assistant.description || t("自定义 AI 助手")}</small></span>
                {assistant.id === selectedId && !isCreating ? <Check size={14} /> : <ArrowUpRight size={13} />}
              </button>
            ))}
          </div>
          <button className="assistant-new-button" onClick={createNew}><Plus size={15} /> {t("新建助手")}</button>
        </aside>

        <form className="assistant-editor" onSubmit={save}>
          <div className="assistant-editor-head">
            <div className="assistant-identity">
              <span className="assistant-avatar is-large">{form.avatar || form.name.slice(0, 2) || "AI"}</span>
              <div><p className="eyebrow">{isCreating ? t("新助手") : t("助手档案")}</p><h2>{form.name || t("未命名助手")}</h2><p>{dirty ? t("配置有未保存的更改") : t("配置已保存到当前工作区")}</p></div>
            </div>
            <div className="assistant-editor-actions">
              {selectedAssistant && <button className="assistant-delete" disabled={busy} onClick={() => void removeAssistant()} type="button"><Trash2 size={14} /> {t("删除")}</button>}
              <button className="knowledge-secondary" disabled={busy || !dirty} type="submit"><Save size={14} /> {t("保存")}</button>
              <button className="admin-primary" disabled={busy} onClick={() => void startConversation()} type="button"><MessageSquareText size={15} /> {t("开始对话")}</button>
            </div>
          </div>

          {notice && <div className="assistant-notice" role="status"><Check size={14} /> {notice}</div>}

          <div className="assistant-form-grid">
            <section className="assistant-form-section">
              <div className="assistant-section-heading"><span><Bot size={15} /> {t("基本信息")}</span><small>{t("用于识别和开始会话")}</small></div>
              <div className="assistant-field-row">
                <label><span>{t("名称")}</span><input maxLength={80} value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder={t("例如：Oracle 专家")} /></label>
                <label className="assistant-avatar-field"><span>{t("标识")}</span><input maxLength={3} value={form.avatar} onChange={(event) => updateForm("avatar", event.target.value.toUpperCase())} placeholder="OR" /></label>
              </div>
              <label><span>{t("说明")}</span><input maxLength={240} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder={t("这个助手适合处理什么任务")} /></label>
              <label><span>{t("欢迎语")}</span><textarea maxLength={500} rows={3} value={form.welcomeMessage} onChange={(event) => updateForm("welcomeMessage", event.target.value)} placeholder={t("用户进入新会话时看到的第一句话")} /></label>
            </section>

            <section className="assistant-form-section">
              <div className="assistant-section-heading"><span><Sparkles size={15} /> {t("模型与指令")}</span><small>{t("决定助手如何回答")}</small></div>
              <label><span>{t("默认模型")}</span><select value={form.defaultModelKey} onChange={(event) => updateForm("defaultModelKey", event.target.value)}><option value="">{t("使用工作区默认模型")}</option>{groupedModels.map(([provider, providerModels]) => <optgroup label={provider} key={provider}>{providerModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</optgroup>)}</select></label>
              <label><span>{t("系统提示词")}</span><textarea className="assistant-system-prompt" maxLength={12_000} rows={12} value={form.systemPrompt} onChange={(event) => updateForm("systemPrompt", event.target.value)} placeholder={t("定义角色、输出要求、安全边界和工作方式")} /></label>
              <div className="assistant-prompt-meta"><span>{form.systemPrompt.length.toLocaleString("zh-CN")} / 12,000 {t("字符")}</span><small>{t("系统指令会应用到由此助手创建的新会话。")}</small></div>
            </section>

            <section className="assistant-form-section assistant-knowledge-section">
              <div className="assistant-section-heading"><span><Database size={15} /> {t("默认知识库")}</span><small>{form.knowledgeBaseIds.length} / 3</small></div>
              {knowledgeBases.length > 0 ? (
                <div className="assistant-knowledge-list">
                  {knowledgeBases.map((base) => {
                    const active = form.knowledgeBaseIds.includes(base.id);
                    return <button aria-pressed={active} data-active={active} key={base.id} onClick={() => toggleKnowledgeBase(base.id)} type="button"><Database size={14} /><span><strong>{base.name}</strong><small>{base.documentCount} {t("文档")} · {base.chunkCount} {t("片段")}</small></span>{active && <Check size={14} />}</button>;
                  })}
                </div>
              ) : (
                <div className="assistant-empty-knowledge"><p>{t("还没有知识库。")}</p><Link href="/knowledge">{t("创建知识库")} <ArrowUpRight size={13} /></Link></div>
              )}
            </section>
          </div>
        </form>
      </div>
    </main>
  );
}
