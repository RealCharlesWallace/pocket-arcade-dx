import * as THREE from 'three';
import type { GBCButton, ShellTheme } from '../core/types';

export const SHELL_THEMES: ShellTheme[] = [
  { id: 'atomic-purple', name: 'ATOMIC PURPLE', color: 0x6c3cb8, cssHex: '#6c3cb8', roughness: 0.28 },
  { id: 'kiwi', name: 'KIWI GREEN', color: 0x76c728, cssHex: '#76c728', roughness: 0.32 },
  { id: 'teal', name: 'TEAL BLUE', color: 0x1e8f99, cssHex: '#1e8f99', roughness: 0.32 },
  { id: 'berry', name: 'BERRY PINK', color: 0xc92266, cssHex: '#c92266', roughness: 0.32 },
  { id: 'dandelion', name: 'DANDELION', color: 0xf0b418, cssHex: '#f0b418', roughness: 0.34 },
  { id: 'midnight', name: 'MIDNIGHT', color: 0x262a30, cssHex: '#262a30', roughness: 0.38 },
];

export class GameBoyColor3D {
  public readonly root = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly buttonMeshes = {} as Record<GBCButton, THREE.Object3D>;
  public readonly buttonSizes: Record<GBCButton, { w: number; h: number; zFront: number }> = {
    up: { w: 0.28, h: 0.29, zFront: 0.03 },
    down: { w: 0.28, h: 0.29, zFront: 0.03 },
    left: { w: 0.29, h: 0.28, zFront: 0.03 },
    right: { w: 0.29, h: 0.28, zFront: 0.03 },
    a: { w: 0.42, h: 0.42, zFront: 0.08 },
    b: { w: 0.42, h: 0.42, zFront: 0.08 },
    select: { w: 0.34, h: 0.12, zFront: 0.055 },
    start: { w: 0.34, h: 0.12, zFront: 0.055 },
  };
  public lcdMesh!: THREE.Mesh;

  private shellMat: THREE.MeshPhysicalMaterial;
  private cartridgeBodyMat: THREE.MeshStandardMaterial;
  private cartridgeLabelMat: THREE.MeshBasicMaterial;
  private ledMat: THREE.MeshStandardMaterial;
  private ledLight: THREE.PointLight;
  private screenMat: THREE.MeshBasicMaterial;

  private dpadGroup = new THREE.Group();
  private btnAMesh!: THREE.Mesh;
  private btnBMesh!: THREE.Mesh;
  private btnStartMesh!: THREE.Mesh;
  private btnSelectMesh!: THREE.Mesh;
  private powerSwitchMesh!: THREE.Mesh;

  private buttonTargets: Record<GBCButton, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    a: 0,
    b: 0,
    start: 0,
    select: 0,
  };

  private buttonCurrent: Record<GBCButton, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    a: 0,
    b: 0,
    start: 0,
    select: 0,
  };

  private isPowered = false;

  constructor(screenTexture: THREE.CanvasTexture) {
    this.shellMat = new THREE.MeshPhysicalMaterial({
      color: SHELL_THEMES[0].color,
      roughness: SHELL_THEMES[0].roughness,
      metalness: 0.08,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
    });

    this.cartridgeBodyMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.38,
      metalness: 0.15,
    });

    this.cartridgeLabelMat = new THREE.MeshBasicMaterial({
      color: 0x2e8b8b,
    });

    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0x3a1010,
      emissive: 0x000000,
      roughness: 0.2,
    });

    this.ledLight = new THREE.PointLight(0xff2a2a, 0, 1.4);

    this.screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      color: 0x181c19, // dimmed until powered on
    });

    this.buildShell();
    this.buildScreenBezelAndLCD();
    this.buildControls();
    this.buildSpeakerGrille();
    this.buildCartridgeAndPowerSwitch();
  }

  private createRoundedRectShape(w: number, h: number, rTop: number, rBottomRight: number, rBottomLeft: number): THREE.Shape {
    const shape = new THREE.Shape();
    const hw = w / 2;
    const hh = h / 2;

    shape.moveTo(-hw + rTop, hh);
    shape.lineTo(hw - rTop, hh);
    shape.quadraticCurveTo(hw, hh, hw, hh - rTop);
    shape.lineTo(hw, -hh + rBottomRight);
    shape.quadraticCurveTo(hw, -hh, hw - rBottomRight, -hh);
    shape.lineTo(-hw + rBottomLeft, -hh);
    shape.quadraticCurveTo(-hw, -hh, -hw, -hh + rBottomLeft);
    shape.lineTo(-hw, hh - rTop);
    shape.quadraticCurveTo(-hw, hh, -hw + rTop, hh);
    return shape;
  }

  private buildShell(): void {
    // Main sculpted Game Boy Color body (width 3.2, height 5.3, depth 0.72)
    const bodyShape = this.createRoundedRectShape(3.2, 5.3, 0.22, 0.62, 0.26);
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.62,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    };

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    bodyGeo.center();
    const bodyMesh = new THREE.Mesh(bodyGeo, this.shellMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.root.add(bodyMesh);

    // Subtle rear battery pack bulge for 3D silhouette authenticity
    const packGeo = new THREE.BoxGeometry(2.3, 2.5, 0.22);
    const packMesh = new THREE.Mesh(packGeo, this.shellMat);
    packMesh.position.set(0, -0.95, -0.42);
    this.root.add(packMesh);
  }

  private buildScreenBezelAndLCD(): void {
    // Dark glass lens frame with painted "GAME BOY COLOR" & "BATTERY" badge
    const bezelCanvas = document.createElement('canvas');
    bezelCanvas.width = 512;
    bezelCanvas.height = 440;
    const bctx = bezelCanvas.getContext('2d')!;

    // Dark charcoal bezel background
    bctx.fillStyle = '#1d2024';
    bctx.fillRect(0, 0, 512, 440);

    // Subtle inner decorative border line
    bctx.strokeStyle = '#343940';
    bctx.lineWidth = 3;
    bctx.strokeRect(18, 18, 476, 404);

    // BATTERY text on left side
    bctx.fillStyle = '#a5a9b0';
    bctx.font = 'bold 12px system-ui, sans-serif';
    bctx.fillText('BATTERY', 24, 210);

    // Bottom "GAME BOY COLOR" logo
    bctx.font = 'italic bold 24px system-ui, sans-serif';
    bctx.fillStyle = '#d8dce2';
    bctx.fillText('GAME BOY', 120, 404);

    const colorWord = [
      { ch: 'C', col: '#e83058' },
      { ch: 'O', col: '#9048d8' },
      { ch: 'L', col: '#48c838' },
      { ch: 'O', col: '#f8b818' },
      { ch: 'R', col: '#2898e8' },
    ];
    bctx.font = 'italic bold 23px "Comic Sans MS", system-ui, sans-serif';
    let cx = 272;
    for (const item of colorWord) {
      bctx.fillStyle = item.col;
      bctx.fillText(item.ch, cx, 404);
      cx += 21;
    }

    const bezelTex = new THREE.CanvasTexture(bezelCanvas);
    bezelTex.colorSpace = THREE.SRGBColorSpace;

    const bezelShape = this.createRoundedRectShape(2.76, 2.34, 0.14, 0.34, 0.14);
    const bezelGeo = new THREE.ShapeGeometry(bezelShape);
    // Normalize UV coordinates for ShapeGeometry
    bezelGeo.computeBoundingBox();
    const bb = bezelGeo.boundingBox!;
    const pos = bezelGeo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
      uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
    }
    bezelGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const bezelMat = new THREE.MeshPhysicalMaterial({
      map: bezelTex,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });

    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 1.15, 0.392);
    this.root.add(bezelMesh);

    // Recessed inner black frame around the LCD
    const innerFrameGeo = new THREE.PlaneGeometry(1.98, 1.78);
    const innerFrameMat = new THREE.MeshBasicMaterial({ color: 0x0b0d0c });
    const innerFrame = new THREE.Mesh(innerFrameGeo, innerFrameMat);
    innerFrame.position.set(0.08, 1.24, 0.395);
    this.root.add(innerFrame);

    // Actual 160:144 (10:9) Active LCD Screen
    const lcdGeo = new THREE.PlaneGeometry(1.9, 1.71);
    const lcdMesh = new THREE.Mesh(lcdGeo, this.screenMat);
    lcdMesh.position.set(0.08, 1.24, 0.398);
    lcdMesh.userData = { control: 'screen' };
    this.lcdMesh = lcdMesh;
    this.interactiveMeshes.push(lcdMesh);
    this.root.add(lcdMesh);

    // Power LED dome on the left of the bezel
    const ledGeo = new THREE.SphereGeometry(0.052, 16, 16);
    const ledMesh = new THREE.Mesh(ledGeo, this.ledMat);
    ledMesh.position.set(-1.12, 1.32, 0.395);
    this.root.add(ledMesh);

    this.ledLight.position.set(-1.12, 1.32, 0.52);
    this.root.add(this.ledLight);
  }

  private createButtonLabelTexture(letter: string, bgHex: string, fgHex = '#d8dce2'): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = fgHex;
    ctx.font = 'bold 68px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildControls(): void {
    const darkPlasticMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.35,
      metalness: 0.1,
    });

    // --- D-PAD ---
    this.dpadGroup.position.set(-0.78, -0.58, 0.41);

    const hBarGeo = new THREE.BoxGeometry(0.86, 0.28, 0.14);
    const vBarGeo = new THREE.BoxGeometry(0.28, 0.86, 0.14);
    const hBar = new THREE.Mesh(hBarGeo, darkPlasticMat);
    const vBar = new THREE.Mesh(vBarGeo, darkPlasticMat);
    this.dpadGroup.add(hBar, vBar);

    // Subtle center indentation circle
    const centerDipGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 16);
    centerDipGeo.rotateX(Math.PI / 2);
    const centerDip = new THREE.Mesh(centerDipGeo, new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.5 }));
    this.dpadGroup.add(centerDip);

    // Molded directional arrows on the 3D D-Pad arms
    const dpadArrowCanvas = document.createElement('canvas');
    dpadArrowCanvas.width = 256;
    dpadArrowCanvas.height = 256;
    const dctx = dpadArrowCanvas.getContext('2d')!;
    dctx.clearRect(0, 0, 256, 256);
    dctx.fillStyle = 'rgba(216, 220, 226, 0.38)';
    const drawTri = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
      dctx.beginPath();
      dctx.moveTo(x1, y1);
      dctx.lineTo(x2, y2);
      dctx.lineTo(x3, y3);
      dctx.closePath();
      dctx.fill();
    };
    drawTri(128, 22, 108, 56, 148, 56);   // Up
    drawTri(128, 234, 108, 200, 148, 200); // Down
    drawTri(22, 128, 56, 108, 56, 148);   // Left
    drawTri(234, 128, 200, 108, 200, 148); // Right
    const dpadArrowTex = new THREE.CanvasTexture(dpadArrowCanvas);
    const dpadArrowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.84),
      new THREE.MeshBasicMaterial({ map: dpadArrowTex, transparent: true })
    );
    dpadArrowMesh.position.set(0, 0, 0.072);
    this.dpadGroup.add(dpadArrowMesh);

    // 4 directional raycast hit boxes on the D-Pad arms
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const dirs: Array<{ dir: GBCButton; x: number; y: number; w: number; h: number }> = [
      { dir: 'up', x: 0, y: 0.285, w: 0.28, h: 0.29 },
      { dir: 'down', x: 0, y: -0.285, w: 0.28, h: 0.29 },
      { dir: 'left', x: -0.285, y: 0, w: 0.29, h: 0.28 },
      { dir: 'right', x: 0.285, y: 0, w: 0.29, h: 0.28 },
    ];
    for (const d of dirs) {
      const hitGeo = new THREE.BoxGeometry(d.w, d.h, 0.24);
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(d.x, d.y, 0.04);
      hitMesh.userData = { control: d.dir };
      this.dpadGroup.add(hitMesh);
      this.interactiveMeshes.push(hitMesh);
      this.buttonMeshes[d.dir] = hitMesh;
    }

    this.root.add(this.dpadGroup);

    // --- A & B Buttons ---
    const btnGeo = new THREE.CylinderGeometry(0.21, 0.22, 0.16, 28);
    btnGeo.rotateX(Math.PI / 2);
    btnGeo.rotateZ(Math.PI / 2);

    const matA = new THREE.MeshStandardMaterial({
      map: this.createButtonLabelTexture('A', '#23262c'),
      roughness: 0.25,
      metalness: 0.12,
    });
    const matB = new THREE.MeshStandardMaterial({
      map: this.createButtonLabelTexture('B', '#23262c'),
      roughness: 0.25,
      metalness: 0.12,
    });

    this.btnAMesh = new THREE.Mesh(btnGeo, matA);
    this.btnAMesh.position.set(0.96, -0.42, 0.41);
    this.btnAMesh.userData = { control: 'a' };
    this.interactiveMeshes.push(this.btnAMesh);
    this.buttonMeshes.a = this.btnAMesh;
    this.root.add(this.btnAMesh);

    this.btnBMesh = new THREE.Mesh(btnGeo, matB);
    this.btnBMesh.position.set(0.44, -0.68, 0.41);
    this.btnBMesh.userData = { control: 'b' };
    this.interactiveMeshes.push(this.btnBMesh);
    this.buttonMeshes.b = this.btnBMesh;
    this.root.add(this.btnBMesh);

    // --- SELECT & START Rubber Pills ---
    const pillGeo = new THREE.CapsuleGeometry(0.055, 0.22, 8, 16);
    pillGeo.rotateZ(Math.PI / 2);
    const pillMat = new THREE.MeshStandardMaterial({
      color: 0x363a40,
      roughness: 0.65,
    });

    this.btnSelectMesh = new THREE.Mesh(pillGeo, pillMat);
    this.btnSelectMesh.position.set(-0.24, -1.52, 0.4);
    this.btnSelectMesh.userData = { control: 'select' };
    this.interactiveMeshes.push(this.btnSelectMesh);
    this.buttonMeshes.select = this.btnSelectMesh;
    this.root.add(this.btnSelectMesh);

    this.btnStartMesh = new THREE.Mesh(pillGeo, pillMat);
    this.btnStartMesh.position.set(0.24, -1.52, 0.4);
    this.btnStartMesh.userData = { control: 'start' };
    this.interactiveMeshes.push(this.btnStartMesh);
    this.buttonMeshes.start = this.btnStartMesh;
    this.root.add(this.btnStartMesh);

    // Printed SELECT / START label plate under pills
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.clearRect(0, 0, 256, 64);
    lctx.fillStyle = 'rgba(255,255,255,0.75)';
    lctx.font = 'bold 20px system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText('SELECT', 74, 42);
    lctx.fillText('START', 182, 42);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(1.1, 0.26);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, -1.7, 0.395);
    this.root.add(labelMesh);
  }

  private buildSpeakerGrille(): void {
    const holeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 8);
    holeGeo.rotateX(Math.PI / 2);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x101214 });

    const startX = 0.62;
    const startY = -1.65;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if ((r === 0 && c === 4) || (r === 4 && c === 0)) continue;
        const dot = new THREE.Mesh(holeGeo, holeMat);
        dot.position.set(startX + c * 0.11, startY - r * 0.11, 0.385);
        this.root.add(dot);
      }
    }
  }

  private buildCartridgeAndPowerSwitch(): void {
    // Protruding Game Pak Cartridge at the top rear slot
    const cartGroup = new THREE.Group();
    const cartGeo = new THREE.BoxGeometry(2.15, 0.9, 0.24);
    const cartMesh = new THREE.Mesh(cartGeo, this.cartridgeBodyMat);
    cartGroup.add(cartMesh);

    const labelGeo = new THREE.PlaneGeometry(1.65, 0.42);
    const labelMesh = new THREE.Mesh(labelGeo, this.cartridgeLabelMat);
    labelMesh.position.set(0, 0.14, 0.125);
    cartGroup.add(labelMesh);

    cartGroup.position.set(0, 2.48, -0.14);
    this.root.add(cartGroup);

    // Top-left Power Slider Switch
    const switchGeo = new THREE.BoxGeometry(0.28, 0.16, 0.18);
    const switchMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.4 });
    this.powerSwitchMesh = new THREE.Mesh(switchGeo, switchMat);
    this.powerSwitchMesh.position.set(-1.62, 2.1, 0);
    this.powerSwitchMesh.userData = { control: 'power' };
    this.interactiveMeshes.push(this.powerSwitchMesh);
    this.root.add(this.powerSwitchMesh);
  }

  setPowerState(powered: boolean): void {
    this.isPowered = powered;
    if (powered) {
      this.ledMat.color.setHex(0xff3b3b);
      this.ledMat.emissive.setHex(0xff1e1e);
      this.ledMat.emissiveIntensity = 1.6;
      this.ledLight.intensity = 0.8;
      this.screenMat.color.setHex(0xffffff);
    } else {
      this.ledMat.color.setHex(0x3a1010);
      this.ledMat.emissive.setHex(0x000000);
      this.ledMat.emissiveIntensity = 0;
      this.ledLight.intensity = 0;
      this.screenMat.color.setHex(0x181c19);
    }
  }

  setShellTheme(theme: ShellTheme): void {
    this.shellMat.color.setHex(theme.color);
    this.shellMat.roughness = theme.roughness;
  }

  setCartridgeAppearance(cartColorHex: string, accentColorHex: string): void {
    this.cartridgeBodyMat.color.set(cartColorHex);
    this.cartridgeLabelMat.color.set(accentColorHex);
  }

  setButtonState(btn: GBCButton, pressed: boolean): void {
    this.buttonTargets[btn] = pressed ? 1 : 0;
  }

  update(dt: number): void {
    const speed = Math.min(1, dt * 22);
    (Object.keys(this.buttonTargets) as GBCButton[]).forEach((k) => {
      this.buttonCurrent[k] += (this.buttonTargets[k] - this.buttonCurrent[k]) * speed;
    });

    // D-Pad physical tilt
    const tiltX = (this.buttonCurrent.down - this.buttonCurrent.up) * 0.16;
    const tiltY = (this.buttonCurrent.right - this.buttonCurrent.left) * 0.16;
    this.dpadGroup.rotation.x = tiltX;
    this.dpadGroup.rotation.y = tiltY;
    const dpadDepress = Math.max(
      this.buttonCurrent.up,
      this.buttonCurrent.down,
      this.buttonCurrent.left,
      this.buttonCurrent.right
    );
    this.dpadGroup.position.z = 0.41 - dpadDepress * 0.025;

    // A / B / Start / Select physical depression
    this.btnAMesh.position.z = 0.41 - this.buttonCurrent.a * 0.05;
    this.btnBMesh.position.z = 0.41 - this.buttonCurrent.b * 0.05;
    this.btnSelectMesh.position.z = 0.4 - this.buttonCurrent.select * 0.035;
    this.btnStartMesh.position.z = 0.4 - this.buttonCurrent.start * 0.035;

    // Power switch position
    const targetSwitchY = this.isPowered ? 2.24 : 2.02;
    this.powerSwitchMesh.position.y += (targetSwitchY - this.powerSwitchMesh.position.y) * speed;
  }
}
