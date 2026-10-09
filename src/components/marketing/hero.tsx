"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";

export function MarketingHero() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden pt-20 pb-16 lg:pt-28 lg:pb-24">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-b from-[#b7f34a]/15 via-[#38bdf8]/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-48 h-96 w-96 rounded-full bg-[#b7f34a]/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 -right-48 h-96 w-96 rounded-full bg-cyan-500/10 blur-[100px]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-medium text-zinc-300 backdrop-blur-md mb-8 hover:border-[#b7f34a]/40 transition-colors">
          <span className="flex h-2 w-2 rounded-full bg-[#b7f34a] animate-pulse" />
          <span className="text-[#b7f34a] font-semibold">{t("全新发布", "NEW RELEASE")}</span>
          <span className="text-zinc-500">|</span>
          <span>{t("非覆盖式分支 · 工业级生成幂等 · 混合知识库 RAG", "Tree Branching · Idempotent Engine · Hybrid RAG")}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.12]">
          {t("连接每个智能节点", "Connect Every Intelligent Node")}
          <br />
          <span className="bg-gradient-to-r from-[#ffffff] via-[#e2e8f0] to-[#94a3b8] bg-clip-text text-transparent">
            {t("重塑企业 AI 生产力中枢", "Enterprise AI Orchestration")}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-3xl text-lg text-zinc-300/90 leading-relaxed font-normal sm:text-xl">
          <span className="text-white font-medium">ai2dot</span>{" "}
          {t(
            "为高要求工程师与现代企业打造统一 AI 聚合工作台。打破单一模型束缚，融合非覆盖式思维分支、混合检索知识库与硬件级凭证加密，让智能交互极度可靠、精准、安全。",
            "is the unified intelligence workspace for frontier engineering teams. Unify OpenAI, Claude, DeepSeek and private gateways with non-destructive thought branching, hybrid RAG, and hardware-grade security."
          )}
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 rounded-xl bg-[#b7f34a] px-7 py-3.5 text-sm font-bold text-[#111707] shadow-[0_0_30px_rgba(183,243,74,0.3)] hover:bg-[#c6f764] hover:shadow-[0_0_40px_rgba(183,243,74,0.5)] active:scale-95 transition-all"
          >
            <Sparkles className="h-4 w-4 fill-current" />
            <span>{t("进入 Dot 工作台", "Launch Workspace")}</span>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/[0.08] hover:border-white/25 active:scale-95 transition-all"
          >
            <span>{t("商业方案对比", "Compare Pricing")}</span>
          </Link>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl border border-transparent px-5 py-3.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <span>{t("预约演示 →", "Book a Demo →")}</span>
          </Link>
        </div>

        {/* Production URL Callout */}
        <div className="mt-5 text-xs text-zinc-500 flex items-center justify-center gap-1.5">
          <span>{t("官方生产应用部署于:", "Production Instance:")}</span>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#b7f34a]/80 hover:text-[#b7f34a] font-mono underline underline-offset-4"
          >
            {APP_URL}
          </a>
        </div>

        {/* Metrics Grid */}
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6 border-y border-white/[0.08] py-8">
          <div className="text-left border-l-2 border-[#b7f34a] pl-4">
            <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">100+</div>
            <div className="text-xs text-zinc-400 mt-1">{t("顶尖模型与网关热插拔", "Frontier Models & Gateways")}</div>
          </div>
          <div className="text-left border-l-2 border-emerald-400 pl-4">
            <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("0 次", "Zero")}</div>
            <div className="text-xs text-zinc-400 mt-1">{t("幂等防护网络重复扣费", "Duplicate Call Risks")}</div>
          </div>
          <div className="text-left border-l-2 border-cyan-400 pl-4">
            <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("200 页", "200 Pages")}</div>
            <div className="text-xs text-zinc-400 mt-1">{t("单文档 RAG 毫秒级分块召回", "Hybrid RAG Per-Doc")}</div>
          </div>
          <div className="text-left border-l-2 border-amber-400 pl-4">
            <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">AES-256</div>
            <div className="text-xs text-zinc-400 mt-1">{t("金融硬件级敏感密钥加密", "Hardware Key Vault GCM")}</div>
          </div>
        </div>

        {/* Supported Models Ecosystem */}
        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {t("原生深度协同与多协议调度生态", "Supported Providers & Universal Protocol Ecosystem")}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {[
              "OpenAI GPT-4o",
              "Claude 3.7 Sonnet",
              "DeepSeek-R1 / V3",
              "Google Gemini 2.0",
              "OpenRouter",
              "ZenMux",
              "Private Ollama/vLLM",
            ].map((model) => (
              <span
                key={model}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-[#b7f34a]/40 hover:text-white transition-all"
              >
                {model}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
