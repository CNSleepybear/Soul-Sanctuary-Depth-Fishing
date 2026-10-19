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

    // ── Landmark: white-walled wat with tiered gold roof + chedi spire ──
    const watX = 1.9;
    const watZ = -2.5;
    stage.trim(watX, SURFACE_Y + 0.12, watZ, 2.1, 0.24, 1.9, templeWhite);
    stage.solid(watX, SURFACE_Y + 0.24 + 0.65, watZ, 1.7, 1.3, 1.5, templeWhite);
    // gold wall trim
    stage.trim(watX, SURFACE_Y + 1.0, watZ + 0.78, 1.7, 0.08, 0.06, gold);
    // shop-front glow + teak door
    stage.glow(watX, SURFACE_Y + 0.85, watZ + 0.78, 0.7, 0.5, 0.05, glow);
    stage.trim(watX, SURFACE_Y + 0.5, watZ + 0.8, 0.3, 0.66, 0.06, teak);
    for (const wx of [-0.5, 0.5]) {
      stage.trim(watX + wx, SURFACE_Y + 0.9, watZ + 0.79, 0.22, 0.36, 0.05, gold);
    }
    // tiered roof: orange eaves with green upper tiers and gold ridges
    stage.solid(watX, SURFACE_Y + 1.62, watZ, 2.1, 0.2, 1.9, roofOrange);
    stage.solid(watX, SURFACE_Y + 1.82, watZ, 1.7, 0.2, 1.65, roofOrange);
    stage.solid(watX, SURFACE_Y + 2.02, watZ, 1.3, 0.2, 1.4, roofGreen);
    stage.solid(watX, SURFACE_Y + 2.22, watZ, 0.9, 0.2, 1.15, roofOrange);
    stage.solid(watX, SURFACE_Y + 2.42, watZ, 0.5, 0.2, 0.9, roofGreen);
    stage.glow(watX, SURFACE_Y + 2.56, watZ, 0.42, 0.1, 0.82, goldBright);
    stage.trim(watX, SURFACE_Y + 1.72, watZ + 0.98, 2.0, 0.06, 0.06, gold);
    stage.trim(watX, SURFACE_Y + 1.92, watZ + 0.86, 1.6, 0.06, 0.06, gold);
    // golden chedi behind the hall
    const chediX = 2.9;
    const chediZ = -3.15;
    stage.solid(chediX, SURFACE_Y + 0.3, chediZ, 1.0, 0.6, 1.0, gold);
    stage.solid(chediX, SURFACE_Y + 0.75, chediZ, 0.8, 0.5, 0.8, gold);
    stage.solid(chediX, SURFACE_Y + 1.15, chediZ, 0.62, 0.5, 0.62, gold);
    stage.solid(chediX, SURFACE_Y + 1.52, chediZ, 0.46, 0.44, 0.46, gold);
    stage.solid(chediX, SURFACE_Y + 1.86, chediZ, 0.3, 0.4, 0.3, goldBright);
    stage.glow(chediX, SURFACE_Y + 2.16, chediZ, 0.14, 0.5, 0.14, glow);
    stage.glow(chediX, SURFACE_Y + 2.45, chediZ, 0.3, 0.07, 0.3, goldBright);
    // little gold finial rings
    for (let i = 0; i < 3; i++) {
      stage.trim(
        chediX,
        SURFACE_Y + 2.55 + i * 0.14,
        chediZ,
        0.22 - i * 0.05,
        0.05,
        0.22 - i * 0.05,
        gold,
      );
    }

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

    // ── Secondary: two long-tail boats on the river ──
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
      push(0, 0.1, 0, 1.8, 0.16, 0.34, teak);
      push(0, 0.22, 0, 1.4, 0.1, 0.28, shade(teak, 1.2));
      push(0.95, 0.5, 0, 0.08, 0.8, 0.08, teak);
      push(0.75, 0.9, 0, 0.5, 0.06, 0.06, teak);
      push(-0.9, 0.42, 0, 0.22, 0.5, 0.2, roofOrange);
      // driver silhouette
      push(-0.4, 0.5, 0, 0.16, 0.34, 0.16, templeWhite);
      push(-0.4, 0.74, 0, 0.14, 0.14, 0.14, mixHex(key, 0x8a6a50, 0.5));
      push(-0.4, 0.84, 0, 0.28, 0.06, 0.24, teak);
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
      yBase: -0.2,
      heightMin: 2.2,
      heightMax: 3.2,
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

    // 1) Sky lanterns rising over the river.
    const lanterns: MoteSpec[] = [];
    for (let i = 0; i < 16; i++) {
      lanterns.push({
        x: rng.nextFloat(-4.5, 4.5),
        y: SURFACE_Y + 0.8,
        z: rng.nextFloat(-4, 4.5),
        w: rng.nextFloat(0.16, 0.24),
        h: rng.nextFloat(0.2, 0.3),
        d: rng.nextFloat(0.16, 0.24),
        color: rng.chance(0.35) ? mixHex(glow, 0xffe29a, 0.4) : glow,
        mode: 'rise',
        speed: rng.nextFloat(0.1, 0.22),
        amp: rng.nextFloat(0.2, 0.6),
        phase: rng.next(),
        span: 7.5,
      });
    }
    this.motes.push(new MoteField(lanterns, { additive: true, opacity: 0.85 }));

    // 2) Krathongs drifting down the river (warm candle reflections).
    const krathongs: MoteSpec[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = rng.nextFloat(0.02, 1.3);
      const radius = rng.nextFloat(6.6, 7.6);
      krathongs.push({
        x: Math.cos(angle) * radius,
        y: -1.84,
        z: Math.sin(angle) * radius,
        w: 0.22,
        h: 0.08,
        d: 0.22,
        color: mixHex(glow, accent, 0.4),
        mode: 'drift',
        speed: 0.14,
        amp: 0.12,
        phase: rng.next(),
        span: 1.0,
      });
    }
    this.motes.push(new MoteField(krathongs, { additive: true, opacity: 0.6 }));

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
