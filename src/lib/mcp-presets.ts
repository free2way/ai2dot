export type McpPreset = {
  id: string;
  name: string;
  description: string;
  transport: "http" | "sse";
  url?: string;
  auth: "none" | "bearer" | "oauth";
  secretLabel?: string;
  secretPlaceholder?: string;
  docsUrl: string;
  available: boolean;
  recommended?: boolean;
};

function normalizeMcpUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

/** Maps a source to a preset id by explicit template, or by a known preset URL. */
export function resolveMcpTemplateId(source: {
  templateId: string | null;
  url?: string | null;
}) {
  if (source.templateId) return source.templateId;
  if (!source.url) return null;
  const url = normalizeMcpUrl(source.url);
  return (
    MCP_PRESETS.find((preset) => preset.url && normalizeMcpUrl(preset.url) === url)
      ?.id ?? null
  );
}

export type McpDependencySource = {
  id: string;
  enabled: boolean;
  templateId: string | null;
  toolCount: number;
  hasError: boolean;
};

export function summarizeMcpDependencySource(source: {
  id: string;
  enabled: boolean;
  templateId: string | null;
  url?: string | null;
  tools: readonly unknown[] | null;
  lastError?: string | null;
}): McpDependencySource {
  return {
    id: source.id,
    enabled: source.enabled,
    templateId: resolveMcpTemplateId(source),
    toolCount: source.tools?.length ?? 0,
    hasError: Boolean(source.lastError),
  };
}

/**
 * Template ids that can satisfy Skill MCP dependencies. Shared by the chat
 * picker and server-side Skill resolution so both agree on availability.
 */
export function getAvailableMcpTemplateIdsFromSources(
  sources: McpDependencySource[],
  allowedSourceIds: string[],
) {
  const allowed = new Set(allowedSourceIds);
  const templateIds = new Set<string>();
  for (const source of sources) {
    if (!allowed.has(source.id) || !source.enabled) continue;
    if (source.hasError || source.toolCount === 0) continue;
    if (source.templateId) templateIds.add(source.templateId);
  }
  return templateIds;
}

export const MCP_PRESETS: McpPreset[] = [
  {
    id: "exa",
    name: "Exa Search",
    description: "联网搜索、代码检索与网页内容提取，无需 API Key 即可开始。",
    transport: "http",
    url: "https://mcp.exa.ai/mcp",
    auth: "none",
    docsUrl: "https://exa.ai/docs/get-started/exa-mcp",
    available: true,
    recommended: true,
  },
  {
    id: "tavily",
    name: "Tavily Search",
    description: "面向 AI Agent 的实时搜索、网页提取、站点地图与抓取工具。",
    transport: "http",
    url: "https://mcp.tavily.com/mcp/",
    auth: "bearer",
    secretLabel: "Tavily API Key",
    secretPlaceholder: "tvly-••••••••",
    docsUrl: "https://docs.tavily.com/documentation/mcp",
    available: true,
  },
  {
    id: "context7",
    name: "Context7",
    description: "获取最新版本的框架与 SDK 官方文档，减少过时 API 和幻觉。",
    transport: "http",
    url: "https://mcp.context7.com/mcp",
    auth: "bearer",
    secretLabel: "Context7 API Key",
    secretPlaceholder: "ctx7sk-••••••••",
    docsUrl: "https://github.com/upstash/context7",
    available: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "只读访问仓库、Issues 与 Pull Requests，默认关闭写入类工具。",
    transport: "http",
    url: "https://api.githubcopilot.com/mcp/readonly",
    auth: "bearer",
    secretLabel: "GitHub Personal Access Token",
    secretPlaceholder: "github_pat_••••••••",
    docsUrl: "https://github.com/github/github-mcp-server",
    available: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "读取、搜索和发送邮件需要用户级 Google OAuth 授权。",
    transport: "http",
    auth: "oauth",
    docsUrl: "https://developers.google.com/gmail/api/auth/about-auth",
    available: false,
  },
  {
    id: "notion",
    name: "Notion",
    description: "官方托管 MCP 使用 OAuth，并继承用户现有的页面权限。",
    transport: "http",
    url: "https://mcp.notion.com/mcp",
    auth: "oauth",
    docsUrl: "https://www.notion.com/help/notion-mcp",
    available: false,
  },
  {
    id: "x",
    name: "X",
    description: "访问账号数据和发布内容需要用户级 OAuth 授权。",
    transport: "http",
    auth: "oauth",
    docsUrl: "https://docs.x.com/fundamentals/authentication/oauth-2-0/overview",
    available: false,
  },
];
