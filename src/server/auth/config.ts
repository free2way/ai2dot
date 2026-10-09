export type AuthMode = "clerk" | "local" | "disabled";

function hasClerkCredentials() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

export function isClerkConfigured() {
  return process.env.AI2DOT_AUTH_MODE?.toLowerCase() !== "local" &&
    hasClerkCredentials();
}

export function isLocalAuthConfigured() {
  const passwordHash = process.env.AI2DOT_LOCAL_AUTH_PASSWORD_HASH;
  const sessionSecret = process.env.AI2DOT_SESSION_SECRET;
  return Boolean(
    process.env.AI2DOT_LOCAL_AUTH_EMAIL &&
      passwordHash?.startsWith("scrypt$") &&
      sessionSecret &&
      sessionSecret.length >= 32,
  );
}

export function getAuthMode(): AuthMode {
  const requestedMode = process.env.AI2DOT_AUTH_MODE?.toLowerCase();

  if (requestedMode === "local") {
    return isLocalAuthConfigured() ? "local" : "disabled";
  }
  if (requestedMode === "clerk") {
    return hasClerkCredentials() ? "clerk" : "disabled";
  }
  if (isLocalAuthConfigured()) return "local";
  if (hasClerkCredentials()) return "clerk";
  return "disabled";
}

export function isAuthConfigured() {
  return getAuthMode() !== "disabled";
}
