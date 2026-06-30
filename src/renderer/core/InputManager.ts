// ===== src/renderer/core/InputManager.ts =====
// Unified mouse + keyboard input. Mode-aware dispatch.
// Emits: input:down, input:up, input:hold, input:shortcut

import { EventBus } from './EventBus';

export class InputManager {
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement | null = null;
  private _isHolding = false;
  private holdStartTime = 0;
  private enabled = true; // disabled during idle click-through mode

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Attach mouse listeners to the game canvas and keyboard to document. */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mouseup', this._onMouseUp);
    // Keyboard is attached to document so shortcuts work even when the
    // transparent canvas does not have focus.
    document.addEventListener('keydown', this._onKeyDown);
    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      this.canvas.removeEventListener('mouseup', this._onMouseUp);
      this.canvas.removeEventListener('contextmenu', this._onContextMenu);
      this.canvas = null;
    }
    document.removeEventListener('keydown', this._onKeyDown);
  }

  get isHolding(): boolean {
    return this._isHolding;
  }

  /** Enable/disable input (used for click-through mode switching). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this._isHolding = false;
    }
  }

  update(_dt: number): void {
    // If holding, emit periodic hold event
    if (this._isHolding) {
      const duration = (performance.now() - this.holdStartTime) / 1000;
      this.eventBus.emit('input:hold', { duration });
    }
  }

  private _onMouseDown = (_e: MouseEvent): void => {
    if (!this.enabled) return;
    this._isHolding = true;
    this.holdStartTime = performance.now();
    this.eventBus.emit('input:down', { timestamp: this.holdStartTime });
  };

  private _onMouseUp = (_e: MouseEvent): void => {
    if (!this.enabled || !this._isHolding) return;
    this._isHolding = false;
    const holdDuration = (performance.now() - this.holdStartTime) / 1000;
    this.eventBus.emit('input:up', { holdDuration });
  };

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    this.eventBus.emit('input:shortcut', { key: e.key });
  };

  private _onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };
}
