import "server-only";

import { parseVideoUrl, type ParsedVideoUrl } from "@/lib/video-sources";

export type VideoMetadata = ParsedVideoUrl & {
  title: string;
  authorName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
};

const FETCH_TIMEOUT_MS = 8_000;
const B23_SLUG = /^[A-Za-z0-9_-]{2,32}$/;

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function readMeta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

async function resolveShortBilibiliUrl(input: string) {
  const url = new URL(input.trim());
  if (url.hostname.toLowerCase() !== "b23.tv") return input;
  const slug = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!B23_SLUG.test(slug)) throw new Error("Bilibili 短链接格式不正确。");

  const response = await fetch(`https://b23.tv/${slug}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "user-agent": "ai2dot-video-import/1.0" },
  });
  const location = response.headers.get("location");
  if (!location) throw new Error("无法展开 Bilibili 短链接，请粘贴完整视频地址。");
  const resolved = new URL(location, "https://b23.tv").toString();
  if (!parseVideoUrl(resolved)) throw new Error("Bilibili 短链接没有指向受支持的视频。");
  return resolved;
}

async function inspectYouTube(parsed: ParsedVideoUrl): Promise<VideoMetadata> {
  try {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", parsed.canonicalUrl);
    endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": "ai2dot-video-import/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    return {
      ...parsed,
      title: typeof payload.title === "string" ? payload.title.slice(0, 300) : `YouTube 视频 ${parsed.externalId}`,
      authorName: typeof payload.author_name === "string" ? payload.author_name.slice(0, 200) : null,
      thumbnailUrl: typeof payload.thumbnail_url === "string" ? payload.thumbnail_url : null,
      durationSeconds: null,
      metadata: { provider: "youtube-oembed" },
    };
  } catch (error) {
    return {
      ...parsed,
      title: `YouTube 视频 ${parsed.externalId}`,
      authorName: null,
      thumbnailUrl: null,
      durationSeconds: null,
      metadata: {
        provider: "fallback",
        metadataError: error instanceof Error ? error.message.slice(0, 200) : "unavailable",
      },
    };
  }
}

async function inspectBilibili(parsed: ParsedVideoUrl): Promise<VideoMetadata> {
  try {
    const response = await fetch(parsed.canonicalUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html",
        "user-agent": "Mozilla/5.0 (compatible; ai2dot-video-import/1.0)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 4 * 1024 * 1024) throw new Error("metadata response too large");
    const html = (await response.text()).slice(0, 2_000_000);
    const rawTitle = readMeta(html, "og:title");
    const title = rawTitle
      ?.replace(/_哔哩哔哩_bilibili$/i, "")
      .replace(/-哔哩哔哩.*$/i, "")
      .trim();
    return {
      ...parsed,
      title: title?.slice(0, 300) || `Bilibili 视频 ${parsed.externalId}`,
      authorName: readMeta(html, "author")?.slice(0, 200) ?? null,
      thumbnailUrl: readMeta(html, "og:image"),
      durationSeconds: null,
      metadata: { provider: "bilibili-page-metadata" },
    };
  } catch (error) {
    return {
      ...parsed,
      title: `Bilibili 视频 ${parsed.externalId}`,
      authorName: null,
      thumbnailUrl: null,
      durationSeconds: null,
      metadata: {
        provider: "fallback",
        metadataError: error instanceof Error ? error.message.slice(0, 200) : "unavailable",
      },
    };
  }
}

export async function inspectVideoUrl(input: string) {
  let resolvedInput = input.trim();
  try {
    resolvedInput = await resolveShortBilibiliUrl(resolvedInput);
  } catch (error) {
    if (new URL(resolvedInput).hostname.toLowerCase() === "b23.tv") throw error;
  }
  const parsed = parseVideoUrl(resolvedInput);
  if (!parsed) throw new Error("仅支持 YouTube 和 Bilibili 视频地址。");
  return parsed.platform === "youtube" ? inspectYouTube(parsed) : inspectBilibili(parsed);
}
