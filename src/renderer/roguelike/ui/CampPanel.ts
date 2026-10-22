// ===== src/renderer/roguelike/ui/CampPanel.ts =====
// Camp panel: destination hero, economy strip, upgrade cards, bait shop, relics,
// dailies, save slots and achievements. Logic is unchanged from the previous
// implementation — only the presentation was rebuilt with the v2 art language.

import { DraggablePanel } from '../../ui/DraggablePanel';
import { SceneUI } from '../../ui/SceneUI';
import { GameStateManager } from '../../core/GameStateManager';
import { DailySystem } from '../../data/DailySystem';
import { LocationManager } from '../../locations/LocationManager';
import { ALL_RELICS } from '../relic-data';
import { ALL_ACHIEVEMENTS } from '../achievement-data';
import { LOCATIONS } from '../../data/location-data';
import { BAITS } from '../../../shared/constants';
import { d, toast, sectionTitle } from './run-ui-helpers';
import { i18n } from '../../i18n/I18n';
import { svgIcon, baitIconName, relicIconName, achievementIconName } from '../../ui/icons';
import { locationIllustration } from '../../ui/LocationIllustration';
import type { IconName } from '../../ui/icons';

export interface CampPanelCallbacks {
  onStartRun: () => void;
  onLocationChange: (locationId: string) => void;
}

const LOCATION_ORDER = [
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

const LOCATION_PREFIX: Record<string, string> = {
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

const UPGRADE_ICONS: Record<string, IconName> = {
  charm_slots: 'charm',
  relic_slots: 'relic',
  charm_rerolls: 'sparkle',
  bait_pouch: 'bait',
  line_durability: 'durability',
};

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
    const savedScrollTop = this.activePanel?.getBody().scrollTop ?? 0;
    this.close();
    this.sceneUI.showBackdrop();

    const panel = new DraggablePanel(i18n.t('camp.title'), 384, 'camp');
    panel.el.id = 'camp-panel';
    panel.setPosition((window.innerWidth - 384) / 2, 8);
    const body = panel.getBody();

    this._renderEconomy(body);
    this._renderDestination(body);
    this._renderSpecialization(body, callbacks);
    this._renderUpgradeProgress(body);
    this._renderLocations(body, callbacks);
    this._renderUpgrades(body, callbacks);
    this._renderBaitShop(body, callbacks);
    this._renderRelics(body, callbacks);
    this._renderDailies(body, callbacks);
    this._renderSaves(body);
    this._renderAchievements(body);

    // ── Fixed footer: embark ──
    const footer = d();
    footer.className = 'sanctuary-panel-footer';
    const start = d();
    start.id = 'btn-start-run';
    start.className = 'ss-btn ss-btn--gold';
    start.innerHTML = `${svgIcon('rod', 14)}<span>${i18n.t('camp.startRun')}</span>`;
    start.addEventListener('click', () => {
      panel.remove();
      callbacks.onStartRun();
    });
    footer.appendChild(start);
    const hint = d();
    hint.className = 'footer-hint';
    hint.textContent = i18n.t('camp.startHint');
    footer.appendChild(hint);
    panel.el.appendChild(footer);

    panel.getCloseBtn().addEventListener('click', () => {
      panel.remove();
      this.sceneUI.hideBackdrop();
      this.sceneUI.showStart();
    });

    document.body.appendChild(panel.el);
    body.scrollTop = savedScrollTop;
    this.activePanel = panel;
  }

  // ══ Sections ══

  private _renderEconomy(body: HTMLDivElement): void {
    const wrap = d();
    wrap.className = 'camp-economy';
    wrap.innerHTML = `
      <span class="camp-coin">${svgIcon('coin', 14)}<span>${this.gsm.gold}</span></span>
      <span class="camp-essence">${svgIcon('sparkle', 13)}<span>${this.gsm.essence}</span></span>`;
    body.appendChild(wrap);
  }

  private _renderDestination(body: HTMLDivElement): void {
    const destination = LOCATIONS.find((loc) => loc.id === this.selectedLocation);
    if (!destination) return;
    const hero = d();
    hero.className = 'camp-hero';
    const accent = '#' + (destination.theme?.uiAccent ?? 0xa9c3a0).toString(16).padStart(6, '0');
    hero.style.setProperty('--location-accent', accent);
    hero.innerHTML = `
      <span class="camp-hero__art">${locationIllustration(destination.id)}</span>
      <span class="camp-hero__eyebrow">${svgIcon('pin', 10)}${i18n.t('camp.nextSanctuary')}</span>
      <strong class="camp-hero__name">${destination.name[i18n.lang]}</strong>
      <span class="camp-hero__en">${
        i18n.lang === 'zh' ? destination.name.en : destination.name.zh
      }</span>
      <span class="camp-hero__desc">${
        i18n.lang === 'zh' ? destination.desc : i18n.t('camp.destinationHint')
      }</span>`;
    body.appendChild(hero);
  }

  private _renderSpecialization(body: HTMLDivElement, callbacks: CampPanelCallbacks): void {
    if (!this.gsm.campManager.specializationPending) return;
    body.appendChild(sectionTitle('sparkle', i18n.t('camp.specTitle')));
    const note = d();
    note.className = 'camp-daily-note';
    note.innerHTML = `${svgIcon('warn', 10)}<span>${i18n.t('spec2.choose')}</span>`;
    body.appendChild(note);

    const grid = d();
    grid.className = 'camp-spec-grid';
    const options: {
      id: 'charm_master' | 'line_master';
      icon: IconName;
      name: string;
      desc: string;
    }[] = [
      {
        id: 'charm_master',
        icon: 'charm',
        name: i18n.t('spec2.charmMaster'),
        desc: i18n.t('spec2.charmMasterDesc'),
      },
      {
        id: 'line_master',
        icon: 'durability',
        name: i18n.t('spec2.lineMaster'),
        desc: i18n.t('spec2.lineMasterDesc'),
      },
    ];
    options.forEach((option) => {
      const card = d();
      card.className = 'spec-card';
      card.innerHTML = `
        <span class="spec-card__name">${svgIcon(option.icon, 12)}${option.name}</span>
        <span class="spec-card__desc">${option.desc}</span>`;
      card.addEventListener('click', () => {
        this.gsm.campManager.chooseSpecialization(option.id);
        this.show(callbacks);
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  private _renderUpgradeProgress(body: HTMLDivElement): void {
    const upgrades = this.gsm.campManager.getAllUpgrades();
    let closest: {
      name: string;
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
        closest = {
          name: i18n.upgrade(def.id).name ?? def.name,
          goldPct: Math.min(100, Math.floor(gRatio * 100)),
          essencePct: Math.min(100, Math.floor(eRatio * 100)),
          affordable: gRatio >= 1 && eRatio >= 1,
        };
      }
    }
    if (!closest) return;

    const card = d();
    card.className = 'camp-progress-card';
    card.innerHTML = `
      <div class="camp-progress-card__title">${svgIcon('chevronUp', 10)}${closest.name}</div>
      <div class="camp-progress-line">${svgIcon('coin', 10)}<span class="ss-bar"><i class="${
        closest.affordable ? 'is-sage' : ''
      }" style="transform:scaleX(${closest.goldPct / 100})"></i></span><span>${closest.goldPct}%</span></div>
      <div class="camp-progress-line">${svgIcon('sparkle', 10)}<span class="ss-bar"><i class="is-sky" style="transform:scaleX(${
        closest.essencePct / 100
      })"></i></span><span>${closest.essencePct}%</span></div>`;
    body.appendChild(card);
  }

  private _renderLocations(body: HTMLDivElement, callbacks: CampPanelCallbacks): void {
    body.appendChild(sectionTitle('pin', i18n.t('camp.location'), String(LOCATIONS.length)));
    const grid = d();
    grid.className = 'location-grid';

    LOCATIONS.forEach((loc) => {
      const unlocked = this.gsm.unlockedLocations.has(loc.id);
      const selected = this.selectedLocation === loc.id;
      const idx = LOCATION_ORDER.indexOf(loc.id);
      const prevId = idx > 0 ? LOCATION_ORDER[idx - 1] : null;
      const isNext = prevId ? this.gsm.unlockedLocations.has(prevId) && !unlocked : false;

      const card = d();
      card.className = 'location-card';
      card.dataset.selected = String(selected);
      card.dataset.locked = String(!unlocked);
      card.title = loc.name[i18n.lang];
      card.style.setProperty(
        '--location-accent',
        '#' + (loc.theme?.uiAccent ?? 0xa9c3a0).toString(16).padStart(6, '0'),
      );

      let progress = '';
      if (isNext) {
        const prefix = LOCATION_PREFIX[prevId!];
        const discovered = Object.values(this.gsm.fishpedia).filter(
          (e) => e.fishId.startsWith(prefix) && e.discovered,
        ).length;
        progress = `<span class="location-card__progress">${discovered}/5</span>`;
      }

      card.innerHTML = `
        <span class="location-card__art">${locationIllustration(loc.id)}</span>
        <span class="location-card__index">${String(idx + 1).padStart(2, '0')}${
          unlocked ? '' : ` ${svgIcon('lock', 8)}`
        }</span>
        <span class="location-card__name">${loc.country}</span>
        ${progress}`;

      if (unlocked) {
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', loc.name[i18n.lang]);
        card.setAttribute('aria-pressed', String(selected));
        card.tabIndex = 0;
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
        card.addEventListener('click', () => {
          this.selectedLocation = loc.id;
          this.locationManager.loadLocation(loc.id);
          callbacks.onLocationChange(loc.id);
          this.show(callbacks);
        });
      }
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  private _renderUpgrades(body: HTMLDivElement, callbacks: CampPanelCallbacks): void {
    body.appendChild(sectionTitle('chevronUp', i18n.t('camp.upgradesTitle')));
    const list = d();
    list.className = 'upgrade-list';

    this.gsm.campManager.getAllUpgrades().forEach(({ def, level, cost }) => {
      const affordable = !!cost && this.gsm.canAfford(cost.gold, cost.essence);
      const maxed = !cost;
      const meta = this.gsm.campManager.getMeta();
      const upgI18n = i18n.upgrade(def.id);
      let effect: string;
      switch (def.id) {
        case 'charm_slots':
          effect = i18n.t('camp.effect.charmSlots', { '0': meta.charmSlots });
          break;
        case 'relic_slots':
          effect = i18n.t('camp.effect.relicSlots', { '0': meta.relicSlots });
          break;
        case 'charm_rerolls':
          effect = i18n.t('camp.effect.charmRerolls', { '0': meta.charmRerolls });
          break;
        case 'bait_pouch':
          effect = i18n.t('camp.effect.baitPouch', { '0': meta.baitPouchSize });
          break;
        default:
          effect = i18n.t('camp.effect.lineDurability', { '0': meta.baseLineDurability });
      }

      const row = d();
      row.className = 'upgrade-row';
      row.dataset.buyable = String(affordable);
      row.dataset.max = String(maxed);
      row.innerHTML = `
        <span class="upgrade-row__icon">${svgIcon(UPGRADE_ICONS[def.id] ?? 'chevronUp', 12)}</span>
        <span class="upgrade-row__main">
          <span class="upgrade-row__name">${upgI18n.name}
            <span class="upgrade-row__level">${i18n.t('camp.level', {
              '0': level,
              '1': def.maxLevel,
            })}</span>
          </span>
          <span class="upgrade-row__desc">${upgI18n.desc}</span>
        </span>
        <span class="upgrade-row__effect">${effect}</span>
        <span class="upgrade-row__cost ${affordable ? 'is-affordable' : ''}">${
          cost
            ? `${svgIcon('coin', 10)}${cost.gold} ${svgIcon('sparkle', 10)}${cost.essence}`
            : i18n.t('equip.max')
        }</span>`;

      if (affordable) {
        row.addEventListener('click', () => {
          if (this.gsm.spend(cost!.gold, cost!.essence)) {
            this.gsm.campManager.purchase(def.id);
            this.show(callbacks);
          }
        });
      }
      list.appendChild(row);

      if (def.id === 'charm_slots' && this.gsm.campManager.getMeta().synergySlotUnlocked) {
        const milestone = d();
        milestone.className = 'upgrade-milestone';
        milestone.innerHTML = `${svgIcon('link', 9)}<span>${i18n.t('camp.synergyNote')}</span>`;
        list.appendChild(milestone);
      }
    });
    body.appendChild(list);
  }

  private _renderBaitShop(body: HTMLDivElement, callbacks: CampPanelCallbacks): void {
    body.appendChild(sectionTitle('bait', i18n.t('camp.baitShop')));

    // Auto-restock free earthworms so casual players never run out.
    const WORM_RESTOCK_AMOUNT = 20;
    const currentWorms = this.gsm.getBaitCount('bait_worm');
    if (currentWorms < WORM_RESTOCK_AMOUNT) {
      this.gsm.addBait('bait_worm', WORM_RESTOCK_AMOUNT - currentWorms);
    }

    const grid = d();
    grid.className = 'camp-grid-2';
    BAITS.forEach((bait) => {
      const owned = this.gsm.getBaitCount(bait.id);
      const affordable = bait.cost > 0 && this.gsm.gold >= bait.cost;
      const isFree = bait.cost === 0;
      const name = i18n.lang === 'zh' ? bait.name.zh : bait.name.en;
      const card = d();
      card.className = 'bait-card';
      card.dataset.buyable = String(affordable || isFree);
      card.dataset.unavailable = String(!affordable && !isFree);
      card.innerHTML = `
        <span class="bait-card__icon">${svgIcon(baitIconName(bait.id), 14)}</span>
        <span class="bait-card__main">
          <span class="bait-card__name">${name}</span>
          <span class="bait-card__stats">
            <span class="is-rare">${i18n.t('picker.rare', { '0': bait.rareBonus })}</span>
            <span class="is-wait">${i18n.t('picker.wait', { '0': bait.waitReduction })}</span>
          </span>
          <span class="bait-card__foot">
            <span class="bait-card__price">${
              bait.cost > 0 ? `${bait.cost}G` : i18n.t('bait.autoRestocked')
            }</span>
            <span class="bait-card__owned">${i18n.t('camp.owned', { '0': owned })}</span>
          </span>
        </span>`;
      card.addEventListener('click', () => {
        if (isFree) {
          if (this.gsm.purchaseBait(bait.id, 5)) {
            toast(i18n.t('bait.freeClaimed', { '0': name }), 'bait');
            this.show(callbacks);
          }
          return;
        }
        if (!affordable) {
          toast(i18n.t('bait.notEnoughGold'), 'coin');
          return;
        }
        if (this.gsm.purchaseBait(bait.id, 1)) {
          toast(i18n.t('bait.purchased', { '0': name }), 'bait');
          this.show(callbacks);
        }
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  private _renderRelics(body: HTMLDivElement, callbacks: CampPanelCallbacks): void {
    body.appendChild(sectionTitle('relic', i18n.t('camp.relics')));
    const grid = d();
    grid.className = 'camp-grid-2';
    ALL_RELICS.forEach((relic) => {
      const owned = this.gsm.ownedRelics.has(relic.id);
      const equipped = this.gsm.equippedRelics.has(relic.id);
      const relI18n = i18n.relic(relic.id);
      const card = d();
      card.className = 'relic-card';
      card.dataset.owned = String(owned);
      card.dataset.equipped = String(equipped);
      card.title = owned ? relI18n.desc : i18n.t('soul.locked');
      card.innerHTML = `
        <span class="relic-card__icon">${
          owned ? svgIcon(relicIconName(relic.id), 14) : svgIcon('lock', 12)
        }</span>
        <span class="relic-card__main">
          <span class="relic-card__name">${owned ? relI18n.name : '???'}</span>
          <span class="relic-card__state ${equipped ? 'is-equipped' : ''}">${
            owned
              ? equipped
                ? `${svgIcon('check', 9)}${i18n.t('equip.equipped')}`
                : i18n.t('equip.click')
              : i18n.t('soul.locked')
          }</span>
        </span>`;
      if (owned) {
        card.addEventListener('click', () => {
          if (equipped) this.gsm.unequipRelic(relic.id);
          else this.gsm.equipRelic(relic.id);
          this.show(callbacks);
        });
      }
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  private _renderDailies(body: HTMLDivElement, callbacks: CampPanelCallbacks): void {
    const quests = this.dailySystem.activeQuests;
    if (quests.length === 0) return;

    body.appendChild(sectionTitle('daily', i18n.t('camp.daily')));

    const note = d();
    note.className = 'camp-daily-note';
    note.innerHTML = `
      ${svgIcon('daily', 10)}
      <span>${i18n.t('camp.streak', { '0': this.dailySystem.streakDays })}</span>
      ${
        this.dailySystem.hotspotLocation
          ? `<span class="is-hot">${svgIcon('pin', 9)}${i18n.t('camp.hotspot', {
              '0': this.dailySystem.hotspotLocation.toUpperCase(),
            })}</span>`
          : ''
      }`;
    body.appendChild(note);

    const freeBaitAvailable = this.dailySystem.freeBaitAvailable;
    const freeBaitBtn = d();
    freeBaitBtn.className = freeBaitAvailable ? 'ss-btn ss-btn--primary' : 'ss-btn ss-btn--ghost';
    freeBaitBtn.dataset.disabled = String(!freeBaitAvailable);
    freeBaitBtn.innerHTML = `${svgIcon('bait', 11)}<span>${
      freeBaitAvailable ? i18n.t('camp.freeBait') : i18n.t('camp.freeBaitDone')
    }</span>`;
    freeBaitBtn.style.marginBottom = '5px';
    if (freeBaitAvailable) {
      freeBaitBtn.addEventListener('click', () => {
        if (this.dailySystem.claimFreeBait()) this.show(callbacks);
      });
    }
    body.appendChild(freeBaitBtn);

    const list = d();
    list.className = 'quest-list';
    quests.forEach((quest) => {
      const target = typeof quest.target === 'number' ? quest.target : 1;
      const progress = Math.min(quest.progress, target);
      const pct = Math.max(0, Math.min(1, progress / target));
      const row = d();
      row.className = 'quest-row';
      row.dataset.completed = String(quest.completed);
      row.innerHTML = `
        <div class="quest-row__head">
          ${quest.completed ? svgIcon('check', 10) : svgIcon('daily', 10)}
          <span class="quest-row__text">${quest.desc}</span>
          <span class="quest-row__reward">${i18n.t('camp.questReward', {
            '0': quest.rewardGold,
          })}</span>
        </div>
        <span class="ss-bar"><i class="${quest.completed ? 'is-sage' : ''}" style="transform:scaleX(${pct})"></i></span>`;
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  private _renderSaves(body: HTMLDivElement): void {
    body.appendChild(sectionTitle('save', i18n.t('camp.save')));
    const grid = d();
    grid.className = 'save-grid';

    for (let slot = 0; slot < 3; slot++) {
      const info = GameStateManager.getSlotInfo(slot);
      const isCurrent = slot === this.gsm.currentSlot;
      const shortTime = info
        ? new Date(info.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const cell = d();
      cell.className = 'save-slot';
      cell.dataset.current = String(isCurrent);
      cell.innerHTML = `
        ${svgIcon(isCurrent ? 'save' : info ? 'save' : 'lock', 12)}
        <span class="save-slot__name">${String(slot + 1).padStart(2, '0')} ${
          isCurrent ? i18n.t('camp.saveCurrent') : ''
        }</span>
        <span class="save-slot__meta">${
          info
            ? i18n.t('camp.slotInfo', { '0': info.gold, '1': shortTime })
            : i18n.t('camp.saveEmpty')
        }</span>`;
      cell.addEventListener('click', () => {
        const message = isCurrent
          ? i18n.t('save.slot', { '0': slot + 1 })
          : info
            ? `${i18n.t('save.slot', { '0': slot + 1 })}?`
            : i18n.t('save.slot', { '0': slot + 1 });
        if (confirm(message)) {
          if (!isCurrent) {
            localStorage.setItem('soulsanctuary_active_slot', String(slot));
            location.reload();
          }
        }
      });
      grid.appendChild(cell);
    }
    body.appendChild(grid);

    const io = d();
    io.className = 'camp-io';
    const exportBtn = d();
    exportBtn.className = 'ss-btn ss-btn--ghost';
    exportBtn.innerHTML = `${svgIcon('export', 10)}<span>${i18n.t('save.export')}</span>`;
    exportBtn.addEventListener('click', () => {
      const json = this.gsm.exportJSON();
      navigator.clipboard
        .writeText(json)
        .then(() => toast(i18n.t('notify.exported'), 'check'))
        .catch((err: unknown) => console.error('[CampPanel] export to clipboard failed:', err));
    });
    const importBtn = d();
    importBtn.className = 'ss-btn ss-btn--ghost';
    importBtn.innerHTML = `${svgIcon('import', 10)}<span>${i18n.t('save.import')}</span>`;
    importBtn.addEventListener('click', () => {
      const input = prompt(i18n.t('save.import'));
      if (input && this.gsm.importJSON(input)) {
        toast(i18n.t('notify.imported'), 'check');
        setTimeout(() => location.reload(), 800);
      } else if (input) {
        toast(i18n.t('notify.importFailed'), 'warn');
      }
    });
    io.append(exportBtn, importBtn);
    body.appendChild(io);
  }

  private _renderAchievements(body: HTMLDivElement): void {
    if (ALL_ACHIEVEMENTS.length === 0) return;
    const unlocked = this.gsm.unlockedAchievements;
    body.appendChild(
      sectionTitle(
        'trophy',
        i18n.t('camp.achievements'),
        `${unlocked.size}/${ALL_ACHIEVEMENTS.length}`,
      ),
    );
    const grid = d();
    grid.className = 'ach-grid';
    ALL_ACHIEVEMENTS.forEach((ach) => {
      const earned = unlocked.has(ach.id);
      const card = d();
      card.className = 'ach-card';
      card.dataset.earned = String(earned);
      card.title = earned ? ach.desc : '???';
      card.innerHTML = `
        ${svgIcon(earned ? achievementIconName(ach.id) : 'lock', 13)}
        <span class="ach-card__name">${earned ? ach.name : '???'}</span>`;
      grid.appendChild(card);
    });
    body.appendChild(grid);
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
