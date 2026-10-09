import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage: node scripts/hash-password.mjs '<password-at-least-12-chars>'");
  process.exit(1);
}

const salt = randomBytes(16);
const digest = scryptSync(password, salt, 32, {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
process.stdout.write(
  `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}\n`,
);
