# 🎣 Soul Sanctuary: Depth Fishing — Game Design Document (GDD)

> **Version**: 1.0 | **Date**: 2026-06-02 | **Status**: Pre-Production
> **Art Style**: Retro Low-Poly 3D + 400×300 Pixelated Rendering (Three.js)
> **Platform**: Web Browser (Desktop + Mobile)

---

## Table of Contents
1. [Game Overview](#1-game-overview)
2. [Core Gameplay Loop](#2-core-gameplay-loop)
3. [Fishing Mechanics Deep Dive](#3-fishing-mechanics-deep-dive)
4. [Fish System & Bestiary](#4-fish-system--bestiary)
5. [Progression & Economy](#5-progression--economy)
6. [Locations & World Design](#6-locations--world-design)
7. [UI/UX Design](#7-uiux-design)
8. [Audio & Atmosphere](#8-audio--atmosphere)
9. [Retention Systems](#9-retention-systems)
10. [Content Roadmap](#10-content-roadmap)

---

## 1. Game Overview

### 1.1 Elevator Pitch

> Cast your line into the pixelated waters of 12 global sanctuaries. Catch spirit fish, build your compendium, upgrade your gear, and find peace in a meditative low-poly fishing journey.

### 1.2 Design Pillars

| Pillar | Description |
|--------|-------------|
| **🎨 Aesthetic Consistency** | Every visual element must honor the low-poly flat-shaded 400×300 pixel aesthetic. No high-res textures. No smooth normals. |
| **🧘 Meditative Engagement** | The act of fishing itself should be calming. No punishing failure. The atmosphere IS the reward. |
| **📖 Collection Depth** | 100+ fish with unique models, rarities, conditions, and lore entries. Completionists should have months of content. |
| **🌍 Cultural Reverence** | Each of the 12 locations honors its real-world inspiration through architecture, fish species, music, and atmosphere. |
| **🔄 Infinite Replayability** | Procedural rarity, daily conditions, seasonal rotation, and leaderboards ensure no two sessions are identical. |

### 1.3 Target Session Length

| Type | Duration | Frequency |
|------|----------|-----------|
| Quick session | 5-10 min | Multiple times/day |
| Standard session | 20-30 min | 1-2 times/day |
| Deep session | 1-2 hours | Weekend |

### 1.4 Player Fantasy

The player is a **Soul Angler** — a wandering fisher who travels between spiritual sanctuaries across the world, casting not just for fish, but for moments of peace and connection. Each fish caught is a spirit fragment, recorded in the Soul Fishpedia.

---

## 2. Core Gameplay Loop

### 2.1 Primary Loop Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    SESSION LOOP                           │
│                                                           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │ SELECT  │───▶│  CAST   │───▶│  WAIT   │               │
│  │LOCATION │    │  LINE   │    │ & IDLE  │               │
│  └─────────┘    └─────────┘    └────┬────┘               │
│       ▲                              │                    │
│       │                              ▼                    │
│       │                      ┌─────────────┐              │
│       │                      │  FISH BITES  │              │
│       │                      │ (Visual cue) │              │
│       │                      └──────┬──────┘              │
│       │                              │                    │
│       │                              ▼                    │
│       │                      ┌─────────────┐              │
│       │                      │  MINI-GAME   │              │
│       │                      │ (Reel/Fight) │              │
│       │                      └──────┬──────┘              │
│       │                              │                    │
│       │                    ┌─────────┴─────────┐          │
│       │                    │                   │          │
│       │                    ▼                   ▼          │
│       │              ┌──────────┐       ┌──────────┐      │
│       │              │  CATCH!  │       │  ESCAPED │      │
│       │              └────┬─────┘       └────┬─────┘      │
│       │                   │                  │            │
│       │                   ▼                  │            │
│       │           ┌──────────────┐           │            │
│       │           │ FISHPEDIA ADD │           │            │
│       │           │ + GOLD EARN   │           │            │
│       │           └──────┬───────┘           │            │
│       │                  │                  │            │
│       │                  ▼                  │            │
│       │           ┌──────────────┐           │            │
│       │           │ UPGRADE/SHOP │◀──────────┘            │
│       │           └──────────────┘                        │
│       └───────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────┘
```

### 2.2 Meta Loop (Long-Term)

```
┌────────────────────────────────────────────┐
│               META PROGRESSION              │
│                                             │
│  CATCH FISH ──▶ EARN GOLD ──▶ BUY GEAR     │
│      │              │              │        │
│      ▼              ▼              ▼        │
│  UNLOCK NEW    UNLOCK NEW    CATCH HARDER   │
│  LOCATIONS     BAIT TYPES    RARE FISH      │
│      │              │              │        │
│      └──────────────┴──────────────┘        │
│                     │                       │
│                     ▼                       │
│           FISHPEDIA COMPLETION %            │
│                     │                       │
│                     ▼                       │
│           ACHIEVEMENTS / BADGES             │
└────────────────────────────────────────────┘
```

---

## 3. Fishing Mechanics Deep Dive

### 3.1 The Cast

**Player Action**: Click/tap and hold, then release to cast. A power meter appears.

```
POWER METER:
[ MIN ████████░░░░░░░░░░░░ MAX ]
  ↑         ↑              ↑
  Short    Optimal        Overshoot
  cast     range          (line snap)
```

| Cast Power | Distance | Effect |
|------------|----------|--------|
| < 20% | Very short | Only surface fish |
| 20-40% | Short | Common fish pool |
| 40-70% | **OPTIMAL** | Full fish pool + rare chance bonus |
| 70-90% | Long | Full fish pool, slight accuracy penalty |
| > 90% | Overshoot | Line may snap; lose bait |

### 3.2 The Wait (Idle Phase)

After casting, the bobber floats on the water surface. Duration: **2-15 seconds** (varies by bait, location, and fish rarity).

**Visual Feedback:**
- Bobber gently bobs with water waves (sinusoidal)
- Occasional "nibble" — bobber twitches (small splash particle)
- Real bite — bobber DUNKS underwater with splash + ripple ring

**Audio:**
- Ambient: location-specific ambient loop (wind, water, wildlife)
- Nibble: soft water droplet sound
- Bite: distinct splash + tension sound

**Player Agency During Wait:**
- Can "twitch" the line (tap) to attract fish (costs a bit of line durability)
- Can cancel/reel in early (no penalty, recast)

### 3.3 The Bite & Hook

When a fish bites:
1. **Visual**: Bobber submerges, ripple rings expand, water splash particles
2. **Audio**: Splash + species-specific bite sound
3. **Timing Window**: Player has **0.8-2.0 seconds** to click/tap to SET the hook
   - Missing the window = fish escapes with bait
   - Clicking too early (during nibble) = spooks fish

### 3.4 The Mini-Game (Reel Phase)

**Design Philosophy**: Simple to learn, hard to master. One-axis control accessible on both mouse and touch.

#### 3.4.1 Tension Bar System

```
┌─────────────────────────────────────┐
│  TENSION:  [████████░░░░░░░░]  72%  │
│                                     │
│       GREEN ZONE    RED ZONE        │
│  ├─────────┼────────┼────┤         │
│  0%       40%      75%   100%       │
│           ↑                ↑        │
│      SAFE ZONE       LINE BREAK     │
└─────────────────────────────────────┘
```

- **Green Zone (0-40%)**: Fish tires slowly; safest zone
- **Yellow Zone (40-75%)**: Fish tires faster; line durability drains
- **Red Zone (75-100%)**: Rapid line wear; RISK OF LINE BREAK

#### 3.4.2 Player Controls

| Input | Action |
|-------|--------|
| **Hold click/tap** | REEL IN — tension increases, fish gets closer |
| **Release** | SLACK — tension decreases, fish pulls away |
| **Rhythm** | Optimal: pulse reeling (click-release-click) matching fish behavior |

#### 3.4.3 Fish Behavior Patterns

Each fish species has a behavior profile that affects the mini-game:

| Behavior | Description | Visual Cue |
|----------|-------------|-------------|
| **Steady Puller** | Constant moderate tension | Tension rises steadily |
| **Sprint Runner** | Bursts of fast pulling away | Tension spikes suddenly |
| **Lazy Floater** | Barely fights, drifts | Tension very low, slow progress |
| **Zigzag Fighter** | Alternates direction rapidly | Tension oscillates |
| **Deep Diver** | Pulls downward hard | Tension jumps in bursts |
| **Surface Jumper** | Jumps out of water | Brief 0 tension window (reel fast!) |

#### 3.4.4 Catch Resolution

| Outcome | Condition | Consequence |
|---------|-----------|-------------|
| **Perfect Catch** | Tension never entered red zone | Bonus gold + 1.5× XP |
| **Standard Catch** | Caught with some red zone time | Normal gold + XP |
| **Struggle Catch** | Line at <10% durability when caught | Half gold, reduced XP |
| **Line Break** | Tension hit 100% | Fish escapes, lose bait, lose 10% line durability |
| **Hook Slip** | Missed hook timing window | Fish escapes, bait lost |

### 3.5 Gear System

#### 3.5.1 Fishing Rods

| Rod Tier | Name | Unlock | Power | Durability | Bonus |
|----------|------|--------|-------|------------|-------|
| **T1** | Bamboo Starter | Default | 1.0× | 100 casts | None |
| **T2** | Oak Wanderer | 500 gold | 1.2× | 150 casts | +5% rare fish chance |
| **T3** | Steel Seeker | 1500 gold | 1.4× | 200 casts | +10% line strength |
| **T4** | Crystal Caster | 5000 gold | 1.6× | 250 casts | +15% gold from catches |
| **T5** | Soul Rod | Legendary quest | 2.0× | 300 casts | All bonuses + see fish shadows |

#### 3.5.2 Bait Types

| Bait | Cost | Effect | Best For |
|------|------|--------|----------|
| **Basic Worm** | Free (∞) | Standard | All common fish |
| **Glow Worm** | 10 gold | +15% rare; attracts nocturnal fish | Night fishing |
| **Spirit Fly** | 25 gold | +25% rare; attracts surface fish | Rare surface species |
| **Deep Lure** | 40 gold | +30% rare; attracts deep fish | Legendary deep fish |
| **Golden Cricket** | 100 gold | +50% rare; +20% legendary | Trophy hunting |
| **Location Bait** | 15 gold (specific) | +40% location-exclusive fish | Completing fishpedia |

#### 3.5.3 Line Types

| Line | Unlock Cost | Strength | Special |
|------|-------------|----------|---------|
| **Cotton Thread** | Default | 100% | Standard |
| **Silk Line** | 300 gold | 120% | 10% longer cast |
| **Braided Line** | 800 gold | 150% | Reduces zigzag fish effect |
| **Spirit Thread** | 2000 gold | 200% | Glows at night; shows fish HP |

---

## 4. Fish System & Bestiary

### 4.1 Fish Data Model

Each fish has the following attributes:

```typescript
interface SpiritFish {
  id: string;                    // Unique ID (e.g., "sakura_koi")
  name: { zh: string; en: string };  // Bilingual name
  location: string;              // Which sanctuary
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
  
  // Visual
  modelConfig: FishModelConfig;  // Procedural low-poly mesh params
  colorPalette: string[];        // Flat-shaded color scheme
  size: { min: number; max: number };  // In-game units
  
  // Behavior
  behavior: FishBehavior;        // Mini-game AI profile
  
  // Conditions
  timeWindows: ('dawn' | 'day' | 'dusk' | 'night')[];
  weatherRequired?: ('clear' | 'rain' | 'fog' | 'snow' | 'aurora')[];
  seasonRequired?: ('spring' | 'summer' | 'autumn' | 'winter')[];
  baitRequired?: string[];       // Specific baits that can catch this
  
  // Rewards
  baseGold: number;
  xpValue: number;
  
  // Lore
  description: string;           // Fishpedia entry
  mythologyNote?: string;        // Cultural/lore connection
}
```

### 4.2 Rarity Distribution

| Rarity | Spawn Rate | Per Location | Global Total | Visual Indicator |
|--------|------------|--------------|--------------|-----------------|
| **Common** | 45% | 5 | 60 | White name |
| **Uncommon** | 30% | 3 | 36 | Green name |
| **Rare** | 15% | 2 | 24 | Blue name + sparkle |
| **Legendary** | 8% | 1-2 | 15 | Gold name + glow ring |
| **Mythic** | 2% | 0-1 | 6 | Rainbow name + screen effect |

**Total Fish**: ~141 unique species across 12 locations

### 4.3 Fish by Location (Sample)

#### 🇯🇵 Kyoto: Sakura Shrine Pond

| # | Name | Rarity | Behavior | Time | Special Condition |
|---|------|--------|----------|------|-------------------|
| 1 | Sakura Koi | Common | Steady | Day | — |
| 2 | Zen Carp | Common | Lazy | Day/Night | — |
| 3 | Lantern Guppy | Uncommon | Zigzag | Night | Near lantern light |
| 4 | Torii Bass | Uncommon | Sprint | Dusk | — |
| 5 | Petal Drifter | Rare | Surface Jumper | Day | Cherry blossom weather |
| 6 | Moonlit Catfish | Legendary | Deep Diver | Night | Full moon |
| 7 | Kami Dragonfish | Mythic | ALL combined | Dawn | After catching all 6 above |

#### 🇮🇸 Iceland: Aurora Fjord

| # | Name | Rarity | Behavior | Time | Special Condition |
|---|------|--------|----------|------|-------------------|
| 1 | Arctic Cod | Common | Steady | All | — |
| 2 | Frost Herring | Common | Lazy | Day | — |
| 3 | Basalt Eel | Uncommon | Deep Diver | Night | — |
| 4 | Geyser Trout | Uncommon | Sprint | Day | — |
| 5 | Aurora Salmon | Rare | Zigzag | Night | Aurora active |
| 6 | Glacial Sturgeon | Legendary | Deep Diver | All | — |
| 7 | Void Whale (Jörmungandr) | Mythic | ALL | Night | Blizzard weather |

*(Full 12-location fishpedia in Appendix A — to be expanded during content phase)*

### 4.4 Fish Size & Weight System

Each catch generates randomized size within species range:

```
Size Categories (visual + gold multiplier):
📏 Tiny    (<25% of max)  → 0.5× gold
📏 Small   (25-50%)       → 0.75× gold
📏 Average (50-75%)       → 1.0× gold
📏 Large   (75-95%)       → 1.5× gold
📏 Trophy  (>95%)         → 2.0× gold + "Trophy" badge in fishpedia
```

### 4.5 Shiny/Alternate Colors

2% chance per catch: **"Spirit Variant"** — alternate color palette, 3× gold, special fishpedia entry glow.

---

## 5. Progression & Economy

### 5.1 Player Level & XP

```
Level 1-50 system. XP earned from:
├── Catching fish (base XP × rarity multiplier)
├── First-time catches (5× XP bonus)
├── Trophy-size catches (2× XP bonus)
├── Completing location fishpedia pages (large XP bonus)
└── Daily challenges
```

| Level | Unlocks |
|-------|---------|
| 1 | Kyoto unlocked |
| 3 | Iceland unlocked |
| 5 | Thailand unlocked |
| 8 | China unlocked |
| 10 | Shop: bait crafting |
| 12 | UK unlocked |
| 15 | Shop: rod upgrades |
| 18 | France + Germany unlocked |
| 20 | Leaderboard access |
| 22 | Italy + Denmark unlocked |
| 25 | Shop: line upgrades |
| 28 | USA unlocked |
| 30 | Egypt unlocked |
| 35 | Greece unlocked |
| 40 | Mythic fish tracking |
| 50 | All locations + cosmetic prestige |

### 5.2 Currency Types

| Currency | Symbol | How to Earn | Primary Use |
|----------|--------|-------------|-------------|
| **Gold** | 🪙 | Selling fish, challenges, achievements | Gear, bait, storage |
| **Spirit Essence** | ✨ | First-time catches, mythic catches, dailies | Rare bait crafting, cosmetics |
| **Sanctuary Tokens** | 🏛️ | Completing location fishpedia, weekly quests | Location-specific cosmetics |

### 5.3 Gold Economy Balance

| Fish Rarity | Gold Range (by size) |
|-------------|----------------------|
| Common | 5-20 gold |
| Uncommon | 15-50 gold |
| Rare | 40-120 gold |
| Legendary | 100-300 gold |
| Mythic | 500-2000 gold |

**Target**: A 20-minute session should earn ~200-400 gold for an average player, enough for 1-2 bait upgrades or saving toward a rod upgrade over 3-5 sessions.

---

## 6. Locations & World Design

### 6.1 Reusing Soul Sanctuary Assets

The existing 12 sanctuary scenes are PERFECT as fishing backdrops. The 3D scenes are already built with:
- Flat-shaded low-poly meshes
- Atmospheric lighting
- Particle systems
- Animated elements

**Adaptation for Fishing:**
- Add water plane with animated shader to [buildJapan()](index.html:138), [buildChina()](index.html:206), etc.
- Position camera to overlook water + sanctuary
- Add bobber 3D object at cast point
- Fish models rise from below water surface on catch

### 6.2 Camera System

| State | Camera Behavior |
|-------|----------------|
| **Location Select** | Orbiting overview (existing auto-cruise style) |
| **Fishing (idle)** | Fixed angle overlooking water; gentle sway |
| **Fish Bite** | Slight zoom toward bobber |
| **Reel Phase** | Zoom to water surface; fish silhouette visible |
| **Catch** | Dramatic angle; fish model rises with particles |

### 6.3 Water Rendering

Consistent with low-poly style:
- Flat-shaded translucent plane with vertex displacement
- Simple sinusoidal wave animation
- Color varies by location (teal in Thailand, dark blue in Iceland, etc.)
- Sparkle particles on surface (existing [Italy](index.html:600) and [Greece](index.html:957) have sparkle particles)

---

## 7. UI/UX Design

### 7.1 HUD Layout (In-Fishing)

```
┌──────────────────────────────────────────────┐
│  🪙 1,250  ✨ 45  🏛️ 3         Lv.12 [=====] │  TOP BAR
│                                              │
│                                              │
│              [ WATER + SCENE ]               │
│                                              │
│          🎣 [BOBBER] 🎣                      │
│                                              │
│                                              │
│  ┌──────────────────────────────────┐        │
│  │  TENSION: [████░░░░░░░░]  42%    │        │  TENSION BAR
│  │  FISH: ???                       │        │  (appears on hook)
│  └──────────────────────────────────┘        │
│                                              │
│  [BAIT: Spirit Fly ×12]  [LOCATION: Kyoto]   │  BOTTOM INFO
│  🖱️ HOLD TO REEL                              │  CONTROL HINT
└──────────────────────────────────────────────┘
```

### 7.2 Fishpedia UI

```
┌──────────────────────────────────────┐
│  🐟 SOUL FISHPEDIA    [47/141] 33%   │
│                                      │
│  ┌──┬──┬──┬──┬──┐                   │
│  │🖼️│🖼️│🖼️│❓│❓│  ← Grid of       │
│  ├──┼──┼──┼──┼──┤    caught fish     │
│  │❓│🖼️│❓│🖼️│❓│    thumbnails       │
│  ├──┼──┼──┼──┼──┤                   │
│  │  ...more rows... │                   │
│  └──┴──┴──┴──┴──┘                   │
│                                      │
│  [Filter: All ▼] [Sort: Rarity ▼]   │
│                                      │
│  SELECTED: Sakura Koi ★★☆☆☆         │
│  ┌────────────────────────────────┐  │
│  │        [FISH 3D MODEL]         │  │
│  │     Rotatable low-poly model   │  │
│  └────────────────────────────────┘  │
│  Location: Kyoto · Sakura Shrine    │
│  Rarity: Common · Size: 12-18cm     │
│  Best caught: Dawn · Worm bait      │
│  Times caught: 23                   │
│  Largest: 17.8cm 🏆                 │
│  "A koi imbued with cherry blossom  │
│   essence. Swims in the temple pond │
│   beneath falling petals."          │
└──────────────────────────────────────┘
```

### 7.3 Location Select (World Map)

Reuse the existing [cruise system](index.html:80) but add:
- Fishpedia completion % per location
- Currently active weather/conditions
- "Hot spot" indicator (temporary increased rare spawn)

---

## 8. Audio & Atmosphere

### 8.1 Audio Layers

| Layer | Description | Implementation |
|-------|-------------|----------------|
| **Ambient** | Location-specific background (wind, water, wildlife) | Looping Web Audio or OGG |
| **Music** | Meditative ambient track per location (mutable) | Web Audio API, crossfade on location change |
| **SFX** | Cast, bite, reel, catch, UI clicks | One-shot Web Audio samples |
| **Feedback** | Tension warning beeps, rare fish chime | Generated tones via OscillatorNode |

### 8.2 Location Audio Palette

| Location | Ambient | Music Style | Key SFX |
|----------|---------|-------------|---------|
| Kyoto | Water drip + wind chimes | Koto + shakuhachi drone | Bamboo creak, bell |
| Iceland | Howling wind + ice crack | Deep cello + glass harmonica | Ice crack, deep thud |
| Thailand | Jungle insects + water flow | Ranat ek + soft gong | Frog, water ripple |

---

## 9. Retention Systems

### 9.1 Daily System

```
DAILY REFRESH @ Midnight UTC+8:
├── 3× Daily Bounty Quests (e.g., "Catch 5 fish in Iceland")
│   └── Reward: 100-300 gold + 10-30 ✨
├── 1× Daily Hotspot (random location gets +25% rare spawn)
├── Free bait refill (5× Spirit Fly)
└── Login streak counter (7-day streak = Golden Cricket)
```

### 9.2 Weekly System

```
WEEKLY REFRESH @ Monday 00:00 UTC+8:
├── Weekly Tournament: "Biggest [Species] caught this week"
│   └── Top 10 on leaderboard → rewards
├── Weekly Sanctuary Challenge: Complete a location fishpedia page
└── Mystery Fish of the Week (increased spawn rate for one rare fish)
```

### 9.3 Achievements System

| Category | Examples |
|----------|----------|
| **Collection** | "Catch 10/25/50/100 fish species" |
| **Size** | "Catch a trophy-size fish" → "Catch 10 trophy fish" |
| **Location** | "Complete Kyoto fishpedia" → "Complete all 12" |
| **Skill** | "10 perfect catches in a row" |
| **Secrets** | "Fish during aurora in Iceland" |
| **Mastery** | "Catch all mythic fish" |

### 9.4 Seasonal Events

| Season | Event | Special Fish | Duration |
|--------|-------|-------------|----------|
| Spring (Mar-May) | Cherry Blossom Festival | Sakura Spirit variants in Japan/China | 2 weeks |
| Summer (Jun-Aug) | Midnight Sun Tournament | Arctic rare spawns boosted in Iceland | 2 weeks |
| Autumn (Sep-Nov) | Harvest Moon Gala | Golden fish variants globally | 2 weeks |
| Winter (Dec-Feb) | Frostveil Celebration | Ice-themed mythic fish, all locations | 3 weeks |

---

## 10. Content Roadmap

### Phase 1: MVP (Month 1-2)
- ✅ 3 locations (Japan, Iceland, Thailand)
- ✅ 21 fish species (7 per location)
- ✅ Core cast→bite→reel mechanics
- ✅ Tension bar mini-game
- ✅ Basic fishpedia
- ✅ 3 rod tiers + 3 bait types
- ✅ localStorage save
- ✅ Desktop Chrome/Edge/Firefox

### Phase 2: Full Launch (Month 3-4)
- ✅ All 12 locations
- ✅ 100+ fish species
- ✅ Full fishpedia with 3D model viewer
- ✅ Daily quest system
- ✅ Weekly tournaments + leaderboard
- ✅ Full gear progression (5 rods, 6 baits, 4 lines)
- ✅ Mobile browser optimization
- ✅ Cloud save (optional)

### Phase 3: Live Service (Month 5+)
- ✅ Seasonal events system
- ✅ New location (community vote)
- ✅ Multiplayer fishing holes (shared instances)
- ✅ Cosmetic shop
- ✅ Achievement badges
- ✅ Discord integration
- ✅ Trading system (fish for Spirit Essence)

---

## Appendix A: Full Location-Fish Matrix (Abbreviated)

| # | Location | Common | Uncommon | Rare | Legendary | Mythic |
|---|----------|--------|----------|------|-----------|--------|
| 1 | 🇯🇵 Kyoto | 5 | 3 | 2 | 1 | 1 |
| 2 | 🇨🇳 China | 5 | 3 | 2 | 1 | 1 |
| 3 | 🇺🇸 USA | 5 | 3 | 2 | 1 | 0 |
| 4 | 🇬🇧 UK | 5 | 3 | 2 | 2 | 0 |
| 5 | 🇫🇷 France | 5 | 3 | 2 | 1 | 0 |
| 6 | 🇩🇪 Germany | 5 | 3 | 2 | 1 | 1 |
| 7 | 🇮🇹 Italy | 5 | 3 | 2 | 2 | 0 |
| 8 | 🇩🇰 Denmark | 5 | 3 | 2 | 1 | 1 |
| 9 | 🇮🇸 Iceland | 5 | 3 | 2 | 1 | 1 |
| 10 | 🇹🇭 Thailand | 5 | 3 | 2 | 2 | 0 |
| 11 | 🇪🇬 Egypt | 5 | 3 | 2 | 1 | 1 |
| 12 | 🇬🇷 Greece | 5 | 3 | 2 | 1 | 0 |
| **Tot** | | **60** | **36** | **24** | **15** | **6** |

**Grand Total: 141 fish species**

---

## Appendix B: Control Scheme

### Desktop
| Action | Input |
|--------|-------|
| Cast (aim + power) | Click & hold → release |
| Set hook | Click (timing window) |
| Reel | Hold left mouse button |
| Slack | Release mouse button |
| Switch bait | Number keys 1-6 or scroll wheel |
| Open fishpedia | F key |
| Change location | ◀▶ arrow buttons (or existing nav) |
| Pause/Menu | Escape |

### Mobile
| Action | Input |
|--------|-------|
| Cast (aim + power) | Touch & hold → release |
| Set hook | Tap |
| Reel | Hold touch |
| Slack | Release touch |
| Switch bait | Tap bait icon |
| Open fishpedia | Tap book icon |
| Change location | Swipe left/right |
| Pause/Menu | Tap gear icon |

---

*End of Game Design Document v1.0*
