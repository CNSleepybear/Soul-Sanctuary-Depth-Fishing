// ===== src/shared/enums.ts =====
// Shared enumerations used across the entire codebase.

export enum FishRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Legendary = 'legendary',
  Mythic = 'mythic',
}

export enum FishBehavior {
  Steady = 'steady',
  Sprint = 'sprint',
  Lazy = 'lazy',
  Zigzag = 'zigzag',
  DeepDiver = 'deep_diver',
  SurfaceJumper = 'surface_jumper',
}

export enum CatchQuality {
  Perfect = 'perfect',
  Standard = 'standard',
  Struggle = 'struggle',
}

export enum FishingState {
  Idle = 'idle',
  Casting = 'casting',
  Waiting = 'waiting',
  Hooking = 'hooking',
  Reeling = 'reeling',
  Nibble = 'nibble',
  ProbeEscape = 'probe_escape',
  Catch = 'catch',
  Escape = 'escape',
}

export enum GamePhase {
  Menu = 'menu',
  RunPrep = 'run_prep',
  Fishing = 'fishing',
  CatchResult = 'catch_result',
  RunResult = 'run_result',
}

export enum TimeWindow {
  Dawn = 'dawn',
  Day = 'day',
  Dusk = 'dusk',
  Night = 'night',
}

export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
}

export enum Weather {
  Clear = 'clear',
  Rain = 'rain',
  Fog = 'fog',
  Snow = 'snow',
  Aurora = 'aurora',
}

export enum RunEndReason {
  Depleted = 'depleted',
  LineBreak = 'line_break',
  Voluntary = 'voluntary',
}

export enum ModifierRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Cursed = 'cursed',
}

export enum NotificationMode {
  Subtle = 'subtle',
  Normal = 'normal',
  Flash = 'flash',
}
