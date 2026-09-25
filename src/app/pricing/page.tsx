"use client";

import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { MarketingCtaSection } from "@/components/marketing/cta-section";
import { Check, Minus } from "lucide-react";
import { PRICING_TIERS } from "@/lib/marketing-data";
import { useLanguage } from "@/lib/language-context";

export default function PricingPage() {
  const { language, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#07090c] text-zinc-100 selection:bg-[#b7f34a]/30 selection:text-white">
      <MarketingNavbar />

      <main className="relative">
        <PricingSection />

        {/* Feature Comparison Matrix */}
        <section className="py-12 lg:py-16 border-t border-white/[0.08]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              {t("全方案功能对比矩阵", "Comprehensive Plan Comparison Matrix")}
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0d1016]">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="p-4 font-semibold text-zinc-300">
                      {t("功能与规格", "Features & Specifications")}
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th key={tier.id} className="p-4 font-bold text-white">
                        {language === "en" && tier.nameEn ? tier.nameEn : tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-400">
                  <tr>
                    <td className="p-4 font-medium text-white">{t("工作区模式", "Workspace Architecture")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {language === "en" && tier.specs.workspacesEn ? tier.specs.workspacesEn : tier.specs.workspaces}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-white">{t("模型支持", "Model Support")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {language === "en" && tier.specs.modelsEn ? tier.specs.modelsEn : tier.specs.models}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-white">{t("非覆盖式分支", "Thought Branching")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {language === "en" && tier.specs.branchingEn ? tier.specs.branchingEn : tier.specs.branching}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-white">{t("知识库容量", "Knowledge Base Chunks")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {language === "en" && tier.specs.knowledgeStorageEn ? tier.specs.knowledgeStorageEn : tier.specs.knowledgeStorage}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-white">{t("BYOK 自带密钥", "BYOK Key Vault")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {tier.specs.byok ? (
                          <Check className="h-4 w-4 text-[#b7f34a]" />
                        ) : (
                          <Minus className="h-4 w-4 text-zinc-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-white">{t("成本与健康大盘", "Telemetry & Audit Logs")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {tier.specs.auditLog ? (
                          <Check className="h-4 w-4 text-[#b7f34a]" />
                        ) : (
                          <Minus className="h-4 w-4 text-zinc-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-white">{t("服务支持", "Service SLA & Support")}</td>
                    {PRICING_TIERS.map((tier) => (
                      <td key={tier.id} className="p-4">
                        {language === "en" && tier.specs.supportEn ? tier.specs.supportEn : tier.specs.support}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <FaqSection />
        <MarketingCtaSection />
      </main>

      <MarketingFooter />
    </div>
  );
}
