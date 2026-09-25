"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { FAQS } from "@/lib/marketing-data";
import { useLanguage } from "@/lib/language-context";

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const { language, t } = useLanguage();

  return (
    <section className="relative py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1 text-xs font-semibold text-zinc-300 border border-white/10 mb-3">
            <HelpCircle className="h-3.5 w-3.5" /> {t("常见问题", "Frequently Asked Questions")}
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("关于 ai2dot 的技术与商业解答", "Technical & Commercial FAQs")}
          </h2>
          <p className="mt-3 text-zinc-400 text-sm sm:text-base">
            {t(
              "了解我们如何在安全性、幂等防护、计费与企业私有化方面提供支持。",
              "Everything you need to know about security, request idempotency, billing, and enterprise deployments."
            )}
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            const question = (language === "en" && faq.questionEn) ? faq.questionEn : faq.question;
            const answer = (language === "en" && faq.answerEn) ? faq.answerEn : faq.answer;

            return (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-[#0d1016]/80 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white hover:text-[#b7f34a] transition-colors"
                >
                  <span className="pr-4">{question}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[#b7f34a]" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm leading-relaxed text-zinc-400 border-t border-white/5">
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
