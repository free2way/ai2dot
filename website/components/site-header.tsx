"use client";

import Link from "next/link";
import { ArrowUpRight, List, X } from "@phosphor-icons/react";
import { useState } from "react";
import { APP_URL } from "@/lib/site";
import { Brand } from "@/components/brand";
import { useLanguage } from "@/components/language-provider";

const navigation = [
  { href: "/product", label: { zh: "产品", en: "Product" } },
  { href: "/pricing", label: { zh: "定价", en: "Pricing" } },
  { href: "/company", label: { zh: "公司", en: "Company" } },
  { href: "/contact", label: { zh: "企业合作", en: "Enterprise" } },
] as const;

export function SiteHeader() {
  const { language, setLanguage, text } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Brand />
        <nav className="desktop-nav" aria-label={text({ zh: "主导航", en: "Primary navigation" })}>
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{text(item.label)}</Link>
          ))}
        </nav>
        <div className="nav-actions">
          <div className="language-toggle" aria-label={text({ zh: "选择语言", en: "Choose language" })}>
            <button className={language === "zh" ? "is-active" : ""} onClick={() => setLanguage("zh")} type="button">中</button>
            <button className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")} type="button">EN</button>
          </div>
          <a className="button button-acid nav-cta" href={APP_URL} target="_blank" rel="noreferrer">
            {text({ zh: "进入工作台", en: "Open workspace" })}
            <ArrowUpRight aria-hidden="true" size={15} weight="bold" />
          </a>
          <button
            className="menu-button"
            type="button"
            aria-expanded={open}
            aria-label={text({ zh: "打开导航", en: "Open menu" })}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>
      <div className={`mobile-nav ${open ? "is-open" : ""}`}>
        {navigation.map((item) => (
          <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>{text(item.label)}</Link>
        ))}
        <a href={APP_URL} target="_blank" rel="noreferrer">
          {text({ zh: "进入工作台", en: "Open workspace" })}
          <ArrowUpRight size={17} weight="bold" />
        </a>
      </div>
    </header>
  );
}
