// ===== src/renderer/core/RNG.ts =====
// Seeded pseudo-random number generator (mulberry32).
// Deterministic RNG for run seeds — enables reproducible runs for community challenges.

export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with the given probability (0-1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick a random element from an array. */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /** Weighted random selection. Returns the index. */
  weightedIndex(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  /** Shuffle an array in-place (Fisher-Yates). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  getState(): number {
    return this.state;
  }
}
