// ===== src/renderer/ui/FishingUI.ts =====
// In-run fishing feedback overlay: cast power (with depth zones), three-zone
// tension gauge with line-break warning, reel progress, bite prompt, catch /
// escape / line-break feedback, charm-proc hints and the resource strip.
//
// Layout keeps the centre of the 400x300 window clear: gauges hug the side
// edges, cast + status text sit on the bottom strip, catch cards are transient.
// Per-frame updates only write transforms / class names — never read layout.

import { EventBus } from '../core/EventBus';
import { GameEvents } from '../../shared/events';
import { i18n } from '../i18n/I18n';
import { CatchQuality, FishRarity } from '../../shared/enums';
import { BALANCE } from '../../shared/constants';
import { THEME, rarityColor } from './theme';
import { svgIcon } from './icons';
import type { IconName } from './icons';
import type { SpiritFish, Modifier } from '../../shared/types';

type CastZone = 'surface' | 'mid' | 'deep' | 'over';

interface ResourceDetail {
  casts?: number;
  gold?: number;
  essence?: number;
  runGold?: number;
}

export class FishingUI {
  /** Global fishpedia count, mirrored from GameStateManager events. */
  static fishpediaCount = 0;

  private static readonly notificationTimers = new WeakMap<HTMLDivElement, number>();

  private eventBus: EventBus;
  private container: HTMLDivElement;

  private castBar: HTMLDivElement;
  private castFill: HTMLDivElement;
  private castLabel: HTMLDivElement;
  private castZoneLabel: HTMLDivElement;
  private tensionBar: HTMLDivElement;
  private tensionFill: HTMLDivElement;
  private tensionMarker: HTMLDivElement;
  private tensionValue: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private progressValue: HTMLDivElement;
  private fishNameLabel: HTMLDivElement;
  private behaviorLabel: HTMLDivElement;
  private waitingIndicator: HTMLDivElement;
  private probeLabel: HTMLDivElement;
  private hookIndicator: HTMLDivElement;
  private hookTimerFill: HTMLDivElement;
  private catchPopup: HTMLDivElement;
  private notification: HTMLDivElement;
  private idleHint: HTMLDivElement;
  private charmProc: HTMLDivElement;
  private biteGlow: HTMLDivElement;
  private mythicGlow: HTMLDivElement;
  private resources: HTMLDivElement;

  private unsubs: (() => void)[] = [];
  private resourceHandler: ((e: Event) => void) | null = null;

  private _castZone: CastZone | null = null;
  private _probeShown = -1;
  private _tensionShown = -1;
  private _progressShown = -1;
  private hookStartTime = 0;
  private hookDurationMs = 1200;
  private _failTipIndex = 0;
  private _fishName = '';
  private _behaviorType = '';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.container = document.createElement('div');
    this.container.id = 'fishing-ui';
    document.body.appendChild(this.container);

    // ══ Cast power bar ══
    this.castBar = this._createDiv('cast-bar');
    this.castFill = this._createDiv('cast-fill');
    this.castBar.appendChild(this.castFill);
    const overshoot = this._createDiv('cast-overshoot');
    overshoot.style.left = `${BALANCE.castOvershootThreshold * 100}%`;
    this.castBar.appendChild(overshoot);
    this.castLabel = this._createDiv('cast-label');
    this.castLabel.textContent = i18n.t('fishing.holdToCast');
    this.castBar.appendChild(this.castLabel);
    this.castZoneLabel = this._createDiv('cast-zone');
    this.castBar.appendChild(this.castZoneLabel);
    this.container.appendChild(this.castBar);

    // ══ Tension gauge (right) ══
    this.tensionBar = this._createDiv('tension-bar');
    const greenZone = this._createDiv('tension-zone-green');
    const yellowZone = this._createDiv('tension-zone-yellow');
    const redZone = this._createDiv('tension-zone-red');
    this.tensionBar.append(greenZone, yellowZone, redZone);
    this.tensionFill = this._createDiv('tension-fill');
    this.tensionBar.appendChild(this.tensionFill);
    this.tensionMarker = this._createDiv('tension-marker');
    this.tensionBar.appendChild(this.tensionMarker);
    const tensionLabel = this._createDiv('tension-label');
    tensionLabel.textContent = i18n.t('hud.tension');
    this.tensionBar.appendChild(tensionLabel);
    this.tensionValue = this._createDiv('tension-value');
    this.tensionValue.textContent = '0';
    this.tensionBar.appendChild(this.tensionValue);
    const tensionWarn = document.createElement('div');
    tensionWarn.id = 'tension-warn';
    tensionWarn.innerHTML = `${svgIcon('warn', 10)}<span>${i18n.t('fishing.lineWarn')}</span>`;
    this.tensionBar.appendChild(tensionWarn);
    this.container.appendChild(this.tensionBar);

    // ══ Reel progress gauge (left) ══
    this.progressBar = this._createDiv('progress-bar');
    this.progressFill = this._createDiv('progress-fill');
    this.progressBar.appendChild(this.progressFill);
    const progressLabel = this._createDiv('progress-label');
    progressLabel.textContent = i18n.t('fishing.catch');
    this.progressBar.appendChild(progressLabel);
    this.progressValue = this._createDiv('progress-value');
    this.progressValue.textContent = '0';
    this.progressBar.appendChild(this.progressValue);
    this.container.appendChild(this.progressBar);

    // ══ Reel info chips ══
    this.fishNameLabel = this._createDiv('fish-name-label');
    this.container.appendChild(this.fishNameLabel);
    this.behaviorLabel = this._createDiv('behavior-label');
    this.container.appendChild(this.behaviorLabel);

    // ══ Waiting / probe state ══
    this.waitingIndicator = this._createDiv('waiting-indicator');
    this.waitingIndicator.textContent = i18n.t('fishing.waitShort');
    this.container.appendChild(this.waitingIndicator);
    this.probeLabel = this._createDiv('probe-label');
    this.container.appendChild(this.probeLabel);

    // ══ Bite prompt ══
    this.hookIndicator = this._createDiv('hook-indicator');
    this.hookIndicator.innerHTML = `
      <span class="hook-icon">${svgIcon('hook', 15)}</span>
      <span class="hook-text">${i18n.t('fishing.bite')}</span>
      <span class="hook-sub">${i18n.t('fishing.clickNow')}</span>
      <span id="hook-timer"><i id="hook-timer-fill"></i></span>`;
    this.hookTimerFill = this.hookIndicator.querySelector('#hook-timer-fill') as HTMLDivElement;
    this.container.appendChild(this.hookIndicator);

    // ══ Notification + charm proc + idle hint ══
    this.notification = this._createDiv('notification');
    this.container.appendChild(this.notification);

    this.charmProc = this._createDiv('charm-proc');
    this.container.appendChild(this.charmProc);

    this.idleHint = this._createDiv('idle-hint');
    this.idleHint.textContent = i18n.t('fishing.clickToCast');
    this.container.appendChild(this.idleHint);

    // ══ Resource strip (casts / gold, mirror of the run HUD) ══
    this.resources = this._createDiv('fishing-res');
    this.container.appendChild(this.resources);

    // ══ Fullscreen feedback layers ══
    this.biteGlow = this._createDiv('bite-glow');
    this.container.appendChild(this.biteGlow);
    this.mythicGlow = this._createDiv('mythic-glow');
    this.container.appendChild(this.mythicGlow);

    // ══ Catch card (body-level so it sits above the scene UI) ══
    this.catchPopup = this._createDiv('catch-popup');
    document.body.appendChild(this.catchPopup);

    this._subscribe();

    this.unsubs.push(
      this.eventBus.on(GameEvents.GAME_FISHPEDIA_COUNT_UPDATE, (p) => {
        FishingUI.fishpediaCount = p.count;
      }),
    );

    // RunUI broadcasts a compact resource snapshot for the bottom strip.
    this.resourceHandler = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      this._renderResources(e.detail as ResourceDetail | undefined);
    };
    document.addEventListener('soul:resources', this.resourceHandler);
  }

  // ══ Construction helpers ══

  private _createDiv(id: string): HTMLDivElement {
    const div = document.createElement('div');
    div.id = id;
    return div;
  }

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.FISHING_NIBBLE, () =>
        this._showNotification(i18n.t('fishing.nibble')),
      ),
      this.eventBus.on(GameEvents.FISHING_BITE, (p) => {
        this._hideWaiting();
        if (p.hookWindowMs) this.setHookDuration(p.hookWindowMs);
        this._showHookIndicator();
        this._triggerBiteGlow();
      }),
      this.eventBus.on(GameEvents.FISHING_HOOK_SET, (p) => {
        this._hideHookIndicator();
        this._showFishName(p.fish);
      }),
      this.eventBus.on(GameEvents.FISHING_REEL_UPDATE, (p) => {
        this._setTension(p.tension);
        this._setProgress(p.fishProgress);
        this._showFishName(p.fish);
        this._setBehavior(p.fish);
      }),
      this.eventBus.on(GameEvents.FISHING_BURST, () => this._flashTensionBar()),
      this.eventBus.on(GameEvents.FISHING_CATCH, () => this._hideWaiting()),
      this.eventBus.on(GameEvents.UI_SHOW_CATCH_FEEDBACK, (p) => {
        this._hideWaiting();
        this._hideHookIndicator();
        this._showCatchResult(p);
      }),
      this.eventBus.on(GameEvents.FISHING_ESCAPE, (p) => {
        this._hideWaiting();
        this._hideHookIndicator();
        this._showEscape(p);
      }),
      this.eventBus.on(GameEvents.FISHING_LINE_BREAK, (p) => {
        this._hideWaiting();
        this._hideHookIndicator();
        this._showLineBreak(p);
      }),
      this.eventBus.on(GameEvents.FISHING_CAST, () => {
        this._hideCastBar();
        this._showWaiting();
      }),
      this.eventBus.on(GameEvents.FISHING_PROBE_ESCAPE, () => {
        this._hideWaiting();
        this._showNotification(i18n.t('fishing.probeEscape'));
      }),
      this.eventBus.on(GameEvents.FISHING_IDLE, () => {
        this._hideAll();
        this._showIdleHint();
      }),
      this.eventBus.on(GameEvents.FISHING_CAST_START, () => {
        this._showCastBar();
        this._hideIdleHint();
      }),
      this.eventBus.on(GameEvents.RUN_MODIFIER_ADDED, (p) => {
        this._showCharmProc(p.modifier);
      }),
      this.eventBus.on(GameEvents.RUN_START, () => {
        this._renderResources({ casts: undefined, gold: undefined });
        this.resources.style.display = 'flex';
      }),
      this.eventBus.on(GameEvents.RUN_END, () => {
        this.resources.style.display = 'none';
      }),
    );
  }

  // ══ Per-frame update ══

  update(castPower: number, isCasting: boolean, probesRemaining = 3): void {
    if (isCasting) {
      this.castFill.style.transform = `scaleX(${Math.max(0, Math.min(1, castPower))})`;
      const zone: CastZone =
        castPower > BALANCE.castOvershootThreshold
          ? 'over'
          : castPower > 0.7
            ? 'deep'
            : castPower > 0.3
              ? 'mid'
              : 'surface';
      if (zone !== this._castZone) {
        this._castZone = zone;
        this.castFill.className = `is-${zone}`;
        this.castZoneLabel.className = `is-${zone}`;
        this.castZoneLabel.textContent = this._castZoneText(zone);
      }
    }
    if (this.probeLabel.style.display !== 'none' && probesRemaining !== this._probeShown) {
      this._probeShown = probesRemaining;
      this.probeLabel.innerHTML = `${svgIcon('bait', 10)}<span>${i18n.t('fishing.probes', {
        '0': probesRemaining,
        '1': 3,
      })}</span>`;
    }
    this._updateHookTimer();
  }

  private _castZoneText(zone: CastZone): string {
    switch (zone) {
      case 'over':
        return i18n.t('fishing.castZone.over');
      case 'deep':
        return i18n.t('fishing.castZone.deep');
      case 'mid':
        return i18n.t('fishing.castZone.mid');
      default:
        return i18n.t('fishing.castZone.surface');
    }
  }

  // ══ State helpers ══

  private _showCastBar(): void {
    this.castBar.style.display = 'block';
    this.tensionBar.style.display = 'none';
    this.progressBar.style.display = 'none';
    if (this.catchPopup) this.catchPopup.style.display = 'none';
    this._castZone = null;
  }

  private _hideCastBar(): void {
    this.castBar.style.display = 'none';
    this.tensionBar.style.display = 'block';
    this.progressBar.style.display = 'block';
  }

  /** Set the actual hook window duration (ms) reported by FishingSystem. */
  setHookDuration(durationMs: number): void {
    this.hookDurationMs = Math.max(100, durationMs);
  }

  private _showHookIndicator(): void {
    this.hookIndicator.style.display = 'flex';
    this.hookStartTime = performance.now();
    this.hookTimerFill.style.transform = 'scaleX(1)';
  }

  private _hideHookIndicator(): void {
    this.hookIndicator.style.display = 'none';
  }

  private _updateHookTimer(): void {
    if (this.hookIndicator.style.display === 'none') return;
    const elapsed = performance.now() - this.hookStartTime;
    const remaining = Math.max(0, 1 - elapsed / this.hookDurationMs);
    this.hookTimerFill.style.transform = `scaleX(${remaining})`;
  }

  private _setProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(100, progress));
    if (Math.round(clamped) === this._progressShown) return;
    this._progressShown = Math.round(clamped);
    this.progressFill.style.transform = `scaleY(${clamped / 100})`;
    this.progressValue.textContent = String(this._progressShown);
  }

  private _setBehavior(fish: SpiritFish): void {
    const type = fish?.behavior?.type ?? 'steady';
    if (type === this._behaviorType) return;
    this._behaviorType = type;
    const labels: Record<string, string> = {
      steady: i18n.t('behavior2.steady'),
      sprint: i18n.t('behavior2.sprint'),
      lazy: i18n.t('behavior2.lazy'),
      zigzag: i18n.t('behavior2.zigzag'),
      deep_diver: i18n.t('behavior2.deepDiver'),
      surface_jumper: i18n.t('behavior2.surfaceJumper'),
    };
    this.behaviorLabel.innerHTML = `${svgIcon('fish', 10)}<span>${labels[type] ?? type}</span>`;
    this.behaviorLabel.style.display = 'inline-flex';
  }

  private _flashTensionBar(): void {
    this.tensionBar.style.boxShadow = '0 0 14px 2px rgba(221,138,122,0.75)';
    window.setTimeout(() => {
      this.tensionBar.style.boxShadow = '';
    }, 320);
  }

  private _showFishName(fish: SpiritFish): void {
    if (!fish) return;
    const name = fish.name?.[i18n.lang] ?? fish.name?.en ?? '???';
    if (name !== this._fishName) {
      this._fishName = name;
      this.fishNameLabel.textContent = name;
      this.fishNameLabel.style.display = 'block';
    }
  }

  private _setTension(tension: number): void {
    const clamped = Math.max(0, Math.min(100, tension));
    this.tensionFill.style.transform = `scaleY(${clamped / 100})`;
    this.tensionMarker.style.bottom = `${clamped}%`;
    const isRed = clamped > BALANCE.tensionYellowMax;
    const isYellow = clamped > BALANCE.tensionGreenMax;
    this.tensionFill.className = isRed ? 'is-red' : isYellow ? 'is-yellow' : '';
    this.tensionBar.classList.toggle('is-danger', isRed);
    const rounded = Math.round(clamped);
    if (rounded !== this._tensionShown) {
      this._tensionShown = rounded;
      this.tensionValue.textContent = String(rounded);
    }
  }

  private _renderResources(detail: ResourceDetail | undefined): void {
    const casts = detail?.casts;
    const runGold = detail?.runGold ?? 0;
    const parts: string[] = [];
    if (typeof casts === 'number') {
      parts.push(`<span class="fishing-res__item">${svgIcon('rod', 11)}<b>${casts}</b></span>`);
    }
    parts.push(`<span class="fishing-res__item">${svgIcon('coin', 11)}<b>${runGold}</b></span>`);
    this.resources.innerHTML = parts.join('');
    this.resources.style.display = 'flex';
  }

  // ══ Waiting / probe ══

  private _showWaiting(): void {
    this.waitingIndicator.style.display = 'block';
    this.probeLabel.style.display = 'inline-flex';
    this._probeShown = -1;
  }

  private _hideWaiting(): void {
    this.waitingIndicator.style.display = 'none';
    this.probeLabel.style.display = 'none';
  }

  private _triggerBiteGlow(): void {
    this.biteGlow.style.borderColor = 'rgba(221,138,122,0.75)';
    window.setTimeout(() => {
      this.biteGlow.style.borderColor = 'rgba(221,138,122,0)';
    }, 420);
  }

  private _showNotification(msg: string): void {
    this.notification.textContent = msg;
    this.notification.style.opacity = '1';
    const prev = FishingUI.notificationTimers.get(this.notification);
    if (prev !== undefined) clearTimeout(prev);
    FishingUI.notificationTimers.set(
      this.notification,
      window.setTimeout(() => {
        this.notification.style.opacity = '0';
      }, 1600),
    );
  }

  private _showCharmProc(modifier: Modifier): void {
    if (!modifier) return;
    const charm = i18n.charm(modifier.id);
    const label =
      charm.name && charm.name !== `charm.${modifier.id}.name` ? charm.name : modifier.name;
    this.charmProc.innerHTML = `${svgIcon('charm', 11)}<span>${i18n.t('fishing.charmProc', {
      '0': label,
    })}</span>`;
    this.charmProc.style.display = 'flex';
    this.charmProc.style.animation = 'none';
    // restart the CSS animation without reading layout
    void this.charmProc.offsetWidth;
    this.charmProc.style.animation = '';
    window.setTimeout(() => {
      this.charmProc.style.display = 'none';
    }, 1800);
  }

  private _showIdleHint(): void {
    this.idleHint.style.display = 'block';
  }

  private _hideIdleHint(): void {
    this.idleHint.style.display = 'none';
  }

  private _hideAll(): void {
    this.castBar.style.display = 'none';
    this.tensionBar.style.display = 'none';
    this.progressBar.style.display = 'none';
    this.fishNameLabel.style.display = 'none';
    this.behaviorLabel.style.display = 'none';
    this.hookIndicator.style.display = 'none';
    this._hideWaiting();
    this._hideHookIndicator();
  }

  // ══ Catch feedback ══

  private _showCatchResult(payload: {
    fish: SpiritFish;
    size: number;
    quality: CatchQuality;
    gold: number;
    isSpiritVariant: boolean;
    isNewDiscovery?: boolean;
    fishpediaCount?: number;
  }): void {
    const rarity = payload.fish.rarity;
    const isMythic = rarity === FishRarity.Mythic;
    const color = rarityColor(rarity);

    if (isMythic) {
      this.mythicGlow.style.display = 'block';
      window.setTimeout(() => {
        this.mythicGlow.style.display = 'none';
      }, 2500);
    }

    const qualityKey =
      payload.quality === CatchQuality.Perfect
        ? 'result.perfect'
        : payload.quality === CatchQuality.Struggle
          ? 'result.struggle'
          : 'result.standard';
    const qualityIcon: IconName =
      payload.quality === CatchQuality.Perfect
        ? 'sparkle'
        : payload.quality === CatchQuality.Struggle
          ? 'warn'
          : 'check';

    const badges: string[] = [];
    if (isMythic) {
      badges.push(
        `<span class="ss-chip ss-chip--coral">${svgIcon('rarity', 9)}${i18n.t('fishing.mythic')}</span>`,
      );
    }
    if (payload.isSpiritVariant) {
      badges.push(
        `<span class="ss-chip ss-chip--sky">${svgIcon('soul', 9)}${i18n.t('fishing.spirit')}</span>`,
      );
    }
    if (payload.isNewDiscovery) {
      badges.push(
        `<span class="ss-chip ss-chip--sage">${svgIcon('sparkle', 9)}${i18n.t('fishing.newDiscovery')}</span>`,
      );
    }
    const pedia = payload.fishpediaCount ?? FishingUI.fishpediaCount;
    if (pedia > 0) {
      badges.push(
        `<span class="ss-chip">${svgIcon('book', 9)}${i18n.t('fishing.pediaCount', {
          '0': pedia,
        })}</span>`,
      );
    }

    this.catchPopup.style.borderColor = color;
    this.catchPopup.style.boxShadow = `0 18px 48px rgba(8,10,11,0.55), 0 0 30px ${this._alpha(color, 0.16)}`;
    this.catchPopup.innerHTML = `
      <div class="catch-quality" style="color:${color}">
        ${svgIcon(qualityIcon, 16)}<span>${i18n.t(qualityKey)}</span>
      </div>
      <div class="catch-name">${payload.fish.name[i18n.lang] ?? payload.fish.name.en}</div>
      <div class="catch-name-en">${payload.fish.name.en}</div>
      <div class="catch-meta">
        <span class="ss-chip ss-chip--gold">${svgIcon('fish', 9)}${payload.size.toFixed(1)}cm</span>
        <span class="ss-chip ss-chip--gold">${svgIcon('coin', 9)}+${payload.gold}</span>
        <span class="ss-chip" style="color:${color}">${svgIcon('rarity', 9)}${this._rarityLabel(rarity)}</span>
      </div>
      ${badges.length ? `<div class="catch-badges">${badges.join('')}</div>` : ''}
      <div class="catch-hint">${i18n.t('fishing.continueHint')}</div>`;

    this.catchPopup.style.display = 'block';
    this._showFloatingGold(payload.gold, payload.quality, isMythic);

    window.setTimeout(() => {
      this.catchPopup.style.display = 'none';
    }, 3000);
  }

  private _rarityLabel(rarity: string): string {
    const labels: Record<string, string> = {
      [FishRarity.Common]: i18n.t('rarity.common'),
      [FishRarity.Uncommon]: i18n.t('rarity.uncommon'),
      [FishRarity.Rare]: i18n.t('rarity.rare'),
      [FishRarity.Legendary]: i18n.t('rarity.legendary'),
      [FishRarity.Mythic]: i18n.t('rarity.mythic'),
    };
    return labels[rarity] ?? rarity;
  }

  private _showLineBreak(payload: { reason: string }): void {
    const reasonKey =
      payload.reason === 'overshoot'
        ? 'result.overshoot'
        : payload.reason === 'worn_out'
          ? 'result.wornOut'
          : 'result.maxTension';
    const tip = this._nextTip();
    this.catchPopup.style.borderColor = THEME.accent.red;
    this.catchPopup.style.boxShadow = `0 18px 48px rgba(8,10,11,0.55), 0 0 26px rgba(221,138,122,0.2)`;
    this.catchPopup.innerHTML = `
      <div class="catch-quality" style="color:${THEME.accent.red}">
        ${svgIcon('warn', 16)}<span>${i18n.t('result.lineSnap')}</span>
      </div>
      <div class="catch-tip">${i18n.t(reasonKey)}</div>
      <div class="catch-tip" style="color:${THEME.accent.gold}">${tip}</div>
      <div class="catch-hint">${i18n.t('fishing.continueHint')}</div>`;
    this.catchPopup.style.display = 'block';
    window.setTimeout(() => {
      this.catchPopup.style.display = 'none';
    }, 3000);
  }

  private _showEscape(payload: { fish: SpiritFish | null; reason: string }): void {
    const tip = this._nextTip();
    const fishName = payload.fish?.name?.[i18n.lang] ?? payload.fish?.name?.en ?? '?';
    this.catchPopup.style.borderColor = THEME.accent.orange;
    this.catchPopup.style.boxShadow =
      '0 18px 48px rgba(8,10,11,0.55), 0 0 26px rgba(220,154,114,0.18)';
    this.catchPopup.innerHTML = `
      <div class="catch-quality" style="color:${THEME.accent.orange}">
        ${svgIcon('fish', 16)}<span>${i18n.t('result.escaped')}</span>
      </div>
      <div class="catch-tip">${i18n.t('fishing.escapedFish', { '0': fishName })}</div>
      <div class="catch-tip" style="color:${THEME.accent.gold}">${tip}</div>
      <div class="catch-hint">${i18n.t('fishing.continueHint')}</div>`;
    this.catchPopup.style.display = 'block';
    window.setTimeout(() => {
      this.catchPopup.style.display = 'none';
    }, 3000);
  }

  private _nextTip(): string {
    const tips = [
      i18n.t('fishing.tip.early'),
      i18n.t('fishing.tip.snare'),
      i18n.t('fishing.tip.deep'),
      i18n.t('fishing.tip.perfect'),
      i18n.t('fishing.tip.slack'),
    ];
    const tip = tips[this._failTipIndex % tips.length];
    this._failTipIndex++;
    return tip;
  }

  private _showFloatingGold(amount: number, quality: CatchQuality, isMythic: boolean): void {
    const el = document.createElement('div');
    el.className = 'float-gold';
    el.style.cssText = `left:50%; top:50%; color:${
      isMythic
        ? THEME.accent.gold
        : quality === CatchQuality.Perfect
          ? THEME.accent.yellow
          : THEME.accent.green
    }; font-size:${isMythic ? '18px' : quality === CatchQuality.Perfect ? '14px' : '11px'};`;
    el.textContent = `+${amount}`;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 1300);
  }

  private _alpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ══ Cleanup ══

  dispose(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    if (this.resourceHandler) {
      document.removeEventListener('soul:resources', this.resourceHandler);
      this.resourceHandler = null;
    }
    this.catchPopup.remove();
    this.container.remove();
  }
}
