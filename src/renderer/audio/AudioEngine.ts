// ===== src/renderer/audio/AudioEngine.ts =====

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Core audio engine — Web Audio API procedural synthesis.
// Zero external audio files. All sounds generated at runtime.

import { AmbientType, EventType, MusicVariation, type AudioState } from './types';

class AudioMixer {
  ambientNodes: AudioScheduledSourceNode[] = [];
  ambientGainNodes: GainNode[] = [];
  isSuspended = false;
  private suspendedGainValues: number[] = [];
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  add(node: AudioScheduledSourceNode, gainNode?: GainNode): void {
    this.ambientNodes.push(node);
    if (gainNode) this.ambientGainNodes.push(gainNode);
  }

  clear(): void {
    this.ambientNodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* */
      }
    });
    this.ambientNodes = [];
    this.ambientGainNodes = [];
    this.isSuspended = false;
    this.suspendedGainValues = [];
  }

  suspend(_fadeOutMs = 300): void {
    if (this.isSuspended) return;
    this.isSuspended = true;
    this.suspendedGainValues = this.ambientGainNodes.map((g) => g.gain.value);
    const now = this.ctx.currentTime;
    this.ambientGainNodes.forEach((g) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.08);
    });
    // NOTE: caller is responsible for calling resume() after the desired silence.
    // This avoids scheduling an un-cancellable resume timeout inside the mixer.
  }

  resume(): void {
    if (!this.isSuspended) return;
    const now = this.ctx.currentTime;
    this.ambientGainNodes.forEach((g, i) => {
      const target = this.suspendedGainValues[i] || 0.1;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(target, now, 0.3);
    });
    this.isSuspended = false;
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private _mixer: AudioMixer | null = null;
  private musicNodes: OscillatorNode[] = [];
  private musicGainNodes: GainNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;

  // Pending ambient grain timeouts (rain drops, crickets) + mythic catch resume
  private ambientTimeouts: ReturnType<typeof setTimeout>[] = [];
  private mythicResumeTimeout: ReturnType<typeof setTimeout> | null = null;

  state: AudioState = {
    isPlayingAmbient: false,
    isPlayingMusic: false,
    currentAmbientType: null,
    currentMusicVariation: null,
  };

  /** Lazy init: AudioContext requires user gesture in browsers. */
  private _getCtx(): AudioContext {
    if (!this.ctx) {
      const win = window as unknown as WindowWithWebkitAudio;
      const Ctx = window.AudioContext || win.webkitAudioContext;
      if (!Ctx) throw new Error('AudioContext not supported');
      this.ctx = new Ctx();
      this._mixer = new AudioMixer(this.ctx);
    }
    // Resume if suspended (browser policy requires user gesture)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  get mixer(): AudioMixer {
    this._getCtx(); // ensure ctx exists
    return this._mixer!;
  }

  /** Call on first user interaction to unlock audio. */
  ensureContext(): void {
    this._getCtx();
  }

  // ═══════════════════════════════════════════════
  // Brand & UI
  // ═══════════════════════════════════════════════

  playBrandLogo(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const notes = [1047, 784, 659]; // C6→G5→E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.2 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.7);
    });
  }

  playCloseSound(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const notes = [659, 523]; // E5→C5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, now + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.3 + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.9);
    });
  }

  playUIClick(): void {
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 2000;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  }

  // ═══════════════════════════════════════════════
  // Core Fishing SFX
  // ═══════════════════════════════════════════════

  playBite(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Layer 1: bell chime at 2000Hz
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'sine';
    chime.frequency.value = 2000;
    chimeGain.gain.setValueAtTime(0.08, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(now);
    chime.stop(now + 0.2);
    // Layer 2: noise burst (water splash)
    const bufferSize = ctx.sampleRate * 0.1;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.06, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  playCast(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 300;
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 1;
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  playReel(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 90;
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playLineBreak(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  playCatch(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Subtle water splash + low blip for any successful catch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    const bufferSize = ctx.sampleRate * 0.1;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.04, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1200;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  playPerfectCatch(): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.55);
    });
  }

  playMythicCatch(): void {
    this.mixer.suspend(300);
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // 300ms silence then sequence
    const start = now + 0.35;
    // Deep bell at 130Hz
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.value = 130;
    bellGain.gain.setValueAtTime(0.12, start);
    bellGain.gain.setTargetAtTime(0.001, start + 0.1, 0.5);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(start);
    bell.stop(start + 1.5);
    // Rising chime sequence
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + 0.6 + i * 0.15;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    this._clearMythicResumeTimeout();
    this.mythicResumeTimeout = setTimeout(() => {
      this.mythicResumeTimeout = null;
      this.mixer.resume();
    }, 2000);
  }

  // ═══════════════════════════════════════════════
  // Ambient
  // ═══════════════════════════════════════════════

  clearAmbient(): void {
    this._clearAmbientTimeouts();
    this._clearMythicResumeTimeout();
    this.mixer.clear();
    this.state.isPlayingAmbient = false;
    this.state.currentAmbientType = null;
  }

  playAmbient(type: AmbientType): void {
    this.clearAmbient();
    const ctx = this._getCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.12;
    masterGain.connect(ctx.destination);

    switch (type) {
      case AmbientType.Wind:
        this._ambientWind(ctx, masterGain);
        break;
      case AmbientType.Rain:
        this._ambientRain(ctx, masterGain);
        break;
      case AmbientType.Water:
        this._ambientWater(ctx, masterGain);
        break;
      case AmbientType.Bamboo:
        this._ambientBamboo(ctx, masterGain);
        break;
      case AmbientType.Aurora:
        this._ambientAurora(ctx, masterGain);
        break;
      case AmbientType.Crickets:
        this._ambientCrickets(ctx, masterGain);
        break;
    }

    this.state.isPlayingAmbient = true;
    this.state.currentAmbientType = type;
  }

  private _ambientWind(ctx: AudioContext, out: GainNode): void {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink noise approximation
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    source.connect(filter);
    filter.connect(out);
    source.start();
    this.mixer.add(source, out);
    // LFO for breathing
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.25;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(out.gain);
    lfo.start();
  }

  private _ambientRain(ctx: AudioContext, out: GainNode): void {
    // Grain-based rain: random noise pulses
    const rainGain = ctx.createGain();
    rainGain.gain.value = 1;
    rainGain.connect(out);
    const scheduleDrop = () => {
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
      const drop = ctx.createBufferSource();
      drop.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3000 + Math.random() * 3000;
      drop.connect(filter);
      filter.connect(rainGain);
      drop.start();
    };
    for (let i = 0; i < 60; i++) {
      this._setAmbientTimeout(scheduleDrop, Math.random() * 3000);
    }
    // Low pad
    const pad = ctx.createOscillator();
    const padGain = ctx.createGain();
    pad.type = 'triangle';
    pad.frequency.value = 80;
    padGain.gain.value = 0.03;
    pad.connect(padGain);
    padGain.connect(out);
    pad.start();
    this.mixer.add(pad, padGain);
  }

  private _ambientWater(ctx: AudioContext, out: GainNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    gain.gain.value = 0.04;
    // LFO for flowing effect
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    osc.connect(gain);
    gain.connect(out);
    osc.start();
    this.mixer.add(osc, gain);
  }

  private _ambientBamboo(ctx: AudioContext, out: GainNode): void {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.01);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;
    source.connect(filter);
    filter.connect(out);
    source.start();
    this.mixer.add(source, out);
  }

  private _ambientAurora(ctx: AudioContext, out: GainNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 45;
    gain.gain.value = 0.08;
    // Slow chorus LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    osc.connect(gain);
    gain.connect(out);
    osc.start();
    this.mixer.add(osc, gain);
  }

  private _ambientCrickets(ctx: AudioContext, out: GainNode): void {
    const scheduleCricket = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 3000 + Math.random() * 4000;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    };
    for (let i = 0; i < 20; i++) {
      this._setAmbientTimeout(scheduleCricket, Math.random() * 4000);
    }
  }

  // ═══════════════════════════════════════════════
  // Random Events (idle ambiance)
  // ═══════════════════════════════════════════════

  playRandomEvent(type: EventType): void {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.06; // 40% quieter than normal
    masterGain.connect(ctx.destination);

    switch (type) {
      case EventType.Windchime: {
        [880, 1100, 1320].forEach((_freq, _i) => {
          /* stub */
        });
        break;
      }
      case EventType.Woodblock: {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case EventType.Belltower: {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 220;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, now);
        g.gain.setTargetAtTime(0.001, now + 0.1, 0.8);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 2);
        break;
      }
      case EventType.Icecrack: {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < d.length; i++)
          d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3000;
        src.connect(hp);
        hp.connect(masterGain);
        src.start(now);
        break;
      }
      case EventType.Twig: {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case EventType.Birdfly: {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════
  // Music
  // ═══════════════════════════════════════════════

  stopMusic(): void {
    this.musicNodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* */
      }
    });
    this.musicNodes = [];
    this.musicGainNodes = [];
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.state.isPlayingMusic = false;
  }

  playMusic(variation: MusicVariation): void {
    this.stopMusic();
    const ctx = this._getCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.06;
    masterGain.connect(ctx.destination);

    // C major melody: C4 D4 E4 G4 A4
    const melody = [262, 294, 330, 392, 440, 392, 330, 294];
    const rate =
      variation === MusicVariation.Calm ? 0.75 : variation === MusicVariation.Tension ? 1.1 : 1.0;
    let step = 0;
    const playNote = () => {
      const freq = melody[step % melody.length] * rate;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + 1.0);
      this.musicNodes.push(osc);
      this.musicGainNodes.push(gain);
      step++;
    };
    playNote();
    const noteDuration = variation === MusicVariation.Celebration ? 400 : 600;
    this.musicInterval = setInterval(playNote, noteDuration);
    this.state.isPlayingMusic = true;
    this.state.currentMusicVariation = variation;
  }

  // ═══════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════

  /** Stop all audio and cleanup. */
  dispose(): void {
    this.stopMusic();
    this._clearAmbientTimeouts();
    this._clearMythicResumeTimeout();
    this.mixer.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ═══════════════════════════════════════════════
  // Timeout helpers
  // ═══════════════════════════════════════════════

  private _setAmbientTimeout(fn: () => void, delay: number): void {
    const id = setTimeout(() => {
      this._removeAmbientTimeout(id);
      fn();
    }, delay);
    this.ambientTimeouts.push(id);
  }

  private _removeAmbientTimeout(id: ReturnType<typeof setTimeout>): void {
    const idx = this.ambientTimeouts.indexOf(id);
    if (idx !== -1) this.ambientTimeouts.splice(idx, 1);
  }

  private _clearAmbientTimeouts(): void {
    this.ambientTimeouts.forEach((id) => clearTimeout(id));
    this.ambientTimeouts = [];
  }

  private _clearMythicResumeTimeout(): void {
    if (this.mythicResumeTimeout !== null) {
      clearTimeout(this.mythicResumeTimeout);
      this.mythicResumeTimeout = null;
    }
  }
}
