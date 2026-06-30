// ===== src/shared/ipc.ts =====
// Shared IPC channel names and renderer-side API type.
// Imported by both main process (preload, handlers, window-manager) and renderer.

export enum IpcChannel {
  WindowSetAlwaysOnTop = 'window:setAlwaysOnTop',
  WindowSetInteractive = 'window:setInteractive',
  WindowSetZoomFactor = 'window:setZoomFactor',
  WindowSetSize = 'window:setSize',
  WindowHide = 'window:hide',
  WindowFlash = 'window:flash',

  SaveWrite = 'save:write',
  SaveRead = 'save:read',

  AppGetVersion = 'app:getVersion',
  AppQuit = 'app:quit',

  // Main → Renderer events
  WindowFocus = 'window:focus',
  WindowBlur = 'window:blur',
  WindowShortcut = 'window:shortcut',
  WindowRequestSave = 'window:request_save',

  // Renderer → Main events
  WindowSaveComplete = 'window:save_complete',
}

export interface ElectronAPI {
  setAlwaysOnTop: (flag: boolean) => Promise<void>;
  setInteractive: (flag: boolean) => Promise<void>;
  setZoomFactor: (scale: number) => Promise<void>;
  setWindowSize: (w: number, h: number) => Promise<void>;
  hideWindow: () => Promise<void>;
  flashWindow: () => Promise<void>;
  saveData: (slot: number, data: string) => Promise<boolean>;
  loadData: (slot: number) => Promise<string | null>;
  getVersion: () => Promise<string>;
  quit: () => Promise<void>;

  onFocus: (cb: () => void) => () => void;
  onBlur: (cb: () => void) => () => void;
  onShortcut: (cb: (data: { key: string }) => void) => () => void;
  onRequestSave: (cb: () => void) => () => void;
  notifySaveComplete: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
