import "server-only";

type LogLevel = "info" | "warn" | "error";

export function logServerEvent(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV === "test") return;
  const payload = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}
