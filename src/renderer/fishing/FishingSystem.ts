// ===== src/renderer/fishing/FishingSystem.ts =====
// Core fishing state machine: idle→cast→wait→hook→reel→catch/escape.
// Integrates with EventBus, InputManager, FishSpawner.
// Manages tension bar, fish behavior AI, catch quality.

import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { FishSpawner } from './FishSpawner';
import type { SpawnContext } from './FishSpawner';
import type { ModifiedStats } from '../roguelike/ModifierEngine';
import { FishingState, CatchQuality, FishBehavior, FishRarity } from '../../shared/enums';
import { BALANCE, type BalanceKey } from '../../shared/constants';
import { logger } from '../../shared/logger';
import { GameEvents } from '../../shared/events';
import type { SpiritFish, CaughtFish } from '../../shared/types';
import { audio } from '../audio'; // AUDIO-4: centralized audio engine

// ── Fishing context (mutable state during the cycle) ──
interface FishingContext {
  castPower: number;
  castStartTime: number;
  currentFish: SpiritFish | null;
  tension: number;
  fishProgress: number;
  lineDurability: number;
  hookWindowEnd: number;
  waitUntil: number;
  nextBiteRoll: number; // timestamp for next bite roll
  waitExpired: boolean; // whether initial wait period has passed
  nibbleTimer: number; // seconds remaining in nibble phase
  slackTimer: number; // seconds spent in red zone for slack-line burst
  isHolding: boolean;
  isReeling: boolean;
  fishBehaviorTimer: number;
  currentBehavior: FishBehavior;
  behaviorPhaseDuration: number;
  burstActive: boolean;
  burstTimer: number;
  perfectWindowHits: number;
  totalReelPhases: number;
  resultTimestamp: number;
  reelIdleTimer: number;
  probesRemaining: number; // P1-3: active probe uses per run (starts at 3)
  castZone: 'near' | 'mid' | 'far'; // P1-4: cast location based on power
  gamblerMode: 'progress' | 'tension' | null; // charm_gambler: per-fish random multiplier
}

export class FishingSystem {
  private eventBus: EventBus;
  private spawner: FishSpawner | null = null;
  private rng: RNG;
  private ctx: FishingContext;
  private _state: FishingState = FishingState.Idle;
  private spawnCtx: SpawnContext | null = null;
  private readonly RESULT_DISPLAY_MS = 2500;

  // Input subscription cleanup
  private unsubDown: (() => void) | null = null;
  private unsubUp: (() => void) | null = null;

  constructor(eventBus: EventBus, seed: number) {
    this.eventBus = eventBus;
    this.rng = new RNG(seed);
    this.ctx = this._createContext();

    // Listen to input events
    this.unsubDown = eventBus.on('input:down', () => this._onInputDown());
    this.unsubUp = eventBus.on('input:up', () => this._onInputUp());
  }

  // ── Properties ──

  get state(): FishingState {
    return this._state;
  }
  get castPower(): number {
    return this.ctx.castPower;
  }
  get tension(): number {
    return this.ctx.tension;
  }
  get fishProgress(): number {
    return this.ctx.fishProgress;
  }
  get lineDurability(): number {
    return this.ctx.lineDurability;
  }
  /** Expose the hook window end time for UI synchronization. */
  get hookWindowEnd(): number {
    return this.ctx.hookWindowEnd;
  }
  get currentFish(): SpiritFish | null {
    return this.ctx.currentFish;
  }
  get isReeling(): boolean {
    return this.ctx.isReeling;
  }
  get probesRemaining(): number {
    return this.ctx.probesRemaining;
  } // EXT-5: expose for UI

  // ── Context factory ──

  private _createContext(): FishingContext {
    return {
      castPower: 0,
      castStartTime: 0,
      currentFish: null,
      tension: 0,
      fishProgress: 0,
      lineDurability: 100,
      hookWindowEnd: 0,
      waitUntil: 0,
      nextBiteRoll: 0,
      waitExpired: false,
      nibbleTimer: 0,
      slackTimer: 0,
      isHolding: false,
      isReeling: false,
      fishBehaviorTimer: 0,
      currentBehavior: FishBehavior.Steady,
      behaviorPhaseDuration: 3,
      burstActive: false,
      burstTimer: 0,
      perfectWindowHits: 0,
      totalReelPhases: 0,
      resultTimestamp: 0,
      reelIdleTimer: 0,
      probesRemaining: 3, // P1-3: reset to 3 per cast
      castZone: 'mid', // P1-4: default mid zone
      gamblerMode: null,
    };
  }

  // EXT-2: Track per-species catches this run for repeat bonus
  private _caughtThisRun: Map<string, number> = new Map();
  // EXT-8: Track recent perfect ratio for dynamic difficulty
  private _recentPerfects: number[] = []; // last 10 catch qualities (1=perfect, 0=not)

  // ── Run lifecycle ──

  private modStats: ModifiedStats | null = null;

  /** Apply modified stats from ModifierEngine. */
  applyModStats(stats: ModifiedStats): void {
    this.modStats = stats;
  }

  /** Get effective BALANCE value (modStats override or base). */
  private _bal(key: BalanceKey): number {
    if (this.modStats && key in this.modStats) {
      return this.modStats[key];
    }
    return BALANCE[key];
  }

  /** Set the spawn context for this fishing session. */
  setSpawnContext(ctx: SpawnContext): void {
    this.spawnCtx = ctx;
    this.spawner = new FishSpawner(this.rng.getState());
  }

  /** Update baitId mid-run without resetting the spawner RNG. */
  setBaitId(baitId: string): void {
    if (this.spawnCtx) this.spawnCtx.baitId = baitId;
  }

  /** Start a new run with the given spawn context. */
  startRun(spawnCtx: SpawnContext): void {
    this.spawnCtx = spawnCtx;
    this.spawner = new FishSpawner(this.rng.getState());
    this._caughtThisRun.clear(); // EXT-2: reset per-run catch counter
    this._transitionTo(FishingState.Idle);
    logger.debug('[FishingSystem] Run started');
  }

  /** Clean up */
  dispose(): void {
    this.unsubDown?.();
    this.unsubUp?.();
    this.unsubDown = null;
    this.unsubUp = null;
  }

  // ── Input handlers ──

  private _onInputDown(): void {
    switch (this._state) {
      case FishingState.Idle:
        this._beginCast();
        break;
      case FishingState.Waiting:
        this._twitchLine();
        break;
      case FishingState.Hooking:
        this._hookSet();
        break;
      case FishingState.Reeling:
        this.ctx.isReeling = true;
        break;
      case FishingState.Catch:
      case FishingState.Escape:
        this.resetToIdle();
        break;
    }
  }

  // P0: Line twitch during waiting — risk/reward mini-interaction
  private _twitchLine(): void {
    if (!this.ctx.waitExpired) {
      // Speed up initial wait
      this.ctx.waitUntil -= 1500; // reduce by 1.5s
      this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
        message: '👆 Line twitch!',
        type: 'info',
      });
    } else {
      // P1-3: During bite roll phase — try active probe first if probes remain
      if (this.ctx.probesRemaining > 0) {
        this.ctx.probesRemaining--;
        this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
          message: `🔍 Active probe! (${this.ctx.probesRemaining} left)`,
          type: 'info',
        });
        // Probe: force bite roll with +30% rare weight
        this._rollForBite(performance.now(), true);
      } else {
        // Fallback to old twitch: 30% chance to scare, 70% to trigger immediate roll
        if (this.rng.next() < 0.3) {
          this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
            message: '💨 Something got spooked...',
            type: 'info',
          });
        } else {
          this._rollForBite(performance.now());
        }
      }
    }
  }

  private _onInputUp(): void {
    switch (this._state) {
      case FishingState.Casting:
        this._releaseCast();
        break;
      case FishingState.Reeling:
        this.ctx.isReeling = false;
        break;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // STATE MACHINE — called each frame from GameLoop
  // ════════════════════════════════════════════════════════════════

  update(dt: number, now: number): void {
    switch (this._state) {
      case FishingState.Idle:
        // Nothing to do; waiting for player to press mouse
        break;

      case FishingState.Casting:
        this._updateCast(dt, now);
        break;

      case FishingState.Waiting:
        this._updateWait(now);
        break;

      case FishingState.Nibble:
        this._updateNibble(dt, now);
        break;

      case FishingState.ProbeEscape:
        this._updateProbeEscape(dt, now);
        break;

      case FishingState.Hooking:
        this._updateHook(now);
        break;

      case FishingState.Reeling:
        this._updateReel(dt, now);
        break;

      case FishingState.Catch:
      case FishingState.Escape:
        // Auto-reset after display timeout
        if (now - this.ctx.resultTimestamp > this.RESULT_DISPLAY_MS) {
          this.resetToIdle();
        }
        break;
    }
  }

  // ── Cast Phase ──

  private _beginCast(): void {
    if (!this.spawner) {
      logger.warn('[FishingSystem] No spawner active');
      this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
        message: '🏕️ Visit the Camp first!',
        type: 'info',
      });
      return;
    }

    this.ctx = this._createContext();
    this.ctx.castStartTime = performance.now();
    this.ctx.isHolding = true;
    this._transitionTo(FishingState.Casting);
    this.eventBus.emit(GameEvents.FISHING_CAST_START, {});
  }

  private _updateCast(_dt: number, _now: number): void {
    if (!this.ctx.isHolding) return;

    const elapsed = (performance.now() - this.ctx.castStartTime) / 1000;
    this.ctx.castPower = Math.min(elapsed / this._bal('castMaxDuration'), 1.0);
  }

  private _releaseCast(): void {
    this.ctx.isHolding = false;
    const power = this.ctx.castPower;

    // Overshoot check: >90% power risks line snap
    if (power > this._bal('castOvershootThreshold')) {
      const snapChance =
        (power - this._bal('castOvershootThreshold')) / (1 - this._bal('castOvershootThreshold'));
      if (this.rng.chance(snapChance * 0.5)) {
        // P1-5: Overshoot consolation — line snap gives 5 essence
        this.eventBus.emit(GameEvents.FISHING_LINE_BREAK, { reason: 'overshoot' });
        this.eventBus.emit(GameEvents.GAME_ESSENCE_CHANGE, {
          amount: 5,
          source: 'overshoot_consolation',
        });
        this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
          message: '💔 +5 ✨ consolation',
          type: 'info',
        });
        this._transitionTo(FishingState.Escape);
        return;
      }
    }

    // P1-4: Determine cast zone based on power
    if (power < 0.3) this.ctx.castZone = 'near';
    else if (power > 0.7) this.ctx.castZone = 'far';
    else this.ctx.castZone = 'mid';

    const baitId = this.spawnCtx?.baitId ?? 'none';
    this.eventBus.emit(GameEvents.FISHING_CAST, { power, bait: baitId });
    audio.playCast(); // AUDIO: cast sound

    // Set wait timer: shorter wait for higher power (cast further = fish find bait faster)
    const waitRange = this._bal('waitDurationMax') - this._bal('waitDurationMin');
    const waitTime = this._bal('waitDurationMin') + (1 - power) * waitRange;
    this.ctx.waitUntil = performance.now() + waitTime * 1000;
    this.ctx.waitExpired = false;

    this._transitionTo(FishingState.Waiting);
  }

  // ── Wait Phase (V2: weighted bite roll) ──

  private _updateWait(now: number): void {
    // Initial wait: one-time gate before bite rolls begin
    if (!this.ctx.waitExpired && now >= this.ctx.waitUntil) {
      this.ctx.waitExpired = true;
      // First roll after a delay (not immediately — let bobber float idle)
      this.ctx.nextBiteRoll =
        now +
        (this._bal('biteRollIntervalMin') +
          this.rng.next() * (this._bal('biteRollIntervalMax') - this._bal('biteRollIntervalMin'))) *
          1000;
    }

    // Periodic bite roll (only after initial wait expired)
    if (this.ctx.waitExpired && now >= this.ctx.nextBiteRoll) {
      this._rollForBite(now);
      // Schedule next roll
      this.ctx.nextBiteRoll =
        now +
        (this._bal('biteRollIntervalMin') +
          this.rng.next() * (this._bal('biteRollIntervalMax') - this._bal('biteRollIntervalMin'))) *
          1000;
    }
  }

  /** Compute a fish's water depth from rarity/behavior/size. 0=surface, 100=abyssal. */
  static getFishDepth(fish: SpiritFish): number {
    let score = 0;
    switch (fish.rarity) {
      case 'common':
        score = 10;
        break;
      case 'uncommon':
        score = 35;
        break;
      case 'rare':
        score = 60;
        break;
      case 'legendary':
        score = 80;
        break;
      case 'mythic':
        score = 95;
        break;
    }
    switch (fish.behavior.type) {
      case FishBehavior.SurfaceJumper:
        score -= 15;
        break;
      case FishBehavior.DeepDiver:
        score += 15;
        break;
      case FishBehavior.Lazy:
        score -= 5;
        break;
      case FishBehavior.Sprint:
        score += 5;
        break;
    }
    const avgSize = (fish.size.min + fish.size.max) / 2;
    if (avgSize > 80) score += 10;
    else if (avgSize > 50) score += 5;
    if (fish.modelConfig.bodyType === 'angler') score += 10;
    else if (fish.modelConfig.bodyType === 'eel') score += 5;
    return Math.max(5, Math.min(100, score));
  }

  private _rollForBite(now: number, isProbe = false): void {
    if (!this.spawner || !this.spawnCtx) return;

    // Get all fish for this location
    const allPool = FishSpawner.getFishForLocation(this.spawnCtx.locationId);
    if (!allPool || allPool.length === 0) return;

    // Filter by time/weather/season/bait (same logic as FishSpawner.spawn)
    const ctx = this.spawnCtx;
    let candidates = allPool.filter((fish) => {
      if (fish.timeWindows.length > 0 && !fish.timeWindows.includes(ctx.timeWindow)) return false;
      if (fish.weatherRequired && fish.weatherRequired.length > 0) {
        if (!fish.weatherRequired.includes(ctx.weather)) return false;
      }
      if (fish.seasonRequired && fish.seasonRequired.length > 0) {
        if (!fish.seasonRequired.includes(ctx.season)) return false;
      }
      if (fish.baitRequired && fish.baitRequired.length > 0) {
        if (!ctx.baitId || !fish.baitRequired.includes(ctx.baitId)) return false;
      }
      return true;
    });

    // Fallback: if filters eliminated everything, use all fish
    if (candidates.length === 0) candidates = allPool;

    // Filter by cast depth: only fish reachable by this cast
    const depthMult = this.modStats?.castDepthMult ?? 1.0;
    const reachableDepth = this.ctx.castPower * 100 * depthMult;
    const reachable = candidates.filter((f) => FishingSystem.getFishDepth(f) <= reachableDepth);
    const usePool = reachable.length > 0 ? reachable : candidates; // fallback: allow all

    // P1-4: Cast zone modifier — near favors common, far favors rare+
    const zoneMod =
      this.ctx.castZone === 'near'
        ? { common: 1.5, rare: 0.6 }
        : this.ctx.castZone === 'far'
          ? { common: 0.6, rare: 1.3 }
          : { common: 1.0, rare: 1.0 };

    // Weighted selection using seeded RNG — rareBonus increases rare+ weights
    const rareBonus = (this.modStats?.rareBonus ?? 0) / 100; // percent → multiplier
    // EXT-8: Dynamic difficulty — skilled players see more rare fish
    const avgPerfect =
      this._recentPerfects.length > 0
        ? this._recentPerfects.reduce((a, b) => a + b, 0) / this._recentPerfects.length
        : 0;
    const skillBonus = avgPerfect > 0.6 ? 0.1 : avgPerfect > 0.4 ? 0.05 : 0;
    // P1-3: Active probe gives +30% rare weight
    const probeBonus = isProbe ? 0.3 : 0;
    const weights = usePool.map((f) => {
      let w =
        f.rarity === FishRarity.Common
          ? 100
          : f.rarity === FishRarity.Uncommon
            ? 50
            : f.rarity === FishRarity.Rare
              ? 20
              : f.rarity === FishRarity.Legendary
                ? 5
                : 1;
      // P1-4: Apply cast zone modifier
      if (f.rarity === FishRarity.Common) w *= zoneMod.common;
      if (f.rarity === FishRarity.Uncommon) w *= (zoneMod.common + zoneMod.rare) / 2;
      if (
        f.rarity === FishRarity.Rare ||
        f.rarity === FishRarity.Legendary ||
        f.rarity === FishRarity.Mythic
      ) {
        w *= 1 + rareBonus + probeBonus + skillBonus;
        w *= zoneMod.rare;
      }
      return w;
    });
    const idx = this.rng.weightedIndex(weights);
    const fish = usePool[idx];

    // Calculate hook probability
    const hookChance = this._calcHookChance(fish);

    if (this.rng.next() < hookChance) {
      // AUDIO-4: Fish hooked! Alert the player — audio + flash + notification
      audio.playBite();
      window.electronAPI?.flashWindow().catch(() => {
        /* browser / no API */
      });
      this.ctx.currentFish = fish;
      this.ctx.nibbleTimer = this._bal('nibbleDuration');
      this.eventBus.emit(GameEvents.FISHING_NIBBLE, { fish });
      this._transitionTo(FishingState.Nibble);
    } else {
      // Fish probed but didn't bite — brief probe escape
      this.ctx.currentFish = fish;
      this.ctx.hookWindowEnd = now; // set timestamp for probe escape timer
      this.eventBus.emit(GameEvents.FISHING_PROBE_ESCAPE, { fish });
      this._transitionTo(FishingState.ProbeEscape);
    }
  }

  private _calcHookChance(fish: SpiritFish): number {
    const base =
      fish.rarity === FishRarity.Common
        ? 0.65
        : fish.rarity === FishRarity.Uncommon
          ? 0.55
          : fish.rarity === FishRarity.Rare
            ? 0.45
            : fish.rarity === FishRarity.Legendary
              ? 0.35
              : 0.25;
    // Charm/relic/bait bonuses via modStats.hookChance
    const bonus = (this.modStats?.hookChance ?? 0) / 100;
    return Math.min(0.95, Math.max(0.1, base + bonus));
  }

  triggerBite(): void {
    if (this._state !== FishingState.Waiting) return;
    this._rollForBite(performance.now());
  }

  // ── Nibble Phase (V2) ──

  private _updateNibble(dt: number, now: number): void {
    this.ctx.nibbleTimer -= dt;
    if (this.ctx.nibbleTimer <= 0) {
      // Nibble complete → transition to hooking
      const castBonus = 1 + this.ctx.castPower * 0.8;
      const hookDuration = this._bal('hookWindowBase') * (0.8 + this.rng.next() * 0.4) * castBonus;
      const hookDurationMs = hookDuration * 1000;
      this.ctx.hookWindowEnd = now + hookDurationMs;

      this._transitionTo(FishingState.Hooking);
      if (this.ctx.currentFish) {
        this.eventBus.emit(GameEvents.FISHING_BITE, {
          fish: this.ctx.currentFish,
          hookWindowMs: hookDurationMs,
        });
      }
    }
  }

  // ── Probe Escape Phase (V2) ──

  private _updateProbeEscape(_dt: number, now: number): void {
    // Fish escaped — force re-cast. Player sees the miss and must cast again.
    if (now - this.ctx.hookWindowEnd > this._bal('baitLostDuration') * 1000) {
      this._transitionTo(FishingState.Idle);
    }
  }

  // ── Hook Phase ──

  // P1: Late hook — 0.5s grace period after window closes, harder fight
  private _updateHook(now: number): void {
    if (now > this.ctx.hookWindowEnd) {
      const lateMs = now - this.ctx.hookWindowEnd;
      if (lateMs < 500) {
        // Late hook grace period — if player clicks now, start with higher tension
        // (handled in _hookSet via _onInputDown)
        return; // don't escape yet, give 0.5s grace
      }
      this.eventBus.emit(GameEvents.FISHING_ESCAPE, {
        fish: this.ctx.currentFish,
        reason: 'missed_hook',
      });
      this._transitionTo(FishingState.Escape);
    }
  }

  // P1 continuation: late hook detection
  private _hookSet(): void {
    if (this._state !== FishingState.Hooking) return;

    if (!this.ctx.currentFish) {
      this._transitionTo(FishingState.Idle);
      return;
    }

    // Check if this was a late hook (after window closed)
    const now = performance.now();
    const isLateHook = now > this.ctx.hookWindowEnd;
    const startTension = isLateHook ? 30 : 0;

    this.eventBus.emit(GameEvents.FISHING_HOOK_SET, {
      fish: this.ctx.currentFish,
      lateHook: isLateHook,
    });

    // Initialize reel state — late hook starts with 30% tension
    this.ctx.tension = startTension;
    this.ctx.fishProgress = 0;
    this.ctx.lineDurability = 100;
    this.ctx.isReeling = false;
    this.ctx.fishBehaviorTimer = 0;
    this.ctx.currentBehavior = this.ctx.currentFish.behavior.type;
    this.ctx.behaviorPhaseDuration = 2 + this.rng.next() * 4;
    this.ctx.burstActive = false;
    this.ctx.burstTimer = 0;
    this.ctx.perfectWindowHits = 0;
    this.ctx.reelIdleTimer = 0;
    this.ctx.totalReelPhases = 0;

    // charm_gambler: 50% progress ×3, 50% tension ×3 for this fish
    const tags = this.modStats?.tags;
    if (tags?.has('gambler')) {
      this.ctx.gamblerMode = this.rng.next() < 0.5 ? 'progress' : 'tension';
      this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
        message:
          this.ctx.gamblerMode === 'progress'
            ? "🎲 Gambler's Die: progress ×3!"
            : "🎲 Gambler's Die: tension ×3!",
        type: 'info',
      });
    } else {
      this.ctx.gamblerMode = null;
    }

    this._transitionTo(FishingState.Reeling);
  }

  // ── Reel Phase ──

  private _updateReel(dt: number, _now: number): void {
    const fish = this.ctx.currentFish;
    if (!fish) return;

    // Check relic tags
    const tags = this.modStats?.tags;
    const hasAnchorFloor = tags?.has('anchor_progress_floor') ?? false;

    // ── Tension dynamics ──
    // Idle timeout: if no input for 8s, fish escapes
    if (!this.ctx.isReeling) {
      this.ctx.reelIdleTimer += dt;
      if (this.ctx.reelIdleTimer > 8) {
        this.eventBus.emit(GameEvents.FISHING_ESCAPE, {
          fish: this.ctx.currentFish,
          reason: 'idle_timeout',
        });
        this._transitionTo(FishingState.Escape);
        return;
      }
    } else {
      this.ctx.reelIdleTimer = 0;
    }

    const gamblerProgressMult = this.ctx.gamblerMode === 'progress' ? 3 : 1;
    const gamblerTensionMult = this.ctx.gamblerMode === 'tension' ? 3 : 1;

    if (this.ctx.isReeling) {
      // Player is reeling: tension increases
      this.ctx.tension += this._bal('tensionReelRate') * dt * gamblerTensionMult;
      const zoneMult = this._getTensionZoneMultiplier();
      this.ctx.fishProgress += this._bal('fishProgressRate') * zoneMult * dt * gamblerProgressMult;
    } else {
      this.ctx.tension -= this._bal('tensionSlackRate') * dt;
      this.ctx.fishProgress -= this._bal('fishProgressRate') * 0.2 * dt;
    }

    // ── Fish pull (depends on behavior) ──
    const pullForce = this._computePullForce(fish);
    this.ctx.tension += pullForce * dt;
    this.ctx.fishProgress -= pullForce * 0.5 * dt;

    // ── Line wear in red zone ──
    if (this.ctx.tension > BALANCE.tensionYellowMax) {
      const redRatio =
        (this.ctx.tension - this._bal('tensionYellowMax')) / (100 - this._bal('tensionYellowMax'));
      this.ctx.lineDurability -= this._bal('lineWearRate') * redRatio * dt;
    }

    // ── Slack-Line Burst (Rare+ fish, V2) ──
    const rarity = fish.rarity;
    if (
      rarity === FishRarity.Rare ||
      rarity === FishRarity.Legendary ||
      rarity === FishRarity.Mythic
    ) {
      const cfg = BALANCE.slackLineBurst[rarity as keyof typeof BALANCE.slackLineBurst];
      if (cfg && this.ctx.tension > cfg.threshold) {
        this.ctx.slackTimer += dt;
        if (this.ctx.slackTimer > cfg.timeToBurst) {
          this.ctx.lineDurability -= cfg.damage;
          this.ctx.slackTimer = 0; // reset after burst
          if (this.ctx.lineDurability <= 0) {
            this.eventBus.emit(GameEvents.FISHING_LINE_BREAK, { reason: 'slack_burst' });
            this._transitionTo(FishingState.Escape);
            return;
          }
        }
      } else {
        this.ctx.slackTimer = 0;
      }
    }

    this.ctx.tension = Math.max(0, Math.min(100, this.ctx.tension));
    // Anchor floor: progress never drops below 10%
    const progressFloor = hasAnchorFloor ? 10 : 0;
    this.ctx.fishProgress = Math.max(progressFloor, Math.min(100, this.ctx.fishProgress));
    this.ctx.lineDurability = Math.max(0, this.ctx.lineDurability);

    // ── Track green zone hits ──
    this.ctx.totalReelPhases++;
    if (this.ctx.tension <= this._bal('tensionGreenMax')) {
      this.ctx.perfectWindowHits++;
    }

    // ── Update fish behavior ──
    this._updateFishBehavior(dt);

    // ── Emit reel update ──
    this.eventBus.emit(GameEvents.FISHING_REEL_UPDATE, {
      tension: this.ctx.tension,
      fishProgress: this.ctx.fishProgress,
      lineDurability: this.ctx.lineDurability,
      fish,
    });

    // ── Terminal checks ──
    if (this.ctx.fishProgress >= 100) {
      this._fishCaught();
      return;
    }

    if (this.ctx.lineDurability <= 0) {
      this.eventBus.emit(GameEvents.FISHING_LINE_BREAK, { reason: 'worn_out' });
      audio.playLineBreak(); // AUDIO
      this._transitionTo(FishingState.Escape);
      return;
    }

    if (this.ctx.tension >= 100) {
      this.eventBus.emit(GameEvents.FISHING_LINE_BREAK, { reason: 'max_tension' });
      audio.playLineBreak(); // AUDIO
      this._transitionTo(FishingState.Escape);
      return;
    }
  }

  // ── Fish Behavior AI ──

  private _computePullForce(fish: SpiritFish): number {
    const basePull = fish.behavior.pullStrength;

    // Burst mode: temporary increased pull
    if (this.ctx.burstActive) {
      const burstStr = fish.behavior.burstStrength ?? basePull * 0.5;
      return basePull + burstStr;
    }

    return basePull;
  }

  private _updateFishBehavior(dt: number): void {
    this.ctx.fishBehaviorTimer += dt;

    // Burst countdown (frame-based, no setTimeout leak)
    if (this.ctx.burstActive) {
      this.ctx.burstTimer -= dt;
      if (this.ctx.burstTimer <= 0) {
        this.ctx.burstActive = false;
      }
    }

    if (this.ctx.fishBehaviorTimer >= this.ctx.behaviorPhaseDuration) {
      this.ctx.fishBehaviorTimer = 0;
      this.ctx.behaviorPhaseDuration = 1.5 + this.rng.next() * 4;

      const fish = this.ctx.currentFish;
      if (!fish) return;

      // Chance to do a burst
      const burstChance = fish.behavior.burstChance ?? 0;
      if (this.rng.chance(burstChance)) {
        this.ctx.burstActive = true;
        this.ctx.burstTimer = 0.5 + this.rng.next() * 1.0;
        // P2: Enhanced burst — fish rarity determines intensity
        const burstIntensity =
          fish.rarity === FishRarity.Mythic ? 3 : fish.rarity === FishRarity.Legendary ? 2 : 1;
        this.eventBus.emit(GameEvents.FISHING_BURST, {
          active: true,
          intensity: burstIntensity,
          fishName: fish.name.en,
        });
      }

      // Change behavior for zigzag
      if (fish.behavior.type === FishBehavior.Zigzag) {
        const behaviors = [FishBehavior.Steady, FishBehavior.Sprint, FishBehavior.Lazy];
        this.ctx.currentBehavior = behaviors[this.rng.nextInt(0, 2)];
      }
    }
  }

  private _getTensionZoneMultiplier(): number {
    const t = this.ctx.tension;
    if (t <= this._bal('tensionGreenMax')) return this._bal('progressGreenMult');
    if (t <= this._bal('tensionYellowMax')) return this._bal('progressYellowMult');
    return this._bal('progressRedMult');
  }

  // ── Catch / Escape ──

  private _fishCaught(): void {
    const fish = this.ctx.currentFish!;

    // Determine catch quality
    const perfectRatio =
      this.ctx.totalReelPhases > 0 ? this.ctx.perfectWindowHits / this.ctx.totalReelPhases : 0;

    let quality: CatchQuality;
    if (perfectRatio >= 0.8) {
      quality = CatchQuality.Perfect;
    } else if (perfectRatio >= 0.4) {
      quality = CatchQuality.Standard;
    } else {
      quality = CatchQuality.Struggle;
    }

    // Size calculation
    const sizeRange = fish.size.max - fish.size.min;
    const size = fish.size.min + this.rng.next() * sizeRange;
    const sizeCategory = this._getSizeCategory(size, fish);

    // Spirit variant check
    const isSpiritVariant = this.rng.chance(this._bal('spiritVariantChance'));

    // Gold calculation
    let goldMultiplier = 1;
    if (quality === CatchQuality.Perfect) goldMultiplier = 1.5;
    if (quality === CatchQuality.Struggle) goldMultiplier = 0.6;
    if (isSpiritVariant) goldMultiplier *= 3;
    if (sizeCategory === 'trophy') goldMultiplier *= 2;

    const goldEarned = Math.floor(fish.baseGold * goldMultiplier);

    // EXT-2: Repeat catch bonus — +2g per previous catch of same species in this run
    const prevCount = this._caughtThisRun.get(fish.id) ?? 0;
    this._caughtThisRun.set(fish.id, prevCount + 1);
    const repeatBonus = Math.min(prevCount, 10) * 2;

    // Relic: Midas Coin — gold ×1.5
    const tags = this.modStats?.tags;
    const hasMidas = tags?.has('midas_coin') ?? false;
    let finalGold = hasMidas
      ? Math.floor((goldEarned + repeatBonus) * 1.5)
      : goldEarned + repeatBonus;

    // Charm: Golden Touch — gold ×1.5
    const hasGolden = tags?.has('golden_touch') ?? false;
    if (hasGolden) finalGold = Math.floor(finalGold * 1.5);

    // EXT-4: Session milestone — notify every 5 catches in this run
    let sessionTotal = 0;
    this._caughtThisRun.forEach((v) => (sessionTotal += v));
    if (sessionTotal % 5 === 0) {
      this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, {
        message: `🎉 ${sessionTotal} fish this session!`,
        type: 'success',
      });
    }

    // AUDIO: differentiate catch sounds by rarity/quality
    if (fish.rarity === FishRarity.Mythic) {
      audio.playMythicCatch();
      window.electronAPI?.flashWindow().catch(() => {
        /* browser fallback */
      });
    } else if (quality === CatchQuality.Perfect) {
      audio.playPerfectCatch();
    } else {
      audio.playCatch();
    }

    // EXT-8: Track recent perfect ratio for dynamic difficulty
    this._recentPerfects.push(
      quality === CatchQuality.Perfect ? 1 : quality === CatchQuality.Standard ? 0.5 : 0,
    );
    if (this._recentPerfects.length > 10) this._recentPerfects.shift();

    this.eventBus.emit(GameEvents.FISHING_CATCH, {
      fish,
      size,
      quality,
      gold: finalGold,
      isSpiritVariant,
    });

    this._transitionTo(FishingState.Catch);
  }

  private _getSizeCategory(size: number, fish: SpiritFish): CaughtFish['sizeCategory'] {
    const range = fish.size.max - fish.size.min;
    const ratio = (size - fish.size.min) / range;
    if (ratio >= this._bal('trophySizeThreshold')) return 'trophy';
    if (ratio >= 0.75) return 'large';
    if (ratio >= 0.5) return 'average';
    if (ratio >= 0.25) return 'small';
    return 'tiny';
  }

  // ── State transitions ──

  private _transitionTo(newState: FishingState): void {
    const prev = this._state;
    this._state = newState;

    // Track when we enter result states for auto-reset
    if (newState === FishingState.Catch || newState === FishingState.Escape) {
      this.ctx.resultTimestamp = performance.now();
    }

    // Relic: Phoenix Feather — negate line break once per run
    // (handled by RunManager via tag check before this transition)
    if (newState === FishingState.Idle) {
      this.eventBus.emit(GameEvents.FISHING_IDLE, {});
    }

    logger.debug(`[FishingSystem] ${prev} → ${newState}`);
  }

  /** Reset to idle (called after catch/escape result is consumed). */
  resetToIdle(): void {
    this.ctx = this._createContext();
    this._transitionTo(FishingState.Idle);
  }
}
