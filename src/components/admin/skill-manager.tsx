"use client";

import {
  BookOpen,
  Check,
  FileCode2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  version: string;
  sourceUrl: string | null;
  enabled: boolean;
  autoLoad: boolean;
  keywords: string[];
  requiredMcp: string[];
  contentHash: string;
  updatedAt: string;
};

type Props = {
  infrastructureReady: boolean;
  initialSkills?: SkillSummary[];
};

type FormState = {
  name: string;
  description: string;
  version: string;
  keywords: string;
  requiredMcp: string;
  sourceUrl: string;
  markdown: string;
  enabled: boolean;
  autoLoad: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  version: "1.0.0",
  keywords: "",
  requiredMcp: "",
  sourceUrl: "",
  markdown: "",
  enabled: true,
  autoLoad: true,
};

function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 20);
}

export function SkillManager({
  infrastructureReady,
  initialSkills = [],
}: Props) {
  const [skills, setSkills] = useState(initialSkills);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refreshSkills = async () => {
    const response = await fetch("/api/admin/skills", { cache: "no-store" });
    if (!response.ok) throw new Error("无法读取 Skill 列表。");
    const payload = (await response.json()) as { skills: SkillSummary[] };
    setSkills(payload.skills);
  };

  const openCreate = () => {
    if (!infrastructureReady) return;
    setEditingId(undefined);
    setFormState(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = async (skill: SkillSummary) => {
    setBusyId(skill.id);
    try {
      const response = await fetch(`/api/admin/skills/${skill.id}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        skill?: SkillSummary & { markdown: string };
        message?: string;
      };
      if (!response.ok || !payload.skill) throw new Error(payload.message || "无法读取 Skill 正文。");
      const detail = payload.skill;
      setEditingId(detail.id);
      setFormState({
        name: detail.name,
        description: detail.description,
        version: detail.version,
        keywords: detail.keywords.join(", "),
        requiredMcp: detail.requiredMcp.join(", "),
        sourceUrl: detail.sourceUrl ?? "",
        markdown: detail.markdown,
        enabled: detail.enabled,
        autoLoad: detail.autoLoad,
      });
      setFormOpen(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法读取 Skill 正文。");
    } finally {
      setBusyId(undefined);
    }
  };

  const saveSkill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.markdown.trim() && !formState.sourceUrl.trim()) {
      setNotice("请粘贴 SKILL.md 正文，或填写 GitHub raw Markdown 地址。");
      return;
    }
    setBusyId("save");
    setNotice(undefined);
    try {
      const response = await fetch(
        editingId ? `/api/admin/skills/${editingId}` : "/api/admin/skills",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: formState.name,
            description: formState.description,
            version: formState.version,
            keywords: splitList(formState.keywords),
            requiredMcp: splitList(formState.requiredMcp),
            sourceUrl: formState.sourceUrl,
            markdown: formState.markdown,
            enabled: formState.enabled,
            autoLoad: formState.autoLoad,
          }),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Skill 保存失败。");
      setFormOpen(false);
      await refreshSkills();
      setNotice(editingId ? "Skill 已更新。" : "Skill 已安装。当前只加载指令，不执行脚本。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 保存失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const toggleSkill = async (skill: SkillSummary, field: "enabled" | "autoLoad") => {
    setBusyId(skill.id);
    try {
      const response = await fetch(`/api/admin/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: field === "enabled" ? !skill.enabled : skill.enabled,
          autoLoad: field === "autoLoad" ? !skill.autoLoad : skill.autoLoad,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Skill 状态更新失败。");
      await refreshSkills();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 状态更新失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const deleteSkill = async (skill: SkillSummary) => {
    if (!window.confirm(`删除 Skill“${skill.name}”？`)) return;
    setBusyId(skill.id);
    try {
      const response = await fetch(`/api/admin/skills/${skill.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Skill 删除失败。");
      await refreshSkills();
      setNotice(`已删除 Skill“${skill.name}”。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 删除失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="skill-manager" id="skills" aria-label="外部 Skill">
      <div className="provider-section-heading">
        <div><p className="eyebrow">AGENT SKILLS</p><h2>外部 Skill</h2></div>
        <div className="skill-heading-actions">
          <small>导入 SKILL.md 工作流程，按问题相关性自动加载；当前不执行 Skill 脚本。</small>
          <button className="admin-primary" disabled={!infrastructureReady} onClick={openCreate}><Plus size={15} /> 添加 Skill</button>
        </div>
      </div>
      {!infrastructureReady && <p className="skill-help">完成登录、数据库和密钥配置后，才能保存工作区 Skill。</p>}
      {skills.length === 0 ? (
        <div className="skill-empty"><BookOpen size={22} /><strong>还没有 Skill</strong><p>可以粘贴来自 GitHub 的 SKILL.md，先从指令型工作流程开始。</p></div>
      ) : (
        <div className="skill-list">
          {skills.map((skill) => (
            <div className="skill-row" key={skill.id}>
              <div className="skill-main"><i data-enabled={skill.enabled} /><div><strong>{skill.name}</strong><small>v{skill.version} · {skill.sourceUrl || "工作区 Skill"}</small><p>{skill.description}</p></div></div>
              <div className="skill-meta"><span>{skill.keywords.length ? skill.keywords.slice(0, 3).join(" · ") : "无关键词"}</span>{skill.autoLoad ? <em>自动加载</em> : <small>手动匹配</small>}</div>
              <div className="skill-actions">
                <button title={skill.enabled ? "停用 Skill" : "启用 Skill"} disabled={Boolean(busyId)} onClick={() => void toggleSkill(skill, "enabled")}><span className="mcp-toggle" data-active={skill.enabled}><span /></span></button>
                <button title={skill.autoLoad ? "关闭自动加载" : "开启自动加载"} disabled={Boolean(busyId)} onClick={() => void toggleSkill(skill, "autoLoad")}><Check size={14} /></button>
                <button title="修改 Skill" disabled={Boolean(busyId)} onClick={() => void openEdit(skill)}><Pencil size={14} /></button>
                <button className="is-danger" title="删除 Skill" disabled={Boolean(busyId)} onClick={() => void deleteSkill(skill)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <div className="skill-notice" role="status">{notice}<button onClick={() => setNotice(undefined)} aria-label="关闭提示"><X size={13} /></button></div>}

      {formOpen && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <form className="admin-modal skill-modal" onSubmit={saveSkill}>
            <div className="admin-modal-head"><div><p className="eyebrow">{editingId ? "EDIT SKILL" : "NEW SKILL"}</p><h2>{editingId ? "修改 Skill" : "添加外部 Skill"}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="关闭"><X size={18} /></button></div>
            <label>SKILL.md 正文<span>支持 name、description、version、keywords、required_mcp 的简单 frontmatter；不会执行脚本。正文可留空，填写 GitHub raw Markdown 地址后由服务端安全导入。</span><textarea maxLength={28_000} value={formState.markdown} onChange={(event) => setFormState((state) => ({ ...state, markdown: event.target.value }))} placeholder={'---\nname: oracle-review\ndescription: 安全审查 Oracle 脚本\nkeywords: [Oracle, SQL, 数据库]\n---\n\n# 工作流程\n1. 先确认版本和风险。'} rows={10} /></label>
            <div className="skill-field-grid"><label>显示名称（可选）<input maxLength={80} value={formState.name} onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))} placeholder="优先使用 frontmatter 的 name" /></label><label>版本<input maxLength={40} value={formState.version} onChange={(event) => setFormState((state) => ({ ...state, version: event.target.value }))} /></label></div>
            <label>描述（可选）<input maxLength={240} value={formState.description} onChange={(event) => setFormState((state) => ({ ...state, description: event.target.value }))} placeholder="优先使用 frontmatter 的 description" /></label>
            <label>关键词（可选）<input value={formState.keywords} onChange={(event) => setFormState((state) => ({ ...state, keywords: event.target.value }))} placeholder="Oracle, SQL, 数据库" /></label>
            <label>依赖的 MCP 名称（可选）<input value={formState.requiredMcp} onChange={(event) => setFormState((state) => ({ ...state, requiredMcp: event.target.value }))} placeholder="Notion, Context7" /></label>
            <label>来源 URL（可选）<input type="url" maxLength={1_000} value={formState.sourceUrl} onChange={(event) => setFormState((state) => ({ ...state, sourceUrl: event.target.value }))} placeholder="https://raw.githubusercontent.com/.../SKILL.md" /></label>
            {editingId && <div className="skill-checkbox-row"><label><input checked={formState.enabled} onChange={(event) => setFormState((state) => ({ ...state, enabled: event.target.checked }))} type="checkbox" />启用 Skill</label><label><input checked={formState.autoLoad} onChange={(event) => setFormState((state) => ({ ...state, autoLoad: event.target.checked }))} type="checkbox" />自动按问题匹配</label></div>}
            <p className="secret-hint"><ShieldCheck size={14} /> Skill 只作为受限工作流上下文加载；脚本、命令和隐藏指令不会被 AI2DOT 自动执行。</p>
            <button className="admin-primary" disabled={busyId === "save"} type="submit"><FileCode2 size={14} /> {busyId === "save" ? "正在保存…" : "保存 Skill"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
