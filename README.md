# ai2dot

ai2dot 是一个支持多模型聊天、会话历史、知识库、外部 MCP 来源和工作区 Skill 的 Web 应用。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。需要登录、持久化或模型服务时，在本机 `.env.local` 中填写对应值；真实凭据不要提交到 Git。

首次配置数据库后执行：

```bash
npm run db:migrate
```

## 常用页面

- `/`：聊天首页
- `/chat/[id]`：历史会话
- `/admin`：工作区连接和外部来源管理
- `/knowledge`：知识库管理
- `/assistants`：助手管理

## 安全使用

- `.env.local`、部署平台变量和数据库凭据只保存在本机或部署平台的 Secret 中。
- 不要提交任何真实 Key、Token、密码、数据库连接串、内部地址或账户数据。
- 外部连接使用 HTTPS，并只配置你信任的来源。

## 检查命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
