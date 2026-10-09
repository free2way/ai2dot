"use client";

import {
  Cpu,
  GitFork,
  Database,
  ShieldCheck,
  Lock,
  Activity,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { CORE_FEATURES } from "@/lib/marketing-data";
import { useLanguage } from "@/lib/language-context";

const iconMap = {
  Cpu,
  GitFork,
  Database,
  ShieldCheck,
  Lock,
  Activity,
};

export function FeaturesSection() {
  const { language, t } = useLanguage();

  return (
    <section className="relative py-16 lg:py-24 bg-black/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1 text-xs font-semibold text-zinc-300 border border-white/10 mb-4">
            {t("核心技术支柱", "Architectural Pillars")}
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {t("专为严苛业务场景构建", "Built for Mission-Critical Teams")}
          </h2>
          <p className="mt-4 text-zinc-400 text-base sm:text-lg">
            {t(
              "从密钥物理隔离到幂等请求防重计费，ai2dot 在每一个底层细节上守护企业的 AI 生产力与资产安全。",
              "From hardware-grade key isolation to request-level deduplication, engineered for enterprise reliability."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_FEATURES.map((feature) => {
            const Icon = iconMap[feature.iconName] || Cpu;
            const badge = (language === "en" && feature.badgeEn) ? feature.badgeEn : feature.badge;
            const title = (language === "en" && feature.titleEn) ? feature.titleEn : feature.title;
            const description = (language === "en" && feature.descriptionEn) ? feature.descriptionEn : feature.description;
            const metrics = (language === "en" && feature.metricsEn) ? feature.metricsEn : feature.metrics;

            return (
              <div
                key={feature.id}
                className="group relative rounded-2xl border border-white/10 bg-[#0d1016]/80 p-7 hover:border-[#b7f34a]/40 hover:bg-[#121620] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-[#b7f34a] border border-white/10 group-hover:bg-[#b7f34a]/10 group-hover:border-[#b7f34a]/30 transition-colors">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400 rounded-md bg-white/[0.04] px-2.5 py-1 border border-white/5">
                      {badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2.5 group-hover:text-[#b7f34a] transition-colors">
                    {title}
                  </h3>

                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span className="text-[#b7f34a]/90 font-mono">{metrics}</span>
                  <Link
                    href={`/product#${feature.id}`}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    <span>{t("特性详情", "Details")}</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
