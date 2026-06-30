# 🎣 Soul Sanctuary: Depth Fishing — 游戏设计深度审核报告

> **审核日期**: 2026-06-07 | **审核人**: 资深游戏设计师 (15年经验)
> **审核框架**: LeBlanc 8乐趣 + MDA框架 + 心流理论 + 玩家动机心理学
> **审核范围**: 8个维度 × 16个子项，逐项量化评估

---

## 维度1：核心循环（Core Loop）

### 1.1 循环完整性
- **状态**: ✅ 达标
- **当前实现**: [`FishingSystem.ts`](src/renderer/fishing/FishingSystem.ts) 实现9状态FSM: `Idle → Casting → Waiting → Nibble → Hooking → Reeling → Catch/Escape/ProbeEscape → Idle`。完整循环耗时约14–35秒（2s cast + 2–10s wait + 0.6s nibble + 0.6–2.0s hook + 5–15s reel + 2.5s result display）。
- **玩家感受**: "我按下鼠标→看到蓄力条→松开甩竿→浮标落水→等待→鱼咬钩→点击收线→按住拉扯→钓上来/跑掉了→回到待机状态。每一步都有清晰的界面反馈。"
- **优化建议**: 当前循环已达标。但 `Catch/Escape` 状态后的2.5秒结果展示期(`RESULT_DISPLAY_MS = 2500`，[`FishingSystem.ts:50`](src/renderer/fishing/FishingSystem.ts:50))略长。建议缩短至1.8秒并加入"点击跳过"互动。
- **预期效果**: 循环从 ~30s 降至 ~27s。在高频游玩场景下感知流畅度提升约10%。

### 1.2 循环节奏
- **状态**: ⚠️ 有风险
- **当前实现**: Wait阶段在初始等待过期后每2–5秒进行一次咬钩判定([`FishingSystem.ts:290-300`](src/renderer/fishing/FishingSystem.ts:290))。Reel阶段每帧持续更新张力([`FishingSystem.ts:488-592`](src/renderer/fishing/FishingSystem.ts:488))。但Wait阶段玩家只有"线抖"（twitch）一种交互——30%概率吓跑鱼，70%概率触发即刻判定([`FishingSystem.ts:158-175`](src/renderer/fishing/FishingSystem.ts:158))。
- **玩家感受**: "甩竿后要等3–8秒，这期间除了偶尔点一下'抖线'，只能盯着浮标发呆。等待期有点长，特别是连续钓时。"
- **优化建议**: 在 [`FishingSystem.ts`](src/renderer/fishing/FishingSystem.ts) 的 [`_updateWait`](src/renderer/fishing/FishingSystem.ts:285) 方法中增加"主动探测"机制：玩家在等待期点击可以消耗1次"探测次数"（每run 3次），立即触发一次带30%额外稀有度加权的咬钩判定。同时在 `FishingUI` 中添加一个小型"探测"按钮提示。
- **预期效果**: 等待期从"被动忍耐"变为"主动策略选择"。动作类决策点从每10秒1个提升到每3–5秒1个。

---

## 维度2：决策空间（Decision Space）

### 2.1 决策密度
- **状态**: ⚠️ 有风险
- **当前实现**: Reel阶段的 hold/slack 是二进制决策——玩家每秒约做1–2次抉择。Cast阶段只有蓄力（没有方向选择）。Run Prep阶段选择3个charms是一锤子买卖。Run期间的事件30%触发率([`RUN_EVENT_CHANCE = 0.30`](src/shared/constants.ts:102))，事件中有选择支的约6/10 = 60%。
- **玩家感受**: "收线的时候就是按住或松开，虽然鱼的行为会变化，但我的策略几乎不变——维持在绿色区域里。选护符的时候挺纠结的，但选完就没了。"
- **优化建议**:
  1. 在 [`constants.ts`](src/shared/constants.ts) 中新增 `SLACK_STRATEGIC_CHANCE = 0.15`：每次slack线时15%概率触发"策略slack"，给予一次性buff（如"下次收线进度+20%"或"鱼短暂混乱"）。在 [`FishingSystem.ts:513-517`](src/renderer/fishing/FishingSystem.ts:513) slack线逻辑中加入判定。
  2. Cast阶段增加可选方向——在 [`FishingSystem._beginCast`](src/renderer/fishing/FishingSystem.ts:234) 时允许玩家用鼠标指针选择落点区域（近/中/远），不同区域对应不同鱼群。
- **预期效果**: 每30秒循环内决策点从4–5个提升到8–10个，显著减少"无脑按"的时间比例。

### 2.2 决策质量
- **状态**: ✅ 达标
- **当前实现**: 6种鱼行为([`FishBehavior`](src/shared/enums.ts:12))各有不同的拉力曲线。Tension三色区(0-50%/50-70%/70-100%)提供清晰的风险梯度。Charm系统有22个护符通过[`ModifierEngine.compute`](src/renderer/roguelike/ModifierEngine.ts:45)产生组合效应。burst机制([`FishingSystem.ts:608-647`](src/renderer/fishing/FishingSystem.ts:608))不可预测但可准备。
- **玩家感受**: "我知道在绿色区安全但速度慢，红色区快但会断线。鱼突然冲刺时张力会跳升——我必须立刻松开。这种'知道规则但无法完全控制'的感觉很好。"
- **优化建议**: 当前已达标。可以考虑在 `_computePullForce` 中为mythic鱼增加一个"反向拉力"模式（鱼短暂时间里反而帮助玩家，制造迷惑），进一步提升不可预测性。
- **预期效果**: 玩家对决策质量的满意度维持高水平。Mythic鱼的不可预测性增强将拉高"传说级"的仪式感。

---

## 维度3：反馈系统（Feedback System）

### 3.1 即时反馈
- **状态**: ✅ 达标
- **当前实现**: Tension bar实时更新(`FishingUI._updateTensionBar`，[`FishingUI.ts:427-440`](src/renderer/ui/FishingUI.ts:427))，颜色随区域变化(绿→黄→红)。Bobber有6种可视状态(`idle/flying/waiting/sinking/resurfacing/hidden`，[`Bobber.ts:8`](src/renderer/rendering/Bobber.ts:8))，含波纹动画。Bite时hook indicator脉冲动画([`FishingUI.ts:258-263`](src/renderer/ui/FishingUI.ts:258))。Catch时splash粒子爆发([`FishingSceneManager.ts:130-137`](src/renderer/fishing/FishingSceneManager.ts:130))。Cast bar有渐变色和overshoot标记([`FishingUI.ts:62-74`](src/renderer/ui/FishingUI.ts:62))。
- **玩家感受**: "每次操作屏幕都有东西在动——浮标上下摆动、张力条变色、鱼在水下挣扎。松开鼠标的瞬间张力条就开始往下降。反馈是即时的。"
- **优化建议**: 当前已达标。唯一可改进的是在 `hooking` 状态加入音效提示（目前audio system尚未完全集成到FishingSystem）。在[`FishingSystem._onBite`](src/renderer/fishing/FishingSystem.ts:439)处添加 `this.eventBus.emit(GameEvents.UI_SHOW_NOTIFICATION, { message: '🎣 BITE!', type: 'rare' })` 确保双重感官（视觉+声音）刺激。
- **预期效果**: 即时反馈维持A级评价。音效集成后整体反馈满意度提升。

### 3.2 累积反馈
- **状态**: ⚠️ 有风险
- **当前实现**: 每次catch后在catch popup显示鱼名/尺寸/品质/金币([`FishingUI.ts:442-473`](src/renderer/ui/FishingUI.ts:442))。Run期间RunHUD显示剩余casts和durability([`RunUI.ts:149-152`](src/renderer/roguelike/RunUI.ts:149))。Daily quest有进度追踪([`DailySystem.ts:126-154`](src/renderer/data/DailySystem.ts:126))。但缺少：当前run已赚金币的实时显示、Fishpedia完成进度条、run内累计收获面板。
- **玩家感受**: "我知道钓了多少条鱼，剩多少次抛竿。但我不知道这趟run到目前为止赚了多少钱，也不知道鱼鉴的收集进度有没有变化。我只能等run结束才看到总收益。"
- **优化建议**:
  1. 在 [`RunUI._updateRunHUD`](src/renderer/roguelike/RunUI.ts:149) 中增加 `runEarnings: number` 字段，实时显示当前run累计金币。
  2. 在每次catch后通过 [`FishingUI._showCatchResult`](src/renderer/ui/FishingUI.ts:442) 时增加一行："🐟 Fishpedia: 47/141 (new!)" （如果是新发现）。
  3. RunHUD中加入一个微型进度条显示run完成度(已抛竿/总抛竿)。
- **预期效果**: 玩家在每次catch后都能感知到"我离目标更近了一步"。减少"不知道在干嘛"的迷茫感。

---

## 维度4：风险回报（Risk/Reward）

### 4.1 风险可见性
- **状态**: ⚠️ 有风险
- **当前实现**: Tension bar三色区非常清晰([`FishingUI.ts:137-166`](src/renderer/ui/FishingUI.ts:137))。Cast bar overshoot marker([`FishingUI.ts:68-74`](src/renderer/ui/FishingUI.ts:68))。`RunManager.canEndVoluntarily` 在首次catch后为true([`RunManager.ts:67`](src/renderer/roguelike/RunManager.ts:67))，voluntary end +20% gold bonus([`RunManager.ts:274`](src/renderer/roguelike/RunManager.ts:274))。
- **玩家感受**: "收线时我知道自己在危险区。但我不知道'继续钓下去'和'见好就收回家'之间的具体风险差异。我没有一个清晰的风险提示说'你的线还剩X%，再钓可能断'。"
- **优化建议**:
  1. 在 [`RunUI._updateRunHUD`](src/renderer/roguelike/RunUI.ts:149) 的durability显示中加入颜色编码：>70%绿色，30-70%黄色，<30%红色闪烁。
  2. 当 `lineDurability < 30` 且 `canEndVoluntarily` 时，在RunHUD中显示浮动提示："⚠️ Line is fraying — consider heading home"。
  3. 在 [`RunManager._endRun`](src/renderer/roguelike/RunManager.ts:255) 的 `_computeRewards` 中为voluntary end增加更清晰的预览——点击end run按钮后弹出确认框显示"Keep: 💰X gold, 🐟Y fish"，让玩家明确知道保留了什么。
- **预期效果**: 玩家能做出更有信息支撑的"继续/回家"决策，减少因不明确风险而导致的挫败感。

### 4.2 回报差异化
- **状态**: ✅ 达标（基本）/ ⚠️ 可提升
- **当前实现**: 5级稀有度对应不同金币倍率（common:8-20g → mythic:500-2000g）。Perfect catch ×1.5，Struggle catch ×0.6([`FishingSystem.ts:685-687`](src/renderer/fishing/FishingSystem.ts:685))。Spirit variant ×3。Trophy size ×2。Midas Coin relic ×1.5。Streak bonus 3+/5+([`RunManager.ts:202-206`](src/renderer/roguelike/RunManager.ts:202))。Cursed Line charm: tension +50%但progress ×2.0([`charm-data.ts:183-200`](src/renderer/roguelike/charm-data.ts:183))。
- **玩家感受**: "高风险charms带来明显的进度加速，感觉像是在赌博——很刺激。不同品质的catch回报差异也足够大，我会为了perfect catch而努力。"
- **优化建议**: 当前数值差异已足够。但回报类型过于单一(几乎只有金币)。建议在 [`FishingSystem._fishCaught`](src/renderer/fishing/FishingSystem.ts:658) 中加入稀有奖励类型：
  - **Perfect catch on Legendary+**: 额外获得1 Spirit Essence
  - **Mythic fish catch**: 所有装备的charms获得一次"充能"(持续时间延长1 cast)
  - 在 `constants.ts` 中添加 `PERFECT_BONUS_TABLE: { legendary: { essence: 3 }, mythic: { essence: 5, charmCharge: true } }`
- **预期效果**: 高风险路径不仅给更多金币，还提供无法用金币购买的稀有货币和机制奖励。玩家的"搏一把"意愿显著提升。

---

## 维度5：进度感（Progression）

### 5.1 短期进度
- **状态**: ⚠️ 有风险
- **当前实现**: 每次catch获得金币和fishpedia更新。Run结果面板显示总收益([`RunUI._showResultPanel`](src/renderer/roguelike/RunUI.ts:438))。如果鱼是重复种类，唯一获得的是金币。如果所有鱼都钓过了，进度感完全依赖于金币数字的增长。
- **玩家感受**: "我钓到一条已经有的common鱼——弹出+12金币然后没了。感觉像在'刷金币'而不是'冒险探索'。如果连续3次都是重复鱼，我会觉得这趟run有点浪费。"
- **优化建议**:
  1. 在 [`FishingSystem._fishCaught`](src/renderer/fishing/FishingSystem.ts:658) 中加入"重复捕获奖励"：每次重复捕获同种鱼，extra gold = min(已捕获次数, 10) × 2g。这样即使是common鱼，重复钓也有递增价值。
  2. 在 [`DailySystem._onFishCaught`](src/renderer/data/DailySystem.ts:126) 中增加"session milestone"：当前session每钓5条鱼弹出一个短提示"🎉 5 fish this session!"给予小额essence奖励。
  3. 在 catch popup 中增加一行："📊 ×3 caught (record: 17.8cm)"，利用社交比较心理学（与自己过往记录比较）。
- **预期效果**: 每次catch都能获得至少"一点新东西"——金币递增/记录刷新/session milestone。彻底消除"空跑一趟"的感觉。

### 5.2 长期进度
- **状态**: ✅ 达标
- **当前实现**: Camp升级系统（charm slots/relic slots/charm rerolls/bait pouch/line durability）在 [`CampManager.ts`](src/renderer/roguelike/CampManager.ts) 中定义，5个升级线各有3-5级。Level系统解锁12个地点([GDD:368-386](docs/GDD.md:368))。8个永久Relics([`relic-data.ts`](src/renderer/roguelike/relic-data.ts))通过特殊条件解锁。15个成就([`achievement-data.ts`](src/renderer/roguelike/achievement-data.ts))。Daily streak奖励([`DailySystem.ts:35-41`](src/renderer/data/DailySystem.ts:35))。Fishpedia 141条目。
- **玩家感受**: "即使这次run断了线只钓到3条鱼，我也收获了金币和essence可以升级营地。失败后回到camp界面看到我的relics和升级进度，感觉'没白玩'。"
- **优化建议**: 当前已达标。唯一可以增强的是在run结束后显示"升级进度预览"——"你还需要X gold就能升级Charm Slots了！"在 [`RunUI._showResultPanel`](src/renderer/roguelike/RunUI.ts:438) 末尾增加一行升级提示。
- **预期效果**: 长期留存率维持健康水平。失败后的正向激励足够强。

---

## 维度6：心流通道（Flow Channel）

### 6.1 技能匹配
- **状态**: ⚠️ 有风险
- **当前实现**: 游戏没有动态难度调整。Charm系统提供软性难度调节（Cursed Line让熟练玩家加速，Patient Spirit让新手降低难度）。但12个地点的鱼行为难度是固定的——Japan的common鱼pullStrength=3，Iceland mythic鱼pullStrength=10。没有任何基于玩家表现动态调整的机制。
- **玩家感受**: "刚开始玩时感觉张力控制有点难，但钓了20条鱼后就掌握了节奏。现在大多数common鱼对我来说已经没有挑战性了——我知道在绿色区按着就行。"
- **优化建议**:
  1. 在 [`FishingSystem`](src/renderer/fishing/FishingSystem.ts) 中增加 `_playerSkillRating` 字段，基于最近10次catch的perfect ratio动态调整。
  2. 在 [`FishingSystem._rollForBite`](src/renderer/fishing/FishingSystem.ts:327) 中，如果技能评分高(>0.7)，提升rare+鱼的出现权重5-10%。
  3. 在 [`RunManager.startRun`](src/renderer/roguelike/RunManager.ts:72) 时根据玩家level调整base line durability——新手多给20%，老手保持基准。
- **预期效果**: 初期难度平滑（不劝退），后期挑战递增（不无聊）。心流通道的宽度从"一刀切"变为"自适应"。

### 6.2 注意力曲线
- **状态**: ✅ 达标
- **当前实现**: 完整循环天然形成"紧张-放松"节奏：Cast(中等注意力)→Wait(低注意力，可tab away)→Nibble(警觉)→Hook(紧急，0.6-2s窗口)→Reel(高强度，5-15s)→Catch/Escape(释放，2.5s展示)。Desktop widget模式下idle状态click-through更强化了"工作间隙摸鱼"的使用场景。
- **玩家感受**: "我可以在写代码时把窗口放在角落，甩一竿然后继续工作，听到/看到窗口闪光就知道鱼咬钩了。这是一个完美的'桌面伴侣'节奏。"
- **优化建议**: 当前已达标。唯一建议：在 [`Idle`](src/renderer/fishing/FishingSystem.ts:194) 状态超过30秒无操作时，自动切换到缓慢的相机轨道模式(已经在[`CameraController.update`](src/renderer/rendering/CameraController.ts:123)中实现)。进一步增强"放松-紧张-放松"的波浪感。
- **预期效果**: 注意力曲线完美匹配桌面widget使用场景。不需要修改。

---

## 维度7：可重玩性（Replayability）

### 7.1 随机性
- **状态**: ✅ 达标
- **当前实现**: Seeded RNG([`RNG.ts`](src/renderer/core/RNG.ts))保证可复现性。141条鱼×12地点提供底数变量。时间窗口(dawn/day/dusk/night)、天气(5种)、季节(4种)、bait(5种)构成4维过滤器([`FishingSystem._rollForBite:336-348`](src/renderer/fishing/FishingSystem.ts:336))。22个charms随机抽取8个供挑选([`RunUI._showCharmPicker:352`](src/renderer/roguelike/RunUI.ts:352))。10个随机事件30%触发率。Daily热点地点+25%稀有率。Hotspot每天轮换。
- **玩家感受**: "每次开run的感觉都不一样——不同的charms组合，不同的天气，不同的daily热点。即使在同一地点连续钓，也很少遇到完全相同的run。"
- **优化建议**: 当前已达标。但可以增加"run seed可视化"——在RunHUD中显示seed值，允许玩家手动输入seed复现有趣的run。在 [`RunManager`](src/renderer/roguelike/RunManager.ts) 中增加 `customSeed` 支持。
- **预期效果**: 提升社区互动和"挑战run"文化。为未来的leaderboard功能打下基础。

### 7.2 涌现性
- **状态**: ⚠️ 有风险
- **当前实现**: Charm tag系统([`charm-data.ts`](src/renderer/roguelike/charm-data.ts))已设计synergy检测，但当前代码中未实现自动synergy发现。如 `ModifierEngine.compute`([`ModifierEngine.ts:45`](src/renderer/roguelike/ModifierEngine.ts:45))只做线性叠加不做组合检测。GDD中描述的synergy（如3+ spirit tags→"Spirit Communion"）在[`architecture.md:1151-1175`](docs/architecture.md:1151)有设计但未实现。事件选择处理在 [`RunUI._applyChoice`](src/renderer/roguelike/RunUI.ts:525) 是hardcoded的，无法产生意外互动。
- **玩家感受**: "charms之间有标签系统但我没感觉到它们在'互动'——每个charm独立生效，就是数值加减乘除。我希望发现一些设计者没明确教的combo。"
- **优化建议**:
  1. 在 [`ModifierEngine.compute`](src/renderer/roguelike/ModifierEngine.ts:45) 末尾增加 `detectSynergies()` 调用：
     ```typescript
     // Auto-detect charm synergies based on shared tag counts
     if (tags.has('tension') && tags.has('durability')) {
       result.tensionSlackRate += 2; // "Balanced Approach" synergy
     }
     if (tagCounts.get('hook') >= 2) {
       result.hookChance += 5; // "Double Hook" synergy
     }
     ```
  2. 在charm picker UI中标注synergy可能性（灰色文字："Synergy potential: 2 tags matching"）
  3. 增加"跨系统"涌现：让某些fish对特定charm tag有特殊反应（如'fire' tag的charm会让冰岛鱼的pull降低10%）。
- **预期效果**: 玩家会开始在charm picker中寻找标签组合，而非简单选最强数值。发现synergy的"aha moment"成为可重玩性的核心驱动力。

---

## 维度8：情感锚点（Emotional Anchor）

### 8.1 高峰时刻
- **状态**: ⚠️ 有风险
- **当前实现**: Catch popup用颜色区分品质（perfect金色/standard绿色/struggle橙色）([`FishingUI.ts:445-449`](src/renderer/ui/FishingUI.ts:445))。Mythic fish有大额金币（500-2000g）。Spirit variant有"✦SPIRIT✦"标记。Streak bonus 3+/5+有火焰emoji提示([`RunManager.ts:218-222`](src/renderer/roguelike/RunManager.ts:218))。但所有这些都是弹窗文字——没有戏剧性的镜头变化、全屏特效或音乐高潮。
- **玩家感受**: "钓到mythic鱼弹出'500金币！'我确实开心了一下，但画面没太大变化——鱼在水里挣扎了30秒然后弹出一个框。这个'人生巅峰时刻'缺少仪式感。"
- **优化建议**:
  1. 在 [`FishingSceneManager`](src/renderer/fishing/FishingSceneManager.ts) 的catch处理中加入mythic特殊动画：镜头缓慢拉远并旋转→鱼模型放大+金色粒子爆发→画面短暂模糊闪白。
  2. 在 [`FishingUI._showCatchResult`](src/renderer/ui/FishingUI.ts:442) 中为mythic/spirit variant加入专属全屏微光效果（CSS animation + backdrop）。
  3. 添加 `FISHING_CATCH_MYTHIC` 事件类型，触发 Electron 的 `flashFrame(true)` 和系统通知。
- **预期效果**: Mythic catch从"一条鱼+数字"变成"值得截图/录屏/发社交媒体的记忆点"。峰值体验提升2-3倍。

### 8.2 低谷缓冲
- **状态**: ⚠️ 有风险
- **当前实现**: Phoenix Feather relic可抵消一次断线([`RunManager.ts:186-195`](src/renderer/roguelike/RunManager.ts:186))。Late hook grace period 0.5秒([`FishingSystem.ts:436-441`](src/renderer/fishing/FishingSystem.ts:436))。Escape popup显示逃掉的鱼名([`FishingUI.ts:497-513`](src/renderer/ui/FishingUI.ts:497))。Voluntary end保留所有收益。但断线/逃脱后没有"安慰奖"——玩家只是失去了鱼+饵。
- **玩家感受**: "断线了——红色弹窗说'Line snapped'，然后回到待机。我失去了饵，失去了鱼，失去了潜在的200金币。那一瞬间我确实想关掉窗口。"
- **优化建议**:
  1. 在 [`FishingSystem._fishEscaped`](src/renderer/fishing/FishingSystem.ts:624) 和 [`_lineBreak`](src/renderer/fishing/FishingSystem.ts:634) 中加入"残念奖励"：逃脱时获得鱼诱饵价值的1/3金币（"鱼咬过但跑了的饵——至少证明这里有鱼"），断线时获得5-10 essence（"你的鱼线碎片被水精灵回收了"）。
  2. 在 escape/line_break 后展示一个tip提示："💡 Tip: Try using a slower Slack rate next time"或"💡 Tip: Spirit Snare charm makes hook windows longer"。
  3. 在 [`FishingUI._showLineBreak`](src/renderer/ui/FishingUI.ts:476) 中加入鼓励性文案："This one fought hard. The next will be yours."
- **预期效果**: 失败后的退出意图降低40-50%。玩家感知到"即使失败也有微小收获"，不会直接关窗口。

---

## 最后总结

### 1. 关键瓶颈：最阻碍玩家"想再玩一局"的问题

**决策深度不足 + 峰值体验缺失**。目前游戏的核心循环是"按住/松开"二进制决策，charms是唯一有深度的选择但只在run开始时发生。玩家在15分钟的run中大部分时间处于"机械操作"状态。同时，即使钓到Mythic鱼，反馈也仅限于一个弹窗——缺少让玩家"想截图分享"的时刻。

- **具体体现**: [`FishingSystem.tickReel`](src/renderer/fishing/FishingSystem.ts:486) 是唯一核心交互，但它只有 hold/release 两个状态。没有技能、道具、特殊操作的维度。
- **文件**: [`FishingSystem.ts:486-592`](src/renderer/fishing/FishingSystem.ts:486)、[`FishingUI.ts:442-473`](src/renderer/ui/FishingUI.ts:442)

### 2. 快速胜利：投入最少、见效最快的改动

**为每次catch增加"不是完全重复"的价值感**。在 [`FishingSystem._fishCaught`](src/renderer/fishing/FishingSystem.ts:658) 中增加3行代码：

```typescript
// 重复捕获递增金币
const repeatCount = (this.fishCaught?.filter(f => f.fishId === fish.id).length ?? 0);
const repeatBonus = Math.min(repeatCount, 10) * 2;
goldEarned += repeatBonus;
```

同时在 [`FishingUI._showCatchResult`](src/renderer/ui/FishingUI.ts:442) 中显示 `×N caught (+bonus)` 。

- **工作量**: ~15行代码，2个文件
- **效果**: 消除"又是这条鱼"的负面情绪，每次catch都有递增价值感

### 3. 长期支柱：值得投入最多精力打磨的系统

**Charm Synergy 涌现系统 + Modifier交互深度**。当前22个charms有tag系统但synergy是硬编码且未完全实现。这是整个游戏"build多样性"的核心——投入2-3周将synergy系统完全实现，包括：

1. 自动tag计数检测 → 动态synergy发现
2. Charm描述中展示潜在synergy
3. 特定fish × charm tag的跨系统互动
4. 事件选择影响charm效果

- **文件**: [`ModifierEngine.ts`](src/renderer/roguelike/ModifierEngine.ts)、[`charm-data.ts`](src/renderer/roguelike/charm-data.ts)、[`RunUI.ts`](src/renderer/roguelike/RunUI.ts)
- **效果**: 从"选3个最强数值charm"变成"寻找隐藏combo的build玩法"。这是让玩家反复开局的核心动力。

---

*审核报告结束 v1.0*
