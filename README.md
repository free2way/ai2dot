# ai2dot

一个面向个人与小团队的云端、多租户 AI 聚合工作台。当前版本具备响应式 Chat UI、AI SDK 流式协议、多模型切换、Clerk 登录、Neon 云端会话、供应商后台、Generation 可靠性记录、非覆盖式对话分支以及无密钥演示模式。

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。未配置 `AI_GATEWAY_API_KEY` 时会自动使用演示流；填写密钥后调用真实的 Vercel AI Gateway 模型。

## 云端会话与登录

同时配置 Clerk 和 Neon 后，应用会自动为首次登录用户建立个人工作区。会话在模型调用前以只追加方式写入数据库，完整回答与 token 用量在流结束时更新，每个会话都有可恢复地址 `/chat/[id]`。

每次云端生成都有 UUID 幂等键、SHA-256 请求指纹和 `pending → streaming → completed/failed/stopped` 状态。相同请求重复到达时不会再次扣费；已完成结果会直接回放。对回答执行“分支重试”会保留原回答，复制问题以前的上下文到新分支，并可在右侧会话设置中切换。

```bash
# 写入 .env.local 后创建数据库表
npm run db:migrate
```

未配置 Clerk 或 Neon 时，应用保持可运行，并把当前演示会话保存在浏览器 localStorage。

## 模型供应商后台

访问 `/admin` 管理供应商连接。支持 Vercel AI Gateway、OpenAI-compatible 与 Native API 模型目录；API Key 使用 AES-256-GCM 加密后入库。

生成加密密钥：

```bash
openssl rand -base64 32
```

配置 `PROVIDER_SECRET_ENCRYPTION_KEY` 后即可添加连接并在线刷新模型目录。后台页面和 API 都会执行账户及工作区管理员权限检查。

## 环境服务

- AI：Vercel AI Gateway
- Auth：Clerk（两项 Clerk key 同时配置后启用）
- Database：Neon PostgreSQL + Drizzle（工作区、会话分支、消息、Generation、用量、供应商、模型）
- Cache/Rate limit：Upstash Redis（下一阶段接入）
- Files：Vercel Blob（下一阶段接入）

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
