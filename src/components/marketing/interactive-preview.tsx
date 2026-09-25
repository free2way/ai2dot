"use client";

import { useState } from "react";
import { GitBranch, Zap, ArrowRight } from "lucide-react";
import { APP_URL } from "@/lib/marketing-types";
import { useLanguage } from "@/lib/language-context";
import { PreviewChatArea } from "./preview-card";

export function InteractiveWorkspacePreview() {
  const [model, setModel] = useState<"deepseek" | "claude" | "gpt4">("deepseek");
  const [branch, setBranch] = useState<"a" | "b">("a");
  const { t } = useLanguage();

  const meta = {
    deepseek: { name: "DeepSeek-R1", lat: "240ms", spd: "88 t/s", cost: "$0.002" },
    claude: { name: "Claude 3.7", lat: "260ms", spd: "94 t/s", cost: "$0.008" },
    gpt4: { name: "GPT-4o", lat: "190ms", spd: "115 t/s", cost: "$0.005" },
  };

  return (
    <section className="relative py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f34a]/10 px-3 py-1 text-xs font-semibold text-[#b7f34a] border border-[#b7f34a]/20 mb-3">
            <Zap className="h-3 w-3" /> {t("交互式全景预览", "Interactive Workspace Preview")}
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("体验工业级 AI 生产力工作台", "Experience Industrial AI Productivity")}
          </h2>
          <p className="mt-2 text-zinc-400 text-sm">
            {t(
              "自由切换模型与分支，体验非覆盖式思维树、RAG 混合召回与遥测指标。",
              "Switch models and branches instantly to explore non-destructive thought trees, hybrid RAG citations, and telemetry."
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-[#0e1117] p-3 sm:p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-zinc-400 hidden sm:inline">ai2dot://session</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-black/40 p-1 border border-white/10 text-xs">
                {(["deepseek", "claude", "gpt4"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`rounded px-2 py-0.5 font-medium ${
                      model === m ? "bg-[#b7f34a] text-[#111707] font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-white/5 p-1 text-xs border border-white/10">
                <button
                  type="button"
                  onClick={() => setBranch("a")}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                    branch === "a" ? "bg-white/20 text-white font-semibold" : "text-zinc-400"
                  }`}
                >
                  <GitBranch className="h-3 w-3 text-[#b7f34a]" /> {t("分支 A", "Branch A")}
                </button>
                <button
                  type="button"
                  onClick={() => setBranch("b")}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                    branch === "b" ? "bg-white/20 text-white font-semibold" : "text-zinc-400"
                  }`}
                >
                  <GitBranch className="h-3 w-3 text-cyan-400" /> {t("分支 B", "Branch B")}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-3">
            <PreviewChatArea modelName={meta[model].name} branch={branch} />

            <div className="lg:col-span-4 flex flex-col justify-between rounded-xl bg-black/40 border border-white/[0.06] p-3 text-xs">
              <div className="space-y-2">
                <div className="text-zinc-300 font-semibold border-b border-white/10 pb-1">
                  {t("遥测巡检指标", "Live Telemetry & Auditing")}
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-500">{t("首字响应", "TTFT Latency")}</span>
                  <span className="text-white font-mono">{meta[model].lat}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-500">{t("生成吞吐", "Throughput")}</span>
                  <span className="text-[#b7f34a] font-mono">{meta[model].spd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-500">{t("预估成本", "Estimated Cost")}</span>
                  <span className="text-zinc-300 font-mono">{meta[model].cost}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-500">{t("密钥加密", "Key Encryption")}</span>
                  <span className="text-emerald-400 font-medium">AES-256-GCM</span>
                </div>
              </div>

              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-1 rounded-lg bg-[#b7f34a] py-2 text-xs font-bold text-[#111707] hover:bg-[#c6f764] transition-all"
              >
                <span>{t("启动真实工作台", "Open Full Workspace")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
