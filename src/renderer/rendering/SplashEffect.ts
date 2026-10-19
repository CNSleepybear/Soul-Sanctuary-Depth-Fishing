// ===== src/renderer/rendering/SplashEffect.ts =====
// Box-particle splash burst — triggered on cast landing, fish bite, catch and
// line snap.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §3.2):
// - three splash tiers driven by the requested particle count:
//     small  (<20)  : compact droplet ring
//     medium (<40)  : droplets + expanding foam ring
//     legendary (≥40): taller water column + gold soul sparks
// - all droplets live in ONE InstancedMesh (single draw call), so a 60-particle
//   legendary catch does not blow the draw-call budget;
// - particles are stored in world space, so overlapping bursts never shift each
//   other when a new splash starts;
// - update() allocates nothing: matrices/vectors/quaternions are reused.

import * as THREE from 'three';

const CAPACITY = 96;
const GRAVITY = -6.0;

interface SplashParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  aspect: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotSpeed: number;
  gravity: number;
}

export class SplashEffect {
  readonly group: THREE.Group;

  private mesh: THREE.InstancedMesh;
  private geometry: THREE.BoxGeometry;
  private material: THREE.MeshLambertMaterial;
  private particles: SplashParticle[] = [];
  private activeCount = 0;

  private _m = new THREE.Matrix4();
  private _pos = new THREE.Vector3();
  private _quat = new THREE.Quaternion();
  private _euler = new THREE.Euler();
  private _scale = new THREE.Vector3();
  private _color = new THREE.Color();
  private _white = new THREE.Color(0xf2fbff);
  private _gold = new THREE.Color(0xffd76a);
  private _cursor = 0;

  constructor() {
    this.group = new THREE.Group();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, CAPACITY);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = CAPACITY;
    this.mesh.visible = false;

    for (let i = 0; i < CAPACITY; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0,
        aspect: 1,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        rotSpeed: 0,
        gravity: GRAVITY,
      });
      // Hide unused instance slots immediately.
      this._m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._white);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.group.add(this.mesh);
  }

  /** Trigger a splash at the given world position. */
  burst(position: THREE.Vector3, count = 15, color = 0xaaddff, radius = 1.5, height = 2): void {
    const tier = count >= 40 ? 2 : count >= 20 ? 1 : 0;
    this.mesh.visible = true;

    // Droplets
    for (let i = 0; i < count; i++) {
      const slot = this._acquire();
      if (slot < 0) break;
      const p = this.particles[slot];
      p.active = true;
      p.x = position.x + (Math.random() - 0.5) * 0.35;
      p.y = position.y + Math.random() * 0.15;
      p.z = position.z + (Math.random() - 0.5) * 0.35;

      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 2.2) * (0.7 + tier * 0.25);
      p.vx = Math.cos(angle) * speed * radius * 0.55;
      p.vz = Math.sin(angle) * speed * radius * 0.55;
      p.vy = 0.9 + Math.random() * height * (tier === 2 ? 1.4 : 1);
      p.size = 0.0625 + Math.random() * (0.06 + tier * 0.025);
      p.aspect = 1;
      p.life = 0;
      p.maxLife = 0.42 + Math.random() * (0.5 + tier * 0.18);
      p.rotX = Math.random() * 3;
      p.rotY = Math.random() * 3;
      p.rotZ = Math.random() * 3;
      p.rotSpeed = (Math.random() - 0.5) * 7;
      p.gravity = GRAVITY;

      const legendarySpark = tier === 2 && i % 5 === 0;
      const c = legendarySpark ? this._gold : this._color.setHex(color);
      this.mesh.setColorAt(slot, c);
    }

    // Expanding foam ring — reads as the surface "pop" around the splash.
    const foamCount = 8 + tier * 4;
    for (let i = 0; i < foamCount; i++) {
      const slot = this._acquire();
      if (slot < 0) break;
      const p = this.particles[slot];
      const angle = (i / foamCount) * Math.PI * 2 + Math.random() * 0.25;
      const spread = 0.25 + Math.random() * 0.25;
      p.active = true;
      p.x = position.x + Math.cos(angle) * spread;
      p.y = position.y + 0.01;
      p.z = position.z + Math.sin(angle) * spread;
      p.vx = Math.cos(angle) * (0.7 + Math.random() * 0.8) * radius * 0.45;
      p.vz = Math.sin(angle) * (0.7 + Math.random() * 0.8) * radius * 0.45;
      p.vy = 0.05;
      p.size = 0.1 + Math.random() * 0.08;
      p.aspect = 0.22; // flat foam plates
      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.35;
      p.rotX = 0;
      p.rotY = Math.random() * 3;
      p.rotZ = 0;
      p.rotSpeed = 0;
      p.gravity = -1.2;
      this._color.setHex(color).lerp(this._white, 0.72);
      this.mesh.setColorAt(slot, this._color);
    }

    // Legendary column: a few bright blocks shooting straight up.
    if (tier === 2) {
      for (let i = 0; i < 4; i++) {
        const slot = this._acquire();
        if (slot < 0) break;
        const p = this.particles[slot];
        p.active = true;
        p.x = position.x + (Math.random() - 0.5) * 0.2;
        p.y = position.y + 0.05;
        p.z = position.z + (Math.random() - 0.5) * 0.2;
        p.vx = (Math.random() - 0.5) * 0.3;
        p.vz = (Math.random() - 0.5) * 0.3;
        p.vy = 2.4 + Math.random() * 1.1;
        p.size = 0.16 + Math.random() * 0.08;
        p.aspect = 1.4;
        p.life = 0;
        p.maxLife = 0.4 + Math.random() * 0.3;
        p.rotX = 0;
        p.rotY = 0;
        p.rotZ = 0;
        p.rotSpeed = 2;
        p.gravity = GRAVITY * 0.6;
        this._color.copy(this._white).lerp(this._gold, 0.35);
        this.mesh.setColorAt(slot, this._color);
      }
    }

    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    if (this.activeCount === 0) return;

    let alive = 0;
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      alive++;

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotX += p.rotSpeed * dt;
      p.rotZ += p.rotSpeed * 0.6 * dt;

      const t = p.life / p.maxLife;
      // Shrink to nothing instead of per-instance opacity (instancing keeps it
      // at one draw call); foam plates stay flat and wide.
      const shrink = 1 - t * t;
      const s = p.size * shrink;
      this._pos.set(p.x, p.y, p.z);
      this._euler.set(p.rotX, p.rotY, p.rotZ);
      this._quat.setFromEuler(this._euler);
      this._scale.set(s, s * p.aspect, s);
      this._m.compose(this._pos, this._quat, this._scale);
      this.mesh.setMatrixAt(i, this._m);
    }

    this.activeCount = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
    // Skip the draw call entirely while the pool is empty.
    this.mesh.visible = alive > 0;
  }

  clear(): void {
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.particles[i];
      p.active = false;
      this._m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.activeCount = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }

  /** Find a free slot, recycling the oldest one when the pool is full. */
  private _acquire(): number {
    for (let n = 0; n < CAPACITY; n++) {
      const i = (this._cursor + n) % CAPACITY;
      if (!this.particles[i].active) {
        this._cursor = (i + 1) % CAPACITY;
        this.activeCount = Math.min(CAPACITY, this.activeCount + 1);
        return i;
      }
    }
    // Pool exhausted: reuse the cursor slot (oldest-ish).
    const i = this._cursor;
    this._cursor = (i + 1) % CAPACITY;
    return i;
  }

  dispose(): void {
    this.group.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.particles = [];
    this.group.clear();
  }
}
