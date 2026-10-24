// ===== src/renderer/locations/DenmarkNyhavn.ts =====
// 🇩🇰 Denmark �?Nyhavn winter night.
//
// v2 art pass: a copper-green spire anchors the left third, six townhouses with
// deliberately uneven widths close the backdrop, two wooden sailing ships sit in
// the harbour and a snow-dusted quay frames the foreground. All static voxels
// are flushed into three InstancedMesh batches.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { LOCATIONS } from '../data/location-data';
import { Waterfall } from '../rendering/Waterfall';
import type { LocationData } from '../../shared/types';
import {
  buildGlowOrb,
  buildInstancedVoxels,
  createRng,
  hashSeed,
  mixHex,
  shade,
  type InstancedVoxel,
} from '../rendering/ArtKit';

const SURFACE_Y = 1.5;
const TAU = Math.PI * 2;

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
  speed: number;
  amp: number;
  phase: number;
  span: number;
}

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
        x += Math.sin(time * 0.8 + mote.phase * TAU) * mote.amp;
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

export class DenmarkNyhavn extends BaseLocation {
  readonly id = 'denmark';

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
    return LOCATIONS.find((l) => l.id === 'denmark')!;
  }

  protected buildGeometry(): void {
    const island = this.createIsland();
    this.group.add(island.group);

    const art = this.art;
    const accent = art.accent ?? 0x7fb0a0;
    const glow = art.glow ?? 0xffbe6b;
    const shadow = art.shadow ?? 0x263244;
    const veil = art.veil ?? 0x1a2634;
    const key = art.key ?? 0xa9c4e8;
    const islandRadius = island.radius;

    // Local Nyhavn palette (derived from the 6-colour script, muted for snow).
    const houseRed = mixHex(key, 0xa8493c, 0.55);
    const houseYellow = mixHex(glow, key, 0.35);
    const houseBlue = mixHex(key, 0x3a5a8a, 0.5);
    const houseGreen = mixHex(accent, 0x2f6a52, 0.4);
    const houseOchre = mixHex(glow, 0xa8763c, 0.4);
    const houseTeal = accent;
    const roofDark = mixHex(shadow, 0x161b22, 0.4);
    const snow = mixHex(key, 0xf2f5fa, 0.7);
    const snowShade = mixHex(snow, veil, 0.24);
    const copper = mixHex(accent, 0x4a8a7a, 0.55);
    const wood = mixHex(shadow, 0x4a3426, 0.5);
    const tallow = glow;

    const stage = new VoxelStage();
    const rng = createRng(hashSeed('denmark:nyhavn'));

    // ── Quay: snow-dusted stone strip along the camera side ──
    for (let i = 0; i < 30; i++) {
      const angle = 0.05 + (i / 30) * 1.25;
      const radius = islandRadius * rng.nextFloat(0.8, 0.94);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.03,
        Math.sin(angle) * radius,
        rng.nextFloat(0.45, 0.8),
        0.08,
        rng.nextFloat(0.3, 0.55),
        mixHex(snowShade, snow, rng.nextFloat(0, 0.6)),
        rng.nextFloat(-0.2, 0.2),
      );
    }
    // Snow drifts hugging the waterfront.
    for (let i = 0; i < 14; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(2.4, islandRadius - 0.7);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.09,
        Math.sin(angle) * radius,
        rng.nextFloat(0.5, 0.9),
        0.14,
        rng.nextFloat(0.35, 0.6),
        rng.chance(0.5) ? snow : snowShade,
        rng.nextFloat(-0.4, 0.4),
      );
    }

    // ── Landmark: copper-green Copenhagen spire on the left third ──
    const spireX = -3.2;
    const spireZ = -2.5;
    stage.trim(spireX, SURFACE_Y + 0.18, spireZ, 1.1, 0.36, 1.1, snowShade);
    stage.solid(
      spireX,
      SURFACE_Y + 0.36 + 1.35,
      spireZ,
      0.85,
      2.7,
      0.85,
      mixHex(houseOchre, shadow, 0.35),
    );
    stage.trim(spireX, SURFACE_Y + 1.4, spireZ, 0.9, 0.1, 0.9, snow);
    stage.glow(spireX, SURFACE_Y + 2.3, spireZ + 0.46, 0.3, 0.42, 0.07, tallow);
    // copper spire: stepped taper + gold ball
    stage.solid(spireX, SURFACE_Y + 3.14, spireZ, 0.78, 0.2, 0.78, copper);
    stage.solid(spireX, SURFACE_Y + 3.36, spireZ, 0.6, 0.2, 0.6, copper);
    stage.solid(spireX, SURFACE_Y + 3.58, spireZ, 0.42, 0.2, 0.42, copper);
    stage.solid(spireX, SURFACE_Y + 3.8, spireZ, 0.26, 0.2, 0.26, copper);
    stage.solid(spireX, SURFACE_Y + 4.02, spireZ, 0.12, 0.24, 0.12, copper);
    stage.glow(spireX, SURFACE_Y + 4.22, spireZ, 0.12, 0.12, 0.12, glow);

    // ── Secondary: six non-repeating Nyhavn facades and stepped gables ──
    const houseSpecs: { x: number; w: number; h: number; color: number }[] = [
      { x: -2.15, w: 1.0, h: 2.5, color: houseYellow },
      { x: -1.2, w: 0.85, h: 2.95, color: houseRed },
      { x: -0.3, w: 1.25, h: 2.35, color: houseGreen },
      { x: 0.85, w: 0.8, h: 2.75, color: houseBlue },
      { x: 1.75, w: 1.15, h: 2.5, color: houseOchre },
      { x: 2.85, w: 0.95, h: 3.05, color: houseTeal },
    ];
    for (let i = 0; i < houseSpecs.length; i++) {
      const spec = houseSpecs[i];
      const z = -3.15 + (i % 2) * 0.2;
      const bodyDepth = 1.35;
      const front = z + bodyDepth / 2;
      const trimColor = i % 2 ? snowShade : mixHex(snow, spec.color, 0.12);
      stage.solid(spec.x, SURFACE_Y + spec.h / 2, z, spec.w, spec.h, bodyDepth, spec.color);
      stage.trim(
        spec.x,
        SURFACE_Y + 0.12,
        front + 0.025,
        spec.w + 0.04,
        0.24,
        0.07,
        shade(spec.color, 0.7),
      );
      stage.trim(
        spec.x,
        SURFACE_Y + spec.h - 0.08,
        front + 0.04,
        spec.w + 0.12,
        0.14,
        0.12,
        trimColor,
      );
      // Three roof rhythms: stair gable, broad cornice and narrow pointed gable.
      const roofSteps = i % 3 === 1 ? 3 : 5;
      for (let step = 0; step < roofSteps; step++) {
        const rw = spec.w * (1 - step / (roofSteps + 0.3));
        const ry = SURFACE_Y + spec.h + 0.08 + step * 0.17;
        stage.solid(spec.x, ry, z, rw, 0.2, bodyDepth * (0.96 - step * 0.035), roofDark);
        stage.trim(
          spec.x,
          ry + 0.12,
          z,
          rw * 0.96,
          0.07,
          bodyDepth * (0.92 - step * 0.035),
          step % 2 ? snowShade : snow,
        );
        if (i % 3 !== 1) {
          stage.trim(spec.x, ry, front + 0.025, rw * 0.9, 0.16, 0.08, spec.color);
          stage.trim(spec.x - rw / 2, ry + 0.09, front + 0.08, 0.1, 0.1, 0.12, snow);
          stage.trim(spec.x + rw / 2, ry + 0.09, front + 0.08, 0.1, 0.1, 0.12, snow);
        }
      }
      if (i % 3 !== 1) {
        const atticY = SURFACE_Y + spec.h + 0.34;
        stage.trim(spec.x, atticY, front + 0.1, 0.25, 0.3, 0.07, trimColor);
        stage.glow(spec.x, atticY, front + 0.15, 0.13, 0.18, 0.04, tallow);
      }
      // Individual floor counts, window mullions, sills and shutters.
      const floors = Math.max(2, Math.floor(spec.h / 0.76));
      for (let floor = 0; floor < floors; floor++) {
        const wy = SURFACE_Y + 0.62 + floor * 0.72;
        if (wy > SURFACE_Y + spec.h - 0.35) continue;
        for (const dir of [-1, 1]) {
          const wx = spec.x + dir * spec.w * 0.23;
          stage.trim(wx, wy, front + 0.04, 0.3, 0.39, 0.06, trimColor);
          stage.glow(
            wx,
            wy,
            front + 0.08,
            0.2,
            0.28,
            0.04,
            floor === 0 && i % 2 ? mixHex(tallow, shadow, 0.45) : tallow,
          );
          stage.trim(wx, wy, front + 0.115, 0.035, 0.29, 0.025, roofDark);
          stage.trim(wx, wy, front + 0.115, 0.21, 0.035, 0.025, roofDark);
          stage.trim(wx, wy - 0.22, front + 0.1, 0.36, 0.07, 0.16, snowShade);
          if ((i + floor) % 3 === 0) {
            stage.trim(wx + dir * 0.22, wy, front + 0.07, 0.1, 0.38, 0.05, roofDark);
          }
        }
      }
      // Ground-floor doors and shopfronts vary by house.
      stage.trim(spec.x, SURFACE_Y + 0.4, front + 0.075, 0.3, 0.7, 0.08, i % 2 ? roofDark : wood);
      stage.glow(spec.x, SURFACE_Y + 0.52, front + 0.125, 0.16, 0.28, 0.035, tallow);
      stage.trim(spec.x + 0.1, SURFACE_Y + 0.38, front + 0.14, 0.04, 0.04, 0.025, glow);
      stage.trim(spec.x, SURFACE_Y + 0.06, front + 0.2, 0.48, 0.12, 0.34, snowShade);
      if (i === 0 || i === 3 || i === 5) {
        stage.trim(
          spec.x,
          SURFACE_Y + 1.02,
          front + 0.15,
          spec.w * 0.84,
          0.25,
          0.12,
          i === 3 ? houseRed : roofDark,
        );
        for (let mark = 0; mark < 3; mark++) {
          stage.trim(
            spec.x - 0.2 + mark * 0.2,
            SURFACE_Y + 1.04,
            front + 0.22,
            0.09,
            0.06,
            0.025,
            tallow,
          );
        }
      }
      if (i === 2) {
        for (const side of [-1, 1]) {
          stage.trim(spec.x + side * 0.42, SURFACE_Y + 1.6, front + 0.18, 0.18, 0.3, 0.28, wood);
          stage.trim(spec.x + side * 0.42, SURFACE_Y + 1.8, front + 0.18, 0.22, 0.1, 0.3, houseRed);
        }
      }
      stage.solid(
        spec.x - spec.w * 0.24,
        SURFACE_Y + spec.h + 0.52,
        z - 0.2,
        0.16,
        0.62,
        0.16,
        i % 2 ? houseRed : roofDark,
      );
      stage.trim(
        spec.x - spec.w * 0.24,
        SURFACE_Y + spec.h + 0.85,
        z - 0.2,
        0.24,
        0.08,
        0.24,
        snow,
      );
    }

    // ── Secondary: clinker-built sailing ships with yards and stepped rigging ──
    const buildShip = (length: number, seed: number): THREE.InstancedMesh => {
      const shipRng = createRng(seed);
      const cells: InstancedVoxel[] = [];
      const push = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: number,
      ) => {
        cells.push({ x, y, z, w, h, d, color });
      };
      const rope = mixHex(wood, shadow, 0.55);
      const segments = 9;
      for (let s = 0; s < segments; s++) {
        const t = s / (segments - 1);
        const sx = -length / 2 + t * length;
        const width = 0.16 + Math.sin(t * Math.PI) * 0.5;
        const lift = Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.22;
        push(sx, 0.2 + lift, 0, length / segments + 0.03, 0.3, width, wood);
        push(sx, 0.39 + lift, 0, length / segments + 0.03, 0.08, width * 0.9, shade(wood, 1.15));
        for (const side of [-1, 1]) {
          push(
            sx,
            0.32 + lift,
            side * width * 0.48,
            length / segments + 0.03,
            0.055,
            0.045,
            shade(wood, 0.72),
          );
          push(
            sx,
            0.46 + lift,
            side * width * 0.46,
            length / segments + 0.03,
            0.06,
            0.06,
            snowShade,
          );
        }
      }
      push(-length * 0.3, 0.58, 0, length * 0.25, 0.28, 0.48, shade(wood, 0.85));
      push(-length * 0.3, 0.75, 0, length * 0.28, 0.08, 0.52, snow);
      push(length * 0.53, 0.62, 0, 0.65, 0.08, 0.08, wood);
      const mastXs = [-length * 0.25, length * 0.18];
      mastXs.forEach((mastX, mi) => {
        const mastH = 2.35 + mi * 0.35;
        const top = 0.48 + mastH;
        push(mastX, 0.48 + mastH / 2, 0, 0.075, mastH, 0.075, wood);
        push(mastX, top + 0.12, 0, 0.045, 0.3, 0.045, shade(wood, 1.1));
        for (const yard of [0.58, 0.8]) {
          const yy = 0.48 + mastH * yard;
          push(mastX, yy, 0, 1.15 - yard * 0.35, 0.065, 0.065, wood);
          push(mastX, yy - 0.09, 0.03, 0.9 - yard * 0.25, 0.12, 0.12, mixHex(snow, shadow, 0.25));
          push(mastX, yy - 0.02, 0.04, 0.94 - yard * 0.25, 0.035, 0.13, snow);
        }
        // Shrouds and stays are dotted stair-steps, all in the same ship batch.
        for (const side of [-1, 1]) {
          for (let r = 0; r < 10; r++) {
            const t = r / 9;
            push(
              mastX + side * (0.08 + t * 0.62),
              top - 0.18 - t * (mastH - 0.35),
              side * 0.04,
              0.035,
              0.26,
              0.035,
              rope,
            );
          }
        }
        for (let r = 0; r < 9; r++) {
          const t = r / 8;
          push(
            mastX + t * (length * 0.47 - mastX),
            top - t * (top - 0.68),
            0,
            0.2,
            0.035,
            0.035,
            rope,
          );
        }
      });
      for (let r = 0; r < 10; r++) {
        const t = r / 9;
        push(
          mastXs[0] + (mastXs[1] - mastXs[0]) * t,
          2.45 + Math.sin(t * Math.PI) * 0.18,
          0,
          0.18,
          0.035,
          0.035,
          rope,
        );
      }
      push(mastXs[1] + 0.18, 3.0, 0, 0.38, 0.16, 0.035, houseRed);
      const ship = buildInstancedVoxels(cells, { castShadow: true, receiveShadow: true });
      const angle = shipRng.nextFloat(0.08, 0.6);
      const radius = shipRng.nextFloat(6.8, 7.4);
      ship.position.set(Math.cos(angle) * radius, -1.9, Math.sin(angle) * radius);
      ship.rotation.y = shipRng.nextFloat(-0.5, 0.5);
      this.group.add(ship);
      this.floaters.push({
        object: ship,
        baseY: -1.9,
        phase: shipRng.nextFloat(0, TAU),
        roll: 0.025,
      });
      return ship;
    };
    buildShip(2.8, hashSeed('dk:ship1'));
    buildShip(2.2, hashSeed('dk:ship2'));

    // ── Foreground frame: snow-dusted dock, barrels, crates, bollards ──
    const dockX = 4.5;
    const dockZ = 2.1;
    for (let i = 0; i < 6; i++) {
      stage.solid(dockX - 0.9 + i * 0.36, SURFACE_Y + 0.12, dockZ, 0.36, 0.14, 1.5, wood);
      stage.trim(dockX - 0.9 + i * 0.36, SURFACE_Y + 0.2, dockZ, 0.34, 0.04, 1.44, snow);
    }
    for (const [px, pz] of [
      [dockX - 1.0, dockZ - 0.7],
      [dockX + 1.1, dockZ - 0.7],
      [dockX - 1.0, dockZ + 0.7],
      [dockX + 1.1, dockZ + 0.7],
    ]) {
      stage.solid(px, SURFACE_Y + 0.05, pz, 0.14, 1.0, 0.14, roofDark);
      stage.trim(px, SURFACE_Y + 0.6, pz, 0.18, 0.06, 0.18, snow);
    }
    // barrels + crates
    for (let i = 0; i < 3; i++) {
      stage.solid(
        3.5 + i * 0.42,
        SURFACE_Y + 0.28,
        3.0 + i * 0.16,
        0.34,
        0.56,
        0.34,
        shade(wood, 1.05),
      );
      stage.trim(3.5 + i * 0.42, SURFACE_Y + 0.5, 3.0 + i * 0.16, 0.36, 0.06, 0.36, roofDark);
    }
    stage.solid(5.4, SURFACE_Y + 0.22, 3.0, 0.5, 0.44, 0.44, wood);
    stage.trim(5.4, SURFACE_Y + 0.45, 3.0, 0.52, 0.05, 0.46, snow);
    // Iron hoops, mooring cleats and a box-built coil make the dock feel worked in.
    for (let i = 0; i < 3; i++) {
      for (const y of [0.12, 0.4]) {
        stage.trim(3.5 + i * 0.42, SURFACE_Y + y, 3.0 + i * 0.16, 0.37, 0.045, 0.37, roofDark);
      }
    }
    for (const x of [3.6, 5.3]) {
      stage.solid(x, SURFACE_Y + 0.3, 1.45, 0.18, 0.42, 0.18, roofDark);
      stage.trim(x, SURFACE_Y + 0.5, 1.45, 0.42, 0.09, 0.14, roofDark);
      stage.trim(x, SURFACE_Y + 0.57, 1.45, 0.2, 0.05, 0.18, snow);
    }
    for (let segment = 0; segment < 8; segment++) {
      const a = (segment / 8) * TAU;
      stage.trim(
        5.25 + Math.cos(a) * 0.28,
        SURFACE_Y + 0.24,
        2.25 + Math.sin(a) * 0.28,
        0.18,
        0.06,
        0.08,
        shade(wood, 1.25),
        -a,
      );
    }

    // ── Local warm lights: framed lanterns, fluted posts and warm window spill ──
    const harbourLamp = (x: number, z: number, intensity: number, phase: number): void => {
      stage.solid(x, SURFACE_Y + 0.12, z, 0.34, 0.24, 0.34, roofDark);
      stage.solid(x, SURFACE_Y + 1.03, z, 0.1, 1.9, 0.1, roofDark);
      stage.trim(x, SURFACE_Y + 0.32, z, 0.2, 0.12, 0.2, shade(roofDark, 1.3));
      stage.trim(x, SURFACE_Y + 1.78, z, 0.38, 0.09, 0.38, roofDark);
      stage.glow(x, SURFACE_Y + 2.0, z, 0.24, 0.34, 0.24, tallow);
      for (const side of [-1, 1]) {
        stage.trim(x + side * 0.16, SURFACE_Y + 2.0, z, 0.055, 0.42, 0.3, roofDark);
        stage.trim(x, SURFACE_Y + 2.0, z + side * 0.16, 0.3, 0.42, 0.055, roofDark);
      }
      stage.trim(x, SURFACE_Y + 2.23, z, 0.42, 0.09, 0.42, roofDark);
      stage.trim(x, SURFACE_Y + 2.32, z, 0.26, 0.1, 0.26, roofDark);
      stage.trim(x, SURFACE_Y + 2.39, z, 0.1, 0.08, 0.1, snow);
      const light = new THREE.PointLight(glow, intensity, 6.5);
      light.position.set(x, SURFACE_Y + 1.95, z);
      this.group.add(light);
      this.flickers.push({ light, base: intensity, speed: 2.2, amp: 0.5, phase });
    };
    harbourLamp(3.9, 1.5, 4.2, 0.3);
    harbourLamp(-4.2, 0.9, 3.4, 2.1);
    const windowLight = new THREE.PointLight(glow, 3.2, 8);
    windowLight.position.set(0.4, SURFACE_Y + 2.1, -2.4);
    this.group.add(windowLight);
    this.flickers.push({ light: windowLight, base: 3.2, speed: 1.4, amp: 0.4, phase: 1.2 });

    stage.flush(this.group);

    // ── Halo on the quay lamp (single volumetric read) ──
    this.group.add(
      buildGlowOrb({
        color: glow,
        size: 0.3,
        position: new THREE.Vector3(3.9, SURFACE_Y + 1.98, 1.5),
        layers: 2,
      }),
    );

    this.waterfall = new Waterfall({
      radius: islandRadius + 0.25,
      innerRadius: islandRadius - 0.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(key, 0xcfe0ea, 0.45),
      opacity: 0.5,
      density: 0.7,
    });
    this.group.add(this.waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glow = art.glow ?? 0xffbe6b;
    const key = art.key ?? 0xa9c4e8;
    const veil = art.veil ?? 0x1a2634;
    const rng = createRng(hashSeed('denmark:atmosphere'));

    // 1) Snow flurries (the base snow system is a separate, shared layer).
    const snow: MoteSpec[] = [];
    for (let i = 0; i < 34; i++) {
      snow.push({
        x: rng.nextFloat(-6.5, 6.5),
        y: rng.nextFloat(4.5, 8.5),
        z: rng.nextFloat(-6.5, 6.5),
        w: 0.1,
        h: 0.1,
        d: 0.1,
        color: mixHex(key, 0xffffff, 0.7),
        mode: 'fall',
        speed: rng.nextFloat(0.3, 0.55),
        amp: rng.nextFloat(0.1, 0.4),
        phase: rng.next(),
        span: 9,
      });
    }
    this.motes.push(new MoteField(snow, { opacity: 0.85 }));

    // 2) Chimney smoke rising off the townhouse roofs.
    const smoke: MoteSpec[] = [];
    for (let i = 0; i < 12; i++) {
      smoke.push({
        x: rng.nextFloat(-2.6, 3.0),
        y: SURFACE_Y + 3.4,
        z: rng.nextFloat(-3.4, -2.8),
        w: rng.nextFloat(0.14, 0.26),
        h: rng.nextFloat(0.14, 0.26),
        d: rng.nextFloat(0.14, 0.26),
        color: mixHex(veil, 0x9aa4ae, 0.6),
        mode: 'rise',
        speed: rng.nextFloat(0.07, 0.12),
        amp: rng.nextFloat(0.1, 0.3),
        phase: rng.next(),
        span: 3.6,
      });
    }
    this.motes.push(new MoteField(smoke, { opacity: 0.28 }));

    // 3) Warm harbour glitter on the black water.
    const glitter: MoteSpec[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = rng.nextFloat(0.02, 1.3);
      const radius = rng.nextFloat(6.4, 7.6);
      glitter.push({
        x: Math.cos(angle) * radius,
        y: -1.87,
        z: Math.sin(angle) * radius,
        w: rng.nextFloat(0.12, 0.24),
        h: 0.03,
        d: rng.nextFloat(0.6, 1.4),
        color: mixHex(glow, 0xd9e6f2, 0.3),
        mode: 'drift',
        speed: 0.16,
        amp: 0.14,
        phase: rng.next(),
        span: 0.9,
      });
    }
    this.motes.push(new MoteField(glitter, { additive: true, opacity: 0.5 }));

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
      floater.object.position.y = floater.baseY + Math.sin(time * 0.8 + floater.phase) * 0.035;
      floater.object.rotation.z = Math.sin(time * 0.95 + floater.phase) * floater.roll;
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
