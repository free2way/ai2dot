import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (typeof address !== "object" || !address) {
        server.close();
        reject(new Error("Unable to allocate a local port."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

export function buildServerEnv({ config, paths, port, version = "" }) {
  return {
    // Minimal allowlist: never inherit shell secrets or deployment variables.
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: process.env.HOME || paths.root,
    USER: process.env.USER || "",
    TMPDIR: process.env.TMPDIR || os.tmpdir(),
    LANG: process.env.LANG || "en_US.UTF-8",

    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",

    AI2DOT_APP_VERSION: version,
    AI2DOT_DESKTOP: "1",
    AI2DOT_DESKTOP_DATA_DIR: paths.dataDir,
    AI2DOT_AUTH_MODE: "local",
    AI2DOT_LOCAL_AUTH_EMAIL: config.email,
    AI2DOT_LOCAL_AUTH_PASSWORD_HASH: config.passwordHash,
    AI2DOT_SESSION_SECRET: config.sessionSecret,
    AI2DOT_SESSION_TTL_HOURS: "168",
    AI2DOT_COOKIE_SECURE: "false",
    AI2DOT_CHAT_RATE_LIMIT_PER_MINUTE: "300",
    PROVIDER_SECRET_ENCRYPTION_KEY: config.providerSecretKey,
    AI2DOT_TOOL_APPROVAL_SECRET: config.toolApprovalSecret,

    // Web-only integrations are explicitly disabled.
    DATABASE_URL: "",
    DATABASE_URL_UNPOOLED: "",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
    AI_GATEWAY_API_KEY: "",
    VERCEL_OIDC_TOKEN: "",
    BLOB_READ_WRITE_TOKEN: "",
    CRON_SECRET: "",
  };
}

export function startServer({ appRoot, env, logFile, label = "server" }) {
  const entry = path.join(appRoot, "desktop-start.mjs");
  if (!fs.existsSync(entry)) {
    throw new Error(`Desktop server entry not found: ${entry}`);
  }

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const stream = fs.createWriteStream(logFile, { flags: "a", mode: 0o600 });
  stream.write(
    `\n[${new Date().toISOString()}] starting ${label} from ${appRoot}\n`,
  );

  const child = spawn(process.execPath, [entry], {
    cwd: appRoot,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });

  return { child, stream };
}

export async function waitForServer(
  baseUrl,
  { timeoutMs = 90_000, child = null } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "server did not respond";

  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(
        `Local server exited before becoming ready (code ${child.exitCode}).`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2_500),
        cache: "no-store",
      });
      if (response.ok) return;
      lastError = `health check returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Local server did not become ready: ${lastError}`);
}

export async function stopServer(child, { timeoutMs = 4_000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill("SIGTERM");
  });
}
