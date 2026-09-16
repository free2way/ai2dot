"use client";

import { useMemo, useState } from "react";
import {
  ArrowBendDownRight,
  Brain,
  Check,
  FileText,
  Gauge,
  GitBranch,
  Sparkle,
} from "@phosphor-icons/react";
import { useLanguage } from "@/components/language-provider";

const models = [
  { id: "deepseek", name: "DeepSeek-R1", latency: "620ms", speed: "34.8 t/s" },
  { id: "claude", name: "Claude 3.7", latency: "540ms", speed: "41.2 t/s" },
  { id: "gpt", name: "GPT-4o", latency: "410ms", speed: "48.6 t/s" },
] as const;

const branchCopy = {
  a: {
    zh: "建议采用分层路由：常规请求优先选择低延迟模型，复杂推理进入高能力模型，并将知识库命中结果作为可追溯上下文注入。",
    en: "Use tiered routing: send routine work to low-latency models, reserve complex reasoning for high-capability models, and inject cited knowledge as traceable context.",
  },
  b: {
    zh: "先按任务类型建立模型池，再基于延迟、成本与上下文长度进行动态评分。失败请求保留幂等指纹，可安全回放而不会重复计费。",
    en: "Build task-specific model pools, then score by latency, cost, and context size. Failed requests keep an idempotency fingerprint for safe replay without duplicate billing.",
  },
} as const;

export function InteractiveWorkspace() {
  const { language, text } = useLanguage();
  const [modelId, setModelId] = useState<(typeof models)[number]["id"]>("deepseek");
  const [branch, setBranch] = useState<keyof typeof branchCopy>("a");
  const model = useMemo(() => models.find((entry) => entry.id === modelId) ?? models[0], [modelId]);

  return (
    <div className="workspace-preview" aria-label={text({ zh: "AI2Dot 交互工作台预览", en: "Interactive AI2Dot workspace preview" })}>
      <aside className="workspace-sidebar">
        <div className="preview-brand"><span className="brand-mark" aria-hidden="true"><span /></span><strong>DOT</strong></div>
        <button className="new-thread" type="button"><Sparkle size={15} weight="fill" />{text({ zh: "新对话", en: "New chat" })}</button>
        <div className="thread-group">
          <small>{text({ zh: "今天", en: "Today" })}</small>
          <button className="is-current" type="button">{text({ zh: "企业模型路由方案", en: "Enterprise model routing" })}</button>
          <button type="button">{text({ zh: "产品发布资料整理", en: "Launch brief synthesis" })}</button>
          <button type="button">{text({ zh: "法务条款差异分析", en: "Contract variance review" })}</button>
        </div>
        <div className="workspace-status"><Check size={13} weight="bold" />{text({ zh: "知识库已同步", en: "Knowledge synced" })}</div>
      </aside>

      <section className="workspace-main">
        <div className="workspace-toolbar">
          <div>
            <small>{text({ zh: "当前模型", en: "Active model" })}</small>
            <strong>{model.name}</strong>
          </div>
          <div className="model-tabs" role="group" aria-label={text({ zh: "切换模型", en: "Switch model" })}>
            {models.map((entry) => (
              <button
                className={modelId === entry.id ? "is-active" : ""}
                key={entry.id}
                onClick={() => setModelId(entry.id)}
                type="button"
              >
                {entry.name.replace(/-.+$/, "")}
              </button>
            ))}
          </div>
        </div>

        <div className="conversation">
          <div className="user-message">
            <span>{text({ zh: "你", en: "You" })}</span>
            <p>{text({ zh: "如何为团队设计一套可靠的多模型调用策略？", en: "How should our team design a reliable multi-model routing strategy?" })}</p>
          </div>
          <div className="assistant-message" key={`${modelId}-${branch}`}>
            <div className="assistant-mark"><Brain size={17} weight="duotone" /></div>
            <div>
              <div className="answer-meta"><strong>{model.name}</strong><span>{text({ zh: "已完成", en: "Completed" })}</span></div>
              <p>{branchCopy[branch][language]}</p>
              <div className="answer-sources">
                <span><FileText size={13} /> Architecture.pdf</span>
                <span><FileText size={13} /> Security-policy.md</span>
              </div>
            </div>
          </div>
        </div>

        <div className="workspace-metrics">
          <span><Gauge size={14} /> TTFT <strong>{model.latency}</strong></span>
          <span>{text({ zh: "吞吐", en: "Throughput" })} <strong>{model.speed}</strong></span>
          <span>SHA-256 <strong>{text({ zh: "已验证", en: "verified" })}</strong></span>
        </div>
      </section>

      <aside className="branch-panel">
        <div className="branch-heading"><GitBranch size={16} /><strong>{text({ zh: "思维分支", en: "Reasoning branches" })}</strong></div>
        <div className="branch-track" aria-hidden="true" />
        <button className={branch === "a" ? "is-active" : ""} onClick={() => setBranch("a")} type="button">
          <ArrowBendDownRight size={15} />
          <span><strong>{text({ zh: "分支 A", en: "Branch A" })}</strong><small>{text({ zh: "低延迟优先", en: "Latency first" })}</small></span>
        </button>
        <button className={branch === "b" ? "is-active" : ""} onClick={() => setBranch("b")} type="button">
          <ArrowBendDownRight size={15} />
          <span><strong>{text({ zh: "分支 B", en: "Branch B" })}</strong><small>{text({ zh: "可靠性优先", en: "Reliability first" })}</small></span>
        </button>
        <div className="branch-note">
          <small>{text({ zh: "历史保护", en: "History protection" })}</small>
          <p>{text({ zh: "重试不会覆盖原答案，两条推理路径可随时对比。", en: "Retries preserve the original answer so both reasoning paths remain comparable." })}</p>
        </div>
      </aside>
    </div>
  );
}
