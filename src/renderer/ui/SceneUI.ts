// ===== src/renderer/ui/SceneUI.ts =====
// Scene-level UI: brand mark, location plate, main action, tool group, backdrop.
// The window stays transparent — only these surfaces carry colour. The drag bar
// and window controls are owned by index.ts / main.css and remain untouched.
// Bridges RunUI panels with the 3D scene and drives idle auto-rotation.

import { EventBus } from '../core/EventBus';
import { GameEvents } from '../../shared/events';
import { i18n } from '../i18n/I18n';
import { svgIcon } from './icons';
import type { IconName } from './icons';
import { LOCATIONS } from '../data/location-data';
import { FISH_DATABASE } from '../data/fish-database';

export class SceneUI {
  private eventBus: EventBus;
  private container: HTMLDivElement;
  private backdrop: HTMLDivElement;
  private startBtn: HTMLDivElement;
  private toolbar: HTMLDivElement;
  private locationPlate: HTMLDivElement;
  private plateIndex!: HTMLSpanElement;
  private plateCountry!: HTMLSpanElement;
  private plateName!: HTMLElement;
  private plateNameEn!: HTMLSpanElement;
  private plateMood!: HTMLSpanElement;
  private plateProgress!: HTMLSpanElement;
  private plateBarFill!: HTMLElement;
  private devMode: boolean;

  // Callbacks set by owner
  onStart: (() => void) | null = null;
  onFishpedia: (() => void) | null = null;
  onSouls: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  onScenePrev: (() => void) | null = null;
  onSceneNext: (() => void) | null = null;

  private _autoRotate = false;
  private _runActive = false;
  private _idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_AUTOROTATE_DELAY = 6000;
  private _locationId = 'japan';
  private _discoveredCount = 0;

  constructor(eventBus: EventBus, devMode = false) {
    this.devMode = devMode;
    this.eventBus = eventBus;
    this._resetIdleTimer();

    this.container = document.createElement('div');
    this.container.id = 'scene-ui';
    document.body.appendChild(this.container);
    document.body.dataset.phase = 'menu';

    // ── Brand mark (top-left) ──
    const wordmark = document.createElement('div');
    wordmark.id = 'sanctuary-wordmark';
    wordmark.innerHTML = `
      <span class="brand-mark">${svgIcon('soul', 13)}</span>
      <span class="brand-text">
        <span class="brand-name">SOUL SANCTUARY</span>
        <i class="brand-sub">${i18n.t('ui.brandTag')}</i>
      </span>`;
    this.container.appendChild(wordmark);

    // ── Location plate (top-left, below the brand) ──
    this.locationPlate = document.createElement('div');
    this.locationPlate.id = 'location-plate';
    this.locationPlate.innerHTML = `
      <div class="plate-head">
        <span class="plate-index">01</span>
        <span class="plate-divider">/</span>
        <span class="plate-total">12</span>
        <span class="plate-spacer"></span>
        <span class="plate-country">JAPAN</span>
        <span class="plate-progress"></span>
      </div>
      <strong class="plate-name"></strong>
      <span class="plate-name-en"></span>
      <span class="plate-mood">${i18n.t('scene.mood')}</span>
      <span class="plate-bar"><i></i></span>`;
    this.container.appendChild(this.locationPlate);
    this.plateIndex = this.locationPlate.querySelector('.plate-index') as HTMLSpanElement;
    this.plateCountry = this.locationPlate.querySelector('.plate-country') as HTMLSpanElement;
    this.plateName = this.locationPlate.querySelector('.plate-name') as HTMLElement;
    this.plateNameEn = this.locationPlate.querySelector('.plate-name-en') as HTMLSpanElement;
    this.plateMood = this.locationPlate.querySelector('.plate-mood') as HTMLSpanElement;
    this.plateProgress = this.locationPlate.querySelector('.plate-progress') as HTMLSpanElement;
    this.plateBarFill = this.locationPlate.querySelector('.plate-bar > i') as HTMLElement;

    // ── Tagline above the main action ──
    const guide = document.createElement('div');
    guide.id = 'scene-guide';
    guide.textContent = i18n.t('ui.castHint');
    this.container.appendChild(guide);

    // ── Backdrop (dims scene while a panel is open) ──
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'scene-backdrop';
    this.backdrop.addEventListener('click', (e) => e.stopPropagation());
    this.container.appendChild(this.backdrop);

    // ── Main action: start fishing ──
    this.startBtn = document.createElement('div');
    this.startBtn.id = 'btn-start';
    this.startBtn.setAttribute('role', 'button');
    this.startBtn.tabIndex = 0;
    this.startBtn.dataset.testid = 'start-button';
    this.startBtn.innerHTML = `
      ${svgIcon('rod', 15)}
      <span class="btn-start__label">${i18n.t('ui.startFishing')}</span>
      <span class="btn-start__sub">START</span>`;
    this.startBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.startBtn.click();
      }
    });
    this.startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startBtn.style.pointerEvents = 'none';
      this.startBtn.style.opacity = '0.3';
      if (this.onStart) this.onStart();
    });
    this.container.appendChild(this.startBtn);

    // ── Tool group (bottom-right) ──
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'scene-toolbar';
    this.container.appendChild(this.toolbar);

    // Keep the fishpedia button first in DOM order: capture scripts use the
    // first aria-labelled toolbar button containing an SVG to open the guide.
    const bookBtn = this._makeTool('book', i18n.t('scene.openFishpedia'));
    bookBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onFishpedia) this.onFishpedia();
    });
    this.toolbar.appendChild(bookBtn);

    const soulBtn = this._makeTool('soul', i18n.t('scene.openSouls'));
    soulBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSouls) this.onSouls();
    });
    this.toolbar.appendChild(soulBtn);

    const settingsBtn = this._makeTool('settings', i18n.t('scene.openSettings'));
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSettings) this.onSettings();
    });
    this.toolbar.appendChild(settingsBtn);

    if (this.devMode) {
      const prevBtn = this._makeTool('chevronLeft', i18n.t('scene.prevLocation'), true);
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onScenePrev) this.onScenePrev();
      });
      this.toolbar.appendChild(prevBtn);
      const nextBtn = this._makeTool('chevronRight', i18n.t('scene.nextLocation'), true);
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onSceneNext) this.onSceneNext();
      });
      this.toolbar.appendChild(nextBtn);
    }

    this._renderPlate();

    // ── Idle auto-rotate: stop on any click, resume after idle ──
    this.eventBus.on('input:down', () => {
      this._autoRotate = false;
      this._resetIdleTimer();
    });

    // ── Location transitions ──
    this.eventBus.on(GameEvents.GAME_LOCATION_CHANGE, (p) => {
      this._locationId = p.locationId;
      const loc = LOCATIONS.find((l) => l.id === p.locationId);
      if (loc?.theme) {
        const accent = '#' + loc.theme.uiAccent.toString(16).padStart(6, '0');
        document.documentElement.style.setProperty('--location-accent', accent);
      }
      this._renderPlate();
    });

    // ── Field-guide progress on the plate ──
    this.eventBus.on(GameEvents.GAME_FISHPEDIA_COUNT_UPDATE, (p) => {
      this._discoveredCount = p.count;
      this._renderPlateProgress();
    });

    // ── Run state ──
    this.eventBus.on(GameEvents.RUN_START, () => {
      document.body.dataset.phase = 'fishing';
      this._runActive = true;
      this._autoRotate = false;
      this._clearIdleTimer();
      this.startBtn.style.display = 'none';
    });
    this.eventBus.on(GameEvents.RUN_END, () => {
      document.body.dataset.phase = 'menu';
      this._runActive = false;
      this._autoRotate = true;
    });
    this.eventBus.on(GameEvents.GAME_PHASE_CHANGE, (p) => {
      document.body.dataset.phase = p.phase;
      if (p.phase === 'menu') {
        this._runActive = false;
        this._autoRotate = true;
        this.showStart();
      }
      if (p.phase === 'fishing' || p.phase === 'run_prep') {
        this.startBtn.style.display = 'none';
      }
    });
  }

  // ══ Plate ══

  private _renderPlate(): void {
    const index = Math.max(
      0,
      LOCATIONS.findIndex((l) => l.id === this._locationId),
    );
    const loc = LOCATIONS[index];
    if (!loc) return;
    const total = String(LOCATIONS.length);
    this.locationPlate.dataset.number = String(index + 1).padStart(2, '0');
    document.body.dataset.location = loc.id;
    this.plateIndex.textContent = String(index + 1).padStart(2, '0');
    const totalEl = this.locationPlate.querySelector('.plate-total');
    if (totalEl) totalEl.textContent = total;
    this.plateCountry.textContent = loc.country;
    this.plateName.textContent = loc.name[i18n.lang];
    this.plateNameEn.textContent = i18n.lang === 'zh' ? loc.name.en : loc.name.zh;
    this.plateMood.textContent = i18n.t('scene.mood');
    this._renderPlateProgress();
  }

  private _renderPlateProgress(): void {
    const total = FISH_DATABASE.length || 1;
    const pct = Math.max(0, Math.min(1, this._discoveredCount / total));
    this.plateBarFill.style.transform = `scaleX(${pct})`;
    this.plateProgress.textContent = i18n.t('scene.progress', {
      '0': this._discoveredCount,
      '1': FISH_DATABASE.length,
    });
  }

  // ══ Tools ══

  private _makeTool(icon: IconName, title: string, dev = false): HTMLDivElement {
    const btn = document.createElement('div');
    btn.className = dev ? 'scene-tool dev-scene-tool' : 'scene-tool';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', title);
    btn.title = title;
    btn.tabIndex = 0;
    btn.innerHTML = svgIcon(icon, dev ? 12 : 15);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
    return btn;
  }

  // ══ Public API ══

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

  /** Show the dimmed backdrop used behind camp / picker / result panels. */
  showBackdrop(): void {
    this.backdrop.style.display = 'block';
    document.body.dataset.panelOpen = 'true';
  }

  hideBackdrop(): void {
    this.backdrop.style.display = 'none';
    delete document.body.dataset.panelOpen;
  }

  showStart(): void {
    if (!this._runActive) {
      this.startBtn.style.display = 'inline-flex';
      this.startBtn.style.pointerEvents = 'all';
      this.startBtn.style.opacity = '1';
    }
  }

  hideStart(): void {
    this.startBtn.style.display = 'none';
  }

  dispose(): void {
    this._clearIdleTimer();
    this.container.remove();
  }
}
