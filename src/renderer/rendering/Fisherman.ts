// ===== src/renderer/rendering/Fisherman.ts =====
// Voxel fisherman — a small silhouette-readable character holding a jointed rod
// on the island edge.
//
// ART V2 (docs/art-direction-v2.md §2.1 / §2.4):
// - silhouette reads at 400×300 through straw hat + hat band, scarf, canvas
//   rucksack, long coat hem, boots and beard;
// - total height ≈ 1.16 units with the group origin at the feet, so
//   FishingSceneManager's FISHERMAN_POS placement keeps working untouched;
// - the rod is split into four jointed segments that bend with line tension,
//   plus idle-breathing / cast / reel / line-break poses;
// - all geometry is BoxGeometry on a 0.0625 grid; blocks are instanced per
//   animated parent and shadow mode using the shared MaterialCache palette.
//
// The world rod tip is exposed through getWorldRodTip() for FishingLine.

import * as THREE from 'three';
import { buildInstancedVoxels, type InstancedVoxel } from './ArtKit';
import { MaterialCache } from './MaterialCache';

/** Rod base pitch: negative lifts the rod tip toward +Y. */
const ROD_BASE_PITCH = -0.62;

/** Length of each rod section in fish units (sum ≈ 1.375). */
const ROD_SEGMENTS = [0.4375, 0.375, 0.3125, 0.25];

export class Fisherman {
  readonly group: THREE.Group;
  /** Local-space rod tip offset (kept for back-compat; use getWorldRodTip()). */
  readonly rodTip: THREE.Vector3;

  private bodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private rodGroup: THREE.Group;
  private rodSections: THREE.Group[] = [];
  private rodTipObject: THREE.Object3D;
  private _rodTipWorld = new THREE.Vector3();

  private _tension = 0;
  private _bend = 0;
  private _time = 0;
  private _castStart = -100;
  private _breakStart = -100;

  constructor() {
    this.group = new THREE.Group();
    this.group.scale.setScalar(1.12);
    this.rodTip = new THREE.Vector3();
    this.bodyGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.rodGroup = new THREE.Group();
    this.rodTipObject = new THREE.Object3D();

    // ── Palette (shared via MaterialCache) ──
    const skin = MaterialCache.getLambert(0xf0c9a4);
    const skinShade = MaterialCache.getLambert(0xdaa983);
    const coat = MaterialCache.getLambert(0x5f8677);
    const coatDark = MaterialCache.getLambert(0x4a6b60);
    const coatLight = MaterialCache.getLambert(0x749b8b);
    const pants = MaterialCache.getLambert(0x46505c);
    const boots = MaterialCache.getLambert(0x2f353c);
    const hat = MaterialCache.getLambert(0xd9b77a);
    const hatShade = MaterialCache.getLambert(0xbd9a5e);
    const band = MaterialCache.getLambert(0x8a4f3d);
    const caramel = MaterialCache.getLambert(0xc98a6a);
    const cream = MaterialCache.getLambert(0xf0dfbd);
    const beard = MaterialCache.getLambert(0xd6cdbd);
    const pack = MaterialCache.getLambert(0x8a7050);
    const packDark = MaterialCache.getLambert(0x6d5940);
    const strap = MaterialCache.getLambert(0x5c4632);
    const dark = MaterialCache.getLambert(0x242a2f);
    const rodWood = MaterialCache.getLambert(0x6b4a33);
    const rodWoodDark = MaterialCache.getLambert(0x4c3324);

    const batches = new Map<THREE.Group, Map<boolean, InstancedVoxel[]>>();
    const b = (
      parent: THREE.Group,
      w: number,
      h: number,
      d: number,
      mat: THREE.MeshLambertMaterial,
      x: number,
      y: number,
      z: number,
      cast = true,
    ) => {
      let parentBatches = batches.get(parent);
      if (!parentBatches) {
        parentBatches = new Map<boolean, InstancedVoxel[]>();
        batches.set(parent, parentBatches);
      }
      let cells = parentBatches.get(cast);
      if (!cells) {
        cells = [];
        parentBatches.set(cast, cells);
      }
      cells.push({ w, h, d, color: mat.color.getHex(), x, y, z });
    };

    this.group.add(this.bodyGroup);

    // ── Boots (group origin = sole level, y = 0) ──
    b(this.bodyGroup, 0.1875, 0.125, 0.25, boots, -0.125, 0.0625, 0.0625);
    b(this.bodyGroup, 0.1875, 0.125, 0.25, boots, 0.125, 0.0625, 0.0625);
    b(this.bodyGroup, 0.1875, 0.0625, 0.0625, boots, -0.125, 0.03125, 0.1875);
    b(this.bodyGroup, 0.1875, 0.0625, 0.0625, boots, 0.125, 0.03125, 0.1875);

    // ── Legs ──
    b(this.bodyGroup, 0.125, 0.25, 0.1875, pants, -0.125, 0.25, 0);
    b(this.bodyGroup, 0.125, 0.25, 0.1875, pants, 0.125, 0.25, 0);

    // ── Long coat hem with front/back split flaps ──
    b(this.bodyGroup, 0.4375, 0.125, 0.3125, coatDark, 0, 0.4375, 0);
    b(this.bodyGroup, 0.125, 0.1875, 0.25, coatDark, -0.21875, 0.40625, -0.03125);
    b(this.bodyGroup, 0.125, 0.1875, 0.25, coatDark, 0.21875, 0.40625, -0.03125);
    b(this.bodyGroup, 0.3125, 0.1875, 0.0625, coatDark, 0, 0.40625, -0.15625);

    // ── Torso ──
    b(this.bodyGroup, 0.375, 0.25, 0.25, coat, 0, 0.625, 0);
    b(this.bodyGroup, 0.25, 0.125, 0.0625, coatLight, 0, 0.6875, 0.125);
    // Belt
    b(this.bodyGroup, 0.4375, 0.0625, 0.3125, strap, 0, 0.5, 0);
    // Scarf: wrapped band + hanging tail, warm accent against the cool coat
    b(this.bodyGroup, 0.375, 0.0625, 0.3125, caramel, 0, 0.78125, 0);
    b(this.bodyGroup, 0.125, 0.0625, 0.0625, caramel, 0.0625, 0.75, 0.15625);
    b(this.bodyGroup, 0.0625, 0.1875, 0.0625, caramel, 0.09375, 0.65625, 0.15625);
    b(this.bodyGroup, 0.0625, 0.0625, 0.0625, cream, 0.09375, 0.5625, 0.15625);

    // ── Canvas rucksack + shoulder straps ──
    b(this.bodyGroup, 0.25, 0.25, 0.1875, pack, 0, 0.625, -0.1875);
    b(this.bodyGroup, 0.3125, 0.0625, 0.1875, packDark, 0, 0.75, -0.1875);
    b(this.bodyGroup, 0.1875, 0.0625, 0.0625, strap, 0, 0.59375, -0.28125);
    b(this.bodyGroup, 0.0625, 0.25, 0.03125, strap, -0.125, 0.625, 0.125);
    b(this.bodyGroup, 0.0625, 0.25, 0.03125, strap, 0.125, 0.625, 0.125);
    b(this.bodyGroup, 0.1875, 0.1875, 0.125, pack, -0.25, 0.4375, 0.09375);
    b(this.bodyGroup, 0.1875, 0.0625, 0.125, packDark, -0.25, 0.53125, 0.09375);
    b(this.bodyGroup, 0.0625, 0.0625, 0.03125, hat, -0.25, 0.46875, 0.15625);
    b(this.bodyGroup, 0.0625, 0.0625, 0.03125, cream, 0, 0.625, 0.15625);
    b(this.bodyGroup, 0.0625, 0.0625, 0.03125, hat, 0, 0.5625, 0.15625);

    // ── Arms ──
    // Left arm hangs; right arm reaches forward to the rod grip.
    b(this.bodyGroup, 0.125, 0.25, 0.125, coat, -0.21875, 0.625, 0);
    b(this.bodyGroup, 0.125, 0.125, 0.125, skin, -0.21875, 0.4375, 0.03125);
    b(this.bodyGroup, 0.125, 0.1875, 0.125, coat, 0.21875, 0.59375, 0.0625);
    b(this.bodyGroup, 0.125, 0.125, 0.1875, coat, 0.21875, 0.625, 0.1875);
    b(this.bodyGroup, 0.125, 0.125, 0.125, skin, 0.21875, 0.6875, 0.25);

    // ── Head group (neck pivot) so the head can breathe/turn ──
    this.headGroup.position.set(0, 0.75, 0);
    this.bodyGroup.add(this.headGroup);
    b(this.headGroup, 0.25, 0.1875, 0.25, skin, 0, 0.15625, 0);
    b(this.headGroup, 0.0625, 0.0625, 0.0625, skinShade, -0.03125, 0.125, 0.15625);
    // Eyes
    b(this.headGroup, 0.0625, 0.0625, 0.03125, dark, -0.09375, 0.1875, 0.125, false);
    b(this.headGroup, 0.0625, 0.0625, 0.03125, dark, 0.09375, 0.1875, 0.125, false);
    // Beard + moustache
    b(this.headGroup, 0.1875, 0.09375, 0.0625, beard, 0, 0.03125, 0.125);
    b(this.headGroup, 0.125, 0.0625, 0.0625, beard, 0, 0.09375, 0.15625);
    b(this.headGroup, 0.0625, 0.03125, 0.03125, beard, 0, 0.125, 0.15625);
    // Hair at the back of the head
    b(this.headGroup, 0.25, 0.125, 0.0625, beard, 0, 0.15625, -0.125);

    // ── Straw hat: brim + dark band + crown ──
    b(this.headGroup, 0.5625, 0.0625, 0.5, hat, 0, 0.28125, 0.03125);
    b(this.headGroup, 0.5625, 0.03125, 0.5, hatShade, 0, 0.25, 0.03125);
    b(this.headGroup, 0.34375, 0.03125, 0.34375, band, 0, 0.3125, 0);
    b(this.headGroup, 0.3125, 0.0625, 0.3125, hat, 0, 0.359375, 0);
    b(this.headGroup, 0.125, 0.03125, 0.0625, hatShade, -0.125, 0.390625, 0.0625, false);
    b(this.headGroup, 0.0625, 0.03125, 0.125, hatShade, 0.125, 0.3125, 0.1875, false);
    b(this.headGroup, 0.125, 0.03125, 0.03125, band, -0.1875, 0.28125, 0.25, false);

    // ── Rod: four jointed sections, base at the hand ──
    this.rodGroup.position.set(0.21875, 0.6875, 0.25);
    this.rodGroup.rotation.x = ROD_BASE_PITCH;
    this.bodyGroup.add(this.rodGroup);

    let parent: THREE.Group = this.rodGroup;
    for (let i = 0; i < ROD_SEGMENTS.length; i++) {
      const section = new THREE.Group();
      section.name = `rodSection${i}`;
      if (i > 0) section.position.set(0, 0, ROD_SEGMENTS[i - 1]);
      parent.add(section);
      parent = section;

      const len = ROD_SEGMENTS[i];
      // Keep every section at 0.0625 (=1px at 400×300) so the rod never
      // disappears into a sub-pixel line; colour differentiates the sections.
      b(section, 0.0625, 0.0625, len, i < 2 ? rodWood : rodWoodDark, 0, 0, len / 2, i < 2);
      this.rodSections.push(section);
    }
    // Rod tip marker on the last section
    this.rodTipObject.position.set(0, 0, ROD_SEGMENTS[ROD_SEGMENTS.length - 1]);
    this.rodSections[this.rodSections.length - 1].add(this.rodTipObject);

    const totalLen = ROD_SEGMENTS.reduce((sum, v) => sum + v, 0);
    this.rodTip.set(0, 0, totalLen);

    // Small guide ring accents keep the rod readable from the side.
    b(this.rodSections[1], 0.0625, 0.0625, 0.0625, dark, 0, 0.0625, 0.125, false);
    b(this.rodSections[2], 0.0625, 0.0625, 0.0625, dark, 0, 0.05, 0.125, false);

    // Never merge across independently animated parents or shadow modes.
    for (const [batchParent, parentBatches] of batches) {
      for (const [castShadow, cells] of parentBatches) {
        batchParent.add(buildInstancedVoxels(cells, { castShadow, receiveShadow: false }));
      }
    }
  }

  /**
   * Get world-space rod tip for line attachment.
   * Returns a reused vector (callers copy it into their own state) so the
   * per-frame fishing update does not allocate.
   */
  getWorldRodTip(): THREE.Vector3 {
    this.rodTipObject.getWorldPosition(this._rodTipWorld);
    return this._rodTipWorld;
  }

  /** Set tension (0-100) for rod bend. */
  setTension(t: number): void {
    this._tension = Math.max(0, Math.min(100, t));
  }

  /** Optional: trigger a cast whip animation (called by the fishing director). */
  playCast(): void {
    this._castStart = this._time;
  }

  /** Optional: trigger a line-break recoil pose. */
  playLineBreak(): void {
    this._breakStart = this._time;
  }

  /** Idle breathing + rod bend based on tension + optional pose overlays. */
  update(time: number): void {
    this._time = time;
    const target = this._tension / 100;
    this._bend += (target - this._bend) * 0.08;

    // Idle breathing: whole body rises a hair, weight shifts side to side.
    const breathe = Math.sin(time * 2.2) * 0.0075;
    this.bodyGroup.position.y = breathe;
    this.bodyGroup.rotation.z = Math.sin(time * 1.4) * 0.008;

    // Head micro-motion keeps the character alive without breaking silhouette.
    this.headGroup.rotation.y = Math.sin(time * 0.9) * 0.05;
    this.headGroup.rotation.x = Math.sin(time * 1.7 + 0.4) * 0.015;

    // Cast whip: quick backswing then forward release over ~0.6s.
    const castElapsed = time - this._castStart;
    let castOffset = 0;
    let castLean = 0;
    if (castElapsed >= 0 && castElapsed < 0.6) {
      const p = castElapsed / 0.6;
      castOffset = Math.sin(p * Math.PI) * 0.55;
      castLean = Math.sin(p * Math.PI) * 0.1;
    }

    // Line-break recoil: body jerks back, rod snaps upward.
    const breakElapsed = time - this._breakStart;
    let snap = 0;
    if (breakElapsed >= 0 && breakElapsed < 0.7) {
      const p = breakElapsed / 0.7;
      snap = Math.sin(p * Math.PI) * 0.85;
    }

    // Lean back while fighting, forward during cast.
    this.bodyGroup.rotation.x = -this._bend * 0.14 - castLean + snap * 0.16;

    // Rod bend: base pitch + tension curl + casting whip.
    this.rodGroup.rotation.x =
      ROD_BASE_PITCH + castOffset + this._bend * 0.3 + Math.sin(time * 8) * this._bend * 0.012;
    this.rodGroup.rotation.z = Math.sin(time * 2.0) * 0.02 + this._bend * 0.08;

    for (let i = 0; i < this.rodSections.length; i++) {
      const section = this.rodSections[i];
      const flex = this._bend * (i + 1) * 0.11 + Math.sin(time * 6.5 - i) * this._bend * 0.006;
      section.rotation.x = flex;
      section.rotation.y = Math.sin(time * 1.6 + i * 0.4) * 0.008 + snap * 0.08 * (i + 1);
    }
  }

  dispose(): void {
    // Instanced batches own their geometry/material; cached materials are borrowed.
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        if (c instanceof THREE.InstancedMesh) c.dispose();
        c.geometry.dispose();
        const materials = Array.isArray(c.material) ? c.material : [c.material];
        for (const material of materials) {
          if (!MaterialCache.isCached(material)) material.dispose();
        }
      }
    });
    this.group.clear();
  }
}
