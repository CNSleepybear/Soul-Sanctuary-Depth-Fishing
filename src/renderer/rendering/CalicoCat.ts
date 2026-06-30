// ===== src/renderer/rendering/CalicoCat.ts =====
// Maneki-neko style calico cat — white base with orange/black patches,
// blue eyes, raised paw, and gently wagging tail.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';
import { VoxelBuilder } from './VoxelBuilder';

export class CalicoCat {
  readonly group: THREE.Group;
  private tail: THREE.Mesh;

  constructor() {
    const b = new VoxelBuilder();
    this.group = b.group;

    const white = MaterialCache.getLambert(0xffffff);
    const orange = MaterialCache.getBasic(0xff8844);
    const black = MaterialCache.getBasic(0x1a1a1a);
    const eye = MaterialCache.getBasic(0x44aaff);

    // Body
    b.boxMat(0.35, 0.3, 0.5, white, 0, 0.15, 0);
    // Head
    b.boxMat(0.25, 0.25, 0.25, white, 0, 0.45, 0.15);
    // Ears
    b.boxMat(0.08, 0.15, 0.08, white, -0.1, 0.65, 0.1);
    b.boxMat(0.08, 0.15, 0.08, white, 0.1, 0.65, 0.1);
    // Eyes
    b.boxMat(0.06, 0.06, 0.06, eye, -0.08, 0.45, 0.28, { castShadow: false });
    b.boxMat(0.06, 0.06, 0.06, eye, 0.08, 0.45, 0.28, { castShadow: false });
    // Orange patches
    b.boxMat(0.18, 0.02, 0.18, orange, 0.08, 0.31, 0, { castShadow: false });
    b.boxMat(0.13, 0.02, 0.13, orange, 0.06, 0.51, 0.15, { castShadow: false });
    // Black patch
    b.boxMat(0.15, 0.02, 0.15, black, -0.08, 0.31, 0.1, { castShadow: false });
    // Tail
    this.tail = b.boxMat(0.1, 0.1, 0.4, white, 0, 0.2, -0.4);
    // Raised paw
    b.boxMat(0.08, 0.12, 0.08, white, 0.25, 0.35, 0.2);
  }

  update(time: number): void {
    this.tail.rotation.y = Math.sin(time * 3) * 0.3;
    this.group.scale.y = 1 + Math.sin(time * 2.5 + 1) * 0.015;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setRotationY(y: number): void {
    this.group.rotation.y = y;
  }
}
