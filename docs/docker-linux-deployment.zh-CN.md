# ai2dot Docker + Linux 可复现部署手册

本文档描述如何把 ai2dot 从 GitHub 部署到一台 Linux 主机，并使用本地 PostgreSQL、Clerk 和 Cloudflare Tunnel 对外提供服务。步骤与当前仓库中的 `Dockerfile`、`compose.yaml`、`deploy/nginx.conf` 和 Drizzle migration 保持一致。

本文使用以下实例值说明，迁移到其他环境时替换尖括号变量即可：

| 项目 | 当前实例 / 示例 |
| --- | --- |
| Git 仓库 | `https://github.com/free2way/ai2dot.git` |
| Linux 主机 | `192.168.2.235` |
| SSH 用户 | `free2way` |
| 部署目录 | `/app/ai2dot` |
| 宿主机端口 | `3000` |
| 公网域名 | `dot.ai2note.com` |
| 应用入口 | `https://dot.ai2note.com/workspace` |

不要把 Linux 密码、Clerk Secret Key、数据库密码、Cloudflare Tunnel Token 或供应商 API Key 写入 Git。本文所有敏感值均使用占位符。

## 1. 最终架构

```text
Browser
  -> https://dot.ai2note.com
  -> Cloudflare edge / DNS
  -> Cloudflare Tunnel (cloudflared on Linux)
  -> http://127.0.0.1:3000
  -> Nginx container
  -> Next.js standalone container
  -> PostgreSQL container + named volume
```

Compose 默认服务：

- `postgres`：PostgreSQL 17，数据写入命名卷 `ai2dot_postgres-data`。
- `app`：Next.js standalone 生产镜像，以非 root 用户运行。
- `proxy`：Nginx，对外暴露 `AI2DOT_PORT`，处理 gzip、连接复用和静态缓存。
- `migrate`：按需运行的 Drizzle migration 工具容器。
- `backup`：按需运行的 PostgreSQL 压缩备份容器。

PostgreSQL 端口没有映射到宿主机，默认只能由 Compose 网络内的服务访问。

## 2. 主机要求

建议配置：

- Ubuntu 22.04/24.04 或同等级 Linux。
- 2 CPU、2 GB 内存、20 GB 可用磁盘起步。
- 可以访问 Docker Hub、GitHub、Clerk 和 Cloudflare。
- 出站允许 TCP/UDP `7844`，供 Cloudflare Tunnel 建立连接。
- 域名已经接入 Cloudflare DNS。

检查主机：

```bash
uname -a
cat /etc/os-release
free -h
df -h /
```

## 3. 安装 Docker Engine 与 Compose

以下为 Ubuntu 使用 Docker 官方 APT 仓库的方式。其他发行版请使用 [Docker Engine 官方安装文档](https://docs.docker.com/engine/install/) 和 [Compose 插件文档](https://docs.docker.com/compose/install/linux/)。

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git openssl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
printf '%s\n' \
  'Types: deb' \
  'URIs: https://download.docker.com/linux/ubuntu' \
  "Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}" \
  'Components: stable' \
  "Architectures: $(dpkg --print-architecture)" \
  'Signed-By: /etc/apt/keyrings/docker.asc' \
  | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null

sudo apt-get update
sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

如需让部署用户不加 `sudo` 使用 Docker：

```bash
sudo usermod -aG docker "$USER"
newgrp docker
docker version
```

注意：`docker` 用户组等同于主机 root 级权限，只应授予可信部署账号。

### 可选：限制 Docker 日志增长

生产主机可在 `/etc/docker/daemon.json` 配置本地日志轮转：

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
```

配置后重启 Docker。此操作影响主机上的全部容器，应安排维护窗口：

```bash
sudo systemctl restart docker
```

## 4. 获取并核对源码

创建 `/app` 并交给部署用户：

```bash
sudo mkdir -p /app
sudo chown "$USER":"$USER" /app
git clone https://github.com/free2way/ai2dot.git /app/ai2dot
cd /app/ai2dot
```

确认当前代码与 GitHub `main` 一致：

```bash
git remote -v
git fetch origin
git switch main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

要求：

- `git status --short` 没有输出，或只有明确保留在服务器上的未跟踪运维文件。
- `git rev-parse HEAD` 与 `git rev-parse origin/main` 输出相同。
- `.env` 不得加入 Git。

如果使用本地工作区同步而不是 `git clone`，应排除 `.env`、`backups/`、`.git/` 和运行时数据。例如在开发机执行：

```bash
rsync -av --delete \
  --exclude .env \
  --exclude backups/ \
  --exclude .git/ \
  /path/to/ai2dot/ free2way@192.168.2.235:/app/ai2dot/
```

使用 `--delete` 前必须确认源目录正确；它会删除远端源目录中不存在的文件。

## 5. 创建生产环境变量

Compose 自动读取项目根目录的 `.env`：

```bash
cd /app/ai2dot
umask 077
cp .env.example .env
chmod 600 .env
```

分别生成数据库密码、会话签名密钥和凭据加密密钥，并把输出保存到密码管理器：

```bash
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
```

推荐使用十六进制数据库密码，避免 PostgreSQL URL 编码问题。

### 5.1 Clerk 认证配置

编辑 `/app/ai2dot/.env`，至少填写：

```dotenv
AI2DOT_AUTH_MODE=clerk

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk production pk_live key>
CLERK_SECRET_KEY=<Clerk production sk_live key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

AI2DOT_COOKIE_SECURE=true
AI2DOT_SESSION_SECRET=<openssl rand -base64 48 的输出>
AI2DOT_SESSION_TTL_HOURS=168
```

Clerk Dashboard 中需要完成：

1. 创建或启用 Production instance。
2. 将应用域名配置为 `dot.ai2note.com`。
3. 按 Clerk Dashboard 提示添加 Clerk 专用 DNS 记录。
4. 启用所需注册方式，例如邮箱验证码或 Google OAuth。
5. 获取 Production Publishable Key 和 Secret Key，而不是 Development Key。
6. 用应用自己的 `/sign-up` 页面注册首个应用用户。

登录 Clerk Dashboard 本身不等于已经登录 ai2dot。应用账号必须通过 `https://dot.ai2note.com/sign-up` 注册或登录。

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 在 Docker 构建阶段写入前端资源。修改 Clerk 域名或 Publishable Key 后，必须重新执行 `docker compose build app`，仅重启旧容器不会生效。Clerk 官方的生产域名变更说明见 [Change domain](https://clerk.com/docs/guides/development/deployment/changing-domains)。

### 5.2 PostgreSQL 配置

```dotenv
POSTGRES_DB=ai2dot
POSTGRES_USER=ai2dot
POSTGRES_PASSWORD=<openssl rand -hex 24 的输出>

# 留空时 Compose 自动使用 postgres 服务和上面的账号拼接连接串。
DATABASE_URL=
DATABASE_URL_UNPOOLED=
DATABASE_POOL_MAX=10

POSTGRES_SHM_SIZE=256mb
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
POSTGRES_WORK_MEM=8MB
POSTGRES_MAINTENANCE_WORK_MEM=128MB
```

第一次初始化 volume 后，不要只修改 `.env` 中的 `POSTGRES_PASSWORD`。PostgreSQL 不会自动修改已有数据库用户密码，会导致应用无法连接。需要换密码时，应先在数据库中执行 `ALTER ROLE`，再更新 `.env` 并重启应用。

### 5.3 应用密钥与运行参数

```dotenv
# 用于加密模型供应商和 MCP Bearer Token。
PROVIDER_SECRET_ENCRYPTION_KEY=<openssl rand -base64 32 的输出>
CRON_SECRET=<独立随机值>

AI_GATEWAY_API_KEY=
AI2DOT_ENABLE_AI_GATEWAY=false

# 默认通过 AI Gateway 生成 1536 维知识库向量。
AI2DOT_EMBEDDING_PROVIDER_NAME=
AI2DOT_EMBEDDING_MODEL=openai/text-embedding-3-small
AI2DOT_EMBEDDING_BASE_URL=
AI2DOT_EMBEDDING_API_KEY=

AI2DOT_CHAT_RATE_LIMIT_PER_MINUTE=30
AI2DOT_PORT=3000
AI2DOT_IMAGE_TAG=latest
AI2DOT_NODE_MEMORY_MB=768
AI2DOT_KEEP_ALIVE_TIMEOUT_MS=65000
```

AI Gateway 可以保持关闭。语义检索可以将 `AI2DOT_EMBEDDING_PROVIDER_NAME` 设置为 `/admin` 中已启用供应商的准确名称，并用 `AI2DOT_EMBEDDING_MODEL` 指定其 Embedding 模型；也可以填写独立的 `AI2DOT_EMBEDDING_BASE_URL`、`AI2DOT_EMBEDDING_API_KEY` 和支持 1536 维输出的模型。聊天模型与 Embedding 模型仍可独立管理。

### 5.4 本地账号模式（Clerk 的替代方案）

完全脱离 Clerk 时，先生成密码哈希：

```bash
cd /app/ai2dot
node scripts/hash-password.mjs '<至少 12 位强密码>'
```

将输出写入：

```dotenv
AI2DOT_AUTH_MODE=local
AI2DOT_LOCAL_AUTH_EMAIL=admin@example.com
AI2DOT_LOCAL_AUTH_PASSWORD_HASH=<scrypt 输出>
AI2DOT_SESSION_SECRET=<独立随机值>
AI2DOT_COOKIE_SECURE=true
```

Clerk 与本地账号模式二选一。切换认证模式后应重建并重启应用。

## 6. 首次构建和启动

先验证 Compose 服务名称；该命令只显示服务名，不展开敏感环境变量：

```bash
cd /app/ai2dot
docker compose config --services
```

不要把完整的 `docker compose config` 输出发送到工单或聊天，它会展开 `.env` 中的密钥。

按以下顺序启动：

```bash
# 1. 拉取基础运行镜像。
docker compose pull postgres proxy

# 2. 启动数据库并等待健康检查通过。
docker compose up -d postgres
docker compose ps

# 3. 构建 migration 工具并执行全部未运行迁移。
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate

# 4. 构建应用镜像。
docker compose build app

# 5. 启动或更新 Next.js 与 Nginx。
docker compose up -d app proxy

# 6. 等待 app、postgres、proxy 全部 healthy。
docker compose ps
```

查看日志：

```bash
docker compose logs --tail=100 postgres
docker compose logs --tail=100 app
docker compose logs --tail=100 proxy
```

本机验证：

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/
```

预期：

- `/api/health` 返回 `{"status":"ok"}`。
- `/` 返回到 `/workspace` 的跳转。
- `docker compose ps` 中三个长期服务均为 `healthy`。

## 7. 配置 Cloudflare Tunnel

Cloudflare 当前建议大多数场景使用 remotely-managed tunnel。官方流程见 [Create a tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) 和 [DNS records](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)。

### 7.1 创建 Tunnel

1. 登录 Cloudflare Dashboard。
2. 打开 `Networking -> Tunnels`。
3. 创建名为 `ai2dot-linux` 的 Cloudflare Tunnel。
4. 选择 Linux connector。
5. 在 `192.168.2.235` 上执行 Dashboard 提供的安装命令。
6. 等待 Tunnel 状态变为 `Healthy`。

Dashboard 通常会提供以下形式的命令：

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
```

Tunnel Token 等同于连接凭据。不要写入 Git、README、截图或共享日志。

检查服务：

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
```

### 7.2 添加公网 Hostname

在 Tunnel 的 Public Hostname / Published application 中添加：

```text
Hostname: dot.ai2note.com
Service type: HTTP
Service URL: http://localhost:3000
```

不要填写 Vercel 地址，也不要填写 `https://ai2note.com`。Tunnel 应直接连接 Linux 主机上的 Nginx。

### 7.3 检查 DNS 冲突

`dot.ai2note.com` 必须只有一条生效的应用路由，通常是：

```text
Type: CNAME
Name: dot
Target: <TUNNEL_UUID>.cfargotunnel.com
Proxy: enabled
```

删除 `dot` 主机名下指向 Vercel、根域名或旧服务器的冲突 A、AAAA、CNAME 记录。`ai2note.com` 根域名仍可以继续指向宣传页面；根域名记录不会决定 `dot.ai2note.com` 的目标，除非错误地给 `dot` 配置了相同 CNAME。

验证：

```bash
dig +short dot.ai2note.com
curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' \
  -L https://dot.ai2note.com/
curl -fsS https://dot.ai2note.com/api/health
```

预期最终 URL 为 `https://dot.ai2note.com/workspace`，健康接口返回 `{"status":"ok"}`。

使用 Tunnel 时不需要把公网 80/443 入站端口转发到这台 Linux 主机；需要保证 `cloudflared` 可以主动连接 Cloudflare。如果还需要局域网通过 `192.168.2.235:3000` 访问，可保留当前端口映射并用主机防火墙限制来源网段。

## 8. 验证 Clerk 注册流程

1. 打开 `https://dot.ai2note.com/sign-up`。
2. 使用启用的邮箱或社交账号完成注册。
3. 注册成功后访问 `/workspace`。
4. 访问 `/admin`，确认能够管理模型、MCP 和 Skill。
5. 访问 `/assistants`，创建、编辑和删除一个测试助手。
6. 重新登录，确认会话和助手仍然存在。

命令行只能验证页面可达，Clerk 的最终注册流程需要在浏览器中完成：

```bash
curl -I https://dot.ai2note.com/sign-in
curl -I https://dot.ai2note.com/sign-up
```

## 9. 性能配置说明

当前部署已经包含以下优化：

- Docker 多阶段构建，只把 Next.js standalone、静态资源和 public 文件放入运行镜像。
- npm 与 Next.js BuildKit 缓存，加快重复发布。
- 应用容器以非 root 用户运行。
- Nginx 开启 `sendfile`、TCP 优化、keepalive、gzip 和静态资源缓存。
- `/_next/static/` 使用不可变缓存；聊天和流式响应关闭代理缓冲。
- PostgreSQL 开启 WAL compression，并允许按主机内存调节缓存和 work memory。
- Node.js 堆内存通过 `AI2DOT_NODE_MEMORY_MB` 限制，避免应用挤占全部主机内存。

建议参数：

| 主机内存 | Node 堆 | DB pool | shared buffers | effective cache | work mem |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 GB | 384-512 MB | 5 | 128 MB | 512 MB | 4 MB |
| 2 GB | 768 MB | 10 | 256 MB | 1 GB | 8 MB |
| 4 GB | 1-1.5 GB | 15 | 512 MB | 2-3 GB | 8-16 MB |

同一 PostgreSQL 连接上可能同时使用多个 `work_mem`，不要按单连接简单乘满物理内存。修改数据库参数后执行：

```bash
docker compose up -d --force-recreate postgres
docker compose up -d app proxy
```

观察资源：

```bash
docker stats
docker system df
docker compose exec -T postgres \
  psql -U ai2dot -d ai2dot -c 'select now(), version();'
```

## 10. 备份与恢复

### 10.1 创建备份

```bash
cd /app/ai2dot
mkdir -p backups
chmod 700 backups
docker compose --profile tools run --rm backup
ls -lh backups/
```

输出文件格式：

```text
/app/ai2dot/backups/ai2dot-YYYYMMDD-HHMMSS.dump
```

备份目录位于宿主机，不在 PostgreSQL volume 中。应定期复制到另一台主机或对象存储。

可选的每日备份 cron：

```cron
0 3 * * * cd /app/ai2dot && /usr/bin/docker compose --profile tools run --rm backup >> /var/log/ai2dot-backup.log 2>&1
```

### 10.2 恢复备份

恢复会覆盖目标数据库中的同名对象。先保留当前备份并停止应用写入：

```bash
cd /app/ai2dot
docker compose --profile tools run --rm backup
docker compose stop app

docker compose --profile tools run --rm -T backup sh -lc \
  'pg_restore -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < backups/<需要恢复的文件>.dump

docker compose up -d app proxy
docker compose ps
```

恢复后检查登录、工作区、助手、供应商配置和历史对话。

## 11. 日常升级流程

每次升级先备份，再更新代码、执行 migration、构建和替换应用：

```bash
cd /app/ai2dot

# 1. 备份。
docker compose --profile tools run --rm backup

# 2. 更新 main。
git fetch origin
git switch main
git log --oneline HEAD..origin/main
git pull --ff-only origin main

# 3. 执行 migration。
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate

# 4. 构建并滚动替换应用。
docker compose build app
docker compose up -d app proxy

# 5. 验证。
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://dot.ai2note.com/api/health
docker compose logs --tail=100 app proxy
```

需要保留可回滚镜像时，给每次发布使用唯一 tag：

```bash
export AI2DOT_IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
docker compose build app
docker compose up -d app proxy
docker image ls 'ai2dot'
```

发布成功后把该 tag 写入 `.env` 的 `AI2DOT_IMAGE_TAG`。应用回滚只能在数据库 schema 与旧版本兼容时进行：

```bash
AI2DOT_IMAGE_TAG=<旧镜像 tag> docker compose up -d --no-build app proxy
```

数据库 migration 不保证自动向后兼容，涉及 schema 的回滚应优先恢复匹配版本的数据库备份。

## 12. 常用运维命令

```bash
# 服务状态
docker compose ps

# 最近日志
docker compose logs --tail=200 app proxy postgres

# 持续跟踪应用日志
docker compose logs -f app

# 重启应用，不重建数据库
docker compose restart app proxy

# 环境或构建参数变化后重建应用
docker compose build app
docker compose up -d app proxy

# 执行 migration
docker compose --profile tools run --rm migrate

# 查看 volume
docker volume ls | grep ai2dot

# 停止应用但保留 volume
docker compose down

# 检查健康接口
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://dot.ai2note.com/api/health
```

不要执行 `docker compose down -v`，除非明确要删除全部 PostgreSQL 持久化数据。

## 13. 故障排查

### 13.1 域名打开了 Vercel 或其他网站

检查 Cloudflare DNS 中 `dot.ai2note.com`：

- 删除指向根域名、Vercel 或旧主机的冲突记录。
- 保留指向 `<TUNNEL_UUID>.cfargotunnel.com` 的 Tunnel CNAME。
- 确认 Tunnel Public Hostname 的服务是 `http://localhost:3000`。
- `ai2note.com` 根域名可以继续服务宣传页，不需要修改。

### 13.2 Cloudflare 502、1016、1033

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 200 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
docker compose ps
```

- `1016` 常见于 DNS 指向 Tunnel，但 Tunnel 或 hostname route 不存在。
- `1033` 常见于 Tunnel 没有健康 connector。
- `502` 常见于 Tunnel 正常，但 `localhost:3000` 不可达。

### 13.3 Clerk 页面加载失败或登录后循环

- 确认使用 `pk_live_` / `sk_live_` Production Keys。
- 确认 Clerk Production Domain 是 `dot.ai2note.com`。
- 确认 Clerk 要求的 DNS 记录全部验证通过。
- 修改 Publishable Key 后重新构建，不是只重启容器。
- 确认 `AI2DOT_AUTH_MODE=clerk`、`AI2DOT_COOKIE_SECURE=true`。
- 在 `/sign-up` 注册应用账号，而不是只登录 Clerk Dashboard。

### 13.4 应用容器 unhealthy

```bash
docker compose ps
docker compose logs --tail=300 app
docker inspect ai2dot-app-1 --format '{{json .State.Health}}'
```

常见原因：数据库连接失败、环境变量缺失、migration 未执行、内存不足。

### 13.5 PostgreSQL 无法认证

- 检查 `.env` 中 `POSTGRES_USER`、`POSTGRES_DB`、`POSTGRES_PASSWORD`。
- 不要在已有 volume 上直接修改密码变量。
- 检查数据库日志：`docker compose logs --tail=200 postgres`。
- 确认未误删 `ai2dot_postgres-data` volume。

### 13.6 模型或 MCP Key 无法保存

确认 `.env` 中设置了有效的 `PROVIDER_SECRET_ENCRYPTION_KEY`，然后重建或重启应用。该值变更后，之前加密保存的凭据无法再解密；必须保持原值或重新录入全部凭据。

## 14. 上线验收清单

- [ ] Linux 主机时间、磁盘和内存正常。
- [ ] Docker Engine、Buildx、Compose 插件安装完成。
- [ ] `/app/ai2dot` 与 GitHub `main` 对应提交一致。
- [ ] `.env` 权限为 `600`，且没有进入 Git。
- [ ] PostgreSQL 使用强随机密码并由 named volume 持久化。
- [ ] Drizzle migrations 全部成功执行。
- [ ] PostgreSQL 镜像包含 pgvector，`SELECT extversion FROM pg_extension WHERE extname = 'vector'` 能返回版本。
- [ ] `postgres`、`app`、`proxy` 均为 `healthy`，`embedding-worker` 为 `running`。
- [ ] 本机 `/api/health` 返回 200。
- [ ] Cloudflare Tunnel 为 `Healthy`。
- [ ] `dot.ai2note.com` 只路由到 Tunnel，不指向 Vercel。
- [ ] 公网 `/api/health` 返回 200，根路径进入 `/workspace`。
- [ ] Clerk 注册、登录、退出流程正常。
- [ ] 能创建助手、模型供应商、MCP、Skill 和持久化会话。
- [ ] 上传知识库文档后，语义片段数量最终等于可检索片段数量。
- [ ] 同义改写查询能以“语义召回”或“混合召回”命中文档。
- [ ] 已生成首份数据库备份，并复制到主机外的位置。
- [ ] 已记录镜像 tag、Git commit 和本次部署时间。

## 15. 关键文件

- `Dockerfile`：依赖、构建、migration 和非 root runtime stages。
- `compose.yaml`：PostgreSQL、应用、Nginx、migration 与 backup 服务。
- `deploy/nginx.conf`：反向代理、缓存、gzip、健康检查与流式响应配置。
- `.env.example`：全部环境变量模板。
- `drizzle/`：数据库 migration。
- `scripts/hash-password.mjs`：本地认证密码哈希生成器。
