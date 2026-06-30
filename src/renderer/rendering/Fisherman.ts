// ===== src/renderer/rendering/Fisherman.ts =====
// Voxel pixel fisherman — small character holding a rod on the island edge.
// Upgraded to match the richer voxel style in voxel-showcase.html.
// Rod tip position is exposed for FishingLine to connect to.

import * as THREE from 'three';

export class Fisherman {
  readonly group: THREE.Group;
  readonly rodTip: THREE.Vector3; // world-space rod tip for line attachment

  private rodGroup: THREE.Group;
  private bodyGroup: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.rodTip = new THREE.Vector3();
    this.rodGroup = new THREE.Group();
    this.bodyGroup = new THREE.Group();

    const skin = new THREE.MeshLambertMaterial({ color: 0xf5d0b0, flatShading: true });
    const coat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a, flatShading: true });
    const pants = new THREE.MeshLambertMaterial({ color: 0x4a3728, flatShading: true });
    const hat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a, flatShading: true });
    const rodMat = new THREE.MeshLambertMaterial({ color: 0x5c4033, flatShading: true });

    const b = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // ── Body ──
    // Legs
    this.bodyGroup.add(b(0.25, 0.8, 0.25, pants, -0.2, 0.4, 0));
    this.bodyGroup.add(b(0.25, 0.8, 0.25, pants, 0.2, 0.4, 0));
    // Torso
    this.bodyGroup.add(b(0.6, 0.7, 0.4, coat, 0, 1.15, 0));
    // Head
    this.bodyGroup.add(b(0.45, 0.45, 0.45, skin, 0, 1.7, 0));
    // Hat
    this.bodyGroup.add(b(0.6, 0.15, 0.6, hat, 0, 1.95, 0));
    this.bodyGroup.add(b(0.3, 0.3, 0.3, hat, 0, 2.15, 0));
    // Arm holding rod
    this.bodyGroup.add(b(0.15, 0.6, 0.15, coat, 0.4, 1.3, 0.3));

    this.group.add(this.bodyGroup);

    // ── Rod ──
    // Rod extends outward from the hand
    const shaft = b(0.05, 0.05, 2.5, rodMat, 0.5, 1.6, 1.2);
    this.rodGroup.add(shaft);
    this.group.add(this.rodGroup);

    // Rod tip local position
    this.rodTip.set(0.5, 1.6, 2.45);
  }

  /** Get world-space rod tip for line attachment. */
  getWorldRodTip(): THREE.Vector3 {
    const local = this.rodTip.clone();
    this.rodGroup.localToWorld(local);
    return local;
  }

  private _tension = 0;

  /** Set tension (0-100) for rod bend. */
  setTension(t: number): void {
    this._tension = Math.max(0, Math.min(100, t));
  }

  /** Idle animation + rod bend based on tension. */
  update(time: number): void {
    const breathe = Math.sin(time * 2) * 0.02;
    this.bodyGroup.position.y = breathe;
    this.rodGroup.position.y = breathe;

    // Rod bend: more bend = higher tension
    const bendAngle = (this._tension / 100) * 0.35;
    this.rodGroup.rotation.x = -bendAngle * 0.6;
    this.rodGroup.rotation.z = Math.sin(time * 2.0) * 0.03 + bendAngle * 0.3;

    // Body lean back during fight
    this.bodyGroup.rotation.x = -bendAngle * 0.3;
  }

  dispose(): void {
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material.dispose();
      }
    });
  }
}
