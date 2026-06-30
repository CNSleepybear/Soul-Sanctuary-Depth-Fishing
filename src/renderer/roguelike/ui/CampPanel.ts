// ===== src/renderer/roguelike/ui/CampPanel.ts =====
// Camp panel: upgrades, location picker, bait shop, relics, dailies, saves, achievements.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { DailySystem } from '../../data/DailySystem';
import { LocationManager } from '../../locations/LocationManager';
import { ALL_RELICS } from '../relic-data';
import { ALL_ACHIEVEMENTS } from '../achievement-data';
import { LOCATIONS } from '../../data/location-data';
import { BAITS } from '../../../shared/constants';
import { d, toast } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { THEME } from '../../ui/theme';

export interface CampPanelCallbacks {
  onStartRun: () => void;
  onLocationChange: (locationId: string) => void;
}

export class CampPanel {
  private gsm: GameStateManager;
  private dailySystem: DailySystem;
  private sceneUI: SceneUI;
  private locationManager: LocationManager;
  private activePanel: DraggablePanel | null = null;
  private selectedLocation: string;

  constructor(
    gsm: GameStateManager,
    dailySystem: DailySystem,
    sceneUI: SceneUI,
    locationManager: LocationManager,
    initialLocation: string,
  ) {
    this.gsm = gsm;
    this.dailySystem = dailySystem;
    this.sceneUI = sceneUI;
    this.locationManager = locationManager;
    this.selectedLocation = initialLocation;
  }

  get currentSelectedLocation(): string {
    return this.selectedLocation;
  }

  show(callbacks: CampPanelCallbacks): void {
    const savedScrollTop = this.activePanel?.el?.scrollTop ?? 0;
    this.close();
    this.sceneUI.showBackdrop();

    const panel = new DraggablePanel(i18n.t('camp.title'), 380);
    panel.el.id = 'camp-panel';
    panel.setPosition(window.innerWidth / 2 - 190, 40);
    const body = panel.getBody();

    // Header: gold / essence
    const header = d('display: flex; justify-content: center; gap: 12px; margin-bottom: 10px;', '');
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:${THEME.accent.goldText};font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
        💰 ${this.gsm.gold}
      </div>
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:${THEME.accent.purple};font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
        ✨ ${this.gsm.essence}
      </div>
    `;
    body.appendChild(header);

    // Specialization choice
    if (this.gsm.campManager.specializationPending) {
      const specRow = d('display:flex;gap:4px;justify-content:center;margin:4px 0;');
      const charmBtn = d(
        `
        flex:1; padding:8px 0; text-align:center; cursor:pointer;
        background:rgba(68,221,136,0.12); border:1px solid rgba(68,221,136,0.35);
        border-radius:${THEME.radius.md}; font-size:10px; color:${THEME.accent.green}; font-weight:bold;
      `,
        `${i18n.t('spec.charmMaster')}<br><span style="font-size:8px;color:#9ca3af;font-weight:normal;">${i18n.t('spec.charmMasterDesc')}</span>`,
      );
      charmBtn.addEventListener('click', () => {
        this.gsm.campManager.chooseSpecialization('charm_master');
        this.show(callbacks);
      });
      const lineBtn = d(
        `
        flex:1; padding:8px 0; text-align:center; cursor:pointer;
        background:rgba(100,200,255,0.12); border:1px solid rgba(100,200,255,0.35);
        border-radius:${THEME.radius.md}; font-size:10px; color:${THEME.accent.cyan}; font-weight:bold;
      `,
        `${i18n.t('spec.lineMaster')}<br><span style="font-size:8px;color:#9ca3af;font-weight:normal;">${i18n.t('spec.lineMasterDesc')}</span>`,
      );
      lineBtn.addEventListener('click', () => {
        this.gsm.campManager.chooseSpecialization('line_master');
        this.show(callbacks);
      });
      specRow.appendChild(charmBtn);
      specRow.appendChild(lineBtn);
      body.appendChild(
        d(
          'text-align:center;color:rgba(255,200,100,0.85);font-size:9px;margin-top:6px;text-shadow:0 1px 2px rgba(0,0,0,0.4);',
          i18n.t('spec.choose'),
        ),
      );
      body.appendChild(specRow);
    }

    // Next upgrade progress bar
    const upgrades = this.gsm.campManager.getAllUpgrades();
    let closestUpg: {
      name: string;
      goldNeeded: number;
      essenceNeeded: number;
      goldPct: number;
      essencePct: number;
      affordable: boolean;
    } | null = null;
    let closestScore = Infinity;
    for (const { def, cost } of upgrades) {
      if (!cost) continue;
      const gRatio = this.gsm.gold / cost.gold;
      const eRatio = this.gsm.essence / cost.essence;
      const score = Math.max(1 - gRatio, 0) + Math.max(1 - eRatio, 0);
      if (score < closestScore) {
        closestScore = score;
        closestUpg = {
          name: i18n.upgrade(def.id).name ?? def.name,
          goldNeeded: cost.gold,
          essenceNeeded: cost.essence,
          goldPct: Math.min(100, Math.floor(gRatio * 100)),
          essencePct: Math.min(100, Math.floor(eRatio * 100)),
          affordable: gRatio >= 1 && eRatio >= 1,
        };
      }
    }
    if (closestUpg) {
      const progColor = closestUpg.affordable ? THEME.accent.green : THEME.accent.amber;
      const progHTML = `<div style="margin:6px 0 10px;padding:6px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;">
          <div style="font-size:10px;font-weight:bold;color:${progColor};margin-bottom:5px;text-align:center;">🎯 ${closestUpg.name}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:9px;color:${THEME.accent.goldText};width:22px;">💰</span>
            <span style="flex:1;height:7px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
              <span style="display:block;height:100%;width:${closestUpg.goldPct}%;background:${closestUpg.affordable ? THEME.accent.green : THEME.accent.goldText};border-radius:3px;"></span>
            </span>
            <span style="font-size:9px;color:${THEME.text.primary};width:32px;text-align:right;">${closestUpg.goldPct}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:9px;color:${THEME.accent.purple};width:22px;">✨</span>
            <span style="flex:1;height:7px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
              <span style="display:block;height:100%;width:${closestUpg.essencePct}%;background:${closestUpg.essencePct >= 100 ? '#44dd88' : '#f472b6'};border-radius:3px;"></span>
            </span>
            <span style="font-size:9px;color:${THEME.text.primary};width:32px;text-align:right;">${closestUpg.essencePct}%</span>
          </div>
        </div>`;
      body.append(d('', progHTML));
    }

    // Location Picker
    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 9px; letter-spacing: 1px; margin-bottom: 6px;',
        i18n.t('camp.location'),
      ),
    );
    const locRow = d(
      'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px;',
    );
    const locOrder = [
      'japan',
      'china',
      'usa',
      'uk',
      'france',
      'germany',
      'italy',
      'denmark',
      'iceland',
      'thailand',
      'egypt',
      'greece',
    ];
    const locPrefix: Record<string, string> = {
      japan: 'jpn_',
      china: 'chn_',
      usa: 'usa_',
      uk: 'uk_',
      france: 'fra_',
      germany: 'deu_',
      italy: 'ita_',
      denmark: 'dnk_',
      iceland: 'isl_',
      thailand: 'tha_',
      egypt: 'egy_',
      greece: 'grc_',
    };
    LOCATIONS.forEach((loc) => {
      const unlocked = this.gsm.unlockedLocations.has(loc.id);
      const sel = this.selectedLocation === loc.id;
      const idx = locOrder.indexOf(loc.id);
      const prevId = idx > 0 ? locOrder[idx - 1] : null;
      const isNext = prevId ? this.gsm.unlockedLocations.has(prevId) && !unlocked : false;
      let progressText = '';
      if (isNext) {
        const prefix = locPrefix[prevId!];
        const discovered = Object.values(this.gsm.fishpedia).filter(
          (e) => e.fishId.startsWith(prefix) && e.discovered,
        ).length;
        progressText = `<div style="font-size:8px;color:#facc15;font-weight:bold;margin-top:2px;">${discovered}/5</div>`;
      }
      const btn = d(
        `
        padding: 5px 4px; font-size: 9px; border-radius: ${THEME.radius.md}; text-align: center;
        cursor: ${unlocked ? 'pointer' : 'not-allowed'};
        color: ${!unlocked ? '#444' : sel ? '#ffcc88' : '#9ca3af'};
        background: ${!unlocked ? 'rgba(255,255,255,0.02)' : sel ? 'rgba(255,200,100,0.18)' : 'rgba(255,255,255,0.06)'};
        border: 1px solid ${!unlocked ? 'rgba(255,255,255,0.04)' : sel ? 'rgba(255,200,100,0.45)' : 'rgba(255,255,255,0.12)'};
        ${sel ? 'box-shadow: 0 0 10px rgba(255,200,100,0.2);' : ''}
        transition: background 0.15s, border-color 0.15s;
        font-weight: ${sel ? 'bold' : 'normal'};
      `,
        unlocked
          ? loc.country
          : isNext
            ? `<div>🔒</div><div>${loc.country}</div>${progressText}`
            : '🔒',
      );
      btn.addEventListener('mouseenter', () => {
        if (unlocked && !sel) {
          btn.style.background = 'rgba(255,255,255,0.12)';
          btn.style.borderColor = 'rgba(255,255,255,0.22)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (unlocked && !sel) {
          btn.style.background = 'rgba(255,255,255,0.06)';
          btn.style.borderColor = 'rgba(255,255,255,0.12)';
        }
      });
      if (unlocked) {
        btn.addEventListener('click', () => {
          this.selectedLocation = loc.id;
          this.locationManager.loadLocation(loc.id);
          callbacks.onLocationChange(loc.id);
          this.show(callbacks);
        });
      }
      locRow.appendChild(btn);
    });
    body.appendChild(locRow);

    // Upgrades
    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 9px; letter-spacing: 1px; margin-bottom: 6px;',
        i18n.t('camp.upgrades'),
      ),
    );
    this.gsm.campManager.getAllUpgrades().forEach(({ def, level, cost }) => {
      const canBuy = cost && this.gsm.canAfford(cost.gold, cost.essence);
      const upgI18n = i18n.upgrade(def.id);
      const maxLabel = i18n.t('equip.max');
      const meta = this.gsm.campManager.getMeta();
      const effectText =
        def.id === 'charm_slots'
          ? `${meta.charmSlots} 槽`
          : def.id === 'relic_slots'
            ? `${meta.relicSlots} 槽`
            : def.id === 'charm_rerolls'
              ? `${meta.charmRerolls} 次`
              : def.id === 'bait_pouch'
                ? `${meta.baitPouchSize} 个`
                : `${meta.baseLineDurability} 耐久`;
      const row = d(
        `
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 8px; margin: 4px 0; font-size: 10px;
        background: ${canBuy ? 'rgba(68,221,136,0.08)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${canBuy ? 'rgba(68,221,136,0.2)' : 'rgba(255,255,255,0.1)'};
        border-radius: ${THEME.radius.md}; color: ${THEME.text.primary}; ${canBuy ? 'cursor: pointer;' : cost ? '' : 'opacity: 0.45;'}
        transition: background 0.15s, border-color 0.15s;
      `,
        `<span style="font-weight:bold;">${upgI18n.name}
            <span style="color:#9ca3af;font-weight:normal;">Lv${level}/${def.maxLevel}</span>
            <span style="color:${THEME.accent.greenLight};font-size:8px;margin-left:4px;">${effectText}</span></span>
         <span style="color:${canBuy ? '#facc15' : cost ? '#6b7280' : '#4b5563'};font-weight:bold;">${cost ? `${cost.gold}G ${cost.essence}✨` : maxLabel}</span>`,
      );
      row.addEventListener('mouseenter', () => {
        if (canBuy) {
          row.style.background = 'rgba(68,221,136,0.16)';
          row.style.borderColor = 'rgba(68,221,136,0.4)';
        }
      });
      row.addEventListener('mouseleave', () => {
        if (canBuy) {
          row.style.background = 'rgba(68,221,136,0.08)';
          row.style.borderColor = 'rgba(68,221,136,0.2)';
        }
      });
      if (canBuy) {
        row.addEventListener('click', () => {
          if (this.gsm.spend(cost!.gold, cost!.essence)) {
            this.gsm.campManager.purchase(def.id);
            this.show(callbacks);
          }
        });
      }
      body.appendChild(row);

      if (def.id === 'charm_slots' && this.gsm.campManager.getMeta().synergySlotUnlocked) {
        const milestone = d(
          `
          margin: 2px 0 6px 14px; padding: 3px 8px; font-size: 8px;
          color: rgba(255,200,100,0.85); border-left: 2px solid rgba(255,200,100,0.5);
        `,
          i18n.t('camp.synergyUnlocked'),
        );
        body.appendChild(milestone);
      }
    });

    // Bait Shop
    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 9px; letter-spacing: 1px; margin: 10px 0 6px;',
        '🪱 Bait Shop',
      ),
    );
    const baitGrid = d('display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;');

    // Auto-restock free earthworms so casual players never run out
    const WORM_RESTOCK_AMOUNT = 20;
    const currentWorms = this.gsm.getBaitCount('bait_worm');
    if (currentWorms < WORM_RESTOCK_AMOUNT) {
      this.gsm.addBait('bait_worm', WORM_RESTOCK_AMOUNT - currentWorms);
    }

    BAITS.forEach((bait) => {
      const owned = this.gsm.getBaitCount(bait.id);
      const canBuy = bait.cost > 0 && this.gsm.gold >= bait.cost;
      const isFree = bait.cost === 0;
      const name = i18n.lang === 'zh' ? bait.name.zh : bait.name.en;
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 6px; text-align: left; cursor: ${canBuy ? 'pointer' : 'default'};
        background: ${canBuy ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'};
        border: 1px solid ${canBuy ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'};
        border-radius: ${THEME.radius.md}; color: ${canBuy ? '${THEME.text.primary}' : '#555'};
        transition: background 0.15s, border-color 0.15s;
        display: flex; align-items: center; gap: 6px;
      `;
      card.innerHTML = `
        <div style="font-size: 18px; line-height: 1; flex-shrink: 0;">🪱</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 10px; font-weight: bold; color: ${canBuy ? '#fff' : '#777'}; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
          <div style="font-size: 8px; color: ${canBuy ? '${THEME.accent.amber}' : '#555'}; margin-bottom: 2px;">Rare +${bait.rareBonus}%</div>
          <div style="display: flex; justify-content: space-between; font-size: 8px; color: ${canBuy ? '#9ca3af' : '#555'};">
            <span style="color: ${canBuy ? '${THEME.accent.goldText}' : '#555'}; font-weight: bold;">${bait.cost > 0 ? `${bait.cost}G` : i18n.t('bait.autoRestocked')}</span>
            <span>Own ${owned}</span>
          </div>
        </div>
      `;
      card.addEventListener('mouseenter', () => {
        if (canBuy) {
          card.style.background = 'rgba(255,255,255,0.13)';
          card.style.borderColor = 'rgba(255,255,255,0.25)';
        }
      });
      card.addEventListener('mouseleave', () => {
        if (canBuy) {
          card.style.background = 'rgba(255,255,255,0.07)';
          card.style.borderColor = 'rgba(255,255,255,0.14)';
        }
      });
      card.addEventListener('click', () => {
        if (!canBuy) {
          toast(i18n.t('bait.notEnoughGold'));
        } else if (isFree) {
          if (this.gsm.purchaseBait(bait.id, 5)) {
            toast(i18n.t('bait.freeClaimed', { '0': name }));
            this.show(callbacks);
          }
        } else if (this.gsm.purchaseBait(bait.id, 1)) {
          toast(i18n.t('bait.purchased', { '0': name }));
          this.show(callbacks);
        }
      });
      baitGrid.appendChild(card);
    });
    body.appendChild(baitGrid);

    // Relics
    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 9px; letter-spacing: 1px; margin: 10px 0 6px;',
        i18n.t('camp.relics'),
      ),
    );
    const relicGrid = d('display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;');
    ALL_RELICS.forEach((r) => {
      const owned = this.gsm.ownedRelics.has(r.id);
      const equipped = this.gsm.equippedRelics.has(r.id);
      const relI18n = i18n.relic(r.id);
      const equippedLabel = i18n.t('equip.equipped');
      const clickLabel = i18n.t('equip.click');
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 6px; text-align: left; cursor: ${owned ? 'pointer' : 'default'};
        background: ${equipped ? 'rgba(68,221,136,0.12)' : owned ? 'rgba(255,200,100,0.1)' : 'rgba(255,255,255,0.03)'};
        border: 1px solid ${equipped ? 'rgba(68,221,136,0.45)' : owned ? 'rgba(255,200,100,0.25)' : 'rgba(255,255,255,0.06)'};
        border-radius: ${THEME.radius.md}; color: ${owned ? '${THEME.text.primary}' : '#555'};
        transition: background 0.15s, border-color 0.15s;
        display: flex; align-items: center; gap: 6px;
      `;
      card.innerHTML = `
        <div style="font-size: 18px; line-height: 1; flex-shrink: 0;">${owned ? r.icon : '❓'}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 10px; font-weight: bold; color: ${owned ? '#fff' : '#777'}; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${owned ? relI18n.name : '???'}</div>
          ${owned ? `<div style="font-size: 8px; color: ${equipped ? '${THEME.accent.greenLight}' : '#9ca3af'}; font-weight: ${equipped ? 'bold' : 'normal'};">${equipped ? equippedLabel : clickLabel}</div>` : '<div style="font-size:8px;color:#555;">Locked</div>'}
        </div>
      `;
      card.addEventListener('mouseenter', () => {
        if (owned) {
          card.style.background = equipped ? 'rgba(68,221,136,0.2)' : 'rgba(255,200,100,0.18)';
          card.style.borderColor = equipped ? 'rgba(68,221,136,0.6)' : 'rgba(255,200,100,0.4)';
        }
      });
      card.addEventListener('mouseleave', () => {
        if (owned) {
          card.style.background = equipped ? 'rgba(68,221,136,0.12)' : 'rgba(255,200,100,0.1)';
          card.style.borderColor = equipped ? 'rgba(68,221,136,0.45)' : 'rgba(255,200,100,0.25)';
        }
      });
      if (owned) {
        card.addEventListener('click', () => {
          if (equipped) this.gsm.unequipRelic(r.id);
          else this.gsm.equipRelic(r.id);
          this.show(callbacks);
        });
      }
      relicGrid.appendChild(card);
    });
    body.appendChild(relicGrid);

    // Daily Quests
    const quests = this.dailySystem.activeQuests;
    if (quests.length > 0) {
      body.append(
        d(
          'color: rgba(255,255,255,0.55); font-size: 9px; letter-spacing: 1px; margin: 10px 0 6px;',
          `${i18n.t('camp.daily')} · Streak ${this.dailySystem.streakDays} 🔥${this.dailySystem.hotspotLocation ? ` · Hotspot: ${this.dailySystem.hotspotLocation.toUpperCase()}` : ''}`,
        ),
      );

      const freeBaitAvailable = this.dailySystem.freeBaitAvailable;
      const freeBaitBtn = d(
        `
        padding: 6px 0; margin: 4px 0 8px; text-align: center; font-size: 9px; font-weight: bold;
        background: ${freeBaitAvailable ? 'rgba(68,221,136,0.15)' : 'rgba(255,255,255,0.04)'};
        border: 1px solid ${freeBaitAvailable ? 'rgba(68,221,136,0.4)' : 'rgba(255,255,255,0.08)'};
        border-radius: ${THEME.radius.md}; color: ${freeBaitAvailable ? '${THEME.accent.greenLight}' : '#6b7280'};
        cursor: ${freeBaitAvailable ? 'pointer' : 'default'};
        transition: background 0.15s, box-shadow 0.15s;
      `,
        freeBaitAvailable ? '🪱 Claim Free Bait (x3 Worms)' : '✅ Free bait claimed',
      );
      if (freeBaitAvailable) {
        freeBaitBtn.addEventListener('click', () => {
          if (this.dailySystem.claimFreeBait()) {
            this.show(callbacks);
          }
        });
      }
      body.appendChild(freeBaitBtn);

      quests.forEach((q) => {
        const target = typeof q.target === 'number' ? q.target : 1;
        const progress = Math.min(q.progress, target);
        const pct = Math.floor((progress / target) * 100);
        const row = d(
          `
          display: flex; justify-content: space-between; align-items: center;
          padding: 5px 8px; margin: 3px 0; font-size: 9px;
          background: ${q.completed ? 'rgba(68,221,136,0.1)' : 'rgba(255,255,255,0.04)'};
          border: 1px solid ${q.completed ? 'rgba(68,221,136,0.25)' : 'rgba(255,255,255,0.08)'};
          border-radius: ${THEME.radius.md}; color: ${q.completed ? '${THEME.accent.greenLight}' : '${THEME.text.primary}'};
        `,
          `<span style="font-weight:${q.completed ? 'bold' : 'normal'};">${q.completed ? '✅' : '⬜'} ${q.desc}</span>
           <span style="color:${q.completed ? '#facc15' : '#9ca3af'};font-weight:bold;">💰${q.rewardGold}G</span>`,
        );
        body.appendChild(row);
        const bar = d(`
          height: 4px; background: rgba(255,255,255,0.06); border-radius: ${THEME.radius.sm};
          margin: 0 8px 6px; overflow: hidden;
        `);
        bar.appendChild(
          d(`
          height: 100%; width: ${pct}%; background: ${q.completed ? '${THEME.accent.greenLight}' : '${THEME.accent.goldText}'};
          transition: width 0.3s;
        `),
        );
        body.appendChild(bar);
      });
    }

    // Save Slots
    body.append(
      d(
        'color: ${THEME.text.secondary}; font-size: 9px; letter-spacing: 1px; margin: 10px 0 6px;',
        i18n.t('camp.save'),
      ),
    );
    const saveRow = d('display: flex; gap: 6px; justify-content: center; margin-bottom: 8px;');
    for (let slot = 0; slot < 3; slot++) {
      const info = GameStateManager.getSlotInfo(slot);
      const isCurrent = slot === this.gsm.currentSlot;
      const shortTime = info
        ? new Date(info.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const btn = d(
        `
        flex: 1; padding: 6px 4px; text-align: center; font-size: 9px; cursor: pointer;
        background: ${isCurrent ? 'rgba(68,221,136,0.12)' : info ? 'rgba(255,200,100,0.08)' : 'rgba(255,255,255,0.04)'};
        border: 1px solid ${isCurrent ? 'rgba(68,221,136,0.35)' : info ? 'rgba(255,200,100,0.2)' : 'rgba(255,255,255,0.08)'};
        border-radius: ${THEME.radius.md}; color: ${info ? '${THEME.text.primary}' : '#555'};
        transition: background 0.15s, border-color 0.15s;
      `,
        `<div style="font-size:14px;margin-bottom:2px;">${info ? '💾' : '➕'}</div>
         <div style="font-weight:bold;">Slot ${slot + 1}</div>
         ${info ? `<div style="font-size:8px;color:#9ca3af;margin-top:2px;">💰${info.gold}G · ${shortTime}</div>` : '<div style="font-size:8px;color:#6b7280;margin-top:2px;">Empty</div>'}`,
      );
      btn.addEventListener('mouseenter', () => {
        btn.style.background = isCurrent
          ? 'rgba(68,221,136,0.2)'
          : info
            ? 'rgba(255,200,100,0.16)'
            : 'rgba(255,255,255,0.1)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = isCurrent
          ? 'rgba(68,221,136,0.12)'
          : info
            ? 'rgba(255,200,100,0.08)'
            : 'rgba(255,255,255,0.04)';
      });
      btn.addEventListener('click', () => {
        if (
          confirm(
            isCurrent
              ? 'Save to this slot?'
              : info
                ? `Load slot ${slot + 1}? Current progress will be lost.`
                : `Save to slot ${slot + 1}?`,
          )
        ) {
          if (!isCurrent) {
            localStorage.setItem('soulsanctuary_active_slot', String(slot));
            location.reload();
          }
        }
      });
      saveRow.appendChild(btn);
    }
    body.appendChild(saveRow);

    // JSON export/import
    const ioRow = d('display: flex; gap: 6px; justify-content: center; margin: 4px 0;');
    const expBtn = d(
      'padding: 4px 12px; font-size: 8px; color: #9ca3af; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); border-radius: ${THEME.radius.md}; transition: background 0.15s;',
      i18n.t('save.export'),
    );
    expBtn.addEventListener('mouseenter', () => {
      expBtn.style.background = 'rgba(255,255,255,0.08)';
      expBtn.style.color = '${THEME.text.primary}';
    });
    expBtn.addEventListener('mouseleave', () => {
      expBtn.style.background = 'transparent';
      expBtn.style.color = '#9ca3af';
    });
    expBtn.addEventListener('click', () => {
      const json = this.gsm.exportJSON();
      navigator.clipboard
        .writeText(json)
        .then(() => toast(i18n.t('notify.exported')))
        .catch((err: unknown) => console.error('[CampPanel] export to clipboard failed:', err));
    });
    const impBtn = d(
      'padding: 4px 12px; font-size: 8px; color: #9ca3af; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); border-radius: ${THEME.radius.md}; transition: background 0.15s;',
      i18n.t('save.import'),
    );
    impBtn.addEventListener('mouseenter', () => {
      impBtn.style.background = 'rgba(255,255,255,0.08)';
      impBtn.style.color = '${THEME.text.primary}';
    });
    impBtn.addEventListener('mouseleave', () => {
      impBtn.style.background = 'transparent';
      impBtn.style.color = '#9ca3af';
    });
    impBtn.addEventListener('click', () => {
      const input = prompt('Paste save data JSON:');
      if (input && this.gsm.importJSON(input)) {
        toast(i18n.t('notify.imported'));
        setTimeout(() => location.reload(), 800);
      } else if (input) toast(i18n.t('notify.importFailed'));
    });
    ioRow.appendChild(expBtn);
    ioRow.appendChild(impBtn);
    body.appendChild(ioRow);

    // Achievements
    const unlocked = this.gsm.unlockedAchievements;
    const totalAch = ALL_ACHIEVEMENTS.length;
    const unlockedCount = unlocked.size;
    if (ALL_ACHIEVEMENTS.length > 0) {
      body.append(
        d(
          'color: ${THEME.text.secondary}; font-size: 9px; letter-spacing: 1px; margin: 10px 0 6px;',
          `${i18n.t('camp.achievements')} · ${unlockedCount}/${totalAch}`,
        ),
      );
      const achGrid = d('display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;');
      ALL_ACHIEVEMENTS.forEach((ach) => {
        const earned = unlocked.has(ach.id);
        achGrid.appendChild(
          d(
            `
          padding: 5px 2px; text-align: center; font-size: 8px;
          background: ${earned ? 'rgba(255,200,100,0.1)' : 'rgba(255,255,255,0.03)'};
          border: 1px solid ${earned ? 'rgba(255,200,100,0.25)' : 'rgba(255,255,255,0.06)'};
          border-radius: ${THEME.radius.md}; color: ${earned ? '#ffcc88' : '#555'};
        `,
            `<div style="font-size:14px;margin-bottom:2px;">${earned ? ach.icon : '🔒'}</div>
           <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${ach.desc}">${earned ? ach.name : '???'}</div>`,
          ),
        );
      });
      body.appendChild(achGrid);
    }

    // Start Run
    const start = d(
      `
      margin-top: 12px; padding: 9px 0; text-align: center;
      background: rgba(68,221,136,0.18); border: 1px solid rgba(68,221,136,0.4);
      color: ${THEME.accent.greenLight}; font-size: 11px; font-weight: bold; letter-spacing: 1px;
      cursor: pointer; border-radius: ${THEME.radius.lg};
      transition: background 0.15s, box-shadow 0.15s;
    `,
      i18n.t('camp.startRun'),
    );
    start.id = 'btn-start-run';
    start.addEventListener('mouseenter', () => {
      start.style.background = 'rgba(68,221,136,0.3)';
      start.style.boxShadow = '0 0 18px rgba(68,221,136,0.3)';
    });
    start.addEventListener('mouseleave', () => {
      start.style.background = 'rgba(68,221,136,0.18)';
      start.style.boxShadow = 'none';
    });
    start.addEventListener('click', () => {
      panel.remove();
      callbacks.onStartRun();
    });
    body.appendChild(start);

    panel.getCloseBtn().addEventListener('click', () => {
      panel.remove();
      this.sceneUI.hideBackdrop();
      this.sceneUI.showStart();
    });
    document.body.appendChild(panel.el);
    panel.el.scrollTop = savedScrollTop;
    this.activePanel = panel;
  }

  close(): void {
    if (this.activePanel) {
      this.activePanel.remove();
      this.activePanel = null;
    }
  }

  dispose(): void {
    this.close();
  }
}
