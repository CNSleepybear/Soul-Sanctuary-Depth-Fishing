// ===== src/renderer/locations/ChinaBamboo.ts =====
// 🇨🇳 China — Bamboo grove & firefly pond.
//
// v2 art pass: hexagonal ting pavilion landmark (right 2/3 line), moon-gate wall,
// stone bridge over a koi pond, clustered bamboo with ground mist, a firefly
// pond, foreground reeds/rocks/lantern. Static set merged into instanced
// batches; atmosphere = fireflies + bamboo mist + falling bamboo leaves.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { Waterfall } from '../rendering/Waterfall';
import { LOCATIONS } from '../data/location-data';
import type { LocationData } from '../../shared/types';
import {
  buildGlowOrb,
  buildInstancedVoxels,
  buildLightShaft,
  createRng,
  hashSeed,
  mixHex,
  shade,
  type InstancedVoxel,
} from '../rendering/ArtKit';

const SURFACE = 1.5;
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

type DriftMode = 'fall' | 'rise' | 'float';

interface DriftConfig {
  count: number;
  mode: DriftMode;
  colors: number[];
  cx: number;
  cz: number;
  areaX: number;
  areaZ: number;
  yMin: number;
  yMax: number;
  size: [number, number, number];
  speedMin: number;
  speedMax: number;
  sway: number;
  spin: [number, number, number];
  opacity: number;
  additive: boolean;
}

class DriftField {
  readonly mesh: THREE.InstancedMesh;
  private readonly c: DriftConfig;
  private readonly bx: Float32Array;
  private readonly bz: Float32Array;
  private readonly ph: Float32Array;
  private readonly sp: Float32Array;
  private readonly off: Float32Array;

  constructor(parent: THREE.Group, cfg: DriftConfig) {
    this.c = cfg;
    const rng = createRng(hashSeed(`drift:${cfg.mode}:${cfg.colors[0]}`));
    this.bx = new Float32Array(cfg.count);
    this.bz = new Float32Array(cfg.count);
    this.ph = new Float32Array(cfg.count);
    this.sp = new Float32Array(cfg.count);
    this.off = new Float32Array(cfg.count);
    const material = cfg.additive
      ? new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: cfg.opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      : new THREE.MeshLambertMaterial({
          color: 0xffffff,
          flatShading: true,
          transparent: true,
          opacity: cfg.opacity,
          depthWrite: false,
        });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, cfg.count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    for (let i = 0; i < cfg.count; i++) {
      this.bx[i] = cfg.cx + (rng.next() - 0.5) * cfg.areaX;
      this.bz[i] = cfg.cz + (rng.next() - 0.5) * cfg.areaZ;
      this.ph[i] = rng.next() * Math.PI * 2;
      this.sp[i] = rng.nextFloat(cfg.speedMin, cfg.speedMax);
      this.off[i] = rng.next();
      _color.setHex(cfg.colors[rng.nextInt(0, cfg.colors.length - 1)]);
      this.mesh.setColorAt(i, _color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    parent.add(this.mesh);
    this.update(0);
  }

  update(time: number): void {
    const cfg = this.c;
    const span = cfg.yMax - cfg.yMin;
    for (let i = 0; i < cfg.count; i++) {
      const phase = this.ph[i];
      const speed = this.sp[i];
      let x = this.bx[i] + Math.sin(time * (0.5 + speed) + phase) * cfg.sway;
      let z = this.bz[i] + Math.cos(time * (0.4 + speed) + phase) * cfg.sway * 0.7;
      let y: number;
      if (cfg.mode === 'fall') {
        y = cfg.yMax - ((time * speed + this.off[i]) % 1) * span;
      } else if (cfg.mode === 'rise') {
        y = cfg.yMin + ((time * speed + this.off[i]) % 1) * span;
      } else {
        y = cfg.yMin + this.off[i] * span + Math.sin(time * speed + phase) * cfg.sway * 0.8;
      }
      _pos.set(x, y, z);
      _euler.set(
        time * cfg.spin[0] + phase,
        time * cfg.spin[1] + phase,
        time * cfg.spin[2] + phase,
      );
      _quat.setFromEuler(_euler);
      _scale.set(cfg.size[0], cfg.size[1], cfg.size[2]);
      _matrix.compose(_pos, _quat, _scale);
      this.mesh.setMatrixAt(i, _matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface FlickerLight {
  light: THREE.PointLight;
  base: number;
  speed: number;
  phase: number;
  amp: number;
}

export class ChinaBamboo extends BaseLocation {
  readonly id = 'china';
  private _waterfall: Waterfall | null = null;
  private _fields: DriftField[] = [];
  private _lights: FlickerLight[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'china')!;
  }

  protected buildGeometry(): void {
    const art = this.art;
    const theme = this.data.theme;
    const accent = art.accent ?? 0xd9c28a;
    const glowColor = art.glow ?? 0xd8ff8a;
    const keyColor = art.key ?? 0x9fd3c7;
    const shadowColor = art.shadow ?? 0x2c3a44;
    const grass = theme?.island.grass ?? 0x6f9a72;

    const p = {
      bamboo: mixHex(0x7a9a5c, keyColor, 0.12),
      bambooLight: mixHex(0x94b06a, keyColor, 0.2),
      bambooDark: shade(0x5c7a46, 0.9),
      wood: mixHex(0x5a4030, keyColor, 0.1),
      woodDark: 0x3e2d22,
      roof: mixHex(0x3a3a40, shadowColor, 0.3),
      roofDark: 0x2c2c33,
      gold: accent,
      stone: mixHex(0x7c8a82, shadowColor, 0.25),
      stoneLight: mixHex(0xa8b2a6, keyColor, 0.2),
      stoneDark: mixHex(0x5c6a64, shadowColor, 0.3),
      water: mixHex(theme?.waterColor ?? 0x385e5b, shadowColor, 0.3),
      waterLight: mixHex(theme?.waterColor ?? 0x385e5b, keyColor, 0.22),
      koiOrange: 0xe8703a,
      koiWhite: 0xf5f0e8,
      moss: mixHex(grass, 0xd8c88c, 0.24),
      mossDark: shade(grass, 0.8),
      glow: glowColor,
      paper: mixHex(glowColor, 0xffeec0, 0.65),
    };

    const body: InstancedVoxel[] = [];
    const glow: InstancedVoxel[] = [];
    const ao: InstancedVoxel[] = [];
    const rng = createRng(hashSeed('china:v2'));
    const vox = (
      list: InstancedVoxel[],
      x: number,
      z: number,
      y: number,
      w: number,
      h: number,
      d: number,
      color: number,
      rotY = 0,
    ): void => {
      list.push({ x, y: SURFACE + y + h / 2, z, w, h, d, color, rotY });
    };
    const aoPatch = (x: number, z: number, w: number, d: number): void => {
      ao.push({
        x,
        y: SURFACE + 0.015,
        z,
        w,
        h: 0.02,
        d,
        color: mixHex(shadowColor, 0x0e1018, 0.4),
      });
    };

    // ── Landmark: hexagonal ting pavilion (right 2/3 line) ──
    const px = 2.6;
    const pz = -3.0;
    vox(body, px, pz, 0, 3.1, 0.24, 3.1, p.stone);
    vox(body, px, pz, 0.24, 2.6, 0.2, 2.6, p.stoneLight);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const cx = px + Math.cos(a) * 1.35;
      const cz = pz + Math.sin(a) * 1.35;
      vox(body, cx, cz, 0.44, 0.16, 2.1, 0.16, p.woodDark, a);
      vox(body, cx, cz, 0.44, 0.34, 0.14, 0.34, p.stoneDark, a);
      // railing between columns
      if (i % 2 === 0) {
        vox(
          body,
          px + Math.cos(a) * 1.1,
          pz + Math.sin(a) * 1.1,
          0.9,
          0.7,
          0.08,
          0.1,
          p.wood,
          a + Math.PI / 2,
        );
      }
    }
    // glowing lattice screens
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6 + Math.PI / 6;
      const cx = px + Math.cos(a) * 1.16;
      const cz = pz + Math.sin(a) * 1.16;
      vox(glow, cx, cz, 0.95, 0.85, 1.2, 0.06, i % 2 ? p.paper : mixHex(p.paper, p.gold, 0.4), a);
    }
    // three tiered eaves + gold finial
    vox(body, px, pz, 2.5, 3.1, 0.2, 3.1, p.roof, 0.26);
    vox(body, px, pz, 2.7, 2.6, 0.18, 2.6, p.roofDark, 0.26);
    vox(body, px, pz, 3.0, 2.2, 0.18, 2.2, p.roof, 0.42);
    vox(body, px, pz, 3.18, 1.7, 0.16, 1.7, p.roofDark, 0.42);
    vox(body, px, pz, 3.42, 1.15, 0.16, 1.15, p.roof, 0.55);
    vox(body, px, pz, 3.58, 0.6, 0.2, 0.6, p.roofDark, 0.55);
    vox(body, px, pz, 3.78, 0.22, 0.42, 0.22, p.gold);
    vox(glow, px, pz, 3.9, 0.14, 0.14, 0.14, p.gold);
    aoPatch(px, pz, 3.4, 3.4);

    // ── Moon gate in a low courtyard wall ──
    const mx = -3.7;
    const mz = -1.0;
    for (let gx = -1.5; gx <= 1.5; gx += 0.25) {
      for (let gy = 0; gy <= 2.4; gy += 0.25) {
        if (gx * gx + gy * gy < 0.72) continue;
        vox(
          body,
          mx + gx,
          mz,
          gy,
          0.26,
          0.26,
          0.34,
          (Math.round(gx * 4) + Math.round(gy * 4)) % 2 ? p.stoneLight : p.stone,
        );
      }
    }
    vox(body, mx, mz, 2.62, 3.3, 0.18, 0.5, p.roofDark);
    vox(body, mx, mz, 2.8, 3.7, 0.14, 0.62, p.roof);
    aoPatch(mx, mz, 3.6, 0.8);

    // ── Koi pond + stone bridge ──
    const kx = -0.9;
    const kz = 1.3;
    for (let gx = -2.9; gx <= 1.1; gx += 0.5) {
      for (let gz = -0.3; gz <= 2.9; gz += 0.5) {
        const dx = (gx - kx) / 1.95;
        const dz = (gz - kz) / 1.5;
        if (dx * dx + dz * dz > 0.94) continue;
        vox(glow, gx, gz, 0.02, 0.5, 0.06, 0.5, rng.chance(0.45) ? p.waterLight : p.water);
      }
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      vox(
        body,
        kx + Math.cos(a) * 2.12,
        kz + Math.sin(a) * 1.66,
        0,
        rng.nextFloat(0.4, 0.6),
        rng.nextFloat(0.18, 0.3),
        rng.nextFloat(0.38, 0.54),
        rng.chance(0.3) ? p.mossDark : p.stone,
        rng.nextFloat(-0.3, 0.3),
      );
    }
    const bridgeA = kx - 1.9;
    const bridgeB = kx + 1.9;
    const bridgeSegs = 8;
    for (let i = 0; i <= bridgeSegs; i++) {
      const t = i / bridgeSegs;
      const bx = bridgeA + (bridgeB - bridgeA) * t;
      const by = 0.16 + Math.sin(t * Math.PI) * 0.32;
      vox(body, bx, kz, by, 0.52, 0.12, 0.95, i % 2 ? p.stone : p.stoneLight);
      if (i > 0 && i < bridgeSegs) {
        vox(body, bx, kz + 0.42, by + 0.12, 0.08, 0.42, 0.08, p.stoneDark);
        vox(body, bx, kz - 0.42, by + 0.12, 0.08, 0.42, 0.08, p.stoneDark);
        vox(body, bx, kz + 0.42, by + 0.54, 0.5, 0.07, 0.08, p.stoneDark);
        vox(body, bx, kz - 0.42, by + 0.54, 0.5, 0.07, 0.08, p.stoneDark);
      }
    }
    // Static koi silhouettes under the surface.
    [
      [-1.5, 1.0, p.koiOrange],
      [-0.2, 1.8, p.koiWhite],
      [0.3, 0.8, p.koiOrange],
    ].forEach(([fx, fz, color]) => {
      vox(glow, fx, fz, 0.06, 0.34, 0.06, 0.14, color, rng.nextFloat(0, Math.PI));
    });
    aoPatch(kx, kz, 4.8, 3.6);

    // ── Bamboo grove: clustered stalks with node joints and leaf fans ──
    const bamboo = (bx: number, bz: number, s: number): void => {
      const stalks = 3 + rng.nextInt(0, 2);
      for (let st = 0; st < stalks; st++) {
        const a = rng.nextFloat(0, Math.PI * 2);
        const r = rng.nextFloat(0.05, 0.4);
        const sx = bx + Math.cos(a) * r;
        const sz = bz + Math.sin(a) * r;
        const h = rng.nextFloat(2.3, 3.5) * s;
        const segs = Math.max(3, Math.round(h / 0.62));
        for (let i = 0; i < segs; i++) {
          const sh = h / segs;
          vox(body, sx, sz, i * sh, 0.16, sh * 0.9, 0.16, i % 2 ? p.bamboo : p.bambooLight);
          vox(body, sx, sz, i * sh, 0.2, 0.05, 0.2, p.bambooDark);
        }
        for (let i = 0; i < 4; i++) {
          const la = rng.nextFloat(0, Math.PI * 2);
          vox(
            body,
            sx + Math.cos(la) * rng.nextFloat(0.15, 0.5),
            sz + Math.sin(la) * rng.nextFloat(0.15, 0.5),
            h - rng.nextFloat(0.1, 0.6),
            rng.nextFloat(0.3, 0.6),
            0.07,
            rng.nextFloat(0.3, 0.6),
            i % 2 ? p.bambooLight : p.bamboo,
            la,
          );
        }
      }
      aoPatch(bx, bz, 1.6 * s, 1.6 * s);
    };
    bamboo(-4.3, -3.1, 1.1);
    bamboo(-1.8, -4.4, 1);
    bamboo(4.15, -1.6, 0.95);
    bamboo(-4.35, 1.6, 0.9);
    bamboo(3.9, 0.6, 0.75);

    // ── Stone lanterns ──
    const lantern = (lx: number, lz: number, s: number): void => {
      vox(body, lx, lz, 0, 0.6 * s, 0.18 * s, 0.6 * s, p.stoneDark);
      vox(body, lx, lz, 0.18 * s, 0.26 * s, 0.8 * s, 0.26 * s, p.stone);
      vox(body, lx, lz, 0.98 * s, 0.56 * s, 0.13 * s, 0.56 * s, p.stoneLight);
      vox(glow, lx, lz, 1.11 * s, 0.32 * s, 0.34 * s, 0.32 * s, p.paper);
      vox(body, lx, lz, 1.45 * s, 0.72 * s, 0.15 * s, 0.72 * s, p.stone);
      vox(body, lx, lz, 1.6 * s, 0.4 * s, 0.12 * s, 0.4 * s, p.stoneLight);
      vox(body, lx, lz, 1.72 * s, 0.14 * s, 0.16 * s, 0.14 * s, p.stone);
      aoPatch(lx, lz, 1.0 * s, 1.0 * s);
    };
    lantern(-3.6, 0.9, 1);
    lantern(1.4, 3.6, 1);
    lantern(4.85, 1.55, 1.05);

    // ── Foreground frame: reeds, rocks, bench at the right edge ──
    for (let i = 0; i < 14; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(0.2, 1.1);
      const h = rng.nextFloat(0.5, 1.4);
      vox(
        body,
        4.5 + Math.cos(a) * r,
        2.35 + Math.sin(a) * r,
        0,
        0.07,
        h,
        0.07,
        i % 3 === 0 ? p.mossDark : p.moss,
        rng.nextFloat(-0.35, 0.35),
      );
      if (i % 4 === 0)
        vox(body, 4.5 + Math.cos(a) * r, 2.35 + Math.sin(a) * r, h, 0.12, 0.18, 0.12, p.gold);
    }
    for (let i = 0; i < 4; i++) {
      const s = rng.nextFloat(0.4, 0.75);
      vox(
        body,
        4.9 + rng.nextFloat(-0.4, 0.4),
        1.0 + rng.nextFloat(-0.3, 0.3),
        0,
        s,
        s * 0.7,
        s * 0.9,
        i % 2 ? p.stone : p.stoneDark,
        rng.nextFloat(-0.4, 0.4),
      );
    }
    vox(body, 4.0, 2.9, 0.32, 1.1, 0.1, 0.36, p.wood);
    vox(body, 3.7, 2.9, 0, 0.1, 0.32, 0.1, p.woodDark);
    vox(body, 4.3, 2.9, 0, 0.1, 0.32, 0.1, p.woodDark);
    aoPatch(4.4, 2.2, 2.4, 2.0);

    // ── Shore scatter ──
    for (let i = 0; i < 52; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(2.4, 5.6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      const kind = rng.next();
      if (kind < 0.55) {
        const h = rng.nextFloat(0.2, 0.46);
        vox(
          body,
          x,
          z,
          0,
          0.06,
          h,
          0.06,
          rng.chance(0.35) ? p.mossDark : p.moss,
          rng.nextFloat(-0.4, 0.4),
        );
      } else if (kind < 0.85) {
        const s = rng.nextFloat(0.12, 0.28);
        vox(
          body,
          x,
          z,
          0,
          s,
          s * 0.6,
          s * 0.8,
          rng.chance(0.5) ? p.stone : p.stoneDark,
          rng.nextFloat(0, Math.PI),
        );
      } else {
        vox(glow, x, z, 0.03, 0.12, 0.04, 0.12, p.glow);
      }
    }
    // Lily pads.
    for (let i = 0; i < 5; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      vox(
        body,
        kx + Math.cos(a) * rng.nextFloat(0.3, 1.4),
        kz + Math.sin(a) * rng.nextFloat(0.2, 1.0),
        0.05,
        rng.nextFloat(0.28, 0.46),
        0.04,
        rng.nextFloat(0.24, 0.38),
        p.mossDark,
      );
    }

    this.group.add(buildInstancedVoxels(body, { castShadow: true, receiveShadow: true }));
    this.group.add(
      buildInstancedVoxels(glow, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );
    this.group.add(
      buildInstancedVoxels(ao, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );

    // ── Rim waterfall (v2) ──
    this._waterfall = new Waterfall({
      radius: 6.6,
      innerRadius: 6.18,
      yBase: -0.15,
      heightMin: 2.2,
      heightMax: 3.0,
      color: mixHex(theme?.waterColor ?? 0x385e5b, keyColor, 0.4),
      opacity: 0.55,
      density: 0.72,
    });
    this.group.add(this._waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glowColor = art.glow ?? 0xd8ff8a;
    const keyColor = art.key ?? 0x9fd3c7;

    this._fields.push(
      new DriftField(this.group, {
        count: 30,
        mode: 'float',
        colors: [glowColor, 0xf2ffb0, 0xb6ff9a],
        cx: -0.9,
        cz: 1.0,
        areaX: 9,
        areaZ: 9,
        yMin: 1.6,
        yMax: 4.4,
        size: [0.08, 0.08, 0.08],
        speedMin: 0.25,
        speedMax: 0.6,
        sway: 0.75,
        spin: [0, 0.7, 0],
        opacity: 0.9,
        additive: true,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 20,
        mode: 'float',
        colors: [0x9fb8ac, 0xc4d4c8],
        cx: 0,
        cz: -1.5,
        areaX: 11,
        areaZ: 9,
        yMin: 0.6,
        yMax: 2.4,
        size: [1.6, 0.1, 1.0],
        speedMin: 0.04,
        speedMax: 0.1,
        sway: 0.4,
        spin: [0, 0.02, 0],
        opacity: 0.16,
        additive: false,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 26,
        mode: 'fall',
        colors: [0x94b06a, 0x7a9a5c],
        cx: 0,
        cz: 0,
        areaX: 11,
        areaZ: 11,
        yMin: 0.3,
        yMax: 6.4,
        size: [0.18, 0.02, 0.1],
        speedMin: 0.06,
        speedMax: 0.14,
        sway: 0.5,
        spin: [1.2, 0.8, 1.6],
        opacity: 0.9,
        additive: false,
      }),
    );

    const shafts = buildLightShaft({
      color: keyColor,
      height: 7,
      width: 2.2,
      opacity: 0.05,
      count: 2,
      seed: hashSeed('china:shaft'),
    });
    shafts.position.set(0, SURFACE + 0.4, 0);
    this.group.add(shafts);

    this.group.add(
      buildGlowOrb({
        color: glowColor,
        size: 0.36,
        position: new THREE.Vector3(2.6, SURFACE + 2.1, -2.7),
      }),
    );

    const addLight = (
      color: number,
      x: number,
      y: number,
      z: number,
      base: number,
      distance: number,
      speed: number,
      amp: number,
    ): void => {
      const light = new THREE.PointLight(color, base, distance);
      light.position.set(x, y, z);
      this.group.add(light);
      this._lights.push({ light, base, speed, phase: this._lights.length * 1.9, amp });
    };
    addLight(0xffcf7a, 2.6, SURFACE + 2.0, -2.6, 1.7, 6.5, 1.5, 0.16);
    addLight(glowColor, 0.2, SURFACE + 2.2, 1.2, 1.1, 6.0, 0.9, 0.2);
    addLight(0x7fd8e8, -0.9, SURFACE + 0.7, 1.3, 1.0, 5.0, 0.7, 0.1);
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    this._waterfall?.update(time);
    for (const field of this._fields) field.update(time);
    for (const entry of this._lights) {
      entry.light.intensity = entry.base + Math.sin(time * entry.speed + entry.phase) * entry.amp;
    }
  }

  update(dt: number, time: number): void {
    super.update(dt, time);
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._fields = [];
    this._lights = [];
    super.destroy();
  }
}
