"use client";

import { FileText, ShieldCheck, Bot, ExternalLink } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";

interface Props {
  modelName: string;
  branch: "a" | "b";
}
export function PreviewChatArea({ modelName, branch }: Props) {
  const { t } = useLanguage();

  const promptZh =
    branch === "a"
      ? "查看资料摘要"
      : "切换到精简视图";
  const promptEn =
    branch === "a"
      ? "Review the source summary"
      : "Switch to the concise view";

  const answerZh =
    branch === "a"
      ? "已生成结构化摘要，并保留关键事实和可执行事项。"
      : "已切换到精简视图，重点内容保持不变。";
  const answerEn =
    branch === "a"
      ? "A structured summary is ready with key facts and actionable items preserved."
      : "The concise view is ready with the important content preserved.";

  const citeZh = "来源已标注";
  const citeEn = "Source noted";

  return (
    <div className="lg:col-span-8 flex flex-col justify-between rounded-xl bg-black/30 border border-white/[0.08] p-4 min-h-[300px]">
      <div className="space-y-3 text-xs sm:text-sm">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl bg-zinc-800 text-zinc-100 p-2.5">
            {t(promptZh, promptEn)}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#b7f34a]/20 text-[#b7f34a]">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="max-w-[90%] space-y-2 rounded-2xl bg-white/[0.04] border border-white/10 p-3 text-zinc-200">
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 border-b border-white/10 pb-1">
              <span className="text-[#b7f34a] font-semibold">{modelName}</span>
              <span>· {t("分支已就绪", "Branch Synced")}</span>
            </div>
            <p className="leading-relaxed">
              {t(answerZh, answerEn)}
            </p>
            <div className="rounded bg-black/30 p-1.5 border border-white/10 text-[10px] text-zinc-400 flex items-center gap-1">
              <FileText className="h-3 w-3 text-[#b7f34a]" />
              <span>{t(citeZh, citeEn)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-[#b7f34a]" />{" "}
          {t("SHA-256 幂等锁定 · 零重复扣费", "SHA-256 Idempotency Lock · Zero Duplicate Charge")}
        </span>
        <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="text-[#b7f34a] hover:underline flex items-center gap-1">
          {t("进入应用", "Launch App")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
