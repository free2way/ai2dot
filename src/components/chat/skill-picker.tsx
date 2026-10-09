"use client";

import {
  BookOpen,
  Check,
  ChevronRight,
  Library,
  Search,
  Settings2,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SkillDependency,
  SkillSelection,
} from "@/lib/skill-selection";

export type ChatSkillItem = {
  id: string;
  versionId: string;
  name: string;
  description: string;
  slug: string;
  catalogId: string | null;
  category: string | null;
  version: string;
  enabled: boolean;
  autoLoad: boolean;
  dependencies: SkillDependency[];
};

type Props = {
  open: boolean;
  skills: ChatSkillItem[];
  selection: SkillSelection;
  scope: "message" | "branch";
  availableMcpTemplateIds: string[];
  recentSkillVersionIds?: string[];
  canSaveBranch: boolean;
  saving?: boolean;
  libraryHref?: string;
  onNavigate?: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectionChange: (selection: SkillSelection) => void;
  onScopeChange: (scope: "message" | "branch") => void;
  onSaveBranch: () => void;
  onRestoreInherited: () => void;
  onRestoreDefault: () => void;
};

function missingRequiredDependencies(
  dependencies: SkillDependency[],
  available: Set<string>,
) {
  return dependencies.filter(
    (dependency) =>
      dependency.requirement === "required" &&
      !dependency.alternatives.some((id) => available.has(id)),
  );
}

export function SkillPicker({
  open,
  skills,
  selection,
  scope,
  availableMcpTemplateIds,
  recentSkillVersionIds = [],
  canSaveBranch,
  saving = false,
  libraryHref = "/skills",
  onNavigate,
  onOpenChange,
  onSelectionChange,
  onScopeChange,
  onSaveBranch,
  onRestoreInherited,
  onRestoreDefault,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const available = useMemo(
    () => new Set(availableMcpTemplateIds),
    [availableMcpTemplateIds],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (!skill.enabled || !skill.versionId) return false;
      if (!normalized) return true;
      return [skill.name, skill.description, skill.slug, skill.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    }).sort((left, right) => {
      const leftIndex = recentSkillVersionIds.indexOf(left.versionId);
      const rightIndex = recentSkillVersionIds.indexOf(right.versionId);
      if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
      if (leftIndex >= 0) return -1;
      if (rightIndex >= 0) return 1;
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [query, recentSkillVersionIds, skills]);

  const toggle = (skill: ChatSkillItem) => {
    const active = selection.refs.some(
      (reference) => reference.versionId === skill.versionId,
    );
    const refs = active
      ? selection.refs.filter(
          (reference) => reference.versionId !== skill.versionId,
        )
      : [
          ...selection.refs,
          { skillId: skill.id, versionId: skill.versionId },
        ].slice(0, 3);
    onSelectionChange({ ...selection, mode: "manual", refs });
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter" && filtered[activeIndex]) {
        event.preventDefault();
        toggle(filtered[activeIndex]);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  if (!open) return null;

  return (
    <div className="skill-picker" role="dialog" aria-label="选择 Skill">
      <header>
        <div><strong>Skills</strong><small>最多选择 3 个工作流</small></div>
        <button onClick={() => onOpenChange(false)} type="button" aria-label="关闭 Skill 选择器"><X size={15} /></button>
      </header>
      <div className="skill-picker-modes" aria-label="Skill 调用模式">
        {(["auto", "manual", "hybrid"] as const).map((mode) => (
          <button
            data-active={selection.mode === mode}
            key={mode}
            onClick={() =>
              onSelectionChange({
                ...selection,
                mode,
                refs: mode === "auto" ? [] : selection.refs,
              })
            }
            type="button"
          >
            {mode === "auto" ? "自动" : mode === "manual" ? "手动" : "混合"}
          </button>
        ))}
      </div>
      <label className="skill-picker-search"><Search size={14} /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder="搜索名称、说明或 slug" /></label>
      <div className="skill-picker-list" role="listbox">
        {filtered.some((skill) => recentSkillVersionIds.includes(skill.versionId)) && <p className="skill-picker-group">最近使用</p>}
        {filtered.map((skill, index) => {
          const active = selection.refs.some(
            (reference) => reference.versionId === skill.versionId,
          );
          const missing = missingRequiredDependencies(skill.dependencies, available);
          return (
            <button
              aria-pressed={active}
              data-focused={index === activeIndex}
              data-active={active}
              key={skill.versionId}
              onClick={() => toggle(skill)}
              onMouseEnter={() => setActiveIndex(index)}
              type="button"
            >
              <BookOpen size={15} />
              <span><strong>{skill.name}<em>v{skill.version}{recentSkillVersionIds.includes(skill.versionId) ? " · 最近" : ""}</em></strong><small>{skill.description}</small>{missing.length > 0 && <small className="is-warning"><Wrench size={11} /> 需要 {missing.map((item) => item.alternatives.join(" / ")).join(", ")}</small>}</span>
              {active ? <Check size={15} /> : <ChevronRight size={14} />}
            </button>
          );
        })}
        {filtered.length === 0 && <p>没有匹配的已安装 Skill。</p>}
      </div>
      <div className="skill-picker-context">
        <label><span>处理范围</span><select value={selection.contextTarget} onChange={(event) => onSelectionChange({ ...selection, contextTarget: event.target.value as SkillSelection["contextTarget"] })}><option value="current_message">当前消息</option><option value="recent_messages">最近消息</option><option value="conversation">可用会话上下文</option></select></label>
        <div><button data-active={scope === "message"} onClick={() => onScopeChange("message")} type="button">仅本次</button><button data-active={scope === "branch"} disabled={!canSaveBranch} onClick={() => onScopeChange("branch")} type="button">当前会话</button></div>
      </div>
      <footer>
        <Link href={libraryHref} onClick={onNavigate}><Library size={13} /> 浏览 Library</Link>
        <Link href="/assistants" onClick={onNavigate}><Settings2 size={13} /> 助手默认</Link>
        {scope === "branch" && <button disabled={!canSaveBranch || saving} onClick={onSaveBranch} type="button">{saving ? "保存中" : "保存到会话"}</button>}
        {scope === "branch" && <button className="is-subtle" disabled={!canSaveBranch || saving} onClick={onRestoreInherited} type="button">恢复继承</button>}
        {scope === "message" && <button className="is-subtle" onClick={onRestoreDefault} type="button">恢复会话默认</button>}
      </footer>
    </div>
  );
}
