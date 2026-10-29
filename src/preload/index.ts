import { contextBridge, ipcRenderer } from "electron";
import type { DesktopCore } from "../shared/contracts";
const core: DesktopCore = {
  runtime: Object.freeze({
    sandboxed: process.sandboxed === true,
    contextIsolated: process.contextIsolated,
  }),
  inspectImport: () => ipcRenderer.invoke("core:inspectImport"),
  commitImport: (input) => ipcRenderer.invoke("core:commitImport", input),
  cancelImport: () => ipcRenderer.invoke("core:cancelImport"),
  getDashboard: (input) => ipcRenderer.invoke("core:getDashboard", input),
  getState: () => ipcRenderer.invoke("core:getState"),
  createWorkspace: (input) => ipcRenderer.invoke("core:createWorkspace", input),
  selectWorkspace: (input) => ipcRenderer.invoke("core:selectWorkspace", input),
  renameWorkspace: (input) => ipcRenderer.invoke("core:renameWorkspace", input),
  updateAppearance: (input) =>
    ipcRenderer.invoke("core:updateAppearance", input),
  updateSidebar: (input) => ipcRenderer.invoke("core:updateSidebar", input),
  exportBackup: () => ipcRenderer.invoke("core:exportBackup"),
  inspectRestore: () => ipcRenderer.invoke("core:inspectRestore"),
  confirmRestore: (input) => ipcRenderer.invoke("core:confirmRestore", input),
  cancelRestore: () => ipcRenderer.invoke("core:cancelRestore"),
  openDataFolder: () => ipcRenderer.invoke("core:openDataFolder"),
};
contextBridge.exposeInMainWorld("desktop", Object.freeze(core));
