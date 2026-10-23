import fs from "node:fs";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import locale from "./locale.cjs";
it("keeps general, sites and about settings usable in English and switches without a restart prompt", async () => {
  const settings = { language: "en", version: "0.2.0", address: "https://one.example", serverVersion: "build-1", canOpenAtLogin: true, openAtLogin: false };
  const bridge = {
    getSettings: async () => settings,
    saveSettings: vi.fn(async (value) => Object.assign(settings, value)),
    listSites: async () => ({ sites: [{ id: "one", name: "One", url: "https://one.example" }], current: { mode: "cloud", serverUrl: "https://one.example" } }),
    onLanguage: () => {}, onView: () => {}, cancel: vi.fn(),
    choose: vi.fn(async () => ({ ok: true })),
  };
  const dom = new JSDOM(fs.readFileSync(new URL("./site-picker.html", import.meta.url), "utf8"), {
    url: "file:///site-picker.html?view=settings", runScripts: "dangerously",
    beforeParse(window) { window.sitePicker = bridge; window.desktopT = locale.desktopT; },
  });
  try {
    const document = dom.window.document;
    await vi.waitFor(() => expect(document.getElementById("generalTab").textContent).toBe("General"));
    expect(document.getElementById("settingsView").classList.contains("hidden")).toBe(false);
    document.getElementById("aboutTab").click();
    expect(document.getElementById("appVersion").textContent).toBe("0.2.0");
    expect(document.getElementById("serverVersion").textContent).toBe("build-1");
    document.getElementById("sitesTab").click();
    expect(document.getElementById("pickerView").textContent).toContain("Switch without restarting");
    document.querySelector("[data-site-id='one']").click();
    expect(bridge.choose).toHaveBeenCalledWith({ mode: "cloud", serverUrl: "https://one.example" });
    document.getElementById("generalTab").click();
    document.getElementById("language").value = "zh";
    document.getElementById("language").dispatchEvent(new dom.window.Event("change"));
    await vi.waitFor(() => expect(document.getElementById("generalTab").textContent).toBe("通用"));
  } finally { dom.window.close(); }
});
