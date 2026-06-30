// ===== src/renderer/rendering/SplashEffect.ts =====
// Box-particle burst — triggered on cast landing, fish bite, and line snap.
// Particles: small white/blue boxes that burst outward, fall, and fade.
// Uses an object pool so geometries/materials are reused across bursts.

import * as THREE from 'three';

interface SplashParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class SplashEffect {
  readonly group: THREE.Group;
  private activeParticles: SplashParticle[] = [];
  private pool: SplashParticle[] = [];
  private active = false;
  private baseGeometry: THREE.BoxGeometry;

  constructor() {
    this.group = new THREE.Group();
    // REF-PERF: single unit cube scaled per particle, never recreate geometry per burst
    this.baseGeometry = new THREE.BoxGeometry(1, 1, 1);
  }

  /** Trigger a splash at the given world position. */
  burst(position: THREE.Vector3, count = 15, color = 0xaaddff, radius = 1.5, height = 2): void {
    this.active = true;
    this.group.position.copy(position);

    for (let i = 0; i < count; i++) {
      let p = this.pool.pop();
      if (!p) {
        const mat = new THREE.MeshLambertMaterial({
          color,
          flatShading: true,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(this.baseGeometry, mat);
        mesh.visible = false;
        this.group.add(mesh);
        p = {
          mesh,
          velocity: new THREE.Vector3(),
          life: 0,
          maxLife: 0,
          active: false,
        };
      }

      // Reset / recycle
      p.active = true;
      p.mesh.visible = true;
      const mat = p.mesh.material as THREE.MeshLambertMaterial;
      mat.color.setHex(color);
      mat.opacity = 0.9;

      const size = 0.04 + Math.random() * 0.08;
      p.mesh.scale.set(size, size, size);
      p.mesh.rotation.set(0, 0, 0);

      // Random outward direction
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      p.velocity.set(
        Math.cos(angle) * speed * radius * 0.5,
        1 + Math.random() * height,
        Math.sin(angle) * speed * radius * 0.5,
      );

      p.mesh.position.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.3,
      );

      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.8;

      this.activeParticles.push(p);
    }
  }

  update(dt: number): void {
    if (!this.active) return;

    let aliveCount = 0;

    for (const p of this.activeParticles) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        this._returnToPool(p);
        continue;
      }

      aliveCount++;

      // Move
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      // Gravity
      p.velocity.y -= 6 * dt;

      // Fade
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshLambertMaterial).opacity = alpha * 0.9;

      // Rotation
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 3;
    }

    // Compact the active list occasionally to avoid unbounded growth
    if (aliveCount === 0) {
      this.activeParticles = [];
      this.active = false;
    }
  }

  private _returnToPool(p: SplashParticle): void {
    p.active = false;
    p.mesh.visible = false;
    p.mesh.position.set(0, 0, 0);
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.scale.set(1, 1, 1);
    this.pool.push(p);
  }

  clear(): void {
    for (const p of this.activeParticles) {
      this._returnToPool(p);
    }
    this.activeParticles = [];
    this.active = false;
  }

  dispose(): void {
    this.clear();
    this.baseGeometry.dispose();
    for (const p of this.pool) {
      (p.mesh.material as THREE.Material).dispose();
      this.group.remove(p.mesh);
    }
    this.pool = [];
  }
}
