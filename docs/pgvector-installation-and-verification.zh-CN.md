# PostgreSQL pgvector 安装、配置与 AI2Dot 验证手册

本文用于将普通 PostgreSQL 数据库升级为支持向量存储和相似度搜索的数据库，并验证 AI2Dot 的文档分块、Embedding、HNSW 索引与混合召回链路。

适用环境：

- Docker：AI2Dot 自托管环境，PostgreSQL 17。
- Linux 原生 PostgreSQL：Ubuntu/Debian 或 RHEL 系列。
- Vercel + Neon：应用运行在 Vercel，数据库运行在 Neon。

AI2Dot 当前固定使用 1536 维向量、余弦距离和 HNSW 索引。实施时必须保证数据库列维度与 Embedding 模型输出维度一致。

## 1. 当前架构

AI2Dot 的语义检索链路如下：

1. 上传 PDF、DOCX、TXT、Markdown、CSV 或 JSON。
2. 应用解析正文并切分为 `knowledge_chunks`。
3. `knowledge_embedding_jobs` 保存可恢复的后台任务。
4. Embedding 服务将每个片段转换为 1536 维向量。
5. 向量写入 `knowledge_chunks.embedding`。
6. 检索同时执行关键词候选和 pgvector 语义候选。
7. 应用使用 RRF、关键词得分和余弦相似度进行混合重排。

关键数据库对象：

| 对象 | 用途 |
| --- | --- |
| `vector` 扩展 | 提供向量类型、距离运算符和向量索引 |
| `knowledge_chunks.embedding vector(1536)` | 保存文档片段向量 |
| `knowledge_chunks_embedding_hnsw_idx` | 余弦距离 HNSW 索引 |
| `knowledge_embedding_jobs` | 持久化后台任务、重试和租约 |
| `embedding_model` | 防止混用不同供应商或不同模型生成的向量 |

## 2. 变更前检查与备份

### 2.1 检查 PostgreSQL 主版本

Docker 环境：

```bash
cd /app/ai2dot
docker compose exec -T postgres psql -U ai2dot -d ai2dot -c \
  "SHOW server_version;"
```

原生 PostgreSQL：

```bash
psql "$DATABASE_URL" -c "SHOW server_version;"
```

切换 Docker 镜像时必须保持 PostgreSQL 主版本一致。例如原数据库是 PostgreSQL 17，只能直接切换到 `pgvector` 的 PostgreSQL 17 镜像。跨主版本升级必须使用 `pg_upgrade` 或逻辑备份恢复，不能直接复用旧数据目录。

### 2.2 创建逻辑备份

AI2Dot Compose 已提供备份工具：

```bash
cd /app/ai2dot
docker compose --profile tools run --rm backup
ls -lh backups/
```

也可以手工执行：

```bash
docker compose exec -T postgres sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/ai2dot-$(date +%Y%m%d-%H%M%S).dump"
```

确认备份文件非空后再继续：

```bash
latest_backup="$(ls -1t backups/ai2dot-*.dump | head -1)"
test -n "$latest_backup" && test -s "$latest_backup"
```

### 2.3 记录升级前数据量

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc
  "select
     (select count(*) from users),
     (select count(*) from workspaces),
     (select count(*) from knowledge_documents);"'
```

保存输出，切换镜像后应得到相同结果。

## 3. Docker 安装方式

这是 AI2Dot 自托管环境的推荐方式。pgvector 官方镜像是在 PostgreSQL 官方镜像基础上加入扩展文件，数据库仍然使用原来的 PostgreSQL 数据目录。

### 3.1 修改 Compose 镜像

`compose.yaml` 中的数据库服务应类似：

```yaml
services:
  postgres:
    image: pgvector/pgvector:0.8.6-pg17-bookworm
    restart: unless-stopped
    shm_size: 256mb
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-ai2dot}
      POSTGRES_USER: ${POSTGRES_USER:-ai2dot}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    command:
      - postgres
      - -c
      - shared_buffers=${POSTGRES_SHARED_BUFFERS:-256MB}
      - -c
      - effective_cache_size=${POSTGRES_EFFECTIVE_CACHE_SIZE:-1GB}
      - -c
      - work_mem=${POSTGRES_WORK_MEM:-8MB}
      - -c
      - maintenance_work_mem=${POSTGRES_MAINTENANCE_WORK_MEM:-128MB}
      - -c
      - wal_compression=on
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

注意事项：

- `pg17` 必须与原数据库主版本一致。
- 建议固定 pgvector 版本，不要在生产环境直接使用不带版本的浮动标签。
- `shm_size` 应不小于 `maintenance_work_mem`，否则并行构建 HNSW 索引时可能失败。
- 不得删除或更名 `postgres-data` volume。

### 3.2 验证 Compose 配置

该命令只解析配置，不创建容器：

```bash
docker compose config --quiet
```

不要把完整的 `docker compose config` 输出复制到日志或工单，它可能展开 `.env` 中的密钥。

### 3.3 拉取并切换数据库镜像

```bash
docker compose pull postgres
docker compose up -d --no-deps --force-recreate --wait postgres
docker compose ps postgres
```

确认状态为 `healthy` 后，再次检查数据量：

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc
  "select
     (select count(*) from users),
     (select count(*) from workspaces),
     (select count(*) from knowledge_documents);"'
```

### 3.4 检查镜像系统变化引起的排序规则差异

如果从 Alpine 切换到 Debian/Bookworm，建议检查数据库记录的排序规则版本：

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c
  "select datname,
          datcollversion,
          pg_database_collation_actual_version(oid) as actual_version
     from pg_database
    where datname = current_database();"'
```

如果两个版本不同，应先阅读 PostgreSQL 输出的警告，重建受影响的文本索引，再执行 `ALTER DATABASE ... REFRESH COLLATION VERSION`。不要在未重建索引时只刷新版本标记。该问题不影响向量数据格式，但可能影响文本排序和 B-tree 索引。

## 4. Linux 原生 PostgreSQL 安装方式

Docker 部署不需要执行本节。

### 4.1 使用 PostgreSQL APT 仓库

确保已配置 PostgreSQL 官方 APT 仓库，然后按数据库主版本安装。PostgreSQL 17 示例：

```bash
sudo apt update
sudo apt install postgresql-17-pgvector
```

在每个需要向量能力的数据库中启用扩展：

```bash
sudo -u postgres psql -d ai2dot -c \
  "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4.2 使用 PostgreSQL RPM 仓库

在 RHEL、Rocky Linux 或 AlmaLinux 上，确保已配置 PostgreSQL 官方 Yum Repository，然后安装与数据库主版本匹配的软件包。PostgreSQL 17 示例：

```bash
sudo dnf install pgvector_17
sudo -u postgres psql -d ai2dot -c \
  "CREATE EXTENSION IF NOT EXISTS vector;"
```

如果软件包管理器找不到 `pgvector_17`，先确认 PostgreSQL 官方仓库已经启用，并检查当前 PostgreSQL 的主版本。不要为 PostgreSQL 17 安装其他主版本的软件包。

### 4.3 从源码安装

仅在发行版没有合适的软件包时使用：

```bash
sudo apt update
sudo apt install -y build-essential git postgresql-server-dev-17

cd /tmp
git clone --branch v0.8.6 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

然后连接目标数据库：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

如果主机有多个 PostgreSQL 版本，编译前明确指定：

```bash
export PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config
make clean
make
sudo --preserve-env=PG_CONFIG make install
```

## 5. Neon 与 Vercel

Neon 已提供 pgvector 扩展，不需要安装操作系统软件包。使用 Neon SQL Editor 或 unpooled/direct connection 执行：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

AI2Dot 的 migration 已包含 `CREATE EXTENSION IF NOT EXISTS vector`。Vercel 环境应配置：

```dotenv
# 应用运行时使用 Neon pooled connection。
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require

# Migration 使用 Neon direct/unpooled connection。
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require

CRON_SECRET=<独立随机值>
```

`npm run vercel-build` 会先执行 Drizzle migration，再构建 Next.js。不要让多个生产部署同时对同一数据库执行手工 DDL。

Embedding 有两种配置方法。

方法一，使用 Vercel AI Gateway：

```dotenv
AI2DOT_ENABLE_AI_GATEWAY=true
AI2DOT_EMBEDDING_MODEL=openai/text-embedding-3-small
# 未使用 Vercel OIDC 时还需设置 AI_GATEWAY_API_KEY。
AI_GATEWAY_API_KEY=<Vercel AI Gateway API key>
```

使用 Vercel OIDC 时无需额外填写 `AI_GATEWAY_API_KEY`；两种认证方式至少配置一种。

方法二，复用 AI2Dot 管理页面中加密保存的 OpenAI-compatible 供应商：

```dotenv
AI2DOT_EMBEDDING_PROVIDER_NAME=Google Gemini
AI2DOT_EMBEDDING_MODEL=models/gemini-embedding-2
```

第二种方式要求每个需要语义检索的工作区都存在同名、已启用且密钥有效的供应商连接。Vercel 使用 Neon 数据库中的供应商配置，不能自动读取 Docker 本地 PostgreSQL 中的配置。

## 6. 执行 AI2Dot Migration

Docker：

```bash
cd /app/ai2dot
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate
```

本地或 CI：

```bash
DATABASE_URL_UNPOOLED='<direct connection string>' npx drizzle-kit migrate
```

对应的 migration 是：

```text
drizzle/0014_gigantic_arclight.sql
```

它会执行以下核心 DDL：

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_chunks
  ADD COLUMN embedding vector(1536);

CREATE INDEX knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
```

余弦索引和查询运算符必须匹配：

| 用途 | 索引操作类 | 查询运算符 |
| --- | --- | --- |
| 欧氏距离 | `vector_l2_ops` | `<->` |
| 内积 | `vector_ip_ops` | `<#>` |
| 余弦距离 | `vector_cosine_ops` | `<=>` |

AI2Dot 使用 `vector_cosine_ops` 和 `<=>`。相似度换算为 `1 - cosine_distance`，数值越大越相似。

## 7. 数据库能力验证

### 7.1 检查扩展、列和索引

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c
  "select extname, extversion
     from pg_extension
    where extname = '\''vector'\'';

   select format_type(a.atttypid, a.atttypmod) as embedding_type
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
    where c.relname = '\''knowledge_chunks'\''
      and a.attname = '\''embedding'\'';

   select indexname, indexdef
     from pg_indexes
    where indexname = '\''knowledge_chunks_embedding_hnsw_idx'\'';"'
```

预期结果：

- `vector` 扩展存在。
- `embedding_type` 为 `vector(1536)`。
- 索引定义包含 `USING hnsw` 和 `vector_cosine_ops`。

### 7.2 使用三维测试向量验证搜索

下面的测试在事务中创建独立表，最后使用 `ROLLBACK` 清理，不会留下数据：

```sql
BEGIN;

CREATE TABLE pgvector_smoke_test (
  id bigserial PRIMARY KEY,
  label text NOT NULL,
  embedding vector(3) NOT NULL
);

INSERT INTO pgvector_smoke_test (label, embedding) VALUES
  ('exact', '[1,0,0]'),
  ('near',  '[0.9,0.1,0]'),
  ('far',   '[0,1,0]');

CREATE INDEX pgvector_smoke_test_hnsw_idx
  ON pgvector_smoke_test
  USING hnsw (embedding vector_cosine_ops);

ANALYZE pgvector_smoke_test;

SELECT
  label,
  round((1 - (embedding <=> '[1,0,0]'::vector))::numeric, 6) AS similarity
FROM pgvector_smoke_test
ORDER BY embedding <=> '[1,0,0]'::vector
LIMIT 3;

SET LOCAL enable_seqscan = off;
EXPLAIN (ANALYZE, COSTS OFF)
SELECT label
FROM pgvector_smoke_test
ORDER BY embedding <=> '[1,0,0]'::vector
LIMIT 2;

ROLLBACK;
```

预期排序为：

```text
exact  1.000000
near   约 0.993884
far    0.000000
```

`EXPLAIN` 应出现 `pgvector_smoke_test_hnsw_idx`。这里关闭顺序扫描仅用于强制验证索引可用性；生产环境不要全局关闭 `enable_seqscan`。小数据表正常情况下选择顺序扫描通常更便宜。

## 8. 使用测试文档验证 AI2Dot 全链路

仓库已经提供可直接上传的测试文件：

```text
docs/samples/semantic-search-smoke-test.md
```

### 8.1 确认 Embedding 配置

Docker 使用已有 Google Gemini 供应商时，`.env` 应包含：

```dotenv
AI2DOT_EMBEDDING_PROVIDER_NAME="Google Gemini"
AI2DOT_EMBEDDING_MODEL=models/gemini-embedding-2
CRON_SECRET=<已配置的随机值>
```

供应商名称包含空格时应使用双引号，不要写成 `Google\ Gemini`，否则反斜杠可能被当作名称的一部分。

应用环境发生变化后重建容器：

```bash
docker compose up -d --force-recreate --wait app embedding-worker
```

### 8.2 上传文档

1. 打开 `https://dot.ai2note.com/knowledge`。
2. 创建一个名为“语义检索验收”的知识库。
3. 上传 `docs/samples/semantic-search-smoke-test.md`。
4. 等待文档状态变为“就绪”。
5. 确认界面显示语义片段数量大于 0。

文档解析完成和向量生成完成是两个状态。正文已经可用但向量仍在排队时，系统会暂时使用关键词检索。

### 8.3 手工触发后台任务

正常情况下 Docker worker 每 30 秒领取任务。需要立即验证时，可以调用受保护的 Cron 接口：

```bash
cd /app/ai2dot
set -a
. ./.env
set +a

curl -fsS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  http://127.0.0.1:3000/api/cron/knowledge-embeddings
```

典型成功响应：

```json
{
  "ok": true,
  "configured": true,
  "claimed": 1,
  "embedded": 1,
  "completed": 1,
  "failed": 0
}
```

如果 worker 已经先完成任务，`claimed` 为 `0` 也是正常结果。

### 8.4 用 SQL 验证真实 1536 维向量

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c
  "select
       d.name,
       d.status,
       d.embedding_status,
       d.embedding_model,
       d.embedded_chunk_count,
       count(c.id) as total_chunks,
       count(c.embedding) as vector_chunks,
       min(vector_dims(c.embedding)) as min_dimensions,
       max(vector_dims(c.embedding)) as max_dimensions,
       round(min(vector_norm(c.embedding))::numeric, 6) as min_norm,
       round(max(vector_norm(c.embedding))::numeric, 6) as max_norm
     from knowledge_documents d
     join knowledge_chunks c on c.document_id = d.id
    where d.name = '\''semantic-search-smoke-test.md'\''
    group by d.id, d.name, d.status, d.embedding_status,
             d.embedding_model, d.embedded_chunk_count;"'
```

验收标准：

- `status = ready`
- `embedding_status = ready`
- `embedded_chunk_count = total_chunks = vector_chunks`
- `min_dimensions = max_dimensions = 1536`
- 向量经过 L2 归一化，`min_norm` 和 `max_norm` 应接近 `1.000000`

### 8.5 验证数据库余弦检索

下面使用测试文档第一个片段的向量作为查询向量，验证真实业务表可以执行余弦搜索：

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c
  "with query_vector as (
       select c.embedding
         from knowledge_chunks c
         join knowledge_documents d on d.id = c.document_id
        where d.name = '\''semantic-search-smoke-test.md'\''
          and c.embedding is not null
        order by c.chunk_index
        limit 1
   )
   select
     d.name,
     c.chunk_index,
     round((1 - (c.embedding <=> q.embedding))::numeric, 6) as similarity,
     left(c.content, 100) as preview
   from knowledge_chunks c
   join knowledge_documents d on d.id = c.document_id
   cross join query_vector q
   where c.embedding is not null
   order by c.embedding <=> q.embedding
   limit 5;"'
```

第一条结果应为测试文档自身片段，相似度为 `1.000000`。这一步验证 pgvector 数据、运算符和业务表结构；它不单独验证自然语言查询的 Embedding。

### 8.6 验证自然语言语义召回

在助手或聊天中启用“语义检索验收”知识库，然后依次提问：

```text
ORBIT-7391 的资料保留多久？
```

该问题验证关键词召回，预期答案为“180 天”。

再提问：

```text
怎样把售后电话沉淀成团队可以重复利用的经验？
```

测试文档没有完整出现这句话。它应通过语义向量命中文档中“访谈录音转写、整理问题/决策/待办、写入共享知识库”的内容。回答的来源区域应显示 `semantic-search-smoke-test.md`，检索模式应包含语义或混合召回。

最后提问：

```text
谁负责每周检查没有负责人的行动项？
```

预期答案为“林岚，每周五检查”。

## 9. 运行状态与故障排查

### 9.1 查看任务状态

```bash
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c
  "select status, attempts, available_at, locked_at, last_error
     from knowledge_embedding_jobs
    order by updated_at desc
    limit 20;"'
```

### 9.2 查看日志

```bash
docker compose logs --since=10m app embedding-worker
```

### 9.3 常见错误

#### `extension "vector" is not available`

数据库镜像或主机没有安装扩展文件。Docker 应确认实际镜像为：

```bash
docker compose ps postgres
```

原生 PostgreSQL 应确认安装的软件包与主版本一致，例如 `postgresql-17-pgvector`。

#### `Embedding 模型必须返回 1536 维`

模型默认输出维度与列定义不一致。AI2Dot 会向 OpenAI-compatible 服务请求 1536 维；所选模型必须支持该参数。不要把不同维度的模型写入同一个索引。

#### `工作区中找不到已启用的模型供应商`

检查：

- `AI2DOT_EMBEDDING_PROVIDER_NAME` 是否与管理页面名称完全一致。
- 供应商是否处于启用状态。
- 当前文档所属工作区是否拥有该供应商。
- 名称含空格时 `.env` 是否使用双引号。

#### 任务长期为 `pending`

检查 `embedding-worker` 是否运行、`CRON_SECRET` 是否配置，以及受保护接口能否访问：

```bash
docker compose ps embedding-worker
docker compose logs --tail=100 embedding-worker app
```

#### HNSW 索引存在但 `EXPLAIN` 没有使用

小数据集使用顺序扫描通常更快，这是 PostgreSQL 优化器的正常选择。应在接近生产数据量的环境使用 `EXPLAIN (ANALYZE, BUFFERS)` 测试，不要通过全局关闭顺序扫描来强迫生产查询使用索引。

带工作区或知识库过滤条件的 HNSW 查询如果召回不足，可以在验证后为会话设置：

```sql
SET hnsw.iterative_scan = strict_order;
SET hnsw.ef_search = 80;
```

提高 `ef_search` 通常提升召回率，但会增加查询时间。应使用真实数据集测量后再决定是否设为数据库默认值。

## 10. 性能维护

定期更新统计信息：

```sql
ANALYZE knowledge_chunks;
```

检查索引大小：

```sql
SELECT pg_size_pretty(
  pg_relation_size('knowledge_chunks_embedding_hnsw_idx')
) AS hnsw_index_size;
```

检查向量覆盖率：

```sql
SELECT
  count(*) AS total_chunks,
  count(embedding) AS embedded_chunks,
  round(100.0 * count(embedding) / nullif(count(*), 0), 2) AS coverage_percent
FROM knowledge_chunks;
```

注意：

- 1536 维 `vector` 每条约占 `4 * 1536 + 8` 字节，尚未包含表行和 HNSW 索引开销。
- HNSW 查询速度快，但索引构建时间和内存占用高于普通 B-tree。
- 大批量导入时可以先写入数据、再批量构建索引；在线增量文档可直接使用现有索引。
- `NULL` 向量不会进入 HNSW 索引；使用余弦距离时零向量也不会被索引。
- 删除大量文档后应按数据库维护策略执行 `VACUUM (ANALYZE)`。

## 11. 验收清单

- [ ] 已生成并验证数据库备份。
- [ ] PostgreSQL 主版本没有变化。
- [ ] 数据库容器健康，升级前后核心表数量一致。
- [ ] `vector` 扩展已安装并启用。
- [ ] `knowledge_chunks.embedding` 为 `vector(1536)`。
- [ ] HNSW 索引使用 `vector_cosine_ops`。
- [ ] 三维 SQL 测试的距离排序正确。
- [ ] 测试文档解析状态为 `ready`。
- [ ] 测试文档 Embedding 状态为 `ready`。
- [ ] 所有测试片段都生成了 1536 维向量。
- [ ] 向量 L2 norm 接近 1。
- [ ] 关键词问题可以命中文档。
- [ ] 不包含原文关键词的语义问题也可以命中文档。
- [ ] 回答显示正确的知识库来源。
- [ ] Docker worker 或 Vercel Cron 能恢复中断任务。

## 12. 参考资料

- pgvector 官方项目：https://github.com/pgvector/pgvector
- Drizzle pgvector 支持：https://orm.drizzle.team/docs/extensions
- Neon HNSW 说明：https://neon.com/blog/understanding-vector-search-and-hnsw-index-with-pgvector
- AI2Dot 双运行环境架构：`docs/dual-runtime-architecture.zh-CN.md`
- AI2Dot Docker 部署手册：`docs/docker-linux-deployment.zh-CN.md`
