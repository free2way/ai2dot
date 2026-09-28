import { describe, expect, it } from "vitest";
import {
  describeGoogleNotebookProvider,
  getGoogleNotebookProviderConfig,
} from "@/server/notebooks/google-provider";

describe("Google Notebook provider configuration", () => {
  it("keeps the provider disabled without affecting native notebooks", () => {
    const status = describeGoogleNotebookProvider({});
    expect(status.enabled).toBe(false);
    expect(status.configured).toBe(false);
    expect(status.network).toBe("not_checked");
  });

  it("flags mainland China as requiring an explicit connectivity check", () => {
    const config = getGoogleNotebookProviderConfig({
      AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER: "true",
      AI2DOT_DEPLOYMENT_REGION: "cn-mainland",
      GOOGLE_NOTEBOOK_PROJECT_NUMBER: "123456789",
      GOOGLE_NOTEBOOK_LOCATION: "global",
      GOOGLE_NOTEBOOK_ACCESS_TOKEN: "test-token",
    });
    expect(config.configured).toBe(true);
    expect(config.mainlandChinaDeployment).toBe(true);
  });

  it("rejects China as a Google data location", () => {
    const config = getGoogleNotebookProviderConfig({
      AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER: "true",
      GOOGLE_NOTEBOOK_PROJECT_NUMBER: "123456789",
      GOOGLE_NOTEBOOK_LOCATION: "cn",
      GOOGLE_NOTEBOOK_ACCESS_TOKEN: "test-token",
    });
    expect(config.regionSupported).toBe(false);
    expect(config.configured).toBe(false);
  });
});
