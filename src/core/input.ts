import type { GBCButton, InputState, TiltState } from './types';

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
  private pointerPressTimeMs: Record<GBCButton, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    a: 0,
    b: 0,
    start: 0,
    select: 0,
  };
  private pointerMinHoldUntilMs: Record<GBCButton, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    a: 0,
    b: 0,
    start: 0,
    select: 0,
  };
  private latchedPress: Record<GBCButton, boolean> = this.emptyRecord();
  private prevCombined: Record<GBCButton, boolean> = this.emptyRecord();
  private onButtonChangeCallbacks: Array<(btn: GBCButton, pressed: boolean) => void> = [];
  private onAnyInputCallbacks: Array<() => void> = [];

  // Phone Tilt & Angle Monitoring state (strictly decoupled from D-Pad / arrow keys)
  private tiltEnabled = true;
  private rawRollDeg = 0;
  private rawPitchDeg = 30;
  private baseRollDeg = 0;
  private basePitchDeg = 30;
  private sensorActive = false;
  private orientationReceived = false;
  private flickJumpLatched = false;
  private lastFlickTimeMs = 0;
  private manualTiltActive = false;
  private manualTiltX = 0;
  private manualTiltY = 0;
  private permissionRequested = false;

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
    this.bindTiltSensors();
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
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  private bindTiltSensors(): void {
    if (typeof window === 'undefined') return;

    // Support ?tilt=18,-12 or ?tilt=off / ?tilt=on URL query param for simulator/browser testing
    const params = new URLSearchParams(window.location.search);
    const tiltParam = params.get('tilt')?.trim().toLowerCase();
    if (tiltParam === 'off' || tiltParam === '0' || tiltParam === 'false') {
      this.tiltEnabled = false;
    } else if (tiltParam === 'on' || tiltParam === '1' || tiltParam === 'true') {
      this.tiltEnabled = true;
    } else if (tiltParam) {
      const parts = tiltParam.split(',').map((s) => Number(s.trim()));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        this.tiltEnabled = true;
        const isDegrees = Math.abs(parts[0]) > 1 || Math.abs(parts[1]) > 1;
        const nx = isDegrees ? parts[0] / 28 : parts[0];
        const ny = isDegrees ? parts[1] / 28 : parts[1];
        this.setManualTilt(nx, ny, true);
      }
    }

    window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
      if (typeof e.gamma === 'number' && typeof e.beta === 'number' && (e.gamma !== 0 || e.beta !== 0)) {
        const screenAngle = window.screen?.orientation?.angle ?? 0;
        let roll = e.gamma;
        let pitch = e.beta;
        if (screenAngle === 90) {
          roll = -e.beta;
          pitch = e.gamma;
        } else if (screenAngle === -90 || screenAngle === 270) {
          roll = e.beta;
          pitch = -e.gamma;
        }
        this.rawRollDeg = roll;
        this.rawPitchDeg = pitch;
        this.orientationReceived = true;
        this.sensorActive = true;
      }
    });

    window.addEventListener('devicemotion', (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const ax = acc.x ?? 0;
      const ay = acc.y ?? 0;
      const az = acc.z ?? 0;
      if (ax !== 0 || ay !== 0 || az !== 0) {
        this.sensorActive = true;
        if (!this.orientationReceived) {
          const rollRad = Math.atan2(ax, Math.hypot(ay, az));
          const pitchRad = Math.atan2(-ay, Math.hypot(ax, az));
          this.rawRollDeg = (rollRad * 180) / Math.PI;
          this.rawPitchDeg = (pitchRad * 180) / Math.PI;
        }
        const now = performance.now();
        if (this.tiltEnabled && Math.abs(az) > 14.5 && now - this.lastFlickTimeMs > 280) {
          this.flickJumpLatched = true;
          this.lastFlickTimeMs = now;
        }
      }
    });
  }

  pulseButton(btn: GBCButton, durationMs = 110): void {
    this.setVirtualButton(btn, true);
    window.setTimeout(() => {
      this.setVirtualButton(btn, false);
    }, durationMs);
  }

  isTiltEnabled(): boolean {
    return this.tiltEnabled;
  }

  isSensorReceiving(): boolean {
    return this.sensorActive || this.manualTiltActive;
  }

  setTiltEnabled(enabled: boolean): void {
    this.tiltEnabled = enabled;
    if (enabled) {
      this.calibrateTilt();
      this.requestTiltPermission().catch(() => {});
    } else {
      this.manualTiltActive = false;
      this.manualTiltX = 0;
      this.manualTiltY = 0;
      this.flickJumpLatched = false;
    }
  }

  toggleTiltEnabled(): boolean {
    this.setTiltEnabled(!this.tiltEnabled);
    return this.tiltEnabled;
  }

  calibrateTilt(): void {
    if (this.sensorActive) {
      this.baseRollDeg = this.rawRollDeg;
      this.basePitchDeg = this.rawPitchDeg;
    } else {
      this.baseRollDeg = 0;
      this.basePitchDeg = 30;
    }
  }

  async requestTiltPermission(): Promise<boolean> {
    let granted = true;
    let hadPromptApi = false;
    try {
      const doe = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
      } | undefined;
      if (doe && typeof doe.requestPermission === 'function') {
        hadPromptApi = true;
        const res = await doe.requestPermission();
        if (res === 'granted') {
          this.permissionRequested = true;
        } else {
          granted = false;
        }
      }
    } catch {
      // iOS throws NotAllowedError if called on pointerdown instead of click/touchend;
      // keep permissionRequested = false so the subsequent touchend/click retries!
      granted = false;
    }
    try {
      const dme = (typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : undefined) as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
      } | undefined;
      if (dme && typeof dme.requestPermission === 'function') {
        hadPromptApi = true;
        const res = await dme.requestPermission();
        if (res === 'granted') {
          this.permissionRequested = true;
        } else {
          granted = false;
        }
      }
    } catch {
      granted = false;
    }
    if (!hadPromptApi) {
      this.permissionRequested = true;
    }
    return granted;
  }

  setManualTilt(nx: number, ny: number, active: boolean): void {
    this.manualTiltActive = active;
    if (active) {
      this.manualTiltX = Math.max(-1, Math.min(1, nx));
      this.manualTiltY = Math.max(-1, Math.min(1, ny));
    } else {
      this.manualTiltX = 0;
      this.manualTiltY = 0;
    }
  }

  setVirtualButton(btn: GBCButton, pressed: boolean): void {
    const now = performance.now();
    if (pressed) {
      this.notifyAnyInput();
      this.latchedPress[btn] = true;
      if (!this.pointerHeld[btn]) {
        this.pointerPressTimeMs[btn] = now;
        this.pointerMinHoldUntilMs[btn] = now + 45;
      }
      // If pressing a D-Pad direction, immediately clear any lingering min-hold on released directions
      if (btn === 'up' || btn === 'down' || btn === 'left' || btn === 'right') {
        for (const d of ['up', 'down', 'left', 'right'] as const) {
          if (d !== btn && !this.pointerHeld[d]) {
            this.pointerMinHoldUntilMs[d] = 0;
          }
        }
      }
    } else if (this.pointerHeld[btn]) {
      // If the user held the button for >= 45ms and now released/moved off it, stop immediately (0ms tail)
      if (now - this.pointerPressTimeMs[btn] >= 45) {
        this.pointerMinHoldUntilMs[btn] = 0;
      }
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
    const now = performance.now();

    for (const b of ALL_BUTTONS) {
      const isNowHeld = Boolean(
        this.keyHeld[b] ||
          this.pointerHeld[b] ||
          padHeld[b] ||
          this.latchedPress[b] ||
          now < this.pointerMinHoldUntilMs[b]
      );
      this.latchedPress[b] = false;
      held[b] = isNowHeld;
      justPressed[b] = isNowHeld && !this.prevCombined[b];
      justReleased[b] = !isNowHeld && this.prevCombined[b];
      this.prevCombined[b] = isNowHeld;
    }

    // Tilt is strictly driven by the TILT ON/OFF state + physical sensor (never by arrow keys / D-Pad)
    let x = 0;
    let y = 0;
    let rollDeg = 0;
    let pitchDeg = 0;
    let source: TiltState['source'] = 'idle';

    if (this.tiltEnabled) {
      if (this.manualTiltActive) {
        source = 'sensor';
        x = this.manualTiltX;
        y = this.manualTiltY;
        rollDeg = Math.max(-90, Math.min(90, x * 28));
        pitchDeg = Math.max(-90, Math.min(90, y * 28));
      } else if (this.sensorActive) {
        source = 'sensor';
        rollDeg = Math.max(-90, Math.min(90, this.rawRollDeg - this.baseRollDeg));
        pitchDeg = Math.max(-90, Math.min(90, this.rawPitchDeg - this.basePitchDeg));
        x = Math.max(-1, Math.min(1, rollDeg / 28));
        y = Math.max(-1, Math.min(1, pitchDeg / 28));
      }
    }

    const angleDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const magnitude = Math.min(1, Math.hypot(x, y));
    const flickJump = this.tiltEnabled ? this.flickJumpLatched : false;
    this.flickJumpLatched = false;

    const tilt: TiltState = {
      x,
      y,
      rollDeg,
      pitchDeg,
      angleDeg,
      magnitude,
      flickJump,
      source,
      sensorActive: this.tiltEnabled && (this.sensorActive || this.manualTiltActive),
    };

    return { held, justPressed, justReleased, tilt };
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
