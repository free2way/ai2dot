"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BracketsCurly,
  Fingerprint,
  GitBranch,
  LockKey,
  Pulse,
  Stack,
} from "@phosphor-icons/react";
import heroNetwork from "@/public/images/hero-network.png";
import { APP_URL } from "@/lib/site";
import { useLanguage } from "@/components/language-provider";
import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { Reveal } from "@/components/reveal";
import { FinalCta } from "@/components/final-cta";

const pillars = [
  { icon: Stack, title: { zh: "模型统一调度", en: "Unified model routing" }, body: { zh: "连接主流模型与私有 OpenAI-compatible 网关，目录实时刷新。", en: "Connect leading models and private OpenAI-compatible gateways with live catalogs." }, className: "pillar-wide pillar-acid" },
  { icon: GitBranch, title: { zh: "非覆盖式分支", en: "Non-destructive branching" }, body: { zh: "编辑与重试保留完整历史，在同一命题下并行比较推理路径。", en: "Edit and retry without erasing history. Compare reasoning paths side by side." }, className: "pillar-dark" },
  { icon: BracketsCurly, title: { zh: "混合检索 RAG", en: "Hybrid retrieval RAG" }, body: { zh: "关键词候选召回、语义评分与文档多样性重排，答案附结构化引文。", en: "Candidate recall, semantic scoring, diversity reranking, and structured citations." }, className: "pillar-pattern" },
  { icon: Fingerprint, title: { zh: "幂等生成", en: "Idempotent generation" }, body: { zh: "UUID 与 SHA-256 指纹守护每次生成，弱网重传不重复计费。", en: "UUID and SHA-256 fingerprints prevent duplicate billing on retries." }, className: "pillar-tall" },
  { icon: LockKey, title: { zh: "凭证保险箱", en: "Credential vault" }, body: { zh: "BYOK 密钥以 AES-256-GCM 加密，仅在服务端解密调用。", en: "BYOK credentials use AES-256-GCM and decrypt only on the server." }, className: "pillar-dark" },
  { icon: Pulse, title: { zh: "运行可观测", en: "Operational visibility" }, body: { zh: "延迟、Token、费用、目录与供应商健康状态集中可见。", en: "See latency, tokens, cost, catalog state, and provider health in one place." }, className: "pillar-wide pillar-metal" },
] as const;

export default function HomePage() {
  const { text } = useLanguage();

  return (
    <>
      <section className="home-hero">
        <Image className="hero-image" src={heroNetwork} alt="" fill priority sizes="100vw" />
        <div className="hero-scrim" />
        <div className="hero-content section-shell">
          <span className="hero-kicker">ENTERPRISE AI WORKSPACE</span>
          <h1>{text({ zh: "连接每个智能节点，重塑 AI 生产力中枢", en: "One intelligent core for every model and idea" })}</h1>
          <p>{text({ zh: "统一模型、知识与团队工作流，让每次生成可靠、可追溯。", en: "Unify models, knowledge, and team workflows. Make every generation reliable and traceable." })}</p>
          <div className="hero-actions">
            <a className="button button-acid" href={APP_URL} target="_blank" rel="noreferrer">
              {text({ zh: "进入工作台", en: "Open workspace" })}<ArrowUpRight size={17} weight="bold" />
            </a>
            <Link className="button button-secondary" href="/product">
              {text({ zh: "了解产品", en: "Explore product" })}<ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </div>
      </section>

      <section className="proof-strip section-shell" aria-label={text({ zh: "产品能力指标", en: "Product capability metrics" })}>
        <div><strong>100+</strong><span>{text({ zh: "模型生态", en: "model ecosystem" })}</span></div>
        <div><strong>0</strong><span>{text({ zh: "幂等重传重复扣费", en: "duplicate charges on replay" })}</span></div>
        <div><strong>200</strong><span>{text({ zh: "页 PDF 单文档上限", en: "PDF pages per document" })}</span></div>
        <div><strong>AES-256</strong><span>{text({ zh: "密钥认证加密", en: "authenticated encryption" })}</span></div>
      </section>

      <section className="workspace-section section-shell section-pad">
        <Reveal>
          <span className="section-kicker">LIVE PRODUCT PREVIEW</span>
          <h2 className="section-title">{text({ zh: "不是演示图，是一套可以点击的工作方式。", en: "Not a mockup. A workflow you can interact with." })}</h2>
          <p className="section-copy">{text({ zh: "切换模型与分支，查看 AI2Dot 如何保留上下文、引用来源与实时性能指标。", en: "Switch models and branches to see how AI2Dot preserves context, citations, and live performance signals." })}</p>
        </Reveal>
        <Reveal delay={100}><InteractiveWorkspace /></Reveal>
      </section>

      <section className="model-rail" aria-label={text({ zh: "支持的模型生态", en: "Supported model ecosystem" })}>
        <div className="section-shell model-rail-inner">
          <span>OpenAI</span><span>Claude</span><span>DeepSeek</span><span>Gemini</span><span>OpenRouter</span><span>ZenMux</span><span>Private Gateway</span>
        </div>
      </section>

      <section className="pillars-section section-shell section-pad">
        <Reveal>
          <h2 className="section-title">{text({ zh: "为企业 AI 的真实复杂度而生。", en: "Built for the real complexity of enterprise AI." })}</h2>
          <p className="section-copy">{text({ zh: "从模型接入到可靠性控制，每一层都为可验证的生产使用设计。", en: "From model access to reliability controls, every layer is designed for verifiable production use." })}</p>
        </Reveal>
        <div className="pillar-grid">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <Reveal className={`pillar ${pillar.className}`} delay={index * 55} key={pillar.title.zh}>
                <Icon size={24} weight="duotone" />
                <div><h3>{text(pillar.title)}</h3><p>{text(pillar.body)}</p></div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="architecture-section section-pad">
        <div className="section-shell architecture-grid">
          <Reveal className="architecture-copy">
            <span className="section-kicker">SECURITY BY ARCHITECTURE</span>
            <h2 className="section-title">{text({ zh: "密钥不离开服务端，私网不成为攻击入口。", en: "Keys stay server-side. Private networks stay unreachable." })}</h2>
            <p className="section-copy">{text({ zh: "凭证认证加密、租户边界与 SSRF 私网拦截共同构成默认安全路径。", en: "Authenticated encryption, tenant boundaries, and SSRF network filtering form the default secure path." })}</p>
            <Link className="text-link" href="/product">{text({ zh: "查看完整架构", en: "See the architecture" })}<ArrowRight size={16} weight="bold" /></Link>
          </Reveal>
          <Reveal className="architecture-map" delay={120}>
            <div className="architecture-core"><span>DOT CORE</span><strong>{text({ zh: "策略路由", en: "Policy routing" })}</strong></div>
            <div className="architecture-node node-a"><small>CLIENT</small><strong>{text({ zh: "加密请求", en: "Encrypted request" })}</strong></div>
            <div className="architecture-node node-b"><small>VAULT</small><strong>AES-256-GCM</strong></div>
            <div className="architecture-node node-c"><small>NETWORK</small><strong>{text({ zh: "私网拦截", en: "Private IP block" })}</strong></div>
            <div className="architecture-node node-d"><small>NEON</small><strong>{text({ zh: "租户隔离", en: "Tenant isolation" })}</strong></div>
            <span className="map-line line-a" /><span className="map-line line-b" /><span className="map-line line-c" /><span className="map-line line-d" />
          </Reveal>
        </div>
      </section>

      <section className="pricing-preview section-shell section-pad">
        <Reveal>
          <h2 className="section-title">{text({ zh: "从个人探索，到企业级控制。", en: "From individual exploration to enterprise control." })}</h2>
          <p className="section-copy">{text({ zh: "先用真实工作流验证价值，再按团队与治理需求扩展。", en: "Prove value in real workflows, then scale with your team and governance needs." })}</p>
        </Reveal>
        <div className="pricing-asymmetric">
          <Reveal className="price-featured" delay={80}>
            <div><span>{text({ zh: "团队首选", en: "For teams" })}</span><h3>Team</h3></div>
            <div className="price-number"><strong>$49</strong><span>{text({ zh: "/ 席位 / 月", en: "/ seat / mo" })}</span></div>
            <p>{text({ zh: "共享工作区、智能体、知识库与 30 天成本可观测。", en: "Shared workspaces, assistants, knowledge, and 30-day cost visibility." })}</p>
            <Link className="button button-acid" href="/pricing">{text({ zh: "查看方案", en: "Compare plans" })}<ArrowRight size={16} weight="bold" /></Link>
          </Reveal>
          <div className="price-stack">
            <Reveal className="price-compact" delay={140}><div><small>PRO</small><h3>$19</h3></div><p>{text({ zh: "为独立工程师与顾问提供完整 AI 工作流。", en: "The complete AI workflow for independent builders and consultants." })}</p></Reveal>
            <Reveal className="price-compact" delay={200}><div><small>ENTERPRISE</small><h3>{text({ zh: "定制", en: "Custom" })}</h3></div><p>{text({ zh: "VPC、SSO、专属网关与 SLA。", en: "VPC, SSO, dedicated gateways, and SLA." })}</p></Reveal>
          </div>
        </div>
      </section>

      <section className="use-cases section-pad">
        <div className="section-shell">
          <Reveal><h2 className="section-title">{text({ zh: "不同团队，同一个可信工作面。", en: "Different teams. One trusted workspace." })}</h2></Reveal>
          <div className="use-case-list">
            {[
              { n: "R&D", zh: "研发架构团队", en: "Engineering architecture", zhBody: "并行比较模型推理，保留决策分支与技术依据。", enBody: "Compare model reasoning in parallel and retain every decision branch." },
              { n: "LEGAL", zh: "法务投研团队", en: "Legal and research", zhBody: "在私有文档中检索，回答附带可回溯的原始来源。", enBody: "Retrieve across private documents with traceable sources in every answer." },
              { n: "GLOBAL", zh: "出海业务团队", en: "Global operations", zhBody: "统一全球模型入口，按任务、成本与地区策略灵活调度。", enBody: "Route global models by task, cost, and regional policy from one entry point." },
            ].map((item, index) => (
              <Reveal className="use-case-row" delay={index * 70} key={item.n}>
                <span>{item.n}</span><h3>{languageAware(text, item.zh, item.en)}</h3><p>{languageAware(text, item.zhBody, item.enBody)}</p><ArrowUpRight size={20} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="faq-section section-shell section-pad">
        <Reveal><h2 className="section-title">{text({ zh: "常见问题", en: "Common questions" })}</h2></Reveal>
        <div className="faq-list">
          {[
            { q: { zh: "AI2Dot 会保存我的模型密钥吗？", en: "Does AI2Dot store my model keys?" }, a: { zh: "密钥以 AES-256-GCM 加密后存储，明文不会回传浏览器，仅在服务端发起模型请求时短暂解密。", en: "Keys are stored with AES-256-GCM encryption, never returned to the browser, and only decrypted server-side for model requests." } },
            { q: { zh: "可以接入私有模型网关吗？", en: "Can we connect a private model gateway?" }, a: { zh: "可以。支持任意兼容 OpenAI Chat Completions 与 Models API 的 HTTPS 服务，并执行地址与私网安全校验。", en: "Yes. Any HTTPS service compatible with OpenAI Chat Completions and Models APIs can connect, subject to network safety checks." } },
            { q: { zh: "分支重试与普通重试有什么不同？", en: "How is branch retry different?" }, a: { zh: "分支重试不会覆盖原回答，而是复制问题之前的上下文并创建一条新路径，便于比较模型与提示词差异。", en: "Branch retry preserves the original response and creates a new path from the same context for direct comparison." } },
            { q: { zh: "知识库支持哪些文件？", en: "Which knowledge formats are supported?" }, a: { zh: "支持 PDF、DOCX、TXT、Markdown、CSV 与 JSON。单份 PDF 上限 200 页，文本上限 50 万字符。", en: "PDF, DOCX, TXT, Markdown, CSV, and JSON are supported. PDFs can contain up to 200 pages and text up to 500,000 characters." } },
            { q: { zh: "是否支持企业私有化部署？", en: "Is private enterprise deployment available?" }, a: { zh: "Enterprise 方案支持私有 VPC、SSO/SAML、专属模型网关与定制化交付。", en: "Enterprise plans support private VPC, SSO/SAML, dedicated model gateways, and tailored delivery." } },
          ].map((item) => (
            <details key={item.q.zh}><summary>{text(item.q)}<span>+</span></summary><p>{text(item.a)}</p></details>
          ))}
        </div>
      </section>

      <FinalCta />
    </>
  );
}

function languageAware(
  text: <T>(value: { zh: T; en: T }) => T,
  zh: string,
  en: string,
) {
  return text({ zh, en });
}
