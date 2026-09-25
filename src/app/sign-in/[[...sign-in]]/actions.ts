"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocalAuthConfigured } from "@/server/auth/config";
import {
  createLocalSession,
  verifyLocalPassword,
} from "@/server/auth/local";

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1_024),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_ATTEMPT_LIMIT = 10;
const globalAuthState = globalThis as typeof globalThis & {
  ai2dotLoginAttempts?: Map<string, { count: number; resetAt: number }>;
};
const loginAttempts =
  globalAuthState.ai2dotLoginAttempts ??
  (globalAuthState.ai2dotLoginAttempts = new Map());

function consumeLoginAttempt(key: string, now = Date.now()) {
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (current.count >= LOGIN_ATTEMPT_LIMIT) return false;
  current.count += 1;
  return true;
}

export async function signInLocally(formData: FormData) {
  if (!isLocalAuthConfigured()) redirect("/sign-in?error=configuration");

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0];
  const attemptKey = forwardedFor?.trim() || "unknown";
  if (!consumeLoginAttempt(attemptKey)) {
    redirect("/sign-in?error=rate-limit");
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const configuredEmail = process.env.AI2DOT_LOCAL_AUTH_EMAIL
    ?.trim()
    .toLowerCase();
  const configuredHash = process.env.AI2DOT_LOCAL_AUTH_PASSWORD_HASH ?? "";
  const password = parsed.success ? parsed.data.password : "invalid-password";
  const passwordValid = verifyLocalPassword(password, configuredHash);
  const emailValid =
    parsed.success && parsed.data.email.trim().toLowerCase() === configuredEmail;

  if (!emailValid || !passwordValid || !configuredEmail) {
    redirect("/sign-in?error=invalid");
  }

  loginAttempts.delete(attemptKey);
  await createLocalSession(configuredEmail);
  redirect("/workspace");
}
