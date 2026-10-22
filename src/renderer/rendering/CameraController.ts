// ===== src/renderer/rendering/CameraController.ts =====
// Orbit camera around the island center via breathing dot buttons.
// Styled to match #drag-orb and #btn-close in the drag bar.

import * as THREE from 'three';
import { CAMERA_TARGET } from './Renderer';

export class CameraController {
  private camera: THREE.OrthographicCamera;
  private target: THREE.Vector3;
  private angle = Math.PI / 4;
  private radius: number;
  private height: number;

  private btnLeft: HTMLDivElement;
  private btnRight: HTMLDivElement;

  constructor(camera: THREE.OrthographicCamera, dragBar: HTMLElement) {
    this.camera = camera;
    this.target = CAMERA_TARGET.clone();

    const dx = camera.position.x - this.target.x;
    const dz = camera.position.z - this.target.z;
    this.radius = Math.sqrt(dx * dx + dz * dz);
    this.height = camera.position.y;
    this.angle = Math.atan2(dz, dx);

    // Quiet brass controls share the journal palette.
    const dotStyle = `
      width: 18px; height: 18px;
      border-radius: 4px;
      background: rgba(31,39,36,0.88);
      border: 1px solid rgba(224,185,120,0.3); cursor: pointer;
      flex-shrink: 0;
      -webkit-app-region: no-drag;
      transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    `;

    this.btnLeft = this._makeDot('◀', dotStyle, 'Rotate left');
    this.btnRight = this._makeDot('▶', dotStyle, 'Rotate right');

    // Insert between drag-orb and btn-close
    const closeBtn = dragBar.querySelector('#btn-close');
    if (closeBtn) {
      dragBar.insertBefore(this.btnRight, closeBtn);
      dragBar.insertBefore(this.btnLeft, this.btnRight);
    } else {
      dragBar.appendChild(this.btnLeft);
      dragBar.appendChild(this.btnRight);
    }

    this._wireInput();
  }

  private _makeDot(symbol: string, baseStyle: string, title: string): HTMLDivElement {
    const dot = document.createElement('div');
    dot.style.cssText = baseStyle;
    dot.title = title;
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', title);
    dot.tabIndex = 0;
    dot.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.rotate(symbol === '◀' ? 0.15 : -0.15);
      }
    });
    // Tiny arrow overlay via text
    dot.style.display = 'flex';
    dot.style.alignItems = 'center';
    dot.style.justifyContent = 'center';
    dot.style.color = '#e0b978';
    dot.style.fontSize = '7px';
    dot.style.fontWeight = 'bold';
    dot.style.lineHeight = '1';
    dot.textContent = symbol;

    dot.addEventListener('mouseenter', () => {
      dot.style.background = 'rgba(70,77,63,0.95)';
      dot.style.color = '#efe7d6';
      dot.style.boxShadow = '0 0 8px rgba(224,185,120,0.15)';
      dot.style.transform = 'translateY(-1px)';
    });
    dot.addEventListener('mouseleave', () => {
      dot.style.background = 'rgba(31,39,36,0.88)';
      dot.style.color = '#e0b978';
      dot.style.boxShadow = '';
      dot.style.transform = 'scale(1)';
    });
    dot.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    return dot;
  }

  private _wireInput(): void {
    let holdTimer: ReturnType<typeof setInterval> | null = null;

    const start = (dir: number) => {
      this.rotate(dir * 0.08);
      holdTimer = setInterval(() => this.rotate(dir * 0.08), 50);
    };
    const stop = () => {
      if (holdTimer) {
        clearInterval(holdTimer);
        holdTimer = null;
      }
    };

    this.btnLeft.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      start(1);
    });
    this.btnLeft.addEventListener('mouseup', stop);
    this.btnLeft.addEventListener('mouseleave', stop);

    this.btnRight.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      start(-1);
    });
    this.btnRight.addEventListener('mouseup', stop);
    this.btnRight.addEventListener('mouseleave', stop);
  }

  // POLISH-2: Gentle camera bob for scene "breathing" feel
  private _bobTime = 0;

  /** Per-frame auto-rotate + subtle breathing bob. */
  update(dt: number): void {
    this.angle += dt * 0.028; // A quiet orbit keeps the desktop diorama restful.
    this._bobTime += dt;
    // Subtle height oscillation: ±0.12 units over ~6 seconds
    const bobOffset = Math.sin(this._bobTime * 1.05) * 0.12;
    this._updateCamera(bobOffset);
  }

  rotate(step: number): void {
    this.angle += step;
    this._updateCamera();
  }

  private _updateCamera(bobOffset = 0): void {
    const x = this.target.x + this.radius * Math.cos(this.angle);
    const z = this.target.z + this.radius * Math.sin(this.angle);
    this.camera.position.set(x, this.height + bobOffset, z);
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.btnLeft.remove();
    this.btnRight.remove();
  }
}
