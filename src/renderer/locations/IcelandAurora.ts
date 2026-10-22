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

    // ── Snow / moss ground patches ──
    for (let i = 0; i < 22; i++) {
      const angle = rng.nextFloat(0, TAU);
      const radius = rng.nextFloat(1.6, islandRadius - 0.6);
      stage.trim(
        Math.cos(angle) * radius,
        SURFACE_Y + 0.05,
        Math.sin(angle) * radius,
        rng.nextFloat(0.4, 0.85),
        0.1,
        rng.nextFloat(0.35, 0.7),
        rng.chance(0.6) ? snow : snowShade,
        rng.nextFloat(-0.4, 0.4),
      );
    }

    // ── Landmark: black church with white window frames + turf roof strip ──
    const churchX = -2.6;
    const churchZ = -1.9;
    stage.trim(churchX, SURFACE_Y + 0.1, churchZ, 2.0, 0.2, 3.0, basaltDark);
    stage.solid(churchX, SURFACE_Y + 0.2 + 0.95, churchZ, 1.5, 1.9, 2.6, churchBlack);
    // stepped steep roof
    stage.solid(churchX, SURFACE_Y + 2.2, churchZ, 1.62, 0.22, 2.72, churchBlack);
    stage.solid(churchX, SURFACE_Y + 2.42, churchZ, 1.32, 0.22, 2.55, shade(churchBlack, 1.12));
    stage.solid(churchX, SURFACE_Y + 2.64, churchZ, 1.0, 0.22, 2.3, churchBlack);
    stage.solid(churchX, SURFACE_Y + 2.86, churchZ, 0.66, 0.22, 1.95, shade(churchBlack, 1.12));
    stage.solid(churchX, SURFACE_Y + 3.08, churchZ, 0.34, 0.22, 1.5, churchBlack);
    // turf strip along the roof eaves
    stage.trim(churchX, SURFACE_Y + 2.08, churchZ, 1.7, 0.08, 2.85, turf);
    // tower + white cross
    stage.solid(churchX, SURFACE_Y + 0.2 + 1.5, churchZ + 1.65, 0.8, 3.0, 0.8, churchBlack);
    stage.solid(
      churchX,
      SURFACE_Y + 3.3,
      churchZ + 1.65,
      0.95,
      0.16,
      0.95,
      shade(churchBlack, 1.12),
    );
    stage.trim(churchX, SURFACE_Y + 3.5, churchZ + 1.65, 0.6, 0.22, 0.6, churchBlack);
    stage.glow(churchX, SURFACE_Y + 3.82, churchZ + 1.65, 0.07, 0.5, 0.07, whiteTrim);
    stage.glow(churchX, SURFACE_Y + 3.9, churchZ + 1.65, 0.34, 0.07, 0.07, whiteTrim);
    // white window frames + warm windows on the camera-facing side (+z)
    for (const wx of [-0.38, 0.38]) {
      stage.glow(churchX + wx, SURFACE_Y + 1.35, churchZ + 1.32, 0.3, 0.5, 0.06, ember);
      stage.trim(
        churchX + wx - 0.22,
        SURFACE_Y + 1.35,
        churchZ + 1.34,
        0.06,
        0.64,
        0.06,
        whiteTrim,
      );
      stage.trim(
        churchX + wx + 0.22,
        SURFACE_Y + 1.35,
        churchZ + 1.34,
        0.06,
        0.64,
        0.06,
        whiteTrim,
      );
      stage.trim(churchX + wx, SURFACE_Y + 1.66, churchZ + 1.34, 0.5, 0.06, 0.06, whiteTrim);
      stage.trim(churchX + wx, SURFACE_Y + 1.04, churchZ + 1.34, 0.5, 0.06, 0.06, whiteTrim);
    }
    // white door frame
    stage.trim(churchX, SURFACE_Y + 0.66, churchZ + 1.34, 0.44, 1.0, 0.06, whiteTrim);
    stage.glow(churchX, SURFACE_Y + 0.62, churchZ + 1.36, 0.3, 0.8, 0.05, shade(ember, 0.8));

    // ── Secondary: turf house with a grass roof ──
    const turfX = 2.1;
    const turfZ = -2.3;
    stage.solid(turfX, SURFACE_Y + 0.55, turfZ, 1.7, 1.1, 1.5, churchBlack);
    stage.solid(turfX, SURFACE_Y + 1.2, turfZ, 2.0, 0.36, 1.8, turf);
    stage.trim(turfX, SURFACE_Y + 1.42, turfZ, 1.7, 0.1, 1.5, mixHex(turf, snow, 0.3));
    stage.glow(turfX, SURFACE_Y + 0.62, turfZ + 0.78, 0.32, 0.3, 0.06, ember);

    // ── Secondary: basalt column cluster ──
    const basaltColumn = (x: number, z: number, h: number, w: number): void => {
      stage.solid(x, SURFACE_Y + h / 2, z, w, h, w, basalt);
      stage.trim(x, SURFACE_Y + h + 0.03, z, w * 0.9, 0.08, w * 0.9, snow);
    };
    basaltColumn(3.4, -0.9, 1.9, 0.5);
    basaltColumn(3.9, -0.7, 1.4, 0.42);
    basaltColumn(3.1, -0.5, 1.1, 0.38);
    basaltColumn(3.7, -0.2, 0.8, 0.34);

    // ── Secondary: geothermal vent with a stone ring ──
    const ventX = 1.0;
    const ventZ = 0.9;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      stage.trim(
        ventX + Math.cos(a) * 0.5,
        SURFACE_Y + 0.12,
        ventZ + Math.sin(a) * 0.5,
        0.3,
        0.24,
        0.3,
        basaltDark,
        a,
      );
    }
    stage.glow(ventX, SURFACE_Y + 0.14, ventZ, 0.34, 0.1, 0.34, mixHex(accent, 0xffffff, 0.3));

    // ── Foreground frame: basalt boulders + snow drift (camera side) ──
    const rockX = 4.7;
    const rockZ = 2.3;
    stage.solid(rockX, SURFACE_Y + 0.35, rockZ, 0.9, 0.7, 0.7, basalt);
    stage.solid(rockX + 0.7, SURFACE_Y + 0.24, rockZ + 0.4, 0.6, 0.48, 0.55, basaltDark);
    stage.solid(rockX - 0.6, SURFACE_Y + 0.2, rockZ - 0.3, 0.5, 0.4, 0.5, basalt);
    stage.trim(rockX, SURFACE_Y + 0.72, rockZ, 0.86, 0.1, 0.66, snow);
    stage.trim(rockX + 0.7, SURFACE_Y + 0.48, rockZ + 0.4, 0.56, 0.08, 0.5, snowShade);
    // drifts
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

    // 1) Aurora curtains: layered additive bands, green core + cyan edge.
    const aurora: MoteSpec[] = [];
    const bandColors = [accent, fill, glow, mixHex(accent, key, 0.45)];
    for (let i = 0; i < 9; i++) {
      aurora.push({
        x: rng.nextFloat(-5.5, 5.5),
        y: rng.nextFloat(SURFACE_Y + 4.6, SURFACE_Y + 7.2),
        z: rng.nextFloat(-4.5, 1.5),
        w: rng.nextFloat(1.4, 2.8),
        h: rng.nextFloat(1.2, 3.2),
        d: 0.06,
        color: bandColors[i % bandColors.length],
        mode: 'orbit',
        speed: rng.nextFloat(0.03, 0.08),
        amp: rng.nextFloat(0.3, 0.9),
        phase: rng.next(),
        span: 1,
      });
    }
    this.motes.push(new MoteField(aurora, { additive: true, opacity: 0.26 }));

    // 2) Geothermal steam rising from the vent.
    const steam: MoteSpec[] = [];
    for (let i = 0; i < 14; i++) {
      steam.push({
        x: 1.0 + rng.nextFloat(-0.25, 0.25),
        y: SURFACE_Y + 0.2,
        z: 0.9 + rng.nextFloat(-0.25, 0.25),
        w: rng.nextFloat(0.2, 0.4),
        h: rng.nextFloat(0.2, 0.4),
        d: rng.nextFloat(0.2, 0.4),
        color: mixHex(0xffffff, veil, 0.25),
        mode: 'rise',
        speed: rng.nextFloat(0.16, 0.3),
        amp: rng.nextFloat(0.1, 0.35),
        phase: rng.next(),
        span: 3.2,
      });
    }
    this.motes.push(new MoteField(steam, { opacity: 0.3 }));

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
