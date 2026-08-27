# ai2dot

一个面向个人与小团队的云端、多租户 AI 聚合工作台。当前版本具备响应式 Chat UI、AI SDK 流式协议、多模型切换、Clerk 登录、Neon 云端会话、供应商后台、Generation 可靠性记录、非覆盖式对话分支、知识库检索以及无密钥演示模式。

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。默认使用演示流；登录后可在 `/admin` 添加自己的 OpenAI-compatible 模型供应商和 API Key。Vercel AI Gateway 默认关闭，只有显式配置 `AI_GATEWAY_API_KEY`，或同时设置 `AI2DOT_ENABLE_AI_GATEWAY=true` 与 OIDC 时才会启用。

## 云端会话与登录

同时配置 Clerk 和 Neon 后，应用会自动为首次登录用户建立个人工作区。会话在模型调用前以只追加方式写入数据库，完整回答与 token 用量在流结束时更新，每个会话都有可恢复地址 `/chat/[id]`。

每次云端生成都有 UUID 幂等键、SHA-256 请求指纹和 `pending → streaming → completed/failed/stopped` 状态。相同请求重复到达时不会再次扣费；已完成结果会直接回放。对回答执行“分支重试”会保留原回答，复制问题以前的上下文到新分支，并可在右侧会话设置中切换。

```bash
# 写入 .env.local 后创建数据库表
npm run db:migrate
```

未配置 Clerk 或 Neon 时，应用保持可运行，并把当前演示会话保存在浏览器 localStorage。

## 模型供应商后台

访问 `/admin` 管理供应商连接。内置 OpenAI、OpenRouter、DeepSeek、ZenMux、Google Gemini 与自定义 OpenAI-compatible 快捷模板；API Key 使用 AES-256-GCM 加密后入库。

生成加密密钥：

```bash
openssl rand -base64 32
```

配置 `PROVIDER_SECRET_ENCRYPTION_KEY` 后即可添加连接并在线刷新模型目录。后台页面和 API 都会执行账户及工作区管理员权限检查，并显示最近 30 天用量、token、预估费用及供应商健康状态。

云端聊天默认限制为每位用户每分钟 30 次请求，使用 Neon 原子计数保证多个 Vercel 实例之间口径一致。可以通过 `AI2DOT_CHAT_RATE_LIMIT_PER_MINUTE` 调整为 1–300。

## 知识库

登录后访问 `/knowledge`，可以按主题创建知识库并导入 PDF、DOCX、TXT、Markdown、CSV 或 JSON；单文件上限 4MB，PDF 上限 200 页。上传接口返回后会继续在后台解析和分块，页面自动刷新处理状态。

检索使用 Neon PostgreSQL `pg_trgm` 候选召回与应用层相关度、文档多样性排序。对话启用知识库后，命中的文档会作为结构化来源随回答一起保存，并显示在回答下方；重新打开历史会话或进行幂等回放时引用仍然存在。

## 环境服务

- AI：工作区自带的 OpenAI-compatible 供应商；Vercel AI Gateway 为可选能力
- Auth：Clerk（两项 Clerk key 同时配置后启用）
- Database：Neon PostgreSQL + Drizzle（工作区、会话分支、消息、Generation、用量、供应商、模型、知识库）
- Rate limit：Neon PostgreSQL 分钟窗口原子计数
- Documents：文档提取后按片段存入 Neon；当前不保留原始上传文件

完整变量见 [`.env.example`](./.env.example)。数据库 schema 位于 `src/server/db/schema.ts`，SQL migration 位于 `drizzle/`。

## 检查命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 项目文档

- [技术落地方案](./TECHNICAL_PLAN.md)
- [技术验收方案](./TECHNICAL_ACCEPTANCE_PLAN.md)
