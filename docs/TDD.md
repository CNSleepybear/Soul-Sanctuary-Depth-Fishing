# 🎣 Soul Sanctuary: Depth Fishing — Technical Design Document (TDD)

> **Version**: 1.0 | **Date**: 2026-06-02
> **Tech Stack**: Three.js r128, Vanilla JavaScript (ES6+), Web Audio API, localStorage
> **Target**: Single-file HTML application → Modular refactor
> **Inherits From**: [Soul Sanctuary index.html](../index.html) (existing 12-station scene viewer)

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Module Dependency Graph](#2-module-dependency-graph)
3. [Core Systems Design](#3-core-systems-design)
4. [Data Layer](#4-data-layer)
5. [Rendering Pipeline](#5-rendering-pipeline)
6. [State Management](#6-state-management)
7. [Audio System](#7-audio-system)
8. [Save System](#8-save-system)
9. [Migration from Existing Codebase](#9-migration-from-existing-codebase)
10. [Performance Targets](#10-performance-targets)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      index.html (Entry Point)                 │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │  Game    │ │  UI      │ │  Audio   │ │  Save/Storage │   │
│  │  Manager │ │  Manager │ │  Manager │ │  Manager       │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘   │
│       │             │            │               │           │
│       ▼             ▼            ▼               ▼           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   Event Bus (Pub/Sub)                 │    │
│  └──────────────────────────────────────────────────────┘    │
│       │             │            │               │           │
│       ▼             ▼            ▼               ▼           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │ Fishing  │ │ Location │ │ Fish     │ │ Particle      │   │
│  │ System   │ │ Manager  │ │ Spawner  │ │ Manager        │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘   │
│       │             │            │               │           │
│       └─────────────┴────────────┴───────────────┘           │
│                          │                                    │
│                          ▼                                    │
│              ┌──────────────────────┐                        │
│              │   THREE.js Renderer  │                        │
│              │   (400×300 Buffer)   │                        │
│              └──────────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Single Responsibility** | Each module handles ONE concern: FishingSystem only knows about cast/reel/bite logic |
| **Event-Driven Communication** | Modules communicate via EventBus, not direct references |
| **Data-Driven Rendering** | All fish, locations, items are data objects; rendering is pure presentation |
| **Progressive Enhancement** | Core game works without audio, without save, without leaderboard |
| **Existing Code Reuse** | Location builders ([buildJapan()](index.html:138), etc.) adopted with minimal modifications |

### 1.3 Refactor Strategy: Single-File → Modular

The existing [`index.html`](index.html) is a ~1217-line single file. For the fishing game, we refactor into:

```
index.html
├── <script src="js/event-bus.js">
├── <script src="js/config.js">          ← All constants, fish data, balance
├── <script src="js/save-manager.js">    ← localStorage CRUD
├── <script src="js/audio-manager.js">   ← Web Audio API
├── <script src="js/ui-manager.js">      ← DOM manipulation
├── <script src="js/location-manager.js">← 12 sanctuary builders (from existing)
├── <script src="js/fish-spawner.js">    ← Fish procedural generation
├── <script src="js/fishing-system.js">  ← Core cast/bite/reel logic
├── <script src="js/particle-manager.js">← Particle systems (from existing)
├── <script src="js/renderer.js">        ← THREE.js setup (from existing)
├── <script src="js/game-manager.js">    ← Top-level orchestrator
└── <script>/* main bootstrap */</script>
```

> **Note**: For rapid prototyping, all modules can remain in a single HTML file with clear `// ===== SECTION X =====` comment dividers, then extracted to separate files in Phase 2.

---

## 2. Module Dependency Graph

```
game-manager.js
├── config.js (read-only data)
├── event-bus.js (pub/sub)
├── save-manager.js
│   └── config.js (default values)
├── audio-manager.js
│   └── config.js (audio clips)
├── ui-manager.js
│   ├── event-bus.js
│   └── config.js (UI strings)
├── location-manager.js
│   ├── config.js (station metadata)
│   ├── renderer.js (THREE context)
│   └── particle-manager.js
├── fish-spawner.js
│   ├── config.js (fish definitions)
│   └── renderer.js (fish mesh generation)
├── fishing-system.js
│   ├── event-bus.js
│   ├── config.js (balance numbers)
│   ├── fish-spawner.js
│   └── audio-manager.js
└── renderer.js (standalone THREE setup)
```

---

## 3. Core Systems Design

### 3.1 Event Bus

Central pub/sub system — all inter-module communication flows through here.

```typescript
// js/event-bus.js
interface EventBus {
  events: Map<string, Set<Function>>;
  
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, data?: any): void;
}

// Event Catalog
const EVENTS = {
  // Fishing lifecycle
  'fishing:cast':        { power: number, bait: BaitType },
  'fishing:bite':        { fish: SpiritFish },
  'fishing:hook_set':    { success: boolean },
  'fishing:reel_start':  { fish: SpiritFish },
  'fishing:reel_update': { tension: number, fishProgress: number },
  'fishing:catch':       { fish: SpiritFish, size: number, quality: CatchQuality },
  'fishing:escape':      { fish: SpiritFish, reason: EscapeReason },
  'fishing:line_break':  {},
  
  // Game state
  'game:location_change': { locationId: string, meta: StationMeta },
  'game:gold_change':     { amount: number, delta: number },
  'game:xp_gain':         { amount: number, source: string },
  'game:level_up':        { newLevel: number },
  'game:daily_refresh':   {},
  
  // UI
  'ui:open_fishpedia':    { fishId?: string },
  'ui:open_shop':         {},
  'ui:show_notification': { message: string, type: 'info'|'success'|'rare'|'error' },
  
  // Save
  'save:load':   { data: SaveData },
  'save:commit': {},
};
```

### 3.2 Fishing System (State Machine)

The fishing system is a finite state machine with 7 states:

```
                    ┌─────────┐
                    │  IDLE   │◀──────────────────────────┐
                    └────┬────┘                           │
                         │ cast()                         │
                         ▼                                │
                    ┌─────────┐                           │
                    │ WAITING │                           │
                    └────┬────┘                           │
                         │ bite()                         │
                         ▼                                │
                    ┌─────────┐     miss timing           │
                    │ HOOKING │───────────────────────────┤
                    └────┬────┘                           │
                         │ set_hook() ✓                   │
                         ▼                                │
                    ┌─────────┐                           │
                    │ REELING │                           │
                    └────┬────┘                           │
                    ┌─────┴─────┐                         │
                    ▼           ▼                         │
              ┌─────────┐ ┌──────────┐                   │
              │  CATCH  │ │  ESCAPE  │───────────────────┘
              └────┬────┘ └──────────┘
                   │
                   ▼
              ┌─────────┐
              │ RESULTS │──▶ IDLE
              └─────────┘
```

```typescript
// js/fishing-system.js
enum FishingState {
  IDLE = 'idle',
  CASTING = 'casting',    // Power meter visible, charging
  WAITING = 'waiting',    // Bobber in water
  HOOKING = 'hooking',    // Fish bit, waiting for player click
  REELING = 'reeling',    // Mini-game active
  CATCH = 'catch',        // Success animation
  ESCAPE = 'escape',      // Fail animation
}

interface FishingStateMachine {
  state: FishingState;
  
  // State data
  currentPower: number;        // 0-1
  waitTimer: number;           // seconds elapsed while waiting
  hookWindow: number;          // seconds remaining to set hook
  tension: number;             // 0-100
  fishProgress: number;        // 0-100 (how close fish is to being caught)
  lineDurability: number;      // 0-100
  
  // References
  currentBait: BaitType;
  hookedFish: SpiritFish | null;
  
  // Methods
  startCast(): void;           // Begin power meter charge
  releaseCast(power: number): void;  // Cast with power 0-1
  cancelCast(): void;          // Reel in empty line
  attemptHook(): void;         // Player clicks during hooking window
  tickReel(isReeling: boolean, deltaTime: number): void;  // Called each frame
}
```

### 3.3 Fish Spawner

Determines what fish bites based on location, conditions, bait, and RNG.

```typescript
// js/fish-spawner.js
interface FishSpawner {
  // Main spawn logic
  rollFish(locationId: string, bait: BaitType, castPower: number): SpiritFish;
  
  // Rarity table builder
  buildSpawnTable(locationId: string, bait: BaitType, castPower: number): WeightedTable;
  
  // Condition checks
  getCurrentTimeWindow(): 'dawn' | 'day' | 'dusk' | 'night';
  getCurrentWeather(locationId: string): WeatherType;
  getCurrentSeason(): Season;
  
  // Procedural mesh generation
  generateFishMesh(fish: SpiritFish, size: number): THREE.Group;
}

// Weighted random selection
interface WeightedTable {
  entries: Array<{ fish: SpiritFish; weight: number }>;
  totalWeight: number;
  roll(): SpiritFish;
}
```

**Spawn Algorithm:**

```
function rollFish(locationId, bait, castPower):
  1. Get all fish for this location
  2. Filter by:
     - Current time window (dawn/day/dusk/night)
     - Current weather (if fish has weather requirement)
     - Current season
     - Bait compatibility
  3. Build weighted table:
     baseWeight = rarityToWeight(fish.rarity)
     baitBonus = bait.modifierForRarity(fish.rarity)
     powerBonus = castPower in optimal ? 1.15 : 1.0
     finalWeight = baseWeight * baitBonus * powerBonus
  4. Roll random against weighted table
  5. Return selected fish
```

### 3.4 Location Manager

Adapts existing [`buildJapan()`](index.html:138) through [`buildGreece()`](index.html:957) functions.

```typescript
// js/location-manager.js
interface LocationManager {
  currentLocationId: string;
  currentMeta: StationMeta;
  
  // Scene building (reuses existing code)
  buildLocation(locationId: string): void;
  clearLocation(): void;  // dispose geometries
  
  // Water plane (NEW — added to each scene)
  createWaterPlane(locationId: string): THREE.Mesh;
  
  // Environment conditions
  getWeather(locationId: string): WeatherType;
  updateWeather(): void;  // Called on day cycle tick
  
  // Camera positioning
  positionCameraForFishing(): void;
  animateCameraToLocation(): void;
}
```

**Water Plane Implementation (Low-Poly Style):**

```typescript
function createWaterPlane(locationId: string): THREE.Mesh {
  const waterColors = {
    'JAPAN': 0x1a2b3c,    // Dark pond
    'ICELAND': 0x0a1a2a,  // Deep fjord
    'THAILAND': 0x0d2a20, // River teal
    // ...
  };
  
  const geo = new THREE.PlaneGeometry(12, 8, 12, 8);  // Segmented for vertex animation
  const mat = new THREE.MeshLambertMaterial({
    color: waterColors[locationId] || 0x142b30,
    flatShading: true,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  water.userData = { type: 'water', animate: true };
  
  return water;
}
```

---

## 4. Data Layer

### 4.1 Config Data (Static — `js/config.js`)

```typescript
// ===== STATION METADATA (from existing index.html, extended) =====
const STATIONS: StationMeta[] = [
  {
    id: 'japan',
    name: { zh: '京都落樱 · 暮色神社', en: 'Kyoto Sakura Shrine' },
    country: 'JAPAN',
    waterColor: 0x1a2b3c,
    ambientColor: 0x18244b,
    bg: 0x0c0f1d,
    weatherPool: ['clear', 'rain', 'cherry_blossom'],
    unlockLevel: 1,
    // ... existing metadata preserved
  },
  // ... 11 more stations
];

// ===== FISH DATABASE =====
const FISH_DATABASE: SpiritFish[] = [
  {
    id: 'sakura_koi',
    name: { zh: '樱鲤', en: 'Sakura Koi' },
    location: 'japan',
    rarity: 'common',
    behavior: { type: 'steady', pullStrength: 0.3, burstChance: 0.1, burstStrength: 0.6 },
    timeWindows: ['day'],
    baseGold: 10,
    xpValue: 15,
    size: { min: 0.3, max: 0.5 },
    colorPalette: [0xffb7c5, 0xff8fa3, 0xd47394],
    modelConfig: { bodyType: 'koi', finStyle: 'flowing', scale: 1.0 },
    description: 'A koi imbued with cherry blossom essence...',
  },
  // ... 140+ more fish
];

// ===== GEAR DATABASE =====
const RODS: RodConfig[] = [
  { id: 'bamboo', tier: 1, name: 'Bamboo Starter', power: 1.0, durability: 100, cost: 0, bonuses: {} },
  { id: 'oak', tier: 2, name: 'Oak Wanderer', power: 1.2, durability: 150, cost: 500, bonuses: { rareChance: 1.05 } },
  // ...
];

const BAITS: BaitConfig[] = [
  { id: 'worm', name: 'Basic Worm', cost: 0, rareBonus: 1.0, special: null },
  { id: 'glow_worm', name: 'Glow Worm', cost: 10, rareBonus: 1.15, special: 'nocturnal' },
  // ...
];

// ===== BALANCE CONSTANTS =====
const BALANCE = {
  castOptimalMin: 0.4,
  castOptimalMax: 0.7,
  hookWindowBase: 1.2,       // seconds
  hookWindowRarityMult: { common: 1.0, uncommon: 0.9, rare: 0.75, legendary: 0.5, mythic: 0.35 },
  tensionIncreaseRate: 12,   // % per second while reeling
  tensionDecreaseRate: 8,    // % per second while slacking
  lineWearRate: 3,           // % per second in red zone
  fishProgressRate: 8,       // % per second in green zone
  fishProgressGreenMult: 1.2,
  fishProgressYellowMult: 0.8,
  fishProgressRedMult: 0.3,
  xpPerLevel: (level: number) => Math.floor(100 * Math.pow(level, 1.5)),
};
```

### 4.2 Save Data (Dynamic — `js/save-manager.js`)

```typescript
interface SaveData {
  version: number;                    // Schema version for migration
  lastSaveTimestamp: number;
  
  // Player
  player: {
    name: string;
    level: number;
    xp: number;
    gold: number;                     // Primary currency
    spiritEssence: number;            // Premium-ish currency
    sanctuaryTokens: number;          // Location tokens
  };
  
  // Gear
  gear: {
    equippedRodId: string;
    equippedLineId: string;
    ownedRods: string[];
    ownedLines: string[];
  };
  
  // Inventory
  inventory: {
    baits: Record<string, number>;    // baitId → quantity
    fishStorage: StoredFish[];        // Up to capacity
  };
  
  // Fishpedia
  fishpedia: Record<string, FishpediaEntry>;  // fishId → entry
  
  // Progress
  progress: {
    unlockedLocations: string[];
    completedLocations: string[];     // All fish caught
    totalFishCaught: number;
    achievements: string[];
  };
  
  // Dailies
  dailies: {
    lastRefreshDate: string;          // 'YYYY-MM-DD'
    completedQuests: string[];
    streakDays: number;
    freeBaitClaimed: boolean;
  };
  
  // Stats
  stats: {
    totalCasts: number;
    totalCatches: number;
    perfectCatches: number;
    lineBreaks: number;
    longestCast: number;
    biggestFish: { fishId: string; size: number };
  };
}

interface FishpediaEntry {
  fishId: string;
  discovered: boolean;        // Caught at least once
  timesCaught: number;
  largestSize: number;
  smallestSize: number;
  spiritVariantCaught: boolean;  // Shiny version
  firstCatchDate: string;
}

interface StoredFish {
  id: string;                 // Unique instance ID
  fishId: string;             // Species reference
  size: number;
  weight: number;             // Derived from size
  quality: CatchQuality;
  isSpiritVariant: boolean;
  catchTimestamp: number;
  catchLocation: string;
}
```

### 4.3 Save Slots & Compression

```typescript
// Save key format: 'soulsanctuary_save_{slot}'
const SAVE_KEY = (slot: number = 0) => `soulsanctuary_save_${slot}`;

// Compression: JSON → LZString (optional, reduces ~100KB → ~30KB)
function save(slot: number, data: SaveData): void {
  const json = JSON.stringify(data);
  // const compressed = LZString.compress(json);  // Phase 2
  localStorage.setItem(SAVE_KEY(slot), json);
}

function load(slot: number): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY(slot));
  if (!raw) return null;
  // const decompressed = LZString.decompress(raw);
  return JSON.parse(raw);
}
```

---

## 5. Rendering Pipeline

### 5.1 Pixelated Render Target (Inherited)

The existing 400×300 → fullscreen upscale with `image-rendering: pixelated` CSS is preserved exactly:

```css
/* Existing CSS — UNCHANGED */
canvas {
    display: block; width: 100vw; height: 100vh;
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}
```

### 5.2 Rendering Layers

```typescript
// Layer order (front to back)
enum RenderLayer {
  UI_OVERLAY = 0,     // HTML/DOM overlay (HUD, menus) — separate from THREE
  PARTICLE_FRONT = 1, // Bobber, splash particles, ripple rings
  FISH = 2,           // Fish models during reel/catch
  WATER = 3,          // Water plane (transparent)
  SCENE = 4,          // Sanctuary buildings, terrain (existing)
  SKYBOX = 5,         // Background color/fog (existing)
}

// THREE.js Groups (within worldGroup)
const groups = {
  skybox: new THREE.Group(),
  scene: new THREE.Group(),      // Existing sanctuary geometry
  water: new THREE.Group(),
  fish: new THREE.Group(),
  particles: new THREE.Group(),
};
```

### 5.3 Fish Model Generation (Procedural Low-Poly)

All fish are procedurally generated from config — no external model files.

```typescript
interface FishModelConfig {
  bodyType: 'koi' | 'carp' | 'eel' | 'angler' | 'ray' | 'serpent';
  finStyle: 'flowing' | 'spiky' | 'round' | 'none';
  scale: number;               // Base scale multiplier
  segments?: number;           // For eel/serpent types
}

function generateFishMesh(config: FishModelConfig, palette: number[], size: number): THREE.Group {
  const group = new THREE.Group();
  
  // Body construction based on type
  switch(config.bodyType) {
    case 'koi':
      // Elongated box body + tail fin
      group.add(createBox(size * 1.2, size * 0.4, size * 0.3, palette[0], 0, 0, 0));
      // Tail
      const tail = createBox(size * 0.5, size * 0.3, size * 0.05, palette[1], -size * 0.6, 0, 0);
      tail.rotation.y = 0.4;
      group.add(tail);
      // Dorsal fin
      group.add(createBox(size * 0.3, size * 0.05, size * 0.2, palette[2], 0, size * 0.25, 0));
      break;
      
    case 'eel':
      // Segmented serpentine body
      const segs = config.segments || 6;
      for (let i = 0; i < segs; i++) {
        const s = size * (1 - i * 0.08);
        group.add(createBox(s * 0.3, s * 0.3, s * 0.3, palette[i % palette.length], 0, 0, -i * size * 0.15));
      }
      break;
      
    case 'ray':
      // Flat diamond body
      const body = createBox(size * 1.5, size * 0.1, size * 1.0, palette[0], 0, 0, 0);
      body.rotation.x = 0.1;
      group.add(body);
      // Wings
      group.add(createBox(size * 0.1, size * 0.05, size * 1.5, palette[1], 0, 0, 0));
      break;
      
    // ... more body types
  }
  
  // Eyes (two small cubes)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  group.add(createBox(size * 0.06, size * 0.06, size * 0.06, 0xffffff, size * 0.4, size * 0.1, size * 0.1));
  group.add(createBox(size * 0.06, size * 0.06, size * 0.06, 0xffffff, size * 0.4, size * 0.1, -size * 0.1));
  
  // Pupils
  group.add(createBox(size * 0.03, size * 0.03, size * 0.03, 0x000000, size * 0.43, size * 0.1, size * 0.1));
  group.add(createBox(size * 0.03, size * 0.03, size * 0.03, 0x000000, size * 0.43, size * 0.1, -size * 0.1));
  
  group.scale.setScalar(config.scale);
  return group;
}
```

### 5.4 Animation Tweening

For catch/release animations, use a simple tween system (no external library):

```typescript
interface Tween {
  target: THREE.Object3D;
  property: string;
  from: number;
  to: number;
  duration: number;
  elapsed: number;
  easing: (t: number) => number;
  onComplete?: () => void;
}

const tweens: Tween[] = [];

function addTween(target, prop, to, duration, easing, onComplete): void {
  tweens.push({ target, property: prop, from: target[prop], to, duration, elapsed: 0, easing, onComplete });
}

function updateTweens(dt: number): void {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i];
    t.elapsed += dt;
    const progress = Math.min(t.elapsed / t.duration, 1);
    const easedProgress = t.easing(progress);
    t.target[t.property] = t.from + (t.to - t.from) * easedProgress;
    if (progress >= 1) {
      t.onComplete?.();
      tweens.splice(i, 1);
    }
  }
}

// Easing functions
const Easing = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutBounce: (t: number) => { /* ... */ },
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};
```

---

## 6. State Management

### 6.1 GameManager (Top-Level Orchestrator)

```typescript
// js/game-manager.js
class GameManager {
  // Sub-systems
  eventBus: EventBus;
  saveManager: SaveManager;
  audioManager: AudioManager;
  uiManager: UIManager;
  locationManager: LocationManager;
  fishSpawner: FishSpawner;
  fishingSystem: FishingSystem;
  renderer: GameRenderer;
  
  // State
  saveData: SaveData;
  currentLocation: string;
  gameTime: number;  // Total elapsed in-game time
  
  constructor() {
    // 1. Init event bus
    this.eventBus = new EventBus();
    
    // 2. Init systems in dependency order
    this.saveManager = new SaveManager(this.eventBus);
    this.audioManager = new AudioManager(this.eventBus);
    this.renderer = new GameRenderer(this.eventBus);
    this.locationManager = new LocationManager(this.eventBus, this.renderer);
    this.fishSpawner = new FishSpawner(this.eventBus);
    this.fishingSystem = new FishingSystem(this.eventBus, this.fishSpawner);
    this.uiManager = new UIManager(this.eventBus);
    
    // 3. Load save
    this.saveData = this.saveManager.load(0) || this.createDefaultSave();
    
    // 4. Start game
    this.changeLocation(this.saveData.progress.unlockedLocations[0]);
    this.startRenderLoop();
  }
  
  changeLocation(locationId: string): void {
    this.currentLocation = locationId;
    this.locationManager.buildLocation(locationId);
    this.eventBus.emit('game:location_change', {
      locationId,
      meta: STATIONS.find(s => s.id === locationId)
    });
  }
  
  startRenderLoop(): void {
    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);  // Cap delta
      
      this.gameTime += dt;
      
      // Update all systems
      this.locationManager.update(dt);
      this.fishingSystem.update(dt);
      updateTweens(dt);
      this.renderer.render();
      
      // Auto-save every 60 seconds
      if (Math.floor(this.gameTime) % 60 === 0) {
        this.saveManager.save(0, this.saveData);
      }
    };
    loop();
  }
}
```

### 6.2 Input Handling

```typescript
// Unified input handler supporting mouse + touch
class InputManager {
  private isDown: boolean = false;
  private downTime: number = 0;
  
  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousedown', this.onDown.bind(this));
    canvas.addEventListener('mouseup', this.onUp.bind(this));
    canvas.addEventListener('touchstart', this.onDown.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.onUp.bind(this));
    canvas.addEventListener('touchcancel', this.onUp.bind(this));
    
    // Prevent context menu on long press
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  
  private onDown(e: Event): void {
    e.preventDefault();
    this.isDown = true;
    this.downTime = performance.now();
    // Signal to FishingSystem
  }
  
  private onUp(e: Event): void {
    if (!this.isDown) return;
    const holdDuration = (performance.now() - this.downTime) / 1000;
    this.isDown = false;
    // Signal to FishingSystem with hold duration (for cast power)
  }
  
  isHolding(): boolean { return this.isDown; }
  getHoldDuration(): number { return (performance.now() - this.downTime) / 1000; }
}
```

---

## 7. Audio System

### 7.1 Web Audio API Architecture

```typescript
// js/audio-manager.js
class AudioManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private ambientGain: GainNode;
  private sfxGain: GainNode;
  private musicGain: GainNode;
  
  // Active nodes
  private currentAmbient: AudioBufferSourceNode | null;
  private currentMusic: AudioBufferSourceNode | null;
  
  // Buffers (generated procedurally, no external files for MVP)
  private buffers: Map<string, AudioBuffer>;
  
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Gain chain: sources → category gain → master → destination
    this.masterGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    
    this.ambientGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    
    // Set levels
    this.ambientGain.gain.value = 0.3;
    this.sfxGain.gain.value = 0.7;
    this.musicGain.gain.value = 0.15;
    
    this.generateProceduralSounds();
  }
  
  // Procedural sound generation (no external files needed for MVP)
  private generateProceduralSounds(): void {
    // Cast sound: white noise burst filtered
    this.buffers.set('cast', this.createNoiseBurst(0.3, 800, 2000));
    // Bite sound: low frequency thud + splash
    this.buffers.set('bite', this.createSplash(0.4));
    // Reel sound: continuous click/ratchet (generated live)
    this.buffers.set('catch_success', this.createChime([523, 659, 784], 0.5));
    this.buffers.set('catch_rare', this.createChime([523, 659, 784, 1047], 0.8));
    // ...
  }
  
  private createNoiseBurst(duration: number, lowFreq: number, highFreq: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Filtered noise
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8);
    }
    
    return buffer;
  }
  
  playSound(bufferName: string, variation: number = 0): void {
    const buffer = this.buffers.get(bufferName);
    if (!buffer) return;
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + variation * 0.1;  // Slight pitch variation
    source.connect(this.sfxGain);
    source.start();
  }
}
```

### 7.2 Ambient Generation (Procedural)

For MVP, ambient background is generated using oscillators:

```typescript
generateAmbient(locationId: string): AudioBufferSourceNode {
  // Location-specific drone using multiple detuned oscillators
  const osc1 = this.ctx.createOscillator();
  const osc2 = this.ctx.createOscillator();
  
  const freqMap = {
    'japan': [220, 330],     // A3 + E4 (koto-esque)
    'iceland': [130, 196],   // C3 + G3 (deep, cold)
    'thailand': [294, 392],  // D4 + G4 (bright)
  };
  
  const [f1, f2] = freqMap[locationId] || [200, 300];
  osc1.frequency.value = f1;
  osc2.frequency.value = f2;
  osc1.type = 'sine';
  osc2.type = 'triangle';
  
  const merger = this.ctx.createGain();
  osc1.connect(merger);
  osc2.connect(merger);
  merger.connect(this.ambientGain);
  merger.gain.value = 0.5;
  
  osc1.start();
  osc2.start();
  
  return osc1;  // Return for stopping later
}
```

---

## 8. Save System

### 8.1 Auto-Save Strategy

| Trigger | Behavior |
|---------|----------|
| After each catch | Save |
| On location change | Save |
| On shop purchase | Save |
| Every 60 seconds | Auto-save |
| Before unload | Save (`beforeunload` event) |
| On entering menu | Save |

### 8.2 Migration System

```typescript
const SAVE_VERSION = 1;

function migrateSave(raw: any): SaveData {
  if (!raw.version || raw.version < SAVE_VERSION) {
    // Migration path for future schema changes
    if (raw.version === undefined) {
      // v0 → v1: Add spiritEssence, sanctuaryTokens
      raw.player.spiritEssence = 0;
      raw.player.sanctuaryTokens = 0;
      raw.version = 1;
    }
  }
  return raw as SaveData;
}
```

### 8.3 Storage Limits

| Browser | localStorage Limit | Our Save Size | Safe? |
|---------|-------------------|---------------|-------|
| Chrome | 10 MB | ~100 KB | ✅ |
| Firefox | 10 MB | ~100 KB | ✅ |
| Safari | 5 MB | ~100 KB | ✅ |
| Mobile Chrome | 5-10 MB | ~100 KB | ✅ |

---

## 9. Migration from Existing Codebase

### 9.1 What We Keep (Unchanged)

| Component | File/Location | Modifications |
|-----------|--------------|---------------|
| Three.js CDN | [line 61](index.html:61) | Keep r128 |
| Render setup | [lines 88-101](index.html:88) | Keep 400×300, OrthographicCamera, BasicShadowMap |
| Scene + worldGroup | [lines 103-104](index.html:103) | Keep, add water + fish groups |
| Ambient light | [lines 106-107](index.html:106) | Keep |
| clearWorld() | [lines 110-119](index.html:110) | Extend to clear fish geometry |
| createBox() | [lines 123-128](index.html:123) | Keep as utility |
| 12 build*() functions | [lines 138-1029](index.html:138) | Keep intact, add water plane at end |
| buildStation() | [lines 1032-1051](index.html:1032) | Rename to buildLocation(), extend |
| renderLoop() | [lines 1056-1183](index.html:1056) | Restructure into GameManager |
| Clock system | [line 1054](index.html:1054) | Keep `THREE.Clock()` |
| Particle systems | [lines 109-203](index.html:109) per location | Keep, add fishing particles (splash, ripple, bobber) |
| Flicker lights | [lines 1163-1174](index.html:1163) | Keep |
| Auto-cruise | [lines 1177-1180](index.html:1177) | Repurpose for location selection mode |
| CSS styles | [lines 7-43](index.html:7) | Extend with fishing HUD styles |
| HUD header | [lines 46-49](index.html:46) | Redesign for fishing game info bar |
| Navigation buttons | [lines 55-59](index.html:55) | Repurpose for location select |

### 9.2 What We Add (New)

| Component | Description |
|-----------|-------------|
| Water plane | Added to each `build*()` function |
| Fishing state machine | `js/fishing-system.js` |
| Fish spawner + procedural mesh generator | `js/fish-spawner.js` |
| Tension bar UI (DOM overlay) | HTML/CSS in `index.html` |
| Fishpedia UI (DOM overlay) | HTML/CSS modal |
| Shop UI (DOM overlay) | HTML/CSS modal |
| Save/load system | `js/save-manager.js` |
| Audio system | `js/audio-manager.js` |
| Event bus | `js/event-bus.js` |
| Tween engine | Inline in render loop |
| Daily quest system | `js/daily-system.js` |

### 9.3 What We Remove/Replace

| Old | Reason | Replacement |
|-----|--------|-------------|
| `STATIONS[].desc` strings | Made for viewing, not gameplay | Replace with location fish data |
| `nextStation()` / `prevStation()` / `toggleCruise()` | Cruise mode | Replace with location select UI |
| Station info HUD | Viewing info | Replace with fishing HUD |
| `resetParticle()` | Generic reset | Replace with fishing-specific particle behaviors |

---

## 10. Performance Targets

### 10.1 Frame Budget

| Target | Value |
|--------|-------|
| Render resolution | 400×300 (pixelated upscale) |
| Target FPS | 60 (desktop), 30 (mobile) |
| Draw calls | < 200 (existing ~150) |
| Triangle count | < 5,000 (existing ~3,000) |
| Particle count | < 100 active |
| Fish mesh complexity | < 50 triangles per fish |

### 10.2 Memory Budget

| Resource | Limit |
|----------|-------|
| Total JS heap | < 50 MB |
| GPU memory | < 100 MB |
| Audio buffers | < 5 MB |
| localStorage | < 200 KB per save slot |

### 10.3 Optimization Techniques

- **Geometry instancing**: Reuse box/cube geometries (already done via `createBox()`)
- **Material pooling**: Minimize unique materials
- **Object pooling**: Reuse particle meshes instead of creating/destroying
- **Occlusion culling**: THREE.js default frustum culling (free with perspective camera — use orthographic carefully)
- **Lazy loading**: Only build current location's fish models
- **RAF throttling**: Cap render at 30fps on mobile via `setTimeout` or frame skip

---

## Appendix: Class Diagram (Simplified)

```
┌─────────────────────────────────────────────────────────┐
│                     GameManager                          │
│  - eventBus: EventBus                                   │
│  - saveManager: SaveManager                             │
│  - audioManager: AudioManager                           │
│  - uiManager: UIManager                                 │
│  - locationManager: LocationManager                     │
│  - fishSpawner: FishSpawner                             │
│  - fishingSystem: FishingSystem                         │
│  - renderer: GameRenderer                               │
│  + init()                                               │
│  + changeLocation(id)                                   │
│  + startRenderLoop()                                    │
└───────┬─────────────────────────────────────────────────┘
        │ owns
        ▼
┌───────────────┐  ┌──────────────┐  ┌─────────────────┐
│ LocationMgr   │  │ FishingSystem│  │ FishSpawner     │
│ + build()     │  │ + state      │  │ + rollFish()    │
│ + clear()     │  │ + cast()     │  │ + generateMesh()│
│ + water()     │  │ + reel()     │  │ + getConditions()│
└───────────────┘  └──────────────┘  └─────────────────┘
        │                │                    │
        ▼                ▼                    ▼
┌───────────────┐  ┌──────────────┐  ┌─────────────────┐
│ GameRenderer  │  │ AudioManager │  │ SaveManager     │
│ + scene       │  │ + playSFX()  │  │ + save()        │
│ + camera      │  │ + ambient()  │  │ + load()        │
│ + render()    │  │ + music()    │  │ + migrate()     │
└───────────────┘  └──────────────┘  └─────────────────┘
```

---

*End of Technical Design Document v1.0*
