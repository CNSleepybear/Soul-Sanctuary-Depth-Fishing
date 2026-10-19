// ===== src/renderer/locations/BaseLocation.ts =====
// Abstract base for all 12 sanctuary scene builders.
//
// v2 art pass responsibilities (docs/art-direction-v2.md §4):
// - lighting rig: low ambient, a warm/cool key with tight soft shadows, a rim
//   light, a water glow and a warm hemisphere bounce (always exactly 5 lights);
// - a 360° far silhouette ring so every camera angle has a background;
// - a shared voxel water body, shoreline detail scatter and a soft ground
//   shadow under the island;
// - a per-location post grade applied through `setGrade()`.
//
// Subclasses keep owning their landmark geometry via `buildGeometry()` and
// their signature atmosphere via `buildAtmosphere()` / `updateAtmosphere()`.

import * as THREE from 'three';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { MaterialCache } from '../rendering/MaterialCache';
import { SanctuaryWater } from '../rendering/SanctuaryWater';
import { SanctuaryDetails } from '../rendering/SanctuaryDetails';
import { setGrade } from '../rendering/PostFX';
import {
  buildCloud,
  buildGroundShadow,
  buildInstancedVoxels,
  buildMist,
  createRng,
  hashSeed,
  mixHex,
  shade,
  updateMist,
  type InstancedVoxel,
} from '../rendering/ArtKit';
import type { LocationArtTheme, LocationData } from '../../shared/types';

export abstract class BaseLocation {
  abstract readonly id: string;
  abstract get data(): LocationData;

  protected scene: THREE.Scene;
  protected group: THREE.Group;
  protected particles: ParticleSystem | null = null;

  // REF-1: Reference-inspired 5-light rig + fog
  protected ambientLight: THREE.AmbientLight | null = null;
  protected moonLight: THREE.DirectionalLight | null = null;
  protected rimLight: THREE.DirectionalLight | null = null;
  protected waterGlow: THREE.PointLight | null = null;
  protected bottomLight: THREE.HemisphereLight | null = null;
  protected silhouetteGroup: THREE.Group | null = null;
  protected island: FloatingIsland | null = null;
  protected farLayer: THREE.Group | null = null;
  private skyClouds: THREE.Group | null = null;
  private mistGroup: THREE.Group | null = null;
  private sanctuaryWater: SanctuaryWater | null = null;
  private baseParticleCount = 90;

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

  /** The v2 art-direction block for this location (never undefined). */
  protected get art(): LocationArtTheme {
    return this.data.theme?.art ?? {};
  }

  /** Build all meshes and add to scene. Called once on location switch. */
  build(): void {
    const theme = this.data.theme;
    const art = this.art;

    // ── Ambient light: low, colour-lifted, never grey ──
    const shadowColor = art.shadow ?? theme?.ambient ?? 0x454b68;
    const ambientIntensity = Math.min(0.85, 0.5 + ((theme?.ambientIntensity ?? 2) - 2) * 0.1);
    this.ambientLight = new THREE.AmbientLight(shadowColor, ambientIntensity);
    this.scene.add(this.ambientLight);

    const keyColor = art.key ?? theme?.moon ?? 0x99b8d3;
    const keyIntensity = art.keyIntensity ?? (theme?.moonIntensity ?? 1) * 1.7;
    this.moonLight = new THREE.DirectionalLight(keyColor, keyIntensity);
    this.moonLight.position.set(9, 15, 8);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.width = 1024;
    this.moonLight.shadow.mapSize.height = 1024;
    Object.assign(this.moonLight.shadow.camera, {
      left: -11,
      right: 11,
      top: 11,
      bottom: -11,
      near: 1,
      far: 50,
    });
    this.moonLight.shadow.normalBias = 0.045;
    this.moonLight.shadow.bias = -0.0004;
    this.moonLight.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.moonLight);

    this.rimLight = new THREE.DirectionalLight(
      art.fill ?? theme?.rim ?? 0x8866cc,
      art.fillIntensity ?? (theme?.rimIntensity ?? 0.4) * 1.4,
    );
    this.rimLight.position.set(-9, 6, -10);
    this.scene.add(this.rimLight);

    this.waterGlow = new THREE.PointLight(art.glow ?? theme?.waterGlow ?? 0x66ccff, 1.1, 11);
    this.waterGlow.position.set(0, -1.3, 2.5);
    this.scene.add(this.waterGlow);

    // Warm underside bounce — keeps the cliff from reading as a black hole.
    this.bottomLight = new THREE.HemisphereLight(
      new THREE.Color(art.veil ?? 0xbbd9dc),
      new THREE.Color(mixHex(shadowColor, 0xc8a484, 0.5)),
      0.72,
    );
    this.scene.add(this.bottomLight);

    // ── Atmosphere: fog tinted by the location veil colour ──
    const veil = art.veil ?? theme?.fog ?? 0x0a0a12;
    this.scene.fog = new THREE.FogExp2(veil, theme?.fogDensity ?? 0.0075);

    this.originalBackground = this.scene.background as THREE.Color | null;
    if (theme?.bgColor !== undefined) {
      this.scene.background = new THREE.Color(theme.bgColor);
    }

    // ── Post grade: one LUT-style correction per sanctuary ──
    setGrade(art.grade);

    // ── Base particles (locations add their own signature particles) ──
    this.baseParticleCount = 90 + (art.particles ?? 0);
    this.originalParticleColor = this.data.particleColor;
    this.particles = new ParticleSystem({
      count: this.baseParticleCount,
      type: this.data.particleType,
      color: this.data.particleColor,
      spreadRadius: 8,
      heightRange: 10,
    });
    this.scene.add(this.particles.getGroup());

    // ── Subclass geometry ──
    this.buildGeometry();

    // ── Shared water body + ground shadow ──
    this.sanctuaryWater = new SanctuaryWater(this.data, this.id);
    this.group.add(this.sanctuaryWater.group);

    const shadowDisc = buildGroundShadow({ radius: 6.2, opacity: 0.13 });
    shadowDisc.position.set(0, -1.93, 0);
    this.group.add(shadowDisc);

    // ── Location-specific atmosphere hook ──
    this.buildAtmosphere();
    this.group.add(new SanctuaryDetails(this.id).group);

    // ── Depth layers shared by every sanctuary ──
    this._buildSkyProps();
    this._buildMist();
  }

  /** REF-4: create a theme-aware, id-seeded floating island. */
  protected createIsland(): FloatingIsland {
    const island = new FloatingIsland(this.data.theme?.island, this.id);
    this.island = island;
    return island;
  }

  /** Override in subclass to add location-specific 3D meshes. */
  protected abstract buildGeometry(): void;

  /** Optional hook for atmosphere effects (particles, lights, shimmer). */
  protected buildAtmosphere(): void {}

  /** Optional per-frame hook for atmosphere animation. */
  protected updateAtmosphere(_dt: number, _time: number): void {}

  // ── Floating sky props (depth without a horizon) ────────────────────────

  /**
   * A transparent desktop window cannot carry a horizon silhouette: a
   * world-fixed backdrop ends up in front of the island on half of the orbit
   * and would tint the desktop. Instead we ring the diorama with tiny floating
   * islets and pale clouds, which read as depth and orbit naturally.
   */
  private _buildSkyProps(): void {
    const rng = createRng(hashSeed(`sky:${this.id}`));
    const veil = this.art.veil ?? this.data.theme?.fog ?? 0x232a33;
    const grass = this.data.theme?.island?.grass ?? 0x7f9a62;
    const stone = this.data.theme?.island?.stone ?? 0x8d9a93;
    const cells: InstancedVoxel[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = rng.nextFloat(0, Math.PI * 2);
      const radius = rng.nextFloat(12.5, 15.5);
      const lift = rng.nextFloat(2.2, 4.8);
      const size = rng.nextFloat(0.32, 0.62);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const top = mixHex(grass, veil, 0.3);
      const rock = mixHex(stone, veil, 0.42);
      cells.push({
        x,
        y: lift,
        z,
        w: size,
        h: 0.16,
        d: size,
        color: top,
        rotY: rng.nextFloat(-0.5, 0.5),
      });
      cells.push({
        x,
        y: lift - 0.32,
        z,
        w: size * 0.7,
        h: 0.45,
        d: size * 0.7,
        color: rock,
        rotY: rng.nextFloat(-0.5, 0.5),
      });
      if (rng.chance(0.6)) {
        cells.push({
          x: x + rng.nextFloat(-0.3, 0.3),
          y: lift - 0.82,
          z: z + rng.nextFloat(-0.3, 0.3),
          w: size * 0.35,
          h: 0.3,
          d: size * 0.35,
          color: shade(rock, 0.9),
        });
      }
    }
    const mesh = buildInstancedVoxels(cells, {
      castShadow: false,
      receiveShadow: false,
      shading: 'basic',
    });
    const layer = new THREE.Group();
    layer.add(mesh);
    this.scene.add(layer);
    this.farLayer = layer;

    // Pale clouds, softer than the islets.
    this.skyClouds = new THREE.Group();
    const cloudColor = mixHex(veil, 0xf6f2ea, 0.58);
    for (let i = 0; i < 2; i++) {
      const cloud = buildCloud({
        color: cloudColor,
        size: rng.nextFloat(0.9, 1.4),
        opacity: 0.46,
        seed: rng.nextInt(0, 9999),
      });
      const angle = rng.nextFloat(0, Math.PI * 2);
      const radius = rng.nextFloat(8.5, 11);
      cloud.position.set(
        Math.cos(angle) * radius,
        rng.nextFloat(4.2, 6.4),
        Math.sin(angle) * radius,
      );
      this.skyClouds.add(cloud);
    }
    this.scene.add(this.skyClouds);
  }

  private _buildMist(): void {
    const color = mixHex(this.art.veil ?? this.data.theme?.fog ?? 0xd9e4e6, 0xe8eef0, 0.4);
    this.mistGroup = buildMist({
      color,
      count: 4,
      area: 13,
      y: -1.55,
      opacity: 0.09,
      seed: hashSeed(`mist:${this.id}`),
    });
    this.group.add(this.mistGroup);
  }

  // ── Soul ambience (mythic catches) ──────────────────────────────────────

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
        count: this.baseParticleCount + soulCount * particlesPerSoul,
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
      count: this.baseParticleCount,
      type: this.data.particleType,
      color: this.originalParticleColor ?? this.data.particleColor,
      spreadRadius: 8,
      heightRange: 10,
    });
    this.scene.add(this.particles.getGroup());
  }

  // ── Frame update ────────────────────────────────────────────────────────

  /** Called every frame for animations. */
  update(dt: number, time: number): void {
    this.particles?.update(dt, time);
    this.updateAtmosphere(dt, time);
    // Far layer / clouds breathe very slowly; they must never compete with
    // the gameplay animation for attention.
    if (this.farLayer) this.farLayer.position.y = Math.sin(time * 0.18) * 0.08;
    if (this.skyClouds) {
      this.skyClouds.position.y = Math.sin(time * 0.14 + 0.8) * 0.22;
      this.skyClouds.rotation.y = Math.sin(time * 0.025) * 0.06;
    }
  }

  /** Water + island animation (kept separate because locations own their own loops). */
  updateScenery(time: number): void {
    this.sanctuaryWater?.update(time);
    this.island?.update(time);
    if (this.mistGroup) updateMist(this.mistGroup, time);
  }

  // ── Teardown ────────────────────────────────────────────────────────────

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
      this.moonLight.dispose();
      this.moonLight = null;
    }
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight.dispose();
      this.rimLight = null;
    }
    if (this.waterGlow) {
      this.scene.remove(this.waterGlow);
      this.waterGlow.dispose();
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
    if (this.farLayer) {
      this.scene.remove(this.farLayer);
      this.farLayer.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child instanceof THREE.InstancedMesh) child.dispose();
        child.geometry.dispose();
        if (!Array.isArray(child.material) && !MaterialCache.isCached(child.material)) {
          child.material.dispose();
        }
      });
      this.farLayer = null;
    }
    if (this.skyClouds) {
      this.scene.remove(this.skyClouds);
      this.skyClouds.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (!Array.isArray(child.material) && !MaterialCache.isCached(child.material)) {
          child.material.dispose();
        }
      });
      this.skyClouds = null;
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
    this.sanctuaryWater?.dispose();
    this.sanctuaryWater = null;
    this.island?.dispose();
    this.island = null;
    this.mistGroup = null;

    // Restore original background if changed
    this.scene.background = this.originalBackground ?? null;

    this.scene.remove(this.group);
    // Dispose all children. Geometries are always local to a location; materials
    // may come from MaterialCache and must not be disposed if shared.
    this.group.traverse((child) => {
      if (child instanceof THREE.Light) child.dispose();
      if (child instanceof THREE.Mesh) {
        if (child instanceof THREE.InstancedMesh) child.dispose();
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
