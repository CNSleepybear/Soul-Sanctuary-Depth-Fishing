// ===== src/renderer/ui/SceneUI.ts =====
// Scene-level UI: START button, toolbar (Fishpedia/Settings), backdrop.
// Controls auto-rotate during idle. Bridges RunUI panels with the scene.

import { EventBus } from '../core/EventBus';
import { GameEvents } from '../../shared/events';
import { i18n } from '../i18n/I18n';
import { THEME } from './theme';
import { LOCATIONS } from '../data/location-data';

export class SceneUI {
  private eventBus: EventBus;
  private container: HTMLDivElement;
  private backdrop: HTMLDivElement;
  private startBtn: HTMLDivElement;
  private toolbar: HTMLDivElement;
  private devMode: boolean;

  // Callbacks set by owner
  onStart: (() => void) | null = null;
  onFishpedia: (() => void) | null = null;
  onSouls: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  onScenePrev: (() => void) | null = null;
  onSceneNext: (() => void) | null = null;

  private _autoRotate = false; // start still, rotate after idle
  private _runActive = false;
  private _idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_AUTOROTATE_DELAY = 3000;
  private _themeColor = '#44dd88';

  constructor(eventBus: EventBus, devMode = false) {
    this.devMode = devMode;
    this.eventBus = eventBus;
    // Start idle timer immediately — rotate after 3s of no interaction
    this._resetIdleTimer();
    this.container = document.createElement('div');
    this.container.id = 'scene-ui';
    this.container.style.cssText =
      'position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 55;';
    document.body.appendChild(this.container);

    // ── Backdrop (dims scene when panels open) ──
    this.backdrop = document.createElement('div');
    this.backdrop.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: none;
      pointer-events: all;
    `;
    this.backdrop.addEventListener('click', () => {}); // block clicks through to scene
    this.container.appendChild(this.backdrop);

    // ── START button (center of scene, visible when idle) ──
    this.startBtn = document.createElement('div');
    this.startBtn.id = 'btn-start';
    this.startBtn.dataset.testid = 'start-button';
    this.startBtn.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 10px 36px;
      background: ${this._hexToRgba(this._themeColor, 0.28)};
      border: 1px solid ${this._hexToRgba(this._themeColor, 0.55)};
      color: ${this._themeColor}; font-family: ${THEME.panel.font};
      font-size: 13px; letter-spacing: 3px;
      cursor: pointer; pointer-events: all;
      border-radius: ${THEME.radius.sm}; display: none;
      transition: background 0.2s, box-shadow 0.2s;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    `;
    this.startBtn.textContent = i18n.t('ui.start');
    // Guide text above button
    const guide = document.createElement('div');
    guide.style.cssText = `
      position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%);
      color: ${THEME.text.secondary}; font-family: ${THEME.panel.font};
      font-size: 9px; letter-spacing: 2px; pointer-events: none;
      text-shadow: 0 1px 4px rgba(0,0,0,0.6);
    `;
    guide.textContent = i18n.t('ui.castHint');
    this.container.appendChild(guide);
    this.startBtn.addEventListener('mouseenter', () => {
      this.startBtn.style.background = this._hexToRgba(this._themeColor, 0.42);
      this.startBtn.style.boxShadow = `0 0 24px ${this._hexToRgba(this._themeColor, 0.35)}, 0 4px 16px rgba(0,0,0,0.25)`;
    });
    this.startBtn.addEventListener('mouseleave', () => {
      this.startBtn.style.background = this._hexToRgba(this._themeColor, 0.28);
      this.startBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    });
    this.startBtn.addEventListener('mousedown', () => {
      this.startBtn.style.transform = 'translate(-50%, -50%) scale(0.94)';
    });
    this.startBtn.addEventListener('mouseup', () => {
      this.startBtn.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    this.startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startBtn.style.pointerEvents = 'none';
      this.startBtn.style.opacity = '0.3';
      if (this.onStart) this.onStart();
    });
    this.container.appendChild(this.startBtn);

    // ── Toolbar (bottom-right icons) ──
    this.toolbar = document.createElement('div');
    this.toolbar.style.cssText = `
      position: absolute; bottom: 8px; right: 8px; z-index: 10;
      display: flex; gap: 6px; pointer-events: none;
    `;

    // DEV: scene test buttons (prev/next location) — only visible in dev mode
    if (this.devMode) {
      const prevBtn = this._makeIcon('◀', 'Prev Location (Dev)');
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onScenePrev) this.onScenePrev();
      });
      this.toolbar.appendChild(prevBtn);

      const nextBtn = this._makeIcon('▶', 'Next Location (Dev)');
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onSceneNext) this.onSceneNext();
      });
      this.toolbar.appendChild(nextBtn);
    }

    const bookBtn = this._makeIcon('📖', i18n.t('ui.fishpedia'));
    bookBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onFishpedia) this.onFishpedia();
    });
    this.toolbar.appendChild(bookBtn);

    const soulBtn = this._makeIcon('🔮', i18n.t('ui.souls'));
    soulBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSouls) this.onSouls();
    });
    this.toolbar.appendChild(soulBtn);

    const settingsBtn = this._makeIcon('⚙️', i18n.t('ui.settings'));
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSettings) this.onSettings();
    });
    this.toolbar.appendChild(settingsBtn);

    this.container.appendChild(this.toolbar);

    // ── Idle auto-rotate: stop on ANY click, resume after 3s idle (works during fishing too) ──
    this.eventBus.on('input:down', () => {
      this._autoRotate = false;
      this._resetIdleTimer();
    });

    // REF-4: adapt scene UI accent to location theme
    this.eventBus.on(GameEvents.GAME_LOCATION_CHANGE, (p) => {
      const loc = LOCATIONS.find((l) => l.id === p.locationId);
      if (loc?.theme) {
        this._themeColor = '#' + loc.theme.uiAccent.toString(16).padStart(6, '0');
        this.startBtn.style.background = this._hexToRgba(this._themeColor, 0.18);
        this.startBtn.style.borderColor = this._hexToRgba(this._themeColor, 0.4);
        this.startBtn.style.color = this._themeColor;
      }
    });

    // ── Subscribe to run state ──
    this.eventBus.on(GameEvents.RUN_START, () => {
      this._runActive = true;
      this._autoRotate = false;
      this._clearIdleTimer();
      this.startBtn.style.display = 'none';
    });
    this.eventBus.on(GameEvents.RUN_END, () => {
      this._runActive = false;
      this._autoRotate = true;
    });
    this.eventBus.on(GameEvents.GAME_PHASE_CHANGE, (p) => {
      if (p.phase === 'menu') {
        this._runActive = false;
        this._autoRotate = true;
        this.startBtn.style.display = 'block';
      }
      if (p.phase === 'fishing') {
        this.startBtn.style.display = 'none';
      }
    });
  }

  private _makeIcon(symbol: string, title: string): HTMLDivElement {
    const btn = document.createElement('div');
    btn.textContent = symbol;
    btn.title = title;
    btn.style.cssText = `
      width: 24px; height: 24px; display: flex;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.25);
      border: 1px solid ${THEME.border.strong};
      border-radius: ${THEME.radius.sm}; font-size: 12px;
      cursor: pointer; pointer-events: all;
      transition: background 0.15s;
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(0,0,0,0.45)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0,0,0,0.25)';
    });
    return btn;
  }

  get autoRotate(): boolean {
    return this._autoRotate;
  }

  private _resetIdleTimer(): void {
    this._clearIdleTimer();
    this._idleTimer = setTimeout(() => {
      if (!this._runActive) this._autoRotate = true;
    }, this.IDLE_AUTOROTATE_DELAY);
  }

  private _clearIdleTimer(): void {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  /** Show backdrop + return its element for panel stacking. */
  showBackdrop(): void {
    this.backdrop.style.display = 'block';
  }

  hideBackdrop(): void {
    this.backdrop.style.display = 'none';
  }

  showStart(): void {
    if (!this._runActive) {
      this.startBtn.style.display = 'block';
      this.startBtn.style.pointerEvents = 'all';
      this.startBtn.style.opacity = '1';
    }
  }

  hideStart(): void {
    this.startBtn.style.display = 'none';
  }

  private _hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  dispose(): void {
    this._clearIdleTimer();
    this.container.remove();
  }
}
