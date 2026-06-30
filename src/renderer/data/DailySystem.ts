// ===== src/renderer/data/DailySystem.ts =====
// Daily quests, login streaks, hotspot rotation, free bait claim.
// Refreshes automatically at midnight (local time).

import { RNG } from '../core/RNG';
import { LOCATIONS } from './location-data';
import { GameEvents } from '../../shared/events';
import type { EventBus } from '../core/EventBus';
import type { DailyState, SpiritFish } from '../../shared/types';
import { CatchQuality, FishRarity } from '../../shared/enums';

interface DailyQuest {
  id: string;
  desc: string;
  type: 'catch_rarity' | 'catch_count' | 'catch_location' | 'perfect_catch';
  target: string | number;
  progress: number;
  completed: boolean;
  rewardGold: number;
  rewardEssence: number;
}

const QUEST_TEMPLATES: Omit<DailyQuest, 'progress' | 'completed' | 'id'>[] = [
  { desc: 'Catch 3 Common fish', type: 'catch_count', target: 3, rewardGold: 50, rewardEssence: 3 },
  {
    desc: 'Catch 2 Uncommon fish',
    type: 'catch_rarity',
    target: 'Uncommon',
    rewardGold: 80,
    rewardEssence: 5,
  },
  {
    desc: 'Catch 1 Rare fish',
    type: 'catch_rarity',
    target: 'Rare',
    rewardGold: 150,
    rewardEssence: 10,
  },
  {
    desc: 'Catch 5 fish of any kind',
    type: 'catch_count',
    target: 5,
    rewardGold: 60,
    rewardEssence: 4,
  },
  {
    desc: 'Land 2 perfect catches',
    type: 'perfect_catch',
    target: 2,
    rewardGold: 100,
    rewardEssence: 8,
  },
  {
    desc: 'Catch 1 Legendary fish',
    type: 'catch_rarity',
    target: 'Legendary',
    rewardGold: 300,
    rewardEssence: 20,
  },
  {
    desc: 'Fish at the Hotspot',
    type: 'catch_location',
    target: 'hotspot',
    rewardGold: 120,
    rewardEssence: 6,
  },
  {
    desc: 'Catch 4 fish of any kind',
    type: 'catch_count',
    target: 4,
    rewardGold: 55,
    rewardEssence: 4,
  },
  {
    desc: 'Catch 3 Uncommon+ fish',
    type: 'catch_rarity',
    target: 'Uncommon',
    rewardGold: 100,
    rewardEssence: 7,
  },
  {
    desc: 'Catch 1 Mythic fish',
    type: 'catch_rarity',
    target: 'Mythic',
    rewardGold: 500,
    rewardEssence: 30,
  },
];

const STREAK_REWARDS: { minDays: number; gold: number; essence: number }[] = [
  { minDays: 2, gold: 30, essence: 2 },
  { minDays: 3, gold: 50, essence: 5 },
  { minDays: 5, gold: 100, essence: 10 },
  { minDays: 7, gold: 200, essence: 20 },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export class DailySystem {
  // DAILY-2: Feature flag gate — all features are no-ops when disabled
  private enabled = false;

  private eventBus: EventBus;
  private rng: RNG;
  private state: DailyState;
  private quests: DailyQuest[] = [];
  private onPersist: ((state: DailyState) => void) | null = null;

  private unsubs: (() => void)[] = [];

  constructor(
    eventBus: EventBus,
    existing?: DailyState,
    onPersist?: (state: DailyState) => void,
    enabled = false,
  ) {
    this.enabled = enabled;
    this.onPersist = onPersist ?? null;
    this.eventBus = eventBus;
    this.rng = new RNG(Date.now());

    this.state = existing ?? {
      lastRefreshDate: '',
      completedQuests: [],
      streakDays: 0,
      freeBaitClaimed: false,
      hotspotLocation: null,
    };

    this._checkRefresh();
    this._subscribe();
    this._persist();
  }

  private _persist(): void {
    if (this.onPersist) {
      this.onPersist(this.getState());
    }
  }

  // ── Public API ──

  get hotspotLocation(): string | null {
    return this.state.hotspotLocation;
  }
  get streakDays(): number {
    return this.state.streakDays;
  }
  get freeBaitAvailable(): boolean {
    return !this.state.freeBaitClaimed;
  }
  get activeQuests(): readonly DailyQuest[] {
    return this.quests;
  }

  getState(): DailyState {
    return { ...this.state, completedQuests: [...this.state.completedQuests] };
  }

  /** Claim the daily free bait. Returns true if successful. */
  claimFreeBait(): boolean {
    if (!this.enabled || this.state.freeBaitClaimed) return false;
    this.state.freeBaitClaimed = true;
    this.eventBus.emit(GameEvents.DAILY_FREE_BAIT_CLAIMED, { baitId: 'bait_worm', amount: 3 });
    this._persist();
    return true;
  }

  /** Mark a quest as completed and emit reward. */
  completeQuest(questId: string): void {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest || quest.completed) return;
    if (quest.progress < (quest.target as number)) return;

    quest.completed = true;
    this.state.completedQuests.push(questId);

    this.eventBus.emit(GameEvents.DAILY_QUEST_COMPLETED, {
      questId,
      gold: quest.rewardGold,
      essence: quest.rewardEssence,
    });
    this._persist();
  }

  // ── Internal ──

  private _subscribe(): void {
    if (!this.enabled) return; // DAILY-2: skip all daily event subscriptions
    this.unsubs.push(
      this.eventBus.on(GameEvents.FISHING_CATCH, (data) => {
        this._onFishCaught(data.fish, data.quality);
      }),
    );
  }

  private _onFishCaught(fish: SpiritFish, quality: CatchQuality): void {
    for (const quest of this.quests) {
      if (quest.completed) continue;

      switch (quest.type) {
        case 'catch_count':
          quest.progress++;
          break;
        case 'catch_rarity': {
          const targetRarity = quest.target as string;
          const rarityOrder = [
            FishRarity.Common,
            FishRarity.Uncommon,
            FishRarity.Rare,
            FishRarity.Legendary,
            FishRarity.Mythic,
          ];
          const fishIdx = rarityOrder.indexOf(fish.rarity);
          const targetIdx = rarityOrder.findIndex((r) => r === targetRarity.toLowerCase());
          if (fishIdx >= targetIdx) quest.progress++;
          break;
        }
        case 'catch_location':
          if (this.state.hotspotLocation) quest.progress++;
          break;
        case 'perfect_catch':
          if (quality === CatchQuality.Perfect) quest.progress++;
          break;
      }

      if (quest.progress >= (quest.target as number)) {
        this.completeQuest(quest.id);
      }
    }
  }

  private _checkRefresh(): void {
    if (!this.enabled) return; // DAILY-2: skip daily refresh logic
    const key = todayKey();

    if (this.state.lastRefreshDate !== key) {
      // Check streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);

      if (this.state.lastRefreshDate === yesterdayKey) {
        this.state.streakDays++;
      } else if (this.state.lastRefreshDate !== '') {
        this.state.streakDays = 1;
      } else {
        this.state.streakDays = 1;
      }

      // Streak reward
      for (const reward of [...STREAK_REWARDS].reverse()) {
        if (this.state.streakDays >= reward.minDays) {
          this.eventBus.emit(GameEvents.DAILY_STREAK_REWARD, {
            days: this.state.streakDays,
            gold: reward.gold,
            essence: reward.essence,
          });
          break;
        }
      }

      // Roll new hotspot
      const locIds = LOCATIONS.map((l) => l.id);
      this.state.hotspotLocation = locIds[Math.floor(this.rng.next() * locIds.length)];

      // Roll new quests
      this._rollQuests();

      // Reset daily flags
      this.state.freeBaitClaimed = false;
      this.state.completedQuests = [];
      this.state.lastRefreshDate = key;

      this._persist();

      this.eventBus.emit(GameEvents.DAILY_REFRESH, {
        hotspot: this.state.hotspotLocation,
        streak: this.state.streakDays,
      });
    } else {
      // Same day — restore quest state
      this._rollQuests();
      // Restore completed
      for (const qid of this.state.completedQuests) {
        const q = this.quests.find((qu) => qu.id === qid);
        if (q) {
          q.completed = true;
          q.progress = q.target as number;
        }
      }
    }
  }

  private _rollQuests(): void {
    const shuffled = [...QUEST_TEMPLATES];
    // Fisher-Yates shuffle with seeded RNG
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    this.quests = shuffled.slice(0, 3).map((tpl, i) => ({
      ...tpl,
      id: `daily_${todayKey()}_${i}`,
      progress: 0,
      completed: false,
    }));
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
  }
}
