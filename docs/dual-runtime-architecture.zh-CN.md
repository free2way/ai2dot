# Docker 与 Vercel 双运行环境架构

本文约束 ai2dot 后续 Agent、MCP、知识库和后台任务的实现方式，确保同一套业务代码可以运行在：

- Docker：Next.js standalone + Nginx + 本地 PostgreSQL。
- Vercel：Next.js Functions + Neon PostgreSQL。

## 1. 共同能力边界

以下能力只能依赖 PostgreSQL 持久状态和标准 HTTP 请求，不能依赖本地磁盘、单实例内存或常驻进程：

- 助手配置、MCP 来源白名单和工具风险策略。
- 工具人工确认状态和工具执行审计。
- 会话、Generation、知识库元数据和任务状态。
- 幂等键、租约、重试次数和失败原因。

这保证 Vercel Function 冷启动、并发实例和 Docker 容器重启后行为一致。

## 2. 数据库连接与迁移

| 项目 | Docker / PostgreSQL | Vercel / Neon |
| --- | --- | --- |
| 应用连接 | 容器网络直连 PostgreSQL | 使用 Neon pooled connection string |
| 建议连接池 | `DATABASE_POOL_MAX=10`，按主机资源调整 | `DATABASE_POOL_MAX=1`，由 Neon pooler 承担并发 |
| Migration | `migrate` 工具容器 | 构建阶段使用 `DATABASE_URL_UNPOOLED` |
| Schema | 同一套 Drizzle migrations | 同一套 Drizzle migrations |

应用运行时使用 `DATABASE_URL`。DDL migration 优先使用 `DATABASE_URL_UNPOOLED`，避免事务池模式对 DDL 和会话级操作的限制。

## 3. Agent 与 MCP

工具执行采用无状态请求模型：

1. 每次聊天请求从数据库读取当前助手允许的 MCP 来源。
2. 仅为本次请求建立短生命周期 MCP client。
3. 只向模型暴露白名单内的工具。
4. 只读工具可以按策略自动批准；写入、破坏性和未声明风险的工具必须由用户确认。
5. 确认请求、确认结果和工具执行结果写入 PostgreSQL 审计表。
6. 请求结束或中断时关闭 client。

Docker 后续可以增加进程内 TTL/LRU client pool 作为优化，但它不能成为正确性依赖。Vercel 保持短连接，避免跨实例状态和凭据混用。

每次 Agent 执行必须同时限制：最大步骤数、单工具超时和请求总时长。当前聊天路由保持 60 秒上限，因此工具预算必须小于该上限。

## 4. 后台任务

`after()` 用于尽快执行上传后的解析和 embedding，但不作为唯一队列。`knowledge_embedding_jobs` 使用 PostgreSQL 保存状态、租约、重试次数和幂等键：

- Docker：独立 worker 容器每 30 秒调用受 `CRON_SECRET` 保护的领取端点。
- Vercel：上传 Route Handler 的 `after()` 立即处理，Vercel Cron 每日补偿未完成任务；Pro 环境可提高 Cron 频率。

两种执行器只负责调度，任务状态机和业务处理代码保持一致。

## 5. 语义检索

Neon 支持 pgvector。Docker 使用 `pgvector/pgvector:0.8.6-pg17-bookworm`，两端运行同一 migration，由 migration 执行 `CREATE EXTENSION IF NOT EXISTS vector`。

检索设计保持环境无关：`pg_trgm` 关键词候选、HNSW 余弦向量候选、RRF 融合、内容分数重排与文档多样性限制都在共享服务层实现。向量固定为 1536 维，默认模型为 `openai/text-embedding-3-small`；也可按工作区复用数据库内加密保存的 OpenAI-compatible 供应商。向量记录包含供应商连接与模型标识，更换模型后任务会自动重算不匹配的向量。

## 6. 部署检查

每次涉及数据库、Agent 或后台任务的变更必须同时验证：

- 本地 PostgreSQL migration 可以从空库完整执行。
- Neon 使用 unpooled URL 可以执行 migration，应用使用 pooled URL 可以读写。
- Docker standalone 和 Vercel Node.js runtime 均可构建。
- 不使用本地文件保存运行状态。
- 不把进程级缓存作为权限判断或任务唯一状态。
- MCP 来源不可用时不影响普通聊天，工具也不会越过助手白名单。
