# Soul Sanctuary — 工程优化方案

> **版本**: 1.0 | **日期**: 2026-06-22 | **基于**: 全方面项目审查报告  
> **目标**: 将项目从"功能完整的原型"推进到"可发布/可维护的产品"

> **更新日志（2026-06-22）**: 以下优化项/问题已在代码修复阶段完成：
> - 遗物系统已生效（`RunManager.startRun` 接收已装备遗物并传入 `ModifierEngine`）。
> - 营地线耐久升级已生效（按 `baseLineDurability` 注入 modifier）。
> - 存档已接通 Electron 文件持久化（启动时优先从文件加载，退出时文件保存，localStorage 作为 fallback 与自动保存双保险）。
> - Synergy `Balanced Approach` / `Momentum` 的 stat key 已修正。
> - Echo Stone 返竿逻辑已修复。
> - 托盘"切换圣地"快捷键已响应。
> - 超用力断线安慰奖（+5 精华）已通过新增 `game:essence_change` 事件发放。
> - 观赏模式点击穿透已启用 `setIgnoreMouseEvents`。
> - `electron-builder.yml` 已明确打包 `assets/icons/**/*`。
> - 项目已配置 ESLint + Prettier（本方案中"无 ESLint/Prettier"的描述已过时）。

---

## 一、优化目标

| 维度 | 现状 | 目标 |
|---|---|---|
| **工程规范** | 无 ESLint/Prettier，代码风格不一致 | 统一代码风格，CI 可自动检查 |
| **可维护性** | `RunUI.ts` 1131 行，`GameStateManager` 与 UI 耦合 | 核心文件拆分，层级解耦 |
| **发布就绪** | `assets/icons/` 缺失，安装包使用默认图标 | 补齐品牌资源，正式打包 |
| **测试稳定** | Smoke Test 在当前环境无法启动 Electron | 修复或替代 E2E 方案 |
| **代码质量** | 存在无效 alias、硬编码文案、超长行 | 清理遗留问题 |

---

## 二、优化原则

1. **最小侵入**: 不改游戏逻辑、不改现有 API、不改玩家体验
2. **渐进式**: 按 P0 → P1 → P2 分阶段推进，每阶段可独立交付
3. **可回滚**: 每个改动点都可通过 Git 单独回滚
4. **测试驱动**: 每阶段完成后必须保证 `typecheck` + 61 单元测试通过

---

## 三、分阶段优化路线图

### Phase 1: 发布收尾（P0，预计 1-2 天）

#### 3.1 补齐应用图标资源

**目标**: 让 electron-builder 使用品牌图标生成安装包，而非默认 Electron 图标。

**涉及文件**:
- 新建 `assets/icons/icon.ico`（256×256，Windows）
- 新建 `assets/icons/icon.png`（512×512，macOS/Linux）
- 可选 `assets/icons/tray-icon.png`（16×16 / 32×32，系统托盘）
- 现有 `electron-builder.yml` 已配置好路径，无需修改

**验收标准**:
- `npm run build:win` 生成的安装包和 `win-unpacked/Soul Sanctuary.exe` 显示自定义图标
- 任务栏/托盘（如使用）显示自定义图标

**风险**: 低。仅新增资源文件，不影响代码逻辑。

---

#### 3.2 拆分 `RunUI.ts`

**目标**: 将 1131 行的巨型 UI 类拆分为职责单一的模块，降低维护成本。

**建议拆分结构**:

```
src/renderer/roguelike/ui/
├── RunUI.ts              # 仅负责组装和生命周期管理
├── CampPanel.ts          # 营地面板（升级/地点/鱼饵/遗物/日常/存档/成就）
├── CharmPicker.ts        # 护符选择器
├── BaitPicker.ts         # 鱼饵选择器
├── ResultPanel.ts        # Run 结算面板
└── run-ui-helpers.ts     # 共享的 tooltip、toast、card style 工具
```

**涉及文件**:
- 新建上述 6 个文件
- 重写 `src/renderer/roguelike/RunUI.ts` 为轻量级协调器
- 更新 `src/renderer/index.ts` 中的 import

**迁移策略**:
1. 先提取 `tooltip` 工厂函数到 `run-ui-helpers.ts`
2. 再提取 `_showCampPanel` → `CampPanel.ts`
3. 再提取 `_showCharmPicker` → `CharmPicker.ts`
4. 再提取 `_showBaitPicker` → `BaitPicker.ts`
5. 再提取 `_showResultPanel` / `_showEventToast` → `ResultPanel.ts`
6. 最后重写 `RunUI.ts`，保留与原文件相同的 public API：`showCampPanel()`、`dispose()`

**验收标准**:
- `npm run typecheck` 通过
- 61 个单元测试通过
- Smoke Test 中 camp / charm / bait / result 流程行为一致

**风险**: 中。UI 代码高度依赖 DOM 内联样式，拆分过程容易引入微小样式差异。建议每拆一个模块就运行一次测试并截图对比。

---

#### 3.3 解除 `GameStateManager → FishingUI` 耦合

**目标**: 核心状态层不应依赖具体 UI 类。

**当前问题代码**:
```typescript
// src/renderer/core/GameStateManager.ts
import { FishingUI } from '../ui/FishingUI'; // ❌ 核心层依赖 UI 层
// ...
FishingUI.fishpediaCount = Object.keys(this.fishpedia).length;
```

**建议方案**:
- 在 `GameStateManager.recordCatch()` 中改为发射事件：
  ```typescript
  this.eventBus.emit(GameEvents.GAME_FISHPEDIA_COUNT_UPDATE, {
    count: Object.keys(this.fishpedia).length,
  });
  ```
- 在 `FishingUI` 中订阅该事件并更新 `fishpediaCount`

**涉及文件**:
- `src/shared/events.ts`：新增事件类型
- `src/renderer/core/GameStateManager.ts`：移除 `FishingUI` import，改发事件
- `src/renderer/ui/FishingUI.ts`：订阅事件

**验收标准**:
- `typecheck` 通过
- 单元测试通过
- 捕获新鱼后弹窗仍正确显示鱼鉴总数

**风险**: 低。纯事件化重构。

---

### Phase 2: 工程规范（P1，预计 2-3 天）

#### 3.4 配置 ESLint + Prettier

**目标**: 统一代码风格，捕获常见错误，支持 CI 自动检查。

**建议配置**:

```json
// .eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json" },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  },
  "ignorePatterns": ["dist", "dist-electron", "release", "node_modules"]
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**新增依赖**:
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-prettier
```

**新增 npm 脚本**:
```json
"lint": "eslint src tests --ext .ts",
"lint:fix": "eslint src tests --ext .ts --fix",
"format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\""
```

**涉及文件**:
- 新建 `.eslintrc.json`、`.prettierrc`、`.eslintignore`
- 修改 `package.json` 增加脚本和 devDependencies

**验收标准**:
- `npm run lint` 可运行
- `npm run format` 可运行
- 初始格式化提交一次，后续改动不再出现大规模格式噪音

**风险**: 低。首次格式化会产生大量 diff，建议单独一个 commit。

---

#### 3.5 清理无效 alias 与配置

**目标**: 移除 `@systems` 无效 alias，统一路径映射。

**涉及文件**:
- `vite.config.ts`: 删除 `@systems` alias
- `tsconfig.json`: 删除 `@systems/*` path
- 全局搜索确认无代码使用 `@systems/...`

**验收标准**:
- `typecheck` 通过
- `build:vite` 成功

**风险**: 极低。

---

#### 3.6 调整 `tsconfig.json` 的 `outDir`

**目标**: 避免 `outDir: "dist"` 与 Vite 输出目录混淆。

**建议修改**:
```json
"outDir": ".tmp/tsc"
```

**涉及文件**:
- `tsconfig.json`
- `.gitignore` 增加 `.tmp/`

**风险**: 极低。

---

### Phase 3: 稳定性与体验（P2，预计 2-3 天）

#### 3.7 修复/稳定 Smoke Test

**目标**: 让 E2E 测试在开发环境和 CI 中稳定运行。

**可能原因与排查步骤**:
1. 检查 `require('electron')` 返回的路径是否可执行
2. 尝试使用已构建的 `release/win-unpacked/Soul Sanctuary.exe` 作为 `executablePath`
3. 确认 `dist/main/index.js` 与 `dist/renderer/` 为最新构建
4. 在 Windows 上可能需要以管理员权限运行，或关闭杀毒软件拦截

**建议调整 `smoke.spec.ts`**:
```typescript
const electronApp = await electron.launch({
  args: ['.', '--no-sandbox', '--disable-gpu'],
  executablePath: process.env.CI
    ? join(__dirname, '..', 'release', 'win-unpacked', 'Soul Sanctuary.exe')
    : require('electron'),
});
```

**涉及文件**:
- `tests/smoke.spec.ts`
- `.github/workflows/`（如后续加 CI）

**验收标准**:
- `npm run test:smoke` 在本地可稳定通过

**风险**: 中。环境问题排查可能耗时。

---

#### 3.8 持久化窗口位置

**目标**: 记住用户上次窗口位置，下次启动时恢复。

**建议方案**:
- 主进程 `window-manager.ts` 在 `moved`/`resized` 时将 bounds 写入 `userData/window-bounds.json`
- 启动时读取并传入 `createWindow(bounds)`

**涉及文件**:
- `src/main/window-manager.ts`
- `src/main/ipc-handlers.ts`（如需支持 IPC 读取）

**验收标准**:
- 关闭应用后重启，窗口出现在上次位置

**风险**: 低。

---

#### 3.9 增强 i18n 覆盖

**目标**: 消除 UI 中硬编码的中文/英文混合文本。

**重点检查文件**:
- `src/renderer/roguelike/RunUI.ts`（拆分后更易处理）
- `src/renderer/index.ts`（设置面板）
- `src/renderer/ui/FishingUI.ts`

**涉及文件**:
- `src/renderer/i18n/locales.ts`：新增缺失 key
- 各 UI 文件：替换硬编码字符串为 `i18n.t(...)`

**验收标准**:
- 切换语言后所有 UI 文本同步变化

**风险**: 低。

---

#### 3.10 让 Charm Synergy 真正影响数值

**目标**: 当前 `ModifierEngine._detectSynergies()` 只返回名称，未将加成写入 `ModifiedStats`。

**建议实现**:
- 在 `compute()` 中根据检测到的 synergy 自动给对应 stat 加 delta：
  - Tension Mastery → `tensionGreenMax += 10`
  - Keen Senses → `hookWindowBase += 0.3`
  - Balanced Approach → `tensionSlackRate += 3`
  - Momentum → `fishProgressRate += 2`
  - Deep Casting → `castDepthMult += 0.15`

**涉及文件**:
- `src/renderer/roguelike/ModifierEngine.ts`
- 更新相关单元测试

**验收标准**:
- 单元测试验证 synergy 能改变最终 stat 数值
- `RunUI` 中显示的 synergy 名称与实际效果一致

**风险**: 中。需要重新平衡数值，避免加成叠加过强。

---

## 四、实施顺序建议

```
Week 1 — 发布收尾
  Day 1: 3.1 补齐图标 + 3.5 清理 alias + 3.6 调整 outDir
  Day 2: 3.2 拆分 RunUI.ts
  Day 3: 3.3 解耦 GameStateManager → FishingUI
  Day 4-5: 回归测试 + Smoke Test 调试

Week 2 — 工程规范
  Day 1-2: 3.4 配置 ESLint + Prettier，执行首次格式化
  Day 3: 3.8 持久化窗口位置
  Day 4: 3.9 i18n 补全
  Day 5: 3.10 Synergy 数值生效
```

---

## 五、验收清单

| 检查项 | 通过标准 |
|---|---|
| 类型检查 | `npm run typecheck` 无错误 |
| 单元测试 | `npx playwright test tests/unit.spec.ts` 61/61 通过 |
| 构建 | `npm run build:vite` 成功 |
| 打包 | `npm run build:win` 生成带图标的安装包 |
| 代码风格 | `npm run lint` 无错误（首次格式化后） |
| E2E | `npm run test:smoke` 稳定通过 |
| 功能回归 | 钓鱼循环、营地、鱼鉴、地点切换、存档导入导出均正常 |

---

## 六、风险与回滚

| 风险 | 应对 |
|---|---|
| 拆分 UI 引入样式回归 | 每拆一个模块截图对比，保留原文件在 Git 历史中 |
| 首次 Prettier 格式化产生大量 diff | 单独一个 commit，不混合业务改动 |
| Synergy 数值改动影响平衡 | 先在单元测试中验证，再小范围人工测试 |
| Smoke Test 环境问题 | 提供 CI 专用 executablePath 回退方案 |

---

## 七、下一步行动

建议按 Phase 1 开始，先完成 **3.1 补齐图标** 和 **3.5/3.6 配置清理**，这三个任务风险最低、收益最直接，且能让安装包立即看起来更像正式产品。

是否开始执行 Phase 1？可以从任意一个子任务切入。
