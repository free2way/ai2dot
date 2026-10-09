import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ai2dot_session";
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

type LocalSessionPayload = {
  version: 1;
  subject: string;
  email: string;
  expiresAt: number;
};

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionLifetimeMs() {
  const configuredHours = Number(process.env.AI2DOT_SESSION_TTL_HOURS);
  const hours = Number.isInteger(configuredHours)
    ? Math.min(Math.max(configuredHours, 1), 720)
    : 168;
  return hours * 60 * 60 * 1_000;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function hashLocalPassword(
  password: string,
  salt = randomBytes(16),
) {
  const digest = scryptSync(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_OPTIONS,
  );
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export function verifyLocalPassword(password: string, encodedHash: string) {
  const [algorithm, encodedSalt, encodedDigest] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedDigest) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedDigest, "base64url");
    const actual = scryptSync(
      password,
      salt,
      expected.length,
      SCRYPT_OPTIONS,
    );
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createLocalSessionToken(
  email: string,
  secret: string,
  now = Date.now(),
) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload: LocalSessionPayload = {
    version: 1,
    subject: `local:${normalizedEmail}`,
    email: normalizedEmail,
    expiresAt: now + sessionLifetimeMs(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyLocalSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
) {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) return null;

  const expectedSignature = Buffer.from(sign(encodedPayload, secret));
  const actualSignature = Buffer.from(encodedSignature);
  if (!safeEqual(actualSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as LocalSessionPayload;
    if (
      payload.version !== 1 ||
      typeof payload.subject !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createLocalSession(email: string) {
  const secret = process.env.AI2DOT_SESSION_SECRET;
  if (!secret) throw new Error("AI2DOT_SESSION_SECRET is not configured.");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createLocalSessionToken(email, secret), {
    httpOnly: true,
    maxAge: Math.floor(sessionLifetimeMs() / 1_000),
    path: "/",
    sameSite: "lax",
    secure: process.env.AI2DOT_COOKIE_SECURE === "true",
  });
}

export async function clearLocalSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.AI2DOT_COOKIE_SECURE === "true",
  });
}

export async function getLocalSessionIdentity() {
  const secret = process.env.AI2DOT_SESSION_SECRET;
  if (!secret) return null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyLocalSessionToken(token, secret);
  return payload
    ? {
        externalAuthId: payload.subject,
        displayName: payload.email.split("@")[0] || payload.email,
      }
    : null;
}
