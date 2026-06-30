// ===== src/renderer/locations/IcelandAurora.ts =====
// 🇮🇸 Iceland — Aurora over the Black Church with basalt columns, turf house,
// moss lava field, distant glaciers, geothermal steam vents, waterfall and aurora curtains.
// Art upgraded to match the richer voxel diorama ND standard.

import * as THREE from 'three';
import { BaseLocation } from './BaseLocation';
import { FloatingIsland } from '../rendering/FloatingIsland';
import { Waterfall } from '../rendering/Waterfall';
import { MaterialCache } from '../rendering/MaterialCache';
import { VoxelBuilder } from '../rendering/VoxelBuilder';
import { LOCATIONS } from '../data/location-data';
import type { LocationData } from '../../shared/types';
import { updateFlicker, createSurfaceShimmer, updateSurfaceShimmer } from './AtmosphereEffects';

export class IcelandAurora extends BaseLocation {
  readonly id = 'iceland';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _auroraMaterials: THREE.MeshBasicMaterial[] = [];
  private _waterfall: Waterfall | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'iceland')!;
  }

  protected buildGeometry(): void {
    const m = {
      basaltGrey: MaterialCache.getLambert(0x3a3c48),
      basaltDark: MaterialCache.getLambert(0x2a2c38),
      churchBlack: MaterialCache.getLambert(0x2a2a32),
      churchWhite: MaterialCache.getLambert(0xeef0f5),
      roofRed: MaterialCache.getLambert(0x8a3030),
      turfGreen: MaterialCache.getLambert(0x3a5a3a),
      moss: MaterialCache.getLambert(0x4a6a3a),
      mossDark: MaterialCache.getLambert(0x3a4a2a),
      glacier: MaterialCache.getLambert(0xddeeff),
      steam: new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
      windowGlow: MaterialCache.getBasic(0xffaa33),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x6a6a6a, earth: 0x5a5a5a, grass: 0xffffff },
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

    // Moss lava field ground patches
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 4.5;
      const s = 0.3 + Math.random() * 0.5;
      const mat = Math.random() > 0.4 ? m.moss : m.mossDark;
      box(s, 0.12, s, mat, Math.cos(a) * r, 0.06, Math.sin(a) * r, layer.group);
    }

    // Basalt columns
    const basalt = new THREE.Group();
    const col = (bx: number, bz: number, bh: number) => {
      box(0.5, bh, 0.5, m.basaltGrey, bx, bh / 2, bz, basalt);
    };
    col(2.8, -3, 2.4);
    col(3.2, -3, 3.2);
    col(2.4, -3, 1.6);
    col(2.8, -2.5, 1.8);
    col(3.2, -2.5, 2.6);
    col(2.8, -2, 1.0);
    col(-3, 3, 2.8);
    col(-2.5, 3, 2.0);
    layer.group.add(basalt);

    // Distant glaciers
    const glacier = new THREE.Group();
    box(3.5, 1.2, 1.5, m.glacier, -5, 0.6, -4, glacier);
    box(2.8, 0.9, 1.2, m.glacier, -3.5, 0.45, -5, glacier);
    box(4.0, 1.5, 1.8, m.glacier, 5.5, 0.75, -4.5, glacier);
    box(2.2, 0.7, 1.0, m.glacier, 3.5, 0.35, -5.2, glacier);
    glacier.position.set(0, 0, -3);
    layer.group.add(glacier);

    // Black Church
    const church = new THREE.Group();
    box(2.6, 1.8, 4, m.churchBlack, 0, 0.9, 0, church);
    for (let i = 0; i < 5; i++) {
      const w = 2.8 - i * 0.55;
      box(w, 0.25, 4.2, m.roofRed, 0, 1.9 + i * 0.25, 0, church);
    }
    box(0.9, 3.2, 0.9, m.churchBlack, 0, 1.6, 1.5, church);
    for (let j = 0; j < 4; j++) {
      const w = 1.0 - j * 0.25;
      box(w, 0.25, w, m.roofRed, 0, 3.32 + j * 0.25, 1.5, church);
    }
    box(0.08, 0.4, 0.08, m.churchWhite, 0, 4.4, 1.5, church);
    box(0.24, 0.08, 0.08, m.churchWhite, 0, 4.45, 1.5, church);

    // White window frames and glowing windows
    const frontFrame = new THREE.Group();
    frontFrame.add(box(0.52, 0.06, 0.08, m.churchWhite, 0, 1.5, 1.98, frontFrame));
    frontFrame.add(box(0.52, 0.06, 0.08, m.churchWhite, 0, 0.9, 1.98, frontFrame));
    frontFrame.add(box(0.06, 0.72, 0.08, m.churchWhite, -0.23, 1.2, 1.98, frontFrame));
    frontFrame.add(box(0.06, 0.72, 0.08, m.churchWhite, 0.23, 1.2, 1.98, frontFrame));
    church.add(frontFrame);
    box(0.4, 0.6, 0.1, m.windowGlow, 0, 1.2, 1.96, church, false);

    const sideFrame = new THREE.Group();
    sideFrame.add(box(0.08, 0.58, 0.52, m.churchWhite, -1.33, 1.0, 0, sideFrame));
    sideFrame.add(box(0.08, 0.06, 0.52, m.churchWhite, -1.33, 1.29, 0, sideFrame));
    sideFrame.add(box(0.08, 0.06, 0.52, m.churchWhite, -1.33, 0.71, 0, sideFrame));
    church.add(sideFrame);
    box(0.1, 0.5, 0.4, m.windowGlow, -1.31, 1.0, 0, church, false);
    const sideFrameR = sideFrame.clone();
    sideFrameR.position.x = 2.62;
    church.add(sideFrameR);
    box(0.1, 0.5, 0.4, m.windowGlow, 1.31, 1.0, 0, church, false);

    // Turf strips on roof edges
    box(3.0, 0.06, 4.4, m.turfGreen, 0, 2.12, 0, church);
    box(1.2, 0.06, 1.2, m.turfGreen, 0, 3.55, 1.5, church);

    church.position.set(-0.5, 0, -0.5);
    layer.group.add(church);

    // Small turf house
    const turfHouse = new THREE.Group();
    box(1.8, 1.2, 1.8, m.turfGreen, 0, 0.6, 0, turfHouse);
    box(1.6, 0.8, 1.6, m.churchBlack, 0, 0.4, 0, turfHouse);
    box(0.4, 0.5, 0.05, m.windowGlow, 0, 0.6, 0.92, turfHouse, false);
    box(2.0, 0.15, 2.0, m.turfGreen, 0, 1.28, 0, turfHouse);
    turfHouse.position.set(2.5, 0, -1.5);
    layer.group.add(turfHouse);

    // Lights
    const cp = new THREE.PointLight(0xffaa33, 4.0, 7);
    cp.position.set(-0.5, 1.2, -0.5);
    layer.group.add(cp);
    this._flickerLights.push({ light: cp, base: 3.8, speed: 2.2, amp: 0.2 });

    const ad = new THREE.DirectionalLight(0x2bf098, 0.6);
    ad.position.set(2, 6, 2);
    this.scene.add(ad);
    this._flickerLights.push({ light: ad, base: 0.6, speed: 0.5, amp: 0.25, noise: true });

    // Geothermal steam vents
    const steamGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const ventPositions: Array<[number, number]> = [
      [2.4, 2.0],
      [-2.6, 1.6],
      [2.0, -2.4],
      [-1.8, -2.0],
    ];
    for (const [vx, vz] of ventPositions) {
      box(0.4, 0.2, 0.4, m.basaltDark, vx, 0.1, vz, layer.group);
      for (let k = 0; k < 5; k++) {
        const puff = new THREE.Mesh(steamGeo, m.steam.clone());
        puff.position.set(vx, 0.3 + k * 0.3, vz);
        puff.userData = {
          type: 'steam',
          speedY: 0.005 + Math.random() * 0.005,
          swaySpeed: 0.7 + Math.random() * 0.8,
          swayAmp: 0.004 + Math.random() * 0.004,
          initialY: 0.25,
          maxHeight: 1.4 + Math.random() * 0.6,
        };
        layer.group.add(puff);
        this._particles.push(puff);
      }
    }

    // Stars
    const starGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    for (let i = 0; i < 80; i++) {
      const p = new THREE.Mesh(starGeo, starMat.clone());
      p.position.set((Math.random() - 0.5) * 40, 5 + Math.random() * 12, -8 - Math.random() * 12);
      p.userData = {
        type: 'star',
        pulseSpeed: 0.5 + Math.random() * 1.5,
        seed: Math.random() * 100,
      };
      layer.group.add(p);
      this._particles.push(p);
    }

    // Aurora curtains
    const curtainColors = [
      0x2bf098, 0x22ddff, 0x66ffcc, 0x88ffff, 0x2bf098, 0x44ffee, 0x66ccff, 0xaaffcc,
    ];
    for (let b = 0; b < 10; b++) {
      const curtainMat = new THREE.MeshBasicMaterial({
        color: curtainColors[b % curtainColors.length],
        transparent: true,
        opacity: 0.06 + Math.random() * 0.07,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const h = 10 + Math.random() * 6;
      const curtain = new THREE.Mesh(
        new THREE.BoxGeometry(0.15 + Math.random() * 0.25, h, 0.03),
        curtainMat,
      );
      curtain.position.set(
        (Math.random() - 0.5) * 22,
        4 + Math.random() * 4,
        -3 + Math.random() * 10,
      );
      curtain.rotation.y = (Math.random() - 0.5) * 0.8;
      curtain.userData = {
        type: 'curtain',
        speedX: 0.0006 + Math.random() * 0.0012,
        driftY: 0.0004 + Math.random() * 0.0006,
        waveSpeed: 0.15 + Math.random() * 0.2,
        waveAmp: 0.02 + Math.random() * 0.03,
        pulseSpeed: 0.22 + Math.random() * 0.28,
        seed: Math.random() * 100,
        baseOpacity: curtainMat.opacity,
      };
      layer.group.add(curtain);
      this._particles.push(curtain);
    }

    // Aurora rays
    const rayMats = [
      new THREE.MeshBasicMaterial({
        color: 0x2bf098,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.MeshBasicMaterial({
        color: 0x22ddff,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.MeshBasicMaterial({
        color: 0x88ffcc,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.MeshBasicMaterial({
        color: 0xaaffff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.MeshBasicMaterial({
        color: 0x44ffee,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ];
    for (let i = 0; i < 48; i++) {
      const mat = rayMats[i % rayMats.length].clone();
      const h = 4 + Math.random() * 7;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.04 + Math.random() * 0.06, h, 0.02), mat);
      const arcIndex = Math.floor(Math.random() * 6);
      const arcCenterX = (arcIndex - 2.5) * 3.0 + (Math.random() - 0.5) * 1.8;
      const arcCenterZ = -2 + Math.random() * 8;
      p.position.set(
        arcCenterX + (Math.random() - 0.5) * 4.5,
        3.5 + Math.random() * 3.5,
        arcCenterZ + (Math.random() - 0.5) * 3.5,
      );
      p.rotation.set(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 1.0,
        (Math.random() - 0.5) * 0.3,
      );
      p.userData = {
        type: 'ray',
        speedX: 0.0015 + Math.random() * 0.003,
        driftY: 0.0008 + Math.random() * 0.0015,
        waveSpeed: 0.5 + Math.random() * 0.9,
        waveAmp: 0.015 + Math.random() * 0.025,
        rotSpeed: 0.03 + Math.random() * 0.06,
        pulseSpeed: 0.6 + Math.random() * 0.8,
        seed: Math.random() * 100,
        baseOpacity: mat.opacity,
      };
      layer.group.add(p);
      this._particles.push(p);
    }

    // Aurora canopy
    const canopyColors = [0x22ddff, 0x2bf098, 0x88ffff];
    for (let c = 0; c < 4; c++) {
      const canopyMat = new THREE.MeshBasicMaterial({
        color: canopyColors[c % canopyColors.length],
        transparent: true,
        opacity: 0.08 + Math.random() * 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(28, 0.02, 1.8), canopyMat);
      canopy.position.set((Math.random() - 0.5) * 6, 7.5 + c * 0.5, -2 + Math.random() * 5);
      canopy.userData = {
        type: 'canopy',
        speedX: 0.0008 + Math.random() * 0.0012,
        waveSpeed: 0.18 + Math.random() * 0.22,
        waveAmp: 0.03 + Math.random() * 0.04,
        pulseSpeed: 0.25 + Math.random() * 0.3,
        seed: Math.random() * 100,
        baseOpacity: canopyMat.opacity,
      };
      layer.group.add(canopy);
      this._particles.push(canopy);
    }

    // Aurora ions
    const ionGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const ionMat = new THREE.MeshBasicMaterial({
      color: 0xc8ffff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(ionGeo, ionMat.clone());
      p.position.set(
        (Math.random() - 0.5) * 18,
        5.5 + Math.random() * 3.5,
        (Math.random() - 0.5) * 10,
      );
      p.userData = {
        type: 'ion',
        pulseSpeed: 1.0 + Math.random() * 2.0,
        seed: Math.random() * 100,
      };
      layer.group.add(p);
      this._particles.push(p);
    }

    // Ground aurora reflection
    const reflectMat = new THREE.MeshBasicMaterial({
      color: 0x2bf098,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let r = 0; r < 6; r++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(5 + Math.random() * 4, 0.02, 1.2),
        reflectMat.clone(),
      );
      p.position.set(
        (Math.random() - 0.5) * 14,
        -1.4 + Math.random() * 0.2,
        -2 + Math.random() * 8,
      );
      p.userData = {
        type: 'reflection',
        pulseSpeed: 0.4 + Math.random() * 0.5,
        seed: Math.random() * 100,
        baseOpacity: p.material.opacity,
      };
      layer.group.add(p);
      this._particles.push(p);
    }

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    const atm = this.data.theme?.atmosphere;
    const soulColor = new THREE.Color(atm?.soulColor ?? 0xffaa33);
    // Faint soul-colored shimmer on the ground
    const shimmer = createSurfaceShimmer(layer, 10, soulColor.getHex(), { x: 12, z: 12, y: -1.35 });
    this._particles.push(...shimmer);
    // Collect all additive aurora materials
    this.group.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        !Array.isArray(child.material) &&
        child.material instanceof THREE.MeshBasicMaterial &&
        child.material.blending === THREE.AdditiveBlending
      ) {
        this._auroraMaterials.push(child.material);
      }
    });
  }

  applySoulAmbience(soulCount: number): void {
    super.applySoulAmbience(soulCount);
    if (soulCount <= 0) return;
    const atm = this.data.theme?.atmosphere;
    const soulColor = new THREE.Color(atm?.soulColor ?? 0xffaa33);
    for (const mat of this._auroraMaterials) {
      mat.color.lerp(soulColor, 0.1);
    }
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
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'ray') {
        p.position.x += ud.speedX;
        p.position.y += ud.driftY;
        p.position.z += Math.sin(time * ud.waveSpeed + ud.seed) * ud.waveAmp;
        p.rotation.z += Math.sin(time * ud.rotSpeed + ud.seed) * 0.0012;
        p.rotation.y += Math.cos(time * ud.rotSpeed * 0.7 + ud.seed) * 0.0018;
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          const pulse = 0.65 + Math.sin(time * ud.pulseSpeed + ud.seed) * 0.35;
          p.material.opacity = Math.max(0.03, ud.baseOpacity * pulse);
        }
        if (p.position.x > 12) {
          p.position.x = -12;
          p.position.y = 3.5 + Math.random() * 3.5;
          p.position.z = -2 + Math.random() * 8;
        }
      } else if (ud.type === 'curtain') {
        p.position.x += ud.speedX;
        p.position.y += ud.driftY;
        p.position.z += Math.sin(time * ud.waveSpeed + ud.seed) * ud.waveAmp;
        p.rotation.y += Math.sin(time * ud.waveSpeed * 0.5 + ud.seed) * 0.0005;
        p.scale.y = 1 + Math.sin(time * ud.pulseSpeed + ud.seed) * 0.4;
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          const pulse = 0.7 + Math.cos(time * ud.pulseSpeed * 0.6 + ud.seed) * 0.3;
          p.material.opacity = Math.max(0.03, ud.baseOpacity * pulse);
        }
        if (p.position.x > 14) p.position.x = -14;
      } else if (ud.type === 'canopy') {
        p.position.x += ud.speedX;
        p.position.z += Math.sin(time * ud.waveSpeed + ud.seed) * ud.waveAmp;
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          const pulse = 0.6 + Math.sin(time * ud.pulseSpeed + ud.seed) * 0.4;
          p.material.opacity = Math.max(0.02, ud.baseOpacity * pulse);
        }
        if (p.position.x > 14) p.position.x = -14;
      } else if (ud.type === 'ion') {
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          p.material.opacity = 0.08 + Math.abs(Math.sin(time * ud.pulseSpeed + ud.seed)) * 0.32;
        }
      } else if (ud.type === 'star') {
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          p.material.opacity = 0.25 + Math.abs(Math.sin(time * ud.pulseSpeed + ud.seed)) * 0.45;
        }
      } else if (ud.type === 'reflection') {
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          const pulse = 0.5 + Math.sin(time * ud.pulseSpeed + ud.seed) * 0.5;
          p.material.opacity = Math.max(0.01, ud.baseOpacity * pulse);
        }
      } else if (ud.type === 'steam') {
        p.position.y += ud.speedY;
        p.position.x += Math.sin(time * ud.swaySpeed) * ud.swayAmp;
        p.position.z += Math.cos(time * ud.swaySpeed) * ud.swayAmp;
        if (p instanceof THREE.Mesh && !Array.isArray(p.material)) {
          const life = (p.position.y - ud.initialY) / (ud.maxHeight - ud.initialY);
          p.material.opacity = Math.max(0, 0.5 * (1 - life));
        }
        if (p.position.y > ud.maxHeight) {
          p.position.y = ud.initialY;
          if (p instanceof THREE.Mesh && !Array.isArray(p.material)) p.material.opacity = 0.5;
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
    for (const fl of this._flickerLights) {
      this.scene.remove(fl.light);
    }
    this._particles = [];
    this._flickerLights = [];
    this._auroraMaterials = [];
    super.destroy();
  }
}
