// ===== src/renderer/audio/index.ts =====
// Singleton AudioEngine export.

import { AudioEngine } from './AudioEngine';

export const audio = new AudioEngine();
export { AudioEngine } from './AudioEngine';
export { AmbientType, EventType, MusicVariation } from './types';
export type { AudioState } from './types';
