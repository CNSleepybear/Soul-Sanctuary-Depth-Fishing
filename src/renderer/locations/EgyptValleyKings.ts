// ===== src/renderer/locations/EgyptValleyKings.ts =====
// 🇪🇬 Egypt �?Valley of the Kings.
//
// v2 art pass: a stepped sandstone pyramid anchors the right third, a second
// pyramid, obelisks, a colonnade with turquoise/gold bands and a sphinx read as
// secondaries. Palms grow in groups, sand dust and embers drift, and the
// pyramidion carries the single glow focus. Static voxels are instanced.

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

export class EgyptValleyKings extends BaseLocation {
  readonly id = 'egypt';

  private readonly motes: MoteField[] = [];
  private readonly flickers: FlickerSpec[] = [];
  private waterfall: Waterfall | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'egypt')!;
  }

  protected buildGeometry(): void {
    const island = this.createIsland();
    this.group.add(island.group);

    const art = this.art;
    const accent = art.accent ?? 0xc9a144;
    const glow = art.glow ?? 0xffcf70;
    const shadow = art.shadow ?? 0x4a3a34;
    const veil = art.veil ?? 0x3a2c26;
    const key = art.key ?? 0xffc98a;
    const islandRadius = island.radius;

    // Local palette: sandstone in three tones + turquoise / gold column bands.
    const sandstone = mixHex(key, 0xd4b896, 0.58);
    const sandstoneDark = shade(sandstone, 0.82);
    const sandstoneLight = mixHex(sandstone, 0xf0dcbc, 0.45);
    const turquoise = mixHex(accent, 0x2f8f8f, 0.88);
    const gold = mixHex(accent, 0xe8c25a, 0.5);
    const palmTrunk = mixHex(veil, 0x5a4a3a, 0.45);
    const palmLeaf = mixHex(accent, 0x4a7a3a, 0.82);
    const sand = mixHex(sandstone, key, 0.35);
    const ember = mixHex(glow, 0xff9a3c, 0.4);

    const stage = new VoxelStage();
    const rng = createRng(hashSeed('egypt:kings'));

    // ── Sand ripples + wind-scoured stone scatter ──
    for (let i = 0; i < 26; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(1.4, islandRadius - 0.5);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.03,
        Math.sin(angle) * radius,
        rng.nextFloat(0.5, 1.1),
        0.07,
        rng.nextFloat(0.3, 0.7),
        mixHex(sand, sandstoneLight, rng.nextFloat(0, 0.5)),
        rng.nextFloat(-0.5, 0.5),
      );
    }

    // ── Landmark: stepped Great Pyramid on the right third ──
    const pyramidX = 2.3;
    const pyramidZ = -2.9;
    stage.trim(pyramidX, SURFACE_Y + 0.12, pyramidZ, 3.5, 0.24, 3.5, sandstoneDark);
    let tierY = SURFACE_Y + 0.24;
    const tiers = [
      { w: 3.1, h: 0.62 },
      { w: 2.5, h: 0.62 },
      { w: 1.95, h: 0.62 },
      { w: 1.45, h: 0.62 },
      { w: 1.0, h: 0.58 },
      { w: 0.6, h: 0.5 },
    ];
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const color = i % 2 === 0 ? sandstone : mixHex(sandstone, sandstoneLight, 0.35);
      stage.solid(pyramidX, tierY + tier.h / 2, pyramidZ, tier.w, tier.h, tier.w, color);
      if (i > 0) {
        stage.trim(
          pyramidX,
          tierY + tier.h / 2,
          pyramidZ + tier.w / 2 + 0.01,
          tier.w * 0.9,
          0.06,
          0.05,
          turquoise,
        );
      }
      tierY += tier.h;
    }
    // gold pyramidion + glow seam
    stage.glow(pyramidX, tierY + 0.16, pyramidZ, 0.34, 0.32, 0.34, gold);
    stage.trim(pyramidX, tierY + 0.04, pyramidZ, 0.5, 0.1, 0.5, gold);

    // ── Secondary: smaller companion pyramid ──
    const smallX = -3.2;
    const smallZ = -2.6;
    stage.solid(smallX, SURFACE_Y + 0.4, smallZ, 2.2, 0.8, 2.2, sandstone);
    stage.solid(
      smallX,
      SURFACE_Y + 1.1,
      smallZ,
      1.6,
      0.7,
      1.6,
      mixHex(sandstone, sandstoneLight, 0.3),
    );
    stage.solid(smallX, SURFACE_Y + 1.7, smallZ, 1.0, 0.6, 1.0, sandstone);
    stage.glow(smallX, SURFACE_Y + 2.18, smallZ, 0.3, 0.3, 0.3, gold);

    // ── Secondary: obelisk pair with turquoise/gold bands ──
    const obelisk = (x: number, z: number, h: number): void => {
      stage.solid(x, SURFACE_Y + 0.24, z, 0.56, 0.4, 0.56, sandstoneDark);
      let y = SURFACE_Y + 0.44;
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const w = 0.44 - i * 0.05;
        const segH = h / segs;
        stage.solid(x, y + segH / 2, z, w, segH, w, i % 2 === 0 ? sandstone : sandstoneLight);
        if (i % 2 === 1) {
          stage.trim(x, y + segH / 2, z + w / 2 + 0.01, w * 0.8, 0.1, 0.04, turquoise);
        }
        y += segH;
      }
      stage.glow(x, y + 0.18, z, 0.2, 0.34, 0.2, gold);
    };
    obelisk(-1.9, -2.9, 2.6);
    obelisk(-1.1, -2.9, 2.2);

    // ── Secondary: colonnade with painted bands ──
    const column = (x: number, z: number): void => {
      stage.solid(x, SURFACE_Y + 0.09, z, 0.46, 0.18, 0.46, sandstoneDark);
      stage.solid(x, SURFACE_Y + 0.18 + 1.0, z, 0.34, 2.0, 0.34, sandstone);
      stage.trim(x, SURFACE_Y + 1.3, z + 0.18, 0.36, 0.12, 0.06, turquoise);
      stage.trim(x, SURFACE_Y + 0.8, z + 0.18, 0.36, 0.1, 0.06, gold);
      stage.solid(x, SURFACE_Y + 2.3, z, 0.48, 0.2, 0.48, sandstoneDark);
    };
    column(-0.1, -3.1);
    column(0.5, -3.1);
    column(1.1, -3.1);
    stage.solid(0.5, SURFACE_Y + 2.56, -3.1, 1.55, 0.18, 0.5, sandstoneDark);

    // ── Secondary: Sphinx in front of the pyramid ──
    const sphinxX = 2.6;
    const sphinxZ = -0.4;
    stage.solid(sphinxX, SURFACE_Y + 0.3, sphinxZ, 1.1, 0.6, 1.6, sandstone);
    stage.solid(sphinxX, SURFACE_Y + 0.5, sphinxZ + 0.5, 1.2, 0.4, 0.7, sandstoneLight);
    stage.solid(sphinxX, SURFACE_Y + 0.95, sphinxZ + 0.62, 0.6, 0.66, 0.6, sandstone);
    stage.solid(
      sphinxX,
      SURFACE_Y + 1.16,
      sphinxZ + 0.62,
      0.7,
      0.24,
      0.7,
      mixHex(sandstoneDark, key, 0.3),
    );
    stage.trim(sphinxX, SURFACE_Y + 1.32, sphinxZ + 0.62, 0.72, 0.08, 0.72, turquoise);
    stage.glow(sphinxX - 0.14, SURFACE_Y + 1.0, sphinxZ + 0.94, 0.08, 0.07, 0.04, gold);
    stage.glow(sphinxX + 0.14, SURFACE_Y + 1.0, sphinxZ + 0.94, 0.08, 0.07, 0.04, gold);
    for (const legZ of [-0.55, 0.55]) {
      stage.solid(sphinxX - 0.36, SURFACE_Y + 0.2, sphinxZ + legZ, 0.22, 0.4, 0.34, sandstoneDark);
      stage.solid(sphinxX + 0.36, SURFACE_Y + 0.2, sphinxZ + legZ, 0.22, 0.4, 0.34, sandstoneDark);
    }

    // ── Secondary: palms in a group ──
    const palm = (x: number, z: number, height: number, seed: number): void => {
      const palmRng = createRng(seed);
      const segs = 5;
      let px = 0;
      for (let i = 0; i < segs; i++) {
        px += 0.07;
        stage.solid(
          x + px,
          SURFACE_Y + (height / segs) * (i + 0.5),
          z,
          0.26,
          height / segs,
          0.26,
          palmTrunk,
        );
      }
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * TAU + 0.3;
        stage.trim(
          x + px + Math.cos(angle) * 0.5,
          SURFACE_Y + height + 0.1,
          z + Math.sin(angle) * 0.5,
          palmRng.nextFloat(0.7, 0.95),
          0.08,
          0.24,
          i % 2 === 0 ? palmLeaf : shade(palmLeaf, 0.85),
          angle,
        );
      }
      stage.trim(
        x + px,
        SURFACE_Y + height - 0.1,
        z,
        0.22,
        0.16,
        0.22,
        mixHex(palmTrunk, gold, 0.4),
      );
    };
    palm(-4.1, 0.9, 2.6, hashSeed('eg:palm1'));
    palm(-3.4, 1.5, 2.1, hashSeed('eg:palm2'));
    palm(-4.5, 1.9, 1.8, hashSeed('eg:palm3'));
    palm(4.1, -2.4, 2.3, hashSeed('eg:palm4'));

    // ── Foreground frame: sandstone boulders + papyrus reeds ──
    const rockX = 4.7;
    const rockZ = 2.4;
    stage.solid(rockX, SURFACE_Y + 0.42, rockZ, 0.9, 0.84, 0.7, sandstone);
    stage.solid(rockX + 0.7, SURFACE_Y + 0.26, rockZ + 0.4, 0.6, 0.52, 0.5, sandstoneDark);
    stage.solid(rockX - 0.55, SURFACE_Y + 0.2, rockZ - 0.2, 0.5, 0.4, 0.44, sandstoneLight);
    for (let i = 0; i < 8; i++) {
      const h = rng.nextFloat(0.5, 0.95);
      stage.trim(
        4.2 + rng.nextFloat(-0.2, 0.2),
        SURFACE_Y + h / 2,
        2.7 + rng.nextFloat(-0.2, 0.2),
        0.07,
        h,
        0.07,
        mixHex(palmLeaf, shadow, rng.nextFloat(0.2, 0.5)),
      );
    }
    // small camel resting near the palms
    const camelX = 0.6;
    const camelZ = 1.4;
    stage.solid(camelX, SURFACE_Y + 0.4, camelZ, 0.66, 0.4, 0.34, mixHex(key, 0xc4a070, 0.5));
    stage.solid(
      camelX + 0.32,
      SURFACE_Y + 0.66,
      camelZ,
      0.24,
      0.34,
      0.24,
      mixHex(key, 0xc4a070, 0.5),
    );
    stage.trim(camelX + 0.46, SURFACE_Y + 0.6, camelZ, 0.16, 0.1, 0.16, mixHex(key, 0x8a6a50, 0.5));
    for (const [lx, lz] of [
      [-0.24, 0.14],
      [-0.24, -0.14],
      [0.24, 0.14],
      [0.24, -0.14],
    ]) {
      stage.solid(
        camelX + lx,
        SURFACE_Y + 0.1,
        camelZ + lz,
        0.1,
        0.24,
        0.1,
        shade(mixHex(key, 0xc4a070, 0.5), 0.9),
      );
    }

    stage.flush(this.group);

    // ── Local warm lights: colonnade torch, sphinx face, palm campfire ──
    const torchLight = new THREE.PointLight(glow, 4.2, 7.5);
    torchLight.position.set(0.5, SURFACE_Y + 1.6, -2.4);
    this.group.add(torchLight);
    this.flickers.push({ light: torchLight, base: 4.2, speed: 3.1, amp: 0.7, phase: 0.3 });

    const sphinxLight = new THREE.PointLight(ember, 2.6, 5.5);
    sphinxLight.position.set(2.6, SURFACE_Y + 1.0, 0.4);
    this.group.add(sphinxLight);
    this.flickers.push({ light: sphinxLight, base: 2.6, speed: 2.2, amp: 0.4, phase: 1.6 });

    const campLight = new THREE.PointLight(glow, 2.2, 5);
    campLight.position.set(-3.8, SURFACE_Y + 0.8, 1.4);
    this.group.add(campLight);
    this.flickers.push({ light: campLight, base: 2.2, speed: 3.6, amp: 0.5, phase: 2.4 });

    // Gold halo around the pyramidion.
    this.group.add(
      buildGlowOrb({
        color: gold,
        size: 0.4,
        position: new THREE.Vector3(pyramidX, SURFACE_Y + 3.6, pyramidZ),
        layers: 2,
      }),
    );

    this.waterfall = new Waterfall({
      radius: islandRadius + 0.25,
      innerRadius: islandRadius - 0.2,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(sandstone, 0xa8d8c8, 0.35),
      opacity: 0.45,
      density: 0.62,
    });
    this.group.add(this.waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glow = art.glow ?? 0xffcf70;
    const accent = art.accent ?? 0xc9a144;
    const key = art.key ?? 0xffc98a;
    const veil = art.veil ?? 0x3a2c26;
    const rng = createRng(hashSeed('egypt:atmosphere'));

    // 1) Desert dust drifting with a vertical swirl.
    const dust: MoteSpec[] = [];
    for (let i = 0; i < 30; i++) {
      dust.push({
        x: rng.nextFloat(-6, 6),
        y: SURFACE_Y + rng.nextFloat(0.15, 2.4),
        z: rng.nextFloat(-6, 6),
        w: rng.nextFloat(0.08, 0.18),
        h: rng.nextFloat(0.08, 0.18),
        d: rng.nextFloat(0.08, 0.18),
        color: mixHex(key, 0xe8d8b0, 0.4),
        mode: 'drift',
        speed: rng.nextFloat(0.25, 0.7),
        amp: rng.nextFloat(0.2, 0.6),
        phase: rng.next(),
        span: 5,
      });
    }
    this.motes.push(new MoteField(dust, { opacity: 0.4 }));

    // 2) Golden embers rising off the torch/camp light.
    const embers: MoteSpec[] = [];
    for (let i = 0; i < 12; i++) {
      embers.push({
        x: rng.nextFloat(-0.2, 1.2),
        y: SURFACE_Y + 0.7,
        z: -2.4 + rng.nextFloat(-0.4, 0.4),
        w: 0.07,
        h: 0.07,
        d: 0.07,
        color: mixHex(glow, accent, 0.4),
        mode: 'rise',
        speed: rng.nextFloat(0.18, 0.35),
        amp: rng.nextFloat(0.1, 0.3),
        phase: rng.next(),
        span: 3.4,
      });
    }
    this.motes.push(new MoteField(embers, { additive: true, opacity: 0.7 }));

    // 3) Heat shimmer above the sand.
    const shimmer: MoteSpec[] = [];
    for (let i = 0; i < 14; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(2.5, 6.4);
      shimmer.push({
        x: Math.cos(angle) * radius,
        y: SURFACE_Y + rng.nextFloat(0.4, 1.6),
        z: Math.sin(angle) * radius,
        w: rng.nextFloat(0.5, 1.1),
        h: 0.03,
        d: 0.1,
        color: mixHex(veil, 0xf0d8a8, 0.4),
        mode: 'orbit',
        speed: rng.nextFloat(0.12, 0.3),
        amp: rng.nextFloat(0.2, 0.5),
        phase: rng.next(),
        span: 1,
      });
    }
    this.motes.push(new MoteField(shimmer, { additive: true, opacity: 0.28 }));

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
