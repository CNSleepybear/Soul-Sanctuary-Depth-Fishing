// ===== src/renderer/rendering/FishingLine.ts =====
// Curved fishing line — twelve small box segments along a quadratic bezier.
// Rod tip → sag/wind control point → target. Sag decreases with tension, and
// the line colour shifts green → yellow → red as tension rises.
//
// ART V2 (docs/art-direction-v2.md §2.4 / §3.2):
// - every segment is a scaled instance of one shared unit BoxGeometry;
// - update() is allocation-free (all vectors/quaternions are preallocated), so
//   the per-frame fishing update produces zero GC;
// - a slack line keeps a gentle droop plus a slow wind sway, a taut line pulls
//   nearly straight and turns coral red.

import * as THREE from 'three';

const SEGMENTS = 12;
const MAX_SAG = 1.0;
// 0.0625 = 1px at 400×300: the thinnest line that stays visible per art spec.
const LINE_THICKNESS = 0.0625;

const COLOR_SLACK = 0xc1d6b2; // pale sage — safe
const COLOR_MID = 0xe5c681; // brass — careful
const COLOR_TAUT = 0xe48f7e; // coral — danger

export class FishingLine {
  readonly group: THREE.Group;
  private mat: THREE.MeshBasicMaterial;
  private geometry: THREE.BoxGeometry;
  private mesh: THREE.InstancedMesh;

  private rodTip = new THREE.Vector3();
  private target = new THREE.Vector3();
  private _tension = 0; // 0-100
  private _visible = false;

  // Reused temporaries (zero per-frame allocation).
  private _control = new THREE.Vector3();
  private _mid = new THREE.Vector3();
  private _p = new THREE.Vector3();
  private _pNext = new THREE.Vector3();
  private _dir = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 1, 0);
  private _quat = new THREE.Quaternion();
  private _scale = new THREE.Vector3();
  private _matrix = new THREE.Matrix4();
  private _color = new THREE.Color();
  private _green = new THREE.Color(COLOR_SLACK);
  private _yellow = new THREE.Color(COLOR_MID);
  private _red = new THREE.Color(COLOR_TAUT);
  private _elapsed = 0;

  constructor() {
    this.group = new THREE.Group();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({
      color: COLOR_SLACK,
      transparent: true,
      opacity: 0.72,
      depthWrite: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.mat, SEGMENTS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  setRodTip(pos: THREE.Vector3): void {
    this.rodTip.copy(pos);
  }

  setTarget(pos: THREE.Vector3): void {
    this.target.copy(pos);
  }

  setTension(t: number): void {
    this._tension = Math.max(0, Math.min(100, t));
  }

  show(): void {
    this._visible = true;
    this.mesh.visible = true;
  }

  hide(): void {
    this._visible = false;
    this.mesh.visible = false;
  }

  update(): void {
    if (!this._visible) return;

    this.mesh.visible = true;
    const start = this.rodTip;
    const end = this.target;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < 0.0025) {
      this.mesh.visible = false;
      return;
    }

    this._elapsed += 1 / 60;

    // Quadratic bezier control: midpoint + slack droop + slow wind drift.
    const slack = 1 - this._tension / 100;
    const sag = MAX_SAG * slack;
    const wind = 0.22 * slack * Math.sin(this._elapsed * 0.9 + 0.4);
    this._control.set(
      (start.x + end.x) * 0.5 + wind,
      (start.y + end.y) * 0.5 - sag,
      (start.z + end.z) * 0.5 + wind * 0.6,
    );

    // Tension colour: green → yellow → coral, smoothly interpolated.
    if (this._tension <= 50) {
      this._color.lerpColors(this._green, this._yellow, this._tension / 50);
    } else {
      this._color.lerpColors(this._yellow, this._red, (this._tension - 50) / 50);
    }
    this.mat.color.copy(this._color);
    this.mat.opacity = 0.6 + slack * 0.18;

    const step = 1 / SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) {
      const t0 = i * step;
      const t1 = (i + 1) * step;
      this._bezier(t0, this._p);
      this._bezier(t1, this._pNext);

      this._dir.subVectors(this._pNext, this._p);
      const len = this._dir.length();
      if (len < 1e-5) {
        this._matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._matrix);
        continue;
      }
      this._dir.multiplyScalar(1 / len);
      this._quat.setFromUnitVectors(this._up, this._dir);

      this._mid.addVectors(this._p, this._pNext).multiplyScalar(0.5);
      this._scale.set(LINE_THICKNESS, len * 1.02, LINE_THICKNESS);
      this._matrix.compose(this._mid, this._quat, this._scale);
      this.mesh.setMatrixAt(i, this._matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Evaluate the bezier at t into `out` (no allocation). */
  private _bezier(t: number, out: THREE.Vector3): void {
    const u = 1 - t;
    const start = this.rodTip;
    const control = this._control;
    const end = this.target;
    out.set(
      u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      u * u * start.z + 2 * u * t * control.z + t * t * end.z,
    );
  }

  dispose(): void {
    this.group.clear();
    this.mesh.dispose();
    this.geometry.dispose();
    this.mat.dispose();
  }
}
