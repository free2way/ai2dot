# ai2dot

ai2dot 是一个支持多模型聊天、会话历史、知识库、外部 MCP 来源和工作区 Skill 的 Web 应用。

## 快速开始

```bash
npm install
cp .env.example .env.local
npm run dev
```

访问 `http://localhost:3000`。真实密钥、账户信息、数据库连接串和内部地址只能配置在本机或部署平台 Secret 中，禁止提交到 Git。

数据库初始化：

```bash
npm run db:migrate
```

常用页面：`/`、`/chat/[id]`、`/admin`、`/knowledge`、`/assistants`、`/notebooks`。

## macOS 桌面版

默认云端模式：Electron 打开 Web 工作台，登录与 Web 共用同一套账号（Clerk 或本地账号），会话和知识库与 Web 一致；菜单 `账号` 可切换本地离线模式（PGlite）。

```bash
npm run desktop:dev    # 本地开发模式
npm run desktop:build  # 生成未签名 .dmg / .zip，输出到 desktop/release
```

详见 [desktop/README.md](desktop/README.md)。

质量检查：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
