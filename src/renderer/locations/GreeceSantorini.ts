// ===== src/renderer/locations/GreeceSantorini.ts =====
// 🇬🇷 Greece �?Santorini windmill.
//
// v2 art pass: the white windmill with slowly turning sails is the anchor; a
// blue-domed chapel with a bell tower, cubic whitewashed houses, wide stairs and
// bougainvillea are the secondaries. A white-sailed boat and sea spray carry the
// Aegean. Static voxels are instanced into three batches.

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

export class GreeceSantorini extends BaseLocation {
  readonly id = 'greece';

  private readonly motes: MoteField[] = [];
  private readonly flickers: FlickerSpec[] = [];
  private readonly floaters: {
    object: THREE.Object3D;
    baseY: number;
    phase: number;
    roll: number;
  }[] = [];
  private sails: THREE.InstancedMesh | null = null;
  private waterfall: Waterfall | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'greece')!;
  }

  protected buildGeometry(): void {
    const island = this.createIsland();
    this.group.add(island.group);

    const art = this.art;
    const accent = art.accent ?? 0x2f7fd6;
    const glow = art.glow ?? 0xffd9a0;
    const shadow = art.shadow ?? 0x2e3f5a;
    const veil = art.veil ?? 0x22344a;
    const key = art.key ?? 0xfff0d0;
    const fill = art.fill ?? 0x7fa8d9;
    const islandRadius = island.radius;

    const white = mixHex(key, 0xf8f5ec, 0.62);
    const whiteShade = mixHex(white, shadow, 0.16);
    const domeBlue = mixHex(accent, fill, 0.35);
    const stone = mixHex(veil, 0xcbc3b3, 0.55);
    const wood = mixHex(shadow, 0x5c4033, 0.5);
    const bougainvillea = mixHex(glow, 0xcc3388, 0.78);
    const bougainvilleaDeep = shade(bougainvillea, 0.82);
    const grass = mixHex(key, 0xa8b886, 0.6);

    const stage = new VoxelStage();
    const rng = createRng(hashSeed('greece:santorini'));

    // ── Terraced whitewashed paving + dry grass tufts ──
    for (let i = 0; i < 26; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(1.8, islandRadius - 0.6);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.03,
        Math.sin(angle) * radius,
        rng.nextFloat(0.5, 1.0),
        0.06,
        rng.nextFloat(0.4, 0.8),
        rng.chance(0.6) ? whiteShade : mixHex(stone, white, 0.5),
        rng.nextFloat(-0.3, 0.3),
      );
    }

    // ── Landmark: white windmill with blue cone roof + turning sails ──
    const millX = -2.9;
    const millZ = -2.2;
    stage.solid(millX, SURFACE_Y + 0.18, millZ, 1.3, 0.36, 1.3, stone);
    stage.solid(millX, SURFACE_Y + 0.36 + 0.9, millZ, 1.1, 1.8, 1.1, white);
    stage.solid(millX, SURFACE_Y + 2.16, millZ, 0.94, 0.4, 0.94, white);
    stage.solid(millX, SURFACE_Y + 2.56, millZ, 0.78, 0.22, 0.78, domeBlue);
    stage.solid(millX, SURFACE_Y + 2.78, millZ, 0.56, 0.22, 0.56, domeBlue);
    stage.solid(millX, SURFACE_Y + 3.0, millZ, 0.34, 0.22, 0.34, domeBlue);
    stage.glow(millX, SURFACE_Y + 3.2, millZ, 0.14, 0.24, 0.14, glow);
    // mill door + window
    stage.trim(millX, SURFACE_Y + 0.85, millZ + 0.56, 0.42, 0.8, 0.06, wood);
    stage.glow(millX, SURFACE_Y + 1.6, millZ + 0.57, 0.24, 0.3, 0.05, glow);
    stage.trim(millX - 0.2, SURFACE_Y + 1.6, millZ + 0.58, 0.06, 0.38, 0.05, domeBlue);
    stage.trim(millX + 0.2, SURFACE_Y + 1.6, millZ + 0.58, 0.06, 0.38, 0.05, domeBlue);

    // ── Landmark secondary: blue-domed chapel with bell tower ──
    const churchX = 1.7;
    const churchZ = -2.9;
    stage.solid(churchX, SURFACE_Y + 0.8, churchZ, 1.5, 1.6, 1.5, white);
    stage.trim(churchX, SURFACE_Y + 1.6, churchZ, 1.6, 0.1, 1.6, whiteShade);
    stage.solid(churchX, SURFACE_Y + 1.7, churchZ, 1.2, 0.3, 1.2, domeBlue);
    stage.solid(churchX, SURFACE_Y + 2.0, churchZ, 0.92, 0.3, 0.92, domeBlue);
    stage.solid(churchX, SURFACE_Y + 2.3, churchZ, 0.62, 0.3, 0.62, domeBlue);
    stage.glow(churchX, SURFACE_Y + 2.62, churchZ, 0.12, 0.34, 0.12, glow);
    // arched door + windows
    stage.glow(churchX, SURFACE_Y + 0.72, churchZ + 0.77, 0.3, 0.56, 0.06, glow);
    stage.trim(churchX - 0.26, SURFACE_Y + 0.72, churchZ + 0.79, 0.08, 0.7, 0.05, domeBlue);
    stage.trim(churchX + 0.26, SURFACE_Y + 0.72, churchZ + 0.79, 0.08, 0.7, 0.05, domeBlue);
    stage.trim(churchX, SURFACE_Y + 1.06, churchZ + 0.79, 0.6, 0.08, 0.05, domeBlue);
    // bell tower beside the chapel
    const bellX = 2.85;
    const bellZ = -2.4;
    stage.solid(bellX, SURFACE_Y + 1.1, bellZ, 0.42, 2.2, 0.42, white);
    stage.trim(bellX, SURFACE_Y + 2.24, bellZ, 0.62, 0.14, 0.62, whiteShade);
    stage.trim(bellX, SURFACE_Y + 2.38, bellZ, 0.5, 0.1, 0.5, domeBlue);
    stage.glow(bellX, SURFACE_Y + 1.95, bellZ + 0.22, 0.24, 0.34, 0.06, glow);
    stage.solid(bellX, SURFACE_Y + 2.5, bellZ, 0.16, 0.2, 0.16, domeBlue);

    // ── Secondary: whitewashed cubic houses ──
    const house = (x: number, z: number, w: number, h: number, d: number, seed: number): void => {
      const houseRng = createRng(seed);
      stage.solid(x, SURFACE_Y + h / 2, z, w, h, d, white);
      stage.trim(x, SURFACE_Y + h + 0.05, z, w + 0.08, 0.1, d + 0.08, whiteShade);
      // blue shutters + one lit window
      for (const dir of [-1, 1]) {
        stage.trim(
          x + dir * w * 0.24,
          SURFACE_Y + h * 0.62,
          z + d / 2 + 0.02,
          0.2,
          0.32,
          0.05,
          domeBlue,
        );
        stage.glow(
          x + dir * w * 0.24,
          SURFACE_Y + h * 0.62,
          z + d / 2 + 0.03,
          0.12,
          0.22,
          0.04,
          houseRng.chance(0.5) ? glow : shade(glow, 0.45),
        );
      }
      // bougainvillea cascading over one wall
      const wallX = x + (houseRng.chance(0.5) ? -w / 2 : w / 2);
      const count = 8 + houseRng.nextInt(0, 4);
      for (let i = 0; i < count; i++) {
        stage.trim(
          wallX + houseRng.nextFloat(-0.12, 0.12),
          SURFACE_Y + houseRng.nextFloat(0.4, h * 0.85),
          z + houseRng.nextFloat(-d / 2, d / 2),
          0.14,
          0.12,
          0.14,
          houseRng.chance(0.6) ? bougainvillea : bougainvilleaDeep,
        );
      }
      // rooftop railing
      for (let i = 0; i < 3; i++) {
        stage.trim(
          x - w / 2 + 0.12 + i * (w / 2 - 0.06),
          SURFACE_Y + h + 0.2,
          z + d / 2 - 0.08,
          0.06,
          0.22,
          0.06,
          whiteShade,
        );
      }
    };
    house(3.5, -1.2, 1.1, 1.3, 1.0, hashSeed('gr:h1'));
    house(0.0, -3.4, 1.0, 1.1, 0.9, hashSeed('gr:h2'));
    house(-0.9, -1.1, 0.9, 1.0, 0.9, hashSeed('gr:h3'));

    // ── Secondary: wide white stairs up to the chapel terrace ──
    for (let i = 0; i < 6; i++) {
      stage.solid(
        2.4,
        SURFACE_Y + 0.1 + i * 0.12,
        0.2 - i * 0.34,
        1.3,
        0.14,
        0.36,
        i % 2 === 0 ? white : whiteShade,
      );
    }
    // terrace edge + blue railing posts
    stage.solid(2.4, SURFACE_Y + 0.36, -1.9, 1.7, 0.2, 0.9, white);
    for (let i = 0; i < 3; i++) {
      stage.trim(1.7 + i * 0.7, SURFACE_Y + 1.35, -1.5, 0.07, 0.7, 0.07, domeBlue);
    }
    stage.trim(2.4, SURFACE_Y + 1.65, -1.5, 1.5, 0.07, 0.07, domeBlue);

    // ── Foreground frame: whitewashed planter wall + pots + bougainvillea ──
    const planterX = 4.6;
    const planterZ = 2.2;
    stage.solid(planterX, SURFACE_Y + 0.28, planterZ, 1.4, 0.56, 0.5, white);
    stage.trim(planterX, SURFACE_Y + 0.58, planterZ, 1.44, 0.08, 0.54, whiteShade);
    for (let i = 0; i < 10; i++) {
      stage.trim(
        planterX - 0.6 + rng.nextFloat(0, 1.2),
        SURFACE_Y + 0.68 + rng.nextFloat(0, 0.36),
        planterZ + rng.nextFloat(-0.2, 0.2),
        0.16,
        0.14,
        0.16,
        rng.chance(0.55) ? bougainvillea : bougainvilleaDeep,
      );
    }
    // terracotta pots
    for (let i = 0; i < 3; i++) {
      const px = 3.5 + i * 0.34;
      stage.solid(px, SURFACE_Y + 0.2, 2.8, 0.3, 0.4, 0.3, mixHex(bougainvillea, 0x8a4a34, 0.6));
      stage.trim(px, SURFACE_Y + 0.55, 2.8, 0.22, 0.2, 0.22, grass);
    }

    // ── Animated sail boat on the Aegean ──
    const boatCells: InstancedVoxel[] = [];
    const pushBoat = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) => {
      boatCells.push({ x, y, z, w, h, d, color });
    };
    pushBoat(0, 0.1, 0, 1.4, 0.18, 0.4, white);
    pushBoat(0, 0.22, 0, 1.1, 0.1, 0.32, whiteShade);
    pushBoat(0, 1.0, 0, 0.07, 1.6, 0.07, wood);
    pushBoat(0.04, 1.05, 0, 0.9, 0.06, 0.06, wood);
    pushBoat(0.05, 1.35, 0, 0.8, 0.7, 0.04, white);
    pushBoat(-0.4, 0.7, 0, 0.5, 0.5, 0.04, whiteShade);
    const boat = buildInstancedVoxels(boatCells, { castShadow: true, receiveShadow: true });
    boat.position.set(6.9, -1.9, 0.9);
    boat.rotation.y = 0.45;
    this.group.add(boat);
    this.floaters.push({ object: boat, baseY: -1.9, phase: 0.7, roll: 0.025 });

    stage.flush(this.group);

    // ── Windmill sails: one InstancedMesh with four arms, rotated as a group ──
    const sailCells: InstancedVoxel[] = [];
    for (let arm = 0; arm < 4; arm++) {
      const angle = (arm / 4) * TAU;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (let k = 1; k <= 4; k++) {
        const r = 0.28 * k;
        sailCells.push({
          x: cos * r,
          y: sin * r,
          z: 0,
          w: Math.abs(cos) > 0.5 ? 0.28 : 0.08,
          h: Math.abs(sin) > 0.5 ? 0.28 : 0.08,
          d: 0.05,
          color: k % 2 === 0 ? white : whiteShade,
        });
      }
    }
    this.sails = buildInstancedVoxels(sailCells, { castShadow: false, receiveShadow: false });
    this.sails.position.set(millX, SURFACE_Y + 2.15, millZ + 0.62);
    this.group.add(this.sails);

    // ── Local warm lights: chapel window, mill lantern, foreground planter ──
    const chapelLight = new THREE.PointLight(glow, 3.8, 6.5);
    chapelLight.position.set(churchX, SURFACE_Y + 1.1, churchZ + 1.0);
    this.group.add(chapelLight);
    this.flickers.push({ light: chapelLight, base: 3.8, speed: 1.6, amp: 0.4, phase: 0.5 });

    const millLight = new THREE.PointLight(glow, 2.8, 5.5);
    millLight.position.set(millX, SURFACE_Y + 1.2, millZ + 0.9);
    this.group.add(millLight);
    this.flickers.push({ light: millLight, base: 2.8, speed: 2.3, amp: 0.4, phase: 1.5 });

    const pathLight = new THREE.PointLight(domeBlue, 2.2, 5);
    pathLight.position.set(2.6, SURFACE_Y + 1.8, -0.8);
    this.group.add(pathLight);
    this.flickers.push({ light: pathLight, base: 2.2, speed: 1.2, amp: 0.3, phase: 2.6 });

    // Halo at the bell tower window.
    this.group.add(
      buildGlowOrb({
        color: glow,
        size: 0.32,
        position: new THREE.Vector3(bellX, SURFACE_Y + 1.95, bellZ + 0.28),
        layers: 2,
      }),
    );

    this.waterfall = new Waterfall({
      radius: islandRadius + 0.25,
      innerRadius: islandRadius - 0.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(domeBlue, 0xbfe4f0, 0.5),
      opacity: 0.45,
      density: 0.66,
    });
    this.group.add(this.waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glow = art.glow ?? 0xffd9a0;
    const accent = art.accent ?? 0x2f7fd6;
    const key = art.key ?? 0xfff0d0;
    const rng = createRng(hashSeed('greece:atmosphere'));

    // 1) Bougainvillea petals falling over the houses.
    const petals: MoteSpec[] = [];
    for (let i = 0; i < 22; i++) {
      petals.push({
        x: rng.nextFloat(-3, 5),
        y: SURFACE_Y + rng.nextFloat(2.2, 4.2),
        z: rng.nextFloat(-3.4, 2.6),
        w: 0.1,
        h: 0.04,
        d: 0.08,
        color: mixHex(glow, 0xcc3388, rng.nextFloat(0.6, 0.9)),
        mode: 'fall',
        speed: rng.nextFloat(0.16, 0.3),
        amp: rng.nextFloat(0.15, 0.5),
        phase: rng.next(),
        span: 4.2,
      });
    }
    this.motes.push(new MoteField(petals, { opacity: 0.95 }));

    // 2) Sea spray drifting off the caldera.
    const spray: MoteSpec[] = [];
    for (let i = 0; i < 24; i++) {
      const angle = rng.nextFloat(0.02, 1.3);
      const radius = rng.nextFloat(6.4, 7.7);
      spray.push({
        x: Math.cos(angle) * radius,
        y: rng.nextFloat(-1.6, 0.4),
        z: Math.sin(angle) * radius,
        w: rng.nextFloat(0.08, 0.16),
        h: rng.nextFloat(0.08, 0.16),
        d: rng.nextFloat(0.08, 0.16),
        color: mixHex(key, 0xffffff, 0.6),
        mode: 'drift',
        speed: rng.nextFloat(0.3, 0.8),
        amp: rng.nextFloat(0.2, 0.6),
        phase: rng.next(),
        span: 2.4,
      });
    }
    this.motes.push(new MoteField(spray, { additive: true, opacity: 0.5 }));

    // 3) Warm afternoon dust motes around the windmill.
    const dust: MoteSpec[] = [];
    for (let i = 0; i < 12; i++) {
      dust.push({
        x: rng.nextFloat(-4.5, 2.5),
        y: SURFACE_Y + rng.nextFloat(0.6, 3.0),
        z: rng.nextFloat(-3.2, 2.4),
        w: 0.07,
        h: 0.07,
        d: 0.07,
        color: mixHex(glow, accent, 0.25),
        mode: 'orbit',
        speed: rng.nextFloat(0.25, 0.55),
        amp: rng.nextFloat(0.3, 0.8),
        phase: rng.next(),
        span: 1,
      });
    }
    this.motes.push(new MoteField(dust, { additive: true, opacity: 0.5 }));

    for (const mote of this.motes) this.group.add(mote.mesh);
  }

  protected updateAtmosphere(dt: number, time: number): void {
    this.waterfall?.update(time);
    for (const mote of this.motes) mote.update(time);
    for (const flicker of this.flickers) {
      flicker.light.intensity =
        flicker.base + Math.sin(time * flicker.speed + flicker.phase) * flicker.amp;
    }
    if (this.sails) {
      this.sails.rotation.z += dt * 0.45;
    }
    for (const floater of this.floaters) {
      floater.object.position.y = floater.baseY + Math.sin(time * 0.8 + floater.phase) * 0.03;
      floater.object.rotation.z = Math.sin(time * 0.9 + floater.phase) * floater.roll;
    }
  }

  destroy(): void {
    this.waterfall?.dispose();
    this.waterfall = null;
    this.sails = null;
    this.motes.length = 0;
    this.flickers.length = 0;
    this.floaters.length = 0;
    super.destroy();
  }
}
