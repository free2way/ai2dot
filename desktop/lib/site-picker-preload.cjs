const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sitePicker", {
  current: () => ipcRenderer.invoke("site:current"),
  choose: (payload) => ipcRenderer.invoke("site:choose", payload),
  cancel: () => ipcRenderer.send("site:cancel"),
});
