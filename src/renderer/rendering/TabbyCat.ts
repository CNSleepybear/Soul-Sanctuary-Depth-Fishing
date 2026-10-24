// ===== src/renderer/rendering/TabbyCat.ts =====
// Chinese Li Hua tabby cat — warm brown coat with dark stripes and golden eyes.
// Sitting by the bamboo pond, grooming the air with its tail.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §2.5):
// - readable seated silhouette (haunch / chest / head / ears) even in black;
// - BoxGeometry only, striped tabby markings on body, head and tail, fur uses
//   MaterialCache Lambert (eyes/gold bits use cached Basic);
// - idle motion: breathing, head sway, independent ear twitches, a two-joint
//   tail sway with a slow curl. update() allocates nothing.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';

export class TabbyCat {
  readonly group: THREE.Group;
  private bodyRoot: THREE.Group;
  private headGroup: THREE.Group;
  private earL: THREE.Group;
  private earR: THREE.Group;
  private tailRoot: THREE.Group;
  private tailMid: THREE.Group;
  private tailTip: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    // Slightly oversized companion proportions remain readable at 400×300.
    this.group.scale.setScalar(0.85);
    this.bodyRoot = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.earL = new THREE.Group();
    this.earR = new THREE.Group();
    this.tailRoot = new THREE.Group();
    this.tailMid = new THREE.Group();
    this.tailTip = new THREE.Group();
    this.group.add(this.bodyRoot);

    const coat = MaterialCache.getLambert(0x8a6a45);
    const coatDark = MaterialCache.getLambert(0x66502f);
    const stripe = MaterialCache.getLambert(0x4a3620);
    const cream = MaterialCache.getLambert(0xd8c39c);
    const pink = MaterialCache.getLambert(0xc98a86);
    const eye = MaterialCache.getBasic(0xffcc33);
    const pupil = MaterialCache.getBasic(0x1a1408);
    const glint = MaterialCache.getBasic(0xfff6d6);

    const b = (
      parent: THREE.Group,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      cast = true,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // ── Sitting body: haunch → chest ──
    b(this.bodyRoot, 0.4375, 0.25, 0.5, coat, 0, 0.125, -0.03125);
    b(this.bodyRoot, 0.375, 0.09375, 0.4375, cream, 0, 0.03125, -0.03125);
    b(this.bodyRoot, 0.3125, 0.25, 0.3125, coat, 0, 0.3125, 0.09375);
    b(this.bodyRoot, 0.25, 0.1875, 0.0625, cream, 0, 0.28125, 0.25);
    // Front legs + paws
    b(this.bodyRoot, 0.09375, 0.1875, 0.09375, coatDark, -0.09375, 0.125, 0.21875);
    b(this.bodyRoot, 0.09375, 0.1875, 0.09375, coatDark, 0.09375, 0.125, 0.21875);
    b(this.bodyRoot, 0.125, 0.0625, 0.15625, cream, -0.09375, 0.03125, 0.25);
    b(this.bodyRoot, 0.125, 0.0625, 0.15625, cream, 0.09375, 0.03125, 0.25);
    // Hind paws
    b(this.bodyRoot, 0.125, 0.0625, 0.1875, coatDark, -0.1875, 0.03125, -0.15625);
    b(this.bodyRoot, 0.125, 0.0625, 0.1875, coatDark, 0.1875, 0.03125, -0.15625);

    // ── Tabby stripes (thin plates on the surface) ──
    b(this.bodyRoot, 0.4375, 0.03125, 0.03125, stripe, 0, 0.2575, 0.0625, false);
    b(this.bodyRoot, 0.4375, 0.03125, 0.03125, stripe, 0, 0.2575, -0.0625, false);
    b(this.bodyRoot, 0.4375, 0.03125, 0.03125, stripe, 0, 0.2575, -0.1875, false);
    b(this.bodyRoot, 0.03125, 0.09375, 0.3125, stripe, 0.221875, 0.15625, 0, false);
    b(this.bodyRoot, 0.03125, 0.09375, 0.3125, stripe, -0.221875, 0.15625, 0, false);
    b(this.bodyRoot, 0.25, 0.03125, 0.03125, stripe, 0, 0.4375, 0.15625, false);

    // ── Head (pivot at the neck) ──
    this.headGroup.position.set(0, 0.375, 0.09375);
    this.bodyRoot.add(this.headGroup);
    b(this.headGroup, 0.25, 0.25, 0.25, coat, 0, 0.125, 0.03125);
    // Head stripes
    b(this.headGroup, 0.03125, 0.03125, 0.15625, stripe, -0.0625, 0.25, 0.0625, false);
    b(this.headGroup, 0.03125, 0.03125, 0.15625, stripe, 0.0625, 0.25, 0.0625, false);
    b(this.headGroup, 0.03125, 0.03125, 0.125, stripe, 0, 0.25, 0.125, false);
    // Muzzle + nose
    b(this.headGroup, 0.125, 0.0625, 0.0625, cream, 0, 0.0625, 0.15625, false);
    b(this.headGroup, 0.0625, 0.03125, 0.03125, pink, 0, 0.09375, 0.1875, false);
    // Golden eyes with vertical pupil + glint
    b(this.headGroup, 0.0625, 0.0625, 0.03125, eye, -0.0625, 0.15625, 0.125, false);
    b(this.headGroup, 0.0625, 0.0625, 0.03125, eye, 0.0625, 0.15625, 0.125, false);
    b(this.headGroup, 0.03125, 0.03125, 0.03125, pupil, -0.0625, 0.15625, 0.15625, false);
    b(this.headGroup, 0.03125, 0.03125, 0.03125, pupil, 0.0625, 0.15625, 0.15625, false);
    b(this.headGroup, 0.015625, 0.015625, 0.015625, glint, -0.05625, 0.1625, 0.171875, false);
    b(this.headGroup, 0.015625, 0.015625, 0.015625, glint, 0.06875, 0.1625, 0.171875, false);
    // Whiskers
    b(this.headGroup, 0.125, 0.015625, 0.015625, cream, -0.125, 0.0625, 0.15625, false);
    b(this.headGroup, 0.125, 0.015625, 0.015625, cream, 0.125, 0.0625, 0.15625, false);
    // Collar
    b(this.headGroup, 0.25, 0.0625, 0.25, coatDark, 0, 0, 0.03125, false);

    // ── Ears (pivot at the base) ──
    this.earL.position.set(-0.09375, 0.25, 0.03125);
    this.earR.position.set(0.09375, 0.25, 0.03125);
    this.headGroup.add(this.earL, this.earR);
    b(this.earL, 0.09375, 0.125, 0.0625, coat, 0, 0.0625, 0);
    b(this.earL, 0.0625, 0.0625, 0.015625, pink, 0, 0.0625, 0.03125, false);
    b(this.earR, 0.09375, 0.125, 0.0625, coat, 0, 0.0625, 0);
    b(this.earR, 0.0625, 0.0625, 0.015625, pink, 0, 0.0625, 0.03125, false);
    b(this.earR, 0.09375, 0.03125, 0.0625, stripe, 0, 0.125, 0, false);

    // ── Two-joint tail curled along the ground ──
    this.tailRoot.position.set(-0.15625, 0.09375, -0.25);
    this.tailRoot.rotation.y = 0.9;
    this.bodyRoot.add(this.tailRoot);
    this.tailMid.position.set(0, 0, -0.1875);
    this.tailRoot.add(this.tailMid);
    this.tailTip.position.set(0, 0, -0.15625);
    this.tailMid.add(this.tailTip);
    b(this.tailRoot, 0.09375, 0.09375, 0.1875, coatDark, 0, 0.03125, -0.09375);
    b(this.tailMid, 0.09375, 0.09375, 0.1875, coatDark, 0, 0.015625, -0.09375);
    b(this.tailTip, 0.09375, 0.0625, 0.1875, stripe, 0, 0, -0.09375);
    b(this.tailMid, 0.09375, 0.03125, 0.03125, stripe, 0, 0.0625, -0.125, false);
    b(this.tailTip, 0.09375, 0.03125, 0.03125, coat, 0, 0.03125, -0.15625, false);
  }

  update(time: number): void {
    // Breathing chest (pivot at the ground, so the feet stay planted).
    const breathe = 1 + Math.sin(time * 2.0 + 1.1) * 0.012;
    this.bodyRoot.scale.y = breathe;

    // Head sway: slower and lower than the calico's curious bob.
    this.headGroup.rotation.y = Math.sin(time * 0.65 + 0.5) * 0.09;
    this.headGroup.rotation.x = Math.sin(time * 0.9) * 0.025;
    this.headGroup.position.y = 0.375 + Math.sin(time * 2.0 + 1.1) * 0.002;

    // Independent ear twitches.
    const flick = Math.max(0, Math.sin(time * 0.31 + 1.4) - 0.9) * 5;
    this.earL.rotation.z = Math.sin(time * 1.5 + 0.2) * 0.045 - flick * 0.2;
    this.earR.rotation.z = Math.sin(time * 1.5 + 0.9) * -0.045 + flick * 0.16;

    // Tail: root sway, mid curl, tip flick.
    this.tailRoot.rotation.y = 0.9 + Math.sin(time * 1.7) * 0.2;
    this.tailRoot.rotation.x = Math.sin(time * 1.2 + 0.3) * 0.05;
    this.tailMid.rotation.y = Math.sin(time * 1.7 + 0.8) * 0.15;
    this.tailTip.rotation.y = Math.sin(time * 2.1 + 1.4) * 0.2;
    this.tailTip.rotation.x = Math.max(0, Math.sin(time * 1.1)) * 0.18;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setRotationY(y: number): void {
    this.group.rotation.y = y;
  }
}
