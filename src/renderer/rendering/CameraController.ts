// ===== src/renderer/rendering/CameraController.ts =====
// Orbit camera around the island center via breathing dot buttons.
// Styled to match #drag-orb and #btn-close in the drag bar.

import * as THREE from 'three';

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
    this.target = new THREE.Vector3(0, 1.2, 0);

    const dx = camera.position.x - this.target.x;
    const dz = camera.position.z - this.target.z;
    this.radius = Math.sqrt(dx * dx + dz * dz);
    this.height = camera.position.y;
    this.angle = Math.atan2(dz, dx);

    // ── Inject breathing animation CSS ──
    const styleId = 'camera-rotate-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes breathe-cyan {
          0%, 100% { box-shadow: 0 0 4px 1px rgba(100,200,255,0.25); }
          50%      { box-shadow: 0 0 10px 3px rgba(100,200,255,0.50); }
        }
      `;
      document.head.appendChild(style);
    }

    // ── Build dots matching drag-bar orb style ──
    const dotStyle = `
      width: 10px; height: 10px;
      border-radius: 50%;
      background: rgba(100,200,255,0.40);
      border: none; cursor: pointer;
      flex-shrink: 0;
      -webkit-app-region: no-drag;
      transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
      animation: breathe-cyan 3.5s ease-in-out infinite;
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
    // Tiny arrow overlay via text
    dot.style.display = 'flex';
    dot.style.alignItems = 'center';
    dot.style.justifyContent = 'center';
    dot.style.color = 'rgba(255,255,255,0.65)';
    dot.style.fontSize = '7px';
    dot.style.fontWeight = 'bold';
    dot.style.lineHeight = '1';
    dot.textContent = symbol;

    dot.addEventListener('mouseenter', () => {
      dot.style.background = 'rgba(100,200,255,0.80)';
      dot.style.color = 'rgba(255,255,255,1)';
      dot.style.boxShadow = '0 0 14px 4px rgba(100,200,255,0.7)';
      dot.style.transform = 'scale(1.3)';
    });
    dot.addEventListener('mouseleave', () => {
      dot.style.background = 'rgba(100,200,255,0.40)';
      dot.style.color = 'rgba(255,255,255,0.65)';
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
    this.angle += dt * 0.15; // slightly faster for noticeable rotation
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
