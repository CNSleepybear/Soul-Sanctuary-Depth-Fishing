// ===== src/renderer/locations/GermanyBlackForest.ts =====
// 🇩🇪 Germany — Black Forest Winter Cabin with half-timbered walls, triangular roof,
// frozen pond, pine forest, chimney smoke, drifting snow and a small snowman.
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

export class GermanyBlackForest extends BaseLocation {
  readonly id = 'germany';
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
  private _snowTiles: THREE.Mesh[] = [];

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'germany')!;
  }

  protected buildGeometry(): void {
    const m = {
      plaster: MaterialCache.getLambert(0xe6e2d8),
      timber: MaterialCache.getLambert(0x3d2618),
      roofDark: MaterialCache.getLambert(0x4a3020),
      pineGreen: MaterialCache.getLambert(0x1f3d2a),
      pineLight: MaterialCache.getLambert(0x2a5030),
      beerGold: MaterialCache.getBasic(0xffaa00),
      snowWhite: MaterialCache.getLambert(0xffffff),
      shutterGreen: MaterialCache.getLambert(0x2a5a2a),
      ice: MaterialCache.getTransparentLambert(0xaaccdd, 0.55),
      iceLight: MaterialCache.getTransparentLambert(0xcceeff, 0.45),
      carrot: MaterialCache.getBasic(0xff6600),
      coal: MaterialCache.getLambert(0x1a1a1a),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0xaab0b8, earth: 0x9a9a9a, grass: 0xffffff },
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
      color: 0xaaccdd,
      opacity: 0.5,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // ── Frozen pond with animated ice tiles ──
    const iceGroup = new THREE.Group();
    iceGroup.position.y = 0.05;
    layer.group.add(iceGroup);
    for (let x = -3; x <= 3; x += 1) {
      for (let z = -3; z <= 3; z += 1) {
        if (Math.sqrt(x * x + z * z) > 3.2) continue;
        const mat = Math.random() > 0.5 ? m.ice : m.iceLight;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), mat);
        tile.position.set(x, 0, z);
        tile.receiveShadow = false;
        tile.castShadow = false;
        tile.userData = { baseY: 0, phase: Math.random() * Math.PI * 2 };
        iceGroup.add(tile);
        this._snowTiles.push(tile);
      }
    }

    // Half-timbered house
    const house = new THREE.Group();
    const wallH = 2.6;
    box(3.6, wallH, 3.6, m.plaster, 0, wallH / 2, 0, house);
    [
      { x: 1.8, z: 1.8 },
      { x: -1.8, z: 1.8 },
      { x: 1.8, z: -1.8 },
      { x: -1.8, z: -1.8 },
    ].forEach((c) => box(0.12, wallH, 0.12, m.timber, c.x, wallH / 2, c.z, house));
    for (const yP of [0.1, 1.3, 2.5]) {
      box(3.7, 0.12, 0.12, m.timber, 0, yP, 1.8, house);
      box(3.7, 0.12, 0.12, m.timber, 0, yP, -1.8, house);
      box(0.12, 0.12, 3.7, m.timber, 1.8, yP, 0, house);
      box(0.12, 0.12, 3.7, m.timber, -1.8, yP, 0, house);
    }
    const brace = (x: number, z: number, r: number) => {
      const b = box(0.1, 1.4, 0.1, m.timber, x, 0.7, z, house);
      b.rotation.z = r;
      return b;
    };
    house.add(
      brace(1.2, 1.81, 0.6),
      brace(-1.2, 1.81, -0.6),
      brace(1.81, 1.2, 0),
      brace(-1.81, -1.2, 0),
    );
    // Triangular roof layers
    [
      { w: 4.2, h: 0.35, d: 4.0, y: 2.75 },
      { w: 3.4, h: 0.35, d: 4.0, y: 3.1 },
      { w: 2.6, h: 0.35, d: 4.0, y: 3.45 },
      { w: 1.8, h: 0.35, d: 4.0, y: 3.8 },
      { w: 1.0, h: 0.35, d: 4.0, y: 4.15 },
      { w: 0.3, h: 0.35, d: 4.0, y: 4.5 },
    ].forEach((l) => box(l.w, l.h, l.d, m.roofDark, 0, l.y, 0, house));
    // Snow on roof
    box(4.3, 0.12, 4.1, m.snowWhite, 0, 4.72, 0, house);
    // Chimney
    box(0.5, 1.2, 0.5, m.timber, 1, 4.2, -0.8, house);
    // Door and windows
    box(1.2, 0.8, 0.1, m.beerGold, 0, 1.4, 1.82, house, false);
    box(0.7, 1.3, 0.1, m.timber, -1, 0.65, 1.82, house);
    // Green shutters
    box(0.2, 0.7, 0.06, m.shutterGreen, -0.8, 1.4, 1.84, house);
    box(0.2, 0.7, 0.06, m.shutterGreen, 0.8, 1.4, 1.84, house);
    // Porch
    box(2.0, 0.15, 0.9, m.timber, 0, 0.15, 2.3, house);
    for (const x of [-0.9, 0.9]) box(0.1, 0.6, 0.1, m.timber, x, 0.45, 2.7, house);
    house.position.set(-1.5, 0, -1);
    layer.group.add(house);

    // Pines
    const pine = (px: number, pz: number, nl: number) => {
      const t = new THREE.Group();
      const th = 1 + Math.random() * 0.5;
      box(0.25, th, 0.25, m.timber, 0, th / 2, 0, t);
      let cy = th - 0.2,
        bw = 1.8;
      for (let i = 0; i < nl; i++) {
        const mat = i % 2 === 0 ? m.pineGreen : m.pineLight;
        box(bw, 0.5, bw, mat, 0, cy + 0.25, 0, t);
        cy += 0.38;
        bw -= 0.4;
      }
      t.position.set(px, 0, pz);
      return t;
    };
    const pineTall = (px: number, pz: number) => {
      const t = new THREE.Group();
      const th = 1.4 + Math.random() * 0.4;
      box(0.16, th, 0.16, m.timber, 0, th / 2, 0, t);
      let cy = th - 0.2,
        bw = 1.3;
      for (let i = 0; i < 5; i++) {
        const mat = i % 2 === 0 ? m.pineGreen : m.pineLight;
        box(bw, 0.45, bw, mat, 0, cy + 0.225, 0, t);
        cy += 0.34;
        bw -= 0.22;
      }
      t.position.set(px, 0, pz);
      return t;
    };
    layer.group.add(pine(2.8, -2.5, 4));
    layer.group.add(pine(1.2, -3.2, 5));
    layer.group.add(pine(3.2, -0.5, 3));
    layer.group.add(pine(-3.5, 2.5, 4));
    layer.group.add(pineTall(-2.8, -3.2));
    layer.group.add(pineTall(3.8, 1.5));
    layer.group.add(pineTall(-1.5, 3.5));

    // Small snowman
    const snowman = new THREE.Group();
    box(0.45, 0.45, 0.45, m.snowWhite, 0, 0.22, 0, snowman, false);
    box(0.32, 0.32, 0.32, m.snowWhite, 0, 0.61, 0, snowman, false);
    box(0.22, 0.22, 0.22, m.snowWhite, 0, 0.98, 0, snowman, false);
    box(0.06, 0.06, 0.12, m.carrot, 0, 1.0, 0.12, snowman, false);
    box(0.04, 0.04, 0.04, m.coal, -0.06, 1.05, 0.1, snowman, false);
    box(0.04, 0.04, 0.04, m.coal, 0.06, 1.05, 0.1, snowman, false);
    snowman.position.set(1.8, 0, 1.8);
    layer.group.add(snowman);

    // Lights
    const tp = new THREE.PointLight(0xffaa33, 4.5, 7);
    tp.position.set(-1.5, 1.4, 2.5);
    tp.castShadow = true;
    tp.shadow.mapSize.width = 256;
    layer.group.add(tp);
    this._flickerLights.push({ light: tp, base: 4.0, speed: 3.0, amp: 0.2 });

    const md = new THREE.DirectionalLight(0x5a7088, 1.0);
    md.position.set(-5, 10, -5);
    this.scene.add(md);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Snow surface shimmer
    const shimmer = createSurfaceShimmer(layer, 14, 0xffffff, { x: 9, z: 9, y: 0.05 });
    this._particles.push(...shimmer);

    // Pine forest mist
    this._mistPuffs = createRisingPuffs(
      layer,
      8,
      0x8899aa,
      { x: 9, z: 9, yMin: 0.1, yMax: 2.0 },
      0.5,
    );
    for (const p of this._mistPuffs) {
      p.position.y = 0.2 + Math.random() * 1.2;
    }
    this._particles.push(...this._mistPuffs);

    // Snow
    const sg = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    for (let i = 0; i < 55; i++) {
      const p = new THREE.Mesh(sg, MaterialCache.getBasic(0xffffff));
      p.position.set(Math.random() * 10 - 5, Math.random() * 7 + 0.3, Math.random() * 10 - 5);
      p.userData = {
        type: 'snow',
        speedY: 0.02 + Math.random() * 0.015,
        driftX: (Math.random() - 0.5) * 0.005,
      };
      layer.add(p);
      this._particles.push(p);
    }

    // Chimney smoke
    const smokeGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const smokeMat = new THREE.MeshLambertMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.4,
    });
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
      p.position.set(
        1 + (Math.random() - 0.5) * 0.3,
        5.0 + Math.random() * 0.5,
        -0.8 + (Math.random() - 0.5) * 0.3,
      );
      p.userData = {
        type: 'smoke',
        speedY: 0.012 + Math.random() * 0.012,
        swaySpeed: 0.8 + Math.random() * 1.2,
        swayAmp: 0.006 + Math.random() * 0.008,
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

    // Ice tiles shimmer
    for (const w of this._snowTiles) {
      w.position.y = w.userData.baseY + Math.sin(time * 1.5 + w.userData.phase) * 0.01;
    }

    updateRisingPuffs(time, this._mistPuffs);

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      }
    }
  }

  update(dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'snow') {
        p.position.y -= ud.speedY;
        p.position.x += ud.driftX;
        if (p.position.y < 0.15) {
          p.position.y = 7 + Math.random() * 1.5;
          p.position.x = Math.random() * 10 - 5;
          p.position.z = Math.random() * 10 - 5;
        }
      } else if (ud.type === 'smoke' && p instanceof THREE.Mesh) {
        p.position.y += ud.speedY;
        p.position.x += Math.sin(time * ud.swaySpeed) * ud.swayAmp;
        p.position.z += Math.cos(time * ud.swaySpeed) * ud.swayAmp;
        ud.age += dt;
        const lifeRatio = Math.min(ud.age / ud.maxLife, 1);
        p.scale.setScalar(1 + lifeRatio * 1.5);
        if (p.material instanceof THREE.Material) {
          if (!Array.isArray(p.material) && 'opacity' in p.material) {
            (p.material as THREE.MeshLambertMaterial).opacity = 0.4 * (1 - lifeRatio);
          }
        }
        if (ud.age > ud.maxLife || p.position.y > 9) {
          p.position.set(1 + (Math.random() - 0.5) * 0.3, 5.0, -0.8 + (Math.random() - 0.5) * 0.3);
          ud.age = 0;
          p.scale.setScalar(1);
          if (
            p.material instanceof THREE.Material &&
            !Array.isArray(p.material) &&
            'opacity' in p.material
          ) {
            (p.material as THREE.MeshLambertMaterial).opacity = 0.4;
          }
        }
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
    this._snowTiles = [];
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
