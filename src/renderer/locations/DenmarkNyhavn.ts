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

    // ── Secondary: six townhouses with uneven Nyhavn widths ──
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
      stage.solid(spec.x, SURFACE_Y + spec.h / 2, z, spec.w, spec.h, bodyDepth, spec.color);
      // gable roof + snow cap
      stage.solid(
        spec.x,
        SURFACE_Y + spec.h + 0.12,
        z,
        spec.w * 0.94,
        0.24,
        bodyDepth * 0.9,
        roofDark,
      );
      stage.trim(spec.x, SURFACE_Y + spec.h + 0.3, z, spec.w * 0.9, 0.12, bodyDepth * 0.86, snow);
      // two lit windows per floor
      for (let floor = 0; floor < 2; floor++) {
        const wy = SURFACE_Y + 0.62 + floor * 0.85;
        if (wy > SURFACE_Y + spec.h - 0.45) continue;
        for (const dir of [-1, 1]) {
          const wx = spec.x + dir * spec.w * 0.22;
          stage.glow(wx, wy, z + bodyDepth / 2 + 0.02, 0.22, 0.3, 0.06, tallow);
          stage.trim(wx, wy, z + bodyDepth / 2 + 0.04, 0.28, 0.36, 0.04, roofDark);
          stage.glow(wx, wy, z + bodyDepth / 2 + 0.05, 0.2, 0.26, 0.04, tallow);
        }
      }
      // chimney with a snow cap
      if (i % 2 === 0) {
        stage.solid(
          spec.x - spec.w * 0.24,
          SURFACE_Y + spec.h + 0.4,
          z - 0.2,
          0.16,
          0.5,
          0.16,
          roofDark,
        );
        stage.trim(
          spec.x - spec.w * 0.24,
          SURFACE_Y + spec.h + 0.66,
          z - 0.2,
          0.2,
          0.06,
          0.2,
          snow,
        );
      }
    }

    // ── Secondary: two wooden sailing ships with masts and rigging ──
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
      push(0, 0.22, 0, length, 0.4, 0.62, wood);
      push(0, 0.42, 0, length * 0.94, 0.12, 0.5, shade(wood, 1.15));
      push(length * 0.32, 0.32, 0, 0.5, 0.24, 0.56, shade(wood, 0.85));
      push(-length * 0.32, 0.32, 0, 0.5, 0.24, 0.56, shade(wood, 0.85));
      push(length * 0.46, 0.55, 0, 0.4, 0.1, 0.12, snow);
      // masts + sails + rigging
      const mastXs = [-length * 0.28, 0, length * 0.3];
      mastXs.forEach((mastX, mi) => {
        const mastH = 2.2 + mi * 0.15;
        push(mastX, 0.5 + mastH / 2, 0, 0.07, mastH, 0.07, wood);
        push(mastX, 0.55 + mastH * 0.72, 0, 0.5, 0.06, 0.06, wood);
        if (mi > 0) {
          push((mastXs[mi - 1] + mastX) / 2, 0.6 + mastH * 0.55, 0, 0.06, 0.06, 0.06, wood);
        }
        // furled sail with a snow line
        push(mastX, 0.85 + mastH * 0.52, 0.1, 0.42, 0.9, 0.06, mixHex(snow, shadow, 0.35));
        push(mastX, 1.32 + mastH * 0.52, 0.12, 0.44, 0.08, 0.08, snow);
      });
      // rigging diagonals
      for (let r = 0; r < 3; r++) {
        push(
          -length * 0.28 + (r / 2) * length * 0.58,
          1.5 + r * 0.1,
          0.05,
          0.05,
          1.5,
          0.05,
          mixHex(wood, shadow, 0.4),
        );
      }
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

    // ── Local warm lights: two harbour lamps + a warm window spill ──
    const harbourLamp = (x: number, z: number, intensity: number, phase: number): void => {
      stage.glow(x, SURFACE_Y + 2.0, z, 0.22, 0.26, 0.22, tallow);
      const light = new THREE.PointLight(glow, intensity, 6.5);
      light.position.set(x, SURFACE_Y + 1.95, z);
      this.group.add(light);
      this.flickers.push({ light, base: intensity, speed: 2.2, amp: 0.5, phase });
      // lamp post
      stage.solid(x, SURFACE_Y + 1.0, z, 0.1, 2.0, 0.1, roofDark);
      stage.trim(x, SURFACE_Y + 2.15, z, 0.34, 0.08, 0.34, roofDark);
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
