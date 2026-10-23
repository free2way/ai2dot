import fs from "node:fs";
import path from "node:path";

export const DEFAULT_CLOUD_URL = "https://dot.ai2note.com";
export const LEGACY_CLOUD_URL = "https://dot.ai2dot.com";
export const DESKTOP_MODES = ["cloud", "local"];
export const DEFAULT_SITES = [
  {
    id: "ai",
    name: "线上版",
    url: "https://ai.ai2dot.com",
  },
  {
    id: "note",
    name: "本地 Docker",
    url: "https://dot.ai2note.com",
  },
];
const MAX_SITES = 10;

export function settingsPath(root) {
  return path.join(root, "desktop-settings.json");
}

export function normalizeServerUrl(value) {
  const url = new URL(String(value).trim());
  const isLoopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "localhost" ||
    url.hostname === "::1";

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error(
      "云端地址必须使用 HTTPS；本机调试可以使用 http://127.0.0.1。",
    );
  }
  if (url.username || url.password) {
    throw new Error("云端地址不能包含用户名或密码。");
  }

  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function normalizeMode(value) {
  return DESKTOP_MODES.includes(value) ? value : "cloud";
}

export function defaultSites() {
  return DEFAULT_SITES.map((site) => ({ ...site }));
}

function normalizeSite(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`第 ${index + 1} 个站点格式不正确。`);
  }

  const name =
    typeof value.name === "string" ? value.name.trim().slice(0, 40) : "";
  if (!name) {
    throw new Error(`第 ${index + 1} 个站点缺少名称。`);
  }

  if (typeof value.url !== "string" || !value.url.trim()) {
    throw new Error(`第 ${index + 1} 个站点缺少地址。`);
  }

  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim().slice(0, 80)
      : `site-${index + 1}`;

  return {
    id,
    name,
    url: normalizeServerUrl(value.url),
  };
}

export function validateSites(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("至少保留一个登录站点。");
  }
  if (value.length > MAX_SITES) {
    throw new Error(`最多支持 ${MAX_SITES} 个登录站点。`);
  }

  const ids = new Set();
  const urls = new Set();

  return value.map((item, index) => {
    const site = normalizeSite(item, index);
    if (urls.has(site.url)) {
      throw new Error(`站点地址重复：${site.url}`);
    }
    let id = site.id;
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    urls.add(site.url);
    return { ...site, id };
  });
}

function normalizeSites(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultSites();
  }

  const sites = [];
  for (const item of value.slice(0, MAX_SITES)) {
    try {
      const site = normalizeSite(item, sites.length);
      if (!sites.some((existing) => existing.url === site.url)) {
        sites.push(site);
      }
    } catch {
      // Skip malformed entries and keep the rest usable.
    }
  }

  return sites.length > 0 ? sites : defaultSites();
}

function migrateLegacyUrl(url) {
  return url === LEGACY_CLOUD_URL ? DEFAULT_CLOUD_URL : url;
}

export function defaultSettings() {
  return {
    version: 3,
    mode: "cloud",
    language: "zh",
    serverUrl: DEFAULT_CLOUD_URL,
    sites: defaultSites(),
  };
}

export function loadSettings(root) {
  const file = settingsPath(root);
  let settings = defaultSettings();

  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const sites = [];
      for (const site of normalizeSites(parsed.sites)) {
        const url = migrateLegacyUrl(site.url);
        if (!sites.some((existing) => existing.url === url)) {
          sites.push({ ...site, url });
        }
      }
      const serverUrl =
        typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()
          ? migrateLegacyUrl(normalizeServerUrl(parsed.serverUrl))
          : settings.serverUrl;

      settings = {
        version: 3,
        mode: normalizeMode(parsed.mode),
        language: parsed.language === "en" ? "en" : "zh",
        serverUrl,
        sites,
      };
    } catch {
      settings = defaultSettings();
    }
  }

  if (process.env.AI2DOT_DESKTOP_MODE?.trim()) {
    settings.mode = normalizeMode(process.env.AI2DOT_DESKTOP_MODE);
  }
  if (process.env.AI2DOT_DESKTOP_SERVER_URL?.trim()) {
    settings.serverUrl = normalizeServerUrl(
      process.env.AI2DOT_DESKTOP_SERVER_URL,
    );
  }

  return settings;
}

export function saveSettings(root, settings) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = settingsPath(root);
  const temporaryFile = `${file}.${process.pid}.tmp`;
  const normalized = {
    version: 3,
    mode: normalizeMode(settings.mode),
    language: settings.language === "en" ? "en" : "zh",
    serverUrl: normalizeServerUrl(settings.serverUrl || DEFAULT_CLOUD_URL),
    sites: settings.sites ? validateSites(settings.sites) : defaultSites(),
  };

  fs.writeFileSync(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryFile, file);
  return normalized;
}
