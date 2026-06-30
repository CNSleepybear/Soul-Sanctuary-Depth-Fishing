// ===== src/renderer/locations/UKThames.ts =====
// 🇬🇧 UK — Rainy Thames Dock with Big Ben, red phone box, post box,
// double-decker bus silhouette, Thames water, drifting mist and pigeons.
// Art upgraded to match the richer voxel diorama ND standard.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { Waterfall } from '../rendering/Waterfall';
import { MaterialCache } from '../rendering/MaterialCache';
import { VoxelBuilder } from '../rendering/VoxelBuilder';
import { LOCATIONS } from '../data/location-data';
import type { LocationData } from '../../shared/types';
import {
  updateFlicker,
  createSurfaceShimmer,
  updateSurfaceShimmer,
  createRisingPuffs,
  updateRisingPuffs,
} from './AtmosphereEffects';

export class UKThames extends BaseLocation {
  readonly id = 'uk';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _waterfall: Waterfall | null = null;
  private _mistPuffs: THREE.Mesh[] = [];
  private _waterTiles: THREE.Mesh[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'uk')!;
  }

  protected buildGeometry(): void {
    const m = {
      curb: MaterialCache.getLambert(0x2e323d),
      brick: MaterialCache.getLambert(0x5a3a2a),
      brickDark: MaterialCache.getLambert(0x4a2e22),
      britishRed: MaterialCache.getLambert(0xb02020),
      ironBlack: MaterialCache.getLambert(0x16171a),
      windowGlow: MaterialCache.getBasic(0xffdd77),
      lampGlow: MaterialCache.getBasic(0xffeedd),
      clockGlow: MaterialCache.getBasic(0xfff8dd),
      rainDrop: MaterialCache.getBasic(0x485673),
      water: MaterialCache.getTransparentLambert(0x1a2a3a, 0.78),
      waterLight: MaterialCache.getTransparentLambert(0x2a3a4a, 0.68),
      waterReflect: MaterialCache.getTransparentLambert(0x3a4a5a, 0.22),
      pigeonBody: MaterialCache.getLambert(0x6a6a72),
      pigeonHead: MaterialCache.getLambert(0x888890),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x6a6a6a, earth: 0x4a4a4a, grass: 0x3a5a3a },
    );
    this.group.add(island.group);

    const layer = new VoxelBuilder();
    layer.group.position.y = 1.5;
    this.group.add(layer.group);

    // Raw box helper for grouped objects
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Group,
      cast = true,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // ── Waterfall rim ──
    this._waterfall = new Waterfall({
      radius: 4.6,
      innerRadius: 4.0,
      yBase: -0.2,
      heightMin: 1.0,
      heightMax: 1.8,
      color: 0x2a3a4a,
      opacity: 0.6,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // ── Thames water with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = -0.55;
    layer.group.add(waterGroup);
    for (let x = -4; x <= 4; x += 1) {
      for (let z = -4; z <= 2; z += 1) {
        if (Math.sqrt(x * x + (z - 1) * (z - 1)) > 4.8) continue;
        const mat = Math.random() > 0.5 ? m.water : m.waterLight;
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), mat);
        w.position.set(x, 0, z);
        w.receiveShadow = false;
        w.castShadow = false;
        w.userData = { baseY: 0, phase: Math.random() * Math.PI * 2 };
        waterGroup.add(w);
        this._waterTiles.push(w);
      }
    }

    // Curb + side brick wall (framing on left)
    layer.boxMat(7, 0.3, 4, m.curb, 0.5, 0.15, 0.5);
    layer.boxMat(0.8, 5.5, 4, m.brick, -3.5, 2.75, 0);
    // Wall detail strips
    layer.boxMat(0.2, 5.5, 0.1, m.brickDark, -3.05, 2.75, -1.8);
    layer.boxMat(0.2, 5.5, 0.1, m.brickDark, -3.05, 2.75, 1.8);

    // Red telephone booth
    const booth = new THREE.Group();
    box(0.6, 1.5, 0.6, m.britishRed, 0, 0.75, 0, booth);
    box(0.35, 0.7, 0.05, m.windowGlow, 0, 0.85, 0.3, booth, false);
    box(0.62, 0.08, 0.62, m.britishRed, 0, 1.54, 0, booth);
    box(0.3, 0.08, 0.3, m.britishRed, 0, 1.63, 0, booth);
    booth.position.set(2, 0.3, 1.5);
    layer.group.add(booth);

    // Red post box
    const postBox = new THREE.Group();
    box(0.35, 0.9, 0.35, m.britishRed, 0, 0.45, 0, postBox);
    box(0.12, 0.06, 0.02, m.windowGlow, 0, 0.7, 0.18, postBox, false);
    box(0.4, 0.08, 0.4, m.britishRed, 0, 0.94, 0, postBox);
    postBox.position.set(2.9, 0.3, 0.5);
    layer.group.add(postBox);

    // Victorian twin-head lamp
    const lamp = new THREE.Group();
    box(0.18, 4.2, 0.18, m.ironBlack, 0, 2.1, 0, lamp);
    box(0.4, 0.8, 0.4, m.ironBlack, 0, 0.4, 0, lamp);
    box(1.8, 0.15, 0.18, m.ironBlack, 0, 4.0, 0, lamp);
    const head = (isLeft: boolean) => {
      const h = new THREE.Group();
      box(0.4, 0.4, 0.4, m.lampGlow, 0, -0.2, 0, h, false);
      box(0.5, 0.12, 0.5, m.ironBlack, 0, 0.05, 0, h);
      h.position.set(isLeft ? -0.8 : 0.8, 4.0, 0);
      return h;
    };
    lamp.add(head(true), head(false));
    lamp.position.set(-2, 0.3, 1);
    layer.group.add(lamp);

    // Big Ben + side tower (back-left)
    const tower = new THREE.Group();
    box(0.9, 1.6, 0.9, m.brick, 0, 0.8, 0, tower);
    box(0.8, 5, 0.8, m.ironBlack, 0, 4, 0, tower);
    box(0.6, 0.5, 0.6, m.ironBlack, 0, 6.7, 0, tower);
    // Clock face glow
    box(0.35, 0.35, 0.05, m.clockGlow, 0, 5.8, 0.42, tower, false);
    box(0.08, 0.18, 0.02, m.ironBlack, 0, 5.8, 0.46, tower, false);
    box(0.18, 0.08, 0.02, m.ironBlack, 0, 5.9, 0.46, tower, false);
    box(0.3, 1.0, 0.3, m.ironBlack, 0, 7.2, 0, tower);
    box(0.15, 0.5, 0.15, m.ironBlack, 0, 7.9, 0, tower);
    tower.position.set(-2.4, 0, -2.0);
    layer.group.add(tower);

    const sideTower = new THREE.Group();
    box(0.6, 1.2, 0.6, m.brick, 0, 0.6, 0, sideTower);
    box(0.5, 3.5, 0.5, m.ironBlack, 0, 1.75, 0, sideTower);
    box(0.4, 0.4, 0.4, m.ironBlack, 0, 3.7, 0, sideTower);
    box(0.18, 0.25, 0.05, m.windowGlow, 0, 3.0, 0.27, sideTower, false);
    box(0.1, 0.4, 0.1, m.ironBlack, 0, 4.1, 0, sideTower);
    sideTower.position.set(-1.4, 0, -2.8);
    layer.group.add(sideTower);

    // Double-decker bus silhouette (back-right)
    const bus = new THREE.Group();
    box(2.2, 1.1, 0.9, m.britishRed, 0, 0.55, 0, bus);
    box(2.2, 0.35, 0.92, m.ironBlack, 0, 1.18, 0, bus);
    // Windows
    for (let i = -0.8; i <= 0.8; i += 0.55) {
      box(0.25, 0.25, 0.02, m.windowGlow, i, 0.85, 0.46, bus, false);
    }
    box(0.35, 0.28, 0.02, m.windowGlow, 0.85, 0.5, 0.46, bus, false);
    bus.position.set(2.5, 0.3, -2.2);
    bus.rotation.y = -0.2;
    layer.group.add(bus);

    // Dock bollards
    for (let z of [-1.5, 0, 1.5]) {
      layer.boxMat(0.15, 0.5, 0.15, m.ironBlack, -0.8, 0.4, z);
    }

    // Pigeons
    const makePigeon = (x: number, z: number, rot: number) => {
      const pigeon = new THREE.Group();
      box(0.18, 0.12, 0.22, m.pigeonBody, 0, 0.06, 0, pigeon, false);
      box(0.1, 0.1, 0.1, m.pigeonHead, 0.08, 0.16, 0.08, pigeon, false);
      box(0.04, 0.02, 0.12, m.pigeonBody, -0.1, 0.08, 0, pigeon, false);
      pigeon.position.set(x, 0.3, z);
      pigeon.rotation.y = rot;
      return pigeon;
    };
    layer.group.add(makePigeon(0.8, 1.2, 0.4));
    layer.group.add(makePigeon(1.4, 0.8, -0.3));

    // Lights
    const bp = new THREE.PointLight(0xff9922, 2.5, 6);
    bp.position.set(2, 1.8, 1.5);
    bp.castShadow = true;
    layer.group.add(bp);
    this._flickerLights.push({ light: bp, base: 2.0, speed: 5.5, amp: 0.12 });

    const sp = new THREE.PointLight(0xffeebb, 3.5, 9);
    sp.position.set(-2, 3.8, 1);
    sp.castShadow = true;
    sp.shadow.mapSize.width = 256;
    layer.group.add(sp);
    this._flickerLights.push({ light: sp, base: 2.8, speed: 4, amp: 0.15, noise: true });

    const clockLight = new THREE.PointLight(0xfff8dd, 1.5, 5);
    clockLight.position.set(-2.4, 5.8, -1.7);
    layer.group.add(clockLight);
    this._flickerLights.push({ light: clockLight, base: 1.2, speed: 3, amp: 0.08 });

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Water reflection shimmer
    const shimmer = createSurfaceShimmer(layer, 16, 0x88aaff, { x: 8, z: 8, y: -0.5 });
    this._particles.push(...shimmer);

    // Low river mist
    this._mistPuffs = createRisingPuffs(
      layer,
      8,
      0x8899aa,
      { x: 8, z: 8, yMin: -0.5, yMax: 0.5 },
      0.4,
    );
    for (const p of this._mistPuffs) {
      p.position.y = -0.4 + Math.random() * 0.6;
    }
    this._particles.push(...this._mistPuffs);

    // Rain
    const rg = new THREE.BoxGeometry(0.04, 0.45, 0.04);
    for (let i = 0; i < 80; i++) {
      const p = new THREE.Mesh(rg, MaterialCache.getBasic(0x485673));
      p.position.set(Math.random() * 10 - 5, Math.random() * 8 + 0.3, Math.random() * 10 - 5);
      p.userData = { type: 'rain', speedY: 0.12 + Math.random() * 0.08 };
      layer.add(p);
      this._particles.push(p);
    }

    // Rain splash rings
    const splashGeo = new THREE.BoxGeometry(0.18, 0.02, 0.18);
    const splashMat = MaterialCache.getTransparentLambert(0x88aaff, 0.35);
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(splashGeo, splashMat.clone());
      p.position.set((Math.random() - 0.5) * 8, -0.45, (Math.random() - 0.5) * 6);
      p.userData = {
        type: 'splash',
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 2,
      };
      layer.add(p);
      this._particles.push(p);
    }
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    // Waterfall
    this._waterfall?.update(time);

    // Water tiles
    for (const w of this._waterTiles) {
      w.position.y = w.userData.baseY + Math.sin(time * 1.8 + w.userData.phase) * 0.025;
    }

    updateRisingPuffs(time, this._mistPuffs);

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      } else if (ud.type === 'splash' && p instanceof THREE.Mesh) {
        const life = Math.sin(time * ud.speed + ud.phase);
        const active = life > 0;
        p.visible = active;
        if (active) {
          const scale = 0.5 + life * 0.8;
          p.scale.setScalar(scale);
          if (!Array.isArray(p.material)) p.material.opacity = (1 - life) * 0.35;
        }
      }
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'rain') continue;
      p.position.y -= ud.speedY;
      if (p.position.y < 0.2) {
        p.position.y = 7 + Math.random() * 2;
        p.position.x = Math.random() * 10 - 5;
        p.position.z = Math.random() * 10 - 5;
      }
    }
    for (const fl of this._flickerLights) {
      updateFlicker(time, fl);
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._waterTiles = [];
    this._mistPuffs = [];
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
