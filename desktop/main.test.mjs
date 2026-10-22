import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "./lib/settings.mjs";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const state = { windows: [], handlers: new Map(), menu: null };
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
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = Object.assign(new EventEmitter(), {
        setWindowOpenHandler: vi.fn(),
      });
      this.loadURL = vi.fn(async () => {});
      this.setTitle = vi.fn();
      state.windows.push(this);
    }
    isDestroyed() { return false; }
  }
  return {
    app, BrowserWindow,
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
  await vi.waitFor(() => expect(reviewState.windows).toHaveLength(2));
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
    await vi.waitFor(() => expect(window.loadURL).toHaveBeenLastCalledWith(`${oldUrl}/sign-in`));

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
    expect(window.loadURL).toHaveBeenLastCalledWith("https://custom.example.com/sign-in");
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
