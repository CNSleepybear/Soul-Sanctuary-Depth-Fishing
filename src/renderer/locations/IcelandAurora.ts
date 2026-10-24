// ===== src/renderer/locations/IcelandAurora.ts =====
// 🇮🇸 Iceland �?aurora over the black church.
//
// v2 art pass: the Búðakirkja-like black church (white window frames, turf
// strip) is the single anchor; a turf house, basalt columns and steaming vents
// are the secondaries. Layered aurora curtains, geothermal steam and snow
// spindrift supply the atmosphere. Static voxels are instanced into 3 batches.

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

export class IcelandAurora extends BaseLocation {
  readonly id = 'iceland';

  private readonly motes: MoteField[] = [];
  private readonly flickers: FlickerSpec[] = [];
  private waterfall: Waterfall | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'iceland')!;
  }

  protected buildGeometry(): void {
    const island = this.createIsland();
    this.group.add(island.group);

    const art = this.art;
    const accent = art.accent ?? 0x3ee6a8;
    const glow = art.glow ?? 0x7df0c0;
    const shadow = art.shadow ?? 0x1e2c36;
    const veil = art.veil ?? 0x0e1a22;
    const key = art.key ?? 0x9fc9e8;
    const fill = art.fill ?? accent;
    const islandRadius = island.radius;

    // Local palette derived from the script: black tar church, white trim,
    // mossy turf, grey basalt, pale snow.
    const churchBlack = mixHex(shadow, 0x23262c, 0.45);
    const whiteTrim = mixHex(key, 0xf4f7f8, 0.72);
    const turf = mixHex(accent, 0x3d6a3a, 0.62);
    const basalt = mixHex(shadow, 0x4a4e58, 0.5);
    const basaltDark = shade(basalt, 0.78);
    const snow = mixHex(key, 0xeef4f6, 0.62);
    const snowShade = mixHex(snow, veil, 0.2);
    const ember = mixHex(glow, 0xffaa33, 0.5);

    const stage = new VoxelStage();
    const rng = createRng(hashSeed('iceland:aurora'));

    // ── Wind-combed tundra: clustered moss, snow crust and cotton grass ──
    for (let i = 0; i < 38; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(2.2, islandRadius - 0.55);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const w = rng.nextFloat(0.35, 0.9);
      const d = rng.nextFloat(0.3, 0.7);
      const patch = rng.chance(0.48)
        ? mixHex(turf, veil, 0.25)
        : rng.chance(0.55)
          ? snow
          : snowShade;
      stage.trim(x, SURFACE_Y + 0.045, z, w, 0.09, d, patch, rng.nextFloat(-0.45, 0.45));
      if (i % 3 === 0) {
        stage.trim(
          x - 0.08,
          SURFACE_Y + 0.12,
          z,
          w * 0.55,
          0.08,
          d * 0.6,
          mixHex(patch, key, 0.12),
        );
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = -4.7 + rng.nextFloat(-0.45, 0.7);
      const z = -0.2 + rng.nextFloat(-1.0, 2.2);
      const h = rng.nextFloat(0.22, 0.48);
      stage.trim(x, SURFACE_Y + h / 2, z, 0.045, h, 0.045, mixHex(turf, key, 0.25));
      stage.trim(x, SURFACE_Y + h, z, 0.11, 0.1, 0.1, snow);
    }

    // ── Landmark: tar-black church, white joinery and a turf-lined churchyard ──
    const churchX = -2.6;
    const churchZ = -1.9;
    stage.trim(churchX, SURFACE_Y + 0.09, churchZ, 2.05, 0.18, 3.05, basaltDark);
    for (let i = 0; i < 7; i++) {
      stage.trim(
        churchX - 0.82 + i * 0.27,
        SURFACE_Y + 0.19,
        churchZ + 1.48,
        0.23,
        0.16,
        0.18,
        i % 2 === 0 ? basalt : basaltDark,
      );
    }
    stage.solid(churchX, SURFACE_Y + 1.15, churchZ, 1.5, 1.9, 2.6, churchBlack);
    for (let i = 0; i < 7; i++) {
      const x = churchX - 0.66 + i * 0.22;
      stage.trim(
        x,
        SURFACE_Y + 1.15,
        churchZ + 1.312,
        0.035,
        1.82,
        0.035,
        shade(churchBlack, 1.35),
      );
    }
    for (const side of [-1, 1]) {
      stage.trim(
        churchX + side * 0.758,
        SURFACE_Y + 1.12,
        churchZ,
        0.035,
        1.75,
        2.5,
        shade(churchBlack, side > 0 ? 1.22 : 0.78),
      );
      stage.solid(
        churchX + side * 0.68,
        SURFACE_Y + 0.36,
        churchZ - 0.8,
        0.18,
        0.55,
        0.32,
        churchBlack,
      );
    }
    const roofTiers = [
      { y: 2.2, w: 1.68, d: 2.78 },
      { y: 2.42, w: 1.34, d: 2.62 },
      { y: 2.64, w: 1.0, d: 2.42 },
      { y: 2.86, w: 0.66, d: 2.16 },
      { y: 3.08, w: 0.34, d: 1.78 },
    ];
    roofTiers.forEach((tier, i) => {
      stage.solid(
        churchX,
        SURFACE_Y + tier.y,
        churchZ,
        tier.w,
        0.22,
        tier.d,
        i % 2 === 0 ? churchBlack : shade(churchBlack, 1.12),
      );
    });
    stage.trim(churchX, SURFACE_Y + 2.08, churchZ, 1.76, 0.08, 2.88, turf);
    stage.trim(churchX, SURFACE_Y + 3.22, churchZ - 0.12, 0.14, 0.12, 1.7, shade(churchBlack, 1.4));
    stage.trim(churchX - 0.36, SURFACE_Y + 2.96, churchZ - 0.28, 0.24, 0.07, 1.25, snowShade);

    const towerZ = churchZ + 1.65;
    stage.solid(churchX, SURFACE_Y + 1.7, towerZ, 0.8, 3.0, 0.8, churchBlack);
    stage.trim(churchX, SURFACE_Y + 2.65, towerZ + 0.41, 0.66, 0.08, 0.05, whiteTrim);
    for (const lx of [-0.19, 0, 0.19]) {
      stage.trim(churchX + lx, SURFACE_Y + 2.92, towerZ + 0.412, 0.09, 0.38, 0.04, veil);
    }
    stage.solid(churchX, SURFACE_Y + 3.3, towerZ, 0.98, 0.16, 0.98, shade(churchBlack, 1.12));
    stage.solid(churchX, SURFACE_Y + 3.49, towerZ, 0.64, 0.22, 0.64, churchBlack);
    stage.solid(churchX, SURFACE_Y + 3.67, towerZ, 0.34, 0.16, 0.34, shade(churchBlack, 1.18));
    stage.glow(churchX, SURFACE_Y + 3.94, towerZ, 0.07, 0.5, 0.07, whiteTrim);
    stage.glow(churchX, SURFACE_Y + 4.02, towerZ, 0.34, 0.07, 0.07, whiteTrim);

    for (const wx of [-0.4, 0.4]) {
      stage.glow(churchX + wx, SURFACE_Y + 1.4, churchZ + 1.326, 0.28, 0.46, 0.045, ember);
      for (const side of [-1, 1]) {
        stage.trim(
          churchX + wx + side * 0.2,
          SURFACE_Y + 1.4,
          churchZ + 1.35,
          0.06,
          0.62,
          0.06,
          whiteTrim,
        );
      }
      for (const y of [1.09, 1.71]) {
        stage.trim(churchX + wx, SURFACE_Y + y, churchZ + 1.35, 0.46, 0.06, 0.06, whiteTrim);
      }
      stage.trim(churchX + wx, SURFACE_Y + 1.4, churchZ + 1.36, 0.045, 0.5, 0.04, whiteTrim);
      stage.trim(churchX + wx, SURFACE_Y + 1.4, churchZ + 1.36, 0.32, 0.045, 0.04, whiteTrim);
      stage.trim(churchX + wx, SURFACE_Y + 1.04, churchZ + 1.39, 0.54, 0.08, 0.16, snowShade);
    }
    stage.trim(churchX, SURFACE_Y + 0.72, churchZ + 1.35, 0.48, 1.08, 0.07, whiteTrim);
    stage.solid(
      churchX,
      SURFACE_Y + 0.7,
      churchZ + 1.397,
      0.34,
      0.92,
      0.05,
      shade(churchBlack, 0.7),
    );
    stage.glow(churchX + 0.1, SURFACE_Y + 0.7, churchZ + 1.43, 0.045, 0.045, 0.035, ember);
    for (const wz of [-0.65, 0.25]) {
      stage.glow(
        churchX + 0.766,
        SURFACE_Y + 1.35,
        churchZ + wz,
        0.04,
        0.42,
        0.34,
        shade(ember, 0.8),
      );
      stage.trim(churchX + 0.79, SURFACE_Y + 1.35, churchZ + wz, 0.05, 0.56, 0.46, whiteTrim);
      stage.glow(churchX + 0.82, SURFACE_Y + 1.35, churchZ + wz, 0.035, 0.38, 0.28, ember);
    }
    for (let i = 0; i < 7; i++) {
      stage.trim(
        churchX + Math.sin(i * 0.55) * 0.28,
        SURFACE_Y + 0.055,
        churchZ + 2.15 + i * 0.3,
        0.5,
        0.08,
        0.24,
        i % 2 === 0 ? basalt : snowShade,
        Math.sin(i) * 0.18,
      );
    }
    for (let i = 0; i < 8; i++) {
      const x = churchX - 1.55 + i * 0.44;
      stage.solid(x, SURFACE_Y + 0.31, churchZ - 1.75, 0.09, 0.62, 0.09, churchBlack);
      if (i < 7)
        stage.trim(
          x + 0.22,
          SURFACE_Y + 0.4,
          churchZ - 1.75,
          0.44,
          0.08,
          0.08,
          shade(churchBlack, 1.3),
        );
    }

    // ── Secondary: a lived-in turf house with deep eaves and a chimney ──
    const turfX = 2.1;
    const turfZ = -2.3;
    stage.solid(turfX, SURFACE_Y + 0.55, turfZ, 1.7, 1.1, 1.5, churchBlack);
    stage.solid(turfX, SURFACE_Y + 1.18, turfZ, 2.0, 0.3, 1.82, shade(turf, 0.8));
    stage.solid(turfX, SURFACE_Y + 1.38, turfZ, 1.7, 0.18, 1.56, turf);
    stage.trim(turfX, SURFACE_Y + 1.5, turfZ, 1.38, 0.08, 1.28, mixHex(turf, snow, 0.35));
    stage.trim(turfX, SURFACE_Y + 0.48, turfZ + 0.78, 0.36, 0.78, 0.07, shade(churchBlack, 0.75));
    stage.glow(turfX - 0.5, SURFACE_Y + 0.65, turfZ + 0.78, 0.3, 0.3, 0.06, ember);
    stage.trim(turfX - 0.5, SURFACE_Y + 0.65, turfZ + 0.82, 0.04, 0.34, 0.04, whiteTrim);
    stage.solid(turfX + 0.52, SURFACE_Y + 1.7, turfZ - 0.35, 0.28, 0.55, 0.3, basaltDark);
    stage.trim(turfX + 0.52, SURFACE_Y + 2.0, turfZ - 0.35, 0.34, 0.08, 0.36, snowShade);

    // ── Secondary: fractured basalt organ pipes ──
    const basaltColumn = (x: number, z: number, h: number, w: number): void => {
      stage.solid(x, SURFACE_Y + h / 2, z, w, h, w, basalt);
      stage.trim(x, SURFACE_Y + h + 0.03, z, w * 0.9, 0.08, w * 0.9, snow);
      stage.trim(x + w * 0.51, SURFACE_Y + h * 0.52, z, 0.035, h * 0.82, w * 0.7, basaltDark);
    };
    basaltColumn(3.4, -0.9, 1.9, 0.5);
    basaltColumn(3.9, -0.7, 1.4, 0.42);
    basaltColumn(3.1, -0.5, 1.1, 0.38);
    basaltColumn(3.7, -0.2, 0.8, 0.34);
    basaltColumn(4.15, -1.15, 1.05, 0.3);

    // ── Geothermal terraces: mineral rims, turquoise water and two steam vents ──
    const ventX = 1.0;
    const ventZ = 0.9;
    const mineral = mixHex(key, 0xc6b78c, 0.55);
    stage.trim(ventX, SURFACE_Y + 0.035, ventZ, 1.65, 0.07, 1.35, mixHex(mineral, veil, 0.25));
    stage.trim(ventX - 0.12, SURFACE_Y + 0.09, ventZ, 1.25, 0.08, 1.0, mineral);
    stage.trim(
      ventX - 0.18,
      SURFACE_Y + 0.14,
      ventZ,
      0.86,
      0.06,
      0.66,
      mixHex(accent, 0x9fd8d0, 0.65),
    );
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      stage.trim(
        ventX + Math.cos(a) * 0.53,
        SURFACE_Y + 0.17,
        ventZ + Math.sin(a) * 0.43,
        0.22,
        0.2,
        0.2,
        i % 3 === 0 ? mineral : basaltDark,
        a,
      );
    }
    stage.glow(
      ventX - 0.15,
      SURFACE_Y + 0.18,
      ventZ,
      0.38,
      0.045,
      0.3,
      mixHex(accent, 0xffffff, 0.45),
    );
    stage.trim(2.0, SURFACE_Y + 0.07, 0.1, 0.72, 0.1, 0.58, mineral);
    stage.glow(2.0, SURFACE_Y + 0.13, 0.1, 0.22, 0.05, 0.22, mixHex(accent, key, 0.5));

    // ── Foreground frame kept to the far right, clear of the fishing approach ──
    const rockX = 4.7;
    const rockZ = 2.3;
    stage.solid(rockX, SURFACE_Y + 0.35, rockZ, 0.9, 0.7, 0.7, basalt);
    stage.solid(rockX + 0.7, SURFACE_Y + 0.24, rockZ + 0.4, 0.6, 0.48, 0.55, basaltDark);
    stage.solid(rockX - 0.6, SURFACE_Y + 0.2, rockZ - 0.3, 0.5, 0.4, 0.5, basalt);
    stage.trim(rockX, SURFACE_Y + 0.72, rockZ, 0.86, 0.1, 0.66, snow);
    stage.trim(rockX + 0.7, SURFACE_Y + 0.48, rockZ + 0.4, 0.56, 0.08, 0.5, snowShade);
    for (let i = 0; i < 5; i++) {
      stage.trim(
        3.4 + rng.nextFloat(0, 2.2),
        SURFACE_Y + 0.07,
        1.4 + rng.nextFloat(0, 2.2),
        rng.nextFloat(0.4, 0.9),
        0.12,
        rng.nextFloat(0.3, 0.7),
        snow,
        rng.nextFloat(-0.5, 0.5),
      );
    }

    stage.flush(this.group);

    // ── Local lights: warm church windows, turf house, cool aurora spill ──
    const windowLight = new THREE.PointLight(0xffaa33, 3.6, 6.5);
    windowLight.position.set(churchX, SURFACE_Y + 1.3, churchZ + 1.5);
    this.group.add(windowLight);
    this.flickers.push({ light: windowLight, base: 3.6, speed: 2.1, amp: 0.4, phase: 0.4 });

    const hutLight = new THREE.PointLight(ember, 2.0, 5);
    hutLight.position.set(turfX, SURFACE_Y + 0.7, turfZ + 0.9);
    this.group.add(hutLight);
    this.flickers.push({ light: hutLight, base: 2.0, speed: 2.8, amp: 0.3, phase: 1.7 });

    const auroraLight = new THREE.PointLight(fill, 3.0, 12);
    auroraLight.position.set(churchX, SURFACE_Y + 4.6, churchZ);
    this.group.add(auroraLight);
    this.flickers.push({ light: auroraLight, base: 3.0, speed: 0.5, amp: 0.9, phase: 0.9 });

    // Aurora focal halo above the church spire.
    this.group.add(
      buildGlowOrb({
        color: glow,
        size: 0.4,
        position: new THREE.Vector3(churchX, SURFACE_Y + 3.9, churchZ + 1.65),
        layers: 2,
      }),
    );

    this.waterfall = new Waterfall({
      radius: islandRadius + 0.25,
      innerRadius: islandRadius - 0.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(key, 0xbfe0e8, 0.5),
      opacity: 0.45,
      density: 0.6,
    });
    this.group.add(this.waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const accent = art.accent ?? 0x3ee6a8;
    const glow = art.glow ?? 0x7df0c0;
    const fill = art.fill ?? accent;
    const key = art.key ?? 0x9fc9e8;
    const veil = art.veil ?? 0x0e1a22;
    const rng = createRng(hashSeed('iceland:atmosphere'));

    // Three depth-separated ribbons share one draw call; narrow cells make a
    // continuous folded silhouette instead of a scatter of glowing rectangles.
    const aurora: MoteSpec[] = [];
    const bandColors = [accent, mixHex(fill, key, 0.3), glow];
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 19; i++) {
        const t = i / 18;
        const x = -6.3 + t * 12.6;
        const wave = Math.sin(t * Math.PI * 2.2 + layer * 0.85);
        aurora.push({
          x,
          y: SURFACE_Y + 5.2 + layer * 0.48 + wave * 0.42,
          z: -5.1 + layer * 1.05 + Math.cos(t * Math.PI * 2 + layer) * 0.35,
          w: 0.76,
          h: 1.1 + (Math.sin(t * Math.PI * 3.4 + layer * 0.6) * 0.5 + 0.5) * 1.65,
          d: 0.045,
          color: mixHex(bandColors[layer], key, i % 5 === 0 ? 0.22 : 0.04),
          mode: 'orbit',
          speed: 0.07 + layer * 0.018,
          amp: 0.12 + layer * 0.035,
          phase: t * 0.16 + layer * 0.11,
          span: 1,
        });
      }
    }
    this.motes.push(new MoteField(aurora, { additive: true, opacity: 0.2 }));

    // Steam expands as it rises from both mineral pools, with a low wind-blown veil.
    const steam: MoteSpec[] = [];
    for (let i = 0; i < 24; i++) {
      const secondary = i >= 16;
      steam.push({
        x: (secondary ? 2.0 : 0.85) + rng.nextFloat(-0.18, 0.18),
        y: SURFACE_Y + 0.2,
        z: (secondary ? 0.1 : 0.9) + rng.nextFloat(-0.16, 0.16),
        w: rng.nextFloat(0.18, 0.42),
        h: rng.nextFloat(0.18, 0.38),
        d: rng.nextFloat(0.18, 0.4),
        color: mixHex(0xffffff, veil, 0.2),
        mode: 'rise',
        speed: rng.nextFloat(0.14, 0.28),
        amp: rng.nextFloat(0.12, 0.38),
        phase: rng.next(),
        span: secondary ? 2.3 : 3.2,
      });
    }
    this.motes.push(new MoteField(steam, { opacity: 0.26 }));

    // 3) Snow spindrift skimming the snowfields.
    const drift: MoteSpec[] = [];
    for (let i = 0; i < 22; i++) {
      drift.push({
        x: rng.nextFloat(-6, 6),
        y: SURFACE_Y + rng.nextFloat(0.2, 2.2),
        z: rng.nextFloat(-6, 6),
        w: 0.08,
        h: 0.08,
        d: 0.08,
        color: mixHex(key, 0xffffff, 0.6),
        mode: 'drift',
        speed: rng.nextFloat(0.3, 0.6),
        amp: rng.nextFloat(0.2, 0.6),
        phase: rng.next(),
        span: 4,
      });
    }
    this.motes.push(new MoteField(drift, { additive: true, opacity: 0.5 }));

    // 4) Aurora ions twinkling above the church.
    const ions: MoteSpec[] = [];
    for (let i = 0; i < 16; i++) {
      ions.push({
        x: rng.nextFloat(-5, 5),
        y: rng.nextFloat(SURFACE_Y + 3.6, SURFACE_Y + 6.4),
        z: rng.nextFloat(-5, 2.5),
        w: 0.07,
        h: 0.07,
        d: 0.07,
        color: mixHex(glow, 0xd8fff0, 0.4),
        mode: 'orbit',
        speed: rng.nextFloat(0.4, 0.9),
        amp: rng.nextFloat(0.4, 1.1),
        phase: rng.next(),
        span: 1,
      });
    }
    this.motes.push(new MoteField(ions, { additive: true, opacity: 0.55 }));

    for (const mote of this.motes) this.group.add(mote.mesh);
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    this.waterfall?.update(time);
    for (const mote of this.motes) mote.update(time);
    for (const flicker of this.flickers) {
      flicker.light.intensity =
        flicker.base + Math.sin(time * flicker.speed + flicker.phase) * flicker.amp;
    }
  }

  destroy(): void {
    this.waterfall?.dispose();
    this.waterfall = null;
    this.motes.length = 0;
    this.flickers.length = 0;
    super.destroy();
  }
}
