const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  scanFolder: (path) => ipcRenderer.invoke("scan-folder", path),
  organizeFolder: (path) => ipcRenderer.invoke("organize-folder", path),
});
