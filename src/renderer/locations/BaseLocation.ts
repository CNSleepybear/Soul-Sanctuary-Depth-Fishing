// ===== src/renderer/locations/BaseLocation.ts =====
// Abstract base for all 12 sanctuary scene builders.

import * as THREE from 'three';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { MaterialCache } from '../rendering/MaterialCache';
import type { LocationData } from '../../shared/types';

export abstract class BaseLocation {
  abstract readonly id: string;
  abstract readonly data: LocationData;

  protected scene: THREE.Scene;
  protected group: THREE.Group;
  protected particles: ParticleSystem | null = null;

  // REF-1: Reference-inspired 4-light system + fog
  protected ambientLight: THREE.AmbientLight | null = null;
  protected moonLight: THREE.DirectionalLight | null = null;
  protected rimLight: THREE.DirectionalLight | null = null;
  protected waterGlow: THREE.PointLight | null = null;
  protected bottomLight: THREE.HemisphereLight | null = null;
  protected silhouetteGroup: THREE.Group | null = null;

  // Soul sanctuary ambience
  private soulAwakenTimer: ReturnType<typeof setTimeout> | null = null;
  private originalLightIntensities = new Map<THREE.Light, number>();
  private originalLightColors = new Map<THREE.Light, THREE.Color>();
  private originalParticleColor: number | null = null;
  private originalBackground: THREE.Color | null | undefined = undefined;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
  }

  /** Build all meshes and add to scene. Called once on location switch. */
  build(): void {
    const t = this.data.theme;
    // REF-4/5: per-location art theme overrides; fallback to legacy hardcoded values
    // Brighten ambient so the island doesn't sink into dark desktops
    const ambientColor = new THREE.Color(t?.ambient ?? 0x1a1a3a).multiplyScalar(1.6);
    this.ambientLight = new THREE.AmbientLight(ambientColor, (t?.ambientIntensity ?? 1.2) * 1.15);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(t?.moon ?? 0x8899cc, t?.moonIntensity ?? 1.0);
    this.moonLight.position.set(6, 18, 6);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.width = 512;
    this.moonLight.shadow.mapSize.height = 512;
    this.scene.add(this.moonLight);

    this.rimLight = new THREE.DirectionalLight(t?.rim ?? 0x8866cc, t?.rimIntensity ?? 0.4);
    this.rimLight.position.set(-8, 4, -8);
    this.scene.add(this.rimLight);

    this.waterGlow = new THREE.PointLight(
      t?.waterGlow ?? 0x66ccff,
      t?.waterGlowIntensity ?? 2.0,
      10,
    );
    this.waterGlow.position.set(0, -1, 0);
    this.scene.add(this.waterGlow);

    // REF-5: warm bottom hemisphere light — eliminates black-hole underside of island
    this.bottomLight = new THREE.HemisphereLight(
      new THREE.Color(t?.moon ?? 0x8899cc).multiplyScalar(0.8),
      new THREE.Color(0xffddaa),
      0.8,
    );
    this.scene.add(this.bottomLight);

    // REF-4: fog color/density from theme
    this.scene.fog = new THREE.FogExp2(t?.fog ?? 0x0a0a12, t?.fogDensity ?? 0.008);

    // Atmosphere: some locations (e.g. Iceland) need a dark sky for additive effects
    this.originalBackground = this.scene.background as THREE.Color | null;
    if (t?.bgColor !== undefined) {
      this.scene.background = new THREE.Color(t.bgColor);
    }

    // Particles (common to all locations)
    this.originalParticleColor = this.data.particleColor;
    this.particles = new ParticleSystem({
      count: 80,
      type: this.data.particleType,
      color: this.data.particleColor,
      spreadRadius: 8,
      heightRange: 10,
    });
    this.scene.add(this.particles.getGroup());

    // Call subclass-specific build
    this.buildGeometry();

    // Atmosphere hook for location-specific ambient effects
    this.buildAtmosphere();

    // REF-4: subtle distant haze layer for depth
    this._addDistantHazeLayer();
  }

  /** REF-4: create a theme-aware floating island. */
  protected createIsland(): FloatingIsland {
    return new FloatingIsland(this.data.theme?.island);
  }

  /** Override in subclass to add location-specific 3D meshes. */
  protected abstract buildGeometry(): void;

  /** Optional hook for atmosphere effects (particles, lights, shimmer). */
  protected buildAtmosphere(): void {}

  /** Optional per-frame hook for atmosphere animation. */
  protected updateAtmosphere(_dt: number, _time: number): void {}

  /** REF-4: add a very faint, low haze layer far behind the island. */
  private _addDistantHazeLayer(): void {
    const fogHex = this.data.theme?.fog ?? 0x0a0a12;
    const color = new THREE.Color(fogHex);
    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      flatShading: true,
      depthWrite: false,
    });
    const group = new THREE.Group();
    const seed = this.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const rng = (i: number) => {
      const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 8; i++) {
      const h = 0.1 + rng(i) * 0.3;
      const w = 0.3 + rng(i + 100) * 0.6;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), mat);
      mesh.position.set((rng(i + 200) - 0.5) * 22, h / 2 - 0.3, -10 - rng(i + 300) * 3);
      group.add(mesh);
    }
    this.scene.add(group);
    this.silhouetteGroup = group;
  }

  /** Store original light params before applying soul overrides. */
  private _storeOriginalLights(): void {
    const lights = [
      this.ambientLight,
      this.moonLight,
      this.rimLight,
      this.waterGlow,
      this.bottomLight,
    ];
    for (const light of lights) {
      if (!light) continue;
      if (!this.originalLightIntensities.has(light)) {
        this.originalLightIntensities.set(light, light.intensity);
      }
      if (!this.originalLightColors.has(light)) {
        this.originalLightColors.set(light, light.color.clone());
      }
    }
  }

  /** Temporarily bathe the sanctuary in golden light when a mythic soul is caught. */
  applySoulAwakening(): void {
    if (this.soulAwakenTimer) {
      clearTimeout(this.soulAwakenTimer);
      this.soulAwakenTimer = null;
    }
    this._storeOriginalLights();

    const atm = this.data.theme?.atmosphere;
    const soulGold = new THREE.Color(atm?.soulColor ?? 0xffd700);
    const warmAmber = new THREE.Color(atm?.soulColor ?? 0xffaa55);

    if (this.ambientLight) {
      this.ambientLight.color.copy(soulGold);
      this.ambientLight.intensity = this.originalLightIntensities.get(this.ambientLight)! * 1.4;
    }
    if (this.moonLight) {
      this.moonLight.color.copy(warmAmber);
      this.moonLight.intensity = this.originalLightIntensities.get(this.moonLight)! * 1.5;
    }
    if (this.rimLight) {
      this.rimLight.color.copy(soulGold);
      this.rimLight.intensity = this.originalLightIntensities.get(this.rimLight)! * 1.8;
    }
    if (this.waterGlow) {
      this.waterGlow.color.copy(soulGold);
      this.waterGlow.intensity = this.originalLightIntensities.get(this.waterGlow)! * 1.6;
    }

    // Swap particles to a golden rising burst
    if (this.particles) {
      this.scene.remove(this.particles.getGroup());
      this.particles.dispose();
      this.particles = new ParticleSystem({
        count: 120,
        type: 'rise',
        color: 0xffd700,
        spreadRadius: 8,
        heightRange: 10,
        driftType: 'sine',
      });
      this.scene.add(this.particles.getGroup());
    }

    this.soulAwakenTimer = setTimeout(() => this.clearSoulAwakening(), 5000);
  }

  /** Revert temporary soul awakening, keeping persistent ambience if any. */
  clearSoulAwakening(): void {
    if (this.soulAwakenTimer) {
      clearTimeout(this.soulAwakenTimer);
      this.soulAwakenTimer = null;
    }
    for (const [light, intensity] of this.originalLightIntensities) {
      light.intensity = intensity;
    }
    for (const [light, color] of this.originalLightColors) {
      light.color.copy(color);
    }
    this._restoreBaseParticles();
  }

  /** Apply persistent ambience based on number of mythic souls collected here. */
  applySoulAmbience(soulCount: number): void {
    if (soulCount <= 0) return;
    this._storeOriginalLights();

    const atm = this.data.theme?.atmosphere;
    const soulColorHex = atm?.soulColor ?? 0xffcc88;
    const warmth = new THREE.Color(soulColorHex);
    const maxBoost = atm?.maxSoulBoost ?? 0.35;
    const intensityBoost = 1 + Math.min(soulCount * 0.08, maxBoost);

    if (this.ambientLight) {
      this.ambientLight.color.lerp(warmth, 0.15);
      this.ambientLight.intensity =
        this.originalLightIntensities.get(this.ambientLight)! * intensityBoost;
    }
    if (this.moonLight) {
      this.moonLight.color.lerp(warmth, 0.12);
      this.moonLight.intensity =
        this.originalLightIntensities.get(this.moonLight)! * intensityBoost;
    }
    if (this.waterGlow) {
      this.waterGlow.color.lerp(new THREE.Color(soulColorHex), 0.2);
      this.waterGlow.intensity =
        this.originalLightIntensities.get(this.waterGlow)! * intensityBoost;
    }

    // Denser, slightly warmer particles
    if (this.particles) {
      this.scene.remove(this.particles.getGroup());
      this.particles.dispose();
      const particlesPerSoul = atm?.particlesPerSoul ?? 12;
      this.particles = new ParticleSystem({
        count: 80 + soulCount * particlesPerSoul,
        type: this.data.particleType,
        color: this.originalParticleColor ?? this.data.particleColor,
        spreadRadius: 8,
        heightRange: 10,
      });
      this.scene.add(this.particles.getGroup());
    }
  }

  private _restoreBaseParticles(): void {
    if (!this.particles) return;
    this.scene.remove(this.particles.getGroup());
    this.particles.dispose();
    this.particles = new ParticleSystem({
      count: 80,
      type: this.data.particleType,
      color: this.originalParticleColor ?? this.data.particleColor,
      spreadRadius: 8,
      heightRange: 10,
    });
    this.scene.add(this.particles.getGroup());
  }

  /** Called every frame for animations. */
  update(dt: number, time: number): void {
    this.particles?.update(dt, time);
    this.updateAtmosphere(dt, time);
  }

  /** Clean up when switching locations. */
  destroy(): void {
    if (this.soulAwakenTimer) {
      clearTimeout(this.soulAwakenTimer);
      this.soulAwakenTimer = null;
    }
    this.originalLightIntensities.clear();
    this.originalLightColors.clear();
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.moonLight) {
      this.scene.remove(this.moonLight);
      this.moonLight = null;
    }
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight = null;
    }
    if (this.waterGlow) {
      this.scene.remove(this.waterGlow);
      this.waterGlow = null;
    }
    if (this.bottomLight) {
      this.scene.remove(this.bottomLight);
      this.bottomLight = null;
    }
    if (this.particles) {
      this.scene.remove(this.particles.getGroup());
      this.particles.dispose();
      this.particles = null;
    }
    if (this.silhouetteGroup) {
      this.scene.remove(this.silhouetteGroup);
      this.silhouetteGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      this.silhouetteGroup = null;
    }
    // Restore original background if changed
    this.scene.background = this.originalBackground ?? null;

    this.scene.remove(this.group);
    // Dispose all children. Geometries are always local to a location; materials
    // may come from MaterialCache and must not be disposed if shared.
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            if (!MaterialCache.isCached(m)) m.dispose();
          });
        } else if (child.material && !MaterialCache.isCached(child.material)) {
          child.material.dispose();
        }
      }
    });
    this.group.clear();
  }
}
