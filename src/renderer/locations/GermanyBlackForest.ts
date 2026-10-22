// ===== src/renderer/locations/GermanyBlackForest.ts =====
// 🇩🇪 Germany — Black Forest winter cabin.
//
// v2 art pass: half-timbered chalet landmark with a deep-brown gable roof,
// green shutters, warm windows and a smoking chimney (right 2/3 line), a snow
// barn, a woodpile, snow-capped pine clusters, a snow path, and a sled / small
// pine / snow-mound foreground frame. Atmosphere = snow + chimney smoke + icy
// sparkle. Colour script: cool key light against warm window light.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { Waterfall } from '../rendering/Waterfall';
import { LOCATIONS } from '../data/location-data';
import type { LocationData } from '../../shared/types';
import {
  buildGlowOrb,
  buildInstancedVoxels,
  buildLightShaft,
  createRng,
  hashSeed,
  mixHex,
  type InstancedVoxel,
} from '../rendering/ArtKit';

const SURFACE = 1.5;
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

type DriftMode = 'fall' | 'rise' | 'float';

interface DriftConfig {
  count: number;
  mode: DriftMode;
  colors: number[];
  cx: number;
  cz: number;
  areaX: number;
  areaZ: number;
  yMin: number;
  yMax: number;
  size: [number, number, number];
  speedMin: number;
  speedMax: number;
  sway: number;
  spin: [number, number, number];
  opacity: number;
  additive: boolean;
}

class DriftField {
  readonly mesh: THREE.InstancedMesh;
  private readonly c: DriftConfig;
  private readonly bx: Float32Array;
  private readonly bz: Float32Array;
  private readonly ph: Float32Array;
  private readonly sp: Float32Array;
  private readonly off: Float32Array;

  constructor(parent: THREE.Group, cfg: DriftConfig) {
    this.c = cfg;
    const rng = createRng(hashSeed(`drift:${cfg.mode}:${cfg.colors[0]}`));
    this.bx = new Float32Array(cfg.count);
    this.bz = new Float32Array(cfg.count);
    this.ph = new Float32Array(cfg.count);
    this.sp = new Float32Array(cfg.count);
    this.off = new Float32Array(cfg.count);
    const material = cfg.additive
      ? new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: cfg.opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      : new THREE.MeshLambertMaterial({
          color: 0xffffff,
          flatShading: true,
          transparent: true,
          opacity: cfg.opacity,
          depthWrite: false,
        });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, cfg.count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    for (let i = 0; i < cfg.count; i++) {
      this.bx[i] = cfg.cx + (rng.next() - 0.5) * cfg.areaX;
      this.bz[i] = cfg.cz + (rng.next() - 0.5) * cfg.areaZ;
      this.ph[i] = rng.next() * Math.PI * 2;
      this.sp[i] = rng.nextFloat(cfg.speedMin, cfg.speedMax);
      this.off[i] = rng.next();
      _color.setHex(cfg.colors[rng.nextInt(0, cfg.colors.length - 1)]);
      this.mesh.setColorAt(i, _color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    parent.add(this.mesh);
    this.update(0);
  }

  update(time: number): void {
    const cfg = this.c;
    const span = cfg.yMax - cfg.yMin;
    for (let i = 0; i < cfg.count; i++) {
      const phase = this.ph[i];
      const speed = this.sp[i];
      let x = this.bx[i] + Math.sin(time * (0.5 + speed) + phase) * cfg.sway;
      let z = this.bz[i] + Math.cos(time * (0.4 + speed) + phase) * cfg.sway * 0.7;
      let y: number;
      if (cfg.mode === 'fall') {
        y = cfg.yMax - ((time * speed + this.off[i]) % 1) * span;
      } else if (cfg.mode === 'rise') {
        y = cfg.yMin + ((time * speed + this.off[i]) % 1) * span;
      } else {
        y = cfg.yMin + this.off[i] * span + Math.sin(time * speed + phase) * cfg.sway * 0.8;
      }
      _pos.set(x, y, z);
      _euler.set(
        time * cfg.spin[0] + phase,
        time * cfg.spin[1] + phase,
        time * cfg.spin[2] + phase,
      );
      _quat.setFromEuler(_euler);
      _scale.set(cfg.size[0], cfg.size[1], cfg.size[2]);
      _matrix.compose(_pos, _quat, _scale);
      this.mesh.setMatrixAt(i, _matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface FlickerLight {
  light: THREE.PointLight;
  base: number;
  speed: number;
  phase: number;
  amp: number;
}

export class GermanyBlackForest extends BaseLocation {
  readonly id = 'germany';
  private _waterfall: Waterfall | null = null;
  private _fields: DriftField[] = [];
  private _lights: FlickerLight[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'germany')!;
  }

  protected buildGeometry(): void {
    const art = this.art;
    const glowColor = art.glow ?? 0xffb35c;
    const keyColor = art.key ?? 0xb9d0e8;
    const shadowColor = art.shadow ?? 0x2a3442;

    const p = {
      plaster: mixHex(0xd9d4c6, keyColor, 0.14),
      timber: mixHex(0x3d2618, shadowColor, 0.15),
      timberLight: mixHex(0x5a3c28, keyColor, 0.08),
      roof: mixHex(0x4a3020, shadowColor, 0.18),
      roofDark: mixHex(0x352016, shadowColor, 0.2),
      shutter: mixHex(0x2a5a2a, keyColor, 0.1),
      warm: mixHex(glowColor, 0xfff2d0, 0.55),
      fire: mixHex(0xff8a3d, glowColor, 0.35),
      stone: mixHex(0x8a9298, shadowColor, 0.25),
      stoneDark: mixHex(0x636c72, shadowColor, 0.3),
      snow: mixHex(0xe8ecef, keyColor, 0.1),
      snowCool: mixHex(0xc8d6e0, shadowColor, 0.12),
      snowShadow: mixHex(0xa8bac8, shadowColor, 0.2),
      pine: mixHex(0x1f3d2a, shadowColor, 0.15),
      pineLight: mixHex(0x2c5034, keyColor, 0.08),
      trunk: mixHex(0x4a3428, shadowColor, 0.2),
      wood: mixHex(0x6b4a32, shadowColor, 0.15),
      ice: mixHex(0xaaccdd, keyColor, 0.2),
    };

    const body: InstancedVoxel[] = [];
    const glow: InstancedVoxel[] = [];
    const ao: InstancedVoxel[] = [];
    const rng = createRng(hashSeed('germany:v2'));
    const vox = (
      list: InstancedVoxel[],
      x: number,
      z: number,
      y: number,
      w: number,
      h: number,
      d: number,
      color: number,
      rotY = 0,
    ): void => {
      list.push({ x, y: SURFACE + y + h / 2, z, w, h, d, color, rotY });
    };
    const aoPatch = (x: number, z: number, w: number, d: number): void => {
      ao.push({
        x,
        y: SURFACE + 0.012,
        z,
        w,
        h: 0.02,
        d,
        color: mixHex(shadowColor, 0x0a0e14, 0.45),
      });
    };

    // ── Snow ground: three tones + a trodden path ──
    for (let gx = -4.5; gx <= 4.5; gx += 1.5) {
      for (let gz = -4.5; gz <= 4.5; gz += 1.5) {
        if (Math.hypot(gx, gz) > 5.4) continue;
        const t = rng.next();
        vox(
          body,
          gx,
          gz,
          0,
          1.5,
          0.05,
          1.5,
          t < 0.5 ? p.snow : t < 0.82 ? p.snowCool : p.snowShadow,
        );
      }
    }
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      vox(
        body,
        2.2 - t * 0.9,
        -1.5 + t * 3.9,
        0,
        0.7,
        0.06,
        0.55,
        i % 2 ? p.snowShadow : p.snowCool,
        0.25,
      );
    }

    // ── Landmark: half-timbered Black Forest chalet ──
    const hx = 2.5;
    const hz = -2.9;
    vox(body, hx, hz, 0, 3.4, 0.4, 2.8, p.stone);
    vox(body, hx, hz, 0.4, 3.0, 2.2, 2.4, p.plaster);
    // corner posts + rails + half-timber braces on the camera-facing wall
    [
      [-1.5, 1.2],
      [1.5, 1.2],
      [-1.5, -1.2],
      [1.5, -1.2],
    ].forEach(([ox, oz]) => {
      vox(body, hx + ox, hz + oz, 0.4, 0.16, 2.2, 0.16, p.timber);
    });
    [0.5, 1.45, 2.5].forEach((y) => {
      vox(body, hx, hz + 1.21, y, 3.0, 0.14, 0.06, p.timber);
      vox(body, hx, hz - 1.21, y, 3.0, 0.14, 0.06, p.timber);
      vox(body, hx + 1.51, hz, y, 0.06, 0.14, 2.4, p.timber);
      vox(body, hx - 1.51, hz, y, 0.06, 0.14, 2.4, p.timber);
    });
    vox(body, hx - 1.0, hz + 1.22, 0.85, 0.1, 1.0, 0.06, p.timber, 0.55);
    vox(body, hx + 1.0, hz + 1.22, 0.85, 0.1, 1.0, 0.06, p.timber, -0.55);
    // Door + warm windows + green shutters.
    vox(body, hx, hz + 1.23, 0.4, 0.6, 1.15, 0.08, p.timberLight);
    vox(glow, hx, hz + 1.24, 0.75, 0.3, 0.5, 0.06, p.warm);
    [-0.85, 0.85].forEach((ox) => {
      vox(glow, hx + ox, hz + 1.24, 1.25, 0.5, 0.45, 0.06, p.warm);
      vox(body, hx + ox - 0.38, hz + 1.26, 1.2, 0.16, 0.6, 0.06, p.shutter);
      vox(body, hx + ox + 0.38, hz + 1.26, 1.2, 0.16, 0.6, 0.06, p.shutter);
    });
    // Stepped gable roof (deep brown) with snow on every step.
    const roofRows = [3.7, 3.2, 2.7, 2.2, 1.7, 1.2, 0.6];
    roofRows.forEach((w, i) => {
      vox(body, hx, hz, 2.6 + i * 0.22, w, 0.24, 3.0, i % 2 ? p.roof : p.roofDark);
      vox(body, hx, hz, 2.84 + i * 0.22, w * 0.94, 0.07, 2.9, p.snow);
    });
    // Chimney + snow cap + cuckoo clock on the gable.
    vox(body, hx + 0.85, hz - 0.55, 3.4, 0.42, 1.2, 0.42, p.timberLight);
    vox(body, hx + 0.85, hz - 0.55, 4.6, 0.5, 0.1, 0.5, p.snow);
    vox(body, hx, hz + 1.28, 2.85, 0.34, 0.46, 0.08, p.timber);
    vox(glow, hx, hz + 1.33, 2.98, 0.18, 0.18, 0.04, p.warm);
    // Porch step + firewood by the door.
    vox(body, hx, hz + 1.6, 0, 1.0, 0.18, 0.5, p.wood);
    aoPatch(hx, hz, 4.0, 3.4);

    // ── Barn / shed with a snow roof ──
    const bx = -3.6;
    const bz = -2.5;
    vox(body, bx, bz, 0, 2.2, 1.8, 1.9, p.timberLight);
    for (let i = 0; i < 3; i++) {
      vox(body, bx, bz, 0.3 + i * 0.55, 2.3, 0.1, 2.0, p.timber);
    }
    vox(body, bx, bz, 1.8, 2.5, 0.18, 2.2, p.roof);
    vox(body, bx, bz, 1.98, 2.3, 0.12, 2.0, p.snow);
    vox(body, bx, bz, 2.1, 1.4, 0.2, 1.4, p.roofDark);
    vox(body, bx, bz, 2.3, 1.1, 0.1, 1.1, p.snow);
    vox(glow, bx + 0.55, bz + 0.98, 0.9, 0.24, 0.3, 0.05, p.warm);
    aoPatch(bx, bz, 2.8, 2.4);

    // ── Woodpile (stacked log ends) ──
    const wx = 0.5;
    const wz = -2.15;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3 - (row % 2); col++) {
        vox(
          body,
          wx - 0.3 + col * 0.3,
          wz,
          row * 0.28,
          0.8,
          0.26,
          0.26,
          row % 2 ? p.wood : p.timberLight,
          0.08,
        );
      }
    }
    vox(body, wx, wz, 0.86, 1.0, 0.08, 0.4, p.snow);
    aoPatch(wx, wz, 1.6, 1.0);

    // ── Snow-capped pines ──
    const pine = (px: number, pz: number, s: number): void => {
      const h = 1.1 * s;
      vox(body, px, pz, 0, 0.24 * s, h, 0.24 * s, p.trunk);
      const tiers = 4;
      for (let i = 0; i < tiers; i++) {
        const tw = (1.9 - i * 0.4) * s;
        const ty = h * 0.5 + i * 0.62 * s;
        vox(body, px, pz, ty, tw, 0.5 * s, tw, i % 2 ? p.pine : p.pineLight);
        vox(body, px, pz, ty + 0.44 * s, tw * 0.72, 0.12 * s, tw * 0.72, p.snow);
      }
      vox(body, px, pz, h * 0.5 + tiers * 0.62 * s, 0.2 * s, 0.42 * s, 0.2 * s, p.pine);
      aoPatch(px, pz, 2.0 * s, 2.0 * s);
    };
    pine(-4.3, -1.2, 1.15);
    pine(-3.1, -3.9, 1.0);
    pine(-1.6, -4.5, 0.9);
    pine(1.3, -4.7, 0.85);
    pine(4.3, -1.9, 1.05);
    pine(-4.4, 1.5, 0.9);
    pine(0.6, 3.7, 0.75);

    // ── Foreground frame: snow mound + sled + fence at the right edge ──
    for (let i = 0; i < 5; i++) {
      const s = rng.nextFloat(0.6, 1.2);
      vox(
        body,
        4.8 + rng.nextFloat(-0.5, 0.5),
        1.9 + rng.nextFloat(-0.5, 0.5),
        0,
        s,
        s * 0.28,
        s * 0.8,
        i % 2 ? p.snow : p.snowCool,
        rng.nextFloat(-0.3, 0.3),
      );
    }
    // Sled: deck + two runners + upright handle.
    const sx = 4.9;
    const sz = 2.55;
    vox(body, sx, sz, 0.18, 1.2, 0.08, 0.44, p.wood, -0.3);
    vox(body, sx - 0.5, sz, 0.05, 0.1, 0.14, 0.5, p.stoneDark, -0.3);
    vox(body, sx + 0.5, sz, 0.05, 0.1, 0.14, 0.5, p.stoneDark, -0.3);
    vox(body, sx - 0.5, sz, 0.26, 0.08, 0.6, 0.08, p.wood, -0.3);
    aoPatch(sx, sz, 1.8, 1.2);
    for (let i = 0; i < 4; i++) {
      vox(body, 4.3 + i * 0.5, 3.35 - i * 0.1, 0, 0.12, 0.8, 0.12, p.timberLight, -0.12 * i);
      vox(body, 4.3 + i * 0.5, 3.35 - i * 0.1, 0.8, 0.14, 0.1, 0.14, p.snow);
    }
    vox(body, 5.05, 3.2, 0.55, 2.0, 0.09, 0.09, p.wood, -0.1);

    // ── Snow mounds and icy patches along the shore ──
    for (let i = 0; i < 34; i++) {
      const a = rng.nextFloat(0, Math.PI * 2);
      const r = rng.nextFloat(2.6, 5.6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x + 2.8, z - 3.9) < 2.2) continue;
      const kind = rng.next();
      if (kind < 0.55) {
        vox(
          body,
          x,
          z,
          0,
          rng.nextFloat(0.3, 0.8),
          rng.nextFloat(0.1, 0.24),
          rng.nextFloat(0.3, 0.7),
          rng.chance(0.5) ? p.snowCool : p.snow,
          rng.nextFloat(-0.4, 0.4),
        );
      } else if (kind < 0.8) {
        vox(
          glow,
          x,
          z,
          0.04,
          rng.nextFloat(0.2, 0.5),
          0.02,
          rng.nextFloat(0.16, 0.4),
          p.ice,
          rng.nextFloat(0, Math.PI),
        );
      } else {
        const s = rng.nextFloat(0.14, 0.3);
        vox(
          body,
          x,
          z,
          0,
          s,
          s * 0.6,
          s * 0.8,
          rng.chance(0.5) ? p.stone : p.stoneDark,
          rng.nextFloat(0, Math.PI),
        );
      }
    }

    this.group.add(buildInstancedVoxels(body, { castShadow: true, receiveShadow: true }));
    this.group.add(
      buildInstancedVoxels(glow, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );
    this.group.add(
      buildInstancedVoxels(ao, { castShadow: false, receiveShadow: false, shading: 'basic' }),
    );

    this._waterfall = new Waterfall({
      radius: 6.58,
      innerRadius: 6.16,
      yBase: 1.4,
      heightMin: 3.2,
      heightMax: 3.35,
      color: mixHex(0xaaccdd, keyColor, 0.3),
      opacity: 0.5,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const art = this.art;
    const glowColor = art.glow ?? 0xffb35c;
    const keyColor = art.key ?? 0xb9d0e8;

    this._fields.push(
      new DriftField(this.group, {
        count: 64,
        mode: 'fall',
        colors: [0xffffff, 0xe2ecf2, 0xc8d8e4],
        cx: 0,
        cz: 0,
        areaX: 11,
        areaZ: 11,
        yMin: 1.6,
        yMax: 8.0,
        size: [0.07, 0.07, 0.07],
        speedMin: 0.04,
        speedMax: 0.1,
        sway: 0.5,
        spin: [0, 0.5, 0],
        opacity: 0.9,
        additive: false,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 20,
        mode: 'rise',
        colors: [0x9aa8b0, 0xc4ccd0],
        cx: 2.35,
        cz: -2.95,
        areaX: 0.9,
        areaZ: 0.9,
        yMin: SURFACE + 4.7,
        yMax: SURFACE + 7.2,
        size: [0.24, 0.24, 0.24],
        speedMin: 0.05,
        speedMax: 0.1,
        sway: 0.35,
        spin: [0, 0.6, 0],
        opacity: 0.35,
        additive: false,
      }),
    );
    this._fields.push(
      new DriftField(this.group, {
        count: 20,
        mode: 'float',
        colors: [keyColor, 0xffffff],
        cx: 0,
        cz: 0.5,
        areaX: 9,
        areaZ: 8,
        yMin: 1.7,
        yMax: 3.4,
        size: [0.07, 0.07, 0.07],
        speedMin: 0.2,
        speedMax: 0.5,
        sway: 0.4,
        spin: [0, 0.8, 0],
        opacity: 0.7,
        additive: true,
      }),
    );

    // Warm light shaft from the chalet windows through the snow haze.
    const shafts = buildLightShaft({
      color: glowColor,
      height: 6,
      width: 1.8,
      opacity: 0.06,
      count: 2,
      seed: hashSeed('germany:shaft'),
    });
    shafts.position.set(1.6, SURFACE + 0.4, -1.6);
    this.group.add(shafts);

    this.group.add(
      buildGlowOrb({
        color: glowColor,
        size: 0.4,
        position: new THREE.Vector3(2.0, SURFACE + 1.35, -1.55),
      }),
    );

    const addLight = (
      color: number,
      x: number,
      y: number,
      z: number,
      base: number,
      distance: number,
      speed: number,
      amp: number,
    ): void => {
      const light = new THREE.PointLight(color, base, distance);
      light.position.set(x, y, z);
      this.group.add(light);
      this._lights.push({ light, base, speed, phase: this._lights.length * 1.4, amp });
    };
    addLight(glowColor, 2.0, SURFACE + 1.35, -1.5, 2.0, 6.5, 1.2, 0.18);
    addLight(0xff8a3d, 2.5, SURFACE + 2.4, -3.4, 1.2, 5.5, 1.7, 0.2);
    addLight(0xffe0b0, 3.0, SURFACE + 1.2, -1.0, 1.0, 4.5, 0.9, 0.1);
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    this._waterfall?.update(time);
    for (const field of this._fields) field.update(time);
    for (const entry of this._lights) {
      entry.light.intensity = entry.base + Math.sin(time * entry.speed + entry.phase) * entry.amp;
    }
  }

  update(dt: number, time: number): void {
    super.update(dt, time);
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._fields = [];
    this._lights = [];
    super.destroy();
  }
}
