# 美术升级 v2 — 微光圣地（Luminous Sanctuaries）

> 日期：2026-10-18 ｜ 方向与规范：[`art-direction-v2.md`](./art-direction-v2.md) ｜ 参考拆解：[`art-reference-analysis.md`](./art-reference-analysis.md)
> 上一轮记录：[`art-upgrade-2026-10.md`](./art-upgrade-2026-10.md)

## 0. 这次做了什么（一句话）

在保留「透明桌面窗 + 正交体素微缩景观」基因的前提下，给整个游戏加了一层统一的**光与色**：新的调色/泛光/暗角后期、重新做的手工台地浮岛与水岸、12 个场景的构图重排，以及一套纸墨质感的 UI。参考了 Webfishing、Tiny Glade、Cast n Chill、Rusty's Retirement、Dorfromantik 等同类作品的**方法**（不取素材）。

## 1. 渲染管线

| 项 | 之前 | 现在 |
|----|------|------|
| 配色 | 每场景各自调材质，整体发灰 | 12 个地点各有一套 **6 色脚本**（key/shadow/base/accent/glow/veil），写在 `location-data.ts` |
| 光 | 环境光偏高、方向光偏弱，画面平 | 低环境光 + 主光 + 轮廓光 + 水面点光 + 暖半球反弹，固定 5 灯结构；阴影收紧到岛体、1024 贴图 |
| 后期 | 无 | `PostFX.ts`：曝光/对比/饱和/暖冷分离、亮部泛光、alpha 遮罩暗角、4×4 Bayer 抖动；透明像素保持不变 |
| 取景 | viewSize 9，岛偏小、上方空 | viewSize 8.4、目标点 y=1.6、俯角约 33°，岛体占画面约 2/3 |
| 相机 | 仅平移 | 慢速环绕 + ±0.12 呼吸浮动 |

## 2. 浮岛 / 水面 / 远景（全部 12 场景共享）

- **浮岛**（`FloatingIsland.ts`）：由一块平盘改为 7 层手工台地（草皮 0.25 网格 + 土坡 + 3 层岩层 + 水下岛尖），岛缘轮廓按 location id 播种，带特征缺口、阶梯悬崖、悬垂苔藓、岛缘草唇、簇状花草/碎石、岛底悬浮碎岩；按三种阴影语义合为 3 个 InstancedMesh，只有 1 批进入阴影 pass。
- **水面**（`SanctuaryWater.ts`）：5 档深度色带 + 外缘透明度渐隐（不再出现「咖啡滤纸」硬边）、浅水沙色岸台、单个闭合阶梯泡沫环带、两圈带缺口的反向短弧波纹、accent/glow 竖向倒影、实例化闪烁；水面从岛缘下方一直铺到 r≈7.9。
- **远景**（`BaseLocation.ts`）：透明窗口不能有地平线剪影（会在环绕时挡到岛前、并给桌面蒙灰），因此改为 3 块微型浮岛 + 2 团半透明云 + 岛底薄雾，环绕时自然提供深度参照。
- **岸线细节**（`SanctuaryDetails.ts`）：每个地点 5 簇岸线组合（樱花落瓣 / 芦苇 / 雪堆 / 城市管线 / 沙生植物 / 热带花），加 18 颗岸边卵石与 3 处暖光点。

## 3. 12 个圣地

- 所有场景重排为「前景框景 → 主地标 → 悬浮远景」三层；地标让出画面中心，放到 2/3 线；渔夫与浮标禁入区保持可读。
- 补齐 `art-review.md` 指出的文化缺失项（锦鲤池与拱桥、六角亭、峡谷巷道与三色霓虹、红电话亭、圣母院、绿色百叶窗、彩色建筑与系船柱、木帆船、白窗框黑教堂与地热蒸汽、白墙金顶佛塔与坐佛、狮身人面像、三角梅与钟楼等）。
- 每个场景新增 2–4 个局部 PointLight（呼吸频率 0.08–0.2Hz）与至少一处发光体/光柱。
- 场景道具按 0.25 网格重建；重复小物件合并到 InstancedMesh；单场景追加预算 ≤ 40 draw call / 25k 三角形。

## 4. UI

- 新设计 token：墨色面板 `#16191a`、纸色文字 `#efe7d6`、金色高亮 `#e0b978`、鼠尾草绿/珊瑚红/天蓝；统一圆角 3/6/10px、1px 描边、字号阶 7–20px。
- 新增 `ui/icons.ts` 线性 SVG 图标集（16×16、1.25px stroke、currentColor），替换 emoji/Unicode 图标。
- 重做：主界面铭牌与工具组、FishingUI（蓄力/张力三色区/咬钩提示）、RunUI/结算、营地（地点网格/升级卡片/出发底栏）、护符与鱼饵选择、图鉴（稀有度样式/空态/详情）、灵魂面板、设置面板。
- `SoulSanctuaryPanel` 已移除旧内联视觉样式，统计、卡片、故事与锁定碎片统一使用 `.soul-*` 类和设计 token；保留未读、展开与 Escape 行为。
- 统一 150–240ms 缓动、选中态金色描边+外发光、hover 提亮；400×300 / 560×420 / 640×480 三档窗口尺寸无溢出。

## 5. 角色 / 鱼 / 特效

- **渔夫**：1.14 单位高、脚底原点；草帽帽带、围巾、背包、大衣下摆、靴子、胡须；4 节钓竿随张力弯曲；新增 `playCast()/playLineBreak()` 姿态；按动画父节点与阴影语义合为 8 批。
- **鱼**：5 种体型统一体素语言，补背鳍/胸鳍/尾鳍/眼/鳃线/鳞片明暗；稀有度递进发光；idle 尾摆不覆盖世界坐标；模板与材质仍跨实例共享。
- **浮标/鱼线**：暖红+奶油白三段式浮标 + 水面倒影；鱼线绿/黄/红张力色、松弛下垂与风摆。鱼线 12 段合为 1 个动态实例批，浮标等待态由 24 个绘制对象降为 6 个，天线与波纹动画保留。
- **基础粒子**：90 个独立 Mesh 合为 1 个动态 InstancedMesh，粒子数量、运动、寿命与重生不变。
- **水花**：3 档（普通/完美/传说），单 InstancedMesh；传说带金色 soul spark。
- **猫/瀑布**：三花与虎斑多段尾摆；瀑布改为 3 层不同速度/透明度的实例化水帘 + 底部泡沫雾气。

## 6. 验证与截图

```powershell
node node_modules/typescript/bin/tsc --noEmit                 # 0 error
node node_modules/eslint/bin/eslint.js src tests --ext .ts    # 0 error（3 条历史 warning）
node node_modules/@playwright/test/cli.js test tests/unit.spec.ts   # 77 passed
node node_modules/@playwright/test/cli.js test tests/smoke.spec.ts --project=electron  # 1 passed
node node_modules/vite/bin/vite.js build                      # green
node scripts/art-review.cjs                                   # scenes + UI + responsive + budget
```

- `scripts/art-review.cjs` 输出 12 场景 + 营地 + 图鉴 + 灵魂面板 + 三档尺寸截图；page error、cornerAlpha 非 0、calls > 140 或 triangles > 150k 会直接失败。
- 截图目录：`screenshots/art-review/`（`contact-sheet.png` 为 12 场景总览，`japan.png` 保留透明底，`japan-compact.png` / `japan-standard.png` 与 `souls*.png` 验证三档窗口）。
- 美术基础测试共 11 条：12 地点 6 色脚本、PostFX、ArtKit、粒子/鱼线/渔夫/浮标实例化与动画、浮岛三种阴影批次、连续闭合泡沫及资源释放。
- Electron 冒烟全流程通过：启动 → 营地 → 图鉴 → 灵魂面板 → 护符 ×3 → 鱼饵 → 出发 → 抛竿；待机与等待阶段均检查渲染预算。

### 实测性能（640×480，含阴影 pass 与后处理）

| 组 | draw calls | triangles |
|----|-----------:|----------:|
| 北组 6 场景 | 70–75 | 1.86–2.98 万 |
| 南组 6 场景 | 70–79 | 10.15–10.98 万 |

已满足 §3.2 的桌面挂件目标（≤140 calls / ≤150k triangles）。最高采样为 79 calls（意大利、泰国），三角形峰值为 109,844（埃及）；真实抛竿等待为 77 calls / 25,252 triangles。优化未减少粒子或体素，也未关闭动态阴影与后处理。


## 7. 已知限制

- 透明窗口不适合地平线剪影，因此「远景」使用悬浮物而非山脊；若未来提供「桌面模式/背景板模式」，可再启用 `buildSilhouetteRidge`。
- 泛光只对亮度阈值以上的像素生效；每个地点的 `art.grade` 只做轻度校正，避免像素化后出现脏边。
- 12 个场景的细节密度仍受 400×300 内部缓冲限制，低于 0.06 单位的细节不可见（规范中已禁止）。
