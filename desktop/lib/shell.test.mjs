import fs from "node:fs";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";

it("shows the active site and keeps both actions usable when the site changes", async () => {
  let update;
  const bridge = {
    getStatus: async () => ({ label: "线上版 · ai.ai2dot.com", address: "https://ai.ai2dot.com" }),
    openSites: vi.fn(async () => {}),
    onStatus: (callback) => { update = callback; },
  };
  const dom = new JSDOM(fs.readFileSync(new URL("./shell.html", import.meta.url), "utf8"), {
    runScripts: "dangerously",
    beforeParse(window) { window.desktopShell = bridge; },
  });
  try {
    await vi.waitFor(() => expect(dom.window.document.getElementById("siteLabel").textContent).toBe("线上版 · ai.ai2dot.com"));
    const document = dom.window.document;
    expect(document.getElementById("siteAddress").textContent).toBe("https://ai.ai2dot.com");
    document.getElementById("switchSite").click();
    expect(bridge.openSites).toHaveBeenLastCalledWith("picker");
    document.getElementById("manageSites").click();
    expect(bridge.openSites).toHaveBeenLastCalledWith("manage");

    update({ label: "本地模式", address: "本机数据库 · 离线模式" });
    expect(document.getElementById("siteLabel").textContent).toBe("本地模式");
    expect(document.querySelector(".site-bar").textContent).toContain("切换站点");
  } finally {
    dom.window.close();
  }
});
