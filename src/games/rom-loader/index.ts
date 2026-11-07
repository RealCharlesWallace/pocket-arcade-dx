import {
  drawGBCBox,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

interface RomHeaderInfo {
  fileName: string;
  title: string;
  isGBC: boolean;
  romSizeKB: number;
  checksumHex: string;
  tilePreviewColors: number[][];
}

const state = {
  ctx: null as unknown as GameContext,
  romInfo: null as RomHeaderInfo | null,
  demoX: 72,
  demoY: 76,
  time: 0,
  tileOffset: 0,
  rawBytes: null as Uint8Array | null,
};

export const romLoaderCartridge: GameCartridge = {
  id: 'rom-loader',
  title: 'CUSTOM ROM SLOT',
  subtitle: '.GB / .GBC LOADER',
  genre: 'EMULATOR',
  description: 'Load any .gb or .gbc ROM file to inspect its GBC header, VRAM tiles, and run it in the slot!',
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
    context.audio.startBGM('menu');
  },

  onRomLoaded(fileName: string, bytes: Uint8Array) {
    state.rawBytes = bytes;
    // Parse standard Nintendo Game Boy / GBC header (0x0134 - 0x014F)
    let title = '';
    for (let i = 0x0134; i <= 0x0142 && i < bytes.length; i++) {
      const code = bytes[i];
      if (code === 0) break;
      if (code >= 32 && code <= 126) title += String.fromCharCode(code);
    }
    if (!title.trim()) title = fileName.slice(0, 12).toUpperCase();

    const cgbFlag = bytes[0x0143] ?? 0;
    const isGBC = cgbFlag === 0x80 || cgbFlag === 0xc0 || fileName.toLowerCase().endsWith('.gbc');
    const romSizeKB = Math.max(32, Math.round(bytes.length / 1024));
    const checksum = ((bytes[0x014e] ?? 0) << 8) | (bytes[0x014f] ?? 0);

    // Decode 2BPP Game Boy tile data from ROM for live VRAM tile visualization
    const tiles: number[][] = [];
    const startAddr = Math.min(0x0150, Math.max(0, bytes.length - 1600));
    for (let t = 0; t < 40; t++) {
      const base = startAddr + t * 16;
      const pixels: number[] = [];
      for (let row = 0; row < 8; row++) {
        const b1 = bytes[base + row * 2] ?? 0;
        const b2 = bytes[base + row * 2 + 1] ?? 0;
        for (let bit = 7; bit >= 0; bit--) {
          const lo = (b1 >> bit) & 1;
          const hi = (b2 >> bit) & 1;
          pixels.push((hi << 1) | lo);
        }
      }
      tiles.push(pixels);
    }

    state.romInfo = {
      fileName,
      title: title.trim(),
      isGBC,
      romSizeKB,
      checksumHex: '0x' + checksum.toString(16).toUpperCase().padStart(4, '0'),
      tilePreviewColors: tiles,
    };
  },

  update(dt: number, input: InputState) {
    state.time += dt;
    const spd = 55;
    if (input.held.left) state.demoX = Math.max(12, state.demoX - spd * dt);
    if (input.held.right) state.demoX = Math.min(136, state.demoX + spd * dt);
    if (input.held.up) state.demoY = Math.max(54, state.demoY - spd * dt);
    if (input.held.down) state.demoY = Math.min(106, state.demoY + spd * dt);

    if (input.justPressed.a) {
      state.ctx.audio.playMenuSelect();
      state.ctx.openRomFilePicker();
    }
    if (input.justPressed.b && state.rawBytes) {
      state.tileOffset = (state.tileOffset + 8) % Math.max(8, state.romInfo?.tilePreviewColors.length ?? 8);
      state.ctx.audio.playMenuMove();
    }
  },

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#101818';
    ctx.fillRect(0, 0, 160, 144);

    drawGBCBox(ctx, 4, 4, 152, 36, { bg: '#182428', borderOuter: '#38e8b8' });
    if (!state.romInfo) {
      drawPixelText(ctx, 'GBC ROM CARTRIDGE SLOT', 10, 10, { color: '#38e8b8', size: 5 });
      drawPixelText(ctx, 'NO EXTERNAL .GB/.GBC LOADED', 10, 20, { color: '#f8f8f0', size: 4 });
      drawPixelText(ctx, 'PRESS A TO PICK A ROM FILE!', 10, 30, { color: '#f8e838', size: 4 });
    } else {
      drawPixelText(ctx, `ROM: ${state.romInfo.title}`, 10, 10, { color: '#f8e838', size: 5 });
      drawPixelText(
        ctx,
        `${state.romInfo.isGBC ? 'GBC COLOR' : 'DMG MONO'} | ${state.romInfo.romSizeKB}KB | ${state.romInfo.checksumHex}`,
        10,
        20,
        { color: '#38e8b8', size: 4 }
      );
      drawPixelText(ctx, 'A:LOAD NEW ROM  B:BANK STEP', 10, 30, { color: '#c8d8d8', size: 4 });
    }

    // Center Interactive Homebrew / VRAM Sandbox Viewport
    drawGBCBox(ctx, 6, 44, 148, 94, { bg: '#9bbc0f', borderOuter: '#306230', borderInner: '#0f380f' });

    if (state.romInfo) {
      const dmgPalette = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];
      const tiles = state.romInfo.tilePreviewColors;
      for (let idx = 0; idx < 24; idx++) {
        const tile = tiles[(idx + state.tileOffset) % tiles.length];
        if (!tile) continue;
        const tx = 14 + (idx % 8) * 16;
        const ty = 52 + Math.floor(idx / 8) * 18;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            ctx.fillStyle = dmgPalette[tile[r * 8 + c]];
            ctx.fillRect(tx + c * 2, ty + r * 2, 2, 2);
          }
        }
      }
      drawPixelText(ctx, '2BPP ROM TILE DECODER ACTIVE', 80, 124, { color: '#0f380f', size: 4, align: 'center' });
    } else {
      // Built-in DMG Classic Demo Sprite controllable with D-Pad
      drawPixelText(ctx, 'HOMEBREW DMG DEMO ACTIVE', 80, 52, { color: '#0f380f', size: 5, align: 'center' });
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(Math.round(state.demoX), Math.round(state.demoY), 14, 14);
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect(Math.round(state.demoX + 3), Math.round(state.demoY + 4), 2, 2);
      ctx.fillRect(Math.round(state.demoX + 9), Math.round(state.demoY + 4), 2, 2);
      drawPixelText(ctx, 'MOVE SPRITE WITH D-PAD', 80, 114, { color: '#306230', size: 4, align: 'center' });
      drawPixelText(ctx, 'PRESS A TO INSERT .GB/.GBC', 80, 124, { color: '#0f380f', size: 4, align: 'center' });
    }
  },
};
