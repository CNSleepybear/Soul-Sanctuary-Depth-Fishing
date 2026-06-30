// ===== src/renderer/locations/FranceSeine.ts =====
// 🇫🇷 France — Autumn Leaves on the Seine with café terrace, Eiffel Tower,
// Notre-Dame silhouette, maple trees, Seine water, drifting boat and wind-blown leaves.
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

export class FranceSeine extends BaseLocation {
  readonly id = 'france';
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
  private _boat: THREE.Group | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'france')!;
  }

  protected buildGeometry(): void {
    const m = {
      cafeWall: MaterialCache.getLambert(0xded0bc),
      parisGreen: MaterialCache.getLambert(0x1c3127),
      awningBlue: MaterialCache.getLambert(0x1b2d4a),
      awningWhite: MaterialCache.getLambert(0xeae5da),
      iron: MaterialCache.getLambert(0x7a6a5a),
      woodDark: MaterialCache.getLambert(0x3d271d),
      warmGlow: MaterialCache.getBasic(0xffdf9e),
      leafGold: MaterialCache.getLambert(0xc4873b),
      leafOrange: MaterialCache.getLambert(0xc45e2b),
      leafRed: MaterialCache.getLambert(0xa0302a),
      water: MaterialCache.getTransparentLambert(0x1a2a30, 0.78),
      waterLight: MaterialCache.getTransparentLambert(0x2a3a4a, 0.68),
      waterSpark: MaterialCache.getBasic(0x9fdcff),
      boatHull: MaterialCache.getLambert(0x4a3028),
      boatWhite: MaterialCache.getLambert(0xf0ece0),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x8a8a7a, earth: 0x6a5a4a, grass: 0x5a6a3a },
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

    // ── Seine water with animated tiles ──
    const waterGroup = new THREE.Group();
    waterGroup.position.y = -0.55;
    layer.group.add(waterGroup);
    for (let x = -4; x <= 4; x += 1) {
      for (let z = -4; z <= 3; z += 1) {
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
    // Sparkle strips
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 3.5;
      const sparkle = new THREE.Mesh(
        new THREE.BoxGeometry(0.34 + Math.random() * 0.25, 0.03, 0.08),
        m.waterSpark,
      );
      sparkle.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r + 1);
      sparkle.rotation.y = a + Math.PI * 0.5;
      sparkle.castShadow = false;
      sparkle.receiveShadow = false;
      waterGroup.add(sparkle);
    }

    // Café (left side)
    const cafe = new THREE.Group();
    box(5, 5, 3.5, m.cafeWall, 0, 2.5, 0, cafe);
    box(5.1, 0.8, 3.6, m.woodDark, 0, 0.4, 0, cafe);
    box(2.2, 1.6, 0.1, m.warmGlow, 0.6, 1.8, 1.76, cafe, false);
    box(2.3, 1.7, 0.05, m.woodDark, 0.6, 1.8, 1.78, cafe);
    box(1, 2.1, 0.1, m.woodDark, -1.4, 1.05, 1.76, cafe);
    const awning = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const mat = i % 2 === 0 ? m.awningBlue : m.awningWhite;
      const s = box(0.35, 0.2, 1.8, mat, -1.22 + i * 0.35, 3.2, 2.4, awning);
      s.rotation.x = 0.3;
    }
    cafe.add(awning);
    cafe.position.set(-2.5, 0, 0);
    layer.group.add(cafe);

    // Lamp post (right side)
    const lamp = new THREE.Group();
    box(0.16, 4.4, 0.16, m.parisGreen, 0, 2.2, 0, lamp);
    box(0.4, 0.9, 0.4, m.parisGreen, 0, 0.45, 0, lamp);
    box(1.4, 0.15, 0.16, m.parisGreen, 0, 4.1, 0, lamp);
    const cap = (isLeft: boolean) => {
      const h = new THREE.Group();
      box(0.35, 0.4, 0.35, m.warmGlow, 0, -0.2, 0, h, false);
      box(0.45, 0.12, 0.45, m.parisGreen, 0, 0.05, 0, h);
      h.position.set(isLeft ? -0.6 : 0.6, 4.1, 0);
      return h;
    };
    lamp.add(cap(true), cap(false));
    lamp.position.set(2, 0, 1);
    layer.group.add(lamp);

    // Outdoor furniture: café table groups on riverbank
    const makeChair = () => {
      const chair = new THREE.Group();
      chair.add(box(0.55, 0.06, 0.55, m.woodDark, 0, 0.03, 0, chair));
      chair.add(box(0.55, 0.35, 0.06, m.parisGreen, 0, 0.2, -0.25, chair));
      for (const x of [-0.23, 0.23])
        for (const z of [-0.23, 0.23])
          chair.add(box(0.06, 0.25, 0.06, m.parisGreen, x, 0.125, z, chair));
      return chair;
    };
    const makeTableGroup = (px: number, pz: number, rot: number) => {
      const g = new THREE.Group();
      g.add(box(1.1, 0.08, 1.1, m.parisGreen, 0, 0.35, 0, g));
      g.add(box(0.12, 0.7, 0.12, m.parisGreen, 0, 0.35, 0, g));
      const c1 = makeChair();
      c1.position.set(0.7, 0, -0.2);
      c1.rotation.y = 0.5;
      g.add(c1);
      const c2 = makeChair();
      c2.position.set(-0.7, 0, 0.2);
      c2.rotation.y = -2.5;
      g.add(c2);
      g.position.set(px, 0, pz);
      g.rotation.y = rot;
      return g;
    };
    layer.group.add(makeTableGroup(1.5, 1, 0));
    layer.group.add(makeTableGroup(2.8, 2.2, -0.3));
    layer.group.add(makeTableGroup(0.2, 2.4, 0.4));

    // Eiffel Tower (distant background)
    const tower = new THREE.Group();
    box(0.3, 1.5, 0.3, m.iron, -1.2, 0.75, -3, tower);
    box(0.3, 1.5, 0.3, m.iron, 1.2, 0.75, -3, tower);
    box(0.3, 1.5, 0.3, m.iron, -1.2, 0.75, -4, tower);
    box(0.3, 1.5, 0.3, m.iron, 1.2, 0.75, -4, tower);
    box(2.8, 0.15, 1.5, m.iron, 0, 2.05, -3.5, tower);
    box(1.8, 2.5, 1.2, m.iron, 0, 3.35, -3.5, tower);
    box(0.5, 1.5, 0.5, m.iron, 0, 5.05, -3.5, tower);
    box(0.2, 0.8, 0.2, m.iron, 0, 6.05, -3.5, tower);
    // foundations
    box(0.35, 1.6, 0.35, m.iron, -1.2, -0.8, -3, tower);
    box(0.35, 1.6, 0.35, m.iron, 1.2, -0.8, -3, tower);
    box(0.35, 1.6, 0.35, m.iron, -1.2, -0.8, -4, tower);
    box(0.35, 1.6, 0.35, m.iron, 1.2, -0.8, -4, tower);
    tower.position.set(0, 0, -2.6);
    layer.group.add(tower);

    // Notre-Dame silhouette (twin towers + spire)
    const notreDame = new THREE.Group();
    box(0.6, 2.5, 0.6, m.iron, -0.7, 1.25, 0, notreDame);
    box(0.6, 2.5, 0.6, m.iron, 0.7, 1.25, 0, notreDame);
    box(0.5, 0.5, 0.5, m.iron, -0.7, 2.85, 0, notreDame);
    box(0.5, 0.5, 0.5, m.iron, 0.7, 2.85, 0, notreDame);
    box(1.8, 0.15, 0.5, m.iron, 0, 2.3, 0, notreDame);
    box(0.25, 2.2, 0.25, m.iron, 0, 3.1, 0, notreDame);
    box(0.7, 1.6, 0.7, m.iron, -0.7, -0.8, 0, notreDame);
    box(0.7, 1.6, 0.7, m.iron, 0.7, -0.8, 0, notreDame);
    box(0.35, 1.6, 0.35, m.iron, 0, -0.8, 0, notreDame);
    notreDame.position.set(0, 0, -4.2);
    layer.group.add(notreDame);

    // Autumn maple trees
    const autumnTree = (px: number, pz: number, leafMat: THREE.Material) => {
      const t = new THREE.Group();
      box(0.35, 2, 0.35, m.woodDark, 0, 1, 0, t);
      box(1.8, 1.0, 1.8, leafMat, 0, 2.4, 0, t);
      box(1.3, 0.8, 1.3, leafMat, 0.3, 3.1, -0.2, t);
      box(1.0, 0.6, 1.0, leafMat, -0.2, 3.6, 0.2, t);
      t.position.set(px, 0, pz);
      return t;
    };
    layer.group.add(autumnTree(-3.8, 0.5, m.leafRed));
    layer.group.add(autumnTree(-2.5, 0.5, m.leafOrange));
    layer.group.add(autumnTree(3.5, 0.5, m.leafGold));
    layer.group.add(autumnTree(4.2, 0.5, m.leafOrange));

    // Small Seine boat
    this._boat = new THREE.Group();
    box(1.6, 0.25, 0.5, m.boatHull, 0, 0.12, 0, this._boat);
    box(1.4, 0.15, 0.4, m.boatWhite, 0, 0.32, 0, this._boat);
    box(0.08, 1.2, 0.08, m.woodDark, 0, 0.8, 0, this._boat);
    box(0.9, 0.5, 0.02, m.boatWhite, 0, 1.2, 0, this._boat, false);
    this._boat.position.set(1.2, -0.45, 2.2);
    this._boat.userData = {
      type: 'boat',
      baseX: 1.2,
      baseZ: 2.2,
      phase: Math.random() * Math.PI * 2,
    };
    waterGroup.add(this._boat);
    this._particles.push(this._boat);

    // Lights
    const lp = new THREE.PointLight(0xffdf9e, 3.5, 8);
    lp.position.set(2, 3.9, 1);
    lp.castShadow = true;
    lp.shadow.mapSize.width = 256;
    layer.group.add(lp);
    this._flickerLights.push({ light: lp, base: 3.0, speed: 2.5, amp: 0.2 });

    const cp = new THREE.PointLight(0xffb566, 2.2, 6);
    cp.position.set(-1.4, 1.8, 2);
    layer.group.add(cp);
    this._flickerLights.push({ light: cp, base: 1.9, speed: 1.8, amp: 0.15 });

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Seine shimmer
    const shimmer = createSurfaceShimmer(layer, 16, 0xffddaa, { x: 8, z: 8, y: -0.45 });
    this._particles.push(...shimmer);

    // Café awning warm glow
    const cafeGlow = createLanternGlow(layer, new THREE.Vector3(-1.4, 2.3, 2.2), 0xffdf9e, 1.2, 5);
    this._flickerLights.push({ light: cafeGlow.light, base: 1.0, speed: 4, amp: 0.12 });

    // Eiffel top spark
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(sparkGeo, sparkMat.clone());
      p.position.set(
        (Math.random() - 0.5) * 0.3,
        6.3 + Math.random() * 0.4,
        -3.5 + (Math.random() - 0.5) * 0.3,
      );
      p.userData = { type: 'spark', pulseSpeed: 2 + Math.random() * 3, seed: Math.random() * 100 };
      layer.add(p);
      this._particles.push(p);
    }

    // Wind-blown autumn leaves
    const lg = new THREE.BoxGeometry(0.16, 0.04, 0.12);
    const leafMats = [
      MaterialCache.getLambert(0xc4873b),
      MaterialCache.getLambert(0xc45e2b),
      MaterialCache.getLambert(0xa0302a),
    ];
    for (let i = 0; i < 55; i++) {
      const p = new THREE.Mesh(lg, leafMats[i % 3]);
      p.position.set(Math.random() * 10 - 5, Math.random() * 7 + 0.2, Math.random() * 10 - 5);
      p.userData = {
        type: 'fall_spin',
        speedY: 0.012 + Math.random() * 0.015,
        swaySpeed: 1.2 + Math.random() * 1.5,
        swayAmp: 0.01 + Math.random() * 0.015,
        windX: 0.008 + Math.random() * 0.008,
        rotSpeed: 0.01 + Math.random() * 0.02,
        seed: Math.random() * 100,
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
      w.position.y = w.userData.baseY + Math.sin(time * 1.5 + w.userData.phase) * 0.025;
    }

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      } else if (ud.type === 'spark' && p instanceof THREE.Mesh) {
        if (!Array.isArray(p.material)) {
          p.material.opacity = 0.2 + Math.abs(Math.sin(time * ud.pulseSpeed + ud.seed)) * 0.6;
        }
      } else if (ud.type === 'boat' && p instanceof THREE.Group) {
        p.position.x = ud.baseX + Math.sin(time * 0.25 + ud.phase) * 0.4;
        p.position.z = ud.baseZ + Math.cos(time * 0.18 + ud.phase) * 0.25;
        p.rotation.y = Math.sin(time * 0.2 + ud.phase) * 0.08;
        p.rotation.z = Math.sin(time * 0.6 + ud.phase) * 0.03;
      }
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'fall_spin') continue;
      p.position.y -= ud.speedY;
      p.position.x += Math.sin(time * ud.swaySpeed + ud.seed) * ud.swayAmp + ud.windX;
      p.position.z += Math.cos(time * ud.swaySpeed + ud.seed) * (ud.swayAmp * 0.5);
      p.rotation.x += ud.rotSpeed;
      p.rotation.y += ud.rotSpeed * 0.5;
      if (p.position.y < 0.15 || p.position.x > 6) {
        p.position.set(-5 - Math.random() * 2, 7.5 + Math.random() * 2, Math.random() * 10 - 5);
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
    this._boat = null;
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
