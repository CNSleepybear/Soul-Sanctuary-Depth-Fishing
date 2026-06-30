# Contributing to Soul Sanctuary

感谢你对 Soul Sanctuary 的关注！我们欢迎任何形式的贡献。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [测试](#测试)
- [Pull Request 流程](#pull-request-流程)

---

## 行为准则

请保持友善和尊重。我们致力于为所有人提供友好、安全的协作环境。

---

## 如何贡献

### 报告 Bug

1. 在 Issues 中使用 **Bug Report** 模板
2. 描述复现步骤、期望行为和实际行为
3. 提供系统信息（OS、Node.js 版本等）
4. 附上截图或日志（如适用）

### 功能建议

1. 在 Issues 中使用 **Feature Request** 模板
2. 描述你希望添加的功能及其使用场景
3. 说明为什么这个功能对项目有价值

### 代码贡献

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 编写代码和测试
4. 确保所有测试通过
5. 提交 Pull Request

---

## 开发环境搭建

### 前提条件

- **Node.js** >= 18
- **npm** >= 9
- **Git**

### 安装

```bash
git clone https://github.com/your-username/soul-sanctuary.git
cd soul-sanctuary
npm install
```

### 开发模式

```bash
# 浏览器模式（调试 UI 和渲染逻辑）
npm run dev

# Electron 完整桌面模式
npm run dev:electron
```

### 构建

```bash
# 完整构建（Vite + Electron-builder）
npm run build

# 仅构建 Windows
npm run build:win
```

---

## 项目结构

```
src/
├── main/           # Electron 主进程
├── renderer/
│   ├── core/       # 核心系统（EventBus, GameLoop, RNG）
│   ├── fishing/    # 钓鱼逻辑
│   ├── roguelike/  # Roguelike 系统
│   ├── rendering/  # Three.js 渲染
│   ├── locations/  # 12 个圣地场景
│   ├── data/       # 数据定义
│   ├── ui/         # UI 组件
│   ├── audio/      # 音频引擎
│   └── i18n/       # 国际化
└── shared/         # 共享类型和常量
```

### 关键架构概念

- **事件驱动**：组件间通过 [`EventBus`](src/renderer/core/EventBus.ts) 通信，不直接耦合
- **状态机**：钓鱼流程由 [`StateMachine`](src/renderer/core/StateMachine.ts) 驱动
- **Seeded RNG**：使用 mulberry32 算法，保证 Run 可复现
- **体素构建**：所有 3D 模型通过 [`VoxelBuilder`](src/renderer/rendering/VoxelBuilder.ts) 由 BoxGeometry 拼成

---

## 代码规范

### TypeScript

- 使用严格模式（`strict: true`）
- 优先使用 `interface` 而非 `type`（对象定义）
- 避免 `any`，必要时使用 `unknown`
- 导出使用命名导出，避免默认导出

### 格式化

项目使用 Prettier + ESLint：

```bash
# 检查格式
npm run format:check

# 自动格式化
npm run format

# 检查代码
npm run lint

# 自动修复
npm run lint:fix
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | PascalCase（类）/ camelCase（模块） | `EventBus.ts`, `fish-database.ts` |
| 类/接口 | PascalCase | `FishingSystem`, `FishData` |
| 函数/变量 | camelCase | `castLine()`, `fishCount` |
| 常量 | UPPER_SNAKE_CASE | `MAX_CAST_POWER` |
| 枚举 | PascalCase | `FishRarity.Common` |

---

## 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>: <description>

[optional body]
```

**类型（type）**：

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（空格、分号等） |
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `test` | 添加或修改测试 |
| `chore` | 构建、依赖、工具链 |
| `ci` | CI/CD 配置 |

**示例**：

```
feat: add Iceland Aurora location scene

fix: correct line tension calculation in ReelState

docs: update README with contribution guide

refactor: extract Bobber physics into separate module
```

---

## 测试

```bash
# 运行单元测试
npm test

# 运行冒烟测试（需要 Electron 构建产物）
npm run test:smoke

# 带界面运行冒烟测试
npm run test:smoke:headed

# 类型检查
npm run typecheck
```

### 添加新测试

- 单元测试放在 `tests/unit.spec.ts`
- 冒烟测试放在 `tests/smoke.spec.ts`
- 截图测试输出到 `tests/screenshots/`

---

## Pull Request 流程

1. **Fork & Branch**：从 `main` 分支创建特性分支
2. **开发**：编写代码，遵循代码规范
3. **测试**：确保 `npm test` 和 `npm run typecheck` 通过
4. **提交**：使用 Conventional Commits 格式
5. **PR 描述**：
   - 清晰描述变更内容
   - 关联相关 Issue（如有）
   - 附上截图（UI 变更时）
6. **Review**：等待维护者审核，处理反馈
7. **合并**：审核通过后由维护者合并

### PR 检查清单

- [ ] 代码通过 `npm run typecheck`
- [ ] 代码通过 `npm run lint`
- [ ] 测试通过 `npm test`
- [ ] 提交信息遵循 Conventional Commits
- [ ] 相关文档已更新
- [ ] 新功能有对应测试（如适用）

---

## 📄 许可

贡献的代码将基于 [MIT License](LICENSE) 发布。贡献即表示你同意此许可。
