// ===== src/shared/types.ts =====
// Core type definitions used across all systems.

import {
  FishRarity,
  FishBehavior,
  CatchQuality,
  GamePhase,
  TimeWindow,
  Season,
  Weather,
  ModifierRarity,
} from './enums';

// ===== Fish =====
export interface FishModelConfig {
  bodyType: 'koi' | 'eel' | 'ray' | 'angler' | 'standard';
  finStyle: 'normal' | 'long' | 'spike' | 'round';
  scale: number;
  segments?: number;
}

export interface FishBehaviorProfile {
  type: FishBehavior;
  pullStrength: number;
  burstChance?: number;
  burstStrength?: number;
}

export interface SpiritFish {
  id: string;
  name: { zh: string; en: string };
  location: string;
  rarity: FishRarity;
  modelConfig: FishModelConfig;
  colorPalette: string[];
  size: { min: number; max: number };
  behavior: FishBehaviorProfile;
  timeWindows: TimeWindow[];
  weatherRequired?: Weather[];
  seasonRequired?: Season[];
  baitRequired?: string[];
  baseGold: number;
  xpValue: number;
  description: string;
  mythologyNote?: string;
}

export interface CaughtFish {
  fishId: string;
  size: number;
  sizeCategory: 'tiny' | 'small' | 'average' | 'large' | 'trophy';
  quality: CatchQuality;
  isSpiritVariant: boolean;
  goldEarned: number;
  timestamp: number;
}

export interface FishpediaEntry {
  fishId: string;
  discovered: boolean;
  timesCaught: number;
  largestSize: number;
  smallestSize: number;
  hasTrophy: boolean;
  hasSpiritVariant: boolean;
  firstCaughtTimestamp: number | null;
}

export interface SoulEntry {
  fishId: string;
  locationId: string;
  caughtAt: number;
  memoryUnlocked: boolean;
  storyProgress: number;
}

// ===== Modifier (Charm / Relic) =====
export type ModifierEffect =
  | { type: 'stat_mult'; stat: string; multiplier: number }
  | { type: 'stat_add'; stat: string; value: number }
  | { type: 'condition'; condition: string; then: ModifierEffect[] }
  | { type: 'trigger'; on: string; action: ModifierEffect[] }
  | { type: 'tag_add'; tag: string };

export interface Modifier {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: ModifierRarity;
  stackable: boolean;
  maxStacks: number;
  effects: ModifierEffect[];
  tags: string[];
}

export interface Relic extends Modifier {
  relicId: string;
  unlockCondition: string;
  isEquipped: boolean;
}

export interface Synergy {
  name: string;
  description: string;
  requiredTag: string;
  requiredCount: number;
  effects: ModifierEffect[];
}

// ===== Run =====
export interface RunEvent {
  id: string;
  name: string;
  description: string;
  effect: 'blessing' | 'curse' | 'choice' | 'info';
  choices?: { label: string; outcome: string }[];
  modifier?: Modifier;
  statModifiers?: Partial<Record<string, number>>;
  duration?: number; // casts remaining until expiry
}

export interface RunRewards {
  gold: number;
  xp: number;
  spiritEssence: number;
  sanctuaryTokens: number;
  fishCaught: number;
  perfectCatches: number;
  newDiscoveries: string[];
  relicDiscovered: Relic | null;
}

export interface RunState {
  active: boolean;
  seed: number;
  locationId: string;
  castsRemaining: number;
  lineDurability: number;
  activeCharms: Modifier[];
  eventsTriggered: string[];
  fishCaughtThisRun: CaughtFish[];
  canEndVoluntarily: boolean;
}

// ===== Player & Progression =====
export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  gold: number;
  spiritEssence: number;
  sanctuaryTokens: number;
}

export interface GearState {
  equippedRodId: string;
  equippedLineId: string;
  ownedRods: string[];
  ownedLines: string[];
  ownedBaitIds: string[];
  equippedRelicIds: string[];
  ownedRelicIds: string[];
}

export interface MetaState {
  charmSlots: number;
  relicSlots: number;
  charmRerolls: number;
  baitPouchSize: number;
  baseLineDurability: number;
  synergySlotUnlocked: boolean; // P0-2: unlocked when charmSlots >= 4
  specialization: 'none' | 'charm_master' | 'line_master'; // C-P2-1: player's chosen path
}

export interface PlayerStats {
  totalCasts: number;
  totalCatches: number;
  perfectCatches: number;
  lineBreaks: number;
  longestCast: number;
  biggestFish: CaughtFish | null;
  totalGoldEarned: number;
  totalPlays: number;
}

export interface DailyState {
  lastRefreshDate: string;
  completedQuests: string[];
  streakDays: number;
  freeBaitClaimed: boolean;
  hotspotLocation: string | null;
}

// ===== Gear =====
export interface RodConfig {
  id: string;
  name: string;
  tier: number;
  unlockCost: number;
  powerMultiplier: number;
  maxCasts: number;
  bonus: string;
}

export interface LineConfig {
  id: string;
  name: string;
  unlockCost: number;
  strengthMultiplier: number;
  special: string;
}

export interface BaitConfig {
  id: string;
  name: string;
  cost: number;
  rareBonus: number;
  effect: string;
}

// ===== Location =====
export interface LocationTheme {
  ambient: number;
  ambientIntensity: number;
  moon: number;
  moonIntensity: number;
  rim: number;
  rimIntensity: number;
  waterGlow: number;
  waterGlowIntensity: number;
  fog: number;
  fogDensity: number;
  waterColor: number;
  waterOpacity: number;
  uiAccent: number;
  island: {
    stone: number;
    earth: number;
    grass: number;
  };
  /** Optional scene background color (for locations needing a dark sky). */
  bgColor?: number;
  /** Atmosphere tuning: soul-driven ambience, weather fog, etc. */
  atmosphere?: {
    /** Color used for soul-awakening warm tint */
    soulColor?: number;
    /** Max intensity boost multiplier for soul ambience (default 0.35) */
    maxSoulBoost?: number;
    /** Extra particles added per collected soul (default 12) */
    particlesPerSoul?: number;
    /** Fog density multiplier during Rain/Fog/Snow weather (default 1.0) */
    fogDensityBoost?: number;
  };
}

export interface LocationData {
  id: string;
  name: { zh: string; en: string };
  country: string;
  desc: string;
  bgColor: number;
  particleType: string;
  particleColor: number;
  lightColor: number;
  ambientColor: number;
  ambientIntensity: number;
  weatherPool: Weather[];
  innateModifiers?: Partial<Record<string, number>>;
  /** REF-4: per-location art theme — lights, fog, water, UI */
  theme?: LocationTheme;
}

// ===== Save =====
export interface UserSettings {
  alwaysOnTop: boolean;
  uiScale: number; // body zoom: 1.0, 1.25, 1.3, 1.5
  windowX?: number;
  windowY?: number;
  autoHideHUD: boolean;
  notificationMode: 'subtle' | 'normal' | 'flash';
  language: 'zh' | 'en';
  volume: { master: number; sfx: number; ambient: number };
}

export interface SaveData {
  version: number;
  timestamp: number;
  gameState: GameState;
  settings: UserSettings;
}

// ===== Game State (top-level) =====
export interface GameState {
  phase: GamePhase;
  player: PlayerState;
  gear: GearState;
  run: RunState | null;
  meta: MetaState;
  fishpedia: Record<string, FishpediaEntry>;
  unlockedLocations: string[];
  stats: PlayerStats;
  dailies: DailyState;
}

// ===== Inventory =====
export interface InventoryState {
  baits: Record<string, number>;
  fishStorage: CaughtFish[];
}
