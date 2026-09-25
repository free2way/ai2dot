import { SignUp } from "@clerk/nextjs";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { getAuthMode } from "@/server/auth/config";
import { LanguageSwitcher } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const authMode = getAuthMode();
  if (authMode === "clerk") {
    return (
      <main className="auth-shell">
        <LanguageSwitcher />
        <Link className="auth-back" href="/">
          <ArrowLeft size={16} /> 返回工作台
        </Link>
        <SignUp appearance={{ variables: { colorPrimary: "#171914" } }} />
      </main>
    );
  }

  if (authMode === "local") {
    return (
      <main className="auth-shell">
        <LanguageSwitcher />
        <Link className="auth-back" href="/">
          <ArrowLeft size={16} /> 返回首页
        </Link>
        <section className="auth-setup">
          <div className="auth-icon"><UserPlus size={22} /></div>
          <p className="eyebrow">LOCAL ACCOUNT</p>
          <h1>账号由管理员管理</h1>
          <p>本地部署使用服务器配置的管理员账号，不开放在线注册。</p>
          <Link className="primary-link" href="/sign-in">
            前往登录 <ArrowLeft size={15} />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <LanguageSwitcher />
      <section className="auth-setup">
        <div className="auth-icon"><UserPlus size={22} /></div>
        <p className="eyebrow">ACCOUNT SETUP</p>
        <h1>注册入口已就位</h1>
        <p>配置 Clerk 环境变量后，这里将启用邮箱、OAuth 和会话安全能力。</p>
        <Link className="primary-link" href="/">
          先进入演示工作台 <ArrowLeft size={15} />
        </Link>
      </section>
    </main>
  );
}
