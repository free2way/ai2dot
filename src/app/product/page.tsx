"use client";

import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingCtaSection } from "@/components/marketing/cta-section";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";
import { GitBranch, Database, ShieldCheck, Layers, Sparkles, ExternalLink } from "lucide-react";

export default function ProductPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#07090c] text-zinc-100 selection:bg-[#b7f34a]/30 selection:text-white">
      <MarketingNavbar />

      <main className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f34a]/10 px-3.5 py-1 text-xs font-semibold text-[#b7f34a] border border-[#b7f34a]/20 mb-4">
            <Layers className="h-3.5 w-3.5" /> {t("深度技术与产品全景", "Technical Architecture & System Landscape")}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            {t("构建在可靠性与专注之上的 AI 架构", "Architected for Resilience and Cognitive Focus")}
          </h1>
          <p className="mt-6 text-lg text-zinc-300 max-w-3xl mx-auto leading-relaxed">
            {t(
              "ai2dot 不仅是一个对话界面，更是一套具备密码学安全保证、多分支思维树对比、企业级知识检索与自适应模型调度的生产力引擎。",
              "ai2dot is more than a chat UI — it is an enterprise engine offering cryptographic security, non-destructive thought branching, hybrid RAG, and universal provider orchestration."
            )}
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#b7f34a] px-6 py-3 text-sm font-bold text-[#111707] hover:bg-[#c6f764] shadow-lg shadow-[#b7f34a]/20"
            >
              <Sparkles className="h-4 w-4 fill-current" />
              <span>{t("打开云端生产环境", "Launch Cloud Instance")}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Pillars */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-16 space-y-12">
          {/* Section 1 */}
          <div id="branching" className="rounded-3xl border border-white/10 bg-[#0d1016] p-8">
            <div className="flex items-center gap-2 text-xs font-bold text-[#b7f34a] uppercase mb-3">
              <GitBranch className="h-4 w-4" /> {t("架构亮点 01", "Architecture Pillar 01")}
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t("非覆盖式思维分支（Tree Branching）", "Non-Destructive Thought Branching")}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {t(
                "传统 AI 客户端在重新编辑提问时往往会抹掉后续历史。ai2dot 采用会话树状分支。每次分支重试，旧分支历史完好无损，并在右侧随时切换对比。指派 GPT-4o、Claude 3.7 或 DeepSeek-R1 独立推演，并排比对逻辑差异。",
                "Conventional AI clients erase conversational history upon re-prompting. ai2dot organizes conversations as an append-only tree. Branch anytime without overwriting prior outputs, comparing GPT-4o, Claude 3.7, and DeepSeek-R1 side-by-side."
              )}
            </p>
          </div>

          {/* Section 2 */}
          <div id="rag" className="rounded-3xl border border-white/10 bg-[#0d1016] p-8">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase mb-3">
              <Database className="h-4 w-4" /> {t("架构亮点 02", "Architecture Pillar 02")}
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t("混合检索企业知识库（pg_trgm + 多样性重排）", "Hybrid RAG Engine (pg_trgm + Diversity Re-ranking)")}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {t(
                "支持上传 PDF、DOCX、TXT、Markdown、CSV、JSON 多格式文档。后台执行 1200 字切片与滑动窗口重叠。检索阶段利用 Neon pg_trgm 快速召回高分候选，并通过惩罚机制打散同文档聚类，确保返回的信息来源全面且高度相关。",
                "Ingest PDF, DOCX, TXT, Markdown, CSV, and JSON. Documents are split into 1200-character overlapping chunks. High-concurrency trigram candidate selection combined with diversity re-ranking guarantees comprehensive, mathematically grounded citation recall."
              )}
            </p>
          </div>

          {/* Section 3 */}
          <div id="idempotency" className="rounded-3xl border border-white/10 bg-[#0d1016] p-8">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase mb-3">
              <ShieldCheck className="h-4 w-4" /> {t("架构亮点 03", "Architecture Pillar 03")}
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t("UUID + SHA-256 幂等生成引擎与多模型网关", "Cryptographic SHA-256 Idempotency Engine")}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {t(
                "在弱网重试场景下，ai2dot 为每次对话请求生成唯一的 SHA-256 请求指纹与 UUID 幂等锁。上游模型在生成或已完成时，相同指纹到达会自动回放数据流，从数学原理上杜绝重复扣费。",
                "Every turn is protected with a deterministic SHA-256 hash and atomic locks. Network retries automatically trigger streaming replays from cache, physically precluding redundant upstream API billing."
              )}
            </p>
          </div>
        </div>

        <MarketingCtaSection />
      </main>

      <MarketingFooter />
    </div>
  );
}
