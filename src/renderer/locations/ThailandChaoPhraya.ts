// ===== src/renderer/locations/ThailandChaoPhraya.ts =====
// 🇹🇭 Thailand �?Chao Phraya floating lanterns.
//
// v2 art pass: the white-walled wat with a gold-roofed chedi is the anchor on
// the right third; a seated Buddha and a spirit house are the secondaries; sky
// lanterns, krathongs, fireflies and river mist carry the festival. Static
// voxels are instanced into three batches.

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

export class ThailandChaoPhraya extends BaseLocation {
  readonly id = 'thailand';

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
    return LOCATIONS.find((l) => l.id === 'thailand')!;
  }

  protected buildGeometry(): void {
    const island = this.createIsland();
    this.group.add(island.group);

    const art = this.art;
    const accent = art.accent ?? 0xd9a441;
    const glow = art.glow ?? 0xff9a3c;
    const shadow = art.shadow ?? 0x3a2a3a;
    const veil = art.veil ?? 0x2a1f2e;
    const key = art.key ?? 0xffc46b;
    const islandRadius = island.radius;

    const templeWhite = mixHex(key, 0xf3ecd9, 0.68);
    const gold = mixHex(accent, 0xe8c25a, 0.5);
    const goldBright = mixHex(glow, 0xffd870, 0.5);
    const roofOrange = mixHex(accent, 0x9a3f1c, 0.55);
    const roofGreen = mixHex(accent, 0x1f4a34, 0.72);
    const teak = mixHex(shadow, 0x2a1a12, 0.5);
    const lotusLeaf = mixHex(accent, 0x2f6a3a, 0.7);
    const lotusPink = mixHex(glow, 0xd85a8a, 0.5);
    const riverDark = mixHex(veil, 0x3d6a5a, 0.5);

    const stage = new VoxelStage();
    const rng = createRng(hashSeed('thailand:river'));

    // ── River-bank paving + shore reeds ──
    for (let i = 0; i < 26; i++) {
      const angle = 0.02 + (i / 26) * 1.35;
      const radius = islandRadius * rng.nextFloat(0.78, 0.93);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.03,
        Math.sin(angle) * radius,
        rng.nextFloat(0.4, 0.75),
        0.07,
        rng.nextFloat(0.3, 0.55),
        mixHex(teak, templeWhite, rng.nextFloat(0.2, 0.55)),
        rng.nextFloat(-0.3, 0.3),
      );
    }

    // ── Landmark: a gold-edged wat with layered tiles, chofa and a bell chedi ──
    const watX = 1.9;
    const watZ = -2.5;
    stage.trim(watX, SURFACE_Y + 0.09, watZ, 2.5, 0.18, 2.15, shade(templeWhite, 0.86));
    stage.trim(watX, SURFACE_Y + 0.21, watZ, 2.25, 0.1, 1.95, templeWhite);
    for (let i = 0; i < 3; i++) {
      stage.trim(
        watX,
        SURFACE_Y + 0.06 + i * 0.07,
        watZ + 1.22 - i * 0.16,
        1.0 - i * 0.12,
        0.08,
        0.34,
        templeWhite,
      );
    }
    stage.solid(watX, SURFACE_Y + 0.89, watZ, 1.7, 1.3, 1.5, templeWhite);
    for (const px of [-0.78, -0.4, 0.4, 0.78]) {
      stage.trim(watX + px, SURFACE_Y + 0.9, watZ + 0.79, 0.09, 1.26, 0.09, gold);
      stage.trim(watX + px, SURFACE_Y + 0.3, watZ + 0.8, 0.16, 0.12, 0.14, goldBright);
    }
    stage.trim(watX, SURFACE_Y + 1.42, watZ + 0.8, 1.82, 0.1, 0.08, gold);
    stage.trim(watX, SURFACE_Y + 0.35, watZ + 0.8, 1.82, 0.1, 0.08, gold);
    stage.glow(watX, SURFACE_Y + 0.84, watZ + 0.79, 0.56, 0.74, 0.05, shade(glow, 0.72));
    for (const dx of [-0.17, 0.17]) {
      stage.solid(watX + dx, SURFACE_Y + 0.76, watZ + 0.835, 0.29, 0.9, 0.06, teak);
      stage.trim(watX + dx, SURFACE_Y + 0.76, watZ + 0.875, 0.03, 0.82, 0.03, gold);
    }
    for (const wx of [-0.56, 0.56]) {
      stage.solid(watX + wx, SURFACE_Y + 0.88, watZ + 0.805, 0.3, 0.54, 0.06, roofGreen);
      stage.trim(watX + wx, SURFACE_Y + 0.88, watZ + 0.85, 0.05, 0.48, 0.04, goldBright);
      stage.trim(watX + wx, SURFACE_Y + 0.88, watZ + 0.85, 0.26, 0.05, 0.04, goldBright);
      for (const side of [-1, 1]) {
        stage.trim(watX + wx + side * 0.19, SURFACE_Y + 0.88, watZ + 0.84, 0.06, 0.65, 0.06, gold);
      }
      stage.trim(watX + wx, SURFACE_Y + 1.21, watZ + 0.84, 0.44, 0.07, 0.06, gold);
    }
    const roofTiers = [
      { y: 1.6, w: 2.35, d: 2.02, color: roofOrange },
      { y: 1.81, w: 1.95, d: 1.78, color: roofOrange },
      { y: 2.02, w: 1.52, d: 1.5, color: roofGreen },
      { y: 2.23, w: 1.08, d: 1.22, color: roofOrange },
      { y: 2.44, w: 0.58, d: 0.96, color: roofGreen },
    ];
    roofTiers.forEach((tier, i) => {
      stage.solid(watX, SURFACE_Y + tier.y, watZ, tier.w, 0.2, tier.d, tier.color);
      stage.trim(
        watX,
        SURFACE_Y + tier.y - 0.07,
        watZ + tier.d / 2,
        tier.w + 0.08,
        0.07,
        0.08,
        gold,
      );
      for (const side of [-1, 1]) {
        stage.trim(
          watX + side * (tier.w / 2 + 0.05),
          SURFACE_Y + tier.y + 0.1,
          watZ + tier.d / 2 - 0.08,
          0.1,
          0.28 + i * 0.025,
          0.1,
          goldBright,
        );
      }
    });
    stage.glow(watX, SURFACE_Y + 2.59, watZ, 0.16, 0.13, 1.04, goldBright);
    for (const end of [-1, 1]) {
      stage.trim(watX, SURFACE_Y + 2.79, watZ + end * 0.54, 0.1, 0.45, 0.1, goldBright);
      stage.trim(watX, SURFACE_Y + 3.0, watZ + end * 0.61, 0.09, 0.09, 0.24, goldBright);
    }
    for (let i = 0; i < 7; i++) {
      stage.trim(
        watX - 0.9 + i * 0.3,
        SURFACE_Y + 1.71,
        watZ + 0.93,
        0.045,
        0.08,
        0.22,
        shade(gold, 0.82),
      );
    }

    const chediX = 3.15;
    const chediZ = -3.35;
    for (let i = 0; i < 3; i++) {
      stage.solid(
        chediX,
        SURFACE_Y + 0.1 + i * 0.16,
        chediZ,
        1.2 - i * 0.16,
        0.18,
        1.2 - i * 0.16,
        i === 1 ? goldBright : gold,
      );
    }
    const bellTiers = [
      { y: 0.66, w: 0.84, h: 0.3 },
      { y: 0.91, w: 0.72, h: 0.26 },
      { y: 1.14, w: 0.58, h: 0.24 },
      { y: 1.35, w: 0.44, h: 0.22 },
      { y: 1.55, w: 0.32, h: 0.22 },
    ];
    bellTiers.forEach((tier, i) => {
      stage.solid(
        chediX,
        SURFACE_Y + tier.y,
        chediZ,
        tier.w,
        tier.h,
        tier.w,
        i % 2 === 0 ? gold : goldBright,
      );
    });
    stage.glow(chediX, SURFACE_Y + 1.88, chediZ, 0.14, 0.54, 0.14, glow);
    for (let i = 0; i < 6; i++) {
      stage.trim(
        chediX,
        SURFACE_Y + 1.68 + i * 0.14,
        chediZ,
        0.34 - i * 0.042,
        0.045,
        0.34 - i * 0.042,
        goldBright,
      );
    }
    stage.glow(chediX, SURFACE_Y + 2.52, chediZ, 0.07, 0.28, 0.07, goldBright);

    // ── Secondary: seated golden Buddha on a lotus pedestal ──
    const buddhaX = -0.4;
    const buddhaZ = -0.9;
    stage.solid(buddhaX, SURFACE_Y + 0.18, buddhaZ, 0.7, 0.36, 0.6, lotusPink);
    stage.solid(buddhaX, SURFACE_Y + 0.44, buddhaZ, 0.5, 0.2, 0.44, gold);
    stage.solid(buddhaX, SURFACE_Y + 0.78, buddhaZ, 0.4, 0.5, 0.3, gold);
    stage.solid(buddhaX, SURFACE_Y + 1.12, buddhaZ, 0.24, 0.24, 0.22, goldBright);
    stage.glow(buddhaX, SURFACE_Y + 1.12, buddhaZ + 0.12, 0.24, 0.1, 0.05, glow);
    stage.trim(buddhaX, SURFACE_Y + 1.26, buddhaZ, 0.12, 0.1, 0.12, gold);

    // ── Secondary: spirit house (san phra phum) ──
    const spiritX = -3.3;
    const spiritZ = -1.5;
    stage.solid(spiritX, SURFACE_Y + 0.5, spiritZ, 0.12, 1.0, 0.12, teak);
    stage.trim(spiritX, SURFACE_Y + 1.02, spiritZ, 0.6, 0.08, 0.6, teak);
    stage.solid(spiritX, SURFACE_Y + 1.25, spiritZ, 0.46, 0.4, 0.46, templeWhite);
    stage.glow(spiritX, SURFACE_Y + 1.25, spiritZ + 0.25, 0.2, 0.22, 0.05, glow);
    stage.solid(spiritX, SURFACE_Y + 1.5, spiritZ, 0.58, 0.1, 0.58, roofOrange);
    stage.solid(spiritX, SURFACE_Y + 1.58, spiritZ, 0.3, 0.12, 0.3, gold);
    stage.trim(spiritX, SURFACE_Y + 1.7, spiritZ, 0.08, 0.3, 0.08, goldBright);

    // ── Secondary: lotus pads floating on the river ──
    for (let i = 0; i < 10; i++) {
      const angle = rng.nextFloat(0.1, 1.2);
      const radius = rng.nextFloat(6.6, 7.6);
      const lx = Math.cos(angle) * radius;
      const lz = Math.sin(angle) * radius;
      stage.trim(
        lx,
        -1.9,
        lz,
        rng.nextFloat(0.4, 0.6),
        0.06,
        rng.nextFloat(0.35, 0.55),
        lotusLeaf,
        rng.nextFloat(0, TAU),
      );
      if (rng.chance(0.55)) {
        stage.glow(lx, -1.82, lz, 0.14, 0.16, 0.14, lotusPink);
      }
    }

    // ── Long-tail boats: tapered hulls, raised prows, canopy and exposed motor ──
    const buildLongTail = (angle: number, radius: number, seed: number): void => {
      const boatRng = createRng(seed);
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
      const painted = boatRng.chance(0.5) ? roofOrange : roofGreen;
      push(-0.05, 0.08, 0, 2.15, 0.14, 0.3, shade(teak, 0.72));
      push(-0.08, 0.18, 0, 1.9, 0.12, 0.42, painted);
      push(0.9, 0.26, 0, 0.42, 0.14, 0.32, painted);
      push(1.12, 0.39, 0, 0.22, 0.16, 0.22, gold);
      push(1.22, 0.56, 0, 0.1, 0.26, 0.12, goldBright);
      push(-1.08, 0.19, 0, 0.24, 0.14, 0.36, shade(teak, 1.15));
      for (const side of [-1, 1]) {
        push(-0.05, 0.31, side * 0.22, 1.95, 0.08, 0.06, shade(teak, 1.35));
        for (const x of [-0.58, 0.48]) push(x, 0.57, side * 0.2, 0.055, 0.55, 0.055, teak);
      }
      for (const x of [-0.55, 0.05, 0.6]) push(x, 0.3, 0, 0.1, 0.08, 0.4, shade(teak, 1.25));
      push(-0.03, 0.86, 0, 1.35, 0.1, 0.58, painted);
      push(-0.03, 0.93, 0, 1.12, 0.06, 0.48, mixHex(painted, key, 0.16));
      push(-0.84, 0.43, 0, 0.26, 0.3, 0.28, shadow);
      push(-1.28, 0.3, 0, 0.72, 0.065, 0.065, mixHex(shadow, 0x899099, 0.55));
      push(-1.62, 0.22, 0, 0.07, 0.25, 0.22, shade(teak, 0.8));
      push(-0.73, 0.58, 0, 0.16, 0.32, 0.16, templeWhite);
      push(-0.73, 0.81, 0, 0.14, 0.14, 0.14, mixHex(key, 0x8a6a50, 0.5));
      push(-0.73, 0.91, 0, 0.28, 0.06, 0.24, teak);
      push(0.35, 0.49, 0, 0.15, 0.24, 0.15, mixHex(lotusPink, templeWhite, 0.45));
      push(0.35, 0.67, 0, 0.13, 0.13, 0.13, mixHex(key, 0x8a6a50, 0.5));
      for (let i = 0; i < 4; i++) {
        push(
          1.18,
          0.48 - i * 0.08,
          (i % 2 === 0 ? -1 : 1) * 0.08,
          0.08,
          0.08,
          0.08,
          i % 2 === 0 ? lotusPink : goldBright,
        );
      }
      push(0.73, 0.52, 0, 0.14, 0.2, 0.14, glow);
      const boat = buildInstancedVoxels(cells, { castShadow: true, receiveShadow: true });
      boat.position.set(Math.cos(angle) * radius, -1.9, Math.sin(angle) * radius);
      boat.rotation.y = boatRng.nextFloat(0, TAU);
      this.group.add(boat);
      this.floaters.push({
        object: boat,
        baseY: -1.9,
        phase: boatRng.nextFloat(0, TAU),
        roll: 0.02,
      });
    };
    buildLongTail(0.16, 7.0, hashSeed('th:boat1'));
    buildLongTail(0.5, 7.3, hashSeed('th:boat2'));

    // ── Foreground frame: reed screen, clay pots, bamboo bench (shore) ──
    for (let i = 0; i < 7; i++) {
      stage.trim(
        4.35 + rng.nextFloat(-0.25, 0.25),
        SURFACE_Y + rng.nextFloat(0.3, 0.55),
        2.3 + i * 0.16,
        0.08,
        rng.nextFloat(0.7, 1.0),
        0.08,
        mixHex(lotusLeaf, teak, rng.nextFloat(0.3, 0.6)),
        rng.nextFloat(-0.1, 0.1),
      );
    }
    for (let i = 0; i < 3; i++) {
      stage.solid(
        4.9,
        SURFACE_Y + 0.22,
        2.05 + i * 0.5,
        0.34,
        0.44,
        0.34,
        mixHex(accent, 0x8a4a34, 0.6),
      );
      stage.trim(4.9, SURFACE_Y + 0.46, 2.05 + i * 0.5, 0.38, 0.05, 0.38, templeWhite);
    }
    stage.solid(4.15, SURFACE_Y + 0.24, 2.55, 0.9, 0.1, 0.3, teak);
    stage.solid(4.15, SURFACE_Y + 0.1, 2.4, 0.1, 0.28, 0.26, teak);
    stage.solid(4.15, SURFACE_Y + 0.1, 2.7, 0.1, 0.28, 0.26, teak);

    stage.flush(this.group);

    // ── Local warm lights: temple gold, shrine candle, boat lantern ──
    const templeLight = new THREE.PointLight(glow, 4.6, 8.5);
    templeLight.position.set(watX, SURFACE_Y + 1.7, watZ + 0.7);
    this.group.add(templeLight);
    this.flickers.push({ light: templeLight, base: 4.6, speed: 2.4, amp: 0.6, phase: 0.2 });

    const shrineLight = new THREE.PointLight(goldBright, 2.2, 4.5);
    shrineLight.position.set(spiritX, SURFACE_Y + 1.2, spiritZ + 0.4);
    this.group.add(shrineLight);
    this.flickers.push({ light: shrineLight, base: 2.2, speed: 3.2, amp: 0.4, phase: 1.3 });

    const riverLight = new THREE.PointLight(glow, 2.8, 6);
    riverLight.position.set(6.4, -1.0, 1.0);
    this.group.add(riverLight);
    this.flickers.push({ light: riverLight, base: 2.8, speed: 1.8, amp: 0.5, phase: 2.2 });

    // Gold halo around the chedi spire.
    this.group.add(
      buildGlowOrb({
        color: goldBright,
        size: 0.34,
        position: new THREE.Vector3(chediX, SURFACE_Y + 2.3, chediZ),
        layers: 2,
      }),
    );

    this.waterfall = new Waterfall({
      radius: islandRadius + 0.25,
      innerRadius: islandRadius - 0.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(riverDark, 0x9fd0a8, 0.4),
      opacity: 0.55,
      density: 0.7,
    });
    this.group.add(this.waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glow = art.glow ?? 0xff9a3c;
    const accent = art.accent ?? 0xd9a441;
    const key = art.key ?? 0xffc46b;
    const veil = art.veil ?? 0x2a1f2e;
    const rng = createRng(hashSeed('thailand:atmosphere'));

    // Paper bodies, stepped caps and bright bases remain perfectly paired while rising.
    const lanterns: MoteSpec[] = [];
    for (let i = 0; i < 18; i++) {
      lanterns.push({
        x: rng.nextFloat(-4.8, 4.2),
        y: SURFACE_Y + 0.65,
        z: rng.nextFloat(-4.4, 2.2),
        w: rng.nextFloat(0.18, 0.26),
        h: rng.nextFloat(0.28, 0.4),
        d: rng.nextFloat(0.18, 0.26),
        color: rng.chance(0.35) ? mixHex(glow, 0xffe29a, 0.4) : glow,
        mode: 'rise',
        speed: rng.nextFloat(0.1, 0.22),
        amp: rng.nextFloat(0.2, 0.6),
        phase: rng.next(),
        span: 7.5,
      });
    }
    const lanternCaps = lanterns.map((mote) => ({
      ...mote,
      y: mote.y + mote.h * 0.52,
      w: mote.w * 0.72,
      h: 0.07,
      d: mote.d * 0.72,
      color: mixHex(mote.color, key, 0.35),
    }));
    const lanternFlames = lanterns.map((mote) => ({
      ...mote,
      y: mote.y - mote.h * 0.53,
      w: 0.07,
      h: 0.09,
      d: 0.07,
      color: 0xffe5a0,
    }));
    this.motes.push(new MoteField(lanterns, { additive: true, opacity: 0.72 }));
    this.motes.push(new MoteField(lanternCaps, { additive: true, opacity: 0.82 }));
    this.motes.push(new MoteField(lanternFlames, { additive: true, opacity: 0.95 }));

    // Each krathong has a banana-leaf raft, folded petals and a separate candle.
    const krathongs: MoteSpec[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = rng.nextFloat(0.02, 1.3);
      const radius = rng.nextFloat(6.6, 7.6);
      krathongs.push({
        x: Math.cos(angle) * radius,
        y: -1.86,
        z: Math.sin(angle) * radius,
        w: 0.34,
        h: 0.055,
        d: 0.28,
        color: mixHex(accent, 0x397046, 0.72),
        mode: 'drift',
        speed: 0.14,
        amp: 0.12,
        phase: rng.next(),
        span: 1.0,
      });
    }
    const krathongPetals = krathongs.map((mote, i) => ({
      ...mote,
      y: mote.y + 0.075,
      w: 0.22,
      h: 0.1,
      d: 0.2,
      color: i % 3 === 0 ? 0xf2a0b5 : mixHex(glow, 0xf3d6a0, 0.5),
    }));
    const krathongCandles = krathongs.map((mote) => ({
      ...mote,
      y: mote.y + 0.19,
      w: 0.055,
      h: 0.18,
      d: 0.055,
      color: 0xffd77a,
    }));
    this.motes.push(new MoteField(krathongs, { opacity: 0.95 }));
    this.motes.push(new MoteField(krathongPetals, { opacity: 0.95 }));
    this.motes.push(new MoteField(krathongCandles, { additive: true, opacity: 0.9 }));

    // 3) Fireflies around the wat and the spirit house.
    const fireflies: MoteSpec[] = [];
    for (let i = 0; i < 14; i++) {
      fireflies.push({
        x: rng.nextFloat(-3.6, 3.4),
        y: SURFACE_Y + rng.nextFloat(0.5, 2.6),
        z: rng.nextFloat(-2.8, 1.8),
        w: 0.08,
        h: 0.08,
        d: 0.08,
        color: mixHex(0xd8ff8a, key, 0.35),
        mode: 'orbit',
        speed: rng.nextFloat(0.35, 0.8),
        amp: rng.nextFloat(0.25, 0.7),
        phase: rng.next(),
        span: 1,
      });
    }
    this.motes.push(new MoteField(fireflies, { additive: true, opacity: 0.6 }));

    // 4) River mist.
    const mist: MoteSpec[] = [];
    for (let i = 0; i < 9; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(5.8, 7.4);
      mist.push({
        x: Math.cos(angle) * radius,
        y: -1.9,
        z: Math.sin(angle) * radius,
        w: rng.nextFloat(0.7, 1.3),
        h: 0.1,
        d: rng.nextFloat(0.5, 0.9),
        color: mixHex(veil, 0xb9c8c0, 0.5),
        mode: 'rise',
        speed: 0.05,
        amp: 0.14,
        phase: rng.next(),
        span: 1.5,
      });
    }
    this.motes.push(new MoteField(mist, { opacity: 0.13 }));

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
      floater.object.position.y = floater.baseY + Math.sin(time * 0.85 + floater.phase) * 0.03;
      floater.object.rotation.z = Math.sin(time * 0.9 + floater.phase) * floater.roll;
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
