# 参考作品美术拆解（10 款）— 方法、边界与可执行结论

> 角色：美术研究员 reference-research ｜ 2026-10-18 ｜ 只产出方法，不产出素材
> 上位规范：[`art-direction-v2.md`](./art-direction-v2.md)（6 色脚本 / 五条支柱 / 性能预算）；约束来源：[`style-guide.md`](./style-guide.md)、[`visual-art-audit.md`](./visual-art-audit.md)、[`art-review.md`](./art-review.md)
> 红线：不复制参考游戏的模型、贴图、角色、UI 组件、文案。标「待核实」的是二手资料或视觉观察，落地前需用官方截图/实机复核。
> 引用 24 个外部链接（去重，见 §5），其中 8 个为访谈 / 技术分享 / 开发者幕后（含 1 篇转载）。

---

## 0. 先做减法：本项目能借用什么

- **像素化放大是硬约束**：透明桌面窗 + 400×300 内部缓冲 + `image-rendering: pixelated` ⇒ 连续渐变、细密纹理、大范围半透明叠层都会失效（banding、灰边、脏边）。`visual-art-audit.md` 里"Fog 会削弱透明感""抗锯齿柔化方块边缘"都是同一个原因。
- **几何语言是硬约束**：正交相机 + 纯 `BoxGeometry` + 零外部素材 ⇒ 只能借 **色板、明度结构、剪影、构图、光比、动效节奏、UI 层级** 这 7 类；不能借像素画法、曲面建模、贴图、2D 骨骼、实时 GI。
- **预算是硬约束**：桌面挂件预算（≤140 draw calls / ≤150k 三角形 / 后处理 ≤8 draw）⇒ 高级效果只能用「材质色板 + InstancedMesh + 少量半透明 Plane」近似，任何需要新着色器的方案直接否决。
- 因此取舍原则：**能落到"改常量、加 1 个 InstancedMesh、调 1 个光"的才收**。本文件 10 条结论全部满足这条。

---

## 1. 逐作拆解（每款：可借 → 不适用 → 1 条落地）

### 1. WEBFISHING · 低多边形 + 低饱和暖色的钓鱼社交
**来源**：[Steam](https://store.steampowered.com/app/3146520/WEBFISHING/) · [itch.io](https://lamedeveloper.itch.io/webfishing) · [社区风格描述（非官方，待核实）](https://webfishing-game.io/about-us)
- `配色`：秋季低饱和主色 + 粉彩；高饱和只留给鱼和可交互道具，作为"识别点"而非背景。
- `光照/材质`：soft-shade 低多边形，用大块明度而非细节撑画面；阴影干净、几乎无环境细节。
- `构图/UI/动效`：小场景 + 大收藏（Animal Crossing N64 式）；近乎无 HUD，提示长在世界里；节奏松弛，不索取注意力。
- **不适用**：平滑着色与本项目 `flatShading` + 400×300 冲突（渐变必 banding）；纯粉彩在浅色壁纸的透明窗上对比不足；联机社交不是本项目范围。
- **落地**：每条鱼 / 每个地标**只保留 1 个高饱和"记忆色"**（即 6 色脚本的 `accent`），其余部件从 `base`/`shadow` 派生；新道具先过"纯黑剪影可读"测试。〔12 场景 / 角色特效〕

### 2. Tiny Glade · 程序化但"全部手捏"的微缩景观
**来源**：[Steam](https://store.steampowered.com/app/2198150/Tiny_Glade/) · [GDC 2024 议题（中文字幕）](https://www.bilibili.com/video/BV17frkYZECb/) · [中文访谈/报道](https://game.xiaomi.com/viewpoint/1393220466_1727591148090_100)
- `理念`：两名开发者强调"游戏里的一切都是我们亲手制作的"——程序化只做重组与摆放，随机性必须被策展，不靠 AIGC / 不靠纯随机撒点。
- `交互/构图`：路穿过墙自动开拱门，规则替玩家兜底；"手掌大小的微缩景观"，远景永远比主体低对比；每块空地一个主题/季节，共用资产语言、只换色板。
- `光照`：柔和阴影 + 接触暗压，不追求物理正确；可信度更多来自 AO 与环境明度，而不是光源数量。
- **不适用**：ray marching 草叶与实时 GI 是为桌面独显设计的重管线（GDC 议题标题本身就是"too much ray marching"），本项目禁止 `ShaderMaterial`，draw call 预算只有它的零头。
- **落地**：用**假 AO** 代替 GI——每个落地物体正下方垫一片 `shadow` 色扁 Box（高 0.02、宽 +10%、opacity 0.18–0.3），全部合并进 1–2 个 InstancedMesh。〔渲染管线 / 浮岛地形〕

### 3. Cast n Chill · 像素水面与前景框景
**来源**：[Steam](https://store.steampowered.com/app/3483740/Cast_n_Chill/) · [VideoGamer 上手](https://www.videogamer.com/previews/cast-n-chill-fishing-for-compliments-charming-pixel-art-balmy-atmosphere/)
- `构图`：前景框（码头/芦苇/船头）→ 中景主体 → 远景山丘的三层结构，主体永远只占一层。
- `水面`：山丘/金树/云的倒影被"竖向拉长 + 横向波纹打断"；鸭子落水只留几圈涟漪，高光只出现在少数亮点。
- `配色/UI/动效`：逐层递进的暖色剧本；像素 UI 与场景同一套低饱和色板（视觉观察，待核实）；idle 模式下画面自己演，玩家不在也在发生。
- **不适用**：它是 2D 像素画，不能替换本项目的 3D 体素管线；逐像素水面/真实反射的成本模型完全不同。
- **落地**：倒影不做真实反射——把地标的 `accent`/`glow` 两色做成 6–10 条竖向拉长 Box（宽 0.12–0.25、additive、opacity 0.15–0.3），按波纹相位左右偏移 0.05–0.12，总成本 <10 draw call。〔水面〕

### 4. Rusty's Retirement · 桌面常驻的低打扰范式
**来源**：[Steam](https://store.steampowered.com/app/2666510/Rustys_Retirement/) · [BGR 报道](https://www.bgr.com/entertainment/ingenious-idle-game-puts-a-pixelated-farm-on-your-desktop/) · [AUTOMATON 开发者访谈](https://automaton-media.com/articles/interviewsjp/20240205-281336/)
- `UI/布局`：窗口贴屏幕底部或侧边、可缩放、可换显示器，"不抢工作区"是设计前提而非附加项。
- `清晰度`：像素化呈现、以整数倍缩放保持清晰（具体缩放策略待核实）；`信息层级`：HUD 极简、贴着场景，拒绝大面板。
- `动效/节奏`：玩家离开也在推进（idle 叙事），画面"有变化但不要求回应"。
- **不适用**：它是可贴边的横条/方块，本项目是 4:3 透明浮岛，遮挡面积与视觉重心不同；不能把主界面做成常驻横条，也不能把 UI 钉在岛边。
- **落地**：把"低打扰"量化——主 HUD 常态 ≤40% 不透明度、鼠标进入面板才升到 94%；提供"隐藏 HUD / 专注模式"；任何面板不得压住渔夫站位 `(-2.8,1.5,3.9)` 与浮标 `(1.8,-1.91,7.0)` 的 2 单位半径。〔UI〕

### 5. Dorfromantik · 色板驱动光照（本文件最强方法参考）
**来源**：[80.lv 开发者访谈（2026-05）](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design) · [Steam](https://store.steampowered.com/app/1455840/Dorfromantik/)
- `技术`：顶点色 + 灰度 albedo，单个资产最多 5 个颜色通道（红/绿/蓝/黄/紫）当遮罩，引擎里按 biome 绑定色板——和本项目"6 色脚本"完全同构。
- `光照`：全场景只有一盏主日光 + 极轻雾；开发者把光照当"美术工具而非技术工具"，色板组合决定氛围；夜模式不重打光、只重涂色板。
- `流程`：任何资产先在灰度下验明度，再加色相/饱和度；`评审`：团队口头禅 "this is creating too much visual noise"。
- **不适用**：Unity + 顶点色 + 贴图管线；本项目无纹理，颜色只能落在材质上 ⇒ "颜色通道"必须映射成"6 个材质槽位"。
- **落地**：把 6 色脚本做成 `MaterialCache` 的 6 个命名槽，每槽 3 档明度（0.85 / 1.00 / 1.18），场景代码禁止裸 hex，PostFX 的 `grade` 也读同一份 theme。〔渲染管线〕

### 6. ISLANDERS · 大色块 + 零文本的极简岛屿
**来源**：[Steam](https://store.steampowered.com/app/1046030/ISLANDERS/)
- `配色/构图`：一块地貌一个主色、建筑是小面积高饱和锚点；同屏色相很少，靠明度差分层。
- `镜头`：固定微俯视 + 干净留白，视线路径从岛缘进入、在地标处停住。
- `UI`：图标化 / 零长文本，信息密度低到只剩分数与提示图标。
- **不适用**：单屏拼图玩法，没有水面细节、角色与粒子；大色块在 400×300 像素化后容易糊成一片，必须靠明度差而不是色相差分层。
- **落地**：草面最多 **3 档 `base` 明度 + 1 类 `accent` 花色点缀**；地标放在画面 2/3 线上，中心 1/3 留给渔夫与浮标。〔浮岛地形〕
- 待核实：具体色板数值未拿到一手资料，本文件只取"大色块 + 少色相"的方法，不引用其色值。

### 7. A Short Hike · 低分辨率 + 暖雾剪影（与本项目最同构）
**来源**：[官网](https://ashorthike.com/) · [PlayStation Blog 幕后](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/) · [Steam](https://store.steampowered.com/app/1055540/A_Short_Hike/)
- `材质`：低多边形 + 纯色块、几乎无贴图；`呈现`：低分辨率渲染 + 像素化放大，和本项目 400×300 的路径同构。
- `光照/构图`：用暖色雾把远景压成剪影，山脊一层层退后；主体永远比远景饱和、比远景亮。
- `动效/UI`：镜头极轻的跟随与浮动，不打断观察；几乎无 HUD，信息进世界。
- **不适用**：开放世界自由相机；它的"低分辨率"是风格选择，本项目已有固定管线，不需要也不应再降采样（会损失 0.25 体素细节）。
- **落地**：**景深不要靠 `Fog`**——远景层直接用 `MeshBasicMaterial` 上 `veil` 色，opacity 0.55–0.8，随距离衰减到 0.35；既保护透明底，又只有 1 次 draw。〔渲染管线 / 12 场景〕
- 待核实：其内部渲染分辨率与雾参数官方未公开数值，本文件只借方法不引参数。

### 8. Spiritfarer · 用光写情绪的温柔过渡
**来源**：[Toon Boom 动画访谈](https://www.toonboom.com/thunder-lotus-games-on-animating-the-afterlife-in-spiritfarer) · [Gamereactor 创意总监访谈](https://www.gamereactor.eu/spiritfarer-is-inspired-by-greek-mythology-and-studio-ghibli/) · [Steam](https://store.steampowered.com/app/972660/Spiritfarer/)
- `光照`：手绘 2D 与引擎内动态光混用，重点是"光的气氛"而非物理正确；团队专门设了技术美术调环境光。
- `配色/氛围`：各地点的气象与色温变化用来表达时间与情绪；基调是"soothing + 一点忧郁的怀旧"。
- `动效`：动画服务情绪（Stella 约 100 个动作，且每段都允许玩家打断）；金色暖光是"送别 / 升天"的情绪符号（视觉观察）。
- **不适用**：2D 逐帧/骨骼动画，本项目是程序化体素；不可能为单场景做 100 个动作，也不能做逐帧表情。
- **落地**：把"情绪光"固化成可复用的**三拍特效**：PointLight(`glow`) 强度 0→3→0（0.6s，ease-out）+ 8–12 个 additive Box 上飘 + UI 220ms 淡入；只在"稀有鱼上钩 / 灵魂升天 / 新地点解锁"三处触发。〔角色特效〕

### 9. Chillquarium · 深底陈列 + 多色变体的收集感
**来源**：[Steam](https://store.steampowered.com/app/2276930/Chillquarium/) · [COGconnected 报道](https://cogconnected.com/2023/09/chillquarium-is-making-waves-on-steam-with-a-94-positive-review/)
- `构图`：深色底 + 高亮主体的"陈列式"画面（视觉观察），主体永远比环境亮。
- `系统/内容`：图鉴收集是主要长线目标（100 种稀有鱼 + 多色变体）；同种鱼换色即扩内容。
- `UI/节奏`：像素 UI 与游戏同色板；idle 陪伴、不索取注意力。
- **不适用**：2D 像素水族箱；本项目的鱼已是 3D 体素，且图鉴预览目前混用 `PerspectiveCamera` + `antialias`（`visual-art-audit.md` §1.3 已点名），与主场景风格割裂。
- **落地**：图鉴卡片统一为"`ink` 底 88% + 主体正交透明渲染 + 稀有度 5 档固定色条"，并让稀有度色**同时**用于 3D 鱼体 `glow`，做到"卡片色 = 场景色"。〔UI / 角色特效〕

### 10. Cozy Grove · 素描书与水彩式的"颜色解锁"
**来源**：[Polygon 原文](https://www.polygon.com/interviews/22397934/indie-games-hand-drawn-artists-cozy-grove/) · [中文译文（GameRes）](https://www.gameres.com/883956.html)
- `概念`：世界观是一本"素描书"，先有线稿，再逐步上水彩；玩家任务就是把颜色带回小岛。
- `动效/系统`：世界初始去饱和，随进度一点点恢复颜色——**进度 = 色彩**，这是最省美术量的情绪反馈。
- `材质/氛围`：线条本身是美学（宽度、起止点的细微变化），刻意保留"手作的不完美"；Ghibli 的暖 + Over the Garden Wall 的"轻诡异"平衡。
- **不适用**：手绘 2D 线稿，本项目不能画笔触，也无法承担逐帧美术量；"颜色回来"若做成全屏后处理会污染透明底。
- **落地**：做**轻量版颜色解锁**——未发现鱼 / 未解锁地点在图鉴里用 30% 饱和的 6 色变体，解锁时 1.2s 过渡到完整色板；零 geometry 成本，只改材质颜色插值。〔UI / 12 场景〕

---

## 2. 10 条可直接执行的结论

1. **6 色槽位化 + 明度三档**：`theme` 的 `key/shadow/base/accent/glow/veil` 进 `MaterialCache` 命名槽，每槽派生 0.85/1.0/1.18 三档；场景、UI、PostFX 只读槽位，禁止裸 hex。验收：`rg -n "0x[0-9a-fA-F]{6}" src/renderer/locations/` 每场景命中 ≤2 处（仅允许 glow 常量）。〔渲染管线〕
2. **先灰度后颜色**：每个场景截图转灰度，要求 `accent` 与相邻 `base` 明度差 ≥18%、`glow` 明度 ≥0.9、`shadow` 不得压到纯黑（明度 ≥0.10）；灰度可读列为 12 场景硬验收项。〔12 场景〕
3. **每帧只有一个高饱和记忆点**：`accent` 面积 <12%，同屏高饱和色相族 ≤3；第二个霓虹/灯笼/招牌一律用 `glow` 而不是新增 `accent`。〔12 场景 / UI〕
4. **景深用 `veil` 剪影层，不用 Fog**：远景层 `MeshBasicMaterial` + `veil` 色，opacity 0.35–0.8，位于主体后 3–8 单位；透明窗上不产生灰边，且比 `FogExp2` 便宜。〔渲染管线 / 12 场景〕
5. **浮岛地形"三色 + 一径 + 一留白"**：`base` 三档明度做草/土/岩，每地点 1 个特征缺口（瀑布口/码头/沙滩），岛底 3–5 块悬空碎岩；画面中心 1/3 永久留空给渔夫与浮标。〔浮岛地形〕
6. **水面五件套**：浅水提亮 35% + 连续阶梯泡沫环带（呼吸缩放）+ 2 层反向短弧波纹 + `accent`/`glow` 竖向倒影（6–10 条 Box）+ 30–40 个实例化闪烁高光；外缘用 alpha 渐隐而非硬边。〔水面〕
7. **假 AO 替代 SSAO**：落地物体下垫 `shadow` 色扁 Box（高 0.02、宽 +10%、opacity 0.18–0.3），统一 InstancedMesh；这是 400×300 下唯一不糊的接触阴影方案。〔渲染管线 / 浮岛地形〕
8. **局部光统一规则**：每场景 2–4 个 PointLight，`distance` 锁 6–10，颜色必须是 `glow`，强度按 0.08–0.2Hz 呼吸；禁止白光与全岛泛亮。〔12 场景〕
9. **UI 五条硬规则**：`ink` 面板 + 1px `paper` 14% 描边 + `gold` 选中 + 稀有度 5 档固定色 + 常态 ≤40%/悬停 94% 不透明度；张力条改"逐格填充"而非渐变。〔UI〕
10. **动效与分配预算**：呼吸 6–8s 周期、UI 过渡 120–240ms、稀有反馈走三拍（0.6s）、随机一律 seeded PRNG；`update()` 内 0 次 new Vector3/Color。〔角色特效 / UI〕

### 2.5 参考 → 12 场景落地映射

| 场景 | 主参考 | 要偷的手法 | 明确禁止 |
|---|---|---|---|
| 京都 | Dorfromantik + A Short Hike | 灰度分层、`veil` 山脊剪影、鸟居唯一高饱和 | 樱花粉铺满全岛 |
| 中国 | Tiny Glade + ISLANDERS | 竹雾层次、大色块、亭子做唯一地标 | 高饱和竹绿、均匀撒点 |
| 美国 | Cast n Chill + Dorfromantik | 青/品红/橙三色霓虹、湿地面竖向倒影 | 整面品红、无侧墙峡谷 |
| 英国 | Cast n Chill | 前景框景（雨伞/栏杆）、湿砖反光 | 砖墙挡在 z=2.8 阻断视线 |
| 法国 | Dorfromantik | 铁塔退到 2/3 线、圣母院只做剪影 | 铁塔占画面中心 |
| 德国 | A Short Hike | 暖窗冷雪对比、炊烟 | 亮红屋顶、纯白死雪 |
| 意大利 | Spiritfarer | 暖光情绪、水面倒影、彩色立面 | 全城同一米色 |
| 丹麦 | Cast n Chill | 桅杆竖线节奏、港口暖灯 | 用雪粒子替代船与桅杆 |
| 冰岛 | A Short Hike + Spiritfarer | 极光绿 `glow`、黑教堂冷边、地热蒸汽 | 极光覆盖整屏 |
| 泰国 | Spiritfarer | 金色光符号、天灯节奏、河面暖倒影 | 金顶过曝（accent 必须 <12%） |
| 埃及 | Dorfromantik | 砂岩三档明度、热霾 `veil`、柱身饰带 | 纯黄金字塔、灰白阴影 |
| 希腊 | ISLANDERS | 大色块白墙、蓝顶唯一高饱和、海雾远景 | 多色建筑平均用力 |

---

## 3. 6 色脚本示例（`key` / `shadow` / `base` / `accent` / `glow` / `veil`）

四条规则：暖冷成对、`shadow` 非纯黑、`accent` 唯一中高饱和且 <12%、`veil` 与 `shadow` 同族但更亮。

**京都 · 黄昏樱花**｜暖主光 + 冷阴影
| 槽位 | 色值 | 一句话理由 |
|---|---|---|
| key | `#f2c48c` | 32° 暖橙低角度夕照，给朱红鸟居补光而不抬高其饱和度 |
| shadow | `#3a3a5c` | 蓝紫补色冷影，避免黄昏场景暗部发黑 |
| base | `#3f5a46` | 苔绿岛体，压住樱花与鸟居的花色 |
| accent | `#b23a3a` | 朱红鸟居，全画面唯一高饱和，占比 <8% |
| glow | `#ffb85c` | 纸灯笼暖光，只出现在小面积高亮处交给泛光 |
| veil | `#6a5a78` | 暮霭紫，与 shadow 同族更亮，让远景山脊退后 |

**冰岛 · 极光夜**
| 槽位 | 色值 | 一句话理由 |
|---|---|---|
| key | `#8fb6d9` | 冷月光把黑教堂从夜色里"抠"出轮廓边 |
| shadow | `#1e2438` | 深蓝暗部，绝不用纯黑（融雪与白墙的暗面仍要偏蓝） |
| base | `#33383f` | 玄武岩与黑沙的岛体色，不反光、不抢极光 |
| accent | `#92303a` | 教堂红屋顶，唯一高饱和，只占屋顶面积 |
| glow | `#5cf0b0` | 极光绿，只给光带与窗，是泛光的主要来源 |
| veil | `#4a5a72` | 夜雾蓝，亮于 shadow，做远景冰原剪影 |

**赛博美国 · 霓虹夜**
| 槽位 | 色值 | 一句话理由 |
|---|---|---|
| key | `#6f8bff` | 冷青蓝主光，把品红完整留给 accent |
| shadow | `#2a1630` | 紫黑而非纯黑，保住霓虹在暗部的反射体积 |
| base | `#23262e` | 沥青与金属暗灰，让霓虹"浮"起来 |
| accent | `#ff2f8e` | 品红霓虹 <10%；橙色 `#ff8a3d` 只允许作 ≤1% 的招牌高光 |
| glow | `#29e0e0` | 青霓虹与窗光，与品红形成成对冷暖 |
| veil | `#3a2a4a` | 城市雾紫，远景楼群只留轮廓 |

**埃及 · 日落砂岩**
| 槽位 | 色值 | 一句话理由 |
|---|---|---|
| key | `#ffc27a` | 约 2900K 低角度暖阳，晒暖砂岩但不过黄 |
| shadow | `#4a3a5a` | 紫灰补色，沙地阴影比灰黑更耐看 |
| base | `#c2a378` | 砂岩三档明度的中间值，明度差 ≥18% 才有台阶感 |
| accent | `#2f8f8f` | 柱身绿松石饰带，与沙色互补，<12% |
| glow | `#ff9a3c` | 火把与神庙内光，只出现在洞口和小面积高亮 |
| veil | `#b99a86` | 热霾灰粉，与 shadow 同属灰紫族但更亮，做远沙丘 |

**希腊 · 爱琴海午后**
| 槽位 | 色值 | 一句话理由 |
|---|---|---|
| key | `#ffe0b0` | 4500K 暖阳，白墙不过曝、蓝顶不失真 |
| shadow | `#6a7fa8` | 天空反射的蓝灰，白墙暗部偏蓝是圣托里尼的标志 |
| base | `#cbc3b3` | 石灰岩暖白，与墙面的纯白形成层次 |
| accent | `#2f6fd0` | 蓝顶教堂，唯一中高饱和，面积严格 <12% |
| glow | `#ffd98a` | 窗内暖光，给冷蓝画面一点体温 |
| veil | `#9db6cf` | 海雾蓝，远景岛屿与海面只留剪影 |

**泰国 · 河灯夜祭**
| 槽位 | 色值 | 一句话理由 |
|---|---|---|
| key | `#8aa0c8` | 冷月蓝主光，与天灯暖光成对 |
| shadow | `#241f33` | 紫黑保住夜色的体积，河岸暗部不脏 |
| base | `#423a30` | 湿木与河岸土，低饱和、低明度 |
| accent | `#d8a93a` | 金顶佛塔，唯一中高饱和，是画面视觉锚点 |
| glow | `#ff9a4a` | 天灯 / 河灯橙，小面积高亮交给泛光 |
| veil | `#38405c` | 河雾蓝紫，亮于 shadow，远景船桅剪影 |

---

## 4. 与现有文档的冲突 / 待核实清单

- `visual-art-audit.md` §2.1 指出 `antialias: true` 与风格指南冲突：`art-direction-v2.md` §3.1 已裁定 `antialias: false` + `pixelated`，本文件结论以 v2 为准，不再重复讨论。
- `ref-comparison.md` 建议"每个 build 内散落 hex"且"PerspectiveCamera 可接受"：与 v2（正交相机 + 6 色脚本）冲突。该文件的颜色只能当**单件道具参考**，不得成为主光/环境色来源。
- `art-review.md` 的若干目标色（京都草地 `0x3a5a3a`、埃及金字塔 `0xd4b896`）与 6 色脚本可能同色相不同明度：应作为 `base` 槽的明度档派生，不新开 hex，否则同场景会出现两个"绿"。
- **待核实**：ISLANDERS 具体色板数值；A Short Hike 内部渲染分辨率与雾参数；Spiritfarer 光效实现层（2D 特效 or 引擎光）；WEBFISHING 无官方 art 说明页，风格描述来自社区资料；Tiny Glade 的 ray marching / GI 细节来自 GDC 议题标题与二手报道，未读原始 slide。

---

## 5. 引用清单（24 个外部链接，去重；另有 1 个工作区文件）

**访谈 / 技术分享 / 开发者幕后（8，含 1 篇转载）**
1. [80.lv · Dorfromantik 极简设计与顶点色/色板访谈](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design)
2. [Toon Boom · Spiritfarer 动画与光照访谈](https://www.toonboom.com/thunder-lotus-games-on-animating-the-afterlife-in-spiritfarer)
3. [Gamereactor · Spiritfarer 创意总监访谈（Ghibli 影响）](https://www.gamereactor.eu/spiritfarer-is-inspired-by-greek-mythology-and-studio-ghibli/)
4. [GDC 2024 · Rendering Tiny Glades with Entirely Too Much Ray Marching（中文字幕）](https://www.bilibili.com/video/BV17frkYZECb/)
5. [GameLook（小米游戏中心转载）· Tiny Glade 两人团队研发访谈](https://game.xiaomi.com/viewpoint/1393220466_1727591148090_100)
6. [PlayStation Blog · A Short Hike 小世界幕后](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/)
7. [Polygon · 十位开发者谈"手绘游戏"（含 Cozy Grove 首席美术）](https://www.polygon.com/interviews/22397934/indie-games-hand-drawn-artists-cozy-grove/)
8. [AUTOMATON · Rusty's Retirement 开发者访谈（桌面贴边设计）](https://automaton-media.com/articles/interviewsjp/20240205-281336/)

**评测 / 报道（5）**
9. [VideoGamer · Cast n Chill 像素水面与氛围](https://www.videogamer.com/previews/cast-n-chill-fishing-for-compliments-charming-pixel-art-balmy-atmosphere/)
10. [BGR · Rusty's Retirement 桌面挂件形态](https://www.bgr.com/entertainment/ingenious-idle-game-puts-a-pixelated-farm-on-your-desktop/)
11. [COGconnected · Chillquarium 收集与 idle 设计](https://cogconnected.com/2023/09/chillquarium-is-making-waves-on-steam-with-a-94-positive-review/)
12. [GameRes · Cozy Grove 手绘/水彩式上色（Polygon 译文）](https://www.gameres.com/883956.html)
13. [WEBFISHING 社区资料站（非官方，风格描述待核实）](https://webfishing-game.io/about-us)

**官方商店 / 站点（11）**
14. [Tiny Glade · Steam](https://store.steampowered.com/app/2198150/Tiny_Glade/)
15. [WEBFISHING · Steam](https://store.steampowered.com/app/3146520/WEBFISHING/)
16. [WEBFISHING · itch.io](https://lamedeveloper.itch.io/webfishing)
17. [Cast n Chill · Steam](https://store.steampowered.com/app/3483740/Cast_n_Chill/)
18. [Rusty's Retirement · Steam](https://store.steampowered.com/app/2666510/Rustys_Retirement/)
19. [Dorfromantik · Steam](https://store.steampowered.com/app/1455840/Dorfromantik/)
20. [ISLANDERS · Steam](https://store.steampowered.com/app/1046030/ISLANDERS/)
21. [A Short Hike · 官网](https://ashorthike.com/)
22. [A Short Hike · Steam](https://store.steampowered.com/app/1055540/A_Short_Hike/)
23. [Spiritfarer · Steam](https://store.steampowered.com/app/972660/Spiritfarer/)
24. [Chillquarium · Steam](https://store.steampowered.com/app/2276930/Chillquarium/)

> 工作区文件（非链接）：[`art-direction-v2.md`](./art-direction-v2.md) 是本文件的上位规范。

---

*方法可以借，画面必须自己长出来；参考作品只回答"为什么这样好看"，不提供"长什么样"。*
