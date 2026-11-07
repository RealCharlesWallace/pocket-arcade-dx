import type { ChiptuneSynth } from './audio';
import type { CartridgeStorage } from './storage';

export type GBCButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

export interface InputState {
  held: Record<GBCButton, boolean>;
  justPressed: Record<GBCButton, boolean>;
  justReleased: Record<GBCButton, boolean>;
}

export interface GameContext {
  /** Native Game Boy Color logical width (160) */
  width: number;
  /** Native Game Boy Color logical height (144) */
  height: number;
  audio: ChiptuneSynth;
  storage: CartridgeStorage;
  exitToMenu: () => void;
  openRomFilePicker: () => void;
}

export interface GameCartridge {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  description: string;
  cartridgeColor: string;
  labelColor: string;
  accentColor: string;
  renderPreviewIcon: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    time: number
  ) => void;
  init: (context: GameContext) => void;
  update: (dt: number, input: InputState) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
  cleanup?: () => void;
  onRomLoaded?: (name: string, bytes: Uint8Array) => void;
}

export interface ShellTheme {
  id: string;
  name: string;
  color: number;
  cssHex: string;
  roughness: number;
  transmission?: number;
  opacity?: number;
}
