// ===== src/renderer/rendering/ParticleSystem.ts =====
// Reusable low-poly particle emitter for sanctuary atmospheres.
// REF-4: added turbulence / easing motions for more natural particle flow.

import * as THREE from 'three';

interface ParticleConfig {
  count: number;
  type: string; // 'fall' | 'rise' | 'float' | 'drift' | 'snow' | 'rain' | 'firefly' | 'aurora' | 'dust' | 'smoke' | 'fall_spin' | 'river_drift'
  color: number;
  spreadRadius: number;
  heightRange: number;
  driftType?: 'linear' | 'sine' | 'swirl' | 'turbulent'; // REF-4
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  // REF-4: per-particle turbulence params
  phase: number;
  freq: number;
  amp: number;
  initialY: number;
}

export class ParticleSystem {
  private group: THREE.Group;
  private particles: Particle[] = [];
  private config: ParticleConfig;

  constructor(config: ParticleConfig) {
    this.config = config;
    this.group = new THREE.Group();
    this._spawn();
  }

  private _spawn(): void {
    const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    const mat = new THREE.MeshLambertMaterial({
      color: this.config.color,
      flatShading: true,
      transparent: true,
      opacity: 0.8,
    });

    for (let i = 0; i < this.config.count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const r = this.config.spreadRadius;
      const h = this.config.heightRange;

      mesh.position.set(
        (Math.random() - 0.5) * r * 2,
        Math.random() * h,
        (Math.random() - 0.5) * r * 2,
      );

      const velocity = new THREE.Vector3();
      let driftType: ParticleConfig['driftType'] = this.config.driftType ?? 'linear';

      switch (this.config.type) {
        case 'fall':
        case 'fall_spin':
          velocity.set(
            (Math.random() - 0.5) * 0.3,
            -(0.3 + Math.random() * 0.5),
            (Math.random() - 0.5) * 0.3,
          );
          driftType = driftType === 'linear' ? 'sine' : driftType;
          break;
        case 'rise':
          velocity.set(
            (Math.random() - 0.5) * 0.2,
            0.2 + Math.random() * 0.4,
            (Math.random() - 0.5) * 0.2,
          );
          driftType = driftType === 'linear' ? 'sine' : driftType;
          break;
        case 'snow':
          velocity.set(
            (Math.random() - 0.5) * 0.4,
            -(0.1 + Math.random() * 0.3),
            (Math.random() - 0.5) * 0.4,
          );
          driftType = driftType === 'linear' ? 'sine' : driftType;
          break;
        case 'rain':
          velocity.set(0, -(1.0 + Math.random() * 2.0), 0);
          break;
        case 'dust':
        case 'smoke':
          velocity.set(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.3,
          );
          driftType = driftType === 'linear' ? 'swirl' : driftType;
          break;
        case 'float':
          velocity.set(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.2,
          );
          driftType = driftType === 'linear' ? 'sine' : driftType;
          break;
        case 'aurora':
          velocity.set((Math.random() - 0.5) * 0.5, 0.05, (Math.random() - 0.5) * 0.3);
          driftType = driftType === 'linear' ? 'sine' : driftType;
          break;
        default:
          velocity.set(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.2,
          );
      }

      const life = 2 + Math.random() * 4;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        phase: Math.random() * Math.PI * 2,
        freq: 0.5 + Math.random() * 1.5,
        amp: 0.05 + Math.random() * 0.15,
        initialY: mesh.position.y,
      });
      this.group.add(mesh);
    }
  }

  update(dt: number, time: number = 0): void {
    const r = this.config.spreadRadius;
    const h = this.config.heightRange;
    const drift = this.config.driftType ?? 'linear';

    for (const p of this.particles) {
      // REF-4: apply drift patterns
      if (drift === 'sine') {
        p.mesh.position.x += Math.sin(time * p.freq + p.phase) * p.amp * dt;
        p.mesh.position.z += Math.cos(time * p.freq * 0.7 + p.phase) * p.amp * dt;
      } else if (drift === 'swirl') {
        const angle = time * p.freq + p.phase;
        p.mesh.position.x += Math.cos(angle) * p.amp * dt;
        p.mesh.position.z += Math.sin(angle) * p.amp * dt;
        p.mesh.position.y += Math.sin(time * p.freq * 2 + p.phase) * p.amp * 0.3 * dt;
      } else if (drift === 'turbulent') {
        p.mesh.position.x += Math.sin(time * p.freq * 1.3 + p.phase) * p.amp * 1.5 * dt;
        p.mesh.position.z += Math.cos(time * p.freq * 0.9 + p.phase) * p.amp * 1.5 * dt;
        p.mesh.position.y += Math.sin(time * p.freq * 2.1 + p.phase) * p.amp * 0.5 * dt;
      }

      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;
      p.life -= dt;

      // REF-4: soft respawn if out of bounds or expired
      if (
        p.life <= 0 ||
        Math.abs(p.mesh.position.x) > r ||
        Math.abs(p.mesh.position.z) > r ||
        p.mesh.position.y > h ||
        p.mesh.position.y < 0
      ) {
        p.mesh.position.set(
          (Math.random() - 0.5) * r * 2,
          this.config.type === 'rain' ? h * 0.8 : Math.random() * h,
          (Math.random() - 0.5) * r * 2,
        );
        p.initialY = p.mesh.position.y;
        p.life = p.maxLife;
      }
    }
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  dispose(): void {
    for (const p of this.particles) {
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
  }
}
