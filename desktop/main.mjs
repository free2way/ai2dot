import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
} from "electron";
import fs from "node:fs";
import path from "node:path";
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
let appOrigin = "";
let startUrl = "";
let mainWindow = null;
let splashWindow = null;
let sitePickerWindow = null;
let firstRunPicker = false;
let serverChild = null;
let serverLogStream = null;
let quitting = false;
let booting = false;
let cleanupStarted = false;

async function shutdownCleanup() {
  const child = serverChild;
  serverChild = null;
  if (child) {
    await stopServer(child);
  }
  serverLogStream?.end();
  serverLogStream = null;

  try {
    const ses = session.fromPartition(partitionForMode());
    await ses.cookies.flushStore();
    ses.flushStorageData();
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
  return runtimeMode === "cloud" ? CLOUD_PARTITION : LOCAL_PARTITION;
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
  const ses = session.fromPartition(CLOUD_PARTITION);
  const cookies = await ses.cookies.get({ url: settings.serverUrl });
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
          buttons: ["允许", "拒绝"],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
          title: "麦克风/摄像头权限",
          message: "ai2dot 请求使用麦克风或摄像头，是否允许？",
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
  const partition = partitionForMode();
  const ses = session.fromPartition(partition);
  hardenSession(ses, runtimeMode === "local");
  await setLocalSessionCookie();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: "ai2dot",
    backgroundColor: "#07090c",
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
  });

  hardenWebContents(mainWindow.webContents);

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow?.show();
    void maybeCaptureWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on(
    "render-process-gone",
    (_event, details) => {
      logLine(`renderer gone: ${JSON.stringify(details)}`);
      if (!quitting) {
        dialog.showErrorBox(
          "ai2dot 页面异常",
          `渲染进程已退出（${details.reason}）。请重新打开应用。`,
        );
      }
    },
  );

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      logLine(`load failed: ${errorCode} ${errorDescription} url=${_validatedUrl}`);
      void dialog
        .showMessageBox({
          type: "error",
          title: "无法打开工作台",
          message: "连接失败，请检查网络或云端地址。",
          detail: `${errorDescription} (${errorCode})\n\n地址：${startUrl}`,
          buttons: ["重试", "切换登录站点", "退出"],
          defaultId: 0,
          cancelId: 2,
          noLink: true,
        })
        .then(({ response }) => {
          if (response === 0) {
            void mainWindow?.loadURL(startUrl);
          } else if (response === 1) {
            openSitePicker();
          } else {
            app.quit();
          }
        });
    },
  );

  try {
    await mainWindow.loadURL(startUrl);
  } catch (error) {
    // did-fail-load already presents retry/settings actions.
    logLine(`initial load failed: ${error}`);
  }
}

async function maybeCaptureWindow() {
  const target = process.env.AI2DOT_DESKTOP_CAPTURE?.trim();
  if (!target || !mainWindow) return;

  await new Promise((resolve) => setTimeout(resolve, 2_500));
  try {
    const image = await mainWindow.webContents.capturePage();
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
  return app.isPackaged
    ? path.join(app.getAppPath(), "desktop", "lib", name)
    : path.join(app.getAppPath(), "lib", name);
}

function openSitePicker({ firstRun = false } = {}) {
  if (sitePickerWindow && !sitePickerWindow.isDestroyed()) {
    sitePickerWindow.focus();
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
    title: "选择登录站点",
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

  sitePickerWindow.once("ready-to-show", () => sitePickerWindow?.show());
  sitePickerWindow.on("closed", () => {
    const wasFirstRun = firstRunPicker;
    sitePickerWindow = null;
    firstRunPicker = false;
    if (wasFirstRun && !quitting) app.quit();
  });
  sitePickerWindow.loadFile(desktopLibPath("site-picker.html"));
}

function registerSitePickerIpc() {
  ipcMain.handle("sites:list", () => {
    const current = settings ?? loadSettings(paths.root);
    settings = current;
    return {
      sites: current.sites,
      current: { mode: current.mode, serverUrl: current.serverUrl },
    };
  });

  ipcMain.handle("sites:save", async (_event, payload) => {
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
      return {
        ok: true,
        sites: settings.sites,
        current: { mode: settings.mode, serverUrl: settings.serverUrl },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("sites:reset", () => {
    if (!settings) settings = loadSettings(paths.root);
    const sites = defaultSites();
    settings = saveSettings(paths.root, {
      ...settings,
      sites,
      serverUrl: DEFAULT_CLOUD_URL,
    });
    logLine("sites reset to defaults");
    return {
      ok: true,
      sites: settings.sites,
      current: { mode: settings.mode, serverUrl: settings.serverUrl },
    };
  });

  ipcMain.handle("site:choose", async (_event, payload) => {
    try {
      if (!settings) settings = loadSettings(paths.root);
      const mode = payload?.mode === "local" ? "local" : "cloud";
      const serverUrl =
        mode === "cloud"
          ? normalizeServerUrl(payload?.serverUrl || DEFAULT_CLOUD_URL)
          : settings.serverUrl;

      settings = saveSettings(paths.root, { ...settings, mode, serverUrl });
      logLine(`site selected mode=${mode} url=${serverUrl}`);

      if (DEV_MODE) {
        dialog.showMessageBoxSync({
          type: "info",
          title: "开发模式",
          message: "站点已保存，请退出并重新运行 npm run desktop:dev。",
          buttons: ["继续"],
        });
        sitePickerWindow?.close();
        return { ok: true, requiresRestart: true };
      }

      app.relaunch();
      app.quit();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.on("site:cancel", () => {
    sitePickerWindow?.close();
  });
}

function showCredentials() {
  if (!config) return;
  const result = dialog.showMessageBoxSync({
    type: "info",
    title: "本地登录与密码",
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
    title: "重置本地密码",
    message: "确定要重置本地登录密码吗？",
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
    title: "新密码已生成",
    message: "新密码已复制到剪贴板",
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
    title: "服务日志",
    message: "暂无日志",
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
  const ses = session.fromPartition(CLOUD_PARTITION);
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
  if (mainWindow) {
    await mainWindow.loadURL(`${settings.serverUrl}/sign-in`);
  }
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const cloud = runtimeMode === "cloud";
  const accountItems = cloud
    ? [
        { label: "退出登录", click: () => void signOutCloud() },
        {
          label: "重新加载",
          click: () => void mainWindow?.reload(),
        },
      ]
    : [
        { label: "本地登录与密码…", click: showCredentials },
        {
          label: "重新加载",
          click: () => void mainWindow?.reload(),
        },
      ];

  const siteItem = {
    label: "切换登录站点…",
    click: () => openSitePicker(),
  };

  const template = [
    ...(isMac
      ? [
          {
            label: "ai2dot",
            submenu: [
              { role: "about" },
              { type: "separator" },
              ...accountItems,
              siteItem,
              { type: "separator" },
              {
                label: "打开设置文件（云端地址）",
                click: showSettingsFile,
              },
              {
                label: "打开数据目录",
                click: showDataFolder,
              },
              {
                label: "查看服务日志",
                click: showServerLog,
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "selectAll" },
      ],
    },
    {
      label: "账号",
      submenu: [...accountItems, { type: "separator" }, siteItem],
    },
    {
      label: "查看",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(DEV_MODE ? [{ role: "toggleDevTools" }] : []),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front" }]
          : [{ role: "close" }]),
      ],
    },
    ...(isMac
      ? []
      : [
          {
            label: "帮助",
            submenu: [
              ...accountItems,
              siteItem,
              { label: "打开设置文件", click: showSettingsFile },
              { label: "打开数据目录", click: showDataFolder },
              { label: "查看服务日志", click: showServerLog },
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

    if (DEV_URL) {
      runtimeMode = "local";
      config = loadOrCreateConfig(paths.root);
      appOrigin = new URL(DEV_URL).origin;
      startUrl = `${DEV_URL.replace(/\/+$/, "")}/workspace`;
      logLine(`using development server ${startUrl}`);
      createSplash("正在启动本地工作台");
    } else if (settings.mode === "cloud") {
      runtimeMode = "cloud";
      appOrigin = new URL(settings.serverUrl).origin;
      const signedIn = await hasCloudSession();
      startUrl = `${settings.serverUrl}${signedIn ? "/workspace" : "/sign-in"}`;
      logLine(`using cloud server ${startUrl}`);
      createSplash("正在连接云端工作台");
    } else {
      runtimeMode = "local";
      config = loadOrCreateConfig(paths.root);
      createSplash("正在启动本地工作台");

      const port = await findFreePort();
      const env = buildServerEnv({ config, paths, port });
      const appRoot = appRootPath();
      const started = startServer({
        appRoot,
        env,
        logFile: paths.serverLog,
        label: "next-standalone",
      });
      serverChild = started.child;
      serverLogStream = started.stream;
      appOrigin = `http://127.0.0.1:${port}`;
      startUrl = `${appOrigin}/workspace`;

      serverChild.on("exit", (code, signal) => {
        logLine(`server exited code=${code} signal=${signal}`);
        if (!quitting) {
          closeSplash();
          dialog.showErrorBox(
            "ai2dot 本地服务已停止",
            `本地服务意外退出（code ${code ?? "null"}）。\n\n日志：${paths.serverLog}`,
          );
          app.quit();
        }
      });

      logLine(`starting local server on ${appOrigin}`);
      await waitForServer(appOrigin, { child: serverChild, timeoutMs: 120_000 });
      logLine("local server is ready");
    }

    Menu.setApplicationMenu(buildMenu());
    await createMainWindow();
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
