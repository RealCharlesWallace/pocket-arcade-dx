export type BGMTrack =
  | 'none'
  | 'menu'
  | 'monster_town'
  | 'monster_battle'
  | 'brawl'
  | 'quest'
  | 'platformer'
  | 'tetris'
  | 'racer'
  | 'frogger'
  | 'kirby';

interface NoteStep {
  lead: number; // Hz, 0 = rest
  bass?: number; // Hz
  noise?: boolean;
  dur: number; // seconds
}

const N: Record<string, number> = {
  _: 0,
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  C4: 261.63, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.0, Bb5: 932.33, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98
};

const TRACKS: Record<Exclude<BGMTrack, 'none'>, NoteStep[]> = {
  menu: [
    { lead: N.E5, bass: N.C3, dur: 0.18 },
    { lead: N.G5, bass: N.G3, dur: 0.18 },
    { lead: N.C6, bass: N.E3, dur: 0.18 },
    { lead: N.B5, bass: N.G3, dur: 0.18 },
    { lead: N.A5, bass: N.F3, dur: 0.18 },
    { lead: N.G5, bass: N.C3, dur: 0.18 },
    { lead: N.E5, bass: N.G3, dur: 0.18 },
    { lead: N.D5, bass: N.G3, dur: 0.18 },
  ],
  monster_town: [
    { lead: N.G4, bass: N.C3, dur: 0.22 },
    { lead: N.E4, bass: N.G3, dur: 0.22 },
    { lead: N.C5, bass: N.C3, dur: 0.22 },
    { lead: N.E5, bass: N.G3, dur: 0.22 },
    { lead: N.D5, bass: N.F3, dur: 0.22 },
    { lead: N.C5, bass: N.A3, dur: 0.22 },
    { lead: N.A4, bass: N.F3, dur: 0.22 },
    { lead: N.G4, bass: N.G3, dur: 0.22 },
  ],
  monster_battle: [
    { lead: N.E5, bass: N.A3, noise: true, dur: 0.11 },
    { lead: N.F5, bass: N.E3, dur: 0.11 },
    { lead: N.Fs5, bass: N.A3, noise: true, dur: 0.11 },
    { lead: N.G5, bass: N.E3, dur: 0.22 },
    { lead: N.E5, bass: N.A3, noise: true, dur: 0.11 },
    { lead: N.C5, bass: N.G3, dur: 0.11 },
    { lead: N.D5, bass: N.D3, noise: true, dur: 0.11 },
    { lead: N.B4, bass: N.G3, dur: 0.22 },
  ],
  brawl: [
    { lead: N.A4, bass: N.A3, noise: true, dur: 0.13 },
    { lead: N.C5, bass: N.A3, dur: 0.13 },
    { lead: N.D5, bass: N.E3, noise: true, dur: 0.13 },
    { lead: N.Eb5, bass: N.E3, dur: 0.13 },
    { lead: N.D5, bass: N.G3, noise: true, dur: 0.13 },
    { lead: N.C5, bass: N.G3, dur: 0.13 },
    { lead: N.A4, bass: N.E3, noise: true, dur: 0.13 },
    { lead: N.G4, bass: N.E3, dur: 0.13 },
  ],
  quest: [
    { lead: N.A4, bass: N.D3, dur: 0.24 },
    { lead: N.E4, bass: N.A3, dur: 0.12 },
    { lead: N.A4, bass: N.D3, dur: 0.12 },
    { lead: N.A4, bass: N.F3, dur: 0.12 },
    { lead: N.B4, bass: N.G3, dur: 0.12 },
    { lead: N.Cs5, bass: N.A3, dur: 0.12 },
    { lead: N.D5, bass: N.D3, dur: 0.12 },
    { lead: N.E5, bass: N.A3, dur: 0.36 },
  ],
  platformer: [
    { lead: N.E5, bass: N.D3, noise: true, dur: 0.14 },
    { lead: N.E5, bass: N.G3, dur: 0.14 },
    { lead: N._, bass: N.C3, dur: 0.14 },
    { lead: N.E5, bass: N.G3, noise: true, dur: 0.14 },
    { lead: N.C5, bass: N.C3, dur: 0.14 },
    { lead: N.E5, bass: N.E3, dur: 0.28 },
    { lead: N.G5, bass: N.G3, noise: true, dur: 0.28 },
    { lead: N.G4, bass: N.G3, dur: 0.28 },
  ],
  tetris: [
    { lead: N.E5, bass: N.E3, dur: 0.22 },
    { lead: N.B4, bass: N.A3, dur: 0.11 },
    { lead: N.C5, bass: N.E3, dur: 0.11 },
    { lead: N.D5, bass: N.A3, dur: 0.22 },
    { lead: N.C5, bass: N.E3, dur: 0.11 },
    { lead: N.B4, bass: N.A3, dur: 0.11 },
    { lead: N.A4, bass: N.A3, dur: 0.22 },
    { lead: N.C5, bass: N.E3, dur: 0.22 },
  ],
  racer: [
    { lead: N.D5, bass: N.D3, noise: true, dur: 0.12 },
    { lead: N.F5, bass: N.D3, dur: 0.12 },
    { lead: N.A5, bass: N.A3, noise: true, dur: 0.12 },
    { lead: N.G5, bass: N.G3, dur: 0.12 },
    { lead: N.F5, bass: N.F3, noise: true, dur: 0.12 },
    { lead: N.E5, bass: N.E3, dur: 0.12 },
    { lead: N.D5, bass: N.C3, noise: true, dur: 0.12 },
    { lead: N.A4, bass: N.A3, dur: 0.12 },
  ],
  frogger: [
    { lead: N.G5, bass: N.C3, noise: true, dur: 0.14 },
    { lead: N.E5, bass: N.G3, dur: 0.14 },
    { lead: N.C5, bass: N.C3, noise: true, dur: 0.14 },
    { lead: N.E5, bass: N.G3, dur: 0.14 },
    { lead: N.G5, bass: N.C3, noise: true, dur: 0.14 },
    { lead: N.A5, bass: N.F3, dur: 0.14 },
    { lead: N.G5, bass: N.C3, noise: true, dur: 0.14 },
    { lead: N.E5, bass: N.G3, dur: 0.14 },
    { lead: N.F5, bass: N.D3, noise: true, dur: 0.14 },
    { lead: N.D5, bass: N.G3, dur: 0.14 },
    { lead: N.B4, bass: N.G3, noise: true, dur: 0.14 },
    { lead: N.C5, bass: N.C3, dur: 0.22 },
  ],
  kirby: [
    { lead: N.C5, bass: N.F3, dur: 0.15 },
    { lead: N.D5, bass: N.C3, noise: true, dur: 0.15 },
    { lead: N.E5, bass: N.F3, dur: 0.15 },
    { lead: N.F5, bass: N.C3, noise: true, dur: 0.15 },
    { lead: N.A5, bass: N.F3, dur: 0.22 },
    { lead: N.G5, bass: N.C3, noise: true, dur: 0.15 },
    { lead: N.F5, bass: N.D3, dur: 0.15 },
    { lead: N.E5, bass: N.A3, noise: true, dur: 0.15 },
    { lead: N.D5, bass: N.Bb3, dur: 0.15 },
    { lead: N.G5, bass: N.C3, noise: true, dur: 0.22 },
  ],
};

export class ChiptuneSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private unlocked = false;
  private muted = false;
  private currentTrack: BGMTrack = 'none';
  private stepIdx = 0;
  private stepTimer: number | null = null;
  private lastApuFreq1 = 0;
  private lastApuTime1 = 0;
  private lastApuFreq2 = 0;
  private lastApuTime2 = 0;

  private htmlAudioUnlocked = false;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.unlock();
      };
      const events = ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'click', 'keydown'] as const;
      for (const evt of events) {
        window.addEventListener(evt, unlockHandler, { capture: true, passive: true });
      }
    }
  }

  getContextState(): string {
    return this.ctx ? (this.ctx.state as string) : 'uninitialized';
  }

  unlock(): void {
    if (this.muted) return;

    // iOS 17+ / iOS 26 Safari: switch navigator.audioSession from 'ambient' to 'playback'
    // so Web Audio plays through the iPhone speakers even when the hardware Silent Mode switch is ON.
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession && nav.audioSession.type !== 'playback') {
        nav.audioSession.type = 'playback';
      }
    } catch {
      // Ignore on browsers without navigator.audioSession
    }

    // Fallback silent HTML5 <audio> clip to force iOS AVAudioSession into Playback category
    if (!this.htmlAudioUnlocked && typeof Audio !== 'undefined') {
      try {
        const silentWav =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const el = new Audio(silentWav);
        el.setAttribute('playsinline', 'true');
        el.volume = 0.01;
        el.play()
          .then(() => {
            this.htmlAudioUnlocked = true;
          })
          .catch(() => {});
      } catch {
        // Ignore HTML5 audio fallback errors
      }
    }

    const ctx = this.ensureContext(true);
    if (!ctx) return;

    if ((ctx.state as string) !== 'running') {
      ctx.resume().catch(() => {});
    }

    if (!this.unlocked || (ctx.state as string) !== 'running') {
      try {
        const osc = ctx.createOscillator();
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0.00001;
        osc.connect(silentGain);
        silentGain.connect(ctx.destination);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.001);

        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuffer;
        src.connect(ctx.destination);
        src.start(0);
        if ((ctx.state as string) === 'running') {
          this.unlocked = true;
        }
      } catch {
        // Ignore if context is not yet ready
      }
    }

    if (this.currentTrack !== 'none' && this.stepTimer === null) {
      this.scheduleNextNote();
    }
  }

  private ensureContext(allowCreate = false): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && allowCreate && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        const master = this.ctx.createGain();
        master.gain.value = 2.4;
        if (typeof this.ctx.createDynamicsCompressor === 'function') {
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.value = -14;
          comp.knee.value = 12;
          comp.ratio.value = 4;
          comp.attack.value = 0.003;
          comp.release.value = 0.15;
          master.connect(comp);
          comp.connect(this.ctx.destination);
        } else {
          master.connect(this.ctx.destination);
        }
        this.masterGain = master;
      }
    }
    if (this.ctx && (this.ctx.state as string) !== 'running') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.ctx) {
      this.ctx.suspend().catch(() => {});
    } else if (!muted) {
      this.unlock();
    }
  }

  playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.08, slideTo?: number): void {
    const ctx = this.ensureContext();
    if (!ctx || (ctx.state as string) !== 'running' || freq <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo && slideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playNoise(duration = 0.06, volume = 0.05): void {
    const ctx = this.ensureContext();
    if (!ctx || (ctx.state as string) !== 'running') return;

    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    src.start(now);
  }

  /**
   * Synchronizes Game Boy LR35902 hardware APU sound registers (0xFF10..0xFF26)
   * with Web Audio oscillator voices.
   */
  syncHardwareAPU(memory: ArrayLike<number>): void {
    if (this.muted || !memory) return;
    if (((memory[0xff26] ?? 0) & 0x80) === 0) return;

    const now = performance.now();

    // Channel 1 (Square 1)
    const vol1 = ((memory[0xff12] ?? 0) >> 4) & 0x0f;
    const rawFreq1 = (((memory[0xff14] ?? 0) & 0x07) << 8) | ((memory[0xff13] ?? 0) & 0xff);
    if (vol1 > 0 && rawFreq1 > 64 && rawFreq1 < 2040) {
      const freq1 = 131072 / (2048 - rawFreq1);
      if (Math.abs(freq1 - this.lastApuFreq1) > 8 || now - this.lastApuTime1 > 95) {
        this.playTone(freq1, 0.085, 'square', (vol1 / 15) * 0.065);
        this.lastApuFreq1 = freq1;
        this.lastApuTime1 = now;
      }
    } else {
      this.lastApuFreq1 = 0;
    }

    // Channel 2 (Square 2)
    const vol2 = ((memory[0xff17] ?? 0) >> 4) & 0x0f;
    const rawFreq2 = (((memory[0xff19] ?? 0) & 0x07) << 8) | ((memory[0xff18] ?? 0) & 0xff);
    if (vol2 > 0 && rawFreq2 > 64 && rawFreq2 < 2040) {
      const freq2 = 131072 / (2048 - rawFreq2);
      if (Math.abs(freq2 - this.lastApuFreq2) > 8 || now - this.lastApuTime2 > 95) {
        this.playTone(freq2, 0.085, 'triangle', (vol2 / 15) * 0.06);
        this.lastApuFreq2 = freq2;
        this.lastApuTime2 = now;
      }
    } else {
      this.lastApuFreq2 = 0;
    }
  }

  /** Classic Game Boy "Ba-ding!" boot chime */
  playBootChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTone(987.77, 0.09, 'square', 0.11); // B5
    setTimeout(() => {
      this.playTone(1975.53, 0.55, 'square', 0.11); // B6
    }, 90);
  }

  playButtonClick(): void {
    this.playTone(680, 0.025, 'triangle', 0.04, 320);
  }

  playMenuMove(): void {
    this.playTone(523.25, 0.045, 'square', 0.06);
  }

  playMenuSelect(): void {
    this.playTone(659.25, 0.06, 'square', 0.08);
    setTimeout(() => this.playTone(880, 0.12, 'square', 0.08), 55);
  }

  playMenuBack(): void {
    this.playTone(440, 0.06, 'square', 0.07, 261.63);
  }

  playJump(): void {
    this.playTone(260, 0.14, 'square', 0.08, 680);
  }

  playCoin(): void {
    this.playTone(987.77, 0.06, 'square', 0.08);
    setTimeout(() => this.playTone(1318.51, 0.18, 'square', 0.08), 55);
  }

  playHit(): void {
    this.playNoise(0.09, 0.11);
    this.playTone(180, 0.09, 'sawtooth', 0.09, 65);
  }

  playSpecialMove(): void {
    this.playTone(330, 0.22, 'sawtooth', 0.1, 990);
    setTimeout(() => this.playNoise(0.14, 0.1), 80);
  }

  playPowerUp(): void {
    const notes = [330, 392, 659, 523, 587, 784];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.065, 'square', 0.075), idx * 55);
    });
  }

  playLineClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.08, 'square', 0.09), idx * 60);
    });
  }

  startBGM(track: BGMTrack): void {
    if (this.currentTrack === track) return;
    this.stopBGM();
    this.currentTrack = track;
    this.stepIdx = 0;
    if (track === 'none') return;
    this.scheduleNextNote();
  }

  stopBGM(): void {
    this.currentTrack = 'none';
    if (this.stepTimer !== null) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private scheduleNextNote(): void {
    if (this.currentTrack === 'none') return;
    const seq = TRACKS[this.currentTrack];
    if (!seq || seq.length === 0) return;

    const step = seq[this.stepIdx % seq.length];
    this.stepIdx = (this.stepIdx + 1) % seq.length;

    if (!this.muted) {
      if (step.lead > 0) {
        this.playTone(step.lead, step.dur * 0.85, 'square', 0.032);
      }
      if (step.bass && step.bass > 0) {
        this.playTone(step.bass, step.dur * 0.9, 'triangle', 0.04);
      }
      if (step.noise) {
        this.playNoise(0.025, 0.018);
      }
    }

    this.stepTimer = window.setTimeout(() => {
      this.scheduleNextNote();
    }, step.dur * 1000);
  }
}
