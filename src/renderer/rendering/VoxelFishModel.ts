// ===== src/renderer/rendering/VoxelFishModel.ts =====
// Voxel fish assembler — builds fish from BoxGeometry blocks.
// Supports 5 body types: koi, eel, ray, angler, standard.
// Used for both the 3D world and Fishpedia preview.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §3.2):
// - every fish part is a scaled instance of one shared unit BoxGeometry; small
//   details (eyes, gill lines, scale marks, fin tips) sit on a 0.0625 grid;
// - shared voxel language across the five silhouettes: dorsal / pectoral /
//   tail fins, readable eyes, gill line and two-tone scale shading;
// - rarity is expressed through emissive intensity (Lambert) and, for Mythic,
//   a fully unlit luminous body plus glow accents;
// - idle swim animation (body sway + tail swing + fin flap) is applied to
//   internal groups only, so the caller keeps full control of the world
//   transform (Fishpedia spins `group`, FishingSceneManager moves the parent).
//
// RENDER-PERF:
// - One shared unit BoxGeometry, scaled per voxel (no per-box geometry allocation).
// - Materials are cached by color/opacity/emissive in MaterialCache.
// - Complete model groups are cached by fish.id and cloned on use, so switching
//   fish in Fishpedia or spawning a fish during fishing only clones a Group
//   instead of rebuilding all meshes from scratch.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';
import type { SpiritFish } from '../../shared/types';
import { FishRarity } from '../../shared/enums';

// Shared unit cube — all voxels are scaled instances of this geometry.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

// Per-fish-id template cache. Templates are never added to a scene; instances
// are created by cloning the template, which shares geometry and materials.
const MODEL_TEMPLATE_CACHE = new Map<string, THREE.Group>();

/** Adds a box (unit geometry) into `parent`, positions/sizes are in fish units. */
type AddBox = (
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
) => THREE.Mesh;

interface FishMats {
  body: THREE.Material[];
  fin: THREE.Material[];
  dark: THREE.Material;
  belly: THREE.Material;
  eye: THREE.Material;
  glint: THREE.Material;
  glow: THREE.Material;
}

interface SoulStyle {
  opacity: number;
  emissiveMix: number;
  intensity: number;
}

// Rarity → soul state. Higher rarity = more self-illumination.
const SOUL_STYLE: Record<FishRarity, SoulStyle> = {
  [FishRarity.Common]: { opacity: 0.66, emissiveMix: 0.18, intensity: 0.12 },
  [FishRarity.Uncommon]: { opacity: 0.72, emissiveMix: 0.32, intensity: 0.24 },
  [FishRarity.Rare]: { opacity: 0.8, emissiveMix: 0.55, intensity: 0.4 },
  [FishRarity.Legendary]: { opacity: 0.88, emissiveMix: 0.8, intensity: 0.58 },
  [FishRarity.Mythic]: { opacity: 0.95, emissiveMix: 1, intensity: 0.85 },
};

function shadeHex(hex: number, factor: number): number {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}

function mixHex(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

export class VoxelFishModel {
  readonly group: THREE.Group;

  // Animation handles (resolved from the cloned template, never world-space).
  private _body: THREE.Group | null = null;
  private _head: THREE.Group | null = null;
  private _tail: THREE.Group | null = null;
  private _lure: THREE.Group | null = null;
  private _fins: THREE.Group[] = [];
  private _spine: THREE.Group[] = [];
  private _direct: THREE.Object3D[] = [];
  private _breathAmp = 0.015;
  private _phase = 0;

  constructor(fish: SpiritFish) {
    let template = MODEL_TEMPLATE_CACHE.get(fish.id);
    if (!template) {
      template = new THREE.Group();
      this._buildInto(template, fish);
      MODEL_TEMPLATE_CACHE.set(fish.id, template);
    }

    // Clone the template so each VoxelFishModel owns its transform/visibility
    // while sharing geometry and materials with all other instances.
    this.group = template.clone();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = false;
    });

    this._direct = this.group.children.slice();
    this._body = (this.group.getObjectByName('fishBody') as THREE.Group | undefined) ?? null;
    this._head = (this.group.getObjectByName('fishHead') as THREE.Group | undefined) ?? null;
    this._tail = (this.group.getObjectByName('fishTail') as THREE.Group | undefined) ?? null;
    this._lure = (this.group.getObjectByName('fishLure') as THREE.Group | undefined) ?? null;
    for (let i = 0; i < 12; i++) {
      const fin = this.group.getObjectByName(`fishFin${i}`) as THREE.Group | undefined;
      if (fin) this._fins.push(fin);
    }
    for (let i = 0; i < 10; i++) {
      const seg = this.group.getObjectByName(`fishSpine${i}`) as THREE.Group | undefined;
      if (seg) this._spine.push(seg);
    }

    // Rarer souls breathe a little deeper; keep the maximum scale well below
    // 1.06 so voxel proportions never read as "inflated" (see unit tests).
    this._breathAmp =
      fish.rarity === FishRarity.Legendary
        ? 0.05
        : fish.rarity === FishRarity.Mythic
          ? 0.03
          : fish.rarity === FishRarity.Rare
            ? 0.025
            : 0.015;
    this._phase = (fish.id.charCodeAt(0) + fish.id.length * 0.37) % (Math.PI * 2);
  }

  private _buildInto(group: THREE.Group, fish: SpiritFish): void {
    const cfg = fish.modelConfig;
    const palette = fish.colorPalette;
    const s = cfg.scale;
    const segs = cfg.segments ?? 5;

    const style = SOUL_STYLE[fish.rarity] ?? SOUL_STYLE[FishRarity.Common];
    const isMythic = fish.rarity === FishRarity.Mythic;

    const baseColor = new THREE.Color(palette[0]).getHex();
    const emissive = mixHex(baseColor, 0xffffff, style.emissiveMix * 0.35);
    const intensity = style.intensity;

    const mainMat = (ci: number): THREE.Material => {
      const c = new THREE.Color(palette[ci % palette.length]).getHex();
      return isMythic
        ? MaterialCache.getFishBasic(c, style.opacity)
        : MaterialCache.getFishLambert(c, style.opacity, emissive, intensity);
    };

    const mat: FishMats = {
      body: [mainMat(0), mainMat(1), mainMat(2), mainMat(3)],
      fin: [
        isMythic
          ? MaterialCache.getFishBasic(shadeHex(mixHex(baseColor, 0xffffff, 0.2), 0.95), 0.78)
          : MaterialCache.getFishLambert(
              shadeHex(mixHex(baseColor, 0xffffff, 0.18), 0.95),
              style.opacity * 0.82,
              emissive,
              intensity * 0.8,
            ),
        isMythic
          ? MaterialCache.getFishBasic(shadeHex(mixHex(baseColor, 0xffffff, 0.35), 1.0), 0.7)
          : MaterialCache.getFishLambert(
              shadeHex(mixHex(baseColor, 0xffffff, 0.35), 1.0),
              style.opacity * 0.72,
              emissive,
              intensity * 0.7,
            ),
      ],
      dark: isMythic
        ? MaterialCache.getFishBasic(shadeHex(baseColor, 0.45), 0.9)
        : MaterialCache.getFishLambert(
            shadeHex(baseColor, 0.42),
            style.opacity,
            emissive,
            intensity * 0.35,
          ),
      belly: isMythic
        ? MaterialCache.getFishBasic(mixHex(baseColor, 0xfff2d8, 0.7), 0.92)
        : MaterialCache.getFishLambert(
            mixHex(baseColor, 0xfff2d8, 0.7),
            Math.min(0.94, style.opacity + 0.06),
            mixHex(emissive, 0xfff2d8, 0.3),
            intensity * 0.6,
          ),
      eye: MaterialCache.getFishLambert(
        0x14161f,
        Math.min(0.96, style.opacity + 0.12),
        0x000000,
        0,
      ),
      glint: MaterialCache.getFishBasic(0xeef3ff, 0.9),
      glow: MaterialCache.getFishBasic(mixHex(baseColor, 0xffffff, 0.5), 0.85),
    };

    const add: AddBox = (parent, w, h, d, x, y, z, m) => {
      const mesh = new THREE.Mesh(UNIT_BOX, m);
      mesh.position.set(x * s, y * s, z * s);
      mesh.scale.set(w * s, h * s, d * s);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      parent.add(mesh);
      return mesh;
    };

    // Root body group — all animation happens below this node so the caller's
    // world transform (Fishpedia spin, fishing scene placement) is preserved.
    const body = new THREE.Group();
    body.name = 'fishBody';
    group.add(body);

    const builder = { add, mat };
    switch (cfg.bodyType) {
      case 'koi':
        this._buildKoi(body, s, builder, fish.rarity);
        break;
      case 'eel':
        this._buildEel(body, s, segs, builder, fish.rarity);
        break;
      case 'ray':
        this._buildRay(body, s, builder, fish.rarity);
        break;
      case 'angler':
        this._buildAngler(body, s, builder, fish.rarity);
        break;
      case 'standard':
      default:
        this._buildStandard(body, s, cfg.finStyle, builder, fish.rarity);
        break;
    }
  }

  /** Rarity glow accents: a bright dorsal filament (rare+) and side motes (legendary+). */
  private _addGlowAccents(
    body: THREE.Group,
    s: number,
    add: AddBox,
    mat: FishMats,
    rarity: FishRarity,
    topY: number,
    length: number,
  ): void {
    if (rarity === FishRarity.Common || rarity === FishRarity.Uncommon) return;
    const glow = add(body, length, 0.0625, 0.0625, 0, topY, 0, mat.glow);
    glow.castShadow = false;
    if (rarity === FishRarity.Legendary || rarity === FishRarity.Mythic) {
      for (const side of [-1, 1]) {
        add(body, 0.125, 0.0625, 0.0625, -length * 0.28, 0.06, side * 0.3, mat.glow);
        add(body, 0.0625, 0.0625, 0.0625, length * 0.22, -0.02, side * 0.32, mat.glint);
      }
    }
    void s;
  }

  // ── Shared face kit: eye ring + pupil + glint + gill line ──
  private _addEyes(
    parent: THREE.Group,
    add: AddBox,
    mat: FishMats,
    x: number,
    y: number,
    z: number,
    size = 0.12,
  ): void {
    for (const side of [-1, 1]) {
      add(parent, size * 1.5, size * 1.5, 0.0625, x, y, side * z, mat.belly);
      add(parent, size, size, 0.0625, x - 0.0125, y, side * (z + 0.0125), mat.eye);
      add(
        parent,
        size * 0.4,
        size * 0.4,
        0.0625,
        x - 0.03,
        y + size * 0.28,
        side * (z + 0.025),
        mat.glint,
      );
    }
  }

  private _addGill(
    parent: THREE.Group,
    add: AddBox,
    mat: FishMats,
    x: number,
    h: number,
    z: number,
  ): void {
    for (const side of [-1, 1]) {
      add(parent, 0.0625, h, 0.03125, x, 0, side * z, mat.dark);
    }
  }

  private _addScaleMarks(
    parent: THREE.Group,
    add: AddBox,
    mat: FishMats,
    z: number,
    count: number,
    startX: number,
    step: number,
  ): void {
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        add(parent, 0.15, 0.0625, 0.03125, startX + i * step, -0.13, side * z, mat.belly);
        add(
          parent,
          0.125,
          0.0625,
          0.03125,
          startX + i * step + step * 0.5,
          0.14,
          side * z,
          mat.dark,
        );
      }
    }
  }

  // ── Koi: chubby body, flowing fan tail, pectoral fins ──
  private _buildKoi(
    body: THREE.Group,
    s: number,
    B: { add: AddBox; mat: FishMats },
    rarity: FishRarity,
  ): void {
    const { add, mat } = B;
    // Body — three tapering segments
    add(body, 1.3, 0.62, 0.82, 0, 0, 0, mat.body[0]);
    add(body, 0.9, 0.54, 0.74, 0.9, 0.02, 0, mat.body[1]);
    add(body, 0.55, 0.38, 0.55, 1.5, 0.04, 0, mat.body[2]);
    add(body, 0.28, 0.3, 0.42, 1.81, 0.06, 0, mat.dark);
    // Pale belly
    add(body, 0.95, 0.125, 0.6, -0.12, -0.3, 0, mat.belly);

    // Head
    const head = new THREE.Group();
    head.name = 'fishHead';
    head.position.set(-0.98 * s, 0.06 * s, 0);
    body.add(head);
    add(head, 0.9, 0.56, 0.76, 0.05, 0.02, 0, mat.body[0]);
    add(head, 0.62, 0.44, 0.6, -0.38, -0.02, 0, mat.body[1]);
    add(head, 0.16, 0.1, 0.46, -0.68, -0.12, 0, mat.dark);
    // Barbels
    for (const side of [-1, 1]) {
      add(head, 0.0625, 0.0625, 0.25, -0.62, -0.24, side * 0.13, mat.belly);
    }
    this._addEyes(head, add, mat, -0.22, 0.16, 0.38, 0.12);
    this._addGill(body, add, mat, -0.5, 0.46, 0.41);
    this._addScaleMarks(body, add, mat, 0.415, 3, 0.02, 0.3);

    // Dorsal fin — stepped voxel ridge
    add(body, 0.5, 0.28, 0.0625, 0.05, 0.43, 0, mat.fin[1]);
    add(body, 0.3, 0.2, 0.0625, 0.42, 0.36, 0, mat.fin[0]);
    add(body, 0.18, 0.125, 0.0625, 0.66, 0.28, 0, mat.fin[0]);

    // Pectoral fins (pivoting groups so they can flap)
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const fin = new THREE.Group();
      fin.name = `fishFin${i}`;
      fin.position.set(0.12 * s, -0.12 * s, side * 0.38 * s);
      body.add(fin);
      add(fin, 0.34, 0.05, 0.3, 0.12, 0, side * 0.15, mat.fin[0]);
      add(fin, 0.16, 0.05, 0.16, 0.3, -0.02, side * 0.26, mat.fin[1]);
    }

    // Fan tail
    const tail = new THREE.Group();
    tail.name = 'fishTail';
    tail.position.set(1.95 * s, 0.06 * s, 0);
    body.add(tail);
    add(tail, 0.18, 0.56, 0.0625, 0.16, 0, 0, mat.fin[1]);
    add(tail, 0.16, 0.34, 0.0625, 0.28, 0.31, 0.02, mat.fin[0]);
    add(tail, 0.16, 0.34, 0.0625, 0.28, -0.29, 0.02, mat.fin[0]);
    add(tail, 0.14, 0.25, 0.0625, 0.4, 0.46, -0.02, mat.fin[1]);
    add(tail, 0.14, 0.25, 0.0625, 0.4, -0.44, -0.02, mat.fin[1]);

    this._addGlowAccents(body, s, add, mat, rarity, 0.5, 0.9);
  }

  // ── Eel: segmented, undulating chain ──
  private _buildEel(
    body: THREE.Group,
    s: number,
    segments: number,
    B: { add: AddBox; mat: FishMats },
    rarity: FishRarity,
  ): void {
    const { add, mat } = B;
    const actualSegs = Math.max(segments, 5);
    const segLen = 0.42;
    let parent: THREE.Group = body;
    // First spine joint sits at the back of the head; each following joint is
    // a child of the previous one so rotations cascade into a body wave.
    for (let i = 0; i < actualSegs; i++) {
      const joint = new THREE.Group();
      joint.name = `fishSpine${i}`;
      if (i === 0) joint.position.set(-1.55 * s, 0.06 * s, 0);
      else joint.position.set(segLen * s, 0, 0);
      parent.add(joint);
      parent = joint;

      const shrink = 1 - (i / actualSegs) * 0.62;
      add(joint, segLen * 0.98, 0.36 * shrink, 0.34 * shrink, segLen * 0.5, 0, 0, mat.body[i % 2]);
      add(joint, segLen * 0.9, 0.0625, 0.24 * shrink, segLen * 0.5, -0.17 * shrink, 0, mat.belly);
      if (i > 0 && i < actualSegs - 1) {
        add(joint, segLen * 0.7, 0.16 * shrink, 0.0625, segLen * 0.5, 0.24 * shrink, 0, mat.fin[1]);
        add(
          joint,
          0.0625,
          0.125 * shrink,
          0.125 * shrink,
          segLen * 0.5,
          0.3 * shrink,
          0,
          mat.fin[0],
        );
      }
      // Lateral line
      add(joint, segLen * 0.8, 0.03125, 0.03125, segLen * 0.5, 0.04, 0.17 * shrink, mat.dark);
    }

    // Head leads the chain.
    const head = new THREE.Group();
    head.name = 'fishHead';
    head.position.set(-0.38 * s, 0, 0);
    parent.add(head);
    add(head, 0.5, 0.38, 0.34, 0.1, 0.02, 0, mat.body[3]);
    add(head, 0.3, 0.18, 0.2, -0.3, 0.02, 0, mat.body[2]);
    this._addEyes(head, add, mat, -0.12, 0.12, 0.14, 0.09);
    add(head, 0.0625, 0.2, 0.03125, 0.3, 0.02, 0.15, mat.dark);

    // Tail fin at the end of the chain.
    const tail = new THREE.Group();
    tail.name = 'fishTail';
    tail.position.set(segLen * s, 0, 0);
    parent.add(tail);
    add(tail, 0.2, 0.4, 0.0625, 0.1, 0, 0, mat.fin[1]);
    add(tail, 0.16, 0.25, 0.0625, 0.22, 0.22, 0, mat.fin[0]);
    add(tail, 0.16, 0.25, 0.0625, 0.22, -0.22, 0, mat.fin[0]);

    this._addGlowAccents(body, s, add, mat, rarity, 0.5, 1.2);
    void s;
  }

  // ── Ray: flat wings, long whip tail ──
  private _buildRay(
    body: THREE.Group,
    s: number,
    B: { add: AddBox; mat: FishMats },
    rarity: FishRarity,
  ): void {
    const { add, mat } = B;
    // Flat body plates
    add(body, 1.55, 0.16, 1.0, 0, 0, 0, mat.body[0]);
    add(body, 1.2, 0.1, 0.8, 0.05, 0.11, 0, mat.body[1]);
    add(body, 0.7, 0.1, 0.55, -0.35, 0.19, 0, mat.body[2]);
    // Mottled spots on the back
    add(body, 0.22, 0.0625, 0.18, -0.3, 0.18, 0.18, mat.dark);
    add(body, 0.18, 0.0625, 0.16, 0.18, 0.17, -0.2, mat.body[3]);
    add(body, 0.14, 0.0625, 0.14, 0.02, 0.16, 0.24, mat.belly);

    const head = new THREE.Group();
    head.name = 'fishHead';
    head.position.set(-0.98 * s, 0.03 * s, 0);
    body.add(head);
    add(head, 0.5, 0.16, 0.62, 0.1, 0.04, 0, mat.body[3]);
    add(head, 0.18, 0.06, 0.4, -0.22, 0.02, 0, mat.dark);
    this._addEyes(head, add, mat, 0.02, 0.14, 0.2, 0.1);
    // Gill slits under the front edge
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        add(
          body,
          0.22,
          0.03125,
          0.0625,
          -0.55 + i * 0.06,
          -0.1,
          side * (0.22 + i * 0.08),
          mat.dark,
        );
      }
    }

    // Wing fins flap around their roots.
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const wing = new THREE.Group();
      wing.name = `fishFin${i}`;
      wing.position.set(0, 0, side * 0.5 * s);
      body.add(wing);
      add(wing, 0.95, 0.08, 0.55, 0, 0, side * 0.28, mat.fin[0]);
      add(wing, 0.55, 0.06, 0.32, -0.12, 0.01, side * 0.52, mat.fin[1]);
      add(wing, 0.2, 0.05, 0.18, -0.36, 0.02, side * 0.62, mat.fin[1]);
    }

    // Whip tail
    const tail = new THREE.Group();
    tail.name = 'fishTail';
    tail.position.set(0.75 * s, 0.02 * s, 0);
    body.add(tail);
    add(tail, 0.9, 0.0625, 0.14, 0.45, -0.02, 0, mat.body[1]);
    add(tail, 0.5, 0.0625, 0.1, 0.95, 0, 0, mat.dark);
    add(tail, 0.2, 0.125, 0.08, 1.22, 0, 0, mat.dark);

    this._addGlowAccents(body, s, add, mat, rarity, 0.28, 1.1);
  }

  // ── Angler: huge head, lure, teeth ──
  private _buildAngler(
    body: THREE.Group,
    s: number,
    B: { add: AddBox; mat: FishMats },
    rarity: FishRarity,
  ): void {
    const { add, mat } = B;
    const head = new THREE.Group();
    head.name = 'fishHead';
    head.position.set(-0.3 * s, 0.05 * s, 0);
    body.add(head);
    add(head, 1.05, 0.8, 0.9, 0, 0.04, 0, mat.body[0]);
    add(head, 0.9, 0.26, 0.72, -0.18, -0.34, 0, mat.dark);
    add(head, 0.8, 0.1, 0.66, -0.2, -0.2, 0, mat.body[1]);
    // Teeth
    for (let i = 0; i < 4; i++) {
      add(head, 0.0625, 0.1, 0.0625, -0.42 + i * 0.16, -0.2, 0.3, mat.belly);
      add(head, 0.0625, 0.1, 0.0625, -0.42 + i * 0.16, -0.2, -0.3, mat.belly);
    }
    this._addEyes(head, add, mat, -0.05, 0.28, 0.33, 0.16);
    this._addGill(head, add, mat, 0.28, 0.62, 0.44);

    // Compact tail-heavy body
    add(body, 0.7, 0.55, 0.62, 0.55, -0.03, 0, mat.body[1]);
    add(body, 0.45, 0.38, 0.44, 1.05, -0.05, 0, mat.body[2]);
    add(body, 0.55, 0.125, 0.45, 0.75, -0.34, 0, mat.belly);
    // Dorsal spine fin
    add(body, 0.35, 0.28, 0.0625, 0.55, 0.36, 0, mat.fin[1]);
    add(body, 0.25, 0.2, 0.0625, 0.78, 0.28, 0, mat.fin[0]);
    // Pectoral fins
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const fin = new THREE.Group();
      fin.name = `fishFin${i}`;
      fin.position.set(0.5 * s, -0.16 * s, side * 0.32 * s);
      body.add(fin);
      add(fin, 0.3, 0.0625, 0.28, 0.05, 0, side * 0.12, mat.fin[0]);
    }
    // Tail
    const tail = new THREE.Group();
    tail.name = 'fishTail';
    tail.position.set(1.22 * s, -0.05 * s, 0);
    body.add(tail);
    add(tail, 0.16, 0.45, 0.0625, 0.1, 0, 0, mat.fin[1]);
    add(tail, 0.14, 0.28, 0.0625, 0.2, 0.28, 0.02, mat.fin[0]);
    add(tail, 0.14, 0.28, 0.0625, 0.2, -0.26, 0.02, mat.fin[0]);

    // Glowing lure on a jointed stalk
    const lure = new THREE.Group();
    lure.name = 'fishLure';
    lure.position.set(-0.3 * s, 0.42 * s, 0);
    body.add(lure);
    add(lure, 0.0625, 0.25, 0.0625, 0.03, 0.12, 0, mat.dark);
    add(lure, 0.0625, 0.25, 0.0625, 0.1, 0.33, 0, mat.dark);
    add(lure, 0.0625, 0.2, 0.0625, 0.19, 0.48, 0, mat.dark);
    add(lure, 0.22, 0.22, 0.22, 0.26, 0.6, 0, mat.glow);
    add(lure, 0.1, 0.1, 0.1, 0.26, 0.6, 0.12, mat.glint);

    this._addGlowAccents(body, s, add, mat, rarity, 0.62, 0.6);
  }

  // ── Standard: generic fish body with finStyle variants ──
  private _buildStandard(
    body: THREE.Group,
    s: number,
    finStyle: string,
    B: { add: AddBox; mat: FishMats },
    rarity: FishRarity,
  ): void {
    const { add, mat } = B;
    // Body
    add(body, 1.1, 0.52, 0.62, 0, 0, 0, mat.body[0]);
    add(body, 0.75, 0.42, 0.5, 0.85, 0.02, 0, mat.body[1]);
    add(body, 0.42, 0.32, 0.36, 1.35, 0.03, 0, mat.body[2]);
    add(body, 0.85, 0.1, 0.46, -0.1, -0.26, 0, mat.belly);

    // Head
    const head = new THREE.Group();
    head.name = 'fishHead';
    head.position.set(-0.88 * s, 0.05 * s, 0);
    body.add(head);
    add(head, 0.78, 0.46, 0.56, 0, 0, 0, mat.body[3]);
    add(head, 0.34, 0.3, 0.42, -0.42, -0.02, 0, mat.body[1]);
    add(head, 0.125, 0.1, 0.4, -0.58, -0.08, 0, mat.dark);
    this._addEyes(head, add, mat, -0.2, 0.14, 0.28, 0.11);
    this._addGill(body, add, mat, -0.42, 0.38, 0.32);
    this._addScaleMarks(body, add, mat, 0.315, 2, 0.05, 0.34);

    // Dorsal fin
    if (finStyle === 'spike') {
      add(body, 0.14, 0.34, 0.0625, 0.1, 0.4, 0, mat.fin[1]);
      add(body, 0.14, 0.26, 0.0625, 0.3, 0.35, 0, mat.fin[0]);
      add(body, 0.14, 0.2, 0.0625, 0.5, 0.3, 0, mat.fin[0]);
    } else {
      add(body, 0.46, finStyle === 'long' ? 0.34 : 0.24, 0.0625, 0.15, 0.38, 0, mat.fin[1]);
      add(body, 0.24, 0.18, 0.0625, 0.45, 0.32, 0, mat.fin[0]);
    }

    // Pectoral fins
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const fin = new THREE.Group();
      fin.name = `fishFin${i}`;
      fin.position.set(0.05 * s, -0.14 * s, side * 0.3 * s);
      body.add(fin);
      add(fin, 0.3, 0.0625, 0.28, 0.08, 0, side * 0.12, mat.fin[0]);
      add(fin, 0.14, 0.0625, 0.14, 0.24, -0.02, side * 0.22, mat.fin[1]);
    }

    // Tail fin
    const tail = new THREE.Group();
    tail.name = 'fishTail';
    tail.position.set(1.55 * s, 0, 0);
    body.add(tail);
    const tailW = finStyle === 'long' ? 0.8 : finStyle === 'round' ? 0.58 : 0.48;
    add(tail, 0.16, tailW, 0.0625, 0.12, 0, 0, mat.fin[1]);
    if (finStyle === 'long') {
      add(tail, 0.16, 0.5, 0.0625, 0.26, 0.5, 0.02, mat.fin[0]);
      add(tail, 0.16, 0.5, 0.0625, 0.26, -0.5, 0.02, mat.fin[0]);
      add(tail, 0.12, 0.34, 0.0625, 0.42, 0.72, -0.02, mat.fin[1]);
      add(tail, 0.12, 0.34, 0.0625, 0.42, -0.72, -0.02, mat.fin[1]);
    } else if (finStyle === 'round') {
      add(tail, 0.16, 0.34, 0.0625, 0.24, 0.24, 0.02, mat.fin[0]);
      add(tail, 0.16, 0.34, 0.0625, 0.24, -0.24, 0.02, mat.fin[0]);
    } else {
      add(tail, 0.14, 0.26, 0.0625, 0.24, 0.24, 0.02, mat.fin[0]);
      add(tail, 0.14, 0.26, 0.0625, 0.24, -0.24, 0.02, mat.fin[0]);
    }

    this._addGlowAccents(body, s, add, mat, rarity, 0.45, 0.8);
  }

  // ── Animation ──

  /**
   * Idle swim animation. Only internal nodes are animated: the root `group`
   * position/rotation stays untouched so the caller's world-space placement is
   * never overwritten.
   */
  update(time: number): void {
    const body = this._body;
    if (!body) return;
    const t = time;
    const phase = this._phase;

    // Whole-body sway + gentle bob (local offsets only).
    const yaw = Math.sin(t * 1.7 + phase) * 0.09;
    body.rotation.y = yaw;
    body.rotation.z = Math.sin(t * 1.1 + phase) * 0.03;
    body.position.y = Math.sin(t * 1.5 + phase) * 0.018;

    // Head counter-steers to keep the gaze stable.
    const head = this._head;
    if (head) {
      head.rotation.y = -yaw * 0.65 + Math.sin(t * 1.9 + 0.4) * 0.06;
      head.rotation.z = Math.sin(t * 1.3 + 0.2) * 0.02;
    }

    // Tail swing, offset from the body wave.
    const tail = this._tail;
    if (tail) {
      tail.rotation.y = Math.sin(t * 2.6 + 0.9) * 0.4 - yaw * 0.5;
      tail.rotation.z = Math.sin(t * 2.6 + 1.4) * 0.07;
    }

    // Pectoral / wing fin flap.
    const fins = this._fins;
    for (let i = 0; i < fins.length; i++) {
      const fin = fins[i];
      fin.rotation.x = Math.sin(t * 2.3 + i * 1.9) * 0.2;
      fin.rotation.y = Math.cos(t * 1.7 + i) * 0.12;
    }

    // Eel body wave (each spine joint lags the previous one).
    const spine = this._spine;
    for (let i = 0; i < spine.length; i++) {
      spine[i].rotation.y = Math.sin(t * 2.0 - i * 0.6 + phase) * 0.09;
    }

    // Angler lure drift.
    const lure = this._lure;
    if (lure) {
      lure.rotation.z = Math.sin(t * 1.4) * 0.2;
      lure.rotation.y = Math.cos(t * 1.1) * 0.25;
    }

    // Soul breathing — uniform scale on direct children keeps voxel proportions
    // (and the legendary unit test) intact.
    const breath = 1 + this._breathAmp * (0.5 + 0.5 * Math.sin(t * 2.7 + phase));
    const direct = this._direct;
    for (let i = 0; i < direct.length; i++) {
      const child = direct[i];
      child.scale.setScalar(breath);
    }
  }

  dispose(): void {
    // RENDER-PERF: geometry and materials are shared/cached; only detach this instance.
    if (this.group.parent) this.group.parent.remove(this.group);
    this.group.clear();
    this._body = null;
    this._head = null;
    this._tail = null;
    this._lure = null;
    this._fins = [];
    this._spine = [];
    this._direct = [];
  }
}
