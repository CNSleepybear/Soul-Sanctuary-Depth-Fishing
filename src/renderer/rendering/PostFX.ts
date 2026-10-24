// ===== src/renderer/rendering/PostFX.ts =====
// Single-pass screen-space grade for the voxel diorama.
//
// Why this exists (docs/art-direction-v2.md §3.1): the flat Lambert look read
// "washed out" no matter how the material palette was tuned. A tiny post stage
// gives the whole game one coherent film-like response:
//   - exposure / contrast / saturation / warm-cool split toning;
//   - a cheap bright-pass bloom so lanterns, neon and aurora actually glow;
//   - an alpha-masked vignette that never tints the desktop behind the window;
//   - 4x4 Bayer dithering against gradient banding.
//
// The scene is rendered into an RGBA target first, so the window's transparent
// pixels survive untouched (alpha is carried through every pass).

import * as THREE from 'three';

export interface GradeParams {
  exposure: number;
  contrast: number;
  saturation: number;
  /** -1 = cooler shadows / 0 = neutral / 1 = warmer highlights. */
  warmth: number;
  /** Lifts crushed shadows a little; keeps night scenes readable. */
  lift: number;
  bloom: number;
  bloomThreshold: number;
  vignette: number;
  dither: number;
}

export type GradeOverrides = Partial<GradeParams>;

export const DEFAULT_GRADE: GradeParams = {
  exposure: 1.07,
  contrast: 1.03,
  saturation: 1.05,
  warmth: 0.18,
  lift: 0.018,
  bloom: 0.5,
  bloomThreshold: 0.5,
  vignette: 0.13,
  dither: 0.5,
};

let currentGrade: GradeParams = { ...DEFAULT_GRADE };

/** Set the active grade. Called by BaseLocation on every location switch. */
export function setGrade(overrides?: GradeOverrides): void {
  currentGrade = { ...DEFAULT_GRADE, ...(overrides ?? {}) };
}

export function getGrade(): Readonly<GradeParams> {
  return currentGrade;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAGMENT = /* glsl */ `
  uniform sampler2D tSrc;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tSrc, vUv);
    float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float weight = smoothstep(uThreshold, uThreshold + 0.22, luma);
    gl_FragColor = vec4(c.rgb * weight, c.a * weight);
  }
`;

const BLUR_FRAGMENT = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uDirection;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(tSrc, vUv).rgb * 0.227027;
    vec2 offset1 = uDirection * 1.3846153846;
    vec2 offset2 = uDirection * 3.2307692308;
    sum += texture2D(tSrc, vUv + offset1).rgb * 0.3162162162;
    sum += texture2D(tSrc, vUv - offset1).rgb * 0.3162162162;
    sum += texture2D(tSrc, vUv + offset2).rgb * 0.0702702703;
    sum += texture2D(tSrc, vUv - offset2).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uExposure;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uWarmth;
  uniform float uLift;
  uniform float uBloom;
  uniform float uVignette;
  uniform float uDither;
  uniform float uAspect;
  varying vec2 vUv;

  float bayer4(vec2 position) {
    // 4x4 ordered dither matrix, normalised to 0..1.
    int x = int(mod(position.x, 4.0));
    int y = int(mod(position.y, 4.0));
    int index = y * 4 + x;
    float matrix[16] = float[16](
      0.0, 8.0, 2.0, 10.0,
      12.0, 4.0, 14.0, 6.0,
      3.0, 11.0, 1.0, 9.0,
      15.0, 7.0, 13.0, 5.0
    );
    return matrix[index] / 15.0;
  }

  vec3 linearToSRGB(vec3 c) {
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(high, low, step(c, vec3(0.0031308)));
  }

  void main() {
    vec4 scene = texture2D(tScene, vUv);
    // The scene target is premultiplied (it matches the transparent canvas
    // contract). Un-premultiply before grading, re-premultiply at the end.
    float alphaIn = scene.a;
    vec3 straight = alphaIn > 0.001 ? scene.rgb / alphaIn : vec3(0.0);
    // The scene target is linear-light; grade in display space where artists
    // tune colours.
    vec3 color = linearToSRGB(straight);
    vec3 bloom = linearToSRGB(texture2D(tBloom, vUv).rgb);

    color *= uExposure;
    // Split toning: cool shadows, warm highlights (or the reverse).
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadowTint = vec3(-0.026, 0.004, 0.038) * uWarmth;
    vec3 highlightTint = vec3(0.040, 0.016, -0.024) * uWarmth;
    color += mix(shadowTint, highlightTint, smoothstep(0.05, 0.75, luma));
    color += uLift * (1.0 - smoothstep(0.0, 0.45, luma)) * vec3(0.55, 0.62, 0.75);
    // Saturation + contrast around a soft pivot.
    float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(grey), color, uSaturation);
    color = (color - 0.42) * uContrast + 0.42;
    // Bloom is only added where something bright actually exists.
    color += bloom * uBloom;
    // Vignette, masked by alpha so the desktop never gets a grey halo.
    vec2 d = vUv - 0.5;
    d.x *= uAspect;
    float vignette = smoothstep(0.86, 0.28, length(d));
    color *= mix(1.0, vignette, uVignette);
    // Ordered dithering fights banding without adding noise to flat areas.
    float dither = (bayer4(gl_FragCoord.xy) - 0.5) * uDither;
    color += dither / 255.0;
    color = clamp(color, 0.0, 1.0);
    float bloomAlpha = clamp(dot(bloom, vec3(0.333)) * 0.6, 0.0, 1.0);
    float alpha = alphaIn < 0.001 ? 0.0 : clamp(alphaIn + bloomAlpha * alphaIn, 0.0, 1.0);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export class PostFX {
  private renderer: THREE.WebGLRenderer;
  private width: number;
  private height: number;

  private sceneTarget: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget;
  private bloomB: THREE.WebGLRenderTarget;

  private quadCamera: THREE.OrthographicCamera;

  private brightScene: THREE.Scene;
  private blurScene: THREE.Scene;
  private compositeScene: THREE.Scene;

  private brightMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    this.sceneTarget = this._makeTarget(this.width, this.height, false);
    this.bloomA = this._makeTarget(this._bloomWidth(), this._bloomHeight(), true);
    this.bloomB = this._makeTarget(this._bloomWidth(), this._bloomHeight(), true);

    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: this.sceneTarget.texture }, uThreshold: { value: 0.42 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: BRIGHT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.brightScene = new THREE.Scene();
    this.brightScene.add(this._makeQuad(this.brightMaterial));

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tSrc: { value: this.bloomA.texture },
        uDirection: { value: new THREE.Vector2() },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: BLUR_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.blurScene = new THREE.Scene();
    this.blurScene.add(this._makeQuad(this.blurMaterial));

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.sceneTarget.texture },
        tBloom: { value: this.bloomA.texture },
        uExposure: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uWarmth: { value: 0 },
        uLift: { value: 0 },
        uBloom: { value: 0.5 },
        uVignette: { value: 0.2 },
        uDither: { value: 0.5 },
        uAspect: { value: this.width / this.height },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeScene = new THREE.Scene();
    this.compositeScene.add(this._makeQuad(this.compositeMaterial));
  }

  private _makeQuad(material: THREE.Material): THREE.Mesh {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    return quad;
  }

  private _makeTarget(width: number, height: number, linear: boolean): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(width, height, {
      minFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
      magFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
    });
    target.texture.generateMipmaps = false;
    return target;
  }

  private _bloomWidth(): number {
    return Math.max(2, Math.floor(this.width / 4));
  }

  private _bloomHeight(): number {
    return Math.max(2, Math.floor(this.height / 4));
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.sceneTarget.setSize(this.width, this.height);
    this.bloomA.setSize(this._bloomWidth(), this._bloomHeight());
    this.bloomB.setSize(this._bloomWidth(), this._bloomHeight());
    this.compositeMaterial.uniforms.uAspect.value = this.width / this.height;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const grade = currentGrade;
    const renderer = this.renderer;
    // Cover every pass (scene + bright + 4 blur + composite) in one stats frame.
    renderer.info.reset();

    // 1. Scene → linear RGBA target (alpha preserved for the transparent window)
    renderer.setRenderTarget(this.sceneTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    // 2. Bright pass → quarter-res bloom buffer
    this.brightMaterial.uniforms.tSrc.value = this.sceneTarget.texture;
    this.brightMaterial.uniforms.uThreshold.value = grade.bloomThreshold;
    renderer.setRenderTarget(this.bloomA);
    renderer.clear(true, false, false);
    renderer.render(this.brightScene, this.quadCamera);

    // 3. Separable blur (twice, 1x quarter-res radius is enough at 400×300)
    const pixelX = 1 / this._bloomWidth();
    const pixelY = 1 / this._bloomHeight();
    let stepX = pixelX;
    let stepY = pixelY;
    for (let pass = 0; pass < 2; pass++) {
      this.blurMaterial.uniforms.tSrc.value = this.bloomA.texture;
      this.blurMaterial.uniforms.uDirection.value.set(stepX, 0);
      renderer.setRenderTarget(this.bloomB);
      renderer.render(this.blurScene, this.quadCamera);

      this.blurMaterial.uniforms.tSrc.value = this.bloomB.texture;
      this.blurMaterial.uniforms.uDirection.value.set(0, stepY);
      renderer.setRenderTarget(this.bloomA);
      renderer.render(this.blurScene, this.quadCamera);
      stepX *= 2;
      stepY *= 2;
    }

    // 4. Composite → screen
    const uniforms = this.compositeMaterial.uniforms;
    uniforms.tScene.value = this.sceneTarget.texture;
    uniforms.tBloom.value = this.bloomA.texture;
    uniforms.uExposure.value = grade.exposure;
    uniforms.uContrast.value = grade.contrast;
    uniforms.uSaturation.value = grade.saturation;
    uniforms.uWarmth.value = grade.warmth;
    uniforms.uLift.value = grade.lift;
    uniforms.uBloom.value = grade.bloom;
    uniforms.uVignette.value = grade.vignette;
    uniforms.uDither.value = grade.dither;
    renderer.setRenderTarget(null);
    renderer.render(this.compositeScene, this.quadCamera);
  }

  dispose(): void {
    this.sceneTarget.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.brightMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.brightScene.clear();
    this.blurScene.clear();
    this.compositeScene.clear();
  }
}
