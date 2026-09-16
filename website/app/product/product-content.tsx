"use client";

import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Fingerprint,
  GitBranch,
  LockKey,
  MagnifyingGlass,
  Stack,
} from "@phosphor-icons/react";
import heroNetwork from "@/public/images/hero-network.png";
import { APP_URL } from "@/lib/site";
import { useLanguage } from "@/components/language-provider";
import { Reveal } from "@/components/reveal";
import { FinalCta } from "@/components/final-cta";

export function ProductContent() {
  const { text } = useLanguage();

  return (
    <>
      <section className="product-hero page-hero">
        <Image src={heroNetwork} fill priority sizes="100vw" alt="" />
        <div className="product-hero-scrim" />
        <div className="section-shell product-hero-content">
          <span className="section-kicker">DOT CORE WORKSPACE</span>
          <h1 className="page-title">{text({ zh: "一个工作台，承载完整的企业 AI 路径。", en: "One workspace for the complete enterprise AI path." })}</h1>
          <p className="page-intro">{text({ zh: "从模型接入、知识检索到可靠生成，所有关键状态都清晰可见。", en: "From model access and retrieval to reliable generation, every critical state stays visible." })}</p>
          <div className="page-hero-actions">
            <a className="button button-acid" href={APP_URL} target="_blank" rel="noreferrer">{text({ zh: "进入工作台", en: "Open workspace" })}<ArrowUpRight size={17} weight="bold" /></a>
          </div>
        </div>
      </section>

      <section className="product-ledger section-shell section-pad">
        <Reveal className="product-ledger-intro">
          <h2 className="section-title">{text({ zh: "模型不是孤岛。它们是可调度的能力节点。", en: "Models are not islands. They are routable capabilities." })}</h2>
          <p className="section-copy">{text({ zh: "AI2Dot 将供应商目录、模型能力、延迟与成本放进统一工作区。", en: "AI2Dot brings provider catalogs, model capabilities, latency, and cost into one workspace." })}</p>
        </Reveal>
        <div className="product-ledger-list">
          {[
            { icon: Stack, title: { zh: "统一模型目录", en: "Unified model catalog" }, body: { zh: "接入 OpenAI、DeepSeek、Gemini、OpenRouter、ZenMux 与任意兼容网关。启用后的模型立即进入工作台。", en: "Connect OpenAI, DeepSeek, Gemini, OpenRouter, ZenMux, and compatible gateways. Enabled models appear instantly." }, meta: "CATALOG" },
            { icon: GitBranch, title: { zh: "非覆盖式思维树", en: "Non-destructive reasoning tree" }, body: { zh: "重试与修改从同一上下文生成新分支，原答案与完整历史持续保留，可随时切换与比较。", en: "Retries and edits create a new branch from shared context while preserving every prior answer for comparison." }, meta: "BRANCH" },
            { icon: MagnifyingGlass, title: { zh: "可溯源混合检索", en: "Traceable hybrid retrieval" }, body: { zh: "pg_trgm 快速召回候选片段，应用层完成相关度评分和文档多样性排序，命中来源随回答保存。", en: "pg_trgm recalls candidates, application scoring ranks relevance and diversity, and cited sources persist with the answer." }, meta: "RETRIEVAL" },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal className="product-ledger-row" delay={index * 70} key={item.meta}>
                <span>{item.meta}</span><Icon size={27} weight="duotone" /><div><h3>{text(item.title)}</h3><p>{text(item.body)}</p></div><ArrowRight size={18} />
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="branch-story section-pad">
        <div className="section-shell branch-story-grid">
          <Reveal className="branch-copy">
            <span className="section-kicker">THINK IN PARALLEL</span>
            <h2 className="section-title">{text({ zh: "保留每一种可能，不让重试抹去思考。", en: "Keep every possibility. Never let a retry erase the thinking." })}</h2>
            <p className="section-copy">{text({ zh: "团队可以在同一问题上比较不同模型、提示词与推理强度，形成可审阅的决策轨迹。", en: "Teams can compare models, prompts, and reasoning depth on the same question to create an auditable decision trail." })}</p>
          </Reveal>
          <Reveal className="branch-canvas" delay={100}>
            <div className="branch-origin"><small>PROMPT</small><strong>{text({ zh: "市场进入策略", en: "Market entry strategy" })}</strong></div>
            <div className="branch-path path-left"><span /><div><small>DEEPSEEK-R1</small><strong>{text({ zh: "成本与渠道路径", en: "Cost and channel path" })}</strong><p>{text({ zh: "保留为分支 A", en: "Preserved as branch A" })}</p></div></div>
            <div className="branch-path path-right"><span /><div><small>CLAUDE</small><strong>{text({ zh: "风险与合规路径", en: "Risk and compliance path" })}</strong><p>{text({ zh: "保留为分支 B", en: "Preserved as branch B" })}</p></div></div>
          </Reveal>
        </div>
      </section>

      <section className="rag-section section-shell section-pad">
        <Reveal>
          <h2 className="section-title">{text({ zh: "答案有依据，依据可回到原文。", en: "Answers have evidence. Evidence leads back to source." })}</h2>
          <p className="section-copy">{text({ zh: "支持常见企业文档格式，检索结果以结构化来源随会话长期保存。", en: "Common enterprise formats are supported, with structured sources persisted alongside the conversation." })}</p>
        </Reveal>
        <div className="rag-flow">
          <Reveal className="rag-input" delay={60}><span>PDF</span><span>DOCX</span><span>TXT</span><span>MD</span><span>CSV</span><span>JSON</span></Reveal>
          <Reveal className="rag-engine" delay={120}><MagnifyingGlass size={30} weight="duotone" /><strong>pg_trgm + relevance + diversity</strong><p>{text({ zh: "候选召回、相关度评分、文档多样性重排", en: "Candidate recall, relevance scoring, and document diversity reranking" })}</p></Reveal>
          <Reveal className="rag-output" delay={180}>
            <div><CheckCircle size={18} weight="fill" /><span>{text({ zh: "回答已生成", en: "Answer generated" })}</span></div>
            <blockquote>{text({ zh: "根据产品架构与安全规范，建议采用按工作区隔离的模型凭证策略。", en: "Based on the product architecture and security policy, use workspace-scoped model credentials." })}</blockquote>
            <small>Security-policy.md / Architecture.pdf</small>
          </Reveal>
        </div>
      </section>

      <section className="reliability-band section-pad">
        <div className="section-shell reliability-grid">
          <Reveal className="reliability-visual">
            <Fingerprint size={54} weight="duotone" />
            <div><small>REQUEST FINGERPRINT</small><code>8f2a9c7e...c41d</code></div>
            <div className="generation-states"><span>pending</span><span>streaming</span><span>completed</span></div>
          </Reveal>
          <Reveal className="reliability-copy" delay={100}>
            <h2 className="section-title">{text({ zh: "一次意图，只产生一次计费生成。", en: "One intent creates one billable generation." })}</h2>
            <p className="section-copy">{text({ zh: "UUID 幂等键与 SHA-256 请求指纹抵御重复提交，已完成结果可直接回放。", en: "UUID idempotency keys and SHA-256 request fingerprints stop duplicate submissions, while completed results can replay instantly." })}</p>
          </Reveal>
        </div>
      </section>

      <section className="security-detail section-shell section-pad">
        <Reveal className="security-detail-head">
          <LockKey size={36} weight="duotone" />
          <h2 className="section-title">{text({ zh: "安全不是附加项，而是默认路径。", en: "Security is the default path, not an add-on." })}</h2>
        </Reveal>
        <div className="security-columns">
          {[
            { title: "AES-256-GCM", zh: "模型 API Key 与 MCP Token 认证加密落库，明文不返回浏览器。", en: "Model API keys and MCP tokens use authenticated encryption and never return to the browser." },
            { title: "SSRF GUARD", zh: "自定义网关必须使用 HTTPS，域名解析结果会拦截私有地址与本地主机。", en: "Custom gateways require HTTPS and block hostnames that resolve to private or local addresses." },
            { title: "TENANT BOUNDARY", zh: "账户、工作区与管理权限在服务端校验，数据访问始终带租户上下文。", en: "Accounts, workspaces, and admin permissions are checked server-side with tenant context on every access." },
            { title: "ATOMIC LIMIT", zh: "Neon 原子分钟窗口在多实例间统一限流口径，减少突发请求风险。", en: "Neon atomic minute windows maintain consistent rate limits across multiple instances." },
          ].map((item, index) => (
            <Reveal className="security-item" delay={index * 60} key={item.title}><span>{item.title}</span><p>{text({ zh: item.zh, en: item.en })}</p></Reveal>
          ))}
        </div>
      </section>

      <FinalCta />
    </>
  );
}
