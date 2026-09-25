"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X, Sparkles } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";
import { LanguageToggle } from "./language-toggle";

export function MarketingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();

  const navLinks = [
    { href: "/product", zh: "产品矩阵", en: "Product" },
    { href: "/pricing", zh: "商业方案", en: "Pricing" },
    { href: "/#architecture", zh: "架构与安全", en: "Security" },
    { href: "/company", zh: "关于公司", en: "Company" },
    { href: "/contact", zh: "商务咨询", en: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#0c0e12]/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#1a2312] to-[#283917] p-0.5 shadow-md shadow-[#b7f34a]/10 ring-1 ring-[#b7f34a]/40 group-hover:ring-[#b7f34a] transition-all duration-300">
              <span className="h-2.5 w-2.5 rounded-full bg-[#b7f34a] shadow-[0_0_12px_#b7f34a] group-hover:scale-110 transition-transform" />
              <span className="absolute -inset-0.5 rounded-xl bg-[#b7f34a]/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
            <span className="font-sans text-xl font-bold tracking-tight text-white flex items-center gap-1">
              ai<span className="text-[#b7f34a]">2</span>dot
              <span className="ml-1.5 rounded-full bg-[#b7f34a]/10 px-2 py-0.5 text-[10px] font-medium text-[#b7f34a] border border-[#b7f34a]/20">
                Workspace
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-white transition-colors duration-200"
              >
                {t(item.zh, item.en)}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right CTA Actions */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            {t("预约演示", "Book a Demo")}
          </Link>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-1.5 rounded-lg bg-[#b7f34a] px-3.5 py-2 text-xs font-bold text-[#141b07] shadow-[0_0_20px_rgba(183,243,74,0.25)] hover:bg-[#c6f764] hover:shadow-[0_0_28px_rgba(183,243,74,0.4)] active:scale-[0.98] transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 fill-current" />
            <span>{t("进入工作台", "Launch App")}</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-white/[0.08] bg-[#0c0e12] px-4 py-6 md:hidden">
          <div className="flex flex-col gap-4 text-base font-medium text-zinc-300">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-white"
              >
                {t(item.zh, item.en)}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-2.5 text-sm font-bold text-[#141b07]"
              >
                <span>{t("立即进入工作台", "Launch Workspace")}</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
