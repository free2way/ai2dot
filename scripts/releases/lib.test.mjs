import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { affectsComponent, assertSafeTree, latestRelease, nextVersion, reservedVersion, verifyManifest, writeManifest } from "./lib.mjs";

const directories = [];
function temp() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai2dot-release-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
describe("component release planning", () => {
  it("increments from the last published version without committing version bumps", () => {
    expect(nextVersion("0.2.1", "0.2.1")).toBe("0.2.2");
    expect(nextVersion("0.2.1", "0.2.5")).toBe("0.2.6");
    expect(nextVersion("0.3.0", "0.2.5")).toBe("0.3.0");
    expect(nextVersion("0.1.0", null)).toBe("0.1.0");
  });
  it("respects Chrome numeric version limits", () => {
    expect(nextVersion("0.1.0", "0.1.65535")).toBe("0.2.0");
    expect(() => nextVersion("1.0.0-beta", null)).toThrow();
    expect(() => nextVersion("0.0.0", null)).toThrow();
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
    expect(nextVersion("0.2.1", reservedVersion("desktop", releases))).toBe("0.2.3");
  });
});
describe("release asset safety", () => {
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
