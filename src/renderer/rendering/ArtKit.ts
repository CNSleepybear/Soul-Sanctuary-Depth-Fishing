// ===== src/renderer/rendering/ArtKit.ts =====
// Shared voxel art toolkit for all 12 sanctuaries.
//
// The project is a strict voxel diorama: every prop is assembled from
// BoxGeometry blocks. This module owns the shared "brush set" so scenes stay
// coherent: 0.25-unit grid snapping, colour ramps, seeded randomness, and a
// library of reusable low-poly props (trees, rocks, lanterns, boats, clouds,
// silhouettes, light shafts, glows...).
//
// Design rules (see docs/art-direction-v2.md §2.4):
// - new geometry snaps to VOXEL (0.25) unless it is a deliberate fine detail
//   (FINE = 0.0625) that stays readable at 400x300;
// - props expose a Group whose origin sits on the island surface (y = 0 local);
// - materials are borrowed from MaterialCache so teardown stays cheap;
// - random detail is seeded, never Math.random(), so scenes are reproducible.

import * as THREE from 'three';
import { RNG } from '../core/RNG';
import { MaterialCache } from './MaterialCache';
import { VoxelBuilder } from './VoxelBuilder';

// ── Grid + colour helpers ────────────────────────────────────────────────

export const VOXEL = 0.25;
export const FINE = 0.0625;

const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

/** Snap a length to the voxel grid (nearest multiple). */
export function snap(value: number, unit = VOXEL): number {
  return Math.round(value / unit) * unit;
}

/** Snap a length up to at least one voxel. */
export function snapUp(value: number, unit = VOXEL): number {
  return Math.max(unit, Math.ceil(value / unit) * unit);
}

/** Blend two sRGB hex colours. */
export function mixHex(a: number, b: number, t: number): number {
  _colorA.setHex(a);
  _colorB.setHex(b);
  _colorA.lerp(_colorB, Math.min(1, Math.max(0, t)));
  return _colorA.getHex();
}

/** Multiply brightness (linear space). factor > 1 lightens, < 1 darkens. */
export function shade(hex: number, factor: number): number {
  _colorA.setHex(hex);
  _colorA.multiplyScalar(factor);
  return _colorA.getHex();
}

/** Push a colour towards another colour (0..1). */
export function tint(hex: number, towards: number, amount: number): number {
  return mixHex(hex, towards, amount);
}

/** Deterministic seed from a string (e.g. a location id). */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Seeded RNG with a small convenience surface used by prop factories. */
export function createRng(seed: number | string = 1): RNG {
  return new RNG(typeof seed === 'number' ? seed : hashSeed(seed));
}

/** A colour ramp of `count` tones around `base` (dark → light). */
export function rampHex(base: number, count: number, spread = 0.16): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    out.push(shade(base, 1 + t * spread * 2));
  }
  return out;
}

/** Pick one of a set of colours with a seeded rng. */
export function pickColor(rng: RNG, colors: number[]): number {
  return colors[rng.nextInt(0, colors.length - 1)];
}

// ── Instanced voxel helper ───────────────────────────────────────────────

export interface InstancedVoxel {
  x: number;
  y: number;
  z: number;
  w?: number;
  h?: number;
  d?: number;
  color: number;
  rotY?: number;
}

/**
 * Render many same-language voxels in a single draw call. Use it for grass,
 * flowers, water tiles, gravel and other "confetti" that would otherwise
 * explode the draw-call budget.
 */
export function buildInstancedVoxels(
  cells: InstancedVoxel[],
  opts: { castShadow?: boolean; receiveShadow?: boolean; shading?: 'lambert' | 'basic' } = {},
): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material =
    opts.shading === 'basic'
      ? new THREE.MeshBasicMaterial({ color: 0xffffff })
      : new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, cells.length));
  cells.forEach((cell, index) => {
    _position.set(cell.x, cell.y, cell.z);
    _euler.set(0, cell.rotY ?? 0, 0);
    _quaternion.setFromEuler(_euler);
    _scale.set(cell.w ?? VOXEL, cell.h ?? VOXEL, cell.d ?? VOXEL);
    _matrix.compose(_position, _quaternion, _scale);
    mesh.setMatrixAt(index, _matrix);
    _colorA.setHex(cell.color);
    mesh.setColorAt(index, _colorA);
  });
  mesh.count = cells.length;
  mesh.castShadow = opts.castShadow ?? false;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ── Small builder helper ────────────────────────────────────────────────

interface BoxOpts {
  cast?: boolean;
  receive?: boolean;
}

function box(
  builder: VoxelBuilder,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  opts: BoxOpts = {},
): THREE.Mesh {
  return builder.box(w, h, d, color, x, y, z, {
    castShadow: opts.cast ?? true,
    receiveShadow: opts.receive ?? true,
  });
}

/** Fine detail box (sub-voxel) used for eyes, petals, antennae. */
function fine(
  builder: VoxelBuilder,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  opts: BoxOpts = {},
): THREE.Mesh {
  return builder.box(w, h, d, color, x, y, z, {
    castShadow: opts.cast ?? false,
    receiveShadow: opts.receive ?? false,
  });
}

// ── Vegetation ───────────────────────────────────────────────────────────

export type TreeStyle = 'round' | 'pine' | 'cherry' | 'bamboo' | 'palm' | 'bare';

export interface TreeOptions {
  style?: TreeStyle;
  height?: number;
  foliage?: number;
  foliageDark?: number;
  trunk?: number;
  snow?: boolean;
  seed?: number;
  width?: number;
}

/**
 * Reusable voxel tree. Origin at the trunk base; total height ≈ options.height.
 * Styles keep 3-tone canopies and a readable silhouette for each culture.
 */
export function buildTree(options: TreeOptions = {}): THREE.Group {
  const style = options.style ?? 'round';
  const rng = createRng(options.seed ?? 7);
  const builder = new VoxelBuilder();
  const trunkColor = options.trunk ?? 0x5a4636;
  const foliage = options.foliage ?? 0x7f9a6a;
  const foliageDark = options.foliageDark ?? shade(foliage, 0.78);
  const foliageLight = mixHex(foliage, 0xfff4dc, 0.18);
  const width = options.width ?? 1;
  const height = options.height ?? (style === 'bamboo' ? 4.5 : style === 'pine' ? 3.5 : 3);

  if (style === 'pine') {
    const trunkH = height * 0.42;
    box(builder, 0.375 * width, trunkH, 0.375 * width, trunkColor, 0, trunkH / 2, 0);
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const w = (1.9 - t * 1.35) * width + 0.35;
      const y = trunkH + 0.35 + i * (height * 0.16);
      const color = i % 2 === 0 ? foliage : foliageDark;
      box(builder, snapUp(w), 0.45, snapUp(w), color, 0, y, 0, { cast: true });
      if (options.snow) {
        box(builder, snapUp(w * 0.82), 0.125, snapUp(w * 0.82), 0xf1f4f2, 0, y + 0.28, 0, {
          cast: false,
        });
      }
    }
    box(builder, 0.25, 0.75, 0.25, foliage, 0, trunkH + height * 0.72, 0, { cast: false });
    return builder.group;
  }

  if (style === 'bamboo') {
    const stalks = 4 + rng.nextInt(0, 2);
    for (let i = 0; i < stalks; i++) {
      const angle = (i / stalks) * Math.PI * 2 + rng.nextFloat(-0.3, 0.3);
      const radius = rng.nextFloat(0.15, 0.55) * width;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const h = height * rng.nextFloat(0.72, 1);
      const nodes = Math.max(2, Math.floor(h / 0.75));
      for (let n = 0; n < nodes; n++) {
        const segH = h / nodes;
        const color = n % 3 === 0 ? shade(foliage, 0.9) : foliage;
        box(builder, 0.1875, segH * 0.92, 0.1875, color, px, segH * (n + 0.5), pz, {
          cast: n > nodes - 3,
        });
        box(builder, 0.25, 0.0625, 0.25, foliageDark, px, segH * (n + 1) - 0.03, pz, {
          cast: false,
        });
      }
      const leafCount = 5 + rng.nextInt(0, 3);
      for (let l = 0; l < leafCount; l++) {
        const la = rng.nextFloat(0, Math.PI * 2);
        const lr = rng.nextFloat(0.1, 0.45);
        box(
          builder,
          rng.nextFloat(0.25, 0.5),
          0.0625,
          rng.nextFloat(0.25, 0.5),
          l % 2 === 0 ? foliage : foliageLight,
          px + Math.cos(la) * lr,
          h - rng.nextFloat(0.1, 0.6),
          pz + Math.sin(la) * lr,
          { cast: false },
        );
      }
    }
    return builder.group;
  }

  if (style === 'palm') {
    const trunkH = height * 0.68;
    const segments = 5;
    let offsetX = 0;
    for (let i = 0; i < segments; i++) {
      offsetX += 0.075;
      const segH = trunkH / segments;
      box(
        builder,
        0.3125,
        segH,
        0.3125,
        shade(trunkColor, 0.95 + i * 0.02),
        offsetX,
        segH * (i + 0.5),
        0,
      );
    }
    const crownY = trunkH;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.2;
      const frond = box(
        builder,
        0.875 * width,
        0.0625,
        0.25,
        i % 2 === 0 ? foliage : foliageDark,
        offsetX + Math.cos(angle) * 0.5,
        crownY + 0.1,
        Math.sin(angle) * 0.5,
      );
      frond.rotation.y = angle;
      frond.rotation.z = -0.25;
    }
    for (let i = 0; i < 3; i++) {
      fine(builder, 0.125, 0.125, 0.125, 0x8a6b3f, offsetX + 0.15 * i - 0.1, crownY - 0.15, 0.12);
    }
    return builder.group;
  }

  if (style === 'bare') {
    const trunkH = height * 0.75;
    box(builder, 0.375, trunkH, 0.375, trunkColor, 0, trunkH / 2, 0);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      const length = rng.nextFloat(0.4, 0.8);
      const branch = box(
        builder,
        0.1875,
        length,
        0.1875,
        trunkColor,
        Math.cos(angle) * 0.15,
        trunkH * rng.nextFloat(0.55, 0.85),
        Math.sin(angle) * 0.15,
      );
      branch.rotation.z = Math.cos(angle) * 0.5;
      branch.rotation.x = Math.sin(angle) * 0.5;
    }
    return builder.group;
  }

  // round / cherry share a trunk, then split canopy language
  const trunkH = height * (style === 'cherry' ? 0.5 : 0.45);
  const trunkW = style === 'cherry' ? 0.375 : 0.4375;
  box(builder, trunkW, trunkH, trunkW, trunkColor, 0, trunkH / 2, 0);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.7;
    const branch = box(
      builder,
      0.1875,
      trunkH * 0.55,
      0.1875,
      trunkColor,
      Math.cos(angle) * 0.28,
      trunkH * 0.78,
      Math.sin(angle) * 0.28,
    );
    branch.rotation.z = Math.cos(angle) * 0.55;
    branch.rotation.x = Math.sin(angle) * 0.55;
  }

  if (style === 'cherry') {
    const clusters = [
      [0, 0, 0, 2.0, 0.5],
      [0.65, 0.25, 0.35, 1.5, 0.375],
      [-0.6, 0.35, -0.3, 1.4, 0.375],
      [0.3, 0.55, -0.55, 1.25, 0.3125],
      [-0.25, 0.15, 0.6, 1.3, 0.375],
      [0.85, 0.0, -0.15, 1.0, 0.25],
    ];
    clusters.forEach((c, i) => {
      const color = i % 3 === 0 ? foliageLight : i % 3 === 1 ? foliage : foliageDark;
      box(
        builder,
        c[3] * width,
        c[4],
        c[3] * width * 0.9,
        color,
        c[0],
        trunkH + 0.35 + c[1],
        c[2],
        {
          cast: false,
        },
      );
    });
    for (let i = 0; i < 10; i++) {
      const angle = rng.nextFloat(0, Math.PI * 2);
      const radius = rng.nextFloat(0.7, 1.35) * width;
      fine(
        builder,
        0.18375,
        0.125,
        0.18375,
        i % 2 === 0 ? foliage : foliageLight,
        Math.cos(angle) * radius,
        trunkH + rng.nextFloat(0.15, 0.85),
        Math.sin(angle) * radius,
      );
    }
    return builder.group;
  }

  const canopyY = trunkH + 0.35;
  const canopy = [
    [0, 0, 0, 1.7, 0.6],
    [0.55, 0.35, 0.25, 1.25, 0.5],
    [-0.55, 0.25, -0.3, 1.15, 0.45],
    [0.2, 0.65, -0.35, 1.1, 0.4],
    [-0.2, 0.55, 0.45, 1.0, 0.375],
    [0.6, -0.05, -0.5, 0.9, 0.35],
  ];
  canopy.forEach((c, i) => {
    const color = i === 1 ? foliageDark : i === 4 ? foliageLight : foliage;
    box(builder, c[3] * width, c[4], c[3] * width * 0.9, color, c[0], canopyY + c[1], c[2]);
  });
  if (options.snow) {
    box(builder, 1.2 * width, 0.125, 1.0 * width, 0xf1f4f2, 0, canopyY + 0.55, 0, { cast: false });
  }
  return builder.group;
}

/** Low bush / shrub with optional berries. */
export function buildBush(options: {
  foliage?: number;
  size?: number;
  berries?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 3);
  const size = options.size ?? 0.75;
  const color = options.foliage ?? 0x7f9a6a;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + rng.nextFloat(-0.4, 0.4);
    const radius = rng.nextFloat(0.05, 0.22) * size;
    box(
      builder,
      size * rng.nextFloat(0.5, 0.85),
      size * rng.nextFloat(0.35, 0.55),
      size * rng.nextFloat(0.5, 0.85),
      i % 2 === 0 ? color : shade(color, 0.82),
      Math.cos(angle) * radius,
      size * 0.22,
      Math.sin(angle) * radius,
      { cast: true },
    );
  }
  if (options.berries !== undefined) {
    for (let i = 0; i < 4; i++) {
      fine(
        builder,
        0.09375,
        0.09375,
        0.09375,
        options.berries,
        rng.nextFloat(-0.25, 0.25),
        rng.nextFloat(0.25, 0.45),
        rng.nextFloat(-0.25, 0.25),
      );
    }
  }
  return builder.group;
}

/** Grass tuft: three thin blades, cheap and readable. */
export function buildGrassTuft(options: {
  color?: number;
  height?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 11);
  const color = options.color ?? 0x7d9b62;
  const height = options.height ?? 0.5;
  for (let i = 0; i < 3; i++) {
    const blade = box(
      builder,
      0.0625,
      height * rng.nextFloat(0.6, 1),
      0.0625,
      i === 1 ? shade(color, 0.85) : color,
      rng.nextFloat(-0.12, 0.12),
      height * 0.4,
      rng.nextFloat(-0.12, 0.12),
      { cast: false },
    );
    blade.rotation.z = rng.nextFloat(-0.22, 0.22);
  }
  return builder.group;
}

/** Reed clump for pond / river shores. */
export function buildReeds(options: {
  color?: number;
  seedHead?: number;
  count?: number;
  height?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 5);
  const color = options.color ?? 0x7f9a6a;
  const count = options.count ?? 7;
  const height = options.height ?? 1.2;
  for (let i = 0; i < count; i++) {
    const x = rng.nextFloat(-0.55, 0.55);
    const z = rng.nextFloat(-0.55, 0.55);
    const h = height * rng.nextFloat(0.7, 1.15);
    box(builder, 0.0625, h, 0.0625, i % 3 === 0 ? shade(color, 0.88) : color, x, h / 2, z, {
      cast: false,
    });
    if (i % 2 === 0) {
      fine(builder, 0.125, 0.1875, 0.125, options.seedHead ?? 0x8a6b3f, x, h + 0.1, z);
    }
  }
  return builder.group;
}

/** Flower patch: stems + two-tone heads. Great for shorelines and meadows. */
export function buildFlowerPatch(options: {
  petal?: number;
  petalAlt?: number;
  stem?: number;
  count?: number;
  radius?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 17);
  const petal = options.petal ?? 0xf1c5c3;
  const petalAlt = options.petalAlt ?? 0xe6c68a;
  const stem = options.stem ?? 0x6f8a5a;
  const count = options.count ?? 9;
  const radius = options.radius ?? 0.75;
  for (let i = 0; i < count; i++) {
    const angle = rng.nextFloat(0, Math.PI * 2);
    const distance = Math.sqrt(rng.next()) * radius;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const h = rng.nextFloat(0.12, 0.32);
    fine(builder, 0.0625, h, 0.0625, stem, x, h / 2, z);
    fine(builder, 0.125, 0.09375, 0.125, i % 3 === 0 ? petalAlt : petal, x, h + 0.03, z);
  }
  return builder.group;
}

// ── Rocks / terrain decoration ──────────────────────────────────────────

export function buildRockCluster(options: {
  stone?: number;
  moss?: number;
  size?: number;
  seed?: number;
  count?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 23);
  const stone = options.stone ?? 0x8b918c;
  const size = options.size ?? 0.75;
  const count = options.count ?? 4;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.nextFloat(-0.5, 0.5);
    const distance = rng.nextFloat(0.05, 0.45) * size;
    const w = size * rng.nextFloat(0.35, 0.8);
    const h = size * rng.nextFloat(0.25, 0.6);
    box(
      builder,
      snapUp(w),
      snapUp(h),
      snapUp(w * rng.nextFloat(0.7, 1.1)),
      i % 3 === 0 ? shade(stone, 0.82) : stone,
      Math.cos(angle) * distance,
      h / 2,
      Math.sin(angle) * distance,
    );
  }
  if (options.moss !== undefined) {
    box(builder, size * 0.55, 0.0625, size * 0.45, options.moss, 0, size * 0.42, 0, {
      cast: false,
    });
  }
  return builder.group;
}

/** Flat stepping stones, usable as a path or a shore shelf. */
export function buildStonePath(options: {
  stone?: number;
  length?: number;
  step?: number;
  width?: number;
  offsetX?: number;
  offsetZ?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 29);
  const stone = options.stone ?? 0x9aa09a;
  const length = options.length ?? 3;
  const step = options.step ?? 0.65;
  const width = options.width ?? 0.65;
  const count = Math.max(2, Math.round(length / step));
  for (let i = 0; i < count; i++) {
    const z = (options.offsetZ ?? 0) + i * step - length / 2;
    const wobble = rng.nextFloat(-0.08, 0.08);
    const stoneMesh = box(
      builder,
      width * rng.nextFloat(0.8, 1.1),
      0.09375,
      step * rng.nextFloat(0.72, 0.95),
      i % 3 === 0 ? shade(stone, 0.88) : stone,
      (options.offsetX ?? 0) + wobble,
      0.046875,
      z,
      { receive: true },
    );
    stoneMesh.rotation.y = rng.nextFloat(-0.12, 0.12);
  }
  return builder.group;
}

/** Small stone stair / terrace edge. */
export function buildSteps(options: {
  stone?: number;
  count?: number;
  width?: number;
  rise?: number;
  run?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 31);
  const stone = options.stone ?? 0x9aa09a;
  const count = options.count ?? 5;
  const width = options.width ?? 1.5;
  const rise = options.rise ?? 0.1875;
  const run = options.run ?? 0.5;
  for (let i = 0; i < count; i++) {
    box(
      builder,
      width,
      rise,
      run,
      i % 2 === 0 ? stone : shade(stone, 0.9),
      0,
      rise / 2 + i * rise,
      -i * run,
      { receive: true },
    );
    if (rng.chance(0.35)) {
      box(
        builder,
        width * 0.2,
        rise * 0.6,
        run * 0.5,
        shade(stone, 0.84),
        width * 0.3,
        rise + i * rise,
        -i * run,
        {
          cast: false,
        },
      );
    }
  }
  return builder.group;
}

// ── Architecture / props ────────────────────────────────────────────────

/** Japanese-ish stone lantern (toro) with a warm glowing core. */
export function buildStoneLantern(options: {
  stone?: number;
  glow?: number;
  height?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const stone = options.stone ?? 0x8b918c;
  const glow = options.glow ?? 0xffcc66;
  const scale = (options.height ?? 2) / 2;
  box(builder, 0.75 * scale, 0.1875 * scale, 0.75 * scale, stone, 0, 0.09 * scale, 0);
  box(builder, 0.3 * scale, 0.875 * scale, 0.3 * scale, shade(stone, 0.94), 0, 0.62 * scale, 0);
  box(builder, 0.62 * scale, 0.125 * scale, 0.62 * scale, stone, 0, 1.15 * scale, 0);
  box(builder, 0.375 * scale, 0.4375 * scale, 0.375 * scale, glow, 0, 1.43 * scale, 0, {
    cast: false,
  });
  box(builder, 0.8 * scale, 0.15 * scale, 0.8 * scale, stone, 0, 1.72 * scale, 0);
  box(builder, 0.5 * scale, 0.125 * scale, 0.5 * scale, shade(stone, 0.92), 0, 1.86 * scale, 0);
  box(builder, 0.18 * scale, 0.2 * scale, 0.18 * scale, stone, 0, 2.02 * scale, 0);
  return builder.group;
}

/** String of paper lanterns between two posts. */
export function buildLanternString(options: {
  length?: number;
  height?: number;
  lantern?: number;
  post?: number;
  count?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const length = options.length ?? 3.5;
  const height = options.height ?? 2.4;
  const lantern = options.lantern ?? 0xffb45c;
  const post = options.post ?? 0x5a4636;
  const count = options.count ?? 4;
  box(builder, 0.1875, height, 0.1875, post, -length / 2, height / 2, 0);
  box(builder, 0.1875, height, 0.1875, post, length / 2, height / 2, 0);
  box(builder, length + 0.25, 0.0625, 0.0625, 0x3a3230, 0, height - 0.15, 0, { cast: false });
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + (length / (count - 1)) * i;
    const drop = 0.25 + Math.sin(((i + 1) / (count + 1)) * Math.PI) * 0.4;
    box(builder, 0.0625, drop, 0.0625, 0x3a3230, x, height - 0.15 - drop / 2, 0, { cast: false });
    box(builder, 0.3125, 0.3125, 0.3125, lantern, x, height - 0.15 - drop - 0.15, 0, {
      cast: false,
    });
  }
  return builder.group;
}

/** Simple wooden fence / railing. */
export function buildFence(options: {
  wood?: number;
  length?: number;
  height?: number;
  posts?: number;
  z?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const wood = options.wood ?? 0x6b5138;
  const length = options.length ?? 3;
  const height = options.height ?? 0.75;
  const posts = options.posts ?? 4;
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (length / (posts - 1)) * i;
    box(builder, 0.125, height, 0.125, shade(wood, 0.92), x, height / 2, options.z ?? 0);
  }
  box(builder, length, 0.09375, 0.09375, wood, 0, height * 0.7, options.z ?? 0);
  box(builder, length, 0.09375, 0.09375, shade(wood, 0.88), 0, height * 0.35, options.z ?? 0);
  return builder.group;
}

/** Arched wooden bridge with railings. Span runs along X. */
export function buildArchBridge(options: {
  wood?: number;
  railing?: number;
  span?: number;
  arch?: number;
  width?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const wood = options.wood ?? 0x6b5138;
  const railing = options.railing ?? 0x9c4a3c;
  const span = options.span ?? 2.5;
  const arch = options.arch ?? 0.45;
  const width = options.width ?? 1.0;
  const segments = 9;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -span / 2 + span * t;
    const y = 0.18 + Math.sin(t * Math.PI) * arch;
    box(builder, (span / segments) * 1.1, 0.125, width, wood, x, y, 0);
    if (i % 2 === 0 && i > 0 && i < segments) {
      box(builder, 0.125, 0.6, 0.125, railing, x, y + 0.33, width / 2 - 0.06);
      box(builder, 0.125, 0.6, 0.125, railing, x, y + 0.33, -width / 2 + 0.06);
    }
  }
  box(builder, span, 0.09375, 0.09375, railing, 0, 0.9, width / 2 - 0.06);
  box(builder, span, 0.09375, 0.09375, railing, 0, 0.9, -width / 2 + 0.06);
  return builder.group;
}

/** Small rowboat / gondola silhouette. Length runs along Z. */
export function buildRowboat(options: {
  hull?: number;
  trim?: number;
  seat?: number;
  length?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const hull = options.hull ?? 0x2f2a2a;
  const trim = options.trim ?? 0x8a6b3f;
  const seat = options.seat ?? 0x6b5138;
  const length = options.length ?? 1.75;
  box(builder, 0.5, 0.1875, length, hull, 0, 0.09, 0);
  box(builder, 0.375, 0.25, length * 0.72, shade(hull, 1.15), 0, 0.22, 0);
  box(builder, 0.5, 0.125, length * 0.35, trim, 0, 0.36, -length * 0.12);
  box(builder, 0.1875, 0.25, 0.375, hull, 0, 0.12, length / 2 - 0.1);
  box(builder, 0.1875, 0.375, 0.25, hull, 0, 0.2, -length / 2 + 0.05);
  box(builder, 0.625, 0.09375, 0.3125, seat, 0, 0.31, length * 0.18);
  const oar = box(builder, 0.0625, 0.0625, 1.1, trim, 0.5, 0.42, 0.1, { cast: false });
  oar.rotation.y = 0.4;
  return builder.group;
}

/** Wooden dock / pier. */
export function buildDock(options: {
  wood?: number;
  width?: number;
  length?: number;
  height?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const wood = options.wood ?? 0x6b5138;
  const width = options.width ?? 2.25;
  const length = options.length ?? 1.75;
  const height = options.height ?? 0.75;
  box(builder, width, 0.125, length, shade(wood, 1.06), 0, height, 0);
  for (let i = 0; i < 5; i++) {
    box(
      builder,
      width,
      0.015625,
      0.0625,
      shade(wood, 0.82),
      0,
      height + 0.07,
      -length / 2 + 0.25 + i * 0.35,
      {
        cast: false,
      },
    );
  }
  const posts = [
    [-width / 2 + 0.15, -length / 2 + 0.15],
    [width / 2 - 0.15, -length / 2 + 0.15],
    [-width / 2 + 0.15, length / 2 - 0.15],
    [width / 2 - 0.15, length / 2 - 0.15],
  ];
  posts.forEach(([x, z]) => {
    box(builder, 0.1875, height + 0.25, 0.1875, shade(wood, 0.9), x, (height + 0.25) / 2, z);
  });
  return builder.group;
}

// ── Sky / atmosphere ────────────────────────────────────────────────────

/** Soft voxel cloud that can be parked in the far background. */
export function buildCloud(options: {
  color?: number;
  size?: number;
  opacity?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 41);
  const color = options.color ?? 0xf4efe4;
  const size = options.size ?? 1;
  const material = MaterialCache.getTransparentLambert(color, options.opacity ?? 0.5);
  const count = 3 + rng.nextInt(0, 3);
  for (let i = 0; i < count; i++) {
    const mesh = box(
      builder,
      snapUp(size * rng.nextFloat(0.55, 1.15)),
      snapUp(size * rng.nextFloat(0.25, 0.45)),
      snapUp(size * rng.nextFloat(0.4, 0.8)),
      0xffffff,
      rng.nextFloat(-0.7, 0.7) * size,
      rng.nextFloat(-0.1, 0.25) * size,
      rng.nextFloat(-0.35, 0.35) * size,
      { cast: false },
    );
    mesh.material = material;
  }
  return builder.group;
}

export interface FloatingRockCell extends InstancedVoxel {
  castShadow: boolean;
  receiveShadow: boolean;
}

/** Cell data for callers that batch the floating rocks with other voxels. */
export function buildFloatingRockCells(options: {
  stone?: number;
  moss?: number;
  count?: number;
  radius?: number;
  seed?: number;
}): FloatingRockCell[] {
  const cells: FloatingRockCell[] = [];
  const rng = createRng(options.seed ?? 43);
  const stone = options.stone ?? 0x8b918c;
  const count = options.count ?? 4;
  const radius = options.radius ?? 4.5;
  for (let i = 0; i < count; i++) {
    const angle = rng.nextFloat(0, Math.PI * 2);
    const distance = rng.nextFloat(radius * 0.5, radius);
    const size = rng.nextFloat(0.25, 0.65);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = -rng.nextFloat(0.6, 1.8);
    cells.push({
      x,
      y,
      z,
      w: size,
      h: size * 0.75,
      d: size,
      color: stone,
      castShadow: true,
      receiveShadow: true,
    });
    if (rng.chance(0.5)) {
      cells.push({
        x,
        y: y + size * 0.4,
        z,
        w: size * 0.7,
        h: 0.0625,
        d: size * 0.6,
        color: options.moss ?? 0x7f9a6a,
        castShadow: false,
        receiveShadow: true,
      });
    }
  }
  return cells;
}

/** Cluster of small rocks floating under the island (floating-island story). */
export function buildFloatingRocks(options: {
  stone?: number;
  moss?: number;
  count?: number;
  radius?: number;
  seed?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  for (const cell of buildFloatingRockCells(options)) {
    box(
      builder,
      cell.w ?? VOXEL,
      cell.h ?? VOXEL,
      cell.d ?? VOXEL,
      cell.color,
      cell.x,
      cell.y,
      cell.z,
      {
        cast: cell.castShadow,
        receive: cell.receiveShadow,
      },
    );
  }
  return builder.group;
}

/** Low, mostly flat silhouette layer that sits far behind the island. */
export function buildSilhouetteRidge(options: {
  color?: number;
  width?: number;
  height?: number;
  depth?: number;
  distance?: number;
  seed?: number;
  count?: number;
}): THREE.Group {
  const builder = new VoxelBuilder();
  const rng = createRng(options.seed ?? 47);
  const color = options.color ?? 0x232a33;
  const width = options.width ?? 24;
  const depth = options.distance ?? -13;
  const count = options.count ?? 9;
  const material = MaterialCache.getBasic(color);
  for (let i = 0; i < count; i++) {
    const w = (width / count) * rng.nextFloat(0.8, 1.5);
    const h = (options.height ?? 2.4) * rng.nextFloat(0.35, 1);
    const x = -width / 2 + (width / (count - 1)) * i + rng.nextFloat(-0.5, 0.5);
    const z = depth + rng.nextFloat(-1.2, 1.2);
    const mesh = box(builder, snapUp(w), snapUp(h), 0.5, color, x, h / 2 - 0.2, z, {
      cast: false,
      receive: false,
    });
    mesh.material = material;
  }
  return builder.group;
}

/**
 * Slanted light shaft, additive and very faint. Two crossed planes give the
 * classic "god ray" read without any texture.
 */
export function buildLightShaft(options: {
  color?: number;
  height?: number;
  width?: number;
  opacity?: number;
  count?: number;
  seed?: number;
}): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(options.seed ?? 53);
  const color = options.color ?? 0xffe6b0;
  const opacity = options.opacity ?? 0.07;
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const count = options.count ?? 3;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(
      (options.width ?? 1.6) * rng.nextFloat(0.6, 1.2),
      (options.height ?? 8) * rng.nextFloat(0.7, 1.1),
      1,
    );
    mesh.position.set(rng.nextFloat(-4, 4), (options.height ?? 8) * 0.35, rng.nextFloat(-6, -2));
    mesh.rotation.z = rng.nextFloat(-0.35, 0.35);
    mesh.rotation.y = rng.nextFloat(-0.5, 0.5);
    group.add(mesh);
  }
  return group;
}

/** Voxel halo: nested additive boxes, cheap stand-in for bloom on lamps. */
export function buildGlowOrb(options: {
  color?: number;
  size?: number;
  position?: THREE.Vector3;
  layers?: number;
}): THREE.Group {
  const group = new THREE.Group();
  const color = options.color ?? 0xffc46b;
  const size = options.size ?? 0.5;
  const layers = options.layers ?? 3;
  for (let i = 0; i < layers; i++) {
    const scale = size * (1 + i * 0.65);
    const geometry = new THREE.BoxGeometry(scale, scale, scale);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22 / (i + 1),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(options.position ?? new THREE.Vector3());
    group.add(mesh);
  }
  return group;
}

/** Soft circular shadow disc (style-guide allowed exception). */
export function buildGroundShadow(options: {
  radius?: number;
  opacity?: number;
  color?: number;
}): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(options.radius ?? 5, 24);
  const material = new THREE.MeshBasicMaterial({
    color: options.color ?? 0x0a0f12,
    transparent: true,
    opacity: options.opacity ?? 0.12,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

/** Thin drifting mist boxes near the water/ground. Animate with `updateMist`. */
export function buildMist(options: {
  color?: number;
  count?: number;
  area?: number;
  y?: number;
  opacity?: number;
  seed?: number;
}): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(options.seed ?? 59);
  const color = options.color ?? 0xd9e4e6;
  const count = options.count ?? 5;
  const area = options.area ?? 10;
  const material = MaterialCache.getTransparentLambert(color, options.opacity ?? 0.16);
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(rng.nextFloat(2, 4), 0.125, rng.nextFloat(0.8, 1.6)),
      material,
    );
    mesh.position.set(
      rng.nextFloat(-area / 2, area / 2),
      options.y ?? 0.1,
      rng.nextFloat(-area / 2, area / 2),
    );
    mesh.userData = {
      baseX: mesh.position.x,
      baseZ: mesh.position.z,
      phase: rng.nextFloat(0, Math.PI * 2),
      speed: rng.nextFloat(0.05, 0.16),
    };
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

/** Advance a mist group created by `buildMist`. */
export function updateMist(group: THREE.Group, time: number): void {
  for (const child of group.children) {
    const data = child.userData as {
      baseX?: number;
      baseZ?: number;
      phase?: number;
      speed?: number;
    };
    if (data.baseX === undefined || data.baseZ === undefined) continue;
    child.position.x = data.baseX + Math.sin(time * (data.speed ?? 0.1) + (data.phase ?? 0)) * 0.8;
    child.position.z =
      data.baseZ + Math.cos(time * (data.speed ?? 0.1) * 0.7 + (data.phase ?? 0)) * 0.5;
  }
}

// ── Disposal ────────────────────────────────────────────────────────────

/**
 * Dispose geometry + non-cached materials of a subtree. BaseLocation already
 * performs this traversal on teardown; this helper exists for transient props
 * that are removed mid-scene.
 */
export function disposeArtGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child instanceof THREE.InstancedMesh) child.dispose();
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!MaterialCache.isCached(material)) material.dispose();
    });
  });
}
