// ===== src/renderer/ui/FishingUI.ts =====
// DOM overlay system for fishing HUD: cast power bar, tension bar,
// hook indicator, catch result popup, notifications.

import { EventBus } from '../core/EventBus';
import { GameEvents } from '../../shared/events';
import { i18n } from '../i18n/I18n';
import { LOCATIONS } from '../data/location-data';
import { CatchQuality, FishRarity } from '../../shared/enums';
import { BALANCE } from '../../shared/constants';
import { THEME } from './theme';
import type { SpiritFish } from '../../shared/types';

export class FishingUI {
  // EXT-7: Global fishpedia count for catch popup display
  static fishpediaCount = 0;

  private static readonly notificationTimers = new WeakMap<HTMLDivElement, number>();

  private eventBus: EventBus;
  private container: HTMLDivElement;

  // UI element refs
  private _themeColor = '#44dd88';
  private castBar: HTMLDivElement | null = null;
  private castFill: HTMLDivElement | null = null;
  private tensionBar: HTMLDivElement | null = null;
  private tensionFill: HTMLDivElement | null = null;
  private tensionMarker: HTMLDivElement | null = null;
  private progressBar: HTMLDivElement | null = null;
  private progressFill: HTMLDivElement | null = null;
  private fishNameLabel: HTMLDivElement | null = null;
  private hookIndicator: HTMLDivElement | null = null;
  private hookTimer: HTMLDivElement | null = null;
  private catchPopup: HTMLDivElement | null = null;
  private notification: HTMLDivElement | null = null;

  private unsubs: (() => void)[] = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.container = document.createElement('div');
    this.container.id = 'fishing-ui';
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; z-index: 50;
      font-family: ${THEME.panel.font};
    `;
    document.body.appendChild(this.container);

    this._buildUI();
    this._subscribe();

    // EXT-7: listen for fishpedia count updates from GameStateManager
    this.unsubs.push(
      this.eventBus.on(GameEvents.GAME_FISHPEDIA_COUNT_UPDATE, (p) => {
        FishingUI.fishpediaCount = p.count;
      }),
    );

    // REF-4: adapt UI accent to current location theme
    this.unsubs.push(
      this.eventBus.on(GameEvents.GAME_LOCATION_CHANGE, (p) => {
        const loc = this._findLocation(p.locationId);
        if (loc?.theme) {
          this._themeColor = '#' + loc.theme.uiAccent.toString(16).padStart(6, '0');
          this._applyThemeColor();
        }
      }),
    );
  }

  private _findLocation(id: string) {
    return LOCATIONS.find((l) => l.id === id);
  }

  private _applyThemeColor(): void {
    if (this.castFill)
      this.castFill.style.background = `linear-gradient(90deg, ${this._themeColor}, #ffcc00)`;
    if (this.progressFill)
      this.progressFill.style.background = `linear-gradient(180deg, ${this._themeColor}, #2288cc)`;
  }

  // ── Build all DOM elements ──

  private _buildUI(): void {
    // ══ Cast Power Bar (bottom center) ══
    this.castBar = this._createDiv('cast-bar');
    this.castBar.style.cssText = `
      position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
      width: 200px; height: 12px;
      background: rgba(255,255,255,0.08);
      border: 1px solid ${THEME.border.strong};
      display: none;
      border-radius: ${THEME.radius.sm};
    `;
    this.castFill = this._createDiv('cast-fill');
    this.castFill.style.cssText = `
      height: 100%; width: 0%;
      background: linear-gradient(90deg, ${THEME.accent.green}, ${THEME.accent.yellow}, ${THEME.accent.red});
      transition: width 0.05s linear;
    `;
    this.castBar.appendChild(this.castFill);

    // Overshoot marker
    const overshootMarker = this._createDiv('cast-overshoot');
    overshootMarker.style.cssText = `
      position: absolute; top: 0; height: 100%; width: 2px;
      left: ${BALANCE.castOvershootThreshold * 100}%;
      background: rgba(255,80,80,0.6);
    `;
    this.castBar.appendChild(overshootMarker);

    // Cast label
    const castLabel = this._createDiv('cast-label');
    castLabel.style.cssText = `
      position: absolute; bottom: 16px; left: 0; right: 0;
      text-align: center; color: #f0f0f0;
      font-size: 9px; letter-spacing: 1px;
      text-shadow: 0 0 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5);
    `;
    castLabel.textContent = i18n.t('fishing.holdToCast');
    this.castBar.appendChild(castLabel);

    this.container.appendChild(this.castBar);

    // ══ Progress Bar (left side — mirror of tension) ══
    this.progressBar = this._createDiv('progress-bar');
    this.progressBar.style.cssText = `
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      width: 8px; height: 160px;
      background: rgba(255,255,255,0.06);
      border: 1px solid ${THEME.border.strong};
      border-radius: ${THEME.radius.sm};
      display: none;
    `;
    this.progressFill = this._createDiv('progress-fill');
    this.progressFill.style.cssText = `
      position: absolute; left: 1px; right: 1px; bottom: 1px;
      height: 0%;
      background: linear-gradient(180deg, ${this._themeColor}, ${THEME.accent.cyan});
      border-radius: ${THEME.radius.md}; box-shadow: 0 0 6px rgba(68,170,255,0.3);
      transition: height 0.15s linear;
    `;
    this.progressBar.appendChild(this.progressFill);
    const progLabel = this._createDiv('progress-label');
    progLabel.style.cssText = `
      position: absolute; top: -18px; left: 0; right: 0;
      text-align: center; color: #f0f0f0;
      font-size: 8px; letter-spacing: 1px;
      text-shadow: 0 0 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5);
    `;
    progLabel.textContent = i18n.t('fishing.catch');
    this.progressBar.appendChild(progLabel);
    this.container.appendChild(this.progressBar);

    // Fish name during reel
    this.fishNameLabel = this._createDiv('fish-name-label');
    this.fishNameLabel.style.cssText = `
      position: absolute; top: 28%; left: 50%; transform: translateX(-50%);
      color: #ffffff; font-size: 11px; letter-spacing: 1px; font-weight: bold;
      display: none; pointer-events: none; text-align: center;
      text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6);
    `;
    this.container.appendChild(this.fishNameLabel);

    // ══ Tension Bar (right side) ══
    this.tensionBar = this._createDiv('tension-bar');
    this.tensionBar.style.cssText = `
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      width: 8px; height: 160px;
      background: rgba(255,255,255,0.06);
      border: 1px solid ${THEME.border.strong};
      border-radius: ${THEME.radius.sm};
      display: none;
    `;

    // Green zone
    const greenZone = this._createDiv('tension-zone-green');
    greenZone.style.cssText = `
      position: absolute; left: 0; right: 0;
      bottom: 0; height: ${BALANCE.tensionGreenMax}%;
      background: rgba(68,221,136,0.15);
      border-radius: 0 0 ${THEME.radius.md} ${THEME.radius.md};
    `;
    this.tensionBar.appendChild(greenZone);

    // Yellow zone
    const yellowZone = this._createDiv('tension-zone-yellow');
    yellowZone.style.cssText = `
      position: absolute; left: 0; right: 0;
      bottom: ${BALANCE.tensionGreenMax}%;
      height: ${BALANCE.tensionYellowMax - BALANCE.tensionGreenMax}%;
      background: rgba(255,204,0,0.12);
    `;
    this.tensionBar.appendChild(yellowZone);

    // Red zone
    const redZone = this._createDiv('tension-zone-red');
    redZone.style.cssText = `
      position: absolute; left: 0; right: 0;
      bottom: ${BALANCE.tensionYellowMax}%;
      height: ${100 - BALANCE.tensionYellowMax}%;
      background: rgba(255,68,68,0.12);
      border-radius: ${THEME.radius.md} ${THEME.radius.md} 0 0;
    `;
    this.tensionBar.appendChild(redZone);

    this.tensionFill = this._createDiv('tension-fill');
    this.tensionFill.style.cssText = `
      position: absolute; left: 1px; right: 1px; bottom: 1px;
      height: 0%;
      background: ${THEME.accent.green};
      border-radius: ${THEME.radius.md}; box-shadow: 0 0 4px rgba(68,221,136,0.2);
      transition: height 0.1s linear;
    `;
    this.tensionBar.appendChild(this.tensionFill);

    this.tensionMarker = this._createDiv('tension-marker');
    this.tensionMarker.style.cssText = `
      position: absolute; left: -2px; right: -2px;
      height: 3px;
      background: #ffffff;
      border-radius: 2px;
      transition: bottom 0.1s linear;
    `;
    this.tensionBar.appendChild(this.tensionMarker);

    // Label
    const tensionLabel = this._createDiv('tension-label');
    tensionLabel.style.cssText = `
      position: absolute; top: -18px; left: 0; right: 0;
      text-align: center; color: #f0f0f0;
      font-size: 8px; letter-spacing: 1px;
      text-shadow: 0 0 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5);
    `;
    tensionLabel.textContent = i18n.t('fishing.tension');
    this.tensionBar.appendChild(tensionLabel);

    this.container.appendChild(this.tensionBar);

    // ══ Hook Indicator (center) ══
    this.hookIndicator = this._createDiv('hook-indicator');
    this.hookIndicator.style.cssText = `
      position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%);
      padding: 10px 28px;
      background: rgba(255,50,50,0.92);
      border: 2px solid rgba(255,150,150,0.7);
      color: ${THEME.text.white}; font-size: 20px; font-weight: bold;
      letter-spacing: 3px; text-align: center;
      display: none; pointer-events: none;
      border-radius: ${THEME.radius.sm};
      animation: hook-pulse 0.4s ease-in-out infinite;
    `;
    this.hookIndicator.textContent = i18n.t('fishing.click');
    this.hookTimer = this._createDiv('hook-timer');
    this.hookTimer.style.cssText = `
      position: absolute; bottom: -24px; left: 0; right: 0;
      height: 4px; background: rgba(255,255,255,0.15);
      border-radius: ${THEME.radius.sm}; overflow: hidden;
    `;
    const hookTimerFill = this._createDiv('hook-timer-fill');
    hookTimerFill.style.cssText = `
      height: 100%; width: 100%; background: ${THEME.accent.redLight};
      border-radius: ${THEME.radius.sm}; transition: width 0.1s linear;
    `;
    hookTimerFill.id = 'hook-timer-fill';
    this.hookTimer.appendChild(hookTimerFill);
    this.hookIndicator.appendChild(this.hookTimer);
    this.container.appendChild(this.hookIndicator);

    // ══ Catch Result Popup ─═
    this.catchPopup = this._createDiv('catch-popup');
    this.catchPopup.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 16px 32px;
      background: rgba(0,0,0,0.92);
      border: 1px solid rgba(255,255,255,0.35);
      color: ${THEME.text.primary}; text-align: center;
      display: none; min-width: 200px;
      pointer-events: none;
      border-radius: ${THEME.radius.sm};
      z-index: 400;
    `;
    document.body.appendChild(this.catchPopup);

    // ══ Notification ─═
    this.notification = this._createDiv('notification');
    this.notification.style.cssText = `
      position: absolute; top: 38px; left: 50%; transform: translateX(-50%);
      padding: 5px 16px;
      background: rgba(0,0,0,0.88);
      border: 1px solid rgba(255,255,255,0.18);
      color: ${THEME.text.white}; font-size: 10px; letter-spacing: 1px; font-weight: bold;
      opacity: 0; transition: opacity 0.3s ease;
      border-radius: ${THEME.radius.md};
    `;
    this.container.appendChild(this.notification);

    // ── Hook pulse + mythic glow animations ──
    const style = document.createElement('style');
    style.textContent = `
      @keyframes hook-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.08); }
      }
      @keyframes mythic-pulse {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 0.6; }
      }
      @keyframes float-gold {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); }
        20% { transform: translate(-50%, -60%) scale(1.1); }
        100% { opacity: 0; transform: translate(-50%, -120%) scale(1); }
      }
    `;
    document.head.appendChild(style);

    // ══ Idle hint ══
    const idleHint = this._createDiv('idle-hint');
    idleHint.style.cssText = `
      position: absolute; bottom: 55px; left: 50%; transform: translateX(-50%);
      color: #f0f0f0; font-size: 9px; letter-spacing: 1px;
      pointer-events: none;
      text-shadow: 0 0 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5);
    `;
    idleHint.textContent = i18n.t('fishing.clickToCast');
    this.container.appendChild(idleHint);
  }

  // ── Event subscriptions ──

  private waitingIndicator: HTMLDivElement | null = null;
  // EXT-5: Probe count label shown during waiting
  private probeLabel: HTMLDivElement | null = null;
  // POLISH-1: Window border glow element for bite alerts
  private biteGlow: HTMLDivElement | null = null;

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.FISHING_NIBBLE, () =>
        this._showNotification(i18n.t('fishing.nibble'), 'info'),
      ),
      this.eventBus.on(GameEvents.FISHING_BITE, (p) => {
        this._hideWaiting();
        if (p.hookWindowMs) this.setHookDuration(p.hookWindowMs);
        this._showHookIndicator();
        // POLISH-1: Window border glow on bite
        this._triggerBiteGlow();
      }),
      this.eventBus.on(GameEvents.FISHING_HOOK_SET, (p) => {
        this._hideHookIndicator();
        this._showFishName(p.fish);
      }),
      this.eventBus.on(GameEvents.FISHING_REEL_UPDATE, (p) => {
        this._updateTensionBar(p.tension);
        this._updateProgressBar(p.fishProgress);
        this._updateBehaviorLabel(p.fish);
      }),
      this.eventBus.on(GameEvents.FISHING_BURST, () => this._flashTensionBar()),
      this.eventBus.on(GameEvents.FISHING_CATCH, () => {
        this._hideWaiting();
      }),
      this.eventBus.on(GameEvents.UI_SHOW_CATCH_FEEDBACK, (p) => {
        this._hideWaiting();
        this._showCatchResult(p);
      }),
      this.eventBus.on(GameEvents.FISHING_ESCAPE, (p) => {
        this._hideWaiting();
        this._showEscape(p);
      }),
      this.eventBus.on(GameEvents.FISHING_LINE_BREAK, (p) => {
        this._hideWaiting();
        this._showLineBreak(p);
      }),
      this.eventBus.on(GameEvents.FISHING_CAST, () => {
        this._hideCastBar();
        this._showWaiting();
      }),
      this.eventBus.on(GameEvents.FISHING_PROBE_ESCAPE, () => {
        this._hideWaiting();
        this._showNotification(i18n.t('fishing.probeEscape'), 'info');
      }),
      this.eventBus.on(GameEvents.FISHING_IDLE, () => {
        this._hideAll();
        this._showIdleHint();
      }),
      this.eventBus.on(GameEvents.FISHING_CAST_START, () => {
        this._showCastBar();
        this._hideIdleHint();
      }),
    );

    // Create waiting indicator
    this.waitingIndicator = this._createDiv('waiting-indicator');
    this.waitingIndicator.style.cssText = `
      position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      color: #f0f0f0; font-size: 11px; letter-spacing: 2px; font-weight: bold;
      display: none; pointer-events: none;
      text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6);
    `;
    this.waitingIndicator.textContent = i18n.t('fishing.waiting');
    this.container.appendChild(this.waitingIndicator);

    // EXT-5: Create probe count label
    this.probeLabel = this._createDiv('probe-label');
    this.probeLabel.style.cssText = `
      position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%);
      color: ${THEME.accent.amber}; font-size: 9px; letter-spacing: 1px; font-weight: bold;
      display: none; pointer-events: none;
      text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6);
    `;
    this.container.appendChild(this.probeLabel);
  }

  // ── Update each frame (for cast bar animation) ──

  // EXT-1: Cast zone label element
  private castZoneLabel: HTMLDivElement | null = null;

  update(castPower: number, isCasting: boolean, probesRemaining = 3): void {
    if (isCasting && this.castFill) {
      this.castFill.style.width = `${castPower * 100}%`;
      if (castPower > BALANCE.castOvershootThreshold) {
        this.castFill.style.background = '${THEME.accent.red}';
      } else if (castPower > 0.7) {
        this.castFill.style.background = '${THEME.accent.yellow}';
      } else {
        this.castFill.style.background = `linear-gradient(90deg, ${this._themeColor}, ${THEME.accent.yellow})`;
      }

      // EXT-1: Show zone label based on cast power
      if (!this.castZoneLabel) {
        this.castZoneLabel = this._createDiv('cast-zone');
        this.castZoneLabel.style.cssText = `
          position: absolute; top: -16px; left: 0; right: 0;
          text-align: center; font-size: 9px; letter-spacing: 1px; font-weight: bold;
          pointer-events: none; transition: color 0.2s;
          text-shadow: 0 0 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5);
        `;
        this.castBar?.appendChild(this.castZoneLabel);
      }
      if (castPower > BALANCE.castOvershootThreshold) {
        this.castZoneLabel.textContent = '⚠️ OVERSTRESS';
        this.castZoneLabel.style.color = '${THEME.accent.red}';
      } else if (castPower > 0.7) {
        this.castZoneLabel.textContent = '🌊 DEEP';
        this.castZoneLabel.style.color = '${THEME.accent.yellow}';
      } else if (castPower > 0.3) {
        this.castZoneLabel.textContent = '🎯 MID (balanced)';
        this.castZoneLabel.style.color = '${THEME.accent.green}';
      } else {
        this.castZoneLabel.textContent = '🏖️ SURFACE';
        this.castZoneLabel.style.color = '${THEME.accent.blue}';
      }
    }
    // EXT-5: Update probe count label
    if (this.probeLabel && this.probeLabel.style.display !== 'none') {
      this.probeLabel.textContent = `🔍 Probes: ${probesRemaining}`;
    }
    // Animate hook timer bar
    this._updateHookTimer();
  }

  // ── UI state methods ──

  private _showCastBar(): void {
    if (this.castBar) this.castBar.style.display = 'block';
    if (this.tensionBar) this.tensionBar.style.display = 'none';
    if (this.catchPopup) this.catchPopup.style.display = 'none';
  }

  private _hideCastBar(): void {
    if (this.castBar) this.castBar.style.display = 'none';
  }

  private hookStartTime = 0;
  private hookDurationMs = 1200; // default in milliseconds

  /** Set the actual hook window duration from FishingSystem (in ms). Called externally. */
  setHookDuration(durationMs: number): void {
    this.hookDurationMs = Math.max(100, durationMs);
  }

  private _showHookIndicator(): void {
    if (this.hookIndicator) {
      this.hookIndicator.style.display = 'block';
      this.hookIndicator.textContent = i18n.t('fishing.click');
      // Start timer bar
      this.hookStartTime = performance.now();
    }
  }

  private _hideHookIndicator(): void {
    if (this.hookIndicator) this.hookIndicator.style.display = 'none';
  }

  /** Called from update() to animate hook timer bar. */
  private _updateHookTimer(): void {
    if (!this.hookIndicator || this.hookIndicator.style.display === 'none') return;
    const fill = document.getElementById('hook-timer-fill');
    if (!fill) return;
    const elapsed = performance.now() - this.hookStartTime;
    const remaining = Math.max(0, 1 - elapsed / this.hookDurationMs);
    fill.style.width = `${remaining * 100}%`;
  }

  private _updateProgressBar(progress: number): void {
    if (this.progressBar) this.progressBar.style.display = 'block';
    if (this.progressFill) {
      this.progressFill.style.height = `${progress}%`;
    }
  }

  private behaviorLabel: HTMLDivElement | null = null;

  private _updateBehaviorLabel(fish: any): void {
    if (!this.behaviorLabel) {
      this.behaviorLabel = this._createDiv('behavior-label');
      this.behaviorLabel.style.cssText = `
        position: absolute; top: 32%; left: 50%; transform: translateX(-50%);
        color: #fbbf24; font-size: 10px; letter-spacing: 1px; font-weight: bold;
        pointer-events: none; display: none;
        text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6);
      `;
      this.container.appendChild(this.behaviorLabel);
    }
    if (!fish) return;
    const type = fish.behavior?.type ?? 'steady';
    const labels: Record<string, string> = {
      steady: i18n.t('behavior.steady'),
      sprint: i18n.t('behavior.sprint'),
      lazy: i18n.t('behavior.lazy'),
      zigzag: i18n.t('behavior.zigzag'),
      deep_diver: i18n.t('behavior.deepDiver'),
      surface_jumper: i18n.t('behavior.surfaceJumper'),
    };
    this.behaviorLabel.textContent = labels[type] ?? type;
    this.behaviorLabel.style.display = 'block';
  }

  private _flashTensionBar(): void {
    if (!this.tensionBar) return;
    this.tensionBar.style.boxShadow = '0 0 12px 3px rgba(255,80,80,0.8)';
    setTimeout(() => {
      if (this.tensionBar) this.tensionBar.style.boxShadow = '';
    }, 300);
  }

  private _showFishName(fish: any): void {
    if (this.fishNameLabel && fish) {
      this.fishNameLabel.textContent = fish.name?.en ?? fish.name ?? '???';
      this.fishNameLabel.style.display = 'block';
    }
  }

  private _updateTensionBar(tension: number): void {
    if (this.tensionBar) this.tensionBar.style.display = 'block';
    if (this.tensionFill) {
      this.tensionFill.style.height = `${tension}%`;
      // Color based on zone
      if (tension > BALANCE.tensionYellowMax) {
        this.tensionFill.style.background = '#ff4444';
      } else if (tension > BALANCE.tensionGreenMax) {
        this.tensionFill.style.background = '#ffcc00';
      } else {
        this.tensionFill.style.background = this._themeColor;
      }
    }
  }

  // P2-7: Fullscreen glow element for mythic catches
  private mythicGlow: HTMLDivElement | null = null;

  private _showCatchResult(payload: {
    fish: SpiritFish;
    size: number;
    quality: CatchQuality;
    gold: number;
    isSpiritVariant: boolean;
    isNewDiscovery?: boolean;
    fishpediaCount?: number;
  }): void {
    if (!this.catchPopup) return;

    // P2-7: Mythic catch — fullscreen golden glow animation
    const isMythic = payload.fish.rarity === FishRarity.Mythic;
    if (isMythic) {
      if (!this.mythicGlow) {
        this.mythicGlow = this._createDiv('mythic-glow');
        this.mythicGlow.style.cssText = `
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none; z-index: 49;
          background: radial-gradient(ellipse at center, rgba(255,215,0,0.25) 0%, transparent 70%);
          animation: mythic-pulse 0.8s ease-in-out 3;
        `;
        this.container.appendChild(this.mythicGlow);
      }
      this.mythicGlow.style.display = 'block';
      // Auto-hide after animation
      setTimeout(() => {
        if (this.mythicGlow) this.mythicGlow.style.display = 'none';
      }, 2500);
    }

    const qualityColors: Record<string, string> = {
      [CatchQuality.Perfect]: THEME.accent.gold,
      [CatchQuality.Standard]: THEME.accent.green,
      [CatchQuality.Struggle]: THEME.accent.orange,
    };

    const resultKey =
      payload.quality === CatchQuality.Perfect
        ? 'result.perfect'
        : payload.quality === CatchQuality.Struggle
          ? 'result.struggle'
          : 'result.standard';
    const mythicStar = isMythic ? '🌟 MYTHIC 🌟' : '';
    this.catchPopup.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 4px; color: ${isMythic ? THEME.accent.gold : qualityColors[payload.quality] || '#fff'}">
        ${mythicStar || i18n.t(resultKey)}
      </div>
      <div style="font-size: 13px; margin-bottom: 2px;">
        ${payload.fish.name.en}
      </div>
      <div style="font-size: 10px; color: #888; margin-bottom: 8px;">
        ${payload.size.toFixed(1)}cm · +${payload.gold}G
        ${payload.isSpiritVariant ? ' · ✦SPIRIT✦' : ''}
      </div>
      ${(payload.fishpediaCount ?? FishingUI.fishpediaCount) > 0 ? `<div style="font-size: 9px; color: #9ca3af; margin-top: 2px;">🐟 Fishpedia: ${payload.fishpediaCount ?? FishingUI.fishpediaCount}/141</div>` : ''}
      ${payload.isNewDiscovery ? `<div style="font-size: 11px; color: ${THEME.accent.greenLight}; margin-top: 4px; font-weight: bold;">✨ NEW DISCOVERY!</div>` : ''}
      <div style="font-size: 9px; color: #9ca3af; margin-top: 6px;">
        ${i18n.t('result.clickContinue')}
      </div>
    `;
    this.catchPopup.style.display = 'block';

    // BALANCE-FEEDBACK: floating gold text + extra particle emphasis on perfect/mythic
    this._showFloatingGold(payload.gold, payload.quality, isMythic);

    // Auto-hide after 3s or on click
    setTimeout(() => {
      if (this.catchPopup) this.catchPopup.style.display = 'none';
    }, 3000);
  }

  // BALANCE-FEEDBACK: animated +XXG text on successful catch
  private _showFloatingGold(amount: number, quality: CatchQuality, isMythic: boolean): void {
    const el = document.createElement('div');
    const color = isMythic
      ? THEME.accent.gold
      : quality === CatchQuality.Perfect
        ? THEME.accent.yellow
        : THEME.accent.green;
    const prefix = quality === CatchQuality.Perfect ? '✨ ' : '';
    el.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      color: ${color}; font-size: ${isMythic ? '18px' : quality === CatchQuality.Perfect ? '14px' : '11px'};
      font-weight: bold; pointer-events: none; z-index: 500;
      text-shadow: 0 0 4px rgba(0,0,0,0.8);
      animation: float-gold 1.2s ease-out forwards;
    `;
    el.textContent = `${prefix}+${amount}G`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // EXT-3: Rotate through tip messages on failure
  private _failTipIndex = 0;
  private static _FAIL_TIPS = [
    '💡 Try releasing earlier in the red zone.',
    '💡 Spirit Snare charm extends hook windows.',
    '💡 Use Deep zone casts for rare fish.',
    '💡 Perfect catches give 50% more gold.',
    '💡 Slack the line to drop tension fast.',
  ];

  private _showLineBreak(payload: { reason: string }): void {
    if (!this.catchPopup) return;
    const reasonKey =
      payload.reason === 'overshoot'
        ? 'result.overshoot'
        : payload.reason === 'worn_out'
          ? 'result.wornOut'
          : 'result.maxTension';
    const tip = FishingUI._FAIL_TIPS[this._failTipIndex % FishingUI._FAIL_TIPS.length];
    this._failTipIndex++;
    this.catchPopup.innerHTML = `
      <div style="font-size: 14px; color: ${THEME.accent.red}; margin-bottom: 4px;">
        ${i18n.t('result.lineSnap')}
      </div>
      <div style="font-size: 10px; color: #888;">
        ${i18n.t(reasonKey)}
      </div>
      <div style="font-size: 9px; color: #d4c4a8; margin-top: 6px;">
        ${tip}
      </div>
      <div style="font-size: 9px; color: #9ca3af; margin-top: 6px;">
        ${i18n.t('result.clickContinue')}
      </div>
    `;
    this.catchPopup.style.display = 'block';
    setTimeout(() => {
      if (this.catchPopup) this.catchPopup.style.display = 'none';
    }, 3000);
  }

  private _showEscape(payload: { fish: SpiritFish | null; reason: string }): void {
    if (!this.catchPopup) return;
    const tip = FishingUI._FAIL_TIPS[this._failTipIndex % FishingUI._FAIL_TIPS.length];
    this._failTipIndex++;
    this.catchPopup.innerHTML = `
      <div style="font-size: 14px; color: ${THEME.accent.orange}; margin-bottom: 4px;">
        ${i18n.t('result.escaped')}
      </div>
      <div style="font-size: 10px; color: #888;">
        ${payload.fish ? payload.fish.name.en : '?'} ${i18n.t('result.gotAway')}
      </div>
      <div style="font-size: 9px; color: #d4c4a8; margin-top: 6px;">
        ${tip}
      </div>
      <div style="font-size: 9px; color: #9ca3af; margin-top: 6px;">
        ${i18n.t('result.clickContinue')}
      </div>
    `;
    this.catchPopup.style.display = 'block';
    setTimeout(() => {
      if (this.catchPopup) this.catchPopup.style.display = 'none';
    }, 3000);
  }

  private _showWaiting(): void {
    if (this.waitingIndicator) this.waitingIndicator.style.display = 'block';
    // EXT-5: Show probe label during waiting
    if (this.probeLabel) this.probeLabel.style.display = 'block';
  }

  private _hideWaiting(): void {
    if (this.waitingIndicator) this.waitingIndicator.style.display = 'none';
    if (this.probeLabel) this.probeLabel.style.display = 'none';
  }

  // POLISH-1: Brief window border glow on bite — catches attention without being intrusive
  private _triggerBiteGlow(): void {
    if (!this.biteGlow) {
      this.biteGlow = this._createDiv('bite-glow');
      this.biteGlow.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none; z-index: 48;
        border: 3px solid rgba(255,100,80,0);
        border-radius: ${THEME.radius.lg};
        transition: border-color 0.15s ease;
      `;
      this.container.appendChild(this.biteGlow);
    }
    this.biteGlow.style.borderColor = 'rgba(255,100,80,0.7)';
    setTimeout(() => {
      if (this.biteGlow) this.biteGlow.style.borderColor = 'rgba(255,100,80,0)';
    }, 400);
  }

  private _showNotification(msg: string, _type: string): void {
    if (!this.notification) return;
    this.notification.textContent = msg;
    this.notification.style.opacity = '1';
    const prev = FishingUI.notificationTimers.get(this.notification);
    if (prev !== undefined) clearTimeout(prev);
    FishingUI.notificationTimers.set(
      this.notification,
      window.setTimeout(() => {
        if (this.notification) this.notification.style.opacity = '0';
      }, 1500),
    );
  }

  private _showIdleHint(): void {
    const el = document.getElementById('idle-hint');
    if (el) el.style.display = 'block';
  }
  private _hideIdleHint(): void {
    const el = document.getElementById('idle-hint');
    if (el) el.style.display = 'none';
  }

  private _hideAll(): void {
    if (this.castBar) this.castBar.style.display = 'none';
    if (this.tensionBar) this.tensionBar.style.display = 'none';
    if (this.progressBar) this.progressBar.style.display = 'none';
    if (this.fishNameLabel) this.fishNameLabel.style.display = 'none';
    if (this.hookIndicator) this.hookIndicator.style.display = 'none';
    if (this.waitingIndicator) this.waitingIndicator.style.display = 'none';
    if (this.probeLabel) this.probeLabel.style.display = 'none';
  }

  // ── Helper ──

  private _createDiv(id: string): HTMLDivElement {
    const div = document.createElement('div');
    div.id = id;
    return div;
  }

  // ── Cleanup ──

  dispose(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
