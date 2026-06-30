// ===== src/renderer/locations/AtmosphereEffects.ts =====
// Reusable atmosphere primitives for sanctuary locations.
import * as THREE from 'three';

export interface FlickerConfig {
  light: THREE.Light;
  base: number;
  speed: number;
  amp: number;
  noise?: boolean;
}

/** Update a flickering light. Call from the location's update() loop. */
export function updateFlicker(time: number, cfg: FlickerConfig): void {
  let intensity = cfg.base;
  if (cfg.speed > 0) {
    intensity += Math.sin(time * cfg.speed) * cfg.amp;
    if (cfg.noise) {
      intensity += Math.cos(time * cfg.speed * 1.5) * (cfg.amp * 0.5);
    }
  }
  cfg.light.intensity = intensity;
}

/** Create a batch of rising puffs (steam, smoke, embers). */
export function createRisingPuffs(
  group: THREE.Group,
  count: number,
  color: number,
  area: { x: number; z: number; yMin: number; yMax: number },
  size = 0.2,
): THREE.Mesh[] {
  const geo = new THREE.BoxGeometry(size, size, size);
  const matBase = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.5,
  });
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const mat = matBase.clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * area.x,
      area.yMin + Math.random() * (area.yMax - area.yMin),
      (Math.random() - 0.5) * area.z,
    );
    mesh.userData = {
      type: 'rising_puff',
      speedY: 0.005 + Math.random() * 0.008,
      swaySpeed: 0.5 + Math.random() * 1.0,
      swayAmp: 0.003 + Math.random() * 0.005,
      initialY: area.yMin,
      maxHeight: area.yMax,
    };
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

/** Update rising puffs created by createRisingPuffs. */
export function updateRisingPuffs(time: number, meshes: THREE.Mesh[]): void {
  for (const mesh of meshes) {
    const ud = mesh.userData;
    mesh.position.y += ud.speedY;
    mesh.position.x += Math.sin(time * ud.swaySpeed) * ud.swayAmp;
    mesh.position.z += Math.cos(time * ud.swaySpeed) * ud.swayAmp;
    if (mesh.material instanceof THREE.Material) {
      const life = (mesh.position.y - ud.initialY) / (ud.maxHeight - ud.initialY);
      mesh.material.opacity = Math.max(0, 0.5 * (1 - life));
    }
    if (mesh.position.y > ud.maxHeight) {
      mesh.position.y = ud.initialY;
      if (mesh.material instanceof THREE.Material) mesh.material.opacity = 0.5;
    }
  }
}

/** Create small additive squares that shimmer on water/snow surfaces. */
export function createSurfaceShimmer(
  group: THREE.Group,
  count: number,
  color: number,
  area: { x: number; z: number; y: number },
): THREE.Mesh[] {
  const geo = new THREE.BoxGeometry(0.06, 0.02, 0.06);
  const matBase = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const mat = matBase.clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * area.x, area.y, (Math.random() - 0.5) * area.z);
    mesh.userData = {
      type: 'shimmer',
      pulseSpeed: 1.0 + Math.random() * 2.0,
      seed: Math.random() * 100,
    };
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

/** Update shimmer meshes. */
export function updateSurfaceShimmer(time: number, meshes: THREE.Mesh[]): void {
  for (const mesh of meshes) {
    const ud = mesh.userData;
    if (mesh.material instanceof THREE.Material) {
      const pulse = 0.2 + Math.abs(Math.sin(time * ud.pulseSpeed + ud.seed)) * 0.5;
      mesh.material.opacity = pulse;
    }
  }
}

/** Create a point light with a small emissive cube (lantern / window glow). */
export function createLanternGlow(
  group: THREE.Group,
  position: THREE.Vector3,
  color: number,
  intensity = 1.5,
  distance = 4,
): { light: THREE.PointLight; mesh: THREE.Mesh } {
  const light = new THREE.PointLight(color, intensity, distance);
  light.position.copy(position);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.copy(position);
  group.add(light);
  group.add(mesh);
  return { light, mesh };
}

/** Dispose atmosphere meshes and free geometries/materials. */
export function disposeAtmosphereMeshes(meshes: THREE.Object3D[]): void {
  for (const obj of meshes) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }
}
