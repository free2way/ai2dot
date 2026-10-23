import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { clearDrafts, migrateSiteCookies, readDraft, sitePartition, writeDraft } from "./workspace-storage.mjs";
const roots = [];
const root = () => { const value = fs.mkdtempSync(path.join(os.tmpdir(), "ai2dot-drafts-")); roots.push(value); return value; };
afterEach(() => { for (const value of roots.splice(0)) fs.rmSync(value, { recursive: true, force: true }); });
it("isolates sessions by origin and migrates matching cookies only once", async () => {
  const directory = root();
  expect(sitePartition("https://one.example/workspace")).toBe(sitePartition("https://one.example"));
  expect(sitePartition("https://one.example")).not.toBe(sitePartition("https://two.example"));
  const legacy = { cookies: { get: async () => [
    { name: "session", value: "one", domain: "one.example", path: "/", hostOnly: true, session: true },
    { name: "session", value: "two", domain: "two.example", path: "/" },
  ] } };
  const target = { cookies: { set: vi.fn(async () => {}) } };
  await migrateSiteCookies(directory, "https://one.example", legacy, target);
  await migrateSiteCookies(directory, "https://one.example", legacy, target);
  expect(target.cookies.set).toHaveBeenCalledOnce();
  expect(target.cookies.set).toHaveBeenCalledWith({ url: "https://one.example", name: "session", value: "one", domain: "one.example", path: "/" });
});
it("keeps drafts private to their site and identity and clears only the signed-out site", () => {
  const directory = root();
  const key = "ai2dot.chat.draft.v1:user:new:default";
  const value = JSON.stringify({ savedAt: Date.now(), input: "private text" });
  writeDraft(directory, "https://one.example", key, value);
  writeDraft(directory, "https://two.example", key, value);
  expect(readDraft(directory, "https://one.example", key)).toBe(value);
  expect(readDraft(directory, "https://one.example", key.replace("user", "other"))).toBeNull();
  expect(() => writeDraft(directory, "https://one.example", "../../secret", value)).toThrow();
  expect(() => writeDraft(directory, "https://one.example", key, "x".repeat(500001))).toThrow();
  clearDrafts(directory, "https://one.example");
  expect(readDraft(directory, "https://one.example", key)).toBeNull();
  expect(readDraft(directory, "https://two.example", key)).toBe(value);
  const siteDirectory = fs.readdirSync(path.join(directory, "drafts"))[0];
  const file = path.join(directory, "drafts", siteDirectory, fs.readdirSync(path.join(directory, "drafts", siteDirectory))[0]);
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});
it("expires drafts after a day", () => {
  const directory = root();
  const key = "ai2dot.chat.draft.v1:user:new:default";
  writeDraft(directory, "local", key, JSON.stringify({ savedAt: Date.now() - 86400001 }));
  expect(readDraft(directory, "local", key)).toBeNull();
});
