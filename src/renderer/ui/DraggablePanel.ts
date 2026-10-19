// ===== src/renderer/ui/DraggablePanel.ts =====
// Floating draggable panel — shared shell for camp, charm picker, result screens.
// Styling lives in src/styles/main.css (.sanctuary-panel); the panel can be
// dragged by its header and is vertically clamped so it never leaves the window.

import { svgIcon } from './icons';
import type { IconName } from './icons';

export class DraggablePanel {
  readonly el: HTMLDivElement;
  private header: HTMLDivElement;
  private body: HTMLDivElement;
  private closeBtn: HTMLDivElement;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panelStartX = 0;
  private panelStartY = 0;

  constructor(title: string, width = 320, icon?: IconName) {
    this.el = document.createElement('div');
    this.el.className = 'sanctuary-panel';
    this.el.style.cssText = `
      left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: ${width}px; max-width: calc(100vw - 24px); max-height: calc(100vh - 20px);
      z-index: 200;
    `;

    // ── Header (drag handle) ──
    this.header = document.createElement('div');
    this.header.className = 'sanctuary-panel-header';
    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'panel-head__icon';
      iconEl.innerHTML = svgIcon(icon, 14);
      this.header.appendChild(iconEl);
    }
    const titleSpan = document.createElement('span');
    titleSpan.className = 'panel-head__title';
    titleSpan.textContent = title;
    this.header.appendChild(titleSpan);

    this.closeBtn = document.createElement('div');
    this.closeBtn.className = 'panel-close-btn';
    this.closeBtn.dataset.testid = 'panel-close-btn';
    this.closeBtn.setAttribute('role', 'button');
    this.closeBtn.setAttribute('aria-label', 'Close panel');
    this.closeBtn.tabIndex = 0;
    this.closeBtn.innerHTML = svgIcon('close', 12);
    this.closeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.remove();
      }
    });
    this.header.appendChild(this.closeBtn);
    this.el.appendChild(this.header);

    // ── Body (scrollable) ──
    this.body = document.createElement('div');
    this.body.className = 'sanctuary-panel-body';
    this.el.appendChild(this.body);

    // ── Drag behaviour ──
    this.header.addEventListener('mousedown', this._onDragStart);
    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup', this._onDragEnd);

    // Prevent click-through to the 3D scene.
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  getBody(): HTMLDivElement {
    return this.body;
  }

  getCloseBtn(): HTMLDivElement {
    return this.closeBtn;
  }

  /** Place the panel, clamped to the window edges. */
  setPosition(x: number, y: number): void {
    const rect = this.el.getBoundingClientRect();
    const width = rect.width || parseFloat(this.el.style.width) || 320;
    const height = rect.height || 0;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - Math.min(height, window.innerHeight - 16) - 8);
    this.el.style.left = `${Math.max(8, Math.min(x, maxLeft))}px`;
    this.el.style.top = `${Math.max(8, Math.min(y, maxTop))}px`;
    this.el.style.transform = 'none';
  }

  remove(): void {
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }

  private _onDragStart = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    const target = e.target as Node | null;
    if (target && this.closeBtn.contains(target)) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const rect = this.el.getBoundingClientRect();
    this.panelStartX = rect.left;
    this.panelStartY = rect.top;
    this.header.style.cursor = 'grabbing';
    e.preventDefault();
  };

  private _onDragMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const x = this.panelStartX + dx;
    const y = this.panelStartY + dy;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    this.el.style.left = `${Math.max(0, Math.min(x, Math.max(0, window.innerWidth - w)))}px`;
    this.el.style.top = `${Math.max(0, Math.min(y, Math.max(0, window.innerHeight - Math.min(h, 30))))}px`;
    this.el.style.transform = 'none';
  };

  private _onDragEnd = (): void => {
    this.dragging = false;
    this.header.style.cursor = 'grab';
  };
}
