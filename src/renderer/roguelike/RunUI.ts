// ===== src/renderer/roguelike/RunUI.ts =====
// Run coordinator: top HUD (location / tension / line durability / casts / gold),
// run-event popup, and the camp -> charm -> bait -> result flow.
// Individual panels live in ./ui/. Styling comes from src/styles/main.css.

import { EventBus } from '../core/EventBus';
import { RunManager } from './RunManager';
import { GameStateManager } from '../core/GameStateManager';
import { DailySystem } from '../data/DailySystem';
import { LocationManager } from '../locations/LocationManager';
import { SceneUI } from '../ui/SceneUI';
import { ALL_CHARMS } from './charm-data';
import { ALL_RELICS } from './relic-data';
import { GameEvents } from '../../shared/events';
import { ModifierRarity } from '../../shared/enums';
import { BALANCE } from '../../shared/constants';
import { LOCATIONS } from '../data/location-data';
import { i18n } from '../i18n/I18n';
import { svgIcon, charmIconName } from '../ui/icons';
import type { IconName } from '../ui/icons';
import { THEME } from '../ui/theme';
import { CampPanel } from './ui/CampPanel';
import { CharmPicker } from './ui/CharmPicker';
import { BaitPicker } from './ui/BaitPicker';
import { ResultPanel } from './ui/ResultPanel';
import type { RunEvent, Relic } from '../../shared/types';

const EVENT_ICONS: Record<string, IconName> = {
  evt_blessing: 'soul',
  evt_storm: 'warn',
  evt_frenzy: 'fish',
  evt_ancient_relic: 'relic',
  evt_mysterious_stranger: 'link',
  evt_floating_chest: 'relic',
  evt_moonlight: 'sparkle',
  evt_tangled_line: 'tension',
  evt_school: 'fish',
  evt_whirlpool: 'tension',
};

export class RunUI {
  private eventBus: EventBus;
  private runManager: RunManager;
  private gsm: GameStateManager;
  private dailySystem: DailySystem;
  private sceneUI: SceneUI;
  private locationManager: LocationManager;

  private selectedLocation = 'japan';

  // Sub-panels
  private campPanel: CampPanel;
  private charmPicker: CharmPicker;
  private baitPicker: BaitPicker;
  private resultPanel: ResultPanel;

  // Run HUD
  private runHUD!: HTMLDivElement;
  private locName!: HTMLSpanElement;
  private locIdx!: HTMLSpanElement;
  private castsValue!: HTMLSpanElement;
  private goldValue!: HTMLSpanElement;
  private essenceValue!: HTMLSpanElement;
  private charmIcons!: HTMLSpanElement;
  private synergyLabel!: HTMLSpanElement;
  private tensionMeter!: HTMLDivElement;
  private tensionFill!: HTMLElement;
  private tensionValue!: HTMLSpanElement;
  private duraMeter!: HTMLDivElement;
  private duraFill!: HTMLElement;
  private duraValue!: HTMLSpanElement;
  private endBtn!: HTMLDivElement;

  private _lastCasts = -1;
  private _lastGold = -1;
  private _lastEssence = -1;
  private _lastTension = -1;
  private _lastDura = -1;
  private _locationId = 'japan';

  private unsubs: (() => void)[] = [];

  constructor(
    eventBus: EventBus,
    runManager: RunManager,
    gsm: GameStateManager,
    sceneUI: SceneUI,
    locationManager: LocationManager,
    dailySystem: DailySystem,
  ) {
    this.eventBus = eventBus;
    this.runManager = runManager;
    this.gsm = gsm;
    this.sceneUI = sceneUI;
    this.locationManager = locationManager;
    this.dailySystem = dailySystem;

    this.campPanel = new CampPanel(
      gsm,
      dailySystem,
      sceneUI,
      locationManager,
      this.selectedLocation,
    );
    this.charmPicker = new CharmPicker(gsm, sceneUI);
    this.baitPicker = new BaitPicker(gsm, sceneUI);
    this.resultPanel = new ResultPanel(gsm, runManager, sceneUI);

    this._buildRunHUD();
    this._subscribe();
  }

  // ══ Public API ══

  showCampPanel(): void {
    this.campPanel.show({
      onStartRun: () => this._showCharmPicker(),
      onLocationChange: (locationId) => {
        this.selectedLocation = locationId;
        this.campPanel = new CampPanel(
          this.gsm,
          this.dailySystem,
          this.sceneUI,
          this.locationManager,
          this.selectedLocation,
        );
      },
    });
  }

  dispose(): void {
    this._closePanels();
    this.campPanel.dispose();
    this.charmPicker.dispose();
    this.baitPicker.dispose();
    this.resultPanel.dispose();
    this.unsubs.forEach((fn) => fn());
  }

  // ══ Run HUD ══

  private _buildRunHUD(): void {
    this.runHUD = document.createElement('div');
    this.runHUD.id = 'run-hud';

    const loc = document.createElement('div');
    loc.className = 'hud-loc';
    loc.innerHTML = `${svgIcon('pin', 11)}<span class="hud-loc__name" id="hud-loc-name">-</span><span class="hud-loc__idx"></span>`;
    this.runHUD.appendChild(loc);
    this.locName = loc.querySelector('#hud-loc-name') as HTMLSpanElement;
    this.locIdx = loc.querySelector('.hud-loc__idx') as HTMLSpanElement;

    const divider = document.createElement('span');
    divider.className = 'hud-divider';
    this.runHUD.appendChild(divider);

    const meters = document.createElement('div');
    meters.className = 'hud-meters';

    const tensionRow = document.createElement('div');
    tensionRow.className = 'hud-meter';
    tensionRow.innerHTML = `${svgIcon('tension', 10)}<span class="ss-bar"><i id="hud-tension-fill"></i></span><span class="hud-meter__value">0</span>`;
    meters.appendChild(tensionRow);
    this.tensionMeter = tensionRow;
    this.tensionFill = tensionRow.querySelector('#hud-tension-fill') as HTMLElement;
    this.tensionValue = tensionRow.querySelector('.hud-meter__value') as HTMLSpanElement;

    const duraRow = document.createElement('div');
    duraRow.className = 'hud-meter';
    duraRow.innerHTML = `${svgIcon('durability', 10)}<span class="ss-bar"><i id="hud-dura-fill" class="is-sage"></i></span><span class="hud-meter__value">100</span>`;
    meters.appendChild(duraRow);
    this.duraMeter = duraRow;
    this.duraFill = duraRow.querySelector('#hud-dura-fill') as HTMLElement;
    this.duraValue = duraRow.querySelector('.hud-meter__value') as HTMLSpanElement;

    this.runHUD.appendChild(meters);

    this.charmIcons = document.createElement('span');
    this.charmIcons.className = 'hud-charms';
    this.runHUD.appendChild(this.charmIcons);

    this.synergyLabel = document.createElement('span');
    this.synergyLabel.className = 'hud-charms';
    this.runHUD.appendChild(this.synergyLabel);

    const res = document.createElement('div');
    res.className = 'hud-res';
    res.innerHTML = `
      <span class="hud-chip">${svgIcon('rod', 11)}<span class="hud-chip__value">-</span></span>
      <span class="hud-chip">${svgIcon('coin', 11)}<span class="hud-chip__value">-</span></span>
      <span class="hud-chip hud-chip--essence">${svgIcon('sparkle', 11)}<span class="hud-chip__value">-</span></span>`;
    this.runHUD.appendChild(res);
    const chips = res.querySelectorAll('.hud-chip__value');
    this.castsValue = chips[0] as HTMLSpanElement;
    this.goldValue = chips[1] as HTMLSpanElement;
    this.essenceValue = chips[2] as HTMLSpanElement;

    const actions = document.createElement('div');
    actions.className = 'hud-actions';
    this.endBtn = document.createElement('div');
    this.endBtn.className = 'hud-btn hud-btn--danger';
    this.endBtn.innerHTML = `${svgIcon('back', 10)}<span>${i18n.t('hud.endRun')}</span>`;
    this.endBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.runManager.canEndVoluntarily) {
        this._toast(i18n.t('notify.catchFirst'));
        return;
      }
      this.runManager.endRunVoluntarily();
    });
    actions.appendChild(this.endBtn);
    this.runHUD.appendChild(actions);

    document.body.appendChild(this.runHUD);
  }

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.RUN_START, (p) => {
        this._locationId = p.locationId;
        this.runHUD.style.display = 'flex';
        this.endBtn.style.display = 'inline-flex';
        this._renderLocation();
        this._renderCharms();
        this._lastCasts = -1;
        this._lastGold = -1;
        this._lastEssence = -1;
        this._updateRunHUD();
        this._updateMeters(0, this.runManager.maxDurability);
        this.sceneUI.hideBackdrop();
        this.sceneUI.hideStart();
      }),
      this.eventBus.on(GameEvents.RUN_CAST_CONSUMED, () => this._updateRunHUD()),
      this.eventBus.on(GameEvents.FISHING_CATCH, () => this._updateRunHUD()),
      this.eventBus.on(GameEvents.FISHING_REEL_UPDATE, (p) => {
        this._updateMeters(p.tension, p.lineDurability);
        this._updateRunHUD();
      }),
      this.eventBus.on(GameEvents.GAME_GOLD_CHANGE, () => this._updateRunHUD()),
      this.eventBus.on(GameEvents.RUN_END, (p) => {
        this.resultPanel.show(p.rewards, {
          onBackToCamp: () => this.showCampPanel(),
          onFishAgain: () => this._showCharmPicker(),
        });
        this.runHUD.style.display = 'none';
        this.endBtn.style.display = 'none';
      }),
      this.eventBus.on(GameEvents.RUN_EVENT, (p) => this._showEventToast(p.event)),
      this.eventBus.on(GameEvents.DAILY_QUEST_COMPLETED, (p) => {
        this._toast(
          i18n.t('notify.dailyDone', { '0': p.gold ?? 0, '1': p.essence ?? 0 }),
          'sparkle',
        );
      }),
      this.eventBus.on(GameEvents.DAILY_FREE_BAIT_CLAIMED, (p) => {
        this._toast(i18n.t('notify.freeBait', { '0': p.amount ?? 3 }), 'bait');
      }),
    );
  }

  private _renderLocation(): void {
    const loc = LOCATIONS.find((l) => l.id === this._locationId);
    if (!loc) return;
    const idx = LOCATIONS.indexOf(loc) + 1;
    this.locName.textContent = i18n.lang === 'zh' ? loc.name.zh : loc.country;
    this.locIdx.textContent = `${String(idx).padStart(2, '0')}/${LOCATIONS.length}`;
    const accent = '#' + (loc.theme?.uiAccent ?? 0xa9c3a0).toString(16).padStart(6, '0');
    document.documentElement.style.setProperty('--location-accent', accent);
  }

  private _renderCharms(): void {
    const charms = this.runManager.charms;
    this.charmIcons.innerHTML = charms
      .slice(0, 4)
      .map(
        (charm) =>
          `<span title="${i18n.charm(charm.id).name}">${svgIcon(charmIconName(charm.tags), 11)}</span>`,
      )
      .join('');
    const synergies = this.runManager.modStats?.synergies ?? [];
    this.synergyLabel.innerHTML =
      synergies.length > 0
        ? `${svgIcon('link', 10)}<span>${synergies.map((s) => s.name).join(' · ')}</span>`
        : '';
  }

  private _updateMeters(tension: number, lineDurability: number): void {
    const t = Math.round(Math.max(0, Math.min(100, tension)));
    if (t !== this._lastTension) {
      this._lastTension = t;
      this.tensionFill.style.transform = `scaleX(${t / 100})`;
      this.tensionValue.textContent = String(t);
      this.tensionMeter.classList.toggle('is-danger', t > BALANCE.tensionYellowMax);
    }
    const max = Math.max(1, this.runManager.maxDurability);
    const durability = Math.round(Math.max(0, Math.min(100, (lineDurability / max) * 100)));
    if (durability !== this._lastDura) {
      this._lastDura = durability;
      this.duraFill.style.transform = `scaleX(${durability / 100})`;
      this.duraValue.textContent = String(durability);
      this.duraMeter.classList.toggle('is-danger', durability < 25);
    }
  }

  private _updateRunHUD(): void {
    const casts = this.runManager.remainingCasts;
    if (casts !== this._lastCasts) {
      this._lastCasts = casts;
      this.castsValue.textContent = String(casts);
    }
    if (this.gsm.gold !== this._lastGold) {
      this._lastGold = this.gsm.gold;
      this.goldValue.textContent = String(this.gsm.gold);
    }
    if (this.gsm.essence !== this._lastEssence) {
      this._lastEssence = this.gsm.essence;
      this.essenceValue.textContent = String(this.gsm.essence);
    }
    this._broadcastResources();
  }

  /** Snapshot for the FishingUI bottom resource strip. */
  private _broadcastResources(): void {
    const runGold = this.runManager.fishCaughtThisRun.reduce((sum, f) => sum + f.goldEarned, 0);
    document.dispatchEvent(
      new CustomEvent('soul:resources', {
        detail: {
          casts: this.runManager.remainingCasts,
          gold: this.gsm.gold,
          essence: this.gsm.essence,
          runGold,
        },
      }),
    );
  }

  // ══ Charm / Bait / Result flow ══

  private _showCharmPicker(): void {
    this.charmPicker.show({
      onConfirm: (charms) =>
        this.baitPicker.show(charms, {
          onConfirm: (baitId, charges) => {
            const relics = [...this.gsm.equippedRelics]
              .map((id) => ALL_RELICS.find((r) => r.id === id))
              .filter((r): r is Relic => !!r);
            const baseLineDurability = this.gsm.campManager.getMeta().baseLineDurability;
            this.runManager.startRun(
              this.selectedLocation,
              charms,
              { baitId, charges },
              relics,
              baseLineDurability,
            );
          },
          onCancel: () => {
            this.sceneUI.hideBackdrop();
            this.sceneUI.showStart();
          },
        }),
      onCancel: () => {
        this.sceneUI.hideBackdrop();
        this.sceneUI.showStart();
      },
    });
  }

  // ══ Run event popup ══

  private _showEventToast(event: RunEvent): void {
    const evtI18n = i18n.event(event.id);
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="event-card__head">
        <span class="event-card__icon">${svgIcon(EVENT_ICONS[event.id] ?? 'warn', 14)}</span>
        <span class="event-card__name">${evtI18n.name}</span>
      </div>
      <div class="event-card__desc">${evtI18n.desc}</div>`;

    if ((event.choices?.length ?? 0) > 0) {
      const choices = document.createElement('div');
      choices.className = 'event-card__choices';
      (event.choices ?? []).forEach((choice) => {
        const btn = document.createElement('div');
        btn.className = 'ss-btn ss-btn--primary';
        btn.style.justifyContent = 'flex-start';
        btn.innerHTML = `${svgIcon('chevronRight', 10)}<span>${choice.label}</span>`;
        btn.addEventListener('click', () => {
          card.remove();
          this._applyChoice(choice);
        });
        choices.appendChild(btn);
      });
      card.appendChild(choices);
    } else {
      card.style.cursor = 'pointer';
      card.title = i18n.t('ui.close');
      card.addEventListener('click', () => card.remove());
    }
    document.body.appendChild(card);
    window.setTimeout(() => {
      if (card.parentElement) card.remove();
    }, 7000);
  }

  private _applyChoice(choice: NonNullable<RunEvent['choices']>[number]): void {
    switch (choice.outcome) {
      case 'blessing_progress':
        this.runManager.addModifier({
          id: 'evt_progress',
          name: 'Spirit Blessing',
          description: '+3 progress rate',
          icon: '',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'fishProgressRate', value: 3 }],
          tags: ['event'],
        });
        this._toast(i18n.t('toast.blessing_progress'), 'soul');
        break;
      case 'blessing_protection':
        this.runManager.addModifier({
          id: 'evt_protect',
          name: 'Spirit Protection',
          description: '-2 line wear',
          icon: '',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'lineWearRate', value: -2 }],
          tags: ['event'],
        });
        this._toast(i18n.t('toast.blessing_protection'), 'durability');
        break;
      case 'relic_risk':
        if (Math.random() < 0.5) {
          this._toast(i18n.t('toast.relic_risk_nothing'), 'relic');
        } else {
          this.runManager.applyLineDamage(20);
          this._toast(i18n.t('toast.relic_risk_damage'), 'warn');
        }
        break;
      case 'chest_gamble':
        if (Math.random() < 0.5) {
          this.gsm.addGold(200, 'event');
          this._updateRunHUD();
          this._toast(i18n.t('toast.chest_gold'), 'coin');
        } else {
          this.runManager.applyLineDamage(15);
          this._toast(i18n.t('toast.chest_curse'), 'warn');
        }
        break;
      case 'tangle_cut':
        this.runManager.consumeCasts(2);
        this._toast(i18n.t('toast.tangle_cut'), 'tension');
        break;
      case 'tangle_patient':
        this.runManager.applyLineDamage(4);
        this._toast(i18n.t('toast.tangle_patient'), 'durability');
        break;
      case 'whirlpool_reel':
        this.runManager.applyLineDamage(10);
        this._toast(i18n.t('toast.whirlpool_reel'), 'warn');
        break;
      case 'whirlpool_slack':
        this.runManager.consumeCasts(3);
        this._toast(i18n.t('toast.whirlpool_slack'), 'tension');
        break;
      case 'trade_casts': {
        this.runManager.consumeCasts(5);
        const rareCharms = ALL_CHARMS.filter((c) => c.rarity === ModifierRarity.Rare);
        if (rareCharms.length) {
          this.runManager.addModifier(rareCharms[Math.floor(Math.random() * rareCharms.length)]);
          this._toast(i18n.t('toast.trade_charm'), 'charm');
        }
        break;
      }
    }
  }

  // ══ Helpers ══

  private _toast(msg: string, icon: IconName = 'sparkle'): void {
    const node = document.createElement('div');
    node.className = 'ss-toast';
    node.innerHTML = `${svgIcon(icon, 12)}<span>${msg}</span>`;
    document.body.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = `opacity ${THEME.motion.slow} ${THEME.motion.ease}`;
      window.setTimeout(() => node.remove(), 260);
    }, 2000);
  }

  private _closePanels(): void {
    this.campPanel.close();
    this.charmPicker.close();
    this.baitPicker.close();
    this.resultPanel.close();
    document
      .querySelectorAll('#fishpedia')
      .forEach((e) => ((e as HTMLElement).style.display = 'none'));
  }
}
