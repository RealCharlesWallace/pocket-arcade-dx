import * as THREE from 'three';
import type { GBCButton } from '../core/types';
import { GameBoyColor3D } from './gbc-model';

const ALL_GBC_BUTTONS: GBCButton[] = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];

export class StageScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private tempCenter = new THREE.Vector3();
  private tempEdge = new THREE.Vector3();

  private gbc: GameBoyColor3D;
  private screenTexture: THREE.CanvasTexture;
  private overlayButtons: Partial<Record<GBCButton, HTMLElement>> = {};
  private gateEl: HTMLElement | null = null;
  private settingsNavEl: HTMLElement | null = null;
  private tiltHudEl: HTMLElement | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  private pointerNormX = 0;
  private pointerNormY = 0;
  private dpadPointerId: number | null = null;
  private dpadInitialBtn: GBCButton | null = null;
  private actionPointerId: number | null = null;
  private hoveredRaycastButton: GBCButton | null = null;
  private zoomedIn = false;
  private deviceTiltX = 0;
  private deviceTiltY = 0;

  private dpadScreenX = 0;
  private dpadScreenY = 0;
  private dpadRadiusPx = 64;
  private btnScreenRects: Partial<Record<GBCButton, { x: number; y: number; w: number; h: number }>> = {};

  private onVirtualButton: (btn: GBCButton, pressed: boolean) => void;
  private onPowerToggle: () => void;
  private onScreenTap?: (gbcX: number, gbcY: number) => void;

  constructor(
    container: HTMLElement,
    screenCanvas: HTMLCanvasElement,
    options: {
      onVirtualButton: (btn: GBCButton, pressed: boolean) => void;
      onPowerToggle: () => void;
      onScreenTap?: (gbcX: number, gbcY: number) => void;
    }
  ) {
    this.container = container;
    this.onVirtualButton = options.onVirtualButton;
    this.onPowerToggle = options.onPowerToggle;
    this.onScreenTap = options.onScreenTap;

    this.gateEl = document.getElementById('gate');
    this.settingsNavEl = document.getElementById('settings-nav');
    this.tiltHudEl = document.getElementById('tilt-hud');

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    this.lastWidth = initW;
    this.lastHeight = initH;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(initW, initH);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      36,
      initW / Math.max(1, initH),
      0.1,
      50
    );
    this.camera.position.set(0, 0.05, 8.5);

    // Crisp nearest-neighbor CanvasTexture for the Game Boy screen
    this.screenTexture = new THREE.CanvasTexture(screenCanvas);
    this.screenTexture.minFilter = THREE.NearestFilter;
    this.screenTexture.magFilter = THREE.NearestFilter;
    this.screenTexture.generateMipmaps = false;
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;

    this.gbc = new GameBoyColor3D(this.screenTexture);
    // Keep the console steady with a subtle fixed 3D angle so 3D button height & bevel depth show without wobbling
    this.gbc.root.rotation.y = -0.05;
    this.gbc.root.rotation.x = 0.02;
    this.scene.add(this.gbc.root);

    for (const btn of ALL_GBC_BUTTONS) {
      const el = document.querySelector<HTMLElement>(`[data-btn="${btn}"]`);
      if (el) {
        this.overlayButtons[btn] = el;
        el.addEventListener('pointerenter', (e) => {
          if (e.pointerType === 'mouse') this.gbc.setButtonHover(btn, true);
        });
        el.addEventListener('pointerleave', () => this.gbc.setButtonHover(btn, false));
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (el.hasPointerCapture(e.pointerId)) {
              el.releasePointerCapture(e.pointerId);
            }
          } catch {
            // Ignore pointer capture release errors
          }
          if (btn === 'up' || btn === 'down' || btn === 'left' || btn === 'right') {
            this.dpadPointerId = e.pointerId;
            this.dpadInitialBtn = btn;
            this.updateDpadFromScreenPoint(e.clientX, e.clientY, btn);
          } else {
            this.actionPointerId = e.pointerId;
            this.updateActionFromScreenPoint(e.clientX, e.clientY, btn);
          }
        });
      }
    }

    this.setupLighting();
    this.bindEvents(container);
    this.updateCameraFraming(true);
    this.applyUrlDebugPress();
  }

  private syncViewportSize(): void {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width || this.container.clientWidth || window.innerWidth);
    const h = Math.round(vv?.height || this.container.clientHeight || window.innerHeight);
    if (w <= 0 || h <= 0) return;
    if (w !== this.lastWidth || h !== this.lastHeight) {
      const prevAspect = this.lastWidth / Math.max(1, this.lastHeight);
      const nextAspect = w / h;
      this.lastWidth = w;
      this.lastHeight = h;
      this.camera.aspect = nextAspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(w, h);
      if (Math.abs(nextAspect - prevAspect) > 0.08) {
        this.updateCameraFraming(true);
      }
    }
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xd4deea, 0.72);
    this.scene.add(ambient);

    // Strong top-left key light for specular bevel highlights and 3D button shadows
    const keyLight = new THREE.DirectionalLight(0xfff9ee, 2.35);
    keyLight.position.set(-3.2, 5.8, 6.2);
    this.scene.add(keyLight);

    // Bright right-side rim light to sculpt the 3D right side bevel, 5 grip ribs, seam groove, and power switch
    const rightSideRim = new THREE.DirectionalLight(0x74f2f2, 2.1);
    rightSideRim.position.set(5.5, 1.8, 2.2);
    this.scene.add(rightSideRim);

    // Left kick light for balanced 3D contour
    const leftRim = new THREE.DirectionalLight(0x46b8b8, 1.05);
    leftRim.position.set(-5.0, -1.5, -2.5);
    this.scene.add(leftRim);

    // Bottom fill to highlight curved bottom chin and speaker grille perforations
    const bottomFill = new THREE.DirectionalLight(0xb8b4a8, 0.65);
    bottomFill.position.set(0.5, -5.5, 3.5);
    this.scene.add(bottomFill);
  }

  private applyUrlDebugPress(): void {
    const params = new URLSearchParams(window.location.search);
    const pressParam = params.get('press')?.toLowerCase();
    if (!pressParam) return;
    setTimeout(() => {
      if (pressParam === 'upright') {
        this.onVirtualButton('up', true);
        this.onVirtualButton('right', true);
        this.gbc.setDpadSlideVector(0.75, -0.75);
      } else if (pressParam === 'downleft') {
        this.onVirtualButton('down', true);
        this.onVirtualButton('left', true);
        this.gbc.setDpadSlideVector(-0.75, 0.75);
      } else if (ALL_GBC_BUTTONS.includes(pressParam as GBCButton)) {
        this.onVirtualButton(pressParam as GBCButton, true);
      }
    }, 350);
  }

  private updateDpadFromScreenPoint(
    clientX: number,
    clientY: number,
    initialBtn?: GBCButton
  ): void {
    if (initialBtn) {
      this.dpadInitialBtn = initialBtn;
    }

    const dx = clientX - this.dpadScreenX;
    const dy = clientY - this.dpadScreenY;
    const dist = Math.hypot(dx, dy);
    const rad = Math.max(28, this.dpadRadiusPx);

    // If the user's finger slides off the D-Pad arrows onto the shell/screen, cleanly release!
    if (dist > rad * 1.42) {
      this.dpadInitialBtn = null;
      this.releaseDpadButtons();
      return;
    }

    const activeInitial = this.dpadInitialBtn;
    if (dist < rad * 0.08 && !activeInitial) {
      this.gbc.setDpadSlideVector(0, 0);
      this.onVirtualButton('up', false);
      this.onVirtualButton('down', false);
      this.onVirtualButton('left', false);
      this.onVirtualButton('right', false);
      return;
    }

    let ux = dist > 1 ? dx / dist : 0;
    let uy = dist > 1 ? dy / dist : 0;
    if (dist < rad * 0.28 && activeInitial) {
      ux = activeInitial === 'right' ? 1 : activeInitial === 'left' ? -1 : 0;
      uy = activeInitial === 'down' ? 1 : activeInitial === 'up' ? -1 : 0;
    } else if (dist >= rad * 0.28) {
      this.dpadInitialBtn = null;
    }

    const mag = Math.min(1, Math.max(0.65, dist / (rad * 0.80)));
    this.gbc.setDpadSlideVector(ux * mag, uy * mag);

    // Responsive 4-cardinal + 45-degree corner diagonal sector detection
    // 0.56 (~34 deg) gives each cardinal arrow (UP/DOWN/LEFT/RIGHT) a wide 68-degree pure zone
    // so slightly off-center thumb presses never accidentally trigger perpendicular directions
    const diagThreshold = 0.56;
    this.onVirtualButton('up', uy < -diagThreshold);
    this.onVirtualButton('down', uy > diagThreshold);
    this.onVirtualButton('left', ux < -diagThreshold);
    this.onVirtualButton('right', ux > diagThreshold);
  }

  private clearAllHovers(): void {
    for (const b of ALL_GBC_BUTTONS) {
      this.gbc.setButtonHover(b, false);
    }
    this.hoveredRaycastButton = null;
  }

  private releaseDpadButtons(): void {
    this.dpadInitialBtn = null;
    this.gbc.setDpadSlideVector(0, 0);
    this.onVirtualButton('up', false);
    this.onVirtualButton('down', false);
    this.onVirtualButton('left', false);
    this.onVirtualButton('right', false);
    this.clearAllHovers();
  }

  private updateActionFromScreenPoint(
    clientX: number,
    clientY: number,
    fallbackBtn?: GBCButton
  ): void {
    const actionBtns: Array<'a' | 'b' | 'select' | 'start'> = ['a', 'b', 'select', 'start'];
    let anyMatched = false;

    for (const btn of actionBtns) {
      const rect = this.btnScreenRects[btn];
      if (!rect) continue;
      const dx = clientX - rect.x;
      const dy = clientY - rect.y;
      const isPill = btn === 'select' || btn === 'start';
      const rx = Math.max(isPill ? 28 : 26, rect.w * 0.72);
      const ry = Math.max(isPill ? 24 : 26, rect.h * 0.72);
      const normDist = Math.hypot(dx / rx, dy / ry);
      const isHit = normDist <= 1.08;
      if (isHit) {
        anyMatched = true;
        this.onVirtualButton(btn, true);
        if (btn === 'a' || btn === 'b') {
          this.gbc.setActionButtonTilt(btn, dx / rx, dy / ry);
        }
      } else {
        this.onVirtualButton(btn, false);
        if (btn === 'a' || btn === 'b') {
          this.gbc.setActionButtonTilt(btn, 0, 0);
        }
      }
    }

    if (!anyMatched && fallbackBtn && actionBtns.includes(fallbackBtn as 'a' | 'b' | 'select' | 'start')) {
      this.onVirtualButton(fallbackBtn, true);
    }
  }

  private releaseActionButtons(): void {
    this.gbc.setActionButtonTilt('a', 0, 0);
    this.gbc.setActionButtonTilt('b', 0, 0);
    this.onVirtualButton('a', false);
    this.onVirtualButton('b', false);
    this.onVirtualButton('select', false);
    this.onVirtualButton('start', false);
    this.clearAllHovers();
  }

  private bindEvents(container: HTMLElement): void {
    window.addEventListener('resize', () => this.syncViewportSize());
    window.visualViewport?.addEventListener('resize', () => this.syncViewportSize());
    window.visualViewport?.addEventListener('scroll', () => this.syncViewportSize());
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.syncViewportSize());
      ro.observe(container);
    }

    window.addEventListener('pointermove', (e) => {
      if (this.dpadPointerId !== null && e.pointerId === this.dpadPointerId) {
        this.updateDpadFromScreenPoint(e.clientX, e.clientY);
      }
      if (this.actionPointerId !== null && e.pointerId === this.actionPointerId) {
        this.updateActionFromScreenPoint(e.clientX, e.clientY);
      }

      if (e.pointerType !== 'mouse') return;

      const rect = container.getBoundingClientRect();
      this.pointerNormX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      this.pointerNormY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;

      this.pointer.x = this.pointerNormX;
      this.pointer.y = this.pointerNormY;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.gbc.interactiveMeshes, false);
      container.style.cursor = hits.length > 0 ? 'pointer' : 'default';

      const hitCtrl = hits.length > 0 ? (hits[0].object.userData.control as string | undefined) : undefined;
      const nextHoverBtn =
        hitCtrl && hitCtrl !== 'power' && hitCtrl !== 'screen' ? (hitCtrl as GBCButton) : null;
      if (this.hoveredRaycastButton !== nextHoverBtn) {
        if (this.hoveredRaycastButton) this.gbc.setButtonHover(this.hoveredRaycastButton, false);
        if (nextHoverBtn) this.gbc.setButtonHover(nextHoverBtn, true);
        this.hoveredRaycastButton = nextHoverBtn;
      }
    });

    container.addEventListener('pointerdown', (e) => {
      // Check if pointer started anywhere inside the D-Pad circular zone (including diagonal corners!)
      const dpadDist = Math.hypot(e.clientX - this.dpadScreenX, e.clientY - this.dpadScreenY);
      if (dpadDist <= this.dpadRadiusPx * 1.32) {
        this.dpadPointerId = e.pointerId;
        this.updateDpadFromScreenPoint(e.clientX, e.clientY);
        return;
      }

      // Check if pointer started inside any Action Button zone (A, B, SELECT, START) including label padding
      const actionBtns: Array<'a' | 'b' | 'select' | 'start'> = ['a', 'b', 'select', 'start'];
      for (const btn of actionBtns) {
        const bRect = this.btnScreenRects[btn];
        if (!bRect) continue;
        const isPill = btn === 'select' || btn === 'start';
        const rx = Math.max(isPill ? 28 : 26, bRect.w * 0.72);
        const ry = Math.max(isPill ? 24 : 26, bRect.h * 0.72);
        if (Math.hypot((e.clientX - bRect.x) / rx, (e.clientY - bRect.y) / ry) <= 1.08) {
          this.actionPointerId = e.pointerId;
          this.updateActionFromScreenPoint(e.clientX, e.clientY, btn);
          return;
        }
      }

      const rect = container.getBoundingClientRect();
      this.pointerNormX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      this.pointerNormY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      this.pointer.x = this.pointerNormX;
      this.pointer.y = this.pointerNormY;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.gbc.interactiveMeshes, false);
      if (hits.length > 0) {
        const ctrl = hits[0].object.userData.control as string | undefined;
        if (ctrl === 'power') {
          this.onPowerToggle();
        } else if (ctrl === 'screen') {
          const uv = hits[0].uv;
          const gbcX = Math.max(0, Math.min(159, Math.round((uv?.x ?? 0.5) * 160)));
          const gbcY = Math.max(0, Math.min(143, Math.round((1 - (uv?.y ?? 0.5)) * 144)));
          if (this.onScreenTap) {
            this.onScreenTap(gbcX, gbcY);
          } else {
            this.onPowerToggle();
          }
        } else if (ctrl === 'up' || ctrl === 'down' || ctrl === 'left' || ctrl === 'right') {
          this.dpadPointerId = e.pointerId;
          this.dpadInitialBtn = ctrl;
          this.updateDpadFromScreenPoint(e.clientX, e.clientY, ctrl);
        } else if (ctrl) {
          const btn = ctrl as GBCButton;
          this.actionPointerId = e.pointerId;
          this.updateActionFromScreenPoint(e.clientX, e.clientY, btn);
        }
      }
    });

    const handlePointerEnd = (e: PointerEvent) => {
      if (this.dpadPointerId !== null && e.pointerId === this.dpadPointerId) {
        this.dpadPointerId = null;
        this.releaseDpadButtons();
      }
      if (this.actionPointerId !== null && e.pointerId === this.actionPointerId) {
        this.actionPointerId = null;
        this.releaseActionButtons();
      }
      if (e.pointerType !== 'mouse') {
        this.clearAllHovers();
      }
    };

    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    document.addEventListener('pointerleave', handlePointerEnd);

    // Belt-and-suspenders touch-end cleanup for iOS Safari edge gestures
    const handleTouchAllEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (this.dpadPointerId !== null) {
          this.dpadPointerId = null;
          this.releaseDpadButtons();
        }
        if (this.actionPointerId !== null) {
          this.actionPointerId = null;
          this.releaseActionButtons();
        }
        this.clearAllHovers();
      }
    };
    window.addEventListener('touchend', handleTouchAllEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchAllEnd, { passive: true });
  }

  getModel(): GameBoyColor3D {
    return this.gbc;
  }

  setZoomedIn(zoom: boolean): void {
    this.zoomedIn = zoom;
  }

  isZoomedIn(): boolean {
    return this.zoomedIn;
  }

  setDeviceTilt(tx: number, ty: number): void {
    this.deviceTiltX = Math.max(-1, Math.min(1, tx));
    this.deviceTiltY = Math.max(-1, Math.min(1, ty));
  }

  private updateCameraFraming(instant = false): void {
    const aspect = Math.max(0.35, this.camera.aspect);
    const isNarrow = aspect < 0.85;

    this.gbc.setMobileFullBleed(isNarrow, 3.06 / aspect + 0.65);

    // Tight, close framing so the Game Boy fills the viewport with no wasted space around it
    let targetX = isNarrow ? 0.01 : 0.04;
    let targetY = isNarrow ? -0.08 : 0.02;
    let targetZ = isNarrow ? 0.44 + 4.70 / aspect : Math.max(8.0, 4.90 / aspect);

    if (this.zoomedIn) {
      targetX = isNarrow ? 0.05 : 0.08;
      targetY = isNarrow ? 1.18 : 1.26;
      targetZ = isNarrow ? 0.44 + 3.45 / aspect : Math.max(3.85, 3.55 / aspect);
    }

    if (instant) {
      this.camera.position.set(targetX, targetY, targetZ);
      this.camera.lookAt(targetX, targetY, 0);
    } else {
      this.camera.position.x += (targetX - this.camera.position.x) * 0.12;
      this.camera.position.y += (targetY - this.camera.position.y) * 0.12;
      this.camera.position.z += (targetZ - this.camera.position.z) * 0.12;
      this.camera.lookAt(this.camera.position.x, isNarrow ? this.camera.position.y : this.camera.position.y * 0.96, 0);
    }
  }

  private syncOverlayButtonPositions(): void {
    const cw = this.lastWidth;
    const ch = this.lastHeight;
    if (cw <= 0 || ch <= 0) return;

    this.gbc.root.updateWorldMatrix(true, true);
    this.camera.updateMatrixWorld();

    // Anchor #settings-nav high in the upper-left corner of the 3D Game Boy shell (clear of the LCD screen)
    if (this.settingsNavEl) {
      this.tempCenter.set(-1.54, 2.86, 0.44);
      this.gbc.root.localToWorld(this.tempCenter);
      this.tempCenter.project(this.camera);
      const rawX = (this.tempCenter.x * 0.5 + 0.5) * cw;
      const rawY = (-this.tempCenter.y * 0.5 + 0.5) * ch;
      const clampedX = Math.max(6, Math.min(cw - 120, rawX));
      const clampedY = Math.max(4, Math.min(28, rawY));
      this.settingsNavEl.style.left = `${clampedX.toFixed(1)}px`;
      this.settingsNavEl.style.top = `${clampedY.toFixed(1)}px`;
    }

    // Anchor #tilt-hud high in the upper-right corner of the 3D Game Boy shell (symmetric with #settings-nav)
    if (this.tiltHudEl) {
      this.tempCenter.set(1.54, 2.86, 0.44);
      this.gbc.root.localToWorld(this.tempCenter);
      this.tempCenter.project(this.camera);
      const rawX = (this.tempCenter.x * 0.5 + 0.5) * cw;
      const rawY = (-this.tempCenter.y * 0.5 + 0.5) * ch;
      const clampedRight = Math.max(6, Math.min(cw - 120, cw - rawX));
      const clampedY = Math.max(4, Math.min(28, rawY));
      this.tiltHudEl.style.right = `${clampedRight.toFixed(1)}px`;
      this.tiltHudEl.style.left = 'auto';
      this.tiltHudEl.style.top = `${clampedY.toFixed(1)}px`;
    }

    // Compute exact screen-space center & radius of the 3D D-Pad for 360-degree angle sliding
    this.tempCenter.set(0, 0, 0.08);
    this.tempEdge.set(0.48, 0, 0.08);
    this.gbc.dpadGroup.localToWorld(this.tempCenter);
    this.gbc.dpadGroup.localToWorld(this.tempEdge);
    this.tempCenter.project(this.camera);
    this.tempEdge.project(this.camera);
    this.dpadScreenX = (this.tempCenter.x * 0.5 + 0.5) * cw;
    this.dpadScreenY = (-this.tempCenter.y * 0.5 + 0.5) * ch;
    const edgeScreenX = (this.tempEdge.x * 0.5 + 0.5) * cw;
    const edgeScreenY = (-this.tempEdge.y * 0.5 + 0.5) * ch;
    this.dpadRadiusPx = Math.max(32, Math.hypot(edgeScreenX - this.dpadScreenX, edgeScreenY - this.dpadScreenY));

    // Center the #gate Power-On card directly inside the enlarged 3D LCD screen
    if (this.gateEl && !this.gateEl.hasAttribute('hidden') && this.gbc.lcdMesh) {
      this.tempCenter.set(-1.08, -0.96, 0.01);
      this.tempEdge.set(1.08, 0.96, 0.01);
      this.gbc.lcdMesh.localToWorld(this.tempCenter);
      this.gbc.lcdMesh.localToWorld(this.tempEdge);
      this.tempCenter.project(this.camera);
      this.tempEdge.project(this.camera);

      const lcdX = ((this.tempCenter.x + this.tempEdge.x) * 0.25 + 0.5) * cw;
      const lcdY = (-(this.tempCenter.y + this.tempEdge.y) * 0.25 + 0.5) * ch;
      const lcdW = Math.abs(this.tempEdge.x - this.tempCenter.x) * 0.5 * cw;
      this.gateEl.style.left = `${lcdX.toFixed(1)}px`;
      this.gateEl.style.top = `${lcdY.toFixed(1)}px`;
      this.gateEl.style.width = `${Math.min(290, Math.max(176, lcdW * 0.92)).toFixed(1)}px`;
    }

    for (const btn of ALL_GBC_BUTTONS) {
      const el = this.overlayButtons[btn];
      const mesh = this.gbc.buttonMeshes[btn];
      const sz = this.gbc.buttonSizes[btn];
      if (!el || !mesh || !sz) continue;

      // Project exact local front-face corners (-w/2, -h/2, zFront) and (+w/2, +h/2, zFront)
      this.tempCenter.set(-sz.w * 0.5, -sz.h * 0.5, sz.zFront);
      this.tempEdge.set(sz.w * 0.5, sz.h * 0.5, sz.zFront);
      mesh.localToWorld(this.tempCenter);
      mesh.localToWorld(this.tempEdge);

      this.tempCenter.project(this.camera);
      this.tempEdge.project(this.camera);

      const screenX = ((this.tempCenter.x + this.tempEdge.x) * 0.25 + 0.5) * cw;
      const rawScreenY = (-(this.tempCenter.y + this.tempEdge.y) * 0.25 + 0.5) * ch;
      const rawPxW = Math.abs(this.tempEdge.x - this.tempCenter.x) * 0.5 * cw;
      const rawPxH = Math.abs(this.tempEdge.y - this.tempCenter.y) * 0.5 * ch;

      const isPill = btn === 'select' || btn === 'start';
      const isActionRound = btn === 'a' || btn === 'b';
      const isDpadArrow = btn === 'up' || btn === 'down' || btn === 'left' || btn === 'right';
      const dpadOffsetX = btn === 'left' ? -6 : btn === 'right' ? 6 : 0;
      const dpadOffsetY = btn === 'up' ? -6 : btn === 'down' ? 6 : 0;
      const adjScreenX = screenX + dpadOffsetX;
      const screenY = isPill ? rawScreenY + 4 : rawScreenY + dpadOffsetY;
      const pxW = isPill
        ? Math.max(54, rawPxW)
        : isActionRound
          ? Math.max(52, rawPxW)
          : isDpadArrow
            ? Math.max(46, rawPxW)
            : rawPxW;
      const pxH = isPill
        ? Math.max(44, rawPxH)
        : isActionRound
          ? Math.max(52, rawPxH)
          : isDpadArrow
            ? Math.max(46, rawPxH)
            : rawPxH;
      this.btnScreenRects[btn] = { x: adjScreenX, y: screenY, w: pxW, h: pxH };

      const inViewport = screenY > 10 && screenY < ch - 12 && adjScreenX > 4 && adjScreenX < cw - 4;
      el.style.left = `${adjScreenX.toFixed(1)}px`;
      el.style.top = `${screenY.toFixed(1)}px`;
      el.style.width = `${pxW.toFixed(1)}px`;
      el.style.height = `${pxH.toFixed(1)}px`;
      el.style.opacity = inViewport ? '1' : '0';
      el.style.pointerEvents = inViewport ? 'auto' : 'none';
      el.classList.toggle('is-pressed', this.gbc.isButtonPressed(btn));
    }
  }

  render(dt: number, _time: number): void {
    this.syncViewportSize();
    this.updateCameraFraming(false);

    const isNarrow = this.camera.aspect < 0.85;
    const baseRotY = this.zoomedIn ? -0.02 : isNarrow ? -0.04 : -0.12;
    const baseRotX = this.zoomedIn ? 0.01 : isNarrow ? 0.015 : 0.03;
    const targetRotY = baseRotY + this.deviceTiltX * 0.09;
    const targetRotX = baseRotX + this.deviceTiltY * 0.09;

    this.gbc.root.rotation.y += (targetRotY - this.gbc.root.rotation.y) * Math.min(1, dt * 8);
    this.gbc.root.rotation.x += (targetRotX - this.gbc.root.rotation.x) * Math.min(1, dt * 8);

    this.gbc.update(dt);
    this.syncOverlayButtonPositions();
    this.screenTexture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
