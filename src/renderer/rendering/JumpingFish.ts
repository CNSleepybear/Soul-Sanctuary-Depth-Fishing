// ===== src/renderer/rendering/JumpingFish.ts =====
// Simple voxel fish that jump out of water in parabolic arcs.
// Splash particles on re-entry.

import * as THREE from 'three';

interface JumpingFishInstance {
  fish: THREE.Group;
  startTime: number;
  duration: number;
  startPos: THREE.Vector3;
  peakHeight: number;
  direction: THREE.Vector3;
  active: boolean;
}

export class JumpingFish {
  readonly group: THREE.Group;
  private fishes: JumpingFishInstance[] = [];
  private splashMeshes: THREE.Mesh[] = [];
  private maxFish = 3;
  private spawnInterval = 4.0; // seconds between spawns
  private lastSpawn = 0;
  private center: THREE.Vector3;
  private waterRadius: number;

  constructor(center: THREE.Vector3, waterRadius: number) {
    this.center = center.clone();
    this.waterRadius = waterRadius;
    this.group = new THREE.Group();
  }

  /** Called each frame. dt in seconds, time in seconds. */
  update(dt: number, time: number): void {
    // Spawn new fish
    if (
      this.fishes.filter((f) => f.active).length < this.maxFish &&
      time - this.lastSpawn > this.spawnInterval
    ) {
      this.lastSpawn = time;
      this._spawn(time);
    }

    // Update active fish
    for (const f of this.fishes) {
      if (!f.active) continue;

      const elapsed = time - f.startTime;
      const t = elapsed / f.duration;

      if (t >= 1.0) {
        // Fish landed — splash!
        f.fish.visible = false;
        f.active = false;
        this._splash(
          f.startPos.clone().add(f.direction.clone().multiplyScalar(this.waterRadius * 0.3)),
        );
        continue;
      }

      // Parabolic arc
      const xz = f.direction.clone().multiplyScalar(t * this.waterRadius * 0.8);
      const y = Math.sin(t * Math.PI) * f.peakHeight; // arc peaks at t=0.5
      f.fish.position.copy(f.startPos).add(xz);
      f.fish.position.y += y;

      // Tilt fish along trajectory
      f.fish.rotation.z = Math.cos(t * Math.PI) * 0.6;
      f.fish.rotation.x = -0.3;
    }

    // Animate splash particles
    for (const s of this.splashMeshes) {
      if (!s.visible) continue;
      const mat = s.material as THREE.MeshBasicMaterial;
      mat.opacity -= dt * 1.5;
      s.position.y += dt * 1.2;
      s.position.x += (Math.random() - 0.5) * dt * 2;
      s.position.z += (Math.random() - 0.5) * dt * 2;
      if (mat.opacity <= 0) s.visible = false;
    }
  }

  private _spawn(time: number): void {
    // Pick a random point on the water edge
    const angle = Math.random() * Math.PI * 2;
    const r = this.waterRadius * (0.85 + Math.random() * 0.2);

    // Find or create a fish mesh
    let instance = this.fishes.find((f) => !f.active);
    if (!instance) {
      instance = {
        fish: this._createFishMesh(),
        startTime: 0,
        duration: 0,
        startPos: new THREE.Vector3(),
        peakHeight: 0,
        direction: new THREE.Vector3(),
        active: false,
      };
      this.fishes.push(instance);
      this.group.add(instance.fish);
    }

    instance.fish.visible = true;
    instance.active = true;
    instance.startTime = time;
    instance.duration = 0.8 + Math.random() * 0.6;
    instance.startPos.set(
      this.center.x + Math.cos(angle) * r,
      this.center.y,
      this.center.z + Math.sin(angle) * r,
    );
    instance.peakHeight = 0.6 + Math.random() * 0.8;

    // Direction: inward toward center with randomness
    instance.direction.set(
      Math.cos(angle + Math.PI + (Math.random() - 0.5) * 0.8),
      0,
      Math.sin(angle + Math.PI + (Math.random() - 0.5) * 0.8),
    );
  }

  private _createFishMesh(): THREE.Group {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xff8855, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), bodyMat);
    g.add(body);

    // Tail
    const tailMat = new THREE.MeshLambertMaterial({ color: 0xff6644, flatShading: true });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.1), tailMat);
    tail.position.set(-0.12, 0, 0);
    g.add(tail);

    // Eye
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), eyeMat);
    eye.position.set(0.06, 0.02, 0.04);
    g.add(eye);

    g.position.y = -999; // hide initially
    g.visible = false;
    return g;
  }

  private _splash(pos: THREE.Vector3): void {
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    // Spawn 6-10 tiny cubes as splash
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const cube = new THREE.Mesh(geo, splashMat.clone());
      cube.position.copy(pos);
      cube.position.y += 0.05;
      this.group.add(cube);
      this.splashMeshes.push(cube);
    }

    // Cleanup old splash particles
    this.splashMeshes = this.splashMeshes.filter((s) => s.visible);
    if (this.splashMeshes.length > 60) {
      const toRemove = this.splashMeshes.splice(0, 20);
      for (const s of toRemove) {
        this.group.remove(s);
        s.geometry.dispose();
        (s.material as THREE.Material).dispose();
      }
    }
  }

  dispose(): void {
    for (const f of this.fishes) {
      f.fish.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
  }
}
