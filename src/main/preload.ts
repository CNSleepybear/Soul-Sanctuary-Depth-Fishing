// ===== src/main/preload.ts =====
// Context bridge: exposes safe IPC to renderer via window.electronAPI

import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, type ElectronAPI } from '../shared/ipc';

const api: ElectronAPI = {
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke(IpcChannel.WindowSetAlwaysOnTop, flag),
  setInteractive: (flag: boolean) => ipcRenderer.invoke(IpcChannel.WindowSetInteractive, flag),
  setZoomFactor: (scale: number) => ipcRenderer.invoke(IpcChannel.WindowSetZoomFactor, scale),
  setWindowSize: (w: number, h: number) => ipcRenderer.invoke(IpcChannel.WindowSetSize, w, h),
  hideWindow: () => ipcRenderer.invoke(IpcChannel.WindowHide),
  flashWindow: () => ipcRenderer.invoke(IpcChannel.WindowFlash),
  saveData: (slot: number, data: string) => ipcRenderer.invoke(IpcChannel.SaveWrite, slot, data),
  loadData: (slot: number) => ipcRenderer.invoke(IpcChannel.SaveRead, slot),
  getVersion: () => ipcRenderer.invoke(IpcChannel.AppGetVersion),
  quit: () => ipcRenderer.invoke(IpcChannel.AppQuit),

  // Main → Renderer event forwarding
  onFocus: (cb: () => void) => {
    ipcRenderer.on(IpcChannel.WindowFocus, cb);
    return () => ipcRenderer.removeListener(IpcChannel.WindowFocus, cb);
  },
  onBlur: (cb: () => void) => {
    ipcRenderer.on(IpcChannel.WindowBlur, cb);
    return () => ipcRenderer.removeListener(IpcChannel.WindowBlur, cb);
  },
  onShortcut: (cb: (data: { key: string }) => void) => {
    ipcRenderer.on(IpcChannel.WindowShortcut, (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners(IpcChannel.WindowShortcut);
  },
  onRequestSave: (cb: () => void) => {
    ipcRenderer.on(IpcChannel.WindowRequestSave, cb);
    return () => ipcRenderer.removeAllListeners(IpcChannel.WindowRequestSave);
  },
  notifySaveComplete: () => ipcRenderer.send(IpcChannel.WindowSaveComplete),
};

contextBridge.exposeInMainWorld('electronAPI', api);
