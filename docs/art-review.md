# 🎨 Art Review: 12 Sanctuary Scenes — Cultural Authenticity & Visual Audit

> **Reviewer Role**: Art Director  
> **Date**: 2026-06-06  
> **Scope**: All 12 `src/renderer/locations/*.ts` scene classes  

---

## Scoring Legend

| Icon | Rating |
|------|--------|
| 🟢 | Strong — authentic, visually clear |
| 🟡 | Adequate — works but could be richer |
| 🔴 | Needs improvement — missing key elements or incorrect |
| ⚪ | Cosmetic — minor polish needed |

---

## 1. 🇯🇵 Kyoto, Japan — Sakura Shrine at Dusk

| Aspect | Rating | Notes |
|--------|--------|-------|
| Torii gate | 🟢 | Vermillion color correct (0x8f2d34), proper proportion |
| Cherry blossom tree | 🟡 | Single tree with 3 leaf clusters; Kyoto is known for *groves* |
| Stone lantern | 🟢 | Classic tōrō form with glowing core |
| Cherry blossom petals | 🟢 | 35 falling petals with rotation — good |
| **Missing: arched bridge** | 🔴 | No *taiko-bashi* (arched bridge); essential Kyoto shrine element |
| **Missing: koi pond** | 🔴 | No water feature despite theme being fishing |
| **Color: island grass** | 🟡 | 0x223e4a (dark teal) → should be warmer moss (0x3a5a3a) |
| **Color: sky/ambient** | 🟢 | Moonlight 0x718fce + warm lantern 0xffaa33 = good contrast |
| Particle count | 🟢 | 35 petals + BaseLocation 80 particles = adequate |

**Improvements:**
1. Add 2-3 more cherry trees around island perimeter
2. Add a small arched wooden bridge (3-4 boxes) spanning a koi pond
3. Add koi fish silhouette boxes in pond (orange/white)
4. Adjust grass material to warmer moss green

---

## 2. 🇨🇳 China — Bamboo Grove & Firefly Pond

| Aspect | Rating | Notes |
|--------|--------|-------|
| Bamboo stalks | 🟢 | 12 stalks with node segments, varied heights (2.5-6.0) |
| Firefly particles | 🟢 | 50 fireflies with sinusoidal floating animation + opacity pulse |
| Zen pond | 🟢 | Elliptical pond with 12 rim stones |
| Stone lanterns | 🟢 | Two lanterns with layered stone + glowing top |
| Crescent moon | 🟡 | Square-box "cutout" approach creates crescent from front only |
| **Missing: pavilion** | 🔴 | No Chinese architectural element — add a small *ting* (亭) |
| **Missing: mist** | 🟡 | Bamboo forests are known for ground mist — add fog layer |
| **Color: bamboo** | 🟡 | 0x2d5a27 too saturated; real bamboo is 0x4a6e3a (muted olive) |
| **Color: pond** | 🟢 | Deep zen water 0x0a2030 works well |

**Improvements:**
1. Add a small hexagonal pavilion (6 columns + pagoda roof) at island center
2. Add 3-4 semi-transparent horizontal fog planes near ground
3. Adjust bamboo green to warmer olive
4. Replace crescent cutout with a proper arc of small emissive boxes

---

## 3. 🇺🇸 USA — Cyberpunk Neon Alley

| Aspect | Rating | Notes |
|--------|--------|-------|
| Neon grid floor | 🟢 | Tron-style magenta grid on dark floor |
| Server racks | 🟡 | Generic boxes with green lights; add wireframe/cable detail |
| Neon signs | 🟢 | "FISH", "BYTE", "404" — thematic, with matching point lights |
| Holographic pillars | 🟢 | 4 pillars with glowing ring at top, good placement |
| Data rain | 🟢 | 60 falling neon boxes, Matrix-style |
| **Missing: alley walls** | 🔴 | No tall side walls creating "canyon" effect — essential for alley feel |
| **Color: palette** | 🟡 | Too monochrome magenta; cyberpunk needs cyan+orange contrast |
| **Missing: reflection** | ⚪ | Grid should reflect on water surface below |
| Particle count | 🟢 | 60 rain particles + BaseLocation 80 |

**Improvements:**
1. Add two tall wall blocks (3×8×0.5) on left/right sides for alley depth
2. Add orange (#ff6600) accent signs to balance magenta/cyan palette
3. Add ground-level emissive fog (opacity 0.15) below grid
4. Add thin cable lines between server racks

---

## 4. 🇬🇧 UK — Rainy Thames Dock

| Aspect | Rating | Notes |
|--------|--------|-------|
| Wooden dock | 🟢 | Platform + plank lines + 4 pillars — good construction |
| Brick wall | 🟡 | Offset brick pattern correct, but placed at z=2.8 blocking view |
| Lampposts | 🟢 | Victorian-style with warm glow (0xffaa44) |
| Big Ben | 🟡 | Silhouette with clock face, but at z=-3.5 may clip camera |
| Rain particles | 🟢 | 80 rain drops with slight wind drift — excellent |
| **Missing: red elements** | 🔴 | No red phone booth, post box, or double-decker bus |
| **Missing: water reflection** | 🟡 | Thames water too uniform dark |
| **Color: brick** | 🟢 | 0x5a3a2a (warm brown) correct for London brick |

**Improvements:**
1. Move brick wall to x=-3.5 side (framing, not blocking)
2. Add a red phone booth (0.6×1.5×0.6 red box with window cutout)
3. Add second Big Ben side tower for proportion
4. Brighten water with subtle reflection plane

---

## 5. 🇫🇷 France — Autumn Leaves on the Seine

| Aspect | Rating | Notes |
|--------|--------|-------|
| Eiffel Tower | 🟡 | Good base→spire taper, but color too dark (0x4a3a2a) |
| Autumn trees | 🟢 | 4 trees with 3-leaf canopies in orange/red/gold |
| Book stall | 🟢 | *Bouquiniste* with 4 colored books — excellent cultural detail |
| Street lamps | 🟢 | Parisian style with warm glow, sunset directional light |
| Falling leaves | 🟢 | 45 leaves with rotation, sway, color variety |
| **Missing: Notre-Dame** | 🔴 | Iconic silhouette should peer from background |
| **Missing: café chairs** | 🟡 | Small tables/chairs on riverbank |
| **Color: tower** | 🟡 | Should be iron-brown (0x7a6a5a), not dark brown |

**Improvements:**
1. Lighten Eiffel Tower to 0x7a6a5a (wrought iron brown)
2. Add small Notre-Dame silhouette (twin towers + spire) at z=-5
3. Add 2-3 café table groups (tiny boxes with chairs)
4. Adjust tree Z from 1.5 to 0.5 (too far forward)

---

## 6. 🇩🇪 Germany — Black Forest Winter Cabin

| Aspect | Rating | Notes |
|--------|--------|-------|
| Log cabin | 🟢 | Wall + A-frame roof + chimney + door + warm windows |
| Pine trees | 🟢 | 8 trees with 3-layer canopy + snow caps |
| Snow system | 🟢 | 70 snow particles + 8 ground patches |
| Chimney smoke | 🟡 | Good lifecycle, but instant reset feels abrupt |
| Wood pile | 🟢 | 5 stacked logs — nice detail |
| **Color: roof** | 🔴 | 0x8a2020 (bright red) wrong for Black Forest; should be dark brown (0x4a3020) |
| **Missing: window shutters** | 🟡 | Bavarian-style green shutters |
| **Missing: cuckoo clock** | ⚪ | Small clock face on cabin wall |

**Improvements:**
1. Change cabin roof from red to dark brown (0x4a3020)
2. Add green shutters beside windows (0x2a5a2a)
3. Extend smoke top fade (scale opacity from 0.4→0 over 2s)
4. Add 2-3 more pine varieties (thinner, taller)

---

## 7. 🇮🇹 Italy — Venice Canal at Twilight

| Aspect | Rating | Notes |
|--------|--------|-------|
| Canal + embankments | 🟢 | Water + stone sides — good foundation |
| Buildings | 🟡 | 4 buildings but all same warm beige (0xcc9966) |
| Bridge | 🟢 | Arch with side supports |
| Gondola | 🟡 | Present but too wide (0.3) and no gondolier |
| Twilight lighting | 🟢 | Warm orange (0xff9431) low-angle |
| **Missing: striped poles** | 🔴 | No *pali da casada* (striped mooring poles) — iconic Venice |
| **Color: buildings** | 🔴 | All identical; Venice has terracotta, ochre, pale pink, cream |
| **Color: gondola** | 🟡 | Black correct but bow/stern curls too uniform |
| Particle type | 🟡 | Rising sparkles OK but would be better as water reflections |

**Improvements:**
1. Vary building colors: add ochre (0xcc8844), pale pink (0xddbbaa), cream (0xeeddcc)
2. Add 3-4 striped mooring poles (alternating white/red thin boxes)
3. Narrow gondola from 0.3 to 0.2 width
4. Add water reflection shimmer particles (cyan, low opacity)

---

## 8. 🇩🇰 Denmark — Nyhavn Winter Night

| Aspect | Rating | Notes |
|--------|--------|-------|
| Colorful houses | 🟢 | 7 houses in correct Nyhavn palette |
| Harbor water | 🟡 | 0x1a2a3a too dark for canal |
| Dock + planks | 🟢 | Good construction with plank lines |
| Snow system | 🟢 | 60 snow + 6 ground patches + snow on roofs |
| Harbor lamp | 🟢 | Single warm lamp post |
| **Missing: ship masts** | 🔴 | No wooden ships — Nyhavn's defining feature is historic vessels |
| **Missing: spire** | 🟡 | Copenhagen has distinctive copper spires |
| **Color: house widths** | 🟡 | All 0.8 wide; real Nyhavn varies 0.5–1.5 |

**Improvements:**
1. Add 2 wooden ship hulls with 2-3 masts each (thin tall boxes with rigging)
2. Vary house widths randomly (0.5–1.2)
3. Brighten water to 0x2a4a5a
4. Add small copper-green spire silhouette behind houses

---

## 9. 🇮🇸 Iceland — Aurora over the Black Church

| Aspect | Rating | Notes |
|--------|--------|-------|
| Black church | 🟡 | Good Búðakirkja proportions but missing white window frames |
| Aurora bands | 🟢 | 5 bands with shimmer animation, green+cyan alternating |
| Lava rocks | 🟢 | 6 rock formations with asymmetrical shapes |
| Snow patches | 🟢 | 10 patches + BaseLocation snow |
| Aurora dots | 🟢 | 30 floating aurora-colored particles |
| **Missing: geothermal steam** | 🔴 | No steam vents — Iceland's defining landscape feature |
| **Missing: turf roof** | 🟡 | Some Icelandic churches have grass/turf; could be subtle green on roof edge |
| **Color: church trim** | 🔴 | Real Búðakirkja has white window frames and door trim |

**Improvements:**
1. Add white window frame boxes around church windows
2. Add 3-4 geothermal steam vents (rising white semi-transparent boxes)
3. Add subtle green turf strip on church roof edges
4. Lower aurora bands from y=7–10 to y=5–8 for better framing

---

## 10. 🇹🇭 Thailand — Chao Phraya Floating Lanterns

| Aspect | Rating | Notes |
|--------|--------|-------|
| Temple (wat) | 🟡 | Tiered roof + golden chedi correct, but walls too uniform |
| Krathong lanterns | 🟢 | 8 floating lanterns with flame lights and drift animation |
| Sky lanterns | 🟡 | Good animation but only 5 — should be 10-15 for festival feel |
| Lotus flowers | 🟢 | 6 lotus with green pads — correct |
| River | 🟢 | Good water plane |
| **Missing: spirit house** | 🔴 | *San phra phum* (spirit house) is at every Thai temple |
| **Missing: Buddha statue** | 🔴 | Golden sitting Buddha silhouette |
| **Color: temple walls** | 🔴 | Should be white (0xeee8d5) with gold trim, not beige |

**Improvements:**
1. Change temple wall to white (0xeee8d5) with gold roof trim
2. Add small golden Buddha statue (seated pose, 0.4×0.6×0.3 gold box)
3. Add spirit house (small ornate box on pillar) near temple
4. Increase sky lantern count from 5 to 12
5. Add 2-3 long-tail boat silhouettes on river

---

## 11. 🇪🇬 Egypt — Valley of the Kings

| Aspect | Rating | Notes |
|--------|--------|-------|
| Great Pyramid | 🟡 | 6-step construction — good but color too yellow |
| Small pyramid | 🟢 | 5-step, good companion |
| Obelisk | 🟡 | Stacked pyramidion top unusual — real obelisks taper to single point |
| Temple columns | 🟢 | 3 columns with capitals |
| Palm trees | 🟢 | 2 palms with frond arrays |
| Desert sand | 🟢 | Good sand plane + base |
| **Missing: Sphinx** | 🔴 | Most iconic Egyptian monument after pyramids |
| **Missing: hieroglyphs** | 🟡 | Columns too plain — could use colored accent boxes |
| **Color: pyramid** | 🟡 | 0xccaa55 too yellow; real limestone is 0xd4b896 (warm sandstone) |
| Dust particles | 🟡 | Horizontal drift only — should have mild swirl |

**Improvements:**
1. Add small Sphinx silhouette (body + head, 4-6 boxes) near pyramid
2. Adjust pyramid color to 0xd4b896 (sandstone)
3. Add thin colored accent strips on columns (turquoise/gold)
4. Add vertical oscillation to dust particles for swirling effect

---

## 12. 🇬🇷 Greece — Santorini Windmill

| Aspect | Rating | Notes |
|--------|--------|-------|
| White buildings | 🟢 | 4 cubic buildings with flat roofs, blue windows |
| Blue dome church | 🟡 | Dome too dark (0x3366cc); should be brighter Aegean blue |
| Windmill | 🟡 | Tower + dome roof correct, blades rotate (0.008 rad/frame) |
| Stairs | 🟡 | 6 steps but too thin (0.15 depth), barely visible |
| Aegean sea | 🟢 | Good deep blue (0x1a3060) |
| **Missing: bougainvillea** | 🔴 | Fuchsia/magenta flowers on white walls — essential Santorini icon |
| **Missing: bell tower** | 🟡 | Many Santorini churches have adjacent bell towers |
| **Color: dome** | 🔴 | 0x3366cc is cobalt; Santorini domes are 0x4488dd (brighter sky blue) |
| Particle type | 🟡 | Sparkles OK but sea spray/white dots would be more thematic |

**Improvements:**
1. Add bougainvillea accent boxes (fuchsia 0xcc3388) on 2 building walls
2. Brighten dome to 0x4488dd
3. Add small bell tower (0.3×1.5×0.3 white box + arch cutout) beside church
4. Widen stairs to 0.4 depth for visibility
5. Replace sparkle particles with gentle sea spray (white, horizontal drift)

---

## Priority Matrix

```
                    HIGH IMPACT                    LOW IMPACT
                  ┌─────────────────┬─────────────────┐
  CRITICAL        │ 🇹🇭 Temple color │ 🇩🇪 Roof color  │
  (cultural       │ 🇪🇬 Missing Sphinx│ 🇫🇷 Tower color │
   accuracy)      │ 🇩🇰 Missing ships │ 🇬🇷 Dome color  │
                  │ 🇮🇹 Building colors│                │
                  ├─────────────────┼─────────────────┤
  NICE-TO-HAVE    │ 🇯🇵 More trees   │ 🇨🇳 Pavilion    │
  (atmosphere)    │ 🇺🇸 Alley walls  │ 🇬🇧 Phone booth │
                  │ 🇮🇸 Steam vents  │ 🇹🇭 More lanterns│
                  │ 🇬🇷 Bougainvillea│ 🇪🇬 Column detail│
                  └─────────────────┴─────────────────┘
```

## Summary

| Scene | Score | Critical Fixes Needed |
|-------|-------|----------------------|
| 🇯🇵 Japan | 🟡 7/10 | Bridge + koi pond + more trees |
| 🇨🇳 China | 🟡 7/10 | Pavilion + mist + bamboo color |
| 🇺🇸 USA | 🟡 6/10 | Alley walls + orange contrast |
| 🇬🇧 UK | 🟡 7/10 | Phone booth + wall reposition |
| 🇫🇷 France | 🟡 7/10 | Tower color + Notre-Dame |
| 🇩🇪 Germany | 🟡 7/10 | Roof color + shutters |
| 🇮🇹 Italy | 🟡 6/10 | Building colors + mooring poles |
| 🇩🇰 Denmark | 🟡 6/10 | Ship masts + house widths |
| 🇮🇸 Iceland | 🟡 7/10 | Geothermal steam + window trim |
| 🇹🇭 Thailand | 🔴 5/10 | Temple color + Buddha + spirit house |
| 🇪🇬 Egypt | 🟡 6/10 | Sphinx + pyramid color |
| 🇬🇷 Greece | 🟡 7/10 | Bougainvillea + dome color |

**Overall**: All 12 scenes have a solid low-poly foundation with appropriate base elements. The main weaknesses are in color accuracy (especially Thailand, Italy, Germany, Egypt, Greece) and missing culturally-defining elements (Sphinx, Nyhavn ships, mooring poles, bougainvillea, spirit house). These are all fixable with targeted box-geometry additions and material color adjustments.
