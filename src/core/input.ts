import type { GBCButton, InputState } from './types';

const ALL_BUTTONS: GBCButton[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

const KEY_MAP: Record<string, GBCButton> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyP: 'a',
  KeyZ: 'a',
  Enter: 'a',
  KeyL: 'b',
  KeyX: 'b',
  Backspace: 'b',
  Space: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
};

export class InputManager {
  private keyHeld: Record<GBCButton, boolean> = this.emptyRecord();
  private pointerHeld: Record<GBCButton, boolean> = this.emptyRecord();
  private latchedPress: Record<GBCButton, boolean> = this.emptyRecord();
  private prevCombined: Record<GBCButton, boolean> = this.emptyRecord();
  private onButtonChangeCallbacks: Array<(btn: GBCButton, pressed: boolean) => void> = [];
  private onAnyInputCallbacks: Array<() => void> = [];

  constructor() {
    window.addEventListener('keydown', (e) => {
      // Ignore keyboard shortcuts when a modal dialog is open
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog) return;

      this.notifyAnyInput();
      const mapped = KEY_MAP[e.code];
      if (!mapped) return;

      // Prevent browser scrolling or accidental button activation for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace', 'Enter'].includes(e.code)) {
        e.preventDefault();
      }

      if (!this.keyHeld[mapped]) {
        this.keyHeld[mapped] = true;
        this.latchedPress[mapped] = true;
        this.emitButtonChange(mapped, true);
      }
    });

    window.addEventListener('keyup', (e) => {
      const mapped = KEY_MAP[e.code];
      if (!mapped) return;
      if (this.keyHeld[mapped]) {
        this.keyHeld[mapped] = false;
        this.emitButtonChange(mapped, this.pointerHeld[mapped]);
      }
    });

    window.addEventListener('blur', () => {
      for (const b of ALL_BUTTONS) {
        this.keyHeld[b] = false;
        this.pointerHeld[b] = false;
        this.emitButtonChange(b, false);
      }
    });

    this.bindTouchOverlayButtons();
  }

  private emptyRecord(): Record<GBCButton, boolean> {
    return {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      start: false,
      select: false,
    };
  }

  private bindTouchOverlayButtons(): void {
    const buttons = document.querySelectorAll<HTMLElement>('[data-btn]');
    buttons.forEach((el) => {
      const btn = el.dataset.btn as GBCButton | undefined;
      if (!btn) return;

      const press = (e: Event) => {
        e.preventDefault();
        this.notifyAnyInput();
        this.setVirtualButton(btn, true);
      };
      const release = (e: Event) => {
        e.preventDefault();
        this.setVirtualButton(btn, false);
      };

      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('pointercancel', release);
    });
  }

  setVirtualButton(btn: GBCButton, pressed: boolean): void {
    if (pressed) {
      this.notifyAnyInput();
      this.latchedPress[btn] = true;
    }
    if (this.pointerHeld[btn] !== pressed) {
      this.pointerHeld[btn] = pressed;
      this.emitButtonChange(btn, pressed || this.keyHeld[btn]);
    }
  }

  onButtonChange(cb: (btn: GBCButton, pressed: boolean) => void): void {
    this.onButtonChangeCallbacks.push(cb);
  }

  onAnyInput(cb: () => void): void {
    this.onAnyInputCallbacks.push(cb);
  }

  private notifyAnyInput(): void {
    for (const cb of this.onAnyInputCallbacks) cb();
  }

  private emitButtonChange(btn: GBCButton, pressed: boolean): void {
    for (const cb of this.onButtonChangeCallbacks) {
      cb(btn, pressed);
    }
  }

  poll(): InputState {
    const held = this.emptyRecord();
    const justPressed = this.emptyRecord();
    const justReleased = this.emptyRecord();

    // Optional HTML5 Gamepad poll
    const padHeld = this.pollGamepad();

    for (const b of ALL_BUTTONS) {
      const isNowHeld = Boolean(this.keyHeld[b] || this.pointerHeld[b] || padHeld[b] || this.latchedPress[b]);
      this.latchedPress[b] = false;
      held[b] = isNowHeld;
      justPressed[b] = isNowHeld && !this.prevCombined[b];
      justReleased[b] = !isNowHeld && this.prevCombined[b];
      this.prevCombined[b] = isNowHeld;
    }

    return { held, justPressed, justReleased };
  }

  private pollGamepad(): Record<GBCButton, boolean> {
    const res = this.emptyRecord();
    if (!navigator.getGamepads) return res;
    const pads = navigator.getGamepads();
    const pad = pads?.[0];
    if (!pad) return res;

    if (pad.buttons[12]?.pressed || (pad.axes[1] ?? 0) < -0.45) res.up = true;
    if (pad.buttons[13]?.pressed || (pad.axes[1] ?? 0) > 0.45) res.down = true;
    if (pad.buttons[14]?.pressed || (pad.axes[0] ?? 0) < -0.45) res.left = true;
    if (pad.buttons[15]?.pressed || (pad.axes[0] ?? 0) > 0.45) res.right = true;
    if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) res.a = true;
    if (pad.buttons[2]?.pressed || pad.buttons[3]?.pressed) res.b = true;
    if (pad.buttons[9]?.pressed) res.start = true;
    if (pad.buttons[8]?.pressed) res.select = true;
    return res;
  }
}
