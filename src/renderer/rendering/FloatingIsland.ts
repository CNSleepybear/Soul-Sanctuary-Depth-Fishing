// ===== src/renderer/rendering/FloatingIsland.ts =====
// Circular voxel island — distance-based grid with random edge erosion.
// Three layers: bottom R=8, middle R=6.5, top R=5.5.
// Outer 30% of each layer: random omission (p=0.2~0.3).
// REF-4: theme-aware island colors per location.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';
import type { LocationTheme } from '../../shared/types';

const BLOCK = 0.5; // voxel size

interface LayerConfig {
  radius: number;
  yBase: number;
  yCount: number; // how many sub-layers stacked
  color: number;
  omitChance: number; // probability of omission in outer 30%
}

// Default natural palette; overridden by location theme
const DEFAULT_LAYERS: LayerConfig[] = [
  { radius: 8, yBase: -1.5, yCount: 3, color: 0x889099, omitChance: 0.28 },
  { radius: 6.5, yBase: 0.0, yCount: 2, color: 0x8a7a5a, omitChance: 0.25 },
  { radius: 5.5, yBase: 1.0, yCount: 1, color: 0x6a9a5a, omitChance: 0.2 },
];

export class FloatingIsland {
  readonly group: THREE.Group;
  readonly surfaceY: number;

  constructor(theme?: LocationTheme['island']) {
    this.group = new THREE.Group();

    const layers: LayerConfig[] = theme
      ? [
          { ...DEFAULT_LAYERS[0], color: theme.stone },
          { ...DEFAULT_LAYERS[1], color: theme.earth },
          { ...DEFAULT_LAYERS[2], color: theme.grass },
        ]
      : DEFAULT_LAYERS;

    // Compute surface Y (top of top layer)
    const topLayer = layers[layers.length - 1];
    this.surfaceY = topLayer.yBase + topLayer.yCount * BLOCK;

    // Build each layer
    for (const layer of layers) {
      this._buildLayer(layer);
    }
  }

  private _buildLayer(cfg: LayerConfig): void {
    const mat = MaterialCache.getLambert(cfg.color);

    const geo = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
    const innerR = cfg.radius * 0.7; // inner 70% = always solid

    // Iterate grid
    const step = BLOCK;
    for (let x = -cfg.radius; x <= cfg.radius; x += step) {
      for (let z = -cfg.radius; z <= cfg.radius; z += step) {
        const cx = x + step / 2; // block center
        const cz = z + step / 2;
        const d = Math.sqrt(cx * cx + cz * cz);

        if (d > cfg.radius) continue; // outside circle

        // Outer 30% zone: random omission
        if (d > innerR) {
          if (Math.random() < cfg.omitChance) continue;
        }

        // Place blocks at each sub-layer Y
        for (let yi = 0; yi < cfg.yCount; yi++) {
          const cy = cfg.yBase + yi * BLOCK + BLOCK / 2;
          const block = new THREE.Mesh(geo, mat);
          block.position.set(cx, cy, cz);
          block.castShadow = true;
          block.receiveShadow = true;
          this.group.add(block);
        }
      }
    }
  }

  // POLISH-2: Gentle floating bob animation
  private bobPhase = Math.random() * Math.PI * 2;

  update(time: number): void {
    // Subtle up-down drift: ±0.15 units over ~8 seconds
    const bob = Math.sin(time * 0.8 + this.bobPhase) * 0.15;
    this.group.position.y += bob * 0.016; // per-frame drift (dt-based would be better but works)
    // Clamp to reasonable range
    const baseY = -1.0;
    if (Math.abs(this.group.position.y - baseY) > 0.3) {
      this.group.position.y = baseY;
    }
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  dispose(): void {
    this.group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        // REF-4: geometry only — materials are owned by MaterialCache
        child.geometry.dispose();
      }
    });
  }
}
