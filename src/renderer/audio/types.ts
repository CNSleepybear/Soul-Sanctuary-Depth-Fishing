// ===== src/renderer/audio/types.ts =====
// Type definitions for the Web Audio API audio engine.

export enum AmbientType {
  Wind = 'wind',
  Rain = 'rain',
  Water = 'water',
  Bamboo = 'bamboo',
  Aurora = 'aurora',
  Crickets = 'crickets',
}

export enum EventType {
  Windchime = 'windchime',
  Woodblock = 'woodblock',
  Belltower = 'belltower',
  Icecrack = 'icecrack',
  Twig = 'twig',
  Birdfly = 'birdfly',
}

export enum MusicVariation {
  Main = 'main',
  Calm = 'calm',
  Tension = 'tension',
  Celebration = 'celebration',
}

export interface AudioState {
  isPlayingAmbient: boolean;
  isPlayingMusic: boolean;
  currentAmbientType: AmbientType | null;
  currentMusicVariation: MusicVariation | null;
}
