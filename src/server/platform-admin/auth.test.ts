import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashPlatformAdminSessionToken,
  normalizePlatformAdminUsername,
} from "@/server/platform-admin/auth";

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
});
