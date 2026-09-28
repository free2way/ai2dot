<div align="center">
  <img src="./extension/assets/icon.svg" width="92" height="92" alt="ai2dot 标志" />
  <h1>ai2dot</h1>
  <p><strong>面向对话、智能助手、知识管理、研究生产与平台运营的可落地 AI 工作台。</strong></p>
  <p>既可以部署在自己的 Docker 基础设施上，也可以使用同一套代码运行在 Vercel 与 Neon。</p>

  <p>
    <a href="https://ai2note.com"><strong>产品网站</strong></a> ·
    <a href="https://ai.ai2dot.com"><strong>云端应用</strong></a> ·
    <a href="./README.md"><strong>English</strong></a>
  </p>

  <p>
    <img alt="CI" src="https://github.com/free2way/ai2dot/actions/workflows/ci.yml/badge.svg" />
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white" />
    <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" />
    <img alt="Vercel" src="https://img.shields.io/badge/Vercel-ready-000000?logo=vercel" />
  </p>
</div>

---

## 产品定位

ai2dot 将分散的 AI 模型、知识、工具和运营能力整合为一个具备治理边界的工作台。团队可以连接自己的模型供应商，创建可复用助手，让对话基于私有知识回答，在明确授权下调用 MCP 工具，把研究来源转化为结构化产物，并通过独立管理控制台观察整个平台。

产品从一开始就同时考虑了供应商中立与部署中立：

- **私有部署：** Docker Compose、Next.js standalone、Nginx、PostgreSQL + pgvector，可选 Cloudflare Tunnel。
- **云端部署：** Vercel Functions、Vercel Cron、Clerk、Neon PostgreSQL + pgvector。

两种环境共用业务模型、Drizzle migrations、权限边界、Generation 账本和混合检索引擎。

## 已落地能力

| 产品模块 | 已实现能力 |
| --- | --- |
| **AI 工作台** | 流式对话、模型切换、深度推理开关、持久化会话、滚动上下文摘要和非覆盖式会话分支。 |
| **助手管理** | 为助手配置系统指令、指定模型、知识库和明确的 MCP 来源白名单。 |
| **Agent 工具执行** | MCP 多步骤执行、步骤/时间预算、只读工具自动批准、写入或未知风险工具人工确认，以及持久化审计。 |
| **知识库** | 导入 PDF、DOCX、TXT、Markdown、CSV、JSON，结合 `pg_trgm`、pgvector HNSW、RRF 融合和来源引用。 |
| **Notebook Studio** | 研究空间、文件与粘贴来源、YouTube/Bilibili 字幕来源、混合搜索、可编辑研究产物和一键发布知识库。 |
| **Skill** | 工作区级 `SKILL.md` 指令包，支持元数据解析、相关性匹配、版本、指纹与 MCP 依赖提示。 |
| **网页剪藏扩展** | Chrome Manifest V3 侧边栏读取当前页面，以工作区模型生成 Markdown，并保存到指定知识库。 |
| **运营能力** | 供应商健康度、请求/Token/成本统计、生成回放、PostgreSQL 限流、Embedding 后台任务和结构化日志。 |
| **平台管理控制台** | 独立本地管理员身份、用户停用/恢复、空间与存储统计、使用情况和管理审计记录。 |

## 英文架构图

<p align="center">
  <img src="./docs/assets/ai2dot-reference-architecture.svg" alt="ai2dot 英文参考架构图" width="100%" />
</p>

控制平面在请求之间保持无状态。所有与权限正确性相关的数据、幂等状态、任务租约、工具审计事件和外部绑定都由 PostgreSQL 保存。Docker 可以增加进程内缓存改善性能，但不能依赖缓存保证正确性，因此同一业务流程也能在 Vercel 冷启动和多实例并发下运行。

## 核心工程设计

### 模型属于用户，不绑定单一平台

可连接 OpenAI、OpenRouter、DeepSeek、ZenMux、Google Gemini 或任何 OpenAI-compatible 服务。供应商凭据使用 AES-256-GCM 加密后入库，前端不会读回明文。Vercel AI Gateway 只是可选能力。

### 工具调用始终有边界

助手只能看到分配给它的 MCP 来源；普通会话也必须由用户明确选择来源。只读工具可以自动执行，写入、破坏性和风险未知的操作必须由用户确认。请求、授权、执行过程和结果均写入 PostgreSQL 审计记录。

### Embedding 故障不拖垮知识库

检索同时使用 `pg_trgm` 关键词候选和 pgvector HNSW 语义候选，再进行 RRF 融合与重排。Embedding 可以调用工作区自己的 OpenAI-compatible 供应商；Embedding 暂时不可用时，系统会降级为关键词检索。

### 长流程可恢复、重复请求可回放

每个持久化 Generation 都具有 UUID 幂等键、SHA-256 请求指纹和明确状态。已经完成的回答可以直接回放，避免重复调用上游模型。Embedding 任务使用 PostgreSQL 租约、重试和幂等更新，即使函数终止或容器重启也能继续处理。

## Notebook Studio

Notebook Studio 将研究过程与知识库连接为一条完整工作流：

1. 创建绑定独立知识库的研究空间；
2. 添加文档、粘贴文本，或添加带字幕/转写文本的 YouTube、Bilibili 视频来源；
3. 使用与聊天相同的混合检索引擎搜索全部来源；
4. 选择工作区模型生成摘要、FAQ、时间线、学习指南或思维导图；
5. 审阅并编辑 Markdown 产物；
6. 将产物发布回知识库，供后续对话检索。

Gemini Enterprise Notebook 被设计为**可选外部 Provider**。当前仓库已经具备配置与准备状态检查；生产 OAuth、Notebook/Source 同步和报告导入仍受 Feature Flag 控制。没有 Google 服务时，ai2dot 原生 Notebook Studio 仍可独立工作。

## 安全边界

- 对持久化资源和 API 执行工作区级权限检查；
- 支持本地签名 HttpOnly 会话或 Clerk 登录；
- 平台管理员使用独立身份与独立会话；
- 模型与 MCP 凭据使用 AES-256-GCM 加密；
- 外部 MCP 仅允许 HTTPS，并执行 DNS/IP 校验和私网地址阻断；
- 写入和未知风险 MCP 工具必须人工确认；
- Generation 与工具执行保留可审计记录；
- PostgreSQL 原子限流支持多应用实例统一口径；
- 生产容器以非 root 用户运行，PostgreSQL 默认不映射宿主机端口。

这些机制用于降低系统风险，但不能替代企业自身的威胁建模、密钥轮换、网络策略与合规审查。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions 会执行同类应用检查。Chrome 扩展在 `extension/` 下拥有独立的 typecheck、测试、构建和打包命令。

---

<div align="center">
  <strong>ai2dot</strong><br />
  工作区由你掌控，模型由你选择，所有操作边界清晰可见。
</div>
