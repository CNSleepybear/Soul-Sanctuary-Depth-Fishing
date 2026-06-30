# SoulSanctuary Voxel Style Guide

> **Last updated**: 2026-06-03
> **Reference**: Original [`index.html`](../index.html) `buildJapan()` — `buildGreece()`

## 核心原则

**This is a voxel diorama.** 所有物体必须用 `BoxGeometry` 拼成，禁止光滑曲面。参考 Minecraft / 体素微缩景观。

---

## 1. 材质模式

```typescript
// 每个 build 函数开头定义材质对象，统一管理
const m = {
  island:   new THREE.MeshLambertMaterial({ color: 0x1a233a, flatShading: true }),
  grass:    new THREE.MeshLambertMaterial({ color: 0x223e4a, flatShading: true }),
  torii:    new THREE.MeshLambertMaterial({ color: 0x8f2d34, flatShading: true }),
  // 发光材质用 MeshBasicMaterial（不受光照影响）
  core:     new THREE.MeshBasicMaterial({ color: 0xffdf6d }),
};
```

规则:
- 外层物体用 `MeshLambertMaterial` + `flatShading: true`
- 发光/自发光物体（窗户、灯芯）用 `MeshBasicMaterial`
- 所有材质放在 `m` 对象中

## 2. 构建工具函数

```typescript
// 每个 build 函数内部定义
const createBox = (w: number, h: number, d: number, mat: THREE.Material,
                   x: number, y: number, z: number, cast = false) => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  box.position.set(x, y, z);
  if (cast) box.castShadow = true;
  return box;
};
```

## 3. 层级结构

```typescript
// 复杂物体用嵌套 THREE.Group
const torii = new THREE.Group();
torii.add(createBox(...));
torii.add(createBox(...));
torii.position.set(0, 0.4, -2);
this.group.add(torii);
```

## 4. 粒子系统

```typescript
// 粒子数组 + userData 类型标记
private _particles: THREE.Object3D[] = [];

// 生成
const petalGeo = new THREE.BoxGeometry(0.15, 0.05, 0.15);
for (let i = 0; i < 35; i++) {
  const p = new THREE.Mesh(petalGeo, m.leaves);
  p.position.set(Math.random() * 10 - 5, Math.random() * 6 + 0.4, Math.random() * 10 - 5);
  p.userData = {
    type: 'fall',           // 粒子类型（决定 update 逻辑）
    speedY: 0.02 + Math.random() * 0.02,
    speedX: 0.01 + Math.random() * 0.02,
    rotSpeed: Math.random() * 0.02,
    groundY: 0.4,           // 落地重置高度
  };
  this.group.add(p);
  this._particles.push(p);
}

// Update: 按 userData.type 分支处理
// 支持类型: fall, firefly, dust, rain, fall_spin, snow, rise, smoke,
//           aurora, krathong, drift, float
```

## 5. 灯光系统

```typescript
// 方向光（月光/阳光）
const moonDir = new THREE.DirectionalLight(0x718fce, 1.2);
moonDir.position.set(5, 15, 5);
moonDir.castShadow = true;
moonDir.shadow.mapSize.width = 256;
this.scene.add(moonDir);

// 点光源（灯笼/窗户） + 闪烁
const lanternPoint = new THREE.PointLight(0xffaa33, 2, 8);
lanternPoint.position.set(-2.5, 1.75, 2.5);
lanternPoint.castShadow = true;
this.group.add(lanternPoint);
this._flickerLights.push({
  light: lanternPoint,
  base: 2.0,    // 基础强度
  speed: 8,     // 闪烁频率
  amp: 0.2,     // 闪烁幅度
});

// Update:
for (const fl of this._flickerLights) {
  fl.light.intensity = fl.base + Math.sin(time * fl.speed) * fl.amp;
}
```

## 6. 屋顶模式（阶梯金字塔）

```typescript
// 多层 Box 逐级缩小堆叠
const roofLayers = [
  { w: 3.2, h: 0.25, d: 3.0, y: 3.0 },
  { w: 2.6, h: 0.3,  d: 2.8, y: 3.25 },
  { w: 1.8, h: 0.3,  d: 2.8, y: 3.55 },
  { w: 1.0, h: 0.3,  d: 2.8, y: 3.85 },
  { w: 0.3, h: 0.4,  d: 2.8, y: 4.15 },
];
roofLayers.forEach((l) => house.add(createBox(l.w, l.h, l.d, roofMat, 0, l.y, 0, true)));
```

## 7. 禁止事项

- ❌ `CylinderGeometry` / `SphereGeometry` / `ConeGeometry` 等光滑几何体
- ❌ ShaderMaterial / 自定义 Shader
- ❌ 透明渐变 / 边缘羽化 / 玻璃材质
- ❌ 真实感纹理 / PBR 材质
- ❌ 圆形水面（用方形 Box 平台代替）
- ❌ `PointsMaterial` / `AdditiveBlending` 粒子

## 8. 允许的例外

- ✅ `CircleGeometry` 仅用于底部阴影碟（`depthWrite: false`, `opacity < 0.1`）
- ✅ `TorusGeometry` 仅用于水面高光环（原始未有，但可接受）
- ✅ 少数 `CylinderGeometry` 仅用于树干（低分段 6-8，flatShading）

## 9. 窗口配置

```typescript
// Electron BrowserWindow — 透明悬浮窗
{
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  hasShadow: false,
  thickFrame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  width: 800, height: 600,
}

// Three.js Renderer
{
  alpha: true,
  antialias: false,        // 体素不需要抗锯齿
}
renderer.setClearColor(0x000000, 0);
scene.background = null;   // 不设背景
```

## 10. CSS

```css
html, body { background: transparent !important; }
canvas { display: block; background: transparent; }
```
