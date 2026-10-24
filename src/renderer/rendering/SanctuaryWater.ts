// ===== src/renderer/rendering/SanctuaryWater.ts =====
// Stylised voxel water shared by all 12 sanctuaries.
//
// v2 art pass (docs/art-direction-v2.md §4.2): a shallow shelf hugs the island,
// five depth bands fade towards the desktop, and coloured landmark reflections
// plus instanced glints sit above them. Broken coastal foam threads and two
// masked instanced ripple rings keep the transparent surface inexpensive.

import * as THREE from 'three';
import type { LocationData } from '../../shared/types';
import { mixHex, shade, snap } from './ArtKit';

const WATER_Y = -1.95;
const TILE = 0.5;
const INNER = 4.9;
const OUTER = 7.9;
const FOAM_SEGMENTS = 64;
const FOAM_WIDTH = 0.1;
const FOAM_Y = WATER_Y + 0.075;

function makeFoamRing(seedOffset: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < FOAM_SEGMENTS; i++) {
    if ((i + seedOffset) % 13 < 8 || (i + seedOffset) % 17 === 8) continue;
    const angle = (i / FOAM_SEGMENTS) * Math.PI * 2;
    const nextAngle = ((i + 1) / FOAM_SEGMENTS) * Math.PI * 2;
    const coast = (a: number) =>
      5.75 +
      Math.sin(a * 3 + seedOffset * 0.37) * 0.42 +
      Math.cos(a * 5 - seedOffset * 0.19) * 0.18;
    const innerRadius = coast(angle) - FOAM_WIDTH / 2;
    const outerRadius = coast(angle) + FOAM_WIDTH / 2;
    const nextInner = coast(nextAngle) - FOAM_WIDTH / 2;
    const nextOuter = coast(nextAngle) + FOAM_WIDTH / 2;
    const vertex = positions.length / 3;
    positions.push(
      Math.cos(angle) * innerRadius,
      FOAM_Y,
      Math.sin(angle) * innerRadius,
      Math.cos(angle) * outerRadius,
      FOAM_Y,
      Math.sin(angle) * outerRadius,
      Math.cos(nextAngle) * nextInner,
      FOAM_Y,
      Math.sin(nextAngle) * nextInner,
      Math.cos(nextAngle) * nextOuter,
      FOAM_Y,
      Math.sin(nextAngle) * nextOuter,
    );
    indices.push(vertex, vertex + 2, vertex + 3, vertex, vertex + 3, vertex + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

interface Tile {
  x: number;
  y: number;
  z: number;
  color: number;
  w?: number;
  h?: number;
  d?: number;
}

function makeInstanced(
  cells: Tile[],
  opacity: number,
  opts: { additive?: boolean; depthWrite?: boolean } = {},
): THREE.InstancedMesh {
  // A single horizontal face avoids transparent cube sides stacking into a
  // wire basket. Tiles share exact edges and one elevation, without overlaps.
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: opts.depthWrite ?? false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, cells.length));
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  cells.forEach((cell, index) => {
    position.set(cell.x, cell.y, cell.z);
    scale.set(cell.w ?? 1, cell.h ?? 1, cell.d ?? 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    color.setHex(cell.color);
    mesh.setColorAt(index, color);
  });
  mesh.count = cells.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
}

export class SanctuaryWater {
  readonly group = new THREE.Group();
  private foamMaterial: THREE.MeshBasicMaterial | null = null;
  private foamMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  private glintMaterialA: THREE.MeshBasicMaterial | null = null;
  private glintMaterialB: THREE.MeshBasicMaterial | null = null;
  private reflectionMaterial: THREE.MeshBasicMaterial | null = null;
  private rippleGroups: THREE.Group[] = [];

  constructor(data: LocationData, seedText = 'sanctuary') {
    const theme = data.theme;
    const shallow = mixHex(theme?.waterColor ?? 0x285666, 0x9dd8cd, 0.28);
    const deep = shade(theme?.waterColor ?? 0x285666, 0.68);
    const foamColor = mixHex(shallow, 0xf4f0e2, 0.56);
    const glow = theme?.art?.glow ?? theme?.uiAccent ?? 0xffcc88;
    const accent = theme?.art?.accent ?? theme?.uiAccent ?? 0xd9a15e;
    const seedOffset = Array.from(seedText).reduce((sum, char) => sum + char.charCodeAt(0), 0);

    // ── Five depth bands, the outer ones fading into the desktop ──
    const bandCount = 5;
    const bands: Tile[][] = Array.from({ length: bandCount }, () => []);
    for (let x = -OUTER; x <= OUTER; x += TILE) {
      for (let z = -OUTER; z <= OUTER; z += TILE) {
        const cx = snap(x + TILE / 2, TILE);
        const cz = snap(z + TILE / 2, TILE);
        const r = Math.hypot(cx, cz);
        if (r > OUTER) continue;
        const t = Math.max(0, Math.min(1, (r - INNER) / (OUTER - INNER)));
        const color =
          t < 0.45
            ? mixHex(shallow, deep, (t / 0.45) * 0.55)
            : mixHex(mixHex(shallow, deep, 0.55), deep, ((t - 0.45) / 0.55) * 0.55);
        const band = Math.min(bandCount - 1, Math.floor(t * bandCount));
        bands[band].push({
          x: cx,
          y: WATER_Y,
          z: cz,
          w: TILE,
          h: 1,
          d: TILE,
          color,
        });
      }
    }
    const opacities = [0.94, 0.76, 0.56, 0.28, 0.08];
    bands.forEach((cells, index) => {
      if (cells.length === 0) return;
      const mesh = makeInstanced(cells, opacities[index]);
      mesh.renderOrder = -5 + index;
      mesh.userData.waterPart = 'depth';
      mesh.userData.band = index;
      this.group.add(mesh);
    });

    // Broken foam threads follow the coast, with quiet gaps between wavelets.
    const foamMaterial = new THREE.MeshBasicMaterial({
      color: foamColor,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.FrontSide,
    });
    this.foamMaterial = foamMaterial;
    const foamMesh = new THREE.Mesh(makeFoamRing(seedOffset), foamMaterial);
    foamMesh.userData.waterPart = 'foam';
    foamMesh.frustumCulled = false;
    foamMesh.castShadow = false;
    foamMesh.receiveShadow = false;
    this.foamMesh = foamMesh;
    this.group.add(foamMesh);

    // ── Two masked ripple rings (very faint, reads as current) ──
    const rippleA = this._makeRippleRing(INNER + 1.5, 36, 0.06, 0);
    const rippleB = this._makeRippleRing(INNER + 2.6, 28, 0.045, 1);
    this.rippleGroups.push(rippleA, rippleB);
    this.group.add(rippleA, rippleB);

    // ── Glints: two instanced batches with out-of-phase twinkle ──
    const glintA: Tile[] = [];
    const glintB: Tile[] = [];
    for (let i = 0; i < 26; i++) {
      const angle = i * 2.39996;
      const r = INNER + 0.6 + (((i * 7) % 100) / 100) * 2.4;
      const cell = {
        x: Math.cos(angle) * r,
        y: WATER_Y + 0.045,
        z: Math.sin(angle) * r,
        color: i % 5 === 0 ? mixHex(foamColor, 0xffffff, 0.5) : mixHex(shallow, foamColor, 0.6),
        w: 0.35 + (((i * 13) % 10) / 10) * 0.3,
        h: 0.03,
        d: 0.07,
      };
      (i % 2 === 0 ? glintA : glintB).push(cell);
    }
    const meshA = makeInstanced(glintA, 0.35, { additive: true, depthWrite: false });
    const meshB = makeInstanced(glintB, 0.24, { additive: true, depthWrite: false });
    meshA.userData.waterPart = 'glint';
    meshB.userData.waterPart = 'glint';
    this.glintMaterialA = meshA.material as THREE.MeshBasicMaterial;
    this.glintMaterialB = meshB.material as THREE.MeshBasicMaterial;
    this.group.add(meshA, meshB);

    // Broken reflections gather below the landmark instead of circling the island.
    const reflections: Tile[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = -1.18 + (i % 6) * 0.085 + Math.sin(i * 4.3) * 0.035;
      const r = INNER + 0.5 + Math.floor(i / 6) * 0.72 + (i % 2) * 0.16;
      reflections.push({
        x: Math.cos(angle) * r,
        y: WATER_Y + 0.055,
        z: Math.sin(angle) * r,
        color: mixHex(i % 3 === 0 ? glow : accent, shallow, 0.34),
        w: 0.28 + ((i * 7) % 5) * 0.17,
        h: 0.03,
        d: 0.06 + (i % 3) * 0.025,
      });
    }
    const reflectionMesh = makeInstanced(reflections, 0.2, { additive: true, depthWrite: false });
    reflectionMesh.userData.waterPart = 'reflection';
    this.reflectionMaterial = reflectionMesh.material as THREE.MeshBasicMaterial;
    this.group.add(reflectionMesh);
  }

  private _makeRippleRing(
    radius: number,
    count: number,
    opacity: number,
    variant: number,
  ): THREE.Group {
    const group = new THREE.Group();
    group.userData.waterPart = 'ripple';
    const geometry = new THREE.BoxGeometry(0.42, 0.02, 0.07);
    const material = new THREE.MeshBasicMaterial({
      color: 0xe8f3ee,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.userData.waterPart = 'ripple';
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    let instanceIndex = 0;
    for (let i = 0; i < count; i++) {
      const mask = (i + variant * 5) % 18;
      if (mask > 3 && (mask < 8 || mask > 10)) continue;
      const angle = (i / count) * Math.PI * 2;
      const rippleRadius = radius + Math.sin(i * 1.73 + variant * 2.1) * 0.035;
      position.set(Math.cos(angle) * rippleRadius, WATER_Y + 0.05, Math.sin(angle) * rippleRadius);
      euler.set(0, -angle - Math.PI / 2, 0);
      quaternion.setFromEuler(euler);
      scale.set(0.85 + ((i * 7 + variant * 3) % 5) * 0.075, 1, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(instanceIndex, matrix);
      instanceIndex++;
    }
    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return group;
  }

  update(time: number): void {
    if (this.foamMaterial && this.foamMesh) {
      const breath = Math.sin(time * 0.85);
      this.foamMaterial.opacity = 0.28 + breath * 0.08;
      const scale = 1 + breath * 0.004;
      this.foamMesh.scale.set(scale, 1, scale);
    }
    for (let index = 0; index < this.rippleGroups.length; index++) {
      const group = this.rippleGroups[index];
      const phase = time * (0.55 + index * 0.17) + index * 1.7;
      const scale = 1 + Math.sin(phase) * 0.012;
      group.scale.set(scale, 1, scale);
      group.rotation.y = Math.sin(time * 0.07 + index) * 0.02;
    }
    if (this.glintMaterialA) {
      this.glintMaterialA.opacity = 0.34 + Math.max(0, Math.sin(time * 1.9)) * 0.34;
    }
    if (this.glintMaterialB) {
      this.glintMaterialB.opacity = 0.26 + Math.max(0, Math.sin(time * 1.4 + 2.1)) * 0.3;
    }
    if (this.reflectionMaterial) {
      this.reflectionMaterial.opacity = 0.2 + Math.sin(time * 0.7) * 0.05;
    }
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child instanceof THREE.InstancedMesh) child.dispose();
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    });
    this.group.clear();
    this.rippleGroups = [];
    this.foamMaterial = null;
    this.foamMesh = null;
    this.glintMaterialA = null;
    this.glintMaterialB = null;
    this.reflectionMaterial = null;
  }
}
