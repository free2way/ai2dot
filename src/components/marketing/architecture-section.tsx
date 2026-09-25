"use client";

import { Shield, Lock, Database, Network } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export function ArchitectureSection() {
  const { t } = useLanguage();

  return (
    <section id="architecture" className="relative py-16 lg:py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-3">
            <Shield className="h-3.5 w-3.5" /> {t("企业级安全与架构", "Enterprise Architecture & Security")}
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {t("高可用的工业级拓扑设计", "Fault-Tolerant Enterprise Topology")}
          </h2>
          <p className="mt-4 text-zinc-400 text-base sm:text-lg">
            {t(
              "全链路隔离、只读追加会话流、严苛私网阻断，为企业核心资产筑牢防线。",
              "Full-chain isolation, append-only conversation streams, and strict private IP blocking."
            )}
          </p>
        </div>

        {/* Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Network & SSRF Defense */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 sm:p-8 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {t("物理级网络与 SSRF 防护", "Hardware-Level Network & SSRF Defense")}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t(
                "在连接第三方或企业自建网关时，后端执行底层 DNS 解析与 IP 段双重校验，强制封禁 10.x, 172.16.x, 192.168.x 与 127.0.0.1 等所有私有网络地址，彻底隔绝内网被穿透探测的风险。",
                "When routing to external or self-hosted gateways, the backend validates dual DNS and IP ranges, rejecting 10.x, 172.16.x, 192.168.x, and 127.0.0.1 to eliminate intranet SSRF probing."
              )}
            </p>
            <div className="rounded-lg bg-black/40 p-3 font-mono text-[11px] text-zinc-400 border border-white/5">
              <span>{t("✓ 仅允许有效 HTTPS 协议", "✓ Strict HTTPS Protocol Only")}</span>
              <br />
              <span>{t("✓ RFC 1918 / 4193 私有网段主动拦截", "✓ RFC 1918 / 4193 Private IP Blocked")}</span>
            </div>
          </div>

          {/* Card 2: Vault & Key Encryption */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 sm:p-8 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b7f34a]/10 text-[#b7f34a] border border-[#b7f34a]/20">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {t("AES-256-GCM 凭证保险箱", "AES-256-GCM Key Vault")}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t(
                "工作区配置的每一项 Provider 凭据（BYOK）均通过硬件密钥派生与 AES-256-GCM 认证加密。密钥仅在发起流式推理的瞬间在内存中解电，绝不落盘明文，且永远不回传前端浏览器。",
                "Every BYOK provider credential is hardware-derived and encrypted with AES-256-GCM authenticated cipher. Decrypted purely in ephemeral memory for the duration of inference."
              )}
            </p>
            <div className="rounded-lg bg-black/40 p-3 font-mono text-[11px] text-zinc-400 border border-white/5">
              <span>{t("✓ 96-bit 随机 IV 向量隔离", "✓ 96-bit Random IV Nonce Isolation")}</span>
              <br />
              <span>{t("✓ GCM 128-bit 认证标签完整性校验", "✓ GCM 128-bit Integrity Tag Verification")}</span>
            </div>
          </div>

          {/* Card 3: Distributed State & Neon */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1016] p-6 sm:p-8 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {t("分布式租户与原子限流", "Distributed Tenants & Atomic Rate-Limiting")}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t(
                "基于 Neon PostgreSQL 无服务器分布式数据库，所有表结构具备严格的工作区 (workspace_id) 边界。采用数据库级原子滑动窗口限流，多 Vercel Serverless 实例并发下依然保持口径统一。",
                "Powered by Neon serverless PostgreSQL with strict tenant boundaries. Database-level atomic sliding-window rate limiters prevent race conditions across parallel lambdas."
              )}
            </p>
            <div className="rounded-lg bg-black/40 p-3 font-mono text-[11px] text-zinc-400 border border-white/5">
              <span>{t("✓ 每分钟窗口原子事务计数", "✓ Per-minute Atomic Transaction Counting")}</span>
              <br />
              <span>{t("✓ 会话分支级只追加（Append-Only）持久化", "✓ Append-Only Session Branch Persistence")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
