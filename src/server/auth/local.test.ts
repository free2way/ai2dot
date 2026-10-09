import { describe, expect, it } from "vitest";
import {
  createLocalSessionToken,
  hashLocalPassword,
  verifyLocalPassword,
  verifyLocalSessionToken,
} from "@/server/auth/local";

describe("local authentication", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const hash = hashLocalPassword("fixture-password", Buffer.alloc(16, 7));

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("fixture-password");
    expect(verifyLocalPassword("fixture-password", hash)).toBe(true);
    expect(verifyLocalPassword("wrong password", hash)).toBe(false);
  });

  it("signs sessions and rejects tampered or expired tokens", () => {
    const secret = "a".repeat(48);
    const now = Date.UTC(2026, 8, 20);
    const token = createLocalSessionToken("fixture-user", secret, now);

    expect(verifyLocalSessionToken(token, secret, now)?.email).toBe(
      "fixture-user",
    );
    expect(verifyLocalSessionToken(`${token}x`, secret, now)).toBeNull();
    expect(
      verifyLocalSessionToken(token, secret, now + 8 * 24 * 60 * 60 * 1_000),
    ).toBeNull();
  });
});
