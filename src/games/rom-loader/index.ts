import { GBHardwareEmulator, parseRomHeader } from '../../core/gb-emulator';
import {
  drawGBCBox,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

interface RomHeaderInfo {
  fileName: string;
  title: string;
  isGBC: boolean;
  mbcName: string;
  romSizeKB: number;
  checksumHex: string;
  isExecutable: boolean;
  tilePreviewColors: number[][];
}

const GBC_HARDWARE_PALETTES: Array<{ name: string; colors: [string, string, string, string] }> = [
  { name: 'DMG GREEN', colors: ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'] },
  { name: 'GBC BLUE', colors: ['#e8f8ff', '#68b8f8', '#2058b8', '#081838'] },
  { name: 'GBC GOLD', colors: ['#fff8d8', '#f8b838', '#b84818', '#281008'] },
  { name: 'GBC CYBER', colors: ['#f0d8ff', '#e848b8', '#582098', '#140824'] },
];

const hwEmulator = new GBHardwareEmulator();

const state = {
  ctx: null as unknown as GameContext,
  romInfo: null as RomHeaderInfo | null,
  viewMode: 'PLAY' as 'EMU' | 'PLAY' | 'TILES',
  paletteIdx: 0,
  demoX: 72,
  demoY: 78,
  starX: 40,
  starY: 64,
  score: 0,
  time: 0,
  tileOffset: 0,
  rawBytes: null as Uint8Array | null,
};

export const romLoaderCartridge: GameCartridge = {
  id: 'rom-loader',
  title: 'CUSTOM ROM SLOT',
  subtitle: '.GB / .GBC EMULATOR',
  genre: 'EMULATOR',
  description: 'Run any .gb or .gbc ROM on the LR35902 hardware core, or inspect its header & VRAM tiles!',
  cartridgeColor: '#485058',
  labelColor: '#182428',
  accentColor: '#38e8b8',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    ctx.fillStyle = '#182024';
    ctx.fillRect(x, y, w, h);

    // Gold PCB pins & microchip icon
    ctx.fillStyle = '#303840';
    ctx.fillRect(x + 6, y + 4, w - 12, h - 8);
    ctx.fillStyle = '#f8c838';
    for (let px = x + 8; px < x + w - 8; px += 4) {
      ctx.fillRect(px, y + h - 8, 2, 5);
    }
    const blink = Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#38e8b8' : '#289888';
    ctx.fillRect(x + 11, y + 9, w - 22, 10);
  },

  init(context: GameContext) {
    state.ctx = context;
    state.score = 0;
    state.demoX = 72;
    state.demoY = 78;
    if (hwEmulator.isRunningHardware()) {
      state.viewMode = 'EMU';
      context.audio.stopBGM();
    } else {
      context.audio.startBGM('menu');
    }
  },

  onRomLoaded(fileName: string, bytes: Uint8Array) {
    state.rawBytes = bytes;
    const savedSram = state.ctx?.storage.loadData<number[] | null>('rom-loader-sram', null);
    const meta = hwEmulator.loadRom(fileName, bytes, savedSram);
    const header = parseRomHeader(fileName, bytes);

    // Decode up to 256 non-empty 2BPP Game Boy tiles from the ROM
    const tiles: number[][] = [];
    const startAddr = Math.min(0x0150, Math.max(0, bytes.length - 64));
    for (let base = startAddr; base + 16 <= bytes.length && tiles.length < 256; base += 16) {
      const pixels: number[] = [];
      let nonZero = 0;
      for (let row = 0; row < 8; row++) {
        const b1 = bytes[base + row * 2] ?? 0;
        const b2 = bytes[base + row * 2 + 1] ?? 0;
        if (b1 !== 0 || b2 !== 0) nonZero++;
        for (let bit = 7; bit >= 0; bit--) {
          const lo = (b1 >> bit) & 1;
          const hi = (b2 >> bit) & 1;
          pixels.push((hi << 1) | lo);
        }
      }
      if (nonZero >= 2 || tiles.length < 24) {
        tiles.push(pixels);
      }
    }

    state.romInfo = {
      fileName: header.fileName,
      title: header.title,
      isGBC: header.isGBC,
      mbcName: header.mbcName,
      romSizeKB: header.romSizeKB,
      checksumHex: header.checksumHex,
      isExecutable: meta.isExecutable,
      tilePreviewColors: tiles,
    };
    state.tileOffset = 0;
    if (meta.isExecutable && hwEmulator.isRunningHardware()) {
      state.viewMode = 'EMU';
      state.ctx?.audio.stopBGM();
    } else {
      state.viewMode = 'TILES';
      if (header.isGBC) state.paletteIdx = 1;
    }
  },

  update(dt: number, input: InputState) {
    state.time += dt;

    if (state.viewMode === 'EMU' && hwEmulator.isRunningHardware()) {
      hwEmulator.step(dt, input);
      return;
    }

    if (input.justPressed.a) {
      state.ctx.audio.playMenuSelect();
      state.ctx.openRomFilePicker();
      return;
    }

    if (input.justPressed.b) {
      if (hwEmulator.isRunningHardware()) {
        state.viewMode = state.viewMode === 'TILES' ? 'EMU' : 'TILES';
      } else {
        state.viewMode = state.viewMode === 'PLAY' ? 'TILES' : 'PLAY';
      }
      state.ctx.audio.playMenuMove();
      return;
    }

    if (input.justPressed.start) {
      state.paletteIdx = (state.paletteIdx + 1) % GBC_HARDWARE_PALETTES.length;
      state.ctx.audio.playButtonClick();
    }

    if (state.viewMode === 'TILES' && state.romInfo) {
      const total = Math.max(24, state.romInfo.tilePreviewColors.length);
      if (input.justPressed.down || input.justPressed.right) {
        state.tileOffset = (state.tileOffset + 8) % total;
        state.ctx.audio.playButtonClick();
      } else if (input.justPressed.up || input.justPressed.left) {
        state.tileOffset = (state.tileOffset - 8 + total) % total;
        state.ctx.audio.playButtonClick();
      }
      return;
    }

    // PLAY mode: controllable DMG/ROM sprite collecting data stars
    const spd = 62;
    if (input.held.left) state.demoX = Math.max(12, state.demoX - spd * dt);
    if (input.held.right) state.demoX = Math.min(132, state.demoX + spd * dt);
    if (input.held.up) state.demoY = Math.max(54, state.demoY - spd * dt);
    if (input.held.down) state.demoY = Math.min(104, state.demoY + spd * dt);

    if (Math.abs(state.demoX - state.starX) < 12 && Math.abs(state.demoY - state.starY) < 12) {
      state.score += 50;
      state.ctx.storage.setHighScore('rom-loader', state.score);
      state.ctx.audio.playCoin();
      state.starX = 16 + Math.floor(Math.random() * 116);
      state.starY = 56 + Math.floor(Math.random() * 46);
    }
  },

  render(ctx: CanvasRenderingContext2D) {
    if (state.viewMode === 'EMU' && hwEmulator.isRunningHardware()) {
      if (hwEmulator.renderToCanvas(ctx)) {
        return;
      }
    }

    const pal = GBC_HARDWARE_PALETTES[state.paletteIdx].colors;

    ctx.fillStyle = '#101818';
    ctx.fillRect(0, 0, 160, 144);

    drawGBCBox(ctx, 4, 4, 152, 36, { bg: '#182428', borderOuter: '#38e8b8' });
    if (!state.romInfo) {
      drawPixelText(ctx, 'LR35902 GBC EMULATOR SLOT', 10, 10, { color: '#38e8b8', size: 4.5 });
      drawPixelText(ctx, 'READY FOR .GB / .GBC ROMS', 10, 20, { color: '#f8f8f0', size: 4 });
      drawPixelText(ctx, 'A:LOAD .GB/.GBC  START:PALETTE', 10, 30, { color: '#f8e838', size: 4 });
    } else {
      drawPixelText(ctx, `ROM: ${state.romInfo.title}`, 10, 10, { color: '#f8e838', size: 4.5 });
      drawPixelText(
        ctx,
        `${state.romInfo.mbcName} | ${state.romInfo.romSizeKB}KB | ${state.romInfo.checksumHex}`,
        10,
        20,
        { color: '#38e8b8', size: 4 }
      );
      drawPixelText(ctx, 'A:LOAD ROM  B:MODE  START:PAL', 10, 30, { color: '#c8d8d8', size: 4 });
    }

    // Center Interactive Homebrew / VRAM Sandbox Viewport
    drawGBCBox(ctx, 6, 44, 148, 94, { bg: pal[0], borderOuter: pal[2], borderInner: pal[3] });

    if (state.viewMode === 'TILES' && state.romInfo) {
      const tiles = state.romInfo.tilePreviewColors;
      for (let idx = 0; idx < 24; idx++) {
        const tile = tiles[(idx + state.tileOffset) % tiles.length];
        if (!tile) continue;
        const tx = 14 + (idx % 8) * 16;
        const ty = 50 + Math.floor(idx / 8) * 18;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            ctx.fillStyle = pal[tile[r * 8 + c]];
            ctx.fillRect(tx + c * 2, ty + r * 2, 2, 2);
          }
        }
      }
      drawPixelText(
        ctx,
        `2BPP TILES +${state.tileOffset} (D-PAD:SCROLL B:PLAY)`,
        80,
        125,
        { color: pal[3], size: 3.8, align: 'center' }
      );
    } else {
      const headerLabel = state.romInfo
        ? `${state.romInfo.title} SANDBOX | PTS:${state.score}`
        : `HOMEBREW DMG | PTS:${state.score}`;
      drawPixelText(ctx, headerLabel, 80, 50, { color: pal[3], size: 4, align: 'center' });

      const pulse = Math.floor(state.time * 6) % 2 === 0;
      ctx.fillStyle = pulse ? pal[3] : pal[2];
      ctx.fillRect(state.starX + 3, state.starY, 4, 10);
      ctx.fillRect(state.starX, state.starY + 3, 10, 4);

      const px = Math.round(state.demoX);
      const py = Math.round(state.demoY);
      const customTile = state.romInfo?.tilePreviewColors[0];
      if (customTile) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const v = customTile[r * 8 + c];
            if (v === 0) continue;
            ctx.fillStyle = pal[v];
            ctx.fillRect(px + c * 2, py + r * 2, 2, 2);
          }
        }
      } else {
        ctx.fillStyle = pal[3];
        ctx.fillRect(px, py, 14, 14);
        ctx.fillStyle = pal[0];
        ctx.fillRect(px + 3, py + 4, 2, 2);
        ctx.fillRect(px + 9, py + 4, 2, 2);
        ctx.fillRect(px + 4, py + 9, 6, 2);
      }

      drawPixelText(ctx, 'D-PAD:MOVE  B:VRAM INSPECTOR', 80, 116, { color: pal[2], size: 4, align: 'center' });
      drawPixelText(ctx, `PAL:${GBC_HARDWARE_PALETTES[state.paletteIdx].name} (START)`, 80, 125, {
        color: pal[3],
        size: 4,
        align: 'center',
      });
    }
  },

  cleanup() {
    if (state.ctx && hwEmulator.isRunningHardware()) {
      const sram = hwEmulator.extractSram();
      if (sram.length > 0) {
        state.ctx.storage.saveData<number[]>('rom-loader-sram', sram);
      }
    }
  },
};
