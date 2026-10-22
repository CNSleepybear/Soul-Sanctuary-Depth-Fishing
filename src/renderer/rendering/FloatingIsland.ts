// ===== src/renderer/rendering/FloatingIsland.ts =====
// Terraced voxel terrain shared by all 12 sanctuaries.
//
// v2 art pass (docs/art-direction-v2.md §4.1):
// - the island reads as a stack of hand-cut strata (grass flesh, dirt, three
//   stone bands) instead of one flat disc;
// - the top grass layer uses a 0.25 grid so shorelines, paths and mossy edges
//   have somewhere to live;
// - the silhouette is seeded by the location id, so every sanctuary has its
//   own coastline instead of the same circle;
// - floating rock shards hang below the island to sell the "floating diorama"
//   story, and the whole terrain uses one instanced batch per shadow semantic.

import * as THREE from 'three';
import type { LocationTheme } from '../../shared/types';
import { MaterialCache } from './MaterialCache';
import {
  buildFloatingRockCells,
  buildInstancedVoxels,
  createRng,
  hashSeed,
  mixHex,
  shade,
  type InstancedVoxel,
} from './ArtKit';

const GRASS_GRID = 0.25;
const STONE_GRID = 0.5;

interface BandSpec {
  yTop: number;
  thickness: number;
  radius: number;
  color: number;
  grid: number;
  shadeSpread: number;
  moss?: boolean;
}

export class FloatingIsland {
  readonly group = new THREE.Group();
  readonly surfaceY = 1.5;
  /** Nominal surface radius; scenes use it to place shore props. */
  readonly radius: number;
  private baseY = 0;
  private readonly disposables: THREE.InstancedMesh[] = [];

  constructor(theme?: LocationTheme['island'], seedText = 'sanctuary') {
    const palette = theme ?? { stone: 0x788c93, earth: 0x9b795c, grass: 0x88a66b };
    const rng = createRng(hashSeed(seedText));
    const radiusScale = palette.radiusScale ?? 1;
    this.radius = 6.35 * radiusScale;
    this.group.name = 'sanctuary-terrain';

    const grass = palette.grass;
    const grassWarm = mixHex(grass, 0xd8c88c, 0.22);
    const grassCool = mixHex(grass, 0x5b7d68, 0.25);
    const dirt = palette.earth;
    const stone = palette.stone;

    const wobble = rng.nextFloat(0.16, 0.32);
    const notchAngle = rng.nextFloat(0, Math.PI * 2);
    const notchWidth = rng.nextFloat(0.35, 0.7);
    const lobes = rng.nextInt(3, 5);

    /**
     * Coastline radius at a given angle. A couple of low-frequency lobes give
     * the island personality and one soft notch suggests a cove / waterfall
     * cut without breaking the walkable ring.
     */
    const edge = (angle: number): number => {
      let r = this.radius;
      r += Math.sin(angle * lobes + 0.8) * wobble;
      r += Math.cos(angle * 2.3 + 1.7) * 0.22;
      const notch = Math.max(0, Math.cos(angle - notchAngle) - Math.cos(notchWidth));
      r -= Math.max(0, notch) * 0.9;
      return r;
    };

    // ── Strata: grass flesh (0.25 grid) then dirt + three stone bands ──
    const bands: BandSpec[] = [
      {
        yTop: 1.5,
        thickness: 0.25,
        radius: 1.0,
        color: grass,
        grid: GRASS_GRID,
        shadeSpread: 0.07,
      },
      {
        yTop: 1.25,
        thickness: 0.5,
        radius: 0.97,
        color: dirt,
        grid: STONE_GRID,
        shadeSpread: 0.07,
      },
      {
        yTop: 0.75,
        thickness: 0.75,
        radius: 0.9,
        color: stone,
        grid: STONE_GRID,
        shadeSpread: 0.08,
      },
      {
        yTop: 0,
        thickness: 0.75,
        radius: 0.78,
        color: shade(stone, 0.9),
        grid: STONE_GRID,
        shadeSpread: 0.08,
        moss: true,
      },
      {
        yTop: -0.75,
        thickness: 0.75,
        radius: 0.6,
        color: shade(stone, 0.82),
        grid: STONE_GRID,
        shadeSpread: 0.07,
      },
      {
        yTop: -1.5,
        thickness: 0.4,
        radius: 0.4,
        color: shade(stone, 0.74),
        grid: STONE_GRID,
        shadeSpread: 0.06,
      },
      {
        // Submerged tip: the island disappears into the water instead of
        // hovering with a visible gap above it.
        yTop: -1.9,
        thickness: 0.6,
        radius: 0.27,
        color: shade(stone, 0.62),
        grid: STONE_GRID,
        shadeSpread: 0.05,
      },
    ];

    const shadowBatches = [
      { castShadow: true, receiveShadow: true, cells: [] as InstancedVoxel[] },
      { castShadow: false, receiveShadow: true, cells: [] as InstancedVoxel[] },
      { castShadow: false, receiveShadow: false, cells: [] as InstancedVoxel[] },
    ];

    bands.forEach((band, bandIndex) => {
      const cells = this._buildBand(band, bandIndex, rng, edge, grassWarm, grassCool);
      shadowBatches[0].cells.push(...cells);
    });

    // Rim accents: a sparse, stepped grass lip keeps the edge from reading as
    // a razor cut. Only on the top band so props still sit at y = 1.5.
    shadowBatches[1].cells.push(...this._buildRimAccents(rng, edge, grass, grassWarm));
    // A few rocks and flower clusters poking out of the grass.
    shadowBatches[1].cells.push(...this._buildSurfaceScatter(rng, edge, grassWarm, stone));
    // Hanging moss under the grass band.
    shadowBatches[2].cells.push(...this._buildHangingMoss(rng, edge, grass, palette.stone));
    // Floating shards beneath the terrain.
    const rockCells = buildFloatingRockCells({
      stone: shade(stone, 0.72),
      moss: mixHex(grass, 0x8aa06a, 0.4),
      count: 4 + rng.nextInt(0, 2),
      radius: this.radius * 0.85,
      seed: hashSeed(seedText) + 5,
    });
    for (const cell of rockCells) {
      const batch = shadowBatches.find(
        (candidate) =>
          candidate.castShadow === cell.castShadow &&
          candidate.receiveShadow === cell.receiveShadow,
      );
      if (batch) batch.cells.push(cell);
    }

    for (const batch of shadowBatches) {
      if (batch.cells.length === 0) continue;
      const mesh = buildInstancedVoxels(batch.cells, batch);
      this.group.add(mesh);
      this.disposables.push(mesh);
    }
  }

  private _buildBand(
    band: BandSpec,
    bandIndex: number,
    rng: ReturnType<typeof createRng>,
    edge: (angle: number) => number,
    grassWarm: number,
    grassCool: number,
  ): InstancedVoxel[] {
    const cells: InstancedVoxel[] = [];
    const step = band.grid;
    const y = band.yTop - band.thickness / 2;
    const base = new THREE.Color(band.color);
    const warm = new THREE.Color(grassWarm);
    const cool = new THREE.Color(grassCool);
    const patchSeed = rng.nextFloat(0, 10);
    for (let x = -8; x <= 8; x += step) {
      for (let z = -8; z <= 8; z += step) {
        const cx = x + step / 2;
        const cz = z + step / 2;
        const angle = Math.atan2(cz, cx);
        const coast = edge(angle) * band.radius;
        const distance = Math.hypot(cx, cz);
        if (distance > coast) continue;
        const noise = Math.sin(cx * 1.7 + patchSeed) * 0.04 + Math.cos(cz * 2.1 - patchSeed) * 0.04;
        const color = base
          .clone()
          .multiplyScalar(1 + noise + rng.nextFloat(-1, 1) * band.shadeSpread);
        if (bandIndex === 0) {
          // Warm dry patches and cooler moss pockets keep the grass alive.
          const patch = Math.sin(cx * 0.55 + patchSeed) + Math.cos(cz * 0.47 - patchSeed);
          if (patch > 0.9) color.lerp(warm, 0.22);
          else if (patch < -1.0) color.lerp(cool, 0.24);
          // Darker lip right at the coast.
          if (distance > coast - step * 1.5) color.multiplyScalar(0.92);
        }
        if (band.moss && distance > coast - step * 2) color.lerp(new THREE.Color(0x73856a), 0.35);
        cells.push({
          x: cx,
          y,
          z: cz,
          w: step,
          h: band.thickness,
          d: step,
          color: color.getHex(),
        });
      }
    }
    return cells;
  }

  /** Sparse stepped lip cells along the coast (top band only). */
  private _buildRimAccents(
    rng: ReturnType<typeof createRng>,
    edge: (angle: number) => number,
    grass: number,
    grassWarm: number,
  ): InstancedVoxel[] {
    const cells: InstancedVoxel[] = [];
    const count = 18 + rng.nextInt(0, 8);
    for (let i = 0; i < count; i++) {
      const angle = rng.nextFloat(0, Math.PI * 2);
      const r = edge(angle) - rng.nextFloat(0, 0.25);
      const size = rng.nextFloat(0.25, 0.6);
      const color = rng.chance(0.3) ? grassWarm : shade(grass, rng.nextFloat(0.95, 1.12));
      cells.push({
        x: Math.cos(angle) * r,
        y: 1.5 + (rng.chance(0.4) ? 0.125 : 0.0625),
        z: Math.sin(angle) * r,
        w: size,
        h: 0.125,
        d: size,
        color,
        rotY: rng.nextFloat(-0.4, 0.4),
      });
    }
    return cells;
  }

  /** Grass tufts, pebbles and flowers, clustered rather than sprinkled. */
  private _buildSurfaceScatter(
    rng: ReturnType<typeof createRng>,
    edge: (angle: number) => number,
    grassWarm: number,
    stone: number,
  ): InstancedVoxel[] {
    const rngScatter = createRng(rng.nextInt(0, 1_000_000));
    const cells: InstancedVoxel[] = [];
    const clusters = 10;
    for (let c = 0; c < clusters; c++) {
      const angle = rngScatter.nextFloat(0, Math.PI * 2);
      const distance = rngScatter.nextFloat(2.1, Math.max(2.4, edge(angle) - 0.9));
      const cx = Math.cos(angle) * distance;
      const cz = Math.sin(angle) * distance;
      const kind = rngScatter.next();
      if (kind < 0.42) {
        // Flower patch: unwrapped straight into the shared instanced mesh.
        const petal = rngScatter.chance(0.5)
          ? rngScatter.chance(0.5)
            ? grassWarm
            : 0xf2e6c4
          : 0xe4b9c7;
        const count = 7 + rngScatter.nextInt(0, 4);
        for (let i = 0; i < count; i++) {
          const a = rngScatter.nextFloat(0, Math.PI * 2);
          const d = Math.sqrt(rngScatter.next()) * 0.45;
          const h = rngScatter.nextFloat(0.125, 0.3);
          cells.push({
            x: cx + Math.cos(a) * d,
            y: this.surfaceY + h / 2,
            z: cz + Math.sin(a) * d,
            w: 0.0625,
            h,
            d: 0.0625,
            color: 0x6f8a5a,
          });
          cells.push({
            x: cx + Math.cos(a) * d,
            y: this.surfaceY + h + 0.03,
            z: cz + Math.sin(a) * d,
            w: 0.125,
            h: 0.09375,
            d: 0.125,
            color: petal,
          });
        }
      } else if (kind < 0.75) {
        const count = 2 + rngScatter.nextInt(0, 2);
        for (let i = 0; i < count; i++) {
          const a = rngScatter.nextFloat(0, Math.PI * 2);
          const d = rngScatter.nextFloat(0, 0.35);
          const w = rngScatter.nextFloat(0.25, 0.55);
          const h = rngScatter.nextFloat(0.25, 0.5);
          cells.push({
            x: cx + Math.cos(a) * d,
            y: this.surfaceY + h / 2,
            z: cz + Math.sin(a) * d,
            w,
            h,
            d: w * rngScatter.nextFloat(0.7, 1.1),
            color: shade(stone, rngScatter.nextFloat(0.85, 1.08)),
            rotY: rngScatter.nextFloat(-0.4, 0.4),
          });
        }
        if (rngScatter.chance(0.45)) {
          cells.push({
            x: cx,
            y: this.surfaceY + 0.42,
            z: cz,
            w: 0.3,
            h: 0.0625,
            d: 0.25,
            color: mixHex(grassWarm, 0x7f9a6a, 0.5),
          });
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const a = rngScatter.nextFloat(0, Math.PI * 2);
          const d = rngScatter.nextFloat(0, 0.35);
          cells.push({
            x: cx + Math.cos(a) * d,
            y: this.surfaceY + 0.09,
            z: cz + Math.sin(a) * d,
            w: 0.125,
            h: 0.18,
            d: 0.125,
            color: shade(grassWarm, rngScatter.nextFloat(0.85, 1.12)),
          });
        }
      }
    }
    return cells;
  }

  /** Moss strands hanging over the stone band. */
  private _buildHangingMoss(
    rng: ReturnType<typeof createRng>,
    edge: (angle: number) => number,
    grass: number,
    stone: number,
  ): InstancedVoxel[] {
    const cells: InstancedVoxel[] = [];
    const moss = mixHex(grass, 0x6f8a5a, 0.55);
    for (let i = 0; i < 22; i++) {
      const angle = rng.nextFloat(0, Math.PI * 2);
      const r = edge(angle) * 0.88;
      const h = rng.nextFloat(0.25, 0.7);
      cells.push({
        x: Math.cos(angle) * r,
        y: 0.55 - h / 2,
        z: Math.sin(angle) * r,
        w: 0.125,
        h,
        d: 0.125,
        color: rng.chance(0.35) ? shade(stone, 1.05) : moss,
      });
    }
    return cells;
  }

  update(time: number): void {
    this.group.position.y = this.baseY + Math.sin(time * 0.6) * 0.035;
  }

  setPosition(x: number, y: number, z: number): void {
    this.baseY = y;
    this.group.position.set(x, y, z);
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child instanceof THREE.InstancedMesh) child.dispose();
      child.geometry.dispose();
      if (!Array.isArray(child.material) && !MaterialCache.isCached(child.material)) {
        child.material.dispose();
      }
    });
    this.disposables.length = 0;
    this.group.clear();
  }
}
