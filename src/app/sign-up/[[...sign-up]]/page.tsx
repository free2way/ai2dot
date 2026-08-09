import { SignUp } from "@clerk/nextjs";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { isClerkConfigured } from "@/server/auth/config";

export default function SignUpPage() {
  if (isClerkConfigured()) {
    return (
      <main className="auth-shell">
        <Link className="auth-back" href="/">
          <ArrowLeft size={16} /> 返回工作台
        </Link>
        <SignUp appearance={{ variables: { colorPrimary: "#171914" } }} />
      </main>
    );
  }

  return (
    <main className="auth-shell">
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
