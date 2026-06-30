# 🎣 Soul Sanctuary: Depth Fishing — Architecture Design Record

> **Version**: 2.0 | **Date**: 2026-06-03 | **Status**: Re-Architecture
> **Stack**: TypeScript + Vite + Electron + Three.js
> **Target**: Steam (Desktop), "Desktop Widget" casual roguelike

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Desktop Widget UX Specification](#2-desktop-widget-ux-specification)
3. [Roguelike Core Mechanics](#3-roguelike-core-mechanics)
4. [Project Structure](#4-project-structure)
5. [Module Architecture](#5-module-architecture)
6. [Data Flow & State Management](#6-data-flow--state-management)
7. [Electron Integration](#7-electron-integration)
8. [Rendering Pipeline](#8-rendering-pipeline)
9. [Build & Modifier System](#9-build--modifier-system)
10. [Save & Persistence](#10-save--persistence)
11. [Error Handling & Graceful Degradation](#11-error-handling--graceful-degradation)

---

## 1. Design Philosophy

### 1.1 Core Tenets

| # | Tenet | Meaning |
|---|-------|---------|
| 1 | **Desktop First, Work Companion** | Small floating window. Never steals focus. Glanceable. One-hand operation. |
| 2 | **Roguelike Depth, Casual Surface** | Easy to start a run. Deep build synergies for those who dig. |
| 3 | **Art Style IS the Game** | 400×300 pixelated low-poly is not a limitation — it is the identity. Every pixel counts. |
| 4 | **Respect Player Time** | No FOMO punishment. No energy systems. Pause anytime. Runs are 5-15 min. |
| 5 | **Modular Modifiers** | All roguelike variety comes from composable, stackable Charms. Easy to add new ones. |

### 1.2 Player Persona

> A developer / designer / writer who wants a tiny, beautiful window in the corner of their screen. They cast a line between tasks. The 3D sanctuary breathes. A fish bites — they hold mouse button for 20 seconds of tension mini-game — then return to work. Over weeks, they unlock all 12 sanctuaries and collect 141 spirit fish.

---

## 2. Desktop Widget UX Specification

### 2.1 Window Specification

```
┌─────────────────────────────────┐
│  SOUL SANCTUARY     —  □  ✕    │  ← Custom title bar (4px draggable, always clickable)
│                                 │
│   ┌─────────────────────────┐   │
│   │                         │   │
│   │   400×300 3D Canvas     │   │  ← Pixelated low-poly scene
│   │   (nearest-neighbor     │   │     (idle: click-through)
│   │    upscaled to window)  │   │
│   │                         │   │
│   │     🎣 [BOBBER]        │   │
│   │                         │   │
│   └─────────────────────────┘   │
│                                 │
│  🪙 1,250  ✨ 45   Lv.12        │  ← Status bar (auto-hide)
│  [ Ctrl+Shift+F to cast     ]  │  ← Idle hint
└─────────────────────────────────┘
```

| Property | Value | Notes |
|----------|-------|-------|
| Base resolution | 400×300 (internal) | Upscaled integer-multiple by CSS |
| Min window size | 300×225 | 0.75× scale |
| Default window size | 480×360 | 1.2× scale, compact |
| Max window size | 800×600 | 2.0× scale |
| Frame | Frameless + custom 4px title bar | Electron `frame: false` |
| Always on top | Optional (toggle) | `win.setAlwaysOnTop(true)` |
| Click-through (idle) | Canvas area: `setIgnoreMouseEvents(true, { forward: true })`; Title bar: always clickable | Enables drag, min/max/close |
| Tray icon | Yes, with quick actions | "Start Fishing", "Change Location", "Always on Top", "Quit" |
| Global shortcut | `Ctrl+Shift+F` | Toggle between idle ↔ cast mode |
| Startup | Optional: launch on system start | Electron `auto-launch` |
| Position memory | Persisted to settings | `win.getPosition()` on move, restore on launch |

### 2.2 Interaction Modes

```
IDLE MODE (95% of time):
  ┌─────────────────────────┐
  │ Window: frameless        │
  │ Canvas: click-through    │
  │ Title bar: clickable     │
  │                          │
  │ Scene: auto-cruise       │
  │ camera orbits slowly     │
  │ Ambient particles play   │
  │                          │
  │ Status bar shows:        │
  │ "Ctrl+Shift+F to fish"   │
  └─────────────────────────┘

  → User presses Ctrl+Shift+F
     OR right-clicks tray → "Start Fishing"
  → Window becomes interactive
  → Enter CAST mode

CAST MODE:
  ┌─────────────────────────┐
  │ Canvas: click-through    │
  │   disabled               │
  │                          │
  │ Cast power meter shows   │
  │ User holds & releases    │
  │ Bobber flies to water    │
  └─────────────────────────┘

  → Enter WAIT mode

WAIT MODE:
  ┌─────────────────────────┐
  │ Canvas: receives clicks  │
  │ (for twitch & hook)     │
  │                          │
  │ Bobber bobs on water     │
  │ Nibble visual cues       │
  │ User can:                │
  │  - Click to twitch line  │
  │  - Wait for bite         │
  │  - Ignore & work         │
  │                          │
  │ If bite:                 │
  │  - Window FLASHES        │
  │  - Tray notification     │
  │  - Audio ping            │
  └─────────────────────────┘

  → User clicks during hook window (0.8–2.0s)
  → Enter REEL mode

REEL MODE:
  ┌─────────────────────────┐
  │ Canvas: fully interactive│
  │                          │
  │ Tension bar visible      │
  │ Fish silhouette          │
  │ Hold = reel, release =   │
  │ slack                    │
  │                          │
  │ 10-30 second mini-game   │
  └─────────────────────────┘

  → Catch or escape
  → Return to IDLE mode (canvas reverts to click-through)

WINDOW STATE TRANSITIONS:

  IDLE ◄──────────────────────────────┐
    │ (Ctrl+Shift+F / tray "Fish")    │
    ▼                                 │
  CAST ──(cast released)──▶ WAIT     │
                              │       │
                 (bite!)      ▼       │
                            HOOK ─────┤ (missed window)
                              │       │
                 (click!)     ▼       │
                            REEL ─────┤ (escape/line break)
                              │       │
                 (catch!)     ▼       │
                            CATCH ────┘ (auto-return after animation)
```

### 2.3 Notification System

When the game needs the player's attention (fish bites, daily refresh):

| Priority | Method | Use Case |
|----------|--------|----------|
| **Low** | Bobber animation change | Nibble |
| **Medium** | Window border glow (CSS `box-shadow` on `body`) | Rare fish approaching |
| **High** | Window flash (`win.flashFrame(true)`) + system notification | Fish hooked! |
| **Critical** | System tray balloon (`tray.displayBalloon()`) | Mythic fish detected |

---

## 3. Roguelike Core Mechanics

### 3.1 Run Lifecycle

```
┌─────────────────────────────────────────────────────┐
│                    RUN LIFECYCLE                      │
│                                                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐        │
│  │  PREP    │───▶│  FISHING │───▶│  RESULT  │        │
│  │  (Camp)  │    │  (Run)   │    │  (Reward)│        │
│  └──────────┘    └──────────┘    └──────────┘        │
│       │               │               │              │
│       ▼               ▼               ▼              │
│  Choose:          Cast × N        Earn:              │
│  - Location       Random events   - Gold             │
│  - Rod            Modifiers       - Essence          │
│  - Line           accumulate      - Tokens           │
│  - 3 Charms       Fish pool       - XP               │
│  - Bait           evolves         - New charms       │
│                                                       │
│  Meta-progression: spend earnings on permanent        │
│  upgrades → stronger next run                         │
└─────────────────────────────────────────────────────┘
```

### 3.2 Run Definition

A "run" = one fishing expedition at one sanctuary.

| Parameter | Default | Description |
|-----------|---------|-------------|
| Casts per run | 12-20 | Varies by rod tier + charms |
| Line durability | 100% | Shared across all casts in run; 0 = run ends |
| Random events | 3-6 per run | Triggered between casts or on specific conditions |
| Run Charms | 3 (equipped at prep) | Active only during this run |
| Relics | 0 initially, earned via events | Permanent, equipped before run (occupy Relic slots) |
| Fish pool | Location default | Modified by time, weather, charms |

**Run ends when**:
1. Casts depleted (`castsRemaining === 0`)
2. Line breaks (`lineDurability <= 0`)
3. **Player voluntarily ends run** ("Head Home" action — keeps all rewards earned so far)

Voluntary ending is a strategic choice: cash out safely or risk more casts for better rewards.

### 3.3 Charm & Relic System

Two distinct modifier categories:

| Category | Lifetime | Source | Slots |
|----------|----------|--------|-------|
| **Run Charms** | This run only | Picked at Prep phase (3), gained from events | 3 → 6 (meta upgrade) |
| **Relics** | Permanent (cross-run) | Rare event rewards (Ancient Relic, etc.) | 0 → 3 (meta upgrade) |

```typescript
// Relics are a subset of Modifier with additional constraints
interface Relic extends Modifier {
  relicId: string;           // Unique permanent identifier
  unlockCondition: string;   // How it was earned (event name, achievement)
  isEquipped: boolean;       // Player can toggle in Camp
}
```

Relics are discovered through rare events during runs. Once earned, they appear in the Camp "Relic Collection" and can be equipped before future runs. Unlike Run Charms which are random each Prep, Relics are a curated collection the player builds over time.

### 3.4 Random Events (During Run)

After each cast, ~30% chance of an event:

| Event | Effect | Choices |
|-------|--------|---------|
| **Spirit Blessing** | Next fish is +1 rarity tier | — |
| **Storm Front** | All fish pull 30% harder for 3 casts | Endure / Spend essence to dispel |
| **Mysterious Driftwood** | Contains a random Run Charm (this run only) | Take / Ignore |
| **Fish Frenzy** | 2× fish spawn rate for 5 casts | — |
| **Tangled Line** | -20% line durability | Cut line (lose bait) / Carefully untangle (waste 2 casts) |
| **Whispering Depths** | Reveal next fish's species before cast | — |
| **Poacher's Net** | Lose 1 random Run Charm this run | — |
| **Moonlit Surface** | Spirit Variant chance +10% for 3 casts | — |
| **Ancient Relic** | Discover a new permanent Relic (once per relic type) | — |
| **Shadow in the Deep** | Guaranteed legendary/mythic fish next cast, but 2× line wear | Risk it / Pass |

### 3.5 Between-Run Meta Progression

```
PERMANENT UPGRADES (purchased with Gold + Essence):

🏕️ CAMP UPGRADES:
├── Charm Slots: 3 → 4 → 5 → 6 (more Run Charms per run)
├── Relic Slots: 0 → 1 → 2 → 3 (equip permanent Relics)
├── Charm Rerolls: 1 → 2 → 3 (reroll charm choices before run)
├── Bait Pouch: carry 2 → 3 → 4 bait types per run
├── Line Resilience: +10% / +20% / +30% base durability
└── Lucky Start: begin each run with 1 random temporary Run Charm

🎣 GEAR UPGRADES (permanent, not per-run):
├── Rods: Bamboo → Oak → Steel → Crystal → Soul
├── Lines: Cotton → Silk → Braided → Spirit
└── Baits: unlock new types permanently

🌍 LOCATION UNLOCKS:
├── Start: Kyoto (Japan)
├── Level 3: Iceland
├── Level 5: Thailand
├── ... (12 total, spread across levels 1-50)
```

### 3.5 Difficulty & Run Variety

Instead of explicit difficulty levels, variety comes from:

1. **Location modifiers**: Each sanctuary has innate properties (e.g., Iceland: fish pull 15% harder, but +20% gold)
2. **Daily conditions**: One location gets "Hotspot" (+rare%), another gets "Unstable" (random events x2)
3. **Charm synergies**: Players discover charm combinations that create emergent builds (e.g., "Iron Will" + "Deep Breath" = red zone acts like yellow zone)
4. **Run seed**: Deterministic RNG seed for each run (shareable, for community challenges)

---

## 4. Project Structure

```
SoulSanctuary/
├── package.json                  # Vite + Electron + Three.js deps
├── tsconfig.json                 # Strict TypeScript config
├── vite.config.ts                # Vite + Electron plugin config
├── electron-builder.yml          # Electron packaging for Steam
├── index.html                    # Entry HTML (minimal, Vite handles)
│
├── src/
│   ├── main/                     # ===== ELECTRON MAIN PROCESS =====
│   │   ├── index.ts              # App entry: createWindow, tray, IPC
│   │   ├── window-manager.ts     # Window creation, sizing, focus policies
│   │   ├── tray-manager.ts       # System tray icon + context menu
│   │   ├── ipc-handlers.ts       # IPC channel handlers (save, settings)
│   │   ├── auto-launcher.ts      # Auto-start with OS
│   │   └── preload.ts            # Context bridge (secure IPC)
│   │
│   ├── renderer/                 # ===== RENDERER (GAME) =====
│   │   ├── index.ts              # Bootstrap: init all systems
│   │   │
│   │   ├── core/                 # Foundation layer
│   │   │   ├── EventBus.ts       # Typed pub/sub (generic events)
│   │   │   ├── GameLoop.ts       # requestAnimationFrame manager
│   │   │   ├── RNG.ts            # Seeded PRNG (mulberry32)
│   │   │   ├── StateMachine.ts   # Generic FSM (used by fishing, UI, run)
│   │   │   └── ObjectPool.ts     # Pool frequently created objects
│   │   │
│   │   ├── systems/              # Game logic systems
│   │   │   ├── FishingSystem.ts  # Core state machine: idle→cast→wait→hook→reel→catch
│   │   │   ├── RunManager.ts     # Roguelike run lifecycle
│   │   │   ├── EventDeck.ts      # Random event deck (draw, shuffle, trigger)
│   │   │   ├── ModifierEngine.ts # Stackable modifier resolver
│   │   │   ├── FishSpawner.ts    # Weighted RNG fish spawning
│   │   │   ├── DailySystem.ts    # Daily refresh, quests, streaks
│   │   │   ├── ShopSystem.ts     # Purchasing, inventory, upgrades
│   │   │   └── SaveManager.ts    # Persistence (localStorage + cloud optional)
│   │   │
│   │   ├── rendering/            # Three.js rendering
│   │   │   ├── Renderer.ts       # THREE.js setup, render loop
│   │   │   ├── Pipeline.ts       # 400×300 → CSS upscale pipeline
│   │   │   ├── CameraController.ts # Ortho camera, orbit, fishing angles
│   │   │   ├── WaterRenderer.ts  # Low-poly animated water plane
│   │   │   ├── BobberRenderer.ts # Bobber 3D object + animations
│   │   │   ├── FishRenderer.ts   # Procedural low-poly fish mesh gen
│   │   │   └── ParticleSystem.ts # Reusable particle emitter
│   │   │
│   │   ├── locations/            # 12 sanctuary scene builders
│   │   │   ├── LocationManager.ts    # Location registry + switching
│   │   │   ├── BaseLocation.ts       # Abstract location builder
│   │   │   ├── KyotoJapan.ts         # 🇯🇵 京都落樱 · 暮色神社
│   │   │   ├── ChinaBamboo.ts        # 🇨🇳 翠竹流萤 · 禅意水镜
│   │   │   ├── USANeon.ts            # 🇺🇸 赛博不夜 · 像素霓虹
│   │   │   ├── UKRain.ts             # 🇬🇧 雾都雨夜 · 泰晤士船坞
│   │   │   ├── FranceAutumn.ts       # 🇫🇷 枫丹落叶 · 塞纳左岸
│   │   │   ├── GermanySnow.ts        # 🇩🇪 黑林冬雪 · 秩序木屋
│   │   │   ├── ItalyVenice.ts        # 🇮🇹 威尼斯水巷 · 微醺摇曳
│   │   │   ├── DenmarkHygge.ts       # 🇩🇰 新港冬夜 · 炉火温存
│   │   │   ├── IcelandAurora.ts      # 🇮🇸 旷野极光 · 世界尽头
│   │   │   ├── ThailandRiver.ts      # 🇹🇭 湄南水灯 · 佛光普照
│   │   │   ├── EgyptDesert.ts        # 🇪🇬 帝王谷 · 金字塔与绿洲
│   │   │   └── GreeceSantorini.ts    # 🇬🇷 圣托里尼 · 爱琴海风车
│   │   │
│   │   ├── data/                 # Static configuration
│   │   │   ├── fish-database.ts  # All 141 fish definitions
│   │   │   ├── gear-database.ts  # Rods, lines, baits
│   │   │   ├── charm-database.ts # All roguelike charms/modifiers
│   │   │   ├── event-database.ts # Random event definitions
│   │   │   ├── location-data.ts  # Station metadata
│   │   │   └── balance.ts        # Tuning constants (tension rates, gold, etc.)
│   │   │
│   │   ├── ui/                   # DOM-based UI layer
│   │   │   ├── UIManager.ts      # UI state, show/hide, transitions
│   │   │   ├── HUD.ts            # Top bar (gold, level, location)
│   │   │   ├── TensionBar.ts     # Tension gauge with color zones
│   │   │   ├── CastPowerBar.ts   # Cast power meter
│   │   │   ├── HookIndicator.ts  # Hook timing ring
│   │   │   ├── CatchResult.ts    # Post-catch popup
│   │   │   ├── RunPrepModal.ts   # Pre-run charm selection
│   │   │   ├── FishpediaModal.ts # Collection viewer
│   │   │   ├── ShopModal.ts      # Gear + upgrade shop
│   │   │   ├── Notification.ts   # Toast notification system
│   │   │   └── ContextMenu.ts    # Right-click menu
│   │   │
│   │   └── audio/                # Audio (Phase 2: imported assets)
│   │       └── AudioManager.ts   # Web Audio API playback
│   │
│   ├── shared/                   # ===== SHARED TYPES =====
│   │   ├── types.ts              # All interfaces & type definitions
│   │   ├── events.ts             # Event name constants + payload types
│   │   ├── enums.ts              # Shared enums (Rarity, Behavior, etc.)
│   │   └── constants.ts          # Shared constants (version, limits)
│   │
│   └── styles/                   # CSS
│       ├── main.css              # Global styles, CSS variables
│       ├── hud.css               # HUD overlay styles
│       ├── modals.css            # Modal dialog styles
│       └── animations.css        # Keyframe animations
│
├── assets/                       # Static assets
│   ├── icons/                    # App icon, tray icon, Steam assets
│   │   ├── icon.ico
│   │   ├── icon.png              # 256×256
│   │   └── tray-icon.png         # 16×16 / 32×32
│   └── audio/                    # Audio files (Phase 2)
│       └── (empty for now)
│
└── docs/
    ├── GDD.md
    ├── SDD.md
    ├── TDD.md
    ├── market-research.md
    └── architecture.md           # ← This file
```

---

## 5. Module Architecture

### 5.1 Dependency Graph

```
                    ┌──────────────────────┐
                    │     GameManager       │  ← Top-level orchestrator / state owner
                    │   (renderer/index.ts) │
                    └──────────┬───────────┘
                               │ owns & wires
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   EventBus    │◀───│   Systems     │───▶│   Renderer    │
│  (core/)      │    │  (systems/)   │    │ (rendering/)  │
└───────────────┘    └───────┬───────┘    └───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ FishingSystem │    │  RunManager   │    │ ModifierEngine│
└───────┬───────┘    └───────┬───────┘    └───────────────┘
        │                    │
        ▼                    ▼
┌───────────────┐    ┌───────────────┐
│ FishSpawner   │    │  EventDeck    │
└───────────────┘    └───────────────┘
        ▲
        │ reads
┌───────────────┐
│ InputManager  │  ← Unified input (mouse down/up/hold, keyboard shortcuts)
│  (core/)      │     Emits: input:down, input:up, input:hold, input:shortcut
└───────────────┘
```

### 5.2 Core Interfaces

```typescript
// ===== EventBus =====
// src/renderer/core/EventBus.ts

type EventHandler<T = any> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void;
  off<T>(event: string, handler: EventHandler<T>): void;
  emit<T>(event: string, payload: T): void;
  once<T>(event: string, handler: EventHandler<T>): () => void;
}

// ===== StateMachine =====
// src/renderer/core/StateMachine.ts

class StateMachine<S extends string, C> {
  private state: S;
  private transitions: Map<S, Partial<Record<S, (ctx: C) => boolean>>>;
  private onEnter: Partial<Record<S, (ctx: C) => void>>;
  private onExit: Partial<Record<S, (ctx: C) => void>>;

  constructor(initial: S);
  addTransition(from: S, to: S, guard?: (ctx: C) => boolean): this;
  onStateEnter(state: S, fn: (ctx: C) => void): this;
  onStateExit(state: S, fn: (ctx: C) => void): this;
  transition(to: S, ctx: C): boolean;
  get current(): S;
}

// ===== Modifier =====
// src/shared/types.ts

interface Modifier {
  id: string;
  name: string;
  description: string;
  icon: string;            // Emoji or icon key
  rarity: 'common' | 'uncommon' | 'rare' | 'cursed';
  stackable: boolean;      // Can have multiple copies?
  maxStacks: number;
  effects: ModifierEffect[];
  tags: string[];          // For synergy detection (e.g., 'fire', 'spirit', 'deep')
}

type ModifierEffect =
  | { type: 'stat_mult'; stat: string; multiplier: number }
  | { type: 'stat_add'; stat: string; value: number }
  | { type: 'condition'; condition: string; then: ModifierEffect[] }
  | { type: 'trigger'; on: string; action: ModifierEffect[] }
  | { type: 'tag_add'; tag: string };

// Example charm:
const MAGNETIC_HOOK: Modifier = {
  id: 'magnetic_hook',
  name: 'Magnetic Hook',
  description: '+15% rare fish chance, but tension rises 20% faster',
  icon: '🧲',
  rarity: 'uncommon',
  stackable: true,
  maxStacks: 3,
  effects: [
    { type: 'stat_mult', stat: 'rareChance', multiplier: 1.15 },
    { type: 'stat_mult', stat: 'tensionRate', multiplier: 1.20 },
  ],
  tags: ['metal', 'risk'],
};

// ===== ModifierEngine =====
// src/renderer/systems/ModifierEngine.ts

class ModifierEngine {
  private activeModifiers: Modifier[] = [];

  addModifier(mod: Modifier): void;
  removeModifier(modId: string): void;
  clear(): void;
  getModifiers(): ReadonlyArray<Modifier>;
  hasTag(tag: string): boolean;
  countTag(tag: string): number;

  // Resolve all active modifiers for a stat
  resolve(stat: string, baseValue: number): number;
  // Check if a condition is met by any modifier
  checkCondition(condition: string): boolean;
  // Fire triggers
  fireTrigger(on: string, context: Record<string, number>): ModifierEffect[];
}
```

### 5.3 System Registration Pattern

Each game system follows a consistent lifecycle:

```typescript
// src/renderer/systems/FishingSystem.ts

interface GameSystem {
  /** Called once after all systems constructed, before first frame */
  init(): void;
  /** Called every frame with delta time (seconds) */
  update(dt: number): void;
  /** Called when game is being paused/minimized */
  suspend(): void;
  /** Called when game resumes from pause/minimize */
  resume(): void;
  /** Called before app quit (cleanup) */
  destroy(): void;
}

class FishingSystem implements GameSystem {
  constructor(
    private eventBus: EventBus,
    private fishSpawner: FishSpawner,
    private modifierEngine: ModifierEngine,
  ) {}

  init(): void { /* subscribe to events */ }
  update(dt: number): void { /* tick state machine */ }
  suspend(): void { /* cancel current cast */ }
  resume(): void { /* no-op */ }
  destroy(): void { /* unsubscribe */ }
}
```

---

## 6. Data Flow & State Management

### 6.1 State Mutation Pattern

`GameState` is owned exclusively by `GameManager`. Systems **never** mutate it directly. Instead:

1. Systems emit events with change requests (e.g., `GAME_GOLD_CHANGE` with `{ delta: 50, source: 'catch' }`)
2. `GameManager` listens, validates, applies mutations, then emits confirmation events
3. UI listens to confirmation events and reads latest state via `GameManager.getState()`

```typescript
// src/renderer/core/GameManager.ts (simplified)

class GameManager {
  private state: GameState;

  constructor() {
    this.eventBus.on('fishing:catch', (data) => {
      const gold = calculateGold(data.fish, data.quality, data.isSpiritVariant);
      // Single mutation point
      this.state.player.gold += gold;
      this.state.fishpedia[data.fish.id] = updateFishpedia(data);
      this.state.stats.totalCatches++;
      
      // Notify UI
      this.eventBus.emit('game:gold_change', { amount: this.state.player.gold, delta: gold });
      this.eventBus.emit('game:fishpedia_update', { entry: this.state.fishpedia[data.fish.id] });
    });
  }

  getState(): Readonly<GameState> { return this.state; }
}
```

### 6.2 GameState Schema

```typescript
interface GameState {
  phase: 'menu' | 'run_prep' | 'fishing' | 'catch_result' | 'run_result';
  
  player: {
    name: string;
    level: number;
    xp: number;
    gold: number;
    spiritEssence: number;
    sanctuaryTokens: number;
  };
  
  gear: {
    equippedRodId: string;
    equippedLineId: string;
    ownedRods: string[];
    ownedLines: string[];
    ownedBaitIds: string[];
    equippedRelicIds: string[];     // Equipped permanent Relics (0–3)
    ownedRelicIds: string[];        // All discovered Relics
  };
  
  run: {
    active: boolean;
    seed: number;
    locationId: string;
    castsRemaining: number;
    lineDurability: number;
    activeCharms: Modifier[];       // Run-only charms
    eventsTriggered: string[];
    fishCaughtThisRun: CaughtFish[];
    canEndVoluntarily: boolean;     // Player can "Head Home" after first catch
  } | null;
  
  meta: {
    charmSlots: number;             // 3 → 6
    relicSlots: number;             // 0 → 3
    charmRerolls: number;           // 1 → 3
    baitPouchSize: number;          // 2 → 4
    baseLineDurability: number;     // 100 → 130
  };
  
  fishpedia: Record<string, FishpediaEntry>;
  unlockedLocations: string[];
  stats: PlayerStats;
  dailies: DailyState;
}
```

### 6.3 Typed Event Map

All event names are mapped to their payload types for compile-time safety:

```typescript
// src/shared/events.ts

export interface GameEventMap {
  // Fishing lifecycle
  'fishing:cast_start':   {};
  'fishing:cast':          { power: number; bait: string };
  'fishing:nibble':        {};
  'fishing:bite':          { fish: SpiritFish };
  'fishing:hook_set':      { fish: SpiritFish };
  'fishing:reel_update':   { tension: number; fishProgress: number; lineDurability: number; fish: SpiritFish };
  'fishing:catch':         { fish: SpiritFish; size: number; quality: CatchQuality; gold: number; isSpiritVariant: boolean };
  'fishing:escape':        { fish: SpiritFish | null; reason: string };
  'fishing:line_break':    { reason: string };
  'fishing:idle':          {};

  // Run lifecycle
  'run:start':             { locationId: string; seed: number };
  'run:event':             { event: RunEvent; choices?: string[] };
  'run:cast_consumed':     { remaining: number };
  'run:modifier_added':    { modifier: Modifier };
  'run:modifier_removed':  { modifierId: string };
  'run:end':               { reason: 'depleted' | 'line_break' | 'voluntary'; rewards: RunRewards };
  'run:voluntary_end':     {};  // Player requests early end

  // Game state (emitted by GameManager after mutation)
  'game:gold_change':      { amount: number; delta: number; source: string };
  'game:xp_gain':          { xp: number; gained: number; leveledUp: boolean };
  'game:level_up':         { newLevel: number; unlocks: string[] };
  'game:location_change':  { locationId: string };
  'game:save':             { slot: number };
  'game:load':             { slot: number; data: SaveData };

  // Input (from InputManager)
  'input:down':            { timestamp: number };
  'input:up':              { holdDuration: number };
  'input:hold':            { duration: number };
  'input:shortcut':        { key: string };

  // Window (from Electron main process via preload)
  'window:focus':          {};
  'window:blur':           {};
  'window:minimize':       {};
  'window:restore':        {};
  'window:always_on_top':  { enabled: boolean };
}

// Typed EventBus usage:
// eventBus.emit<GameEventMap['fishing:catch']>('fishing:catch', { fish, size, quality, gold, isSpiritVariant });

export const GameEvents: Record<keyof GameEventMap, keyof GameEventMap> = {
  FISHING_CAST_START:   'fishing:cast_start',
  FISHING_CAST:         'fishing:cast',
  // ... etc
} as const;
```

---

## 7. Electron Integration

### 7.1 Main Process Architecture

```typescript
// src/main/index.ts

import { app, BrowserWindow, Tray, ipcMain } from 'electron';
import { WindowManager } from './window-manager';
import { TrayManager } from './tray-manager';
import { registerIpcHandlers } from './ipc-handlers';

let windowManager: WindowManager;
let trayManager: TrayManager;

app.whenReady().then(() => {
  windowManager = new WindowManager();
  trayManager = new TrayManager(windowManager);
  registerIpcHandlers(windowManager);
});

app.on('window-all-closed', (event) => {
  event.preventDefault();  // Never quit — minimize to tray instead
});

app.on('before-quit', () => {
  windowManager?.requestSave();  // Save before actual quit
});

// src/main/window-manager.ts

class WindowManager {
  private win: BrowserWindow | null = null;
  private lastPosition: { x: number; y: number } | null = null;

  createWindow(): BrowserWindow {
    const savedBounds = this.loadWindowBounds();

    this.win = new BrowserWindow({
      width: savedBounds?.width ?? 480,
      height: savedBounds?.height ?? 360,
      x: savedBounds?.x, y: savedBounds?.y,
      minWidth: 300, minHeight: 225,
      maxWidth: 800, maxHeight: 600,
      frame: false,
      transparent: false,
      alwaysOnTop: false,
      skipTaskbar: false,
      resizable: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.win.on('ready-to-show', () => this.win?.show());

    // Save window position on move for next launch
    this.win.on('moved', () => {
      const [x, y] = this.win!.getPosition();
      this.lastPosition = { x, y };
    });

    // Close button → hide to tray, don't quit
    this.win.on('close', (event) => {
      event.preventDefault();
      this.win?.hide();
    });

    return this.win;
  }

  /** Register Ctrl+Shift+F → toggle interactive fishing */
  registerGlobalShortcut(): void {
    const { globalShortcut } = require('electron');
    globalShortcut.register('CommandOrControl+Shift+F', () => {
      this.win?.webContents.send('window:shortcut', { key: 'toggle_fish' });
    });
  }

  setInteractive(interactive: boolean): void {
    if (!this.win) return;
    if (interactive) {
      this.win.setFocusable(true);
      this.win.setIgnoreMouseEvents(false);
    } else {
      this.win.setFocusable(false);
      // Idle: canvas click-through; title bar always clickable for drag
      this.win.setIgnoreMouseEvents(true, { forward: true });
    }
  }

  flashWindow(): void { this.win?.flashFrame(true); }
  show(): void { this.win?.show(); }
  hide(): void { this.win?.hide(); }

  requestSave(): void {
    this.win?.webContents.send('window:request_save');
  }

  private loadWindowBounds() {
    // Load from electron-store or equivalent persisted settings
    return null;
  }
}
```

### 7.2 IPC Channels

```typescript
// src/main/ipc-handlers.ts

// Renderer → Main
ipcMain.handle('window:setAlwaysOnTop', (_, flag: boolean) => { ... });
ipcMain.handle('window:setInteractive', (_, flag: boolean) => { ... });
ipcMain.handle('window:flash', () => { ... });
ipcMain.handle('save:write', (_, slot: number, data: string) => { ... });
ipcMain.handle('save:read', (_, slot: number) => { ... });
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:quit', () => app.quit());

// Main → Renderer
// (via webContents.send)
mainWindow.webContents.send('window:focus');
mainWindow.webContents.send('window:blur');
```

### 7.3 Preload (Context Bridge)

```typescript
// src/main/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  setInteractive: (flag: boolean) => ipcRenderer.invoke('window:setInteractive', flag),
  flashWindow: () => ipcRenderer.invoke('window:flash'),
  saveData: (slot: number, data: string) => ipcRenderer.invoke('save:write', slot, data),
  loadData: (slot: number) => ipcRenderer.invoke('save:read', slot),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onFocus: (cb: () => void) => ipcRenderer.on('window:focus', cb),
  onBlur: (cb: () => void) => ipcRenderer.on('window:blur', cb),
});
```

---

## 8. Rendering Pipeline

### 8.1 Resolution Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                  RENDERING PIPELINE                       │
│                                                           │
│  Three.js Scene                                           │
│  ┌─────────────────────┐                                  │
│  │  400 × 300          │  ← Internal render target        │
│  │  WebGLRenderTarget   │     (constant, never changes)    │
│  │  antialias: false    │                                  │
│  │  flatShading: true   │                                  │
│  └─────────┬───────────┘                                  │
│            │                                              │
│            ▼                                              │
│  ┌─────────────────────┐                                  │
│  │  <canvas> CSS        │  ← Browser upscaling             │
│  │  width: 100%         │     image-rendering: pixelated   │
│  │  height: 100%        │     crisp-edges                  │
│  │  object-fit: contain │                                  │
│  └─────────┬───────────┘                                  │
│            │                                              │
│            ▼                                              │
│  ┌─────────────────────┐                                  │
│  │  DOM UI Overlay      │  ← CSS pixels (native res)       │
│  │  Positioned over     │     Not affected by 400×300      │
│  │  canvas, rendered    │     HUD is crisp at any size     │
│  │  at window res       │                                  │
│  └─────────────────────┘                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Renderer Abstraction

```typescript
// src/renderer/rendering/Renderer.ts

class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderTarget: THREE.WebGLRenderTarget;

  static readonly INTERNAL_W = 400;
  static readonly INTERNAL_H = 300;

  constructor(canvas: HTMLCanvasElement) {
    // Orthographic camera for consistent pixel-perfect look
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const viewSize = 9;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize, 1, 1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,          // MUST be false for pixel look
      alpha: false,
    });
    this.renderer.setPixelRatio(1);  // Force 1:1 for internal buffer
    this.renderer.setSize(GameRenderer.INTERNAL_W, GameRenderer.INTERNAL_H, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.scene = new THREE.Scene();
  }

  getScene(): THREE.Scene { return this.scene; }
  getCamera(): THREE.OrthographicCamera { return this.camera; }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
```

### 8.3 Camera State Transitions

`CameraController` manages 5 distinct camera states driven by the fishing lifecycle:

```typescript
// src/renderer/rendering/CameraController.ts

type CameraState = 'orbit' | 'aim' | 'bobber' | 'reel' | 'catch';

interface CameraTransition {
  from: CameraState;
  to: CameraState;
  duration: number;    // seconds
  easing: 'linear' | 'ease_out' | 'ease_in_out';
}

const TRANSITIONS: CameraTransition[] = [
  // Idle: slowly orbit the sanctuary
  { from: 'orbit',  to: 'orbit',  duration: 0, easing: 'linear' },

  // Cast: zoom slightly toward water, center on cast direction
  { from: 'orbit',  to: 'aim',    duration: 0.3, easing: 'ease_out' },

  // Cast released: focus on bobber landing zone
  { from: 'aim',    to: 'bobber', duration: 0.5, easing: 'ease_in_out' },

  // Hook set: zoom to water surface, show fish silhouette
  { from: 'bobber', to: 'reel',   duration: 0.4, easing: 'ease_out' },

  // Catch: dramatic pull-back angle, fish rises with particles
  { from: 'reel',   to: 'catch',  duration: 0.6, easing: 'ease_out' },

  // Return to orbit after catch/escape animation
  { from: 'catch',  to: 'orbit',  duration: 1.5, easing: 'ease_in_out' },
];
```

Each state uses `THREE.OrthographicCamera` with different `position` and `lookAt` targets. All transitions are smooth lerps — no cuts.

### 8.4 Pipeline.ts

`Pipeline.ts` handles the CSS-side of the 400×300 upscale:

```typescript
// src/renderer/rendering/Pipeline.ts

class RenderPipeline {
  /** Apply pixelated scaling CSS to the canvas element */
  static apply(canvas: HTMLCanvasElement): void {
    canvas.style.imageRendering = 'pixelated';
    canvas.style.imageRendering = 'crisp-edges';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
  }

  /** Calculate letterbox margins to maintain aspect ratio */
  static getLetterbox(windowW: number, windowH: number): { top: number; left: number } {
    const targetAspect = 400 / 300;  // 4:3
    const windowAspect = windowW / windowH;
    // Returns CSS margins for centering
  }
}
```

### 8.5 Scene Construction (Location Builders)

Each location builder is a class extending `BaseLocation`:

```typescript
// src/renderer/locations/BaseLocation.ts

abstract class BaseLocation {
  abstract readonly id: string;
  abstract readonly name: { zh: string; en: string };
  abstract readonly bgColor: number;
  abstract readonly particleType: string;
  abstract readonly lightColor: number;

  protected scene: THREE.Scene;
  private group: THREE.Group;
  private particles: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
  }

  /** Build all meshes and add to scene */
  abstract build(): void;

  /** Called every frame for animations */
  update(dt: number): void { this.particles?.update(dt); }

  /** Clean up when switching locations */
  destroy(): void {
    this.scene.remove(this.group);
    this.particles?.dispose();
  }

  /** Add water plane (shared across all locations) */
  protected addWaterPlane(color: number): void {
    // Create low-poly water with vertex displacement
    const water = new WaterRenderer({
      width: 20, height: 15,
      segments: 20,
      color,
    });
    this.group.add(water.getMesh());
  }
}
```

Each existing sanctuary (from [`index.html`](index.html:65)) becomes a subclass. The existing build functions are ported verbatim — the visual identity is preserved.

---

## 9. Build & Modifier System

### 9.1 Charm Selection UI (Pre-Run)

```
┌──────────────────────────────────────────┐
│  🌸 Kyoto: Sakura Shrine                 │
│                                          │
│  Choose 3 Charms:  [Rerolls: 2]         │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 🧲       │ │ 🕯️       │ │ 💀       │ │
│  │ Magnetic │ │ Patient  │ │ Cursed   │ │
│  │ Hook     │ │ Spirit   │ │ Line     │ │
│  │          │ │          │ │          │ │
│  │ +15% rare│ │ Wait -50%│ │ +30% gold│ │
│  │ Tension  │ │ Pull +30%│ │ Line wear│ │
│  │ +20%     │ │          │ │ +50%     │ │
│  │ [PICK]   │ │ [PICK]   │ │ [PICK]   │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│  ┌──────────┐ ┌──────────┐              │
│  │ 🔥       │ │ ❄️       │  [Reroll →] │
│  │ Fire     │ │ Frost    │              │
│  │ Heart    │ │ Walker   │              │
│  │ [PICK]   │ │ [PICK]   │              │
│  └──────────┘ └──────────┘              │
│                                          │
│  Selected: [🧲] [🕯️] [  ]               │
│                                          │
│  [  START EXPEDITION  ]                 │
└──────────────────────────────────────────┘
```

### 9.2 Modifier Resolution Pipeline

When any stat needs to be evaluated:

```
baseValue
    │
    ▼
┌─────────────────────────────┐
│ 1. Apply stat_add effects   │  baseValue + sum(addValues)
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Apply stat_mult effects  │  value × product(multipliers)
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. Apply condition effects  │  if (condition met): apply sub-effects
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 4. Clamp to bounds          │
└─────────────┬───────────────┘
              │
              ▼
         finalValue
```

Example: base rare chance = 15%, with Magnetic Hook (+15%) and Lucky Bobber (+5%):
- 15 × 1.15 × 1.05 = 18.11%

### 9.3 Synergy System

Charms with shared tags create synergies:

```typescript
// Auto-detected synergies based on tag counts
function detectSynergies(modifiers: Modifier[]): Synergy[] {
  const tagCounts = new Map<string, number>();
  for (const mod of modifiers) {
    for (const tag of mod.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const synergies: Synergy[] = [];
  // e.g., 3+ 'spirit' tags → "Spirit Communion" bonus
  if ((tagCounts.get('spirit') || 0) >= 3) {
    synergies.push({
      name: 'Spirit Communion',
      description: 'All spirit fish give +50% XP',
      effects: [{ type: 'stat_mult', stat: 'xpGain', multiplier: 1.5, condition: 'isSpiritFish' }],
    });
  }
  return synergies;
}
```

---

## 10. Save & Persistence

### 10.1 Save Architecture

```
┌─────────────────────────────────────────────────────┐
│                 SAVE STRATEGY                         │
│                                                       │
│  Tier 1: localStorage (always available)              │
│  ├── Auto-save after every catch                      │
│  ├── Save on run end                                  │
│  ├── Save on app blur/minimize                        │
│  └── 3 manual save slots                              │
│                                                       │
│  Tier 2: JSON export/import (Phase 1)                 │
│  ├── File > Export Save                               │
│  ├── File > Import Save                               │
│  └── Human-readable .json                             │
│                                                       │
│  Tier 3: Steam Cloud (Phase 2, via Electron)          │
│  ├── Auto-sync via Steamworks SDK                     │
│  └── Cross-device for Steam Deck                      │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 10.2 Save Data Schema

```typescript
// src/shared/types.ts

interface SaveData {
  version: number;              // Schema version for migrations
  timestamp: number;            // Last save time (ms)
  gameState: GameState;         // Full game state (see §6.1)
  settings: UserSettings;
}

interface UserSettings {
  alwaysOnTop: boolean;
  windowScale: number;          // 0.75, 1.0, 1.2, 1.5, 2.0
  autoHideHUD: boolean;
  notificationMode: 'subtle' | 'normal' | 'flash';
  language: 'zh' | 'en';
  volume: { master: number; sfx: number; ambient: number };
}
```

---

## 11. Error Handling & Graceful Degradation

### 11.1 Failure Tiers

```
TIER 1 — ALWAYS WORKS (Core Loop):
  If these fail, the app shows a fatal error screen.
  ├── Three.js WebGL context creation
  ├── Canvas element attachment
  └── EventBus initialization

TIER 2 — DEGRADES GRACEFULLY:
  ├── AudioContext blocked → silent mode (no crash)
  ├── localStorage full → in-memory save only, notify user
  └── WebGL context lost → pause rendering, attempt restore

TIER 3 — OPTIONAL (can fail silently):
  ├── Daily quests (clock unavailable → generic fallback quests)
  ├── System tray (OS doesn't support → skip, use taskbar only)
  └── Global shortcut (registration fails → tray-only entry)
```

### 11.2 WebGL Fallback

```typescript
// src/renderer/rendering/Renderer.ts

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
    return renderer;
  } catch (e) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  background:#05050a;color:#e2e8f0;font-family:monospace;text-align:center;">
        <div>
          <h2>WebGL Not Available</h2>
          <p>Your graphics driver or browser does not support WebGL.</p>
          <p style="color:#4a5568;font-size:11px;">Soul Sanctuary requires WebGL 1.0+</p>
        </div>
      </div>`;
    console.error('[Renderer] WebGL initialization failed:', e);
    return null;
  }
}
```

### 11.3 Error Boundary Matrix

| Scenario | Detection | Handling |
|----------|-----------|----------|
| **WebGL not supported** | `createRenderer()` throws | HTML fallback page |
| **WebGL context lost** | `canvas.addEventListener('webglcontextlost')` | Pause game loop, attempt restore on interaction |
| **localStorage full** | `try/catch` on `setItem()` | Notification toast, continue in-memory |
| **Save data corruption** | `JSON.parse()` throws on load | Backup corrupted blob, start fresh with notice |
| **Frame drop / lag spike** | `dt > 0.1` | Cap dt at 0.1s to prevent physics explosion |
| **NaN in calculations** | `isNaN()` guard after every math op | Clamp to safe defaults, log warning |
| **AudioContext blocked** | Browser autoplay policy | Resume `AudioContext` on first user interaction |
| **Fish spawn pool empty** | `_getCandidates()` returns `[]` | Fallback: return random common fish from location |
| **Tab/Window hidden** | `document.visibilitychange` | Reduce FPS to 1fps, pause non-essential updates |
| **Electron IPC timeout** | `ipcRenderer.invoke()` timeout | Retry once, then degrade feature |

### 11.4 Debug Mode

```typescript
// URL parameter: ?debug=1 or Vite DEV mode
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

if (DEBUG) {
  // FPS counter overlay
  // Console access: window.__game = gameManager
  // Modifier inspection: window.__mods = modifierEngine.getModifiers()
  // Fish spawn test: window.__spawn = (id) => fishSpawner.rollFish(id, 'worm', 0.5)
}
```

---

## Appendix A: Vite + Electron Toolchain

```json
// package.json (key dependencies)
{
  "name": "soul-sanctuary",
  "version": "1.0.0",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "dev:electron": "vite build && electron .",
    "build": "vite build && electron-builder",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vite": "^6.0",
    "vite-plugin-electron": "^0.28",
    "vite-plugin-electron-renderer": "^0.14",
    "electron": "^33.0",
    "electron-builder": "^25.0",
    "@types/three": "^0.170"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart(options) {
          options.reload();
        },
      },
    ]),
    renderer(),
  ],
  root: '.',
  build: {
    outDir: 'dist/renderer',
  },
});
```

---

## Appendix B: Migration from index.html

The existing [`index.html`](index.html) contains:

1. **12 STATIONS array** → Migrate to [`src/renderer/data/location-data.ts`](src/renderer/data/location-data.ts)
2. **buildJapan(), buildChina(), ... functions** → Each becomes a class in [`src/renderer/locations/`](src/renderer/locations/)
3. **Particle systems** → Extract to [`src/renderer/rendering/ParticleSystem.ts`](src/renderer/rendering/ParticleSystem.ts)
4. **Camera + Renderer setup** → Extract to [`src/renderer/rendering/Renderer.ts`](src/renderer/rendering/Renderer.ts)
5. **Navigation & cruise** → Repurpose for location selection + idle orbit
6. **CSS styles** → Split into [`src/styles/`](src/styles/)

The 3D art assets (low-poly meshes, particle configs, lighting) are preserved verbatim — they are the project's visual soul.

---

## Appendix C: Development Phases

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 0: Foundation** | Week 1-2 | Vite + Electron scaffold, TypeScript, EventBus, GameLoop, InputManager, 12 location classes ported from index.html, basic window with 3D rendering |
| **Phase 1: Desktop UX** | Week 3-4 | Window manager (frameless, position memory), tray icon + context menu, global shortcut Ctrl+Shift+F, click-through toggle, notification system (flash/tray), always-on-top |
| **Phase 2: Core Loop** | Week 5-6 | FishingSystem state machine, FishSpawner, tension bar, cast power bar, hook indicator, basic fishpedia, 21 MVP fish (3 locations × 7) |
| **Phase 3: Roguelike** | Week 7-8 | RunManager (voluntary end), ModifierEngine, EventDeck, Charm + Relic database (20+ charms, 5+ relics), run prep UI, camp meta-progression |
| **Phase 4: Content** | Week 9-10 | All 141 fish definitions, 12 locations with water planes, procedural fish meshes, balance tuning, daily system |
| **Phase 5: Polish** | Week 11-12 | Save/Load (3 slots + auto-save + JSON export), achievements, Steamworks SDK integration (cloud save, achievements overlay), playtesting, bug fixes |

---

*End of Architecture Design Record v2.0*
