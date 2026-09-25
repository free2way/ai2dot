"use client";

import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingCtaSection } from "@/components/marketing/cta-section";
import { Shield, Target, Compass, Users } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function CompanyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#07090c] text-zinc-100 selection:bg-[#b7f34a]/30 selection:text-white">
      <MarketingNavbar />

      <main className="relative py-16 sm:py-24">
        {/* Header */}
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f34a]/10 px-3.5 py-1 text-xs font-semibold text-[#b7f34a] border border-[#b7f34a]/20 mb-4">
            <Compass className="h-3.5 w-3.5" /> {t("我们的使命与哲学", "Our Mission & Philosophy")}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            {t("连接每一个智能节点", "Connect Every Intelligent Node")}
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed">
            {t(
              "在信息爆炸与模型更迭日新月异的时代，我们坚信：真正有力量的工具应当是极度克制、专注而可靠的。",
              "In an era of relentless model churn and fragmented AI interfaces, we believe true productivity tools must be radically focused, restrained, and mathematically reliable."
            )}
          </p>
        </div>

        {/* Story */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mt-16 space-y-12 text-sm sm:text-base text-zinc-400 leading-relaxed">
          <div className="rounded-3xl border border-white/10 bg-[#0d1016] p-8 sm:p-10 space-y-4">
            <h2 className="text-2xl font-bold text-white">
              {t("为什么命名为「Dot」？", "Why 'Dot'?")}
            </h2>
            <p>
              {t(
                "在几何学中，点（Dot）是一切维度的原点；在计算世界中，每一个节点（Node/Dot）互联便诞生了互联网与分布式智能。",
                "In geometry, a dot is the point of origin for all dimensions. In computing, interconnected nodes (dots) form the foundation of the internet and distributed intelligence."
              )}
            </p>
            <p>
              {t(
                "我们创立 ai2dot，初心就是打造一个既能帮助创作者沉浸思考、又能一站连接全球顶尖 AI 算力节点的中心工作台。我们不制造花哨的玩具，我们只打磨工程师和企业可以全权托付关键业务的生产级系统。",
                "We founded ai2dot to provide a unified command center connecting humans to frontier AI compute. We don't build disposable chat wrappers — we engineer mission-critical systems that engineering leaders trust."
              )}
            </p>
          </div>

          {/* Three Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7f34a]/10 text-[#b7f34a]">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {t("极致专注 (Quiet Focus)", "Quiet Focus")}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t(
                  "去除一切干扰性的浮夸交互，提供沉浸温润的排版与流式响应体验，让思考回归本质。",
                  "Zero distraction or marketing fluff. Ergonomic typography and fluid streaming tuned for deep cognitive work."
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {t("数学级可靠 (Reliability)", "Cryptographic Reliability")}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t(
                  "全链路幂等设计、非覆盖式分支状态留存，保障在任何意外重传或弱网下数据零差错。",
                  "Deterministic SHA-256 idempotency locks and append-only state trees protect you against network failure."
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {t("数据主权 (Privacy First)", "Data Sovereignty")}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t(
                  "坚持 BYOK 架构与 AES-256-GCM 本地加密，用户完全掌控自己的 API 凭据与隐私资产。",
                  "BYOK architecture and hardware-derived AES-256-GCM authenticated cipher keep enterprise keys private."
                )}
              </p>
            </div>
          </div>
        </div>

        <MarketingCtaSection />
      </main>

      <MarketingFooter />
    </div>
  );
}
