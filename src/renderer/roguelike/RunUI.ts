// ===== src/renderer/roguelike/RunUI.ts =====
// Camp, charm picker, result panels. Uses GameStateManager for persistence.
// Location selection in camp. Charm picker respects charmSlots upgrade.
// This is now a lightweight coordinator; individual panels live in ./ui/.

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
import { BAITS } from '../../shared/constants';
import { i18n } from '../i18n/I18n';
import { d, toast } from './ui/run-ui-helpers';
import { THEME } from '../ui/theme';
import { CampPanel } from './ui/CampPanel';
import { CharmPicker } from './ui/CharmPicker';
import { BaitPicker } from './ui/BaitPicker';
import { ResultPanel } from './ui/ResultPanel';
import type { RunEvent, Relic } from '../../shared/types';

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
  private castsLabel!: HTMLSpanElement;
  private duraLabel!: HTMLSpanElement;
  private runEarningsLabel!: HTMLSpanElement;
  private synergyLabel!: HTMLSpanElement;
  private baitLabel!: HTMLSpanElement;
  private charmIcons!: HTMLSpanElement;
  private goldLabel!: HTMLSpanElement;
  private endBtn!: HTMLDivElement;
  private _campBtn!: HTMLDivElement;

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
    const hudShadow = '0 0 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5)';
    this.runHUD = d(`
      position: absolute; top: 28px; left: 0; right: 0;
      display: none; align-items: center; justify-content: space-between;
      padding: 4px 10px; pointer-events: none;
    `);
    const left = d(
      `display: flex; align-items: center; gap: 8px; font-size: 9px; color: #f0f0f0; text-shadow: ${hudShadow};`,
    );
    this.castsLabel = document.createElement('span');
    this.duraLabel = document.createElement('span');
    this.runEarningsLabel = document.createElement('span');
    this.runEarningsLabel.style.cssText = 'color: ${THEME.accent.goldText}; font-weight: bold;';
    this.charmIcons = document.createElement('span');
    this.synergyLabel = document.createElement('span');
    this.synergyLabel.style.cssText =
      'color: ${THEME.accent.purple}; font-size: 8px; font-weight: bold;';
    this.baitLabel = document.createElement('span');
    this.baitLabel.style.cssText = 'color: #f0f0f0; font-size: 8px;';
    left.append(
      this.castsLabel,
      this.duraLabel,
      this.runEarningsLabel,
      this.synergyLabel,
      this.charmIcons,
      this.baitLabel,
    );
    this.runHUD.appendChild(left);

    const right = d('display: flex; align-items: center; gap: 8px;');
    this.goldLabel = d(
      `font-size: 9px; color: ${THEME.accent.goldText}; font-weight: bold; text-shadow: ${hudShadow};`,
      i18n.t('run.goldEssence', { '0': this.gsm.gold, '1': this.gsm.essence }),
    );
    this.endBtn = d(
      `
      font-size: 8px; color: ${THEME.accent.red}; cursor: pointer; font-weight: bold;
      pointer-events: all; padding: 3px 8px;
      border: 1px solid rgba(248,113,113,0.4); border-radius: ${THEME.radius.md};
      background: rgba(0,0,0,0.25); display: none;
      transition: background 0.15s, border-color 0.15s;
    `,
      i18n.t('camp.endRun'),
    );
    this.endBtn.addEventListener('mouseenter', () => {
      this.endBtn.style.background = 'rgba(248,113,113,0.2)';
      this.endBtn.style.borderColor = 'rgba(248,113,113,0.7)';
    });
    this.endBtn.addEventListener('mouseleave', () => {
      this.endBtn.style.background = 'rgba(0,0,0,0.25)';
      this.endBtn.style.borderColor = 'rgba(248,113,113,0.4)';
    });
    this.endBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.runManager.canEndVoluntarily) {
        toast(i18n.t('notify.catchFirst'));
        return;
      }
      this.runManager.endRunVoluntarily();
    });
    const campBtn = d(
      `
      font-size: 9px; color: ${THEME.accent.amber}; cursor: pointer; font-weight: bold;
      pointer-events: all; padding: 3px 8px;
      border: 1px solid rgba(251,191,36,0.4); border-radius: ${THEME.radius.md};
      background: rgba(0,0,0,0.25); display: none;
      transition: background 0.15s, border-color 0.15s;
    `,
      '🏕️',
    );
    campBtn.addEventListener('mouseenter', () => {
      campBtn.style.background = 'rgba(251,191,36,0.2)';
      campBtn.style.borderColor = 'rgba(251,191,36,0.7)';
    });
    campBtn.addEventListener('mouseleave', () => {
      campBtn.style.background = 'rgba(0,0,0,0.25)';
      campBtn.style.borderColor = 'rgba(251,191,36,0.4)';
    });
    campBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.runManager.canEndVoluntarily) {
        toast(i18n.t('notify.catchFirst'));
        return;
      }
      this.runManager.endRunVoluntarily();
    });
    right.append(this.goldLabel, campBtn, this.endBtn);
    this._campBtn = campBtn;
    this.runHUD.appendChild(right);
    document.body.appendChild(this.runHUD);
  }

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.RUN_START, () => {
        this.runHUD.style.display = 'flex';
        this._campBtn.style.display = 'block';
        this.endBtn.style.display = 'block';
        this.charmIcons.textContent = this.runManager.charms.map((c) => c.icon).join(' ');
        const synergies = this.runManager.modStats?.synergies ?? [];
        this.synergyLabel.textContent =
          synergies.length > 0 ? `🔗 ${synergies.map((s) => s.name).join(' · ')}` : '';
        this.sceneUI.hideBackdrop();
        this.sceneUI.hideStart();
        this._updateRunHUD();
      }),
      this.eventBus.on(GameEvents.RUN_CAST_CONSUMED, () => this._updateRunHUD()),
      this.eventBus.on(GameEvents.FISHING_REEL_UPDATE, () => this._updateRunHUD()),
      this.eventBus.on(GameEvents.FISHING_CATCH, () => this._updateRunHUD()),
      this.eventBus.on(GameEvents.RUN_END, (p) => {
        this.resultPanel.show(p.rewards, {
          onBackToCamp: () => this.showCampPanel(),
          onFishAgain: () => this._showCharmPicker(),
        });
        this.runHUD.style.display = 'none';
        this._campBtn.style.display = 'none';
        this.endBtn.style.display = 'none';
      }),
      this.eventBus.on(GameEvents.RUN_EVENT, (p) => this._showEventToast(p.event)),
      this.eventBus.on(GameEvents.DAILY_QUEST_COMPLETED, (p) => {
        toast(`✅ Daily quest complete! +${p.gold ?? 0}G +${p.essence ?? 0}✨`);
      }),
      this.eventBus.on(GameEvents.DAILY_FREE_BAIT_CLAIMED, (p) => {
        toast(`🪱 Free bait claimed! +${p.amount ?? 3} ${p.baitId ?? 'bait'}`);
      }),
    );
  }

  private _updateRunHUD(): void {
    this.castsLabel.textContent = i18n.t('run.casts', { '0': this.runManager.remainingCasts });
    this.duraLabel.textContent = i18n.t('run.durability', {
      '0': Math.floor(this.runManager.durability),
    });

    const baitId = this.runManager.currentBait;
    const baitDef = BAITS.find((b) => b.id === baitId);
    const charges = this.runManager.remainingBaitCharges;
    this.baitLabel.textContent =
      baitDef && baitId !== 'bait_worm'
        ? `🪱 ${i18n.lang === 'zh' ? baitDef.name.zh : baitDef.name.en} x${charges}`
        : '';
    const runEarnings = this.runManager.fishCaughtThisRun.reduce((sum, f) => sum + f.goldEarned, 0);
    this.runEarningsLabel.textContent = runEarnings > 0 ? `💰+${runEarnings}` : '';
    this.goldLabel.textContent = i18n.t('run.goldEssence', {
      '0': this.gsm.gold,
      '1': this.gsm.essence,
    });
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

  // ══ Event Toast ══

  private _showEventToast(event: RunEvent): void {
    const evtI18n = i18n.event(event.id);
    const toastEl = d(
      `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      padding: 10px 18px; background: ${THEME.panel.bg};
      border: ${THEME.panel.border}; border-radius: ${THEME.panel.radius};
      color: ${THEME.text.primary}; text-align: center; z-index: 250;
      font-family: ${THEME.panel.font}; font-size: 9px;
      pointer-events: all; min-width: 200px;
    `,
      `<div style="font-size:11px;margin-bottom:3px;">${evtI18n.name}</div>
       <div style="color:#888;">${evtI18n.desc}</div>`,
    );

    if ((event.choices?.length ?? 0) > 0) {
      const btns = d('display: flex; gap: 4px; justify-content: center; margin-top: 6px;');
      (event.choices ?? []).forEach((choice) => {
        const btn = d(
          `
          padding: 3px 10px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); color: #ccc;
          font-size: 8px; cursor: pointer; border-radius: ${THEME.radius.md};
        `,
          choice.label,
        );
        btn.addEventListener('click', () => {
          toastEl.remove();
          this._applyChoice(choice);
        });
        btns.appendChild(btn);
      });
      toastEl.appendChild(btns);
    } else {
      toastEl.addEventListener('click', () => toastEl.remove());
    }
    document.body.appendChild(toastEl);
    setTimeout(() => {
      if (toastEl.parentElement) toastEl.remove();
    }, 7000);
  }

  private _applyChoice(choice: NonNullable<RunEvent['choices']>[number]): void {
    switch (choice.outcome) {
      case 'blessing_progress':
        this.runManager.addModifier({
          id: 'evt_progress',
          name: 'Spirit Blessing',
          description: '+3 progress rate',
          icon: '✨',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'fishProgressRate', value: 3 }],
          tags: ['event'],
        });
        toast(i18n.t('toast.blessing_progress'));
        break;
      case 'blessing_protection':
        this.runManager.addModifier({
          id: 'evt_protect',
          name: 'Spirit Protection',
          description: '-2 line wear',
          icon: '🛡️',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'lineWearRate', value: -2 }],
          tags: ['event'],
        });
        toast(i18n.t('toast.blessing_protection'));
        break;
      case 'relic_risk':
        if (Math.random() < 0.5) {
          toast(i18n.t('toast.relic_risk_nothing'));
        } else {
          this.runManager.applyLineDamage(20);
          toast(i18n.t('toast.relic_risk_damage'));
        }
        break;
      case 'chest_gamble':
        if (Math.random() < 0.5) {
          this.gsm.addGold(200, 'event');
          this._updateRunHUD();
          toast(i18n.t('toast.chest_gold'));
        } else {
          this.runManager.applyLineDamage(15);
          toast(i18n.t('toast.chest_curse'));
        }
        break;
      case 'tangle_cut':
        this.runManager.consumeCasts(2);
        toast(i18n.t('toast.tangle_cut'));
        break;
      case 'tangle_patient':
        this.runManager.applyLineDamage(4);
        toast(i18n.t('toast.tangle_patient'));
        break;
      case 'whirlpool_reel':
        this.runManager.applyLineDamage(10);
        toast(i18n.t('toast.whirlpool_reel'));
        break;
      case 'whirlpool_slack':
        this.runManager.consumeCasts(3);
        toast(i18n.t('toast.whirlpool_slack'));
        break;
      case 'trade_casts':
        this.runManager.consumeCasts(5);
        const rareCharms = ALL_CHARMS.filter((c) => c.rarity === ModifierRarity.Rare);
        if (rareCharms.length) {
          this.runManager.addModifier(rareCharms[Math.floor(Math.random() * rareCharms.length)]);
          toast(i18n.t('toast.trade_charm'));
        }
        break;
    }
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
