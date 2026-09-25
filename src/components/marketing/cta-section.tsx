"use client";

import Link from "next/link";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";

export function MarketingCtaSection() {
  const { t } = useLanguage();

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0e140a] via-transparent to-transparent opacity-80" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[600px] rounded-full bg-[#b7f34a]/10 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#b7f34a]/30 bg-[#b7f34a]/10 px-4 py-1 text-xs font-semibold text-[#b7f34a] mb-6">
          <Sparkles className="h-3.5 w-3.5" /> {t("即刻开启极简与专注", "Streamlined AI Productivity")}
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
          {t("让 AI 真正成为", "Empower Engineering Teams")}
          <br />
          {t("企业核心生产力的可靠基石", "With Resilient AI Orchestration")}
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
          {t(
            "无需漫长的采购集成周期。即刻启动 Dot 工作台，在毫秒级幂等生成与混合 RAG 赋能下，体验全球主流模型的协同威力。",
            "Zero procurement hurdles. Launch your workspace in seconds with hardware-grade security, thought branching, and hybrid RAG."
          )}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 rounded-xl bg-[#b7f34a] px-8 py-4 text-sm font-bold text-[#111707] shadow-[0_0_30px_rgba(183,243,74,0.35)] hover:bg-[#c6f764] hover:shadow-[0_0_45px_rgba(183,243,74,0.5)] active:scale-95 transition-all"
          >
            <Sparkles className="h-4 w-4 fill-current" />
            <span>{t("进入 Dot 工作台", "Launch Workspace")}</span>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/[0.08] hover:border-white/25 active:scale-95 transition-all"
          >
            <span>{t("预约企业私有化演示", "Book Enterprise Demo")}</span>
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          {t("无需绑定信用卡 · 生产应用地址: ", "No credit card required · Production instance: ")}
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-[#b7f34a] underline underline-offset-4"
          >
            {APP_URL}
          </a>
        </p>
      </div>
    </section>
  );
}
