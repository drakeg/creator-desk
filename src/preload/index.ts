import { contextBridge, ipcRenderer } from "electron";
import type { DesktopCore } from "../shared/contracts";
const core: DesktopCore = {
  shorts: Object.freeze({
    get: () => ipcRenderer.invoke("core:shortsGet"),
    chooseVideo: () => ipcRenderer.invoke("core:shortsChooseVideo"),
    chooseFFmpeg: () => ipcRenderer.invoke("core:shortsChooseFFmpeg"),
    importTranscript: () => ipcRenderer.invoke("core:shortsImportTranscript"),
    saveAI: (input: Parameters<DesktopCore["shorts"]["saveAI"]>[0]) =>
      ipcRenderer.invoke("core:shortsSaveAI", input),
    removeAI: (input: { purpose: import("../shared/shorts").AiPurpose }) =>
      ipcRenderer.invoke("core:shortsRemoveAI", input),
    testAI: (input: { purpose: import("../shared/shorts").AiPurpose }) =>
      ipcRenderer.invoke("core:shortsTestAI", input),
    transcribe: () => ipcRenderer.invoke("core:shortsTranscribe"),
    suggest: () => ipcRenderer.invoke("core:shortsSuggest"),
    saveDraft: (input: import("../shared/shorts").Clip) =>
      ipcRenderer.invoke("core:shortsSaveDraft", input),
    exportClip: (input: import("../shared/shorts").Clip) =>
      ipcRenderer.invoke("core:shortsExport", input),
    cancel: () => ipcRenderer.invoke("core:shortsCancel"),
  }),
  runtime: Object.freeze({
    sandboxed: process.sandboxed === true,
    contextIsolated: process.contextIsolated,
  }),
  inspectImport: () => ipcRenderer.invoke("core:inspectImport"),
  commitImport: (input) => ipcRenderer.invoke("core:commitImport", input),
  cancelImport: () => ipcRenderer.invoke("core:cancelImport"),
  getDashboard: (input) => ipcRenderer.invoke("core:getDashboard", input),
  openGoogleSetup: (input) => ipcRenderer.invoke("core:openGoogleSetup", input),
  useAppGoogleClient: () => ipcRenderer.invoke("core:useAppGoogleClient"),
  getYouTube: () => ipcRenderer.invoke("core:getYouTube"),
  importYouTubeClient: () => ipcRenderer.invoke("core:importYouTubeClient"),
  connectYouTube: () => ipcRenderer.invoke("core:connectYouTube"),
  cancelYouTube: () => ipcRenderer.invoke("core:cancelYouTube"),
  disconnectYouTube: () => ipcRenderer.invoke("core:disconnectYouTube"),
  syncYouTubeDaily: (input) =>
    ipcRenderer.invoke("core:syncYouTubeDaily", input),
  syncYouTubeUploads: () => ipcRenderer.invoke("core:syncYouTubeUploads"),
  syncYouTube: () => ipcRenderer.invoke("core:syncYouTube"),
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
