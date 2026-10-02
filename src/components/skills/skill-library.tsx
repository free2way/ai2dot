"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  ExternalLink,
  Filter,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import type { CatalogSkillSummary } from "@/server/skills/store";

type Props = {
  enabled: boolean;
  canManage: boolean;
  initialSkills: CatalogSkillSummary[];
  returnHref?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  research: "研究",
  productivity: "效率",
  writing: "写作",
  learning: "学习",
};

export function SkillLibrary({ enabled, canManage, initialSkills, returnHref = "/workspace" }: Props) {
  const [skills, setSkills] = useState(initialSkills);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (category !== "all" && skill.category !== category) return false;
      if (!normalized) return true;
      return [skill.name, skill.description, skill.descriptionEn, skill.id]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [category, query, skills]);

  const install = async (skill: CatalogSkillSummary) => {
    if (!canManage || busyId) return;
    setBusyId(skill.id);
    setNotice(undefined);
    try {
      const response = await fetch("/api/admin/skills/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          catalogId: skill.id,
          catalogVersion: skill.version,
        }),
      });
      const payload = (await response.json()) as {
        skill?: { id: string; versionId: string; version: string; enabled: boolean };
        message?: string;
      };
      if (!response.ok || !payload.skill) {
        throw new Error(payload.message || "Skill 安装失败。");
      }
      setSkills((items) =>
        items.map((item) =>
          item.id === skill.id
            ? {
                ...item,
                installed: true,
                installedSkillId: payload.skill!.id,
                installedVersionId: payload.skill!.versionId,
                installedVersion: payload.skill!.version,
                enabled: payload.skill!.enabled,
              }
            : item,
        ),
      );
      setNotice(`“${skill.name}”已安装到当前工作区。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 安装失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  const updateInstalled = async (
    skill: CatalogSkillSummary,
    action: "upgrade" | "toggle",
  ) => {
    if (!canManage || !skill.installedSkillId || busyId) return;
    setBusyId(skill.id);
    setNotice(undefined);
    try {
      const response = await fetch(
        action === "upgrade"
          ? `/api/admin/skills/${skill.installedSkillId}/upgrade`
          : `/api/admin/skills/${skill.installedSkillId}`,
        {
          method: action === "upgrade" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            action === "upgrade"
              ? { catalogVersion: skill.version }
              : { enabled: !skill.enabled },
          ),
        },
      );
      const payload = (await response.json()) as {
        skill?: { versionId: string; version: string; enabled: boolean };
        message?: string;
      };
      if (!response.ok || !payload.skill) {
        throw new Error(payload.message || "Skill 更新失败。");
      }
      setSkills((items) =>
        items.map((item) =>
          item.id === skill.id
            ? {
                ...item,
                installedVersionId: payload.skill!.versionId,
                installedVersion: payload.skill!.version,
                enabled: payload.skill!.enabled,
              }
            : item,
        ),
      );
      setNotice(
        action === "upgrade"
          ? `“${skill.name}”已升级到 v${skill.version}。`
          : `“${skill.name}”已${payload.skill.enabled ? "启用" : "停用"}。`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 更新失败。");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <main className="skill-library-shell">
      <header className="admin-topbar">
        <BrandMark />
        <div className="admin-topbar-actions">
          <Link href={returnHref}><ArrowLeft size={14} /> 返回对话</Link>
        </div>
      </header>
      <div className="skill-library-layout">
        <header className="skill-library-header">
          <div>
            <p className="eyebrow">CURATED WORKFLOWS</p>
            <h1>Skill Library</h1>
          </div>
          <div className="skill-library-stat">
            <Sparkles size={18} />
            <span><strong>{skills.filter((skill) => skill.installed).length}</strong><small>已安装</small></span>
          </div>
        </header>

        {!enabled && (
          <div className="skill-library-notice">Skill Library 功能开关当前未启用。</div>
        )}
        {notice && <div className="skill-library-notice" role="status">{notice}</div>}

        <div className="skill-library-controls">
          <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、用途或目录 ID" /></label>
          <div className="skill-category-filter"><Filter size={14} />{["all", "research", "productivity", "writing", "learning"].map((value) => <button data-active={category === value} key={value} onClick={() => setCategory(value)} type="button">{value === "all" ? "全部" : CATEGORY_LABELS[value]}</button>)}</div>
        </div>

        <div className="skill-catalog-grid">
          {filtered.map((skill) => (
            <article className="skill-catalog-item" key={skill.id}>
              <div className="skill-catalog-item-head">
                <span><BookOpen size={18} /></span>
                <div><small>{CATEGORY_LABELS[skill.category]} · v{skill.version}</small><h2>{skill.name}</h2></div>
                <em>Official</em>
              </div>
              <p>{skill.description}</p>
              <p className="skill-catalog-en">{skill.descriptionEn}</p>
              <div className="skill-catalog-meta">
                <span><ShieldCheck size={13} /> {skill.author}</span>
                <span><Wrench size={13} /> {skill.dependencies.length ? skill.dependencies.map((dependency) => dependency.alternatives.join(" / ")).join(", ") : "无 MCP 依赖"}</span>
              </div>
              <details><summary>预览工作流</summary><pre>{skill.preview}</pre><p>{skill.changeNotes}</p></details>
              <footer>
                <span>输入 {skill.estimatedInput}<br />输出 {skill.estimatedOutput}</span>
                <div>
                  <a href={skill.sourceUrl} target="_blank" rel="noreferrer" title="查看来源"><ExternalLink size={14} /></a>
                  {skill.installed && skill.installedVersion !== skill.version ? (
                    <button disabled={!canManage || busyId === skill.id} onClick={() => void updateInstalled(skill, "upgrade")} type="button">升级到 v{skill.version}</button>
                  ) : skill.installed ? (
                    <button className="is-installed" disabled={!canManage || busyId === skill.id} onClick={() => void updateInstalled(skill, "toggle")} type="button">{skill.enabled ? <Check size={14} /> : null}{skill.enabled ? "已启用" : "已停用"}</button>
                  ) : (
                    <button disabled={!enabled || !canManage || busyId === skill.id} onClick={() => void install(skill)} type="button">{busyId === skill.id ? "安装中" : canManage ? "安装" : "需要管理员"}</button>
                  )}
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
