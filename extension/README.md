# ai2dot Web Clipper

ai2dot 的 Chrome Manifest V3 扩展。用户登录 ai2dot 后，可以读取当前标签页或已选中的内容，调用工作区已启用的模型生成 Markdown，并将结果保存到指定知识库。

完整架构、安全边界、接口和发布说明见 [`../docs/chrome-extension-development.zh-CN.md`](../docs/chrome-extension-development.zh-CN.md)。

## 本地配置

1. 复制 `.env.example` 为 `.env.local`。
2. 将 ai2dot 使用的 Clerk Publishable Key 写入 `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY`。
3. 保持 `PLASMO_PUBLIC_CLERK_SYNC_HOST=https://ai.ai2dot.com`，本地联调时可改为开发站点。
4. 在 ai2dot 服务端配置 `AI2DOT_CHROME_EXTENSION_IDS=pmnodojbgoalhleimdnafblgnnffcgmm`。
5. 在 Clerk Dashboard 中允许同一个 Chrome 扩展来源。

Clerk 认证需要 `cookies` 权限，以及 Clerk Frontend API 和 ai2dot Sync Host 的主机权限。扩展对普通网页仍只使用 `activeTab`，不会申请 `<all_urls>`。

仓库内置的开发 manifest key 会把扩展 ID 固定为 `pmnodojbgoalhleimdnafblgnnffcgmm`。首次发布 Chrome Web Store 后，应使用商店分配的正式 ID 更新 Clerk、Vercel 环境变量和本文档；如需让本地构建与商店 ID 一致，再用商店提供的 public key 替换 manifest key。

## 开发与验证

```bash
cd extension
npm install
npm run dev
```

在 `chrome://extensions` 打开开发者模式，选择“加载已解压的扩展程序”，加载 `build/chrome-mv3-dev`。

提交前执行：

```bash
npm run typecheck
npm test
npm run build
npm run package
```

生产构建目录为 `build/chrome-mv3-prod`，商店上传包位于 `build/chrome-mv3-prod.zip`。

## 服务端接口

- `GET /api/extension/bootstrap`：返回当前工作区可用模型、知识库和内容限制。
- `POST /api/extension/summarize`：以纯文本流生成 Markdown 摘要。
- `POST /api/knowledge-bases/:id/documents`：上传 Markdown 并触发索引。
- `GET /api/knowledge-bases/:id`：轮询索引结果。

扩展不保存模型供应商密钥。所有模型调用、配额、工作区权限和用量记录都由 ai2dot 服务端处理。
