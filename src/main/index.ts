// ===== src/main/index.ts =====
// Electron main process entry point.

import { app, ipcMain } from 'electron';
import { WindowManager } from './window-manager';
import { TrayManager } from './tray-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { IpcChannel } from '../shared/ipc';

let windowManager: WindowManager;
let trayManager: TrayManager;

// ═══════════════════════════════════════════════════════════════════════════════
// Single instance lock: prevent multiple Soul Sanctuary processes
// ═══════════════════════════════════════════════════════════════════════════════
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[Main] Another instance is already running. Quitting.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  // Someone launched the app again while it's running — show the existing window
  windowManager?.show();
  windowManager?.browserWindow?.focus();
});

app
  .whenReady()
  .then(() => {
    windowManager = new WindowManager();

    // Create the desktop widget window
    windowManager.createWindow();

    // Set up system tray
    trayManager = new TrayManager(windowManager);
    trayManager.create();

    // Register IPC handlers
    registerIpcHandlers(windowManager);

    // Register global shortcut
    windowManager.registerGlobalShortcut();

    // Start in idle mode (click-through)
    windowManager.setInteractive(false);
  })
  .catch((err: unknown) => {
    console.error('[Main] Failed to initialize app:', err);
    app.exit(1);
  });

// On window close (X button) the app should fully exit, not hide in tray.
app.on('window-all-closed', () => {
  app.quit();
});

// Save before actual quit; wait for renderer acknowledgement to avoid data loss
let _saveComplete = false;
let _quitAfterSave = false;
app.on('before-quit', (event) => {
  if (_saveComplete) return;
  event.preventDefault();
  if (_quitAfterSave) return; // already waiting
  _quitAfterSave = true;

  const saveTimeout = setTimeout(() => {
    console.warn('[Main] Save acknowledgement timeout; forcing exit');
    _saveComplete = true;
    app.exit(0);
  }, 1000);

  ipcMain.once(IpcChannel.WindowSaveComplete, () => {
    clearTimeout(saveTimeout);
    _saveComplete = true;
    app.quit();
  });

  windowManager?.requestSave();
});

// Cleanup on quit
app.on('will-quit', () => {
  windowManager?.unregisterGlobalShortcut();
  trayManager?.destroy();
});
