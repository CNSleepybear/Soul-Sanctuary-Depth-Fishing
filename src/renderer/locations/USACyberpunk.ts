// ===== src/renderer/locations/USACyberpunk.ts =====
// 🇺🇸 USA — Cyberpunk Neon Alley with floating island, grid floor, server racks,
// data rain, holographic rings, drifting ground fog and a patrol drone.
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

export class USACyberpunk extends BaseLocation {
  readonly id = 'usa';
  private _particles: THREE.Object3D[] = [];
  private _flickerLights: {
    light: THREE.Light;
    base: number;
    speed: number;
    amp: number;
    noise?: boolean;
  }[] = [];
  private _waterfall: Waterfall | null = null;
  private _drone: THREE.Group | null = null;
  private _droneLight: THREE.PointLight | null = null;

  get data(): LocationData {
    return LOCATIONS.find((l) => l.id === 'usa')!;
  }

  protected buildGeometry(): void {
    const m = {
      floor: MaterialCache.getLambert(0x201828),
      wall: MaterialCache.getLambert(0x241a30),
      wallTrim: MaterialCache.getLambert(0x1a1225),
      rack: MaterialCache.getLambert(0x2a2035),
      rackLight: MaterialCache.getBasic(0x33ff33),
      neonPink: MaterialCache.getBasic(0xff2a85),
      neonCyan: MaterialCache.getBasic(0x00f3ff),
      neonOrange: MaterialCache.getBasic(0xff6600),
      neonPurple: MaterialCache.getBasic(0xaa00ff),
      hologram: MaterialCache.getTransparentLambert(0x88ccff, 0.55),
      grid: MaterialCache.getBasic(0xff00ff),
      gridCyan: MaterialCache.getBasic(0x00ffff),
      fog: MaterialCache.getTransparentLambert(0xff00ff, 0.15),
      water: MaterialCache.getTransparentLambert(0x1a0a20, 0.7),
      waterCyan: MaterialCache.getTransparentLambert(0x00f3ff, 0.35),
      droneBody: MaterialCache.getLambert(0x3a3a4a),
      droneEye: MaterialCache.getBasic(0xff6600),
      droneProp: MaterialCache.getBasic(0x00f3ff),
    };

    // Theme-aware floating island
    const islandTheme = this.data.theme?.island;
    const island = new FloatingIsland(
      islandTheme ? { ...islandTheme } : { stone: 0x3a3a5a, earth: 0x2a2a4a, grass: 0x1a1a32 },
    );
    this.group.add(island.group);

    const layer = new VoxelBuilder();
    layer.group.position.y = 1.5;
    this.group.add(layer.group);

    // Raw box helper for grouped objects (signs, racks, drone)
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
      color: 0x00f3ff,
      opacity: 0.55,
      density: 0.75,
    });
    this.group.add(this._waterfall.group);

    // Floor
    layer.boxMat(12, 0.2, 12, m.floor, 0, 0.1, 0);

    // Neon grid lines on floor (magenta / cyan alternating)
    for (let i = -5; i <= 5; i++) {
      layer.boxMat(0.08, 0.02, 12, m.neonPink, i * 1.1, 0.21, 0, { castShadow: false });
      layer.boxMat(12, 0.02, 0.08, m.neonCyan, 0, 0.21, i * 1.1, { castShadow: false });
    }

    // Water reflection plane below grid
    const reflect = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 12), m.water);
    reflect.position.set(0, -0.15, 0);
    reflect.castShadow = false;
    reflect.receiveShadow = false;
    layer.group.add(reflect);
    for (let i = -5; i <= 5; i++) {
      layer.boxMat(0.08, 0.02, 12, m.neonCyan, i * 1.1, -0.12, 0, { castShadow: false });
      layer.boxMat(12, 0.02, 0.08, m.neonPink, 0, -0.12, i * 1.1, { castShadow: false });
    }

    // Alley walls (taller canyon feel)
    layer.boxMat(0.5, 9, 12, m.wall, -5.5, 4.5, 0);
    layer.boxMat(0.5, 9, 12, m.wall, 5.5, 4.5, 0);
    // Wall trim/frames
    layer.boxMat(0.55, 0.2, 12.1, m.wallTrim, -5.5, 8.9, 0);
    layer.boxMat(0.55, 0.2, 12.1, m.wallTrim, 5.5, 8.9, 0);
    // Neon vertical strips on walls
    for (let z = -5; z <= 5; z += 2.5) {
      layer.boxMat(0.08, 7, 0.12, m.neonPink, -5.25, 4, z, { castShadow: false });
      layer.boxMat(0.08, 7, 0.12, m.neonCyan, 5.25, 4, z, { castShadow: false });
    }
    // Orange accent vertical strips
    layer.boxMat(0.08, 7, 0.12, m.neonOrange, -5.25, 4, 0, { castShadow: false });
    layer.boxMat(0.08, 7, 0.12, m.neonOrange, 5.25, 4, 0, { castShadow: false });

    // Server racks
    const makeRack = (rx: number, rz: number) => {
      const rack = new THREE.Group();
      box(1.2, 3.2, 1, m.rack, 0, 1.6, 0, rack, false);
      for (let i = 0; i < 6; i++) {
        const lightMat = i % 2 === 0 ? m.neonCyan : m.neonOrange;
        box(0.9, 0.12, 0.05, lightMat, 0, 0.5 + i * 0.45, 0.51, rack, false);
      }
      rack.position.set(rx, 0, rz);
      return rack;
    };
    layer.group.add(makeRack(-4, -2));
    layer.group.add(makeRack(-4, 1));
    layer.group.add(makeRack(-4, 4));
    layer.group.add(makeRack(4, -2));
    layer.group.add(makeRack(4, 1));
    layer.group.add(makeRack(4, 4));

    // Cables between racks (more varied)
    for (let z of [-0.5, 2.5]) {
      const cable = box(0.06, 0.06, 1.6, m.neonCyan, -4, 2.6, z, layer.group, false);
      cable.rotation.x = 0.15;
      const cableR = box(0.06, 0.06, 1.6, m.neonCyan, 4, 2.6, z, layer.group, false);
      cableR.rotation.x = -0.15;
    }
    for (let z of [-2.5, 1.0]) {
      const cable = box(0.05, 0.05, 1.8, m.neonOrange, -4, 1.8, z, layer.group, false);
      cable.rotation.x = -0.12;
      const cableR = box(0.05, 0.05, 1.8, m.neonOrange, 4, 1.8, z, layer.group, false);
      cableR.rotation.x = 0.12;
    }

    // Neon signs "FISH", "BYTE", "404"
    const makeSign = (label: string, mat: THREE.Material, x: number, z: number, rotY: number) => {
      const sign = new THREE.Group();
      const w = label.length * 0.55 + 0.3;
      box(w, 0.9, 0.15, mat, 0, 0, 0, sign, false);
      for (let i = 0; i < label.length; i++) {
        box(0.08, 0.55, 0.08, mat, (i - (label.length - 1) / 2) * 0.5, 0, 0.1, sign, false);
      }
      sign.position.set(x, 3.2, z);
      sign.rotation.y = rotY;
      return sign;
    };
    layer.group.add(makeSign('FISH', m.neonPink, -2.5, -3.8, 0.2));
    layer.group.add(makeSign('BYTE', m.neonCyan, 2.5, -3.8, -0.2));
    layer.group.add(makeSign('404', m.neonOrange, 0, -4.5, 0));

    // Matching point lights for signs
    const pinkLight = new THREE.PointLight(0xff2a85, 2.5, 7);
    pinkLight.position.set(-2.5, 3.6, -3.2);
    layer.group.add(pinkLight);
    const cyanLight = new THREE.PointLight(0x00f3ff, 2.5, 7);
    cyanLight.position.set(2.5, 3.6, -3.2);
    layer.group.add(cyanLight);
    const orangeLight = new THREE.PointLight(0xff6600, 2.5, 7);
    orangeLight.position.set(0, 3.6, -4.0);
    layer.group.add(orangeLight);
    this._flickerLights.push(
      { light: pinkLight, base: 2.2, speed: 12, amp: 0.4, noise: true },
      { light: cyanLight, base: 2.2, speed: 10, amp: 0.35, noise: true },
      { light: orangeLight, base: 2.0, speed: 14, amp: 0.5, noise: true },
    );

    // Holographic pillars with spinning rings
    [
      [-3, -1],
      [3, -1],
      [-3, 2.5],
      [3, 2.5],
    ].forEach((pos, idx) => {
      const pillar = new THREE.Group();
      box(0.2, 4, 0.2, m.hologram, 0, 2, 0, pillar, false);
      box(0.6, 0.08, 0.6, m.hologram, 0, 3.8, 0, pillar, false);
      // Rotating ring
      const ring = new THREE.Group();
      box(1.0, 0.04, 0.04, m.hologram, 0, 0, 0.5, ring, false);
      box(1.0, 0.04, 0.04, m.hologram, 0, 0, -0.5, ring, false);
      box(0.04, 0.04, 1.0, m.hologram, 0.5, 0, 0, ring, false);
      box(0.04, 0.04, 1.0, m.hologram, -0.5, 0, 0, ring, false);
      ring.position.y = 2.5;
      ring.userData = { type: 'holo_ring', speed: 1.5 + idx * 0.3, phase: idx * 1.2 };
      pillar.add(ring);
      this._particles.push(ring);
      pillar.position.set(pos[0], 0, pos[1]);
      layer.group.add(pillar);
    });

    // Ground-level emissive fog
    box(11, 0.4, 11, m.fog, 0, 0.25, 0, layer.group, false);

    // Grid pulse markers
    const pulseGeo = new THREE.BoxGeometry(0.12, 0.02, 0.12);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(pulseGeo, pulseMat.clone());
      p.position.set((Math.random() - 0.5) * 10, 0.22, (Math.random() - 0.5) * 10);
      p.userData = { type: 'grid_pulse', speed: 2 + Math.random() * 3, seed: Math.random() * 100 };
      layer.group.add(p);
      this._particles.push(p);
    }

    // Data rain particles
    const rg = new THREE.BoxGeometry(0.08, 0.25, 0.08);
    const rainMats = [m.neonPink, m.neonCyan, m.neonOrange];
    for (let i = 0; i < 60; i++) {
      const p = new THREE.Mesh(rg, rainMats[Math.floor(Math.random() * rainMats.length)]);
      p.position.set(Math.random() * 10 - 5, Math.random() * 8 + 2, Math.random() * 12 - 6);
      p.userData = {
        type: 'rain',
        speed: 0.05 + Math.random() * 0.08,
        resetY: 8 + Math.random() * 4,
      };
      layer.group.add(p);
      this._particles.push(p);
    }

    // Orange accent signage on walls
    layer.boxMat(0.1, 2.2, 0.6, m.neonOrange, -5.2, 4.2, -2, { castShadow: false });
    layer.boxMat(0.1, 1.8, 0.4, m.neonOrange, 5.2, 3.8, 2, { castShadow: false });

    // ── Patrol drone character ──
    this._drone = new THREE.Group();
    box(0.35, 0.2, 0.35, m.droneBody, 0, 0, 0, this._drone, false);
    box(0.1, 0.1, 0.1, m.droneEye, 0.13, 0, 0, this._drone, false);
    // Rotors
    const rotorGeo = new THREE.BoxGeometry(0.45, 0.02, 0.08);
    const rotor1 = new THREE.Mesh(rotorGeo, m.droneProp);
    rotor1.position.set(0, 0.15, 0);
    this._drone.add(rotor1);
    const rotor2 = new THREE.Mesh(rotorGeo, m.droneProp);
    rotor2.position.set(0, 0.15, 0);
    rotor2.rotation.y = Math.PI * 0.5;
    this._drone.add(rotor2);
    this._drone.userData = {
      type: 'drone',
      baseX: 0,
      baseZ: 0,
      phase: Math.random() * Math.PI * 2,
    };
    this._drone.position.set(0, 2.2, 0);
    layer.group.add(this._drone);
    this._particles.push(this._drone);

    this._droneLight = new THREE.PointLight(0xff6600, 1.2, 4);
    this._droneLight.position.set(0, 2.2, 0);
    layer.group.add(this._droneLight);

    this.scene.add(this.group);
  }

  protected buildAtmosphere(): void {
    const layer = this.group.children[1] as THREE.Group;
    // Neon reflection on the wet floor
    const shimmer = createSurfaceShimmer(layer, 16, 0x00f3ff, { x: 10, z: 10, y: -0.1 });
    this._particles.push(...shimmer);

    // Drifting ground fog puffs
    const fogGeo = new THREE.BoxGeometry(0.25, 0.12, 0.25);
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(fogGeo, fogMat.clone());
      p.position.set(
        (Math.random() - 0.5) * 10,
        0.25 + Math.random() * 0.4,
        (Math.random() - 0.5) * 10,
      );
      p.userData = {
        type: 'drift_fog',
        baseX: p.position.x,
        baseZ: p.position.z,
        speed: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        radius: 0.3 + Math.random() * 0.8,
      };
      layer.add(p);
      this._particles.push(p);
    }
  }

  protected updateAtmosphere(_dt: number, time: number): void {
    // Animate waterfall
    this._waterfall?.update(time);

    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud) continue;
      if (ud.type === 'grid_pulse' && p instanceof THREE.Mesh) {
        const pulse = Math.abs(Math.sin(time * ud.speed + ud.seed));
        if (!Array.isArray(p.material)) p.material.opacity = 0.2 + pulse * 0.6;
        p.scale.setScalar(0.6 + pulse * 0.8);
      } else if (ud.type === 'shimmer' && p instanceof THREE.Mesh) {
        updateSurfaceShimmer(time, [p as THREE.Mesh]);
      } else if (ud.type === 'holo_ring') {
        p.rotation.y = time * ud.speed + ud.phase;
        p.rotation.x = Math.sin(time * 0.8 + ud.phase) * 0.15;
      } else if (ud.type === 'drone' && p instanceof THREE.Group) {
        p.position.x = Math.sin(time * 0.6 + ud.phase) * 2.2;
        p.position.z = Math.cos(time * 0.4 + ud.phase) * 1.6;
        p.position.y = 2.2 + Math.sin(time * 1.2 + ud.phase) * 0.25;
        p.rotation.y = Math.atan2(
          Math.cos(time * 0.6 + ud.phase) * 2.2,
          -Math.sin(time * 0.4 + ud.phase) * 1.6,
        );
        if (this._droneLight) {
          this._droneLight.position.copy(p.position);
        }
      } else if (ud.type === 'drift_fog' && p instanceof THREE.Mesh) {
        p.position.x = ud.baseX + Math.sin(time * ud.speed + ud.phase) * ud.radius;
        p.position.z = ud.baseZ + Math.cos(time * ud.speed * 0.7 + ud.phase) * ud.radius;
        if (!Array.isArray(p.material))
          p.material.opacity = 0.12 + Math.abs(Math.sin(time * 0.8 + ud.phase)) * 0.12;
      }
    }
  }

  update(_dt: number, time: number): void {
    for (const p of this._particles) {
      const ud = p.userData;
      if (!ud || ud.type !== 'rain') continue;
      p.position.y -= ud.speed;
      if (p.position.y < 0.2) {
        p.position.y = ud.resetY;
        p.position.x = Math.random() * 10 - 5;
        p.position.z = Math.random() * 12 - 6;
      }
    }
    for (const fl of this._flickerLights) {
      updateFlicker(time, fl);
    }
  }

  destroy(): void {
    this._waterfall?.dispose();
    this._waterfall = null;
    this._drone = null;
    this._droneLight = null;
    this._particles = [];
    this._flickerLights = [];
    super.destroy();
  }
}
