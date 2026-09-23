"use client";

import {
  Activity,
  Bot,
  Boxes,
  CircleDollarSign,
  Database,
  FileText,
  HardDrive,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { changePlatformUserStatus } from "@/app/console/actions";
import type { getPlatformConsoleData } from "@/server/platform-admin/store";

type ConsoleData = Awaited<ReturnType<typeof getPlatformConsoleData>>;

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function formatDate(value: string | null) {
  if (!value) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function userLabel(user: ConsoleData["users"][number]) {
  return user.email || user.displayName || user.externalAuthId;
}

export function ConsoleDashboard({
  canManageUsers,
  data,
}: {
  canManageUsers: boolean;
  data: ConsoleData;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      data.users.filter((user) =>
        [user.displayName, user.email, user.externalAuthId]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery)),
      ),
    [data.users, normalizedQuery],
  );
  const maxDailyRequests = Math.max(
    1,
    ...data.dailyUsage.map((item) => item.requests),
  );
  const totalTokens = data.overview.inputTokens + data.overview.outputTokens;

  return (
    <main className="console-content">
      <section className="console-heading" id="overview">
        <div>
          <p>OPERATIONS OVERVIEW</p>
          <h1>平台运行总览</h1>
        </div>
        <span>数据实时读取自 PostgreSQL</span>
      </section>

      <section className="console-metric-grid" aria-label="平台关键指标">
        <article>
          <span className="console-metric-icon green"><Users size={18} /></span>
          <small>用户总数</small>
          <strong>{formatCompact(data.overview.users)}</strong>
          <em>24h 活跃 {data.overview.activeUsers24h}</em>
        </article>
        <article>
          <span className="console-metric-icon blue"><Activity size={18} /></span>
          <small>30 天请求</small>
          <strong>{formatCompact(data.overview.requestCount)}</strong>
          <em>成功率 {data.overview.successRate.toFixed(1)}%</em>
        </article>
        <article>
          <span className="console-metric-icon amber"><Sparkles size={18} /></span>
          <small>30 天 Token</small>
          <strong>{formatCompact(totalTokens)}</strong>
          <em>输入 {formatCompact(data.overview.inputTokens)}</em>
        </article>
        <article>
          <span className="console-metric-icon violet"><HardDrive size={18} /></span>
          <small>知识库占用</small>
          <strong>{formatBytes(data.overview.storageBytes)}</strong>
          <em>{data.overview.documents} 个文档</em>
        </article>
      </section>

      <section className="console-band console-traffic">
        <div className="console-section-heading">
          <div>
            <p>LAST 14 DAYS</p>
            <h2>请求趋势</h2>
          </div>
          <span>{data.overview.failedCount} 次失败</span>
        </div>
        <div className="console-chart" aria-label="最近 14 天请求趋势">
          {data.dailyUsage.map((item) => (
            <div className="console-chart-column" key={item.day}>
              <span>{item.requests}</span>
              <div className="console-chart-track">
                <i
                  style={{
                    height: `${Math.max(4, (item.requests / maxDailyRequests) * 100)}%`,
                  }}
                />
              </div>
              <small>{item.day.slice(5).replace("-", "/")}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="console-band" id="users">
        <div className="console-section-heading console-users-heading">
          <div>
            <p>IDENTITY & ACCESS</p>
            <h2>用户管理</h2>
          </div>
          <label className="console-search">
            <Search size={16} />
            <input
              aria-label="搜索用户"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索用户"
              type="search"
              value={query}
            />
          </label>
        </div>
        <div className="console-table-scroll">
          <table className="console-table console-user-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>状态</th>
                <th>空间</th>
                <th>30 天请求</th>
                <th>Token</th>
                <th>存储</th>
                <th>最近活跃</th>
                <th><span className="sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{userLabel(user)}</strong>
                    <small>{user.externalAuthId}</small>
                  </td>
                  <td>
                    <span className={`console-status ${user.status}`}>
                      {user.status === "active" ? "正常" : "已停用"}
                    </span>
                  </td>
                  <td>{user.workspaceCount}</td>
                  <td>{formatCompact(user.requestCount30d)}</td>
                  <td>{formatCompact(user.tokenCount30d)}</td>
                  <td>{formatBytes(user.storageBytes)}</td>
                  <td>{formatDate(user.lastSeenAt)}</td>
                  <td>
                    {canManageUsers ? (
                      <form action={changePlatformUserStatus}>
                        <input name="userId" type="hidden" value={user.id} />
                        <input
                          name="status"
                          type="hidden"
                          value={user.status === "active" ? "suspended" : "active"}
                        />
                        <button
                          className={user.status === "active" ? "danger" : "restore"}
                          type="submit"
                        >
                          {user.status === "active" ? "停用" : "恢复"}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!filteredUsers.length ? (
                <tr><td className="console-empty" colSpan={8}>未找到匹配用户</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="console-band" id="workspaces">
        <div className="console-section-heading">
          <div>
            <p>TENANT INVENTORY</p>
            <h2>空间用量</h2>
          </div>
          <span>{data.overview.workspaces} 个空间</span>
        </div>
        <div className="console-table-scroll">
          <table className="console-table">
            <thead>
              <tr>
                <th>空间</th>
                <th>所有者</th>
                <th>成员</th>
                <th>30 天请求</th>
                <th>Token</th>
                <th>文档</th>
                <th>存储</th>
                <th>会话 / 助手</th>
              </tr>
            </thead>
            <tbody>
              {data.workspaces.map((workspace) => (
                <tr key={workspace.id}>
                  <td><strong>{workspace.name}</strong><small>{workspace.id}</small></td>
                  <td>{workspace.ownerName}</td>
                  <td>{workspace.memberCount}</td>
                  <td>{formatCompact(workspace.requestCount30d)}</td>
                  <td>{formatCompact(workspace.tokenCount30d)}</td>
                  <td>{workspace.documentCount}</td>
                  <td>{formatBytes(workspace.storageBytes)}</td>
                  <td>{workspace.conversationCount} / {workspace.assistantCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="console-resource-grid" id="resources">
        <article>
          <Database size={19} />
          <span>数据库</span>
          <strong>{formatBytes(data.overview.databaseBytes)}</strong>
          <small>PostgreSQL 当前库体积</small>
        </article>
        <article>
          <FileText size={19} />
          <span>知识索引</span>
          <strong>{formatCompact(data.overview.chunks)}</strong>
          <small>分片 · {data.overview.documents} 文档</small>
        </article>
        <article>
          <Bot size={19} />
          <span>助手</span>
          <strong>{formatCompact(data.overview.assistants)}</strong>
          <small>{data.overview.conversations} 个会话</small>
        </article>
        <article>
          <Wrench size={19} />
          <span>能力接入</span>
          <strong>{data.overview.mcpSources + data.overview.skills}</strong>
          <small>{data.overview.mcpSources} MCP · {data.overview.skills} Skill</small>
        </article>
        <article>
          <Boxes size={19} />
          <span>模型供应商</span>
          <strong>{data.overview.providers}</strong>
          <small>全部工作区连接</small>
        </article>
        <article>
          <CircleDollarSign size={19} />
          <span>30 天估算成本</span>
          <strong>${data.overview.estimatedCostUsd.toFixed(4)}</strong>
          <small>基于已记录用量</small>
        </article>
      </section>

      <section className="console-band" id="audit">
        <div className="console-section-heading">
          <div>
            <p>SECURITY LOG</p>
            <h2>最近审计</h2>
          </div>
          <ShieldAlert size={18} />
        </div>
        <div className="console-audit-list">
          {data.auditLogs.map((entry) => (
            <div key={entry.id}>
              <span className="console-audit-mark" />
              <strong>{entry.action}</strong>
              <p>{entry.adminUsername || "system"}</p>
              <code>{entry.resourceType}{entry.resourceId ? ` · ${entry.resourceId}` : ""}</code>
              <time>{formatDate(entry.createdAt)}</time>
            </div>
          ))}
          {!data.auditLogs.length ? <p className="console-empty">暂无审计事件</p> : null}
        </div>
      </section>
    </main>
  );
}
