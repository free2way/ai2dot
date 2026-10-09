"use client";

import { ExternalLink, MessageSquare, Notebook, ShieldCheck } from "lucide-react";
import { MarketingCtaSection } from "@/components/marketing/cta-section";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";

export default function ProductPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#07090c] text-zinc-100 selection:bg-[#b7f34a]/30 selection:text-white">
      <MarketingNavbar />
      <main className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f34a]/10 px-3.5 py-1 text-xs font-semibold text-[#b7f34a] border border-[#b7f34a]/20 mb-4">
            <MessageSquare className="h-3.5 w-3.5" /> {t("产品能力", "Product")}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            {t("把常用工作集中到一个工作区", "One workspace for everyday work")}
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed">
            {t(
              "连接模型、会话、知识库、外部工具和研究内容，按你的工作方式组织信息。",
              "Bring models, conversations, knowledge, external tools, and research into one focused workspace.",
            )}
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#b7f34a] px-6 py-3 text-sm font-bold text-[#111707] hover:bg-[#c6f764] shadow-lg shadow-[#b7f34a]/20"
            >
              <span>{t("打开工作区", "Open workspace")}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-16 grid gap-6 md:grid-cols-3">
          {[
            [MessageSquare, "多模型聊天", "Multi-model chat", "在同一会话中选择合适的模型并保留历史。"],
            [Notebook, "知识与研究", "Knowledge and research", "整理资料、保存笔记，并在后续对话中继续使用。"],
            [ShieldCheck, "可控的连接", "Controlled connections", "按工作区管理外部来源和访问权限。"],
          ].map(([Icon, title, titleEn, description]) => (
            <article key={title as string} className="rounded-2xl border border-white/10 bg-[#0d1016] p-6">
              <Icon className="h-5 w-5 text-[#b7f34a]" />
              <h2 className="mt-4 text-xl font-bold text-white">{t(title as string, titleEn as string)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description as string}</p>
            </article>
          ))}
        </div>
        <MarketingCtaSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
