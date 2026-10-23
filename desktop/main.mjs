import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  WebContentsView,
} from "electron";
import locale from "./lib/locale.cjs";
import { sitePartition, migrateSiteCookies, readDraft, writeDraft, clearDrafts } from "./lib/workspace-storage.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSessionToken,
  getPaths,
  loadOrCreateConfig,
  resetLocalPassword,
} from "./lib/config.mjs";
import {
  DEFAULT_CLOUD_URL,
  defaultSites,
  loadSettings,
  normalizeServerUrl,
  saveSettings,
  validateSites,
} from "./lib/settings.mjs";
import {
  buildServerEnv,
  findFreePort,
  startServer,
  stopServer,
  waitForServer,
} from "./lib/server.mjs";

const CLOUD_PARTITION = "persist:ai2dot-cloud";
const LOCAL_PARTITION = "persist:ai2dot-local";
const DEV_URL = process.env.AI2DOT_DESKTOP_DEV_URL?.trim() || "";
const DEV_MODE = !app.isPackaged || Boolean(DEV_URL);
const SITE_BAR_HEIGHT = 64;
const DESKTOP_DIR = path.dirname(fileURLToPath(import.meta.url));

// Remote scripts are never allowed. Inline/eval remain because the Next.js
// runtime bootstrap relies on them. Only applied to the local runtime; the
// hosted site ships its own headers.
const LOCAL_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: data: https:",
  "connect-src 'self' https:",
].join("; ");

app.setName("ai2dot");
app.setPath("userData", path.join(app.getPath("appData"), "ai2dot"));

const paths = getPaths(app.getPath("userData"));
let settings = null;
let config = null;
let runtimeMode = "cloud";
// Editing saved sites must not change the identity of the running window.
let activeServerUrl = "";
let appOrigin = "";
let startUrl = "";
let mainWindow = null;
let mainView = null;
let splashWindow = null;
let sitePickerWindow = null;
let firstRunPicker = false;
let serverChild = null;
let serverLogStream = null;
let quitting = false;
let booting = false;
let cleanupStarted = false;
let switching = false;
let localOrigin = "";
let connection = "connecting";
let loadFailed = false;
let retryTimer;
let retryCount = 0;
let serverVersion = "";
const sessionsUsed = new Set();
const flushRequests = new Map();
const t = (text) => locale.desktopT(settings?.language, text);

function setConnection(next, failed = loadFailed) {
  connection = next;
  loadFailed = failed;
  mainView?.setVisible(!failed && next !== "connecting");
  updateWindowTitle();
}

function resizeActiveView() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainView) return;
  const [width, height] = mainWindow.getContentSize();
  mainView.setBounds({ x: 0, y: SITE_BAR_HEIGHT, width, height: Math.max(0, height - SITE_BAR_HEIGHT) });
}

async function flushWorkspace() {
  if (!mainView || mainView.webContents.isDestroyed()) return;
  const sender = mainView.webContents;
  const id = Math.random().toString(36).slice(2);
  await new Promise((resolve) => {
    const timer = setTimeout(() => { flushRequests.delete(id); resolve(); }, 1200);
    flushRequests.set(id, { sender, finish: () => { clearTimeout(timer); flushRequests.delete(id); resolve(); } });
    sender.send("workspace:flush", id);
  });
}

function broadcastLanguage(language) {
  if (language !== "zh" && language !== "en") throw new Error("Invalid language");
  settings = saveSettings(paths.root, { ...settings, language });
  mainView?.webContents.send("workspace:language-changed", language);
  sitePickerWindow?.webContents.send("desktop:language-changed", language);
  Menu.setApplicationMenu(buildMenu());
  updateWindowTitle();
}


async function shutdownCleanup() {
  const child = serverChild;
  serverChild = null;
  if (child) {
    await stopServer(child);
  }
  serverLogStream?.end();
  serverLogStream = null;

  try {
    for (const partition of sessionsUsed) {
      const ses = session.fromPartition(partition);
      await ses.cookies.flushStore();
      ses.flushStorageData();
    }
  } catch (error) {
    logLine(`storage flush failed: ${error}`);
  }
}

function logLine(message) {
  try {
    fs.mkdirSync(paths.logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(paths.logsDir, "electron.log"),
      `[${new Date().toISOString()}] ${message}\n`,
      { mode: 0o600 },
    );
  } catch {
    // Logging must never break startup.
  }
}

function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function openExternal(url) {
  if (isAllowedExternalUrl(url)) {
    void shell.openExternal(url);
  }
}

function isAppUrl(url) {
  if (!appOrigin) return false;
  if (url === "about:blank") return true;
  try {
    return new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
}

/**
 * Clerk performs a cookie handshake on its Frontend API origin before
 * redirecting back to the app. Allow only that exact handshake shape and only
 * when it returns to our own origin.
 */
function isAllowedAuthNavigation(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.pathname.startsWith("/v1/client/handshake")) return false;
    const redirectUrl = parsed.searchParams.get("redirect_url");
    if (!redirectUrl) return false;
    return new URL(redirectUrl).origin === appOrigin;
  } catch {
    return false;
  }
}

function siteHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url || "");
  }
}

function currentSiteLabel() {
  if (!settings) return t("未选择");
  if (runtimeMode === "local") return t("本地模式");
  const serverUrl = activeServerUrl || settings.serverUrl;
  const site = settings.sites?.find(
    (item) => item.url === serverUrl,
  );
  return site
    ? `${site.name} · ${siteHost(site.url)}`
    : siteHost(serverUrl);
}

function currentSiteSelection() {
  return {
    mode: startUrl ? runtimeMode : settings.mode,
    serverUrl: activeServerUrl || settings.serverUrl,
  };
}

function updateWindowTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setTitle(`ai2dot — ${currentSiteLabel()}`);
  mainWindow.webContents.send("desktop:status-changed", desktopStatus());
}

function desktopStatus() {
  return {
    ...currentSiteSelection(),
    label: currentSiteLabel(),
    address: runtimeMode === "local" ? t("本机数据库 · 离线模式") : activeServerUrl,
    language: settings?.language ?? "zh", connection, loadFailed, switching,
    version: app.getVersion(), serverVersion,
    openAtLogin: app.isPackaged && process.platform === "darwin" ? app.getLoginItemSettings().openAtLogin : false,
    canOpenAtLogin: app.isPackaged && process.platform === "darwin",
  };
}

function persistSiteSelection(mode, serverUrl) {
  if (!settings) settings = loadSettings(paths.root);
  const nextMode = mode === "local" ? "local" : "cloud";
  const nextServerUrl =
    nextMode === "cloud"
      ? normalizeServerUrl(serverUrl || settings.serverUrl)
      : settings.serverUrl;

  settings = saveSettings(paths.root, {
    ...settings,
    mode: nextMode,
    serverUrl: nextServerUrl,
  });
  logLine(`site selected mode=${nextMode} url=${nextServerUrl}`);
  Menu.setApplicationMenu(buildMenu());
  updateWindowTitle();
  return settings;
}

function applySiteFromMenu(mode, serverUrl) {
  void switchSite(mode, serverUrl).catch((error) => {
    dialog.showErrorBox(t("无法切换站点"), error instanceof Error ? error.message : String(error));
  });
}

async function ensureLocalRuntime() {
  if (localOrigin) return localOrigin;
  config = loadOrCreateConfig(paths.root);
  if (DEV_URL) { localOrigin = new URL(DEV_URL).origin; return localOrigin; }
  const port = await findFreePort();
  const started = startServer({
    appRoot: appRootPath(), env: buildServerEnv({ config, paths, port, version: app.getVersion() }),
    logFile: paths.serverLog, label: "next-standalone",
  });
  serverChild = started.child;
  serverLogStream = started.stream;
  const origin = `http://127.0.0.1:${port}`;
  const child = serverChild;
  child.on("exit", (code, signal) => {
    logLine(`server exited code=${code} signal=${signal}`);
    if (serverChild !== child) return;
    serverChild = null;
    started.stream.end();
    serverLogStream = null;
    localOrigin = "";
    if (!quitting && runtimeMode === "local") setConnection("error", true);
  });
  try {
    await waitForServer(origin, { child, timeoutMs: 120000 });
    localOrigin = origin;
    return origin;
  } catch (error) {
    serverChild = null;
    await stopServer(child);
    serverLogStream?.end();
    serverLogStream = null;
    throw error;
  }
}

async function switchSite(mode, serverUrl) {
  if (switching) throw new Error(t("正在切换…"));
  switching = true;
  updateWindowTitle();
  try {
    const nextMode = mode === "local" ? "local" : "cloud";
    const url = nextMode === "cloud" ? normalizeServerUrl(serverUrl || settings.serverUrl) : await ensureLocalRuntime();
    await flushWorkspace();
    persistSiteSelection(nextMode, nextMode === "cloud" ? url : settings.serverUrl);
    runtimeMode = nextMode;
    activeServerUrl = nextMode === "cloud" ? url : "";
    appOrigin = new URL(url).origin;
    serverVersion = "";
    const signedIn = nextMode === "local" || await hasCloudSession();
    startUrl = `${url}${signedIn ? "/workspace" : "/sign-in"}`;
    clearTimeout(retryTimer);
    retryCount = 0;
    if (!mainWindow) await createMainWindow();
    else await createActiveView();
    Menu.setApplicationMenu(buildMenu());
  } finally { switching = false; updateWindowTitle(); }
}

async function retryConnection() {
  clearTimeout(retryTimer);
  if (switching) return;
  retryCount = 0;
  if (runtimeMode === "local" && !localOrigin) {
    await switchSite("local");
    return;
  }
  if (mainView) {
    const currentUrl = mainView.webContents.getURL();
    setConnection("connecting", false);
    await mainView.webContents.loadURL(isAppUrl(currentUrl) && currentUrl !== "about:blank" ? currentUrl : startUrl).catch(() => {});
  }
}

async function probeConnection() {
  const view = mainView;
  const origin = appOrigin;
  if (!view || switching || connection === "connecting") return;
  try {
    const response = await fetch(`${runtimeMode === "cloud" ? activeServerUrl : appOrigin}/api/health`, {
      signal: AbortSignal.timeout(5000), redirect: "error",
    });
    if (view !== mainView || origin !== appOrigin) return;
    if (!response.ok) throw new Error(`Health HTTP ${response.status}`);
    const body = await response.json();
    serverVersion = typeof body.version === "string" ? body.version.slice(0, 100) : "";
    if (loadFailed) await retryConnection();
    else setConnection("online", false);
  } catch {
    if (view === mainView && origin === appOrigin && connection !== "connecting") setConnection("offline");
  }
}

function appRootPath() {
  if (process.env.AI2DOT_DESKTOP_APP_ROOT?.trim()) {
    return path.resolve(process.env.AI2DOT_DESKTOP_APP_ROOT.trim());
  }
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(process.cwd(), "desktop", ".runtime");
}

function splashHtml(message) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px; background: #07090c; color: #e7ece3;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    -webkit-app-region: drag; user-select: none;
  }
  .mark {
    width: 56px; height: 56px; border-radius: 16px;
    border: 1px solid rgba(183,243,74,.5);
    display: grid; place-items: center; color: #b7f34a;
    font-size: 26px; font-weight: 700; letter-spacing: -2px;
    box-shadow: 0 0 42px rgba(183,243,74,.16);
  }
  h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: .2px; }
  p { margin: 0; color: #8b9588; font-size: 13px; }
  .dot { animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
</style>
</head>
<body>
  <div class="mark">.d</div>
  <h1>ai2dot</h1>
  <p>${message}<span class="dot">…</span></p>
</body>
</html>`;
}

function createSplash(message) {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 300,
    resizable: false,
    movable: true,
    frame: false,
    show: false,
    backgroundColor: "#07090c",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(message))}`,
  );
  splashWindow.once("ready-to-show", () => splashWindow?.show());
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function partitionForMode() {
  return runtimeMode === "cloud" ? sitePartition(activeServerUrl || settings.serverUrl) : LOCAL_PARTITION;
}

async function setLocalSessionCookie() {
  if (!config || runtimeMode !== "local") return;
  const { token, expiresAt } = createSessionToken({
    email: config.email,
    secret: config.sessionSecret,
  });
  const ses = session.fromPartition(LOCAL_PARTITION);
  await ses.cookies.set({
    url: appOrigin,
    name: "ai2dot_session",
    value: token,
    httpOnly: true,
    secure: appOrigin.startsWith("https://"),
    sameSite: "lax",
    expirationDate: Math.floor(expiresAt / 1_000),
  });
}

async function hasCloudSession() {
  const ses = session.fromPartition(partitionForMode());
  await migrateSiteCookies(paths.root, activeServerUrl, session.fromPartition(CLOUD_PARTITION), ses);
  const cookies = await ses.cookies.get({ url: activeServerUrl });
  return cookies.some(
    (cookie) =>
      cookie.name === "__session" ||
      cookie.name === "__clerk_db_jwt" ||
      (cookie.name === "__client_uat" && cookie.value !== "0") ||
      cookie.name === "ai2dot_session",
  );
}

function hardenSession(ses, injectCsp) {
  if (injectCsp) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      const hasCsp = Object.keys(responseHeaders).some(
        (name) => name.toLowerCase() === "content-security-policy",
      );
      if (!hasCsp) {
        responseHeaders["Content-Security-Policy"] = [LOCAL_CSP];
      }
      callback({ responseHeaders });
    });
  }

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "clipboard-sanitized-write") {
      callback(true);
      return;
    }
    if (permission === "fullscreen") {
      callback(true);
      return;
    }
    if (permission === "media") {
      void dialog
        .showMessageBox({
          type: "question",
          buttons: [t("允许"), t("拒绝")],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
          title: t("麦克风/摄像头权限"),
          message: t("ai2dot 请求使用麦克风或摄像头，是否允许？"),
        })
        .then(({ response }) => callback(response === 0))
        .catch(() => callback(false));
      return;
    }
    callback(false);
  });

  ses.setPermissionCheckHandler((_webContents, permission) => {
    return (
      permission === "clipboard-sanitized-write" || permission === "fullscreen"
    );
  });
}

function hardenWebContents(webContents) {
  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url) || isAllowedAuthNavigation(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  webContents.on("will-redirect", (event, url) => {
    if (isAppUrl(url) || isAllowedAuthNavigation(url)) return;
    logLine(`blocked external redirect ${url}`);
    event.preventDefault();
    openExternal(url);
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: "ai2dot",
    backgroundColor: "#07090c",
    webPreferences: {
      preload: desktopLibPath("shell-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  // The site bar belongs to a local shell, so hosted pages cannot remove it
  // or gain access to its privileged bridge after login or navigation.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("will-redirect", (event) => event.preventDefault());
  mainWindow.on("resize", resizeActiveView);
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    updateWindowTitle();
  });

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    updateWindowTitle();
    mainWindow?.show();
    void maybeCaptureWindow();
  });

  mainWindow.on("closed", () => {
    clearTimeout(retryTimer);
    if (mainView && !mainView.webContents.isDestroyed()) mainView.webContents.close();
    mainView = null;
    mainWindow = null;
  });
  await mainWindow.loadFile(desktopLibPath("shell.html"));
  await createActiveView();
}

async function createActiveView() {
  const partition = partitionForMode();
  sessionsUsed.add(partition);
  hardenSession(session.fromPartition(partition), runtimeMode === "local");
  await setLocalSessionCookie();
  if (mainView) {
    mainWindow.contentView.removeChildView(mainView);
    if (!mainView.webContents.isDestroyed()) mainView.webContents.close();
  }
  const view = new WebContentsView({ webPreferences: {
    partition, preload: desktopLibPath("workspace-preload.cjs"),
    contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false, spellcheck: true,
  } });
  mainView = view;
  mainWindow.contentView.addChildView(view);
  resizeActiveView();
  hardenWebContents(view.webContents);
  setConnection("connecting", false);
  const active = () => mainView === view && !quitting;
  view.webContents.on("did-start-navigation", (_event, _url, inPlace, isMainFrame) => {
    if (active() && isMainFrame && !inPlace && (isAppUrl(_url) || isAllowedAuthNavigation(_url))) setConnection("connecting", false);
  });
  view.webContents.on("did-finish-load", () => {
    if (!active() || loadFailed) return;
    clearTimeout(retryTimer);
    retryCount = 0;
    setConnection("online", false);
    view.webContents.send("workspace:language-changed", settings.language);
  });
  view.webContents.on("render-process-gone", (_event, details) => {
    if (!active()) return;
    logLine(`renderer gone: ${details.reason}`);
    setConnection("error", true);
  });
  view.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    if (!active() || !isMainFrame || code === -3) return;
    logLine(`load failed: ${code} ${description}`);
    setConnection("error", true);
    clearTimeout(retryTimer);
    const delay = [2000, 5000, 15000][retryCount++];
    // Certificate and policy failures require explicit user action.
    if (delay && ![-200, -201, -202, -206, -501].includes(code)) {
      retryTimer = setTimeout(() => {
        if (!active()) return;
        setConnection("connecting", false);
        void view.webContents.loadURL(startUrl).catch(() => {});
      }, delay);
    }
  });
  void view.webContents.loadURL(startUrl).then(() => { if (active()) view.webContents.focus(); }).catch((error) => logLine(`load failed: ${error}`));
}

async function maybeCaptureWindow() {
  const target = process.env.AI2DOT_DESKTOP_CAPTURE?.trim();
  if (!target || !mainView) return;

  await new Promise((resolve) => setTimeout(resolve, 2_500));
  try {
    const image = await mainView.webContents.capturePage();
    fs.writeFileSync(target, image.toPNG());
    logLine(`captured window to ${target}`);
  } catch (error) {
    logLine(`capture failed: ${error}`);
  }

  if (process.env.AI2DOT_DESKTOP_EXIT_AFTER_CAPTURE === "1") {
    app.quit();
  }
}

function desktopLibPath(name) {
  return path.join(DESKTOP_DIR, "lib", name);
}

function openSitePicker({ firstRun = false, initialView = "picker" } = {}) {
  if (sitePickerWindow && !sitePickerWindow.isDestroyed()) {
    sitePickerWindow.focus();
    sitePickerWindow.webContents.send("site:view", initialView);
    return;
  }

  firstRunPicker = firstRun;
  sitePickerWindow = new BrowserWindow({
    width: 840,
    height: 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    title: t("选择登录站点"),
    backgroundColor: "#07090c",
    parent: mainWindow ?? undefined,
    modal: Boolean(mainWindow),
    webPreferences: {
      preload: desktopLibPath("site-picker-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  sitePickerWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  sitePickerWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  sitePickerWindow.webContents.on("will-redirect", (event) => event.preventDefault());
  sitePickerWindow.once("ready-to-show", () => sitePickerWindow?.show());
  sitePickerWindow.on("closed", () => {
    const wasFirstRun = firstRunPicker;
    sitePickerWindow = null;
    firstRunPicker = false;
    if (wasFirstRun && !quitting) app.quit();
  });
  sitePickerWindow.loadFile(desktopLibPath("site-picker.html"), {
    query: { view: initialView },
  });
}

function registerSitePickerIpc() {
  function assertShellSender(event) {
    if (
      !mainWindow || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame
    ) {
      throw new Error("This action is only available from the desktop site bar.");
    }
  }

  function assertPickerSender(event) {
    if (!sitePickerWindow || event.sender !== sitePickerWindow.webContents || event.senderFrame !== sitePickerWindow.webContents.mainFrame) {
      throw new Error("This action is only available from desktop settings.");
    }
  }
  function assertWorkspaceSender(event) {
    if (!mainView || event.sender !== mainView.webContents || event.senderFrame !== mainView.webContents.mainFrame || !isAppUrl(event.senderFrame.url) || event.senderFrame.url === "about:blank") {
      throw new Error("Invalid workspace sender");
    }
  }
  const draftSite = () => runtimeMode === "local" ? "local" : activeServerUrl;
  ipcMain.handle("workspace:language", (event) => { assertWorkspaceSender(event); return settings.language; });
  ipcMain.handle("workspace:language-set", (event, language) => { assertWorkspaceSender(event); broadcastLanguage(language); });
  ipcMain.handle("workspace:draft-get", (event, key) => { assertWorkspaceSender(event); return readDraft(paths.root, draftSite(), key); });
  ipcMain.handle("workspace:draft-set", (event, key, value) => { assertWorkspaceSender(event); writeDraft(paths.root, draftSite(), key, value); });
  ipcMain.on("workspace:flushed", (event, id) => {
    const request = flushRequests.get(id);
    if (request && event.sender === request.sender && event.senderFrame === request.sender.mainFrame) request.finish();
  });
  ipcMain.on("workspace:network", (event, online) => {
    try { assertWorkspaceSender(event); } catch { return; }
    if (online) void probeConnection();
    else setConnection("offline");
  });
  ipcMain.handle("desktop:retry", (event) => { assertShellSender(event); return retryConnection(); });
  ipcMain.handle("settings:get", (event) => { assertPickerSender(event); return desktopStatus(); });
  ipcMain.handle("settings:save", (event, payload) => {
    assertPickerSender(event);
    if (payload.language !== undefined) broadcastLanguage(payload.language);
    if (typeof payload.openAtLogin === "boolean" && app.isPackaged && process.platform === "darwin") app.setLoginItemSettings({ openAtLogin: payload.openAtLogin });
    return desktopStatus();
  });
  ipcMain.handle("settings:open-folder", (event) => { assertPickerSender(event); showDataFolder(); });
  ipcMain.handle("desktop:status", (event) => {
    assertShellSender(event);
    return desktopStatus();
  });
  ipcMain.handle("desktop:open-sites", (event, view) => {
    assertShellSender(event);
    openSitePicker({ initialView: ["manage", "settings"].includes(view) ? view : "picker" });
  });

  ipcMain.handle("sites:list", (event) => {
    assertPickerSender(event);
    const current = settings ?? loadSettings(paths.root);
    settings = current;
    return {
      sites: current.sites,
      current: currentSiteSelection(),
    };
  });

  ipcMain.handle("sites:save", async (event, payload) => {
    assertPickerSender(event);
    try {
      if (!settings) settings = loadSettings(paths.root);
      const sites = validateSites(payload);
      const previousSite = settings.sites.find(
        (site) => site.url === settings.serverUrl,
      );
      const updatedSite = previousSite
        ? sites.find((site) => site.id === previousSite.id)
        : null;
      const serverUrl = updatedSite?.url ?? settings.serverUrl;

      settings = saveSettings(paths.root, { ...settings, sites, serverUrl });
      logLine(`sites saved count=${sites.length}`);
      Menu.setApplicationMenu(buildMenu());
      updateWindowTitle();
      return {
        ok: true,
        sites: settings.sites,
        current: currentSiteSelection(),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("sites:reset", (event) => {
    assertPickerSender(event);
    if (!settings) settings = loadSettings(paths.root);
    const sites = defaultSites();
    settings = saveSettings(paths.root, {
      ...settings,
      sites,
      serverUrl: DEFAULT_CLOUD_URL,
    });
    logLine("sites reset to defaults");
    Menu.setApplicationMenu(buildMenu());
    updateWindowTitle();
    return {
      ok: true,
      sites: settings.sites,
      current: currentSiteSelection(),
    };
  });

  ipcMain.handle("site:choose", async (event, payload) => {
    assertPickerSender(event);
    try {
      await switchSite(payload?.mode, payload?.serverUrl);
      firstRunPicker = false;
      sitePickerWindow?.close();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.on("site:cancel", (event) => {
    try { assertPickerSender(event); sitePickerWindow?.close(); } catch { /* Ignore untrusted senders. */ }
  });
}

function showCredentials() {
  if (!config) return;
  const result = dialog.showMessageBoxSync({
    type: "info",
    title: t("本地登录与密码"),
    message: `邮箱：${config.email}`,
    detail:
      "本地模式启动时会自动注入会话，无需手动登录。\n\n" +
      "如果手动登录凭据失效，可以重置密码；重置后应用会重启。",
    buttons: ["重置密码", "关闭"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (result !== 0) return;

  const confirmed = dialog.showMessageBoxSync({
    type: "warning",
    title: t("重置本地密码"),
    message: t("确定要重置本地登录密码吗？"),
    detail: "当前会话会失效，应用需要重启后才会使用新密码。",
    buttons: ["重置并重启", "取消"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (confirmed !== 0) return;

  const { password } = resetLocalPassword(paths.root);
  clipboard.writeText(password);
  dialog.showMessageBoxSync({
    type: "info",
    title: t("新密码已生成"),
    message: t("新密码已复制到剪贴板"),
    detail: `${password}\n\n${DEV_MODE ? "请退出并重新运行 npm run desktop:dev。" : "应用将自动重启。"}`,
    buttons: ["继续"],
    noLink: true,
  });

  if (DEV_MODE) return;
  app.relaunch();
  app.quit();
}

function showDataFolder() {
  void shell.openPath(paths.root);
}

function showServerLog() {
  if (fs.existsSync(paths.serverLog)) {
    shell.showItemInFolder(paths.serverLog);
    return;
  }
  dialog.showMessageBoxSync({
    type: "info",
    title: t("服务日志"),
    message: t("暂无日志"),
    detail: paths.serverLog,
  });
}

function showSettingsFile() {
  try {
    if (!settings) return;
    if (!fs.existsSync(paths.settingsFile)) {
      saveSettings(paths.root, settings);
    }
    shell.showItemInFolder(paths.settingsFile);
  } catch (error) {
    dialog.showErrorBox(
      "无法打开设置文件",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function signOutCloud() {
  if (!settings) return;
  if (switching || runtimeMode !== "cloud") return;
  const view = mainView;
  const url = activeServerUrl;
  await flushWorkspace();
  if (view !== mainView || url !== activeServerUrl) return;
  const ses = session.fromPartition(sitePartition(url));
  clearDrafts(paths.root, url);
  await ses.clearStorageData({
    storages: [
      "cookies",
      "localstorage",
      "indexdb",
      "cachestorage",
      "serviceworkers",
    ],
  });
  await ses.clearCache();
  try {
    await ses.clearAuthCache();
  } catch {
    // Not every Electron build exposes the auth cache.
  }
  logLine("cloud session cleared");
  if (mainView === view) {
    await view.webContents.loadURL(`${url}/sign-in`);
  }
}

function siteMenuItems() {
  const items = [
    { label: `${t("当前站点")}：${currentSiteLabel()}`, enabled: false },
    { type: "separator" },
    {
      label: t("切换登录站点…"),
      accelerator: "CmdOrCtrl+Shift+S",
      click: () => openSitePicker(),
    },
    {
      label: t("管理站点…"),
      click: () => openSitePicker({ initialView: "manage" }),
    },
    { type: "separator" },
  ];

  for (const site of settings?.sites ?? []) {
    items.push({
      label: `${site.name} · ${siteHost(site.url)}`,
      type: "radio",
      checked: runtimeMode === "cloud" && activeServerUrl === site.url,
      click: () => applySiteFromMenu("cloud", site.url),
    });
  }

  items.push({
    label: t("本地模式（离线）"),
    type: "radio",
    checked: runtimeMode === "local",
    click: () => applySiteFromMenu("local", settings?.serverUrl),
  });

  return items;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const cloud = runtimeMode === "cloud";
  const accountItems = cloud
    ? [
        { label: t("退出登录"), click: () => void signOutCloud() },
        {
          label: t("重新加载"),
          click: () => mainView?.webContents.reload(),
        },
      ]
    : [
        { label: t("本地登录与密码…"), click: showCredentials },
        {
          label: t("重新加载"),
          click: () => mainView?.webContents.reload(),
        },
      ];

  const siteItem = {
    label: t("切换登录站点…"),
    click: () => openSitePicker(),
  };

  const template = [
    ...(isMac
      ? [
          {
            label: "ai2dot",
            submenu: [
              { role: "about", label: t("关于") },
              { type: "separator" },
              ...accountItems,
              siteItem,
              { label: t("设置…"), accelerator: "CmdOrCtrl+,", click: () => openSitePicker({ initialView: "settings" }) },
              { type: "separator" },
              {
                label: t("打开设置文件（云端地址）"),
                click: showSettingsFile,
              },
              {
                label: t("打开数据目录"),
                click: showDataFolder,
              },
              {
                label: t("查看服务日志"),
                click: showServerLog,
              },
              { type: "separator" },
              { role: "services", label: t("服务") },
              { type: "separator" },
              { role: "hide", label: t("隐藏 ai2dot") },
              { role: "hideOthers", label: t("隐藏其他") },
              { role: "unhide", label: t("显示全部") },
              { type: "separator" },
              { role: "quit", label: t("退出") },
            ],
          },
        ]
      : []),
    {
      label: t("编辑"),
      submenu: [
        { role: "undo", label: t("撤销") },
        { role: "redo", label: t("重做") },
        { type: "separator" },
        { role: "cut", label: t("剪切") },
        { role: "copy", label: t("复制") },
        { role: "paste", label: t("粘贴") },
        { role: "pasteAndMatchStyle", label: t("粘贴并匹配样式") },
        { role: "selectAll", label: t("全选") },
      ],
    },
    {
      label: t("账号"),
      submenu: accountItems,
    },
    {
      label: t("站点"),
      submenu: siteMenuItems(),
    },
    {
      label: t("查看"),
      submenu: [
        { label: t("重新加载"), accelerator: "CmdOrCtrl+R", click: () => mainView?.webContents.reload() },
        { label: t("强制重新加载"), accelerator: "CmdOrCtrl+Shift+R", click: () => mainView?.webContents.reloadIgnoringCache() },
        ...(DEV_MODE ? [{ label: t("开发者工具"), accelerator: "Alt+CmdOrCtrl+I", click: () => mainView?.webContents.toggleDevTools() }] : []),
        { type: "separator" },
        { label: t("实际大小"), accelerator: "CmdOrCtrl+0", click: () => mainView?.webContents.setZoomLevel(0) },
        { label: t("放大"), accelerator: "CmdOrCtrl+Plus", click: () => { if (mainView) mainView.webContents.setZoomLevel(mainView.webContents.getZoomLevel() + 0.5); } },
        { label: t("缩小"), accelerator: "CmdOrCtrl+-", click: () => { if (mainView) mainView.webContents.setZoomLevel(mainView.webContents.getZoomLevel() - 0.5); } },
        { type: "separator" },
        { role: "togglefullscreen", label: t("进入全屏") },
      ],
    },
    {
      label: t("窗口"),
      submenu: [
        { role: "minimize", label: t("最小化") },
        { role: "zoom", label: t("缩放") },
        ...(isMac
          ? [{ type: "separator" }, { role: "front", label: t("全部置前") }]
          : [{ role: "close", label: t("关闭窗口") }]),
      ],
    },
    ...(isMac
      ? []
      : [
          {
            label: t("帮助"),
            submenu: [
              ...accountItems,
              siteItem,
              { label: t("打开设置文件"), click: showSettingsFile },
              { label: t("打开数据目录"), click: showDataFolder },
              { label: t("查看服务日志"), click: showServerLog },
            ],
          },
        ]),
  ];

  return Menu.buildFromTemplate(template);
}

async function boot() {
  if (booting) return;
  booting = true;

  try {
    settings = loadSettings(paths.root);

    if (!DEV_URL && !fs.existsSync(paths.settingsFile)) {
      runtimeMode = settings.mode;
      logLine("first run: showing site picker");
      openSitePicker({ firstRun: true });
      return;
    }

    createSplash(t(settings.mode === "local" || DEV_URL ? "正在启动本地工作台" : "正在连接云端工作台"));
    await switchSite(DEV_URL ? "local" : settings.mode, settings.serverUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logLine(`boot failed: ${message}`);
    closeSplash();
    dialog.showErrorBox(
      "ai2dot 启动失败",
      `${message}\n\n数据目录：${paths.root}\n设置文件：${paths.settingsFile}`,
    );
    app.quit();
  } finally {
    booting = false;
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (startUrl) {
      void createMainWindow();
    }
  });

  app.whenReady().then(() => {
    registerSitePickerIpc();
    Menu.setApplicationMenu(buildMenu());

    // Keep the local session fresh while the app stays open for days.
    setInterval(() => {
      void setLocalSessionCookie().catch((error) =>
        logLine(`cookie refresh failed: ${error}`),
      );
    }, 6 * 60 * 60 * 1_000);

    setInterval(() => { void probeConnection(); }, 30000);
    void boot();
  });

  app.on("activate", () => {
    if (!mainWindow && startUrl) void createMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
  });

  app.on("will-quit", (event) => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    event.preventDefault();
    void shutdownCleanup().finally(() => app.exit(0));
  });
}
