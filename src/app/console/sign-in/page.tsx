import { Activity, ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/server/platform-admin/auth";
import { signInToConsole } from "../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid: "管理员账号或密码不正确。连续失败 5 次将锁定 15 分钟。",
};

export default async function ConsoleSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getPlatformAdminSession()) redirect("/console");
  const error = (await searchParams).error;

  return (
    <main className="console-login-shell">
      <section className="console-login-brand" aria-label="ai2dot 平台管理">
        <div className="console-login-mark">
          <Activity size={21} />
        </div>
        <p>AI2DOT CONTROL PLANE</p>
        <h1>平台管理控制台</h1>
        <div className="console-login-status">
          <span />
          管理链路已加密
        </div>
      </section>

      <section className="console-login-panel">
        <Link className="console-login-back" href="/">
          <ArrowLeft size={15} /> 返回应用
        </Link>
        <div className="console-login-title">
          <LockKeyhole size={22} />
          <div>
            <p>ADMIN ACCESS</p>
            <h2>管理员登录</h2>
          </div>
        </div>
        <form action={signInToConsole} className="console-login-form">
          <label htmlFor="username">用户名</label>
          <input
            autoComplete="username"
            autoFocus
            id="username"
            name="username"
            required
            type="text"
          />
          <label htmlFor="password">密码</label>
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            required
            type="password"
          />
          {error && errorMessages[error] ? (
            <p className="console-login-error" role="alert">
              {errorMessages[error]}
            </p>
          ) : null}
          <button type="submit">登录控制台</button>
        </form>
        <p className="console-login-footnote">此入口独立于工作区用户认证。</p>
      </section>
    </main>
  );
}
