# ai2dot Docker 与 Gemini Enterprise Notebook 集成技术开发方案

> 文档状态：可进入技术验证（Conditional GO）<br />
> 编写日期：2026-09-28<br />
> 目标系统：ai2dot Docker 版，同时兼容 Vercel + Neon 版<br />
> Docker 部署目录：`/app/ai2dot`<br />
> 对外域名：`https://dot.ai2note.com`

## 1. 结论摘要

ai2dot 当前 Docker 环境能够承载 Google 官方 Gemini Enterprise Notebook 集成，建议采用以下混合架构：

1. ai2dot Notebook Studio 继续作为笔记、来源、报告和知识库数据的主系统。
2. Gemini Enterprise Notebook 作为可选外部 Provider，而不是 ai2dot 的强制依赖。
3. ai2dot 可通过 Google 官方 API 创建 Notebook，并将 YouTube 链接作为 Source 提交给 Google。
4. 由于 Google 当前公开 API 没有提供 Notebook Report 的生成和读取接口，ai2dot 不应通过浏览器自动化、Cookie 或逆向接口抓取报告。
5. Google 报告采用“跳转到 Gemini Enterprise Notebook 生成，再导入 ai2dot”的模式。
6. ai2dot 同时实现自己的“详细视频报告”流水线，支持全自动生成、编辑、保存和发布到本地知识库。

因此，项目当前结论不是“立即生产启用”，而是：

- **Docker 基础设施：通过。**
- **Google API 网络可达性：通过。**
- **Google 企业租户配置：待完成。**
- **Google Report 自动拉取：官方 API 当前不支持。**
- **混合方案：可实现，并且同时兼容 Docker 与 Vercel。**

## 2. 评估范围

本评估中的“Google 官方 Notebook”指 Google Cloud 的 **Gemini Enterprise Notebook / NotebookLM Enterprise API**，不指个人版 `notebooklm.google.com` 的非公开接口。

评估内容包括：

- Docker 主机和容器运行环境；
- 中国境内部署主机到 Google API 的网络连通性；
- Google Cloud 项目、API、许可证、IAM 和 OAuth 要求；
- Notebook、Source、YouTube 和 Audio Overview 的官方 API 能力；
- Google Report 的可编程能力边界；
- ai2dot 当前代码与目标架构之间的差距；
- Docker 与 Vercel 两种运行环境的兼容性。

## 3. Docker 环境评估结果

### 3.1 已验证项目

| 检查项 | 当前状态 | 结论 |
| --- | --- | --- |
| Linux x86_64 | 已确认 | 支持 |
| Docker 29.8.1 | 已确认 | 支持 |
| Docker Compose v5.5.1 | 已确认 | 支持 |
| ai2dot 应用容器 | 正常运行 | 支持 |
| PostgreSQL 持久化 | 已部署 | 支持 |
| HTTPS 公网入口 | `dot.ai2note.com` | 支持 |
| Google Discovery Engine DNS/TLS | 已验证 | 支持 |
| Google Notebook Web 地址 | 已验证可建立连接 | 支持，但用户浏览器侧仍需单独验证 |

2026-09-28 从 Docker 主机执行的连通性检查结果：

- `https://discoveryengine.googleapis.com/...` 返回 HTTP 404，表示 DNS、TLS 和 HTTP 链路均已建立；未带有效资源和凭据时返回 404 属预期现象。
- `https://global-discoveryengine.googleapis.com/...`、`us-...`、`eu-...` 均可建立连接。
- `https://notebook.cloud.google.com/global/` 返回 HTTP 302，说明服务器能够访问 Google Notebook Web 入口。

这些测试只证明网络可达，不证明 API 已授权，也不保证中国境内终端用户浏览器能够稳定打开 Google 页面。

### 3.2 当前 Provider 配置状态

Docker 实例当前配置状态为：

```text
AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER=false
AI2DOT_DEPLOYMENT_REGION=cn-mainland
GOOGLE_NOTEBOOK_LOCATION=global
GOOGLE_NOTEBOOK_PROJECT_NUMBER=未配置
GOOGLE_NOTEBOOK_ACCESS_TOKEN=未配置
GOOGLE_NOTEBOOK_CLIENT_ID=未配置
GOOGLE_NOTEBOOK_CLIENT_SECRET=未配置
```

所以当前页面中的 Google Provider 只能显示准备状态，尚不能真正创建外部 Notebook 或提交来源。

## 4. Google 官方配置要求

### 4.1 必须具备的云资源

正式接入前必须完成：

1. 创建或选定 Google Cloud Project。
2. 为项目启用 Billing。
3. 启用 Discovery Engine API。
4. 配置 Gemini Enterprise Notebook / NotebookLM Enterprise 订阅或试用许可证。
5. 为测试用户分配与目标多区域一致的许可证。
6. 为用户授予至少 `Cloud NotebookLM User` 角色。
7. 配置 OAuth Consent Screen 和 Web OAuth Client。
8. 将 ai2dot 回调地址加入 OAuth Redirect URI。
9. 确定数据区域：`global`、`us` 或 `eu`。

Google 官方许可证目前具有以下约束：

- 用户必须拥有许可证才能登录和使用 Enterprise Notebook。
- 许可证与数据多区域相关，区域选择后需要保持一致。
- 正式订阅通常至少购买 15 个许可证。
- 官方试用期可用于先完成技术验证。

### 4.2 API 能力边界

当前官方文档公开的 NotebookLM v1alpha 服务包括：

- `NotebookService`
- `SourceService`
- `AudioOverviewService`
- `DiscoverSourcesService`
- `LabelService`

官方 Source API 明确支持 YouTube URL：

```json
{
  "videoContent": {
    "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
  }
}
```

官方 API 当前没有公开 `ReportService`，也没有文档化的“生成报告并读取报告正文”接口。因此：

- 可以自动创建 Notebook；
- 可以自动添加 YouTube、文本、网页、Google Drive 或上传文件来源；
- 可以轮询来源处理状态；
- 可以通过官方能力生成或管理 Audio Overview；
- 不能通过公开 API 自动获取 NotebookLM 页面里的 Report 正文。

这是目标架构必须保留“Google 报告人工跳转/导入”和“ai2dot 原生详细报告”两条路径的根本原因。

## 5. 中国境内部署的特殊约束

Google Enterprise Notebook 没有中国大陆数据区域。选择 `global`、`us` 或 `eu` 时，提交给 Google 的视频 URL、文本和文件内容会跨境传输并存储在对应 Google Cloud 区域。

上线前必须明确：

1. Google Provider 默认关闭，由管理员显式启用。
2. 首次连接时向用户说明外部数据传输范围。
3. 企业敏感内容应支持 workspace 级策略禁止发送到 Google。
4. 审计日志记录操作者、Notebook、来源类型、外部资源 ID、时间和结果，但不记录 OAuth Token 与完整正文。
5. 服务端虽然已验证可访问 Google，用户浏览器访问 Google Notebook 页面仍可能受网络环境影响。
6. ai2dot 原生报告和本地知识库必须可独立运行，不能把 Google 作为单点依赖。

## 6. 目标架构

```text
Browser
  |
  v
ai2dot Notebook Studio
  |-- Native Report API -------------------------+
  |                                              |
  |                                      Report Worker
  |                                              |
  |                                      LLM / Embedding
  |                                              |
  |                                      PostgreSQL + pgvector
  |
  +-- Google Provider API
          |
          v
     Provider Orchestrator
          |
          +-- OAuth Token Store (encrypted)
          +-- Durable Job Queue
          +-- Gemini Enterprise Notebook Adapter
                         |
                         v
                Google Discovery Engine API
```

设计原则：

- ai2dot 数据库是业务主数据源。
- Google 外部资源使用绑定表关联，不覆盖本地 Notebook 数据。
- Provider 能力通过 Adapter 接口隔离，未来可增加其他 Notebook Provider。
- 所有长任务使用持久化 Job，不依赖单个 HTTP 请求一直存活。
- Docker 使用常驻 Worker；Vercel 使用短任务触发器和定时续跑。

## 7. 核心用户流程

### 7.1 连接 Google Provider

1. 用户进入 Notebook Studio 的“外部 Provider”设置。
2. 点击“连接 Google”。
3. ai2dot 创建带 PKCE、`state` 和过期时间的 OAuth 请求。
4. 用户在 Google 授权页完成授权。
5. 回调接口校验 `state`，换取 Access Token 和 Refresh Token。
6. Refresh Token 使用应用加密密钥加密后写入数据库。
7. ai2dot 调用轻量 API 验证项目、区域、许可证和权限。
8. 页面显示“已连接”，并列出可用能力。

不应在生产环境使用静态 `GOOGLE_NOTEBOOK_ACCESS_TOKEN`。该变量只允许本地 PoC 临时使用。

### 7.2 将本地 Notebook 绑定到 Google

1. 用户在一个本地 Notebook 中选择“连接到 Google”。
2. 用户可以创建新 Google Notebook，或选择已有 Notebook。
3. ai2dot 创建 `notebook_external_bindings` 记录。
4. 后续来源同步均使用该绑定，不改变本地 Notebook ID。

### 7.3 将 YouTube 视频提交到 Google

1. 用户在 ai2dot 添加视频来源。
2. URL 经过规范化和来源域名校验。
3. 本地来源先保存，状态为 `ready` 或 `needs_transcript`。
4. 用户点击“同步到 Google”。
5. ai2dot 创建幂等 Job。
6. Worker 调用 Google `sources:batchCreate`，提交 `youtubeUrl`。
7. 保存 Google Source 的资源名称和 ID。
8. Worker 轮询 Source 状态直到 `SOURCE_STATUS_COMPLETE` 或失败。
9. UI 同步展示本地处理状态与 Google 处理状态。

### 7.4 使用 Google 报告

由于没有公开 Report API，第一版流程为：

1. 来源同步完成后显示“在 Google Notebook 中打开”。
2. 深链接格式：

```text
https://notebook.cloud.google.com/{LOCATION}/notebook/{NOTEBOOK_ID}?project={PROJECT_NUMBER}
```

3. 用户在 Google 页面生成 Report。
4. 用户将导出的文本、Markdown、PDF 或复制内容导入 ai2dot。
5. ai2dot 保存为 `external_report` Artifact，并允许发布到知识库。

禁止实现以下方案：

- 保存或复用用户 Google Cookie；
- 使用 Playwright/Selenium 自动操作个人 NotebookLM；
- 调用浏览器抓取到的非公开 Report API；
- 绕过 Google 许可证或用户身份要求。

### 7.5 使用 ai2dot 原生详细报告

用户无需 Google Provider 也可以：

1. 粘贴 YouTube/Bilibili URL；
2. 提供字幕、上传字幕文件，或使用可配置的转写服务；
3. 生成章节级分析和详细综合报告；
4. 编辑报告；
5. 保存为 Notebook Artifact；
6. 一键发布到知识库并生成向量索引。

## 8. ai2dot 原生详细报告设计

### 8.1 输入要求

报告流水线应接受：

- 视频元数据：标题、作者、平台、URL、时长；
- 带时间戳字幕；
- 无时间戳纯文本字幕；
- 用户补充的分析目标；
- 输出语言和报告模板。

仅有 URL 且无法取得字幕时，不应生成看似完整但缺少事实依据的报告。UI 应明确提示用户粘贴字幕、上传文件或启用转写 Provider。

### 8.2 处理流水线

```text
Transcript normalization
  -> chapter segmentation
  -> parallel chapter analysis
  -> evidence extraction
  -> global synthesis
  -> citation/timestamp validation
  -> quality gate
  -> editable artifact
  -> knowledge-base publication
```

建议参数：

- 分段大小：按模型上下文动态计算，默认每段约 8,000 至 15,000 字符；
- 重叠：前后 5% 至 10%；
- 章节分析并发：Docker 默认 2，资源允许时最高 4；
- 综合报告目标：约 4,000 至 10,000 中文字，由内容长度决定；
- 引用：优先保留视频时间戳；
- 重试：模型超时最多 3 次，指数退避；
- 提示词：必须保存 `prompt_version`，便于报告复现和质量回归。

### 8.3 报告结构

默认报告应包括：

1. 执行摘要；
2. 视频核心观点；
3. 章节与内容脉络；
4. 关键概念解释；
5. 重要事实、数据和案例；
6. 论证链与结论；
7. 可执行建议；
8. 值得质疑或进一步验证的内容；
9. 学习卡片或问答；
10. 带时间戳的证据索引；
11. 原始来源和生成信息。

### 8.4 质量门禁

报告保存前执行自动检查：

- 关键结论是否存在来源证据；
- 时间戳是否落在视频时长范围内；
- 是否混入模型无法从字幕支持的外部事实；
- 是否覆盖主要章节；
- 是否出现大段重复；
- 是否达到最低内容密度；
- 是否明确区分“视频原意”和“模型推论”。

## 9. 数据模型

### 9.1 `notebook_provider_connections`

| 字段 | 用途 |
| --- | --- |
| `id` | 连接 ID |
| `workspace_id` | 工作区隔离 |
| `user_id` | Google 授权用户 |
| `provider` | `google_notebook_enterprise` |
| `project_number` | Google Cloud Project Number |
| `location` | `global`、`us` 或 `eu` |
| `encrypted_refresh_token` | 加密后的 Refresh Token |
| `access_token_expires_at` | Access Token 到期时间 |
| `scopes` | 已授权 Scope |
| `status` | `active`、`expired`、`revoked`、`error` |
| `last_verified_at` | 最近权限验证时间 |
| `created_at` / `updated_at` | 审计时间 |

连接应以 workspace + user 为边界。第一版不建议用一个管理员 Refresh Token 代表所有用户。

### 9.2 `notebook_external_bindings`

| 字段 | 用途 |
| --- | --- |
| `id` | 绑定 ID |
| `notebook_id` | ai2dot Notebook |
| `connection_id` | Provider 连接 |
| `external_notebook_name` | Google 完整资源名 |
| `external_notebook_id` | Google Notebook ID |
| `external_url` | 官方页面深链接 |
| `sync_mode` | `manual` 或 `automatic` |
| `sync_status` | 最近同步状态 |
| `last_synced_at` | 最近成功同步时间 |

唯一约束建议为：

```text
(notebook_id, connection_id, external_notebook_id)
```

### 9.3 `notebook_external_sources`

记录本地 Source 与 Google Source 的对应关系：

- `source_id`
- `binding_id`
- `external_source_name`
- `external_source_id`
- `provider_status`
- `provider_error_code`
- `provider_error_message`
- `submitted_at`
- `completed_at`

### 9.4 `notebook_jobs`

建议使用 PostgreSQL 持久化任务队列：

- `type`
- `workspace_id`
- `notebook_id`
- `source_id`
- `provider`
- `idempotency_key`
- `status`
- `attempt_count`
- `available_at`
- `lease_owner`
- `lease_expires_at`
- `payload_json`
- `result_json`
- `last_error`

任务领取使用 `FOR UPDATE SKIP LOCKED`，支持多个 Worker 水平扩展。

## 10. API 设计

### 10.1 Provider 连接

```text
POST   /api/notebook-providers/google/oauth/start
GET    /api/notebook-providers/google/oauth/callback
GET    /api/notebook-providers/google/status
DELETE /api/notebook-providers/google/connection
```

### 10.2 Notebook 绑定

```text
POST   /api/notebooks/:notebookId/providers/google/bind
GET    /api/notebooks/:notebookId/providers
DELETE /api/notebooks/:notebookId/providers/google/bindings/:bindingId
```

### 10.3 来源同步

```text
POST /api/notebooks/:notebookId/sources/:sourceId/providers/google/sync
GET  /api/notebooks/:notebookId/sources/:sourceId/providers/google/status
POST /api/notebooks/:notebookId/providers/google/refresh-status
```

### 10.4 报告

```text
POST /api/notebooks/:notebookId/reports/detailed-video
GET  /api/notebooks/:notebookId/reports/:reportId
POST /api/notebooks/:notebookId/reports/import
POST /api/notebooks/:notebookId/reports/:reportId/publish
```

所有写接口必须检查 workspace 权限，并为外部写操作使用幂等键。

## 11. Google API Adapter

Adapter 接口建议如下：

```ts
interface NotebookProviderAdapter {
  getCapabilities(context: ProviderContext): Promise<ProviderCapabilities>;
  verifyConnection(context: ProviderContext): Promise<ConnectionHealth>;
  createNotebook(input: CreateExternalNotebookInput): Promise<ExternalNotebook>;
  addSource(input: AddExternalSourceInput): Promise<ExternalSource>;
  getSource(input: GetExternalSourceInput): Promise<ExternalSource>;
  getNotebookUrl(input: ExternalNotebookRef): string;
}
```

`ProviderCapabilities` 至少包含：

```ts
type ProviderCapabilities = {
  createNotebook: boolean;
  addYouTubeSource: boolean;
  addWebSource: boolean;
  addTextSource: boolean;
  uploadFile: boolean;
  generateAudioOverview: boolean;
  generateReport: boolean;
  retrieveReport: boolean;
};
```

当前 Google Adapter 必须返回：

```text
generateReport=false
retrieveReport=false
```

未来 Google 发布 Report API 后，只修改 Adapter 和能力探测，不改变 Notebook Studio 的主数据模型。

### 11.1 官方端点

来源批量创建端点：

```text
POST https://{ENDPOINT_LOCATION}-discoveryengine.googleapis.com/
  v1alpha/projects/{PROJECT_NUMBER}/locations/{LOCATION}/
  notebooks/{NOTEBOOK_ID}/sources:batchCreate
```

其中 `ENDPOINT_LOCATION` 与 `LOCATION` 必须严格采用 Google 官方允许的 `global`、`us` 或 `eu`。

当前代码的端点生成逻辑需要修正：`global` 应使用 `global-discoveryengine.googleapis.com`，不能继续使用通用 `discoveryengine.googleapis.com` 作为正式端点。同时，生产 UI 不应暴露未经官方 Notebook 文档确认的其他 Location。

## 12. OAuth 与凭据安全

生产实现采用 Authorization Code + PKCE：

1. 生成一次性 `state`、PKCE verifier 和 challenge；
2. `state` 与 workspace、用户和回跳路径绑定，短时有效；
3. 回调验证 `state` 后交换 Token；
4. Refresh Token 使用现有服务端加密能力进行信封加密；
5. Access Token 只做短时缓存，不写日志；
6. Token 刷新失败时将连接标记为 `expired`，要求用户重新授权；
7. 用户断开连接时撤销 Google Token，并清除本地密文；
8. 日志中禁止输出 Authorization Header、Token、Client Secret。

建议新增配置：

```dotenv
AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER=true
GOOGLE_NOTEBOOK_PROJECT_NUMBER=123456789012
GOOGLE_NOTEBOOK_LOCATION=global
GOOGLE_NOTEBOOK_CLIENT_ID=...
GOOGLE_NOTEBOOK_CLIENT_SECRET=...
GOOGLE_NOTEBOOK_OAUTH_REDIRECT_URI=https://dot.ai2note.com/api/notebook-providers/google/oauth/callback
GOOGLE_NOTEBOOK_OAUTH_SCOPES=https://www.googleapis.com/auth/cloud-platform
```

`GOOGLE_NOTEBOOK_ACCESS_TOKEN` 仅保留给开发调试，生产 Compose 中应删除或保持为空。

## 13. Docker 与 Vercel 双环境设计

### 13.1 Docker

Docker 环境建议新增独立 Worker 服务：

```text
services:
  app:
    # Next.js Web/API
  worker:
    # 报告、来源同步、轮询与向量任务
  postgres:
    # PostgreSQL + pgvector
```

Worker 与 Web 使用同一代码镜像，通过启动命令区分。优点是长视频处理和 Google 状态轮询不受 HTTP 超时影响。

建议资源基线：

- Web：1 至 2 CPU，1 至 2 GB 内存；
- Worker：2 CPU，2 至 4 GB 内存；
- 报告并发默认 2；
- Provider 同步并发默认 4；
- PostgreSQL 使用持久化卷并执行定期备份。

### 13.2 Vercel + Neon

同一套数据库表和 Adapter 可用于 Vercel，但执行模型不同：

- API 只创建 Job，不同步等待长任务完成；
- 使用 Vercel Cron 定期领取短批次 Job；
- 单个任务接近运行时限时释放 Lease，下次继续；
- Embedding 和 LLM 请求按小批次执行；
- PostgreSQL 使用 Neon，向量字段继续使用 pgvector；
- OAuth 回调域名使用 Vercel 正式域名，例如 `https://ai.ai2dot.com/...`。

应分别注册 Docker 和 Vercel OAuth Redirect URI，禁止动态接受任意回调域名。

## 14. 任务可靠性

### 14.1 状态机

Google Source 同步状态：

```text
queued
  -> submitting
  -> processing
  -> complete
  -> failed
  -> cancelled
```

原生报告状态：

```text
queued
  -> extracting
  -> segmenting
  -> analyzing
  -> synthesizing
  -> validating
  -> complete
  -> failed
```

### 14.2 重试策略

- `429`、`5xx`、网络超时：指数退避并加随机抖动；
- `401`：刷新 Token 后只重试一次；
- `403`：停止重试，提示许可证、IAM 或区域问题；
- `400`：停止重试，显示可操作的输入错误；
- 同一 Source 的重复提交使用相同幂等键；
- 每个 Job 设置最大尝试次数和最终失败状态。

## 15. 权限、审计与数据治理

### 15.1 权限

- Workspace Owner/Admin：配置 Provider 策略；
- Member：连接自己的 Google 账号；
- Notebook Editor：提交来源、生成报告；
- Viewer：只读报告和同步状态；
- Admin Console：查看统计与错误，不默认读取用户正文。

### 15.2 审计事件

至少记录：

- `google_provider.connected`
- `google_provider.disconnected`
- `google_notebook.created`
- `google_notebook.bound`
- `google_source.submitted`
- `google_source.completed`
- `google_source.failed`
- `notebook_report.generated`
- `notebook_report.imported`
- `notebook_report.published`

### 15.3 数据删除

删除本地 Notebook 时不得默认删除 Google Notebook，应明确提供：

- 仅解除绑定；
- 同时删除外部资源（仅在官方 API 支持且用户二次确认时）；
- 保留审计日志但移除正文与 Token。

## 16. 当前代码差距

现有 ai2dot 已具备：

- Notebook Studio 基础界面；
- Notebook、Source、Artifact 数据模型；
- YouTube/Bilibili 视频来源入口；
- Google Provider 状态接口和配置读取；
- PostgreSQL 持久化；
- 知识库与向量检索基础能力。

仍需完成：

1. 修正 Google `global` API 主机名。
2. Provider Location 收敛到官方支持范围。
3. 实现 OAuth Authorization Code + PKCE。
4. 增加加密 Refresh Token 存储。
5. 实现 Google Notebook 创建和绑定。
6. 实现 YouTube Source `batchCreate`。
7. 实现 Source 状态轮询与幂等重试。
8. 增加持久化 Job 与 Docker Worker。
9. 增加“在 Google Notebook 中打开”。
10. 增加 Google 报告手工导入。
11. 将当前简短摘要升级为分段分析加综合生成的详细报告。
12. 将报告发布流程接入知识库索引。
13. 增加 Provider 权限与审计日志。
14. 为 Docker 和 Vercel 分别配置 OAuth Redirect URI。

## 17. 分阶段实施计划

### 阶段 0：Google 租户 PoC

目标：确认许可证、身份、IAM 和区域组合可工作。

- 开通试用或许可证；
- 创建专用 Google Cloud Project；
- 启用 Discovery Engine API；
- 分配测试用户和角色；
- 使用 `curl` 或最小脚本创建 Notebook；
- 提交一个 YouTube URL；
- 确认 Source 最终为 `SOURCE_STATUS_COMPLETE`；
- 确认测试用户能在 Google 页面看到该 Notebook。

这是生产开发的首个硬门槛。

### 阶段 1：Provider 基础集成

- OAuth 连接与撤销；
- Notebook 创建和绑定；
- YouTube Source 同步；
- 状态轮询；
- 深链接；
- 审计日志；
- Docker Worker。

### 阶段 2：ai2dot 原生详细视频报告

- 字幕标准化；
- 章节切分；
- Map-Reduce 分析；
- 证据和时间戳校验；
- 可编辑报告；
- 发布到知识库；
- 质量评估集。

### 阶段 3：Google 报告回流

- 文本/Markdown/PDF 导入；
- 外部报告来源标识；
- 去重；
- 发布到本地知识库；
- 保留 Google Notebook 反向链接。

### 阶段 4：Vercel 兼容与正式发布

- Vercel Cron Job Runner；
- Neon 迁移；
- 双域名 OAuth 配置；
- Preview 环境隔离；
- 端到端测试；
- 灰度开关与监控。

### 阶段 5：官方 Report API 适配

仅在 Google 发布文档化 Report API 后实施：

- 能力探测改为 `generateReport=true`；
- 增加报告生成 Job；
- 保存外部 Report ID；
- 获取正文并自动导入；
- 不改现有 Notebook、Source、Artifact 主模型。

## 18. 测试与验收

### 18.1 单元测试

- Google 资源名和端点生成；
- YouTube URL 规范化；
- OAuth `state` 与 PKCE；
- Token 加密/解密；
- Provider 错误分类；
- 幂等键生成；
- 状态机转换；
- 报告分段与引用校验。

### 18.2 集成测试

- 创建 Google Notebook；
- 添加 YouTube Source；
- 轮询到完成；
- Token 刷新；
- 许可证缺失返回 403；
- IAM 缺失返回 403；
- Location 不一致被阻止；
- 网络超时进入重试；
- 重复请求不创建重复 Source。

### 18.3 端到端验收标准

Google 路径：

1. 用户可以连接 Google 账号；
2. 本地 Notebook 可创建或绑定 Google Notebook；
3. 一个 YouTube URL 能同步到 Google；
4. 状态最终显示完成；
5. 用户可通过深链接打开正确 Notebook；
6. 导入的 Google 报告可保存并发布到知识库。

原生路径：

1. 用户在没有 Google 账号时仍可添加视频来源；
2. 有字幕时可生成详细报告；
3. 报告包含章节、关键观点、证据和时间戳；
4. 报告可编辑；
5. 发布后能通过知识库混合检索召回；
6. Google API 故障不影响本地 Notebook 和知识库。

Docker 运维路径：

1. Web 与 Worker 重启后任务可继续；
2. PostgreSQL 重启后数据不丢失；
3. Cloudflare Tunnel 不暴露数据库与 Worker 端口；
4. 日志中不存在 OAuth Token 和用户正文；
5. 备份可以恢复 Notebook、Artifact、Job 和 Provider 绑定。

## 19. 上线门槛

### 19.1 技术验证 GO 条件

- Docker 网络可访问 Google API：已满足；
- Google Cloud Project 和 Billing：待完成；
- Discovery Engine API：待启用；
- Enterprise Notebook 许可证：待开通；
- 测试用户 IAM：待配置；
- OAuth Client：待创建；
- YouTube Source PoC：待验证。

### 19.2 生产 GO 条件

以下条件全部完成后才能生产启用：

1. 阶段 0 PoC 通过；
2. OAuth 凭据不以明文保存；
3. Google Provider 默认关闭且可按 workspace 开启；
4. 跨境数据提示和用户确认完成；
5. Provider 操作具备审计日志；
6. Worker 重试和幂等测试通过；
7. 原生报告路径可独立使用；
8. Docker 备份与恢复演练通过；
9. 管理员可快速停用 Google Provider；
10. 端到端测试覆盖 Docker 和 Vercel 两种环境。

## 20. 回退方案

Google Provider 通过 Feature Flag 控制：

```dotenv
AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER=false
```

关闭后：

- 不再接受新的 Google 同步任务；
- 已有本地 Notebook、Source、Artifact 和知识库继续可用；
- 运行中的 Google Job 转为 `cancelled` 或等待管理员处理；
- 已有外部绑定只读保留；
- 用户仍可使用原生详细报告；
- 不需要回滚数据库迁移。

## 21. 工作量估算

在 Google 租户和许可证已经准备好的前提下，建议估算：

| 工作包 | 预计工作量 |
| --- | --- |
| Google 租户 PoC | 1 至 2 人日 |
| OAuth、连接与 Token 安全 | 2 至 3 人日 |
| Notebook/Source Adapter | 2 至 3 人日 |
| Job Queue 与 Docker Worker | 2 至 3 人日 |
| 原生详细视频报告 | 4 至 6 人日 |
| 报告导入与知识库发布 | 2 至 3 人日 |
| Vercel 执行适配 | 2 至 3 人日 |
| 测试、监控和上线 | 3 至 4 人日 |

总计约 18 至 27 人日。Google 许可证审批、OAuth 审核、跨境数据合规评估不计入开发时间。

## 22. 实施前需要准备的信息

开发开始前由管理员提供或确认：

- Google Cloud Project Number；
- `global`、`us` 或 `eu` 数据区域；
- Enterprise Notebook 许可证测试用户；
- OAuth Client ID 与 Client Secret；
- Docker 与 Vercel 的正式回调域名；
- 允许发送到 Google 的数据分类规则；
- 原生详细报告使用的模型、Token 上限和成本预算；
- 是否启用第三方字幕/转写 Provider。

任何密码、Client Secret、Refresh Token 均不得写入本文档或提交 Git。

## 23. 官方参考资料

- NotebookLM Enterprise 设置：<https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/set-up-notebooklm>
- NotebookLM Enterprise 许可证：<https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/set-up-licensing>
- NotebookLM Enterprise 概览：<https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/overview>
- Notebook 与 Sources API：<https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks-sources>
- NotebookLM v1alpha RPC：<https://docs.cloud.google.com/gemini/enterprise/docs/reference/rpc/google.cloud.notebooklm.v1alpha>

## 24. 最终决策

采用“ai2dot 自有 Notebook Studio + Gemini Enterprise Notebook 可选 Provider”的混合路线。

该路线满足：

- Docker 本地部署不依赖 Google 也能完整工作；
- 可以使用 Google 官方 Notebook 和 YouTube Source 能力；
- 不依赖脆弱的浏览器自动化或非公开接口；
- Google Report API 缺失时仍有可用方案；
- 未来可平滑支持官方 Report API；
- 同一业务模型可部署到 Docker + PostgreSQL 与 Vercel + Neon；
- 报告最终可以进入 ai2dot 本地知识库，形成可检索、可学习、可复用的数据资产。
