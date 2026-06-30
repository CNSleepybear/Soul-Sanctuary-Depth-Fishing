// ===== src/renderer/locations/GreeceSantorini.ts =====
// 🇬🇷 Greece — Santorini Windmill with blue-domed church, white houses,
// Aegean sea, grape vines, terracotta pots, spinning windmill and sea spray.
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
  createLanternGlow,
} from './AtmosphereEffects';

export class GreeceSantorini extends BaseLocation {
  readonly id = 'greece';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _waterfall: Waterfall | null = null;
  private _windmill: THREE.Group | null = null;
  private _waterTiles: THREE.Mesh[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'greece')!;
  }

  protected buildGeometry(): void {
    const m = {
      white: MaterialCache.getLambert(0xe2e5eb),
      blue: MaterialCache.getLambert(0x4488dd),
      gold: MaterialCache.getBasic(0xffdd44),
      wood: MaterialCache.getLambert(0x5c4033),
      fuchsia: MaterialCache.getLambert(0xcc3388),
      pot: MaterialCache.getLambert(0xc46a3a),
      water: MaterialCache.getTransparentLambert(0x1a3060, 0.78),
      waterLight: MaterialCache.getTransparentLambert(0x2a4080, 0.68),
      seagull: MaterialCache.getLambert(0xffffff),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0xf5f0e8, earth: 0xeae5da, grass: 0x9aaa7a },
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
      color: 0x2a4080,
      opacity: 0.6,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // ── Aegean sea with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = -0.55;
    layer.group.add(waterGroup);
    for (let x = -4; x <= 4; x += 1) {
      for (let z = -4; z <= 4; z += 1) {
        if (Math.sqrt(x * x + z * z) > 4.8) continue;
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

    // Windmill
    const mill = new THREE.Group();
    box(3, 3.5, 3, m.white, -1, 1.75, -1, mill);
    for (let i = 0; i < 6; i++) {
      const w = 3.4 - i * 0.6;
      box(w, 0.3, w, m.blue, -1, 3.5 + i * 0.3, -1, mill);
    }
    box(0.3, 0.8, 0.3, m.gold, -1, 6.2, -1, mill, false);
    layer.group.add(mill);

    // Blades
    this._windmill = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = box(3.6, 0.15, 0.15, m.gold, 1.8, 0, 0, this._windmill, false);
      blade.rotation.z = (i * Math.PI) / 2;
    }
    this._windmill.position.set(-1, 5.5, -1);
    layer.group.add(this._windmill);

    // Houses
    const h1 = new THREE.Group();
    h1.add(box(2.5, 2.5, 2.5, m.white, 0, 1.25, 0, h1));
    h1.add(box(2.7, 0.3, 2.7, m.blue, 0, 2.7, 0, h1));
    h1.add(box(0.6, 0.6, 0.1, m.gold, 0.5, 1.5, 1.26, h1, false));
    h1.position.set(2.5, 0, 2);
    layer.group.add(h1);

    const h2 = new THREE.Group();
    h2.add(box(2, 2, 2, m.white, 0, 1, 0, h2));
    h2.add(box(2.2, 0.3, 2.2, m.blue, 0, 2.2, 0, h2));
    h2.position.set(-3, 0, 2.5);
    layer.group.add(h2);

    // Bougainvillea
    const addBougainvillea = (building: THREE.Group, cx: number, cy: number, cz: number) => {
      for (let i = 0; i < 10; i++) {
        const bx = (Math.random() - 0.5) * 0.7;
        const by = (Math.random() - 0.5) * 0.7;
        building.add(box(0.14, 0.14, 0.08, m.fuchsia, cx + bx, cy + by, cz, building, false));
      }
    };
    addBougainvillea(h1, 0.5, 1.5, 1.3);
    addBougainvillea(h2, 0, 1.0, 1.05);

    // Blue dome church with bell tower
    const church = new THREE.Group();
    church.add(box(2, 1.8, 2, m.white, 0, 0.9, 0, church));
    church.add(box(1.4, 0.7, 1.4, m.blue, 0, 2.15, 0, church));
    church.add(box(0.3, 1.5, 0.3, m.white, 1.35, 0.75, 0.5, church));
    church.add(box(0.15, 0.4, 0.05, m.wood, 1.35, 0.7, 0.67, church));
    church.add(box(0.1, 0.15, 0.1, m.gold, 1.35, 1.05, 0.5, church, false));
    church.position.set(0, 0, -3);
    layer.group.add(church);

    // Pergola
    const pergola = new THREE.Group();
    for (const x of [-0.5, 0.5])
      for (const z of [-0.5, 0.5]) pergola.add(box(0.1, 2, 0.1, m.wood, x, 1, z, pergola));
    pergola.add(box(1.4, 0.1, 1.4, m.wood, 0, 2, 0, pergola));
    pergola.position.set(1, 0, -2.5);
    layer.group.add(pergola);

    // Wide stairs
    const stairs = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      stairs.add(box(1.2, 0.15, 0.4, m.white, 0, i * 0.15, i * 0.4, stairs));
    }
    stairs.position.set(-1, 0, 3.5);
    layer.group.add(stairs);

    // Terracotta pots
    const pot = (px: number, pz: number) => {
      const p = new THREE.Group();
      box(0.25, 0.35, 0.25, m.pot, 0, 0.175, 0, p);
      box(0.08, 0.25, 0.08, m.fuchsia, 0, 0.45, 0, p, false);
      p.position.set(px, 0, pz);
      return p;
    };
    layer.group.add(pot(2.2, 3.2));
    layer.group.add(pot(-2.2, 3.2));
    layer.group.add(pot(0.5, -3.5));

    // Seagull
    const seagull = new THREE.Group();
    box(0.25, 0.06, 0.08, m.seagull, 0, 0, 0, seagull, false);
    box(0.08, 0.04, 0.04, m.seagull, 0.16, 0.02, 0, seagull, false);
    box(0.04, 0.04, 0.12, m.seagull, -0.12, 0, 0, seagull, false);
    seagull.position.set(0, 5.5, 0);
    seagull.userData = { type: 'seagull', baseY: 5.5, phase: Math.random() * Math.PI * 2 };
    layer.group.add(seagull);
    this._particles.push(seagull);

    // Lights
    const sd = new THREE.DirectionalLight(0xffddaa, 0.8);
    sd.position.set(5, 10, 5);
    sd.castShadow = true;
    this.scene.add(sd);

    const wp = new THREE.PointLight(0xffdd44, 2.0, 5);
    wp.position.set(3, 1.5, 2.5);
    layer.group.add(wp);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Whitewash sun reflection
    const shimmer = createSurfaceShimmer(layer, 16, 0xeef0f5, { x: 9, z: 9, y: -0.45 });
    this._particles.push(...shimmer);

    // Blue dome highlight
    const dome = createLanternGlow(layer, new THREE.Vector3(0, 2.3, -3), 0x66ccff, 0.7, 3);
    this._flickerLights.push({ light: dome.light, base: 0.5, speed: 2.5, amp: 0.12 });
    this._particles.push(dome.mesh);

    // Sea spray particles
    const fg = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    for (let i = 0; i < 45; i++) {
      const p = new THREE.Mesh(fg, MaterialCache.getBasic(0xffffff));
      p.position.set(Math.random() * 10 - 5, -0.35 + Math.random() * 0.8, Math.random() * 10 - 5);
      p.userData = {
        type: 'spray',
        speedX: 0.01 + Math.random() * 0.02,
        speedZ: (Math.random() - 0.5) * 0.015,
        angle: Math.random() * Math.PI * 2,
        amp: 0.01 + Math.random() * 0.02,
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
      w.position.y = w.userData.baseY + Math.sin(time * 1.5 + w.userData.phase) * 0.02;
    }

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      } else if (ud.type === 'seagull' && p instanceof THREE.Group) {
        p.position.x += 0.012;
        p.position.y = ud.baseY + Math.sin(time * 2 + ud.phase) * 0.25;
        if (p.position.x > 6) p.position.x = -6;
      }
    }
  }

  update(dt: number, time: number): void {
    if (this._windmill) {
      this._windmill.rotation.z += 0.5 * dt;
    }
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'spray') continue;
      p.position.x += ud.speedX;
      p.position.z += ud.speedZ + Math.sin(time + ud.angle) * ud.amp;
      if (p.position.x > 5) {
        p.position.x = -5;
        p.position.z = Math.random() * 10 - 5;
        p.position.y = -0.35 + Math.random() * 0.8;
      }
    }
    for (const fl of this._flickerLights) {
      updateFlicker(time, fl);
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._windmill = null;
    this._waterTiles = [];
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
