import {
  Activity,
  Bot,
  Boxes,
  Database,
  Gauge,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/server/platform-admin/auth";
import { signOutOfConsole } from "../actions";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getPlatformAdminSession();
  if (!admin) redirect("/console/sign-in");

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="console-brand">
          <span className="console-brand-mark">
            <Activity size={18} />
          </span>
          <div>
            <strong>ai2dot</strong>
            <small>CONTROL PLANE</small>
          </div>
        </div>

        <nav className="console-nav" aria-label="控制台导航">
          <a href="#overview"><Gauge size={17} />总览</a>
          <a href="#users"><Users size={17} />用户</a>
          <a href="#workspaces"><Boxes size={17} />空间</a>
          <a href="#resources"><Database size={17} />资源</a>
          <a href="#audit"><ShieldCheck size={17} />审计</a>
        </nav>

        <div className="console-admin-profile">
          <span><Bot size={17} /></span>
          <div>
            <strong>{admin.displayName}</strong>
            <small>{admin.role.replace("_", " ")}</small>
          </div>
          <form action={signOutOfConsole}>
            <button aria-label="退出管理控制台" title="退出">
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <div>
            <span className="console-live-dot" />
            PLATFORM ONLINE
          </div>
          <p>平台管理控制台</p>
        </header>
        {children}
      </div>
    </div>
  );
}
