// ===== src/renderer/rendering/TabbyCat.ts =====
// Chinese Li Hua tabby cat — dark coat with subtle stripes, golden eyes,
// gently wagging tail and slow breathing. Based on the 翠竹流萤 reference.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';
import { VoxelBuilder } from './VoxelBuilder';

export class TabbyCat {
  readonly group: THREE.Group;
  private tail: THREE.Mesh;

  constructor() {
    const b = new VoxelBuilder();
    this.group = b.group;

    const coat = MaterialCache.getLambert(0x1a1a1a);
    const stripe = MaterialCache.getBasic(0x2a2a2a);
    const eye = MaterialCache.getBasic(0xffdd44);

    // Body
    b.boxMat(0.35, 0.3, 0.5, coat, 0, 0.15, 0);
    // Body stripes
    b.boxMat(0.36, 0.02, 0.02, stripe, 0, 0.08, 0.1, { castShadow: false });
    b.boxMat(0.36, 0.02, 0.02, stripe, 0, 0.18, -0.05, { castShadow: false });
    b.boxMat(0.36, 0.02, 0.02, stripe, 0, 0.26, -0.2, { castShadow: false });

    // Head
    const head = b.boxMat(0.25, 0.25, 0.25, coat, 0, 0.45, 0.15);
    head.userData.isHead = true;
    // Ears
    const leftEar = b.boxMat(0.08, 0.15, 0.08, coat, -0.1, 0.65, 0.1);
    leftEar.userData.isEar = true;
    const rightEar = b.boxMat(0.08, 0.15, 0.08, coat, 0.1, 0.65, 0.1);
    rightEar.userData.isEar = true;
    // Golden eyes
    b.boxMat(0.06, 0.06, 0.06, eye, -0.08, 0.45, 0.28, { castShadow: false });
    b.boxMat(0.06, 0.06, 0.06, eye, 0.08, 0.45, 0.28, { castShadow: false });
    // Head stripes
    b.boxMat(0.02, 0.02, 0.26, stripe, 0, 0.52, 0.15, { castShadow: false });
    b.boxMat(0.02, 0.02, 0.26, stripe, -0.06, 0.48, 0.15, { castShadow: false });
    b.boxMat(0.02, 0.02, 0.26, stripe, 0.06, 0.48, 0.15, { castShadow: false });

    // Tail
    this.tail = b.boxMat(0.1, 0.1, 0.4, coat, 0, 0.2, -0.4);
    // Tail stripes
    b.boxMat(0.11, 0.02, 0.02, stripe, 0, 0.2, -0.3, { castShadow: false });
    b.boxMat(0.11, 0.02, 0.02, stripe, 0, 0.2, -0.45, { castShadow: false });
  }

  update(time: number): void {
    this.tail.rotation.y = Math.sin(time * 2.5) * 0.35;
    this.group.scale.y = 1 + Math.sin(time * 2.2 + 1) * 0.015;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setRotationY(y: number): void {
    this.group.rotation.y = y;
  }
}
