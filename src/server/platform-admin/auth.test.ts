import { createHash, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashPlatformAdminSessionToken,
  normalizePlatformAdminUsername,
} from "@/server/platform-admin/auth";
import { verifyPlatformAdminPassword } from "@/server/platform-admin/password";

describe("platform administrator authentication", () => {
  it("normalizes administrator usernames", () => {
    expect(normalizePlatformAdminUsername("  Admin@Local ")).toBe(
      "admin@local",
    );
  });

  it("stores only a one-way session token hash", () => {
    const token = "a-private-session-token";
    const expected = createHash("sha256").update(token).digest("hex");

    expect(hashPlatformAdminSessionToken(token)).toBe(expected);
    expect(hashPlatformAdminSessionToken(token)).not.toContain(token);
  });

  it("validates scrypt password hashes", () => {
    const salt = Buffer.from("platform-admin-test-salt");
    const digest = scryptSync("correct-password", salt, 32, {
      N: 16_384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const encoded = `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;

    expect(verifyPlatformAdminPassword("correct-password", encoded)).toBe(true);
    expect(verifyPlatformAdminPassword("wrong-password", encoded)).toBe(false);
  });
});
