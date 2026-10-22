// ===== src/renderer/rendering/ShoreLife.ts =====
// Hand-placed garden silhouettes, a lived-in fishing landing and quiet wildlife.
// All twelve palettes use original, seeded voxel geometry; no downloaded assets.

import * as THREE from 'three';
import type { LocationData } from '../../shared/types';
import { buildInstancedVoxels, createRng, mixHex, shade, type InstancedVoxel } from './ArtKit';

export class ShoreLife {
  readonly group = new THREE.Group();
  private readonly wildlife: THREE.InstancedMesh;
  private readonly fish: THREE.InstancedMesh;
  private readonly reeds: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private readonly night: boolean;
  private readonly phase: number;

  constructor(data: LocationData) {
    this.group.name = 'sanctuary-shore-life';
    const rng = createRng(`shore-life:${data.id}`);
    this.phase = rng.nextFloat(0, 6.28);
    this.night = ['usa', 'uk', 'denmark', 'iceland'].includes(data.id);
    const winter = ['germany', 'denmark', 'iceland'].includes(data.id);
    const desert = data.id === 'egypt';
    const city = data.id === 'usa';
    const art = data.theme?.art;
    const grass = data.theme?.island.grass ?? 0x86a073;
    const stone = data.theme?.island.stone ?? 0x86938c;
    const wood = city ? 0x48586c : winter ? 0x7a756c : 0x997457;
    const foliage = desert ? 0x768d62 : mixHex(grass, 0x446e60, 0.48);
    const flower = data.id === 'japan' ? 0xf2c4cb : data.id === 'greece' ? 0xd46a9b : 0xe5cda0;
    const cells: InstancedVoxel[] = [];
    const lights: InstancedVoxel[] = [];
    const add = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
      rotY = 0,
    ) => {
      cells.push({ x, y, z, w, h, d, color, rotY });
    };

    // Broad masses, then small details: gardens frame the island without
    // filling the central path or the fisherman / bobber interaction corridor.
    const gardens = [
      [-4.65, 0.3],
      [4.1, 3.3],
      [-1, -5.1],
      [4.8, -1.9],
    ];
    for (const [cx, cz] of gardens) {
      const rotation = rng.nextFloat(-0.4, 0.4);
      add(cx, 1.58, cz, 1.3, 0.16, 0.8, shade(stone, 0.87), rotation);
      if (city) {
        add(cx, 1.83, cz, 1.05, 0.5, 0.65, 0x344252, rotation);
        add(cx, 2.1, cz, 1.1, 0.1, 0.7, 0x6c7f8c, rotation);
        lights.push({
          x: cx,
          y: 2.17,
          z: cz,
          w: 0.8,
          h: 0.06,
          d: 0.1,
          color: art?.glow ?? 0x78dfdc,
        });
        for (let i = 0; i < 3; i++) add(cx - 0.3 + i * 0.3, 2.25, cz, 0.09, 0.2, 0.4, foliage);
        continue;
      }
      for (let j = 0; j < 6; j++) {
        const x = cx + rng.nextFloat(-0.55, 0.55);
        const z = cz + rng.nextFloat(-0.35, 0.35);
        const height = rng.nextFloat(0.28, 0.65);
        const color = shade(foliage, rng.nextFloat(0.82, 1.13));
        add(x, 1.62 + height / 2, z, 0.45, height, 0.4, color);
        add(x - 0.07, 1.66 + height, z, 0.3, 0.2, 0.3, winter ? 0xdde6df : shade(color, 1.15));
        if (!winter && j % 2 === 0) {
          add(x, 1.87 + height, z, 0.16, 0.14, 0.16, flower);
          add(x + 0.07, 1.92 + height, z - 0.05, 0.08, 0.08, 0.08, 0xf3dfab);
        }
      }
      // Stone clusters give each planted bed a readable lower silhouette.
      add(cx - 0.65, 1.75, cz + 0.2, 0.45, 0.45, 0.5, stone, rotation);
      add(cx - 0.7, 2.0, cz + 0.2, 0.3, 0.1, 0.3, winter ? 0xe5ece3 : mixHex(stone, grass, 0.4));
    }

    // The landing meets the existing feet at y=1.5. Its lower supports explain
    // the drop from island to water and leave the fishing line unobstructed.
    for (let i = 0; i < 13; i++) {
      add(-2.8, 1.41, 3.65 + i * 0.24, 1.45, 0.16, 0.215, shade(wood, i % 3 === 0 ? 1.12 : 0.94));
    }
    for (const x of [-3.42, -2.18]) {
      add(x, 0.35, 5.8, 0.19, 2.1, 0.2, shade(wood, 0.7));
      add(x, 1.66, 5.8, 0.23, 0.45, 0.23, wood);
      add(x, 1.9, 5.8, 0.3, 0.08, 0.3, winter ? 0xd6dfdb : 0xc6b48c);
    }
    add(-2.8, 1.25, 5.95, 1.7, 0.16, 0.16, shade(wood, 0.74));
    // A box, folded cloth, bucket and a little landing lamp.
    add(-3.75, 1.72, 3.2, 0.65, 0.45, 0.55, wood);
    add(-3.75, 1.98, 3.2, 0.72, 0.08, 0.6, 0xb89c76);
    add(-3.75, 2.05, 3.25, 0.45, 0.08, 0.4, winter ? 0xb8cbd3 : 0x8ca79c);
    add(-2.0, 1.7, 3.55, 0.35, 0.4, 0.35, 0x899a9c);
    add(-2.0, 1.92, 3.55, 0.4, 0.06, 0.4, 0xc6d1cb);
    add(-3.4, 2.03, 5.8, 0.34, 0.07, 0.34, 0x43504c);
    add(-3.4, 2.43, 5.8, 0.4, 0.1, 0.4, 0x43504c);
    for (const x of [-3.54, -3.26]) add(x, 2.25, 5.8, 0.055, 0.4, 0.25, 0x43504c);
    lights.push({ x: -3.4, y: 2.24, z: 5.8, w: 0.23, h: 0.3, d: 0.23, color: 0xffd799 });

    // Deliberate stone trail from the clear centre to the landing.
    for (let i = 0; i < 5; i++) {
      add(
        -2.8 + Math.sin(i * 0.8) * 0.2,
        1.54,
        1.1 + i * 0.48,
        0.55,
        0.06,
        0.35,
        mixHex(stone, 0xd6cfb7, 0.25),
        i * 0.15,
      );
    }
    this.group.add(buildInstancedVoxels(cells, { castShadow: true, receiveShadow: true }));
    this.group.add(buildInstancedVoxels(lights, { shading: 'basic', receiveShadow: false }));

    // Three gently swaying reed beds; one instanced batch, one transform.
    const reedCells: InstancedVoxel[] = [];
    for (const [x, z] of [
      [-4.9, 2.9],
      [3.9, 4.4],
      [5.4, 0.2],
    ]) {
      for (let i = 0; i < 9; i++) {
        const h = rng.nextFloat(0.35, 0.9);
        const px = x + rng.nextFloat(-0.45, 0.45);
        const pz = z + rng.nextFloat(-0.3, 0.3);
        reedCells.push({ x: px, y: h / 2, z: pz, w: 0.085, h, d: 0.085, color: foliage });
        if (i % 3 === 0)
          reedCells.push({
            x: px,
            y: h,
            z: pz,
            w: 0.14,
            h: 0.22,
            d: 0.14,
            color: winter ? 0xd6ddd2 : 0xc2ab7c,
          });
      }
    }
    this.reeds = buildInstancedVoxels(reedCells, { receiveShadow: true });
    this.reeds.position.y = 1.5;
    this.group.add(this.reeds);

    const fauna = Array.from(
      { length: 15 },
      (_, i): InstancedVoxel => ({
        x: 0,
        y: 0,
        z: 0,
        color: i % 3 === 0 ? 0x575746 : this.night ? 0xf6dca3 : flower,
      }),
    );
    this.wildlife = buildInstancedVoxels(fauna, { shading: 'basic', receiveShadow: false });
    this.wildlife.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wildlife.name = 'shore-butterflies';
    this.group.add(this.wildlife);
    const fishCells = Array.from(
      { length: 18 },
      (_, i): InstancedVoxel => ({
        x: 0,
        y: 0,
        z: 0,
        color: i % 3 === 0 ? 0x344f53 : mixHex(data.theme?.waterColor ?? 0x397d85, 0x5b9f9d, 0.35),
      }),
    );
    this.fish = buildInstancedVoxels(fishCells, { shading: 'basic', receiveShadow: false });
    this.fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fish.name = 'shore-fish';
    this.group.add(this.fish);
    this.update(0);
  }

  update(time: number): void {
    this.reeds.rotation.z = Math.sin(time * 0.7 + this.phase) * 0.018;
    const t = this.transform;
    for (let i = 0; i < 5; i++) {
      const phase = i * 2.399 + this.phase;
      const x = Math.cos(phase) * 4.5 + Math.sin(time * 0.27 + phase) * 0.5;
      const z = Math.sin(phase) * 4.5 + Math.cos(time * 0.22 + phase) * 0.4;
      const y = 2.7 + Math.sin(time * 0.8 + phase) * 0.3;
      for (let wing = 0; wing < 3; wing++) {
        const side = wing === 1 ? -1 : 1;
        t.position.set(x + (wing ? side * 0.09 : 0), y, z);
        t.rotation.set(0, phase + time * 0.2, wing ? side * Math.sin(time * 7 + phase) * 0.8 : 0);
        t.scale.set(wing ? 0.17 : 0.055, wing ? 0.04 : 0.06, wing ? 0.12 : 0.16);
        if (this.night && wing) t.scale.multiplyScalar(0.55 + Math.sin(time * 1.8 + phase) * 0.2);
        t.updateMatrix();
        this.wildlife.setMatrixAt(i * 3 + wing, t.matrix);
      }
    }
    for (let i = 0; i < 6; i++) {
      const angle = time * 0.065 + i * 0.75 + this.phase;
      const radius = 6.8 + Math.sin(i * 4.7) * 0.25;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      for (let part = 0; part < 3; part++) {
        const offset = part === 1 ? -0.24 : part === 2 ? 0.05 : 0;
        t.position.set(x - Math.sin(angle) * offset, -1.91, z + Math.cos(angle) * offset);
        t.rotation.set(
          0,
          -angle - Math.PI / 2 + (part === 1 ? Math.sin(time * 3 + i) * 0.4 : 0),
          0,
        );
        t.scale.set(part === 0 ? 0.42 : 0.15, 0.025, part === 2 ? 0.23 : 0.12);
        t.updateMatrix();
        this.fish.setMatrixAt(i * 3 + part, t.matrix);
      }
    }
    this.wildlife.instanceMatrix.needsUpdate = true;
    this.fish.instanceMatrix.needsUpdate = true;
  }
}
