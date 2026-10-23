const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sitePicker", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  openFolder: () => ipcRenderer.invoke("settings:open-folder"),
  onLanguage: (callback) => { ipcRenderer.on("desktop:language-changed", (_event, language) => callback(language)); },
  listSites: () => ipcRenderer.invoke("sites:list"),
  saveSites: (sites) => ipcRenderer.invoke("sites:save", sites),
  resetSites: () => ipcRenderer.invoke("sites:reset"),
  choose: (payload) => ipcRenderer.invoke("site:choose", payload),
  cancel: () => ipcRenderer.send("site:cancel"),
  onView: (callback) => {
    ipcRenderer.on("site:view", (_event, view) => callback(view));
  },
});
