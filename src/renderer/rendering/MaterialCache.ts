// ===== src/renderer/rendering/MaterialCache.ts =====
// REF-4: global material cache to reduce GC pressure when switching locations.
// All BoxGeometry-based objects that share a color can reuse the same material.

import * as THREE from 'three';

class MaterialCacheImpl {
  private lambert = new Map<number | string, THREE.MeshLambertMaterial>();
  private basic = new Map<number | string, THREE.MeshBasicMaterial>();

  getLambert(color: number): THREE.MeshLambertMaterial {
    let mat = this.lambert.get(color);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.lambert.set(color, mat);
    }
    return mat;
  }

  getBasic(color: number): THREE.MeshBasicMaterial {
    let mat = this.basic.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this.basic.set(color, mat);
    }
    return mat;
  }

  getTransparentLambert(color: number, opacity: number): THREE.MeshLambertMaterial {
    // Use a composite key so different opacities don't collide.
    const key = (color << 8) | Math.floor(opacity * 255);
    let mat = this.lambert.get(key);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: true, opacity });
      this.lambert.set(key, mat);
    }
    return mat;
  }

  // RENDER-PERF: shared soul-state fish materials keyed by color + rarity params
  getFishLambert(
    color: number,
    opacity: number,
    emissive: number,
    emissiveIntensity: number,
  ): THREE.MeshLambertMaterial {
    const key = `fish:${color}:${opacity.toFixed(3)}:${emissive}:${emissiveIntensity.toFixed(3)}`;
    let mat = this.lambert.get(key);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
        transparent: true,
        opacity,
        emissive: new THREE.Color(emissive),
        emissiveIntensity,
      });
      this.lambert.set(key, mat);
    }
    return mat;
  }

  getFishBasic(color: number, opacity: number): THREE.MeshBasicMaterial {
    const key = `fishb:${color}:${opacity.toFixed(3)}`;
    let mat = this.basic.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
      this.basic.set(key, mat);
    }
    return mat;
  }

  /** Return true if the material instance is currently held in the cache. */
  isCached(mat: THREE.Material): boolean {
    for (const cached of this.lambert.values()) {
      if (cached === mat) return true;
    }
    for (const cached of this.basic.values()) {
      if (cached === mat) return true;
    }
    return false;
  }

  clear(): void {
    this.lambert.forEach((m) => m.dispose());
    this.basic.forEach((m) => m.dispose());
    this.lambert.clear();
    this.basic.clear();
  }
}

export const MaterialCache = new MaterialCacheImpl();
