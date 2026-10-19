// ===== src/renderer/rendering/SanctuaryDetails.ts =====
// Shoreline micro-detail shared by every sanctuary: pebbles, shells, driftwood,
// reeds, flower heads, snow mounds, city vents and tiny warm lights. The point
// is scale and "inhabitedness" — 12 dioramas should not read as empty grass.
//
// Everything is clustered (never evenly sprinkled) and mostly instanced so the
// detail budget stays friendly (see docs/art-direction-v2.md §2.4/§3.2).

import * as THREE from 'three';
import {
  buildInstancedVoxels,
  createRng,
  hashSeed,
  mixHex,
  shade,
  type InstancedVoxel,
} from './ArtKit';

type ShoreStyle =
  | 'blossom'
  | 'reed'
  | 'herb'
  | 'snow'
  | 'city'
  | 'desert'
  | 'tropical'
  | 'volcanic';

interface ShoreProfile {
  style: ShoreStyle;
  foliage: number;
  flower: number;
  stone: number;
  accent: number;
}

const STYLES: Record<string, ShoreProfile> = {
  japan: {
    style: 'blossom',
    foliage: 0x78966b,
    flower: 0xf1c5c3,
    stone: 0x9aa09a,
    accent: 0xffb45c,
  },
  china: { style: 'reed', foliage: 0x6d9978, flower: 0xe6d9ae, stone: 0x8b918c, accent: 0xffd27a },
  usa: { style: 'city', foliage: 0x4a5368, flower: 0x86ced5, stone: 0x586276, accent: 0xff5fd2 },
  uk: { style: 'herb', foliage: 0x718875, flower: 0xc0b1c8, stone: 0x8b918c, accent: 0xffaa44 },
  france: { style: 'herb', foliage: 0x899067, flower: 0xd4b581, stone: 0x9aa09a, accent: 0xffb066 },
  germany: {
    style: 'snow',
    foliage: 0x94a5a1,
    flower: 0xe2e9df,
    stone: 0xaab0b8,
    accent: 0xffc46b,
  },
  italy: { style: 'herb', foliage: 0x7f9971, flower: 0xe4b3b2, stone: 0x9aa09a, accent: 0xff9a5c },
  denmark: {
    style: 'snow',
    foliage: 0x9ab0a8,
    flower: 0xe6ece1,
    stone: 0x8a9aaa,
    accent: 0xffc46b,
  },
  iceland: {
    style: 'volcanic',
    foliage: 0x7a9584,
    flower: 0xcbddda,
    stone: 0x6a6a6a,
    accent: 0x7df0c0,
  },
  thailand: {
    style: 'tropical',
    foliage: 0x7ca174,
    flower: 0xe5b9cd,
    stone: 0x9aa09a,
    accent: 0xffb833,
  },
  egypt: {
    style: 'desert',
    foliage: 0x7f9c81,
    flower: 0xe6c27f,
    stone: 0xc4b896,
    accent: 0xffcc55,
  },
  greece: { style: 'herb', foliage: 0x8c9b72, flower: 0xd9a6b9, stone: 0xf0ece2, accent: 0x9dc6e8 },
};

export class SanctuaryDetails {
  readonly group = new THREE.Group();

  constructor(locationId: string) {
    const profile = STYLES[locationId] ?? STYLES.japan;
    const rng = createRng(hashSeed(`details:${locationId}`));
    const cells: InstancedVoxel[] = [];
    const surfaceY = 1.5;
    const isSnow = profile.style === 'snow' || profile.style === 'volcanic';
    const isCity = profile.style === 'city';
    const isDesert = profile.style === 'desert';
    const isTropical = profile.style === 'tropical';

    // Five deliberate patches around the coast, leaving the fisherman's lane
    // (south-east shore, roughly x > 1.5 / z > 3) clear for the fishing spot.
    const patches: [number, number][] = [
      [4.25, 2.35],
      [3.3, 3.85],
      [-4.55, -1.35],
      [-4.2, 2.45],
      [0.4, -4.6],
    ];
    patches.forEach(([baseX, baseZ], patchIndex) => {
      const x = baseX + rng.nextFloat(-0.25, 0.25);
      const z = baseZ + rng.nextFloat(-0.25, 0.25);
      if (isCity) {
        // Vents, cables and warning lights for the alley floor.
        cells.push({ x, y: surfaceY + 0.12, z, w: 0.75, h: 0.25, d: 0.75, color: 0x586276 });
        cells.push({
          x,
          y: surfaceY + 0.27,
          z: z + 0.25,
          w: 0.55,
          h: 0.04,
          d: 0.06,
          color: profile.flower,
        });
        if (patchIndex % 2 === 0) {
          cells.push({
            x: x + 0.2,
            y: surfaceY + 0.5,
            z: z - 0.1,
            w: 0.1,
            h: 0.35,
            d: 0.1,
            color: profile.accent,
          });
        }
        return;
      }
      if (isSnow) {
        // Snow mound with a wind-scoured edge.
        cells.push({
          x,
          y: surfaceY + 0.1,
          z,
          w: 0.75,
          h: 0.2,
          d: 0.55,
          color: shade(profile.flower, 0.96),
          rotY: rng.nextFloat(-0.3, 0.3),
        });
        cells.push({
          x: x - 0.1,
          y: surfaceY + 0.22,
          z: z + 0.05,
          w: 0.45,
          h: 0.12,
          d: 0.4,
          color: profile.flower,
        });
        return;
      }
      if (isDesert) {
        for (let i = 0; i < 3; i++) {
          cells.push({
            x: x + rng.nextFloat(-0.35, 0.35),
            y: surfaceY + 0.14,
            z: z + rng.nextFloat(-0.35, 0.35),
            w: 0.3,
            h: 0.28,
            d: 0.2,
            color: profile.foliage,
            rotY: rng.nextFloat(-0.5, 0.5),
          });
        }
        cells.push({
          x,
          y: surfaceY + 0.28,
          z,
          w: 0.08,
          h: 0.55,
          d: 0.08,
          color: shade(profile.foliage, 0.85),
        });
        return;
      }
      const clusterSize = profile.style === 'reed' ? 1.6 : 1;
      const stems = profile.style === 'reed' ? 8 : 5;
      for (let i = 0; i < stems; i++) {
        const angle = rng.nextFloat(0, Math.PI * 2);
        const distance = Math.sqrt(rng.next()) * 0.5 * clusterSize;
        const px = x + Math.cos(angle) * distance;
        const pz = z + Math.sin(angle) * distance;
        const height =
          profile.style === 'reed'
            ? rng.nextFloat(0.55, 1.25)
            : isTropical
              ? rng.nextFloat(0.25, 0.5)
              : rng.nextFloat(0.15, 0.38);
        cells.push({
          x: px,
          y: surfaceY + height / 2,
          z: pz,
          w: 0.0625,
          h: height,
          d: 0.0625,
          color: shade(profile.foliage, rng.nextFloat(0.86, 1.1)),
        });
        if (i % 2 === 0) {
          cells.push({
            x: px,
            y: surfaceY + height + 0.04,
            z: pz,
            w: isTropical ? 0.2 : 0.14,
            h: 0.1,
            d: isTropical ? 0.12 : 0.14,
            color: profile.flower,
          });
        }
      }
      if (profile.style === 'blossom') {
        // Fallen petals around the cherry trees.
        for (let i = 0; i < 5; i++) {
          cells.push({
            x: x + rng.nextFloat(-0.55, 0.55),
            y: surfaceY + 0.045,
            z: z + rng.nextFloat(-0.55, 0.55),
            w: 0.14,
            h: 0.02,
            d: 0.1,
            color: rng.chance(0.5) ? profile.flower : mixHex(profile.flower, 0xffffff, 0.25),
            rotY: rng.nextFloat(0, Math.PI),
          });
        }
      }
    });

    // Pebbles and shells hugging the coastline, instanced together with the
    // patch detail so cost stays at one draw call.
    const pebbleCount = isSnow ? 10 : 18;
    for (let i = 0; i < pebbleCount; i++) {
      const angle = rng.nextFloat(0, Math.PI * 2);
      const radius = rng.nextFloat(5.3, 6.1);
      const size = rng.nextFloat(0.14, 0.32);
      cells.push({
        x: Math.cos(angle) * radius,
        y: surfaceY + size / 2,
        z: Math.sin(angle) * radius,
        w: size,
        h: size * (isSnow ? 0.9 : 0.55),
        d: size * rng.nextFloat(0.7, 1.2),
        color: shade(profile.stone, rng.nextFloat(0.85, 1.1)),
        rotY: rng.nextFloat(-0.6, 0.6),
      });
    }

    const detailMesh = buildInstancedVoxels(cells, { castShadow: false, receiveShadow: true });
    this.group.add(detailMesh);

    // Three small warm lights per shore: lanterns / windows / sparks. The
    // scene itself owns the "hero" lights; these are just living punctuation.
    const lightSpots: [number, number][] = [
      [-4.6, -0.4],
      [2.6, -3.9],
      [-1.6, 4.4],
    ];
    lightSpots.forEach(([x, z], index) => {
      if (isCity) return;
      const color = mixHex(profile.accent, 0xfff2d0, 0.2);
      const light = new THREE.PointLight(color, 0.45, 3.2);
      light.position.set(x, surfaceY + 0.9, z);
      this.group.add(light);
      const orb = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color }),
      );
      orb.position.set(x, surfaceY + 0.72, z);
      orb.userData.phase = index * 2.1;
      this.group.add(orb);
    });
  }
}
