// ===== src/renderer/core/GameLoop.ts =====
// requestAnimationFrame wrapper with dt capping and pause/resume.

export class GameLoop {
  private running = false;
  private paused = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private updateFn: (dt: number) => void;
  private fpsLimit: number; // 0 = unlimited
  private fpsInterval: number;
  private fpsLastTime = 0;

  constructor(updateFn: (dt: number) => void, fpsLimit = 0) {
    this.updateFn = updateFn;
    this.fpsLimit = fpsLimit;
    this.fpsInterval = fpsLimit > 0 ? 1000 / fpsLimit : 0;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.fpsLastTime = this.lastTime;
    this._tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
  }

  get isRunning(): boolean {
    return this.running;
  }
  get isPaused(): boolean {
    return this.paused;
  }

  private _tick = (now: number): void => {
    if (!this.running) return;

    this.rafId = requestAnimationFrame(this._tick);

    if (this.paused) return;

    // FPS limiting
    if (this.fpsLimit > 0) {
      const elapsed = now - this.fpsLastTime;
      if (elapsed < this.fpsInterval) return;
      this.fpsLastTime = now - (elapsed % this.fpsInterval);
    }

    // Delta time in seconds, capped at 100ms to prevent physics explosion
    let dt = (now - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = now;

    this.updateFn(dt);
  };
}
