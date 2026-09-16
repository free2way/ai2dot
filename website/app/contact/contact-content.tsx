"use client";

import { ArrowUpRight, CheckCircle, FileLock, ShieldCheck } from "@phosphor-icons/react";
import { useState } from "react";
import { APP_URL } from "@/lib/site";
import { useLanguage } from "@/components/language-provider";
import { Reveal } from "@/components/reveal";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactContent() {
  const { language, text } = useLanguage();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, language }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Request failed");
      setState("success");
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : text({ zh: "提交失败，请稍后重试。", en: "Submission failed. Please try again." }));
    }
  }

  return (
    <>
      <section className="contact-hero page-hero">
        <div className="section-shell">
          <span className="section-kicker">ENTERPRISE</span>
          <h1 className="page-title">{text({ zh: "把您的 AI 路线图，变成可交付的工作系统。", en: "Turn your AI roadmap into a working system." })}</h1>
          <p className="page-intro">{text({ zh: "咨询 Team 采购、私有化部署、身份集成与专属模型网关。", en: "Discuss Team procurement, private deployment, identity integration, and dedicated model gateways." })}</p>
        </div>
      </section>

      <section className="contact-section section-shell section-pad">
        <div className="contact-grid">
          <Reveal className="contact-aside">
            <h2>{text({ zh: "我们可以一起完成", en: "What we can deliver together" })}</h2>
            <div className="contact-capabilities">
              {[
                { title: { zh: "Team 方案采购", en: "Team procurement" }, body: { zh: "席位规划、共享工作区与成本可观测配置。", en: "Seat planning, shared workspaces, and cost visibility." } },
                { title: { zh: "企业私有化部署", en: "Private enterprise deployment" }, body: { zh: "VPC、网络边界、模型网关与交付范围评估。", en: "VPC, network boundaries, model gateways, and delivery scoping." } },
                { title: { zh: "身份与合规集成", en: "Identity and compliance" }, body: { zh: "SSO / SAML、NDA、安全问卷与架构评审。", en: "SSO / SAML, NDA, security questionnaires, and architecture review." } },
              ].map((item) => <div key={item.title.zh}><CheckCircle size={18} weight="fill" /><span><strong>{text(item.title)}</strong><small>{text(item.body)}</small></span></div>)}
            </div>
            <div className="nda-note"><FileLock size={24} weight="duotone" /><div><strong>{text({ zh: "标准 NDA 流程", en: "Standard NDA process" })}</strong><p>{text({ zh: "在共享敏感架构与数据边界前，可先完成双向保密协议。", en: "A mutual NDA can be completed before sensitive architecture or data boundaries are shared." })}</p></div></div>
            <a className="text-link" href={APP_URL} target="_blank" rel="noreferrer">{text({ zh: "先体验产品", en: "Explore the product first" })}<ArrowUpRight size={16} weight="bold" /></a>
          </Reveal>

          <Reveal className="contact-form-wrap" delay={100}>
            {state === "success" ? (
              <div className="form-success" role="status">
                <CheckCircle size={42} weight="duotone" />
                <h2>{text({ zh: "已收到您的信息", en: "We received your message" })}</h2>
                <p>{text({ zh: "企业顾问会根据您留下的需求与联系方式跟进。", en: "An enterprise advisor will follow up using the details you provided." })}</p>
                <button className="button button-secondary" onClick={() => setState("idle")} type="button">{text({ zh: "提交另一项咨询", en: "Send another inquiry" })}</button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={submit}>
                <div className="form-heading"><ShieldCheck size={24} weight="duotone" /><div><h2>{text({ zh: "预约企业咨询", en: "Book an enterprise conversation" })}</h2><p>{text({ zh: "请留下业务背景，我们会更有针对性地准备沟通。", en: "Share your context so we can prepare a focused conversation." })}</p></div></div>
                <div className="form-row">
                  <label><span>{text({ zh: "姓名", en: "Name" })}</span><input name="name" minLength={2} maxLength={80} autoComplete="name" required /></label>
                  <label><span>{text({ zh: "工作邮箱", en: "Work email" })}</span><input name="email" type="email" maxLength={160} autoComplete="email" required /></label>
                </div>
                <div className="form-row">
                  <label><span>{text({ zh: "公司", en: "Company" })}</span><input name="company" minLength={2} maxLength={120} autoComplete="organization" required /></label>
                  <label><span>{text({ zh: "团队规模", en: "Team size" })}</span><select name="teamSize" required defaultValue=""><option value="" disabled>{text({ zh: "请选择", en: "Select" })}</option><option>1-10</option><option>11-50</option><option>51-200</option><option>201-1000</option><option>1000+</option></select></label>
                </div>
                <label><span>{text({ zh: "合作方向", en: "Area of interest" })}</span><select name="interest" required defaultValue=""><option value="" disabled>{text({ zh: "请选择", en: "Select" })}</option><option value="team">Team</option><option value="private">{text({ zh: "私有化部署", en: "Private deployment" })}</option><option value="gateway">{text({ zh: "专属模型网关", en: "Dedicated model gateway" })}</option><option value="other">{text({ zh: "其他合作", en: "Other" })}</option></select></label>
                <label><span>{text({ zh: "需求说明", en: "What are you planning?" })}</span><textarea name="details" minLength={20} maxLength={2000} rows={6} required /><small>{text({ zh: "可描述当前模型、数据边界、部署方式或试点目标。", en: "Share current models, data boundaries, deployment needs, or pilot goals." })}</small></label>
                <label className="consent"><input name="consent" type="checkbox" value="accepted" required /><span>{text({ zh: "我同意 AI2Dot 为本次商务咨询处理以上信息。", en: "I agree that AI2Dot may process this information for this business inquiry." })}</span></label>
                {state === "error" && <p className="form-error" role="alert">{message}</p>}
                <button className="button button-acid" disabled={state === "submitting"} type="submit">{state === "submitting" ? text({ zh: "正在提交", en: "Sending" }) : text({ zh: "提交咨询", en: "Send inquiry" })}<ArrowUpRight size={16} weight="bold" /></button>
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  );
}
