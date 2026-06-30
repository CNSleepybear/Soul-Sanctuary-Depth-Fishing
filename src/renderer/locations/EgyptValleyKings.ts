// ===== src/renderer/locations/EgyptValleyKings.ts =====
// 🇪🇬 Egypt — Valley of the Kings with step pyramid, obelisk, Sphinx,
// palm oasis, temple columns, drifting sand and a small camel.
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

export class EgyptValleyKings extends BaseLocation {
  readonly id = 'egypt';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _waterfall: Waterfall | null = null;
  private _fronds: THREE.Mesh[] = [];
  private _camel: THREE.Group | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'egypt')!;
  }

  protected buildGeometry(): void {
    const m = {
      pyramid: MaterialCache.getLambert(0xd4b896),
      pyramidDark: MaterialCache.getLambert(0x8c7040),
      gold: MaterialCache.getBasic(0xffd700),
      turquoise: MaterialCache.getLambert(0x40c0a0),
      palmTrunk: MaterialCache.getLambert(0x5a4a3a),
      palmLeaf: MaterialCache.getLambert(0x3d7331),
      oasis: MaterialCache.getTransparentLambert(0x1a3d3d, 0.78),
      oasisLight: MaterialCache.getTransparentLambert(0x2a4d4d, 0.68),
      camel: MaterialCache.getLambert(0xc4a070),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0xc4b896, earth: 0xa49876, grass: 0x8a9a5a },
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
      color: 0x1a3d3d,
      opacity: 0.6,
      density: 0.7,
    });
    this.group.add(this._waterfall.group);

    // Oasis water
    const waterGroup = new THREE.Group();
    waterGroup.position.y = 0.05;
    layer.group.add(waterGroup);
    for (let x = -1.5; x <= 1.5; x += 0.5) {
      for (let z = -1.5; z <= 1.5; z += 0.5) {
        if (Math.sqrt(x * x + z * z) > 1.6) continue;
        const mat = Math.random() > 0.5 ? m.oasis : m.oasisLight;
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.48), mat);
        w.position.set(x + 3, 0, z + 2);
        w.receiveShadow = false;
        w.castShadow = false;
        w.userData = { baseY: 0, phase: Math.random() * Math.PI * 2 };
        waterGroup.add(w);
      }
    }

    // Step pyramid
    const pyramid = new THREE.Group();
    box(5, 1, 5, m.pyramid, -1, 0.5, -1, pyramid);
    box(3.2, 1, 3.2, m.pyramid, -1, 1.5, -1, pyramid);
    box(1.4, 1, 1.4, m.gold, -1, 2.5, -1, pyramid, false);
    // Hieroglyphic relief bands on pyramid face
    box(0.06, 2.6, 0.06, m.turquoise, -0.7, 1.3, 1.51, pyramid, false);
    box(0.06, 2.6, 0.06, m.gold, 0, 1.3, 1.51, pyramid, false);
    box(0.06, 2.6, 0.06, m.turquoise, 0.7, 1.3, 1.51, pyramid, false);
    pyramid.position.set(-1, 0, -1);
    layer.group.add(pyramid);

    // Companion small pyramid
    const smallPyramid = new THREE.Group();
    box(2.5, 0.8, 2.5, m.pyramid, 0, 0.4, 0, smallPyramid);
    box(1.6, 0.7, 1.6, m.pyramid, 0, 1.15, 0, smallPyramid);
    box(0.8, 0.6, 0.8, m.pyramid, 0, 1.8, 0, smallPyramid);
    box(0.3, 0.5, 0.3, m.gold, 0, 2.35, 0, smallPyramid, false);
    smallPyramid.position.set(3, 0, -3);
    layer.group.add(smallPyramid);

    // Sphinx silhouette
    const sphinx = new THREE.Group();
    box(1.4, 0.7, 2.2, m.pyramid, 0, 0.35, 0, sphinx);
    box(0.6, 0.6, 0.7, m.pyramid, 0, 0.9, 0.6, sphinx);
    box(0.22, 0.15, 0.55, m.pyramid, -0.5, 0.2, 0.75, sphinx);
    box(0.22, 0.15, 0.55, m.pyramid, 0.5, 0.2, 0.75, sphinx);
    sphinx.position.set(-3.5, 0, 2);
    layer.group.add(sphinx);

    // Palm trees
    const mkPalm = (px: number, pz: number, ph: number) => {
      const p = new THREE.Group();
      box(0.22, ph, 0.22, m.palmTrunk, 0, ph / 2, 0, p);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const frond = box(
          0.08,
          0.9,
          0.08,
          m.palmLeaf,
          Math.cos(angle) * 0.55,
          ph + 0.1,
          Math.sin(angle) * 0.55,
          p,
        );
        frond.rotation.x = Math.sin(angle) * 0.35;
        frond.rotation.z = Math.cos(angle) * 0.35;
      }
      p.position.set(px, 0, pz);
      return p;
    };
    layer.group.add(mkPalm(3.5, 3.2, 2.5));
    layer.group.add(mkPalm(4.0, 2.5, 2.2));
    layer.group.add(mkPalm(2.8, 3.8, 2.0));
    layer.group.add(mkPalm(-3.2, -2.2, 2.0));

    // Temple columns with hieroglyphic accents
    const mkColumn = (cx: number, cz: number) => {
      const c = new THREE.Group();
      box(0.5, 0.15, 0.5, m.pyramidDark, 0, 0.075, 0, c);
      box(0.35, 2.2, 0.35, m.pyramid, 0, 1.25, 0, c);
      box(0.5, 0.2, 0.5, m.pyramidDark, 0, 2.45, 0, c);
      box(0.05, 1.4, 0.4, m.turquoise, 0, 1.3, 0.03, c, false);
      box(0.4, 0.06, 0.06, m.gold, 0, 1.65, 0.18, c, false);
      box(0.4, 0.06, 0.06, m.gold, 0, 1.05, 0.18, c, false);
      c.position.set(cx, 0, cz);
      return c;
    };
    layer.group.add(mkColumn(2, -3));
    layer.group.add(mkColumn(2.8, -3));
    layer.group.add(mkColumn(3.6, -3));

    // Obelisk with tapering shaft and pyramidion top
    const obelisk = new THREE.Group();
    box(0.3, 0.6, 0.3, m.pyramidDark, 0, 0.3, 0, obelisk);
    box(0.26, 0.7, 0.26, m.pyramidDark, 0, 0.95, 0, obelisk);
    box(0.22, 0.8, 0.22, m.pyramidDark, 0, 1.7, 0, obelisk);
    box(0.18, 0.9, 0.18, m.pyramidDark, 0, 2.55, 0, obelisk);
    box(0.14, 0.7, 0.14, m.pyramidDark, 0, 3.35, 0, obelisk);
    box(0.12, 0.4, 0.12, m.gold, 0, 3.9, 0, obelisk, false); // pyramidion
    obelisk.position.set(3.5, 0, -2.5);
    layer.group.add(obelisk);

    // Companion obelisk near Sphinx
    const smallObelisk = new THREE.Group();
    box(0.14, 0.4, 0.14, m.pyramidDark, 0, 0.2, 0, smallObelisk);
    box(0.1, 0.6, 0.1, m.pyramidDark, 0, 0.7, 0, smallObelisk);
    box(0.08, 0.7, 0.08, m.pyramidDark, 0, 1.35, 0, smallObelisk);
    box(0.05, 0.35, 0.05, m.gold, 0, 1.88, 0, smallObelisk, false);
    smallObelisk.position.set(-2.5, 0, 2.8);
    layer.group.add(smallObelisk);

    // Small camel
    this._camel = new THREE.Group();
    box(0.6, 0.45, 0.35, m.camel, 0, 0.45, 0, this._camel);
    box(0.25, 0.3, 0.25, m.camel, 0.35, 0.75, 0.05, this._camel);
    box(0.12, 0.5, 0.12, m.camel, -0.3, 0.25, 0.15, this._camel);
    box(0.12, 0.5, 0.12, m.camel, -0.3, 0.25, -0.15, this._camel);
    box(0.12, 0.5, 0.12, m.camel, 0.3, 0.25, 0.15, this._camel);
    box(0.12, 0.5, 0.12, m.camel, 0.3, 0.25, -0.15, this._camel);
    box(0.08, 0.08, 0.2, m.camel, 0.55, 0.55, 0.05, this._camel);
    this._camel.position.set(-1.5, 0, 3);
    this._camel.rotation.y = -0.4;
    layer.group.add(this._camel);

    // Lights
    const pp = new THREE.PointLight(0xffaa00, 3.0, 10);
    pp.position.set(-1, 3, -1);
    pp.castShadow = true;
    layer.group.add(pp);
    this._flickerLights.push({ light: pp, base: 3.0, speed: 1.5, amp: 0.2 });

    const op = new THREE.PointLight(0x44ffaa, 1.5, 5);
    op.position.set(3, 1, 2);
    layer.group.add(op);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Spark at obelisk tip
    const obeliskTip = createLanternGlow(
      layer,
      new THREE.Vector3(3.5, 4.15, -2.5),
      0xffd700,
      1.2,
      4,
    );
    this._flickerLights.push({ light: obeliskTip.light, base: 1.0, speed: 4, amp: 0.2 });
    this._particles.push(obeliskTip.mesh);

    // Golden dust eddies over sand
    const dust = createSurfaceShimmer(layer, 16, 0xffd700, { x: 10, z: 10, y: 0.08 });
    this._particles.push(...dust);

    // Drifting sand grains
    const dg = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    for (let i = 0; i < 45; i++) {
      const p = new THREE.Mesh(dg, MaterialCache.getBasic(0xffd700));
      p.position.set(Math.random() * 10 - 5, Math.random() * 4 + 0.3, Math.random() * 10 - 5);
      p.userData = {
        type: 'drift',
        speedY: 0.01 + Math.random() * 0.02,
        speedX: 0.01 + Math.random() * 0.015,
        angle: Math.random() * Math.PI * 2,
        amp: 0.01 + Math.random() * 0.02,
        swirl: 0.5 + Math.random() * 0.5,
      };
      layer.add(p);
      this._particles.push(p);
    }

    // Animate palm fronds
    this._fronds = [];
    layer.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material &&
        !Array.isArray(child.material) &&
        (child.material as THREE.MeshLambertMaterial).color.getHex() === 0x3d7331
      ) {
        child.userData.baseRotX = child.rotation.x;
        child.userData.baseRotZ = child.rotation.z;
        child.userData.swaySpeed = 0.8 + Math.random() * 0.8;
        child.userData.swayAmp = 0.04 + Math.random() * 0.03;
        this._fronds.push(child);
      }
    });
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    // Waterfall
    this._waterfall?.update(time);

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p]);
      }
    }
    for (const f of this._fronds) {
      const ud = f.userData;
      f.rotation.x = ud.baseRotX + Math.sin(time * ud.swaySpeed) * ud.swayAmp;
      f.rotation.z = ud.baseRotZ + Math.cos(time * ud.swaySpeed * 0.7) * ud.swayAmp;
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'drift') continue;
      p.position.z += ud.speedY * 0.5;
      p.position.x += Math.sin(time * ud.swirl + ud.angle) * ud.amp;
      p.position.y = 0.3 + Math.sin(time + ud.angle) * 0.15 + Math.cos(time * 0.7 + ud.angle) * 0.1;
      if (p.position.z > 5) p.position.z = -5;
    }
    for (const fl of this._flickerLights) {
      updateFlicker(time, fl);
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._fronds = [];
    this._camel = null;
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
