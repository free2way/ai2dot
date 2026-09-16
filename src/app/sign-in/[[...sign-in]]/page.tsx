import { SignIn } from "@clerk/nextjs";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { isClerkConfigured } from "@/server/auth/config";
import { LanguageSwitcher } from "@/lib/i18n";

export default function SignInPage() {
  if (isClerkConfigured()) {
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
          在 <code>.env.local</code> 中填写 Clerk 的 publishable key 和 secret
          key，刷新页面后即可启用邮箱及 OAuth 登录。
        </p>
        <Link className="primary-link" href="/">
          先进入演示工作台 <ArrowLeft size={15} />
        </Link>
      </section>
    </main>
  );
}
