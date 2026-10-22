import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "./lib/settings.mjs";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const state = { windows: [], views: [], handlers: new Map(), menu: null };
  const app = Object.assign(new EventEmitter(), {
    isPackaged: true,
    setName: vi.fn(), setPath: vi.fn(), getPath: vi.fn(),
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    relaunch: vi.fn(), quit: vi.fn(), exit: vi.fn(),
  });
  const ses = {
    cookies: { get: vi.fn(async () => []), set: vi.fn() },
    setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(),
    clearStorageData: vi.fn(), clearCache: vi.fn(), clearAuthCache: vi.fn(),
  };
  function contents() {
    return Object.assign(new EventEmitter(), {
      mainFrame: {},
      setWindowOpenHandler: vi.fn(), send: vi.fn(),
      loadURL: vi.fn(async () => {}), focus: vi.fn(),
      isDestroyed: () => false, close: vi.fn(),
      reload: vi.fn(), reloadIgnoringCache: vi.fn(),
    });
  }
  class WebContentsView {
    constructor(options) {
      this.options = options;
      this.webContents = contents();
      this.setBounds = vi.fn();
      state.views.push(this);
    }
  }
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = contents();
      this.contentView = { addChildView: vi.fn() };
      this.getContentSize = vi.fn(() => [1440, 900]);
      this.loadURL = vi.fn(async () => {});
      this.loadFile = vi.fn(async () => {});
      this.setTitle = vi.fn();
      this.focus = vi.fn();
      state.windows.push(this);
    }
    isDestroyed() { return false; }
  }
  return {
    app, BrowserWindow, WebContentsView,
    ipcMain: {
      handle: (name, handler) => state.handlers.set(name, handler),
      on: vi.fn(),
    },
    Menu: {
      buildFromTemplate: (menu) => menu,
      setApplicationMenu: (menu) => { state.menu = menu; },
    },
    session: { fromPartition: () => ses },
    dialog: { showErrorBox: vi.fn() }, clipboard: {}, shell: {},
    reviewState: state,
  };
});

const { app, reviewState } = await import("electron");
let directory;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubEnv("AI2DOT_DESKTOP_DEV_URL", "");
  vi.stubEnv("AI2DOT_DESKTOP_MODE", "");
  vi.stubEnv("AI2DOT_DESKTOP_SERVER_URL", "");
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai2dot-site-test-"));
  app.getPath.mockReturnValue(directory);
  app.removeAllListeners();
  reviewState.windows.length = 0;
  reviewState.views.length = 0;
  reviewState.handlers.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function boot(settings = defaultSettings()) {
  saveSettings(directory, settings);
  await import("./main.mjs");
  await vi.waitFor(() => expect(reviewState.views[0]?.webContents.loadURL).toHaveBeenCalled());
  return reviewState.windows[1];
}

function invoke(name, payload) {
  return reviewState.handlers.get(name)({}, payload);
}

function siteMenu() {
  return reviewState.menu.find((item) => item.label === "站点").submenu;
}

describe("active desktop login site", () => {
  it("keeps the actual site in the title, picker and logout after editing its URL", async () => {
    const window = await boot();
    const oldUrl = defaultSettings().serverUrl;
    const sites = defaultSettings().sites.map((site) =>
      site.url === oldUrl ? { ...site, url: "https://new.example.com" } : site,
    );
    const result = await invoke("sites:save", sites);

    expect(loadSettings(directory).serverUrl).toBe("https://new.example.com");
    expect(result.current.serverUrl).toBe(oldUrl);
    expect(invoke("sites:list").current.serverUrl).toBe(oldUrl);
    expect(window.setTitle).toHaveBeenLastCalledWith("ai2dot — dot.ai2note.com");
    expect(siteMenu()[0].label).toBe("当前站点：dot.ai2note.com");
    expect(siteMenu().filter((item) => item.checked)).toEqual([]);

    const logout = reviewState.menu.find((item) => item.label === "账号").submenu[0];
    logout.click();
    await vi.waitFor(() => expect(reviewState.views[0].webContents.loadURL).toHaveBeenLastCalledWith(`${oldUrl}/sign-in`));

    // The replacement URL is applied only after an explicit selection.
    await invoke("site:choose", { mode: "cloud", serverUrl: sites[1].url });
    expect(app.relaunch).toHaveBeenCalledOnce();
    expect(app.quit).toHaveBeenCalledOnce();
  });

  it("preserves the active site when restoring defaults", async () => {
    const settings = defaultSettings();
    settings.serverUrl = "https://custom.example.com";
    settings.sites.push({ id: "custom", name: "自定义", url: settings.serverUrl });
    const window = await boot(settings);
    const result = invoke("sites:reset");

    expect(loadSettings(directory).serverUrl).toBe(defaultSettings().serverUrl);
    expect(result.current.serverUrl).toBe("https://custom.example.com");
    expect(window.setTitle).toHaveBeenLastCalledWith("ai2dot — custom.example.com");
    expect(reviewState.views[0].webContents.loadURL).toHaveBeenLastCalledWith("https://custom.example.com/sign-in");
    expect(app.relaunch).not.toHaveBeenCalled();
  });

  it("keeps the active checkmark and updates a renamed site's title", async () => {
    const window = await boot();
    const sites = defaultSettings().sites.map((site) => ({ ...site, name: `${site.name}新版` }));
    await invoke("sites:save", sites);
    expect(window.setTitle).toHaveBeenLastCalledWith("ai2dot — 本地 Docker新版 · dot.ai2note.com");
    expect(siteMenu().filter((item) => item.checked)).toHaveLength(1);
  });
});

describe("persistent desktop site bar", () => {
  function shellEvent() {
    const sender = reviewState.windows[1].webContents;
    return { sender, senderFrame: sender.mainFrame };
  }

  it("keeps a local shell above the hosted page through login and resize", async () => {
    const window = await boot();
    const view = reviewState.views[0];
    expect(window.loadFile).toHaveBeenCalledWith(expect.stringMatching(/lib\/shell\.html$/));
    expect(window.options.webPreferences.preload).toMatch(/lib\/shell-preload\.cjs$/);
    expect(view.options.webPreferences.preload).toBeUndefined();
    expect(view.options.webPreferences.partition).toBe("persist:ai2dot-cloud");
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 64, width: 1440, height: 836 });

    await view.webContents.loadURL("https://dot.ai2note.com/workspace");
    expect(window.loadFile).toHaveBeenCalledOnce();
    const status = reviewState.handlers.get("desktop:status")(shellEvent());
    expect(status).toMatchObject({ mode: "cloud", address: "https://dot.ai2note.com", label: "本地 Docker · dot.ai2note.com" });

    window.getContentSize.mockReturnValue([1100, 700]);
    window.emit("resize");
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 64, width: 1100, height: 636 });
    window.emit("closed");
    expect(view.webContents.close).toHaveBeenCalledOnce();
  });

  it.each(["picker", "manage"])("opens the %s dialog from the site bar", async (initialView) => {
    await boot();
    reviewState.handlers.get("desktop:open-sites")(shellEvent(), initialView);
    expect(reviewState.windows[2].loadFile).toHaveBeenCalledWith(
      expect.stringMatching(/lib\/site-picker\.html$/), { query: { view: initialView } },
    );
  });

  it("rejects privileged toolbar actions from hosted pages and subframes", async () => {
    const window = await boot();
    const remote = reviewState.views[0].webContents;
    for (const name of ["desktop:status", "desktop:open-sites"]) {
      const handler = reviewState.handlers.get(name);
      expect(() => handler({ sender: remote, senderFrame: remote.mainFrame }, "manage")).toThrow("site bar");
      expect(() => handler({ sender: window.webContents, senderFrame: {} }, "manage")).toThrow("site bar");
    }
    expect(reviewState.windows).toHaveLength(2);
  });
});
