"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { PRICING_TIERS } from "@/lib/marketing-data";
import { useLanguage } from "@/lib/language-context";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const { language, t } = useLanguage();

  return (
    <section id="pricing" className="relative py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f34a]/10 px-3.5 py-1 text-xs font-semibold text-[#b7f34a] border border-[#b7f34a]/20 mb-3">
            {t("透明计费方案", "Predictable Pricing")}
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {t("灵活方案，随需拓展", "Scale On Your Terms")}
          </h2>
          <p className="mt-4 text-zinc-400 text-base sm:text-lg">
            {t(
              "从极简个人探索到全功能团队协作，为不同发展阶段提供最具竞争力的定价。",
              "From solo engineering exploration to enterprise team collaboration, clear pricing for every scale."
            )}
          </p>

          {/* Billing Interval Toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`rounded-full px-4 py-1.5 transition-all ${
                !isAnnual ? "bg-white text-zinc-900 font-bold shadow" : "text-zinc-400 hover:text-white"
              }`}
            >
              {t("按月计费", "Monthly")}
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-all ${
                isAnnual ? "bg-[#b7f34a] text-[#111707] font-bold shadow" : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>{t("按年计费", "Annual")}</span>
              <span className="rounded-full bg-[#111707]/15 px-1.5 py-0.5 text-[10px]">{t("立省 20%", "Save 20%")}</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {PRICING_TIERS.map((tier) => {
            const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;
            const name = (language === "en" && tier.nameEn) ? tier.nameEn : tier.name;
            const tagline = (language === "en" && tier.taglineEn) ? tier.taglineEn : tier.tagline;
            const features = (language === "en" && tier.featuresEn) ? tier.featuresEn : tier.features;
            const ctaText = (language === "en" && tier.ctaTextEn) ? tier.ctaTextEn : tier.ctaText;

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-7 transition-all ${
                  tier.popular
                    ? "border-2 border-[#b7f34a] bg-gradient-to-b from-[#161c12] to-[#0d1016] shadow-[0_0_35px_rgba(183,243,74,0.15)]"
                    : "border border-white/10 bg-[#0d1016]/80 hover:border-white/20"
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#b7f34a] px-3 py-0.5 text-[11px] font-bold text-[#111707] shadow">
                    {t("推荐首选", "MOST POPULAR")}
                  </span>
                )}

                <div>
                  <h3 className="text-lg font-bold text-white">{name}</h3>
                  <p className="mt-2 text-xs text-zinc-400 min-h-[36px]">{tagline}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
                      ${price}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {tier.priceMonthly === 0
                        ? t("/ 永久免费", "/ forever free")
                        : isAnnual
                        ? t("/ 月 (年付)", "/ mo (billed annually)")
                        : t("/ 月", "/ mo")}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3 border-t border-white/[0.08] pt-6 text-xs text-zinc-300">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 shrink-0 text-[#b7f34a]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  {tier.ctaHref.startsWith("http") ? (
                    <a
                      href={tier.ctaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-bold transition-all ${
                        tier.popular
                          ? "bg-[#b7f34a] text-[#111707] hover:bg-[#c6f764] shadow-[0_0_20px_rgba(183,243,74,0.3)]"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      <span>{ctaText}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link
                      href={tier.ctaHref}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-xs font-bold text-white hover:bg-white/20 transition-all"
                    >
                      <span>{ctaText}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/pricing"
            className="text-xs font-semibold text-zinc-400 hover:text-[#b7f34a] inline-flex items-center gap-1 transition-colors"
          >
            <span>{t("查看完整特性对比矩阵与团队私有化说明", "View Full Feature Matrix & Enterprise Specs")}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
