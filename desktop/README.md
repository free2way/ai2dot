# ai2dot for macOS

macOS 桌面版支持两种模式：

- **云端模式（默认）**：Electron 打开 Web 工作台（默认 `https://dot.ai2note.com`），登录、会话、知识库与 Web 完全一致。Web 用 Clerk 就用 Clerk，用本地账号就用本地账号，桌面端不另建账号体系。
- **本地模式（可选）**：内嵌 Next.js standalone + PGlite，数据保存在本机，可离线打开；启动时使用本机生成的本地账号自动登录。

两种模式可以在顶部站点栏或菜单 `站点` 中直接切换，无需重启。各站点的登录存储相互隔离，退出登录只清理当前站点。

## 开发

```bash
npm install
npm run desktop:dev
```

`desktop:dev` 启动本地模式：

1. 在 `~/Library/Application Support/ai2dot/` 生成桌面配置（权限 `0600`）。
2. 初始化/迁移 PGlite 数据库。
3. 启动 `next dev`（默认 `127.0.0.1:3210`）。
4. 启动 Electron 并自动登录到 `/workspace`。

调试云端模式可以启动任意 Web 服务后运行：

```bash
AI2DOT_DESKTOP_MODE=cloud \
AI2DOT_DESKTOP_SERVER_URL=http://127.0.0.1:3000 \
./node_modules/.bin/electron desktop/main.mjs
```

或者直接让开发脚本启动本地 Web 服务并让 Electron 以云端模式连接：

```bash
npm run desktop:dev:cloud
```

## 打包

```bash
npm run desktop:build
```

产物位于 `desktop/release/`：

- `ai2dot-0.2.0-arm64.dmg`（当前机器架构）
- `ai2dot-0.2.0-arm64.zip`

打包流程会过滤所有 `.env`、`.env.*` 文件，并检查最终运行时，避免将构建机的环境密钥放入安装包。

本轮为未签名构建，首次打开需要右键点击应用选择“打开”，或执行：

```bash
xattr -cr "/Applications/ai2dot.app"
```

## 当前站点

窗口内顶部始终显示站点栏，包含当前站点名称、完整地址、**切换站点** 和 **设置** 按钮。登录、页面跳转和刷新后仍然可见，云端与本地模式均适用，不依赖云端网站更新。

窗口标题也会显示当前站点，例如 `ai2dot — 本地 Docker · dot.ai2note.com` 或 `ai2dot — 本地模式`。菜单 `站点` 的第一项会显示 `当前站点：…`，并带有当前站点的勾选状态。

- 切换站点：窗口顶部 **切换站点**，或菜单 `站点`（`Cmd+Shift+S`）
- 管理站点：窗口顶部 **设置 → 站点 → 管理站点**，或菜单 `站点 → 管理站点…`

## 登录与站点选择

首次启动会显示“选择登录站点”窗口：

- **ai.ai2dot.com**：线上 Web 部署，账号与数据在云端。
- **dot.ai2note.com**：本地 Docker 部署，账号与数据跟随该站点（默认选中）。
- **本地模式**：使用本机 PGlite 数据库，离线可用，账号为本机独立账号。

选择后立即切换并记住选择。之后可随时通过菜单 `站点` 修改。

窗口底部的 **管理站点** 可以新增、编辑或删除站点（最多 10 个），也可以恢复默认站点。站点地址必须使用 HTTPS；本机调试允许 `http://127.0.0.1`。

编辑站点或恢复默认只更新已保存的设置。标题、菜单勾选和退出登录始终对应当前实际连接；再次选择该站点时才会切换到新地址。

- **云端站点**：打开所选站点的 `/sign-in`，使用与该站点相同的账号登录。登录状态保存在按站点来源隔离的 `persist:ai2dot-cloud-<hash>` 会话分区，后续启动自动进入 `/workspace`；菜单 `账号 → 退出登录` 只清除当前站点的登录状态、缓存及草稿。升级时会一次性迁移旧分区中属于当前站点的 Cookie。
- **本地模式**：使用本机 `desktop-config.json` 中的账号哈希，启动时自动注入会话；菜单 `ai2dot → 本地登录与密码…` 可重置密码。

Clerk 的第三方社交登录（如 Google）在 Electron 内嵌窗口里可能被提供商拦截。遇到这种情况请使用邮箱密码登录，或后续接入系统浏览器 + 自定义协议回调。

## 语言、连接与草稿

顶部 **设置**（或 `Cmd+,`）集中提供通用设置、站点管理和关于信息。中英文偏好会同步到工作台、登录页面、站点栏、设置和菜单，切站及重启后沿用。安装后的 macOS 应用可选择登录时启动，默认不更改系统启动项。

站点栏显示连接中、已连接、离线或连接失败。加载失败会显示重试和切站入口；普通网络加载错误最多自动重试三次，证书错误需要手动处理。已打开页面断网时保留页面，避免丢失输入；恢复联网后检查连接。

输入草稿按站点、账号、会话和分支自动保存，有效期 24 小时。桌面草稿额外保存在本机权限 `0600` 的文件中，本地模式端口变化后仍可恢复。草稿不包含附件，不保存正在生成的回答。云端语言同步和自动草稿需要站点部署配套 Web 代码；较旧站点仍可切换并使用桌面设置。

## 设置与数据

| 内容 | 路径 |
| --- | --- |
| 模式与云端地址 | `~/Library/Application Support/ai2dot/desktop-settings.json` |
| 本地配置（本地账号哈希、会话密钥、Provider 加密密钥） | `~/Library/Application Support/ai2dot/desktop-config.json` |
| PGlite 数据库（仅本地模式） | `~/Library/Application Support/ai2dot/data/pgdata` |
| 输入草稿 | `~/Library/Application Support/ai2dot/drafts/` |
| 云端登录状态 | `~/Library/Application Support/ai2dot/Partitions/ai2dot-cloud-<hash>/` |
| Next 服务日志（仅本地模式） | `~/Library/Application Support/ai2dot/logs/server.log` |
| Electron 日志 | `~/Library/Application Support/ai2dot/logs/electron.log` |

切换站点使用菜单 `站点 → 切换登录站点…`（快捷键 `Cmd+Shift+S`），也可以直接在 `站点` 菜单里勾选已配置站点或本地模式。如需自定义地址，使用 `站点 → 管理站点…`。默认地址为 `AI2DOT_DESKTOP_SERVER_URL` 或 `https://dot.ai2note.com`。

## 运行方式

- 云端模式只加载配置的 Web 地址；同源导航允许，外链交给系统浏览器。
- 本地模式服务只监听 `127.0.0.1`，端口每次启动随机分配，并注入 CSP、限制页面导航。
- 麦克风/摄像头会弹窗确认，其他权限默认拒绝。
- 本地模式允许 `http://localhost`、回环和局域网模型地址，可直接接 Ollama、LM Studio 或 LAN 网关。

## 已知限制

- 仅支持 macOS（当前在 Apple Silicon 上构建/验证）。
- 未做代码签名与 Apple 公证，不适合直接公开分发。
- 云端模式需要联网；本地模式不支持 Clerk 登录、Vercel Blob、Google Notebook Provider 和定时任务。
- PGlite 单连接串行执行，适合单用户桌面场景；不适合多用户并发。
- 云端模式下 Clerk 社交登录可能需要后续接入系统浏览器回调。

## 验证

```bash
npm run typecheck
npm test
npm run desktop:build
```
