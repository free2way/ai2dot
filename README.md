<div align="center">
  <img src="./extension/assets/icon.svg" width="92" height="92" alt="ai2dot logo" />
  <h1>ai2dot</h1>
  <p><strong>A deployable AI workspace for conversations, agents, knowledge, research, and operations.</strong></p>
  <p>Run it on your own Docker infrastructure or ship the same application on Vercel and Neon.</p>

  <p>
    <a href="https://ai2note.com"><strong>Product Site</strong></a> ·
    <a href="https://ai.ai2dot.com"><strong>Cloud App</strong></a> ·
    <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
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

## Product Overview

ai2dot turns fragmented AI tools into one governed workspace. Teams can connect their own model providers, build reusable assistants, ground conversations in private knowledge, run approved MCP tools, turn research sources into structured artifacts, and monitor the platform from an independent administration console.

The application is provider-neutral and deployment-neutral by design. The same domain model, Drizzle migrations, authorization boundaries, generation ledger, and retrieval engine run in both environments:

- **Self-hosted:** Docker Compose, Next.js standalone, Nginx, PostgreSQL + pgvector, and an optional Cloudflare Tunnel.
- **Cloud:** Vercel Functions, Vercel Cron, Clerk, and Neon PostgreSQL + pgvector.

## What Is Included

| Surface | Production capability |
| --- | --- |
| **AI Workspace** | Streaming chat, model switching, deep reasoning controls, persistent conversations, rolling context summaries, and non-destructive branches. |
| **Assistants** | Reusable system instructions with a selected model, knowledge bases, and an explicit MCP source allowlist. |
| **Agentic Tools** | Multi-step MCP execution with step/time budgets, automatic approval for read-only tools, human approval for write or unknown-risk tools, and durable audit records. |
| **Knowledge** | PDF, DOCX, TXT, Markdown, CSV, and JSON ingestion with PostgreSQL full-text/trigram candidates, pgvector semantic candidates, RRF fusion, and citations. |
| **Notebook Studio** | Research spaces, files and pasted sources, YouTube/Bilibili transcript sources, source search, editable artifacts, and one-click publication to the knowledge base. |
| **Skills** | Workspace-scoped `SKILL.md` instruction packages with metadata parsing, relevance matching, versioning, fingerprints, and MCP dependency hints. |
| **Web Clipper** | Chrome Manifest V3 side panel that extracts the current page, generates Markdown with a workspace model, and saves it to a selected knowledge base. |
| **Operations** | Provider health, usage, token and cost telemetry, generation replay, PostgreSQL rate limiting, background embedding jobs, and structured logs. |
| **Platform Console** | Separate local administrator identity, user status controls, workspace inventory, storage and usage views, and administrative audit history. |

## Reference Architecture

<p align="center">
  <img src="./docs/assets/ai2dot-reference-architecture.svg" alt="ai2dot reference architecture" width="100%" />
</p>

The control plane is intentionally stateless between requests. PostgreSQL owns authorization-relevant state, idempotency, leases, job progress, tool audit events, and external bindings. Docker may add process-local caches for performance, but correctness never depends on them; Vercel can therefore execute the same workflows across cold starts and concurrent functions.

## Core Engineering Principles

### Provider ownership without lock-in

Connect OpenAI, OpenRouter, DeepSeek, ZenMux, Google Gemini, or any compatible endpoint. Provider credentials are encrypted with AES-256-GCM before they are stored and are never returned to the browser. Vercel AI Gateway remains optional.

### Tool use with explicit boundaries

An assistant can only see MCP sources assigned to it. Ordinary chats require users to select a source explicitly. Read-only tools can run automatically; write, destructive, and unknown-risk operations require human approval. Requests, approvals, executions, and outcomes are recorded in PostgreSQL.

### Retrieval that survives provider outages

Knowledge search combines `pg_trgm` keyword recall with pgvector HNSW semantic recall and reciprocal-rank fusion. Embeddings can use a workspace-owned OpenAI-compatible provider. If embedding generation is unavailable, search degrades to keyword retrieval instead of taking the workspace offline.

### Durable AI operations

Every persistent generation has a UUID idempotency key, a SHA-256 request fingerprint, and an explicit lifecycle. Completed responses can be replayed without a second upstream charge. Embedding work uses PostgreSQL leases, retries, and idempotent updates so interrupted functions or containers can resume safely.

## Notebook Studio

Notebook Studio connects research and the knowledge base in one workflow:

1. Create a research space linked to its own knowledge base.
2. Add documents, pasted text, or a YouTube/Bilibili URL with a transcript or subtitle file.
3. Search all sources with the same hybrid retrieval engine used by chat.
4. Generate a summary, FAQ, timeline, study guide, or mind map with a selected workspace model.
5. Review and edit the Markdown artifact.
6. Publish the result back to the knowledge base for future retrieval.

Gemini Enterprise Notebook is designed as an **optional external provider**. The repository currently includes provider configuration and readiness checks; production OAuth, notebook/source synchronization, and report import remain behind a feature flag. ai2dot's native Notebook Studio continues to work without Google services.

## Security Model

- Workspace-level authorization on persistent resources and APIs.
- Local signed HttpOnly sessions or Clerk authentication.
- Separate platform-admin identities and sessions.
- AES-256-GCM encryption for model and MCP credentials.
- HTTPS-only external MCP endpoints with DNS/IP validation and private-network blocking.
- Human approval for mutating or unclassified MCP tools.
- Append-oriented generation records and tool audit trails.
- PostgreSQL-backed rate limiting across multiple application instances.
- Non-root production containers; PostgreSQL is not published to the host by default.

Security features reduce operational risk but do not replace an organization-specific threat model, secret rotation policy, network policy, or compliance review.

## Development Quality Gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions executes the same application checks. The Chrome extension has its own typecheck, test, build, and packaging commands under `extension/`.

---

<div align="center">
  <strong>ai2dot</strong><br />
  Own the workspace. Choose the models. Keep the operating boundary visible.
</div>
