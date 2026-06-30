// ===== src/renderer/core/GameStateManager.ts =====
// Centralized persistent state: gold, essence, camp upgrades, relics, fishpedia.
// Saves to localStorage on every state change. Loads on construction.

import { EventBus } from './EventBus';
import { CampManager } from '../roguelike/CampManager';
import { ALL_RELICS } from '../roguelike/relic-data';
import { checkAchievements } from '../roguelike/achievement-data';
import { LOCATIONS } from '../data/location-data';
import { SOUL_STORIES } from '../data/soul-stories';
import { GameEvents } from '../../shared/events';
import { logger } from '../../shared/logger';
import { BAITS } from '../../shared/constants';
import { CatchQuality, FishRarity } from '../../shared/enums';
import type {
  MetaState,
  FishpediaEntry,
  CaughtFish,
  RunRewards,
  SoulEntry,
} from '../../shared/types';

const SAVE_PREFIX = 'soulsanctuary_save_';
const AUTO_SAVE_INTERVAL = 60000; // 60 seconds

interface PersistedState {
  version: number;
  timestamp: number;
  gold: number;
  essence: number;
  meta: MetaState;
  ownedRelics: string[];
  equippedRelics: string[];
  fishpedia: Record<string, FishpediaEntry>;
  soulCollection: Record<string, SoulEntry>;
  totalCatches: number;
  totalPerfectCatches: number;
  unlockedAchievements: string[];
  unlockedLocations: string[];
  dailyLastRefresh: string;
  dailyCompletedQuests: string[];
  dailyStreakDays: number;
  dailyFreeBaitClaimed: boolean;
  dailyHotspotLocation: string | null;
  baits: Record<string, number>;
}

export class GameStateManager {
  private eventBus: EventBus;
  campManager!: CampManager;

  gold = 500;
  essence = 20;
  ownedRelics = new Set<string>();
  equippedRelics = new Set<string>();
  fishpedia: Record<string, FishpediaEntry> = {};
  soulCollection: Record<string, SoulEntry> = {};
  baits: Record<string, number> = {};
  totalCatches = 0;
  totalPerfectCatches = 0;
  unlockedLocations = new Set<string>(['japan']);
  unlockedAchievements = new Set<string>();
  hasRareCatch = false;
  hasLegendCatch = false;
  hasMythicCatch = false;

  // C-P1-1: Track total runs for new-player discount
  totalRuns = 0;
  firstPurchaseDiscountUsed = false;

  // Loaded daily state (consumed by DailySystem constructor)
  _loadedDailyState: import('../../shared/types').DailyState | undefined;

  private unsubs: (() => void)[] = [];
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;

  private _currentSlot = 0;

  constructor(eventBus: EventBus, slot = 0) {
    this.eventBus = eventBus;
    this._currentSlot = slot;

    // Load or init
    this._applyPersistedState(this._load(slot));

    this._subscribe();
    this._save(slot);

    // Auto-save every 60s
    this.autoSaveInterval = setInterval(() => this._save(this._currentSlot), AUTO_SAVE_INTERVAL);
  }

  /** Apply a persisted state (from localStorage or Electron file) to this manager. */
  private _applyPersistedState(saved: PersistedState | null): void {
    if (saved) {
      this.gold = saved.gold;
      this.essence = saved.essence;
      this.ownedRelics = new Set(saved.ownedRelics);
      this.equippedRelics = new Set(saved.equippedRelics);
      this.fishpedia = saved.fishpedia;
      this.soulCollection = saved.soulCollection ?? {};
      // Backfill storyProgress for saves created before narrative update
      for (const entry of Object.values(this.soulCollection)) {
        if (typeof entry.storyProgress !== 'number' || entry.storyProgress < 1) {
          entry.storyProgress = 1;
        }
      }
      this.totalCatches = saved.totalCatches;
      this.totalPerfectCatches = saved.totalPerfectCatches;
      this.unlockedLocations = new Set(saved.unlockedLocations ?? ['japan']);
      this.unlockedAchievements = new Set(saved.unlockedAchievements ?? []);
      this.baits = saved.baits ?? {};
    } else {
      // Reset defaults for a fresh save
      this.gold = 500;
      this.essence = 20;
      this.ownedRelics = new Set<string>();
      this.equippedRelics = new Set<string>();
      this.ownedRelics.add('relic_compass');
      this.fishpedia = {};
      this.soulCollection = {};
      this.baits = { bait_worm: 20 };
      this.totalCatches = 0;
      this.totalPerfectCatches = 0;
      this.unlockedLocations = new Set<string>(['japan']);
      this.unlockedAchievements = new Set<string>();
    }

    // P0-2: synergySlotUnlocked added to MetaState
    // C-P2-1: specialization added to MetaState
    this.campManager = new CampManager(
      saved?.meta ?? {
        charmSlots: 3,
        relicSlots: 0,
        charmRerolls: 1,
        baitPouchSize: 3,
        baseLineDurability: 100,
        synergySlotUnlocked: false,
        specialization: 'none',
      },
    );

    // Expose daily state for DailySystem initialization
    this._loadedDailyState = saved
      ? {
          lastRefreshDate: saved.dailyLastRefresh ?? '',
          completedQuests: saved.dailyCompletedQuests ?? [],
          streakDays: saved.dailyStreakDays ?? 0,
          freeBaitClaimed: saved.dailyFreeBaitClaimed ?? false,
          hotspotLocation: saved.dailyHotspotLocation ?? null,
        }
      : undefined;
  }

  /** Try to load a save from Electron's file persistence. Falls back to localStorage if unavailable. */
  async loadFromElectron(slot = this._currentSlot): Promise<boolean> {
    if (!window.electronAPI) return false;
    try {
      const raw = await window.electronAPI.loadData(slot);
      if (!raw) return false;
      const data = JSON.parse(raw) as PersistedState;
      this._applyPersistedState(data);
      this._currentSlot = slot;
      this._save(slot);
      return true;
    } catch (err: unknown) {
      logger.warn('[GameStateManager] Failed to load from Electron file:', err);
      return false;
    }
  }

  // ── Save/Load ──

  get currentSlot(): number {
    return this._currentSlot;
  }

  static getSlotInfo(
    slot: number,
  ): { exists: boolean; timestamp: number; gold: number; fishpedia: number } | null {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot);
      if (raw) {
        const data = JSON.parse(raw) as PersistedState;
        return {
          exists: true,
          timestamp: data.timestamp,
          gold: data.gold,
          fishpedia: Object.keys(data.fishpedia).length,
        };
      }
    } catch {
      /* */
    }
    return null;
  }

  private _load(slot: number): PersistedState | null {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot);
      if (raw) return JSON.parse(raw) as PersistedState;
    } catch {
      /* corrupted, start fresh */
    }
    return null;
  }

  // Daily state (updated by DailySystem)
  private _dailyState: import('../../shared/types').DailyState = {
    lastRefreshDate: '',
    completedQuests: [],
    streakDays: 0,
    freeBaitClaimed: false,
    hotspotLocation: null,
  };

  /** Called by DailySystem to push state updates for persistence. */
  updateDailyState(state: import('../../shared/types').DailyState): void {
    this._dailyState = state;
    this._save(this._currentSlot);
  }

  private _save(slot: number): void {
    const data: PersistedState = {
      version: 1,
      timestamp: Date.now(),
      gold: this.gold,
      essence: this.essence,
      meta: this.campManager.getMeta(),
      ownedRelics: [...this.ownedRelics],
      equippedRelics: [...this.equippedRelics],
      fishpedia: this.fishpedia,
      soulCollection: this.soulCollection,
      totalCatches: this.totalCatches,
      totalPerfectCatches: this.totalPerfectCatches,
      unlockedAchievements: [...this.unlockedAchievements],
      unlockedLocations: [...this.unlockedLocations],
      dailyLastRefresh: this._dailyState.lastRefreshDate,
      dailyCompletedQuests: this._dailyState.completedQuests,
      dailyStreakDays: this._dailyState.streakDays,
      dailyFreeBaitClaimed: this._dailyState.freeBaitClaimed,
      dailyHotspotLocation: this._dailyState.hotspotLocation,
      baits: this.baits,
    };
    try {
      localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
    } catch {
      /* quota full */
    }
  }

  // ── Public mutations ──

  addGold(amount: number, source: string): void {
    this.gold += amount;
    this.eventBus.emit(GameEvents.GAME_GOLD_CHANGE, { amount: this.gold, delta: amount, source });
    this._save(this._currentSlot);
  }

  addEssence(amount: number): void {
    this.essence += amount;
    this._save(this._currentSlot);
  }

  canAfford(gold: number, essence: number): boolean {
    return this.gold >= gold && this.essence >= essence;
  }

  spend(gold: number, essence: number): boolean {
    // C-P1-1: First purchase in runs 0-2 gets 50% essence discount
    let actualEssence = essence;
    if (!this.firstPurchaseDiscountUsed && this.totalRuns <= 2 && essence > 0) {
      this.firstPurchaseDiscountUsed = true;
      actualEssence = Math.max(1, Math.floor(essence * 0.5));
    }
    if (!this.canAfford(gold, actualEssence)) return false;
    this.gold -= gold;
    this.essence -= actualEssence;
    this._save(this._currentSlot);
    return true;
  }

  discoverRelic(relicId: string): void {
    if (!this.ownedRelics.has(relicId)) {
      this.ownedRelics.add(relicId);
      const relic = ALL_RELICS.find((r) => r.id === relicId);
      if (relic) {
        this.eventBus.emit(GameEvents.RELIC_DISCOVERED, { relic });
      }
    }
    this._save(this._currentSlot);
  }

  equipRelic(relicId: string): void {
    if (this.ownedRelics.has(relicId)) {
      this.equippedRelics.add(relicId);
      this.eventBus.emit(GameEvents.RELIC_EQUIPPED, { relicId });
      this._save(this._currentSlot);
    }
  }

  unequipRelic(relicId: string): void {
    this.equippedRelics.delete(relicId);
    this.eventBus.emit(GameEvents.RELIC_UNEQUIPPED, { relicId });
    this._save(this._currentSlot);
  }

  // ═══════════════════════════════════════════════
  // Bait inventory
  // ═══════════════════════════════════════════════

  getBaitCount(baitId: string): number {
    return this.baits[baitId] ?? 0;
  }

  addBait(baitId: string, amount: number): void {
    if (amount <= 0) return;
    this.baits[baitId] = (this.baits[baitId] ?? 0) + amount;
    this._save(this._currentSlot);
  }

  consumeBait(baitId: string, amount = 1): boolean {
    if ((this.baits[baitId] ?? 0) < amount) return false;
    this.baits[baitId] -= amount;
    if (this.baits[baitId] <= 0) delete this.baits[baitId];
    this._save(this._currentSlot);
    return true;
  }

  canAffordBait(baitId: string): boolean {
    const def = BAITS.find((b) => b.id === baitId);
    return !!def && this.gold >= def.cost;
  }

  purchaseBait(baitId: string, amount = 1): boolean {
    const def = BAITS.find((b) => b.id === baitId);
    if (!def || amount <= 0) return false;
    const totalCost = def.cost * amount;
    if (this.gold < totalCost) return false;
    this.gold -= totalCost;
    this.addBait(baitId, amount);
    this.eventBus.emit(GameEvents.GAME_GOLD_CHANGE, {
      amount: this.gold,
      delta: -totalCost,
      source: 'bait_purchase',
    });
    return true;
  }

  /** Record a caught fish in the fishpedia. */
  recordCatch(caught: CaughtFish): void {
    const entry = this.fishpedia[caught.fishId];
    if (!entry) {
      this.fishpedia[caught.fishId] = {
        fishId: caught.fishId,
        discovered: true,
        timesCaught: 1,
        largestSize: caught.size,
        smallestSize: caught.size,
        hasTrophy: caught.sizeCategory === 'trophy',
        hasSpiritVariant: caught.isSpiritVariant,
        firstCaughtTimestamp: caught.timestamp,
      };
    } else {
      entry.timesCaught++;
      if (caught.size > entry.largestSize) entry.largestSize = caught.size;
      if (caught.size < entry.smallestSize) entry.smallestSize = caught.size;
      if (caught.sizeCategory === 'trophy') entry.hasTrophy = true;
      if (caught.isSpiritVariant) entry.hasSpiritVariant = true;
    }
    this.totalCatches++;
    // EXT-7: Sync fishpedia count via EventBus (decoupled from FishingUI)
    const fishpediaCount = Object.keys(this.fishpedia).length;
    this.eventBus.emit(GameEvents.GAME_FISHPEDIA_COUNT_UPDATE, { count: fishpediaCount });
    if (caught.quality === CatchQuality.Perfect) this.totalPerfectCatches++;
    // Track rarity catches
    if (caught.goldEarned >= 60 && caught.goldEarned < 150) this.hasRareCatch = true;
    if (caught.goldEarned >= 150 && caught.goldEarned < 300) this.hasLegendCatch = true;
    if (caught.goldEarned >= 300) this.hasMythicCatch = true;

    this.eventBus.emit(GameEvents.GAME_FISHPEDIA_UPDATE, {
      entry: {
        fishId: caught.fishId,
        discovered: true,
        isNewDiscovery: !entry,
        timesCaught: this.fishpedia[caught.fishId].timesCaught,
      },
    });
    this._save(this._currentSlot);
  }

  /** Apply run rewards to persistent state. May discover a relic. */
  applyRunRewards(rewards: RunRewards): void {
    this.addGold(rewards.gold, 'run_reward');
    this.addEssence(rewards.spiritEssence);
    this.totalRuns++; // C-P1-1: increment run counter
    if (rewards.relicDiscovered) {
      this.discoverRelic(rewards.relicDiscovered.id);
    }
  }

  // ── Location unlock ──

  /** Check and unlock locations based on fishpedia progress. */
  checkLocationUnlocks(): string[] {
    const newlyUnlocked: string[] = [];
    const allLocationIds = [
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

    for (const locId of allLocationIds) {
      if (this.unlockedLocations.has(locId)) continue;
      // Unlock next location when 5+ fish discovered in previous location
      const prevIdx = allLocationIds.indexOf(locId) - 1;
      if (prevIdx < 0) continue;
      const prevLoc = allLocationIds[prevIdx];
      const fishInPrev = Object.values(this.fishpedia).filter((e) => {
        // fishId format: jpn_koi, chn_carp, etc �?match by prefix
        const prefix =
          prevLoc === 'japan'
            ? 'jpn_'
            : prevLoc === 'china'
              ? 'chn_'
              : prevLoc === 'usa'
                ? 'usa_'
                : prevLoc === 'uk'
                  ? 'uk_'
                  : prevLoc === 'france'
                    ? 'fra_'
                    : prevLoc === 'germany'
                      ? 'deu_'
                      : prevLoc === 'italy'
                        ? 'ita_'
                        : prevLoc === 'denmark'
                          ? 'dnk_'
                          : prevLoc === 'iceland'
                            ? 'isl_'
                            : prevLoc === 'thailand'
                              ? 'tha_'
                              : prevLoc === 'egypt'
                                ? 'egy_'
                                : 'grc_';
        return e.fishId.startsWith(prefix) && e.discovered;
      });
      if (fishInPrev.length >= 5) {
        this.unlockedLocations.add(locId);
        newlyUnlocked.push(locId);
      }
    }
    if (newlyUnlocked.length > 0) {
      this._save(this._currentSlot);
      for (const locId of newlyUnlocked) {
        const loc = LOCATIONS.find((l) => l.id === locId);
        if (loc) {
          this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
            message: `🔓 ${loc.country} unlocked! ${loc.name.zh}`,
            type: 'success',
          });
        }
      }
    }
    return newlyUnlocked;
  }

  // ── Subscribe to events ──

  private _subscribe(): void {
    this.unsubs.push(
      this.eventBus.on(GameEvents.FISHING_CATCH, (p) => {
        if (p.fish) {
          const sizeRange = (p.fish.size?.max ?? 100) - (p.fish.size?.min ?? 0);
          const sizeRatio =
            sizeRange > 0 ? ((p.size ?? 0) - (p.fish.size?.min ?? 0)) / sizeRange : 0.5;
          let sizeCat: 'tiny' | 'small' | 'average' | 'large' | 'trophy' = 'average';
          if (sizeRatio >= 0.95) sizeCat = 'trophy';
          else if (sizeRatio >= 0.75) sizeCat = 'large';
          else if (sizeRatio >= 0.5) sizeCat = 'average';
          else if (sizeRatio >= 0.25) sizeCat = 'small';
          else sizeCat = 'tiny';

          const prevCount = Object.keys(this.fishpedia).length;
          this.recordCatch({
            fishId: p.fish.id,
            size: p.size ?? 0,
            sizeCategory: sizeCat,
            quality: p.quality ?? 'standard',
            isSpiritVariant: p.isSpiritVariant ?? false,
            goldEarned: p.gold ?? 0,
            timestamp: Date.now(),
          });
          const isNewDiscovery = Object.keys(this.fishpedia).length > prevCount;

          // Soul Collection: mythic fish become persistent sanctuary souls
          if (p.fish?.rarity === FishRarity.Mythic) {
            const hadSoul = !!this.soulCollection[p.fish.id];
            const story = SOUL_STORIES.find((s) => s.fishId === p.fish.id);
            const maxFragments = story?.fragments.length ?? 1;
            const prevProgress = this.soulCollection[p.fish.id]?.storyProgress ?? 0;
            const nextProgress = hadSoul ? Math.min(prevProgress + 1, maxFragments) : 1;
            this.soulCollection[p.fish.id] = {
              fishId: p.fish.id,
              locationId: p.fish.location,
              caughtAt: this.soulCollection[p.fish.id]?.caughtAt ?? Date.now(),
              memoryUnlocked: true,
              storyProgress: nextProgress,
            };
            this.eventBus.emit(GameEvents.GAME_MYTHIC_CAUGHT, {
              fishId: p.fish.id,
              locationId: p.fish.location,
              isNewDiscovery: !hadSoul,
            });
            if (nextProgress > prevProgress) {
              this.eventBus.emit(GameEvents.GAME_STORY_FRAGMENT_UNLOCKED, {
                fishId: p.fish.id,
                fragmentIndex: nextProgress - 1,
                isNew: nextProgress > prevProgress,
              });
            }
            this._save(this._currentSlot);
          }

          this.eventBus.emit(GameEvents.UI_SHOW_CATCH_FEEDBACK, {
            fish: p.fish,
            size: p.size ?? 0,
            quality: p.quality ?? 'standard',
            gold: p.gold ?? 0,
            isSpiritVariant: p.isSpiritVariant ?? false,
            isNewDiscovery,
            fishpediaCount: Object.keys(this.fishpedia).length,
            totalCatches: this.totalCatches,
          });
          this.checkLocationUnlocks();
          this.checkAllAchievements();
        }
      }),
      this.eventBus.on(GameEvents.RUN_END, (p) => {
        if (p.rewards) this.applyRunRewards(p.rewards);
        this.checkLocationUnlocks();
        this.checkAllAchievements();
      }),
      this.eventBus.on(GameEvents.GAME_ESSENCE_CHANGE, (p) => {
        this.addEssence(p.amount);
      }),
      // DAILY-4: Daily quest/streak rewards — only active when DAILY_ENABLED
      this.eventBus.on(GameEvents.DAILY_QUEST_COMPLETED, (p) => {
        this.addGold(p.gold ?? 0, 'daily_quest');
        this.addEssence(p.essence ?? 0);
      }),
      this.eventBus.on(GameEvents.DAILY_STREAK_REWARD, (p) => {
        this.addGold(p.gold ?? 0, 'daily_streak');
        this.addEssence(p.essence ?? 0);
      }),
      this.eventBus.on(GameEvents.DAILY_FREE_BAIT_CLAIMED, (p) => {
        const baitId = p.baitId ?? 'bait_worm';
        const amount = p.amount ?? 3;
        this.addBait(baitId, amount);
      }),
    );
  }

  /** Export state as JSON string. */
  exportJSON(): string {
    const data = {
      version: 1,
      timestamp: Date.now(),
      gold: this.gold,
      essence: this.essence,
      meta: this.campManager.getMeta(),
      ownedRelics: [...this.ownedRelics],
      equippedRelics: [...this.equippedRelics],
      fishpedia: this.fishpedia,
      soulCollection: this.soulCollection,
      baits: this.baits,
      totalCatches: this.totalCatches,
      totalPerfectCatches: this.totalPerfectCatches,
      totalRuns: this.totalRuns,
      firstPurchaseDiscountUsed: this.firstPurchaseDiscountUsed,
      unlockedAchievements: [...this.unlockedAchievements],
      unlockedLocations: [...this.unlockedLocations],
      dailyLastRefresh: this._dailyState.lastRefreshDate,
      dailyCompletedQuests: this._dailyState.completedQuests,
      dailyStreakDays: this._dailyState.streakDays,
      dailyFreeBaitClaimed: this._dailyState.freeBaitClaimed,
      dailyHotspotLocation: this._dailyState.hotspotLocation,
    };
    return JSON.stringify(data, null, 2);
  }

  /** Import state from JSON string. Returns true on success. */
  importJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data.gold && data.gold !== 0) return false;
      this.gold = data.gold;
      this.essence = data.essence ?? 0;
      this.ownedRelics = new Set(data.ownedRelics ?? []);
      this.equippedRelics = new Set(data.equippedRelics ?? []);
      this.fishpedia = data.fishpedia ?? {};
      this.soulCollection = data.soulCollection ?? {};
      this.baits = data.baits ?? {};
      this.totalCatches = data.totalCatches ?? 0;
      this.totalPerfectCatches = data.totalPerfectCatches ?? 0;
      this.totalRuns = data.totalRuns ?? 0;
      this.firstPurchaseDiscountUsed = data.firstPurchaseDiscountUsed ?? false;
      this.unlockedAchievements = new Set(data.unlockedAchievements ?? []);
      this.unlockedLocations = new Set(data.unlockedLocations ?? ['japan']);
      this._dailyState = {
        lastRefreshDate: data.dailyLastRefresh ?? '',
        completedQuests: data.dailyCompletedQuests ?? [],
        streakDays: data.dailyStreakDays ?? 0,
        freeBaitClaimed: data.dailyFreeBaitClaimed ?? false,
        hotspotLocation: data.dailyHotspotLocation ?? null,
      };
      this._loadedDailyState = { ...this._dailyState };
      this._save(this._currentSlot);
      return true;
    } catch {
      return false;
    }
  }

  /** Check and unlock achievements. Called after catch/run end. */
  checkAllAchievements(): string[] {
    // Manual add for rarity achievements (not auto-checked by count)
    if (this.hasRareCatch) this.unlockedAchievements.add('catch_rare');
    if (this.hasLegendCatch) this.unlockedAchievements.add('catch_legend');
    if (this.hasMythicCatch) this.unlockedAchievements.add('catch_mythic');

    const fishpediaCount = Object.keys(this.fishpedia).length;
    return checkAchievements(
      fishpediaCount,
      this.totalCatches,
      this.totalPerfectCatches,
      this.ownedRelics.size,
      this.unlockedLocations.size,
      this._dailyState?.streakDays ?? 0,
      this.gold,
      this.unlockedAchievements,
    );
  }

  // ── Relic chance on run end ──

  /** Roll for relic discovery based on fish caught. Called externally. */
  rollRelicDiscovery(fishCaught: CaughtFish[]): string | null {
    // Base 5% + 2% per rare/legendary/mythic fish
    let chance = 0.05;
    for (const f of fishCaught) {
      if (f.goldEarned >= 50) chance += 0.03;
      if (f.goldEarned >= 150) chance += 0.05;
    }
    if (Math.random() < chance) {
      const undiscovered = ALL_RELICS.filter((r) => !this.ownedRelics.has(r.id));
      if (undiscovered.length > 0) {
        return undiscovered[Math.floor(Math.random() * undiscovered.length)].id;
      }
    }
    return null;
  }

  dispose(): void {
    for (const fn of this.unsubs) fn();
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
}
