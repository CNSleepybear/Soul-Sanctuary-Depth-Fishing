// ===== src/renderer/locations/ChinaBamboo.ts =====
// 🇨🇳 China — Bamboo Grove & Firefly Pond with pagoda tower, lotus pond,
// stone lanterns, fisherman, tabby cat, crescent moon and waterfall rim.
// Art upgraded to match the richer 翠竹流萤 voxel diorama reference.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { Waterfall } from '../rendering/Waterfall';
import { TabbyCat } from '../rendering/TabbyCat';
import { Fisherman } from '../rendering/Fisherman';
import { MaterialCache } from '../rendering/MaterialCache';
import { VoxelBuilder } from '../rendering/VoxelBuilder';
import { LOCATIONS } from '../data/location-data';
import type { LocationData } from '../../shared/types';
import {
  createSurfaceShimmer,
  updateSurfaceShimmer,
  createLanternGlow,
  createRisingPuffs,
  updateRisingPuffs,
} from './AtmosphereEffects';

export class ChinaBamboo extends BaseLocation {
  readonly id = 'china';
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
  private _pads: THREE.Mesh[] = [];
  private _mistPuffs: THREE.Mesh[] = [];
  private _cat: TabbyCat | null = null;
  private _fisherman: Fisherman | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'china')!;
  }

  protected buildGeometry(): void {
    const m = {
      rock: MaterialCache.getLambert(0x2d3040),
      stone: MaterialCache.getLambert(0x555a65),
      moss: MaterialCache.getLambert(0x2a4a32),
      grass: MaterialCache.getLambert(0x3a6b3a),
      grassDark: MaterialCache.getLambert(0x2d5540),
      bamboo: MaterialCache.getLambert(0x4a6e3a),
      bambooLight: MaterialCache.getLambert(0x4a8a4a),
      bambooJoint: MaterialCache.getLambert(0x5a8a5a),
      wood: MaterialCache.getLambert(0x5c4033),
      woodDark: MaterialCache.getLambert(0x3a2a20),
      roof: MaterialCache.getLambert(0x4a4038),
      roofDark: MaterialCache.getLambert(0x3a3028),
      chinaRed: MaterialCache.getLambert(0xb03030),
      gold: MaterialCache.getLambert(0xbfa15f),
      glow: MaterialCache.getBasic(0xffcc66),
      lanternBody: MaterialCache.getLambert(0x4a4a5a),
      windowGlow: MaterialCache.getBasic(0xffe2a0),
      water: MaterialCache.getTransparentLambert(0x1a3a5a, 0.88),
      waterLight: MaterialCache.getTransparentLambert(0x2a5a8a, 0.78),
      waterSpark: MaterialCache.getBasic(0x9fdcff),
      koiOrange: MaterialCache.getBasic(0xe87030),
      koiWhite: MaterialCache.getBasic(0xf5f0e8),
      lilyPad: MaterialCache.getLambert(0x2a5a3a),
      lilyFlower: MaterialCache.getBasic(0xff88aa),
      moon: MaterialCache.getBasic(0xfff8dd),
      moonCut: MaterialCache.getBasic(0x0a0a12),
      firefly: MaterialCache.getBasic(0xd8ff8a),
    };

    // Theme-aware floating island with warmer moss grass
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme
        ? { ...islandTheme, grass: 0x3a5a3a }
        : { stone: 0x6a7a6a, earth: 0x5a4a3a, grass: 0x3a5a3a },
    );
    this.group.add(island.group);

    const layer = new VoxelBuilder();
    layer.group.position.y = 1.5;
    this.group.add(layer.group);

    // Raw box helper for grouped objects (tower, lanterns, moon)
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
      heightMin: 1.2,
      heightMax: 2.2,
      color: 0x66aadd,
      opacity: 0.65,
      density: 0.85,
    });
    this.group.add(this._waterfall.group);

    // ── Lotus pond with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = 0.05;
    layer.group.add(waterGroup);
    for (let x = -4; x <= 4; x += 1) {
      for (let z = -4; z <= 4; z += 1) {
        if (Math.sqrt(x * x + z * z) > 4.3) continue;
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
    // Sparkle strips
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 3.2;
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

    // ── Lotus pads and flowers ──
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 3;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 + Math.random() * 0.4, 0.05, 0.8 + Math.random() * 0.4),
        m.lilyPad,
      );
      pad.position.set(px, -0.05, pz);
      pad.userData = { baseY: -0.05, phase: Math.random() * Math.PI * 2 };
      pad.castShadow = false;
      pad.receiveShadow = false;
      waterGroup.add(pad);
      this._pads.push(pad);
      if (Math.random() > 0.5) {
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), m.lilyPad);
        stem.position.set(px, 0.1, pz);
        stem.castShadow = false;
        waterGroup.add(stem);
        const bloom = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), m.lilyFlower);
        bloom.position.set(px, 0.22, pz);
        bloom.castShadow = false;
        waterGroup.add(bloom);
      }
    }

    // ── Koi fish ──
    const koiConfigs = [
      { x: -0.8, z: 1.6, c: m.koiOrange },
      { x: 0.6, z: 2.0, c: m.koiWhite },
      { x: 0.2, z: 1.4, c: m.koiOrange },
      { x: -0.4, z: 2.2, c: m.koiWhite },
    ];
    koiConfigs.forEach((k) => {
      const koi = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.12), k.c);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.02), k.c);
      tail.position.set(-0.25, 0, 0);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), k.c);
      fin.position.set(0.22, 0.02, 0);
      koi.add(body, tail, fin);
      koi.position.set(k.x, -0.05, k.z);
      koi.userData = { type: 'koi', baseX: k.x, baseZ: k.z, phase: Math.random() * Math.PI * 2 };
      waterGroup.add(koi);
      this._koi.push(koi);
      this._particles.push(koi);
    });

    // ── Bamboo forest ──
    const bambooGroup = new THREE.Group();
    const createBamboo = (x: number, z: number, height: number, tilt: number) => {
      const b = new THREE.Group();
      const segments = Math.floor(height / 0.8);
      for (let i = 0; i < segments; i++) {
        const mat = i % 2 === 0 ? m.bamboo : m.bambooLight;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.35), mat);
        seg.position.set(0, i * 0.8 + 0.35, 0);
        seg.castShadow = true;
        b.add(seg);
        // Joint
        const joint = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), m.bambooJoint);
        joint.position.set(0, i * 0.8 + 0.05, 0);
        joint.castShadow = false;
        b.add(joint);
      }
      // Leaf clusters
      for (let i = 0; i < 5; i++) {
        const ly = height - 0.5 - Math.random() * 1.5;
        const lx = (Math.random() - 0.5) * 1.2;
        const lz = (Math.random() - 0.5) * 1.2;
        const leafA = new THREE.Mesh(
          new THREE.BoxGeometry(0.6 + Math.random() * 0.4, 0.08, 0.15),
          m.bambooLight,
        );
        leafA.position.set(lx, ly, lz);
        leafA.rotation.y = Math.random() * Math.PI;
        leafA.castShadow = false;
        const leafB = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.08, 0.6 + Math.random() * 0.4),
          m.bambooLight,
        );
        leafB.position.set(lx, ly + 0.1, lz);
        leafB.rotation.y = Math.random() * Math.PI;
        leafB.castShadow = false;
        b.add(leafA, leafB);
      }
      b.position.set(x, 0.05, z);
      b.rotation.z = tilt * 0.05;
      b.rotation.x = tilt * 0.03;
      bambooGroup.add(b);
    };
    // Outer bamboo ring (kept inside solid inner 70% of island, radius < 5.5)
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.2 + Math.random() * 1.8;
      createBamboo(Math.cos(a) * r, Math.sin(a) * r, 5 + Math.random() * 4, Math.random() - 0.5);
    }
    // Inner accents
    createBamboo(-3.2, -2.2, 5, 0.2);
    createBamboo(3, -1.5, 6, -0.1);
    createBamboo(-2.8, 3.2, 4.5, 0.3);
    layer.group.add(bambooGroup);

    // ── Hexagonal pavilion in bamboo clearing ──
    const pavilion = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(0.12, 1.6, 0.12, m.woodDark, Math.cos(a) * 0.9, 0.8, Math.sin(a) * 0.9, pavilion);
    }
    box(2.2, 0.1, 2.2, m.roof, 0, 1.7, 0, pavilion);
    box(1.6, 0.1, 1.6, m.roofDark, 0, 1.85, 0, pavilion);
    box(1.0, 0.1, 1.0, m.roof, 0, 1.98, 0, pavilion);
    box(0.08, 0.4, 0.08, m.gold, 0, 2.25, 0, pavilion, false);
    // Pavilion benches
    box(1.4, 0.12, 0.4, m.wood, 0, 0.4, 0, pavilion);
    box(0.4, 0.12, 1.4, m.wood, 0, 0.4, 0, pavilion);
    pavilion.position.set(-2.5, 0, 2.5);
    layer.group.add(pavilion);

    // ── Chinese pagoda tower ──
    const tower = new THREE.Group();
    // Base platform
    box(4, 0.5, 4, m.stone, 0, 0.25, 0, tower);
    // First floor
    box(3, 2.5, 3, m.woodDark, 0, 1.75, 0, tower);
    // First eaves
    box(4, 0.3, 4, m.roof, 0, 3.15, 0, tower);
    box(3.5, 0.2, 3.5, m.roofDark, 0, 3.4, 0, tower);
    // First floor windows
    box(0.5, 0.8, 0.1, m.windowGlow, -0.8, 2, 1.51, tower, false);
    box(0.5, 0.8, 0.1, m.windowGlow, 0.8, 2, 1.51, tower, false);
    box(0.1, 0.8, 0.5, m.windowGlow, 1.51, 2, -0.8, tower, false);
    box(0.1, 0.8, 0.5, m.windowGlow, 1.51, 2, 0.8, tower, false);
    // Second floor
    box(2.2, 2, 2.2, m.wood, 0, 4.4, 0, tower);
    box(3.2, 0.25, 3.2, m.roof, 0, 5.5, 0, tower);
    box(2.8, 0.2, 2.8, m.roofDark, 0, 5.72, 0, tower);
    box(0.4, 0.6, 0.1, m.windowGlow, 0, 4.5, 1.11, tower, false);
    // Third floor
    box(1.5, 1.5, 1.5, m.woodDark, 0, 6.5, 0, tower);
    box(2.2, 0.2, 2.2, m.roof, 0, 7.35, 0, tower);
    box(1.8, 0.15, 1.8, m.roofDark, 0, 7.55, 0, tower);
    // Spire
    box(0.3, 1.2, 0.3, m.wood, 0, 8.2, 0, tower);
    box(0.6, 0.1, 0.6, m.roof, 0, 8.8, 0, tower);
    tower.position.set(3, 0.4, -3);
    layer.group.add(tower);

    // ── Stone lanterns ──
    const makeStoneLantern = (lx: number, lz: number) => {
      const sl = new THREE.Group();
      box(0.6, 0.3, 0.6, m.stone, 0, 0.15, 0, sl);
      box(0.4, 1, 0.4, m.lanternBody, 0, 0.8, 0, sl);
      box(0.6, 0.15, 0.6, m.stone, 0, 1.4, 0, sl);
      box(0.35, 0.5, 0.35, m.glow, 0, 1.75, 0, sl, false);
      box(0.7, 0.2, 0.7, m.stone, 0, 2.1, 0, sl);
      box(0.2, 0.3, 0.2, m.stone, 0, 2.35, 0, sl);
      sl.position.set(lx, 0, lz);
      return sl;
    };
    layer.group.add(makeStoneLantern(-3.5, 1));
    layer.group.add(makeStoneLantern(1.5, 3.5));
    layer.group.add(makeStoneLantern(-1, -3.5));

    // ── Fisherman ──
    this._fisherman = new Fisherman();
    this._fisherman.group.position.set(-0.5, 0.4, 1.5);
    this._fisherman.group.rotation.y = -0.3;
    layer.group.add(this._fisherman.group);

    // ── Tabby cat ──
    this._cat = new TabbyCat();
    this._cat.setPosition(-1.3, 0.4, 0.8);
    this._cat.setRotationY(0.5);
    layer.group.add(this._cat.group);

    // ── Crescent moon ──
    const moon = new THREE.Group();
    box(0.6, 0.8, 0.15, m.moon, 0, 0, 0, moon, false);
    box(0.5, 0.6, 0.15, m.moon, 0.1, 0.1, 0, moon, false);
    box(0.4, 0.4, 0.15, m.moon, 0.2, 0.2, 0, moon, false);
    // Crescent cut
    box(0.35, 0.5, 0.16, m.moonCut, 0.25, 0.15, 0, moon, false);
    moon.position.set(-8, 16, -12);
    layer.group.add(moon);

    // ── Scatter decorations ──
    // Small stones
    for (let i = 0; i < 10; i++) {
      const s = 0.2 + Math.random() * 0.3;
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 4;
      layer.boxMat(s, s * 0.5, s, m.stone, Math.cos(a) * r, 0.4, Math.sin(a) * r);
    }
    // Grass tufts
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 4.5;
      const mat = Math.random() > 0.3 ? m.grass : m.grassDark;
      layer.boxMat(
        0.06,
        0.25 + Math.random() * 0.2,
        0.06,
        mat,
        Math.cos(a) * r,
        0.5,
        Math.sin(a) * r,
        { castShadow: false },
      );
    }

    // ── Lighting ──
    // Cool moonlight from the crescent
    const moonDir = new THREE.DirectionalLight(0x99aadd, 1.0);
    moonDir.position.set(-8, 20, -10);
    moonDir.castShadow = true;
    moonDir.shadow.mapSize.width = 512;
    moonDir.shadow.mapSize.height = 512;
    this.scene.add(moonDir);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x4466aa, 0.5);
    fillLight.position.set(10, 10, 5);
    this.scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x6644aa, 0.5);
    rimLight.position.set(-10, 5, -10);
    this.scene.add(rimLight);

    // Tower warm light
    const towerLight = new THREE.PointLight(0xffc070, 4, 15);
    towerLight.position.set(3, 5, -3);
    towerLight.castShadow = true;
    towerLight.shadow.mapSize.width = 128;
    layer.group.add(towerLight);
    this._flickerLights.push({ light: towerLight, base: 3.4, speed: 5, amp: 0.25, noise: true });

    // Water glow
    const waterGlow = new THREE.PointLight(0x66c8ff, 2.0, 10);
    waterGlow.position.set(0, -1, 0);
    layer.group.add(waterGlow);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Pond shimmer
    const shimmer = createSurfaceShimmer(layer, 14, 0x88ffcc, { x: 3.6, z: 3.2, y: 0.18 });
    for (const s of shimmer) {
      s.position.x += (Math.random() - 0.5) * 3.6;
      s.position.z += 1.5 + (Math.random() - 0.5) * 2.6;
    }
    this._particles.push(...shimmer);

    // Lantern glows
    const lanternGlow1 = createLanternGlow(
      layer,
      new THREE.Vector3(-3.5, 2.2, 1),
      0xffaa33,
      1.2,
      5,
    );
    this._flickerLights.push({
      light: lanternGlow1.light,
      base: 1.0,
      speed: 6,
      amp: 0.15,
      noise: true,
    });
    const lanternGlow2 = createLanternGlow(
      layer,
      new THREE.Vector3(1.5, 2.2, 3.5),
      0xffaa33,
      1.2,
      5,
    );
    this._flickerLights.push({
      light: lanternGlow2.light,
      base: 1.0,
      speed: 5.5,
      amp: 0.15,
      noise: true,
    });
    const lanternGlow3 = createLanternGlow(
      layer,
      new THREE.Vector3(-1, 2.2, -3.5),
      0xffaa33,
      1.2,
      5,
    );
    this._flickerLights.push({
      light: lanternGlow3.light,
      base: 1.0,
      speed: 6.5,
      amp: 0.15,
      noise: true,
    });

    // Ground mist layers (3-4 depth planes)
    this._mistPuffs = createRisingPuffs(
      layer,
      10,
      0x88aabb,
      { x: 10, z: 10, yMin: 0.2, yMax: 1.0 },
      0.35,
    );
    for (const p of this._mistPuffs) {
      p.position.y = 0.2 + Math.random() * 0.6;
    }
    this._particles.push(...this._mistPuffs);

    // Fireflies
    const fireflyGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xd8ff8a,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 35; i++) {
      const p = new THREE.Mesh(fireflyGeo, fireflyMat.clone());
      p.position.set(
        (Math.random() - 0.5) * 15,
        1.2 + Math.random() * 5.8,
        (Math.random() - 0.5) * 15,
      );
      p.userData = {
        type: 'firefly',
        baseX: p.position.x,
        baseY: p.position.y,
        baseZ: p.position.z,
        speed: 0.3 + Math.random() * 0.5,
        radius: 0.35 + Math.random() * 1.6,
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
      w.position.y = w.userData.baseY + Math.sin(time * 2 + w.userData.phase) * 0.03;
    }

    updateRisingPuffs(time, this._mistPuffs);

    // Lotus pads
    for (const p of this._pads) {
      p.position.y = p.userData.baseY + Math.sin(time * 1.5 + p.userData.phase) * 0.02;
      p.rotation.y = Math.sin(time * 0.5 + p.userData.phase) * 0.1;
    }

    // Cat
    this._cat?.update(time);

    // Fisherman
    this._fisherman?.update(time);

    // Particles
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
      if (ud.type === 'koi') {
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
    this._fisherman = null;
    this._waterTiles = [];
    this._koi = [];
    this._pads = [];
    this._mistPuffs = [];
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
