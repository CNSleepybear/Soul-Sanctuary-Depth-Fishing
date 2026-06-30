// ===== src/main/ipc-handlers.ts =====
// IPC channel handlers: window control, save/load, app info.

import { ipcMain, app } from 'electron';
import { join } from 'path';
import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { logger } from '../shared/logger';
import { IpcChannel } from '../shared/ipc';
import type { WindowManager } from './window-manager';

// Lazy-init: app.getPath() only available after app.whenReady()
let _saveDir: string | null = null;

function saveDir(): string {
  if (!_saveDir) {
    _saveDir = join(app.getPath('userData'), 'saves');
  }
  return _saveDir;
}

async function ensureSaveDir(): Promise<void> {
  const dir = saveDir();
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

function savePath(slot: number): string {
  return join(saveDir(), `slot_${slot}.json`);
}

export function registerIpcHandlers(windowManager: WindowManager): void {
  // Window control
  ipcMain.handle(IpcChannel.WindowSetAlwaysOnTop, (_event, flag: boolean) => {
    windowManager.setAlwaysOnTop(flag);
  });

  ipcMain.handle(IpcChannel.WindowSetInteractive, (_event, flag: boolean) => {
    windowManager.setInteractive(flag);
  });

  ipcMain.handle(IpcChannel.WindowSetZoomFactor, (_event, scale: number) => {
    windowManager.setZoomFactor(scale);
  });

  ipcMain.handle(IpcChannel.WindowSetSize, (_event, w: number, h: number) => {
    windowManager.setSize(w, h);
  });

  ipcMain.handle(IpcChannel.WindowHide, () => {
    windowManager.hide();
  });

  ipcMain.handle(IpcChannel.WindowFlash, () => {
    windowManager.flashWindow();
  });

  // Save/Load — file-based persistence in userData directory (async)
  ipcMain.handle(IpcChannel.SaveWrite, async (_event, slot: number, data: string) => {
    try {
      await ensureSaveDir();
      await writeFile(savePath(slot), data, 'utf-8');
      return true;
    } catch (e) {
      logger.error('[IPC] save:write failed:', e);
      return false;
    }
  });

  ipcMain.handle(IpcChannel.SaveRead, async (_event, slot: number) => {
    try {
      await ensureSaveDir();
      const path = savePath(slot);
      return await readFile(path, 'utf-8');
    } catch (e) {
      // File does not exist or cannot be read — return null
      logger.warn('[IPC] save:read unavailable:', e);
      return null;
    }
  });

  // App info
  ipcMain.handle(IpcChannel.AppGetVersion, () => app.getVersion());
  ipcMain.handle(IpcChannel.AppQuit, () => {
    // before-quit handler will request save and wait for acknowledgement
    app.quit();
  });
}
