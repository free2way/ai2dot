"use client";

import Link from "next/link";
import { ArrowUpRight, Shield, Terminal } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";

export function MarketingFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/[0.08] bg-[#07090c] text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2312] ring-1 ring-[#b7f34a]/50">
                <span className="h-2 w-2 rounded-full bg-[#b7f34a]" />
              </span>
              <span className="text-xl font-bold tracking-tight text-white">
                ai<span className="text-[#b7f34a]">2</span>dot
              </span>
            </Link>
            <p className="max-w-sm text-sm text-zinc-400 leading-relaxed">
              {t(
                "专为现代企业打造的 AI 聚合协同中枢。具备工业级幂等生成、树状思维分支与硬件级敏感凭证保护。",
                "The modern enterprise AI orchestration workspace. Built with request idempotency, non-destructive thought branching, and hardware-grade security."
              )}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t("全球核心集群全量运行 (Operational)", "All Global Systems Operational")}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              {t("产品矩阵", "Product")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/product#workspace" className="hover:text-white">{t("智能工作台", "AI Workspace")}</Link></li>
              <li><Link href="/product#branching" className="hover:text-white">{t("非覆盖分支", "Tree Branching")}</Link></li>
              <li><Link href="/product#rag" className="hover:text-white">{t("混合知识库 RAG", "Hybrid RAG")}</Link></li>
              <li><Link href="/product#gateway" className="hover:text-white">{t("模型网关与 BYOK", "Gateways & BYOK")}</Link></li>
              <li>
                <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#b7f34a] hover:underline">
                  {t("打开云端应用", "Launch Web App")} <ArrowUpRight className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              {t("方案定价", "Pricing")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/pricing" className="hover:text-white">{t("方案概览", "Overview")}</Link></li>
              <li><Link href="/pricing#starter" className="hover:text-white">{t("Starter 体验版", "Starter Tier")}</Link></li>
              <li><Link href="/pricing#pro" className="hover:text-white">{t("Pro 专业版", "Pro Tier")}</Link></li>
              <li><Link href="/pricing#team" className="hover:text-white">{t("Team 团队版", "Team Tier")}</Link></li>
              <li><Link href="/contact" className="hover:text-white">{t("Enterprise 定制", "Enterprise")}</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              {t("信任与合规", "Trust & Compliance")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/company" className="hover:text-white">{t("关于我们", "About Us")}</Link></li>
              <li><Link href="/#architecture" className="hover:text-white">{t("安全与架构", "Security Specs")}</Link></li>
              <li><Link href="/contact" className="hover:text-white">{t("商务合作", "Contact Sales")}</Link></li>
              <li>
                <span className="inline-flex items-center gap-1.5 text-zinc-400">
                  <Shield className="h-3.5 w-3.5 text-[#b7f34a]" /> AES-256-GCM {t("加密", "Encrypted")}
                </span>
              </li>
              <li>
                <Link href="/workspace" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
                  <Terminal className="h-3 w-3" /> {t("本地工作台入口", "Local Session Gate")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-6 sm:flex-row text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} ai2dot Technologies Inc. {t("保留所有权利。", "All rights reserved.")}</p>
          <div className="flex items-center gap-4">
            <span>{t("隐私政策", "Privacy Policy")}</span>
            <span>{t("服务协议", "Terms of Service")}</span>
            <span>{t("安全白皮书", "Security Whitepaper")}</span>
            <span>{t("99.99% SLA 承诺", "99.99% SLA Guarantee")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
