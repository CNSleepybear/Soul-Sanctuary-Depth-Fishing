// ===== src/renderer/locations/DenmarkNyhavn.ts =====
// 🇩🇰 Denmark — Nyhavn Winter Night with colorful townhouses, harbor water,
// wooden ships, copper spire, dockside lamps, drifting snow and chimney smoke.
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
  createLanternGlow,
} from './AtmosphereEffects';

export class DenmarkNyhavn extends BaseLocation {
  readonly id = 'denmark';
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
  private _smokePuffs: THREE.Mesh[] = [];
  private _waterTiles: THREE.Mesh[] = [];
  private _ships: THREE.Group[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'denmark')!;
  }

  protected buildGeometry(): void {
    const m = {
      houseRed: MaterialCache.getLambert(0x8a3324),
      houseOrange: MaterialCache.getLambert(0xcc8844),
      houseYellow: MaterialCache.getLambert(0xccaa44),
      houseGreen: MaterialCache.getLambert(0x487865),
      houseBlue: MaterialCache.getLambert(0x3a5a8a),
      housePurple: MaterialCache.getLambert(0x6a4a6a),
      houseTeal: MaterialCache.getLambert(0x3a7a7a),
      roofCharcoal: MaterialCache.getLambert(0x1e222b),
      snow: MaterialCache.getLambert(0xeef0f5),
      mastWood: MaterialCache.getLambert(0x473425),
      hullWood: MaterialCache.getLambert(0x5a3a25),
      sailWhite: MaterialCache.getLambert(0xd9d2c5),
      copperPatina: MaterialCache.getLambert(0x4a8a7a),
      hyggeGlow: MaterialCache.getBasic(0xffbb44),
      lampPost: MaterialCache.getLambert(0x15191e),
      water: MaterialCache.getTransparentLambert(0x2a4a5a, 0.78),
      waterLight: MaterialCache.getTransparentLambert(0x3a5a6a, 0.68),
      seagullWhite: MaterialCache.getLambert(0xffffff),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x8a9aaa, earth: 0x7a8a9a, grass: 0xeef0f5 },
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
      color: 0x2a4a5a,
      opacity: 0.6,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // ── Harbor water with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = -0.45;
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

    // Seven colorful Nyhavn townhouses with varied widths
    const housePalette = [
      m.houseYellow,
      m.houseRed,
      m.houseGreen,
      m.houseBlue,
      m.houseOrange,
      m.housePurple,
      m.houseTeal,
    ];
    const houseWidths = [1.0, 0.8, 1.2, 0.7, 0.9, 0.6, 1.4];
    const townhouses = new THREE.Group();
    let cx = -3.4;
    for (let i = 0; i < 7; i++) {
      const w = houseWidths[i];
      const h = 2.4 + (i % 3) * 0.35;
      const d = 1.5;
      const g = new THREE.Group();
      box(w, h, d, housePalette[i], 0, h / 2, 0, g);
      // stepped roof
      const roofLayers = Math.max(2, Math.floor(h / 1.0));
      for (let r = 0; r < roofLayers; r++) {
        const rw = w + 0.2 - r * (w / (roofLayers + 1));
        box(rw, 0.2, d + 0.1, m.roofCharcoal, 0, h + 0.1 + r * 0.2, 0, g);
      }
      // snow cap
      box(w + 0.15, 0.1, d + 0.05, m.snow, 0, h + 0.15 + roofLayers * 0.2, 0, g);
      // glowing windows
      const win = (wx: number, wy: number) => {
        box(0.28, 0.42, 0.06, m.hyggeGlow, wx, wy, d / 2 + 0.03, g, false);
        box(0.32, 0.46, 0.04, m.roofCharcoal, wx, wy, d / 2 + 0.04, g);
      };
      win(-w * 0.22, h * 0.55);
      win(w * 0.22, h * 0.55);
      win(-w * 0.22, h * 0.25);
      win(w * 0.22, h * 0.25);
      // Chimney for some houses
      if (i % 2 === 0) {
        box(0.25, 0.6, 0.25, m.roofCharcoal, -w * 0.25, h + 0.4 + roofLayers * 0.2, 0, g);
      }
      g.position.set(cx + w / 2, 0, 0);
      cx += w + 0.25;
      townhouses.add(g);
    }
    townhouses.position.set(0.2, 0.15, -2.4);
    layer.group.add(townhouses);

    // Wooden ships with masts
    const buildShip = (sx: number, sz: number, ry: number) => {
      const s = new THREE.Group();
      s.userData = { type: 'ship', baseX: sx, baseZ: sz, phase: Math.random() * Math.PI * 2 };
      box(3.2, 0.45, 0.9, m.hullWood, 0, 0.22, 0, s);
      box(3.0, 0.2, 0.7, m.mastWood, 0, 0.45, 0, s);
      const mastX = [-1.0, 0, 1.0];
      for (let mi = 0; mi < mastX.length; mi++) {
        const mh = 2.4 + (mi === 1 ? 0.5 : 0);
        box(0.08, mh, 0.08, m.mastWood, mastX[mi], 0.5 + mh / 2, 0, s);
        box(0.04, 1.2, 0.6, m.sailWhite, mastX[mi], 0.8 + mh / 2, 0.1, s, false);
        if (mi < mastX.length - 1) {
          box(
            mastX[mi + 1] - mastX[mi],
            0.04,
            0.04,
            m.mastWood,
            (mastX[mi] + mastX[mi + 1]) / 2,
            0.5 + mh - 0.2,
            0,
            s,
          );
        }
      }
      // Diagonal rigging lines between masts
      const rig = (x1: number, y1: number, x2: number, y2: number, zOff: number) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const r = box(len, 0.02, 0.02, m.mastWood, (x1 + x2) / 2, (y1 + y2) / 2, zOff, s, false);
        r.rotation.z = Math.atan2(dy, dx);
      };
      rig(mastX[0], 2.2, mastX[1], 1.4, 0.06);
      rig(mastX[1], 1.55, mastX[2], 2.0, 0.06);
      rig(mastX[0], 1.6, mastX[1], 0.95, -0.06);
      rig(mastX[1], 0.95, mastX[2], 1.5, -0.06);
      s.position.set(sx, -0.2, sz);
      s.rotation.y = ry;
      return s;
    };
    const ship1 = buildShip(-2.6, 2.0, 0.2);
    const ship2 = buildShip(2.4, 2.3, -0.25);
    waterGroup.add(ship1);
    waterGroup.add(ship2);
    this._ships.push(ship1, ship2);
    this._particles.push(ship1, ship2);

    // Copper-green Copenhagen spire silhouette
    const spire = new THREE.Group();
    box(0.25, 3.5, 0.25, m.copperPatina, 0, 1.75, 0, spire);
    box(0.45, 0.12, 0.45, m.copperPatina, 0, 3.56, 0, spire);
    box(0.08, 0.6, 0.08, m.copperPatina, 0, 4.0, 0, spire);
    spire.position.set(-1.5, 0.15, -4.2);
    layer.group.add(spire);

    // Lamp posts
    const lamp = new THREE.Group();
    box(0.12, 3.6, 0.12, m.lampPost, 0, 1.8, 0, lamp);
    box(0.4, 0.2, 0.4, m.lampPost, 0, 3.6, 0, lamp);
    box(0.3, 0.3, 0.3, m.hyggeGlow, 0, 3.45, 0, lamp, false);
    lamp.position.set(-3.2, 0, 0.5);
    layer.group.add(lamp);

    const lamp2 = lamp.clone();
    lamp2.position.set(3.2, 0, 0.5);
    layer.group.add(lamp2);

    // Dock bollards
    for (let x of [-3.5, -1.5, 1.5, 3.5]) {
      layer.boxMat(0.12, 0.45, 0.12, m.lampPost, x, 0.22, 1.2);
    }

    // Seagull
    const seagull = new THREE.Group();
    box(0.25, 0.06, 0.08, m.seagullWhite, 0, 0, 0, seagull, false);
    box(0.08, 0.04, 0.04, m.seagullWhite, 0.16, 0.02, 0, seagull, false);
    box(0.04, 0.04, 0.12, m.seagullWhite, -0.12, 0, 0, seagull, false);
    seagull.position.set(0, 5.5, 0);
    seagull.userData = { type: 'seagull', baseY: 5.5, phase: Math.random() * Math.PI * 2 };
    layer.group.add(seagull);
    this._particles.push(seagull);

    // Lights
    const lP = new THREE.PointLight(0xffaa44, 3.2, 6);
    lP.position.set(-3.2, 3.4, 0.5);
    lP.castShadow = true;
    lP.shadow.mapSize.width = 256;
    layer.group.add(lP);
    this._flickerLights.push({ light: lP, base: 3.0, speed: 2.0, amp: 0.15 });

    const lP2 = new THREE.PointLight(0xffaa44, 3.2, 6);
    lP2.position.set(3.2, 3.4, 0.5);
    layer.group.add(lP2);
    this._flickerLights.push({ light: lP2, base: 3.0, speed: 2.3, amp: 0.15 });

    const hP = new THREE.PointLight(0xff8822, 2.5, 6);
    hP.position.set(0, 2.0, -1.5);
    layer.group.add(hP);
    this._flickerLights.push({ light: hP, base: 2.4, speed: 4.5, amp: 0.3, noise: true });

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Harbor water shimmer
    const shimmer = createSurfaceShimmer(layer, 16, 0xffddaa, { x: 8, z: 8, y: -0.35 });
    this._particles.push(...shimmer);

    // Lamp glows
    const lampGlow1 = createLanternGlow(
      layer,
      new THREE.Vector3(-3.2, 3.45, 0.5),
      0xffbb44,
      0.8,
      4,
    );
    this._flickerLights.push({ light: lampGlow1.light, base: 0.7, speed: 4, amp: 0.1 });
    const lampGlow2 = createLanternGlow(layer, new THREE.Vector3(3.2, 3.45, 0.5), 0xffbb44, 0.8, 4);
    this._flickerLights.push({ light: lampGlow2.light, base: 0.7, speed: 4.5, amp: 0.1 });

    // Warm window glow point light
    const winLight = new THREE.PointLight(0xffbb44, 1.5, 5);
    winLight.position.set(0, 2.0, -1.5);
    layer.add(winLight);
    this._flickerLights.push({ light: winLight, base: 1.2, speed: 3, amp: 0.15, noise: true });

    // Dockside mist
    this._mistPuffs = createRisingPuffs(
      layer,
      6,
      0x8899aa,
      { x: 8, z: 8, yMin: 0.1, yMax: 1.2 },
      0.4,
    );
    for (const p of this._mistPuffs) {
      p.position.y = 0.15 + Math.random() * 0.8;
    }
    this._particles.push(...this._mistPuffs);

    // Snow
    const sg = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(sg, MaterialCache.getBasic(0xffffff));
      p.position.set(Math.random() * 10 - 5, Math.random() * 7 + 0.3, Math.random() * 10 - 5);
      p.userData = {
        type: 'snow',
        speedY: 0.018 + Math.random() * 0.012,
        driftX: (Math.random() - 0.5) * 0.004,
      };
      layer.add(p);
      this._particles.push(p);
    }

    // Chimney smoke from houses
    const smokeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const smokeMat = new THREE.MeshLambertMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.35,
    });
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
      const hx = -2.5 + Math.random() * 5;
      p.position.set(hx, 3.5 + Math.random() * 0.5, -2.4 + (Math.random() - 0.5) * 0.3);
      p.userData = {
        type: 'smoke',
        speedY: 0.01 + Math.random() * 0.01,
        swaySpeed: 0.8 + Math.random() * 1.2,
        swayAmp: 0.005 + Math.random() * 0.007,
        age: Math.random() * 2,
        maxLife: 2.0 + Math.random() * 0.8,
      };
      layer.add(p);
      this._particles.push(p);
      this._smokePuffs.push(p);
    }
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    // Waterfall
    this._waterfall?.update(time);

    // Water tiles
    for (const w of this._waterTiles) {
      w.position.y = w.userData.baseY + Math.sin(time * 1.5 + w.userData.phase) * 0.02;
    }

    updateRisingPuffs(time, this._mistPuffs);

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      } else if (ud.type === 'ship' && p instanceof THREE.Group) {
        p.rotation.z = Math.sin(time * 1.2 + ud.phase) * 0.02;
        p.rotation.x = Math.cos(time * 0.9 + ud.phase) * 0.015;
        p.position.y = -0.2 + Math.sin(time * 1.0 + ud.phase) * 0.03;
      } else if (ud.type === 'seagull' && p instanceof THREE.Group) {
        p.position.x += 0.012;
        p.position.y = ud.baseY + Math.sin(time * 2 + ud.phase) * 0.25;
        if (p.position.x > 6) p.position.x = -6;
      }
    }
  }

  update(dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'smoke') continue;
      if (!(p instanceof THREE.Mesh)) continue;
      p.position.y += ud.speedY;
      p.position.x += Math.sin(time * ud.swaySpeed) * ud.swayAmp;
      p.position.z += Math.cos(time * ud.swaySpeed) * ud.swayAmp;
      ud.age += dt;
      if (ud.age > ud.maxLife || p.position.y > 9) {
        p.position.set(-2.5 + Math.random() * 5, 3.5, -2.4 + (Math.random() - 0.5) * 0.3);
        ud.age = 0;
      }
    }
    for (const fl of this._flickerLights) {
      updateFlicker(time, fl);
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._mistPuffs = [];
    this._smokePuffs = [];
    this._waterTiles = [];
    this._ships = [];
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
