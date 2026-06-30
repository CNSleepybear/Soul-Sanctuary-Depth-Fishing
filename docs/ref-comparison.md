# 🎨 Reference Comparison: sceneReference.html → TypeScript Location Classes

> **Goal**: Align all 12 TypeScript scene classes with the original `sceneReference.html` art style.  
> **Key architectural note**: Reference uses large single-box islands + OrthographicCamera orbit; TS uses FloatingIsland (voxel layers) + PerspectiveCamera. We preserve the TS architecture but port all visual/mesh/particle/color details from reference.

---

## Scene-by-Scene Gap Analysis

### 1. 🇯🇵 Japan — `KyotoJapan.ts`
**Status**: Largely matches (was the original port). Minor gaps only.

| Reference Has | TS Has? | Action |
|---|---|---|
| Large box island (12×2×12) + grass top | ❌ (uses FloatingIsland) | ⚪ Accept FloatingIsland |
| Torii gate (4 pieces, correct vermillion) | ✅ | None |
| Cherry tree (trunk + 3 leaf clusters) | ✅ | None |
| Stone lantern (3-layer + glowing core) | ✅ | None |
| Moon DirLight (0x718fce, intensity 1.2) | ✅ | None |
| Lantern PointLight (0xffaa33, range 8) | ✅ | None |
| 35 cherry petal particles (fall type) | ✅ | None |

**Verdict**: ✅ Minor — no rewrites needed beyond what art review noted (more trees, bridge, koi pond).

---

### 2. 🇨🇳 China — `ChinaBamboo.ts` 🔴 MAJOR REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Large stone island (10×1.5×10) + moss top (9.6×0.2×9.6) | ❌ FloatingIsland | Accept FloatingIsland |
| **Chinese pavilion** (4 red columns + 5-layer grey tile roof + gold top) | ❌ MISSING | **ADD** |
| **Palace lantern** (red body 0.5×0.7×0.5 + gold glow core 0.38×0.5×0.38) | ❌ Has stone lanterns instead | **REPLACE** |
| Bamboo grove (6 stalks, segmented with node bumps, 7-9 segments each) | 🟡 Has 12 stalks, different implementation | Rework to match segment pattern |
| Bamboo color: 0x2b4c33 (muted olive) | 🔴 0x2d5a27 (too bright) | **FIX** |
| Stone color: 0x1c2024 (dark charcoal) | 0x1a2818 (greenish) | **FIX** |
| Moss color: 0x1f3326 | N/A | **ADD** |
| Moon DirLight (0x4a658a, intensity 1.0) | 0x8899cc, 0.8 | Adjust |
| Palace lantern PointLight (0xff8c00, range 7) | Multiple firefly lights | **REPLACE** with single lantern |
| 25 fireflies (MeshBasicMaterial, 0xccff33, sinusoidal float) | 50 fireflies | Reduce to 25, match animation |
| Firefly animation: angle-based sinusoidal + yStep oscillation + scale pulsing | Different movement pattern | **REWRITE** animation |

**Verdict**: 🔴 Needs major rewrite — add pavilion, palace lantern, fix colors, rework bamboo.

---

### 3. 🇺🇸 USA — `USACyberpunk.ts` 🔴 CONCEPTUAL MISMATCH

The reference is **"Retro Cyberpunk Diner in Desert"**, not a cyberpunk data center.

| Reference Has | TS Has? | Action |
|---|---|---|
| Sand island (11×1.5×11) + road strip (11×0.1×3.5) | ❌ FloatingIsland + neon grid | **REPLACE** with sand+road |
| **Retro diner/motel** (cream walls 0xd9cbd5, dark purple roof 0x3d2940, yellow windows) | ❌ Server racks | **ADD** diner |
| **Neon sign on pole** (pink wings 0xff2a85 + cyan center 0x00f3ff, flicker glitch) | 🟡 Has floating "FISH"/"BYTE"/"404" | **REPLACE** with sign-on-pole |
| **Retro pickup truck** (red body, dark wheels, windshield) | ❌ MISSING | **ADD** |
| **Cacti** (0x244235, 3 sizes with arm branches) | ❌ Has holographic pillars | **REPLACE** |
| Neon PointLight (0xff0077, intensity 3.0, range 8, glitch flicker) | Has magenta lights | Tune to match |
| Diner window PointLight (0xffaa11) | ❌ MISSING | **ADD** |
| 30 dust particles (0x9d72b5, horizontal drift + oscillate) | 60 data rain (wrong type) | **REPLACE** with dust |
| Animated neon sign with glitch effect | ❌ MISSING | **ADD** animatedObject |

**Verdict**: 🔴 Complete conceptual mismatch — needs full rewrite to retro diner + desert theme.

---

### 4. 🇬🇧 UK — `UKThames.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Cobblestone ground (10.5×1.5×10.5) + curb (10.5×0.3×5) | ❌ FloatingIsland | Accept FloatingIsland |
| Brick wall (10.5×5.5×0.8) at z=-5 | 🟡 Brick wall at z=2.8, wrong position | Move to z=-5 |
| **Red telephone booth** (detailed: base, glass body 0xffdd77, 4 red corner frames, stepped top) | ❌ MISSING | **ADD** |
| **Victorian lamp post** (iron post + 2 lamp heads with warm glow) | 🟡 Simpler lamp | Upgrade to twin-head |
| Lamp post PointLight (0xffeebb, 3.0, range 8) | Has 2 lamps | Match reference |
| Booth PointLight (0xff9922) | ❌ MISSING | **ADD** |
| 65 rain drops (0x485673, speed 0.12+) | 80 rain drops | Minor adjust |
| Brick color: 0x3d2727 | 0x5a3a2a | **FIX** |
| Curb color: 0x2e323d | ❌ N/A | **ADD** curb plane |

**Verdict**: 🟡 Add telephone booth, upgrade lamp, fix brick color. Big Ben silhouette optional bonus.

---

### 5. 🇫🇷 France — `FranceSeine.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Street ground (10×1.5×10) | ❌ FloatingIsland | Accept FloatingIsland |
| **Café building** (cream walls 0xded0bc, dark wood base 0x3d271d, warm window 0xffdf9e) | 🟡 Generic building + book stall | **REPLACE** with café |
| **Blue+white striped awning** (8 alternating stripes, rotated 0.3 rad) | ❌ MISSING | **ADD** |
| **Wrought-iron lamp post** (Paris green 0x1c3127, same twin-head as UK) | 🟡 Simpler lamp | Upgrade |
| **Outdoor café furniture** (round table + wooden chair with slatted back) | ❌ MISSING | **ADD** |
| Lamp PointLight (0xffdf9e, 3.2, range 7) | 0xffaa44, 2 | Adjust |
| Café PointLight (0xffb566, 2.0, range 6) | ❌ MISSING | **ADD** |
| 28 autumn leaves (gold 0xc4873b, fall_spin type) | 45 leaves | Reduce to 28, match animation |
| Leaf animation: sinusoidal sway + rotation | Has rotation + sway | Match reference pattern |

**Verdict**: 🟡 Add café awning + furniture, upgrade lamp, tune lights. Eiffel Tower optional background.

---

### 6. 🇩🇪 Germany — `GermanyBlackForest.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Dark ground (10×1.5×10, 0x12161f) | ❌ FloatingIsland | Accept FloatingIsland |
| **Half-timbered house** (cream plaster 0xe6e2d8 + dark timber framework 0x2b1a11 + cross braces) | 🔴 Log cabin! | **REPLACE** with Fachwerk house |
| Red stepped roof (5 layers, 0x7a2b22) | Red flat roof (0x8a2020) | Change to stepped |
| Chimney (0.5×1.2×0.5 dark timber) | Has chimney | Match position |
| Golden window (1.2×0.8×0.1, 0xffaa00) | Warm windows 0xffaa44 | Adjust color |
| Dark door (0.7×1.3×0.1) | Has door | Match position |
| Pine trees (4 trees, 3-5 layers, dark green 0x13261b) | 8 trees, 0x1a3a1a | Reduce to 4, fix color |
| Tree trunk: 0x2b1a11 | 0x3a2a1a | Fix |
| Tavern PointLight (0xff9900, 3.5, range 6) | Fire light 0xff6600 | Adjust |
| Moon DirLight (0x405570, 0.8) | 0x8899cc, 0.9 | Adjust |
| 45 snow particles (MeshBasicMaterial, 0xffffff) | 70 snow | Reduce to 45 |

**Verdict**: 🟡 Replace log cabin with half-timbered house (Fachwerk), fix tree count/colors.

---

### 7. 🇮🇹 Italy — `ItalyVenice.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Water (10×1.2×7) + stone pier (10×1.5×3.5) | ❌ FloatingIsland | Accept FloatingIsland |
| **Two-tone buildings** (terracotta 0x9e4331 + ochre 0xcca05e) | 🔴 All beige 0xcc9966 | **FIX** colors |
| Building windows (warm glow + dark frames) | Simple windows | Add frames |
| **Striped mooring poles** (11 alternating blue 0x1f4172/white 0xe6e1d5 stripes + glow top) | ❌ MISSING | **ADD** |
| Gondola (black 0x111215 + red trim 0x822020, 3.6×0.2×0.9) | Too wide (0.3) | Narrow, add trim |
| Gondola animation (z-rotation ±0.025, y-bobbing ±0.03) | No animation | **ADD** animatedObject |
| Wall lantern (0.25×0.35×0.25 glow + black top) | ❌ MISSING | **ADD** |
| Lantern PointLight (0xff9431, 3.2, range 7) | 0xffcc66, 2 | Adjust |
| Window PointLight (0xffaa44, 1.8, range 5) | ❌ MISSING | **ADD** |
| 30 sea sparkle particles (0x3da39e, rise type) | 40 particles, similar | Match count |

**Verdict**: 🟡 Fix building colors, add mooring poles, add gondola animation, add wall lantern.

---

### 8. 🇩🇰 Denmark — `DenmarkNyhavn.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Water (11×1.2×5.5) + boardwalk (11×1.4×4.5) | ❌ FloatingIsland | Accept FloatingIsland |
| **Mint green townhouse** (0x487865, 3.2×4.2×2.5, stepped charcoal roof) | 🟡 Different house style | Rework to match |
| **Danish red townhouse** (0x8a3324, 2.6×4.8×2.2, stepped roof) | 🟡 Different | Rework |
| Windows with dark frames | Simple windows | Add frames |
| **Double-masted sailboat** (hull 3.5×0.4×1 + 2 masts + white sail) | ❌ MISSING | **ADD** |
| Sailboat animation (z±0.02, x±0.015, y±0.025) | ❌ MISSING | **ADD** animatedObject |
| Lamp post (0x15191e) with warm glow | Has lamp | Match reference |
| Lamp PointLight (0xffaa44, 3.2, range 6) | 0xffbb44 | Adjust |
| Hearth PointLight (0xff8822, 2.5, range 6, noise flicker) | ❌ MISSING | **ADD** |
| 25 ember/smoke particles (0xffbb44, rising with age/lifecycle) | 🔴 60 snow (wrong!) | **REPLACE** with embers |

**Verdict**: 🟡 Replace snow with embers, add sailboat, rework houses to stepped-roof style.

---

### 9. 🇮🇸 Iceland — `IcelandAurora.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Black sand ground (10.5×1.2×10.5, 0x131419) | ❌ FloatingIsland | Accept FloatingIsland |
| **Basalt columns** (hexagonal block formations, 0x22242c) | 🔴 Lava rocks (0x1a1a1a) | **REPLACE** with basalt columns |
| Black church (0x18181d) with **RED roof** (0x732626) | 🔴 Black roof! | **FIX** roof to red |
| Church has **white cross** (0xe2e5eb) | Grey cross (0xdddddd) | Fix to pure white |
| Church has **white window trim** (0xe2e5eb) | ❌ MISSING | **ADD** |
| Church window: 0.4×0.6×0.1 warm glow | 0.15×0.5×0.05 | Enlarge windows |
| Core PointLight (0xff9922, 2.8, range 5) | 0xffcc88, 2 | Adjust |
| Aurora DirLight (0x2bf098, 0.4) | ❌ Has aurora bands instead | Keep bands, add dirLight |
| 45 aurora particles (auroraGreen 0x2bf098, horizontal drift) | 30 dots | Adjust to 45, match drift |

**Verdict**: 🟡 Fix church roof to RED, add basalt columns, add white trim, fix window glow.

---

### 10. 🇹🇭 Thailand — `ThailandChaoPhraya.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Teal river (10.5×1.2×10.5, 0x112822) | ❌ FloatingIsland | Accept FloatingIsland |
| **Teak wood stilt house** (dark brown 0x3d2015, 6 pillars, green+orange tiered roof) | 🔴 Combined temple | **REPLACE** with stilt house |
| **Separate golden chedi** (0xcca625, 8-layer stepped, separate position at 2.2, -1.8) | 🟡 Temple+chedi combined | Separate them |
| House front door glow (0xff8c1a) | Has temple glow | Reposition |
| Chedi PointLight (0xffb833, 3.0, range 7) | Has temple light | Adjust |
| House PointLight (0xff7d1a, 2.2, range 5) | ❌ MISSING | **ADD** |
| 35 krathong lanterns (leaf green base + orange flame, drift animation) | 8 krathongs | Increase to 35, remove sky lanterns |
| Krathong animation: z-drift + sinusoidal x/y | Has drift | Match reference |
| No sky lanterns in reference | Has 5 sky lanterns | Remove (reference doesn't have) |

**Verdict**: 🟡 Replace temple with stilt house + separate chedi, increase krathongs to 35, remove sky lanterns.

---

### 11. 🇪🇬 Egypt — `EgyptValleyKings.ts` 🟡 MODERATE REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Sand (12×1.2×12, 0xcca625) | ❌ FloatingIsland | Accept FloatingIsland |
| Oasis pool (3×0.1×3, 0x1a3d3d) at (3, 0.05, 2) | Nile river (different) | **REPLACE** with oasis |
| **Step pyramid** (5×1×5, 3.2×1×3.2, 1.4×1×1.4 gold top) at (-1, -1) | 🟡 Different proportions | Match reference |
| Pyramid color: 0x8c701b (dark sandstone) + 0x4a3b0f (darker) | 0xccaa55 (too yellow) | **FIX** |
| **Cacti** (3 sizes, 0x2d4a1e, with arm branches) | 🔴 Palm trees (wrong!) | **REPLACE** with cacti |
| Obelisk (0.3×3.5×0.3, 0x4a3b0f) | Has obelisk | Adjust color |
| Pyramid PointLight (0xffaa00, 3.0, range 10) | Has cap light | Adjust |
| Oasis PointLight (0x44ffaa, 1.5, range 5) | ❌ MISSING | **ADD** |
| 40 dust particles (0xffd700, drift type, horizontal) | 40 dust (different color) | Fix to gold |

**Verdict**: 🟡 Fix pyramid colors, replace palms with cacti, replace Nile with oasis pool, add oasis light.

---

### 12. 🇬🇷 Greece — `GreeceSantorini.ts` 🟡 MINOR REWRITE

| Reference Has | TS Has? | Action |
|---|---|---|
| Water (12×1.2×12, 0x112547) | ❌ FloatingIsland | Accept FloatingIsland |
| **Windmill** (white 0xe2e5eb cube 3×3.5×3 + blue 0x1f5cb8 stepped dome 6 layers + gold top) | 🟡 Similar but blue too dark (0x3366cc) | **FIX** blue to 0x1f5cb8 |
| **Rotating blades** (4 blades, gold 0xffdd44, 3.6×0.15×0.15) | Has blades, white | **FIX** to gold |
| Blade rotation: z-axis at 0.5 rad/s | z-axis at 0.008 rad/frame | Match speed |
| **White Santorini houses** (2 houses, flat white + blue roof trim) | 4 houses | Match reference layout |
| **Wooden pergola** (4 posts + top frame, 0x5c4033) | ❌ MISSING | **ADD** |
| Sun DirLight (0xffddaa, 0.8) | 0x3399ff, 1.3 | Adjust to warm sun |
| Window PointLight (0xffdd44, 2.0, range 5) | Has window light | Adjust color |
| 30 float particles (white, gentle rise+drift) | 35 sparkles | Match to float type |

**Verdict**: 🟡 Fix blue dome color, fix blade color to gold, add pergola, adjust lighting.

---

## Priority Summary

### 🔴 Critical Conceptual Mismatches (need full rewrite of scene content)
| Scene | Issue |
|---|---|
| 🇺🇸 USA | Retro diner in desert ↔ Cyberpunk data center |
| 🇨🇳 China | Chinese pavilion missing entirely |

### 🟡 Significant Missing Elements (need substantial additions)
| Scene | Missing Elements |
|---|---|
| 🇩🇰 Denmark | Sailboat, ember particles ↔ snow |
| 🇩🇪 Germany | Half-timbered house ↔ log cabin |
| 🇫🇷 France | Café awning, outdoor furniture |
| 🇬🇧 UK | Telephone booth, twin-head lamp |
| 🇮🇹 Italy | Mooring poles, gondola animation, wall lantern |
| 🇹🇭 Thailand | Stilt house + separate chedi ↔ combined temple |
| 🇪🇬 Egypt | Cacti ↔ palms, oasis ↔ Nile |
| 🇮🇸 Iceland | Red church roof ↔ black, basalt columns ↔ lava rocks |

### ⚪ Minor Tune-ups
| Scene | Fixes |
|---|---|
| 🇯🇵 Japan | Accept as-is (direct port) |
| 🇬🇷 Greece | Blue dome color, blade color, pergola |

### Architectural Notes
- All scenes use `FloatingIsland` instead of the reference's large box islands — this is **acceptable** as an artistic choice (voxel aesthetic).
- All scenes use PerspectiveCamera instead of OrthographicCamera — this is **acceptable** for the fishing game (depth needed for casting).
- Particle counts can vary ±20% from reference based on performance.
- Flicker light system already matches reference pattern.
