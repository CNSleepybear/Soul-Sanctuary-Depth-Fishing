// ===== src/renderer/locations/KyotoJapan.ts =====
// 🇯🇵 Kyoto — Sakura shrine at dusk.
//
// v2 art pass (docs/art-direction-v2.md §2/§4/§5):
// - one landmark: vermilion torii gate on a stone stair, placed on the right
//   two-thirds line so the centre stays free for the fisherman and bobber;
// - secondary layer: koi pond with a taiko-bashi arch bridge, four cherry trees
//   in a grove, stone tōrō lanterns, a paper-lantern string;
// - foreground frame: shore rocks, reeds and a lantern at the right edge;
// - the whole static set is merged into four instanced batches (body / emissive
//   / fake-AO / animated koi), so the scene adds ~15 draw calls;
// - atmosphere: falling petals, floating fireflies and rising embers, plus the
//   shared rim waterfall (Waterfall v2, 5 draw calls).

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

// ── Reusable animated instanced particle field ─────────────────────────
// One InstancedMesh per visual type (1 draw call), matrices are rewritten
// analytically each frame so the motion never drifts or allocates.

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

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

class DriftField {
  readonly mesh: THREE.InstancedMesh;
  private readonly cfg: DriftConfig;
  private readonly baseX: Float32Array;
  private readonly baseZ: Float32Array;
  private readonly phase: Float32Array;
  private readonly speed: Float32Array;
  private readonly offset: Float32Array;

  constructor(parent: THREE.Group, cfg: DriftConfig) {
    this.cfg = cfg;
    const rng = createRng(hashSeed(`drift:${cfg.mode}:${cfg.colors[0]}`));
    this.baseX = new Float32Array(cfg.count);
    this.baseZ = new Float32Array(cfg.count);
    this.phase = new Float32Array(cfg.count);
    this.speed = new Float32Array(cfg.count);
    this.offset = new Float32Array(cfg.count);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
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
    this.mesh = new THREE.InstancedMesh(geometry, material, cfg.count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    for (let i = 0; i < cfg.count; i++) {
      this.baseX[i] = cfg.cx + (rng.next() - 0.5) * cfg.areaX;
      this.baseZ[i] = cfg.cz + (rng.next() - 0.5) * cfg.areaZ;
      this.phase[i] = rng.next() * Math.PI * 2;
      this.speed[i] = rng.nextFloat(cfg.speedMin, cfg.speedMax);
      this.offset[i] = rng.next();
      _color.setHex(cfg.colors[rng.nextInt(0, cfg.colors.length - 1)]);
      this.mesh.setColorAt(i, _color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    parent.add(this.mesh);
    this.update(0);
  }

  update(time: number): void {
    const cfg = this.cfg;
    const span = cfg.yMax - cfg.yMin;
    for (let i = 0; i < cfg.count; i++) {
      const phase = this.phase[i];
      const speed = this.speed[i];
      const sway = Math.sin(time * (0.5 + speed) + phase) * cfg.sway;
      let x = this.baseX[i] + sway;
      let z = this.baseZ[i] + Math.cos(time * (0.4 + speed) + phase) * cfg.sway * 0.7;
      let y: number;
      if (cfg.mode === 'fall') {
        y = cfg.yMax - ((time * speed + this.offset[i]) % 1) * span;
      } else if (cfg.mode === 'rise') {
        y = cfg.yMin + ((time * speed + this.offset[i]) % 1) * span;
      } else {
        x = this.baseX[i] + Math.sin(time * speed * 1.2 + phase) * cfg.sway;
        z = this.baseZ[i] + Math.cos(time * speed + phase) * cfg.sway;
        y = cfg.yMin + (this.offset[i] * span + Math.sin(time * speed + phase) * cfg.sway * 0.8);
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

export class KyotoJapan extends BaseLocation {
  readonly id = 'japan';
  private _waterfall: Waterfall | null = null;
  private _fields: DriftField[] = [];
  private _lights: FlickerLight[] = [];
  private _koiMesh: THREE.InstancedMesh | null = null;
  private _koi: {
    phase: number;
    speed: number;
    dir: number;
    rx: number;
    rz: number;
    alt: number;
  }[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'japan')!;
  }

  protected buildGeometry(): void {
    const art = this.art;
    const theme = this.data.theme;
    const accent = art.accent ?? 0xc4574f;
    const glowColor = art.glow ?? 0xffb45c;
    const shadowColor = art.shadow ?? 0x3d3f5c;
    const keyColor = art.key ?? 0xffd2a1;
    const grass = theme?.island.grass ?? 0x7f9a62;

    // Six-colour script, resolved into the local voxel palette.
    const p = {
      red: accent,
      redDark: shade(accent, 0.68),
      ink: mixHex(shadowColor, 0x241c26, 0.55),
      wood: mixHex(0x6b4a38, keyColor, 0.12),
      woodDark: 0x4a3226,
      stone: mixHex(0x8f9a94, shadowColor, 0.18),
      stoneLight: mixHex(0xa8b0a4, keyColor, 0.14),
      stoneDark: mixHex(0x6a7774, shadowColor, 0.3),
      water: mixHex(theme?.waterColor ?? 0x496f76, shadowColor, 0.28),
      waterLight: mixHex(theme?.waterColor ?? 0x496f76, keyColor, 0.3),
      koiOrange: 0xe8894a,
      koiWhite: 0xf2e8d8,
      koiGold: 0xd8a24a,
      sakura: mixHex(0xefbcc5, keyColor, 0.2),
      sakuraLight: mixHex(0xffdde4, keyColor, 0.25),
      sakuraDeep: mixHex(0xcf94a4, shadowColor, 0.18),
      trunk: 0x54402f,
      moss: mixHex(grass, 0xd8c88c, 0.3),
      mossDark: shade(grass, 0.82),
      glow: glowColor,
      paper: mixHex(glowColor, 0xfff2d0, 0.55),
      gold: mixHex(0xd9b06a, keyColor, 0.2),
    };

    const body: InstancedVoxel[] = [];
    const glow: InstancedVoxel[] = [];
    const ao: InstancedVoxel[] = [];
    const rng = createRng(hashSeed('japan:v2'));

    /** Voxel with its bottom on `y` above the island surface. */
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
    /** Flat fake-AO patch hugging the ground. */
    const aoPatch = (x: number, z: number, w: number, d: number): void => {
      ao.push({
        x,
        y: SURFACE + 0.015,
        z,
        w,
        h: 0.02,
        d,
        color: mixHex(shadowColor, 0x0e1018, 0.35),
      });
    };

    // ── Landmark: vermilion torii on a stone stair (right 2/3 line) ──
    const tx = 2.7;
    const tz = -3.2;
    vox(body, tx - 1.8, tz, 0, 0.85, 0.24, 0.85, p.stoneDark);
    vox(body, tx + 1.8, tz, 0, 0.85, 0.24, 0.85, p.stoneDark);
    vox(body, tx - 1.8, tz, 0.24, 0.44, 2.95, 0.44, p.red);
    vox(body, tx + 1.8, tz, 0.24, 0.44, 2.95, 0.44, p.red);
    vox(body, tx - 1.8, tz, 2.55, 0.56, 0.16, 0.56, p.redDark);
    vox(body, tx + 1.8, tz, 2.55, 0.56, 0.16, 0.56, p.redDark);
    // Nuki (lower tie beam) + gakuzuka strut + plaque.
    vox(body, tx, tz, 2.36, 4.5, 0.26, 0.38, p.red);
    vox(body, tx, tz, 2.62, 0.42, 0.56, 0.32, p.red);
    vox(body, tx, tz, 2.82, 0.68, 0.6, 0.22, p.ink);
    vox(glow, tx, tz, 2.9, 0.2, 0.36, 0.06, p.gold);
    // Shimaki + kasagi (top lintel), with upturned ends.
    vox(body, tx, tz, 3.16, 4.9, 0.2, 0.52, p.red);
    vox(body, tx, tz, 3.36, 5.3, 0.24, 0.66, p.ink);
    vox(body, tx - 2.62, tz, 3.56, 0.5, 0.2, 0.72, p.ink);
    vox(body, tx + 2.62, tz, 3.56, 0.5, 0.2, 0.72, p.ink);
    vox(body, tx - 1.8, tz, 2.71, 0.62, 0.14, 0.62, p.ink);
    vox(body, tx + 1.8, tz, 2.71, 0.62, 0.14, 0.62, p.ink);
    aoPatch(tx, tz, 5.0, 1.6);

    // Stone stair descending towards the pond.
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      vox(
        body,
        2.7 - t * 0.9,
        -2.25 + i * 0.52,
        0.5 - t * 0.44,
        1.5,
        0.16,
        0.54,
        i % 2 ? p.stone : p.stoneLight,
      );
    }
    // Stepping-stone path towards the bridge and the foreground.
    const path: [number, number][] = [
      [1.55, 1.5],
      [1.15, 1.05],
      [0.75, 0.85],
      [-3.25, 1.35],
      [-3.65, 2.0],
      [4.05, 1.65],
      [4.65, 2.15],
    ];
    path.forEach(([px, pz], i) => {
      vox(
        body,
        px + rng.nextFloat(-0.06, 0.06),
        pz,
        0,
        0.5,
        0.09,
        0.42,
        i % 2 ? p.stone : p.stoneLight,
        rng.nextFloat(-0.15, 0.15),
      );
    });

    // ── Koi pond with a taiko-bashi arch bridge ──
    const pondX = -1.2;
    const pondZ = 0.9;
    for (let gx = -3.4; gx <= 1.0; gx += 0.5) {
      for (let gz = -0.7; gz <= 2.5; gz += 0.5) {
        const dx = (gx - pondX) / 2.15;
        const dz = (gz - pondZ) / 1.45;
        if (dx * dx + dz * dz > 0.94) continue;
        vox(glow, gx, gz, 0.02, 0.5, 0.06, 0.5, rng.chance(0.4) ? p.waterLight : p.water);
      }
    }
    // Stone rim + moss so the pond reads as a shaped basin, not a puddle.
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const rx = pondX + Math.cos(a) * 2.35;
      const rz = pondZ + Math.sin(a) * 1.62;
      const h = rng.nextFloat(0.2, 0.34);
      vox(
        body,
        rx,
        rz,
        0,
        rng.nextFloat(0.42, 0.62),
        h,
        rng.nextFloat(0.4, 0.56),
        rng.chance(0.3) ? p.mossDark : p.stone,
        rng.nextFloat(-0.3, 0.3),
      );
      if (i % 3 === 0) {
        vox(body, rx * 0.97, rz * 0.97, h, 0.36, 0.1, 0.3, p.moss);
      }
    }
    aoPatch(pondX, pondZ, 5.4, 4.2);

    // Arch bridge: deck follows a sine arch, vermilion railings on both sides.
    const span = 4.0;
    const segs = 9;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const bx = pondX - span / 2 + span * t;
      const archY = 0.2 + Math.sin(t * Math.PI) * 0.4;
      vox(body, bx, pondZ, archY, (span / segs) * 1.12, 0.14, 1.05, p.wood);
      if (i > 0 && i < segs) {
        vox(body, bx, pondZ + 0.46, archY + 0.14, 0.1, 0.52, 0.1, p.red);
        vox(body, bx, pondZ - 0.46, archY + 0.14, 0.1, 0.52, 0.1, p.red);
        vox(body, bx, pondZ + 0.46, archY + 0.58, (span / segs) * 1.1, 0.08, 0.1, p.redDark);
        vox(body, bx, pondZ - 0.46, archY + 0.58, (span / segs) * 1.1, 0.08, 0.1, p.redDark);
      }
      if (i === 0 || i === segs) {
        vox(body, bx, pondZ, 0, 0.34, 0.22, 1.25, p.stoneDark);
      }
    }
    // Lantern glints reflected in the pond (emissive dashes).
    vox(glow, pondX - 1.1, pondZ + 0.5, 0.08, 0.5, 0.02, 0.12, mixHex(p.glow, p.water, 0.25));
    vox(glow, pondX + 0.4, pondZ - 0.4, 0.08, 0.3, 0.02, 0.1, mixHex(p.glow, p.water, 0.35));

    // ── Cherry grove (four trees, three canopy tones) ──
    const cherry = (cx: number, cz: number, s: number): void => {
      const h = 3.2 * s;
      const tw = 0.3 * s;
      vox(body, cx, cz, 0, tw, h * 0.52, tw, p.trunk);
      const branches: [number, number, number][] = [
        [0.34, 0.12, 0.3],
        [-0.3, -0.16, -0.28],
        [0.1, -0.34, 0.22],
      ];
      branches.forEach(([bx, bz, rot]) => {
        vox(body, cx + bx * s, cz + bz * s, h * 0.4, 0.13 * s, h * 0.36, 0.13 * s, p.trunk, rot);
      });
      const clusters: [number, number, number, number, number][] = [
        [0, 0, 0, 2.25, 0.72],
        [0.72, 0.42, 0.28, 1.6, 0.56],
        [-0.68, -0.34, 0.3, 1.5, 0.52],
        [0.24, -0.56, 0.62, 1.35, 0.46],
        [-0.34, 0.58, 0.12, 1.3, 0.5],
        [0.62, 0.1, -0.62, 1.15, 0.4],
      ];
      clusters.forEach(([ox, oz, oy, cw, ch], i) => {
        const color = i % 3 === 0 ? p.sakuraLight : i % 3 === 1 ? p.sakura : p.sakuraDeep;
        vox(
          body,
          cx + ox * s,
          cz + oz * s,
          h * 0.56 + oy * s,
          cw * s,
          ch * s,
          cw * 0.9 * s,
          color,
          rng.nextFloat(-0.2, 0.2),
        );
      });
      for (let i = 0; i < 7; i++) {
        const a = rng.nextFloat(0, Math.PI * 2);
        const r = rng.nextFloat(0.75, 1.35) * s;
        vox(
          body,
          cx + Math.cos(a) * r,
          cz + Math.sin(a) * r,
          h * 0.62 + rng.nextFloat(-0.1, 0.55) * s,
          0.16,
          0.1,
          0.16,
          i % 2 ? p.sakuraLight : p.sakura,
          rng.nextFloat(0, Math.PI),
        );
      }
      // Fallen petal carpet.
      for (let i = 0; i < 10; i++) {
        const a = rng.nextFloat(0, Math.PI * 2);
        const r = rng.nextFloat(0.3, 1.5) * s;
        vox(
          body,
          cx + Math.cos(a) * r,
          cz + Math.sin(a) * r,
          0,
          0.16,
          0.02,
          0.12,
          rng.chance(0.5) ? p.sakura : p.sakuraLight,
          rng.nextFloat(0, Math.PI),
        );
      }
      aoPatch(cx, cz, 3.2 * s, 3.0 * s);
    };
    cherry(-3.9, -1.0, 1.15);
    cherry(-4.25, 1.7, 0.95);
    cherry(-0.6, -4.7, 0.85);
    cherry(4.5, 0.1, 0.8);

    // ── Stone tōrō lanterns ──
    const toro = (lx: number, lz: number, s: number): void => {
      vox(body, lx, lz, 0, 0.62 * s, 0.2 * s, 0.62 * s, p.stoneDark);
      vox(body, lx, lz, 0.2 * s, 0.28 * s, 0.78 * s, 0.28 * s, p.stone);
      vox(body, lx, lz, 0.98 * s, 0.58 * s, 0.14 * s, 0.58 * s, p.stoneLight);
      vox(glow, lx, lz, 1.12 * s, 0.34 * s, 0.36 * s, 0.34 * s, p.paper);
      vox(body, lx, lz, 1.48 * s, 0.76 * s, 0.16 * s, 0.76 * s, p.stone);
      vox(body, lx, lz, 1.64 * s, 0.42 * s, 0.12 * s, 0.42 * s, p.stoneLight);
      vox(body, lx, lz, 1.76 * s, 0.14 * s, 0.16 * s, 0.14 * s, p.stone);
      aoPatch(lx, lz, 1.1 * s, 1.1 * s);
    };
    toro(1.55, -1.6, 1);
    toro(4.0, -2.5, 1.05);
    toro(5.15, 0.35, 1.1);

    // ── Paper lantern string across the foreground ──
    const stringA: [number, number, number][] = [
      [0.4, 2.05, 2.35],
      [3.05, 2.6, 2.2],
    ];
    stringA.forEach(([lx, lz, h]) => {
      vox(body, lx, lz, 0, 0.16, h, 0.16, p.woodDark);
      vox(body, lx, lz, h, 0.22, 0.1, 0.22, p.ink);
      aoPatch(lx, lz, 0.6, 0.6);
    });
    const ropeSteps = 7;
    for (let i = 1; i < ropeSteps; i++) {
      const t = i / ropeSteps;
      const lx = 0.4 + (3.05 - 0.4) * t;
      const lz = 2.05 + (2.6 - 2.05) * t;
      const sag = Math.sin(t * Math.PI) * 0.28;
      const ly = 2.35 + (2.2 - 2.35) * t - sag;
      vox(body, lx, lz, ly, 0.08, 0.08, 0.08, p.ink);
      if (i % 2 === 1) {
        vox(glow, lx, lz, ly - 0.34, 0.3, 0.3, 0.3, i % 4 === 1 ? p.glow : p.paper);
        vox(body, lx, lz, ly - 0.06, 0.14, 0.08, 0.14, p.ink);
      }
    }

    // ── Foreground frame: shore rocks, reeds and a lantern shelf ──
    for (let i = 0; i < 4; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(0, 0.55);
      const s = rng.nextFloat(0.45, 0.85);
      vox(
        body,
        4.95 + Math.cos(a) * r,
        1.35 + Math.sin(a) * r,
        0,
        s,
        s * 0.7,
        s * 0.9,
        i % 2 ? p.stone : p.stoneDark,
        rng.nextFloat(-0.4, 0.4),
      );
    }
    vox(body, 5.0, 1.35, 0.1, 0.3, 0.12, 0.26, p.moss);
    for (let i = 0; i < 12; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(0.3, 1.0);
      const h = rng.nextFloat(0.3, 0.7);
      vox(
        body,
        4.6 + Math.cos(a) * r,
        2.2 + Math.sin(a) * r,
        0,
        0.07,
        h,
        0.07,
        i % 3 === 0 ? p.mossDark : p.moss,
        rng.nextFloat(-0.3, 0.3),
      );
    }
    // Low wooden railing at the right shore, reading as a viewing deck.
    for (let i = 0; i < 4; i++) {
      vox(body, 4.55 + i * 0.42, 2.9 - i * 0.06, 0, 0.12, 0.85, 0.12, p.wood, -0.12 * i);
    }
    vox(body, 5.2, 2.78, 0.62, 1.9, 0.1, 0.1, p.wood, -0.08);
    aoPatch(4.9, 2.0, 2.2, 1.8);

    // ── Shore scatter: moss tufts, pebbles, fallen petals ──
    for (let i = 0; i < 54; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(2.4, 5.6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Keep the fisherman's lane and the bobber water clear.
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      const kind = rng.next();
      if (kind < 0.5) {
        const h = rng.nextFloat(0.18, 0.42);
        vox(
          body,
          x,
          z,
          0,
          0.07,
          h,
          0.07,
          rng.chance(0.4) ? p.mossDark : p.moss,
          rng.nextFloat(-0.4, 0.4),
        );
        if (rng.chance(0.3)) vox(body, x, z, h, 0.14, 0.08, 0.14, p.sakura);
      } else if (kind < 0.8) {
        const s = rng.nextFloat(0.14, 0.3);
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
        vox(
          body,
          x,
          z,
          0,
          0.18,
          0.02,
          0.14,
          rng.chance(0.5) ? p.sakura : p.sakuraLight,
          rng.nextFloat(0, Math.PI),
        );
      }
    }
    // A few lily pads drifting on the pond.
    for (let i = 0; i < 5; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      vox(
        body,
        pondX + Math.cos(a) * rng.nextFloat(0.3, 1.5),
        pondZ + Math.sin(a) * rng.nextFloat(0.2, 1.0),
        0.05,
        rng.nextFloat(0.3, 0.5),
        0.04,
        rng.nextFloat(0.26, 0.4),
        p.mossDark,
      );
    }

    // ── Batches: 1 body + 1 emissive + 1 fake-AO = 3 draw calls ──
    const bodyMesh = buildInstancedVoxels(body, { castShadow: true, receiveShadow: true });
    this.group.add(bodyMesh);
    const glowMesh = buildInstancedVoxels(glow, {
      castShadow: false,
      receiveShadow: false,
      shading: 'basic',
    });
    this.group.add(glowMesh);
    const aoMesh = buildInstancedVoxels(ao, {
      castShadow: false,
      receiveShadow: false,
      shading: 'basic',
    });
    this.group.add(aoMesh);

    // ── Animated koi (one instanced draw call) ──
    this._koi = [
      { phase: 0.2, speed: 0.34, dir: 1, rx: 1.25, rz: 0.85, alt: 0 },
      { phase: 2.1, speed: 0.26, dir: -1, rx: 0.95, rz: 0.6, alt: 1 },
      { phase: 3.7, speed: 0.41, dir: 1, rx: 1.5, rz: 0.95, alt: 0 },
      { phase: 5.2, speed: 0.22, dir: -1, rx: 0.7, rz: 0.5, alt: 1 },
    ];
    this._koiMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      this._koi.length * 3,
    );
    this._koiMesh.frustumCulled = false;
    this._koiMesh.castShadow = false;
    for (let i = 0; i < this._koi.length; i++) {
      const fish = this._koi[i];
      const bodyColor = i % 2 === 0 ? p.koiOrange : p.koiWhite;
      for (let k = 0; k < 3; k++) {
        _color.setHex(k === 2 ? (fish.alt === 0 ? p.koiWhite : p.koiGold) : bodyColor);
        this._koiMesh.setColorAt(i * 3 + k, _color);
      }
    }
    if (this._koiMesh.instanceColor) this._koiMesh.instanceColor.needsUpdate = true;
    this.group.add(this._koiMesh);

    // ── Rim waterfall (v2, 5 draw calls) ──
    this._waterfall = new Waterfall({
      radius: 6.6,
      innerRadius: 6.18,
      yBase: -0.15,
      heightMin: 2.2,
      heightMax: 3.1,
      color: mixHex(theme?.waterColor ?? 0x496f76, keyColor, 0.35),
      opacity: 0.58,
      density: 0.78,
    });
    this.group.add(this._waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glowColor = art.glow ?? 0xffb45c;
    const keyColor = art.key ?? 0xffd2a1;

    // 1) Sakura petals drifting down across the diorama.
    this._fields.push(
      new DriftField(this.group, {
        count: 54,
        mode: 'fall',
        colors: [0xefbcc5, 0xffdde4, 0xcf94a4],
        cx: 0,
        cz: 0,
        areaX: 11,
        areaZ: 11,
        yMin: 0.4,
        yMax: 7.6,
        size: [0.15, 0.03, 0.12],
        speedMin: 0.1,
        speedMax: 0.22,
        sway: 0.55,
        spin: [1.4, 0.9, 2.1],
        opacity: 0.92,
        additive: false,
      }),
    );
    // 2) Fireflies over the pond and the grove.
    this._fields.push(
      new DriftField(this.group, {
        count: 24,
        mode: 'float',
        colors: [0xffd9a0, 0xd8ff8a, 0xffc77a],
        cx: -1.2,
        cz: 0.6,
        areaX: 8.5,
        areaZ: 8.5,
        yMin: 1.9,
        yMax: 4.6,
        size: [0.08, 0.08, 0.08],
        speedMin: 0.25,
        speedMax: 0.6,
        sway: 0.7,
        spin: [0, 0.6, 0],
        opacity: 0.9,
        additive: true,
      }),
    );
    // 3) Warm embers rising from the lantern strings.
    this._fields.push(
      new DriftField(this.group, {
        count: 18,
        mode: 'rise',
        colors: [glowColor, 0xffd9a0],
        cx: 1.9,
        cz: 2.5,
        areaX: 3.4,
        areaZ: 2.4,
        yMin: 1.6,
        yMax: 3.6,
        size: [0.06, 0.06, 0.06],
        speedMin: 0.12,
        speedMax: 0.26,
        sway: 0.28,
        spin: [0, 1.2, 0],
        opacity: 0.85,
        additive: true,
      }),
    );

    // Volumetric dusk shafts behind the torii + a lantern halo.
    const shafts = buildLightShaft({
      color: keyColor,
      height: 7,
      width: 2.4,
      opacity: 0.055,
      count: 2,
      seed: hashSeed('japan:shaft'),
    });
    shafts.position.set(0, SURFACE + 0.4, 0);
    this.group.add(shafts);

    const orb = buildGlowOrb({
      color: glowColor,
      size: 0.42,
      position: new THREE.Vector3(1.9, SURFACE + 1.75, 2.45),
    });
    this.group.add(orb);

    // ── Local light rig: 2 warm lanterns + 1 cool water bounce ──
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
      this._lights.push({ light, base, speed, phase: this._lights.length * 1.7, amp });
    };
    addLight(glowColor, 1.9, SURFACE + 2.0, 2.45, 1.6, 6.5, 1.7, 0.18); // paper lanterns
    addLight(0xffe0b0, 2.7, SURFACE + 2.6, -2.7, 1.3, 6.0, 1.1, 0.12); // torii / shrine
    addLight(0x9fdcff, -1.2, SURFACE + 0.8, 0.9, 1.0, 5.0, 0.8, 0.1); // pond bounce
  }

  private _updateKoi(time: number): void {
    const mesh = this._koiMesh;
    if (!mesh) return;
    const pondX = -1.2;
    const pondZ = 0.9;
    for (let i = 0; i < this._koi.length; i++) {
      const fish = this._koi[i];
      const a = fish.phase + time * fish.speed * fish.dir;
      const cx = pondX + Math.cos(a) * fish.rx;
      const cz = pondZ + Math.sin(a) * fish.rz;
      const vx = -Math.sin(a) * fish.rx * fish.speed * fish.dir;
      const vz = Math.cos(a) * fish.rz * fish.speed * fish.dir;
      const heading = Math.atan2(-vz, vx);
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      const offsets: [number, number, number, number, number, number][] = [
        [0, 0.09, 0.1, 0.42, 0.12, 0.18],
        [-0.3, 0.09, 0.1, 0.18, 0.1, 0.14],
        [0.12, 0.09, 0.1, 0.14, 0.05, 0.12],
      ];
      offsets.forEach(([ox, oy, oz, w, h, d], k) => {
        _pos.set(cx + ox * cos + oz * sin, SURFACE + oy, cz - ox * sin + oz * cos);
        _euler.set(0, heading, 0);
        _quat.setFromEuler(_euler);
        _scale.set(w, h, d);
        _matrix.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i * 3 + k, _matrix);
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    this._waterfall?.update(time);
    for (const field of this._fields) field.update(time);
    this._updateKoi(time);
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
    this._koi = [];
    this._koiMesh = null;
    super.destroy();
  }
}
