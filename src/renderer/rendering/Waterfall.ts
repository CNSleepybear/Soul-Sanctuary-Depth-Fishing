// ===== src/renderer/rendering/Waterfall.ts =====
// Layered voxel waterfall ringing the island edge.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §4.2):
// - three water curtains at different radii, falling at different speeds and
//   opacities, so the fall reads as depth rather than one flat wall;
// - every curtain is a single InstancedMesh; each angular slot owns three
//   falling blocks that cycle from the lip to the water with an ease envelope,
//   giving continuous voxel flow without per-block meshes;
// - bottom foam blocks pulse where the water hits the surface and a few large
//   translucent mist slabs drift upward;
// - draw calls: 3 curtains + 1 foam + 1 mist = 5 per location (was one draw
//   call per falling block).
//
// Layout is seeded (deterministic per config), so a location always looks the
// same between runs. Self-created materials/geometry are disposed in dispose().

import * as THREE from 'three';

export interface WaterfallConfig {
  radius: number;
  innerRadius?: number;
  yBase?: number;
  heightMin?: number;
  heightMax?: number;
  color?: number;
  opacity?: number;
  density?: number; // 0-1 chance to spawn a fall column in the ring
}

const SEGMENTS_PER_COLUMN = 3;
const VOXEL_GRID = 0.0625;

interface CurtainLayer {
  mesh: THREE.InstancedMesh;
  slots: {
    angle: number;
    radius: number;
    height: number;
    width: number;
    thickness: number;
    phase: number;
  }[];
  speed: number;
  topY: number;
}

interface FoamSlot {
  angle: number;
  radius: number;
  size: number;
  phase: number;
  y: number;
}

interface MistSlot {
  angle: number;
  radius: number;
  phase: number;
  baseY: number;
  size: number;
}

/** Small deterministic PRNG so the ring layout never changes between runs. */
function createRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixColor(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

function snap(v: number, step = VOXEL_GRID): number {
  return Math.round(v / step) * step;
}

export class Waterfall {
  readonly group = new THREE.Group();

  private geometry: THREE.BoxGeometry;
  private layers: CurtainLayer[] = [];
  private foam: THREE.InstancedMesh;
  private foamMaterial: THREE.MeshLambertMaterial;
  private foamSlots: FoamSlot[] = [];
  private mist: THREE.InstancedMesh;
  private mistMaterial: THREE.MeshBasicMaterial;
  private mistSlots: MistSlot[] = [];
  private materials: THREE.Material[] = [];

  private _pos = new THREE.Vector3();
  private _quat = new THREE.Quaternion();
  private _scale = new THREE.Vector3();
  private _matrix = new THREE.Matrix4();
  private _axisY = new THREE.Vector3(0, 1, 0);

  constructor(cfg: WaterfallConfig) {
    const {
      radius,
      innerRadius = radius * 0.85,
      yBase = -0.4,
      heightMin = 1.2,
      heightMax = 2.2,
      color = 0x66aadd,
      opacity = 0.65,
      density = 1.0,
    } = cfg;

    const rng = createRng(
      Math.round((radius * 1000 + innerRadius * 100 + heightMax * 10) * 7) + 13,
    );
    const circumference = 2 * Math.PI * radius;
    const slots = Math.max(6, Math.min(42, Math.floor((circumference / 0.8) * density)));

    // Single unit box shared by every waterfall instance.
    this.geometry = new THREE.BoxGeometry(1, 1, 1);

    // ── Three curtain layers: inner is densest/darkest, outer is spray-like ──
    const layerSpec = [
      { radial: 0.12, speed: 1.0, height: 0.9, opacity: 1.0, light: 0.0, thick: 0.09 },
      { radial: 0.5, speed: 0.68, height: 1.0, opacity: 0.72, light: 0.14, thick: 0.12 },
      { radial: 0.88, speed: 0.44, height: 0.72, opacity: 0.46, light: 0.3, thick: 0.08 },
    ];

    for (const spec of layerSpec) {
      const layerColor = mixColor(color, 0xffffff, spec.light);
      const mat = new THREE.MeshLambertMaterial({
        color: layerColor,
        flatShading: true,
        transparent: true,
        opacity: Math.min(0.85, opacity * spec.opacity),
        depthWrite: false,
      });
      this.materials.push(mat);

      const count = slots * SEGMENTS_PER_COLUMN;
      const mesh = new THREE.InstancedMesh(this.geometry, mat, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      const layerSlots: CurtainLayer['slots'] = [];
      const arc = (Math.PI * 2) / slots;
      for (let i = 0; i < slots; i++) {
        const angle = (i / slots) * Math.PI * 2 + (rng() - 0.5) * arc * 0.35;
        const r = innerRadius + (radius - innerRadius) * spec.radial * (0.92 + rng() * 0.16);
        const h = (heightMin + rng() * (heightMax - heightMin)) * spec.height;
        layerSlots.push({
          angle,
          radius: r,
          height: snap(h, 0.125),
          width: snap(Math.max(0.25, arc * r * 0.78), 0.0625),
          thickness: snap(spec.thick + rng() * 0.03, 0.0625),
          phase: rng(),
        });
      }
      this.layers.push({ mesh, slots: layerSlots, speed: spec.speed, topY: yBase });
      this.group.add(mesh);
    }

    // ── Foam: pale blocks bursting where the curtains hit the water ──
    const foamColor = mixColor(color, 0xf6fbff, 0.66);
    this.foamMaterial = new THREE.MeshLambertMaterial({
      color: foamColor,
      flatShading: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.materials.push(this.foamMaterial);
    const foamCount = slots + 6;
    this.foam = new THREE.InstancedMesh(this.geometry, this.foamMaterial, foamCount);
    this.foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foam.frustumCulled = false;
    this.foam.castShadow = false;
    this.group.add(this.foam);

    const bottomY = yBase - heightMax;
    for (let i = 0; i < foamCount; i++) {
      const angle = (i / foamCount) * Math.PI * 2 + rng() * 0.4;
      this.foamSlots.push({
        angle,
        radius: innerRadius + (radius - innerRadius) * (0.2 + rng() * 0.7),
        size: snap(0.16 + rng() * 0.22, 0.0625),
        phase: rng() * Math.PI * 2,
        y: bottomY + snap(0.02 + rng() * 0.12, 0.03125),
      });
    }

    // ── Mist: large translucent slabs drifting up at the base ──
    const mistColor = mixColor(color, 0xffffff, 0.55);
    this.mistMaterial = new THREE.MeshBasicMaterial({
      color: mistColor,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    });
    this.materials.push(this.mistMaterial);
    const mistCount = 10;
    this.mist = new THREE.InstancedMesh(this.geometry, this.mistMaterial, mistCount);
    this.mist.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mist.frustumCulled = false;
    this.mist.castShadow = false;
    this.group.add(this.mist);

    for (let i = 0; i < mistCount; i++) {
      this.mistSlots.push({
        angle: (i / mistCount) * Math.PI * 2 + rng() * 0.6,
        radius: radius * (0.96 + rng() * 0.1),
        phase: rng(),
        baseY: bottomY + rng() * 0.3,
        size: snap(0.4 + rng() * 0.5, 0.0625),
      });
    }

    // Fill matrices once so frustum bounds are correct before the first frame.
    this.update(0);
    this.layers.forEach((layer) => {
      if (layer.mesh.computeBoundingSphere) layer.mesh.computeBoundingSphere();
      layer.mesh.instanceMatrix.needsUpdate = true;
    });
    this.foam.computeBoundingSphere();
    this.mist.computeBoundingSphere();
  }

  update(time: number): void {
    // ── Curtains: continuous falling voxel columns ──
    for (const layer of this.layers) {
      const segHeightRatio = 1 / 5.2;
      let index = 0;
      for (const slot of layer.slots) {
        const arcRot = -slot.angle - Math.PI / 2;
        const cos = Math.cos(slot.angle);
        const sin = Math.sin(slot.angle);
        const px = cos * slot.radius;
        const pz = sin * slot.radius;
        const blockLen = slot.height * segHeightRatio;

        for (let k = 0; k < SEGMENTS_PER_COLUMN; k++) {
          const phase =
            (this._fract(slot.phase + k / SEGMENTS_PER_COLUMN + time * layer.speed * 0.42) + 1) % 1;
          // Ease in at the lip, ease out at the surface so blocks wrap smoothly.
          const env = Math.min(1, phase * 6) * Math.min(1, (1 - phase) * 6);
          const y = layer.topY - slot.height * phase;
          this._pos.set(px, y, pz);
          this._quat.setFromAxisAngle(this._axisY, arcRot);
          this._scale.set(slot.width, Math.max(0.0001, blockLen * env), slot.thickness);
          this._matrix.compose(this._pos, this._quat, this._scale);
          layer.mesh.setMatrixAt(index++, this._matrix);
        }
      }
      layer.mesh.instanceMatrix.needsUpdate = true;
    }

    // ── Foam: pulsing pale blocks at the base ──
    for (let i = 0; i < this.foamSlots.length; i++) {
      const slot = this.foamSlots[i];
      const pulse = 0.72 + 0.28 * Math.sin(time * 1.9 + slot.phase);
      this._pos.set(
        Math.cos(slot.angle) * slot.radius,
        slot.y + Math.sin(time * 1.6 + slot.phase) * 0.0225,
        Math.sin(slot.angle) * slot.radius,
      );
      this._quat.setFromAxisAngle(this._axisY, -slot.angle);
      this._scale.set(slot.size * pulse, slot.size * 0.32, slot.size * pulse);
      this._matrix.compose(this._pos, this._quat, this._scale);
      this.foam.setMatrixAt(i, this._matrix);
    }
    this.foam.instanceMatrix.needsUpdate = true;

    // ── Mist: slow upward drift, growing then fading by scale ──
    for (let i = 0; i < this.mistSlots.length; i++) {
      const slot = this.mistSlots[i];
      const phase = (this._fract(slot.phase + time * 0.11) + 1) % 1;
      const env = Math.min(1, phase * 3) * Math.min(1, (1 - phase) * 2.2);
      const grow = 0.75 + phase * 0.85;
      this._pos.set(
        Math.cos(slot.angle) * slot.radius,
        slot.baseY + phase * 1.15,
        Math.sin(slot.angle) * slot.radius,
      );
      this._quat.setFromAxisAngle(this._axisY, -slot.angle + phase * 0.6);
      this._scale.set(slot.size * grow, slot.size * 0.5 * grow * env, slot.size * grow);
      this._matrix.compose(this._pos, this._quat, this._scale);
      this.mist.setMatrixAt(i, this._matrix);
    }
    this.mist.instanceMatrix.needsUpdate = true;
  }

  private _fract(v: number): number {
    return v - Math.floor(v);
  }

  dispose(): void {
    this.group.clear();
    this.layers.forEach((layer) => {
      layer.mesh.dispose();
    });
    this.layers = [];
    this.foam.dispose();
    this.mist.dispose();
    this.geometry.dispose();
    for (const mat of this.materials) mat.dispose();
    this.materials = [];
    this.foamSlots = [];
    this.mistSlots = [];
  }
}
