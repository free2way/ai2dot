/* Shared by native menus and the local desktop pages. */
const desktopEnglish = {
  "当前登录站点": "Current site",
  "当前站点": "Current site", "未选择": "No site selected", "本地模式": "Local mode",
  "本机数据库 · 离线模式": "Local database · Offline mode", "切换站点": "Switch site", "管理站点": "Manage sites",
  "设置": "Settings", "通用": "General", "站点": "Sites", "关于": "About", "语言": "Language",
  "选择登录站点": "Choose a site", "管理登录站点": "Manage sites", "取消": "Cancel", "返回": "Back", "保存": "Save", "关闭": "Close",
  "正在读取站点…": "Reading site…", "正在加载工作台…": "Loading workspace…", "正在连接": "Connecting", "已连接": "Connected", "连接失败": "Connection failed", "网络离线": "Offline",
  "无法连接工作台": "Unable to connect", "请检查网络或站点地址，然后重试。": "Check your connection or site address, then try again.", "重试": "Retry",
  "云端": "Cloud", "离线": "Offline", "本机": "This computer", "正在切换…": "Switching…",
  "使用该站点的账号、会话与知识库。": "Use this site's account, chats, and knowledge.",
  "使用本机独立账号和数据库。模型服务仍可能需要联网。": "Use a separate local account and database. Model services may still require a connection.",
  "切换无需重启；输入中的文字会自动保存。": "Switch without restarting. Unsent text is saved automatically.",
  "登录账号与业务数据归属所选站点；本地模式使用本机独立数据库。": "Accounts and data belong to the selected site. Local mode uses a separate database on this computer.",
  "地址需使用 HTTPS，本机调试可使用 HTTP；最多 10 个站点。": "Use HTTPS, or HTTP for localhost. Up to 10 sites.",
  "名称": "Name", "站点地址": "Site address", "站点名称": "Site name", "删除": "Delete", "+ 添加站点": "+ Add site", "恢复默认": "Restore defaults", "新站点": "New site",
  "保存后选择站点即可切换。": "Save, then select a site to switch.", "最多支持 10 个站点。": "Up to 10 sites are supported.", "至少保留一个站点。": "Keep at least one site.", "站点名称和地址不能为空。": "Enter a name and address for each site.",
  "保存失败，请重试。": "Could not save. Please try again.", "恢复默认失败。": "Could not restore defaults.", "已恢复默认站点。": "Default sites restored.", "站点已保存。": "Sites saved.",
  "语言会同步到工作台、菜单及所有站点。": "Language is shared across the workspace, menus, and all sites.",
  "登录时启动 ai2dot": "Open ai2dot at login", "仅在安装后的 macOS 应用中可用。": "Available in the installed macOS app.",
  "客户端版本": "App version", "当前连接": "Current connection", "服务端版本": "Server version", "未知": "Unavailable", "打开数据目录": "Open data folder", "查看服务日志": "View server logs",
  "编辑": "Edit", "账号": "Account", "查看": "View", "窗口": "Window", "帮助": "Help",
  "退出登录": "Sign out of this site", "重新加载": "Reload", "强制重新加载": "Force reload", "开发者工具": "Developer tools", "实际大小": "Actual size", "放大": "Zoom in", "缩小": "Zoom out",
  "切换登录站点…": "Switch site…", "管理站点…": "Manage sites…", "设置…": "Settings…", "本地模式（离线）": "Local mode (offline)", "本地登录与密码…": "Local account and password…", "打开设置文件（云端地址）": "Open settings file", "打开设置文件": "Open settings file",
  "允许": "Allow", "拒绝": "Deny", "麦克风/摄像头权限": "Microphone / camera permission", "ai2dot 请求使用麦克风或摄像头，是否允许？": "Allow ai2dot to use the microphone or camera?",
  "正在启动本地工作台": "Starting local workspace", "正在连接云端工作台": "Connecting to cloud workspace", "无法切换站点": "Could not switch site",
  "撤销": "Undo", "重做": "Redo", "剪切": "Cut", "复制": "Copy", "粘贴": "Paste", "粘贴并匹配样式": "Paste and match style", "全选": "Select all", "退出": "Quit", "最小化": "Minimize", "缩放": "Zoom", "关闭窗口": "Close window", "进入全屏": "Toggle fullscreen", "全部置前": "Bring all to front", "服务": "Services", "隐藏 ai2dot": "Hide ai2dot", "隐藏其他": "Hide others", "显示全部": "Show all",
};
function desktopT(language, text) { return language === "en" ? desktopEnglish[text] ?? text : text; }
if (typeof module !== "undefined") module.exports = { desktopT };
else globalThis.desktopT = desktopT;
