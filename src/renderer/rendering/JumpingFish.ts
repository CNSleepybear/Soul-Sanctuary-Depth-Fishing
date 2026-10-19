// ===== src/renderer/rendering/JumpingFish.ts =====
// Small voxel fish that leap out of the water in parabolic arcs, with an
// instanced box-particle splash on re-entry.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §3.2):
// - BoxGeometry-only fish with dorsal / pectoral / tail fins and a readable
//   eye; the tail pivots so the leap reads as a living fish;
// - splash droplets live in a single InstancedMesh (one draw call), reused
//   from a fixed pool — no per-frame allocation and no per-burst materials;
// - jumping fish bodies and splash slots are pooled, so the class can run for
//   a whole session without growing the scene graph.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';

const MAX_FISH = 3;
const SPLASH_CAPACITY = 48;
const GRAVITY = -7;
const SPAWN_INTERVAL = 4.0;

const FISH_COLORS = [0xff8855, 0xffd76a, 0x8fd0e8];

interface JumpingFishInstance {
  fish: THREE.Group;
  tail: THREE.Group;
  startX: number;
  startZ: number;
  dirX: number;
  dirZ: number;
  startTime: number;
  duration: number;
  peakHeight: number;
  phase: number;
  active: boolean;
}

interface SplashSlot {
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
}

export class JumpingFish {
  readonly group: THREE.Group;
  private fishes: JumpingFishInstance[] = [];
  private center: THREE.Vector3;
  private waterRadius: number;
  private lastSpawn = -999;

  private fishGeometry: THREE.BoxGeometry;
  private splashGeometry: THREE.BoxGeometry;
  private splashMaterial: THREE.MeshLambertMaterial;
  private splashMesh: THREE.InstancedMesh;
  private splashSlots: SplashSlot[] = [];

  private _m = new THREE.Matrix4();
  private _pos = new THREE.Vector3();
  private _quat = new THREE.Quaternion();
  private _scale = new THREE.Vector3();

  constructor(center: THREE.Vector3, waterRadius: number) {
    this.center = center.clone();
    this.waterRadius = waterRadius;
    this.group = new THREE.Group();

    this.fishGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.splashGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.splashMaterial = new THREE.MeshLambertMaterial({
      color: 0xaaddff,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.splashMesh = new THREE.InstancedMesh(
      this.splashGeometry,
      this.splashMaterial,
      SPLASH_CAPACITY,
    );
    this.splashMesh.frustumCulled = false;
    this.splashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splashMesh.count = SPLASH_CAPACITY;
    for (let i = 0; i < SPLASH_CAPACITY; i++) {
      this.splashSlots.push({
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
      });
      this._m.makeScale(0, 0, 0);
      this.splashMesh.setMatrixAt(i, this._m);
    }
    this.splashMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.splashMesh);
  }

  /** Called each frame. dt in seconds, time in seconds. */
  update(dt: number, time: number): void {
    // ── Spawn ──
    let activeFish = 0;
    for (const f of this.fishes) if (f.active) activeFish++;
    if (activeFish < MAX_FISH && time - this.lastSpawn > SPAWN_INTERVAL) {
      this.lastSpawn = time;
      this._spawn(time);
    }

    // ── Jump arcs ──
    for (const f of this.fishes) {
      if (!f.active) continue;
      const elapsed = time - f.startTime;
      const t = elapsed / f.duration;

      if (t >= 1) {
        f.active = false;
        f.fish.visible = false;
        const landX = f.startX + f.dirX * this.waterRadius * 0.8;
        const landZ = f.startZ + f.dirZ * this.waterRadius * 0.8;
        this._splash(landX, this.center.y + 0.02, landZ);
        continue;
      }

      const travel = t * this.waterRadius * 0.8;
      const arc = Math.sin(t * Math.PI) * f.peakHeight;
      f.fish.position.set(
        f.startX + f.dirX * travel,
        this.center.y + arc,
        f.startZ + f.dirZ * travel,
      );
      // Face travel direction (+X-forward fish model) and pitch with the arc.
      f.fish.rotation.y = Math.atan2(-f.dirZ, f.dirX);
      f.fish.rotation.z = Math.cos(t * Math.PI) * 0.55;
      // Tail beats faster at the top of the arc.
      f.tail.rotation.y = Math.sin(time * 14 + f.phase) * 0.55;
    }

    // ── Splash droplets (single InstancedMesh) ──
    let alive = 0;
    for (let i = 0; i < SPLASH_CAPACITY; i++) {
      const p = this.splashSlots[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this._m.makeScale(0, 0, 0);
        this.splashMesh.setMatrixAt(i, this._m);
        continue;
      }
      alive++;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      const s = p.size * (1 - t * t);
      this._pos.set(p.x, p.y, p.z);
      this._scale.set(s, s, s);
      this._m.compose(this._pos, this._quat.identity(), this._scale);
      this.splashMesh.setMatrixAt(i, this._m);
    }
    if (alive > 0) this.splashMesh.instanceMatrix.needsUpdate = true;
  }

  private _spawn(time: number): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = this.waterRadius * (0.85 + Math.random() * 0.2);
    let instance = this.fishes.find((f) => !f.active);
    if (!instance) {
      if (this.fishes.length >= MAX_FISH) return;
      const built = this._createFishMesh();
      instance = {
        fish: built.fish,
        tail: built.tail,
        startX: 0,
        startZ: 0,
        dirX: 0,
        dirZ: 0,
        startTime: 0,
        duration: 1,
        peakHeight: 1,
        phase: 0,
        active: false,
      };
      this.fishes.push(instance);
      this.group.add(instance.fish);
    }

    instance.fish.visible = true;
    instance.active = true;
    instance.startTime = time;
    instance.duration = 0.8 + Math.random() * 0.6;
    instance.startX = this.center.x + Math.cos(angle) * radius;
    instance.startZ = this.center.z + Math.sin(angle) * radius;
    instance.peakHeight = 0.6 + Math.random() * 0.8;
    instance.phase = Math.random() * Math.PI * 2;

    // Inward direction with a little randomness.
    const dirAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    instance.dirX = Math.cos(dirAngle);
    instance.dirZ = Math.sin(dirAngle);
    instance.fish.position.set(instance.startX, this.center.y, instance.startZ);
  }

  private _createFishMesh(): { fish: THREE.Group; tail: THREE.Group } {
    const fish = new THREE.Group();
    const bodyGroup = new THREE.Group();
    fish.add(bodyGroup);

    const body = MaterialCache.getLambert(FISH_COLORS[this.fishes.length % FISH_COLORS.length]);
    const fin = MaterialCache.getLambert(0xff6644);
    const belly = MaterialCache.getLambert(0xfff0d0);
    const eye = MaterialCache.getBasic(0x14161f);
    const glint = MaterialCache.getBasic(0xf2fbff);

    const box = (
      parent: THREE.Group,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new THREE.Mesh(this.fishGeometry, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.castShadow = false;
      parent.add(mesh);
      return mesh;
    };

    // Body (head toward +X)
    box(bodyGroup, 0.34, 0.13, 0.12, body, 0, 0, 0);
    box(bodyGroup, 0.28, 0.06, 0.1, belly, 0, -0.075, 0);
    box(bodyGroup, 0.16, 0.15, 0.11, body, 0.23, 0.01, 0);
    // Eye + glint
    box(bodyGroup, 0.05, 0.05, 0.03, eye, 0.28, 0.04, 0.06);
    box(bodyGroup, 0.05, 0.05, 0.03, eye, 0.28, 0.04, -0.06);
    box(bodyGroup, 0.025, 0.025, 0.02, glint, 0.29, 0.055, 0.075);
    // Dorsal fin
    box(bodyGroup, 0.14, 0.1, 0.03, fin, -0.02, 0.11, 0);
    // Pectoral fins
    box(bodyGroup, 0.1, 0.04, 0.14, fin, 0.1, -0.05, 0.1);
    box(bodyGroup, 0.1, 0.04, 0.14, fin, 0.1, -0.05, -0.1);

    // Tail pivots at the rear.
    const tail = new THREE.Group();
    tail.position.set(-0.2, 0, 0);
    bodyGroup.add(tail);
    box(tail, 0.14, 0.17, 0.03, fin, -0.05, 0, 0);
    box(tail, 0.1, 0.1, 0.03, fin, -0.11, 0.1, 0.02);
    box(tail, 0.1, 0.1, 0.03, fin, -0.11, -0.1, 0.02);

    fish.visible = false;
    return { fish, tail };
  }

  private _splash(x: number, y: number, z: number): void {
    const count = 8 + Math.floor(Math.random() * 5);
    let spawned = 0;
    for (let i = 0; i < SPLASH_CAPACITY && spawned < count; i++) {
      const p = this.splashSlots[i];
      if (p.active) continue;
      spawned++;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.0;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.2;
      p.y = y + 0.05;
      p.z = z + (Math.random() - 0.5) * 0.2;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = 1.2 + Math.random() * 1.8;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.4;
      p.size = 0.05 + Math.random() * 0.05;
    }
  }

  dispose(): void {
    // Fish meshes share this.fishGeometry; materials come from MaterialCache.
    this.fishes.forEach((f) => {
      this.group.remove(f.fish);
    });
    this.fishes = [];
    this.group.remove(this.splashMesh);
    this.splashMesh.dispose();
    this.fishGeometry.dispose();
    this.splashGeometry.dispose();
    this.splashMaterial.dispose();
    this.splashSlots = [];
    this.group.clear();
  }
}
