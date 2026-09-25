# ai2dot

一个面向个人与小团队的多租户 AI 聚合工作台。当前版本具备响应式 Chat UI、AI SDK 流式协议、多模型切换、本地或 Clerk 登录、PostgreSQL 持久化、供应商后台、Generation 可靠性记录、非覆盖式对话分支、知识库检索、指令型 Skill 以及无密钥演示模式。

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。默认使用演示流；登录后可在 `/admin` 添加自己的 OpenAI-compatible 模型供应商和 API Key。Vercel AI Gateway 默认关闭，只有显式配置 `AI_GATEWAY_API_KEY`，或同时设置 `AI2DOT_ENABLE_AI_GATEWAY=true` 与 OIDC 时才会启用。

## Docker 运行与 Linux 部署

项目使用 Next.js standalone 输出构建精简生产镜像，容器以非 root 用户运行。Compose 默认启动 PostgreSQL、应用和 Nginx，并把数据库数据保存在命名 volume `ai2dot_postgres-data` 中。

```bash
# 填写数据库密码、本地管理员账号和会话密钥。Compose 自动读取 .env。
cp .env.example .env

# 生成本地管理员密码哈希并填入 AI2DOT_LOCAL_AUTH_PASSWORD_HASH
npm run auth:hash-password -- 'your-strong-password'

# 首次启动数据库并执行 schema migration
docker compose up -d postgres
docker compose --profile tools run --rm migrate

# 构建并启动应用与 Nginx，默认监听宿主机 3000 端口
docker compose up -d --build app proxy

# 查看容器状态和日志
docker compose ps
docker compose logs -f app proxy
```

数据库 schema 更新后显式执行迁移：

```bash
docker compose --profile tools run --rm migrate
```

Linux 主机需安装 Docker Engine 与 Docker Compose 插件。将项目目录同步到主机后，在项目目录中放置不纳入版本控制的 `.env`，再执行上述迁移及启动命令。通过 `AI2DOT_PORT` 可调整宿主机端口，例如 `AI2DOT_PORT=8080`。

生产入口由 Nginx 提供，启用连接复用、gzip 和 Next.js 静态资源缓存；聊天与 React 流式响应关闭代理缓冲。镜像构建启用 npm/Next BuildKit 缓存，重复发布只重建变化的层。`AI2DOT_NODE_MEMORY_MB` 控制 Node.js 最大堆内存，默认 768 MB；小型主机可降到 384–512，大型文档处理或高并发场景可提高。Clerk 的 `NEXT_PUBLIC_*` 变量会在镜像构建时写入前端资源，修改后必须重新构建镜像。

本地认证使用 scrypt 密码哈希和 HMAC 签名的 HttpOnly Cookie，默认会话有效期为 7 天。公网 HTTPS 部署应设置 `AI2DOT_COOKIE_SECURE=true`。如需改回 Clerk，设置 `AI2DOT_AUTH_MODE=clerk` 并填写 Clerk 两项 key。

创建一次 PostgreSQL 压缩备份：

```bash
mkdir -p backups
docker compose --profile tools run --rm backup
```

## 持久化会话与登录

同时配置认证和 PostgreSQL 后，应用会自动为首次登录用户建立个人工作区。会话在模型调用前以只追加方式写入数据库，完整回答与 token 用量在流结束时更新，每个会话都有可恢复地址 `/chat/[id]`。

每次云端生成都有 UUID 幂等键、SHA-256 请求指纹和 `pending → streaming → completed/failed/stopped` 状态。相同请求重复到达时不会再次扣费；已完成结果会直接回放。对回答执行“分支重试”会保留原回答，复制问题以前的上下文到新分支，并可在右侧会话设置中切换。

```bash
# 写入 .env.local 后创建数据库表
npm run db:migrate
```

未配置认证或 PostgreSQL 时，应用保持可运行，并把当前演示会话保存在浏览器 localStorage。

## 模型供应商后台

访问 `/admin` 管理供应商连接。内置 OpenAI、OpenRouter、DeepSeek、ZenMux、Google Gemini 与自定义 OpenAI-compatible 快捷模板；API Key 使用 AES-256-GCM 加密后入库。

生成加密密钥：

```bash
openssl rand -base64 32
```

配置 `PROVIDER_SECRET_ENCRYPTION_KEY` 后即可添加连接并在线刷新模型目录。后台页面和 API 都会执行账户及工作区管理员权限检查，并显示最近 30 天用量、token、预估费用及供应商健康状态。

## 外部 MCP 来源

访问 `/admin#mcp-sources` 或在模型管理页向下滚动到“外部 MCP 来源”，即可添加远程 MCP 服务。当前支持 Streamable HTTP（推荐）和 SSE 两种传输方式，可选填写 Bearer Token；地址必须使用 HTTPS，并会阻止解析到内网的主机。

保存后 AI2Dot 会测试连接并同步工具清单。MCP 来源必须在助手中加入白名单，或在普通会话的设置面板中由用户明确选择，才会提供给模型。模型最多连续执行 5 个工具步骤；写入、删除和风险未知的工具会在执行前请求用户确认。单个来源不可用时不会阻断普通模型回答。MCP 凭据与模型供应商密钥使用同一套 AES-256-GCM 加密策略。

新增 MCP 数据表后，在本地或部署环境执行一次迁移：

```bash
npm run db:migrate
```

## 外部 Skill

访问 `/admin#skills` 管理工作区 Skill。第一阶段支持粘贴或从 `raw.githubusercontent.com` / `gist.githubusercontent.com` 导入 `SKILL.md` 指令包，解析 `name`、`description`、`version`、`keywords` 和 `required_mcp` 等简单 frontmatter；启用后，聊天会按当前问题相关性最多加载 3 个 Skill。Skill 只提供受限的工作流程上下文，不会执行其中的脚本、命令或隐藏指令，也不会赋予新的 MCP 权限。

Skill 与 MCP 互补：Skill 描述“如何完成工作”，MCP 提供“可以访问的工具和数据”。当前 Skill 内容按工作区隔离保存，支持启用/停用、自动匹配、版本和来源记录，并保存 SHA-256 内容指纹。MCP 工具由助手白名单和用户确认控制；Skill 本身不执行脚本。

持久化聊天默认限制为每位用户每分钟 30 次请求，使用 PostgreSQL 原子计数保证多个实例之间口径一致。可以通过 `AI2DOT_CHAT_RATE_LIMIT_PER_MINUTE` 调整为 1–300。

## 知识库

登录后访问 `/knowledge`，可以按主题创建知识库并导入 PDF、DOCX、TXT、Markdown、CSV 或 JSON；单文件上限 4MB，PDF 上限 200 页。上传接口返回后会继续在后台解析和分块，页面自动刷新处理状态。

检索使用 PostgreSQL `pg_trgm` 关键词候选和 `pgvector` HNSW 语义候选，通过 RRF、关键词相关度和余弦相似度进行混合重排，并限制单篇文档占用的结果数量。Embedding 默认使用 Vercel AI Gateway 的 `openai/text-embedding-3-small`（1536 维）；也可通过 `AI2DOT_EMBEDDING_PROVIDER_NAME` 复用 `/admin` 中已加密保存的工作区 OpenAI-compatible 供应商，或通过其他 `AI2DOT_EMBEDDING_*` 变量连接独立服务。Embedding 暂不可用时自动降级为关键词检索。

文档切块后会创建持久化的 `knowledge_embedding_jobs` 任务。上传请求通过 Next.js `after()` 尽快处理，Docker worker 每 30 秒补领任务，Vercel Cron 每日兜底；任务使用数据库行锁、租约、幂等更新和指数退避，可在函数终止后继续执行。对话启用知识库后，命中的文档会作为结构化来源随回答一起保存。

## 环境服务

- AI：工作区自带的 OpenAI-compatible 供应商；Vercel AI Gateway 为可选能力
- Auth：本地单管理员认证（默认）或 Clerk
- Database：PostgreSQL + Drizzle（工作区、会话分支、消息、Generation、用量、供应商、模型、知识库、MCP 来源、Skill）
- Rate limit：PostgreSQL 分钟窗口原子计数
- Documents：文档提取后按片段存入 PostgreSQL；当前不保留原始上传文件

完整变量见 [`.env.example`](./.env.example)。数据库 schema 位于 `src/server/db/schema.ts`，SQL migration 位于 `drizzle/`。

## 检查命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 项目文档

- [Docker + Linux 可复现部署手册](./docs/docker-linux-deployment.zh-CN.md)
- [技术落地方案](./TECHNICAL_PLAN.md)
- [技术验收方案](./TECHNICAL_ACCEPTANCE_PLAN.md)
