import "server-only";

import { scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export function verifyPlatformAdminPassword(
  password: string,
  encodedHash: string,
) {
  const [algorithm, encodedSalt, encodedDigest] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedDigest) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedDigest, "base64url");
    const actual = scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
