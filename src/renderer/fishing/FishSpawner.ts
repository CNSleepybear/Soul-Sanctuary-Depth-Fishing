// ===== src/renderer/fishing/FishSpawner.ts =====
// Weighted random fish selection with time/weather/season/bait filters.
// Uses the seeded RNG for deterministic runs.

import { RNG } from '../core/RNG';
import { FISH_BY_LOCATION, RARITY_WEIGHTS } from '../data/fish-database';
import { LOCATIONS } from '../data/location-data';
import { FishRarity, TimeWindow, Season, Weather } from '../../shared/enums';
import { logger } from '../../shared/logger';
import type { SpiritFish } from '../../shared/types';

export interface SpawnContext {
  locationId: string;
  timeWindow: TimeWindow;
  season: Season;
  weather: Weather;
  baitId?: string;
  hotspotActive?: boolean; // +25% rare bonus
}

export interface SpawnResult {
  fish: SpiritFish;
  adjustedRarity: FishRarity;
  wasHotspot: boolean;
}

export class FishSpawner {
  private rng: RNG;

  constructor(seed: number) {
    this.rng = new RNG(seed);
  }

  /** Reseed for a new run. */
  reseed(seed: number): void {
    this.rng = new RNG(seed);
  }

  /**
   * Select a fish based on weighted random, filtered by context.
   * Returns null if no fish matches (should not happen with proper data).
   */
  /** Get all fish for a location (unfiltered). */
  static getFishForLocation(locationId: string): SpiritFish[] {
    return FISH_BY_LOCATION.get(locationId) ?? [];
  }

  spawn(ctx: SpawnContext): SpawnResult | null {
    const pool = FISH_BY_LOCATION.get(ctx.locationId);
    if (!pool || pool.length === 0) {
      logger.warn(`[FishSpawner] No fish found for location: ${ctx.locationId}`);
      return null;
    }

    // ── Filter by conditions ──
    let candidates = pool.filter((fish) => {
      // Time window
      if (fish.timeWindows.length > 0 && !fish.timeWindows.includes(ctx.timeWindow)) {
        return false;
      }
      // Weather
      if (fish.weatherRequired && fish.weatherRequired.length > 0) {
        if (!fish.weatherRequired.includes(ctx.weather)) return false;
      }
      // Season
      if (fish.seasonRequired && fish.seasonRequired.length > 0) {
        if (!fish.seasonRequired.includes(ctx.season)) return false;
      }
      // Bait
      if (fish.baitRequired && fish.baitRequired.length > 0) {
        if (!ctx.baitId || !fish.baitRequired.includes(ctx.baitId)) return false;
      }
      return true;
    });

    // Fallback: if filters eliminated everything, use all fish at the location
    if (candidates.length === 0) {
      candidates = pool;
    }

    // ── Weight by rarity ──
    const rarityWeights = candidates.map((fish) => {
      let w = RARITY_WEIGHTS[fish.rarity] ?? 0;

      // Hotspot bonus: +25% to rare+
      if (ctx.hotspotActive) {
        if (fish.rarity === FishRarity.Rare) w *= 1.25;
        if (fish.rarity === FishRarity.Legendary) w *= 1.25;
        if (fish.rarity === FishRarity.Mythic) w *= 1.25;
      }

      // Spirit variant chance (applied during catch, not spawn)
      return w;
    });

    const idx = this.rng.weightedIndex(rarityWeights);
    const selected = candidates[idx];

    return {
      fish: selected,
      adjustedRarity: selected.rarity,
      wasHotspot: ctx.hotspotActive ?? false,
    };
  }

  /**
   * Get all fish available at a location (unfiltered), for Fishpedia display.
   */
  static getLocationFish(locationId: string): SpiritFish[] {
    return FISH_BY_LOCATION.get(locationId) ?? [];
  }

  /**
   * Get common/uncommon fish for initial casts (tutorial-like experience).
   */
  static getCommonFish(locationId: string): SpiritFish[] {
    const pool = FISH_BY_LOCATION.get(locationId) ?? [];
    return pool.filter((f) => f.rarity === FishRarity.Common || f.rarity === FishRarity.Uncommon);
  }

  /**
   * Determine current time window based on real clock.
   */
  static getCurrentTimeWindow(): TimeWindow {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 8) return TimeWindow.Dawn;
    if (hour >= 8 && hour < 17) return TimeWindow.Day;
    if (hour >= 17 && hour < 20) return TimeWindow.Dusk;
    return TimeWindow.Night;
  }

  /**
   * Pick a random weather from the location's weather pool.
   */
  static getRandomWeather(locationId: string): Weather {
    const loc = LOCATIONS.find((l) => l.id === locationId);
    const pool = loc?.weatherPool ?? [Weather.Clear, Weather.Rain, Weather.Fog];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Determine current season based on real calendar (Northern Hemisphere).
   */
  static getCurrentSeason(): Season {
    const month = new Date().getMonth(); // 0-11
    if (month >= 2 && month <= 4) return Season.Spring;
    if (month >= 5 && month <= 7) return Season.Summer;
    if (month >= 8 && month <= 10) return Season.Autumn;
    return Season.Winter;
  }
}
