import { GBHardwareEmulator } from '../../core/gb-emulator';
import { drawGBCBox, drawPixelSprite, drawPixelText } from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

type KirbyMode = 'PROFILES' | 'EMU_ROM' | 'TILT_COURSE';

interface KirbyProfile {
  slot: number;
  playerName: string;
  worldLabel: string;
  stars: number;
  redStars: number;
  lives: number;
  hasSave: boolean;
}

interface StarPickup {
  x: number;
  y: number;
  isRed: boolean;
  collected: boolean;
}

interface BumperPin {
  x: number;
  y: number;
  r: number;
}

let BUNDLED_KIRBY_ROM: Uint8Array | null = null;
let BUNDLED_KIRBY_PROMISE: Promise<void> | null = null;

async function ensureKirbyRom(): Promise<void> {
  if (BUNDLED_KIRBY_ROM) return;
  if (!BUNDLED_KIRBY_PROMISE) {
    BUNDLED_KIRBY_PROMISE = (async () => {
      try {
        const res = await fetch('./roms/kirby-tilt-n-tumble.gbc');
        if (res.ok) {
          BUNDLED_KIRBY_ROM = new Uint8Array(await res.arrayBuffer());
        }
      } catch (err) {
        console.warn('Failed to fetch bundled Kirby Tilt n Tumble GBC ROM:', err);
      } finally {
        if (!BUNDLED_KIRBY_ROM) {
          BUNDLED_KIRBY_PROMISE = null;
        }
      }
    })();
  }
  await BUNDLED_KIRBY_PROMISE;
}

const KIRBY_SPRITE = [
  '..PPPPPP..',
  '.PPLLLLPP.',
  'PPLKPPKLPP',
  'PPLKPPKLPP',
  'PPRPPPPRPP',
  'PPPPPPPPPP',
  '.PPPPPPPP.',
  '..FF..FF..',
];

function drawKirbyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  drawPixelSprite(
    ctx,
    KIRBY_SPRITE,
    {
      P: '#ff78b8',
      L: '#ffc0e0',
      K: '#181828',
      R: '#ff3870',
      F: '#d81850',
    },
    x,
    y,
    scale
  );
}

export function createKirbyTiltCartridge(): GameCartridge {
  const cartId = 'kirby-tilt-n-tumble';
  const primaryHex = '#e84898';
  const accentHex = '#ffe858';
  const hwEmulator = new GBHardwareEmulator();

  function createDefaultProfiles(): KirbyProfile[] {
    return [
      {
        slot: 0,
        playerName: 'KIRBY',
        worldLabel: 'STAGE 1-1',
        stars: 18,
        redStars: 1,
        lives: 4,
        hasSave: true,
      },
      {
        slot: 1,
        playerName: 'DEDEDE',
        worldLabel: 'STAGE 2-1',
        stars: 64,
        redStars: 4,
        lives: 7,
        hasSave: true,
      },
      {
        slot: 2,
        playerName: 'NEW TUMBLER',
        worldLabel: 'FRESH SAVE',
        stars: 0,
        redStars: 0,
        lives: 3,
        hasSave: false,
      },
    ];
  }

  const state = {
    ctx: null as unknown as GameContext,
    animTime: 0,
    mode: 'PROFILES' as KirbyMode,
    profiles: createDefaultProfiles(),
    profileCursor: 0,
    activeProfileSlot: 0,
    romReady: false,
    sramSyncTimer: 0,

    // Native GBC Tilt Course state
    kx: 80,
    ky: 540,
    vx: 0,
    vy: 0,
    kz: 0,
    vz: 0,
    camY: 440,
    stars: 0,
    redStars: 0,
    score: 0,
    timer: 60,
    stage: 1,
    lastRollDeg: 0,
    lastPitchDeg: 0,
    starPickups: [] as StarPickup[],
    bumpers: [] as BumperPin[],
  };

  function initTiltCourse(): void {
    state.kx = 80;
    state.ky = 550;
    state.vx = 0;
    state.vy = 0;
    state.kz = 0;
    state.vz = 0;
    state.camY = 440;
    state.timer = 60;
    state.starPickups = [];
    state.bumpers = [];

    for (let i = 0; i < 18; i++) {
      const y = 510 - i * 26;
      const x = 32 + ((i * 37) % 96);
      state.starPickups.push({
        x,
        y,
        isRed: i === 12,
        collected: false,
      });
      if (i % 3 === 1) {
        state.bumpers.push({
          x: 44 + ((i * 53) % 72),
          y: y - 12,
          r: 8,
        });
      }
    }
  }

  function getSlotSramKey(slot: number): string {
    return `${cartId}-sram-v1-slot-${slot}`;
  }

  function loadProfiles(): void {
    if (!state.ctx) return;
    const saved = state.ctx.storage.loadData<KirbyProfile[] | null>(`${cartId}-profiles-v2`, null);
    state.profiles = saved && saved.length === 3 ? saved : createDefaultProfiles();
    state.ctx.storage.saveData(`${cartId}-profiles-v2`, state.profiles);
  }

  function saveProfiles(): void {
    if (!state.ctx) return;
    if (hwEmulator.isRunningHardware()) {
      const sram = hwEmulator.extractSram();
      if (sram.length > 0) {
        state.ctx.storage.saveData(getSlotSramKey(state.activeProfileSlot), sram);
      }
    }
    state.ctx.storage.saveData(`${cartId}-profiles-v2`, state.profiles);
    const best = Math.max(
      state.score,
      ...state.profiles.map((p) => p.stars * 100 + p.redStars * 500)
    );
    state.ctx.storage.setHighScore(cartId, best);
  }

  function bootProfileIntoRom(
    slot: number,
    bootTarget: 'TITLE' | 'FILE_SELECT' | 'LEVEL_SELECT' | 'PLAY_GAME' = 'PLAY_GAME'
  ): boolean {
    const romBytes = BUNDLED_KIRBY_ROM ?? hwEmulator.getRawBytes();
    if (!romBytes) return false;

    state.activeProfileSlot = slot;
    state.profileCursor = slot;
    const prof = state.profiles[slot] ?? state.profiles[0];

    const savedSram = state.ctx?.storage.loadData<number[] | null>(getSlotSramKey(slot), null);
    const meta = hwEmulator.loadRom('kirby-tilt-n-tumble.gbc', romBytes, savedSram);
    if (meta.isExecutable && hwEmulator.isRunningHardware()) {
      const effectiveTarget =
        bootTarget === 'PLAY_GAME' && !prof.hasSave
          ? 'FILE_SELECT'
          : bootTarget === 'PLAY_GAME' && slot === 1
            ? 'LEVEL_SELECT'
            : bootTarget;
      hwEmulator.fastForwardKirbyBoot(slot, effectiveTarget);
      state.mode = 'EMU_ROM';
      state.ctx?.audio.startBGM('kirby' as any);
      return true;
    }
    return false;
  }

  function updateProfiles(input: InputState): void {
    if (input.justPressed.up && state.profileCursor > 0) {
      state.profileCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.down && state.profileCursor < 2) {
      state.profileCursor++;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.b) {
      state.ctx.audio.playMenuBack();
      state.ctx.exitToMenu();
    } else if (input.justPressed.select) {
      state.ctx.audio.playMenuSelect();
      if (!bootProfileIntoRom(state.profileCursor, 'TITLE')) {
        ensureKirbyRom().then(() => {
          state.romReady = Boolean(BUNDLED_KIRBY_ROM);
          bootProfileIntoRom(state.profileCursor, 'TITLE');
        });
      }
    } else if (input.justPressed.a || input.justPressed.start) {
      state.ctx.audio.playMenuSelect();
      if (!bootProfileIntoRom(state.profileCursor, 'PLAY_GAME')) {
        ensureKirbyRom().then(() => {
          state.romReady = Boolean(BUNDLED_KIRBY_ROM);
          if (!bootProfileIntoRom(state.profileCursor, 'PLAY_GAME')) {
            initTiltCourse();
            state.mode = 'TILT_COURSE';
          }
        });
      }
    }
  }

  function updateTiltCourse(dt: number, input: InputState): void {
    if (input.held.select && input.justPressed.b) {
      saveProfiles();
      state.mode = 'PROFILES';
      state.ctx.audio.playMenuBack();
      return;
    }

    const dirX = Math.max(-1, Math.min(1, (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0) + input.tilt.x));
    const dirY = Math.max(-1, Math.min(1, (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0) + input.tilt.y));

    state.vx = (state.vx + dirX * 220 * dt) * 0.92;
    state.vy = (state.vy + dirY * 220 * dt) * 0.92;
    state.kx = Math.max(20, Math.min(140, state.kx + state.vx * dt));
    state.ky = Math.max(40, Math.min(570, state.ky + state.vy * dt));

    // Pop / Flip jump with A or upward phone flick
    if ((input.justPressed.a || input.tilt.flickJump) && state.kz <= 0.1) {
      state.vz = 95;
      state.ctx.audio.playJump();
    }
    if (state.kz > 0 || state.vz > 0) {
      state.kz += state.vz * dt;
      state.vz -= 240 * dt;
      if (state.kz <= 0) {
        state.kz = 0;
        state.vz = 0;
      }
    }

    // Collect stars
    for (const s of state.starPickups) {
      if (!s.collected && Math.hypot(state.kx - s.x, state.ky - s.y) < 11) {
        s.collected = true;
        if (s.isRed) {
          state.redStars++;
          state.score += 500;
          state.ctx.audio.playPowerUp();
        } else {
          state.stars++;
          state.score += 100;
          state.ctx.audio.playCoin();
        }
      }
    }

    // Bumpers
    if (state.kz < 4) {
      for (const b of state.bumpers) {
        const dx = state.kx - b.x;
        const dy = state.ky - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < b.r + 6) {
          state.vx = (dx / dist) * 110;
          state.vy = (dy / dist) * 110;
          state.score += 50;
          state.ctx.audio.playHit();
        }
      }
    }

    // Reach Goal Pad at top of course
    if (state.ky <= 55) {
      state.stage++;
      state.score += 1000;
      state.ctx.audio.playPowerUp();
      saveProfiles();
      initTiltCourse();
    }

    state.camY = Math.max(0, Math.min(440, state.ky - 96));
  }

  function renderProfiles(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fff0f8';
    ctx.fillRect(0, 0, 160, 144);

    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 160, 22);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 20, 160, 2);

    drawPixelText(ctx, 'KIRBY TILT N TUMBLE', 80, 3, {
      color: '#ffe858',
      size: 5,
      align: 'center',
      shadow: '#381028',
    });
    drawPixelText(
      ctx,
      state.romReady
        ? `TILT:${Math.round(state.lastRollDeg)},${Math.round(state.lastPitchDeg)} · GBC ROM READY`
        : 'LOADING KIRBY GBC ROM...',
      80,
      12,
      {
        color: '#ffffff',
        size: 3.8,
        align: 'center',
      }
    );

    state.profiles.forEach((prof, idx) => {
      const sel = state.profileCursor === idx;
      const by = 25 + idx * 34;

      drawGBCBox(ctx, 5, by, 150, 31, {
        bg: sel ? '#ffffff' : '#f8dce8',
        borderOuter: sel ? primaryHex : '#986880',
        borderInner: sel ? accentHex : '#d8b0c4',
      });

      if (sel) {
        drawPixelText(ctx, '>', 8, by + 11, { color: primaryHex, size: 5 });
      }

      drawKirbyIcon(ctx, 14, by + 10, 1);

      if (prof.hasSave) {
        drawPixelText(ctx, `FILE ${idx + 1}: ${prof.playerName}`, 27, by + 5, {
          color: sel ? '#281020' : '#482838',
          size: 4.3,
        });
        drawPixelText(ctx, prof.worldLabel, 149, by + 5, {
          color: primaryHex,
          size: 3.6,
          align: 'right',
        });
        drawPixelText(
          ctx,
          `STARS:${String(prof.stars).padStart(2, '0')}  RED:${prof.redStars}/8  LVS:${prof.lives}`,
          27,
          by + 17,
          {
            color: sel ? '#781848' : '#684858',
            size: 3.9,
          }
        );
      } else {
        drawPixelText(ctx, `FILE ${idx + 1}: + START NEW GAME`, 27, by + 6, {
          color: sel ? primaryHex : '#482838',
          size: 4.3,
        });
        drawPixelText(ctx, 'TILT SENSOR + 360 DPAD', 27, by + 17, {
          color: '#684858',
          size: 3.8,
        });
      }
    });

    ctx.fillStyle = '#281020';
    ctx.fillRect(0, 129, 160, 15);
    drawPixelText(ctx, 'A/START:PLAY  SEL:TITLE  B:EXIT', 80, 134, {
      color: '#ffe858',
      size: 3.9,
      align: 'center',
    });
  }

  function renderTiltCourse(ctx: CanvasRenderingContext2D): void {
    // Sky backdrop
    ctx.fillStyle = '#58b8f8';
    ctx.fillRect(0, 0, 160, 144);

    // Checkerboard Tilt Course
    for (let y = 20; y < 580; y += 16) {
      const sy = Math.round(y - state.camY);
      if (sy < -16 || sy > 144) continue;
      for (let x = 16; x < 144; x += 16) {
        const even = ((x >> 4) + (y >> 4)) % 2 === 0;
        ctx.fillStyle = even ? '#f8e8b8' : '#e8b878';
        ctx.fillRect(x, sy, 16, 16);
      }
    }

    // Goal Pad
    const goalSy = Math.round(45 - state.camY);
    if (goalSy > -20 && goalSy < 144) {
      ctx.fillStyle = '#e83878';
      ctx.fillRect(62, goalSy - 10, 36, 20);
      drawPixelText(ctx, 'GOAL', 80, goalSy - 4, {
        color: '#ffe858',
        size: 5,
        align: 'center',
      });
    }

    // Stars & Bumpers
    for (const s of state.starPickups) {
      if (s.collected) continue;
      const sy = Math.round(s.y - state.camY);
      if (sy < 0 || sy > 140) continue;
      ctx.fillStyle = s.isRed ? '#ff2848' : '#ffe838';
      ctx.fillRect(s.x - 3, sy - 3, 6, 6);
    }

    for (const b of state.bumpers) {
      const sy = Math.round(b.y - state.camY);
      if (sy < 0 || sy > 140) continue;
      ctx.fillStyle = '#3868e8';
      ctx.fillRect(b.x - 6, sy - 6, 12, 12);
      ctx.fillStyle = '#ffe858';
      ctx.fillRect(b.x - 3, sy - 3, 6, 6);
    }

    // Rolling Kirby shadow + sprite
    const ksy = Math.round(state.ky - state.camY);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(state.kx - 4), ksy + 2, 8, 4);
    drawKirbyIcon(ctx, Math.round(state.kx - 5), Math.round(ksy - 5 - state.kz * 0.35), 1);

    // Top HUD
    ctx.fillStyle = '#281020';
    ctx.fillRect(0, 0, 160, 13);
    drawPixelText(ctx, `STARS:${String(state.stars).padStart(2, '0')}`, 4, 3, {
      color: '#ffe858',
      size: 4,
    });
    drawPixelText(
      ctx,
      `TILT:${Math.round(state.lastRollDeg)},${Math.round(state.lastPitchDeg)}`,
      80,
      3,
      {
        color: '#ffffff',
        size: 3.7,
        align: 'center',
      }
    );
    drawPixelText(ctx, `SC:${String(state.score).padStart(4, '0')}`, 156, 3, {
      color: '#ff98c8',
      size: 4,
      align: 'right',
    });
  }

  return {
    id: cartId,
    title: 'KIRBY TILT N TUMBLE',
    subtitle: 'Tilt & 360 D-Pad GBC',
    genre: 'TILT ACT',
    description:
      '1MB Kirby Tilt n Tumble GBC ROM with tilt & 3-slot saves!',
    cartridgeColor: '#ff6eb4',
    labelColor: '#381028',
    accentColor: accentHex,

    renderPreviewIcon(ctx, x, y, w, h, time) {
      ctx.fillStyle = '#381028';
      ctx.fillRect(x, y, w, h);
      const rollX = Math.round(Math.sin(time * 3.5) * 3);
      drawKirbyIcon(ctx, x + 7 + rollX, y + 6, 2);
    },

    init(context: GameContext) {
      state.ctx = context;
      (hwEmulator as unknown as { setAudio?: (a: unknown) => void }).setAudio?.(context.audio);
      state.profileCursor = 0;
      state.mode = 'PROFILES';
      loadProfiles();
      initTiltCourse();
      state.romReady = Boolean(BUNDLED_KIRBY_ROM);
      context.audio.startBGM('kirby' as any);

      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode')?.toLowerCase();
      const urlSlot = Math.max(0, Math.min(2, Number(params.get('slot') ?? '0') || 0));

      ensureKirbyRom().then(() => {
        state.romReady = Boolean(BUNDLED_KIRBY_ROM);
        if (urlMode === 'title') {
          bootProfileIntoRom(urlSlot, 'TITLE');
        } else if (urlMode === 'files') {
          bootProfileIntoRom(urlSlot, 'FILE_SELECT');
        } else if (urlMode === 'levels') {
          bootProfileIntoRom(urlSlot, 'LEVEL_SELECT');
        } else if (urlMode === 'game') {
          bootProfileIntoRom(urlSlot, 'PLAY_GAME');
        }
      });
    },

    onRomLoaded(_fileName: string, bytes: Uint8Array) {
      BUNDLED_KIRBY_ROM = bytes;
      state.romReady = true;
      bootProfileIntoRom(state.activeProfileSlot, 'TITLE');
    },

    update(dt: number, input: InputState) {
      state.animTime += dt;
      state.lastRollDeg = input.tilt.rollDeg;
      state.lastPitchDeg = input.tilt.pitchDeg;

      if (state.mode === 'EMU_ROM' && hwEmulator.isRunningHardware()) {
        if (input.held.select && input.justPressed.b) {
          saveProfiles();
          state.mode = 'PROFILES';
          state.ctx?.audio.playMenuBack();
          return;
        }

        // Feed Phone Tilt (plus optional D-Pad fallback inside Kirby ROM) into MBC7 gyro registers
        const tiltX = Math.max(-1, Math.min(1, (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0) + input.tilt.x));
        const tiltY = input.tilt.flickJump
          ? -1.0
          : Math.max(-1, Math.min(1, (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0) + input.tilt.y));
        if (input.tilt.flickJump) {
          state.ctx?.audio.playJump();
        }
        hwEmulator.setTilt(tiltX, tiltY);
        hwEmulator.step(dt, input);

        state.sramSyncTimer += dt;
        if (state.sramSyncTimer >= 3.0) {
          state.sramSyncTimer = 0;
          saveProfiles();
        }
        return;
      }

      if (state.mode === 'PROFILES') {
        updateProfiles(input);
      } else {
        updateTiltCourse(dt, input);
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      if (state.mode === 'EMU_ROM' && hwEmulator.isRunningHardware()) {
        if (hwEmulator.renderToCanvas(ctx)) {
          return;
        }
      }
      if (state.mode === 'PROFILES') {
        renderProfiles(ctx);
      } else {
        renderTiltCourse(ctx);
      }
    },

    onScreenTap(_x: number, y: number): boolean {
      if (state.mode === 'PROFILES') {
        if (y >= 22 && y <= 130) {
          const slot = y < 58 ? 0 : y < 95 ? 1 : 2;
          state.profileCursor = slot;
        }
        state.ctx.audio.playMenuSelect();
        if (!bootProfileIntoRom(state.profileCursor, 'PLAY_GAME')) {
          ensureKirbyRom().then(() => {
            state.romReady = Boolean(BUNDLED_KIRBY_ROM);
            if (!bootProfileIntoRom(state.profileCursor, 'PLAY_GAME')) {
              initTiltCourse();
              state.mode = 'TILT_COURSE';
            }
          });
        }
        return true;
      }
      return false;
    },

    cleanup() {
      saveProfiles();
    },
  };
}

export const kirbyTiltCartridge = createKirbyTiltCartridge();
