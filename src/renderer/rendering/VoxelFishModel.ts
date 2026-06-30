// ===== src/renderer/rendering/VoxelFishModel.ts =====
// Voxel fish assembler — builds fish from BoxGeometry blocks.
// Supports 5 body types: koi, eel, ray, angler, standard.
// Used for both the 3D world and Fishpedia preview.
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

export class VoxelFishModel {
  readonly group: THREE.Group;
  private rarity: FishRarity; // SOUL-1: for soul-state rendering
  private meshes: THREE.Mesh[] = []; // SOUL-1: for breathing animation

  constructor(fish: SpiritFish) {
    this.rarity = fish.rarity;

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
      if (child instanceof THREE.Mesh) this.meshes.push(child);
    });
  }

  private _buildInto(group: THREE.Group, fish: SpiritFish): void {
    const cfg = fish.modelConfig;
    const palette = fish.colorPalette;
    const s = cfg.scale;
    const segs = cfg.segments ?? 1;

    // SOUL-1: Rarity-based soul state materials
    const rarity = fish.rarity;
    const soulConfig = {
      common: { opacity: 0.65, emissive: 0x111122, emissiveIntensity: 0.15 },
      uncommon: { opacity: 0.72, emissive: 0x221133, emissiveIntensity: 0.25 },
      rare: { opacity: 0.8, emissive: 0x331144, emissiveIntensity: 0.35 },
      legendary: { opacity: 0.88, emissive: 0x442255, emissiveIntensity: 0.5 },
      mythic: { opacity: 0.95, emissive: 0xffffff, emissiveIntensity: 0.7 },
    };
    const sc = soulConfig[rarity] ?? soulConfig[FishRarity.Common];

    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      colorIdx: number,
      opacity = sc.opacity,
    ) => {
      const colorStr = palette[colorIdx % palette.length];
      const color = new THREE.Color(colorStr).getHex();
      const isMythic = rarity === FishRarity.Mythic;
      const mat = isMythic
        ? MaterialCache.getFishBasic(color, opacity)
        : MaterialCache.getFishLambert(color, opacity, sc.emissive, sc.emissiveIntensity);
      const mesh = new THREE.Mesh(UNIT_BOX, mat);
      mesh.position.set(x * s, y * s, z * s);
      mesh.scale.set(w * s, h * s, d * s);
      mesh.castShadow = false; // soul fish don't cast shadows
      group.add(mesh);
      return mesh;
    };

    switch (cfg.bodyType) {
      case 'koi':
        this._buildKoi(box, s, palette);
        break;
      case 'eel':
        this._buildEel(box, s, segs, palette);
        break;
      case 'ray':
        this._buildRay(box, s, palette);
        break;
      case 'angler':
        this._buildAngler(box, s, palette);
        break;
      case 'standard':
      default:
        this._buildStandard(box, s, cfg.finStyle, palette);
        break;
    }
  }

  // ── Koi: chubby body, flowing tail, pectoral fins ──
  private _buildKoi(
    box: (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      ci: number,
      o?: number,
    ) => THREE.Mesh,
    _s: number,
    _p: string[],
  ): void {
    // Body — 3 segments
    box(1.2, 0.6, 0.8, 0, 0, 0, 0);
    box(0.8, 0.5, 0.7, 1.0, 0, 0, 1);
    box(0.5, 0.4, 0.5, 1.6, 0, 0, 2);

    // Head
    box(0.9, 0.5, 0.7, -1.0, 0.1, 0, 0);

    // Eyes
    box(0.15, 0.15, 0.15, -1.3, 0.35, 0.25, 2);
    box(0.15, 0.15, 0.15, -1.3, 0.35, -0.25, 2);

    // Tail fin
    box(0.2, 0.6, 0.05, 2.0, 0.1, 0, 3);
    box(0.15, 0.4, 0.05, 2.1, 0.3, 0.15, 3);
    box(0.15, 0.4, 0.05, 2.1, 0.3, -0.15, 3);
    box(0.15, 0.4, 0.05, 2.1, -0.1, 0.15, 3);
    box(0.15, 0.4, 0.05, 2.1, -0.1, -0.15, 3);

    // Pectoral fins
    box(0.05, 0.25, 0.4, 0, -0.25, 0.45, 1);
    box(0.05, 0.25, 0.4, 0, -0.25, -0.45, 1);

    // Dorsal fin
    box(0.05, 0.3, 1.0, 0.4, 0.45, 0, 0);
  }

  // ── Eel: segmented snake-like body ──
  private _buildEel(
    box: (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      ci: number,
      o?: number,
    ) => THREE.Mesh,
    _s: number,
    segments: number,
    _p: string[],
  ): void {
    const actualSegs = Math.max(segments, 5);
    const segLen = 0.4;
    const totalLen = actualSegs * segLen;

    for (let i = 0; i < actualSegs; i++) {
      const x = -totalLen / 2 + i * segLen + segLen / 2;
      const shrink = 1 - (i / actualSegs) * 0.5; // taper toward tail
      const ci = i % 2;
      box(segLen * 0.9, 0.35 * shrink, 0.35 * shrink, x, 0, 0, ci);

      // Dorsal fin ridge
      if (i > 1 && i < actualSegs - 2) {
        box(0.05, 0.15 * shrink, 0.2 * shrink, x, 0.25, 0, 2);
      }
    }

    // Head
    box(0.45, 0.35, 0.35, -totalLen / 2 - 0.2, 0.05, 0, 0);
    // Eyes
    box(0.08, 0.08, 0.08, -totalLen / 2 - 0.35, 0.2, 0.15, 3);
    box(0.08, 0.08, 0.08, -totalLen / 2 - 0.35, 0.2, -0.15, 3);

    // Tail fin
    box(0.05, 0.25, 0.05, totalLen / 2 + 0.2, 0, 0, 3);
  }

  // ── Ray: flat wide body ──
  private _buildRay(
    box: (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      ci: number,
      o?: number,
    ) => THREE.Mesh,
    _s: number,
    _p: string[],
  ): void {
    // Flat disc body
    box(1.5, 0.15, 1.0, 0, 0, 0, 0);
    box(1.2, 0.12, 0.8, 0, 0, 0, 1); // inner layer

    // Wing fins
    box(0.15, 0.1, 1.5, 0, 0, 0, 0);
    box(0.4, 0.08, 1.6, 0, 0, 0, 2, 0.7);

    // Head
    box(0.5, 0.15, 0.6, -1.0, 0.02, 0, 0);
    // Eyes
    box(0.1, 0.08, 0.1, -1.2, 0.12, 0.25, 3);
    box(0.1, 0.08, 0.1, -1.2, 0.12, -0.25, 3);

    // Tail
    const tailLen = 1.0;
    box(tailLen, 0.06, 0.2, 1.2, 0, 0, 1);
    box(0.2, 0.15, 0.08, 1.7, 0, 0.15, 3);
    box(0.2, 0.15, 0.08, 1.7, 0, -0.15, 3);
  }

  // ── Angler: big head, lure, small body ──
  private _buildAngler(
    box: (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      ci: number,
      o?: number,
    ) => THREE.Mesh,
    _s: number,
    _p: string[],
  ): void {
    // Huge head
    box(1.0, 0.8, 0.9, 0, 0, 0, 0);
    // Mouth (slightly open)
    box(0.8, 0.2, 0.6, 0.3, -0.35, 0, 2);

    // Eyes
    box(0.2, 0.2, 0.2, -0.2, 0.35, 0.35, 3);
    box(0.2, 0.2, 0.2, -0.2, 0.35, -0.35, 3);

    // Body
    box(0.6, 0.5, 0.6, -0.8, -0.1, 0, 1);
    box(0.4, 0.35, 0.4, -1.2, -0.1, 0, 2);

    // Dorsal fin
    box(0.05, 0.3, 0.3, -0.5, 0.45, 0, 0);

    // Lure stalk (antenna)
    const stalkH = 0.55;
    box(0.05, stalkH, 0.05, 0.3, stalkH / 2 + 0.4, 0, 1);
    // Lure bulb (glowing)
    box(0.2, 0.2, 0.2, 0.3, stalkH + 0.55, 0, 3);
  }

  // ── Standard: generic fish body ──
  private _buildStandard(
    box: (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      ci: number,
      o?: number,
    ) => THREE.Mesh,
    _s: number,
    finStyle: string,
    _p: string[],
  ): void {
    // Body
    box(1.0, 0.5, 0.6, 0, 0, 0, 0);
    box(0.7, 0.4, 0.5, 0.8, 0, 0, 1);
    box(0.4, 0.3, 0.35, 1.3, 0, 0, 2);

    // Head
    box(0.8, 0.45, 0.55, -0.8, 0.05, 0, 0);

    // Eyes
    box(0.12, 0.12, 0.12, -0.95, 0.25, 0.2, 3);
    box(0.12, 0.12, 0.12, -0.95, 0.25, -0.2, 3);

    // Tail fin
    const tailW = finStyle === 'long' ? 0.8 : finStyle === 'round' ? 0.6 : 0.5;
    const tailH = finStyle === 'long' ? 0.15 : 0.1;
    box(0.1, tailW, tailH, 1.55, 0, 0, 1);
    if (finStyle === 'spike') {
      box(0.3, 0.05, 0.4, 1.5, 0.15, 0, 0);
    }

    // Dorsal fin
    const dorsalH = finStyle === 'spike' ? 0.35 : 0.2;
    box(0.04, dorsalH, 0.8, 0.2, 0.35, 0, 0);

    // Pectoral fins
    box(0.04, 0.2, 0.3, -0.1, -0.25, 0.35, 1);
    box(0.04, 0.2, 0.3, -0.1, -0.25, -0.35, 1);
  }

  // ── Animation ──

  /** Gentle idle swim animation + soul breathing. */
  update(time: number): void {
    const sway = Math.sin(time * 2.5) * 0.05;
    this.group.position.y = sway;
    this.group.rotation.z = Math.sin(time * 1.8) * 0.08;

    // SOUL-1: Breathing emissive animation for Rare+ fish
    if (this.rarity === FishRarity.Rare || this.rarity === FishRarity.Legendary) {
      const breathe = 0.7 + Math.sin(time * 3.0) * 0.3;
      this.meshes.forEach((m) => {
        const mat = m.material as THREE.MeshLambertMaterial;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = (this.rarity === FishRarity.Legendary ? 0.5 : 0.35) * breathe;
        }
      });
    }
    // Mythic: pulsing opacity
    if (this.rarity === FishRarity.Mythic) {
      const pulse = 0.85 + Math.sin(time * 2.0) * 0.15;
      this.meshes.forEach((m) => {
        if (Array.isArray(m.material)) return;
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = pulse;
      });
    }
    // Legendary: inner glow blocks (nested smaller blocks) pulse
    if (this.rarity === FishRarity.Legendary && this.group.children.length > 0) {
      const glowPhase = Math.sin(time * 4.0) * 0.3 + 0.5;
      this.group.children.forEach((child, i) => {
        if (i % 3 === 0) {
          // every 3rd block pulses stronger
          child.scale.setScalar(1 + glowPhase * 0.15);
        }
      });
    }
  }

  dispose(): void {
    // RENDER-PERF: geometry and materials are shared/cached; only detach this instance.
    if (this.group.parent) this.group.parent.remove(this.group);
    this.group.clear();
    this.meshes = [];
  }
}
