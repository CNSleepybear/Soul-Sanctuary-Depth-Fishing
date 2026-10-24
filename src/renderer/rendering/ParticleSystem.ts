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
  position: THREE.Vector3;
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
  private mesh: THREE.InstancedMesh;
  private _matrix = new THREE.Matrix4();

  constructor(config: ParticleConfig) {
    this.config = config;
    this.group = new THREE.Group();

    const geo =
      config.type === 'rain'
        ? new THREE.BoxGeometry(0.045, 0.28, 0.045)
        : new THREE.BoxGeometry(
            config.type === 'firefly' ? 0.1 : 0.075,
            config.type === 'snow' ? 0.05 : 0.075,
            config.type === 'fall_spin' ? 0.04 : 0.075,
          );
    const mat = new THREE.MeshLambertMaterial({
      color: this.config.color,
      flatShading: true,
      transparent: true,
      opacity: config.type === 'firefly' ? 0.8 : 0.58,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.config.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    this._spawn();
  }

  private _spawn(): void {
    for (let i = 0; i < this.config.count; i++) {
      const position = new THREE.Vector3();
      const r = this.config.spreadRadius;
      const h = this.config.heightRange;

      position.set((Math.random() - 0.5) * r * 2, Math.random() * h, (Math.random() - 0.5) * r * 2);

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
        position,
        velocity,
        life,
        maxLife: life,
        phase: Math.random() * Math.PI * 2,
        freq: 0.5 + Math.random() * 1.5,
        amp: 0.05 + Math.random() * 0.15,
        initialY: position.y,
      });
      this._matrix.makeTranslation(position.x, position.y, position.z);
      this.mesh.setMatrixAt(i, this._matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, time: number = 0): void {
    const r = this.config.spreadRadius;
    const h = this.config.heightRange;
    const drift = this.config.driftType ?? 'linear';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      // REF-4: apply drift patterns
      if (drift === 'sine') {
        p.position.x += Math.sin(time * p.freq + p.phase) * p.amp * dt;
        p.position.z += Math.cos(time * p.freq * 0.7 + p.phase) * p.amp * dt;
      } else if (drift === 'swirl') {
        const angle = time * p.freq + p.phase;
        p.position.x += Math.cos(angle) * p.amp * dt;
        p.position.z += Math.sin(angle) * p.amp * dt;
        p.position.y += Math.sin(time * p.freq * 2 + p.phase) * p.amp * 0.3 * dt;
      } else if (drift === 'turbulent') {
        p.position.x += Math.sin(time * p.freq * 1.3 + p.phase) * p.amp * 1.5 * dt;
        p.position.z += Math.cos(time * p.freq * 0.9 + p.phase) * p.amp * 1.5 * dt;
        p.position.y += Math.sin(time * p.freq * 2.1 + p.phase) * p.amp * 0.5 * dt;
      }

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;
      p.life -= dt;

      // REF-4: soft respawn if out of bounds or expired
      if (
        p.life <= 0 ||
        Math.abs(p.position.x) > r ||
        Math.abs(p.position.z) > r ||
        p.position.y > h ||
        p.position.y < 0
      ) {
        p.position.set(
          (Math.random() - 0.5) * r * 2,
          this.config.type === 'rain' ? h * 0.8 : Math.random() * h,
          (Math.random() - 0.5) * r * 2,
        );
        p.initialY = p.position.y;
        p.life = p.maxLife;
      }

      this._matrix.makeTranslation(p.position.x, p.position.y, p.position.z);
      this.mesh.setMatrixAt(i, this._matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  dispose(): void {
    this.group.clear();
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.particles = [];
  }
}
