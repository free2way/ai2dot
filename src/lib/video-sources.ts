export type VideoPlatform = "youtube" | "bilibili";

export type ParsedVideoUrl = {
  platform: VideoPlatform;
  externalId: string;
  sourceUrl: string;
  canonicalUrl: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const BILIBILI_ID = /^(BV[A-Za-z0-9]+|av\d+)$/i;

export function parseVideoUrl(input: string): ParsedVideoUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!YOUTUBE_ID.test(id)) return null;
    return {
      platform: "youtube",
      externalId: id,
      sourceUrl: url.toString(),
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v") ?? ""
        : ["shorts", "embed", "live"].includes(segments[0] ?? "")
          ? segments[1] ?? ""
          : "";
    if (!YOUTUBE_ID.test(id)) return null;
    return {
      platform: "youtube",
      externalId: id,
      sourceUrl: url.toString(),
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }

  if (hostname === "bilibili.com" || hostname === "m.bilibili.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const videoIndex = segments.findIndex((segment) => segment.toLowerCase() === "video");
    const id = videoIndex >= 0 ? segments[videoIndex + 1] ?? "" : "";
    if (!BILIBILI_ID.test(id)) return null;
    const normalizedId = id.startsWith("av") ? id.toLowerCase() : id;
    return {
      platform: "bilibili",
      externalId: normalizedId,
      sourceUrl: url.toString(),
      canonicalUrl: `https://www.bilibili.com/video/${normalizedId}`,
    };
  }
  return null;
}

function formatTimestamp(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) return normalized;
  const seconds = Math.floor(Number(parts.at(-1)));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) return normalized;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function cleanCaptionText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]+}/g, "")
    .replace(/\\N/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeVideoTranscript(source: string) {
  const text = source.replaceAll("\u0000", "").replaceAll("\r\n", "\n").trim();
  if (!text) return "";

  const assLines = text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("Dialogue:"))
    .map((line) => {
      const fields = line.slice(line.indexOf(":") + 1).split(",");
      if (fields.length < 10) return "";
      const content = cleanCaptionText(fields.slice(9).join(","));
      return content ? `[${formatTimestamp(fields[1])}] ${content}` : "";
    })
    .filter(Boolean);
  if (assLines.length > 0) return assLines.join("\n");

  const blocks = text
    .replace(/^WEBVTT[^\n]*\n+/i, "")
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean));
  const captionLines = blocks
    .map((lines) => {
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) return "";
      const start = lines[timingIndex].split("-->", 1)[0];
      const content = cleanCaptionText(lines.slice(timingIndex + 1).join(" "));
      return content ? `[${formatTimestamp(start)}] ${content}` : "";
    })
    .filter(Boolean);
  if (captionLines.length > 0) return captionLines.join("\n");

  return text.replace(/\n{3,}/g, "\n\n");
}

export function buildVideoKnowledgeMarkdown(input: {
  platform: VideoPlatform;
  title: string;
  authorName?: string | null;
  canonicalUrl: string;
  language?: string;
  transcript: string;
}) {
  const platformName = input.platform === "youtube" ? "YouTube" : "Bilibili";
  return [
    `# ${input.title}`,
    "",
    `- 平台：${platformName}`,
    input.authorName ? `- 作者：${input.authorName}` : "",
    `- 原始地址：${input.canonicalUrl}`,
    input.language ? `- 字幕语言：${input.language}` : "",
    "",
    "## 字幕与逐字稿",
    "",
    input.transcript,
  ]
    .filter((line, index, lines) => line || lines[index - 1] !== "")
    .join("\n")
    .trim();
}
