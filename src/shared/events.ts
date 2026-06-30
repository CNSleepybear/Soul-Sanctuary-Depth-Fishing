// ===== src/shared/events.ts =====
// Typed event map — compile-time safety for EventBus communication.

import type {
  SpiritFish,
  Modifier,
  Relic,
  RunEvent,
  RunRewards,
  SaveData,
  FishpediaEntry,
} from './types';
import type { CatchQuality } from './enums';

export interface GameEventMap {
  // ===== Fishing Lifecycle =====
  'fishing:cast_start': {};
  'fishing:cast': { power: number; bait: string };
  'fishing:nibble': { fish: SpiritFish };
  'fishing:probe_escape': { fish: SpiritFish };
  'fishing:bite': { fish: SpiritFish; hookWindowMs?: number };
  'fishing:hook_set': { fish: SpiritFish; lateHook?: boolean };
  'fishing:reel_update': {
    tension: number;
    fishProgress: number;
    lineDurability: number;
    fish: SpiritFish;
  };
  'fishing:catch': {
    fish: SpiritFish;
    size: number;
    quality: CatchQuality;
    gold: number;
    isSpiritVariant: boolean;
  };
  'fishing:escape': { fish: SpiritFish | null; reason: string };
  'fishing:line_break': { reason: string };
  'fishing:burst': { active: boolean; intensity?: number; fishName?: string };
  'fishing:idle': {};

  // ===== Run Lifecycle =====
  'run:start': { locationId: string; seed: number };
  'run:event': { event: RunEvent; choices?: string[] };
  'run:cast_consumed': { remaining: number };
  'run:modifier_added': { modifier: Modifier; source?: string };
  'run:modifier_removed': { modifierId: string };
  'run:end': { reason: 'depleted' | 'line_break' | 'voluntary'; rewards: RunRewards };
  'run:voluntary_end': {};

  // ===== Relic =====
  'relic:discovered': { relic: Relic };
  'relic:equipped': { relicId: string };
  'relic:unequipped': { relicId: string };

  // ===== Daily =====
  'daily:refresh': { hotspot: string; streak: number };
  'daily:streak_reward': { days: number; gold: number; essence: number };
  'daily:quest_completed': { questId: string; gold: number; essence: number };
  'daily:free_bait_claimed': { baitId: string; amount: number };

  // ===== Game State (emitted by GameManager after mutation) =====
  'game:gold_change': { amount: number; delta: number; source: string };
  'game:essence_change': { amount: number; source: string };
  'game:xp_gain': { xp: number; gained: number; leveledUp: boolean };
  'game:level_up': { newLevel: number; unlocks: string[] };
  'game:location_change': { locationId: string };
  'game:phase_change': { phase: string };
  'game:save': { slot: number };
  'game:load': { slot: number; data: SaveData };
  'game:fishpedia_update': {
    entry: Partial<FishpediaEntry> & { fishId: string; isNewDiscovery?: boolean };
  };
  'game:fishpedia_count_update': { count: number };
  'game:mythic_caught': { fishId: string; locationId: string; isNewDiscovery: boolean };
  'game:story_fragment_unlocked': { fishId: string; fragmentIndex: number; isNew: boolean };

  // ===== Input (from InputManager) =====
  'input:down': { timestamp: number };
  'input:up': { holdDuration: number };
  'input:hold': { duration: number };
  'input:shortcut': { key: string };

  // ===== Window (from Electron main process via preload) =====
  'window:focus': {};
  'window:blur': {};
  'window:minimize': {};
  'window:restore': {};
  'window:always_on_top': { enabled: boolean };
  'window:shortcut': { key: string };
  'window:request_save': {};

  // ===== UI =====
  'ui:show_notification': { message: string; type: 'info' | 'success' | 'rare' | 'error' };
  'ui:show_modal': { modalId: string };
  'ui:hide_modal': {};
  'ui:toggle_souls': {};
  'ui:show_catch_feedback': {
    fish: SpiritFish;
    size: number;
    quality: CatchQuality;
    gold: number;
    isSpiritVariant: boolean;
    isNewDiscovery: boolean;
    fishpediaCount: number;
    totalCatches: number;
  };
}

// Helper: typed event name constants
export const GameEvents = {
  FISHING_CAST_START: 'fishing:cast_start',
  FISHING_CAST: 'fishing:cast',
  FISHING_NIBBLE: 'fishing:nibble',
  FISHING_PROBE_ESCAPE: 'fishing:probe_escape',
  FISHING_BITE: 'fishing:bite',
  FISHING_HOOK_SET: 'fishing:hook_set',
  FISHING_REEL_UPDATE: 'fishing:reel_update',
  FISHING_CATCH: 'fishing:catch',
  FISHING_ESCAPE: 'fishing:escape',
  FISHING_LINE_BREAK: 'fishing:line_break',
  FISHING_BURST: 'fishing:burst',
  FISHING_IDLE: 'fishing:idle',

  RUN_START: 'run:start',
  RUN_EVENT: 'run:event',
  RUN_CAST_CONSUMED: 'run:cast_consumed',
  RUN_MODIFIER_ADDED: 'run:modifier_added',
  RUN_MODIFIER_REMOVED: 'run:modifier_removed',
  RUN_END: 'run:end',
  RUN_VOLUNTARY_END: 'run:voluntary_end',

  RELIC_DISCOVERED: 'relic:discovered',
  RELIC_EQUIPPED: 'relic:equipped',
  RELIC_UNEQUIPPED: 'relic:unequipped',

  DAILY_REFRESH: 'daily:refresh',
  DAILY_STREAK_REWARD: 'daily:streak_reward',
  DAILY_QUEST_COMPLETED: 'daily:quest_completed',
  DAILY_FREE_BAIT_CLAIMED: 'daily:free_bait_claimed',

  GAME_GOLD_CHANGE: 'game:gold_change',
  GAME_ESSENCE_CHANGE: 'game:essence_change',
  GAME_XP_GAIN: 'game:xp_gain',
  GAME_LEVEL_UP: 'game:level_up',
  GAME_LOCATION_CHANGE: 'game:location_change',
  GAME_PHASE_CHANGE: 'game:phase_change',
  GAME_SAVE: 'game:save',
  GAME_LOAD: 'game:load',
  GAME_FISHPEDIA_UPDATE: 'game:fishpedia_update',
  GAME_FISHPEDIA_COUNT_UPDATE: 'game:fishpedia_count_update',
  GAME_MYTHIC_CAUGHT: 'game:mythic_caught',
  GAME_STORY_FRAGMENT_UNLOCKED: 'game:story_fragment_unlocked',

  INPUT_DOWN: 'input:down',
  INPUT_UP: 'input:up',
  INPUT_HOLD: 'input:hold',
  INPUT_SHORTCUT: 'input:shortcut',

  WINDOW_FOCUS: 'window:focus',
  WINDOW_BLUR: 'window:blur',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_RESTORE: 'window:restore',
  WINDOW_ALWAYS_ON_TOP: 'window:always_on_top',
  WINDOW_SHORTCUT: 'window:shortcut',
  WINDOW_REQUEST_SAVE: 'window:request_save',

  UI_SHOW_NOTIFICATION: 'ui:show_notification',
  UI_SHOW_MODAL: 'ui:show_modal',
  UI_HIDE_MODAL: 'ui:hide_modal',
  UI_TOGGLE_SOULS: 'ui:toggle_souls',
  UI_SHOW_CATCH_FEEDBACK: 'ui:show_catch_feedback',
} as const;

export type GameEventName = keyof GameEventMap;
