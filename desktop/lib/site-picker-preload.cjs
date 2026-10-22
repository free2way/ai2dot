const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sitePicker", {
  listSites: () => ipcRenderer.invoke("sites:list"),
  saveSites: (sites) => ipcRenderer.invoke("sites:save", sites),
  resetSites: () => ipcRenderer.invoke("sites:reset"),
  choose: (payload) => ipcRenderer.invoke("site:choose", payload),
  cancel: () => ipcRenderer.send("site:cancel"),
  onView: (callback) => {
    ipcRenderer.on("site:view", (_event, view) => callback(view));
  },
});
