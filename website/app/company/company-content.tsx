"use client";

import { ArrowUpRight, CirclesThreePlus, Crosshair, ShieldCheck } from "@phosphor-icons/react";
import { APP_URL } from "@/lib/site";
import { useLanguage } from "@/components/language-provider";
import { Reveal } from "@/components/reveal";
import { FinalCta } from "@/components/final-cta";

export function CompanyContent() {
  const { text } = useLanguage();

  return (
    <>
      <section className="page-hero company-hero">
        <div className="section-shell company-hero-grid">
          <div>
            <span className="section-kicker">WHY DOT</span>
            <h1 className="page-title">{text({ zh: "点，是思考的原点。连接起来，就是智能的网络。", en: "A dot is where thought begins. Connected, it becomes intelligence." })}</h1>
            <p className="page-intro">{text({ zh: "我们希望让复杂的 AI 能力回到一个安静、可靠、可掌控的工作面。", en: "We bring complex AI capabilities back to one calm, reliable, controllable workspace." })}</p>
          </div>
          <div className="company-orbit" aria-hidden="true"><span className="orbit-core" /><span className="orbit-one" /><span className="orbit-two" /><span className="orbit-three" /></div>
        </div>
      </section>

      <section className="manifesto section-shell section-pad">
        <Reveal>
          <p>{text({ zh: "企业不缺模型，缺的是一套能把模型、知识、权限与责任边界连接起来的工作系统。AI2Dot 从一个点开始：让每次智能调用都清晰、可追溯、可复用。", en: "Enterprises do not lack models. They lack a system connecting models, knowledge, permissions, and accountability. AI2Dot starts from one point: make every intelligent action clear, traceable, and reusable." })}</p>
        </Reveal>
      </section>

      <section className="philosophy-section section-pad">
        <div className="section-shell">
          <Reveal><span className="section-kicker">ENGINEERING PHILOSOPHY</span><h2 className="section-title">{text({ zh: "三条原则，决定我们如何构建产品。", en: "Three principles shape how we build." })}</h2></Reveal>
          <div className="philosophy-list">
            {[
              { icon: Crosshair, enTitle: "Quiet Focus", zhTitle: "极致专注", zh: "界面退到任务之后。减少无意义装饰，让模型、上下文与结果成为视觉中心。", en: "The interface recedes behind the task. Models, context, and outcomes remain the visual center." },
              { icon: CirclesThreePlus, enTitle: "Reliability", zhTitle: "数学级可靠", zh: "从幂等键到生成状态，每次请求都留下可验证、可恢复的工程记录。", en: "From idempotency keys to generation states, every request leaves a verifiable, recoverable record." },
              { icon: ShieldCheck, enTitle: "Privacy First", zhTitle: "数据主权", zh: "您的密钥、知识与工作区边界属于您。默认安全，不以信任替代技术约束。", en: "Your keys, knowledge, and workspace boundaries belong to you. Security is the default, enforced by engineering." },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal className="philosophy-row" delay={index * 80} key={item.enTitle}>
                  <Icon size={32} weight="duotone" />
                  <div><span>{item.enTitle}</span><h3>{text({ zh: item.zhTitle, en: item.enTitle })}</h3></div>
                  <p>{text({ zh: item.zh, en: item.en })}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="company-belief section-pad">
        <div className="section-shell belief-grid">
          <Reveal><h2>{text({ zh: "技术应当放大判断，而不是取代判断。", en: "Technology should amplify judgment, not replace it." })}</h2></Reveal>
          <Reveal delay={100}><p>{text({ zh: "AI2Dot 不追求把更多按钮放进工作台。我们关注的是让人看清上下文、比较不同路径，并在知道依据的前提下作出更好的决定。", en: "AI2Dot is not about adding more buttons to a workspace. It is about seeing context, comparing paths, and making better decisions with visible evidence." })}</p></Reveal>
        </div>
      </section>

      <section className="company-work section-shell section-pad">
        <Reveal>
          <h2 className="section-title">{text({ zh: "现在，就从一个点开始。", en: "Start from one point." })}</h2>
          <p className="section-copy">{text({ zh: "进入 AI2Dot 工作台，把下一个问题变成清晰的工作路径。", en: "Open AI2Dot and turn your next question into a clear path of work." })}</p>
          <a className="button button-acid" href={APP_URL} target="_blank" rel="noreferrer">{text({ zh: "进入工作台", en: "Open workspace" })}<ArrowUpRight size={17} weight="bold" /></a>
        </Reveal>
      </section>

      <FinalCta />
    </>
  );
}
