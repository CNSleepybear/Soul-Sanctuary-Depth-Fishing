// ===== src/renderer/rendering/Renderer.ts =====
// Three.js renderer: 400×300 internal, orthographic camera, flat shading.

import * as THREE from 'three';
import { RENDER_WIDTH, RENDER_HEIGHT } from '../../shared/constants';
import { logger } from '../../shared/logger';

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  static INTERNAL_W = RENDER_WIDTH;
  static INTERNAL_H = RENDER_HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const viewSize = 9;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect,
      viewSize * aspect,
      viewSize,
      -viewSize,
      1,
      1000,
    );
    this.camera.position.set(13, 10, 13);
    this.camera.lookAt(0, 1.2, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // REF-4: disable AA to keep voxel edges crisp
      alpha: true, // Transparent background
    });
    // RENDER-PERF: cap pixel ratio to avoid 4K displays blowing up the drawing buffer
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
    this.renderer.setClearColor(0x000000, 0); // Fully transparent clear
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // REF-3: softer shadows like reference

    this.scene = new THREE.Scene();
    this.scene.background = null; // Desktop widget: transparent background
    this.scene.fog = new THREE.FogExp2(0x0a0a12, 0.008); // UX-3: lighter fog for clearer, brighter scenes
  }

  getScene(): THREE.Scene {
    return this.scene;
  }
  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  setBackgroundColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number): void {
    GameRenderer.INTERNAL_W = w;
    GameRenderer.INTERNAL_H = h;
    // RENDER-PERF: re-apply capped pixel ratio when resolution changes
    const pixelRatio = Math.min(window.devicePixelRatio, w <= 400 ? 1 : 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    // false = don't set CSS size, let canvas CSS 100% handle it
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewSize = 9;
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
    logger.debug(
      '[Renderer] resize:',
      w,
      'x',
      h,
      'drawingBuffer:',
      this.renderer.domElement.width,
      'x',
      this.renderer.domElement.height,
      'inner:',
      window.innerWidth,
      'x',
      window.innerHeight,
    );
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
