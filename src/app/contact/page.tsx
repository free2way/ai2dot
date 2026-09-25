"use client";

import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { Mail, Shield, Building, Clock } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { ContactForm } from "@/components/marketing/contact-form";
import { useLanguage } from "@/lib/language-context";

export default function ContactPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#07090c] text-zinc-100 selection:bg-[#b7f34a]/30 selection:text-white">
      <MarketingNavbar />

      <main className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f34a]/10 px-3.5 py-1 text-xs font-semibold text-[#b7f34a] border border-[#b7f34a]/20 mb-3">
              <Building className="h-3.5 w-3.5" /> {t("商务咨询与企业私有化", "Commercial Inquiry & Enterprise Partnerships")}
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              {t("与 ai2dot 专家团队探讨方案", "Connect with ai2dot Solutions Team")}
            </h1>
            <p className="mt-3 text-zinc-400 text-sm sm:text-base">
              {t(
                "无论是团队协同采购、私有 VPC 部署还是定制专属模型网关，我们将在 2 小时内与您联络。",
                "Whether you are planning team procurement, private VPC deployment, or custom gateway integration, our architects reply within 2 hours."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 space-y-4 text-xs sm:text-sm">
                <h3 className="text-base font-bold text-white">
                  {t("直接联络方式", "Direct Channels")}
                </h3>
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Mail className="h-4 w-4 text-[#b7f34a]" />
                  <span>{t("企业商务: ", "Sales: ")}contact@ai2dot.com</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Clock className="h-4 w-4 text-[#b7f34a]" />
                  <span>{t("响应时效: 工作日 2 小时内回复", "Response SLA: Within 2 hours (Weekdays)")}</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Shield className="h-4 w-4 text-[#b7f34a]" />
                  <span>{t("合规支持: 支持标准 NDA 协议签署", "Compliance: Mutual NDA Supported")}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-zinc-400 space-y-2">
                <div className="text-white font-semibold">
                  {t("生产应用快捷入口", "Direct App Access")}
                </div>
                <p>
                  {t(
                    "无需等待商务对接，您可以直接在浏览器中访问生产环境：",
                    "No wait required. Experience the live cloud instance instantly:"
                  )}
                </p>
                <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="text-[#b7f34a] hover:underline block font-mono">
                  {APP_URL}
                </a>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 sm:p-8">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
