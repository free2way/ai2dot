"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react";
import { APP_URL } from "@/lib/site";
import { Brand } from "@/components/brand";
import { useLanguage } from "@/components/language-provider";

export function SiteFooter() {
  const { text } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Brand />
          <p>{text({ zh: "连接模型、知识与团队，让可靠的 AI 工作流发生在同一个点。", en: "Bring models, knowledge, and teams into one reliable AI workspace." })}</p>
        </div>
        <div className="footer-links">
          <div>
            <strong>{text({ zh: "探索", en: "Explore" })}</strong>
            <Link href="/product">{text({ zh: "产品", en: "Product" })}</Link>
            <Link href="/pricing">{text({ zh: "定价", en: "Pricing" })}</Link>
            <Link href="/company">{text({ zh: "公司", en: "Company" })}</Link>
          </div>
          <div>
            <strong>{text({ zh: "联系", en: "Contact" })}</strong>
            <Link href="/contact">{text({ zh: "企业合作", en: "Enterprise" })}</Link>
            <a href={APP_URL} target="_blank" rel="noreferrer">
              {text({ zh: "进入工作台", en: "Open workspace" })}
              <ArrowUpRight size={13} weight="bold" />
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} AI2Dot</span>
        <span>{text({ zh: "为清晰、可靠的智能协作而设计", en: "Designed for clear, reliable intelligence" })}</span>
      </div>
    </footer>
  );
}
