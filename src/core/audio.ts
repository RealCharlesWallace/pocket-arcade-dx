export type BGMTrack =
  | 'none'
  | 'menu'
  | 'monster_town'
  | 'monster_battle'
  | 'brawl'
  | 'quest'
  | 'platformer'
  | 'tetris'
  | 'racer';

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
};

export class ChiptuneSynth {
  private ctx: AudioContext | null = null;
  private muted = false;
  private currentTrack: BGMTrack = 'none';
  private stepIdx = 0;
  private stepTimer: number | null = null;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
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
    } else if (!muted && this.ctx) {
      this.ctx.resume().catch(() => {});
    }
  }

  playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.08, slideTo?: number): void {
    const ctx = this.ensureContext();
    if (!ctx || freq <= 0) return;

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
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playNoise(duration = 0.06, volume = 0.05): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

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
    gain.connect(ctx.destination);
    src.start(now);
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
