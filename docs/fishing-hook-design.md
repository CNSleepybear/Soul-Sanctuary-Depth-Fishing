# 🎣 Fishing Hook System Design — Phase 4.5 (v2)

> **Status**: Revised per review  
> **Impact**: [`FishingSystem.ts`](src/renderer/fishing/FishingSystem.ts), [`charm-data.ts`](src/renderer/roguelike/charm-data.ts), [`constants.ts`](src/shared/constants.ts)

---

## 1. Refined State Machine

```
IDLE → CASTING → WAITING
                    ↓ (fish rolls for bite)
                    ├─ No bite → continue WAITING (next rollout in 1-3s)
                    └─ Fish bites → NIBBLE (bobber twitches)
                                    ↓ (player has 0.8-1.2s to observe)
                                    ↓ auto-roll hook probability
                                    ├─ HOOK SUCCESS → HOOKING (click to set!)
                                    │                   ↓ click in time?
                                    │                   ├─ Yes → REELING → CATCH
                                    │                   └─ No → MISSED_HOOK → IDLE (no bait lost)
                                    └─ HOOK FAIL → PROBE_ESCAPE → back to WAITING (no bait lost)
```

**Key changes from v1:**

| v1 | v2 |
|----|----|
| Nibble fail = bait consumed | Nibble fail = **fish probed and left**, bait NOT consumed |
| Hook fail = bait consumed | Hook fail renamed to PROBE_ESCAPE, bait NOT consumed |
| Only one "escape" type | Three distinct: probe_escape (no bait lost), missed_hook (no bait lost), line_break (bait lost) |
| Fish selected during nibble | Fish selected DURING WAITING roll, before nibble starts |

---

## 2. Bait Consumption Rules

| Scenario | Bait Consumed? | State |
|----------|:---:|-------|
| Fish probes and leaves (hook roll fail) | ❌ No | PROBE_ESCAPE → WAITING |
| Fish bites but player misses hook window | ❌ No | MISSED_HOOK → IDLE |
| Fish hooked + line breaks during fight | ✅ Yes | LINE_BREAK → IDLE |
| Fish hooked + caught | ✅ Yes | CATCH → RESULT |
| Overshoot cast (line snap) | ✅ Yes | LINE_BREAK → IDLE |

**Design rationale**: Only lose bait when you actually HAD the fish on the hook. This rewards patience and keeps the loop flowing. Common fish nibbling your Mythic bait doesn't waste your Spirit Paste.

---

## 3. Multi-Rarity Bite Roll (Critical Fix)

**Problem**: If a Common fish (85% hook) always takes priority over a Mythic fish (25% hook), the Mythic never gets a chance.

**Solution**: During WAITING, periodically (every 1-3s) roll which fish IS interested, weighted by the location's spawn pool rarity distribution. The selected fish's rarity determines the hook probability.

### Algorithm

```
Every 1-3s while WAITING:
  1. Get all fish available at this location (filtered by time/weather/season/bait)
  2. Weight by rarity: Common×5, Uncommon×3, Rare×2, Legendary×1, Mythic×0.5
  3. Pick one fish via weighted random
  4. Roll hook probability based on that fish's rarity + bonuses
  5. If SUCCESS → NIBBLE (show fish, 0.8-1.2s) → HOOKING
  6. If FAIL → silent, continue WAITING (loop back to step 1 after 1-3s)
```

This means a Mythic fish CAN appear but with lower weight, and when it does, it still has only 25% hook chance. The player might see 3-4 probe failures before finally hooking a Mythic — which is exactly the tension we want.

---

## 4. Hook Probability by Rarity

| Rarity | Spawn Weight | Hook % | Notes |
|--------|:---:|:-----:|-------|
| Common | ×5 | 85% | Reliable income |
| Uncommon | ×3 | 70% | Frequent catches |
| Rare | ×2 | 55% | Exciting gamble |
| Legendary | ×1 | 40% | Memorable fights |
| Mythic | ×0.5 | 25% | Heart-stopping |

### Bonuses (additive, capped at 95%)

| Source | Bonus |
|--------|:-----:|
| Bread bait | +5% |
| Shrimp bait | +8% |
| Spoon Lure | +10% |
| Spirit Paste | +15% |
| Magnetic Hook charm | +8% |
| Eagle Eye charm (new) | +5% |
| Lucky Lure charm (new) | +10% |
| Spirit Snare charm (new) | +12% |
| Ancient Compass relic | +5% |

**Max possible**: 25% (Mythic base) + 15% + 12% + 10% + 8% + 5% = 70%. Still requires skill.

---

## 5. Slack-Line Tension Mechanic (New for Rare+)

**Problem**: Currently, reeling is just "hold button = tension goes up, release = tension drops". For Rare+ fish, this is too passive.

**Solution**: Rare and above fish have a **"slack burst"** mechanic. If the player reels too aggressively (tension stays in Red zone for too long), the fish performs a sudden burst that can break the line instantly.

### Mechanic

| Rarity | Slack-Line Risk |
|--------|----------------|
| Common | None — safe to reel however |
| Uncommon | None — safe |
| Rare | If tension > 90% for 2+ seconds, fish has 10% chance of sudden burst (+30% line damage) |
| Legendary | If tension > 85% for 1.5+ seconds, 15% burst chance |
| Mythic | If tension > 80% for 1+ second, 20% burst chance |

### Player Strategy

```
Common/Uncommon: Reel freely, no punishment
Rare: Stay in Green/Yellow, avoid prolonged Red
Legendary: Must pulse-reel (green→yellow→green), Red is dangerous
Mythic: Requires rhythm mastery — short bursts of reeling, long slack periods
```

### Visual Feedback

- Red zone danger: line color shifts to orange/red pulsing
- Burst warning: fish thrashes visibly, splash particles
- Line break: dramatic SNAP effect

---

## 6. Complete Flow (Player Perspective)

```
1. Cast line → bobber lands
2. Wait 2-10s → nothing happens? Bobber twitches?
3. "Oh! Something's there!" (NIBBLE — see fish indicator)
4. [0.8s pause — is it going to bite?]
5a. "YES!" → Bobber DUNKS → CLICK NOW → Reel fight
5b. "It left..." → Bobber goes still → back to step 2 (no bait lost)
6. During fight (Rare+): 
   - Watch tension bar — stay out of red zone
   - Pulse the reel: hold-release-hold-release
   - If you redline too long → FISH BURSTS → possible break
7. Fish caught → reward → IDLE → cast again
```

---

## 7. Code Impact Summary

| File | Changes |
|------|---------|
| `shared/enums.ts` | +1 state: `ProbeEscape` |
| `shared/events.ts` | +1 event: `fishing:probe_escape` |
| `shared/constants.ts` | +nibbleDuration, +slackLine thresholds, +hook bonuses on baits |
| `fishing/FishingSystem.ts` | ~50 lines: periodic bite roll in WAITING, hook probability, slack-line burst, nibble state |
| `roguelike/charm-data.ts` | ~15 lines: 3 new charms |
| `roguelike/ModifierEngine.ts` | +1 stat: `hookChance` |
| **Total** | ~80 lines, 6 files |
