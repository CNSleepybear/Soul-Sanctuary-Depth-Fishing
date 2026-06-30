// ===== src/renderer/locations/ItalyVenice.ts =====
// 🇮🇹 Italy — Venice Canal at Twilight with colorful houses, arch bridge,
// striped mooring poles, narrow gondola, canal water and drifting fireflies.
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

export class ItalyVenice extends BaseLocation {
  readonly id = 'italy';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _waterfall: Waterfall | null = null;
  private _gondola: THREE.Group | null = null;
  private _waterTiles: THREE.Mesh[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'italy')!;
  }

  protected buildGeometry(): void {
    const m = {
      pierStone: MaterialCache.getLambert(0x4a4850),
      terracotta: MaterialCache.getLambert(0xcc7744),
      ochre: MaterialCache.getLambert(0xcc8844),
      palePink: MaterialCache.getLambert(0xddbbaa),
      cream: MaterialCache.getLambert(0xeeddcc),
      gondolaBlack: MaterialCache.getLambert(0x1c1d22),
      gondolaTrim: MaterialCache.getLambert(0x822020),
      poleRed: MaterialCache.getLambert(0xa82e2e),
      poleWhite: MaterialCache.getLambert(0xe6e1d5),
      lanternGlow: MaterialCache.getBasic(0xffb042),
      seaSparkle: MaterialCache.getBasic(0x3da39e),
      water: MaterialCache.getTransparentLambert(0x1a3a3a, 0.78),
      waterLight: MaterialCache.getTransparentLambert(0x2a4a4a, 0.68),
      shirt: MaterialCache.getLambert(0xffffff),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x9a9a8a, earth: 0x8a7a6a, grass: 0x6a9a5a },
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
      color: 0x2a4a4a,
      opacity: 0.6,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // ── Canal water with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = -0.35;
    layer.group.add(waterGroup);
    for (let x = -4; x <= 4; x += 1) {
      for (let z = -4; z <= 4; z += 1) {
        if (Math.sqrt(x * x + (z - 0.5) * (z - 0.5)) > 4.8) continue;
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

    // Four buildings in varied Venetian colors
    const building = new THREE.Group();
    const addHouse = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      z: number,
    ) => {
      const g = new THREE.Group();
      box(w, h, d, mat, 0, h / 2, 0, g);
      // glowing windows
      const wx = w * 0.22;
      const wyTop = h * 0.55;
      const wyBot = h * 0.28;
      const wd = 0.06;
      box(w * 0.25, h * 0.22, wd, m.lanternGlow, -wx, wyTop, d / 2 + 0.01, g, false);
      box(w * 0.25, h * 0.22, wd, m.lanternGlow, wx, wyTop, d / 2 + 0.01, g, false);
      box(w * 0.25, h * 0.22, wd, m.lanternGlow, -wx, wyBot, d / 2 + 0.01, g, false);
      box(w * 0.25, h * 0.22, wd, m.lanternGlow, wx, wyBot, d / 2 + 0.01, g, false);
      // dark shutters
      const sw = w * 0.06;
      box(sw, h * 0.24, wd, m.gondolaBlack, -wx - w * 0.16, wyTop, d / 2 + 0.02, g);
      box(sw, h * 0.24, wd, m.gondolaBlack, wx + w * 0.16, wyTop, d / 2 + 0.02, g);
      box(sw, h * 0.24, wd, m.gondolaBlack, -wx - w * 0.16, wyBot, d / 2 + 0.02, g);
      box(sw, h * 0.24, wd, m.gondolaBlack, wx + w * 0.16, wyBot, d / 2 + 0.02, g);
      g.position.set(x, 0, z);
      building.add(g);
    };
    addHouse(1.5, 3.4, 1.7, m.terracotta, -2.4, 0);
    addHouse(1.2, 2.9, 1.5, m.ochre, -0.8, 0);
    addHouse(1.3, 3.1, 1.6, m.palePink, 0.7, 0);
    addHouse(1.6, 3.5, 1.8, m.cream, 2.4, 0);
    // canal-side balcony
    building.add(box(1.6, 0.15, 0.6, m.pierStone, -2.4, 0.9, 1.15, building));
    building.position.set(0, 0.15, -2.5);
    layer.group.add(building);

    // Arch bridge over canal
    const bridge = new THREE.Group();
    box(4.5, 0.25, 1.4, m.pierStone, 0, 1.8, 0, bridge);
    // Steps
    for (let i = 0; i < 5; i++) {
      const y = i * 0.22;
      const z = -1.2 + i * 0.6;
      box(1.2, 0.12, 0.55, m.pierStone, 0, y + 0.06, z, bridge);
    }
    // Arch supports
    box(0.35, 1.8, 1.2, m.pierStone, -1.6, 0.9, 0, bridge);
    box(0.35, 1.8, 1.2, m.pierStone, 1.6, 0.9, 0, bridge);
    bridge.position.set(0, 0, 2.8);
    layer.group.add(bridge);

    // Striped mooring poles (red/white)
    const pole = (px: number, pz: number) => {
      const p = new THREE.Group();
      for (let i = 0; i < 11; i++) {
        const mat = i % 2 === 0 ? m.poleRed : m.poleWhite;
        box(0.12, 0.25, 0.12, mat, 0, i * 0.25 + 0.125, 0, p);
      }
      box(0.16, 0.15, 0.16, m.lanternGlow, 0, 11 * 0.25 + 0.05, 0, p, false);
      p.position.set(px, 0.1, pz);
      return p;
    };
    layer.group.add(pole(-2.2, 1.6));
    layer.group.add(pole(-0.7, 1.6));
    layer.group.add(pole(0.7, 1.6));
    layer.group.add(pole(2.2, 1.6));

    // Narrow gondola with gondolier
    this._gondola = new THREE.Group();
    const gw = 0.18;
    box(3.6, 0.2, gw, m.gondolaBlack, 0, 0.1, 0, this._gondola);
    box(1.8, 0.15, gw * 0.6, m.gondolaTrim, 0, 0.2, 0, this._gondola);
    box(0.6, 0.5, gw, m.gondolaBlack, 1.9, 0.35, 0, this._gondola);
    box(0.6, 0.4, gw, m.gondolaBlack, -1.9, 0.3, 0, this._gondola);
    // decorative prow/stern curls
    box(0.12, 0.5, 0.06, m.poleWhite, 2.25, 0.55, 0, this._gondola);
    box(0.12, 0.35, 0.06, m.poleWhite, -2.25, 0.45, 0, this._gondola);
    // gondolier standing at the stern
    const gondolier = new THREE.Group();
    box(0.16, 0.35, 0.16, m.shirt, 0, 0.18, 0, gondolier);
    box(0.18, 0.08, 0.18, m.gondolaBlack, 0, 0.4, 0, gondolier);
    box(0.05, 0.6, 0.05, m.poleWhite, 0.22, 0.32, 0.1, gondolier);
    gondolier.position.set(-1.4, 0.35, 0);
    this._gondola.add(gondolier);
    this._gondola.position.set(0.8, -0.25, 0.5);
    this._gondola.rotation.y = 0.25;
    this._gondola.userData = {
      type: 'gondola',
      baseX: 0.8,
      baseZ: 0.5,
      phase: Math.random() * Math.PI * 2,
    };
    waterGroup.add(this._gondola);
    this._particles.push(this._gondola);

    // Wall lantern
    const wl = new THREE.Group();
    box(0.25, 0.35, 0.25, m.lanternGlow, 0, 0, 0, wl, false);
    box(0.35, 0.1, 0.35, m.gondolaBlack, 0, 0.2, 0, wl);
    wl.position.set(-1.2, 2.7, -1.8);
    layer.group.add(wl);

    // Lights
    const lp = new THREE.PointLight(0xffaa33, 4.0, 8);
    lp.position.set(-1.2, 2.6, -1.6);
    lp.castShadow = true;
    lp.shadow.mapSize.width = 256;
    layer.group.add(lp);
    this._flickerLights.push({ light: lp, base: 3.6, speed: 4.0, amp: 0.18 });

    const wp = new THREE.PointLight(0xffbb55, 2.5, 6);
    wp.position.set(0, 2.0, -1.5);
    layer.group.add(wp);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Canal shimmer
    const shimmer = createSurfaceShimmer(layer, 16, 0x88ffff, { x: 7, z: 6, y: -0.25 });
    for (const s of shimmer) {
      s.position.x += (Math.random() - 0.5) * 7;
      s.position.z += 1.0 + (Math.random() - 0.5) * 5;
    }
    this._particles.push(...shimmer);

    // Mooring pole top lights
    const poleGlow1 = createLanternGlow(layer, new THREE.Vector3(-2.2, 2.9, 1.6), 0xffb042, 0.8, 4);
    this._flickerLights.push({ light: poleGlow1.light, base: 0.7, speed: 5, amp: 0.1 });
    const poleGlow2 = createLanternGlow(layer, new THREE.Vector3(2.2, 2.9, 1.6), 0xffb042, 0.8, 4);
    this._flickerLights.push({ light: poleGlow2.light, base: 0.7, speed: 5.5, amp: 0.1 });

    // Sea sparkles
    const sg = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(sg, MaterialCache.getBasic(0x3da39e));
      p.position.set(Math.random() * 7 - 3.5, -0.25 + Math.random() * 0.3, Math.random() * 6 - 1);
      p.userData = {
        type: 'rise',
        vSpeed: 0.004 + Math.random() * 0.006,
        maxHeight: -0.05 + Math.random() * 0.3,
        sinSpeed: 2 + Math.random() * 2,
      };
      layer.add(p);
      this._particles.push(p);
    }

    // Fireflies / lantern light motes
    const fireflyGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xffb042,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(fireflyGeo, fireflyMat.clone());
      p.position.set((Math.random() - 0.5) * 8, 1 + Math.random() * 4, (Math.random() - 0.5) * 6);
      p.userData = {
        type: 'firefly',
        baseX: p.position.x,
        baseY: p.position.y,
        baseZ: p.position.z,
        speed: 0.3 + Math.random() * 0.5,
        radius: 0.3 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
      };
      layer.add(p);
      this._particles.push(p);
    }

    // Distant seagulls
    const gullGeo = new THREE.BoxGeometry(0.08, 0.02, 0.04);
    const gullMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(gullGeo, gullMat.clone());
      p.position.set(
        (Math.random() - 0.5) * 10,
        5 + Math.random() * 2,
        -3 + (Math.random() - 0.5) * 4,
      );
      p.userData = {
        type: 'gull',
        speed: 0.3 + Math.random() * 0.3,
        yBase: p.position.y,
        phase: Math.random() * 100,
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
      } else if (ud.type === 'gull') {
        p.position.x += 0.01;
        p.position.y = ud.yBase + Math.sin(time * ud.speed + ud.phase) * 0.2;
        if (p.position.x > 6) p.position.x = -6;
      } else if (ud.type === 'firefly') {
        p.position.x = ud.baseX + Math.sin(time * ud.speed + ud.phase) * ud.radius;
        p.position.y = ud.baseY + Math.sin(time * ud.speed * 0.7 + ud.phase) * 0.3;
        p.position.z = ud.baseZ + Math.cos(time * ud.speed * 0.5 + ud.phase) * ud.radius;
        p.visible = Math.sin(time * 3 + ud.phase) > -0.3;
      } else if (ud.type === 'gondola' && p instanceof THREE.Group) {
        p.position.x = ud.baseX + Math.sin(time * 0.2 + ud.phase) * 0.3;
        p.position.z = ud.baseZ + Math.cos(time * 0.15 + ud.phase) * 0.2;
        p.rotation.z = Math.sin(time * 1.5 + ud.phase) * 0.025;
        p.position.y = -0.25 + Math.cos(time * 1.2 + ud.phase) * 0.03;
      }
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'rise') continue;
      p.position.y += ud.vSpeed;
      p.position.x += Math.sin(time * ud.sinSpeed) * 0.002;
      if (p.position.y > ud.maxHeight) {
        p.position.y = -0.25;
        p.position.x = Math.random() * 7 - 3.5;
        p.position.z = Math.random() * 6 - 1;
      }
    }
    for (const fl of this._flickerLights) {
      updateFlicker(time, fl);
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._gondola = null;
    this._waterTiles = [];
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
