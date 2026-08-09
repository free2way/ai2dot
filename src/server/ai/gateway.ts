import "server-only";

export type GatewayAuthMode = "api-key" | "oidc" | "unconfigured";
type GatewayEnvironment = Pick<
  NodeJS.ProcessEnv,
  "AI_GATEWAY_API_KEY" | "VERCEL_OIDC_TOKEN" | "VERCEL_ENV" | "NODE_ENV"
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
  return getGatewayAuthMode(environment) !== "unconfigured";
}

export function getGatewayEnvironmentTag(
  environment: Partial<GatewayEnvironment> = process.env,
) {
  return `env:${environment.VERCEL_ENV || environment.NODE_ENV || "development"}`;
}
