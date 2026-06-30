// ===== src/renderer/rendering/Bobber.ts =====
// 3D voxel bobber — idle bob, cast flight arc, waiting ripple, bite sink.
// Built from BoxGeometry blocks: red-white float + stick + small flag.

import * as THREE from 'three';

export type BobberState = 'hidden' | 'idle' | 'flying' | 'waiting' | 'sinking' | 'resurfacing';

export class Bobber {
  readonly group: THREE.Group;
  private floatBody: THREE.Group;
  private stick: THREE.Mesh;
  private flag: THREE.Mesh;
  private rippleRings: THREE.Mesh[] = [];

  private _state: BobberState = 'hidden';
  private bobPhase = 0;
  private ripplePhase = 0;

  // Flight arc
  private flightStart = new THREE.Vector3();
  private flightEnd = new THREE.Vector3();
  private flightDuration = 0.6;
  private flightElapsed = 0;
  private flightArcHeight = 3;

  // Sink
  private sinkTarget = 0;
  private sinkElapsed = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // ── Float body (red top, white bottom) ──
    this.floatBody = new THREE.Group();

    const redMat = new THREE.MeshLambertMaterial({ color: 0xff2222, flatShading: true });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const stickMat = new THREE.MeshLambertMaterial({ color: 0x886644, flatShading: true });
    const flagMat = new THREE.MeshLambertMaterial({ color: 0xffcc00, flatShading: true });

    // Top half (red)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), redMat);
    top.position.y = 0.12;
    this.floatBody.add(top);

    // Bottom half (white)
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.18), whiteMat);
    bottom.position.y = -0.05;
    this.floatBody.add(bottom);

    // Sphere approximation for rounder look
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), redMat);
    corner.position.set(0, 0.2, 0.08);
    this.floatBody.add(corner);
    const corner2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), redMat);
    corner2.position.set(0, 0.2, -0.08);
    this.floatBody.add(corner2);

    this.group.add(this.floatBody);

    // ── Stick ──
    this.stick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04), stickMat);
    this.stick.position.y = 0.4;
    this.group.add(this.stick);

    // ── Flag ──
    this.flag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.02), flagMat);
    this.flag.position.set(0.08, 0.65, 0);
    this.group.add(this.flag);

    // ── Ripple rings (for waiting) ──
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 16), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.rippleRings.push(ring);
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
    this.floatBody.position.y = 0;
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
    this._hideRipples();
  }

  /** Land in water — begin waiting bob. */
  land(): void {
    this._state = 'waiting';
    this.group.position.copy(this.flightEnd);
    this.floatBody.position.y = 0;
    this.bobPhase = 0;
    this.ripplePhase = 0;
    this._showRipples();
  }

  private twitchTimer = 0;
  private twitching = false;

  /** Quick twitch (nibble) — frame-based, no setTimeout. */
  twitch(): void {
    if (this._state !== 'waiting') return;
    this.floatBody.position.y = -0.15;
    this.twitchTimer = 0.15;
    this.twitching = true;
  }

  /** Fish bites — bobber pulled under. */
  startSink(): void {
    this._state = 'sinking';
    this.sinkTarget = -1.5;
    this.sinkElapsed = 0;
    this._hideRipples();
  }

  /** Bobber snaps back to surface (escape). */
  resurface(pos: THREE.Vector3): void {
    this._state = 'resurfacing';
    this.group.position.copy(pos);
    this.floatBody.position.y = -0.5;
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
        // Twitch recovery
        if (this.twitching) {
          this.twitchTimer -= dt;
          if (this.twitchTimer <= 0) {
            this.floatBody.position.y = 0;
            this.twitching = false;
          }
        } else {
          // Gentle bobbing
          this.bobPhase += dt * 2.5;
          this.floatBody.position.y = Math.sin(this.bobPhase) * 0.08;
        }
        // Flag sway
        this.flag.rotation.z = Math.sin(this.bobPhase * 0.7) * 0.15;
        // Ripple animation
        this.ripplePhase += dt;
        this._updateRipples();
        break;
      }

      case 'flying': {
        this.flightElapsed += dt;
        const t = Math.min(this.flightElapsed / this.flightDuration, 1);
        // Parabolic arc
        const pos = new THREE.Vector3().lerpVectors(this.flightStart, this.flightEnd, t);
        pos.y += Math.sin(t * Math.PI) * this.flightArcHeight;
        this.group.position.copy(pos);
        // Tilt bobber during flight
        this.group.rotation.x = -0.5 + t * 0.5;
        if (t >= 1) this.land();
        break;
      }

      case 'sinking': {
        this.sinkElapsed += dt;
        this.floatBody.position.y -= dt * 2.5;
        if (this.floatBody.position.y < this.sinkTarget) {
          this.floatBody.position.y = this.sinkTarget;
          this.group.visible = false;
        }
        break;
      }

      case 'resurfacing': {
        this.floatBody.position.y += dt * 3;
        if (this.floatBody.position.y >= 0) {
          this.floatBody.position.y = 0;
          this._state = 'waiting';
          this._showRipples();
        }
        break;
      }
    }
  }

  getWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.group.getWorldPosition(pos);
    return pos;
  }

  // ── Ripples ──

  private _showRipples(): void {
    this.rippleRings.forEach((r) => {
      r.visible = true;
      r.scale.set(0.5, 0.5, 0.5);
    });
    this.ripplePhase = 0;
  }

  private _hideRipples(): void {
    this.rippleRings.forEach((r) => {
      r.visible = false;
    });
  }

  private _updateRipples(): void {
    const t = this.ripplePhase;
    this.rippleRings.forEach((ring, i) => {
      const offset = i * 1.2;
      const phase = (t + offset) % 3.6;
      const s = 0.3 + (phase / 3.6) * 2.5;
      ring.scale.set(s, s, s);
      const opacity = Math.max(0, 0.3 * (1 - phase / 3.6));
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
    });
  }

  dispose(): void {
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material.dispose();
      }
    });
    this.group.clear();
  }
}
