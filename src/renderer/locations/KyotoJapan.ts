// ===== src/renderer/locations/KyotoJapan.ts =====
// 🇯🇵 Kyoto — Sakura Shrine at Dusk with arched bridge, koi pond,
// stone lantern, maneki-neko calico cat, waterfall rim, and floating petals.
// Art upgraded to match the richer voxel diorama in voxel-showcase.html.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { Waterfall } from '../rendering/Waterfall';
import { CalicoCat } from '../rendering/CalicoCat';
import { MaterialCache } from '../rendering/MaterialCache';
import { VoxelBuilder } from '../rendering/VoxelBuilder';
import { LOCATIONS } from '../data/location-data';
import type { LocationData } from '../../shared/types';
import { createSurfaceShimmer, updateSurfaceShimmer, createLanternGlow } from './AtmosphereEffects';

export class KyotoJapan extends BaseLocation {
  readonly id = 'japan';
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
  private _koi: THREE.Group[] = [];
  private _cat: CalicoCat | null = null;
  private _toriiLight: THREE.PointLight | null = null;
  private _treeLight: THREE.PointLight | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'japan')!;
  }

  protected buildGeometry(): void {
    const m = {
      toriiRed: MaterialCache.getLambert(0xb03030),
      toriiDark: MaterialCache.getLambert(0x1a1a2e),
      sakura: MaterialCache.getLambert(0xe978b6),
      sakuraLight: MaterialCache.getLambert(0xffabd8),
      trunk: MaterialCache.getLambert(0x5c4033),
      stone: MaterialCache.getLambert(0x555560),
      lanternBody: MaterialCache.getLambert(0x4a4a5a),
      lanternGlow: MaterialCache.getBasic(0xffcc66),
      wood: MaterialCache.getLambert(0x5c4033),
      water: MaterialCache.getTransparentLambert(0x1a3a5a, 0.88),
      waterLight: MaterialCache.getTransparentLambert(0x2a5a8a, 0.78),
      waterSpark: MaterialCache.getBasic(0x9fdcff),
      koiOrange: MaterialCache.getBasic(0xff8844),
      koiWhite: MaterialCache.getBasic(0xffddcc),
      gold: MaterialCache.getLambert(0xcc9933),
      grass: MaterialCache.getLambert(0x3a6b4a),
      grassDark: MaterialCache.getLambert(0x2d5540),
    };

    // Warmer moss grass per art-review
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme
        ? { ...islandTheme, grass: 0x3a5a3a }
        : { stone: 0x889099, earth: 0x8a7a5a, grass: 0x3a5a3a },
    );
    this.group.add(island.group);

    const layer = new VoxelBuilder();
    layer.group.position.y = 1.5;
    this.group.add(layer.group);

    // ── Waterfall rim ──
    this._waterfall = new Waterfall({
      radius: 4.6,
      innerRadius: 4.0,
      yBase: -0.2,
      heightMin: 1.2,
      heightMax: 2.2,
      color: 0x66aadd,
      opacity: 0.65,
      density: 0.85,
    });
    this.group.add(this._waterfall.group);

    // ── Koi pond with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = 0.05;
    layer.group.add(waterGroup);
    for (let x = -3; x <= 3; x += 1) {
      for (let z = -3; z <= 3; z += 1) {
        if (Math.sqrt(x * x + z * z) > 3.3) continue;
        const mat = Math.random() > 0.5 ? m.water : m.waterLight;
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.95), mat);
        w.position.set(x, -0.1, z);
        w.receiveShadow = false;
        w.castShadow = false;
        w.userData = { baseY: -0.1, phase: Math.random() * Math.PI * 2 };
        waterGroup.add(w);
        this._waterTiles.push(w);
      }
    }
    // Sparkle strips on water
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 2.3;
      const sparkle = new THREE.Mesh(
        new THREE.BoxGeometry(0.34 + Math.random() * 0.25, 0.03, 0.08),
        m.waterSpark,
      );
      sparkle.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      sparkle.rotation.y = a + Math.PI * 0.5;
      sparkle.castShadow = false;
      sparkle.receiveShadow = false;
      waterGroup.add(sparkle);
    }

    // ── Torii Gate ──
    const torii = new THREE.Group();
    // Pillars
    layer.boxMat(0.5, 4.5, 0.5, m.toriiRed, -2.2, 2.25, 0);
    layer.boxMat(0.5, 4.5, 0.5, m.toriiRed, 2.2, 2.25, 0);
    // Lower lintel
    layer.boxMat(4.8, 0.4, 0.5, m.toriiRed, 0, 3.3, 0);
    // Upper lintel (kasagi)
    layer.boxMat(5.4, 0.5, 0.6, m.toriiDark, 0, 4.2, 0);
    // Plaque (gaku)
    layer.boxMat(1.2, 0.8, 0.3, m.toriiDark, 0, 3.8, 0);
    // Gold "soul" symbol
    layer.boxMat(0.3, 0.4, 0.05, m.gold, 0, 3.8, 0.16, { castShadow: false });
    torii.position.set(0, 0, -3.5);
    layer.group.add(torii);

    // Stone steps path leading to torii
    for (let i = 0; i < 6; i++) {
      const z = 2.2 - i * 0.85;
      const width = 1.2 + i * 0.08;
      layer.boxMat(width, 0.08, 0.45, m.stone, 0, 0.45, z, { castShadow: false });
    }

    // ── Cherry Blossom Tree ──
    const tree = new THREE.Group();
    const tb = new VoxelBuilder();
    tree.add(tb.group);
    tb.boxMat(0.7, 3.5, 0.7, m.trunk, 0, 1.75, 0);
    // Branches
    tb.boxMat(0.4, 1.5, 0.4, m.trunk, 0.8, 3, 0.5);
    tb.boxMat(0.4, 1.2, 0.4, m.trunk, -0.6, 3.2, -0.4);
    // Leaf clusters
    const leafClusters = [
      { w: 2.8, h: 1.5, d: 2.8, x: 0, y: 4, z: 0 },
      { w: 2, h: 1.1, d: 2, x: 0.9, y: 4.7, z: 0.7 },
      { w: 1.7, h: 1, d: 1.7, x: -0.8, y: 5, z: -0.45 },
      { w: 1.9, h: 1.1, d: 1.9, x: 0.45, y: 3.5, z: -0.9 },
      { w: 1.5, h: 0.8, d: 1.5, x: -1.1, y: 3.8, z: 0.5 },
    ];
    leafClusters.forEach((c) => {
      const mat = Math.random() > 0.4 ? m.sakura : m.sakuraLight;
      tb.boxMat(c.w, c.h, c.d, mat, c.x, c.y, c.z, { castShadow: false });
    });
    // Loose blossom voxels
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.15 + Math.random() * 1.75;
      const y = 3.25 + Math.random() * 2.35;
      const mat = Math.random() > 0.38 ? m.sakura : m.sakuraLight;
      tb.boxMat(
        0.22 + Math.random() * 0.12,
        0.14,
        0.22 + Math.random() * 0.12,
        mat,
        Math.cos(a) * r,
        y,
        Math.sin(a) * r,
        { castShadow: false },
      );
    }
    tree.position.set(4.2, 0, 2.1);
    layer.group.add(tree);

    // A second smaller tree on the opposite side for framing
    const tree2 = tree.clone();
    tree2.scale.set(0.75, 0.75, 0.75);
    tree2.position.set(-3.8, 0, 3.2);
    tree2.rotation.y = 0.4;
    layer.group.add(tree2);

    // ── Stone Lantern ──
    const lantern = new THREE.Group();
    layer.boxMat(0.7, 0.3, 0.7, m.stone, 0, 0.15, 0);
    layer.boxMat(0.5, 1.2, 0.5, m.lanternBody, 0, 0.9, 0);
    layer.boxMat(0.7, 0.2, 0.7, m.stone, 0, 1.6, 0);
    layer.boxMat(0.5, 0.6, 0.5, m.lanternGlow, 0, 1.95, 0, { castShadow: false });
    layer.boxMat(0.9, 0.3, 0.9, m.stone, 0, 2.35, 0);
    layer.boxMat(0.3, 0.3, 0.3, m.stone, 0, 2.65, 0);
    lantern.position.set(-3, 0, 1.5);
    layer.group.add(lantern);

    // ── Arched wooden bridge ──
    const bridge = new THREE.Group();
    layer.boxMat(3.2, 0.15, 1.0, m.wood, 0, 0.55, 0);
    layer.boxMat(0.25, 0.6, 0.8, m.wood, -1.2, 0.3, 0);
    layer.boxMat(0.25, 0.9, 0.8, m.wood, 0, 0.45, 0);
    layer.boxMat(0.25, 0.6, 0.8, m.wood, 1.2, 0.3, 0);
    layer.boxMat(3.2, 0.15, 0.1, m.wood, 0, 0.9, 0.45);
    layer.boxMat(3.2, 0.15, 0.1, m.wood, 0, 0.9, -0.45);
    bridge.position.set(0, 0, 1.8);
    layer.group.add(bridge);

    // ── Koi fish ──
    const koiConfigs = [
      { x: -0.8, z: 1.6, c: m.koiOrange },
      { x: 0.6, z: 2.0, c: m.koiWhite },
      { x: 0.2, z: 1.4, c: m.koiOrange },
      { x: -0.4, z: 2.2, c: m.koiWhite },
    ];
    koiConfigs.forEach((k) => {
      const koi = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.18), k.c);
      koi.add(body);
      koi.position.set(k.x, -0.05, k.z);
      koi.userData = { type: 'koi', baseX: k.x, baseZ: k.z, phase: Math.random() * Math.PI * 2 };
      waterGroup.add(koi);
      this._koi.push(koi);
      this._particles.push(koi);
    });

    // ── Calico Cat ──
    this._cat = new CalicoCat();
    this._cat.setPosition(-1.2, 0, 0.8);
    this._cat.setRotationY(0.5);
    layer.group.add(this._cat.group);

    // ── Scatter decorations ──
    // Small stones
    for (let i = 0; i < 8; i++) {
      const s = 0.2 + Math.random() * 0.3;
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 3;
      layer.boxMat(s, s * 0.6, s, m.stone, Math.cos(a) * r, 0.4, Math.sin(a) * r);
    }
    // Grass tufts
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 4;
      const mat = Math.random() > 0.3 ? m.grass : m.grassDark;
      layer.boxMat(
        0.08,
        0.3 + Math.random() * 0.2,
        0.08,
        mat,
        Math.cos(a) * r,
        0.5,
        Math.sin(a) * r,
        { castShadow: false },
      );
    }

    // ── Lighting ──
    const moonDir = new THREE.DirectionalLight(0x99aadd, 1.2);
    moonDir.position.set(8, 20, 8);
    moonDir.castShadow = true;
    moonDir.shadow.mapSize.width = 512;
    moonDir.shadow.mapSize.height = 512;
    this.scene.add(moonDir);

    // Lantern glow
    const lanternPoint = new THREE.PointLight(0xffaa44, 4, 12);
    lanternPoint.position.set(-3, 2.4, 1.5);
    lanternPoint.castShadow = true;
    layer.group.add(lanternPoint);
    this._flickerLights.push({ light: lanternPoint, base: 2.5, speed: 6, amp: 0.3 });

    // Torii warm light
    this._toriiLight = new THREE.PointLight(0xff6644, 2.5, 15);
    this._toriiLight.position.set(0, 3.5, -2);
    layer.group.add(this._toriiLight);
    this._flickerLights.push({ light: this._toriiLight, base: 1.2, speed: 2, amp: 0.3 });

    // Tree blossom light
    this._treeLight = new THREE.PointLight(0xff88aa, 1.5, 10);
    this._treeLight.position.set(4, 4.5, 2);
    layer.group.add(this._treeLight);
    this._flickerLights.push({ light: this._treeLight, base: 0.8, speed: 1.5, amp: 0.2 });

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Pond shimmer
    const shimmer = createSurfaceShimmer(layer, 14, 0xffb7c5, { x: 3.2, z: 2.4, y: 0.18 });
    for (const m of shimmer) {
      m.position.x += (Math.random() - 0.5) * 3.2;
      m.position.z += 1.8 + (Math.random() - 0.5) * 2.4;
    }
    this._particles.push(...shimmer);

    // Fireflies around the trees
    const fireflyGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xd8ff8a,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(fireflyGeo, fireflyMat.clone());
      p.position.set((Math.random() - 0.5) * 12, 1 + Math.random() * 5, (Math.random() - 0.5) * 12);
      p.userData = {
        type: 'firefly',
        baseX: p.position.x,
        baseY: p.position.y,
        baseZ: p.position.z,
        speed: 0.3 + Math.random() * 0.5,
        radius: 0.3 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      };
      layer.add(p);
      this._particles.push(p);
    }

    // Stone lantern glow mesh
    const lanternGlow = createLanternGlow(layer, new THREE.Vector3(-3, 1.1, 1.5), 0xffaa33, 1.2, 5);
    this._flickerLights.push({ light: lanternGlow.light, base: 1.0, speed: 6, amp: 0.15 });

    // Cherry Blossom Petals
    const petalGeo = new THREE.BoxGeometry(0.12, 0.04, 0.12);
    const petalMats = [MaterialCache.getLambert(0xe978b6), MaterialCache.getLambert(0xffabd8)];
    for (let i = 0; i < 60; i++) {
      const p = new THREE.Mesh(petalGeo, petalMats[Math.floor(Math.random() * petalMats.length)]);
      p.position.set(Math.random() * 14 - 7, 2 + Math.random() * 7, Math.random() * 14 - 7);
      p.userData = {
        type: 'fall',
        speedY: 0.015 + Math.random() * 0.02,
        drift: (Math.random() - 0.5) * 0.02,
        rotSpeed: Math.random() * 0.03,
      };
      layer.add(p);
      this._particles.push(p);
    }
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    // Animate waterfall
    this._waterfall?.update(time);

    // Animate water tiles
    for (const w of this._waterTiles) {
      w.position.y = w.userData.baseY + Math.sin(time * 2 + w.userData.phase) * 0.03;
    }

    // Animate cat
    this._cat?.update(time);

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer') {
        updateSurfaceShimmer(time, [p as THREE.Mesh]);
      } else if (ud.type === 'firefly') {
        p.position.x = ud.baseX + Math.sin(time * ud.speed + ud.phase) * ud.radius;
        p.position.y = ud.baseY + Math.sin(time * ud.speed * 0.7 + ud.phase) * 0.3;
        p.position.z = ud.baseZ + Math.cos(time * ud.speed * 0.5 + ud.phase) * ud.radius;
        p.visible = Math.sin(time * 3 + ud.phase) > -0.3;
      }
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'fall') {
        p.position.y -= ud.speedY;
        p.position.x += Math.sin(time + p.position.y) * 0.005 + ud.drift;
        p.rotation.x += ud.rotSpeed;
        p.rotation.z += ud.rotSpeed;
        if (p.position.y < 0.3) {
          p.position.y = 7 + Math.random() * 2;
          p.position.x = (Math.random() - 0.5) * 14;
          p.position.z = (Math.random() - 0.5) * 14;
        }
      } else if (ud.type === 'koi') {
        p.position.x = ud.baseX + Math.sin(time * 0.5 + ud.phase) * 0.25;
        p.position.z = ud.baseZ + Math.cos(time * 0.3 + ud.phase) * 0.15;
        (p as THREE.Group).rotation.y = Math.atan2(
          Math.cos(time * 0.5 + ud.phase) * 0.25,
          -Math.sin(time * 0.5 + ud.phase) * 0.15,
        );
      }
    }
    for (const fl of this._flickerLights) {
      let intensity = fl.base + Math.sin(time * fl.speed) * fl.amp;
      if (fl.noise) intensity += Math.cos(time * fl.speed * 1.5) * (fl.amp * 0.5);
      fl.light.intensity = intensity;
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._cat = null;
    this._waterTiles = [];
    this._koi = [];
    this._toriiLight = null;
    this._treeLight = null;
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
