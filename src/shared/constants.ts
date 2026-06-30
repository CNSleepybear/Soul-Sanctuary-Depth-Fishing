// ===== src/shared/constants.ts =====
// Shared constants — version, limits, rendering dimensions.

export const APP_VERSION = '0.1.0';

// Rendering
export const RENDER_WIDTH = 400;
export const RENDER_HEIGHT = 300;
export const RENDER_ASPECT = RENDER_WIDTH / RENDER_HEIGHT; // 4:3

// Resolution presets — window and render size sync, pixel-perfect
export const RESOLUTION_PRESETS: { w: number; h: number; label: string }[] = [
  { w: 400, h: 300, label: 'Compact (400x300)' },
  { w: 560, h: 420, label: 'Standard (560x420)' },
  { w: 640, h: 480, label: 'Large (640x480)' },
];

// Window
export const WINDOW_MIN_WIDTH = 300;
export const WINDOW_MIN_HEIGHT = 225;
export const WINDOW_DEFAULT_WIDTH = 480;
export const WINDOW_DEFAULT_HEIGHT = 360;
export const WINDOW_MAX_WIDTH = 800;
export const WINDOW_MAX_HEIGHT = 600;

// Save
export const SAVE_SLOTS = 3;
export const SAVE_KEY_PREFIX = 'soulsanctuary_save_';
export const AUTO_SAVE_INTERVAL_SEC = 60;

// Fishing balance (defaults, can be overridden by modifiers)
export const BALANCE = {
  tensionReelRate: 10, // tension increase/sec when reeling
  tensionSlackRate: 22, // tension decrease/sec when slacking (fast dump)
  lineWearRate: 3, // durability loss/sec in red zone (>70%)
  fishProgressRate: 12, // base progress per second
  progressGreenMult: 1.3, // multiplier in green zone (0-50%)
  progressYellowMult: 0.75, // multiplier in yellow zone (50-70%)
  progressRedMult: 0.25, // multiplier in red zone (70-100%)
  tensionGreenMax: 50,
  tensionYellowMax: 70,
  tensionMax: 100,
  castMaxDuration: 2.0, // seconds to reach max power
  castOvershootThreshold: 0.9, // >90% = line snap risk
  hookWindowBase: 1.2, // seconds to react to bite
  hookWindowMin: 0.6, // minimum hook window (legendary fish)
  hookWindowMax: 2.0, // maximum hook window (common fish)
  waitDurationMin: 2, // minimum wait time (seconds)
  waitDurationMax: 10, // maximum wait time (seconds)
  spiritVariantChance: 0.02, // 2%
  trophySizeThreshold: 0.95, // >95% of max size = trophy
  // Hook system V2
  nibbleDuration: 0.6, // seconds before hook roll in nibble phase
  baitLostDuration: 1.5, // seconds before return to idle after probe escape
  biteRollIntervalMin: 2.0, // minimum seconds between bite rolls during waiting
  biteRollIntervalMax: 5.0, // maximum seconds between bite rolls
  // Slack-line burst (Rare+ fish)
  slackLineBurst: {
    rare: { threshold: 90, timeToBurst: 2.0, damage: 30 },
    legendary: { threshold: 85, timeToBurst: 1.5, damage: 35 },
    mythic: { threshold: 80, timeToBurst: 1.0, damage: 40 },
  },
  castDepthMult: 1.0, // base cast depth multiplier
} as const;

/** Numeric keys of BALANCE that can be modified by charms/events. */
export type BalanceKey = {
  [K in keyof typeof BALANCE]: (typeof BALANCE)[K] extends number ? K : never;
}[keyof typeof BALANCE];

// Bait definitions and effects
export interface BaitDef {
  id: string;
  name: { zh: string; en: string };
  cost: number;
  rareBonus: number; // additive percentage to rare+ weights
  waitReduction: number; // seconds reduced from wait time
  hookWindowBonus: number; // seconds added to hook window
}

export const BAITS: BaitDef[] = [
  {
    id: 'bait_worm',
    name: { zh: '蚯蚓', en: 'Earthworm' },
    cost: 0,
    rareBonus: 0,
    waitReduction: 0,
    hookWindowBonus: 0,
  },
  {
    id: 'bait_bread',
    name: { zh: '面包', en: 'Bread' },
    cost: 10,
    rareBonus: 5,
    waitReduction: 1,
    hookWindowBonus: 0.1,
  },
  {
    id: 'bait_shrimp',
    name: { zh: '虾饵', en: 'Shrimp' },
    cost: 25,
    rareBonus: 15,
    waitReduction: 2,
    hookWindowBonus: 0.2,
  },
  {
    id: 'bait_lure_spoon',
    name: { zh: '亮片假饵', en: 'Spoon Lure' },
    cost: 50,
    rareBonus: 25,
    waitReduction: 3,
    hookWindowBonus: 0.15,
  },
  {
    id: 'bait_spirit_paste',
    name: { zh: '灵饵', en: 'Spirit Paste' },
    cost: 75,
    rareBonus: 40,
    waitReduction: 4,
    hookWindowBonus: 0.3,
  },
];

// Run
export const RUN_BASE_CASTS = 16;
export const RUN_BASE_LINE_DURABILITY = 100;
export const RUN_EVENT_CHANCE = 0.3; // 30% per cast
export const DEFAULT_CHARM_SLOTS = 3;
export const DEFAULT_RELIC_SLOTS = 0;

// DAILY-1: Feature flag — daily system enabled for desktop
// Enables daily quests, login streaks, hotspot rotation, and free bait
export const DAILY_ENABLED = true;

// Progression
export const MAX_LEVEL = 50;
export const MAX_FISH_STORAGE = 50;

// Time windows (hours)
export const TIME_WINDOWS = {
  dawn: { start: 5, end: 8 },
  day: { start: 8, end: 17 },
  dusk: { start: 17, end: 20 },
  night: { start: 20, end: 5 }, // wraps around midnight
} as const;
