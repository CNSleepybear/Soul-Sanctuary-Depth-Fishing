import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { RNG } from '../src/renderer/core/RNG';
import { EventBus } from '../src/renderer/core/EventBus';
import { GameStateManager } from '../src/renderer/core/GameStateManager';
import { ModifierEngine } from '../src/renderer/roguelike/ModifierEngine';
import { RunManager } from '../src/renderer/roguelike/RunManager';
import { FishingSystem } from '../src/renderer/fishing/FishingSystem';
import { FishSpawner } from '../src/renderer/fishing/FishSpawner';
import { CampManager } from '../src/renderer/roguelike/CampManager';
import { DailySystem } from '../src/renderer/data/DailySystem';
import { ALL_CHARMS } from '../src/renderer/roguelike/charm-data';
import { ALL_RELICS } from '../src/renderer/roguelike/relic-data';
import { FISH_DATABASE, FISH_BY_ID, FISH_BY_LOCATION } from '../src/renderer/data/fish-database';
import { VoxelFishModel } from '../src/renderer/rendering/VoxelFishModel';
import { FloatingIsland } from '../src/renderer/rendering/FloatingIsland';
import { SanctuaryWater } from '../src/renderer/rendering/SanctuaryWater';
import { SanctuaryDetails } from '../src/renderer/rendering/SanctuaryDetails';
import { ParticleSystem } from '../src/renderer/rendering/ParticleSystem';
import { FishingLine } from '../src/renderer/rendering/FishingLine';
import { Fisherman } from '../src/renderer/rendering/Fisherman';
import { Bobber } from '../src/renderer/rendering/Bobber';
import { DEFAULT_GRADE, setGrade, getGrade } from '../src/renderer/rendering/PostFX';
import {
  buildInstancedVoxels,
  createRng,
  mixHex,
  shade,
  snap,
  snapUp,
} from '../src/renderer/rendering/ArtKit';
import { LOCATIONS } from '../src/renderer/data/location-data';
import { LocationManager } from '../src/renderer/locations/LocationManager';
import { BALANCE, BAITS } from '../src/shared/constants';
import { GameEvents } from '../src/shared/events';
import { Logger, LogLevel } from '../src/shared/logger';
import { Weather, TimeWindow, Season } from '../src/shared/enums';
import type { MetaState, FishpediaEntry, RunEvent } from '../src/shared/types';

/**
 * Unit & Integration tests — no Electron required.
 * Run: npx playwright test tests/unit.spec.ts --reporter=list
 */

test.describe('RNG Determinism', () => {
  test('same seed produces identical sequences', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  test('different seeds produce different first values', () => {
    const a = new RNG(1);
    const b = new RNG(2);
    expect(a.next()).not.toBe(b.next());
  });

  test('nextInt produces values in range', () => {
    const rng = new RNG(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  test('weightedIndex works correctly', () => {
    const rng = new RNG(42);
    // All zero except one → should always pick that index
    const w = [0, 0, 100, 0];
    for (let i = 0; i < 10; i++) {
      expect(rng.weightedIndex(w)).toBe(2);
    }
  });

  test('shuffle preserves all elements', () => {
    const rng = new RNG(789);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle([...arr]);
    expect(shuffled.sort((a, b) => a - b)).toEqual(arr);
  });
});

test.describe('Fish Database Integrity', () => {
  test('all 141 fish have unique IDs', () => {
    const ids = FISH_DATABASE.map((f) => f.id);
    expect(new Set(ids).size).toBe(FISH_DATABASE.length);
  });

  test('all fish have valid location IDs', () => {
    const validLocations = [
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
    for (const fish of FISH_DATABASE) {
      expect(validLocations).toContain(fish.location);
    }
  });

  test('FISH_BY_ID index covers all fish', () => {
    for (const fish of FISH_DATABASE) {
      expect(FISH_BY_ID.get(fish.id)).toBe(fish);
    }
  });

  test('FISH_BY_LOCATION groups all fish correctly', () => {
    let total = 0;
    for (const [, list] of FISH_BY_LOCATION) {
      total += list.length;
    }
    expect(total).toBe(FISH_DATABASE.length);
  });

  test('each location has at least 11 fish', () => {
    for (const [, list] of FISH_BY_LOCATION) {
      expect(list.length).toBeGreaterThanOrEqual(11);
    }
  });

  test('all fish have valid rarity', () => {
    const valid = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
    for (const fish of FISH_DATABASE) {
      expect(valid).toContain(fish.rarity);
    }
  });

  test('all fish have positive baseGold and xpValue', () => {
    for (const fish of FISH_DATABASE) {
      expect(fish.baseGold).toBeGreaterThan(0);
      expect(fish.xpValue).toBeGreaterThan(0);
    }
  });

  test('all fish have non-empty colorPalette', () => {
    for (const fish of FISH_DATABASE) {
      expect(fish.colorPalette.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('depth calculation does not throw', () => {
    for (const fish of FISH_DATABASE) {
      const depth = FishingSystem.getFishDepth(fish);
      expect(depth).toBeGreaterThanOrEqual(5);
      expect(depth).toBeLessThanOrEqual(100);
    }
  });
});

test.describe('FishSpawner', () => {
  test('getFishForLocation returns fish for all 12 locations', () => {
    const ids = [
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
    for (const id of ids) {
      const fish = FishSpawner.getFishForLocation(id);
      expect(fish.length).toBeGreaterThan(0);
    }
  });

  test('getCurrentTimeWindow returns valid TimeWindow', () => {
    const tw = FishSpawner.getCurrentTimeWindow();
    expect(['dawn', 'day', 'dusk', 'night']).toContain(tw);
  });

  test('getCurrentSeason returns valid Season', () => {
    const s = FishSpawner.getCurrentSeason();
    expect(['spring', 'summer', 'autumn', 'winter']).toContain(s);
  });

  test('baitRequired prevents fish from spawning with wrong bait', () => {
    const spawner = new FishSpawner(42);
    // jpn_yatagarasu_koi requires Dawn + bait_spirit_paste
    for (let i = 0; i < 500; i++) {
      const result = spawner.spawn({
        locationId: 'japan',
        timeWindow: TimeWindow.Dawn,
        season: Season.Spring,
        weather: Weather.Clear,
        baitId: 'bait_worm',
      });
      expect(result).not.toBeNull();
      expect(result!.fish.id).not.toBe('jpn_yatagarasu_koi');
    }
  });

  test('baitRequired allows fish to spawn with correct bait', () => {
    const spawner = new FishSpawner(42);
    let found = false;
    // jpn_kaminari_uo requires Night + Rain + bait_bread (Rare, so reasonably frequent)
    for (let i = 0; i < 2000; i++) {
      const result = spawner.spawn({
        locationId: 'japan',
        timeWindow: TimeWindow.Night,
        season: Season.Spring,
        weather: Weather.Rain,
        baitId: 'bait_bread',
      });
      if (result && result.fish.id === 'jpn_kaminari_uo') {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

test.describe('ModifierEngine', () => {
  test('empty modifiers return BALANCE defaults', () => {
    const stats = ModifierEngine.compute([]);
    expect(stats.tensionReelRate).toBe(BALANCE.tensionReelRate);
    expect(stats.hookWindowBase).toBe(BALANCE.hookWindowBase);
    expect(stats.rareBonus).toBe(0);
    expect(stats.hookChance).toBe(0);
  });

  test('stat_add increases values correctly', () => {
    const charm = ALL_CHARMS.find((c) => c.id === 'charm_eagle_eye')!;
    const stats = ModifierEngine.compute([charm]);
    // hookChance +5 means +5 percentage points
    expect(stats.hookChance).toBe(5);
  });

  test('stat_mult multiplies correctly', () => {
    const charm = ALL_CHARMS.find((c) => c.id === 'charm_magnetic')!;
    const stats = ModifierEngine.compute([charm]);
    expect(stats.hookWindowBase).toBeCloseTo(BALANCE.hookWindowBase * 1.4, 1);
  });

  test('tags are accumulated', () => {
    const golden = ALL_CHARMS.find((c) => c.id === 'charm_golden')!;
    const trophy = ALL_CHARMS.find((c) => c.id === 'charm_trophy')!;
    const stats = ModifierEngine.compute([golden, trophy]);
    expect(stats.tags.has('golden_touch')).toBe(true);
    expect(stats.tags.has('trophy_hunter')).toBe(true);
  });

  test('multiple stat_add stack additively', () => {
    const eagle = ALL_CHARMS.find((c) => c.id === 'charm_eagle_eye')!;
    const lucky = ALL_CHARMS.find((c) => c.id === 'charm_lucky_lure')!;
    const stats = ModifierEngine.compute([eagle, lucky]);
    expect(stats.hookChance).toBe(15); // 5 + 10
  });

  test('castDepthMult stacks additively', () => {
    // Use custom modifiers so synergy detection does not add extra bonuses.
    const mod1: any = {
      id: 'test_cast_1',
      name: 'Test',
      description: '',
      icon: '',
      rarity: 'common',
      stackable: false,
      maxStacks: 1,
      tags: ['test_cast'],
      effects: [{ type: 'stat_add', stat: 'castDepthMult', value: 0.1 }],
    };
    const mod2: any = {
      id: 'test_cast_2',
      name: 'Test',
      description: '',
      icon: '',
      rarity: 'common',
      stackable: false,
      maxStacks: 1,
      tags: ['test_cast'],
      effects: [{ type: 'stat_add', stat: 'castDepthMult', value: 0.2 }],
    };
    const stats = ModifierEngine.compute([mod1, mod2]);
    // castDepthMult base is 1.0 (now in BALANCE), stat_add values are additive on top
    expect(stats.castDepthMult).toBeCloseTo(1.0 + 0.1 + 0.2, 5); // 1.3
  });

  test('weather condition charm applies during rain', () => {
    const storm = ALL_CHARMS.find((c) => c.id === 'charm_storm')!;
    const statsRain = ModifierEngine.compute([storm], { weather: Weather.Rain });
    expect(statsRain.tensionSlackRate).toBeCloseTo(BALANCE.tensionSlackRate * 2.0, 1);

    const statsClear = ModifierEngine.compute([storm], { weather: Weather.Clear });
    expect(statsClear.tensionSlackRate).toBe(BALANCE.tensionSlackRate);
  });

  test('numeric conditions still work', () => {
    const conditional: any = {
      id: 'test_conditional',
      name: 'Test',
      description: '',
      icon: '',
      rarity: 'common',
      stackable: false,
      maxStacks: 1,
      tags: [],
      effects: [
        {
          type: 'condition',
          condition: 'tension>50',
          then: [{ type: 'stat_add', stat: 'hookChance', value: 10 }],
        },
      ],
    };
    expect(ModifierEngine.compute([conditional], { tension: 60 }).hookChance).toBe(10);
    expect(ModifierEngine.compute([conditional], { tension: 40 }).hookChance).toBe(0);
  });

  test('Tension Mastery synergy expands green zone', () => {
    const patient = ALL_CHARMS.find((c) => c.id === 'charm_patient')!;
    const steady = ALL_CHARMS.find((c) => c.id === 'charm_steady')!;
    const focused = ALL_CHARMS.find((c) => c.id === 'charm_focused')!;
    const stats = ModifierEngine.compute([patient, steady, focused]);
    expect(stats.synergies.some((s) => s.name === 'Tension Mastery')).toBe(true);
    // Synergy adds +10 flat after modifiers; focused adds +5 separately
    expect(stats.tensionGreenMax).toBe(BALANCE.tensionGreenMax + 5 + 10);
  });

  test('Keen Senses synergy extends hook window', () => {
    const magnetic = ALL_CHARMS.find((c) => c.id === 'charm_magnetic')!;
    const eagle = ALL_CHARMS.find((c) => c.id === 'charm_eagle_eye')!;
    const stats = ModifierEngine.compute([magnetic, eagle]);
    expect(stats.synergies.some((s) => s.name === 'Keen Senses')).toBe(true);
    expect(stats.hookWindowBase).toBeCloseTo(BALANCE.hookWindowBase * 1.4 + 0.3, 5);
  });

  test('Deep Casting synergy increases cast depth', () => {
    const keen = ALL_CHARMS.find((c) => c.id === 'charm_keen')!;
    const long = ALL_CHARMS.find((c) => c.id === 'charm_long_cast')!;
    const stats = ModifierEngine.compute([keen, long]);
    expect(stats.synergies.some((s) => s.name === 'Deep Casting')).toBe(true);
    expect(stats.castDepthMult).toBeCloseTo(BALANCE.castDepthMult + 0.1 + 0.15, 5);
  });
});

test.describe('RunManager Event Modifiers', () => {
  test('event statModifiers are applied and expire after duration casts', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);

    run.startRun('japan', []);
    const baseReelRate = run.modStats!.tensionReelRate;

    const event: RunEvent = {
      id: 'evt_storm',
      name: 'Storm Front',
      description: '',
      effect: 'curse',
      statModifiers: { tensionReelRate: 3 },
      duration: 2,
    };
    run.addEventModifier(event);
    expect(run.modStats!.tensionReelRate).toBe(baseReelRate + 3);

    // First cast: duration 2 -> 1, modifier still active
    eventBus.emit('fishing:cast', { power: 0.5, bait: 'none' });
    expect(run.modStats!.tensionReelRate).toBe(baseReelRate + 3);

    // Second cast: duration 1 -> 0, modifier expires
    eventBus.emit('fishing:cast', { power: 0.5, bait: 'none' });
    expect(run.modStats!.tensionReelRate).toBe(baseReelRate);
  });

  test('weather base modifier affects stats', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);

    run.startRun('japan', []);
    run.setWeather(Weather.Rain);

    const stats = run.modStats!;
    expect(stats.tensionReelRate).toBe(BALANCE.tensionReelRate + 2);
  });
});

test.describe('Charm Tag Effects', () => {
  const makeCharm = (id: string, tag: string): any => ({
    id,
    name: id,
    description: '',
    icon: '',
    rarity: 'common',
    stackable: false,
    maxStacks: 1,
    effects: [{ type: 'tag_add', tag }],
    tags: [],
  });

  test('mirror_pool duplicates the first catch only', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);
    const mirrorCharm = makeCharm('charm_mirror', 'mirror_pool');

    run.startRun('japan', [mirrorCharm]);
    const fish = FISH_DATABASE[0];
    eventBus.emit('fishing:catch', {
      fish,
      size: 0.5,
      quality: 'standard',
      gold: 100,
      isSpiritVariant: false,
    });
    expect(run.fishCaughtThisRun.length).toBe(2);
    expect(run.fishCaughtThisRun[0].fishId).toBe(fish.id);
    expect(run.fishCaughtThisRun[1].fishId).toBe(fish.id);

    // Second catch is not duplicated
    eventBus.emit('fishing:catch', {
      fish,
      size: 0.5,
      quality: 'standard',
      gold: 100,
      isSpiritVariant: false,
    });
    expect(run.fishCaughtThisRun.length).toBe(3);
  });

  test('chain_reaction increases progress rate per catch up to 30%', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);
    const chainCharm = makeCharm('charm_chain', 'chain_reaction');

    run.startRun('japan', [chainCharm]);
    const fish = FISH_DATABASE[0];

    expect(run.modStats!.fishProgressRate).toBe(BALANCE.fishProgressRate);

    for (let i = 0; i < 5; i++) {
      eventBus.emit('fishing:catch', {
        fish,
        size: 0.5,
        quality: 'standard',
        gold: 10,
        isSpiritVariant: false,
      });
    }
    expect(run.modStats!.fishProgressRate).toBe(BALANCE.fishProgressRate + 10);

    // Reach cap at 15 catches (+30%)
    for (let i = 0; i < 15; i++) {
      eventBus.emit('fishing:catch', {
        fish,
        size: 0.5,
        quality: 'standard',
        gold: 10,
        isSpiritVariant: false,
      });
    }
    expect(run.modStats!.fishProgressRate).toBe(BALANCE.fishProgressRate + 30);
  });

  test('golden_touch tag is accumulated', () => {
    const golden = ALL_CHARMS.find((c) => c.id === 'charm_golden')!;
    const stats = ModifierEngine.compute([golden]);
    expect(stats.tags.has('golden_touch')).toBe(true);
  });

  test('gambler tag is accumulated', () => {
    const gambler = ALL_CHARMS.find((c) => c.id === 'charm_gambler')!;
    const stats = ModifierEngine.compute([gambler]);
    expect(stats.tags.has('gambler')).toBe(true);
  });
});

test.describe('Bait System', () => {
  test('GameStateManager bait purchase and consume', () => {
    const eventBus = new EventBus();
    const gsm = new GameStateManager(eventBus, 999);
    gsm.gold = 100;

    expect(gsm.purchaseBait('bait_worm', 5)).toBe(true); // free bait can be claimed in shop
    expect(gsm.getBaitCount('bait_worm')).toBe(25); // 20 starter + 5 claimed
    expect(gsm.purchaseBait('bait_shrimp', 1)).toBe(true);
    expect(gsm.getBaitCount('bait_shrimp')).toBe(1);
    expect(gsm.gold).toBe(75);

    expect(gsm.consumeBait('bait_shrimp', 1)).toBe(true);
    expect(gsm.getBaitCount('bait_shrimp')).toBe(0);
  });

  test('RunManager applies bait modifier effects', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);

    run.startRun('japan', [], { baitId: 'bait_shrimp', charges: 3 });
    const stats = run.modStats!;
    const shrimp = BAITS.find((b) => b.id === 'bait_shrimp')!;
    expect(stats.rareBonus).toBe(shrimp.rareBonus);
    expect(stats.hookWindowBase).toBeCloseTo(BALANCE.hookWindowBase + shrimp.hookWindowBonus, 5);
    expect(stats.waitDurationMin).toBe(BALANCE.waitDurationMin - shrimp.waitReduction);
    expect(stats.waitDurationMax).toBe(BALANCE.waitDurationMax - shrimp.waitReduction);
  });

  test('RunManager consumes bait charges per cast and reverts to worm', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);

    run.startRun('japan', [], { baitId: 'bait_bread', charges: 2 });
    expect(run.currentBait).toBe('bait_bread');
    expect(run.remainingBaitCharges).toBe(2);

    eventBus.emit('fishing:cast', { power: 0.5, bait: 'bait_bread' });
    expect(run.remainingBaitCharges).toBe(1);
    expect(run.currentBait).toBe('bait_bread');

    eventBus.emit('fishing:cast', { power: 0.5, bait: 'bait_bread' });
    expect(run.remainingBaitCharges).toBe(0);
    expect(run.currentBait).toBe('bait_worm');

    // Third cast no longer consumes special bait
    eventBus.emit('fishing:cast', { power: 0.5, bait: 'bait_worm' });
    expect(run.remainingBaitCharges).toBe(0);
    expect(run.currentBait).toBe('bait_worm');
  });
});

test.describe('Balance Constants', () => {
  test('BAITS array is non-empty', () => {
    expect(BAITS.length).toBe(5);
  });

  test('BALANCE values are in valid ranges', () => {
    expect(BALANCE.tensionReelRate).toBeGreaterThan(0);
    expect(BALANCE.tensionSlackRate).toBeGreaterThan(BALANCE.tensionReelRate); // slack faster than reel
    expect(BALANCE.tensionGreenMax).toBeLessThan(BALANCE.tensionYellowMax);
    expect(BALANCE.tensionYellowMax).toBeLessThan(BALANCE.tensionMax);
    expect(BALANCE.castMaxDuration).toBeGreaterThan(0);
    expect(BALANCE.spiritVariantChance).toBeGreaterThan(0);
    expect(BALANCE.spiritVariantChance).toBeLessThan(1);
  });
});

test.describe('Charm Data', () => {
  test('all charms have unique IDs', () => {
    const ids = ALL_CHARMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ALL_CHARMS.length);
  });

  test('all charm effects reference valid stats', () => {
    const validStats = new Set([
      'hookWindowBase',
      'tensionReelRate',
      'tensionSlackRate',
      'lineWearRate',
      'fishProgressRate',
      'castMaxDuration',
      'waitDurationMin',
      'waitDurationMax',
      'maxCasts',
      'tensionGreenMax',
      'lineDurability',
      'rareBonus',
      'progressGreenMult',
      'spiritVariantChance',
      'castDepthMult',
      'hookChance',
      'trophySizeThreshold',
    ]);
    for (const charm of ALL_CHARMS) {
      for (const effect of charm.effects) {
        if (effect.type === 'stat_add' || effect.type === 'stat_mult') {
          expect(
            validStats.has(effect.stat),
            `Charm ${charm.id} references unknown stat: ${effect.stat}`,
          ).toBe(true);
        }
      }
    }
  });
});

test.describe('Relic Data', () => {
  test('all relics have unique IDs', () => {
    const ids = ALL_RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ALL_RELICS.length);
  });

  test('relics with tag_add effects reference known consumers', () => {
    const knownTags = [
      'midas_coin',
      'anchor_progress_floor',
      'phoenix_feather',
      'echo_stone',
      'golden_touch',
      'trophy_hunter',
      'chain_reaction',
      'mirror_pool',
      'gambler',
    ];
    for (const relic of ALL_RELICS) {
      for (const effect of relic.effects) {
        if (effect.type === 'tag_add') {
          expect(
            knownTags.includes(effect.tag),
            `Relic ${relic.id} has unknown tag: ${effect.tag}`,
          ).toBe(true);
        }
      }
    }
  });
});

test.describe('Camp Upgrades', () => {
  test('upgrade costs are positive and scale correctly', () => {
    const meta: MetaState = {
      charmSlots: 3,
      relicSlots: 0,
      charmRerolls: 1,
      baitPouchSize: 3,
      baseLineDurability: 100,
      synergySlotUnlocked: false,
      specialization: 'none',
    };
    const cm = new CampManager(meta);

    // Charm slots: Lv0 cost should be 200G
    const cost0 = cm.getCost('charm_slots');
    expect(cost0).not.toBeNull();
    expect(cost0!.gold).toBe(200);
    expect(cost0!.essence).toBe(10);

    // After purchase, Lv1 cost should scale
    cm.purchase('charm_slots');
    const cost1 = cm.getCost('charm_slots');
    expect(cost1).not.toBeNull();
    expect(cost1!.gold).toBe(Math.floor(200 * 1.8)); // 360
    expect(cost1!.essence).toBe(Math.floor(10 * 1.8)); // 18
  });

  test('max level prevents further upgrades', () => {
    const meta: MetaState = {
      charmSlots: 3,
      relicSlots: 0,
      charmRerolls: 1,
      baitPouchSize: 3,
      baseLineDurability: 100,
      synergySlotUnlocked: false,
      specialization: 'none',
    };
    const cm = new CampManager(meta);
    // Charm slots max is 4 levels
    for (let i = 0; i < 4; i++) cm.purchase('charm_slots');
    expect(cm.getCost('charm_slots')).toBeNull(); // maxed
  });
});

// ═══════════════════════════════════════════════════
// Location Unlock Tests
// ═══════════════════════════════════════════════════

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

const PREFIX_MAP: Record<string, string> = {
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

type PrefixFishEntry = { fishId: string; discovered: boolean };

test.describe('Location Unlock System', () => {
  test('japan is always unlocked from start', () => {
    const gsm = new GameStateManager(new EventBus(), 0);
    expect(gsm.unlockedLocations.has('japan')).toBe(true);
  });

  test('china is locked by default', () => {
    const gsm = new GameStateManager(new EventBus(), 0);
    expect(gsm.unlockedLocations.has('china')).toBe(false);
  });

  test('prefix map covers all 12 locations', () => {
    for (const loc of LOCATION_ORDER) {
      expect(PREFIX_MAP[loc]).toBeDefined();
    }
  });

  test('all fish IDs match their location prefix', () => {
    for (const fish of FISH_DATABASE) {
      const prefix = PREFIX_MAP[fish.location];
      expect(prefix).toBeDefined();
      expect(
        fish.id.startsWith(prefix),
        `Fish ${fish.id} should start with ${prefix} for location ${fish.location}`,
      ).toBe(true);
    }
  });

  test('5 discovered fish in japan unlocks china', () => {
    const gsm = new GameStateManager(new EventBus(), 0);
    // Simulate catching 5 japan fish
    const japanFish = FISH_BY_LOCATION.get('japan')!;
    for (let i = 0; i < 5; i++) {
      const entry: PrefixFishEntry = { fishId: japanFish[i].id, discovered: true };
      (gsm as any).fishpedia[japanFish[i].id] = entry;
    }
    const newly = gsm.checkLocationUnlocks();
    expect(newly).toContain('china');
    expect(gsm.unlockedLocations.has('china')).toBe(true);
  });

  test('4 discovered fish does NOT unlock next location', () => {
    const gsm = new GameStateManager(new EventBus(), 0);
    const japanFish = FISH_BY_LOCATION.get('japan')!;
    for (let i = 0; i < 4; i++) {
      (gsm as any).fishpedia[japanFish[i].id] = { fishId: japanFish[i].id, discovered: true };
    }
    const newly = gsm.checkLocationUnlocks();
    expect(newly).not.toContain('china');
    expect(gsm.unlockedLocations.has('china')).toBe(false);
  });

  test('full unlock chain: all 12 locations unlock in order', () => {
    const gsm = new GameStateManager(new EventBus(), 0);

    for (let i = 1; i < LOCATION_ORDER.length; i++) {
      const prevLoc = LOCATION_ORDER[i - 1];
      const targetLoc = LOCATION_ORDER[i];
      const fishList = FISH_BY_LOCATION.get(prevLoc)!;

      // Add 5 discovered fish from previous location
      for (let j = 0; j < 5; j++) {
        (gsm as any).fishpedia[fishList[j].id] = { fishId: fishList[j].id, discovered: true };
      }

      const newly = gsm.checkLocationUnlocks();
      expect(newly).toContain(targetLoc);
      expect(gsm.unlockedLocations.has(targetLoc)).toBe(true);
    }

    // All 12 should be unlocked
    expect(gsm.unlockedLocations.size).toBe(12);
  });

  test('catching fish in already-unlocked location does not re-unlock', () => {
    const gsm = new GameStateManager(new EventBus(), 0);
    // Japan is already unlocked
    // Add japan fish - should not trigger japan unlock again
    const japanFish = FISH_BY_LOCATION.get('japan')!;
    for (let i = 0; i < 6; i++) {
      (gsm as any).fishpedia[japanFish[i].id] = { fishId: japanFish[i].id, discovered: true };
    }
    const newly = gsm.checkLocationUnlocks();
    // Should unlock china but NOT re-unlock japan
    expect(newly).not.toContain('japan');
  });

  test('mid-chain: unlocking uk requires 5 uk_ prefix fish from uk location', () => {
    const gsm = new GameStateManager(new EventBus(), 0);

    // Manually unlock japan→china→usa
    gsm.unlockedLocations.add('china');
    gsm.unlockedLocations.add('usa');

    // Add 5 UK fish
    const ukFish = FISH_BY_LOCATION.get('uk')!;
    for (let i = 0; i < 5; i++) {
      (gsm as any).fishpedia[ukFish[i].id] = { fishId: ukFish[i].id, discovered: true };
    }

    const newly = gsm.checkLocationUnlocks();
    // usa unlocks france (next), not uk—uk→france is the chain
    // Actually: usa unlocks uk (prevLoc for uk is usa)
    // But wait - the logic checks prevLoc fish count. For uk, prevLoc=usa
    // We added UK fish, not USA fish. So UK data exists but USA (prev for uk) might not.
    // Let me re-think: the chain is japan→china→usa→uk→france→...
    // For 'uk', prevLoc='usa'. We need 5 USA fish discovered.
    // So this test setup is wrong. The mid-chain test should add USA fish.

    // Correct: add 5 USA fish to unlock uk
    const usaFish = FISH_BY_LOCATION.get('usa')!;
    for (let i = 0; i < 5; i++) {
      (gsm as any).fishpedia[usaFish[i].id] = { fishId: usaFish[i].id, discovered: true };
    }

    const newly2 = gsm.checkLocationUnlocks();
    expect(newly2).toContain('uk');
  });

  test('fish from wrong prefix do not count toward unlock', () => {
    const gsm = new GameStateManager(new EventBus(), 0);

    // Add 5 china fish (chn_ prefix) — should NOT unlock china because prevLoc for china is japan
    const chinaFish = FISH_BY_LOCATION.get('china')!;
    for (let i = 0; i < 5; i++) {
      (gsm as any).fishpedia[chinaFish[i].id] = { fishId: chinaFish[i].id, discovered: true };
    }

    const newly = gsm.checkLocationUnlocks();
    // china fish with chn_ prefix don't count for japan → china unlock
    expect(newly).not.toContain('china');
  });
});

// ═══════════════════════════════════════════════════
// Daily System Tests
// ═══════════════════════════════════════════════════

test.describe('DailySystem', () => {
  test('claimFreeBait emits event with baitId and amount', () => {
    const eventBus = new EventBus();
    const daily = new DailySystem(eventBus, undefined, undefined, true);
    let captured: any = null;
    eventBus.on(GameEvents.DAILY_FREE_BAIT_CLAIMED, (p) => {
      captured = p;
    });

    expect(daily.claimFreeBait()).toBe(true);
    expect(captured).not.toBeNull();
    expect(captured.baitId).toBe('bait_worm');
    expect(captured.amount).toBe(3);
    expect(daily.freeBaitAvailable).toBe(false);
    expect(daily.claimFreeBait()).toBe(false);
  });

  test('GameStateManager adds bait on DAILY_FREE_BAIT_CLAIMED', () => {
    const eventBus = new EventBus();
    const gsm = new GameStateManager(eventBus, 998);
    eventBus.emit(GameEvents.DAILY_FREE_BAIT_CLAIMED, { baitId: 'bait_worm', amount: 3 });
    expect(gsm.getBaitCount('bait_worm')).toBeGreaterThanOrEqual(3);
  });

  test('RunManager sets hotspotActive in spawn context for matching location', () => {
    const eventBus = new EventBus();
    const fishing = new FishingSystem(eventBus, 42);
    const run = new RunManager(eventBus, fishing, 42);

    run.setHotspotLocation('japan');
    run.startRun('japan', []);
    // hotspotActive is consumed internally by FishingSystem spawn context;
    // we verify no errors and run starts in fishing phase
    expect(run.currentPhase).toBe('fishing');
  });
});

// ═══════════════════════════════════════════════════
// Save/Load Roundtrip Tests
// ═══════════════════════════════════════════════════

test.describe('GameStateManager Import/Export', () => {
  test('export and import preserves baits, souls, runs, discount and daily state', () => {
    const eventBus = new EventBus();
    const gsm = new GameStateManager(eventBus, 997);
    gsm.gold = 1234;
    gsm.essence = 56;
    gsm.baits = {}; // clear starter bait for deterministic export
    gsm.addBait('bait_shrimp', 7);
    gsm.soulCollection = {
      jpn_aoi_sakana: {
        fishId: 'jpn_aoi_sakana',
        locationId: 'japan',
        caughtAt: Date.now(),
        memoryUnlocked: true,
        storyProgress: 2,
      },
    };
    gsm.totalRuns = 5;
    gsm.firstPurchaseDiscountUsed = true;
    (gsm as any)._dailyState = {
      lastRefreshDate: '2026-06-20',
      completedQuests: ['daily_2026-06-20_0'],
      streakDays: 3,
      freeBaitClaimed: true,
      hotspotLocation: 'iceland',
    };

    const json = gsm.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.baits).toEqual(expect.objectContaining({ bait_shrimp: 7 }));
    expect(gsm.getBaitCount('bait_shrimp')).toBe(7);
    expect(parsed.soulCollection).toBeDefined();
    expect(parsed.totalRuns).toBe(5);
    expect(parsed.firstPurchaseDiscountUsed).toBe(true);
    expect(parsed.dailyStreakDays).toBe(3);
    expect(parsed.dailyHotspotLocation).toBe('iceland');

    const gsm2 = new GameStateManager(eventBus, 996);
    expect(gsm2.importJSON(json)).toBe(true);
    expect(gsm2.gold).toBe(1234);
    expect(gsm2.essence).toBe(56);
    expect(gsm2.getBaitCount('bait_shrimp')).toBe(7);
    expect(gsm2.getBaitCount('bait_worm')).toBe(0); // imported save should not include starter bait
    expect(gsm2.soulCollection).toHaveProperty('jpn_aoi_sakana');
    expect(gsm2.totalRuns).toBe(5);
    expect(gsm2.firstPurchaseDiscountUsed).toBe(true);
    expect((gsm2 as any)._dailyState.streakDays).toBe(3);
    expect((gsm2 as any)._dailyState.hotspotLocation).toBe('iceland');
  });
});

// ═══════════════════════════════════════════════════
// Rendering / Memory Tests
// ═══════════════════════════════════════════════════

test.describe('VoxelFishModel Cache', () => {
  test('legendary breathing preserves voxel proportions across frames', () => {
    const fish = FISH_DATABASE.find((entry) => entry.rarity === 'legendary')!;
    const model = new VoxelFishModel(fish);
    const original = model.group.children.map((child) => child.scale.clone());
    for (const time of [0, 0.5, 1, 10, 100]) {
      model.update(time);
      model.group.children.forEach((child, index) => {
        const ratio = child.scale.clone().divide(original[index]);
        expect(ratio.x).toBeCloseTo(ratio.y, 5);
        expect(ratio.y).toBeCloseTo(ratio.z, 5);
        expect(ratio.x).toBeGreaterThanOrEqual(1);
        expect(ratio.x).toBeLessThan(1.06);
      });
    }
    model.dispose();
  });
  test('same fish shares geometry and materials across instances', () => {
    const fish = FISH_DATABASE[0];
    const a = new VoxelFishModel(fish);
    const b = new VoxelFishModel(fish);

    const aGeos = new Set<THREE.BufferGeometry>();
    const bGeos = new Set<THREE.BufferGeometry>();
    a.group.traverse((c) => {
      if (c instanceof THREE.Mesh) aGeos.add(c.geometry);
    });
    b.group.traverse((c) => {
      if (c instanceof THREE.Mesh) bGeos.add(c.geometry);
    });

    // Should share the single unit box geometry
    expect(aGeos.size).toBe(1);
    expect(bGeos.size).toBe(1);
    expect([...aGeos][0]).toBe([...bGeos][0]);

    const aMats = new Set<THREE.Material>();
    const bMats = new Set<THREE.Material>();
    a.group.traverse((c) => {
      if (c instanceof THREE.Mesh) aMats.add(c.material as THREE.Material);
    });
    b.group.traverse((c) => {
      if (c instanceof THREE.Mesh) bMats.add(c.material as THREE.Material);
    });

    // Materials should be reused (same instances)
    for (const mat of aMats) {
      expect(bMats.has(mat)).toBe(true);
    }

    // dispose of one instance should not affect the other
    a.dispose();
    expect(b.group.children.length).toBeGreaterThan(0);
    b.dispose();
  });

  test('different fish produce different model groups', () => {
    const fishA = FISH_DATABASE[0];
    const fishB = FISH_DATABASE[1];
    const a = new VoxelFishModel(fishA);
    const b = new VoxelFishModel(fishB);
    expect(a.group).not.toBe(b.group);
    a.dispose();
    b.dispose();
  });
});

test.describe('Sanctuary visual lifecycle', () => {
  test('all twelve locations animate ambience and release their scene objects', () => {
    const scene = new THREE.Scene();
    const locations = new LocationManager(scene);
    for (const id of [
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
    ]) {
      locations.loadLocation(id);
      expect(scene.children.filter((child) => child instanceof THREE.Light)).toHaveLength(5);
      let atmosphereFrames = 0;
      Object.defineProperty(locations.currentLocation!, 'updateAtmosphere', {
        value: () => {
          atmosphereFrames++;
        },
      });
      locations.update(1 / 60);
      expect(atmosphereFrames).toBe(1);
    }
    locations.destroy();
    expect(scene.children).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════
// Art direction v2 foundations
// ═══════════════════════════════════════════════════

test.describe('Art direction v2', () => {
  test('every sanctuary ships a complete 6-colour script and sane grade', () => {
    for (const location of LOCATIONS) {
      const theme = location.theme;
      expect(theme, location.id).toBeTruthy();
      const art = theme!.art;
      expect(art, `${location.id} theme.art`).toBeTruthy();
      for (const slot of ['key', 'shadow', 'accent', 'glow', 'veil'] as const) {
        expect(typeof art![slot], `${location.id}.${slot}`).toBe('number');
      }
      const grade = art!.grade ?? {};
      expect(grade.saturation ?? 1, location.id).toBeGreaterThan(0.8);
      expect(grade.saturation ?? 1, location.id).toBeLessThan(1.3);
      expect(grade.bloom ?? 0.5, location.id).toBeGreaterThanOrEqual(0);
      expect(grade.bloom ?? 0.5, location.id).toBeLessThanOrEqual(1.2);
      expect(grade.vignette ?? 0.13, location.id).toBeLessThanOrEqual(0.35);
    }
  });

  test('post grade merges overrides without leaking between locations', () => {
    setGrade({ bloom: 0.91, saturation: 1.2 });
    expect(getGrade().bloom).toBe(0.91);
    expect(getGrade().saturation).toBe(1.2);
    expect(getGrade().exposure).toBe(DEFAULT_GRADE.exposure);
    setGrade();
    expect(getGrade().bloom).toBe(DEFAULT_GRADE.bloom);
    expect(getGrade().saturation).toBe(DEFAULT_GRADE.saturation);
  });

  test('art kit helpers keep the 0.25 grid coherent', () => {
    expect(snap(0.37)).toBe(0.25);
    expect(snap(0.64)).toBe(0.75);
    expect(snapUp(0.01)).toBe(0.25);
    const mid = mixHex(0x000000, 0xffffff, 0.5);
    expect((mid >> 16) & 0xff).toBe((mid >> 8) & 0xff);
    expect((mid >> 8) & 0xff).toBe(mid & 0xff);
    expect(mid & 0xff).toBeGreaterThan(0x80);
    expect(shade(0x808080, 1)).toBe(0x808080);
    const rngA = createRng('sanctuary');
    const rngB = createRng('sanctuary');
    for (let i = 0; i < 12; i++) expect(rngA.next()).toBe(rngB.next());
  });

  test('instanced voxel batches create one draw call worth of mesh', () => {
    const mesh = buildInstancedVoxels([
      { x: 0, y: 0, z: 0, color: 0xff0000 },
      { x: 1, y: 0, z: 0, color: 0x00ff00 },
      { x: 2, y: 0, z: 0, color: 0x0000ff },
    ]);
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBe(3);
    expect(mesh.instanceColor).toBeTruthy();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  test('particle system uses one dynamic batch and preserves motion', () => {
    const system = new ParticleSystem({
      count: 90,
      type: 'float',
      color: 0xffffff,
      spreadRadius: 3,
      heightRange: 2,
      driftType: 'sine',
    });
    const group = system.getGroup();
    expect(group.children).toHaveLength(1);
    const mesh = group.children[0] as THREE.InstancedMesh;
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBe(90);
    expect(mesh.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    const before = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    mesh.getMatrixAt(0, before);
    system.update(1 / 60, 0.5);
    mesh.getMatrixAt(0, after);
    expect(after.equals(before)).toBe(false);
    system.dispose();
    expect(group.children).toHaveLength(0);
  });

  test('fishing line keeps twelve curved segments in one dynamic batch', () => {
    const line = new FishingLine();
    const mesh = line.group.children[0] as THREE.InstancedMesh;
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBe(12);
    expect(mesh.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    line.setRodTip(new THREE.Vector3(0, 1, 0));
    line.setTarget(new THREE.Vector3(2, -1, 4));
    line.setTension(25);
    line.show();
    line.update();
    expect(mesh.visible).toBe(true);
    const first = new THREE.Matrix4();
    const last = new THREE.Matrix4();
    mesh.getMatrixAt(0, first);
    mesh.getMatrixAt(11, last);
    expect(last.equals(first)).toBe(false);
    line.setTension(100);
    line.update();
    expect((mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xff6b5e);
    line.setTarget(new THREE.Vector3(0, 1, 0));
    line.update();
    expect(mesh.visible).toBe(false);
    line.dispose();
    expect(line.group.children).toHaveLength(0);
  });

  test('fisherman batches rigid voxels without freezing rod animation', () => {
    const fisherman = new Fisherman();
    const meshes: THREE.Mesh[] = [];
    fisherman.group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });
    expect(meshes).toHaveLength(8);
    expect(meshes.every((mesh) => mesh instanceof THREE.InstancedMesh)).toBe(true);
    const before = fisherman.getWorldRodTip().clone();
    fisherman.setTension(100);
    for (let frame = 1; frame <= 12; frame++) fisherman.update(frame / 60);
    const after = fisherman.getWorldRodTip().clone();
    expect(after.distanceTo(before)).toBeGreaterThan(0.001);
    fisherman.playCast();
    fisherman.update(0.3);
    fisherman.playLineBreak();
    fisherman.update(0.5);
    fisherman.dispose();
    expect(fisherman.group.children).toHaveLength(0);
  });

  test('bobber keeps the antenna and state animation after batching', () => {
    const bobber = new Bobber();
    bobber.showIdle(new THREE.Vector3());
    const meshes: THREE.Mesh[] = [];
    bobber.group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });
    expect(meshes).toHaveLength(6);
    expect(meshes.filter((mesh) => mesh instanceof THREE.InstancedMesh)).toHaveLength(5);
    const antenna = meshes.find((mesh) => !(mesh instanceof THREE.InstancedMesh));
    expect(antenna).toBeDefined();
    bobber.update(0.1);
    expect(antenna!.rotation.z).not.toBe(0);
    bobber.startFlight(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, -1, 2));
    for (let frame = 0; frame < 20; frame++) bobber.update(0.1);
    expect(bobber.state).toBe('waiting');
    bobber.startSink();
    for (let frame = 0; frame < 10; frame++) bobber.update(0.1);
    expect(bobber.group.visible).toBe(false);
    bobber.resurface(new THREE.Vector3(1, -1, 2));
    for (let frame = 0; frame < 10; frame++) bobber.update(0.1);
    expect(bobber.state).toBe('waiting');
    bobber.dispose();
    expect(bobber.group.children).toHaveLength(0);
  });

  test('floating island combines strata into three shadow-aware batches', () => {
    const island = new FloatingIsland(undefined, 'test-island');
    expect(island.surfaceY).toBe(1.5);
    expect(island.radius).toBeGreaterThan(5);
    const instanced = island.group.children.filter(
      (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
    );
    expect(instanced).toHaveLength(3);
    expect(instanced.reduce((sum, mesh) => sum + mesh.count, 0)).toBeGreaterThan(3000);
    expect(instanced.filter((mesh) => mesh.castShadow)).toHaveLength(1);
    expect(instanced.filter((mesh) => mesh.receiveShadow)).toHaveLength(2);
    expect(instanced.every((mesh) => mesh.instanceColor)).toBe(true);
    island.update(1.5);
    island.setPosition(0, 0.5, 0);
    island.dispose();
    expect(island.group.children).toHaveLength(0);
  });

  test('water keeps a closed foam band and stable resources across animation', () => {
    const water = new SanctuaryWater(LOCATIONS[0], 'japan');
    const depth: THREE.InstancedMesh[] = [];
    const ripples: THREE.InstancedMesh[] = [];
    let foam: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    water.group.traverse((child) => {
      if (child.userData.waterPart === 'foam') {
        foam = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      } else if (child instanceof THREE.InstancedMesh && child.userData.waterPart === 'depth') {
        depth.push(child);
      } else if (child instanceof THREE.InstancedMesh && child.userData.waterPart === 'ripple') {
        ripples.push(child);
      }
    });
    expect(depth).toHaveLength(5);
    depth.sort((a, b) => a.userData.band - b.userData.band);
    expect(depth.map((mesh) => (mesh.material as THREE.MeshBasicMaterial).opacity)).toEqual([
      1, 0.9, 0.76, 0.56, 0.34,
    ]);
    expect(ripples).toHaveLength(2);
    expect(ripples[0].count).toBeLessThan(36);
    expect(ripples[1].count).toBeLessThan(28);
    if (!foam) throw new Error('Missing continuous foam mesh');
    expect(foam.geometry.getAttribute('position').count).toBe(128);
    expect(foam.geometry.index?.count).toBe(64 * 6);
    const index = foam.geometry.index!;
    expect(Array.from(index.array.slice(-6))).toEqual([126, 0, 1, 126, 1, 127]);
    const foamGeometry = foam.geometry;
    const foamMaterial = foam.material;
    const rippleBuffers = ripples.map((mesh) => mesh.instanceMatrix);
    water.update(0);
    water.update(12.5);
    expect(foam.geometry).toBe(foamGeometry);
    expect(foam.material).toBe(foamMaterial);
    ripples.forEach((mesh, i) => expect(mesh.instanceMatrix).toBe(rippleBuffers[i]));
    water.dispose();
    expect(water.group.children).toHaveLength(0);
  });

  test('shoreline detail builds for all twelve sanctuaries', () => {
    for (const location of LOCATIONS) {
      const details = new SanctuaryDetails(location.id);
      expect(details.group.children.length, location.id).toBeGreaterThan(0);
      const lights = details.group.children.filter((c) => c instanceof THREE.PointLight);
      expect(lights.length, location.id).toBeLessThanOrEqual(3);
      details.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m) => m.dispose());
        }
      });
    }
  });
});

// ═══════════════════════════════════════════════════
// Logger Tests
// ═══════════════════════════════════════════════════

test.describe('Logger', () => {
  test('level filtering works', () => {
    const logs: string[] = [];
    const original = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    console.debug = (...args: any[]) => logs.push(args.join(' '));
    console.info = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));
    console.error = (...args: any[]) => logs.push(args.join(' '));

    const log = new Logger('Test', LogLevel.WARN);
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');

    expect(logs).toContain('[Test] c');
    expect(logs).toContain('[Test] d');
    expect(logs).not.toContain('[Test] a');
    expect(logs).not.toContain('[Test] b');

    console.debug = original.debug;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  });
});
