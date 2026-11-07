import * as THREE from 'three';
import type { GBCButton } from '../core/types';
import { GameBoyColor3D } from './gbc-model';

export class StageScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private gbc: GameBoyColor3D;
  private screenTexture: THREE.CanvasTexture;

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
    this.onVirtualButton = options.onVirtualButton;
    this.onPowerToggle = options.onPowerToggle;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / Math.max(1, container.clientHeight),
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
    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    container.addEventListener('pointermove', (e) => {
      const rect = container.getBoundingClientRect();
      this.pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNormY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
    const aspect = this.camera.aspect;
    const isNarrow = aspect < 0.85;

    let targetY = 0.08;
    let targetZ = isNarrow ? 10.6 : 8.7;

    if (this.zoomedIn) {
      targetY = 1.22;
      targetZ = isNarrow ? 5.1 : 3.95;
    }

    if (instant) {
      this.camera.position.set(0, targetY, targetZ);
      this.camera.lookAt(0, targetY, 0);
    } else {
      this.camera.position.y += (targetY - this.camera.position.y) * 0.1;
      this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;
      this.camera.lookAt(0, this.camera.position.y * 0.92, 0);
    }
  }

  render(dt: number, time: number): void {
    this.updateCameraFraming(false);

    // Subtle parallax tilt & idle breathing on the 3D Game Boy Color
    const tiltAllowance = this.zoomedIn ? 0.04 : 0.22;
    const targetRotY = this.pointerNormX * tiltAllowance + Math.sin(time * 0.8) * 0.025;
    const targetRotX = -this.pointerNormY * (tiltAllowance * 0.75) + Math.cos(time * 0.6) * 0.018;

    this.gbc.root.rotation.y += (targetRotY - this.gbc.root.rotation.y) * Math.min(1, dt * 8);
    this.gbc.root.rotation.x += (targetRotX - this.gbc.root.rotation.x) * Math.min(1, dt * 8);

    this.gbc.update(dt);
    this.screenTexture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
