// ===== src/renderer/rendering/FishingLine.ts =====
// Curved fishing line — multiple small segments along a quadratic bezier.
// Rod tip → sag control point → target. Sag decreases with tension.

import * as THREE from 'three';

const SEGMENTS = 10;
const MAX_SAG = 1.5; // maximum downward droop when slack

export class FishingLine {
  readonly group: THREE.Group;
  private segments: THREE.Mesh[] = [];
  private rodTip = new THREE.Vector3();
  private target = new THREE.Vector3();
  private _tension = 0; // 0-100
  private _visible = false;

  constructor() {
    this.group = new THREE.Group();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x88cc88,
      transparent: true,
      opacity: 0.65,
      depthWrite: true,
    });

    for (let i = 0; i < SEGMENTS; i++) {
      // REF-4: thicker line segments for visibility at 400x300
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), mat);
      seg.visible = false;
      this.segments.push(seg);
      this.group.add(seg);
    }
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
    this.segments.forEach((s) => (s.visible = true));
  }

  hide(): void {
    this._visible = false;
    this.segments.forEach((s) => (s.visible = false));
  }

  update(): void {
    if (!this._visible) return;

    const start = this.rodTip;
    const end = this.target;
    const dist = start.distanceTo(end);

    if (dist < 0.05) {
      this.segments.forEach((s) => (s.visible = false));
      return;
    }

    // Quadratic bezier: P0=start, P1=midpoint+sag, P2=end
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    // Sag decreases as tension increases
    const sagAmount = MAX_SAG * (1 - this._tension / 100);
    const control = mid.clone();
    control.y -= sagAmount;

    // Color based on tension
    const mat = this.segments[0].material as THREE.MeshBasicMaterial;
    if (this._tension > 75) mat.color.setHex(0xff4444);
    else if (this._tension > 40) mat.color.setHex(0xffcc00);
    else mat.color.setHex(0x44dd88);

    // Place segments along bezier
    for (let i = 0; i < SEGMENTS; i++) {
      const t = (i + 0.5) / SEGMENTS;
      const u = 1 - t;

      // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const bx = u * u * start.x + 2 * u * t * control.x + t * t * end.x;
      const by = u * u * start.y + 2 * u * t * control.y + t * t * end.y;
      const bz = u * u * start.z + 2 * u * t * control.z + t * t * end.z;

      const seg = this.segments[i];
      seg.position.set(bx, by, bz);
      seg.visible = true;

      // Scale segment to cover its portion of the curve
      const segLen = dist / SEGMENTS;
      seg.scale.y = segLen / 0.05;

      // Orient toward next point
      const tNext = (i + 1.5) / SEGMENTS;
      const uNext = 1 - tNext;
      const nx = uNext * uNext * start.x + 2 * uNext * tNext * control.x + tNext * tNext * end.x;
      const ny = uNext * uNext * start.y + 2 * uNext * tNext * control.y + tNext * tNext * end.y;
      const nz = uNext * uNext * start.z + 2 * uNext * tNext * control.z + tNext * tNext * end.z;

      const dir = new THREE.Vector3(nx - bx, ny - by, nz - bz).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      seg.setRotationFromQuaternion(quat);
    }
  }

  dispose(): void {
    this.segments.forEach((s) => {
      s.geometry.dispose();
    });
    (this.segments[0]?.material as THREE.Material)?.dispose();
    this.group.clear();
  }
}
