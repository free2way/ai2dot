import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const COMPONENTS = ["desktop", "extension"];
export function assertComponent(value) {
  if (!COMPONENTS.includes(value)) throw new Error("Unknown release component.");
  return value;
}
export function parseVersion(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error("Release versions must have three numeric components.");
  const parts = value.split(".").map(Number);
  if (parts.join(".") !== value || parts.some((part) => !Number.isSafeInteger(part) || part > 65535) || parts.every((part) => part === 0)) {
    throw new Error("Release version is outside the supported range.");
  }
  return parts;
}
export function nextVersion(base, previous) {
  const parts = parseVersion(base);
  if (!previous) return base;
  const last = parseVersion(previous);
  const comparison = parts.reduce((result, part, index) => result || Math.sign(part - last[index]), 0);
  if (comparison > 0) return base;
  for (let index = 2; index >= 0; index -= 1) {
    if (last[index] < 65535) {
      last[index] += 1;
      return last.join(".");
    }
    last[index] = 0;
  }
  throw new Error("Release version space is exhausted.");
}
export function affectsComponent(component, file) {
  assertComponent(component);
  if (/(?:^|\/)(?:__tests__|docs)(?:\/|$)|\.(?:test|spec)\.[^/]+$|\.(?:md|mdx)$/i.test(file)) return false;
  if (file === ".github/workflows/releases.yml" || file.startsWith("scripts/releases/")) return true;
  if (component === "extension") return file.startsWith("extension/");
  return /^(?:desktop|src|public|drizzle)\//.test(file) ||
    /^(?:package(?:-lock)?\.json|next\.config\.[^/]+|tsconfig\.json|postcss\.config\.[^/]+)$/.test(file);
}
export function latestRelease(component, releases) {
  assertComponent(component);
  const pattern = new RegExp(`^${component}-v(\\d+\\.\\d+\\.\\d+)$`);
  return releases.filter((release) => !release.draft && !release.prerelease && pattern.test(release.tag_name))
    .sort((a, b) => Date.parse(b.published_at ?? b.created_at) - Date.parse(a.published_at ?? a.created_at))[0] ?? null;
}
export function reservedVersion(component, releases) {
  assertComponent(component);
  const pattern = new RegExp(`^${component}-v(\\d+\\.\\d+\\.\\d+)$`);
  return releases.map((release) => pattern.exec(release.tag_name)?.[1]).filter(Boolean)
    .sort((a, b) => {
      const left = parseVersion(a), right = parseVersion(b);
      return right.reduce((result, part, index) => result || part - left[index], 0);
    })[0] ?? null;
}
const credentialPattern = /\b(?:[ps]k_(?:test|live)_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npg_[A-Za-z0-9]{12,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
export function assertSafeTree(directory, root = fs.realpathSync(directory)) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (/^(?:\.env(?:\..*)?|\.git|\.codex|\.agents|AGENTS\.md|CLAUDE\.md|TECHNICAL_.*\.md)$/i.test(entry.name) || /\.(?:pem|key)$/i.test(entry.name)) {
      throw new Error("Release tree contains a prohibited configuration or instruction file.");
    }
    if (entry.isSymbolicLink()) {
      const resolved = fs.realpathSync(file);
      if (!resolved.startsWith(`${root}${path.sep}`)) {
        throw new Error("Release tree contains an external symlink.");
      }
    } else if (entry.isDirectory()) assertSafeTree(file, root);
    else if (/\.(?:js|mjs|cjs|json|html|css|txt|map)$/i.test(entry.name)) {
      if (credentialPattern.test(fs.readFileSync(file, "utf8"))) throw new Error("Release tree contains a credential-like value.");
    }
  }
}
export function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
export function writeManifest(directory, component, version, sha, names) {
  assertComponent(component);
  parseVersion(version);
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Release commit must be a full SHA.");
  const files = names.sort().map((name) => {
    if (path.basename(name) !== name || !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("Unsafe asset name.");
    return { name, sha256: sha256(path.join(directory, name)) };
  });
  fs.writeFileSync(path.join(directory, "SHA256SUMS.txt"), files.map((file) => `${file.sha256}  ${file.name}\n`).join(""));
  fs.writeFileSync(path.join(directory, "release-manifest.json"), JSON.stringify({ component, version, sha, files }, null, 2));
}
export function verifyManifest(directory, component, version, sha) {
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, "release-manifest.json"), "utf8"));
  if (metadata.component !== component || metadata.version !== version || metadata.sha !== sha || !Array.isArray(metadata.files)) {
    throw new Error("Release metadata does not match this build.");
  }
  const expected = component === "desktop"
    ? [`ai2dot-${version}-arm64.dmg`, `ai2dot-${version}-arm64.zip`]
    : [`ai2dot-chrome-${version}.zip`];
  if (JSON.stringify(metadata.files.map((file) => file.name).sort()) !== JSON.stringify(expected.sort())) {
    throw new Error("Release asset set is incomplete or unexpected.");
  }
  for (const file of metadata.files) {
    if (fs.lstatSync(path.join(directory, file.name)).isSymbolicLink() || sha256(path.join(directory, file.name)) !== file.sha256) {
      throw new Error("Release asset checksum mismatch.");
    }
  }
  const sums = metadata.files.map((file) => `${file.sha256}  ${file.name}\n`).join("");
  if (fs.readFileSync(path.join(directory, "SHA256SUMS.txt"), "utf8") !== sums) throw new Error("Checksum file mismatch.");
  return [...expected, "SHA256SUMS.txt"];
}
