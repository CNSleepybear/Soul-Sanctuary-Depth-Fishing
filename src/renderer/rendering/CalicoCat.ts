// ===== src/renderer/rendering/CalicoCat.ts =====
// Maneki-neko style calico cat — white base with orange/black patches,
// blue eyes, raised waving paw, collar bell and a gently swishing tail.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §2.5):
// - sitting silhouette reads in a pure black silhouette: haunch → chest →
//   head + ears, with the raised paw breaking the outline;
// - BoxGeometry only, fur uses MaterialCache Lambert, glow bits (eyes, bell)
//   use cached Basic;
// - idle motion: breathing chest, slow head turn, ear twitches, paw wave and a
//   three-joint tail sway. update() allocates nothing.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';

export class CalicoCat {
  readonly group: THREE.Group;
  private bodyRoot: THREE.Group;
  private headGroup: THREE.Group;
  private earL: THREE.Group;
  private earR: THREE.Group;
  private pawGroup: THREE.Group;
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
    this.pawGroup = new THREE.Group();
    this.tailRoot = new THREE.Group();
    this.tailMid = new THREE.Group();
    this.tailTip = new THREE.Group();
    this.group.add(this.bodyRoot);

    const white = MaterialCache.getLambert(0xf4efe4);
    const whiteShade = MaterialCache.getLambert(0xe2dacb);
    const orange = MaterialCache.getLambert(0xd98a4a);
    const black = MaterialCache.getLambert(0x2a2a30);
    const pink = MaterialCache.getLambert(0xe8a0a0);
    const cream = MaterialCache.getLambert(0xf6ecd8);
    const eye = MaterialCache.getBasic(0x56b8dd);
    const pupil = MaterialCache.getBasic(0x14161f);
    const glint = MaterialCache.getBasic(0xf2fbff);
    const gold = MaterialCache.getBasic(0xe0b978);

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
    b(this.bodyRoot, 0.4375, 0.25, 0.5, white, 0, 0.125, -0.03125);
    b(this.bodyRoot, 0.375, 0.125, 0.4375, whiteShade, 0, 0.03125, -0.03125);
    b(this.bodyRoot, 0.3125, 0.25, 0.3125, white, 0, 0.3125, 0.09375);
    b(this.bodyRoot, 0.25, 0.1875, 0.0625, cream, 0, 0.28125, 0.25);
    // Front legs + paws
    b(this.bodyRoot, 0.09375, 0.1875, 0.09375, white, -0.09375, 0.125, 0.21875);
    b(this.bodyRoot, 0.09375, 0.1875, 0.09375, white, 0.09375, 0.125, 0.21875);
    b(this.bodyRoot, 0.125, 0.0625, 0.15625, cream, -0.09375, 0.03125, 0.25);
    b(this.bodyRoot, 0.125, 0.0625, 0.15625, cream, 0.09375, 0.03125, 0.25);
    // Hind paws peeking out
    b(this.bodyRoot, 0.125, 0.0625, 0.1875, white, -0.1875, 0.03125, -0.15625);
    b(this.bodyRoot, 0.125, 0.0625, 0.1875, white, 0.1875, 0.03125, -0.15625);

    // ── Calico patches (thin plates on the surface) ──
    b(this.bodyRoot, 0.1875, 0.03125, 0.25, orange, -0.125, 0.2575, -0.03125, false);
    b(this.bodyRoot, 0.125, 0.03125, 0.1875, black, 0.15625, 0.2575, -0.0625, false);
    b(this.bodyRoot, 0.03125, 0.125, 0.15625, orange, 0.221875, 0.15625, -0.03125, false);
    b(this.bodyRoot, 0.03125, 0.09375, 0.125, black, -0.221875, 0.1875, -0.0625, false);

    // ── Head (pivot at the neck) ──
    this.headGroup.position.set(0, 0.375, 0.09375);
    this.bodyRoot.add(this.headGroup);
    b(this.headGroup, 0.25, 0.25, 0.25, white, 0, 0.125, 0.03125);
    // Face markings
    b(this.headGroup, 0.125, 0.03125, 0.125, orange, -0.0625, 0.25, 0.03125, false);
    b(this.headGroup, 0.09375, 0.03125, 0.09375, black, 0.0625, 0.25, 0.09375, false);
    // Muzzle + nose
    b(this.headGroup, 0.125, 0.0625, 0.0625, cream, 0, 0.0625, 0.15625, false);
    b(this.headGroup, 0.0625, 0.03125, 0.03125, pink, 0, 0.09375, 0.1875, false);
    // Eyes (blue with dark pupil + glint)
    b(this.headGroup, 0.0625, 0.0625, 0.03125, eye, -0.0625, 0.15625, 0.125, false);
    b(this.headGroup, 0.0625, 0.0625, 0.03125, eye, 0.0625, 0.15625, 0.125, false);
    b(this.headGroup, 0.03125, 0.03125, 0.03125, pupil, -0.0625, 0.15625, 0.15625, false);
    b(this.headGroup, 0.03125, 0.03125, 0.03125, pupil, 0.0625, 0.15625, 0.15625, false);
    b(this.headGroup, 0.03125, 0.03125, 0.015625, glint, -0.05625, 0.1625, 0.171875, false);
    b(this.headGroup, 0.03125, 0.03125, 0.015625, glint, 0.06875, 0.1625, 0.171875, false);
    // Whiskers
    b(this.headGroup, 0.125, 0.015625, 0.015625, cream, -0.125, 0.0625, 0.15625, false);
    b(this.headGroup, 0.125, 0.015625, 0.015625, cream, 0.125, 0.0625, 0.15625, false);
    // Collar + bell
    b(this.headGroup, 0.25, 0.0625, 0.25, orange, 0, 0, 0.03125, false);
    b(this.headGroup, 0.0625, 0.0625, 0.03125, gold, 0, -0.03125, 0.15625, false);

    // ── Ears (pivot at the ear base so they can twitch) ──
    this.earL.position.set(-0.09375, 0.25, 0.03125);
    this.earR.position.set(0.09375, 0.25, 0.03125);
    this.headGroup.add(this.earL, this.earR);
    b(this.earL, 0.09375, 0.125, 0.0625, white, 0, 0.0625, 0);
    b(this.earL, 0.0625, 0.0625, 0.015625, pink, 0, 0.0625, 0.03125, false);
    b(this.earR, 0.09375, 0.125, 0.0625, white, 0, 0.0625, 0);
    b(this.earR, 0.0625, 0.0625, 0.015625, pink, 0, 0.0625, 0.03125, false);
    b(this.earR, 0.09375, 0.03125, 0.0625, orange, 0, 0.125, 0, false);

    // ── Raised paw (maneki-neko wave) ──
    this.pawGroup.position.set(0.1875, 0.25, 0.1875);
    this.bodyRoot.add(this.pawGroup);
    b(this.pawGroup, 0.09375, 0.1875, 0.09375, white, 0, 0.09375, 0);
    b(this.pawGroup, 0.125, 0.09375, 0.125, cream, 0, 0.21875, 0.015625);

    // ── Three-joint tail curling around the haunch ──
    this.tailRoot.position.set(-0.125, 0.09375, -0.25);
    this.tailRoot.rotation.y = 0.5;
    this.bodyRoot.add(this.tailRoot);
    this.tailMid.position.set(0, 0, -0.15625);
    this.tailRoot.add(this.tailMid);
    this.tailTip.position.set(0, 0, -0.125);
    this.tailMid.add(this.tailTip);
    b(this.tailRoot, 0.09375, 0.09375, 0.1875, white, 0, 0.03125, -0.09375);
    b(this.tailMid, 0.09375, 0.09375, 0.15625, white, 0, 0.015625, -0.0625);
    b(this.tailTip, 0.09375, 0.09375, 0.125, orange, 0, 0, -0.0625);
    b(this.tailTip, 0.09375, 0.03125, 0.0625, white, 0, 0.0625, -0.0625, false);
  }

  update(time: number): void {
    // Breathing chest (pivot at the ground, so the feet stay planted).
    const breathe = 1 + Math.sin(time * 2.2 + 0.7) * 0.012;
    this.bodyRoot.scale.y = breathe;

    // Slow head turn + curious tilt.
    this.headGroup.rotation.y = Math.sin(time * 0.8) * 0.1;
    this.headGroup.rotation.x = Math.sin(time * 1.1 + 0.3) * 0.03;
    this.headGroup.position.y = 0.375 + Math.sin(time * 2.2 + 0.7) * 0.002;

    // Ear twitches: rare quick flick on top of a slow idle drift.
    const flick = Math.max(0, Math.sin(time * 0.37) - 0.92) * 6;
    this.earL.rotation.z = Math.sin(time * 1.7) * 0.05 + flick * 0.18;
    this.earR.rotation.z = Math.sin(time * 1.7 + 0.6) * -0.05 - flick * 0.14;

    // Paw wave.
    this.pawGroup.rotation.z = Math.sin(time * 2.4) * 0.16;

    // Tail: root sway + mid curl + tip counter-sway.
    this.tailRoot.rotation.y = 0.5 + Math.sin(time * 2.0) * 0.22;
    this.tailRoot.rotation.x = Math.sin(time * 1.5 + 0.4) * 0.06;
    this.tailMid.rotation.y = Math.sin(time * 2.0 + 0.7) * 0.18;
    this.tailTip.rotation.y = Math.sin(time * 2.4 + 1.2) * 0.24;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setRotationY(y: number): void {
    this.group.rotation.y = y;
  }
}
