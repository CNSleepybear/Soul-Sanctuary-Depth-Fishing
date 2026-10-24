// ===== src/renderer/locations/USACyberpunk.ts =====
// 🇺🇸 USA — Cyberpunk neon alley.
//
// v2 art pass: neon pylon landmark (right 2/3 line), two tall canyon walls that
// frame the fisherman and the landmark, a reflective asphalt grid floor with
// cyan / magenta / orange neon, overhead cables, a server rack row and a
// vending-machine foreground. Atmosphere = data rain + ground fog + neon dust.

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

export class USACyberpunk extends BaseLocation {
  readonly id = 'usa';
  private _waterfall: Waterfall | null = null;
  private _fields: DriftField[] = [];
  private _lights: FlickerLight[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'usa')!;
  }

  protected buildGeometry(): void {
    const art = this.art;
    const magenta = art.accent ?? 0xff3fbf;
    const cyan = art.glow ?? 0x59f0ff;
    const orange = 0xff8a3d;
    const keyColor = art.key ?? 0xd67bff;
    const shadowColor = art.shadow ?? 0x1a1230;

    const p = {
      asphalt: mixHex(0x23262e, shadowColor, 0.3),
      asphaltLight: mixHex(0x2e3240, keyColor, 0.1),
      wall: mixHex(0x2a2238, shadowColor, 0.3),
      wallDark: shade(0x1e1a2a, 0.9),
      trim: 0x3a3450,
      metal: 0x4a4a62,
      magenta,
      cyan,
      orange,
      magentaDim: mixHex(magenta, shadowColor, 0.55),
      cyanDim: mixHex(cyan, shadowColor, 0.5),
      orangeDim: mixHex(orange, shadowColor, 0.5),
      signBack: 0x171320,
    };

    const body: InstancedVoxel[] = [];
    const glow: InstancedVoxel[] = [];
    const ao: InstancedVoxel[] = [];
    const rng = createRng(hashSeed('usa:v2'));
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
        color: mixHex(shadowColor, 0x05040a, 0.5),
      });
    };

    // ── Wet asphalt: restrained seams, gutters and broken sign reflections ──
    for (let gx = -4.5; gx <= 4.5; gx += 1.5) {
      for (let gz = -4.5; gz <= 4.5; gz += 1.5) {
        if (Math.hypot(gx, gz) > 5.4) continue;
        vox(body, gx, gz, 0, 1.47, 0.06, 1.47, rng.chance(0.3) ? p.asphaltLight : p.asphalt);
      }
    }
    for (const side of [-1, 1]) {
      vox(body, side * 4.15, -0.3, 0.06, 0.22, 0.14, 7.2, p.trim);
      for (let i = 0; i < 7; i++) {
        vox(body, side * 3.93, -3.0 + i * 0.9, 0.07, 0.3, 0.035, 0.08, p.metal);
      }
    }
    const reflections: [number, number, number][] = [
      [2.8, -1.25, p.magentaDim],
      [1.65, -0.55, p.cyanDim],
      [-2.75, 0.75, p.cyanDim],
      [0.4, -2.75, p.orangeDim],
      [3.75, 0.65, p.magentaDim],
    ];
    reflections.forEach(([x, z, color], ri) => {
      vox(glow, x, z + 0.65, 0.065, 0.72, 0.018, 2.15, mixHex(p.asphalt, color, 0.28));
      for (let j = 0; j < 4; j++) {
        const width = 0.18 + ((ri + j) % 3) * 0.11;
        vox(
          glow,
          x + (j % 2 ? 0.12 : -0.08),
          z + j * 0.43,
          0.086,
          width,
          0.015,
          0.25 + (j % 2) * 0.18,
          color,
        );
      }
    });

    // ── Landmark: neon data pylon (right 2/3 line) ──
    const tx = 2.8;
    const tz = -2.8;
    vox(body, tx, tz, 0, 2.2, 0.5, 2.2, p.wallDark);
    vox(body, tx, tz, 0.5, 1.7, 1.2, 1.7, p.wall);
    vox(glow, tx, tz - 0.87, 0.62, 1.5, 0.08, 0.06, p.magenta);
    vox(glow, tx, tz - 0.87, 1.3, 1.5, 0.08, 0.06, p.cyan);
    vox(body, tx, tz, 1.7, 1.25, 1.1, 1.25, p.wall);
    vox(glow, tx - 0.64, tz, 1.86, 0.06, 0.1, 1.0, p.cyan);
    vox(glow, tx + 0.64, tz, 2.4, 0.06, 0.1, 1.0, p.magenta);
    vox(body, tx, tz, 2.8, 0.9, 1.0, 0.9, p.wall);
    vox(glow, tx, tz - 0.46, 3.0, 0.8, 0.1, 0.06, p.orange);
    // A dark sign cabinet with neon tubing and geometric glyphs, rather than a solid light panel.
    vox(body, tx, tz - 0.5, 1.94, 1.08, 0.78, 0.14, p.signBack);
    vox(glow, tx, tz - 0.59, 1.98, 0.96, 0.055, 0.045, p.magenta);
    vox(glow, tx, tz - 0.59, 2.62, 0.96, 0.055, 0.045, p.magenta);
    for (const side of [-1, 1])
      vox(glow, tx + side * 0.46, tz - 0.59, 2.02, 0.055, 0.62, 0.045, p.cyan);
    for (let i = 0; i < 3; i++) {
      const gx = tx - 0.25 + i * 0.25;
      vox(glow, gx, tz - 0.62, 2.18, 0.06, 0.3 - i * 0.05, 0.035, i === 1 ? p.orange : p.magenta);
      vox(glow, gx + 0.07, tz - 0.62, 2.36 - i * 0.08, 0.18, 0.05, 0.035, p.magenta);
    }
    vox(body, tx, tz, 3.8, 0.5, 0.9, 0.5, p.trim);
    vox(body, tx, tz, 4.7, 0.32, 0.12, 0.32, p.metal);
    vox(glow, tx, tz, 4.82, 0.14, 0.35, 0.14, p.cyan);
    vox(glow, tx, tz, 5.17, 0.1, 0.1, 0.1, p.magenta);
    aoPatch(tx, tz, 2.8, 2.8);

    // ── Layered alley facades: floor bands, recessed windows, AC and fire escapes ──
    for (let i = 0; i < 6; i++) {
      const wx = -4.7 + i * 0.42;
      const wz = 1.95 + i * 0.1;
      const h = 3.8 + (i % 2) * 0.5;
      vox(body, wx, wz, 0, 0.46, h, 0.55, i % 2 ? p.wall : p.wallDark, -0.3);
      for (const y of [0.45, 2.0, 3.55]) vox(body, wx, wz + 0.04, y, 0.5, 0.1, 0.65, p.trim, -0.3);
      for (let floor = 0; floor < 3; floor++) {
        const wy = 0.85 + floor * 0.9;
        vox(body, wx, wz + 0.3, wy, 0.27, 0.55, 0.07, p.signBack, -0.3);
        vox(
          glow,
          wx,
          wz + 0.345,
          wy + 0.06,
          0.17,
          0.38,
          0.035,
          (i + floor) % 3 ? p.cyanDim : p.magentaDim,
          -0.3,
        );
        vox(body, wx, wz + 0.38, wy + 0.05, 0.035, 0.4, 0.035, p.metal, -0.3);
      }
      if (i % 2 === 0) {
        vox(body, wx, wz + 0.47, 0.52, 0.34, 0.28, 0.32, p.metal, -0.3);
        vox(body, wx, wz + 0.64, 0.58, 0.24, 0.06, 0.035, p.wallDark, -0.3);
      } else {
        vox(body, wx, wz + 0.52, 1.92, 0.52, 0.08, 0.64, p.metal, -0.3);
        vox(body, wx, wz + 0.8, 2.0, 0.5, 0.35, 0.045, p.metal, -0.3);
      }
    }
    for (let i = 0; i < 7; i++) {
      const wx = 2.0 + i * 0.42;
      const wz = -4.5 - i * 0.12;
      const h = 4.4 + (i % 3) * 0.5;
      vox(body, wx, wz, 0, 0.5, h, 0.6, i % 2 ? p.wall : p.wallDark, 0.28);
      for (const y of [0.5, 2.15, 3.9]) vox(body, wx, wz + 0.04, y, 0.54, 0.11, 0.7, p.trim, 0.28);
      for (let floor = 0; floor < 4; floor++) {
        const wy = 0.9 + floor * 0.82;
        vox(body, wx, wz + 0.32, wy, 0.34, 0.48, 0.07, p.signBack, 0.28);
        vox(
          glow,
          wx,
          wz + 0.365,
          wy + 0.05,
          0.23,
          0.33,
          0.035,
          (i + floor) % 3 === 0 ? p.orangeDim : floor % 2 ? p.magentaDim : p.cyanDim,
          0.28,
        );
        vox(body, wx, wz + 0.4, wy + 0.2, 0.36, 0.045, 0.04, p.metal, 0.28);
      }
      if (i === 1 || i === 5) vox(body, wx + 0.18, wz + 0.43, 0.2, 0.08, 3.8, 0.08, p.metal);
    }
    aoPatch(-3.9, 2.0, 2.6, 1.6);
    aoPatch(3.3, -4.4, 2.8, 1.6);

    // Dark overhead cables keep the neon signs as the brightest linework.
    for (const cableZ of [0.6, -1.2, -2.8]) {
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const sag = Math.sin(t * Math.PI) * 0.5;
        vox(body, -3.6 + t * 6.2, cableZ + t * 0.4, 3.4 - sag, 1.05, 0.035, 0.035, p.wallDark);
      }
    }

    // ── Secondary: server racks alongside the left wall ──
    [
      [-3.8, -1.4],
      [-3.6, 0.1],
      [-3.4, 1.4],
    ].forEach(([rx, rz], ri) => {
      vox(body, rx, rz, 0, 0.9, 2.2, 0.7, p.wallDark, -0.2);
      for (let i = 0; i < 5; i++) {
        vox(
          glow,
          rx + 0.46,
          rz,
          0.4 + i * 0.38,
          0.05,
          0.1,
          0.5,
          (i + ri) % 3 === 0 ? p.orangeDim : p.cyanDim,
          -0.2,
        );
      }
      vox(glow, rx - 0.46, rz, 1.6, 0.05, 0.5, 0.5, p.magentaDim, -0.2);
      aoPatch(rx, rz, 1.4, 1.1);
    });

    // Recessed shutter shop, ribbed awning and a small projecting neon sign.
    vox(body, 0.4, -4.7, 0, 2.4, 2.6, 0.7, p.wallDark);
    vox(body, 0.4, -4.31, 0.18, 1.5, 1.45, 0.1, p.metal);
    for (let i = 0; i < 7; i++)
      vox(body, 0.4, -4.24, 0.28 + i * 0.18, 1.42, 0.055, 0.045, p.wallDark);
    vox(body, 0.4, -4.25, 1.78, 1.95, 0.18, 0.62, p.orangeDim);
    vox(glow, 0.4, -4.24, 1.98, 1.75, 0.22, 0.08, p.orange);
    for (let i = 0; i < 5; i++)
      vox(body, -0.32 + i * 0.36, -4.17, 1.82, 0.07, 0.12, 0.5, p.signBack);
    vox(body, -1.1, -4.35, 1.35, 0.68, 0.86, 0.12, p.signBack);
    vox(glow, -1.1, -4.27, 1.43, 0.5, 0.055, 0.04, p.cyan);
    vox(glow, -1.1, -4.27, 1.86, 0.5, 0.055, 0.04, p.cyan);
    vox(glow, -1.28, -4.27, 1.49, 0.055, 0.38, 0.04, p.magenta);

    // ── Foreground frame: vending machine + cable bundle at the right edge ──
    const vx = 4.75;
    const vz = 1.5;
    vox(body, vx, vz, 0, 1.05, 1.95, 0.8, p.wall, 0.25);
    vox(glow, vx - 0.1, vz + 0.42, 0.35, 0.75, 1.15, 0.05, p.cyanDim, 0.25);
    vox(glow, vx - 0.1, vz + 0.42, 1.6, 0.75, 0.18, 0.05, p.magenta, 0.25);
    vox(glow, vx + 0.3, vz + 0.38, 0.3, 0.2, 0.9, 0.05, p.orangeDim, 0.25);
    aoPatch(vx, vz, 1.6, 1.3);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      vox(
        glow,
        4.0 + t * 0.7,
        2.6 - t * 0.4,
        0.05,
        0.2,
        0.06,
        0.2,
        i % 2 ? p.cyanDim : p.magentaDim,
      );
    }
    vox(body, 4.2, 2.75, 0, 0.22, 0.5, 0.22, p.metal);
    vox(glow, 4.2, 2.75, 0.5, 0.16, 0.14, 0.16, p.orange);

    // ── Street scatter: vents, hatch lights, cables on the ground ──
    for (let i = 0; i < 26; i++) {
      const x = rng.nextFloat(-4.2, 4.2);
      const z = rng.nextFloat(-3.4, 3.4);
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      const kind = rng.next();
      if (kind < 0.4) {
        vox(body, x, z, 0.05, 0.5, 0.06, 0.5, p.metal, rng.nextFloat(-0.4, 0.4));
        vox(glow, x, z, 0.11, 0.3, 0.02, 0.08, rng.chance(0.5) ? p.cyanDim : p.magentaDim);
      } else if (kind < 0.7) {
        vox(glow, x, z, 0.1, 0.12, 0.04, 0.12, rng.chance(0.5) ? p.cyan : p.magenta);
      } else {
        vox(
          body,
          x,
          z,
          0.05,
          rng.nextFloat(0.2, 0.5),
          0.08,
          rng.nextFloat(0.2, 0.4),
          p.asphaltLight,
          rng.nextFloat(0, Math.PI),
        );
      }
    }

    this.group.add(buildInstancedVoxels(body, { castShadow: true, receiveShadow: true }));
    this.group.add(
      buildInstancedVoxels(glow, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );
    this.group.add(
      buildInstancedVoxels(ao, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );

    this._waterfall = new Waterfall({
      radius: 6.62,
      innerRadius: 6.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(0x2a3a4a, cyan, 0.45),
      opacity: 0.5,
      density: 0.65,
    });
    this.group.add(this._waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const magenta = art.accent ?? 0xff3fbf;
    const cyan = art.glow ?? 0x59f0ff;
    const orange = 0xff8a3d;

    this._fields.push(
      new DriftField(this.group, {
        count: 56,
        mode: 'fall',
        colors: [cyan, magenta, orange],
        cx: 0,
        cz: 0,
        areaX: 10,
        areaZ: 10,
        yMin: 0.2,
        yMax: 7.2,
        size: [0.06, 0.5, 0.06],
        speedMin: 0.32,
        speedMax: 0.6,
        sway: 0.05,
        spin: [0, 0, 0],
        opacity: 0.85,
        additive: true,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 20,
        mode: 'float',
        colors: [magenta, 0x8a3fc0],
        cx: 0,
        cz: 0.4,
        areaX: 9.5,
        areaZ: 8,
        yMin: 0.2,
        yMax: 1.1,
        size: [1.2, 0.12, 0.8],
        speedMin: 0.04,
        speedMax: 0.12,
        sway: 0.5,
        spin: [0, 0.02, 0],
        opacity: 0.12,
        additive: true,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 22,
        mode: 'rise',
        colors: [cyan, 0x9ffcff],
        cx: 1.2,
        cz: -1.6,
        areaX: 6,
        areaZ: 6,
        yMin: 1.0,
        yMax: 3.6,
        size: [0.07, 0.07, 0.07],
        speedMin: 0.08,
        speedMax: 0.2,
        sway: 0.3,
        spin: [0, 1.5, 0],
        opacity: 0.85,
        additive: true,
      }),
    );

    const shafts = buildLightShaft({
      color: cyan,
      height: 8,
      width: 1.8,
      opacity: 0.05,
      count: 2,
      seed: hashSeed('usa:shaft'),
    });
    shafts.position.set(1.5, SURFACE + 1.2, -2.5);
    this.group.add(shafts);

    this.group.add(
      buildGlowOrb({
        color: magenta,
        size: 0.5,
        position: new THREE.Vector3(2.8, SURFACE + 2.6, -3.3),
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
      this._lights.push({ light, base, speed, phase: this._lights.length * 1.3, amp });
    };
    addLight(magenta, 2.4, SURFACE + 2.6, -3.2, 2.0, 7.5, 2.2, 0.3);
    addLight(cyan, -2.6, SURFACE + 2.0, 0.4, 1.8, 7.0, 1.8, 0.25);
    addLight(orange, 0.4, SURFACE + 2.0, -4.3, 1.6, 6.0, 2.6, 0.35);
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
