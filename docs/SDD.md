# 🎣 Soul Sanctuary: Depth Fishing — Software Design Document (SDD)

> **Version**: 1.0 | **Date**: 2026-06-02 | **Status**: Pre-Production
> **Implementation Language**: JavaScript (ES6+) with Three.js r128
> **Target**: Single-Page Web Application (`index.html` + `/js/` modules)
> **Inherits From**: [Soul Sanctuary index.html](../index.html)

---

## Table of Contents
1. [File Structure & Build](#1-file-structure--build)
2. [Component API Specifications](#2-component-api-specifications)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Detailed Algorithm Specifications](#4-detailed-algorithm-specifications)
5. [UI Component Tree & DOM Structure](#5-ui-component-tree--dom-structure)
6. [CSS Architecture](#6-css-architecture)
7. [Testing Strategy](#7-testing-strategy)
8. [Error Handling & Edge Cases](#8-error-handling--edge-cases)
9. [Deployment & Versioning](#9-deployment--versioning)
10. [Code Style Guide](#10-code-style-guide)

---

## 1. File Structure & Build

### 1.1 Directory Layout

```
SoulSanctuary/
├── index.html              # Main entry point (SPA)
├── js/
│   ├── config.js           # All static data: fish, stations, gear, balance
│   ├── event-bus.js        # Pub/sub event system
│   ├── save-manager.js     # localStorage CRUD + migration
│   ├── audio-manager.js    # Web Audio API procedural audio
│   ├── ui-manager.js       # DOM manipulation, HUD, menus
│   ├── input-manager.js    # Unified mouse/touch input
│   ├── tween-engine.js     # Simple animation tweening
│   ├── location-manager.js # 12 sanctuary builders (from index.html)
│   ├── fish-spawner.js     # Fish RNG + procedural mesh generation
│   ├── fishing-system.js   # Core fishing state machine
│   ├── daily-system.js     # Daily quests, streaks, refresh
│   ├── shop-system.js      # Purchasing, inventory
│   ├── renderer.js         # THREE.js setup + render loop
│   └── game-manager.js     # Top-level orchestrator
├── docs/
│   ├── market-research.md
│   ├── GDD.md
│   ├── TDD.md
│   └── SDD.md              # ← This file
└── assets/                 # (Phase 2: audio files, if not procedural)
    └── (empty for MVP)
```

### 1.2 HTML Script Loading Order

```html
<!-- index.html <head> or end of <body> -->
<!-- 1. External dependency (CDN) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<!-- 2. No-dependency modules first -->
<script src="js/config.js"></script>
<script src="js/event-bus.js"></script>

<!-- 3. Low-dependency systems -->
<script src="js/save-manager.js"></script>
<script src="js/audio-manager.js"></script>
<script src="js/tween-engine.js"></script>
<script src="js/input-manager.js"></script>

<!-- 4. Rendering (depends on THREE + config) -->
<script src="js/renderer.js"></script>

<!-- 5. Game systems (depend on renderer + event bus) -->
<script src="js/location-manager.js"></script>
<script src="js/fish-spawner.js"></script>
<script src="js/fishing-system.js"></script>
<script src="js/daily-system.js"></script>
<script src="js/shop-system.js"></script>

<!-- 6. UI (depends on event bus) -->
<script src="js/ui-manager.js"></script>

<!-- 7. Top-level orchestrator -->
<script src="js/game-manager.js"></script>

<!-- 8. Bootstrap -->
<script>
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameManager();
  });
</script>
```

### 1.3 No Build Step (MVP)

For Phase 1, there is **no bundler, no transpiler, no minifier**. All files are plain `.js` loaded via `<script>` tags. This keeps development velocity high and avoids toolchain complexity.

**Phase 2 option**: Rollup or esbuild to bundle into a single minified file for production.

### 1.4 Module Pattern

All "modules" use the **IIFE + global namespace** pattern (ES5-compatible, no import/export):

```javascript
// js/fishing-system.js
var FishingSystem = (function() {
  // Private state
  var _state = 'idle';
  var _tension = 0;
  
  // Constructor
  function FishingSystem(eventBus, fishSpawner, audioManager) {
    this.eventBus = eventBus;
    this.fishSpawner = fishSpawner;
    this.audioManager = audioManager;
    this._setupListeners();
  }
  
  // Public API
  FishingSystem.prototype.startCast = function() { /* ... */ };
  FishingSystem.prototype.releaseCast = function(power) { /* ... */ };
  FishingSystem.prototype.update = function(dt) { /* ... */ };
  
  // Private methods
  function _calculateTension(isReeling, dt) { /* ... */ }
  function _determineCatchQuality(tensionHistory) { /* ... */ }
  
  return FishingSystem;
})();
```

> **Note**: All modules expose a single global constructor. The `GameManager` wires them together.

---

## 2. Component API Specifications

### 2.1 EventBus

```javascript
/**
 * Lightweight pub/sub event system.
 * No external dependencies.
 */
function EventBus() {
  this._listeners = {};  // { eventName: [callback1, callback2, ...] }
}

/**
 * Subscribe to an event.
 * @param {string} event - Event name (e.g., 'fishing:catch')
 * @param {Function} callback - Called with (data) when event fires
 * @returns {Function} Unsubscribe function
 */
EventBus.prototype.on = function(event, callback) {
  if (!this._listeners[event]) this._listeners[event] = [];
  this._listeners[event].push(callback);
  return () => this.off(event, callback);
};

/**
 * Unsubscribe from an event.
 */
EventBus.prototype.off = function(event, callback) {
  if (!this._listeners[event]) return;
  this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
};

/**
 * Emit an event to all subscribers.
 * @param {string} event
 * @param {*} data - Optional data payload
 */
EventBus.prototype.emit = function(event, data) {
  if (!this._listeners[event]) return;
  for (var i = 0; i < this._listeners[event].length; i++) {
    try {
      this._listeners[event][i](data);
    } catch (e) {
      console.error('[EventBus] Error in listener for "' + event + '":', e);
    }
  }
};
```

### 2.2 SaveManager

```javascript
function SaveManager(eventBus) {
  this.eventBus = eventBus;
  this.SAVE_KEY_PREFIX = 'soulsanctuary_save_';
  this.AUTO_SAVE_INTERVAL = 60;  // seconds
  this._lastAutoSave = 0;
}

/**
 * Save game data to localStorage.
 * @param {number} slot - Save slot (0-2)
 * @param {SaveData} data
 * @returns {boolean} Success
 */
SaveManager.prototype.save = function(slot, data) {
  data.lastSaveTimestamp = Date.now();
  try {
    var json = JSON.stringify(data);
    localStorage.setItem(this.SAVE_KEY_PREFIX + slot, json);
    this.eventBus.emit('save:commit', { slot: slot });
    return true;
  } catch (e) {
    console.error('[SaveManager] Save failed:', e);
    this.eventBus.emit('ui:show_notification', {
      message: '保存失败，请检查浏览器存储空间',
      type: 'error'
    });
    return false;
  }
};

/**
 * Load game data from localStorage.
 * @param {number} slot
 * @returns {SaveData|null}
 */
SaveManager.prototype.load = function(slot) {
  try {
    var raw = localStorage.getItem(this.SAVE_KEY_PREFIX + slot);
    if (!raw) return null;
    var data = JSON.parse(raw);
    return this._migrate(data);
  } catch (e) {
    console.error('[SaveManager] Load failed:', e);
    return null;
  }
};

/**
 * Delete a save slot.
 */
SaveManager.prototype.deleteSlot = function(slot) {
  localStorage.removeItem(this.SAVE_KEY_PREFIX + slot);
};

/**
 * Get all save slot metadata (for save/load UI).
 * @returns {Array<{slot: number, exists: boolean, level: number, timestamp: number}>}
 */
SaveManager.prototype.listSlots = function() {
  var slots = [];
  for (var i = 0; i < 3; i++) {
    var data = this.load(i);
    slots.push({
      slot: i,
      exists: data !== null,
      level: data ? data.player.level : 0,
      timestamp: data ? data.lastSaveTimestamp : 0
    });
  }
  return slots;
};

/**
 * Schema migration (handles future version changes).
 * @private
 */
SaveManager.prototype._migrate = function(data) {
  if (!data.version) {
    // v0 → v1: Initial migration
    data.player.spiritEssence = data.player.spiritEssence || 0;
    data.player.sanctuaryTokens = data.player.sanctuaryTokens || 0;
    data.version = 1;
  }
  // Future migrations here...
  return data;
};

/**
 * Create default save data for new game.
 * @returns {SaveData}
 */
SaveManager.prototype.createDefault = function() {
  return {
    version: 1,
    lastSaveTimestamp: Date.now(),
    player: {
      name: 'Soul Angler',
      level: 1,
      xp: 0,
      gold: 100,
      spiritEssence: 0,
      sanctuaryTokens: 0
    },
    gear: {
      equippedRodId: 'bamboo',
      equippedLineId: 'cotton',
      ownedRods: ['bamboo'],
      ownedLines: ['cotton']
    },
    inventory: {
      baits: { 'worm': 999 },
      fishStorage: []
    },
    fishpedia: {},
    progress: {
      unlockedLocations: ['japan'],
      completedLocations: [],
      totalFishCaught: 0,
      achievements: []
    },
    dailies: {
      lastRefreshDate: '',
      completedQuests: [],
      streakDays: 0,
      freeBaitClaimed: false
    },
    stats: {
      totalCasts: 0,
      totalCatches: 0,
      perfectCatches: 0,
      lineBreaks: 0,
      longestCast: 0,
      biggestFish: null
    }
  };
};
```

### 2.3 FishingSystem

```javascript
/**
 * Core fishing state machine.
 * Manages: IDLE → CASTING → WAITING → HOOKING → REELING → CATCH/ESCAPE
 */
function FishingSystem(eventBus, fishSpawner, audioManager) {
  this.eventBus = eventBus;
  this.fishSpawner = fishSpawner;
  this.audioManager = audioManager;
  
  // State
  this.state = 'idle';  // FishingState enum
  this.castPower = 0;
  this.waitTimer = 0;
  this.waitDuration = 0;
  this.hookTimer = 0;
  this.hookWindow = 0;
  this.tension = 0;
  this.fishProgress = 0;
  this.lineDurability = 100;
  this.hookedFish = null;
  this.currentBait = 'worm';
  this.tensionHistory = [];  // For catch quality calculation
  
  this._setupListeners();
}

FishingSystem.prototype._setupListeners = function() {
  var self = this;
  this.eventBus.on('input:down', function() { self._onInputDown(); });
  this.eventBus.on('input:up', function(data) { self._onInputUp(data); });
};

FishingSystem.prototype._onInputDown = function() {
  if (this.state === 'idle') {
    this.startCast();
  }
};

FishingSystem.prototype._onInputUp = function(data) {
  if (this.state === 'casting') {
    this.releaseCast(data.holdDuration);
  } else if (this.state === 'hooking') {
    this.attemptHook();
  }
};

/**
 * Begin charging the cast power meter.
 */
FishingSystem.prototype.startCast = function() {
  this.state = 'casting';
  this.castPower = 0;
  this.eventBus.emit('fishing:cast_start', {});
  this.audioManager.playSound('cast_charge');
};

/**
 * Release the cast at current power level.
 * @param {number} holdDuration - Seconds the player held
 */
FishingSystem.prototype.releaseCast = function(holdDuration) {
  // Power: linear from hold duration, capped at 1.0 at 2 seconds
  this.castPower = Math.min(holdDuration / 2.0, 1.0);
  
  if (this.castPower > 0.9) {
    // Overshoot: line snap
    this._lineBreak('overshoot');
    return;
  }
  
  this.state = 'waiting';
  this.eventBus.emit('fishing:cast', {
    power: this.castPower,
    bait: this.currentBait
  });
  this.audioManager.playSound('cast_splash');
  
  // Calculate wait time: 2-10s, affected by bait
  this.waitDuration = 2 + Math.random() * 8;
  if (BAITS[this.currentBait].rareBonus > 1.0) {
    this.waitDuration *= 0.8;  // Better bait = faster bite
  }
  this.waitTimer = 0;
};

/**
 * Called every frame during WAITING state.
 * @param {number} dt - Delta time in seconds
 */
FishingSystem.prototype._tickWaiting = function(dt) {
  this.waitTimer += dt;
  
  // Random nibble events
  if (Math.random() < 0.003) {  // ~0.3% per frame at 60fps
    this.eventBus.emit('fishing:nibble', {});
    this.audioManager.playSound('nibble', Math.random() * 0.05);
  }
  
  // Fish bites when timer exceeds wait duration
  if (this.waitTimer >= this.waitDuration) {
    this._onBite();
  }
};

/**
 * A fish has bitten the hook.
 */
FishingSystem.prototype._onBite = function() {
  this.state = 'hooking';
  
  // Determine which fish
  this.hookedFish = this.fishSpawner.rollFish(
    this.currentLocation,
    this.currentBait,
    this.castPower
  );
  
  // Hook window: base 1.2s, shorter for rarer fish
  var rarityMultipliers = { common: 1.0, uncommon: 0.9, rare: 0.7, legendary: 0.5, mythic: 0.3 };
  this.hookWindow = 1.2 * (rarityMultipliers[this.hookedFish.rarity] || 1.0);
  this.hookTimer = 0;
  
  this.eventBus.emit('fishing:bite', { fish: this.hookedFish });
  this.audioManager.playSound('bite');
  
  // Visual: bobber dunks, ripple ring
};

/**
 * Player attempts to set the hook (clicks during HOOKING state).
 */
FishingSystem.prototype.attemptHook = function() {
  if (this.hookTimer > this.hookWindow) {
    // Too late!
    this._fishEscaped('missed_hook');
    return;
  }
  
  // Hook set! Begin reeling.
  this.state = 'reeling';
  this.tension = 0;
  this.fishProgress = 0;
  this.lineDurability = 100;
  this.tensionHistory = [];
  
  this.eventBus.emit('fishing:hook_set', { fish: this.hookedFish });
  this.audioManager.playSound('hook_set');
};

/**
 * Called every frame during REELING state.
 * @param {number} dt
 * @param {boolean} isReeling - Is the player holding the reel button?
 */
FishingSystem.prototype.tickReel = function(dt, isReeling) {
  if (this.state !== 'reeling') return;
  
  if (isReeling) {
    this.tension += BALANCE.tensionIncreaseRate * dt;
  } else {
    this.tension -= BALANCE.tensionDecreaseRate * dt;
  }
  this.tension = Math.max(0, Math.min(100, this.tension));
  
  // Fish pulls based on its behavior
  var fishPull = this._calculateFishPull(dt);
  this.tension += fishPull;
  this.tension = Math.max(0, Math.min(100, this.tension));
  
  // Line wear in red zone
  if (this.tension > 75) {
    this.lineDurability -= BALANCE.lineWearRate * dt;
  }
  
  // Fish progress: faster in green, slower in red
  var progressRate = BALANCE.fishProgressRate;
  if (this.tension < 40) {
    progressRate *= BALANCE.fishProgressGreenMult;
  } else if (this.tension < 75) {
    progressRate *= BALANCE.fishProgressYellowMult;
  } else {
    progressRate *= BALANCE.fishProgressRedMult;
  }
  this.fishProgress += progressRate * dt;
  
  // Record tension for quality calc
  this.tensionHistory.push(this.tension);
  
  // Check win/lose
  if (this.fishProgress >= 100) {
    this._fishCaught();
  } else if (this.lineDurability <= 0) {
    this._lineBreak('tension');
  }
  
  // Audio feedback based on tension
  if (this.tension > 80) {
    this.audioManager.setReelWarning(true);
  } else {
    this.audioManager.setReelWarning(false);
  }
  
  this.eventBus.emit('fishing:reel_update', {
    tension: this.tension,
    fishProgress: this.fishProgress,
    lineDurability: this.lineDurability,
    fish: this.hookedFish
  });
};

/**
 * Calculate how much the fish pulls based on its behavior profile.
 * @private
 */
FishingSystem.prototype._calculateFishPull = function(dt) {
  var behavior = this.hookedFish.behavior;
  var pull = 0;
  
  switch (behavior.type) {
    case 'steady':
      pull = behavior.pullStrength * dt * 5;
      break;
    case 'sprint':
      // Burst pattern
      pull = behavior.pullStrength * dt * 5;
      if (Math.random() < behavior.burstChance * dt * 2) {
        pull += behavior.burstStrength * 0.5;
      }
      break;
    case 'zigzag':
      pull = Math.sin(performance.now() * 0.005) * behavior.pullStrength * dt * 10;
      break;
    case 'deep_diver':
      pull = behavior.pullStrength * dt * 8;
      break;
    case 'surface_jumper':
      // Mostly low pull, occasional spikes
      pull = Math.random() < 0.02 ? behavior.burstStrength : behavior.pullStrength * dt * 2;
      break;
    default:
      pull = 2 * dt;
  }
  
  return pull;
};

/**
 * Fish successfully caught!
 */
FishingSystem.prototype._fishCaught = function() {
  this.state = 'catch';
  
  // Calculate size
  var size = this.hookedFish.size.min +
    Math.random() * (this.hookedFish.size.max - this.hookedFish.size.min);
  
  // Calculate catch quality
  var quality = this._determineCatchQuality();
  
  // Calculate gold
  var goldMultiplier = quality === 'perfect' ? 1.5 : quality === 'struggle' ? 0.5 : 1.0;
  var gold = Math.floor(this.hookedFish.baseGold * goldMultiplier);
  
  // Spirit variant check (2%)
  var isSpiritVariant = Math.random() < 0.02;
  if (isSpiritVariant) gold *= 3;
  
  this.eventBus.emit('fishing:catch', {
    fish: this.hookedFish,
    size: size,
    quality: quality,
    gold: gold,
    isSpiritVariant: isSpiritVariant
  });
  
  this.audioManager.playSound(isSpiritVariant ? 'catch_rare' : 'catch_success');
  
  // Reset to idle after animation
  setTimeout(this._resetToIdle.bind(this), 2000);
};

/**
 * Determine catch quality based on tension history.
 * @returns {'perfect'|'standard'|'struggle'}
 */
FishingSystem.prototype._determineCatchQuality = function() {
  var maxTension = Math.max.apply(null, this.tensionHistory);
  if (maxTension < 40) return 'perfect';
  if (maxTension < 75) return 'standard';
  return 'struggle';
};

FishingSystem.prototype._fishEscaped = function(reason) {
  this.state = 'escape';
  this.eventBus.emit('fishing:escape', {
    fish: this.hookedFish,
    reason: reason
  });
  this.audioManager.playSound('escape');
  setTimeout(this._resetToIdle.bind(this), 1500);
};

FishingSystem.prototype._lineBreak = function(reason) {
  this.state = 'escape';
  this.eventBus.emit('fishing:line_break', { reason: reason });
  this.audioManager.playSound('line_break');
  setTimeout(this._resetToIdle.bind(this), 1500);
};

FishingSystem.prototype._resetToIdle = function() {
  this.state = 'idle';
  this.hookedFish = null;
  this.eventBus.emit('fishing:idle', {});
};

/**
 * Main update called each frame.
 */
FishingSystem.prototype.update = function(dt) {
  switch (this.state) {
    case 'casting':
      this.castPower = Math.min(this.castPower + dt / 2.0, 1.0);
      this.eventBus.emit('fishing:cast_update', { power: this.castPower });
      break;
    case 'waiting':
      this._tickWaiting(dt);
      break;
    case 'hooking':
      this.hookTimer += dt;
      if (this.hookTimer > this.hookWindow) {
        this._fishEscaped('missed_hook');
      }
      this.eventBus.emit('fishing:hook_update', {
        timer: this.hookTimer,
        window: this.hookWindow
      });
      break;
    case 'reeling':
      // isReeling comes from InputManager
      this.tickReel(dt, InputManager.isHolding);
      break;
  }
};
```

### 2.4 FishSpawner

```javascript
function FishSpawner(eventBus) {
  this.eventBus = eventBus;
}

/**
 * Roll for a fish at the current location with given conditions.
 * @param {string} locationId
 * @param {string} baitId
 * @param {number} castPower - 0-1
 * @returns {SpiritFish}
 */
FishSpawner.prototype.rollFish = function(locationId, baitId, castPower) {
  // 1. Get candidate fish pool
  var candidates = this._getCandidates(locationId, baitId);
  
  // 2. Build weighted table
  var table = this._buildWeightedTable(candidates, baitId, castPower);
  
  // 3. Roll
  return table.roll();
};

FishSpawner.prototype._getCandidates = function(locationId, baitId) {
  var timeWindow = this.getCurrentTimeWindow();
  var weather = this.getCurrentWeather(locationId);
  var season = this.getCurrentSeason();
  var baitConfig = BAITS[baitId];
  
  return FISH_DATABASE.filter(function(fish) {
    if (fish.location !== locationId) return false;
    if (fish.timeWindows.indexOf(timeWindow) === -1) return false;
    if (fish.weatherRequired && fish.weatherRequired.indexOf(weather) === -1) return false;
    if (fish.seasonRequired && fish.seasonRequired.indexOf(season) === -1) return false;
    if (fish.baitRequired && fish.baitRequired.indexOf(baitId) === -1) return false;
    return true;
  });
};

FishSpawner.prototype._buildWeightedTable = function(candidates, baitId, castPower) {
  var baitConfig = BAITS[baitId];
  var entries = [];
  var totalWeight = 0;
  
  var rarityWeights = {
    common: 45,
    uncommon: 30,
    rare: 15,
    legendary: 8,
    mythic: 2
  };
  
  for (var i = 0; i < candidates.length; i++) {
    var fish = candidates[i];
    var weight = rarityWeights[fish.rarity] || 45;
    
    // Bait modifier
    if (baitConfig.rareBonus && fish.rarity !== 'common') {
      weight *= baitConfig.rareBonus;
    }
    
    // Cast power bonus in optimal range
    if (castPower >= 0.4 && castPower <= 0.7) {
      weight *= 1.15;
    }
    
    entries.push({ fish: fish, weight: weight });
    totalWeight += weight;
  }
  
  return {
    entries: entries,
    totalWeight: totalWeight,
    roll: function() {
      var roll = Math.random() * this.totalWeight;
      var cumulative = 0;
      for (var i = 0; i < this.entries.length; i++) {
        cumulative += this.entries[i].weight;
        if (roll <= cumulative) {
          return this.entries[i].fish;
        }
      }
      return this.entries[this.entries.length - 1].fish;  // Fallback
    }
  };
};

/**
 * Determine current time window based on real clock.
 * @returns {'dawn'|'day'|'dusk'|'night'}
 */
FishSpawner.prototype.getCurrentTimeWindow = function() {
  var hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
};

/**
 * Current season (meteorological).
 */
FishSpawner.prototype.getCurrentSeason = function() {
  var month = new Date().getMonth();  // 0-11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
};

/**
 * Get weather for location. For MVP, uses a simple random-per-session model.
 * Phase 2: real API or more sophisticated simulation.
 */
FishSpawner.prototype.getCurrentWeather = function(locationId) {
  // Session-consistent pseudo-random weather
  var weatherPool = STATIONS.find(function(s) { return s.id === locationId; }).weatherPool;
  // Use date as seed for daily-consistent weather
  var seed = new Date().toDateString() + locationId;
  var hash = this._simpleHash(seed);
  return weatherPool[hash % weatherPool.length];
};

FishSpawner.prototype._simpleHash = function(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;  // Convert to 32bit integer
  }
  return Math.abs(hash);
};
```

### 2.5 UI Manager

```javascript
function UIManager(eventBus) {
  this.eventBus = eventBus;
  this._elements = {};
  this._cacheDOMElements();
  this._setupListeners();
  this._hideAllModals();
}

UIManager.prototype._cacheDOMElements = function() {
  this._elements = {
    // HUD
    goldDisplay: document.getElementById('gold-display'),
    essenceDisplay: document.getElementById('essence-display'),
    levelDisplay: document.getElementById('level-display'),
    xpBar: document.getElementById('xp-bar'),
    locationName: document.getElementById('location-name'),
    baitDisplay: document.getElementById('bait-display'),
    
    // Fishing UI
    tensionBar: document.getElementById('tension-bar'),
    tensionFill: document.getElementById('tension-fill'),
    tensionValue: document.getElementById('tension-value'),
    fishProgressBar: document.getElementById('fish-progress-bar'),
    fishProgressFill: document.getElementById('fish-progress-fill'),
    castPowerBar: document.getElementById('cast-power-bar'),
    castPowerFill: document.getElementById('cast-power-fill'),
    fishNameLabel: document.getElementById('fish-name-label'),
    
    // Modals
    fishpediaModal: document.getElementById('fishpedia-modal'),
    shopModal: document.getElementById('shop-modal'),
    locationSelectModal: document.getElementById('location-select-modal'),
    
    // Notification
    notification: document.getElementById('notification'),
    
    // Buttons
    btnFishpedia: document.getElementById('btn-fishpedia'),
    btnShop: document.getElementById('btn-shop'),
    btnLocation: document.getElementById('btn-location'),
    btnSettings: document.getElementById('btn-settings'),
  };
};

UIManager.prototype._setupListeners = function() {
  var self = this;
  
  // Button clicks
  this._elements.btnFishpedia.addEventListener('click', function() {
    self.showFishpedia();
  });
  this._elements.btnShop.addEventListener('click', function() {
    self.showShop();
  });
  this._elements.btnLocation.addEventListener('click', function() {
    self.showLocationSelect();
  });
  
  // Fishing events → UI updates
  this.eventBus.on('fishing:cast_update', function(data) {
    self.updateCastPowerBar(data.power);
  });
  this.eventBus.on('fishing:reel_update', function(data) {
    self.updateTensionBar(data.tension);
    self.updateFishProgressBar(data.fishProgress);
    if (data.fish) {
      self._elements.fishNameLabel.textContent = data.fish.name.zh;
    }
  });
  this.eventBus.on('fishing:idle', function() {
    self.hideFishingUI();
  });
  this.eventBus.on('fishing:catch', function(data) {
    self.showCatchResult(data);
  });
  this.eventBus.on('game:gold_change', function(data) {
    self.updateGold(data.amount);
  });
  this.eventBus.on('game:xp_gain', function(data) {
    self.updateXP(data);
  });
  this.eventBus.on('ui:show_notification', function(data) {
    self.showNotification(data.message, data.type);
  });
};

UIManager.prototype.updateTensionBar = function(tension) {
  var pct = Math.round(tension);
  this._elements.tensionFill.style.width = pct + '%';
  this._elements.tensionValue.textContent = pct + '%';
  
  // Color zones
  if (tension < 40) {
    this._elements.tensionFill.style.backgroundColor = '#48bb78';  // Green
  } else if (tension < 75) {
    this._elements.tensionFill.style.backgroundColor = '#ecc94b';  // Yellow
  } else {
    this._elements.tensionFill.style.backgroundColor = '#fc8181';  // Red
  }
  
  // Show/hide
  this._elements.tensionBar.style.display = 'block';
};

UIManager.prototype.showNotification = function(message, type) {
  var notif = this._elements.notification;
  notif.textContent = message;
  notif.className = 'notification notification-' + (type || 'info');
  notif.style.display = 'block';
  notif.style.opacity = '1';
  
  setTimeout(function() {
    notif.style.opacity = '0';
    setTimeout(function() { notif.style.display = 'none'; }, 300);
  }, 2500);
};

// ... more UI methods for fishpedia, shop, location select, etc.
```

---

## 3. Data Flow Diagrams

### 3.1 Cast → Catch Data Flow

```
┌──────────┐    input:down     ┌───────────────┐
│  Input   │ ───────────────▶  │ FishingSystem │
│  Manager │                   │  .startCast() │
└──────────┘                   └───────┬───────┘
                                emit  │
                        'fishing:cast_start'
                                      ▼
┌──────────┐    input:up       ┌───────────────┐
│  Input   │ ───────────────▶  │ FishingSystem │
│  Manager │   {holdDuration}  │ .releaseCast()│
└──────────┘                   └───────┬───────┘
                                emit  │
                         'fishing:cast'
                                       │
                         ┌─────────────┼─────────────┐
                         ▼             ▼             ▼
                   ┌──────────┐ ┌───────────┐ ┌──────────┐
                   │UIManager │ │AudioMgr   │ │Renderer  │
                   │hide cast │ │play splash│ │animate   │
                   │power bar │ │sound      │ │bobber    │
                   └──────────┘ └───────────┘ └──────────┘

    ... wait phase ... nibbles ... then:

                   ┌───────────────┐
                   │ FishingSystem │
                   │  ._onBite()   │
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │ FishSpawner   │
                   │ .rollFish()   │
                   └───────┬───────┘
                           │ returns SpiritFish
                           ▼
                   ┌───────────────┐
                   │ FishingSystem │  emit 'fishing:bite'
                   │ state=hooking │ ──────────────┐
                   └───────────────┘               │
                                                   ▼
                                           ┌───────────────┐
                                           │ UIManager     │
                                           │ show hook     │
                                           │ indicator     │
                                           └───────────────┘

    ... player clicks during hook window ...

                   ┌───────────────┐
                   │ FishingSystem │  state=reeling
                   │ .attemptHook()│
                   └───────┬───────┘
                           │ emit 'fishing:hook_set'
                   ┌───────┴───────┐
                   ▼               ▼
            ┌──────────┐    ┌──────────┐
            │UIManager │    │Renderer  │
            │show      │    │show fish │
            │tension UI│    │silhouette│
            └──────────┘    └──────────┘

    ... reeling phase: each frame update tension + progress ...

                   ┌───────────────┐
                   │ FishingSystem │  fishProgress >= 100
                   │._fishCaught() │
                   └───────┬───────┘
                           │ emit 'fishing:catch'
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────┐    ┌──────────────┐  ┌──────────────┐
   │UIManager │    │ GameManager  │  │ AudioManager │
   │show catch│    │ addGold()    │  │ play success │
   │result    │    │ addXP()      │  │ sound        │
   │animation │    │ updatePedia()│  └──────────────┘
   └──────────┘    │ save()       │
                   └──────────────┘
```

### 3.2 Game Initialization Flow

```
DOMContentLoaded
       │
       ▼
┌──────────────┐
│ GameManager  │
│ constructor()│
└──────┬───────┘
       │
       ├──▶ new EventBus()
       ├──▶ new SaveManager(eventBus)
       │       └── load(0) or createDefault()
       ├──▶ new AudioManager(eventBus)
       │       └── AudioContext.resume() on first user interaction
       ├──▶ new InputManager(canvas, eventBus)
       ├──▶ new GameRenderer(eventBus)
       │       └── THREE.js setup (400×300)
       ├──▶ new LocationManager(eventBus, renderer)
       ├──▶ new FishSpawner(eventBus)
       ├──▶ new FishingSystem(eventBus, fishSpawner, audioManager)
       ├──▶ new DailySystem(eventBus)
       ├──▶ new ShopSystem(eventBus)
       ├──▶ new UIManager(eventBus)
       │
       └──▶ changeLocation(saveData.progress.unlockedLocations[0])
              └── locationManager.buildLocation('japan')
              └── emit 'game:location_change'
              └── startRenderLoop()
```

---

## 4. Detailed Algorithm Specifications

### 4.1 Tension-Based Mini-Game (Pseudocode)

```
ALGORITHM: Update Fishing Tension
INPUT: deltaTime (seconds), playerIsReeling (boolean), fishBehavior
OUTPUT: tension (0-100), fishProgress (0-100), lineDurability (0-100)

CONSTANTS:
  REEL_RATE = 12        // tension increase per second when reeling
  SLACK_RATE = 8        // tension decrease per second when not reeling
  LINE_WEAR_RATE = 3    // durability loss per second in red zone (>75%)
  BASE_PROGRESS = 8     // fish progress per second
  GREEN_MULT = 1.2      // progress multiplier in green zone (0-40%)
  YELLOW_MULT = 0.8     // progress multiplier in yellow zone (40-75%)
  RED_MULT = 0.3        // progress multiplier in red zone (75-100%)

1. UPDATE TENSION:
   IF playerIsReeling:
     tension += REEL_RATE * dt
   ELSE:
     tension -= SLACK_RATE * dt
   CLAMP tension to [0, 100]

2. APPLY FISH PULL:
   fishPull = calculateFishPull(fishBehavior, dt)
   tension += fishPull
   CLAMP tension to [0, 100]

3. UPDATE LINE DURABILITY:
   IF tension > 75:
     lineDurability -= LINE_WEAR_RATE * dt

4. DETERMINE ZONE:
   IF tension < 40:     zone = GREEN
   ELSE IF tension < 75: zone = YELLOW
   ELSE:                 zone = RED

5. UPDATE FISH PROGRESS:
   multiplier = (GREEN: GREEN_MULT, YELLOW: YELLOW_MULT, RED: RED_MULT)
   fishProgress += BASE_PROGRESS * multiplier[zone] * dt

6. CHECK TERMINATION:
   IF fishProgress >= 100: return CATCH
   IF lineDurability <= 0: return LINE_BREAK
   IF tension >= 100:      return LINE_BREAK
   ELSE:                   return CONTINUE
```

### 4.2 Fish Pull Calculation (Per Behavior Type)

```
ALGORITHM: calculateFishPull
INPUT: behavior, deltaTime
OUTPUT: pullForce (adds to tension)

SWITCH behavior.type:
  CASE 'steady':
    return behavior.pullStrength * 5 * dt

  CASE 'sprint':
    basePull = behavior.pullStrength * 5 * dt
    IF random() < behavior.burstChance * dt * 2:
      basePull += behavior.burstStrength * 0.5
    return basePull

  CASE 'lazy':
    return behavior.pullStrength * 2 * dt

  CASE 'zigzag':
    return abs(sin(time * 5)) * behavior.pullStrength * 10 * dt

  CASE 'deep_diver':
    return behavior.pullStrength * 8 * dt

  CASE 'surface_jumper':
    IF random() < 0.02:
      return behavior.burstStrength  // sudden spike
    ELSE:
      return behavior.pullStrength * 2 * dt

  DEFAULT:
    return 2 * dt
```

### 4.3 Procedural Fish Mesh Generation

```
ALGORITHM: generateFishMesh
INPUT: modelConfig { bodyType, finStyle, scale }, colorPalette, size
OUTPUT: THREE.Group (low-poly fish model)

CREATE group = new THREE.Group()

SWITCH bodyType:
  CASE 'koi':
    // Elongated body
    ADD box(size * 1.2, size * 0.4, size * 0.3, colorPalette[0])
    // Tail fin (rotated box)
    tail = box(size * 0.5, size * 0.3, 0.05, colorPalette[1])
    tail.rotation.y = 0.4
    tail.position.x = -size * 0.6
    ADD tail
    // Dorsal fin
    ADD box(size * 0.3, 0.05, size * 0.2, colorPalette[2]) at y = size * 0.25
    // Pectoral fins (2)
    FOR side in [LEFT, RIGHT]:
      fin = box(size * 0.2, 0.04, size * 0.35, colorPalette[1])
      fin.rotation.z = side === LEFT ? 0.4 : -0.4
      fin.position.set(size * 0.1, -size * 0.15, side * size * 0.25)
      ADD fin

  CASE 'eel':
    segmentCount = config.segments || 6
    FOR i = 0 TO segmentCount - 1:
      segSize = size * (1 - i * 0.08)
      ADD box(segSize * 0.3, segSize * 0.3, segSize * 0.3, colorPalette[i % len])
        at z = -i * size * 0.15

  CASE 'ray':
    // Flat diamond body
    ADD box(size * 1.5, size * 0.1, size * 1.0, colorPalette[0])
    // Wing flaps
    ADD box(size * 0.1, size * 0.05, size * 1.5, colorPalette[1])

  CASE 'angler':
    // Round body
    ADD box(size * 0.8, size * 0.6, size * 0.8, colorPalette[0])
    // Large mouth
    ADD box(size * 0.3, size * 0.2, size * 0.4, colorPalette[2]) at x = size * 0.4
    // Lure/antenna
    ADD box(size * 0.05, size * 0.04, size * 0.5, colorPalette[1]) at x = size * 0.4, y = size * 0.45

// EYES (common to all fish)
eyeMat = MeshBasicMaterial(0xffffff)
ADD box(size * 0.06, size * 0.06, size * 0.06, eyeMat) at (size * 0.4, size * 0.1, size * 0.1)
ADD box(size * 0.06, size * 0.06, size * 0.06, eyeMat) at (size * 0.4, size * 0.1, -size * 0.1)
// Pupils
ADD box(size * 0.03, size * 0.03, size * 0.03, 0x000000) at (size * 0.43, size * 0.1, size * 0.1)
ADD box(size * 0.03, size * 0.03, size * 0.03, 0x000000) at (size * 0.43, size * 0.1, -size * 0.1)

APPLY group.scale.setScalar(config.scale)
RETURN group
```

### 4.4 Daily Refresh Algorithm

```
ALGORITHM: Check Daily Refresh
INPUT: lastRefreshDate (string 'YYYY-MM-DD')
OUTPUT: boolean (whether refresh occurred)

today = new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'

IF lastRefreshDate !== today:
  1. Generate 3 new daily quests:
     For each quest slot:
       - Random location from unlocked set
       - Random objective: 'catch_N_fish' | 'catch_rarity_X' | 'catch_in_weather_Y'
       - Random reward: 100-300 gold + 10-30 essence

  2. Select daily hotspot location:
     hotspot = random(unlockedLocations)
     → +25% rare fish spawn rate for 24 hours

  3. Reset free bait claim:
     freeBaitClaimed = false

  4. Update streak:
     yesterday = date - 1 day
     IF lastRefreshDate === yesterday:
       streakDays++
     ELSE:
       streakDays = 1

  5. IF streakDays === 7:
       Grant Golden Cricket ×1
       streakDays = 0

  6. lastRefreshDate = today
  7. RETURN true

RETURN false
```

---

## 5. UI Component Tree & DOM Structure

### 5.1 Complete DOM Tree

```html
<body>
  <!-- ===== THREE.js Canvas (auto-appended by renderer) ===== -->
  <canvas id="game-canvas"></canvas>

  <!-- ===== HUD Overlay (position: absolute over canvas) ===== -->
  <div id="hud-container">
    
    <!-- Top Bar -->
    <div id="top-bar">
      <div id="currency-display">
        <span id="gold-display">🪙 100</span>
        <span id="essence-display">✨ 0</span>
        <span id="token-display">🏛️ 0</span>
      </div>
      <div id="level-display">
        <span id="level-text">Lv.1</span>
        <div id="xp-bar-container">
          <div id="xp-bar-fill"></div>
        </div>
      </div>
      <div id="location-name">京都 · 樱落神社</div>
    </div>

    <!-- Center: Fishing UI (hidden when idle) -->
    <div id="fishing-ui" style="display:none;">
      <!-- Cast Power Meter (shown during charging) -->
      <div id="cast-power-container" style="display:none;">
        <div id="cast-power-label">CAST POWER</div>
        <div id="cast-power-bar">
          <div id="cast-power-fill"></div>
          <div id="cast-power-zones">
            <span class="zone zone-short">SHORT</span>
            <span class="zone zone-optimal">OPTIMAL</span>
            <span class="zone zone-long">LONG</span>
          </div>
        </div>
      </div>

      <!-- Hook Indicator (shown during hooking window) -->
      <div id="hook-indicator" style="display:none;">
        <div id="hook-ring"></div>
        <div id="hook-timer-fill"></div>
        <span id="hook-label">!</span>
      </div>

      <!-- Tension Bar (shown during reeling) -->
      <div id="tension-bar" style="display:none;">
        <div id="tension-label">TENSION</div>
        <div id="tension-bar-track">
          <div id="tension-fill"></div>
          <div id="tension-zones">
            <span class="zone zone-green">SAFE</span>
            <span class="zone zone-yellow">CAUTION</span>
            <span class="zone zone-red">DANGER</span>
          </div>
        </div>
        <div id="tension-value">0%</div>
      </div>

      <!-- Fish Info (shown during reeling) -->
      <div id="fish-info" style="display:none;">
        <span id="fish-name-label">???</span>
        <span id="fish-rarity-label"></span>
      </div>

      <!-- Fish Progress Bar (shown during reeling) -->
      <div id="fish-progress-bar" style="display:none;">
        <div id="fish-progress-fill"></div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div id="bottom-bar">
      <div id="bait-display">
        <span id="bait-icon">🪱</span>
        <span id="bait-name">Basic Worm</span>
        <span id="bait-count">∞</span>
      </div>
      <div id="action-buttons">
        <button id="btn-fishpedia" class="btn-icon">📖</button>
        <button id="btn-shop" class="btn-icon">🛒</button>
        <button id="btn-location" class="btn-icon">🌍</button>
        <button id="btn-settings" class="btn-icon">⚙️</button>
      </div>
      <div id="control-hint">🖱️ HOLD & RELEASE TO CAST</div>
    </div>
  </div>

  <!-- ===== Notification Toast ===== -->
  <div id="notification" style="display:none;"></div>

  <!-- ===== Modals (hidden by default) ===== -->
  
  <!-- Fishpedia Modal -->
  <div id="fishpedia-modal" class="modal" style="display:none;">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>🐟 SOUL FISHPEDIA</h2>
        <span id="fishpedia-progress">47/141 · 33%</span>
        <button class="btn-close">✕</button>
      </div>
      <div class="modal-body">
        <div id="fishpedia-grid">
          <!-- Dynamically populated fish cards -->
        </div>
        <div id="fishpedia-detail" style="display:none;">
          <!-- Selected fish detail view -->
        </div>
      </div>
    </div>
  </div>

  <!-- Shop Modal -->
  <div id="shop-modal" class="modal" style="display:none;">
    <!-- Similar structure -->
  </div>

  <!-- Location Select Modal -->
  <div id="location-select-modal" class="modal" style="display:none;">
    <!-- Similar structure -->
  </div>

  <!-- Settings Modal -->
  <div id="settings-modal" class="modal" style="display:none;">
    <!-- Similar structure -->
  </div>
</body>
```

### 5.2 Modal System

```javascript
UIManager.prototype._hideAllModals = function() {
  var modals = ['fishpedia-modal', 'shop-modal', 'location-select-modal', 'settings-modal'];
  for (var i = 0; i < modals.length; i++) {
    var modal = document.getElementById(modals[i]);
    if (modal) modal.style.display = 'none';
  }
};

UIManager.prototype.showModal = function(modalId) {
  this._hideAllModals();
  document.getElementById(modalId).style.display = 'flex';
};

UIManager.prototype.hideAllModals = function() {
  this._hideAllModals();
};
```

---

## 6. CSS Architecture

### 6.1 Design Tokens (CSS Custom Properties)

```css
:root {
  /* Colors — dark theme matching existing Sanctuary aesthetic */
  --color-bg: #05050a;
  --color-surface: rgba(255, 255, 255, 0.03);
  --color-border: rgba(255, 255, 255, 0.1);
  --color-border-hover: rgba(255, 255, 255, 0.3);
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #a0aec0;
  --color-text-muted: #4a5568;
  
  /* Fishing-specific colors */
  --color-tension-green: #48bb78;
  --color-tension-yellow: #ecc94b;
  --color-tension-red: #fc8181;
  --color-rarity-common: #a0aec0;
  --color-rarity-uncommon: #68d391;
  --color-rarity-rare: #63b3ed;
  --color-rarity-legendary: #f6ad55;
  --color-rarity-mythic: #f687b3;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
  
  /* Typography */
  --font-mono: 'Courier New', monospace;
  --font-size-xs: 10px;
  --font-size-sm: 11px;
  --font-size-md: 14px;
  --font-size-lg: 18px;
  
  /* Animation */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
}
```

### 6.2 Key CSS Classes

```css
/* ===== HUD ===== */
#hud-container {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;  /* Allow click-through to canvas */
  z-index: 10;
}

#hud-container > * {
  pointer-events: auto;  /* Re-enable for interactive elements */
}

#top-bar {
  position: absolute; top: 16px; left: 20px; right: 20px;
  display: flex; justify-content: space-between; align-items: center;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  letter-spacing: 1px;
}

/* ===== Tension Bar ===== */
#tension-bar {
  position: absolute; bottom: 120px; left: 50%;
  transform: translateX(-50%);
  width: 320px;
}

#tension-bar-track {
  width: 100%; height: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

#tension-fill {
  height: 100%;
  width: 0%;
  transition: width 0.05s linear, background-color 0.2s ease;
}

#tension-zones {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
}

#tension-zones .zone {
  font-size: 8px;
  color: rgba(255,255,255,0.3);
  position: absolute;
  top: -14px;
}

.zone-green  { left: 10%; color: var(--color-tension-green) !important; }
.zone-yellow { left: 55%; color: var(--color-tension-yellow) !important; }
.zone-red    { left: 85%; color: var(--color-tension-red) !important; }

/* ===== Cast Power Bar ===== */
#cast-power-bar {
  /* Same as tension bar but vertical or different styling */
}

/* ===== Modal System ===== */
.modal {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal-backdrop {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: rgba(10, 10, 20, 0.95);
  border: 1px solid var(--color-border);
  max-width: 700px;
  max-height: 80vh;
  width: 90%;
  overflow-y: auto;
  padding: var(--space-lg);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.btn-close {
  background: none; border: 1px solid var(--color-border);
  color: var(--color-text-secondary); cursor: pointer;
  padding: 4px 10px; font-size: var(--font-size-md);
  transition: all var(--transition-fast);
}

.btn-close:hover {
  border-color: var(--color-border-hover);
  color: #fff;
}

/* ===== Notification Toast ===== */
#notification {
  position: absolute; top: 60px; left: 50%; transform: translateX(-50%);
  padding: 10px 24px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  letter-spacing: 1px;
  z-index: 200;
  transition: opacity var(--transition-normal);
  pointer-events: none;
}

.notification-success { border-color: #48bb78 !important; }
.notification-rare    { border-color: #f6ad55 !important; }
.notification-error   { border-color: #fc8181 !important; }

/* ===== Responsive: Mobile ===== */
@media (max-width: 768px) {
  #top-bar { font-size: var(--font-size-xs); }
  #tension-bar { width: 260px; bottom: 100px; }
  #bottom-bar { padding: 0 12px; }
  .btn-icon { padding: 6px 12px; font-size: 14px; }
}
```

---

## 7. Testing Strategy

### 7.1 Test Levels

| Level | Scope | Tool | When |
|-------|-------|------|------|
| **Unit** | Individual functions: fish spawn RNG, tension calculation, gold formulas | Manual console testing + inline assertions | During development |
| **Integration** | System pairs: FishingSystem + FishSpawner, SaveManager + UI | Manual gameplay | Before merging features |
| **Visual** | Rendering output: fish meshes, water shader, particle effects | Visual inspection | Continuous |
| **Playtest** | Full game loop with save/load | Internal team + friends | Weekly |
| **Performance** | FPS counter, memory profiling | Chrome DevTools | Before releases |

### 7.2 Unit Test Examples (Inline Assertions)

```javascript
// ===== TEST: FishSpawner.rollFish() =====
(function testFishSpawn() {
  var spawner = new FishSpawner(new EventBus());
  var results = {};
  
  // Test 1000 spawns, verify rarity distribution is ~correct
  for (var i = 0; i < 1000; i++) {
    var fish = spawner.rollFish('japan', 'worm', 0.5);
    results[fish.rarity] = (results[fish.rarity] || 0) + 1;
  }
  
  console.log('Fish spawn distribution:', results);
  // Expected: common ~45%, uncommon ~30%, rare ~15%, legendary ~8%, mythic ~2%
})();

// ===== TEST: Tension calculation =====
(function testTensionCalc() {
  // Simulate 1 second of reeling at 60fps
  var tension = 0;
  for (var i = 0; i < 60; i++) {
    tension += 12 * (1/60);  // REEL_RATE * dt
    tension = Math.min(tension, 100);
  }
  console.assert(Math.abs(tension - 12) < 0.1, 'Tension should be ~12 after 1s reeling');
  
  // Simulate 1 second of slacking
  for (var j = 0; j < 60; j++) {
    tension -= 8 * (1/60);
    tension = Math.max(tension, 0);
  }
  console.assert(Math.abs(tension - 4) < 0.1, 'Tension should be ~4 after 1s slack');
})();

// ===== TEST: Save/Load roundtrip =====
(function testSaveRoundtrip() {
  var sm = new SaveManager(new EventBus());
  var data = sm.createDefault();
  data.player.gold = 999;
  
  sm.save(0, data);
  var loaded = sm.load(0);
  
  console.assert(loaded.player.gold === 999, 'Gold should survive roundtrip');
  console.assert(loaded.version === 1, 'Version should be 1');
  console.log('Save/Load test passed!');
})();
```

### 7.3 Test Commands

```bash
# Run all inline tests (paste into browser console)
// TEST_SUITE.js content loaded via script tag in dev mode
```

### 7.4 Debug Mode

```javascript
// Set ?debug=1 in URL to enable debug overlay
var DEBUG = window.location.search.includes('debug=1');

if (DEBUG) {
  // Show FPS counter
  var fpsDisplay = document.createElement('div');
  fpsDisplay.id = 'fps-counter';
  fpsDisplay.style.cssText = 'position:fixed;top:4px;right:8px;color:#0f0;font:10px monospace;z-index:999;';
  document.body.appendChild(fpsDisplay);
  
  // Expose systems globally for console access
  window.__game = gameManager;
  window.__fishSpawner = gameManager.fishSpawner;
  window.__fishingSystem = gameManager.fishingSystem;
  
  console.log('🐛 Debug mode active. Access systems via window.__game, etc.');
}
```

---

## 8. Error Handling & Edge Cases

### 8.1 Error Handling Matrix

| Scenario | Detection | Handling |
|----------|-----------|----------|
| **localStorage full** | try/catch on `setItem()` | Show notification, skip save, game continues in-memory |
| **AudioContext blocked** | Browser auto-play policy | Resume AudioContext on first user click/tap |
| **WebGL not supported** | Check `THREE.WebGLRenderer` availability | Show fallback message: "Your browser does not support WebGL" |
| **Fish spawn pool empty** | No candidates match conditions | Fallback: return random common fish from location |
| **Save data corruption** | JSON.parse throws | Delete corrupted save, start fresh |
| **Frame drop / lag spike** | dt > 0.1s (cap delta) | Cap dt at 0.1s to prevent physics explosion |
| **Mobile touch events** | Passive listener warning | Use `{ passive: false }` on touchstart/touchend |
| **Canvas resize** | `window.onresize` | Recalculate orthographic camera bounds |
| **Tab background** | `document.visibilitychange` | Pause audio, reduce render FPS to 1fps |
| **NaN in tension/gold** | `isNaN()` check after calculations | Clamp to safe defaults, log warning |

### 8.2 Edge Cases

| Edge Case | Behavior |
|-----------|----------|
| **Player casts with 0 power** | Minimum distance cast (surface fish only) |
| **Player releases during hook window after window expired** | Already handled — state transitioned to escape |
| **All 3 save slots used** | Overwrite selected slot with confirmation |
| **Concurrent input (mouse + touch)** | InputManager debounces; only processes first active input |
| **Rapid location switching** | Cancel current fishing state, animate transition |
| **Fish storage full (50 fish)** | Prompt player to sell or release before next catch |
| **Midnight crosses during session** | DailySystem checks on each cast/catch |
| **Browser back/forward** | Game state in localStorage persists; reloads on return |
| **Very long hold (>5 seconds)** | Cast power caps at 1.0; no further increase |

### 8.3 Graceful Degradation

```
FEATURE TIERS:
├── Tier 1 (ALWAYS WORKS): Cast, bite, reel, catch, gold, fishpedia, save
├── Tier 2 (DEGRADES): Audio (if AudioContext fails → silent mode)
├── Tier 3 (OPTIONAL): Daily quests (if clock unavailable → generic quests)
└── Tier 4 (NICE-TO-HAVE): Leaderboard (if no internet → local only)
```

---

## 9. Deployment & Versioning

### 9.1 Deployment Strategy

```
DEVELOPMENT:
  Local file:// → browser
  Python HTTP server: python -m http.server 8080
  VS Code Live Server extension

STAGING:
  GitHub Pages (from /docs or gh-pages branch)
  Netlify (drag-and-drop deploy)

PRODUCTION:
  CDN-hosted (Cloudflare Pages / Vercel / Netlify)
  Custom domain: soulsanctuary.game
```

### 9.2 Version Numbering

```
MAJOR.MINOR.PATCH  (Semantic Versioning)

MAJOR: Save-breaking changes, complete rewrites
MINOR: New location, new fish species, new feature
PATCH: Bug fixes, balance adjustments, typo fixes

Examples:
  1.0.0  → MVP (3 locations, 21 fish)
  1.1.0  → Add 2 more locations + fish
  1.1.1  → Fix tension bar NaN bug
  2.0.0  → All 12 locations, multiplayer
```

### 9.3 Changelog Format

```markdown
## [1.0.0] - 2026-06-15
### Added
- 3 fishing locations: Japan, Iceland, Thailand
- 21 fish species (7 per location)
- Core cast → bite → reel mechanic
- Tension-based mini-game
- Basic fishpedia
- 3 rod tiers, 3 bait types
- localStorage save/load

### Known Issues
- Mobile touch sensitivity needs tuning
- Audio may not start until first interaction
```

---

## 10. Code Style Guide

### 10.1 JavaScript Conventions

```javascript
// ===== NAMING =====
// Constructors: PascalCase
function FishingSystem() {}

// Variables/functions: camelCase
var fishProgress = 0;
function calculateTension() {}

// Constants: UPPER_SNAKE_CASE (top-level only)
var MAX_TENSION = 100;
var REEL_RATE = 12;

// Private members: _prefix (convention, not enforced)
FishingSystem.prototype._tickWaiting = function() {};

// Modules: PascalCase global
var GameManager = (function() { /* ... */ return GameManager; })();

// ===== FILE HEADER =====
/**
 * js/fishing-system.js
 * Core fishing state machine.
 * States: idle → casting → waiting → hooking → reeling → catch/escape
 * @depends event-bus.js, fish-spawner.js, audio-manager.js, config.js
 */

// ===== COMMENTS =====
// Use JSDoc for public APIs
/**
 * Roll for a fish given location + conditions.
 * @param {string} locationId
 * @param {string} baitId
 * @param {number} castPower - 0.0 to 1.0
 * @returns {SpiritFish}
 */

// Use inline comments for algorithm explanation
// 3. Build weighted table with bait + power modifiers
var weight = rarityWeights[fish.rarity] * baitConfig.rareBonus;
```

### 10.2 Project Conventions

| Rule | Detail |
|------|--------|
| **Indentation** | 2 spaces (consistent with existing index.html) |
| **Quotes** | Single quotes for strings, double for HTML attributes |
| **Semicolons** | Required |
| **Var vs Let/Const** | Use `var` for ES5 compatibility (no Babel) |
| **Line length** | 100 characters max |
| **File length** | 300 lines max per module (split if longer) |
| **Global variables** | Only module constructors on `window` |
| **Debug logs** | Use `console.log` guarded by `if (DEBUG)` |
| **THREE.js usage** | `new THREE.MeshLambertMaterial({ flatShading: true })` — always flat shading |

---

## Appendix: Implementation Checklist (MVP)

### Phase 1 Sprint Tasks (Ordered)

- [ ] **Sprint 1: Foundation** (Week 1)
  - [ ] Create `js/event-bus.js`
  - [ ] Create `js/config.js` (stations + first 21 fish + balance constants)
  - [ ] Create `js/save-manager.js`
  - [ ] Create `js/input-manager.js`
  - [ ] Refactor `index.html`: extract renderer to `js/renderer.js`
  - [ ] Refactor `index.html`: extract location builders to `js/location-manager.js`

- [ ] **Sprint 2: Core Fishing** (Week 2)
  - [ ] Create `js/fish-spawner.js` (RNG + mesh generation)
  - [ ] Create `js/fishing-system.js` (state machine)
  - [ ] Add water plane to 3 locations
  - [ ] Add bobber 3D object
  - [ ] Implement cast power meter UI
  - [ ] Implement tension bar UI

- [ ] **Sprint 3: Polish & Content** (Week 3)
  - [ ] Create `js/audio-manager.js` (procedural sounds)
  - [ ] Create `js/ui-manager.js` (full HUD + fishpedia modal)
  - [ ] Create `js/shop-system.js`
  - [ ] Create `js/daily-system.js`
  - [ ] Implement save/load UI
  - [ ] Add catch result animation + screen effects

- [ ] **Sprint 4: Testing & Launch** (Week 4)
  - [ ] Playtest all 3 locations
  - [ ] Balance gold economy
  - [ ] Mobile touch testing
  - [ ] Bug fixes
  - [ ] Deploy to staging
  - [ ] v1.0.0 Release

---

*End of Software Design Document v1.0*
