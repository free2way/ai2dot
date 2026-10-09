import { SignIn } from "@clerk/nextjs";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthMode } from "@/server/auth/config";
import { getRequestIdentity } from "@/server/auth/session";
import { LanguageSwitcher } from "@/lib/i18n";
import { signInLocally } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  configuration: "本地认证配置不完整，请检查服务器环境变量。",
  invalid: "邮箱或密码不正确。",
  "rate-limit": "登录尝试过于频繁，请 15 分钟后重试。",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const authMode = getAuthMode();
  if (authMode === "clerk") {
    return (
      <main className="auth-shell">
        <LanguageSwitcher />
        <Link className="auth-back" href="/">
          <ArrowLeft size={16} /> 返回工作台
        </Link>
        <SignIn appearance={{ variables: { colorPrimary: "#171914" } }} />
      </main>
    );
  }

  if (authMode === "local") {
    if (await getRequestIdentity()) redirect("/workspace");
    const error = (await searchParams).error;

    return (
      <main className="auth-shell">
        <LanguageSwitcher />
        <Link className="auth-back" href="/">
          <ArrowLeft size={16} /> 返回首页
        </Link>
        <section className="auth-setup local-auth-panel">
          <div className="auth-icon">
            <KeyRound size={22} />
          </div>
          <p className="eyebrow">LOCAL ADMIN</p>
          <h1>登录工作台</h1>
          <form action={signInLocally} className="local-auth-form">
            <label htmlFor="email">邮箱</label>
            <input
              autoComplete="username"
              id="email"
              name="email"
              required
              type="email"
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
              <p className="auth-error" role="alert">
                {errorMessages[error]}
              </p>
            ) : null}
            <button className="primary-link" type="submit">
              登录
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <LanguageSwitcher />
      <section className="auth-setup">
        <div className="auth-icon">
          <KeyRound size={22} />
        </div>
        <p className="eyebrow">AUTH SETUP</p>
        <h1>登录入口已就位</h1>
        <p>
          配置本地认证环境变量，或填写 Clerk 的 publishable key 和 secret
          key，即可启用安全登录。
        </p>
        <Link className="primary-link" href="/">
          先进入演示工作台 <ArrowLeft size={15} />
        </Link>
      </section>
    </main>
  );
}
