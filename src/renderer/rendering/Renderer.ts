// ===== src/renderer/rendering/Renderer.ts =====
// Three.js renderer: internal buffer = window size, orthographic diorama camera,
// flat shading and a tiny post grade (see PostFX.ts).

import * as THREE from 'three';
import { RENDER_WIDTH, RENDER_HEIGHT } from '../../shared/constants';
import { logger } from '../../shared/logger';
import { PostFX } from './PostFX';

/** Vertical half-extent of the orthographic frustum (world units). */
export const CAMERA_VIEW_SIZE = 8.4;
/** Point the camera at chest height so the island sits in the lower 2/3. */
export const CAMERA_TARGET = new THREE.Vector3(0, 1.6, 0);
/** Key camera offset; the controller orbits around CAMERA_TARGET. */
export const CAMERA_OFFSET = new THREE.Vector3(13, 12, 13);

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private postfx: PostFX;

  static INTERNAL_W = RENDER_WIDTH;
  static INTERNAL_H = RENDER_HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    const aspect = canvas.clientWidth / canvas.clientHeight || RENDER_WIDTH / RENDER_HEIGHT;
    this.camera = new THREE.OrthographicCamera(
      -CAMERA_VIEW_SIZE * aspect,
      CAMERA_VIEW_SIZE * aspect,
      CAMERA_VIEW_SIZE,
      -CAMERA_VIEW_SIZE,
      1,
      1000,
    );
    this.camera.position.copy(CAMERA_OFFSET);
    this.camera.lookAt(CAMERA_TARGET);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // REF-4: disable AA to keep voxel edges crisp
      alpha: true, // Transparent background
      powerPreference: 'high-performance',
    });
    // RENDER-PERF: cap pixel ratio to avoid 4K displays blowing up the drawing buffer
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
    this.renderer.setClearColor(0x000000, 0); // Fully transparent clear
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // REF-3: softer shadows like reference
    // Stats are reset once per frame inside PostFX so they cover every pass.
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.scene.background = null; // Desktop widget: transparent background
    this.scene.fog = new THREE.FogExp2(0x0a0a12, 0.006); // light depth haze

    this.postfx = new PostFX(this.renderer, RENDER_WIDTH, RENDER_HEIGHT);
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

  /** Draw-call / triangle budget probe (used by the art review harness). */
  getStats(): { calls: number; triangles: number; geometries: number; textures: number } {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  render(): void {
    this.postfx.render(this.scene, this.camera);
  }

  resize(w: number, h: number): void {
    GameRenderer.INTERNAL_W = w;
    GameRenderer.INTERNAL_H = h;
    // RENDER-PERF: re-apply capped pixel ratio when resolution changes
    this.renderer.setPixelRatio(1);
    // false = don't set CSS size, let canvas CSS 100% handle it
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -CAMERA_VIEW_SIZE * aspect;
    this.camera.right = CAMERA_VIEW_SIZE * aspect;
    this.camera.top = CAMERA_VIEW_SIZE;
    this.camera.bottom = -CAMERA_VIEW_SIZE;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(w, h);
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
    this.postfx.dispose();
    this.renderer.dispose();
  }
}
