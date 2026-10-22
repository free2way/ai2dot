import fs from "node:fs";
import path from "node:path";

export const DEFAULT_CLOUD_URL = "https://dot.ai2dot.com";
export const DESKTOP_MODES = ["cloud", "local"];

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

export function defaultSettings() {
  return {
    version: 1,
    mode: "cloud",
    serverUrl: DEFAULT_CLOUD_URL,
  };
}

export function loadSettings(root) {
  const file = settingsPath(root);
  let settings = defaultSettings();

  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      settings = {
        version: 1,
        mode: normalizeMode(parsed.mode),
        serverUrl:
          typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()
            ? normalizeServerUrl(parsed.serverUrl)
            : settings.serverUrl,
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
    version: 1,
    mode: normalizeMode(settings.mode),
    serverUrl: normalizeServerUrl(settings.serverUrl || DEFAULT_CLOUD_URL),
  };

  fs.writeFileSync(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryFile, file);
  return normalized;
}
