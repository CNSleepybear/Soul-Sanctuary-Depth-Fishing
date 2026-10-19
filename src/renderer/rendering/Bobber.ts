// ===== src/renderer/rendering/Bobber.ts =====
// 3D voxel bobber — warm red + cream three-section float (top marker / float
// body / bottom needle) with water-line reflection blocks and square voxel
// ripples instead of ring geometry.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §3.2):
// - all geometry is BoxGeometry (no Ring/Sphere/Cylinder);
// - idle bob, nibble twitch, bite sink, cast flight arc and resurface are kept
//   from the original state machine so FishingSceneManager needs no changes;
// - update() never allocates: all temporaries are preallocated vectors.

import * as THREE from 'three';
import type { InstancedVoxel } from './ArtKit';
import { MaterialCache } from './MaterialCache';

export type BobberState = 'hidden' | 'idle' | 'flying' | 'waiting' | 'sinking' | 'resurfacing';

export class Bobber {
  readonly group: THREE.Group;

  private floatGroup: THREE.Group;
  private antenna: THREE.Mesh;
  private reflection: THREE.Group;
  private ringGroups: THREE.Group[] = [];
  private ringMats: THREE.MeshBasicMaterial[] = [];
  private ripplePhase = 0;

  private _state: BobberState = 'hidden';
  private bobPhase = 0;

  // Flight arc
  private flightStart = new THREE.Vector3();
  private flightEnd = new THREE.Vector3();
  private flightDuration = 0.6;
  private flightElapsed = 0;
  private flightArcHeight = 2.6;
  private _flightPos = new THREE.Vector3();

  // Sink / twitch
  private sinkTarget = -1.15;
  private twitchTimer = 0;
  private twitching = false;

  private _worldPos = new THREE.Vector3();
  private _ownMats: THREE.Material[] = [];
  private _boxGeo: THREE.BoxGeometry;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.floatGroup = new THREE.Group();
    this.reflection = new THREE.Group();

    // ── Palette: cached colors for the float, owned materials for instance
    // colors, water-line reflections and ripples (disposed in dispose()).
    const red = MaterialCache.getLambert(0xd9564a);
    const redLight = MaterialCache.getLambert(0xe88274);
    const cream = MaterialCache.getLambert(0xf4e3c2);
    const needle = MaterialCache.getLambert(0x4f5a61);
    const metal = MaterialCache.getLambert(0xb9b3a4);

    const floatMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const reflectionMat = new THREE.MeshBasicMaterial({
      color: 0xd9564a,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const reflectionMatCream = new THREE.MeshBasicMaterial({
      color: 0xf4e3c2,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this._ownMats.push(floatMat, reflectionMat, reflectionMatCream);

    // One shared unit box per bobber instance; everything is a scaled cube.
    this._boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();
    const batch = (
      parent: THREE.Group,
      cells: InstancedVoxel[],
      mat: THREE.Material,
      useInstanceColor = false,
    ) => {
      const mesh = new THREE.InstancedMesh(this._boxGeo, mat, cells.length);
      cells.forEach((cell, index) => {
        position.set(cell.x, cell.y, cell.z);
        scale.set(cell.w ?? 1, cell.h ?? 1, cell.d ?? 1);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
        if (useInstanceColor) {
          color.setHex(cell.color);
          mesh.setColorAt(index, color);
        }
      });
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      parent.add(mesh);
    };
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
      const mesh = new THREE.Mesh(this._boxGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      parent.add(mesh);
      return mesh;
    };
    const floatCells: InstancedVoxel[] = [];
    const floatBox = (
      w: number,
      h: number,
      d: number,
      mat: THREE.MeshLambertMaterial,
      x: number,
      y: number,
      z: number,
    ) => {
      floatCells.push({ w, h, d, color: mat.color.getHex(), x, y, z });
    };

    this.group.add(this.floatGroup);

    // ── Section 1: top marker (cream collar + red cap + antenna) ──
    floatBox(0.1875, 0.03125, 0.1875, cream, 0, 0.203125, 0);
    floatBox(0.125, 0.09375, 0.125, red, 0, 0.171875, 0);
    floatBox(0.0625, 0.0625, 0.0625, redLight, 0, 0.25, 0);
    this.antenna = box(this.floatGroup, 0.0625, 0.125, 0.0625, cream, 0, 0.3125, 0);
    floatBox(0.0625, 0.03125, 0.0625, redLight, 0, 0.390625, 0);

    // ── Section 2: float body (red top, cream belly, cream band) ──
    floatBox(0.1875, 0.125, 0.1875, red, 0, 0.078125, 0);
    floatBox(0.21875, 0.03125, 0.21875, cream, 0, 0.015625, 0);
    floatBox(0.1875, 0.09375, 0.1875, cream, 0, -0.0625, 0);
    floatBox(0.125, 0.0625, 0.125, cream, 0, -0.140625, 0);

    // ── Section 3: bottom needle ──
    floatBox(0.0625, 0.125, 0.0625, metal, 0, -0.234375, 0);
    floatBox(0.0625, 0.125, 0.0625, needle, 0, -0.359375, 0);
    floatBox(0.0625, 0.0625, 0.0625, needle, 0, -0.453125, 0);
    batch(this.floatGroup, floatCells, floatMat, true);

    // ── Water-line reflection blocks (flat plates hugging the surface) ──
    batch(
      this.reflection,
      [
        { w: 0.28125, h: 0.015625, d: 0.0625, color: 0xd9564a, x: 0, y: -0.03125, z: 0.15625 },
        { w: 0.28125, h: 0.015625, d: 0.0625, color: 0xd9564a, x: 0, y: -0.03125, z: -0.15625 },
      ],
      reflectionMat,
    );
    batch(
      this.reflection,
      [
        { w: 0.0625, h: 0.015625, d: 0.28125, color: 0xf4e3c2, x: 0.15625, y: -0.03125, z: 0 },
        { w: 0.0625, h: 0.015625, d: 0.28125, color: 0xf4e3c2, x: -0.15625, y: -0.03125, z: 0 },
      ],
      reflectionMatCream,
    );
    this.group.add(this.reflection);

    // ── Square voxel ripple rings (2 rings, 4 bars each) ──
    for (let r = 0; r < 2; r++) {
      const ring = new THREE.Group();
      ring.position.y = -0.015625;
      ring.visible = false;
      const ringColor = r === 0 ? 0xcfeaf2 : 0xaee0ee;
      const mat = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      this._ownMats.push(mat);
      this.ringMats.push(mat);
      // Bars are built at a half-size of 0.5 and the group is scaled up over time.
      batch(
        ring,
        [
          { w: 1.0, h: 0.03125, d: 0.0625, color: ringColor, x: 0, y: 0, z: 0.5 },
          { w: 1.0, h: 0.03125, d: 0.0625, color: ringColor, x: 0, y: 0, z: -0.5 },
          { w: 0.0625, h: 0.03125, d: 1.0, color: ringColor, x: 0.5, y: 0, z: 0 },
          { w: 0.0625, h: 0.03125, d: 1.0, color: ringColor, x: -0.5, y: 0, z: 0 },
        ],
        mat,
      );
      ring.scale.set(0.4, 1, 0.4);
      this.ringGroups.push(ring);
      this.group.add(ring);
    }
  }

  get state(): BobberState {
    return this._state;
  }

  // ── State transitions ──

  /** Show idle bobber at position (waiting for cast). */
  showIdle(pos: THREE.Vector3): void {
    this._state = 'idle';
    this.group.visible = true;
    this.group.position.copy(pos);
    this.group.rotation.set(0, 0, 0);
    this.floatGroup.position.y = 0;
    this.floatGroup.rotation.set(0, 0, 0);
    this.bobPhase = Math.random() * Math.PI * 2;
    this._hideRipples();
  }

  /** Begin flight arc from rod tip to water target. */
  startFlight(from: THREE.Vector3, to: THREE.Vector3): void {
    this._state = 'flying';
    this.group.visible = true;
    this.flightStart.copy(from);
    this.flightEnd.copy(to);
    this.flightElapsed = 0;
    this.group.position.copy(from);
    this.group.rotation.set(0, 0, 0);
    this.floatGroup.position.y = 0;
    this._hideRipples();
  }

  /** Land in water — begin waiting bob. */
  land(): void {
    this._state = 'waiting';
    this.group.position.copy(this.flightEnd);
    this.group.rotation.set(0, 0, 0);
    this.floatGroup.position.y = 0;
    this.bobPhase = 0;
    this.ripplePhase = 0;
    this._showRipples();
  }

  /** Quick twitch (nibble) — frame-based, no setTimeout. */
  twitch(): void {
    if (this._state !== 'waiting' && this._state !== 'idle') return;
    this.floatGroup.position.y = -0.125;
    this.floatGroup.rotation.z = 0.22;
    this.twitchTimer = 0.16;
    this.twitching = true;
    this.ripplePhase = 0;
  }

  /** Fish bites — bobber pulled under. */
  startSink(): void {
    this._state = 'sinking';
    this.sinkTarget = -1.15;
    this._hideRipples();
    this.reflection.visible = false;
  }

  /** Bobber snaps back to surface (escape). */
  resurface(pos: THREE.Vector3): void {
    this._state = 'resurfacing';
    this.group.position.copy(pos);
    this.floatGroup.position.y = -0.5;
    this.floatGroup.rotation.set(0, 0, 0);
    this.reflection.visible = true;
    this.group.visible = true;
    this._hideRipples();
  }

  hide(): void {
    this._state = 'hidden';
    this.group.visible = false;
    this._hideRipples();
  }

  // ── Per-frame update ──

  update(dt: number): void {
    switch (this._state) {
      case 'hidden':
        break;

      case 'idle':
      case 'waiting': {
        if (this.twitching) {
          this.twitchTimer -= dt;
          if (this.twitchTimer <= 0) {
            this.floatGroup.position.y = 0;
            this.floatGroup.rotation.z = 0;
            this.twitching = false;
          }
        } else {
          this.bobPhase += dt * 2.2;
          this.floatGroup.position.y = Math.sin(this.bobPhase) * 0.055;
          this.floatGroup.rotation.z = Math.sin(this.bobPhase * 0.8) * 0.06;
          this.floatGroup.rotation.x = Math.cos(this.bobPhase * 0.6) * 0.04;
        }
        // Antenna sway
        this.antenna.rotation.z = Math.sin(this.bobPhase * 1.4 + 0.5) * 0.22;
        this.reflection.visible = true;
        this._updateRipples(dt);
        break;
      }

      case 'flying': {
        this.flightElapsed += dt;
        const t = Math.min(this.flightElapsed / this.flightDuration, 1);
        // Parabolic arc (reused vector, no per-frame allocation)
        this._flightPos.lerpVectors(this.flightStart, this.flightEnd, t);
        this._flightPos.y += Math.sin(t * Math.PI) * this.flightArcHeight;
        this.group.position.copy(this._flightPos);
        // Tumble while flying
        this.group.rotation.x = -0.6 + t * 1.2;
        this.group.rotation.z = Math.sin(t * Math.PI * 2) * 0.35;
        this.reflection.visible = false;
        if (t >= 1) this.land();
        break;
      }

      case 'sinking': {
        this.reflection.visible = false;
        this.floatGroup.position.y -= dt * 1.8;
        this.floatGroup.rotation.z += dt * 0.6;
        if (this.floatGroup.position.y < this.sinkTarget) {
          this.floatGroup.position.y = this.sinkTarget;
          this.group.visible = false;
        }
        break;
      }

      case 'resurfacing': {
        this.floatGroup.position.y += dt * 3;
        if (this.floatGroup.position.y >= 0) {
          this.floatGroup.position.y = 0;
          this._state = 'waiting';
          this._showRipples();
        }
        break;
      }
    }
  }

  /** Reused vector: callers copy it immediately (splash bursts / line targets). */
  getWorldPosition(): THREE.Vector3 {
    this.group.getWorldPosition(this._worldPos);
    return this._worldPos;
  }

  // ── Ripples ──

  private _showRipples(): void {
    this.ripplePhase = 0;
    this.ringGroups.forEach((ring, i) => {
      ring.visible = true;
      ring.scale.set(0.35 + i * 0.12, 1, 0.35 + i * 0.12);
      this.ringMats[i].opacity = 0.3;
    });
  }

  private _hideRipples(): void {
    this.ringGroups.forEach((ring) => {
      ring.visible = false;
    });
  }

  private _updateRipples(dt: number): void {
    this.ripplePhase += dt;
    for (let i = 0; i < this.ringGroups.length; i++) {
      const ring = this.ringGroups[i];
      if (!ring.visible) continue;
      // Each ring expands and fades on its own phase offset.
      const phase = (this.ripplePhase * 0.9 + i * 0.5) % 1;
      const scale = 0.4 + phase * 2.4;
      ring.scale.set(scale, 1, scale);
      this.ringMats[i].opacity = 0.32 * (1 - phase) * (1 - phase);
      if (phase > 0.98) ring.scale.set(0.4, 1, 0.4);
    }
  }

  dispose(): void {
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        // Geometry is shared by every bobber voxel; dispose it once below.
        if (c instanceof THREE.InstancedMesh) c.dispose();
        c.castShadow = false;
      }
    });
    this.group.clear();
    this._boxGeo.dispose();
    for (const mat of this._ownMats) mat.dispose();
    this._ownMats = [];
    this.ringGroups = [];
    this.ringMats = [];
  }
}
