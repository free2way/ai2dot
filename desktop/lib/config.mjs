import { createHmac, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DEFAULT_SESSION_TTL_MS = 168 * 60 * 60 * 1_000;
const CONFIG_VERSION = 1;

export const APP_NAME = "ai2dot";

export function defaultAppSupportDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      APP_NAME,
    );
  }
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    APP_NAME,
  );
}

export function getPaths(root = defaultAppSupportDir()) {
  return {
    root,
    configFile: path.join(root, "desktop-config.json"),
    settingsFile: path.join(root, "desktop-settings.json"),
    dataDir: path.join(root, "data"),
    logsDir: path.join(root, "logs"),
    serverLog: path.join(root, "logs", "server.log"),
  };
}

export function hashLocalPassword(password, salt = randomBytes(16)) {
  const digest = scryptSync(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_OPTIONS,
  );
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export function createSessionToken({
  email,
  secret,
  ttlMs = DEFAULT_SESSION_TTL_MS,
  now = Date.now(),
}) {
  const payload = {
    version: 1,
    subject: `local:${email.trim().toLowerCase()}`,
    email: email.trim().toLowerCase(),
    expiresAt: now + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
  };
}

function createConfig() {
  const password = randomBytes(18).toString("base64url");

  return {
    version: CONFIG_VERSION,
    email: `local@${APP_NAME}.desktop`,
    passwordHash: hashLocalPassword(password),
    sessionSecret: randomBytes(48).toString("base64url"),
    providerSecretKey: randomBytes(32).toString("base64"),
    toolApprovalSecret: randomBytes(32).toString("base64url"),
    createdAt: new Date().toISOString(),
  };
}

function writeConfig(configFile, config) {
  const temporaryFile = `${configFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryFile, configFile);
}

const REQUIRED_CONFIG_FIELDS = [
  "email",
  "passwordHash",
  "sessionSecret",
  "providerSecretKey",
  "toolApprovalSecret",
  "createdAt",
];

function normalizeConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("desktop-config.json is not a JSON object.");
  }
  if (value.version !== CONFIG_VERSION) {
    throw new Error(
      `Unsupported desktop-config.json version: ${String(value.version)}.`,
    );
  }

  const missing = REQUIRED_CONFIG_FIELDS.filter(
    (key) => typeof value[key] !== "string" || value[key].length === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `desktop-config.json is missing required fields: ${missing.join(", ")}. ` +
        "Restore the file from a backup instead of deleting it, otherwise encrypted provider keys cannot be decrypted.",
    );
  }

  // Older builds persisted the plaintext password. Keep only the hash and
  // drop the legacy field on the next write.
  const changed = Object.hasOwn(value, "password");
  if (changed) delete value.password;
  return { config: value, changed };
}

export function loadOrCreateConfig(root = defaultAppSupportDir()) {
  const paths = getPaths(root);
  fs.mkdirSync(path.join(root, "data"), { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.logsDir, { recursive: true, mode: 0o700 });

  if (!fs.existsSync(paths.configFile)) {
    const config = createConfig();
    writeConfig(paths.configFile, config);
    return config;
  }

  const raw = fs.readFileSync(paths.configFile, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Unable to parse ${paths.configFile}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const { config, changed } = normalizeConfig(parsed);
  fs.chmodSync(paths.configFile, 0o600);
  if (changed) writeConfig(paths.configFile, config);
  return config;
}

export function resetLocalPassword(root = defaultAppSupportDir()) {
  const paths = getPaths(root);
  const config = loadOrCreateConfig(root);
  const password = randomBytes(18).toString("base64url");
  const updated = {
    ...config,
    passwordHash: hashLocalPassword(password),
    updatedAt: new Date().toISOString(),
  };
  writeConfig(paths.configFile, updated);
  return { config: updated, password };
}
