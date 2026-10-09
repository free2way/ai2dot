"use client";

import { Quote, CheckCircle2 } from "lucide-react";
import { USE_CASES } from "@/lib/marketing-data";
import { useLanguage } from "@/lib/language-context";

export function UseCasesSection() {
  const { language, t } = useLanguage();

  return (
    <section className="relative py-16 lg:py-24 bg-black/20 border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1 text-xs font-semibold text-zinc-300 border border-white/10 mb-3">
            {t("行业落地与客户验证", "Customer Validation")}
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {t("驱动行业领先者的关键生产力", "Powering Engineering Leaders")}
          </h2>
          <p className="mt-4 text-zinc-400 text-base sm:text-lg">
            {t(
              "从开源底层软件开发到合规知识检索，深入不同技术与商业场景。",
              "From systems infrastructure to enterprise compliance knowledge retrieval."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {USE_CASES.map((item, idx) => {
            const quote = (language === "en" && item.quoteEn) ? item.quoteEn : item.quote;
            const benefit = (language === "en" && item.benefitEn) ? item.benefitEn : item.benefit;
            const role = (language === "en" && item.roleEn) ? item.roleEn : item.role;
            const company = (language === "en" && item.companyEn) ? item.companyEn : item.company;

            return (
              <div
                key={idx}
                className="relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0d1016]/90 p-7 hover:border-white/20 transition-all"
              >
                <div>
                  <Quote className="h-8 w-8 text-[#b7f34a]/30 mb-4" />
                  <p className="text-sm leading-relaxed text-zinc-300 italic">
                    “{quote}”
                  </p>
                </div>

                <div className="mt-8 border-t border-white/[0.08] pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#b7f34a] mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{benefit}</span>
                  </div>
                  <div className="text-xs font-semibold text-white">{role}</div>
                  <div className="text-[11px] text-zinc-500">{company}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
