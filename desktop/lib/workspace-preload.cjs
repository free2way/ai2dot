const { contextBridge, ipcRenderer } = require("electron");
const pending = new Set();
function writeDraft(key, value) {
  const task = ipcRenderer.invoke("workspace:draft-set", key, value);
  pending.add(task);
  task.then(() => pending.delete(task), () => pending.delete(task));
  return task;
}
contextBridge.exposeInMainWorld("ai2dotDesktop", {
  getLanguage: () => ipcRenderer.invoke("workspace:language"),
  setLanguage: (language) => ipcRenderer.invoke("workspace:language-set", language),
  onLanguage: (callback) => {
    const listener = (_event, language) => callback(language);
    ipcRenderer.on("workspace:language-changed", listener);
    return () => ipcRenderer.removeListener("workspace:language-changed", listener);
  },
  getDraft: (key) => ipcRenderer.invoke("workspace:draft-get", key),
  setDraft: writeDraft,
});
ipcRenderer.on("workspace:flush", async (_event, id) => {
  await Promise.allSettled([...pending]);
  ipcRenderer.send("workspace:flushed", id);
});
window.addEventListener("online", () => ipcRenderer.send("workspace:network", true));
window.addEventListener("offline", () => ipcRenderer.send("workspace:network", false));
