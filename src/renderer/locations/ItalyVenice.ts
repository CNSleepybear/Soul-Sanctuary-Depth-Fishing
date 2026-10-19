// ===== src/renderer/locations/ItalyVenice.ts =====
// 🇮🇹 Italy �?Venice canal at twilight.
//
// v2 art pass (docs/art-direction-v2.md §2/§4): one dominant landmark (the
// campanile on the right third), a terraced row of ochre / rose / cream palazzi,
// a stone arch bridge over a small rio, striped mooring poles and a
// lantern-lit gondola frame the canal. Every static voxel is flushed into three
// InstancedMesh batches (structure / trim / emissive) so the whole diorama stays
// inside a dozen draw calls on top of the shared base.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { LOCATIONS } from '../data/location-data';
import { Waterfall } from '../rendering/Waterfall';
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

const SURFACE_Y = 1.5;
const TAU = Math.PI * 2;

/**
 * Static voxel staging. Collects every axis-aligned box of the scene and
 * flushes them into three InstancedMesh batches:
 * - solid: casts + receives shadows (silhouette-carrying structure),
 * - trim: receives shadows only (fine facade / shore detail),
 * - emissive: unlit MeshBasicMaterial (windows, lanterns, flames).
 */
class VoxelStage {
  private readonly solidCells: InstancedVoxel[] = [];
  private readonly trimCells: InstancedVoxel[] = [];
  private readonly glowCells: InstancedVoxel[] = [];

  solid(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rotY = 0,
  ): void {
    this.solidCells.push({ x, y, z, w, h, d, color, rotY });
  }

  trim(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rotY = 0,
  ): void {
    this.trimCells.push({ x, y, z, w, h, d, color, rotY });
  }

  glow(x: number, y: number, z: number, w: number, h: number, d: number, color: number): void {
    this.glowCells.push({ x, y, z, w, h, d, color });
  }

  flush(group: THREE.Group): void {
    if (this.solidCells.length > 0) {
      group.add(buildInstancedVoxels(this.solidCells, { castShadow: true, receiveShadow: true }));
    }
    if (this.trimCells.length > 0) {
      group.add(buildInstancedVoxels(this.trimCells, { castShadow: false, receiveShadow: true }));
    }
    if (this.glowCells.length > 0) {
      group.add(
        buildInstancedVoxels(this.glowCells, {
          castShadow: false,
          receiveShadow: false,
          shading: 'basic',
        }),
      );
    }
  }
}

type MoteMode = 'rise' | 'fall' | 'orbit' | 'drift';

interface MoteSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  mode: MoteMode;
  /** Cycles per second of the drift envelope. */
  speed: number;
  /** Sway / orbit amplitude in world units. */
  amp: number;
  /** Deterministic phase, 0..1. */
  phase: number;
  /** Vertical wrap span (rise/fall) or horizontal travel (drift). */
  span: number;
}

/**
 * A single-draw-call animated particle field. Motes are tiny boxes whose
 * matrices are rewritten every frame �?this is the cheap stand-in for
 * per-object particle meshes and keeps the scene at one call per particle type.
 */
class MoteField {
  readonly mesh: THREE.InstancedMesh;
  private readonly motes: MoteSpec[];
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly color = new THREE.Color();

  constructor(motes: MoteSpec[], opts: { additive?: boolean; opacity?: number } = {}) {
    this.motes = motes;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.additive !== true,
      blending: opts.additive === true ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, motes.length));
    motes.forEach((mote, index) => {
      this.color.setHex(mote.color);
      this.mesh.setColorAt(index, this.color);
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = motes.length;
    this.update(0);
  }

  update(time: number): void {
    for (let i = 0; i < this.motes.length; i++) {
      const mote = this.motes[i];
      let x = mote.x;
      let y = mote.y;
      let z = mote.z;
      if (mote.mode === 'rise') {
        y =
          mote.y +
          ((((time * mote.speed + mote.phase * mote.span) % mote.span) + mote.span) % mote.span);
        x += Math.sin(time * mote.speed * 2.1 + mote.phase * TAU) * mote.amp;
        z += Math.cos(time * mote.speed * 1.7 + mote.phase * TAU) * mote.amp;
      } else if (mote.mode === 'fall') {
        y =
          mote.y -
          ((((time * mote.speed + mote.phase * mote.span) % mote.span) + mote.span) % mote.span);
        x += Math.sin(time * 0.9 + mote.phase * TAU) * mote.amp;
      } else if (mote.mode === 'orbit') {
        x += Math.cos(time * mote.speed + mote.phase * TAU) * mote.amp;
        z += Math.sin(time * mote.speed + mote.phase * TAU) * mote.amp;
        y += Math.sin(time * mote.speed * 0.7 + mote.phase * TAU) * mote.amp * 0.6;
      } else {
        x += Math.sin(time * mote.speed + mote.phase * TAU) * mote.amp;
        z +=
          ((((time * mote.speed * 0.36 + mote.phase * mote.span) % mote.span) + mote.span) %
            mote.span) -
          mote.span / 2;
        y += Math.sin(time * mote.speed * 1.3 + mote.phase * TAU) * mote.amp * 0.5;
      }
      this.position.set(x, y, z);
      this.scale.set(mote.w, mote.h, mote.d);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface FlickerSpec {
  light: THREE.PointLight;
  base: number;
  speed: number;
  amp: number;
  phase: number;
}

export class ItalyVenice extends BaseLocation {
  readonly id = 'italy';

  private readonly motes: MoteField[] = [];
  private readonly flickers: FlickerSpec[] = [];
  private readonly floaters: {
    object: THREE.Object3D;
    baseY: number;
    phase: number;
    roll: number;
  }[] = [];
  private waterfall: Waterfall | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'italy')!;
  }

  protected buildGeometry(): void {
    const island = this.createIsland();
    this.group.add(island.group);

    const art = this.art;
    const accent = art.accent ?? 0xc25a4a;
    const glow = art.glow ?? 0xffd08a;
    const shadow = art.shadow ?? 0x3c3350;
    const veil = art.veil ?? 0x332b3f;
    const key = art.key ?? 0xffb37a;

    // 6-colour script �?local Venetian palette (all derived, no new hue family).
    const terracotta = mixHex(accent, 0x7a352a, 0.35);
    const ochre = mixHex(accent, key, 0.7);
    const rose = mixHex(accent, 0xf0cdc0, 0.72);
    const cream = mixHex(key, 0xf3e6cf, 0.58);
    const tile = mixHex(accent, 0x6d2a1f, 0.55);
    const stone = mixHex(shadow, 0x8f8b86, 0.55);
    const stoneLight = mixHex(key, 0xb5a99a, 0.5);
    const dark = shade(shadow, 0.7);
    const wood = mixHex(accent, 0x2b2020, 0.75);
    const rioWater = mixHex(veil, 0x3f6f72, 0.55);

    const stage = new VoxelStage();
    const rng = createRng(hashSeed('italy:venice'));
    const islandRadius = island.radius;

    // ── Landing / campo: a stone waterfront pavement on the camera side ──
    for (let i = 0; i < 30; i++) {
      const angle = 0.05 + (i / 30) * 1.15;
      const radius = islandRadius * rng.nextFloat(0.82, 0.95);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.02,
        Math.sin(angle) * radius,
        rng.nextFloat(0.4, 0.72),
        0.06,
        rng.nextFloat(0.3, 0.6),
        mixHex(stone, stoneLight, rng.nextFloat(0, 0.45)),
        rng.nextFloat(-0.2, 0.2),
      );
    }
    // Campo paving in front of the palazzi.
    for (let i = 0; i < 26; i++) {
      const px = -3.9 + rng.nextFloat(0, 4.6);
      const pz = -1.9 + rng.nextFloat(0, 2.0);
      stage.trim(
        px,
        SURFACE_Y + 0.02,
        pz,
        rng.nextFloat(0.42, 0.7),
        0.05,
        rng.nextFloat(0.34, 0.6),
        mixHex(stone, stoneLight, rng.nextFloat(0, 0.35)),
        rng.nextFloat(-0.15, 0.15),
      );
    }

    // ── Secondary: terraced row of four palazzi ──
    const palazzo = (
      x: number,
      z: number,
      w: number,
      h: number,
      d: number,
      body: number,
      seed: number,
    ): void => {
      const houseRng = createRng(seed);
      stage.solid(x, SURFACE_Y + h / 2, z, w, h, d, body);
      // plaster footing + roof cornice + steep terracotta cap
      stage.trim(x, SURFACE_Y + 0.12, z, w + 0.08, 0.24, d + 0.08, stone);
      stage.trim(x, SURFACE_Y + h + 0.06, z, w + 0.16, 0.12, d + 0.16, tile);
      stage.solid(x, SURFACE_Y + h + 0.2, z, w - 0.1, 0.2, d - 0.1, shade(tile, 0.86));
      stage.solid(x - w * 0.24, SURFACE_Y + h + 0.36, z - d * 0.18, 0.16, 0.44, 0.16, tile);
      // canal facade (+z): glowing windows with dark shutters
      const cols = Math.max(2, Math.round(w / 0.5));
      const rows = Math.max(2, Math.floor(h / 0.85));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const wx = x - w / 2 + (w / (cols + 1)) * (c + 1);
          const wy = SURFACE_Y + 0.55 + r * 0.78;
          if (wy > SURFACE_Y + h - 0.4) continue;
          const lit = houseRng.chance(0.62);
          stage.glow(wx, wy, z + d / 2 + 0.02, 0.2, 0.3, 0.06, lit ? glow : dark);
          stage.trim(wx - 0.15, wy, z + d / 2 + 0.04, 0.07, 0.34, 0.05, shade(accent, 0.4));
          stage.trim(wx + 0.15, wy, z + d / 2 + 0.04, 0.07, 0.34, 0.05, shade(accent, 0.4));
        }
      }
      // little balcony on the piano nobile
      if (w > 1.05) {
        stage.trim(x, SURFACE_Y + h * 0.54, z + d / 2 + 0.1, w * 0.68, 0.06, 0.24, stoneLight);
        for (let b = 0; b < 4; b++) {
          stage.trim(
            x - w * 0.3 + b * (w * 0.2),
            SURFACE_Y + h * 0.54 + 0.16,
            z + d / 2 + 0.19,
            0.05,
            0.3,
            0.05,
            dark,
          );
        }
      }
      // awning stripes over the ground-floor door
      stage.trim(x, SURFACE_Y + 0.52, z + d / 2 + 0.14, 0.7, 0.06, 0.3, cream);
      stage.trim(x, SURFACE_Y + 0.52, z + d / 2 + 0.15, 0.7, 0.05, 0.12, terracotta);
    };
    palazzo(-4.0, -1.7, 1.5, 2.4, 1.35, terracotta, hashSeed('it:p1'));
    palazzo(-2.65, -2.5, 1.2, 3.0, 1.3, ochre, hashSeed('it:p2'));
    palazzo(-1.35, -2.9, 1.1, 2.6, 1.25, rose, hashSeed('it:p3'));
    palazzo(-0.1, -3.1, 1.35, 3.2, 1.4, cream, hashSeed('it:p4'));

    // ── Landmark: campanile on the right third (height �?4.6 above the grass) ──
    const campanileX = 1.55;
    const campanileZ = -3.2;
    stage.trim(campanileX, SURFACE_Y + 0.16, campanileZ, 1.15, 0.32, 1.15, stone);
    stage.solid(campanileX, SURFACE_Y + 0.32 + 1.25, campanileZ, 0.8, 2.5, 0.8, cream);
    // brick banding + clock face
    stage.trim(campanileX, SURFACE_Y + 0.95, campanileZ, 0.86, 0.1, 0.86, terracotta);
    stage.trim(campanileX, SURFACE_Y + 1.85, campanileZ, 0.86, 0.1, 0.86, terracotta);
    stage.glow(campanileX, SURFACE_Y + 2.35, campanileZ + 0.43, 0.36, 0.36, 0.06, cream);
    stage.trim(campanileX, SURFACE_Y + 2.35, campanileZ + 0.47, 0.04, 0.3, 0.04, dark);
    stage.trim(campanileX, SURFACE_Y + 2.35, campanileZ + 0.47, 0.26, 0.04, 0.04, dark);
    // belfry: four corner piers, glowing arch openings, cornice
    stage.trim(campanileX, SURFACE_Y + 3.17, campanileZ, 1.0, 0.7, 1.0, cream);
    for (const [dx, dz] of [
      [-0.36, -0.36],
      [0.36, -0.36],
      [-0.36, 0.36],
      [0.36, 0.36],
    ]) {
      stage.solid(campanileX + dx, SURFACE_Y + 3.17, campanileZ + dz, 0.18, 0.7, 0.18, cream);
    }
    stage.glow(campanileX, SURFACE_Y + 3.17, campanileZ + 0.38, 0.34, 0.42, 0.08, glow);
    stage.glow(campanileX, SURFACE_Y + 3.17, campanileZ - 0.38, 0.34, 0.42, 0.08, glow);
    stage.trim(campanileX, SURFACE_Y + 3.6, campanileZ, 1.1, 0.12, 1.1, stone);
    // tapering terracotta cupola + gold cross
    stage.solid(
      campanileX,
      SURFACE_Y + 3.78,
      campanileZ,
      0.9,
      0.22,
      0.9,
      mixHex(tile, accent, 0.3),
    );
    stage.solid(
      campanileX,
      SURFACE_Y + 4.0,
      campanileZ,
      0.62,
      0.22,
      0.62,
      mixHex(tile, accent, 0.3),
    );
    stage.solid(
      campanileX,
      SURFACE_Y + 4.22,
      campanileZ,
      0.34,
      0.22,
      0.34,
      mixHex(tile, accent, 0.3),
    );
    stage.glow(campanileX, SURFACE_Y + 4.48, campanileZ, 0.06, 0.32, 0.06, glow);
    stage.glow(campanileX, SURFACE_Y + 4.52, campanileZ, 0.22, 0.06, 0.06, glow);

    // ── Secondary: stone arch bridge over the rio ──
    const bridgeX = 3.5;
    const bridgeZ = 0.2;
    const span = 2.2;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const bx = bridgeX - span / 2 + span * t;
      const by = SURFACE_Y + 0.14 + Math.sin(t * Math.PI) * 0.42;
      stage.solid(bx, by, bridgeZ, span / 8 + 0.02, 0.12, 0.9, stoneLight);
      if (i > 0 && i < 8 && i % 2 === 0) {
        stage.trim(bx, by + 0.3, bridgeZ + 0.4, 0.09, 0.5, 0.09, stone);
        stage.trim(bx, by + 0.3, bridgeZ - 0.4, 0.09, 0.5, 0.09, stone);
      }
    }
    stage.trim(bridgeX, SURFACE_Y + 0.92, bridgeZ + 0.4, span, 0.08, 0.08, stone);
    stage.trim(bridgeX, SURFACE_Y + 0.92, bridgeZ - 0.4, span, 0.08, 0.08, stone);
    // steps up to the arch at both ends
    for (let i = 0; i < 3; i++) {
      stage.solid(
        bridgeX - span / 2 - 0.12 - i * 0.16,
        SURFACE_Y + 0.1 + i * 0.04,
        bridgeZ,
        0.18,
        0.12,
        1.0,
        stone,
      );
      stage.solid(
        bridgeX + span / 2 + 0.12 + i * 0.16,
        SURFACE_Y + 0.1 + i * 0.04,
        bridgeZ,
        0.18,
        0.12,
        1.0,
        stone,
      );
    }
    // stone banks of the rio
    for (let i = 0; i < 12; i++) {
      const bx = bridgeX - 1.7 + i * 0.32;
      stage.trim(bx, SURFACE_Y + 0.03, bridgeZ - 0.62, 0.3, 0.1, 0.16, stone);
      stage.trim(bx, SURFACE_Y + 0.03, bridgeZ + 0.62, 0.3, 0.1, 0.16, stone);
    }

    // ── Rio water: a narrow canal inset in the campo ──
    const rioMaterial = new THREE.MeshLambertMaterial({
      color: rioWater,
      flatShading: true,
      transparent: true,
      opacity: 0.88,
    });
    const rio = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 0.98), rioMaterial);
    rio.position.set(bridgeX, SURFACE_Y - 0.04, bridgeZ);
    rio.receiveShadow = true;
    this.group.add(rio);

    // ── Secondary: striped mooring poles out in the lagoon ──
    const mooringPole = (angle: number, radius: number, height: number, seed: number): void => {
      const poleRng = createRng(seed);
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const baseY = -1.9;
      stage.trim(px, baseY + 0.08, pz, 0.3, 0.16, 0.3, stone);
      const segments = Math.round(height / 0.25);
      for (let i = 0; i < segments; i++) {
        const striped = i % 2 === 0 ? accent : cream;
        stage.solid(px, baseY + 0.125 + i * 0.25, pz, 0.14, 0.25, 0.14, striped, 0);
      }
      stage.glow(px, baseY + height + 0.12, pz, 0.16, 0.16, 0.16, glow);
      stage.trim(px, baseY + height + 0.28, pz, 0.22, 0.06, 0.22, wood);
      if (poleRng.chance(0.5)) {
        stage.trim(px + 0.1, baseY + height - 0.2, pz, 0.3, 0.1, 0.1, cream);
      }
    };
    mooringPole(0.2, 6.85, 1.85, hashSeed('it:pole1'));
    mooringPole(0.42, 7.02, 1.6, hashSeed('it:pole2'));
    mooringPole(0.64, 6.92, 1.95, hashSeed('it:pole3'));

    // ── Landmark secondary: gondola with a gondolier, bobbing in the lagoon ──
    const gondolaCells: InstancedVoxel[] = [];
    const pushGondola = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ): void => {
      gondolaCells.push({ x, y, z, w, h, d, color });
    };
    const hull = shade(veil, 0.55);
    pushGondola(0, 0.1, 0, 2.5, 0.18, 0.24, hull);
    pushGondola(0, 0.24, 0, 1.9, 0.14, 0.2, mixHex(hull, dark, 0.4));
    pushGondola(1.18, 0.32, 0, 0.22, 0.5, 0.1, hull);
    pushGondola(1.3, 0.62, 0, 0.18, 0.2, 0.08, cream);
    pushGondola(-1.18, 0.28, 0, 0.22, 0.4, 0.1, hull);
    pushGondola(0, 0.3, 0, 0.8, 0.1, 0.22, mixHex(accent, key, 0.3));
    // gondolier: striped shirt, head, straw hat, oar
    pushGondola(-0.78, 0.62, 0, 0.18, 0.38, 0.18, cream);
    pushGondola(-0.78, 0.68, 0.02, 0.19, 0.2, 0.2, shade(accent, 1.1));
    pushGondola(-0.78, 0.9, 0, 0.16, 0.16, 0.16, mixHex(key, 0x8a6a50, 0.5));
    pushGondola(-0.78, 1.01, 0, 0.24, 0.06, 0.24, mixHex(ochre, 0x3a2e20, 0.4));
    pushGondola(-1.1, 0.5, 0, 0.05, 0.05, 1.1, wood);
    const gondola = buildInstancedVoxels(gondolaCells, {
      castShadow: true,
      receiveShadow: true,
    });
    gondola.position.set(7.0, -1.9, -0.5);
    gondola.rotation.y = 0.6;
    this.group.add(gondola);
    this.floaters.push({ object: gondola, baseY: -1.9, phase: 0.4, roll: 0.02 });

    // ── Foreground frame: waterfront pots and a stone bollard ──
    const pot = (x: number, z: number, seed: number): void => {
      const potRng = createRng(seed);
      stage.solid(x, SURFACE_Y + 0.2, z, 0.3, 0.4, 0.3, mixHex(accent, 0x8a4a34, 0.5));
      stage.trim(x, SURFACE_Y + 0.42, z, 0.34, 0.06, 0.34, stoneLight);
      for (let i = 0; i < 5; i++) {
        const a = potRng.nextFloat(0, TAU);
        const r = potRng.nextFloat(0, 0.16);
        stage.trim(
          x + Math.cos(a) * r,
          SURFACE_Y + 0.55 + potRng.nextFloat(0, 0.15),
          z + Math.sin(a) * r,
          0.1,
          0.14,
          0.1,
          mixHex(accent, 0xe36a86, potRng.nextFloat(0.2, 0.6)),
        );
      }
      stage.trim(x, SURFACE_Y + 0.53, z, 0.2, 0.05, 0.2, mixHex(accent, 0x6f8a5a, 0.55));
    };
    pot(5.0, 2.3, hashSeed('it:pot1'));
    pot(5.5, 1.55, hashSeed('it:pot2'));
    pot(4.55, 2.9, hashSeed('it:pot3'));
    // low stone bollards along the landing
    for (let i = 0; i < 4; i++) {
      stage.trim(4.2 + i * 0.55, SURFACE_Y + 0.22, 3.25, 0.2, 0.44, 0.2, stone);
      stage.trim(4.2 + i * 0.55, SURFACE_Y + 0.46, 3.25, 0.26, 0.08, 0.26, stoneLight);
    }
    // a bench under the palazzi
    stage.trim(-2.9, SURFACE_Y + 0.26, -0.9, 0.9, 0.08, 0.3, wood);
    stage.trim(-3.25, SURFACE_Y + 0.14, -0.9, 0.1, 0.28, 0.26, wood);
    stage.trim(-2.55, SURFACE_Y + 0.14, -0.9, 0.1, 0.28, 0.26, wood);

    stage.flush(this.group);

    // ── Local warm lights: palazzo lantern, bridge lamp, gondola lantern ──
    const lanternLight = (
      x: number,
      y: number,
      z: number,
      intensity: number,
      distance: number,
      speed: number,
      amp: number,
      phase: number,
      color = glow,
    ): void => {
      const light = new THREE.PointLight(color, intensity, distance);
      light.position.set(x, y, z);
      this.group.add(light);
      this.flickers.push({ light, base: intensity, speed, amp, phase });
    };
    lanternLight(-0.7, SURFACE_Y + 2.0, -2.1, 4.2, 7.5, 1.7, 0.5, 0.2);
    lanternLight(4.2, SURFACE_Y + 1.0, 0.2, 3.2, 5.5, 2.4, 0.4, 1.4);
    lanternLight(6.6, -0.7, 0.6, 2.6, 5, 3.1, 0.5, 2.6);

    // ── One volumetric hero: halo on the campanile belfry + twilight shafts ──
    const halo = buildGlowOrb({
      color: glow,
      size: 0.34,
      position: new THREE.Vector3(campanileX, SURFACE_Y + 3.42, campanileZ),
      layers: 2,
    });
    this.group.add(halo);
    const shafts = buildLightShaft({
      color: mixHex(glow, key, 0.45),
      height: 8,
      width: 2.4,
      opacity: 0.06,
      count: 2,
      seed: hashSeed('italy:shaft'),
    });
    shafts.position.set(0.4, 0, -0.6);
    this.group.add(shafts);

    // ── Shared floating-island waterfall on the far rim ──
    this.waterfall = new Waterfall({
      radius: islandRadius + 0.25,
      innerRadius: islandRadius - 0.2,
      yBase: -0.2,
      heightMin: 2.2,
      heightMax: 3.2,
      color: mixHex(rioWater, 0x9fd0c8, 0.4),
      opacity: 0.55,
      density: 0.75,
    });
    this.group.add(this.waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glow = art.glow ?? 0xffd08a;
    const accent = art.accent ?? 0xc25a4a;
    const veil = art.veil ?? 0x332b3f;
    const key = art.key ?? 0xffb37a;
    const rng = createRng(hashSeed('italy:atmosphere'));

    // 1) Lagoon reflections: stretched additive dashes under the palazzi.
    const reflections: MoteSpec[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = rng.nextFloat(0.06, 1.05);
      const radius = rng.nextFloat(6.4, 7.3);
      reflections.push({
        x: Math.cos(angle) * radius,
        y: -1.87,
        z: Math.sin(angle) * radius,
        w: rng.nextFloat(0.14, 0.26),
        h: 0.03,
        d: rng.nextFloat(0.7, 1.5),
        color: mixHex(i % 3 === 0 ? accent : glow, 0x8fd8d0, 0.25),
        mode: 'drift',
        speed: 0.18,
        amp: 0.16,
        phase: rng.next(),
        span: 0.8,
      });
    }
    this.motes.push(new MoteField(reflections, { additive: true, opacity: 0.5 }));

    // 2) Lantern fireflies drifting through the campo.
    const fireflies: MoteSpec[] = [];
    for (let i = 0; i < 16; i++) {
      fireflies.push({
        x: rng.nextFloat(-3.6, 4.6),
        y: SURFACE_Y + rng.nextFloat(0.6, 3.0),
        z: rng.nextFloat(-2.8, 2.8),
        w: 0.09,
        h: 0.09,
        d: 0.09,
        color: mixHex(glow, 0xfff2c8, rng.nextFloat(0.1, 0.5)),
        mode: 'orbit',
        speed: rng.nextFloat(0.35, 0.7),
        amp: rng.nextFloat(0.25, 0.7),
        phase: rng.next(),
        span: 1,
      });
    }
    this.motes.push(new MoteField(fireflies, { additive: true, opacity: 0.8 }));

    // 3) Canal mist rising off the lagoon.
    const mist: MoteSpec[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(5.6, 7.4);
      mist.push({
        x: Math.cos(angle) * radius,
        y: -1.9,
        z: Math.sin(angle) * radius,
        w: rng.nextFloat(0.6, 1.2),
        h: 0.1,
        d: rng.nextFloat(0.5, 0.9),
        color: mixHex(veil, 0xa9c4c8, 0.55),
        mode: 'rise',
        speed: 0.05,
        amp: 0.14,
        phase: rng.next(),
        span: 1.6,
      });
    }
    this.motes.push(new MoteField(mist, { opacity: 0.14 }));

    // Warm sparkle above the campanile so the landmark keeps a glow focus.
    const sparks: MoteSpec[] = [];
    for (let i = 0; i < 8; i++) {
      sparks.push({
        x: 1.55 + rng.nextFloat(-0.4, 0.4),
        y: SURFACE_Y + 3.3,
        z: -3.2 + rng.nextFloat(-0.4, 0.4),
        w: 0.07,
        h: 0.07,
        d: 0.07,
        color: mixHex(glow, key, 0.3),
        mode: 'rise',
        speed: 0.16,
        amp: 0.12,
        phase: rng.next(),
        span: 1.8,
      });
    }
    this.motes.push(new MoteField(sparks, { additive: true, opacity: 0.65 }));

    for (const mote of this.motes) this.group.add(mote.mesh);
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    this.waterfall?.update(time);
    for (const mote of this.motes) mote.update(time);
    for (const flicker of this.flickers) {
      flicker.light.intensity =
        flicker.base + Math.sin(time * flicker.speed + flicker.phase) * flicker.amp;
    }
    for (const floater of this.floaters) {
      floater.object.position.y = floater.baseY + Math.sin(time * 0.9 + floater.phase) * 0.03;
      floater.object.rotation.z = Math.sin(time * 1.1 + floater.phase) * floater.roll;
    }
  }

  destroy(): void {
    this.waterfall?.dispose();
    this.waterfall = null;
    this.motes.length = 0;
    this.flickers.length = 0;
    this.floaters.length = 0;
    super.destroy();
  }
}
