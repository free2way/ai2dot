import { describe, expect, it } from "vitest";
import {
  getGatewayAuthMode,
  getGatewayEnvironmentTag,
  isAiGatewayConfigured,
} from "./gateway";

describe("AI Gateway environment", () => {
  it("prefers a manual API key over OIDC", () => {
    expect(
      getGatewayAuthMode({
        AI_GATEWAY_API_KEY: "gateway-key",
        VERCEL_OIDC_TOKEN: "oidc-token",
      }),
    ).toBe("api-key");
  });

  it("requires explicit opt-in before using Vercel OIDC", () => {
    const environment = { VERCEL_OIDC_TOKEN: "oidc-token" };
    expect(getGatewayAuthMode(environment)).toBe("oidc");
    expect(isAiGatewayConfigured(environment)).toBe(false);
    expect(
      isAiGatewayConfigured({
        ...environment,
        AI2DOT_ENABLE_AI_GATEWAY: "true",
      }),
    ).toBe(true);
  });

  it("reports an unconfigured environment and creates a deployment tag", () => {
    expect(isAiGatewayConfigured({})).toBe(false);
    expect(getGatewayEnvironmentTag({ VERCEL_ENV: "preview" })).toBe(
      "env:preview",
    );
  });
});
