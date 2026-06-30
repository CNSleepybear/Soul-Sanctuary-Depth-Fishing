// ===== src/renderer/roguelike/RunManager.ts =====
// Run lifecycle: Prep (pick charms) → Fishing (consume casts) → Result (rewards).
// Wraps FishingSystem, tracks casts/durability, triggers random events.

import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { FishingSystem } from '../fishing/FishingSystem';
import { FishSpawner } from '../fishing/FishSpawner';
import type { SpawnContext } from '../fishing/FishSpawner';
import { ModifierEngine } from './ModifierEngine';
import type { ModifiedStats } from './ModifierEngine';
import { ALL_CHARMS } from './charm-data';
import { ALL_EVENTS } from './event-data';
import { GameEvents } from '../../shared/events';
import { RunEndReason, Weather, ModifierRarity, CatchQuality } from '../../shared/enums';
import { RUN_EVENT_CHANCE, BAITS } from '../../shared/constants';
import { logger } from '../../shared/logger';
import type { Modifier, RunRewards, RunEvent, CaughtFish } from '../../shared/types';

export type RunPhase = 'none' | 'prep' | 'fishing' | 'result';

export class RunManager {
  private eventBus: EventBus;
  private fishingSystem: FishingSystem;
  private rng: RNG;

  // Run state
  private phase: RunPhase = 'none';

  private castsRemaining = 0;
  private lineDurability = 0;
  private maxLineDurability = 0;
  private activeCharms: Modifier[] = [];
  private activeRelics: Modifier[] = [];
  private fishCaught: CaughtFish[] = [];
  private eventsTriggered: string[] = [];
  private seed = 0;

  // Computed stats from modifiers
  private _modStats: ModifiedStats | null = null;

  // Event modifiers with duration (in casts)
  private activeEventMods: Array<{ instanceId: string; duration: number }> = [];
  private currentWeather: Weather = Weather.Clear;

  // Bait state
  private currentBaitId = 'bait_worm';
  private baitCharges = 0;

  // Camp baseline stats
  private _baseLineDurability = 100;

  // Relic state
  private _phoenixUsed = false;
  private _streakCount = 0; // P3: consecutive catches
  private _streakEssenceBonus = 0; // C-P1-2: accumulated streak essence
  private _chainCatchCount = 0; // charm_chain: total catches this run for progress bonus
  private _mirrorUsed = false; // charm_mirror: only duplicates first catch

  // Daily hotspot
  private _hotspotLocation: string | null = null;

  // Deferred run end: wait for fishing cycle to complete before ending
  private _pendingEndReason: RunEndReason | null = null;

  constructor(eventBus: EventBus, fishingSystem: FishingSystem, seed: number) {
    this.eventBus = eventBus;
    this.fishingSystem = fishingSystem;
    this.rng = new RNG(seed);
    this.seed = seed;

    this._subscribe();
  }

  // ── Public API ──

  get currentPhase(): RunPhase {
    return this.phase;
  }
  get remainingCasts(): number {
    return this.castsRemaining;
  }
  get durability(): number {
    return this.lineDurability;
  }
  get maxDurability(): number {
    return this.maxLineDurability;
  }
  get charms(): Modifier[] {
    return [...this.activeCharms];
  }
  get fishCaughtThisRun(): CaughtFish[] {
    return [...this.fishCaught];
  }
  get canEndVoluntarily(): boolean {
    return this.phase === 'fishing' && this.fishCaught.length > 0;
  }
  get availableCharms(): Modifier[] {
    return [...ALL_CHARMS];
  }
  get modStats(): ModifiedStats | null {
    return this._modStats;
  }
  get currentBait(): string {
    return this.currentBaitId;
  }
  get remainingBaitCharges(): number {
    return this.baitCharges;
  }

  /** Set the current daily hotspot location (called on load and refresh). */
  setHotspotLocation(locationId: string | null): void {
    this._hotspotLocation = locationId;
  }

  /** Start a new run with player-selected charms, bait, and equipped relics. */
  startRun(
    locationId: string,
    charms: Modifier[],
    baitConfig?: { baitId: string; charges: number },
    relics: Modifier[] = [],
    baseLineDurability = 100,
  ): void {
    this.phase = 'prep';
    this.activeCharms = charms;
    this.activeRelics = relics;
    this._baseLineDurability = baseLineDurability;
    this._phoenixUsed = false;

    this.activeEventMods = [];
    this.currentWeather = FishSpawner.getRandomWeather(locationId);
    this.currentBaitId = baitConfig?.baitId ?? 'bait_worm';
    this.baitCharges = baitConfig?.charges ?? 0;
    this._chainCatchCount = 0;
    this._mirrorUsed = false;
    this._recomputeStats();
    this.castsRemaining = this._modStats!.maxCasts;
    this.maxLineDurability = this._modStats!.lineDurability;
    this.lineDurability = this.maxLineDurability;
    this.fishCaught = [];
    this.eventsTriggered = [];
    this._pendingEndReason = null;
    this._streakCount = 0;
    this._streakEssenceBonus = 0; // C-P1-2: reset per run

    this.fishingSystem.applyModStats(this._modStats!);

    const spawnCtx: SpawnContext = {
      locationId,
      timeWindow: FishSpawner.getCurrentTimeWindow(),
      season: FishSpawner.getCurrentSeason(),
      weather: this.currentWeather,
      baitId: this.currentBaitId,
      hotspotActive: this._hotspotLocation === locationId,
    };
    this.fishingSystem.setSpawnContext(spawnCtx);

    this.phase = 'fishing';
    this.eventBus.emit(GameEvents.RUN_START, { locationId, seed: this.seed });
    this.eventBus.emit(GameEvents.GAME_PHASE_CHANGE, { phase: 'fishing' });
  }

  /** Called each frame from game loop. */
  update(dt: number, now: number): void {
    if (this.phase !== 'fishing') return;

    // Fishing system handles its own state machine
    this.fishingSystem.update(dt, now);

    // Check if line durability needs updating from FishingSystem
    // (handled by event listeners below)
  }

  /** Change weather mid-run (also used by tests). */
  setWeather(weather: Weather): void {
    this.currentWeather = weather;
    this._recomputeStats();
    this.fishingSystem.applyModStats(this._modStats!);
  }

  /** End the run voluntarily. */
  endRunVoluntarily(): void {
    if (!this.canEndVoluntarily) return;
    this.eventBus.emit(GameEvents.RUN_VOLUNTARY_END, {});
    this._endRun(RunEndReason.Voluntary);
  }

  /** Get a random event (called externally or by internal trigger). */
  drawEvent(): RunEvent | null {
    const event = this._pickEvent();
    if (event) {
      this.eventsTriggered.push(event.id);
      this.addEventModifier(event);
      this.eventBus.emit(GameEvents.RUN_EVENT, { event });
    }
    return event;
  }

  /** Apply line damage from events. */
  applyLineDamage(amount: number): void {
    this.lineDurability = Math.max(0, this.lineDurability - amount);
    if (this.lineDurability <= 0) {
      this._endRun(RunEndReason.LineBreak);
    }
  }

  /** Consume casts from events. */
  consumeCasts(amount: number): void {
    this.castsRemaining = Math.max(0, this.castsRemaining - amount);
    this.eventBus.emit(GameEvents.RUN_CAST_CONSUMED, { remaining: this.castsRemaining });
    if (this.castsRemaining <= 0) {
      this._endRun(RunEndReason.Depleted);
    }
  }

  /** Apply a new modifier mid-run (from event reward). */
  addModifier(mod: Modifier): void {
    this.activeCharms.push(mod);
    this._recomputeStats();
    this.fishingSystem.applyModStats(this._modStats!);
    this.eventBus.emit(GameEvents.RUN_MODIFIER_ADDED, { modifier: mod });
  }

  /** Apply a temporary event modifier with a duration (in casts). */
  addEventModifier(event: RunEvent): void {
    if (!event.statModifiers || Object.keys(event.statModifiers).length === 0) return;

    const instanceId = `${event.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const mod: Modifier = {
      id: instanceId,
      name: event.name,
      description: event.description,
      icon: event.effect === 'curse' ? '⚡' : '✨',
      rarity: ModifierRarity.Common,
      stackable: true,
      maxStacks: 99,
      effects: Object.entries(event.statModifiers).map(([stat, value]) => ({
        type: 'stat_add',
        stat,
        value: value ?? 0,
      })),
      tags: ['event'],
    };

    this.activeCharms.push(mod);
    this.activeEventMods.push({ instanceId, duration: event.duration ?? 1 });
    this._recomputeStats();
    this.fishingSystem.applyModStats(this._modStats!);
    this.eventBus.emit(GameEvents.RUN_MODIFIER_ADDED, { modifier: mod, source: 'event' });
  }

  private _tickEventModifiers(): void {
    if (this.activeEventMods.length === 0) return;

    const expiredIds = new Set<string>();
    this.activeEventMods = this.activeEventMods
      .map((m) => ({ ...m, duration: m.duration - 1 }))
      .filter((m) => {
        if (m.duration <= 0) {
          expiredIds.add(m.instanceId);
          return false;
        }
        return true;
      });

    if (expiredIds.size > 0) {
      this.activeCharms = this.activeCharms.filter((mod) => !expiredIds.has(mod.id));
      this._recomputeStats();
      this.fishingSystem.applyModStats(this._modStats!);
    }
  }

  private _getBaitModifier(): Modifier | null {
    const def = BAITS.find((b) => b.id === this.currentBaitId);
    if (!def || this.currentBaitId === 'bait_worm') return null;
    return {
      id: 'bait_active',
      name: def.name.en,
      description: 'Active bait bonus',
      icon: '🪱',
      rarity: ModifierRarity.Common,
      stackable: false,
      maxStacks: 1,
      effects: [
        { type: 'stat_add', stat: 'rareBonus', value: def.rareBonus },
        { type: 'stat_add', stat: 'waitDurationMin', value: -def.waitReduction },
        { type: 'stat_add', stat: 'waitDurationMax', value: -def.waitReduction },
        { type: 'stat_add', stat: 'hookWindowBase', value: def.hookWindowBonus },
      ],
      tags: ['bait'],
    };
  }

  private _getChainReactionModifier(): Modifier | null {
    if (!this._modStats?.tags.has('chain_reaction')) return null;
    const bonus = Math.min(this._chainCatchCount * 2, 30);
    if (bonus <= 0) return null;
    return {
      id: 'chain_reaction_active',
      name: 'Chain Reaction',
      description: `+${bonus}% progress speed`,
      icon: '⚡',
      rarity: ModifierRarity.Common,
      stackable: false,
      maxStacks: 1,
      effects: [{ type: 'stat_add', stat: 'fishProgressRate', value: bonus }],
      tags: [],
    };
  }

  private _getWeatherModifier(): Modifier | null {
    switch (this.currentWeather) {
      case Weather.Rain:
        return {
          id: 'weather_rain',
          name: 'Rain',
          description: 'Rainy weather',
          icon: '🌧️',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'tensionReelRate', value: 2 }],
          tags: ['weather'],
        };
      case Weather.Fog:
        return {
          id: 'weather_fog',
          name: 'Fog',
          description: 'Foggy weather',
          icon: '🌫️',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'hookChance', value: -3 }],
          tags: ['weather'],
        };
      case Weather.Snow:
        return {
          id: 'weather_snow',
          name: 'Snow',
          description: 'Snowy weather',
          icon: '❄️',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'fishProgressRate', value: -2 }],
          tags: ['weather'],
        };
      case Weather.Aurora:
        return {
          id: 'weather_aurora',
          name: 'Aurora',
          description: 'Aurora weather',
          icon: '🌌',
          rarity: ModifierRarity.Common,
          stackable: false,
          maxStacks: 1,
          effects: [{ type: 'stat_add', stat: 'spiritVariantChance', value: 0.03 }],
          tags: ['weather'],
        };
      default:
        return null;
    }
  }

  private _recomputeStats(): void {
    const mods = [...this.activeCharms, ...this.activeRelics];

    // Camp upgrade: baseline line durability
    if (this._baseLineDurability !== 100) {
      mods.push({
        id: 'camp_line_durability',
        name: 'Camp Line Durability',
        description: '',
        icon: '',
        rarity: ModifierRarity.Common,
        stackable: false,
        maxStacks: 1,
        effects: [
          { type: 'stat_add', stat: 'lineDurability', value: this._baseLineDurability - 100 },
        ],
        tags: [],
      });
    }

    const baitMod = this._getBaitModifier();
    if (baitMod) mods.push(baitMod);
    const chainMod = this._getChainReactionModifier();
    if (chainMod) mods.push(chainMod);
    const weatherMod = this._getWeatherModifier();
    if (weatherMod) mods.push(weatherMod);
    this._modStats = ModifierEngine.compute(mods, { weather: this.currentWeather });
  }

  // ── Event subscriptions ──

  private _subscribe(): void {
    // On each cast, decrement counters
    this.eventBus.on(GameEvents.FISHING_CAST, () => {
      if (this.phase !== 'fishing') return;
      this.castsRemaining--;
      this._tickEventModifiers();

      // Consume bait charge; revert to default worm when depleted
      if (this.baitCharges > 0 && this.currentBaitId !== 'bait_worm') {
        this.baitCharges--;
        if (this.baitCharges <= 0) {
          this.currentBaitId = 'bait_worm';
          this._recomputeStats();
          this.fishingSystem.applyModStats(this._modStats!);
          this.fishingSystem.setBaitId('bait_worm');
          this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
            message: '🪱 Bait depleted — back to earthworm.',
            type: 'info',
          });
        }
      }

      this.eventBus.emit(GameEvents.RUN_CAST_CONSUMED, { remaining: this.castsRemaining });

      // Random event chance
      if (this.rng.chance(RUN_EVENT_CHANCE)) {
        this.drawEvent();
      }

      // Defer run end — wait for current fishing cycle to complete
      if (this.castsRemaining <= 0) {
        this._pendingEndReason = RunEndReason.Depleted;
      }
    });

    // Line durability from fishing system
    this.eventBus.on(GameEvents.FISHING_REEL_UPDATE, (p) => {
      if (this.phase !== 'fishing') return;
      this.lineDurability = p.lineDurability ?? this.lineDurability;
    });

    // Line break — Phoenix Feather relic negates once per run
    this.eventBus.on(GameEvents.FISHING_LINE_BREAK, () => {
      if (this.phase !== 'fishing') return;
      // Phoenix Feather: negate first line break
      const tags = this._modStats?.tags;
      if (tags && !this._phoenixUsed && tags.has('phoenix_feather')) {
        this._phoenixUsed = true;
        this.lineDurability = Math.min(this.maxLineDurability, this.lineDurability + 30);
        logger.debug('[RunManager] Phoenix Feather saved the line!');
        return;
      }
      // Don't end immediately — let fishing cycle complete (escape/idle)
      this._pendingEndReason = RunEndReason.LineBreak;
    });

    // Track catches — Echo Stone: 30% chance to not consume a cast
    this.eventBus.on(GameEvents.FISHING_CATCH, (p) => {
      if (this.phase !== 'fishing') return;
      if (p.fish) {
        // C-P1-2: Streak bonus — 3+/5+ consecutive catches = bonus gold + essence
        this._streakCount++;
        let streakBonus = 0;
        let streakEssence = 0;
        if (this._streakCount >= 5) {
          streakBonus = Math.floor((p.gold ?? 0) * 0.5);
          streakEssence = 4;
        } else if (this._streakCount >= 3) {
          streakBonus = Math.floor((p.gold ?? 0) * 0.25);
          streakEssence = 2;
        }
        const finalGold = (p.gold ?? 0) + streakBonus;

        const caught: CaughtFish = {
          fishId: p.fish.id,
          size: p.size ?? 0,
          sizeCategory: 'average',
          quality: p.quality ?? 'standard',
          isSpiritVariant: p.isSpiritVariant ?? false,
          goldEarned: finalGold,
          timestamp: Date.now(),
        };
        this.fishCaught.push(caught);

        // charm_mirror: duplicate the first fish caught this run
        if (!this._mirrorUsed && this._modStats?.tags.has('mirror_pool')) {
          this._mirrorUsed = true;
          this.fishCaught.push({ ...caught });
          this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
            message: '🪞 Mirror Pool! First fish duplicated!',
            type: 'rare',
          });
        }

        // charm_chain: +2% progress speed per catch (max 30%)
        this._chainCatchCount++;
        this._recomputeStats();
        this.fishingSystem.applyModStats(this._modStats!);

        if (streakBonus > 0) {
          this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
            message: `🔥 ${this._streakCount}x Streak! +${streakBonus}G +${streakEssence}✨`,
            type: 'success',
          });
        }
        // C-P1-2: Emit essence reward for streak (handled by GameStateManager)
        if (streakEssence > 0) {
          // Defer to RunManager's rewards — add as bonus to run rewards later
          this._streakEssenceBonus += streakEssence;
        }
        // Echo Stone: 30% chance to refund the cast consumed for this catch
        const tags = this._modStats?.tags;
        if (tags && tags.has('echo_stone')) {
          if (this.rng.chance(0.3) && this.castsRemaining < this._modStats!.maxCasts) {
            this.castsRemaining++;
            this._pendingEndReason = null; // cancel pending depletion if we got a cast back
            this.eventBus.emit(GameEvents.RUN_CAST_CONSUMED, { remaining: this.castsRemaining });
            logger.debug('[RunManager] Echo Stone refunded a cast!');
          }
        }
      }
    });

    // When fishing returns to idle, check if run should end
    this.eventBus.on(GameEvents.FISHING_IDLE, () => {
      if (this.phase !== 'fishing') return;
      if (this._pendingEndReason) {
        this._endRun(this._pendingEndReason);
      }
    });

    // P3: Break streak on escape or line break
    this.eventBus.on(GameEvents.FISHING_ESCAPE, () => {
      if (this.phase === 'fishing') this._streakCount = 0;
    });
    this.eventBus.on(GameEvents.FISHING_LINE_BREAK, () => {
      if (this.phase === 'fishing') this._streakCount = 0;
    });

    // DAILY-5: Track hotspot rotation
    this.eventBus.on(GameEvents.DAILY_REFRESH, (p) => {
      this._hotspotLocation = p.hotspot ?? null;
    });
  }

  // ── Run end ──

  private _endRun(reason: RunEndReason): void {
    this.phase = 'result';

    const rewards: RunRewards = this._computeRewards(reason);

    this.eventBus.emit(GameEvents.RUN_END, { reason, rewards });
    this.eventBus.emit(GameEvents.GAME_PHASE_CHANGE, { phase: 'run_result' });

    // Player manually transitions via Result panel buttons — no auto-dismiss
    logger.info(`[RunManager] Run ended: ${reason}`, rewards);
  }

  private _computeRewards(reason: RunEndReason): RunRewards {
    const totalGold = this.fishCaught.reduce((sum, f) => sum + f.goldEarned, 0);
    const totalXp = this.fishCaught.length * 10;
    const perfectCatches = this.fishCaught.filter((f) => f.quality === CatchQuality.Perfect).length;
    const newDiscoveries: string[] = [];

    // Voluntary end bonus
    const bonusGold = reason === RunEndReason.Voluntary ? Math.floor(totalGold * 0.2) : 0;

    return {
      gold: totalGold + bonusGold,
      xp: totalXp,
      spiritEssence: Math.floor(this.fishCaught.length * 1.5) + this._streakEssenceBonus,
      sanctuaryTokens: reason === RunEndReason.Voluntary ? 2 : 1,
      fishCaught: this.fishCaught.length,
      perfectCatches,
      newDiscoveries,
      relicDiscovered: null,
    };
  }

  private _pickEvent(): RunEvent | null {
    if (ALL_EVENTS.length === 0) return null;
    return ALL_EVENTS[this.rng.nextInt(0, ALL_EVENTS.length - 1)];
  }

  dispose(): void {
    // Cleanup handled by EventBus
  }
}
