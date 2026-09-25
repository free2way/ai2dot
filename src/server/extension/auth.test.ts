import { describe, expect, it } from "vitest";
import {
  getAllowedChromeExtensionIds,
  parseChromeExtensionOrigin,
} from "@/server/extension/auth";

describe("Chrome extension authentication helpers", () => {
  it("parses a Chrome extension origin", () => {
    expect(
      parseChromeExtensionOrigin(
        "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
      ),
    ).toEqual({
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    });
  });

  it("rejects web and malformed origins", () => {
    expect(parseChromeExtensionOrigin("https://ai.ai2dot.com")).toBeNull();
    expect(parseChromeExtensionOrigin("not a url")).toBeNull();
    expect(parseChromeExtensionOrigin(null)).toBeNull();
  });

  it("normalizes the configured extension id allowlist", () => {
    process.env.AI2DOT_CHROME_EXTENSION_IDS = " ABC , def,ABC ";
    expect([...getAllowedChromeExtensionIds()]).toEqual(["abc", "def"]);
    delete process.env.AI2DOT_CHROME_EXTENSION_IDS;
  });
});
