import { GBHardwareEmulator } from '../../core/gb-emulator';
import { drawGBCBox, drawPixelSprite, drawPixelText } from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

type FroggerMode = 'PROFILES' | 'EMU_ROM' | 'ARCADE';

interface FroggerProfile {
  slot: number;
  playerName: string;
  stage: number;
  highScore: number;
  lives: number;
  zoneLabel: string;
  hasSave: boolean;
}

interface LaneItem {
  x: number;
  w: number;
  speed: number;
  kind: 'car' | 'truck' | 'racer' | 'log' | 'turtle';
  color: string;
}

let BUNDLED_FROGGER_ROM: Uint8Array | null = null;
let BUNDLED_FROGGER_PROMISE: Promise<void> | null = null;

async function ensureFroggerRom(): Promise<void> {
  if (BUNDLED_FROGGER_ROM) return;
  if (!BUNDLED_FROGGER_PROMISE) {
    BUNDLED_FROGGER_PROMISE = (async () => {
      try {
        const res = await fetch('./roms/frogger.gbc');
        if (res.ok) {
          BUNDLED_FROGGER_ROM = new Uint8Array(await res.arrayBuffer());
        }
      } catch (err) {
        console.warn('Failed to fetch bundled Frogger GBC ROM:', err);
      } finally {
        if (!BUNDLED_FROGGER_ROM) {
          BUNDLED_FROGGER_PROMISE = null;
        }
      }
    })();
  }
  await BUNDLED_FROGGER_PROMISE;
}

const FROG_SPRITE = [
  '.YY....YY.',
  'YKKY..YKKY',
  '.GGGGGGGG.',
  'GGLLLLLLGG',
  '.GGGGGGGG.',
  'GG.GGGG.GG',
  'G..G..G..G',
  '..GG..GG..',
];

function drawFrogIcon(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  drawPixelSprite(
    ctx,
    FROG_SPRITE,
    {
      Y: '#f8e838',
      K: '#181818',
      G: '#28c840',
      L: '#98f878',
    },
    x,
    y,
    scale
  );
}

export function createFroggerCartridge(): GameCartridge {
  const cartId = 'frogger';
  const primaryHex = '#1e9832';
  const accentHex = '#78f858';
  const hwEmulator = new GBHardwareEmulator();

  function createDefaultProfiles(): FroggerProfile[] {
    return [
      {
        slot: 0,
        playerName: 'HOPPER',
        stage: 1,
        highScore: 4250,
        lives: 5,
        zoneLabel: 'HIGHWAY HOP',
        hasSave: true,
      },
      {
        slot: 1,
        playerName: 'RIBBIT',
        stage: 3,
        highScore: 12800,
        lives: 5,
        zoneLabel: 'RIVER RAPIDS',
        hasSave: true,
      },
      {
        slot: 2,
        playerName: 'NEW HOPPER',
        stage: 1,
        highScore: 0,
        lives: 5,
        zoneLabel: 'MAIN MENU / NEW',
        hasSave: false,
      },
    ];
  }

  const state = {
    ctx: null as unknown as GameContext,
    animTime: 0,
    mode: 'PROFILES' as FroggerMode,
    profiles: createDefaultProfiles(),
    profileCursor: 0,
    activeProfileSlot: 0,
    romReady: false,

    // Native GBC Frogger Arcade state
    frogCol: 5,
    frogRow: 11,
    frogX: 76,
    points: 0,
    highScore: 4250,
    lives: 5,
    stage: 1,
    timer: 30,
    homesFilled: [false, false, false, false, false],
    lanes: [] as LaneItem[][],
    deathTimer: 0,
  };

  function initArcadeLanes(stageMult = 1): void {
    const sp = 0.85 + stageMult * 0.15;
    state.lanes = [
      // Row 1..4: River lanes (logs & turtles)
      [
        { x: 10, w: 36, speed: 22 * sp, kind: 'log', color: '#985020' },
        { x: 92, w: 36, speed: 22 * sp, kind: 'log', color: '#985020' },
      ],
      [
        { x: 20, w: 24, speed: -26 * sp, kind: 'turtle', color: '#e84828' },
        { x: 76, w: 24, speed: -26 * sp, kind: 'turtle', color: '#e84828' },
        { x: 130, w: 24, speed: -26 * sp, kind: 'turtle', color: '#e84828' },
      ],
      [
        { x: 0, w: 48, speed: 30 * sp, kind: 'log', color: '#a85824' },
        { x: 88, w: 48, speed: 30 * sp, kind: 'log', color: '#a85824' },
      ],
      [
        { x: 14, w: 28, speed: -20 * sp, kind: 'turtle', color: '#e84828' },
        { x: 84, w: 28, speed: -20 * sp, kind: 'turtle', color: '#e84828' },
      ],
      // Row 5: Safe median bank
      [],
      // Row 6..9: Highway traffic lanes
      [
        { x: 18, w: 22, speed: -28 * sp, kind: 'truck', color: '#f8e8d8' },
        { x: 96, w: 22, speed: -28 * sp, kind: 'truck', color: '#f8e8d8' },
      ],
      [
        { x: 10, w: 14, speed: 38 * sp, kind: 'racer', color: '#f83838' },
        { x: 86, w: 14, speed: 38 * sp, kind: 'racer', color: '#f83838' },
      ],
      [
        { x: 30, w: 14, speed: -24 * sp, kind: 'car', color: '#d878f8' },
        { x: 95, w: 14, speed: -24 * sp, kind: 'car', color: '#d878f8' },
      ],
      [
        { x: 5, w: 14, speed: 22 * sp, kind: 'car', color: '#f8d830' },
        { x: 65, w: 14, speed: 22 * sp, kind: 'car', color: '#f8d830' },
        { x: 125, w: 14, speed: 22 * sp, kind: 'car', color: '#f8d830' },
      ],
    ];
  }

  function resetFrogPosition(): void {
    state.frogCol = 5;
    state.frogRow = 11;
    state.frogX = 76;
    state.timer = 30;
  }

  function loadProfiles(): void {
    if (!state.ctx) return;
    const saved = state.ctx.storage.loadData<FroggerProfile[] | null>(`${cartId}-profiles-v1`, null);
    state.profiles = saved && saved.length === 3 ? saved : createDefaultProfiles();
    state.ctx.storage.saveData(`${cartId}-profiles-v1`, state.profiles);
  }

  function saveProfiles(): void {
    if (!state.ctx) return;
    const prof = state.profiles[state.activeProfileSlot];
    if (prof) {
      prof.highScore = Math.max(prof.highScore, state.points, state.highScore);
      prof.stage = Math.max(prof.stage, state.stage);
      prof.hasSave = true;
    }
    state.ctx.storage.saveData(`${cartId}-profiles-v1`, state.profiles);
    const best = Math.max(state.highScore, ...state.profiles.map((p) => p.highScore));
    state.ctx.storage.setHighScore(cartId, best);
  }

  function bootProfileIntoRom(
    slot: number,
    bootTarget: 'TITLE' | 'MAIN_MENU' | 'PLAY_GAME' = 'PLAY_GAME'
  ): boolean {
    const romBytes = BUNDLED_FROGGER_ROM ?? hwEmulator.getRawBytes();
    if (!romBytes) return false;

    state.activeProfileSlot = slot;
    state.profileCursor = slot;
    const prof = state.profiles[slot] ?? state.profiles[0];
    state.stage = prof.stage;
    state.points = prof.hasSave ? (prof.stage - 1) * 1500 : 0;
    state.highScore = Math.max(4250, prof.highScore);

    const savedSram = state.ctx?.storage.loadData<number[] | null>(
      `${cartId}-sram-slot-${slot}`,
      null
    );
    const meta = hwEmulator.loadRom('frogger.gbc', romBytes, savedSram);
    if (meta.isExecutable && hwEmulator.isRunningHardware()) {
      const target = bootTarget === 'PLAY_GAME' && !prof.hasSave ? 'MAIN_MENU' : bootTarget;
      hwEmulator.fastForwardFroggerBoot(target);
      state.mode = 'EMU_ROM';
      state.ctx?.audio.stopBGM();
      return true;
    }
    return false;
  }

  function startArcadeForSlot(slot: number): void {
    state.activeProfileSlot = slot;
    const prof = state.profiles[slot] ?? state.profiles[0];
    state.stage = prof.stage || 1;
    state.points = prof.hasSave ? (state.stage - 1) * 1200 : 0;
    state.highScore = Math.max(4250, prof.highScore);
    state.lives = 5;
    state.homesFilled = [false, false, false, false, false];
    initArcadeLanes(state.stage);
    resetFrogPosition();
    state.mode = 'ARCADE';
    state.ctx?.audio.startBGM('frogger' as any);
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
        ensureFroggerRom().then(() => {
          state.romReady = Boolean(BUNDLED_FROGGER_ROM);
          bootProfileIntoRom(state.profileCursor, 'TITLE');
        });
      }
    } else if (input.justPressed.a || input.justPressed.start) {
      state.ctx.audio.playMenuSelect();
      const chosen = state.profiles[state.profileCursor];
      const target = chosen?.hasSave ? 'PLAY_GAME' : 'MAIN_MENU';
      if (!bootProfileIntoRom(state.profileCursor, target)) {
        ensureFroggerRom().then(() => {
          state.romReady = Boolean(BUNDLED_FROGGER_ROM);
          if (!bootProfileIntoRom(state.profileCursor, target)) {
            startArcadeForSlot(state.profileCursor);
          }
        });
      }
    }
  }

  function updateArcade(dt: number, input: InputState): void {
    if (input.held.select && input.justPressed.b) {
      saveProfiles();
      state.mode = 'PROFILES';
      state.ctx.audio.playMenuBack();
      return;
    }

    if (state.deathTimer > 0) {
      state.deathTimer -= dt;
      if (state.deathTimer <= 0) {
        if (state.lives <= 0) {
          saveProfiles();
          state.mode = 'PROFILES';
        } else {
          resetFrogPosition();
        }
      }
      return;
    }

    state.timer -= dt;
    if (state.timer <= 0) {
      state.lives--;
      state.deathTimer = 0.8;
      state.ctx.audio.playHit();
      return;
    }

    // Move lanes
    for (const lane of state.lanes) {
      for (const item of lane) {
        item.x += item.speed * dt;
        if (item.speed > 0 && item.x > 168) item.x = -item.w;
        if (item.speed < 0 && item.x + item.w < -8) item.x = 168;
      }
    }

    // Hop controls
    if (input.justPressed.up && state.frogRow > 1) {
      state.frogRow--;
      state.points += 10;
      state.ctx.audio.playJump();
    } else if (input.justPressed.down && state.frogRow < 11) {
      state.frogRow++;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.left && state.frogX > 8) {
      state.frogX = Math.max(4, state.frogX - 14);
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.right && state.frogX < 142) {
      state.frogX = Math.min(146, state.frogX + 14);
      state.ctx.audio.playMenuMove();
    }

    // Check reaching Lily-Pad Home Row (row === 1)
    if (state.frogRow === 1) {
      const bayIdx = Math.min(4, Math.max(0, Math.floor(state.frogX / 32)));
      if (!state.homesFilled[bayIdx]) {
        state.homesFilled[bayIdx] = true;
        state.points += 200 + Math.round(state.timer * 10);
        state.ctx.audio.playCoin();
        if (state.homesFilled.every(Boolean)) {
          state.stage++;
          state.points += 1000;
          state.homesFilled = [false, false, false, false, false];
          initArcadeLanes(state.stage);
          state.ctx.audio.playPowerUp();
        }
        saveProfiles();
        resetFrogPosition();
      } else {
        state.lives--;
        state.deathTimer = 0.7;
        state.ctx.audio.playHit();
      }
      return;
    }

    // River rows (rows 2..5 -> lanes 0..3)
    if (state.frogRow >= 2 && state.frogRow <= 5) {
      const lane = state.lanes[state.frogRow - 2] ?? [];
      const platform = lane.find(
        (it) => state.frogX + 8 >= it.x && state.frogX + 2 <= it.x + it.w
      );
      if (platform) {
        state.frogX += platform.speed * dt;
        if (state.frogX < 0 || state.frogX > 152) {
          state.lives--;
          state.deathTimer = 0.8;
          state.ctx.audio.playHit();
        }
      } else {
        state.lives--;
        state.deathTimer = 0.8;
        state.ctx.audio.playHit();
      }
    }

    // Highway rows (rows 7..10 -> lanes 5..8)
    if (state.frogRow >= 7 && state.frogRow <= 10) {
      const lane = state.lanes[state.frogRow - 2] ?? [];
      const hitCar = lane.some(
        (it) => state.frogX + 8 > it.x + 1 && state.frogX + 2 < it.x + it.w - 1
      );
      if (hitCar) {
        state.lives--;
        state.deathTimer = 0.8;
        state.ctx.audio.playHit();
      }
    }
  }

  function renderProfiles(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#e8f8e0';
    ctx.fillRect(0, 0, 160, 144);

    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 160, 22);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 20, 160, 2);

    drawPixelText(ctx, 'FROGGER GBC - ACCOUNTS', 80, 3, {
      color: '#f8e838',
      size: 5,
      align: 'center',
      shadow: '#102810',
    });
    drawPixelText(
      ctx,
      state.romReady ? '1MB MAJESCO GBC ROM READY' : 'LOADING FROGGER ROM...',
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
        bg: sel ? '#ffffff' : '#dcecd4',
        borderOuter: sel ? primaryHex : '#688868',
        borderInner: sel ? accentHex : '#a8c8a0',
      });

      if (sel) {
        drawPixelText(ctx, '>', 8, by + 11, { color: primaryHex, size: 5 });
      }

      drawFrogIcon(ctx, 14, by + 10, 1);

      if (prof.hasSave) {
        drawPixelText(ctx, `FILE ${idx + 1}: ${prof.playerName}`, 27, by + 5, {
          color: sel ? '#102414' : '#304834',
          size: 4.3,
        });
        drawPixelText(ctx, prof.zoneLabel, 149, by + 5, {
          color: primaryHex,
          size: 3.7,
          align: 'right',
        });
        drawPixelText(
          ctx,
          `STG:${prof.stage}  HI:${String(prof.highScore).padStart(5, '0')}  LVS:${prof.lives}`,
          27,
          by + 17,
          {
            color: sel ? '#1e5828' : '#486850',
            size: 3.9,
          }
        );
      } else {
        drawPixelText(ctx, `FILE ${idx + 1}: + START NEW GAME`, 27, by + 6, {
          color: sel ? primaryHex : '#304834',
          size: 4.3,
        });
        drawPixelText(ctx, 'HIGHWAY & RIVER / STAGE 1', 27, by + 17, {
          color: '#486850',
          size: 3.8,
        });
      }
    });

    ctx.fillStyle = '#102414';
    ctx.fillRect(0, 129, 160, 15);
    drawPixelText(ctx, 'A/START:PLAY  SEL:TITLE  B:EXIT', 80, 134, {
      color: '#f8e838',
      size: 3.9,
      align: 'center',
    });
  }

  function renderArcade(ctx: CanvasRenderingContext2D): void {
    // Top HUD
    ctx.fillStyle = '#102018';
    ctx.fillRect(0, 0, 160, 12);
    drawPixelText(ctx, `1UP ${String(state.points).padStart(5, '0')}`, 4, 3, {
      color: '#f8f8f0',
      size: 4,
    });
    drawPixelText(ctx, `HI ${String(state.highScore).padStart(5, '0')}`, 156, 3, {
      color: '#f8e838',
      size: 4,
      align: 'right',
    });

    // Lily-pad home bank (Row 1: y = 12..24)
    ctx.fillStyle = '#185828';
    ctx.fillRect(0, 12, 160, 12);
    for (let i = 0; i < 5; i++) {
      const bx = i * 32 + 6;
      ctx.fillStyle = '#183898';
      ctx.fillRect(bx, 14, 20, 10);
      ctx.fillStyle = '#48c848';
      ctx.fillRect(bx + 3, 15, 14, 8);
      if (state.homesFilled[i]) {
        drawFrogIcon(ctx, bx + 5, 15, 1);
      }
    }

    // River (Rows 2..5: y = 24..64)
    ctx.fillStyle = '#183898';
    ctx.fillRect(0, 24, 160, 40);

    // Safe Median Bank (Row 6: y = 64..74)
    ctx.fillStyle = '#8848b8';
    ctx.fillRect(0, 64, 160, 10);

    // Highway (Rows 7..10: y = 74..114)
    ctx.fillStyle = '#202028';
    ctx.fillRect(0, 74, 160, 40);

    // Starting Safe Bank (Row 11: y = 114..126)
    ctx.fillStyle = '#8848b8';
    ctx.fillRect(0, 114, 160, 12);

    // Draw river logs/turtles & highway vehicles
    state.lanes.forEach((lane, idx) => {
      const ry = 24 + idx * 10;
      for (const it of lane) {
        ctx.fillStyle = it.color;
        ctx.fillRect(Math.round(it.x), ry + 1, it.w, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(it.x) + 2, ry + 2, Math.max(2, it.w - 4), 2);
      }
    });

    // Draw Frog
    const fy = 14 + (state.frogRow - 1) * 10;
    if (state.deathTimer > 0) {
      ctx.fillStyle = '#f83838';
      ctx.fillRect(Math.round(state.frogX), fy, 10, 8);
    } else {
      drawFrogIcon(ctx, Math.round(state.frogX), fy, 1);
    }

    // Bottom status bar (y = 126..144)
    ctx.fillStyle = '#101810';
    ctx.fillRect(0, 126, 160, 18);
    drawPixelText(ctx, `LIVES:${state.lives} STG:${state.stage}`, 4, 131, {
      color: '#78f858',
      size: 4,
    });
    const timeW = Math.max(0, Math.min(54, Math.round((state.timer / 30) * 54)));
    ctx.fillStyle = '#384838';
    ctx.fillRect(100, 130, 56, 7);
    ctx.fillStyle = state.timer < 8 ? '#f83838' : '#f8e838';
    ctx.fillRect(101, 131, timeW, 5);
  }

  return {
    id: cartId,
    title: 'FROGGER GBC',
    subtitle: 'Highway & River Hop',
    genre: 'ARCADE',
    description:
      '1MB Majesco Frogger GBC ROM with 3-slot saves & highway action!',
    cartridgeColor: primaryHex,
    labelColor: '#102818',
    accentColor: accentHex,

    renderPreviewIcon(ctx, x, y, w, h, time) {
      ctx.fillStyle = '#102818';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1848a8';
      ctx.fillRect(x + 2, y + 4, w - 4, 10);
      const hop = Math.abs(Math.sin(time * 5)) * 3;
      drawFrogIcon(ctx, x + 8, Math.round(y + 8 - hop), 2);
    },

    init(context: GameContext) {
      state.ctx = context;
      (hwEmulator as unknown as { setAudio?: (a: unknown) => void }).setAudio?.(context.audio);
      state.profileCursor = 0;
      state.mode = 'PROFILES';
      loadProfiles();
      initArcadeLanes(1);
      resetFrogPosition();
      state.romReady = Boolean(BUNDLED_FROGGER_ROM);
      context.audio.startBGM('frogger' as any);

      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode')?.toLowerCase();
      const urlSlot = Math.max(0, Math.min(2, Number(params.get('slot') ?? '0') || 0));

      ensureFroggerRom().then(() => {
        state.romReady = Boolean(BUNDLED_FROGGER_ROM);
        if (urlMode === 'title') {
          bootProfileIntoRom(urlSlot, 'TITLE');
        } else if (urlMode === 'game') {
          bootProfileIntoRom(urlSlot, 'PLAY_GAME');
        } else if (urlMode === 'menu') {
          bootProfileIntoRom(urlSlot, 'MAIN_MENU');
        }
      });

      if (urlMode === 'arcade') {
        startArcadeForSlot(urlSlot);
      }
    },

    onRomLoaded(fileName: string, bytes: Uint8Array) {
      BUNDLED_FROGGER_ROM = bytes;
      state.romReady = true;
      bootProfileIntoRom(state.activeProfileSlot, 'TITLE');
    },

    update(dt: number, input: InputState) {
      state.animTime += dt;
      if (state.mode === 'EMU_ROM' && hwEmulator.isRunningHardware()) {
        if (input.held.select && input.justPressed.b) {
          const sram = hwEmulator.extractSram();
          if (sram.length > 0) {
            state.ctx?.storage.saveData(`${cartId}-sram-slot-${state.activeProfileSlot}`, sram);
          }
          saveProfiles();
          state.mode = 'PROFILES';
          state.ctx?.audio.playMenuBack();
          return;
        }
        hwEmulator.step(dt, input);
        return;
      }

      if (state.mode === 'PROFILES') {
        updateProfiles(input);
      } else {
        updateArcade(dt, input);
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
        renderArcade(ctx);
      }
    },

    onScreenTap(_x: number, y: number): boolean {
      if (state.mode === 'PROFILES') {
        if (y >= 22 && y <= 130) {
          const slot = y < 58 ? 0 : y < 95 ? 1 : 2;
          state.profileCursor = slot;
        }
        state.ctx.audio.playMenuSelect();
        const chosen = state.profiles[state.profileCursor];
        const target = chosen?.hasSave ? 'PLAY_GAME' : 'MAIN_MENU';
        if (!bootProfileIntoRom(state.profileCursor, target)) {
          ensureFroggerRom().then(() => {
            state.romReady = Boolean(BUNDLED_FROGGER_ROM);
            if (!bootProfileIntoRom(state.profileCursor, target)) {
              startArcadeForSlot(state.profileCursor);
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

export const froggerCartridge = createFroggerCartridge();
