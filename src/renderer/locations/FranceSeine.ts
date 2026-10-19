// ===== src/renderer/locations/FranceSeine.ts =====
// 🇫🇷 France — Autumn leaves on the Seine.
//
// v2 art pass: rust-brown Eiffel Tower landmark (right 2/3 line), Notre-Dame
// silhouette as an unlit back layer, a café terrace with tables/chairs and an
// awning, a green bouquiniste book stall with string lights as the foreground
// frame, plane trees in gold/orange, and a rain-free Seine quay.

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

export class FranceSeine extends BaseLocation {
  readonly id = 'france';
  private _waterfall: Waterfall | null = null;
  private _fields: DriftField[] = [];
  private _lights: FlickerLight[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'france')!;
  }

  protected buildGeometry(): void {
    const art = this.art;
    const theme = this.data.theme;
    const accent = art.accent ?? 0xc97a4a;
    const glowColor = art.glow ?? 0xffd8a0;
    const keyColor = art.key ?? 0xffc37a;
    const shadowColor = art.shadow ?? 0x40384a;
    const veil = art.veil ?? 0x3a2f3f;

    const p = {
      iron: mixHex(0x7a6a5a, accent, 0.35),
      ironDark: mixHex(0x5a504a, shadowColor, 0.2),
      stone: mixHex(0x9a8f7e, shadowColor, 0.2),
      stoneLight: mixHex(0xb8ab94, keyColor, 0.15),
      stoneDark: mixHex(0x766b5e, shadowColor, 0.3),
      cream: mixHex(0xded0bc, keyColor, 0.18),
      green: 0x2c4a3a,
      greenDark: 0x1e3328,
      blue: 0x2a3f5e,
      awningCream: mixHex(0xeae5da, keyColor, 0.1),
      wood: mixHex(0x6b4a32, shadowColor, 0.15),
      woodDark: 0x3d271d,
      warm: mixHex(glowColor, 0xfff2d0, 0.5),
      water: mixHex(theme?.waterColor ?? 0x4c6864, shadowColor, 0.28),
      waterLight: mixHex(theme?.waterColor ?? 0x4c6864, keyColor, 0.25),
      leafGold: mixHex(0xc4873b, keyColor, 0.2),
      leafOrange: mixHex(0xc45e2b, keyColor, 0.12),
      leafRed: mixHex(0xa0302a, accent, 0.2),
      trunk: 0x4a3428,
      silhouette: mixHex(0x3a3040, veil, 0.4),
      bookRed: 0xa04038,
      bookBlue: 0x2f5a7a,
      bookGold: 0xc8a24a,
      bookGreen: 0x3e6a4a,
    };

    const body: InstancedVoxel[] = [];
    const glow: InstancedVoxel[] = [];
    const ao: InstancedVoxel[] = [];
    const silhouette: InstancedVoxel[] = [];
    const rng = createRng(hashSeed('france:v2'));
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
        color: mixHex(shadowColor, 0x0e0a12, 0.4),
      });
    };

    // ── Landmark: rust-brown Eiffel Tower (right 2/3 line) ──
    const tx = 2.4;
    const tz = -3.4;
    const legs: [number, number][] = [
      [-0.85, -0.85],
      [0.85, -0.85],
      [-0.85, 0.85],
      [0.85, 0.85],
    ];
    legs.forEach(([lx, lz]) => {
      vox(body, tx + lx, tz + lz, 0, 0.62, 0.35, 0.62, p.stoneDark);
      vox(body, tx + lx, tz + lz, 0.35, 0.5, 1.65, 0.5, p.iron);
      vox(body, tx + lx * 0.62, tz + lz * 0.62, 1.65, 0.36, 1.5, 0.36, p.iron);
      vox(body, tx + lx * 0.95, tz + lz * 0.95, 0.9, 0.16, 0.85, 0.16, p.iron, 0);
    });
    // Truss rings between the legs at three heights.
    [0.8, 1.7, 2.5].forEach((y, i) => {
      const s = 2.1 - i * 0.45;
      vox(body, tx, tz, y, s, 0.14, 0.22, p.iron);
      vox(body, tx, tz, y, 0.22, 0.14, s, p.iron);
      vox(body, tx, tz, y + 0.22, s * 0.8, 0.1, 0.16, p.ironDark);
    });
    // First platform, upper shaft, second platform, spire.
    vox(body, tx, tz, 1.75, 2.4, 0.16, 2.4, p.ironDark);
    vox(body, tx - 0.42, tz - 0.42, 1.9, 0.32, 1.6, 0.32, p.iron);
    vox(body, tx + 0.42, tz - 0.42, 1.9, 0.32, 1.6, 0.32, p.iron);
    vox(body, tx - 0.42, tz + 0.42, 1.9, 0.32, 1.6, 0.32, p.iron);
    vox(body, tx + 0.42, tz + 0.42, 1.9, 0.32, 1.6, 0.32, p.iron);
    vox(body, tx, tz, 3.5, 1.3, 0.15, 1.3, p.ironDark);
    vox(body, tx, tz, 3.65, 0.7, 1.15, 0.7, p.iron);
    vox(body, tx, tz, 4.8, 0.5, 0.9, 0.5, p.iron);
    vox(body, tx, tz, 5.7, 0.3, 0.55, 0.3, p.ironDark);
    vox(body, tx, tz, 6.25, 0.16, 0.3, 0.16, p.ironDark);
    vox(glow, tx, tz, 6.55, 0.16, 0.22, 0.16, p.warm);
    // Warm uplights on the tower legs.
    vox(glow, tx - 0.85, tz + 0.86, 0.4, 0.26, 0.06, 0.1, mixHex(p.warm, p.iron, 0.3));
    vox(glow, tx + 0.85, tz + 0.86, 0.4, 0.26, 0.06, 0.1, mixHex(p.warm, p.iron, 0.3));
    aoPatch(tx, tz, 3.4, 3.4);

    // ── Back layer: Notre-Dame silhouette (unlit, low contrast) ──
    const nx = -3.2;
    const nz = -4.6;
    vox(silhouette, nx, nz, 0, 2.9, 1.9, 0.5, p.silhouette);
    vox(silhouette, nx, nz, 1.9, 3.3, 0.24, 0.6, p.silhouette);
    vox(silhouette, nx - 1.0, nz + 0.05, 1.9, 0.7, 1.0, 0.5, p.silhouette);
    vox(silhouette, nx + 1.0, nz + 0.05, 1.9, 0.7, 1.0, 0.5, p.silhouette);
    vox(silhouette, nx - 1.0, nz + 0.05, 2.9, 0.8, 0.18, 0.6, p.silhouette);
    vox(silhouette, nx + 1.0, nz + 0.05, 2.9, 0.8, 0.18, 0.6, p.silhouette);
    vox(silhouette, nx, nz + 0.05, 2.14, 0.26, 1.5, 0.26, p.silhouette);
    vox(silhouette, nx, nz + 0.2, 3.64, 0.16, 0.5, 0.16, p.silhouette);
    vox(silhouette, nx, nz + 0.31, 1.3, 0.6, 0.6, 0.04, mixHex(p.silhouette, glowColor, 0.25));

    // ── Café terrace with awning, warm windows and bistro sets ──
    const cx = -3.6;
    const cz = 0.6;
    vox(body, cx, cz, 0, 2.5, 2.3, 1.9, p.cream);
    vox(body, cx, cz, 2.3, 2.7, 0.18, 2.1, p.woodDark);
    vox(glow, cx - 0.6, cz + 0.96, 1.0, 0.7, 0.9, 0.05, p.warm);
    vox(glow, cx + 0.6, cz + 0.96, 1.0, 0.5, 0.9, 0.05, p.warm);
    vox(body, cx - 0.6, cz + 0.98, 1.95, 0.85, 0.1, 0.1, p.greenDark);
    vox(body, cx + 0.6, cz + 0.98, 1.95, 0.65, 0.1, 0.1, p.greenDark);
    // Striped awning sloping over the terrace.
    for (let i = 0; i < 7; i++) {
      const color = i % 2 === 0 ? p.greenDark : p.awningCream;
      vox(body, cx - 1.5 + i * 0.5, cz + 1.35, 2.1 + i * 0.02, 0.55, 0.07, 1.1, color);
    }
    // Bistro tables + chairs (three sets).
    [
      [cx + 1.55, cz + 1.15, 0.2],
      [cx + 2.2, cz + 2.0, -0.3],
      [cx + 0.8, cz + 2.2, 0.5],
    ].forEach(([sx, sz, rot]) => {
      vox(body, sx, sz, 0.3, 0.62, 0.06, 0.62, p.wood, rot);
      vox(body, sx, sz, 0, 0.1, 0.3, 0.1, p.greenDark, rot);
      vox(body, sx + 0.5, sz, 0.15, 0.34, 0.05, 0.34, p.woodDark, rot);
      vox(body, sx + 0.5, sz, 0.2, 0.34, 0.3, 0.05, p.green, rot);
      vox(body, sx - 0.5, sz, 0.15, 0.34, 0.05, 0.34, p.woodDark, rot);
      vox(body, sx - 0.5, sz, 0.2, 0.34, 0.3, 0.05, p.green, rot);
    });
    aoPatch(cx, cz, 4.6, 3.6);

    // ── Plane trees: gold / orange / red canopies ──
    const tree = (mx: number, mz: number, s: number, leaf: number): void => {
      vox(body, mx, mz, 0, 0.3, 2.6 * s, 0.3, p.trunk);
      vox(body, mx, mz, 1.2 * s, 0.15, 1.0 * s, 0.15, p.trunk, 0.4);
      vox(body, mx, mz, 1.6 * s, 1.9 * s, 0.85 * s, 1.8 * s, leaf);
      vox(
        body,
        mx + 0.5 * s,
        mz + 0.3 * s,
        1.95 * s,
        1.3 * s,
        0.7 * s,
        1.2 * s,
        mixHex(leaf, keyColor, 0.25),
      );
      vox(body, mx - 0.5 * s, mz - 0.3 * s, 2.1 * s, 1.1 * s, 0.6 * s, 1.1 * s, shade(leaf, 0.85));
      vox(
        body,
        mx + 0.15 * s,
        mz - 0.2 * s,
        2.45 * s,
        1.0 * s,
        0.55 * s,
        1.0 * s,
        mixHex(leaf, keyColor, 0.4),
      );
      for (let i = 0; i < 6; i++) {
        const a = rng.nextFloat(0, Math.PI * 2);
        const r = rng.nextFloat(0.7, 1.4) * s;
        vox(
          body,
          mx + Math.cos(a) * r,
          mz + Math.sin(a) * r,
          1.7 * s + rng.nextFloat(-0.2, 0.6) * s,
          0.2,
          0.03,
          0.14,
          rng.chance(0.5) ? leaf : p.leafGold,
          rng.nextFloat(0, Math.PI),
        );
      }
      for (let i = 0; i < 8; i++) {
        const a = rng.nextFloat(0, Math.PI * 2);
        const r = rng.nextFloat(0.2, 1.4) * s;
        vox(
          body,
          mx + Math.cos(a) * r,
          mz + Math.sin(a) * r,
          0,
          0.18,
          0.02,
          0.13,
          rng.chance(0.5) ? p.leafGold : p.leafOrange,
          rng.nextFloat(0, Math.PI),
        );
      }
      aoPatch(mx, mz, 2.8 * s, 2.6 * s);
    };
    tree(-4.35, -1.4, 1.1, p.leafGold);
    tree(0.9, -4.8, 0.95, p.leafOrange);
    tree(4.45, -0.6, 1.0, p.leafRed);
    tree(-4.4, 2.4, 0.85, p.leafOrange);

    // ── Parisian lamp posts ──
    const lamp = (lx: number, lz: number): void => {
      vox(body, lx, lz, 0, 0.32, 0.3, 0.32, p.greenDark);
      vox(body, lx, lz, 0.3, 0.14, 3.1, 0.14, p.green);
      vox(body, lx, lz, 3.35, 0.8, 0.1, 0.14, p.green);
      vox(glow, lx - 0.3, lz, 3.1, 0.3, 0.32, 0.3, p.warm);
      vox(glow, lx + 0.3, lz, 3.1, 0.3, 0.32, 0.3, p.warm);
      vox(body, lx - 0.3, lz, 3.44, 0.4, 0.08, 0.4, p.greenDark);
      vox(body, lx + 0.3, lz, 3.44, 0.4, 0.08, 0.4, p.greenDark);
      aoPatch(lx, lz, 0.8, 0.8);
    };
    lamp(0.3, 0.9);
    lamp(4.0, -1.9);

    // ── Foreground frame: green bouquiniste book stall with string lights ──
    const bx = 4.35;
    const bz = 1.65;
    vox(body, bx, bz, 0, 1.7, 0.12, 0.75, p.greenDark, 0.18);
    vox(body, bx, bz, 0.12, 1.7, 0.55, 0.2, p.green, 0.18);
    vox(body, bx, bz, 0.65, 1.75, 0.6, 0.42, p.greenDark, 0.18);
    for (let i = 0; i < 4; i++) {
      const bookColors = [p.bookRed, p.bookBlue, p.bookGold, p.bookGreen];
      vox(body, bx - 0.55 + i * 0.37, bz, 0.7, 0.3, 0.34, 0.1, bookColors[i], 0.18);
      vox(body, bx - 0.55 + i * 0.37, bz, 1.08, 0.28, 0.3, 0.1, bookColors[(i + 2) % 4], 0.18);
    }
    // String of warm lamps over the stall.
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      vox(
        body,
        bx - 1.1 + t * 2.2,
        bz + 0.25,
        1.55 + Math.sin(t * Math.PI) * 0.12,
        0.06,
        0.06,
        0.06,
        p.woodDark,
        0.18,
      );
      if (i % 2 === 1)
        vox(glow, bx - 1.1 + t * 2.2, bz + 0.25, 1.35, 0.16, 0.16, 0.16, p.warm, 0.18);
    }
    vox(body, bx - 1.15, bz + 0.2, 0, 0.12, 1.7, 0.12, p.woodDark);
    vox(body, bx + 1.15, bz + 0.2, 0, 0.12, 1.7, 0.12, p.woodDark);
    aoPatch(bx, bz, 2.8, 1.6);

    // ── Quay path + scatter ──
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      vox(
        body,
        2.1 - t * 2.6,
        0.9 + t * 1.3,
        0,
        0.6,
        0.06,
        0.5,
        i % 2 ? p.stone : p.stoneLight,
        0.2,
      );
    }
    for (let i = 0; i < 34; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(2.5, 5.5);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      const kind = rng.next();
      if (kind < 0.45) {
        vox(
          body,
          x,
          z,
          0,
          0.16,
          0.02,
          0.13,
          rng.chance(0.5) ? p.leafGold : p.leafOrange,
          rng.nextFloat(0, Math.PI),
        );
      } else if (kind < 0.75) {
        const s = rng.nextFloat(0.14, 0.28);
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
        vox(body, x, z, 0, 0.07, rng.nextFloat(0.2, 0.45), 0.07, p.green, rng.nextFloat(-0.3, 0.3));
      }
    }

    this.group.add(buildInstancedVoxels(body, { castShadow: true, receiveShadow: true }));
    this.group.add(
      buildInstancedVoxels(glow, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );
    this.group.add(
      buildInstancedVoxels(ao, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );
    this.group.add(
      buildInstancedVoxels(silhouette, {
        castShadow: false,
        receiveShadow: false,
        shading: 'basic',
      }),
    );

    this._waterfall = new Waterfall({
      radius: 6.62,
      innerRadius: 6.2,
      yBase: -0.15,
      heightMin: 2.2,
      heightMax: 3.1,
      color: mixHex(theme?.waterColor ?? 0x4c6864, keyColor, 0.35),
      opacity: 0.55,
      density: 0.72,
    });
    this.group.add(this._waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glowColor = art.glow ?? 0xffd8a0;
    const keyColor = art.key ?? 0xffc37a;

    this._fields.push(
      new DriftField(this.group, {
        count: 52,
        mode: 'fall',
        colors: [0xc4873b, 0xc45e2b, 0xa0302a],
        cx: 0,
        cz: 0,
        areaX: 11,
        areaZ: 11,
        yMin: 0.3,
        yMax: 7.0,
        size: [0.18, 0.03, 0.14],
        speedMin: 0.08,
        speedMax: 0.18,
        sway: 0.5,
        spin: [1.2, 0.7, 1.8],
        opacity: 0.92,
        additive: false,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 18,
        mode: 'rise',
        colors: [glowColor, 0xffe8b8],
        cx: -2.0,
        cz: 1.8,
        areaX: 3.6,
        areaZ: 2.4,
        yMin: 1.2,
        yMax: 2.8,
        size: [0.06, 0.06, 0.06],
        speedMin: 0.08,
        speedMax: 0.18,
        sway: 0.25,
        spin: [0, 1.2, 0],
        opacity: 0.85,
        additive: true,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 20,
        mode: 'float',
        colors: [0xffd8a0, 0xfff0c8],
        cx: 0,
        cz: 3.4,
        areaX: 10,
        areaZ: 5,
        yMin: 0.1,
        yMax: 0.8,
        size: [0.14, 0.02, 0.06],
        speedMin: 0.2,
        speedMax: 0.45,
        sway: 0.2,
        spin: [0, 0.8, 0],
        opacity: 0.5,
        additive: true,
      }),
    );

    const shafts = buildLightShaft({
      color: keyColor,
      height: 7,
      width: 2.2,
      opacity: 0.055,
      count: 2,
      seed: hashSeed('france:shaft'),
    });
    shafts.position.set(0.5, SURFACE + 1.0, -2.4);
    this.group.add(shafts);

    this.group.add(
      buildGlowOrb({
        color: glowColor,
        size: 0.42,
        position: new THREE.Vector3(2.4, SURFACE + 6.5, -3.4),
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
      this._lights.push({ light, base, speed, phase: this._lights.length * 1.5, amp });
    };
    addLight(glowColor, -2.2, SURFACE + 2.4, 1.4, 1.8, 7.0, 1.2, 0.16);
    addLight(glowColor, 0.3, SURFACE + 3.1, 0.9, 1.5, 6.5, 0.9, 0.12);
    addLight(0xffb066, 2.4, SURFACE + 3.4, -3.0, 1.2, 6.0, 1.6, 0.2);
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
