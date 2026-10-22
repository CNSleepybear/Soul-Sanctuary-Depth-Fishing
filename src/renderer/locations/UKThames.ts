// ===== src/renderer/locations/UKThames.ts =====
// 🇬🇧 UK — Rainy Thames dock.
//
// v2 art pass: Elizabeth-tower clock landmark (right 2/3 line), second clock
// tower + brick warehouse with warm windows, red phone box and post box, a
// rain-slick quay with puddle reflections, and an umbrella / bollard foreground
// frame. Atmosphere = rain + river mist + splash pulses.

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

export class UKThames extends BaseLocation {
  readonly id = 'uk';
  private _waterfall: Waterfall | null = null;
  private _fields: DriftField[] = [];
  private _lights: FlickerLight[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'uk')!;
  }

  protected buildGeometry(): void {
    const art = this.art;
    const theme = this.data.theme;
    const red = art.accent ?? 0xc0392b;
    const glowColor = art.glow ?? 0xffaa44;
    const keyColor = art.key ?? 0xffc98a;
    const shadowColor = art.shadow ?? 0x2a3340;

    const p = {
      brick: mixHex(0x6b4436, shadowColor, 0.18),
      brickDark: mixHex(0x4e3128, shadowColor, 0.3),
      brickLight: mixHex(0x8a5a44, keyColor, 0.12),
      stone: mixHex(0x7d8890, shadowColor, 0.25),
      stoneLight: mixHex(0xa4aca8, keyColor, 0.15),
      iron: 0x22242a,
      ironDark: 0x16181d,
      red,
      redDark: shade(red, 0.66),
      warm: mixHex(glowColor, 0xfff2d0, 0.5),
      glass: mixHex(0x5a7080, shadowColor, 0.2),
      wood: mixHex(0x5a4436, shadowColor, 0.2),
      woodDark: 0x3a2c24,
      water: mixHex(theme?.waterColor ?? 0x455a64, shadowColor, 0.3),
      waterLight: mixHex(theme?.waterColor ?? 0x455a64, keyColor, 0.2),
      puddle: mixHex(0x3a4c5a, keyColor, 0.1),
      pigeon: 0x6a6a72,
    };

    const body: InstancedVoxel[] = [];
    const glow: InstancedVoxel[] = [];
    const ao: InstancedVoxel[] = [];
    const rng = createRng(hashSeed('uk:v2'));
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
        y: SURFACE + 0.012,
        z,
        w,
        h: 0.02,
        d,
        color: mixHex(shadowColor, 0x0a0e12, 0.45),
      });
    };

    // ── Rain-slick quay: wet cobbles + puddles with warm reflections ──
    for (let gx = -4.5; gx <= 4.5; gx += 1.5) {
      for (let gz = -4.5; gz <= 4.5; gz += 1.5) {
        if (Math.hypot(gx, gz) > 5.4) continue;
        const wet = rng.chance(0.35);
        vox(
          body,
          gx,
          gz,
          0,
          1.5,
          0.05,
          1.5,
          wet ? p.brickDark : p.stone,
          rng.nextFloat(-0.05, 0.05),
        );
      }
    }
    for (let i = 0; i < 10; i++) {
      const x = rng.nextFloat(-4.4, 4.4);
      const z = rng.nextFloat(-4.2, 4.2);
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      vox(
        glow,
        x,
        z,
        0.06,
        rng.nextFloat(0.7, 1.5),
        0.02,
        rng.nextFloat(0.5, 1.1),
        p.puddle,
        rng.nextFloat(-0.2, 0.2),
      );
      if (i % 2 === 0) {
        vox(glow, x, z, 0.08, 0.3, 0.02, rng.nextFloat(0.4, 0.9), mixHex(glowColor, p.water, 0.4));
      }
    }

    // ── Landmark: Elizabeth clock tower (right 2/3 line) ──
    const tx = 2.6;
    const tz = -3.2;
    vox(body, tx, tz, 0, 1.3, 0.7, 1.3, p.stone);
    vox(body, tx, tz, 0.7, 1.0, 1.4, 1.0, p.brick);
    vox(body, tx, tz, 2.1, 0.92, 1.5, 0.92, p.brickLight);
    // vertical stone ribs
    vox(body, tx - 0.48, tz, 2.1, 0.1, 1.5, 1.0, p.stoneLight);
    vox(body, tx + 0.48, tz, 2.1, 0.1, 1.5, 1.0, p.stoneLight);
    // clock stage
    vox(body, tx, tz, 3.6, 1.15, 0.95, 1.15, p.stoneLight);
    vox(glow, tx, tz + 0.59, 3.78, 0.56, 0.56, 0.06, p.warm);
    vox(glow, tx + 0.59, tz, 3.78, 0.06, 0.56, 0.56, p.warm);
    vox(body, tx, tz + 0.6, 4.06, 0.07, 0.3, 0.04, p.ironDark);
    vox(body, tx + 0.6, tz, 4.06, 0.04, 0.3, 0.07, p.ironDark);
    // spire tiers + gold tip
    vox(body, tx, tz, 4.55, 1.05, 0.22, 1.05, p.stone);
    vox(body, tx, tz, 4.77, 0.78, 0.3, 0.78, p.stoneLight);
    vox(body, tx, tz, 5.07, 0.52, 0.42, 0.52, p.iron);
    vox(body, tx, tz, 5.49, 0.26, 0.5, 0.26, p.ironDark);
    vox(glow, tx, tz, 5.99, 0.12, 0.18, 0.12, p.warm);
    aoPatch(tx, tz, 1.8, 1.8);

    // ── Secondary: second clock tower + brick warehouse ──
    const sx = -3.4;
    const sz = -2.9;
    vox(body, sx, sz, 0, 0.9, 3.2, 0.9, p.brick);
    vox(body, sx, sz, 3.2, 0.75, 0.75, 0.75, p.brickLight);
    vox(glow, sx, sz + 0.39, 3.44, 0.3, 0.3, 0.05, p.warm);
    vox(body, sx, sz, 3.95, 0.5, 0.35, 0.5, p.iron);
    vox(body, sx, sz, 4.3, 0.25, 0.45, 0.25, p.ironDark);
    aoPatch(sx, sz, 1.4, 1.4);
    const wx = -3.7;
    const wz = 1.0;
    vox(body, wx, wz, 0, 2.2, 2.4, 1.8, p.brick);
    vox(body, wx, wz, 2.4, 2.4, 0.18, 2.0, p.brickDark);
    for (let i = 0; i < 3; i++) {
      vox(glow, wx - 0.6 + i * 0.6, wz + 0.92, 1.2, 0.34, 0.5, 0.05, p.warm);
      vox(body, wx - 0.6 + i * 0.6, wz + 0.94, 1.74, 0.44, 0.06, 0.08, p.stoneLight);
    }
    vox(body, wx + 0.1, wz - 0.95, 0.2, 0.9, 0.7, 0.12, p.woodDark);
    aoPatch(wx, wz, 2.6, 2.3);

    // Red phone box + post box.
    const bx = -2.0;
    const bz = -0.4;
    vox(body, bx, bz, 0, 0.72, 1.5, 0.72, p.red);
    vox(glow, bx, bz + 0.37, 0.45, 0.46, 0.86, 0.05, p.warm);
    vox(body, bx, bz, 1.5, 0.8, 0.12, 0.8, p.redDark);
    vox(body, bx, bz, 1.62, 0.4, 0.1, 0.4, p.red);
    vox(glow, bx, bz, 1.62, 0.22, 0.06, 0.22, p.warm);
    aoPatch(bx, bz, 1.2, 1.2);
    const px = -1.15;
    const pz = 0.25;
    vox(body, px, pz, 0, 0.42, 0.95, 0.42, p.red);
    vox(body, px, pz, 0.95, 0.5, 0.1, 0.5, p.redDark);
    vox(glow, px, pz + 0.22, 0.62, 0.2, 0.05, 0.04, p.ironDark);
    aoPatch(px, pz, 0.8, 0.8);

    // Victorian twin-head lamp posts.
    const lamp = (lx: number, lz: number): void => {
      vox(body, lx, lz, 0, 0.4, 0.3, 0.4, p.ironDark);
      vox(body, lx, lz, 0.3, 0.16, 3.0, 0.16, p.iron);
      vox(body, lx, lz, 3.3, 1.3, 0.1, 0.16, p.iron);
      vox(glow, lx - 0.55, lz, 3.12, 0.3, 0.3, 0.3, p.warm);
      vox(glow, lx + 0.55, lz, 3.12, 0.3, 0.3, 0.3, p.warm);
      vox(body, lx - 0.55, lz, 3.4, 0.42, 0.1, 0.42, p.ironDark);
      vox(body, lx + 0.55, lz, 3.4, 0.42, 0.1, 0.42, p.ironDark);
      aoPatch(lx, lz, 0.9, 0.9);
    };
    lamp(0.5, 0.3);
    lamp(4.0, -0.9);

    // ── Foreground frame: quay railing, umbrella, bollards ──
    for (let i = 0; i < 4; i++) {
      vox(body, 3.9 + i * 0.42, 2.6 - i * 0.05, 0, 0.12, 0.9, 0.12, p.ironDark, -0.1 * i);
    }
    vox(body, 4.5, 2.45, 0.72, 1.75, 0.08, 0.08, p.iron, -0.05);
    // Umbrella: pole + two canopy tiers.
    const ux = 4.55;
    const uz = 1.35;
    vox(body, ux, uz, 0, 0.1, 1.75, 0.1, p.ironDark);
    vox(body, ux, uz, 1.7, 1.25, 0.12, 1.25, p.ironDark);
    vox(body, ux, uz, 1.82, 0.85, 0.12, 0.85, p.iron, 0.4);
    vox(body, ux, uz, 1.94, 0.4, 0.14, 0.4, p.ironDark);
    vox(glow, ux, uz, 1.6, 0.9, 0.05, 0.9, mixHex(glowColor, 0xfff2d0, 0.5));
    aoPatch(ux, uz, 1.5, 1.5);
    for (let i = 0; i < 3; i++) {
      vox(body, 5.0 - i * 0.55, -0.2 + i * 0.9, 0, 0.22, 0.45, 0.22, p.ironDark);
    }
    // Pigeons (tiny, static).
    vox(body, 1.0, 1.4, 0.05, 0.2, 0.14, 0.24, p.pigeon, 0.4);
    vox(body, 1.08, 1.48, 0.19, 0.1, 0.1, 0.1, p.stoneLight, 0.4);
    vox(body, 1.6, 0.9, 0.05, 0.18, 0.12, 0.22, p.pigeon, -0.3);

    // ── Shore scatter ──
    for (let i = 0; i < 30; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(2.6, 5.5);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      const s = rng.nextFloat(0.14, 0.3);
      vox(
        body,
        x,
        z,
        0,
        s,
        s * 0.6,
        s * 0.85,
        rng.chance(0.5) ? p.stone : p.brickDark,
        rng.nextFloat(0, Math.PI),
      );
    }

    this.group.add(buildInstancedVoxels(body, { castShadow: true, receiveShadow: true }));
    this.group.add(
      buildInstancedVoxels(glow, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );
    this.group.add(
      buildInstancedVoxels(ao, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );

    this._waterfall = new Waterfall({
      radius: 6.64,
      innerRadius: 6.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(theme?.waterColor ?? 0x455a64, keyColor, 0.3),
      opacity: 0.5,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glowColor = art.glow ?? 0xffaa44;
    const keyColor = art.key ?? 0xffc98a;

    this._fields.push(
      new DriftField(this.group, {
        count: 70,
        mode: 'fall',
        colors: [0x8fa8c0, 0xb8c8d8],
        cx: 0,
        cz: 0,
        areaX: 11,
        areaZ: 11,
        yMin: 0.2,
        yMax: 7.4,
        size: [0.04, 0.5, 0.04],
        speedMin: 0.45,
        speedMax: 0.85,
        sway: 0.04,
        spin: [0, 0, 0],
        opacity: 0.5,
        additive: false,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 18,
        mode: 'float',
        colors: [0x8fa0b0, 0xb8c4c8],
        cx: 0,
        cz: 1.2,
        areaX: 11,
        areaZ: 9,
        yMin: 0.3,
        yMax: 1.8,
        size: [1.8, 0.12, 1.1],
        speedMin: 0.04,
        speedMax: 0.1,
        sway: 0.5,
        spin: [0, 0.02, 0],
        opacity: 0.15,
        additive: false,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 24,
        mode: 'rise',
        colors: [0x9fc4e0, 0xd8e8f0],
        cx: 0,
        cz: 2.5,
        areaX: 10,
        areaZ: 7,
        yMin: 0.1,
        yMax: 1.4,
        size: [0.06, 0.12, 0.06],
        speedMin: 0.12,
        speedMax: 0.25,
        sway: 0.18,
        spin: [0, 0, 0],
        opacity: 0.5,
        additive: true,
      }),
    );

    const shafts = buildLightShaft({
      color: keyColor,
      height: 7,
      width: 2.0,
      opacity: 0.05,
      count: 2,
      seed: hashSeed('uk:shaft'),
    });
    shafts.position.set(1.0, SURFACE + 0.6, -2.2);
    this.group.add(shafts);

    this.group.add(
      buildGlowOrb({
        color: glowColor,
        size: 0.4,
        position: new THREE.Vector3(2.6, SURFACE + 5.3, -3.2),
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
      this._lights.push({ light, base, speed, phase: this._lights.length * 1.6, amp });
    };
    addLight(glowColor, 0.5, SURFACE + 3.1, 0.3, 1.9, 7.0, 1.1, 0.18);
    addLight(0xfff0d0, 2.6, SURFACE + 3.9, -2.6, 1.3, 6.0, 0.8, 0.08);
    addLight(0xff7a5a, -1.6, SURFACE + 1.2, 0.0, 1.0, 5.0, 1.5, 0.16);
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
