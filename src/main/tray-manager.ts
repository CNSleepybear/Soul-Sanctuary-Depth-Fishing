// ===== src/main/tray-manager.ts =====
// System tray icon with context menu: Start Fishing, Change Location, Always on Top, Quit.

import { Tray, Menu, nativeImage, app, type NativeImage } from 'electron';
import { IpcChannel } from '../shared/ipc';
import { join } from 'path';
import type { WindowManager } from './window-manager';

export class TrayManager {
  private tray: Tray | null = null;
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  create(): void {
    // Use a simple 16×16 icon — create a colored square as fallback
    const iconPath = join(__dirname, '../../assets/icons/tray-icon.png');
    let icon: NativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
    } catch {
      // Fallback: create a tiny blank icon
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('Soul Sanctuary');

    this.updateMenu();

    // Double-click tray icon → show and focus the existing window
    this.tray.on('double-click', () => {
      this.windowManager.show();
      this.windowManager.browserWindow?.focus();
    });
  }

  private updateMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '开始垂钓',
        click: () => {
          this.windowManager.show();
          this.windowManager.browserWindow?.webContents.send(IpcChannel.WindowShortcut, {
            key: 'toggle_fish',
          });
        },
      },
      {
        label: '切换圣地',
        click: () => {
          this.windowManager.show();
          this.windowManager.browserWindow?.webContents.send(IpcChannel.WindowShortcut, {
            key: 'change_location',
          });
        },
      },
      { type: 'separator' },
      {
        label: '窗口置顶',
        type: 'checkbox',
        checked: false,
        click: (menuItem) => {
          this.windowManager.setAlwaysOnTop(menuItem.checked);
        },
      },
      { type: 'separator' },
      {
        label: '退出 Soul Sanctuary',
        click: () => {
          // before-quit handler will request save and wait for acknowledgement
          app.quit();
        },
      },
    ]);

    this.tray?.setContextMenu(contextMenu);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
