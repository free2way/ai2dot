import "server-only";

export type GatewayAuthMode = "api-key" | "oidc" | "unconfigured";
type GatewayEnvironment = Pick<
  NodeJS.ProcessEnv,
  | "AI_GATEWAY_API_KEY"
  | "AI2DOT_ENABLE_AI_GATEWAY"
  | "VERCEL_OIDC_TOKEN"
  | "VERCEL_ENV"
  | "NODE_ENV"
>;

export function getGatewayAuthMode(
  environment: Partial<GatewayEnvironment> = process.env,
): GatewayAuthMode {
  if (environment.AI_GATEWAY_API_KEY?.trim()) return "api-key";
  if (environment.VERCEL_OIDC_TOKEN?.trim()) return "oidc";
  return "unconfigured";
}

export function isAiGatewayConfigured(
  environment: Partial<GatewayEnvironment> = process.env,
) {
  const mode = getGatewayAuthMode(environment);
  return (
    mode === "api-key" ||
    (mode === "oidc" && environment.AI2DOT_ENABLE_AI_GATEWAY === "true")
  );
}

export function getGatewayEnvironmentTag(
  environment: Partial<GatewayEnvironment> = process.env,
) {
  return `env:${environment.VERCEL_ENV || environment.NODE_ENV || "development"}`;
}
