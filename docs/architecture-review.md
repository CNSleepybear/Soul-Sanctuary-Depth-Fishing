# SoulSanctuary — 全项目架构深度审查

> 审查时间: 2026-06-06 | 版本: v0.4.0 (Phase 4 Content)  
> 审查范围: 55 个 TypeScript 模块, 3 个进程 (main/preload/renderer)

> **更新日志（2026-06-22）**: 本报告中的 Critical/Warning 问题已有较大进展：
> - **C1** — `'fishing:burst'` 已加入 `GameEventMap` 与 `GameEvents` 常量。
> - **C2** — 遗物已传入 `ModifierEngine` 参与数值计算；tag-based 遗物（Midas Coin / Anchor / Feather / Echo Stone）已在 `FishingSystem` / `RunManager` 中消费。
> - **C3 + C4** — `ipc-handlers.ts` 已实现 `save:write/read`，`renderer/index.ts` 的 `onRequestSave` 已触发真实文件写入。
> - **C5** — `DailyState` 已随 `GameStateManager` 持久化到 localStorage 与文件。
> - **C6** — `rareBonus` modifier 已在 `FishingSystem._rollForBite` 中接入稀有鱼权重。
> - **Preload 路径** — 生产构建中 Preload 路径已修正为 `dist-electron/preload.js`。
> - **Synergy key** — `Balanced Approach` / `Momentum` 的 stat key 已对齐实际使用的 `tensionSlackRate` / `fishProgressRate`。
> - **托盘切换圣地** — `renderer/index.ts` 已处理 `'change_location'` 快捷键。
> - **点击穿透** — `WindowManager.setInteractive(false)` 已启用 `setIgnoreMouseEvents(true, { forward: true })`。

---

## 🗺️ 第一轮：项目地图 — 模块依赖拓扑

### 1.1 导入方向 — Mermaid 依赖图

```mermaid
graph TD
    subgraph "Entry Point"
        IDX[renderer/index.ts]
    end

    subgraph "Shared (唯一可信数据源)"
        SH_TYPES[shared/types.ts]
        SH_ENUMS[shared/enums.ts]
        SH_CONST[shared/constants.ts]
        SH_EVENTS[shared/events.ts]
    end

    subgraph "Core (基础设施)"
        EB[core/EventBus.ts]
        GL[core/GameLoop.ts]
        IM[core/InputManager.ts]
        RNG[core/RNG.ts]
        SM[core/StateMachine.ts]
        GSM[core/GameStateManager.ts]
    end

    subgraph "Data (静态数据)"
        FDB[data/fish-database.ts]
        LD[data/location-data.ts]
        DS[data/DailySystem.ts]
    end

    subgraph "Roguelike (肉鸽系统)"
        MOD[roguelike/ModifierEngine.ts]
        RM[roguelike/RunManager.ts]
        RUI[roguelike/RunUI.ts]
        CM[roguelike/CampManager.ts]
        CH[roguelike/charm-data.ts]
        RL[roguelike/relic-data.ts]
        EV[roguelike/event-data.ts]
        AC[roguelike/achievement-data.ts]
    end

    subgraph "Fishing (钓鱼核心)"
        FS[FishingSystem.ts]
        FSP[FishSpawner.ts]
        FSC[FishingSceneManager.ts]
    end

    subgraph "Rendering (Three.js 渲染)"
        REN[Renderer.ts]
        BOB[Bobber.ts]
        FLI[FishingLine.ts]
        SPL[SplashEffect.ts]
        VFM[VoxelFishModel.ts]
        FIS[FloatingIsland.ts]
        FHM[Fisherman.ts]
        CC[CameraController.ts]
        PIPE[Pipeline.ts]
    end

    subgraph "UI (DOM 界面)"
        FUI[ui/FishingUI.ts]
        SUI[ui/SceneUI.ts]
        FP[ui/Fishpedia.ts]
        DP[ui/DraggablePanel.ts]
    end

    subgraph "Locations (场景)"
        BL[locations/BaseLocation.ts]
        LM[locations/LocationManager.ts]
    end

    subgraph "Main Process (Electron)"
        MAIN[main/index.ts]
        WM[window-manager.ts]
        TM[tray-manager.ts]
        IPC[ipc-handlers.ts]
        PRE[preload.ts]
    end

    %% Entry wiring
    IDX --> EB
    IDX --> GL
    IDX --> IM
    IDX --> REN
    IDX --> LM
    IDX --> FS
    IDX --> RM
    IDX --> GSM
    IDX --> RUI
    IDX --> FSC
    IDX --> SUI
    IDX --> FUI
    IDX --> FP
    IDX --> DS
    IDX --> SH_CONST
    IDX --> SH_ENUMS

    %% Core imports
    GSM --> EB
    GSM --> CM
    GSM --> RL
    GSM --> AC
    GSM --> LD
    IM --> EB
    FS --> EB
    FS --> RNG
    FS --> FSP
    RM --> EB
    RM --> RNG
    RM --> FS
    RM --> FSP
    RM --> MOD
    RM --> CH
    RM --> EV
    DS --> RNG
    DS --> LD

    %% UI imports
    FUI --> EB
    SUI --> EB
    FP --> EB
    FP --> GSM
    FP --> FDB
    FP --> VFM
    RUI --> EB
    RUI --> RM
    RUI --> GSM
    RUI --> DS
    RUI --> LM
    RUI --> SUI
    RUI --> DP
    RUI --> CH
    RUI --> RL
    RUI --> AC
    RUI --> LD

    %% Fishing scene imports
    FSC --> EB
    FSC --> BOB
    FSC --> FLI
    FSC --> SPL
    FSC --> VFM
    FSC --> FHM

    %% Location imports
    LM --> LD
    LM --> BL
    BL --> REN  %% ParticleSystem

    %% Data imports
    FDB --> SH_TYPES
    FDB --> SH_ENUMS
    FSP --> RNG
    FSP --> FDB

    %% Roguelike data imports
    CH --> SH_TYPES
    CH --> SH_ENUMS
    RL --> SH_TYPES
    RL --> SH_ENUMS
    EV --> SH_TYPES
    MOD --> SH_TYPES
    MOD --> SH_CONST

    %% Rendering imports
    REN --> SH_CONST
    CC --> REN  %% camera access
    VFM --> SH_TYPES

    %% Shared imports
    SH_TYPES --> SH_ENUMS
    SH_EVENTS --> SH_TYPES
    SH_EVENTS --> SH_ENUMS
```

### 1.2 循环依赖检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `roguelike/` ↔ `fishing/` | 🟢 无循环 | `RunManager` → `FishingSystem`, `FishingSystem` → `FishSpawner`, 单向 |
| `ui/` → `renderer/core/` | 🟢 仅依赖 EventBus | `FishingUI`, `SceneUI`, `RunUI` 只 import `EventBus`, 不直接依赖 `Renderer` |
| `shared/` 依赖 | 🟢 单向 | `shared/` 是叶子节点，不 import 任何其他模块 |
| `data/` 依赖 | 🟢 单向 | `fish-database.ts` → `shared/types`, `shared/enums`; `DailySystem` → `RNG`, `location-data` |
| 环形: `index.ts` ↔ 多模块 | 🟡 星形辐射 | `index.ts` 是组合根 (Composition Root)，import 所有模块，这是预期的 DI 模式 |

**结论**: 无循环依赖。架构分层清晰：`shared/` → `core/data` → `roguelike/fishing/rendering` → `ui/locations` → `index.ts`。

### 1.3 数据流向

```
┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  fish-db.ts  │───▶│ FishSpawner  │───▶│FishingSystem │
│  location.ts │    │ spawn()      │    │ _rollForBite │
│  charm-data  │    └─────────────┘    └──────┬───────┘
│  relic-data  │                              │
│  event-data  │    ┌─────────────┐           │ CaughtFish
└──────────────┘    │ModifierEngine│◀──────────┘
       │            │ compute()    │
       │            └──────┬──────┘
       ▼                   │ ModifiedStats
┌──────────────┐           ▼
│ RunManager   │───▶ FishingSystem.applyModStats()
│ startRun()   │
└──────┬───────┘
       │ RunRewards
       ▼
┌──────────────┐
│GameStateMgr  │───▶ localStorage (SAVE_PREFIX + slot)
│ recordCatch()│
│ applyRewards │
└──────────────┘
```

**检查**: `shared/` 是唯一可信数据源：
- ✅ `FishRarity`, `FishBehavior`, `CatchQuality` 枚举定义在 `shared/enums.ts`，所有模块 import 同一来源
- ✅ `SpiritFish`, `Modifier`, `RunRewards` 类型定义在 `shared/types.ts`
- ✅ `BALANCE` 常量定义在 `shared/constants.ts`
- ✅ 事件名称定义在 `shared/events.ts`（`GameEvents` const 对象 + `GameEventMap` 类型）
- ⚠️ `GameEvents.FISHING_CAST` 等 const 值在 emit 中使用 `GameEvents.FISHING_CAST`，但 subscribe 中混用字符串字面量和 `GameEvents` 常量 — 见 1.5

### 1.4 生命周期所有权

| 对象 | 创建者 | 销毁者 | 生命周期 |
|------|--------|--------|----------|
| `FishingSystem` | `index.ts` (line 93) | 未显式销毁 | 应用级单例 |
| `RunManager` | `index.ts` (line 94) | 未显式销毁 | 应用级单例 |
| `FishSpawner` | `FishingSystem.setSpawnContext()` | 隐式 GC | 每次 startRun 重建 |
| `ModifierEngine` | 静态类 | N/A | 无状态，纯函数 |
| `GameStateManager` | `index.ts` (line 90) | dispose() | 应用级单例 |
| `FishingSceneManager` | `index.ts` (line 98) | dispose() | 应用级单例 |
| `LocationManager` | `index.ts` (line 86) | destroy() | 应用级单例 |

**⚠️ 发现问题**:

1. **`FishingSystem` 是应用级单例** — 每次 `RunManager.startRun()` 调用 `fishingSystem.setSpawnContext()` 和 `startRun()`，但 FishingSystem 的订阅 (`input:down`, `input:up`) 在构造函数中注册且永不解除。如果 RunManager 被多次 startRun，FishingSystem 的状态正确重置了（`resetToIdle()`），但 **InputManager 的订阅是全局的**，不会因为 FishingSystem 重置而改变。

2. **`ModifierEngine` 是纯静态类** — ✅ 正确。`compute()` 每次接收 modifiers 数组，返回新的 `ModifiedStats` 对象，无状态污染。

3. **`RunManager` 不在主进程和渲染进程各一份** — ✅ 正确。RunManager 仅在 `src/renderer/` 中定义，运行在渲染进程。主进程 (`src/main/`) 不包含任何游戏逻辑。

### 1.5 事件总线/消息机制

**通信方式**: `EventBus` (typed pub/sub, 定义在 [`EventBus.ts`](src/renderer/core/EventBus.ts))

**事件名称管理**: 混合模式

```typescript
// ✅ 正确用法 - emit 使用 GameEvents 常量
this.eventBus.emit(GameEvents.FISHING_CAST, { power, bait: 'none' });

// ⚠️ 混用 - subscribe 使用字符串字面量
this.eventBus.on('fishing:bite', () => { ... });
this.eventBus.on('fishing:burst', () => { ... }); // 'fishing:burst' 不在 GameEvents 中!
```

| 位置 | 问题 | 严重度 |
|------|------|--------|
| [`FishingUI.ts:282`](src/renderer/ui/FishingUI.ts:282) | `'fishing:nibble'` 字符串字面量，非 `GameEvents.FISHING_NIBBLE` | 🟡 |
| [`FishingUI.ts:283`](src/renderer/ui/FishingUI.ts:283) | `'fishing:bite'` 字符串字面量 | 🟡 |
| [`FishingUI.ts:284-298`](src/renderer/ui/FishingUI.ts:284) | `'fishing:hook_set'`, `'fishing:reel_update'`, `'fishing:burst'`, `'fishing:catch'`, `'fishing:escape'`, `'fishing:line_break'`, `'fishing:idle'`, `'fishing:cast_start'` 全部字符串字面量 | 🟡 |
| [`FishingSystem.ts:556`](src/renderer/fishing/FishingSystem.ts:556) | `this.eventBus.emit('fishing:burst', ...)` — `'fishing:burst'` **不在 `GameEvents` 和 `GameEventMap` 中定义** | 🔴 |
| [`Fishpedia.ts:86`](src/renderer/ui/Fishpedia.ts:86) | `this.eventBus.on('game:fishpedia_update', ...)` 字符串字面量 | 🟡 |
| [`Fishpedia.ts:94`](src/renderer/ui/Fishpedia.ts:94) | `this.eventBus.on('input:shortcut', ...)` 字符串字面量 | 🟡 |

**🔴 Critical**: `'fishing:burst'` 事件在 [`FishingSystem.ts:556`](src/renderer/fishing/FishingSystem.ts:556) 中 emit，在 [`FishingUI.ts:293`](src/renderer/ui/FishingUI.ts:293) 中被订阅，但**不在 [`GameEventMap`](src/shared/events.ts) 类型定义中**。这意味着：
- TypeScript 无法对 payload 做类型检查
- GameEvents 常量对象中没有 `FISHING_BURST` 条目
- 拼写错误不会被编译期捕获

---

## 🔬 第二轮：分模块深度审查

### P0: `shared/` + `data/` — 类型、常量、配置

#### `shared/types.ts` — 类型定义

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型完整性 | 🟢 | `SpiritFish`, `CaughtFish`, `Modifier`, `RunRewards` 等核心类型定义完整 |
| 冗余字段 | 🟡 | `Relic` 同时有 `id` 和 `relicId`，两者语义相同（见 [`relic-data.ts:9`](src/renderer/roguelike/relic-data.ts:9)） |
| 枚举一致性 | 🟢 | `FishRarity`, `CatchQuality`, `RunEndReason` 枚举在 `enums.ts` 统一定义 |

#### `shared/constants.ts` — 平衡数值

| 检查点 | 结果 |
|--------|------|
| `BALANCE` 是否被 `ModifierEngine` 正确引用 | 🟢 `ModifierEngine.compute()` 使用 `BALANCE as unknown as Record<string, number>` |
| `BALANCE.slackLineBurst` 嵌套对象 | 🟡 `ModifierEngine` 在 flat map 中无法处理嵌套对象，slackLineBurst 的 key 不会出现在 `result` 中。但 `FishingSystem` 直接读 `BALANCE.slackLineBurst[rarity]`，不经过 `ModifierEngine`，所以运行正确。只是架构不一致。 |
| `BAITS` 数组 | 🟡 `BAITS` 定义在 `constants.ts` 但 `BaitConfig` 类型在 `types.ts`。`BAITS` 使用独立的 `BaitDef` 接口，与 `BaitConfig` 不同。消费者 (`FishingSystem`) 未使用 bait 数据 — `_releaseCast` 硬编码 `bait: 'none'` |

#### `data/fish-database.ts` — 141 条鱼数据

| 检查点 | 结果 |
|--------|------|
| ID 唯一性 | 🟢 所有 ID 使用 `{prefix}_{name}` 格式，无重复 |
| 数据完整性 | 🟢 所有鱼都有 `id`, `name`, `location`, `rarity`, `modelConfig`, `colorPalette`, `size`, `behavior`, `timeWindows`, `baseGold`, `xpValue`, `description` |
| 与 `FishSpawner` 契约 | 🟢 `FISH_BY_LOCATION` Map 正确索引，`FishSpawner.spawn()` 正确读取 |
| 与 `FishingSystem._rollForBite` 契约 | 🟢 (已修复) 现已正确过滤 time/weather/season/bait |

#### `data/DailySystem.ts` — 每日系统

| 检查点 | 结果 |
|--------|------|
| 日期键格式 | 🟡 `todayKey()` 使用本地时间 `new Date().toISOString().slice(0, 10)` — 如果玩家跨时区，可能造成日期不一致 |
| 刷新逻辑 | 🟡 `_checkRefresh` 在同一日重启时重新 `_rollQuests()`，RNG 用 `Date.now()` 种子导致 quest 可能不同 |
| 进度追踪 | 🟡 `_onFishCaught` 中用 `fish.goldEarned` 推断稀有度 (≥150 = Legendary+)，但 goldEarned 受 quality/spirit variant 影响，不精确 |
| 持久化 | 🔴 `DailyState` 定义在 `types.ts` 但 **未持久化** — `GameStateManager` 不保存/加载 `DailyState`。重启后 streak 丢失 |

---

### P1: `roguelike/` — 肉鸽数据与引擎

#### `charm-data.ts` — 22 个 Charm

| 检查点 | 结果 |
|--------|------|
| ID 唯一性 | 🟢 所有 `charm_*` ID 唯一 |
| Effects 有效性 | 🟢 所有 effect 的 `stat` 字段引用 `ModifiedStats` 中存在的 key |
| `ModifierRarity` vs 字符串 | 🟡 `charm_cursed` 和 `charm_gambler` 使用 `ModifierRarity.Cursed` 枚举值 ✅ |
| 数量公式 | 🟡 `charm_ghost` (id: `charm_ghost`) 的 condition effect 引用 `burstActive` — 这个 condition 在 `ModifierEngine._checkCondition` 中通过 `ctx['burstActive']` 检查，但 `compute()` 调用时 eventCtx 为 undefined，condition 永远返回 true（fallback），effect 无条件生效。 |

#### `relic-data.ts` — 8 个 Relic

| 检查点 | 结果 |
|--------|------|
| `id` vs `relicId` 冗余 | 🟡 每个 Relic 同时有 `id` 和 `relicId`，值相同。建议只保留一个。 |
| Tags 与实际效果 | 🟡 Relic `relic_coin` (Midas Coin) 只有 `tag_add: 'midas_coin'`，但 `FishingSystem._fishCaught` 的 gold 计算不检查 `midas_coin` tag — **Relic 效果未实现**。 |
| Relic `relic_anchor` | 🟡 `tag_add: 'anchor_progress_floor'` — `FishingSystem._updateReel` 不检查此 tag，无进度下限保护。 |
| Relic `relic_feather` | 🟡 `tag_add: 'phoenix_feather'` — `FishingSystem` 不检查此 tag，line break 无保护。 |
| Relic `relic_echo` | 🟡 `tag_add: 'echo_stone'` — `RunManager._subscribe` 中 FISHING_CAST handler 不检查此 tag，每次钓鱼都消耗 cast。 |

**🔴 Critical**: 5/8 个 Relic 的效果仅通过 `tag_add` 添加标签，但**消费者代码 (`FishingSystem`, `RunManager`) 不检查这些标签**。这意味着除了 `relic_compass` (stat_add: rareBonus)、`relic_lantern` (stat_add: spiritVariantChance)、`relic_hook` (stat_mult: hookWindowBase)、`relic_line` (stat_mult: lineDurability) 之外，其余 Relic **完全没有效果**。

#### `event-data.ts` — 10 个事件

| 检查点 | 结果 |
|--------|------|
| choice outcomes | 🟡 `_applyChoice` 中 `'blessing_progress'` 等 outcome 通过 switch-case 硬编码处理。新增事件需要修改 `RunUI._applyChoice`。 |
| statModifiers 字段 | 🟡 `RunEvent.statModifiers` 在类型中定义但在 `_applyChoice` 中未使用，`evt_storm`, `evt_frenzy`, `evt_moonlight`, `evt_school` 的 statModifiers 被忽略。 |

---

### P2: `roguelike/` — 核心引擎

#### `ModifierEngine.ts` — 数值计算

| 检查点 | 结果 |
|--------|------|
| 计算顺序 | 🟢 add → multiply → clamp(0, 999)，正确 |
| 量纲一致性 | 🔴 **量纲错误**: `charm-data.ts` 中 `rareBonus: 35` (charm_lucky) 被 `stat_add` 到 `rareBonus`。但在 `FishSpawner.spawn()` 中，`rareBonus` 未被使用；在 `FishingSystem._calcHookChance()` 中，`hookChance` 被读取为 `(this.modStats?.hookChance ?? 0) / 100`（除以 100），但 charm 中 `hookChance` 用 `stat_add: 5`（意为 +5%）。这是正确的：5/100=0.05=5%。✅ |
| `spiritVariantChance` 量纲 | 🟡 `charm_nightowl` 使用 `stat_add: 0.05`，`relic_lantern` 使用 `stat_add: 0.08`。`FishingSystem._fishCaught` 中 `this.rng.chance(this._bal('spiritVariantChance'))`，BALANCE 值是 0.02。如果 modStats 返回 `0.02 + 0.05 + 0.08 = 0.15`（15% 概率），与 BALANCE 的 2% 量纲一致。✅ |
| 嵌套对象处理 | 🔴 `ModifierEngine.compute()` 将 `BALANCE` 作为 `Record<string, number>` 展开，但 `BALANCE.slackLineBurst` 是嵌套对象，不会出现在结果中。`FishingSystem` 回退到直接读 `BALANCE.slackLineBurst`，绕过 ModifierEngine。 |

#### `RunManager.ts` — 肉鸽生命周期

| 检查点 | 结果 |
|--------|------|
| run seed | 🟢 `this.rng = new RNG(seed)`，确定性 |
| 局内 modifier 应用 | 🟢 (已修复) `addModifier` 现在调用 `fishingSystem.applyModStats()` |
| run end reason | 🟢 `Depleted`, `LineBreak`, `Voluntary` 枚举正确 |
| cleanup | 🟡 `dispose()` 注释说 "Cleanup handled by EventBus"，但 EventBus 不自动清理 — 订阅通过 `on()` 返回的 unsubscribe 函数管理。`RunManager._subscribe` 使用 `this.eventBus.on(...)` 但未保存返回的 unsubscribe 函数，**事件泄漏**。 |

---

### P3: `fishing/` — 钓鱼系统

#### `FishingSystem.ts` — 核心状态机

| 检查点 | 结果 |
|--------|------|
| 状态机完整性 | 🟢 Idle→Casting→Waiting→Nibble→Hooking→Reeling→{Catch\|Escape} |
| 过渡完整性 | 🟢 (已修复 ProbeEscape 即时跳转 bug) |
| RNG 确定性 | 🟢 (已修复 Math.random → rng.next) |
| 深度公式 | 🟢 `FishingSystem.getFishDepth()` 正确，综合 rarity + behavior + size + bodyType |
| slackLineBurst | 🟢 逻辑正确，timeToBurst 倒计时 + damage + lineDurability 检查 |
| burst 事件 | 🔴 `emit('fishing:burst', ...)` 事件不在 GameEventMap 中 |
| bait 集成 | 🟡 `_releaseCast()` 硬编码 `bait: 'none'`，bait 系统未接入 |
| 订阅清理 | 🟢 `unsubDown`/`unsubUp` 通过 `dispose()` 清理 |

#### `FishSpawner.ts` — 鱼生成器

| 检查点 | 结果 |
|--------|------|
| 时间窗口判断 | 🟢 `getCurrentTimeWindow()` 使用 `new Date().getHours()` ✅ |
| 季节判断 | 🟢 `getCurrentSeason()` 使用 `new Date().getMonth()` ✅ |
| 天气 | 🟡 `RunManager.startRun()` 硬编码 `weather: 'clear' as any` — 天气系统未实现 |
| spawn filter | 🟢 正确过滤 timeWindows, weatherRequired, seasonRequired, baitRequired |

#### `FishingSceneManager.ts` — 3D 钓鱼场景

| 检查点 | 结果 |
|--------|------|
| 鱼模型生命周期 | 🟢 `_spawnFishModel` 先 `_hideFishModel`，避免泄漏 |
| setTimeout 使用 | 🟡 `FISHING_ESCAPE` 和 `FISHING_LINE_BREAK` handler 中使用 `setTimeout`，可能导致在组件已销毁后执行 — 使用 `this.unsubs` 清理订阅但未清理 timeout |
| 材质泄漏 | 🟢 `_hideFishModel` → `dispose()` 正确释放 |

---

### P4: `ui/` + `core/` — UI 与基础设施

#### `core/EventBus.ts`

| 检查点 | 结果 |
|--------|------|
| 内存泄漏防护 | 🟡 `on()` 返回 unsubscribe 函数，但多处未保存返回值（见 RunManager） |
| 错误隔离 | 🟢 `emit()` 中 try-catch 隔离 handler 错误 |

#### `core/InputManager.ts`

| 检查点 | 结果 |
|--------|------|
| 模式切换 | 🟢 `setEnabled()` 控制是否响应输入 |
| 事件清理 | 🟡 `detach()` 存在但从未调用 |

#### `ui/FishingUI.ts`

| 检查点 | 结果 |
|--------|------|
| setTimeout 清理 | 🟡 `_showCatchResult`, `_showLineBreak`, `_showEscape` 使用 `setTimeout` 自动隐藏，无清理机制 |

#### `ui/Fishpedia.ts`

| 检查点 | 结果 |
|--------|------|
| Three.js 实例 | 🟡 每次 `_buildPreview` 创建新的 `WebGLRenderer`，`_stopPreview` 正确释放。但切换鱼时重建整个 renderer 效率低。 |
| 事件监听 | 🟡 `document.addEventListener('keydown', this._onKeyDown)` 全局监听，`dispose` 中移除 ✅ |

---

### P5: `main/` — Electron 主进程

#### `main/preload.ts` — Context Bridge

| 检查点 | 结果 |
|--------|------|
| API 暴露 | 🟢 只暴露安全 IPC invoke 和 listener |
| 安全性 | 🟢 `contextIsolation: true`, `nodeIntegration: false` |

#### `main/window-manager.ts` — 窗口管理

| 检查点 | 结果 |
|--------|------|
| 透明窗口 | 🟢 `transparent: true`, `backgroundColor: '#00000000'` |
| 交互模式 | 🟢 `setInteractive()` 正确使用 `setFocusable()` |
| 持久化坐标 | 🟡 `lastPosition` 未持久化到文件，重启丢失 |

#### `main/ipc-handlers.ts` — IPC 通道

| 检查点 | 结果 |
|--------|------|
| save/load | 🟡 `save:write` 和 `save:read` 是空实现，返回 true/null。存储完全在渲染进程的 localStorage 中。如果 localStorage 被清除，所有存档丢失。 |
| 通道名 | 🟢 统一前缀 `window:`, `save:`, `app:` |

#### `main/tray-manager.ts` — 系统托盘

| 检查点 | 结果 |
|--------|------|
| 图标 fallback | 🟡 使用 `nativeImage.createEmpty()` 作为 fallback — 托盘图标可能不可见 |
| 快捷键 | 🟡 `change_location` 快捷键发送到渲染进程但无对应 handler |

---

## 🔗 第三轮：集成推演审查

### 场景 A: 肉鸽局内 → 钓鱼 → 回到营地

**预期**: 玩家在 Camp 选择 3 个 Charm → 进入 Run → 钓鱼时 Charm 效果生效 → Run 结束后回到 Camp 获得奖励。

**推演**:

1. [`RunUI._showCharmPicker`](src/renderer/roguelike/RunUI.ts:322) — 玩家选 charms → `RunManager.startRun(locationId, picked)` 被调用
2. [`RunManager.startRun`](src/renderer/roguelike/RunManager.ts:64) — 调用 `ModifierEngine.compute(this.activeCharms)` → `fishingSystem.applyModStats(this._modStats)`
3. [`FishingSystem.applyModStats`](src/renderer/fishing/FishingSystem.ts:98) — 保存 `this.modStats`
4. 钓鱼中 — `FishingSystem._bal('hookWindowBase')` 从 `modStats` 读取 ✅
5. 如果局中获得新 modifier (通过 event) — [`RunManager.addModifier`](src/renderer/roguelike/RunManager.ts:135) ✅ (已修复，现在调用 `fishingSystem.applyModStats`)
6. Run 结束 → [`RunManager._endRun`](src/renderer/roguelike/RunManager.ts:192) → emit `RUN_END` → `GameStateManager` 应用 rewards → `RunUI._showResultPanel`

**结论**: 🟢 流程完整 (修复后)

### 场景 B: 钓鱼途中强制退出

**预期**: 重新打开后应回到 Idle 状态或恢复之前的 Run。

**推演**:

1. 玩家在 Reeling 状态按 Alt+F4
2. Electron `before-quit` 事件 → [`main/index.ts:38`](src/main/index.ts:38) → `windowManager.requestSave()`
3. `requestSave()` → `webContents.send('window:request_save')` → renderer 的 `onRequestSave` handler
4. Renderer handler: [`index.ts:133`](src/renderer/index.ts:133) — **只是 `console.log`**，不执行任何保存操作
5. **结果**: 进程被杀死，`FishingSystem` 状态丢失
6. 重新打开 → `GameStateManager` 从 localStorage 加载 → 恢复到上次 `_save()` 的状态
7. 上次保存是什么时候？— 每 60 秒 auto-save，或每次 catch/gold change 时保存
8. 如果在上次 auto-save 之后钓了鱼但没完成 catch → **鱼饵消耗了但鱼没入账，lineDurability 消耗了但没保存**

**结论**: 🔴 **状态恢复不完整**。钓鱼 mid-cycle 强制退出会导致：
- FishingSystem 状态 (Casting/Waiting/Reeling) 丢失 → 重启后为 Idle ✅ (可接受)
- 已消耗的 casts 通过 `RunManager._subscribe` → `FISHING_CAST` 事件 → `castsRemaining--` 会触发，但 emit 是同步的。如果在 emit 后、`_save()` 前退出，casts 消耗未持久化。
- `FishingSceneManager` 中的 3D 对象 (Bobber, FishModel, Splash) 在页面重载时正确重建 ✅

### 场景 C: 跨系统数值叠加

**配置**: Relic A (rareBonus +15) + Charm B (hookChance +5) + Event Buff (假设 hookChance +10)

**推演**:

1. `ModifierEngine.compute([relic_compass, charm_eagle_eye, hypothetical_event])` 
2. 处理顺序: `stat_add: rareBonus 15` → `stat_add: hookChance 5` → `stat_add: hookChance 10`
3. 结果: `rareBonus = 0 + 15 = 15`, `hookChance = 0 + 5 + 10 = 15`
4. `FishingSystem._calcHookChance`: `base(0.45) + bonus(15/100) = 0.45 + 0.15 = 0.60` ✅
5. `rareBonus` 在 `FishSpawner.spawn()` 中未被使用 — `RARITY_WEIGHTS` 是硬编码的。Charm 的 rareBonus 效果不生效！

**结论**: 🟡 **rareBonus 未接入 FishSpawner**。`charm_lucky` (rareBonus +35) 和 `relic_compass` (rareBonus +15) 的稀有度加成在 `_rollForBite` 中使用 `RARITY_WEIGHTS` 固定值，未读取 `modStats.rareBonus`。

### 场景 D: UI 状态与逻辑状态漂移

**场景**: FishingSystem 进入 Escape 状态，FishingUI 仍显示搏斗中。

**推演**:

1. [`FishingSystem._updateReel`](src/renderer/fishing/FishingSystem.ts:418) — `tension >= 100` → `emit(FISHING_LINE_BREAK)` → `_transitionTo(Escape)`
2. [`FishingUI._subscribe`](src/renderer/ui/FishingUI.ts:296) — 订阅 `'fishing:escape'` → `_showEscape(p)`
3. `_showEscape` 设置 `catchPopup` 的 innerHTML 和 `display: block`
4. 但同时 `_updateHookTimer()` 从 `update()` 调用，检查 `hookIndicator.style.display === 'none'` → 如果是 'none'，不更新。Hook indicator 在 `FISHING_HOOK_SET` 时被 `_hideHookIndicator()` 隐藏 ✅
5. 如果玩家在 Escape popup 显示期间点击 → [`FishingSystem._onInputDown`](src/renderer/fishing/FishingSystem.ts:145) → case `Catch`/`Escape` → `resetToIdle()`

**结论**: 🟢 UI 状态转换正确。Escape 事件触发 `_showEscape`，之前的 hook/reel UI 已在 `_hideAll`/`_hideHookIndicator` 中隐藏。点击 popup 区域通过 `FishingSystem._onInputDown` 正确处理。

---

## 📊 问题汇总

### 🔴 Critical (6)

| # | 文件:行 | 描述 |
|---|---------|------|
| C1 | [`events.ts:10-84`](src/shared/events.ts) | `'fishing:burst'` 事件 emit 但不在 `GameEventMap` 类型中，无类型检查 |
| C2 | [`relic-data.ts`](src/renderer/roguelike/relic-data.ts) | 5 个 Relic (coin, anchor, feather, echo, 部分 compass) 使用 tag_add 但消费者代码不检查标签 |
| C3 | [`main/ipc-handlers.ts:26-34`](src/main/ipc-handlers.ts:26) | `save:write` / `save:read` 是空实现，所有存档仅靠 localStorage，清除即丢失 |
| C4 | [`index.ts:133`](src/renderer/index.ts:133) | `onRequestSave` handler 只 console.log，不触发实际保存 |
| C5 | [`DailySystem.ts`](src/renderer/data/DailySystem.ts) | `DailyState` 未持久化，重启后 streak 和 quest 进度丢失 |
| C6 | [`FishingSystem.ts:308`](src/renderer/fishing/FishingSystem.ts:308) | `rareBonus` modifier 在 bite roll 中未接入 (RARITY_WEIGHTS 写死) |

### 🟡 Warning (10)

| # | 文件:行 | 描述 |
|---|---------|------|
| W1 | [`FishingUI.ts:282-298`](src/renderer/ui/FishingUI.ts:282) | 所有事件订阅使用字符串字面量而非 `GameEvents` 常量 |
| W2 | [`RunManager.ts:143-187`](src/renderer/roguelike/RunManager.ts:143) | 事件订阅未保存 unsubscribe 函数，无法清理 |
| W3 | [`RunManager.ts:80`](src/renderer/roguelike/RunManager.ts:80) | 天气硬编码 `'clear'` |
| W4 | [`FishingSystem.ts:244`](src/renderer/fishing/FishingSystem.ts:244) | bait 硬编码 `'none'` |
| W5 | [`event-data.ts`](src/renderer/roguelike/event-data.ts) | `statModifiers` 字段在事件效果中未使用 |
| W6 | [`charm-data.ts:103-109`](src/renderer/roguelike/charm-data.ts:103) | `charm_ghost` condition effect 在 compute() 中无条件生效 (eventCtx=undefined) |
| W7 | [`FishingSceneManager.ts:148-163`](src/renderer/fishing/FishingSceneManager.ts:148) | setTimeout 在 handler 中未跟踪，销毁时可能泄漏 |
| W8 | [`Fishpedia.ts:313`](src/renderer/ui/Fishpedia.ts:313) | 每次 fish 选择重建 Three.js renderer，低效 |
| W9 | [`relic-data.ts`](src/renderer/roguelike/relic-data.ts) | `id` 和 `relicId` 字段冗余 |
| W10 | [`DailySystem.ts:123-150`](src/renderer/data/DailySystem.ts:123) | quest 进度用 goldEarned 推断稀有度，不精确 |

### 🟢 Info (5)

| # | 描述 |
|---|------|
| I1 | `ModifierEngine` 不处理 `BALANCE.slackLineBurst` 嵌套对象 — 设计限制，可接受 |
| I2 | `FishSpawner.getCurrentTimeWindow()` 使用本地时间 — 跨时区行为取决于用户预期 |
| I3 | `charm_lucky` ID 与 `charm_lucky_lure` 的 icon 重复使用 🍀 |
| I4 | `tray-manager.ts` 的 `change_location` 快捷键无 renderer 端 handler |
| I5 | `window-manager.ts` 窗口位置未持久化 |

---

## 🔧 建议修复优先级

1. **C2** — 实现 tag-based Relic 效果 (在 FishingSystem/RunManager 中检查 tags)
2. **C3+C4** — 实现主进程文件持久化 (electron-store 或 fs write)
3. **C6** — 接入 rareBonus 到 bite roll 的权重计算
4. **C1** — 将 `'fishing:burst'` 加入 `GameEventMap`
5. **C5** — 持久化 DailyState
6. **W2** — 保存 unsubscribe 函数并清理
7. **W1** — 统一使用 `GameEvents` 常量订阅事件
