# 🎣 Cast Distance → Water Depth System

> **Status**: Proposal  
> **Principle**: Deep fish need long casts. Short casts = surface fish only. No new fish data needed — derive depth from existing rarity/behavior/size.

---

## 1. Water Depth Tiers

| Tier | Cast Power | Depth Name | Typical Fish |
|------|:---:|------------|-------------|
| Surface | 0-30% | Shallow (0-3m) | Common surface fish (Koi, Medaka, Neon Tetra) |
| Mid-Water | 30-60% | Medium (3-15m) | Uncommon fish, standard body types |
| Deep | 60-85% | Deep (15-50m) | Rare fish, predators, eels |
| Abyssal | 85-100% | Trench (50m+) | Legendary/Mythic, deep diver behavior |

---

## 2. Deriving Fish Depth (No New Data)

Instead of adding `depthMin`/`depthMax` to 141 fish definitions, compute depth from existing properties:

### Depth Score Formula

```typescript
function getFishDepth(fish: SpiritFish): number {
  let score = 0; // 0-100, higher = deeper

  // Rarity: main factor
  switch (fish.rarity) {
    case 'common':    score += 10; break;
    case 'uncommon':  score += 35; break;
    case 'rare':      score += 60; break;
    case 'legendary': score += 80; break;
    case 'mythic':    score += 95; break;
  }

  // Behavior modifier
  switch (fish.behavior.type) {
    case 'SurfaceJumper': score -= 15; break;
    case 'DeepDiver':     score += 15; break;
    case 'Lazy':          score -= 5; break;
    case 'Sprint':        score += 5; break;
  }

  // Size factor: bigger = deeper
  const avgSize = (fish.size.min + fish.size.max) / 2;
  if (avgSize > 80) score += 10;
  else if (avgSize > 50) score += 5;

  // Body type hint
  if (fish.modelConfig.bodyType === 'eel') score += 5;
  if (fish.modelConfig.bodyType === 'angler') score += 10;

  return Math.max(5, Math.min(100, score));
}
```

### Example Depth Scores

| Fish | Rarity | Behavior | Depth | Tier |
|------|--------|----------|:-----:|------|
| 锦鲤 (Koi) | Common | Steady | 10 | Surface |
| 香鱼 (Ayu) | Common | Lazy | 5 | Surface |
| 岩鱼 (Iwana) | Uncommon | Steady | 35 | Mid-Water |
| 雷鱼 (Thunderfish) | Rare | Zigzag | 65 | Deep |
| 蛟 (Mizuchi) | Legendary | DeepDiver | 95 | Abyssal |
| 八咫鲤 (Yatagarasu) | Mythic | DeepDiver | 100 | Abyssal |
| 龙魂鱼 (Loong Spirit) | Mythic | DeepDiver | 100 | Abyssal |

---

## 3. Cast Power → Depth Matching

### Player casts with power P (0-1.0):

```
Reachable depth = P × (baseCastDepth + charmBonuses)

Shallow:  P < 0.30  → depth 0-30
Medium:   P 0.30-0.60 → depth 30-60
Deep:     P 0.60-0.85 → depth 60-85
Abyssal:  P > 0.85  → depth 85-100
```

### During bite roll, filter fish by cast depth:

```typescript
// Only fish within reachable depth
const reachableDepth = castPower * 100 * depthMultiplier;
candidates = pool.filter(f => getFishDepth(f) <= reachableDepth);
```

### Visual Feedback

| Cast Power | Bobber Position | Visual |
|------------|----------------|--------|
| 0-30% | Near island edge | Bobber close, small splash |
| 30-60% | Mid-distance | Medium ripple |
| 60-85% | Far out | Large splash, bobber barely visible |
| 85-100% | Very far | Dramatic cast, risk of line snap |

---

## 4. Build Integration (Charm Effects)

### New/Modified Charms

| Charm | Effect | Rarity |
|-------|--------|--------|
| **Long Cast** | +10% cast depth reach | Common |
| **Deep Line** | +20% cast depth reach, line wear -10% | Uncommon |
| **Abyssal Weight** | +30% cast depth reach, +15% line wear | Rare |
| **Surface Skimmer** | -10% depth reach, +15% hook chance (specializes in surface fish) | Uncommon |

### Bait Effects Extended

| Bait | Hook Bonus | Depth Bonus |
|------|:---:|:---:|
| Earthworm | 0% | 0% |
| Bread | +5% | -5% (floats, targets surface) |
| Shrimp | +8% | 0% |
| Spoon Lure | +10% | +10% |
| Spirit Paste | +15% | +15% (sinks deep, attracts abyssal) |

---

## 5. Gameplay Flow

```
1. Player holds mouse → cast power meter fills
2. Release → cast lands at depth = power × multiplier
3. Bobber visible at corresponding distance
4. Wait phase: only fish at or above that depth can bite
5. Short cast (20%): "Hmm, only small fish today..."
6. Max cast (90%): "This is where the legends live..."
7. Overshoot (>90%): risk of line snap
```

### Strategic Decisions

| Strategy | Cast Power | Target |
|----------|:---:|--------|
| Safe farming | 30-50% | Common/Uncommon, reliable income |
| Rare hunting | 60-80% | Rare fish, higher risk/reward |
| Legend chasing | 85-90% | Legendary/Mythic, high snap risk |
| Surface specialist | 20-30% | Fast catches, charm synergy |

---

## 6. Implementation Impact

| File | Changes |
|------|---------|
| `fishing/FishingSystem.ts` | Add `getFishDepth()`, filter candidates by cast depth in `_rollForBite()` |
| `fishing/FishSpawner.ts` | No changes (depth filtering in FishingSystem) |
| `shared/constants.ts` | Add `baseCastDepth: 1.0` multiplier |
| `roguelike/charm-data.ts` | Add 3-4 depth charms |
| `roguelike/ModifierEngine.ts` | Add `castDepthMultiplier` stat |
| **Total** | ~50 lines, 4 files |

### Note: No changes to 141 fish definitions!

All depth computation is done via the formula, which uses existing rarity/behavior/size/bodyType fields. This means zero data migration.
