import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { affectsComponent, assertSafeTree, findGithubRelease, latestRelease, reservedVersion, verifyManifest, versionForRun, writeManifest } from "./lib.mjs";

const directories = [];
function temp() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai2dot-release-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
describe("component release planning", () => {
  it("uses unique monotonic build versions without needing draft visibility", () => {
    expect(versionForRun("0.2.1", 1)).toBe("0.2.2");
    expect(versionForRun("0.2.1", 2)).toBe("0.2.3");
    expect(versionForRun("0.2.1", 3)).toBe("0.2.4");
    expect(versionForRun("0.1.0", 3)).toBe("0.1.3");
    expect(versionForRun("0.2.1", 3)).toBe(versionForRun("0.2.1", 3));
  });
  it("respects Chrome numeric version limits", () => {
    expect(versionForRun("0.1.65535", 1)).toBe("0.2.0");
    expect(() => versionForRun("1.0.0-beta", 1)).toThrow();
    expect(() => versionForRun("0.0.0", 1)).toThrow();
    expect(() => versionForRun("0.1.0", 0)).toThrow();
  });
  it("ignores documentation and tests but includes shared web runtime changes for desktop", () => {
    expect(affectsComponent("desktop", "src/app/api/chat/route.ts")).toBe(true);
    expect(affectsComponent("desktop", "desktop/main.test.mjs")).toBe(false);
    expect(affectsComponent("desktop", "README.md")).toBe(false);
    expect(affectsComponent("extension", "extension/sidepanel.tsx")).toBe(true);
    expect(affectsComponent("extension", "src/app/api/chat/route.ts")).toBe(false);
    expect(affectsComponent("extension", "extension/lib/auth-config.test.ts")).toBe(false);
    expect(affectsComponent("extension", ".github/workflows/releases.yml")).toBe(true);
  });
  it("keeps component histories separate and excludes drafts and prereleases", () => {
    const releases = [
      { tag_name: "desktop-v0.2.1", published_at: "2026-01-01" },
      { tag_name: "extension-v0.1.0", published_at: "2026-02-01" },
      { tag_name: "desktop-v0.2.2", draft: true, published_at: "2026-03-01" },
    ];
    expect(latestRelease("desktop", releases).tag_name).toBe("desktop-v0.2.1");
    expect(reservedVersion("desktop", releases)).toBe("0.2.2");
  });
  it("keeps planning and package-installing jobs read-only", () => {
    const workflow = fs.readFileSync(new URL("../../.github/workflows/releases.yml", import.meta.url), "utf8");
    const beforePublishing = workflow.slice(0, workflow.indexOf("  publish-extension:"));
    expect(beforePublishing).not.toMatch(/contents:\s*write/);
    expect(beforePublishing).toMatch(/contents:\s*read/);
  });
});
describe("release asset safety", () => {
  it("loads draft assets by release ID instead of the published-only tag endpoint", () => {
    const calls = [];
    const draft = { id: 123, draft: true, assets: [] };
    const result = findGithubRelease("owner/repo", "extension-v0.1.0", (args) => {
      expect(args).toContain("databaseId");
      return { status: 0, stdout: JSON.stringify({ databaseId: 123 }) };
    }, (...args) => { calls.push(args); return JSON.stringify(draft); });
    expect(result).toEqual(draft);
    expect(calls).toEqual([["api", "repos/owner/repo/releases/123"]]);
  });
  it("rejects configuration and credential files before packing", () => {
    const directory = temp();
    fs.writeFileSync(path.join(directory, ".env.local"), "fixture");
    expect(() => assertSafeTree(directory)).toThrow("prohibited");
  });
  it("verifies exact assets and checksums and detects tampering", () => {
    const directory = temp();
    const name = "ai2dot-chrome-0.1.0.zip";
    const sha = "a".repeat(40);
    fs.writeFileSync(path.join(directory, name), "fixture archive");
    writeManifest(directory, "extension", "0.1.0", sha, [name]);
    expect(verifyManifest(directory, "extension", "0.1.0", sha)).toEqual([name, "SHA256SUMS.txt"]);
    fs.writeFileSync(path.join(directory, name), "tampered archive");
    expect(() => verifyManifest(directory, "extension", "0.1.0", sha)).toThrow("checksum");
  });
});
