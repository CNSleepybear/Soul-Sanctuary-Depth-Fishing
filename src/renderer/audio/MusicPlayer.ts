import { logger } from '../../shared/logger';

export const MUSIC_TRACKS = [
  { id: 'abyssal-lamps', title: 'Abyssal Lamps', file: 'Abyssal Lamps.wav' },
  { id: 'bruise-of-ink', title: 'bruise of ink', file: 'bruise of ink.wav' },
  { id: 'lingering-threshold', title: 'Lingering Threshold', file: 'Lingering Threshold.wav' },
] as const;

const STORAGE_KEY = 'soulsanctuary_music';

/** Stream one bundled WAV at a time, retaining the playlist across scene changes. */
export class MusicPlayer extends EventTarget {
  private element: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private _enabled = true;
  private _volume = 0.35;
  private failedTracks = new Set<string>();

  constructor() {
    super();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { enabled?: unknown; volume?: unknown; trackId?: unknown };
      if (typeof saved.enabled === 'boolean') this._enabled = saved.enabled;
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) {
        this._volume = Math.max(0, Math.min(1, saved.volume));
      }
      const index = MUSIC_TRACKS.findIndex((track) => track.id === saved.trackId);
      if (index >= 0) this.trackIndex = index;
    } catch {
      // Missing storage or malformed preferences: use the default playlist.
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get volume(): number {
    return this._volume;
  }

  get currentTrack(): (typeof MUSIC_TRACKS)[number] {
    return MUSIC_TRACKS[this.trackIndex];
  }

  get isPlaying(): boolean {
    return (
      this.element !== null &&
      !this.element.paused &&
      !this.element.ended &&
      this.element.error === null
    );
  }

  /** Called from a user gesture so browser autoplay policy is respected. */
  play(): void {
    if (!this._enabled) return;
    if (!this.element) {
      this.element = document.createElement('audio');
      this.element.dataset.soulMusic = '';
      this.element.hidden = true;
      this.element.preload = 'metadata';
      this.element.volume = this._volume;
      this.element.addEventListener('ended', () => this.next());
      this.element.addEventListener('playing', () => this.notify());
      this.element.addEventListener('pause', () => this.notify());
      this.element.addEventListener('error', () => {
        logger.warn('[Music] Unable to load track:', this.currentTrack.title);
        this.failedTracks.add(this.currentTrack.id);
        if (this.failedTracks.size < MUSIC_TRACKS.length) this.next();
        else this.notify();
      });
      document.body.appendChild(this.element);
      this.loadTrack();
    }
    void this.element.play().catch((error: unknown) => {
      // Changing tracks aborts a pending play; a later gesture can retry autoplay.
      if (error instanceof Error && error.name === 'AbortError') return;
      logger.debug('[Music] Playback deferred:', error);
      this.notify();
    });
  }

  stop(): void {
    if (this.element) {
      this.element.pause();
      this.element.currentTime = 0;
    }
    this.notify();
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.save();
    if (enabled) this.play();
    else this.element?.pause();
    this.notify();
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this._volume = Math.max(0, Math.min(1, volume));
    if (this.element) this.element.volume = this._volume;
    this.save();
    this.notify();
  }

  selectTrack(id: string): void {
    const index = MUSIC_TRACKS.findIndex((track) => track.id === id);
    if (index < 0) return;
    this.failedTracks.clear();
    this.trackIndex = index;
    this.loadTrack();
    this.save();
    this.play();
    this.notify();
  }

  next(): void {
    // Skip unavailable files, but never spin indefinitely if all files fail.
    if (this.failedTracks.size >= MUSIC_TRACKS.length) return;
    do {
      this.trackIndex = (this.trackIndex + 1) % MUSIC_TRACKS.length;
    } while (this.failedTracks.has(this.currentTrack.id));
    this.loadTrack();
    this.save();
    this.play();
    this.notify();
  }

  dispose(): void {
    this.stop();
    if (this.element) {
      this.element.removeAttribute('src');
      this.element.load();
      this.element.remove();
      this.element = null;
    }
  }

  private loadTrack(): void {
    if (!this.element) return;
    // Relative to index.html: works under Vite HTTP and packaged Electron file://.
    this.element.src = new URL(
      `music/${encodeURIComponent(this.currentTrack.file)}`,
      document.baseURI,
    ).href;
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: this._enabled,
          volume: this._volume,
          trackId: this.currentTrack.id,
        }),
      );
    } catch {
      // Playback still works when storage is unavailable.
    }
  }

  private notify(): void {
    this.dispatchEvent(new Event('change'));
  }
}
