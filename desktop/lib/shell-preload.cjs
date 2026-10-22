const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopShell", {
  getStatus: () => ipcRenderer.invoke("desktop:status"),
  openSites: (view) => ipcRenderer.invoke("desktop:open-sites", view),
  onStatus: (callback) => {
    ipcRenderer.on("desktop:status-changed", (_event, status) => callback(status));
  },
});
