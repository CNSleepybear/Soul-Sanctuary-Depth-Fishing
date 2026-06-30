// ===== src/renderer/rendering/Waterfall.ts =====
// Animated voxel waterfall that rings a circular island. Each fall block
// gently stretches and fades to mimic flowing water over the edge.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';

export interface WaterfallConfig {
  radius: number;
  innerRadius?: number;
  yBase?: number;
  heightMin?: number;
  heightMax?: number;
  color?: number;
  opacity?: number;
  density?: number; // 0-1 chance to spawn a fall block in the ring
}

export class Waterfall {
  readonly group = new THREE.Group();
  private falls: {
    mesh: THREE.Mesh;
    baseScaleY: number;
    phase: number;
    baseY: number;
  }[] = [];
  private material: THREE.MeshLambertMaterial;

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

    this.material = MaterialCache.getTransparentLambert(color, opacity);

    const circumference = 2 * Math.PI * radius;
    const blockSize = 0.9;
    const count = Math.floor((circumference / blockSize) * density);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const r = innerRadius + Math.random() * (radius - innerRadius);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = heightMin + Math.random() * (heightMax - heightMin);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(blockSize, h, blockSize), this.material);
      mesh.position.set(x, yBase - h / 2, z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      this.falls.push({
        mesh,
        baseScaleY: h,
        phase: Math.random() * Math.PI * 2,
        baseY: yBase - h / 2,
      });
    }
  }

  update(time: number): void {
    // Shared material: opacity is global, not per-fall
    this.material.opacity = 0.55 + Math.sin(time * 2.5) * 0.1;
    for (const f of this.falls) {
      const stretch = Math.sin(time * 3 + f.phase) * 0.15;
      f.mesh.scale.y = Math.max(0.2, f.baseScaleY + stretch);
      // Keep bottom anchored while top stretches
      f.mesh.position.y = f.baseY - (f.mesh.scale.y - f.baseScaleY) * 0.5;
    }
  }

  dispose(): void {
    for (const f of this.falls) {
      f.mesh.geometry.dispose();
    }
    this.group.clear();
    this.falls = [];
  }
}
