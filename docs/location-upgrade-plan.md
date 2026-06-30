# Soul Sanctuary 场景美术升级 ND 计划书

> **ND** = Next Development（下一阶段开发）
> **状态**: 全部 12 个场景已完成 ND 标准升级
> **目标**: 让所有 12 个地点达到统一的“体素微缩景观 + 文化氛围 + 动态氛围”标杆

---

## 1. 背景与目标

经过最新一轮迭代，`KyotoJapan` 与 `ChinaBamboo` 已完成艺术升级，确立了新的场景质量标准。本计划书将这两份成果固化为可复用的 SOP，并列出其余 10 个场景的升级方向，供后续分窗口/分任务执行。

### 1.1 升级目标

- **视觉统一**: 全部场景使用 `FloatingIsland` + `VoxelBuilder`/`Waterfall`/角色 helper 的同一套架构
- **文化辨识度**: 每个地点拥有 1-2 个不可替代的标志性建筑/元素
- **动态氛围**: 水面、粒子、灯光、角色动画共同营造“活着的微缩景观”
- **性能可控**: 保持 400×300 像素画布下 60fps，避免过度几何体

---

## 2. 已完成标杆：日本 & 中国

### 2.1 🇯🇵 京都落樱 · 暮色神社

**文件**: `src/renderer/locations/KyotoJapan.ts`

| 模块 | 实现要点 |
|------|----------|
| 浮岛 | `FloatingIsland` + 暖青苔色草地 |
| 水体 | `Waterfall` 边缘瀑布 + 中心锦鲤池 + 动态水方块 |
| 标志建筑 | 鸟居、石灯笼、拱木桥 |
| 自然 | 双层樱花树 + 60 片飘落花瓣 |
| 角色 | `CalicoCat` 招财猫 |
| 灯光 | 月光冷蓝 + 灯笼暖黄 + 樱花粉补光 |

### 2.2 🇨🇳 翠竹流萤 · 禅意水镜

**文件**: `src/renderer/locations/ChinaBamboo.ts`

| 模块 | 实现要点 |
|------|----------|
| 浮岛 | `FloatingIsland` + 主题色岛屿 |
| 水体 | `Waterfall` + 荷塘（荷叶、荷花、锦鲤、水面微光） |
| 标志建筑 | 多层中式塔楼 + 3 座石灯笼 |
| 自然 | 16+ 根竹林（关节、竹叶簇、倾斜） |
| 角色 | `Fisherman` 钓鱼人 + 新增 `TabbyCat` 狸花猫 |
| 灯光 | 弯月冷光 + 塔楼暖光 + 流萤 |

---

## 3. 升级标准 / SOP

后续场景统一按以下步骤执行：

### 3.1 引入通用组件

```ts
import { BaseLocation } from './BaseLocation';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { Waterfall } from '../rendering/Waterfall';
import { MaterialCache } from '../rendering/MaterialCache';
import { VoxelBuilder } from '../rendering/VoxelBuilder';
import { createSurfaceShimmer, createLanternGlow } from './AtmosphereEffects';
```

必要时新建 helper（如 `TabbyCat`），放在 `src/renderer/rendering/`。

### 3.2 材质使用规范

- 不透明物体：`MaterialCache.getLambert(color)`
- 自发光（窗户、灯芯）：`MaterialCache.getBasic(color)`
- 透明水体：`MaterialCache.getTransparentLambert(color, opacity)`
- 禁止：光滑几何体、PBR、自定义 Shader

### 3.3 场景必备元素清单

| 元素 | 说明 |
|------|------|
| 浮岛底座 | `FloatingIsland` + 主题色 |
| 水体/瀑布 | 至少一种动态水效果 |
| 地标建筑 | 1-2 个文化符号建筑 |
| 植被/装饰 | 与地点气候匹配 |
| 小型角色 | 猫/渔夫/行人等，增加生气 |
| 粒子氛围 | 雨/雪/花瓣/萤火/尘埃等 |
| 灯光层次 | 月光/补光/轮廓光 + 1-2 个闪烁暖光源 |

### 3.4 动画 update 规范

- 水体方块/荷叶：`Math.sin(time * speed + phase)`
- 粒子按 `userData.type` 分支处理
- 灯光闪烁：`_flickerLights` 数组 + `update()` 循环
- 角色/动物：独立 helper，每帧调用 `.update(time)`

### 3.5 清理规范

```ts
destroy(): void {
  this._waterfall?.dispose();
  this._cat = null;
  this._fisherman = null;
  this._particles = [];
  this._flickerLights = [];
  super.destroy();
}
```

---

## 4. 10 个场景升级方向（已完成）

> 优先级：P0（核心视觉）> P1（氛围增强）> P2（细节 polish）

### 4.1 🇺🇸 USA — Cyberpunk Neon Alley

**当前问题**: 缺少侧墙“峡谷感”，色调单一洋红，缺少橙/青对比。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 两侧加高墙（3×8×0.5 体素），贴霓虹招牌 |
| 水体 | 地面网格反射 + 低层雾化 |
| 色彩 | 增加橙色 (#ff6600) 与青色 (#00ffff) 霓虹 |
| 细节 | 服务器架之间加电缆线、全息投影环 |
| 粒子 | 数据雨保持，新增地面漂移雾 |

### 4.2 🇬🇧 UK — Rainy Thames Dock

**当前问题**: 砖墙遮挡视角，缺少红色英伦元素（电话亭/邮筒/双层巴士）。

| 升级项 | 具体动作 |
|--------|----------|
| 布局 | 砖墙移到左侧作为画框，正面留出码头空间 |
| 标志 | 增加红色电话亭、红色邮筒、双层巴士剪影 |
| 水体 | 泰晤士河加动态水方块 + 雨点涟漪 |
| 灯光 | 路灯暖光增强，大本钟钟面发光 |
| 粒子 | 雨势增强，加雨滴落地溅起效果 |

### 4.3 🇫🇷 France — Autumn Leaves on the Seine

**当前问题**: 落叶场景较空，缺少塞纳河标志性元素。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 增加埃菲尔铁塔剪影/小模型 |
| 水体 | 塞纳河水面 + 小船/贡多拉 |
| 植被 | 枫树（橙红体素簇）替代普通树 |
| 细节 | 街边小咖啡座、路灯 |
| 粒子 | 落叶旋转下落 + 风向往一侧飘 |

### 4.4 🇩🇪 Germany — Black Forest Winter Cabin

**当前问题**: 雪景较平，缺少木屋细节和烟囱炊烟。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 黑森林木屋加三角屋顶、烟囱、门廊 |
| 环境 | 松树环绕 + 积雪覆盖 |
| 水体 | 结冰池塘或小溪（半透明蓝白） |
| 灯光 | 窗户暖光、门廊灯 |
| 粒子 | 雪花加大 + 烟囱炊烟 |

### 4.5 🇮🇹 Italy — Venice Canal at Twilight

**当前问题**: 缺少威尼斯建筑特征（拱桥、彩色房屋、贡多拉）。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 彩色房屋排（粉/黄/橙）+ 拱桥 |
| 水体 | 运河水面 + 贡多拉小船 |
| 灯光 | 暖黄街灯倒映水面 |
| 细节 | 系船柱、百叶窗、阳台 |
| 粒子 | 萤火虫/灯笼光点 |

### 4.6 🇩🇰 Denmark — Nyhavn Winter Night

**当前问题**: 童话木屋色彩可更丰富，缺少壁炉烟雾和港口细节。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 彩色联排木屋（红、黄、蓝、绿） |
| 水体 | 港湾水面 + 小船倒影 |
| 灯光 | 窗户暖光、门廊灯 |
| 细节 | 积雪屋顶、烟囱、码头木桩 |
| 粒子 | 雪花 + 烟囱炊烟 |

### 4.7 🇮🇸 Iceland — Aurora over the Black Church

**当前问题**: 极光已有，但地面景观单调，缺少冰岛地貌特征。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 黑教堂 + 小型草皮屋 |
| 地貌 | 苔藓熔岩地 + 远处冰川/雪山 |
| 水体 | 小瀑布/温泉蒸汽 |
| 灯光 | 极光保持，地面冷蓝月光 |
| 粒子 | 极光粒子 + 上升蒸汽 |

### 4.8 🇹🇭 Thailand — Chao Phraya Floating Lanterns

**当前问题**: 缺少泰式建筑和河岸氛围。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 金色佛塔/寺庙屋顶 + 河岸长廊 |
| 水体 | 河面 + 漂浮水灯 |
| 灯光 | 灯笼暖光、佛塔金色补光 |
| 细节 | 香蕉树、莲花、长尾船 |
| 粒子 | 天灯上升 + 萤火虫 |

### 4.9 🇪🇬 Egypt — Valley of the Kings

**当前问题**: 金字塔可更精致，缺少绿洲和棕榈。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 金字塔（阶梯式体素）+ 方尖碑 |
| 环境 | 棕榈树环绕绿洲 |
| 水体 | 绿洲水池 |
| 灯光 | 夕阳金橙侧光 |
| 粒子 | 沙尘漂移 |

### 4.10 🇬🇷 Greece — Santorini Windmill

**当前问题**: 白色建筑已有，可增加风车、蓝顶教堂和葡萄藤。

| 升级项 | 具体动作 |
|--------|----------|
| 建筑 | 蓝顶教堂 + 风车 + 白色阶梯房屋 |
| 水体 | 爱琴海蓝水面 |
| 细节 | 葡萄藤、陶罐、石墙 |
| 灯光 | 地中海蓝白对比光 |
| 粒子 | 海风漂浮粒子 |

---

## 5. 验收标准

每个场景升级完成后必须通过：

1. **类型检查**: `npm run typecheck` 无错误
2. **构建通过**: `npm run build:vite` 成功
3. **单元测试**: `npx playwright test tests/unit.spec.ts` 61 项全绿
4. **视觉自测**: 在 `npm run dev` 中切换地点，确认地标清晰、灯光不刺眼、无穿模
5. **性能自测**: 场景切换后 FPS 不低于 50
6. **清理检查**: 切换地点后内存/对象无泄漏（观察 `destroy()` 调用）

---

## 6. 推荐执行顺序

建议按文化复杂度与当前完成度排序：

1. **USA**（已有霓虹基础，补侧墙与色彩即可）
2. **UK**（码头结构完整，补英伦元素）
3. **France**（秋季氛围，补地标）
4. **Italy**（水城特色，补建筑）
5. **Germany / Denmark**（冬季雪景可复用烟囱/雪粒子）
6. **Iceland**（极光特效为主）
7. **Thailand / Egypt / Greece**（文化建筑差异大，单独处理）

---

## 7. 文件与 Helper 索引

| 文件 | 用途 |
|------|------|
| `src/renderer/locations/BaseLocation.ts` | 地点基类、灯光、粒子、销毁 |
| `src/renderer/rendering/FloatingIsland.ts` | 主题化浮岛底座 |
| `src/renderer/rendering/VoxelBuilder.ts` | 体素方块构建器 |
| `src/renderer/rendering/Waterfall.ts` | 边缘瀑布 |
| `src/renderer/rendering/CalicoCat.ts` | 日本招财猫 |
| `src/renderer/rendering/TabbyCat.ts` | 中国狸花猫 |
| `src/renderer/rendering/Fisherman.ts` | 钓鱼人 |
| `src/renderer/rendering/MaterialCache.ts` | 材质缓存 |
| `src/renderer/locations/AtmosphereEffects.ts` | 水面微光、灯笼光晕、雾气 |
| `docs/style-guide.md` | 体素美术规范 |
| `docs/art-review.md` | 旧版场景审计（部分建议仍可参考） |

---

*本计划书基于 2026-06-21 已提交的 Japan/China 升级成果编制。*
