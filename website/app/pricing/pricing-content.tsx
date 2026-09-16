"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Minus } from "@phosphor-icons/react";
import { useState } from "react";
import { APP_URL } from "@/lib/site";
import { useLanguage } from "@/components/language-provider";
import { Reveal } from "@/components/reveal";
import { FinalCta } from "@/components/final-cta";

const matrix = [
  { zh: "本地会话", en: "Local conversations", values: [true, true, true, true] },
  { zh: "云端同步", en: "Cloud sync", values: [false, true, true, true] },
  { zh: "非覆盖式分支", en: "Non-destructive branches", values: ["3", "∞", "∞", "∞"] },
  { zh: "BYOK 模型接入", en: "BYOK model access", values: [false, true, true, true] },
  { zh: "知识库 RAG", en: "Knowledge RAG", values: [false, true, true, true] },
  { zh: "共享工作区", en: "Shared workspace", values: [false, false, true, true] },
  { zh: "自定义智能体", en: "Custom assistants", values: [false, "5", "∞", "∞"] },
  { zh: "成本可观测", en: "Cost observability", values: [false, "7d", "30d", "Custom"] },
  { zh: "SSO / SAML", en: "SSO / SAML", values: [false, false, false, true] },
  { zh: "私有 VPC", en: "Private VPC", values: [false, false, false, true] },
  { zh: "服务保障", en: "Service assurance", values: ["Community", "Standard", "Priority", "SLA"] },
] as const;

export function PricingContent() {
  const { text } = useLanguage();
  const [annual, setAnnual] = useState(true);

  const plans = [
    { name: "Starter", tag: { zh: "体验版", en: "Explore" }, price: "$0", suffix: { zh: "永久免费", en: "forever" }, description: { zh: "无需配置，体验本地会话与核心交互。", en: "Explore local conversations and the core experience with no setup." }, features: [{ zh: "本地会话体验", en: "Local conversation experience" }, { zh: "演示模型", en: "Demo models" }, { zh: "3 个思维分支", en: "3 reasoning branches" }], href: APP_URL, action: { zh: "立即体验", en: "Start exploring" } },
    { name: "Pro", tag: { zh: "专业版", en: "Professional" }, price: annual ? "$15" : "$19", suffix: { zh: "/ 月", en: "/ month" }, description: { zh: "为独立工程师、研究者与顾问提供完整能力。", en: "The complete workspace for independent builders, researchers, and consultants." }, features: [{ zh: "云端同步", en: "Cloud sync" }, { zh: "无限分支", en: "Unlimited branches" }, { zh: "BYOK 与知识库 RAG", en: "BYOK and knowledge RAG" }], href: APP_URL, action: { zh: "开始使用", en: "Start with Pro" } },
    { name: "Team", tag: { zh: "推荐", en: "Recommended" }, price: annual ? "$39" : "$49", suffix: { zh: "/ 席位 / 月", en: "/ seat / month" }, description: { zh: "让团队共享模型、知识与可观测工作流。", en: "Give teams shared models, knowledge, and observable workflows." }, features: [{ zh: "共享工作区与知识库", en: "Shared workspaces and knowledge" }, { zh: "自定义 Assistants", en: "Custom assistants" }, { zh: "30 天 Token 成本大盘", en: "30-day token cost dashboard" }], href: "/contact", action: { zh: "咨询团队方案", en: "Talk to sales" }, featured: true },
    { name: "Enterprise", tag: { zh: "旗舰定制", en: "Custom" }, price: text({ zh: "商务洽谈", en: "Custom" }), suffix: { zh: "按需交付", en: "tailored delivery" }, description: { zh: "面向严格网络、安全与合规要求的大型组织。", en: "For organizations with strict network, security, and compliance requirements." }, features: [{ zh: "私有 VPC 部署", en: "Private VPC deployment" }, { zh: "SSO / SAML 与专属网关", en: "SSO / SAML and dedicated gateway" }, { zh: "99.99% SLA 方案", en: "99.99% SLA option" }], href: "/contact", action: { zh: "联系企业顾问", en: "Contact enterprise" } },
  ];

  return (
    <>
      <section className="page-hero pricing-hero">
        <div className="section-shell">
          <span className="section-kicker">PRICING</span>
          <h1 className="page-title">{text({ zh: "按价值扩展，不按复杂度付费。", en: "Scale by value, not complexity." })}</h1>
          <p className="page-intro">{text({ zh: "从免费探索到企业级治理，所有方案都保持透明清晰。", en: "From free exploration to enterprise governance, every plan stays clear and transparent." })}</p>
          <div className="billing-toggle" role="group" aria-label={text({ zh: "计费周期", en: "Billing period" })}>
            <button className={!annual ? "is-active" : ""} onClick={() => setAnnual(false)} type="button">{text({ zh: "月付", en: "Monthly" })}</button>
            <button className={annual ? "is-active" : ""} onClick={() => setAnnual(true)} type="button">{text({ zh: "年付", en: "Annual" })}<span>{text({ zh: "省约 20%", en: "Save about 20%" })}</span></button>
          </div>
        </div>
      </section>

      <section className="plans-section section-shell section-pad">
        <div className="plans-grid">
          {plans.map((plan, index) => (
            <Reveal className={`plan ${plan.featured ? "is-featured" : ""}`} delay={index * 60} key={plan.name}>
              <div className="plan-top"><span>{text(plan.tag)}</span><h2>{plan.name}</h2><p>{text(plan.description)}</p></div>
              <div className="plan-price"><strong>{plan.price}</strong><small>{text(plan.suffix)}</small></div>
              <ul>{plan.features.map((feature) => <li key={feature.zh}><Check size={15} weight="bold" />{text(feature)}</li>)}</ul>
              {plan.href.startsWith("http") ? (
                <a className={`button ${plan.featured ? "button-acid" : "button-secondary"}`} href={plan.href} target="_blank" rel="noreferrer">{text(plan.action)}<ArrowUpRight size={16} weight="bold" /></a>
              ) : (
                <Link className={`button ${plan.featured ? "button-acid" : "button-secondary"}`} href={plan.href}>{text(plan.action)}<ArrowRight size={16} weight="bold" /></Link>
              )}
            </Reveal>
          ))}
        </div>
        <p className="pricing-note">{text({ zh: "年付价格按月折算。实际账单、税费与企业交付范围以正式订单为准。", en: "Annual pricing is shown as a monthly equivalent. Final billing, tax, and enterprise scope are confirmed in the order." })}</p>
      </section>

      <section className="comparison-section section-pad">
        <div className="section-shell">
          <Reveal><h2 className="section-title">{text({ zh: "完整功能对照", en: "Full feature comparison" })}</h2><p className="section-copy">{text({ zh: "从个人工作流到企业网络边界，快速确认每个方案的能力范围。", en: "Compare every capability from personal workflows to enterprise network boundaries." })}</p></Reveal>
          <Reveal className="comparison-wrap" delay={80}>
            <table>
              <thead><tr><th>{text({ zh: "能力", en: "Capability" })}</th><th>Starter</th><th>Pro</th><th>Team</th><th>Enterprise</th></tr></thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.zh}><th>{text({ zh: row.zh, en: row.en })}</th>{row.values.map((value, index) => <td key={`${row.zh}-${index}`}>{value === true ? <><Check aria-hidden="true" size={17} weight="bold" /><span className="sr-only">{text({ zh: "包含", en: "Included" })}</span></> : value === false ? <><Minus aria-hidden="true" size={16} /><span className="sr-only">{text({ zh: "不包含", en: "Not included" })}</span></> : value}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="pricing-faq section-shell section-pad">
        <Reveal><h2 className="section-title">{text({ zh: "购买前需要了解的事", en: "Before you choose" })}</h2></Reveal>
        <div className="pricing-faq-grid">
          {[
            { q: { zh: "模型费用包含在订阅中吗？", en: "Are model costs included?" }, a: { zh: "BYOK 模式下，模型费用由您的供应商账户直接结算。订阅费用对应 AI2Dot 工作区与协作能力。", en: "With BYOK, model usage is billed by your provider. The subscription covers the AI2Dot workspace and collaboration features." } },
            { q: { zh: "可以随时升级方案吗？", en: "Can we upgrade at any time?" }, a: { zh: "可以。个人方案可随时升级，Team 与 Enterprise 的席位和交付范围可按实际需求扩展。", en: "Yes. Individual plans can upgrade at any time, while Team and Enterprise capacity can expand with your needs." } },
            { q: { zh: "Enterprise 如何计价？", en: "How is Enterprise priced?" }, a: { zh: "价格根据席位、部署方式、身份集成、专属网关与服务等级确定。我们会先完成需求评估。", en: "Pricing depends on seats, deployment, identity integration, dedicated gateways, and service levels. We begin with a requirements review." } },
            { q: { zh: "是否提供采购与 NDA 支持？", en: "Do you support procurement and NDA review?" }, a: { zh: "支持。企业合作流程可包含 NDA、信息安全问卷、架构评审与试点范围确认。", en: "Yes. Enterprise engagement can include NDA, security questionnaires, architecture review, and pilot scoping." } },
          ].map((item) => <Reveal className="pricing-faq-item" key={item.q.zh}><h3>{text(item.q)}</h3><p>{text(item.a)}</p></Reveal>)}
        </div>
      </section>

      <FinalCta />
    </>
  );
}
