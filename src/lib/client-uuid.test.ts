import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientUuid } from "./client-uuid";

afterEach(() => vi.unstubAllGlobals());

describe("Browser UUID generation", () => {
  it("uses native randomUUID on secure origins", () => {
    const native = vi.fn(() => "00000000-0000-4000-8000-000000000001");
    vi.stubGlobal("crypto", { randomUUID: native });
    expect(createClientUuid()).toBe("00000000-0000-4000-8000-000000000001");
    expect(native).toHaveBeenCalledOnce();
  });

  it("creates a cryptographically random v4 UUID on LAN HTTP", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xff);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    expect(createClientUuid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});
