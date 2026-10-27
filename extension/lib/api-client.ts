import type {
  BootstrapResponse,
  ExtractedPage,
  SummaryTemplate,
} from "~/lib/types";

const API_ORIGIN = (
  process.env.PLASMO_PUBLIC_API_ORIGIN || "https://ai.ai2dot.com"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function parseError(response: Response) {
  const fallback = `请求失败（HTTP ${response.status}）`;
  try {
    const payload = (await response.json()) as {
      code?: string;
      message?: string;
    };
    return new ApiError(
      payload.message || fallback,
      payload.code || "REQUEST_FAILED",
      response.status,
    );
  } catch {
    return new ApiError(fallback, "REQUEST_FAILED", response.status);
  }
}

function authorization(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getBootstrap(token: string) {
  const response = await fetch(`${API_ORIGIN}/api/extension/bootstrap`, {
    headers: authorization(token),
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as BootstrapResponse;
}

export async function summarizePage({
  token,
  modelId,
  page,
  template,
  signal,
  onDelta,
}: {
  token: string;
  modelId: string;
  page: ExtractedPage;
  template: SummaryTemplate;
  signal: AbortSignal;
  onDelta: (fullText: string) => void;
}) {
  const response = await fetch(`${API_ORIGIN}/api/extension/summarize`, {
    method: "POST",
    headers: {
      ...authorization(token),
      "content-type": "application/json",
      accept: "application/x-ndjson",
    },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      modelId,
      template,
      locale: "zh-CN",
      page: {
        title: page.title,
        url: page.canonicalUrl || page.url,
        siteName: page.siteName,
        author: page.author,
        publishedAt: page.publishedAt,
        markdown: page.markdown,
      },
    }),
    signal,
  });
  if (!response.ok) throw await parseError(response);
  if (!response.body) throw new ApiError("模型没有返回内容。", "EMPTY_RESPONSE", 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const framed = response.headers.get("content-type")?.includes("application/x-ndjson");
  let output = "";
  let pending = "";
  let completed = false;
  let lastUpdateAt = 0;
  const consume = (text: string) => {
    if (!framed) {
      output += text;
      return;
    }
    pending += text;
    let index: number;
    while ((index = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, index).trim();
      pending = pending.slice(index + 1);
      if (!line) continue;
      let event: unknown;
      try { event = JSON.parse(line); }
      catch { throw new ApiError("总结响应格式不正确。", "INVALID_RESPONSE", 502); }
      if (!event || typeof event !== "object" || !("type" in event) || completed) {
        throw new ApiError("总结响应格式不正确。", "INVALID_RESPONSE", 502);
      }
      if (event.type === "error") {
        throw new ApiError("模型总结失败，请稍后重试。", "SUMMARY_FAILED", 502);
      } else if (event.type === "done") {
        completed = true;
      } else if (event.type === "delta" && "text" in event && typeof event.text === "string") {
        output += event.text;
      } else {
        throw new ApiError("总结响应格式不正确。", "INVALID_RESPONSE", 502);
      }
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      consume(decoder.decode(value, { stream: true }));
      const now = performance.now();
      if (now - lastUpdateAt >= 50) {
        lastUpdateAt = now;
        onDelta(output);
      }
    }
    consume(decoder.decode());
    if ((framed && (!completed || pending.trim())) || !output.trim()) {
      throw new ApiError("总结未完成，请重新分析。", "INCOMPLETE_RESPONSE", 502);
    }
    onDelta(output);
    return output;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function uploadMarkdown({
  token,
  knowledgeBaseId,
  name,
  content,
}: {
  token: string;
  knowledgeBaseId: string;
  name: string;
  content: string;
}) {
  const form = new FormData();
  form.set("name", name);
  form.set("content", content);
  const response = await fetch(
    `${API_ORIGIN}/api/knowledge-bases/${knowledgeBaseId}/documents`,
    {
      method: "POST",
      headers: authorization(token),
      body: form,
    },
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as {
    document: { id: string; status: "processing" };
  };
}

export async function waitForKnowledgeDocument({
  token,
  knowledgeBaseId,
  documentId,
}: {
  token: string;
  knowledgeBaseId: string;
  documentId: string;
}) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(
      `${API_ORIGIN}/api/knowledge-bases/${knowledgeBaseId}`,
      {
        headers: authorization(token),
        cache: "no-store",
      },
    );
    if (!response.ok) throw await parseError(response);
    const payload = (await response.json()) as {
      documents: Array<{
        id: string;
        status: "processing" | "ready" | "failed";
        errorMessage: string | null;
      }>;
    };
    const document = payload.documents.find((item) => item.id === documentId);
    if (document?.status === "ready") return document;
    if (document?.status === "failed") {
      throw new ApiError(
        document.errorMessage || "知识库索引失败。",
        "KNOWLEDGE_INDEX_FAILED",
        422,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new ApiError(
    "文档已上传，但索引仍在处理中，请稍后到知识库查看。",
    "KNOWLEDGE_INDEX_TIMEOUT",
    202,
  );
}

export function openModelManagement() {
  return chrome.tabs.create({ url: `${API_ORIGIN}/admin` });
}

export function openKnowledgeBaseManagement() {
  return chrome.tabs.create({ url: `${API_ORIGIN}/knowledge` });
}
