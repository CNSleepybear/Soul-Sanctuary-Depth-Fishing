// ===== src/renderer/roguelike/CampManager.ts =====
// Camp upgrade system — spend Gold + Spirit Essence for permanent upgrades.

import { DEFAULT_CHARM_SLOTS, DEFAULT_RELIC_SLOTS } from '../../shared/constants';
import type { MetaState } from '../../shared/types';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  baseCostGold: number;
  baseCostEssence: number;
  costScale: number; // multiplier per level
  apply: (meta: MetaState, level: number) => void;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'charm_slots',
    name: 'Charm Slots',
    desc: 'Equip more charms per run',
    maxLevel: 4,
    baseCostGold: 200,
    baseCostEssence: 10,
    costScale: 1.8,
    // P0-2: At level 4 (charmSlots=7), unlock synergy slot
    apply: (m, lvl) => {
      m.charmSlots = DEFAULT_CHARM_SLOTS + lvl;
      if (lvl >= 4) m.synergySlotUnlocked = true;
    },
  },
  {
    id: 'relic_slots',
    name: 'Relic Slots',
    desc: 'Equip more relics',
    maxLevel: 3,
    baseCostGold: 500,
    baseCostEssence: 30,
    costScale: 2.0,
    apply: (m, lvl) => {
      m.relicSlots = DEFAULT_RELIC_SLOTS + lvl;
    },
  },
  {
    id: 'charm_rerolls',
    name: 'Charm Rerolls',
    desc: 'Reroll charm choices before a run',
    maxLevel: 3,
    baseCostGold: 150,
    baseCostEssence: 8,
    costScale: 1.6,
    apply: (m, lvl) => {
      m.charmRerolls = lvl;
    },
  },
  {
    id: 'bait_pouch',
    name: 'Bait Pouch',
    desc: 'Carry more bait per run',
    maxLevel: 5,
    baseCostGold: 100,
    baseCostEssence: 5,
    costScale: 1.4,
    apply: (m, lvl) => {
      m.baitPouchSize = 3 + lvl * 2;
    },
  },
  {
    id: 'line_durability',
    name: 'Line Durability',
    desc: 'Stronger baseline fishing line',
    maxLevel: 5,
    baseCostGold: 180,
    baseCostEssence: 12,
    costScale: 1.5,
    apply: (m, lvl) => {
      m.baseLineDurability = 100 + lvl * 20;
    },
  },
];

export class CampManager {
  private meta: MetaState;

  // Track current upgrade levels
  private levels: Map<string, number> = new Map();

  // C-P2-1: Track total non-relic purchases for specialization unlock
  private totalPurchases = 0;
  specializationPending = false; // flag for UI to show specialization picker

  constructor(meta: MetaState) {
    this.meta = meta;
    // Infer levels from meta state
    // P0-2: Initialize synergy slot state from persisted data
    if (meta.synergySlotUnlocked === undefined) meta.synergySlotUnlocked = meta.charmSlots >= 7;
    // C-P2-1: Initialize specialization
    if (!meta.specialization) meta.specialization = 'none';
    this.levels.set('charm_slots', Math.max(0, meta.charmSlots - DEFAULT_CHARM_SLOTS));
    this.levels.set('relic_slots', Math.max(0, meta.relicSlots - DEFAULT_RELIC_SLOTS));
    this.levels.set('charm_rerolls', meta.charmRerolls);
    this.levels.set('bait_pouch', Math.max(0, Math.floor((meta.baitPouchSize - 3) / 2)));
    this.levels.set(
      'line_durability',
      Math.max(0, Math.floor((meta.baseLineDurability - 100) / 20)),
    );

    // C-P2-1: Reconstruct total purchases from levels
    for (const [id, lvl] of this.levels) {
      if (id !== 'relic_slots') this.totalPurchases += lvl;
    }
    // Check if specialization should be pending (3+ purchases, none chosen yet)
    this.specializationPending = this.totalPurchases >= 3 && this.meta.specialization === 'none';
  }

  getLevel(upgradeId: string): number {
    return this.levels.get(upgradeId) ?? 0;
  }

  getCost(upgradeId: string): { gold: number; essence: number } | null {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return null;
    const lvl = this.levels.get(upgradeId) ?? 0;
    if (lvl >= def.maxLevel) return null; // maxed
    return {
      gold: Math.floor(def.baseCostGold * Math.pow(def.costScale, lvl)),
      essence: Math.floor(def.baseCostEssence * Math.pow(def.costScale, lvl)),
    };
  }

  canAfford(upgradeId: string, gold: number, essence: number): boolean {
    const cost = this.getCost(upgradeId);
    if (!cost) return false;
    return gold >= cost.gold && essence >= cost.essence;
  }

  // C-P2-1: Choose specialization (called from UI)
  chooseSpecialization(spec: 'charm_master' | 'line_master'): void {
    if (this.meta.specialization !== 'none') return;
    this.meta.specialization = spec;
    this.specializationPending = false;

    if (spec === 'charm_master') {
      this.meta.baseLineDurability = Math.floor(this.meta.baseLineDurability * 0.8);
    } else {
      this.meta.charmSlots = Math.max(3, this.meta.charmSlots - 1);
    }
  }

  purchase(upgradeId: string): boolean {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return false;
    const lvl = this.levels.get(upgradeId) ?? 0;
    if (lvl >= def.maxLevel) return false;

    const newLvl = lvl + 1;
    this.levels.set(upgradeId, newLvl);
    def.apply(this.meta, newLvl);

    // C-P2-1: Track non-relic purchases, trigger specialization at 3
    if (upgradeId !== 'relic_slots') {
      this.totalPurchases++;
      if (this.totalPurchases >= 3 && this.meta.specialization === 'none') {
        this.specializationPending = true;
      }
    }

    return true;
  }

  getMeta(): MetaState {
    return { ...this.meta };
  }

  getAllUpgrades(): Array<{
    def: UpgradeDef;
    level: number;
    cost: ReturnType<CampManager['getCost']>;
  }> {
    return UPGRADES.map((def) => ({
      def,
      level: this.levels.get(def.id) ?? 0,
      cost: this.getCost(def.id),
    }));
  }
}
