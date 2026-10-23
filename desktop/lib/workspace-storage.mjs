import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(value).digest("hex");
export function sitePartition(url) {
  return `persist:ai2dot-cloud-${digest(new URL(url).origin).slice(0, 24)}`;
}
function draftDirectory(root, site) { return path.join(root, "drafts", digest(site)); }
function draftPath(root, site, key) {
  if (typeof key !== "string" || !key.startsWith("ai2dot.chat.draft.v1:") || key.length > 1000) throw new Error("Invalid draft key");
  return path.join(draftDirectory(root, site), `${digest(key)}.json`);
}
export function readDraft(root, site, key) {
  const file = draftPath(root, site, key);
  try {
    const value = fs.readFileSync(file, "utf8");
    const { savedAt } = JSON.parse(value);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > 86400000 || savedAt > Date.now()) {
      fs.rmSync(file, { force: true });
      return null;
    }
    return value;
  } catch { return null; }
}
export function writeDraft(root, site, key, value) {
  const file = draftPath(root, site, key);
  if (value === null) { fs.rmSync(file, { force: true }); return; }
  if (typeof value !== "string" || Buffer.byteLength(value) > 500000) throw new Error("Draft is too large");
  const parsed = JSON.parse(value);
  if (!Number.isFinite(parsed.savedAt)) throw new Error("Invalid draft");
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // Discard expired drafts and bound storage per site.
  const files = fs.readdirSync(path.dirname(file)).filter((name) => name.endsWith(".json"));
  for (const name of files) {
    const entry = path.join(path.dirname(file), name);
    if (Date.now() - fs.statSync(entry).mtimeMs > 86400000) fs.rmSync(entry, { force: true });
  }
  if (!fs.existsSync(file) && fs.readdirSync(path.dirname(file)).length >= 200) throw new Error("Draft storage is full");
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, value, { mode: 0o600 });
  fs.renameSync(temporary, file);
}
export function clearDrafts(root, site) {
  fs.rmSync(draftDirectory(root, site), { recursive: true, force: true });
}

export async function migrateSiteCookies(root, url, legacy, target) {
  const marker = path.join(root, `session-migrated-${digest(new URL(url).origin).slice(0, 24)}`);
  if (fs.existsSync(marker)) return;
  const hostname = new URL(url).hostname;
  for (const cookie of await legacy.cookies.get({ url })) {
    const domain = cookie.domain?.replace(/^\./, "");
    if (!domain || !(hostname === domain || hostname.endsWith(`.${domain}`))) continue;
    const { hostOnly, session, ...details } = cookie;
    void hostOnly; void session;
    await target.cookies.set({ ...details, url });
  }
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(marker, "1", { mode: 0o600 });
}
