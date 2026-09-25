import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { ExtractedPage } from "~/lib/types";

export type CapturedDocument = {
  title: string;
  url: string;
  language: string | null;
  html: string;
  selectionHtml: string | null;
  metadata: {
    canonicalUrl: string | null;
    siteName: string | null;
    author: string | null;
    publishedAt: string | null;
    description: string | null;
  };
};

function captureDocument(): CapturedDocument {
  const root = document.documentElement.cloneNode(true) as HTMLElement;
  root
    .querySelectorAll(
      "script,style,noscript,template,input,textarea,select,option,button,[hidden],[aria-hidden='true']",
    )
    .forEach((node) => node.remove());

  const selection = window.getSelection();
  let selectionHtml: string | null = null;
  if (selection && !selection.isCollapsed && selection.toString().trim().length >= 20) {
    const container = document.createElement("div");
    for (let index = 0; index < selection.rangeCount; index += 1) {
      container.append(selection.getRangeAt(index).cloneContents());
    }
    selectionHtml = container.innerHTML;
  }

  const meta = (selector: string) =>
    document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || null;

  return {
    title: document.title.trim() || location.hostname,
    url: location.href,
    language: document.documentElement.lang || null,
    html: root.outerHTML.slice(0, 1_000_000),
    selectionHtml,
    metadata: {
      canonicalUrl:
        document.querySelector<HTMLLinkElement>("link[rel='canonical']")?.href ||
        null,
      siteName: meta("meta[property='og:site_name']"),
      author: meta("meta[name='author']"),
      publishedAt:
        meta("meta[property='article:published_time']") ||
        meta("meta[name='date']"),
      description:
        meta("meta[name='description']") || meta("meta[property='og:description']"),
    },
  };
}

function absolutizeUrls(documentNode: Document, pageUrl: string) {
  documentNode.querySelectorAll<HTMLElement>("a[href], img[src]").forEach((node) => {
    const attribute = node.tagName === "A" ? "href" : "src";
    const value = node.getAttribute(attribute);
    if (!value || value.startsWith("data:")) return;
    try {
      node.setAttribute(attribute, new URL(value, pageUrl).toString());
    } catch {
      node.removeAttribute(attribute);
    }
  });
}

function normalizeMarkdown(markdown: string) {
  return markdown
    .replaceAll("\u0000", "")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function extractCurrentPage(
  maxCharacters: number,
): Promise<ExtractedPage> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error("当前页面不允许扩展读取，请打开普通 HTTP 或 HTTPS 页面。");
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: captureDocument,
  });
  const captured = result?.result as CapturedDocument | undefined;
  if (!captured) throw new Error("未能读取当前页面内容。");

  return extractCapturedPage(captured, maxCharacters);
}

export function extractCapturedPage(
  captured: CapturedDocument,
  maxCharacters: number,
): ExtractedPage {

  const parser = new DOMParser();
  const pageDocument = parser.parseFromString(captured.html, "text/html");
  absolutizeUrls(pageDocument, captured.url);

  const article = new Readability(pageDocument, { charThreshold: 20 }).parse();
  const sourceHtml =
    captured.selectionHtml || article?.content || pageDocument.body.innerHTML;
  const sourceDocument = parser.parseFromString(sourceHtml, "text/html");
  absolutizeUrls(sourceDocument, captured.url);

  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    headingStyle: "atx",
  });
  turndown.use(gfm);
  turndown.remove(["script", "style", "form", "button"]);

  const markdown = normalizeMarkdown(
    turndown.turndown(sourceDocument.body.innerHTML),
  );
  if (markdown.length < 20) {
    throw new Error("当前页面没有提取到足够的正文内容。");
  }
  if (markdown.length > maxCharacters) {
    throw new Error(
      `页面正文超过 ${maxCharacters.toLocaleString()} 字符，请选中重点内容后重试。`,
    );
  }

  return {
    version: 1,
    mode: captured.selectionHtml
      ? "selection"
      : article?.content
        ? "article"
        : "fallback",
    title: article?.title?.trim() || captured.title,
    url: captured.url,
    canonicalUrl: captured.metadata.canonicalUrl,
    siteName: article?.siteName || captured.metadata.siteName,
    author: article?.byline || captured.metadata.author,
    publishedAt: captured.metadata.publishedAt,
    language: article?.lang || captured.language,
    excerpt: article?.excerpt || captured.metadata.description,
    markdown,
    characterCount: markdown.length,
    extractedAt: new Date().toISOString(),
  };
}

function yamlString(value: string) {
  return JSON.stringify(value.replaceAll("\u0000", ""));
}

export function composeMarkdownDocument(
  page: ExtractedPage,
  summary: string,
  modelName: string,
) {
  const metadata = [
    "---",
    `title: ${yamlString(page.title)}`,
    `source: ${yamlString(page.canonicalUrl || page.url)}`,
    ...(page.siteName ? [`site: ${yamlString(page.siteName)}`] : []),
    ...(page.author ? [`author: ${yamlString(page.author)}`] : []),
    `captured_at: ${yamlString(page.extractedAt)}`,
    `summary_model: ${yamlString(modelName)}`,
    "---",
  ];
  return `${metadata.join("\n")}\n\n# ${page.title}\n\n${summary.trim()}\n\n## 来源\n\n- [原始页面](${page.canonicalUrl || page.url})\n`;
}

export function markdownFileName(title: string) {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${cleaned || `web-capture-${Date.now()}`}.md`;
}
