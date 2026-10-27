const CONFIG_KEY = "ai2dot.public-auth.v1";

export function normalizePublishableKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(key);
  if (!match || key.length > 1024) return null;
  try {
    const host = atob(match[1].replaceAll("-", "+").replaceAll("_", "/"));
    return /^[A-Za-z0-9.-]+\$$/.test(host) && host.includes(".") ? key : null;
  } catch { return null; }
}

export async function loadPublicAuthKey() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  return normalizePublishableKey(stored[CONFIG_KEY]);
}

export async function savePublicAuthKey(value: unknown) {
  const key = normalizePublishableKey(value);
  if (!key) throw new Error("请输入有效的 Clerk Publishable Key，不能使用服务端 Secret Key。");
  await chrome.storage.local.set({ [CONFIG_KEY]: key });
  return key;
}
