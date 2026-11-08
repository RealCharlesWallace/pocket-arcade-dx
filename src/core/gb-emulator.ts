// @ts-expect-error -- serverboy's internal GameBoyCore is a CommonJS module without TS declarations
import GameBoyCore from 'serverboy/src/gameboy_core/gameboy.js';
import { GBC_HEIGHT, GBC_WIDTH } from './pixel-renderer';
import type { GBCButton, InputState } from './types';

export interface RomMetadata {
  fileName: string;
  title: string;
  isGBC: boolean;
  mbcCode: number;
  mbcName: string;
  romSizeKB: number;
  checksumHex: string;
  isExecutable: boolean;
}

const MBC_NAMES: Record<number, string> = {
  0x00: 'ROM ONLY',
  0x01: 'MBC1',
  0x02: 'MBC1+RAM',
  0x03: 'MBC1+RAM+BATT',
  0x05: 'MBC2',
  0x06: 'MBC2+BATT',
  0x0f: 'MBC3+TIMER+BATT',
  0x10: 'MBC3+TIMER+RAM+BATT',
  0x11: 'MBC3',
  0x12: 'MBC3+RAM',
  0x13: 'MBC3+RAM+BATT',
  0x19: 'MBC5',
  0x1a: 'MBC5+RAM',
  0x1b: 'MBC5+RAM+BATT',
};

/**
 * GameBoyCore JoyPad key indices:
 * RIGHT: 0, LEFT: 1, UP: 2, DOWN: 3, A: 4, B: 5, SELECT: 6, START: 7
 */
const GB_KEY_MAP: ReadonlyArray<{ btn: GBCButton; code: number }> = [
  { btn: 'right', code: 0 },
  { btn: 'left', code: 1 },
  { btn: 'up', code: 2 },
  { btn: 'down', code: 3 },
  { btn: 'a', code: 4 },
  { btn: 'b', code: 5 },
  { btn: 'select', code: 6 },
  { btn: 'start', code: 7 },
];

export function parseRomHeader(fileName: string, bytes: Uint8Array): RomMetadata {
  let title = '';
  for (let i = 0x0134; i <= 0x0142 && i < bytes.length; i++) {
    const code = bytes[i];
    if (code === 0) break;
    if (code >= 32 && code <= 126) title += String.fromCharCode(code);
  }
  if (!title.trim()) {
    title = fileName.replace(/\.(gbc?|bin)$/i, '').slice(0, 14).toUpperCase();
  }

  const cgbFlag = bytes[0x0143] ?? 0;
  const isGBC = cgbFlag === 0x80 || cgbFlag === 0xc0 || fileName.toLowerCase().endsWith('.gbc');
  const mbcCode = bytes[0x0147] ?? 0;
  const mbcName = MBC_NAMES[mbcCode] ?? `MBC(0x${mbcCode.toString(16).toUpperCase()})`;
  const romSizeKB = Math.max(32, Math.round(bytes.length / 1024));
  const checksum = ((bytes[0x014e] ?? 0) << 8) | (bytes[0x014f] ?? 0);

  // Check if the ROM contains executable LR35902 entry-point code at 0x0100..0x0103
  // Standard GB/GBC ROMs have JP (0xC3), JR (0x18), DI (0xF3), XOR A (0xAF), or LD at 0x0100..0x0103
  let hasEntryJump = false;
  for (let i = 0x0100; i <= 0x0103 && i < bytes.length; i++) {
    const op = bytes[i];
    if (op === 0xc3 || op === 0x18 || op === 0xf3 || op === 0xcd || op === 0xaf || op === 0x31) {
      hasEntryJump = true;
      break;
    }
  }

  // Also check if code region 0x0150..0x0300 has varied opcodes (not just 0x00 NOPs)
  let codeVariety = 0;
  const seen = new Set<number>();
  for (let i = 0x0150; i < Math.min(bytes.length, 0x0400); i++) {
    if (bytes[i] !== 0x00 && bytes[i] !== 0xff) {
      seen.add(bytes[i]);
    }
  }
  codeVariety = seen.size;

  return {
    fileName,
    title: title.trim(),
    isGBC,
    mbcCode,
    mbcName,
    romSizeKB,
    checksumHex: '0x' + checksum.toString(16).toUpperCase().padStart(4, '0'),
    isExecutable: bytes.length >= 0x4000 && hasEntryJump && codeVariety >= 8,
  };
}

/**
 * Hardware-level Nintendo Game Boy / Game Boy Color (LR35902 CPU + PPU + MBC1/2/3/5)
 * emulator wrapper powered by Grant Galitz's GameBoyCore (`serverboy`).
 */
export class GBHardwareEmulator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gb: any = null;
  private metadata: RomMetadata | null = null;
  private romBytes: Uint8Array | null = null;
  private cycleAccum = 0;
  private prevHeld: Record<GBCButton, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false,
    start: false,
    select: false,
  };

  private frameCanvas: HTMLCanvasElement;
  private frameCtx: CanvasRenderingContext2D;
  private imageData: ImageData;

  constructor() {
    this.frameCanvas = document.createElement('canvas');
    this.frameCanvas.width = GBC_WIDTH;
    this.frameCanvas.height = GBC_HEIGHT;
    this.frameCtx = this.frameCanvas.getContext('2d')!;
    this.frameCtx.imageSmoothingEnabled = false;
    this.imageData = this.frameCtx.createImageData(GBC_WIDTH, GBC_HEIGHT);
  }

  loadRom(
    fileName: string,
    bytes: Uint8Array,
    savedSram?: number[] | null,
    dmgPaletteHex?: [number, number, number, number]
  ): RomMetadata {
    const meta = parseRomHeader(fileName, bytes);
    this.metadata = meta;
    this.romBytes = bytes;
    this.cycleAccum = 0;

    // Reset button states
    for (const { btn } of GB_KEY_MAP) {
      this.prevHeld[btn] = false;
    }

    if (!meta.isExecutable) {
      this.gb = null;
      return meta;
    }

    try {
      const romArray = Array.from(bytes);
      const core = new GameBoyCore(romArray);
      if (dmgPaletteHex) {
        core.colors = dmgPaletteHex.slice();
      }
      core.openMBC = () => (savedSram && savedSram.length > 0 ? savedSram.slice() : []);
      // Skip expensive per-frame JS array copy in graphicsBlit; we read core.canvasBuffer.data directly
      core.graphicsBlit = () => {};
      core.start();
      core.stopEmulator &= 1;
      core.iterations = 0;

      // Pre-seed default palettes so DMG/hybrid ROMs render immediately even before CGB palette writes
      const seedPal = dmgPaletteHex ?? [0xefffde, 0xadd794, 0x529273, 0x183442];
      if (core.gbBGPalette) {
        for (let i = 0; i < 4; i++) core.gbBGPalette[i] = seedPal[i];
      }
      if (core.gbcBGPalette) {
        for (let i = 0; i < 64; i++) core.gbcBGPalette[i] = seedPal[i % 4];
      }

      // Run initial warm-up slices so the ROM initializes VRAM & LCD registers
      for (let i = 0; i < 12; i++) {
        core.run();
      }

      this.gb = core;
    } catch (err) {
      console.warn('GBHardwareEmulator failed to initialize ROM:', err);
      this.gb = null;
    }

    return meta;
  }

  isRunningHardware(): boolean {
    return this.gb !== null && Boolean(this.metadata?.isExecutable);
  }

  getMetadata(): RomMetadata | null {
    return this.metadata;
  }

  getRawBytes(): Uint8Array | null {
    return this.romBytes;
  }

  reset(savedSram?: number[] | null): void {
    if (this.metadata && this.romBytes) {
      this.loadRom(this.metadata.fileName, this.romBytes, savedSram);
    }
  }

  step(dt: number, input: InputState): void {
    if (!this.gb) return;

    // Sync live JoyPad state with GameBoyCore
    for (const { btn, code } of GB_KEY_MAP) {
      const isDown = Boolean(input.held[btn]);
      if (isDown !== this.prevHeld[btn]) {
        this.prevHeld[btn] = isDown;
        this.gb.JoyPadEvent(code, isDown);
      }
    }

    // GameBoyCore is configured for 8ms (0.008s) clock slices (~2 slices per 60Hz frame).
    const clampedDt = Math.min(dt, 0.05);
    this.cycleAccum += clampedDt;
    let slices = 0;
    while (this.cycleAccum >= 0.008 && slices < 4) {
      this.gb.run();
      this.cycleAccum -= 0.008;
      slices++;
    }
  }

  renderToCanvas(ctx: CanvasRenderingContext2D): boolean {
    if (!this.gb || !this.gb.canvasBuffer?.data) return false;

    const srcData: Uint8ClampedArray = this.gb.canvasBuffer.data;
    if (srcData.length === GBC_WIDTH * GBC_HEIGHT * 4) {
      this.imageData.data.set(srcData);
      this.frameCtx.putImageData(this.imageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.frameCanvas, 0, 0, GBC_WIDTH, GBC_HEIGHT);
      return true;
    }
    return false;
  }

  extractSram(): number[] {
    if (!this.gb || typeof this.gb.saveSRAMState !== 'function') return [];
    try {
      const sram = this.gb.saveSRAMState();
      return Array.isArray(sram) ? sram : [];
    } catch {
      return [];
    }
  }
}
