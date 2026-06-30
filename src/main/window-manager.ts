// ===== src/main/window-manager.ts =====
// Desktop widget window: frameless, position memory, click-through toggle.

import { BrowserWindow, globalShortcut, screen, app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { logger } from '../shared/logger';
import { IpcChannel } from '../shared/ipc';

interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

const BOUNDS_FILE = 'window-bounds.json';

export class WindowManager {
  private win: BrowserWindow | null = null;
  private lastPosition: { x: number; y: number } | null = null;
  private boundsPath: string;

  constructor() {
    this.boundsPath = join(app.getPath('userData'), BOUNDS_FILE);
  }

  private loadBounds(): Partial<WindowBounds> | undefined {
    try {
      if (existsSync(this.boundsPath)) {
        const raw = readFileSync(this.boundsPath, 'utf-8');
        return JSON.parse(raw) as Partial<WindowBounds>;
      }
    } catch (err: unknown) {
      logger.warn('[WindowManager] Failed to load window bounds:', err);
    }
    return undefined;
  }

  private saveBounds(bounds: Partial<WindowBounds>): void {
    writeFile(this.boundsPath, JSON.stringify(bounds), 'utf-8').catch((err: unknown) => {
      logger.warn('[WindowManager] Failed to save window bounds:', err);
    });
  }

  get browserWindow(): BrowserWindow | null {
    return this.win;
  }

  createWindow(bounds?: Partial<WindowBounds>): BrowserWindow {
    // Default: bottom-right corner, compact desktop widget size
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const saved = this.loadBounds();
    const winW = bounds?.width ?? saved?.width ?? 400;
    const winH = bounds?.height ?? saved?.height ?? 300;
    const winX = bounds?.x ?? saved?.x ?? screenW - winW - 20;
    const winY = bounds?.y ?? saved?.y ?? screenH - winH - 20;

    this.win = new BrowserWindow({
      width: winW,
      height: winH,
      x: winX,
      y: winY,
      frame: false, // No title bar / borders
      transparent: true, // Desktop visible through transparent pixels
      backgroundColor: '#00000000', // ARGB transparent — critical for Windows
      hasShadow: false, // No rectangular window shadow
      thickFrame: false, // No thick window frame on Windows
      alwaysOnTop: true, // Float above other windows
      skipTaskbar: true, // Hide from taskbar (tray-only)
      resizable: false, // Fixed size
      show: false,
      webPreferences: {
        preload: join(__dirname, '../../dist-electron/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load renderer
    const loadPromise = process.env.VITE_DEV_SERVER_URL
      ? this.win.loadURL(process.env.VITE_DEV_SERVER_URL)
      : this.win.loadFile(join(__dirname, '../renderer/index.html'));
    loadPromise.catch((err: unknown) => {
      console.error('[WindowManager] Failed to load renderer:', err);
    });

    this.win.on('ready-to-show', () => {
      this.win?.show();
    });

    // Forward focus/blur/minimize/restore to renderer so it can pause rendering/audio
    this.win.on('focus', () => {
      this.win?.webContents.send(IpcChannel.WindowFocus);
    });
    this.win.on('blur', () => {
      this.win?.webContents.send(IpcChannel.WindowBlur);
    });
    this.win.on('minimize', () => {
      this.win?.webContents.send(IpcChannel.WindowBlur);
    });
    this.win.on('restore', () => {
      this.win?.webContents.send(IpcChannel.WindowFocus);
    });

    // Save position on move/resize for next launch
    const updateBounds = () => {
      if (!this.win) return;
      const [x, y] = this.win.getPosition();
      const [width, height] = this.win.getSize();
      this.lastPosition = { x, y };
      this.saveBounds({ x, y, width, height });
    };
    this.win.on('moved', updateBounds);
    this.win.on('resized', updateBounds);

    // Close button (X) → fully quit the app (single-instance, no tray hide)
    this.win.on('close', () => {
      this.unregisterGlobalShortcut();
    });

    return this.win;
  }

  /** Register global shortcut: Ctrl+Shift+F → toggle fishing mode */
  registerGlobalShortcut(): void {
    const registered = globalShortcut.register('CommandOrControl+Shift+F', () => {
      if (!this.win) return;
      if (this.win.isVisible() && !this.win.isMinimized()) {
        // Window is visible → toggle interactive mode
        this.win.webContents.send(IpcChannel.WindowShortcut, { key: 'toggle_fish' });
      } else {
        // Window hidden → show and start fishing
        this.win.show();
        this.win.focus();
        this.win.webContents.send(IpcChannel.WindowShortcut, { key: 'toggle_fish' });
      }
    });

    if (!registered) {
      logger.warn('[WindowManager] Failed to register global shortcut Ctrl+Shift+F');
    }
  }

  unregisterGlobalShortcut(): void {
    globalShortcut.unregister('CommandOrControl+Shift+F');
  }

  /** Toggle interactive mode. In viewing mode the window ignores mouse events and forwards them. */
  setInteractive(interactive: boolean): void {
    if (!this.win) return;
    this.win.setFocusable(interactive);
    // Click-through only when not interactive; forward events so tray/shortcut still work
    if (interactive) {
      this.win.setIgnoreMouseEvents(false);
    } else {
      this.win.setIgnoreMouseEvents(true, { forward: true });
    }
  }

  setAlwaysOnTop(flag: boolean): void {
    this.win?.setAlwaysOnTop(flag);
  }

  setZoomFactor(scale: number): void {
    this.win?.webContents.setZoomFactor(scale);
  }

  setSize(w: number, h: number): void {
    if (this.win) {
      // Temporarily allow resize, apply, then lock again
      this.win.resizable = true;
      this.win.setSize(w, h, true); // true = animate resize
      this.win.resizable = false;
      // Preserve current position if available; otherwise default to bottom-right
      const [x, y] = this.win.getPosition();
      this.saveBounds({ x, y, width: w, height: h });
    }
  }

  flashWindow(): void {
    this.win?.flashFrame(true);
  }

  show(): void {
    this.win?.show();
  }
  hide(): void {
    this.win?.hide();
  }
  isVisible(): boolean {
    return this.win?.isVisible() ?? false;
  }

  requestSave(): void {
    this.win?.webContents.send(IpcChannel.WindowRequestSave);
  }

  getPosition(): { x: number; y: number } | null {
    return this.lastPosition;
  }
}
