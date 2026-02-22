const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  checkBackendHealth: () => ipcRenderer.invoke("backend-health"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  scanFolder: (path) => ipcRenderer.invoke("scan-folder", path),
  organizeDryRun: (path) => ipcRenderer.invoke("organize-folder-dry-run", path),
  organizeFolder: (path) => ipcRenderer.invoke("organize-folder", path),
  setGpuAcceleration: (enabled) => ipcRenderer.invoke("gpu-acceleration-set", enabled),
  closeApp: () => ipcRenderer.invoke("window-close"),
});
