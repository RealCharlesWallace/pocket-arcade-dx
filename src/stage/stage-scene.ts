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
  private lastWidth = 0;
  private lastHeight = 0;

  private pointerNormX = 0;
  private pointerNormY = 0;
  private activeRaycastButton: GBCButton | null = null;
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

    for (const btn of ALL_GBC_BUTTONS) {
      const el = document.querySelector<HTMLElement>(`[data-btn="${btn}"]`);
      if (el) this.overlayButtons[btn] = el;
    }
    this.gateEl = document.getElementById('gate');

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
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      36,
      initW / Math.max(1, initH),
      0.1,
      50
    );
    this.camera.position.set(0, 0.15, 9.2);

    // Crisp nearest-neighbor CanvasTexture for the Game Boy screen
    this.screenTexture = new THREE.CanvasTexture(screenCanvas);
    this.screenTexture.minFilter = THREE.NearestFilter;
    this.screenTexture.magFilter = THREE.NearestFilter;
    this.screenTexture.generateMipmaps = false;
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;

    this.gbc = new GameBoyColor3D(this.screenTexture);
    this.scene.add(this.gbc.root);

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
    const ambient = new THREE.AmbientLight(0xd8e0e8, 0.85);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff8ec, 2.1);
    keyLight.position.set(3.5, 5.5, 6.0);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x46b8b8, 1.15);
    rimLight.position.set(-4.5, 2.5, -3.5);
    this.scene.add(rimLight);

    const bottomFill = new THREE.DirectionalLight(0x9a9a90, 0.55);
    bottomFill.position.set(0, -5, 3);
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
      this.pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNormY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.pointer.x = this.pointerNormX;
      this.pointer.y = this.pointerNormY;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.gbc.interactiveMeshes, false);
      container.style.cursor = hits.length > 0 ? 'pointer' : 'default';
    });

    container.addEventListener('pointerdown', (e) => {
      const rect = container.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

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

    let targetX = 0;
    let targetY = isNarrow ? 0.14 : 0.08;
    let targetZ = isNarrow ? 0.41 + 6.0 / aspect : Math.max(8.7, 5.15 / aspect);

    if (this.zoomedIn) {
      targetX = isNarrow ? 0.05 : 0.08;
      targetY = isNarrow ? 0.92 : 1.22;
      targetZ = isNarrow ? Math.max(3.95, 4.35 / aspect) : Math.max(3.95, 3.65 / aspect);
    }

    if (instant) {
      this.camera.position.set(targetX, targetY, targetZ);
      this.camera.lookAt(targetX, targetY * 0.95, 0);
    } else {
      this.camera.position.x += (targetX - this.camera.position.x) * 0.12;
      this.camera.position.y += (targetY - this.camera.position.y) * 0.12;
      this.camera.position.z += (targetZ - this.camera.position.z) * 0.12;
      this.camera.lookAt(this.camera.position.x, this.camera.position.y * 0.95, 0);
    }
  }

  private syncOverlayButtonPositions(): void {
    const cw = this.lastWidth;
    const ch = this.lastHeight;
    if (cw <= 0 || ch <= 0) return;

    this.gbc.root.updateWorldMatrix(true, true);
    this.camera.updateMatrixWorld();

    // Center the #gate Power-On card directly inside the 3D LCD screen
    if (this.gateEl && !this.gateEl.hasAttribute('hidden') && this.gbc.lcdMesh) {
      this.tempCenter.set(-0.92, -0.82, 0.01);
      this.tempEdge.set(0.92, 0.82, 0.01);
      this.gbc.lcdMesh.localToWorld(this.tempCenter);
      this.gbc.lcdMesh.localToWorld(this.tempEdge);
      this.tempCenter.project(this.camera);
      this.tempEdge.project(this.camera);

      const lcdX = ((this.tempCenter.x + this.tempEdge.x) * 0.25 + 0.5) * cw;
      const lcdY = (-(this.tempCenter.y + this.tempEdge.y) * 0.25 + 0.5) * ch;
      const lcdW = Math.abs(this.tempEdge.x - this.tempCenter.x) * 0.5 * cw;
      this.gateEl.style.left = `${lcdX.toFixed(1)}px`;
      this.gateEl.style.top = `${lcdY.toFixed(1)}px`;
      this.gateEl.style.width = `${Math.min(280, Math.max(168, lcdW * 0.94)).toFixed(1)}px`;
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

      const inViewport = screenY > 10 && screenY < ch - 42 && screenX > 6 && screenX < cw - 6;
      el.style.left = `${screenX.toFixed(1)}px`;
      el.style.top = `${screenY.toFixed(1)}px`;
      el.style.width = `${pxW.toFixed(1)}px`;
      el.style.height = `${pxH.toFixed(1)}px`;
      el.style.opacity = inViewport ? '1' : '0';
      el.style.pointerEvents = inViewport ? 'auto' : 'none';
    }
  }

  render(dt: number, time: number): void {
    this.syncViewportSize();
    this.updateCameraFraming(false);

    // Subtle parallax tilt & idle breathing on the 3D Game Boy Color
    const tiltAllowance = this.zoomedIn ? 0.04 : 0.22;
    const targetRotY = this.pointerNormX * tiltAllowance + Math.sin(time * 0.8) * 0.025;
    const targetRotX = -this.pointerNormY * (tiltAllowance * 0.75) + Math.cos(time * 0.6) * 0.018;

    this.gbc.root.rotation.y += (targetRotY - this.gbc.root.rotation.y) * Math.min(1, dt * 8);
    this.gbc.root.rotation.x += (targetRotX - this.gbc.root.rotation.x) * Math.min(1, dt * 8);

    this.gbc.update(dt);
    this.syncOverlayButtonPositions();
    this.screenTexture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
