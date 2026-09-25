"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export function ContactForm() {
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState({ name: "", email: "", company: "", interest: "私有化部署与 VPC" });

  if (submitted) {
    return (
      <div className="text-center py-10 space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">
          {t("咨询已成功提交", "Inquiry Received")}
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
          {t("专属技术架构师已收到需求，将在 2 小时内与您联络。", "Our enterprise solutions architect will reach out within 2 hours.")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4 text-xs sm:text-sm">
      <div>
        <label className="block text-zinc-300 font-medium mb-1">
          {t("您的姓名", "Your Name")}
        </label>
        <input
          type="text"
          required
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          placeholder={t("例如：张先生", "e.g. Alex Morgan")}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-white placeholder-zinc-600 focus:border-[#b7f34a] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-zinc-300 font-medium mb-1">
          {t("企业邮箱", "Work Email")}
        </label>
        <input
          type="email"
          required
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
          placeholder="alex@company.com"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-white placeholder-zinc-600 focus:border-[#b7f34a] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-zinc-300 font-medium mb-1">
          {t("公司名称", "Company Name")}
        </label>
        <input
          type="text"
          required
          value={data.company}
          onChange={(e) => setData({ ...data, company: e.target.value })}
          placeholder={t("例如：某某科技有限公司", "e.g. Acme Technologies Inc.")}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-white placeholder-zinc-600 focus:border-[#b7f34a] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-zinc-300 font-medium mb-1">
          {t("主要诉求", "Primary Objective")}
        </label>
        <select
          value={data.interest}
          onChange={(e) => setData({ ...data, interest: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-[#161a22] px-3.5 py-2 text-white focus:border-[#b7f34a] focus:outline-none"
        >
          <option value="私有化部署与 VPC">{t("私有化部署与 VPC 集成", "On-Premises / VPC Air-Gapped Deployment")}</option>
          <option value="企业 Team 批量采购">{t("企业 Team 方案批量采购", "Team Tier Bulk Licensing & Procurement")}</option>
          <option value="专属私有大模型网关">{t("专属私有大模型网关接入", "Private Model Gateway & Custom LLMs")}</option>
        </select>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-[#b7f34a] py-2.5 text-xs sm:text-sm font-bold text-[#111707] hover:bg-[#c6f764] transition-all flex items-center justify-center gap-1.5 mt-2"
      >
        <Send className="h-4 w-4" />
        <span>{t("提交商务咨询", "Submit Inquiry")}</span>
      </button>
    </form>
  );
}
