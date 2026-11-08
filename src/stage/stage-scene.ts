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
  private lastWidth = 0;
  private lastHeight = 0;

  private pointerNormX = 0;
  private pointerNormY = 0;
  private activeRaycastButton: GBCButton | null = null;
  private hoveredRaycastButton: GBCButton | null = null;
  private zoomedIn = false;

  private onVirtualButton: (btn: GBCButton, pressed: boolean) => void;
  private onPowerToggle: () => void;

  constructor(
    container: HTMLElement,
    screenCanvas: HTMLCanvasElement,
    options: {
      onVirtualButton: (btn: GBCButton, pressed: boolean) => void;
      onPowerToggle: () => void;
    }
  ) {
    this.container = container;
    this.onVirtualButton = options.onVirtualButton;
    this.onPowerToggle = options.onPowerToggle;

    this.gateEl = document.getElementById('gate');
    this.settingsNavEl = document.getElementById('settings-nav');

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
        el.addEventListener('pointerenter', () => this.gbc.setButtonHover(btn, true));
        el.addEventListener('pointerleave', () => this.gbc.setButtonHover(btn, false));
      }
    }

    this.setupLighting();
    this.bindEvents(container);
    this.updateCameraFraming(true);
  }

  private syncViewportSize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
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
      if (Math.abs(nextAspect - prevAspect) > 0.15) {
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

  private bindEvents(container: HTMLElement): void {
    window.addEventListener('resize', () => this.syncViewportSize());
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.syncViewportSize());
      ro.observe(container);
    }

    container.addEventListener('pointermove', (e) => {
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
      const rect = container.getBoundingClientRect();
      this.pointerNormX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      this.pointerNormY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      this.pointer.x = this.pointerNormX;
      this.pointer.y = this.pointerNormY;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.gbc.interactiveMeshes, false);
      if (hits.length > 0) {
        const ctrl = hits[0].object.userData.control as string | undefined;
        if (ctrl === 'power' || ctrl === 'screen') {
          this.onPowerToggle();
        } else if (ctrl) {
          const btn = ctrl as GBCButton;
          this.activeRaycastButton = btn;
          this.onVirtualButton(btn, true);
        }
      }
    });

    const releaseRaycastButton = () => {
      if (this.activeRaycastButton) {
        this.onVirtualButton(this.activeRaycastButton, false);
        this.activeRaycastButton = null;
      }
    };

    window.addEventListener('pointerup', releaseRaycastButton);
    window.addEventListener('pointercancel', releaseRaycastButton);
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

    // Anchor #settings-nav to the upper-left corner of the 3D Game Boy shell (above the screen bezel)
    if (this.settingsNavEl) {
      this.tempCenter.set(-1.46, 2.68, 0.44);
      this.gbc.root.localToWorld(this.tempCenter);
      this.tempCenter.project(this.camera);
      const rawX = (this.tempCenter.x * 0.5 + 0.5) * cw;
      const rawY = (-this.tempCenter.y * 0.5 + 0.5) * ch;
      const clampedX = Math.max(8, Math.min(cw - 130, rawX));
      const clampedY = Math.max(6, Math.min(ch - 60, rawY));
      this.settingsNavEl.style.left = `${clampedX.toFixed(1)}px`;
      this.settingsNavEl.style.top = `${clampedY.toFixed(1)}px`;
    }

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
      const screenY = (-(this.tempCenter.y + this.tempEdge.y) * 0.25 + 0.5) * ch;
      const pxW = Math.abs(this.tempEdge.x - this.tempCenter.x) * 0.5 * cw;
      const pxH = Math.abs(this.tempEdge.y - this.tempCenter.y) * 0.5 * ch;

      const inViewport = screenY > 10 && screenY < ch - 12 && screenX > 4 && screenX < cw - 4;
      el.style.left = `${screenX.toFixed(1)}px`;
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
    // Keep the console stationary (no continuous wobble); only the 3D buttons move/tilt/depress
    const targetRotY = this.zoomedIn ? -0.02 : isNarrow ? -0.04 : -0.12;
    const targetRotX = this.zoomedIn ? 0.01 : isNarrow ? 0.015 : 0.03;

    this.gbc.root.rotation.y += (targetRotY - this.gbc.root.rotation.y) * Math.min(1, dt * 8);
    this.gbc.root.rotation.x += (targetRotX - this.gbc.root.rotation.x) * Math.min(1, dt * 8);

    this.gbc.update(dt);
    this.syncOverlayButtonPositions();
    this.screenTexture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
