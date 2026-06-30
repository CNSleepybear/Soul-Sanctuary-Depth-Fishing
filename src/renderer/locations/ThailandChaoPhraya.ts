// ===== src/renderer/locations/ThailandChaoPhraya.ts =====
// 🇹🇭 Thailand — Chao Phraya Floating Lanterns with golden temple, chedi,
// Buddha, spirit house, river water, krathongs, sky lanterns, long-tail boats and fireflies.
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

export class ThailandChaoPhraya extends BaseLocation {
  readonly id = 'thailand';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _waterfall: Waterfall | null = null;
  private _waterTiles: THREE.Mesh[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'thailand')!;
  }

  protected buildGeometry(): void {
    const m = {
      teakWood: MaterialCache.getLambert(0x3d2015),
      thaiGold: MaterialCache.getLambert(0xcca625),
      goldGlow: MaterialCache.getBasic(0xffd700),
      roofOrange: MaterialCache.getLambert(0xb54516),
      roofGreen: MaterialCache.getLambert(0x215438),
      lanternOrange: MaterialCache.getBasic(0xff8c1a),
      krathongLeaf: MaterialCache.getLambert(0x3d7331),
      templeWhite: MaterialCache.getLambert(0xeee8d5),
      water: MaterialCache.getTransparentLambert(0x1a2a20, 0.78),
      waterLight: MaterialCache.getTransparentLambert(0x2a3a30, 0.68),
      elephantGrey: MaterialCache.getLambert(0x6a6a6a),
      lotusLeaf: MaterialCache.getLambert(0x3d7331),
      lotusPink: MaterialCache.getBasic(0xff66aa),
      lanternDeep: MaterialCache.getBasic(0xff6600),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x7a8a6a, earth: 0x6a7a5a, grass: 0x5a8a4a },
    );
    island.group.position.set(0, 0, 0.5);
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
      color: 0x2a3a30,
      opacity: 0.6,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // ── River water with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = -0.45;
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

    // Wat temple
    const house = new THREE.Group();
    [
      { x: -1.2, z: -1.2 },
      { x: 0, z: -1.2 },
      { x: 1.2, z: -1.2 },
      { x: -1.2, z: 1.2 },
      { x: 0, z: 1.2 },
      { x: 1.2, z: 1.2 },
    ].forEach((pos) => box(0.15, 1.4, 0.15, m.teakWood, pos.x, 0.7, pos.z, house));
    box(2.6, 1.6, 2.6, m.templeWhite, 0, 1.4 + 0.8, 0, house);
    [
      { w: 3.2, h: 0.25, d: 3.0, y: 3.0, mat: m.roofGreen },
      { w: 2.6, h: 0.3, d: 2.8, y: 3.25, mat: m.roofOrange },
      { w: 1.8, h: 0.3, d: 2.8, y: 3.55, mat: m.roofOrange },
      { w: 1, h: 0.3, d: 2.8, y: 3.85, mat: m.roofOrange },
      { w: 0.3, h: 0.4, d: 2.8, y: 4.15, mat: m.thaiGold },
    ].forEach((l) => box(l.w, l.h, l.d, l.mat, 0, l.y, 0, house));
    // Gold roof trim
    box(0.1, 0.05, 3.2, m.thaiGold, 0, 3.12, 0, house, false);
    box(0.1, 0.05, 2.9, m.thaiGold, 0, 3.42, 0, house, false);
    box(0.1, 0.05, 2.9, m.thaiGold, 0, 3.72, 0, house, false);
    box(0.1, 0.05, 2.9, m.thaiGold, 0, 4.02, 0, house, false);
    box(0.15, 0.5, 0.8, m.teakWood, 0, 1.35, 1.7, house);
    box(0.8, 0.9, 0.1, m.lanternOrange, 0, 2.1, 1.31, house, false);
    // Temple facade: golden window frames + wooden door to break plain white wall
    [
      { x: -0.7, y: 2.0 },
      { x: 0.7, y: 2.0 },
      { x: -0.7, y: 1.0 },
      { x: 0.7, y: 1.0 },
    ].forEach((p) => box(0.22, 0.32, 0.06, m.thaiGold, p.x, p.y, 1.31, house, false));
    box(0.35, 0.9, 0.06, m.teakWood, 0, 0.85, 1.31, house, false);
    house.position.set(-2, 0, -1.5);
    layer.group.add(house);

    // Golden chedi
    const chedi = new THREE.Group();
    [
      { w: 2.8, h: 0.5, y: 0.25 },
      { w: 2.2, h: 0.5, y: 0.75 },
      { w: 1.7, h: 0.6, y: 1.3 },
      { w: 1.3, h: 0.5, y: 1.85 },
      { w: 0.9, h: 0.5, y: 2.35 },
      { w: 0.6, h: 0.4, y: 2.8 },
      { w: 0.4, h: 0.4, y: 3.2 },
      { w: 0.2, h: 0.6, y: 3.7 },
    ].forEach((l, idx) => {
      const mat = idx > 4 ? m.goldGlow : m.thaiGold;
      box(l.w, l.h, l.w, mat, 0, l.y, 0, chedi, false);
    });
    chedi.position.set(2.2, 0, -1.8);
    layer.group.add(chedi);

    // Seated golden Buddha silhouette
    const buddha = new THREE.Group();
    box(0.5, 0.15, 0.35, m.thaiGold, 0, 0.075, 0, buddha, false);
    box(0.4, 0.55, 0.25, m.thaiGold, 0, 0.45, 0, buddha, false);
    box(0.25, 0.25, 0.25, m.thaiGold, 0, 0.85, 0, buddha, false);
    buddha.position.set(0, 0, 1.8);
    layer.group.add(buddha);

    // Spirit house
    const spirit = new THREE.Group();
    box(0.15, 0.7, 0.15, m.teakWood, 0, 0.35, 0, spirit);
    box(0.6, 0.08, 0.6, m.teakWood, 0, 0.74, 0, spirit);
    box(0.55, 0.55, 0.55, m.templeWhite, 0, 1.05, 0, spirit);
    box(0.65, 0.1, 0.65, m.roofOrange, 0, 1.38, 0, spirit);
    box(0.15, 0.35, 0.15, m.thaiGold, 0, 1.6, 0, spirit, false);
    spirit.position.set(1.6, 0, 1.4);
    layer.group.add(spirit);

    // Small elephant
    const elephant = new THREE.Group();
    box(0.7, 0.5, 0.45, m.elephantGrey, 0, 0.25, 0, elephant);
    box(0.35, 0.35, 0.35, m.elephantGrey, 0.45, 0.45, 0.1, elephant);
    box(0.08, 0.35, 0.08, m.elephantGrey, -0.25, 0.18, 0.2, elephant);
    box(0.08, 0.35, 0.08, m.elephantGrey, -0.25, 0.18, -0.2, elephant);
    box(0.08, 0.35, 0.08, m.elephantGrey, 0.25, 0.18, 0.2, elephant);
    box(0.08, 0.35, 0.08, m.elephantGrey, 0.25, 0.18, -0.2, elephant);
    box(0.1, 0.1, 0.25, m.elephantGrey, 0.7, 0.25, 0.1, elephant);
    elephant.position.set(-3, 0, 2.5);
    elephant.rotation.y = 0.3;
    layer.group.add(elephant);

    // Lights
    const cp = new THREE.PointLight(0xffb833, 3.0, 7);
    cp.position.set(2.2, 2.0, -1.8);
    cp.castShadow = true;
    cp.shadow.mapSize.width = 256;
    layer.group.add(cp);
    this._flickerLights.push({ light: cp, base: 2.6, speed: 2.5, amp: 0.3 });

    const hp = new THREE.PointLight(0xff7d1a, 2.2, 5);
    hp.position.set(-2, 2.1, -0.2);
    layer.group.add(hp);
    this._flickerLights.push({ light: hp, base: 2.0, speed: 4.0, amp: 0.2 });

    // Lotus leaves and flowers on the river
    for (let i = 0; i < 8; i++) {
      const lotus = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.55), m.lotusLeaf);
      leaf.position.y = 0;
      lotus.add(leaf);
      if (Math.random() > 0.4) {
        const flower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), m.lotusPink);
        flower.position.y = 0.1;
        lotus.add(flower);
      }
      const lx = Math.random() * 6 - 3;
      const lz = Math.random() * 6 - 3;
      lotus.position.set(lx, -0.38, lz);
      lotus.userData = {
        type: 'lotus',
        baseX: lx,
        baseZ: lz,
        phase: Math.random() * Math.PI * 2,
      };
      waterGroup.add(lotus);
      this._particles.push(lotus);
    }

    // Long-tail boats
    for (let i = 0; i < 3; i++) {
      const boat = new THREE.Group();
      boat.userData = { type: 'boat', baseX: 0, baseZ: 0, phase: Math.random() * Math.PI * 2 };
      box(1.4, 0.12, 0.28, m.teakWood, 0, 0.06, 0, boat);
      box(0.06, 0.7, 0.06, m.teakWood, -0.65, 0.35, 0, boat);
      box(0.35, 0.06, 0.06, m.teakWood, -0.85, 0.7, 0, boat);
      const bx = Math.random() * 7 - 3.5;
      const bz = Math.random() * 7 - 3.5;
      boat.position.set(bx, -0.35, bz);
      boat.rotation.y = Math.random() * Math.PI * 2;
      boat.userData.baseX = bx;
      boat.userData.baseZ = bz;
      waterGroup.add(boat);
      this._particles.push(boat);
    }

    // Krathongs
    for (let i = 0; i < 30; i++) {
      const kg = new THREE.Group();
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.08, 0.25),
        MaterialCache.getLambert(0x3d7331),
      );
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      kg.add(leaf);
      const candle = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.15, 0.1),
        MaterialCache.getBasic(0xff8c1a),
      );
      candle.position.set(0, 0.1, 0);
      candle.castShadow = false;
      kg.add(candle);
      const kx = Math.random() * 7 - 3.5;
      const kz = Math.random() * 7 - 3.5;
      kg.position.set(kx, -0.38, kz);
      kg.userData = {
        type: 'krathong',
        baseX: kx,
        baseZ: kz,
        driftSpeed: 0.015 + Math.random() * 0.015,
        waveSpeed: 1.5 + Math.random() * 1.5,
        waveAmp: 0.015 + Math.random() * 0.01,
        sinOffset: Math.random() * 10,
      };
      waterGroup.add(kg);
      this._particles.push(kg);
    }

    // Sky lanterns
    for (let i = 0; i < 14; i++) {
      const lg = new THREE.Group();
      const isDeep = Math.random() < 0.3;
      const lanternColor = isDeep ? 0xff6600 : 0xff8c1a;
      const lanternMat = isDeep ? m.lanternDeep : MaterialCache.getBasic(0xff8c1a);
      const lanternMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), lanternMat);
      lanternMesh.castShadow = false;
      lg.add(lanternMesh);
      const lp = new THREE.PointLight(lanternColor, isDeep ? 0.9 : 0.7, 3);
      lp.position.set(0, 0, 0);
      lg.add(lp);
      lg.position.set(Math.random() * 8 - 4, Math.random() * 3 + 0.8, Math.random() * 8 - 4);
      lg.userData = {
        type: 'lantern',
        speedY: 0.008 + Math.random() * 0.008,
        driftX: (Math.random() - 0.5) * 0.004,
        driftZ: (Math.random() - 0.5) * 0.004,
        resetY: 6 + Math.random() * 2,
      };
      layer.add(lg);
      this._particles.push(lg);
    }

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // River candlelight reflections
    const shimmer = createSurfaceShimmer(layer, 18, 0xffaa44, { x: 9, z: 9, y: -0.35 });
    this._particles.push(...shimmer);

    // Temple golden glint
    const chediGlint = createLanternGlow(
      layer,
      new THREE.Vector3(2.2, 3.7, -1.8),
      0xffd700,
      0.8,
      3,
    );
    this._flickerLights.push({ light: chediGlint.light, base: 0.6, speed: 3.5, amp: 0.15 });
    this._particles.push(chediGlint.mesh);

    // Fireflies
    const fireflyGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xd8ff8a,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(fireflyGeo, fireflyMat.clone());
      p.position.set(
        (Math.random() - 0.5) * 10,
        0.5 + Math.random() * 4,
        (Math.random() - 0.5) * 10,
      );
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
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    // Waterfall
    this._waterfall?.update(time);

    // Water tiles
    for (const w of this._waterTiles) {
      w.position.y = w.userData.baseY + Math.sin(time * 1.2 + w.userData.phase) * 0.02;
    }

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      } else if (ud.type === 'boat' && p instanceof THREE.Group) {
        p.position.x = ud.baseX + Math.sin(time * 0.2 + ud.phase) * 0.15;
        p.position.z = ud.baseZ + Math.cos(time * 0.15 + ud.phase) * 0.1;
        p.rotation.z = Math.sin(time * 0.8 + ud.phase) * 0.02;
      }
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'krathong') {
        p.position.z += ud.driftSpeed;
        p.position.x = ud.baseX + Math.sin(time * ud.waveSpeed + ud.sinOffset) * 0.15;
        p.position.y = -0.38 + Math.cos(time * ud.waveSpeed * 0.8 + ud.sinOffset) * ud.waveAmp;
        if (p.position.z > 4.5) {
          p.position.z = -4 - Math.random() * 2;
          const nx = Math.random() * 7 - 3.5;
          p.position.x = nx;
          ud.baseX = nx;
        }
      } else if (ud.type === 'lantern') {
        p.position.y += ud.speedY;
        p.position.x += ud.driftX + Math.sin(time * 0.8 + ud.resetY) * 0.002;
        p.position.z += ud.driftZ + Math.cos(time * 0.6 + ud.resetY) * 0.002;
        if (p.position.y > ud.resetY) {
          p.position.y = 0.8;
          p.position.x = Math.random() * 8 - 4;
          p.position.z = Math.random() * 8 - 4;
        }
      } else if (ud.type === 'firefly') {
        p.position.x = ud.baseX + Math.sin(time * ud.speed + ud.phase) * ud.radius;
        p.position.y = ud.baseY + Math.sin(time * ud.speed * 0.7 + ud.phase) * 0.3;
        p.position.z = ud.baseZ + Math.cos(time * ud.speed * 0.5 + ud.phase) * ud.radius;
        p.visible = Math.sin(time * 3 + ud.phase) > -0.3;
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
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
