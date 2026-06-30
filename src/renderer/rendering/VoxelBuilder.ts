// ===== src/renderer/rendering/VoxelBuilder.ts =====
// Fluent voxel box builder used by sanctuary locations. Each mesh gets its own
// BoxGeometry so locations can dispose them safely on teardown; materials are
// borrowed from MaterialCache and must not be disposed per-mesh.

import * as THREE from 'three';
import { MaterialCache } from './MaterialCache';

export interface VoxelBoxOpts {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function makeBox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  opts: VoxelBoxOpts = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}

/** Build a scaled voxel box and attach it to a parent group. */
export function voxelBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  opts: VoxelBoxOpts = {},
): THREE.Mesh {
  const mat = MaterialCache.getLambert(color);
  const mesh = makeBox(w, h, d, mat, x, y, z, opts);
  parent.add(mesh);
  return mesh;
}

/** Build a voxel box using an existing material. */
export function voxelBoxMat(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  opts: VoxelBoxOpts = {},
): THREE.Mesh {
  const mesh = makeBox(w, h, d, mat, x, y, z, opts);
  parent.add(mesh);
  return mesh;
}

/** Disposable wrapper: builds a voxel group and tracks meshes for cleanup. */
export class VoxelBuilder {
  readonly group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];

  box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    opts?: VoxelBoxOpts,
  ): THREE.Mesh {
    const m = voxelBox(this.group, w, h, d, color, x, y, z, opts);
    this.meshes.push(m);
    return m;
  }

  boxMat(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    opts?: VoxelBoxOpts,
  ): THREE.Mesh {
    const m = voxelBoxMat(this.group, w, h, d, mat, x, y, z, opts);
    this.meshes.push(m);
    return m;
  }

  add(child: THREE.Object3D): void {
    this.group.add(child);
  }

  /** Dispose tracked geometries. The group itself is kept so it can remain in the scene. */
  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      // Materials are owned by MaterialCache or passed externally; do not dispose here.
    }
    this.meshes = [];
  }
}
