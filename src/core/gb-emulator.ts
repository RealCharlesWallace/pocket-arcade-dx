// @ts-expect-error -- serverboy's internal GameBoyCore is a CommonJS module without TS declarations
import GameBoyCore from 'serverboy/src/gameboy_core/gameboy.js';
import { GBC_HEIGHT, GBC_WIDTH } from './pixel-renderer';
import type { ChiptuneSynth } from './audio';
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

export interface Gen1SaveSummary {
  playerName: string;
  badges: number;
  pokedexOwned: number;
  hours: number;
  minutes: number;
  curMap: number;
  hasValidSave: boolean;
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
  0x22: 'MBC7+TILT+SRAM+BATT',
};

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

/**
 * Encodes an ASCII uppercase string (e.g. "RED", "ASH") into Gen-1 Pokémon character bytes
 * ('A'..'Z' = 0x80..0x99, '0'..'9' = 0xF6..0xFF, terminator '@' = 0x50).
 */
export function encodeGen1String(str: string, maxLen = 11): number[] {
  const out = new Array<number>(maxLen).fill(0x50);
  const clean = str.toUpperCase().slice(0, maxLen - 1);
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      out[i] = 0x80 + (code - 65);
    } else if (code >= 48 && code <= 57) {
      out[i] = 0xf6 + (code - 48);
    } else {
      out[i] = 0x7f; // space
    }
  }
  out[clean.length] = 0x50;
  return out;
}

/**
 * Decodes a Gen-1 Pokémon string from byte array up to terminator 0x50 ('@').
 */
export function decodeGen1String(bytes: ArrayLike<number>, offset: number, maxLen = 11): string {
  let out = '';
  for (let i = 0; i < maxLen; i++) {
    const b = bytes[offset + i] ?? 0x50;
    if (b === 0x50 || b === 0x00) break;
    if (b >= 0x80 && b <= 0x99) {
      out += String.fromCharCode(65 + (b - 0x80));
    } else if (b >= 0xa0 && b <= 0xb9) {
      out += String.fromCharCode(97 + (b - 0xa0));
    } else if (b >= 0xf6 && b <= 0xff) {
      out += String.fromCharCode(48 + (b - 0xf6));
    } else if (b === 0x7f) {
      out += ' ';
    }
  }
  return out.trim();
}

/**
 * Customizes a 32KB Gen-1 Pokémon Red/Blue SRAM image with a specific Trainer Profile's
 * name, rival name, badge count, Pokédex owned count, and play time, and recomputes `sMainDataCheckSum` (0x3523).
 */
export function customizeGen1Sram(
  baseSram: Uint8Array,
  opts: {
    playerName: string;
    rivalName: string;
    badgesMask: number;
    pokedexOwnedCount: number;
    hours: number;
    minutes: number;
    leadSpeciesByte?: number;
    leadNickname?: string;
  }
): number[] {
  const sram = Array.from(baseSram);
  while (sram.length < 32768) sram.push(0);

  // sPlayerName at 0x2598 (11 bytes)
  const pBytes = encodeGen1String(opts.playerName, 11);
  for (let i = 0; i < 11; i++) sram[0x2598 + i] = pBytes[i];

  // sMainData starts at 0x25A3 (corresponds to wMainDataStart = 0xD2F7)
  const mainBase = 0x25a3;
  const toSram = (wramAddr: number) => mainBase + (wramAddr - 0xd2f7);

  // wPokedexOwned (0xD2F7..0xD309) & wPokedexSeen (0xD30A..0xD31C)
  let rem = Math.max(0, Math.min(151, opts.pokedexOwnedCount));
  for (let i = 0; i < 19; i++) {
    let mask = 0;
    for (let bit = 0; bit < 8 && rem > 0; bit++, rem--) {
      mask |= 1 << bit;
    }
    sram[toSram(0xd2f7 + i)] = mask;
    sram[toSram(0xd30a + i)] = mask;
  }

  // wRivalName (0xD34A, 11 bytes)
  const rBytes = encodeGen1String(opts.rivalName, 11);
  for (let i = 0; i < 11; i++) sram[toSram(0xd34a + i)] = rBytes[i];

  // wObtainedBadges (0xD356)
  sram[toSram(0xd356)] = opts.badgesMask & 0xff;

  // wPlayTimeHours (0xDA41) & wPlayTimeMinutes (0xDA43)
  sram[toSram(0xda41)] = opts.hours & 0xff;
  sram[toSram(0xda43)] = opts.minutes & 0xff;

  // sPartyData starts at 0x2F2C (corresponds to wPartyDataStart = 0xD163)
  const partyBase = 0x2f2c;
  const partyCount = sram[partyBase] ?? 0;
  if (opts.leadSpeciesByte && partyCount >= 1) {
    sram[partyBase + 1] = opts.leadSpeciesByte & 0xff; // wPartySpecies[0]
    sram[partyBase + 8] = opts.leadSpeciesByte & 0xff; // wPartyMon1Species
    if (opts.leadNickname) {
      const nickBytes = encodeGen1String(opts.leadNickname, 11);
      const nickStart = partyBase + (0xd2b5 - 0xd163);
      for (let i = 0; i < 11; i++) sram[nickStart + i] = nickBytes[i];
    }
  }
  // Sync OT names for all party members to playerName
  const otStart = partyBase + (0xd273 - 0xd163);
  for (let m = 0; m < Math.min(6, partyCount); m++) {
    for (let i = 0; i < 11; i++) {
      sram[otStart + m * 11 + i] = pBytes[i];
    }
  }

  // Recompute complement checksum over 0x2598..0x3522 -> store at 0x3523
  let sum = 0;
  for (let addr = 0x2598; addr < 0x3523; addr++) {
    sum = (sum + (sram[addr] & 0xff)) & 0xff;
  }
  sram[0x3523] = (~sum) & 0xff;

  return sram;
}

/**
 * Reads a Gen-1 32KB SRAM array and decodes the Trainer Profile summary.
 */
export function parseGen1SramSummary(sram: ArrayLike<number> | null | undefined): Gen1SaveSummary | null {
  if (!sram || sram.length < 0x3524) return null;

  let sum = 0;
  for (let addr = 0x2598; addr < 0x3523; addr++) {
    sum = (sum + (sram[addr] & 0xff)) & 0xff;
  }
  const expected = (~sum) & 0xff;
  if ((sram[0x3523] & 0xff) !== expected) return null;

  const playerName = decodeGen1String(sram, 0x2598, 11);
  if (!playerName) return null;

  const mainBase = 0x25a3;
  const toSram = (wramAddr: number) => mainBase + (wramAddr - 0xd2f7);

  let badgeCount = 0;
  const badgeByte = sram[toSram(0xd356)] & 0xff;
  for (let b = 0; b < 8; b++) {
    if ((badgeByte >> b) & 1) badgeCount++;
  }

  let dexCount = 0;
  for (let i = 0; i < 19; i++) {
    const byte = sram[toSram(0xd2f7 + i)] & 0xff;
    for (let b = 0; b < 8; b++) {
      if ((byte >> b) & 1) dexCount++;
    }
  }

  const hours = sram[toSram(0xda41)] & 0xff;
  const minutes = sram[toSram(0xda43)] & 0xff;
  const curMap = sram[toSram(0xd35e)] & 0xff;

  return {
    playerName,
    badges: badgeCount,
    pokedexOwned: dexCount,
    hours,
    minutes,
    curMap,
    hasValidSave: true,
  };
}

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

  let hasEntryJump = false;
  for (let i = 0x0100; i <= 0x0103 && i < bytes.length; i++) {
    const op = bytes[i];
    if (op === 0xc3 || op === 0x18 || op === 0xf3 || op === 0xcd || op === 0xaf || op === 0x31) {
      hasEntryJump = true;
      break;
    }
  }

  const seen = new Set<number>();
  for (let i = 0x0150; i < Math.min(bytes.length, 0x0400); i++) {
    if (bytes[i] !== 0x00 && bytes[i] !== 0xff) {
      seen.add(bytes[i]);
    }
  }

  return {
    fileName,
    title: title.trim(),
    isGBC,
    mbcCode,
    mbcName,
    romSizeKB,
    checksumHex: '0x' + checksum.toString(16).toUpperCase().padStart(4, '0'),
    isExecutable: bytes.length >= 0x4000 && hasEntryJump && seen.size >= 8,
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
  private audio: ChiptuneSynth | null = null;
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
  private minHoldSlices: Record<GBCButton, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    a: 0,
    b: 0,
    start: 0,
    select: 0,
  };
  private retriggerGapSlices: Record<GBCButton, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    a: 0,
    b: 0,
    start: 0,
    select: 0,
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

  setAudio(audio: ChiptuneSynth): void {
    this.audio = audio;
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

    for (const { btn } of GB_KEY_MAP) {
      this.prevHeld[btn] = false;
      this.minHoldSlices[btn] = 0;
      this.retriggerGapSlices[btn] = 0;
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
      core.graphicsBlit = () => {};
      core.start();
      core.stopEmulator &= 1;
      core.iterations = 0;

      if (!core.cGBC) {
        const seedPal = dmgPaletteHex ?? [0xefffde, 0xadd794, 0x529273, 0x183442];
        core.colors = seedPal.slice();
        if (core.cachedBGPaletteConversion) {
          for (let i = 0; i < 4; i++) core.cachedBGPaletteConversion[i] = seedPal[i];
        }
        if (core.cachedOBJPaletteConversion) {
          for (let i = 0; i < 8; i++) core.cachedOBJPaletteConversion[i] = seedPal[i % 4];
        }
        if (core.gbBGPalette) {
          for (let i = 0; i < 4; i++) core.gbBGPalette[i] = seedPal[i];
        }
        if (core.gbcBGPalette) {
          for (let i = 0; i < 64; i++) core.gbcBGPalette[i] = seedPal[i % 4];
        }
      }

      for (let i = 0; i < 12; i++) {
        core.run();
      }
      if (!core.cGBC) {
        if (typeof core.updateGBBGPalette === 'function') {
          core.updateGBBGPalette(core.memory[0xff47]);
        }
        if (typeof core.updateGBOBJPalette === 'function') {
          core.updateGBOBJPalette(0, core.memory[0xff48]);
          core.updateGBOBJPalette(1, core.memory[0xff49]);
        }
      }

      this.gb = core;
    } catch (err) {
      console.warn('GBHardwareEmulator failed to initialize ROM:', err);
      this.gb = null;
    }

    return meta;
  }

  /**
   * Fast-forwards a Gen-1 Pokémon Red/Blue ROM past the Game Freak star intro
   * to the Title Screen (`'TITLE'`), the native `CONTINUE / NEW GAME` menu (`'MAIN_MENU'`),
   * the `PLAYER / BADGES / POKéDEX / TIME` Continue card (`'CONTINUE_INFO'`),
   * directly into the saved game overworld (`'CONTINUE_GAME'`), or Professor Oak's New Game intro (`'OAK_INTRO'`).
   */
  fastForwardGen1Boot(
    target: 'TITLE' | 'MAIN_MENU' | 'CONTINUE_INFO' | 'CONTINUE_GAME' | 'OAK_INTRO' = 'TITLE'
  ): void {
    if (!this.gb) return;

    const tapKey = (code: number, hold = 12, wait = 45) => {
      this.gb.JoyPadEvent(code, true);
      for (let i = 0; i < hold; i++) this.gb.run();
      this.gb.JoyPadEvent(code, false);
      for (let i = 0; i < wait; i++) this.gb.run();
    };

    // Run ~650 slices past the Game Freak star intro, then tap START until wTitleMonSpecies (0xCD3D) is set on the Title Screen
    for (let i = 0; i < 650; i++) {
      this.gb.run();
    }
    let titleGuard = 0;
    while (this.gb.memory[0xcd3d] === 0 && titleGuard < 25) {
      tapKey(7, 12, 45);
      titleGuard++;
    }
    for (let i = 0; i < 160; i++) {
      this.gb.run();
    }

    if (target === 'TITLE') {
      return;
    }

    // Advance into MainMenu until wSaveFileStatus (0xD088) is set
    let guard = 0;
    while (this.gb.memory[0xd088] === 0 && guard < 25) {
      tapKey(7, 12, 45);
      guard++;
    }
    // Wait until wMaxMenuItem (0xCC28) is populated right before HandleMenuInput
    let menuWait = 0;
    while (this.gb.memory[0xcc28] === 0 && menuWait < 300) {
      this.gb.run();
      menuWait++;
    }
    for (let i = 0; i < 20; i++) {
      this.gb.run();
    }

    if (target === 'MAIN_MENU') {
      return;
    }

    if (
      (target === 'CONTINUE_INFO' || target === 'CONTINUE_GAME') &&
      this.gb.memory[0xd088] === 2
    ) {
      // Press A on CONTINUE and wait for DelayFrames(20) + DisplayContinueGameInfo to render
      tapKey(4, 14, 150);
      if (target === 'CONTINUE_GAME') {
        // Press A on the PLAYER / BADGES / POKéDEX / TIME card to enter Pallet Town / Red's House!
        tapKey(4, 16, 220);
      }
      return;
    }

    if (target === 'OAK_INTRO') {
      if (this.gb.memory[0xd088] === 2) {
        // Move cursor down from CONTINUE to NEW GAME
        tapKey(3, 12, 45);
      }
      // Press A on NEW GAME to enter Professor Oak's intro speech
      tapKey(4, 14, 240);
    }
  }

  /**
   * Fast-forwards the bundled Frogger (USA) GBC ROM (`frogger.gbc`) to:
   * - `'TITLE'`: The iconic Majesco / Hasbro Interactive FROGGER Title Screen (frame 950)
   * - `'MAIN_MENU'`: Past Language Select onto `Start / Options / Password`
   * - `'PLAY_GAME'`: Directly into live Highway & River gameplay!
   */
  fastForwardFroggerBoot(target: 'TITLE' | 'MAIN_MENU' | 'PLAY_GAME' = 'PLAY_GAME'): void {
    if (!this.gb) return;
    const tapKey = (code: number, hold = 15, wait = 180) => {
      this.gb.JoyPadEvent(code, true);
      for (let i = 0; i < hold; i++) this.gb.run();
      this.gb.JoyPadEvent(code, false);
      for (let i = 0; i < wait; i++) this.gb.run();
    };

    if (target === 'TITLE') {
      for (let i = 0; i < 885; i++) this.gb.run();
      return;
    }

    // Advance past Language Select onto Player Select ("SELECT ONE PLAYER / TWO PLAYERS")
    for (let i = 0; i < 1360; i++) this.gb.run();
    tapKey(7, 15, 220);
    tapKey(7, 15, 220);
    tapKey(7, 15, 260);

    if (target === 'MAIN_MENU') {
      return;
    }

    // Press START on ONE PLAYER -> Live Highway & River Level 1
    tapKey(7, 15, 320);
  }

  /**
   * Fast-forwards the bundled Kirby Tilt 'n' Tumble (USA) GBC ROM (`kirby-tilt-n-tumble.gbc`) to:
   * - `'TITLE'`: The official full-color Kirby Tilt 'n' Tumble Title Screen
   * - `'FILE_SELECT'`: The native 3-slot Save File Select screen (`File 1`, `File 2`, `File 3`)
   * - `'LEVEL_SELECT'`: Selected save slot's World / Stage Map (`Level 1 - Stage 1`)
   * - `'PLAY_GAME'`: Directly into live rolling Kirby Stage 1-1 gameplay for that save slot!
   */
  fastForwardKirbyBoot(
    slot = 0,
    target: 'TITLE' | 'FILE_SELECT' | 'LEVEL_SELECT' | 'PLAY_GAME' = 'PLAY_GAME'
  ): void {
    if (!this.gb) return;
    const tapKey = (code: number, hold = 14, wait = 150) => {
      this.gb.JoyPadEvent(code, true);
      for (let i = 0; i < hold; i++) this.gb.run();
      this.gb.JoyPadEvent(code, false);
      for (let i = 0; i < wait; i++) this.gb.run();
    };

    // 1. Dismiss initial patch splash at frame 60 -> opening cloud intro
    for (let i = 0; i < 60; i++) this.gb.run();
    tapKey(4, 12, 820);

    // 2. Skip opening cloud intro -> official Kirby Tilt 'n' Tumble Title Screen
    tapKey(7, 15, 380);

    if (target === 'TITLE') {
      for (let i = 0; i < 1420; i++) this.gb.run();
      return;
    }

    // 3. Press START on the Title Screen -> 3-slot SELECT FILE screen (1 / 2 / 3 / ERASE)
    tapKey(7, 15, 380);

    // Move cursor down to the chosen profile slot (0 = File 1, 1 = File 2, 2 = File 3)
    const clampedSlot = Math.max(0, Math.min(2, slot));
    for (let s = 0; s < clampedSlot; s++) {
      tapKey(3, 12, 60);
    }

    if (target === 'FILE_SELECT') {
      return;
    }

    // 4. Press A on the chosen Save File -> Level 1 World / Stage Map
    tapKey(4, 15, 420);

    if (target === 'LEVEL_SELECT') {
      return;
    }

    // 5. Select Stage 1-1 and confirm calibration prompt -> Live Rolling Kirby Stage 1-1!
    tapKey(4, 15, 550);
    tapKey(4, 15, 550);
  }

  /**
   * Feeds normalized tilt coordinates (`x, y` in `[-1, 1]`) into MBC7 accelerometer registers.
   */
  setTilt(x: number, y: number): void {
    if (!this.gb || typeof this.gb.GyroEvent !== 'function') return;
    this.gb.GyroEvent(x, y);
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

  step(dt: number, input: InputState): void {
    if (!this.gb) return;

    const dpadDirs: ReadonlyArray<GBCButton> = ['up', 'down', 'left', 'right'];
    for (const { btn } of GB_KEY_MAP) {
      if (input.justPressed[btn]) {
        const isDpad = dpadDirs.includes(btn);
        if (isDpad) {
          // Immediately cancel lingering hold on any other D-Pad direction when changing direction
          for (const d of dpadDirs) {
            if (d !== btn && !input.held[d]) {
              this.minHoldSlices[d] = 0;
              this.retriggerGapSlices[d] = 0;
            }
          }
          if (this.prevHeld[btn]) {
            this.retriggerGapSlices[btn] = 3;
          }
          this.minHoldSlices[btn] = 12;
        } else {
          if (this.prevHeld[btn]) {
            this.retriggerGapSlices[btn] = 3;
          }
          this.minHoldSlices[btn] = 8;
        }
      }
    }

    const clampedDt = Math.min(dt, 0.05);
    this.cycleAccum += clampedDt;
    let slices = 0;
    while (this.cycleAccum >= 0.008 && slices < 4) {
      for (const { btn, code } of GB_KEY_MAP) {
        let wantDown = false;
        if (this.retriggerGapSlices[btn] > 0) {
          wantDown = false;
          this.retriggerGapSlices[btn]--;
        } else {
          wantDown = Boolean(input.held[btn] || this.minHoldSlices[btn] > 0);
          if (this.minHoldSlices[btn] > 0) {
            this.minHoldSlices[btn]--;
          }
        }
        if (wantDown !== this.prevHeld[btn]) {
          this.prevHeld[btn] = wantDown;
          this.gb.JoyPadEvent(code, wantDown);
        }
      }
      this.gb.run();
      this.cycleAccum -= 0.008;
      slices++;
    }

    if (this.audio && this.gb) {
      this.audio.syncHardwareAPU(this.gb);
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

  /**
   * Reads live WRAM from a running Gen-1 Pokémon Red/Blue instance and synchronizes it into
   * a valid 32KB SRAM save array (if the player has entered the overworld or loaded a save)
   * so progress is preserved across sessions even before manually opening START -> SAVE!
   */
  extractGen1SramWithLiveSync(): { sram: number[]; summary: Gen1SaveSummary | null } {
    const rawSram = this.extractSram();
    if (!this.gb) {
      return { sram: rawSram, summary: parseGen1SramSummary(rawSram) };
    }

    // Check if SRAM already has a valid in-game save (e.g. player saved via START -> SAVE)
    const existingSramSummary = parseGen1SramSummary(rawSram);

    // Only sync live WRAM into SRAM when the player is actively inside a loaded overworld map
    // (wCurMapHeight at 0xD368 > 0 and wCurMapWidth at 0xD369 > 0), never during MainMenu or OakSpeech!
    const wramName = decodeGen1String(this.gb.memory, 0xd158, 11);
    const saveStatus = this.gb.memory[0xd088] ?? 0;
    const mapHeight = this.gb.memory[0xd368] ?? 0;
    const mapWidth = this.gb.memory[0xd369] ?? 0;

    if (wramName && wramName !== 'NINTEN' && saveStatus >= 1 && mapHeight > 0 && mapWidth > 0) {
      const sram = rawSram.length >= 32768 ? rawSram.slice() : new Array<number>(32768).fill(0);
      const copyToSram = (wramStart: number, wramEnd: number, sramStart: number) => {
        for (let i = 0; i < wramEnd - wramStart; i++) {
          sram[sramStart + i] = this.gb.memory[wramStart + i] & 0xff;
        }
      };
      copyToSram(0xd158, 0xd158 + 11, 0x2598);
      copyToSram(0xd2f7, 0xda80, 0x25a3);
      copyToSram(0xc100, 0xc300, 0x2d2c);
      copyToSram(0xd163, 0xd2f7, 0x2f2c);
      copyToSram(0xda80, 0xdee2, 0x30c0);
      sram[0x3522] = this.gb.memory[0xffd7] & 0xff;

      let sum = 0;
      for (let addr = 0x2598; addr < 0x3523; addr++) {
        sum = (sum + (sram[addr] & 0xff)) & 0xff;
      }
      sram[0x3523] = (~sum) & 0xff;
      return { sram, summary: parseGen1SramSummary(sram) };
    }

    return { sram: rawSram, summary: existingSramSummary };
  }
}

export function buildHardwareTestRom(titleText = 'POKEMON RED'): Uint8Array {
  const rom = new Uint8Array(32768);
  rom[0x0100] = 0x00;
  rom[0x0101] = 0xc3;
  rom[0x0102] = 0x50;
  rom[0x0103] = 0x01;

  for (let i = 0; i < Math.min(15, titleText.length); i++) {
    rom[0x0134 + i] = titleText.charCodeAt(i);
  }
  rom[0x0143] = 0x80;
  rom[0x0147] = 0x03;
  rom[0x0148] = 0x00;
  rom[0x0149] = 0x02;

  let pc = 0x0150;
  const emit = (...bytes: number[]) => {
    for (const b of bytes) rom[pc++] = b;
  };

  emit(0xf3, 0x31, 0xfe, 0xff);
  emit(0xf0, 0x44, 0xfe, 144, 0x38, 0xfa);
  emit(0xaf, 0xe0, 0x40);
  emit(0x21, 0x00, 0x02, 0x11, 0x00, 0x80, 0x06, 64);
  emit(0x2a, 0x12, 0x13, 0x05, 0x20, 0xf9);
  emit(0x21, 0x00, 0x98, 0x0e, 32);
  emit(0x06, 32);
  emit(0x78, 0x81, 0xe6, 0x03, 0x22, 0x05, 0x20, 0xf8);
  emit(0x0d, 0x20, 0xf3);
  emit(0x3e, 0xe4, 0xe0, 0x47);
  emit(0x3e, 0x91, 0xe0, 0x40);
  emit(0xf0, 0x44, 0xfe, 144, 0x20, 0xfa);
  emit(0x18, 0xf8);

  const tileData = [
    0x00, 0x00, 0x18, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x00, 0x18, 0x00, 0x00,
    0x3c, 0x3c, 0x7e, 0x42, 0xff, 0x81, 0xff, 0xff, 0xff, 0x99, 0x7e, 0x00, 0x3c, 0x3c, 0x00, 0x00,
    0xff, 0xff, 0x81, 0x81, 0xbd, 0x81, 0xbd, 0x81, 0xbd, 0x81, 0xbd, 0x81, 0x81, 0x81, 0xff, 0xff,
    0xf0, 0x0f, 0xf0, 0x0f, 0xf0, 0x0f, 0xf0, 0x0f, 0x0f, 0xf0, 0x0f, 0xf0, 0x0f, 0xf0, 0x0f, 0xf0,
  ];
  for (let i = 0; i < tileData.length; i++) {
    rom[0x0200 + i] = tileData[i];
  }
  return rom;
}
