// ===== src/renderer/ui/DraggablePanel.ts =====
// Floating draggable panel — for camp, charm picker, result screens.
// Positioned independently from the 3D scene; can be dragged by its header.

import { THEME } from './theme';

export class DraggablePanel {
  readonly el: HTMLDivElement;
  private header: HTMLDivElement;
  private body: HTMLDivElement;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panelStartX = 0;
  private panelStartY = 0;

  constructor(title: string, width = 320) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: ${width}px; max-height: 85vh; overflow-y: auto;
      background: ${THEME.panel.bg};
      border: ${THEME.panel.border};
      border-radius: ${THEME.panel.radius};
      font-family: ${THEME.panel.font};
      z-index: 200;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      user-select: none;
    `;

    // Drag header
    this.header = document.createElement('div');
    this.header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; cursor: grab;
      border-bottom: 1px solid ${THEME.border.subtle};
      background: rgba(255,255,255,0.04);
      border-radius: ${THEME.panel.radiusTop};
      font-size: 12px; color: ${THEME.text.secondary}; letter-spacing: 1px;
    `;
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    this.header.appendChild(titleSpan);

    // Close button — larger hit target with × symbol
    const close = document.createElement('div');
    close.className = 'panel-close-btn';
    close.dataset.testid = 'panel-close-btn';
    close.style.cssText = `
      width: 18px; height: 18px; border-radius: 50%;
      background: rgba(255,80,80,0.35); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: rgba(255,200,200,0.7);
      line-height: 1; font-weight: bold;
      transition: background 0.2s, color 0.2s;
    `;
    close.textContent = '×';
    close.addEventListener('mouseenter', () => {
      close.style.background = 'rgba(255,50,50,0.7)';
      close.style.color = 'rgba(255,255,255,1)';
    });
    close.addEventListener('mouseleave', () => {
      close.style.background = 'rgba(255,80,80,0.35)';
      close.style.color = 'rgba(255,200,200,0.7)';
    });
    this.header.appendChild(close);

    this.el.appendChild(this.header);

    // Body
    this.body = document.createElement('div');
    this.body.style.cssText = 'padding: 14px; color: ${THEME.text.primary};';
    this.el.appendChild(this.body);

    // Drag events
    this.header.addEventListener('mousedown', this._onDragStart);
    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup', this._onDragEnd);

    // Prevent click-through on body
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  getBody(): HTMLDivElement {
    return this.body;
  }
  getCloseBtn(): HTMLDivElement {
    return this.header.lastChild as HTMLDivElement;
  }

  setPosition(x: number, y: number): void {
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.transform = 'none';
  }

  remove(): void {
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }

  private _onDragStart = (e: MouseEvent): void => {
    if (e.target === this.header.lastChild) return; // close button
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const rect = this.el.getBoundingClientRect();
    this.panelStartX = rect.left;
    this.panelStartY = rect.top;
    this.header.style.cursor = 'grabbing';
  };

  private _onDragMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const x = this.panelStartX + dx;
    const y = this.panelStartY + dy;
    const w = this.el.offsetWidth;
    this.el.style.left = `${Math.max(0, Math.min(x, window.innerWidth - w))}px`;
    this.el.style.top = `${Math.max(0, Math.min(y, window.innerHeight - 30))}px`;
    this.el.style.transform = 'none';
  };

  private _onDragEnd = (): void => {
    this.dragging = false;
    this.header.style.cursor = 'grab';
  };
}
