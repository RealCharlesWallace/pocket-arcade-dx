import * as THREE from 'three';
import type { GBCButton, ShellTheme } from '../core/types';

export const SHELL_THEMES: ShellTheme[] = [
  { id: 'atomic-purple', name: 'ATOMIC PURPLE', color: 0x6c3cb8, cssHex: '#6c3cb8', roughness: 0.28 },
  { id: 'teal', name: 'TEAL BLUE', color: 0x16a5b2, cssHex: '#16a5b2', roughness: 0.30 },
  { id: 'kiwi', name: 'KIWI GREEN', color: 0x76c728, cssHex: '#76c728', roughness: 0.32 },
  { id: 'berry', name: 'BERRY PINK', color: 0xc92266, cssHex: '#c92266', roughness: 0.32 },
  { id: 'dandelion', name: 'DANDELION', color: 0xf0b418, cssHex: '#f0b418', roughness: 0.34 },
  { id: 'midnight', name: 'MIDNIGHT', color: 0x262a30, cssHex: '#262a30', roughness: 0.38 },
];

export class GameBoyColor3D {
  public readonly root = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly buttonMeshes = {} as Record<GBCButton, THREE.Object3D>;
  public readonly buttonSizes: Record<GBCButton, { w: number; h: number; zFront: number }> = {
    up: { w: 0.30, h: 0.31, zFront: 0.01 },
    down: { w: 0.30, h: 0.31, zFront: 0.01 },
    left: { w: 0.31, h: 0.30, zFront: 0.01 },
    right: { w: 0.31, h: 0.30, zFront: 0.01 },
    a: { w: 0.46, h: 0.46, zFront: 0.03 },
    b: { w: 0.46, h: 0.46, zFront: 0.03 },
    select: { w: 0.36, h: 0.14, zFront: 0.02 },
    start: { w: 0.36, h: 0.14, zFront: 0.02 },
  };
  public lcdMesh!: THREE.Mesh;

  private shellMat: THREE.MeshPhysicalMaterial;
  private cartridgeBodyMat: THREE.MeshStandardMaterial;
  private cartridgeLabelMat: THREE.MeshBasicMaterial;
  private ledMat: THREE.MeshStandardMaterial;
  private ledLight: THREE.PointLight;
  private screenMat: THREE.MeshBasicMaterial;

  private dpadGroup = new THREE.Group();
  private bodyMesh!: THREE.Mesh;
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

  private buttonHover: Record<GBCButton, number> = {
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

  private hoverCurrent: Record<GBCButton, number> = {
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
    const plasticBump = this.createPlasticBumpTexture();
    this.shellMat = new THREE.MeshPhysicalMaterial({
      color: SHELL_THEMES[0].color,
      roughness: SHELL_THEMES[0].roughness,
      metalness: 0.06,
      clearcoat: 0.48,
      clearcoatRoughness: 0.22,
      bumpMap: plasticBump,
      bumpScale: 0.015,
    });

    this.cartridgeBodyMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.35,
      metalness: 0.18,
    });

    this.cartridgeLabelMat = new THREE.MeshBasicMaterial({
      color: 0x2e8b8b,
    });

    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0x3a1010,
      emissive: 0x000000,
      roughness: 0.2,
    });

    this.ledLight = new THREE.PointLight(0xff2a2a, 0, 1.6);

    this.screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      color: 0x141816, // dimmed until powered on
    });

    this.buildShell();
    this.buildScreenBezelAndLCD();
    this.buildControls();
    this.buildSpeakerGrille();
    this.buildCartridgeAndPowerSwitch();
  }

  private createPlasticBumpTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    // Fine injection-molded ABS grain + micro-scuffs for tactile 3D light catch
    for (let i = 0; i < 4500; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      const v = 116 + ((i * 29) % 26);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = 'rgba(210, 210, 210, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const x1 = (i * 53) % 256;
      const y1 = (i * 97) % 256;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + ((i % 5) - 2) * 14, y1 + ((i % 3) + 1) * 9);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 5);
    return tex;
  }

  private createRoundedRectShape(
    w: number,
    h: number,
    rTop: number,
    rBottomRight: number,
    rBottomLeft: number,
    bottomArcsag = 0
  ): THREE.Shape {
    const shape = new THREE.Shape();
    const hw = w / 2;
    const hh = h / 2;

    shape.moveTo(-hw + rTop, hh);
    shape.lineTo(hw - rTop, hh);
    shape.quadraticCurveTo(hw, hh, hw, hh - rTop);
    shape.lineTo(hw, -hh + rBottomRight);
    shape.quadraticCurveTo(hw, -hh, hw - rBottomRight, -hh);
    if (bottomArcsag > 0) {
      shape.quadraticCurveTo(0, -hh - bottomArcsag, -hw + rBottomLeft, -hh);
    } else {
      shape.lineTo(-hw + rBottomLeft, -hh);
    }
    shape.quadraticCurveTo(-hw, -hh, -hw, -hh + rBottomLeft);
    shape.lineTo(-hw, hh - rTop);
    shape.quadraticCurveTo(-hw, hh, -hw + rTop, hh);
    return shape;
  }

  private buildShell(): void {
    // Sculpted Game Boy Color body with curved bottom chin and deep 3D bevels
    const bodyShape = this.createRoundedRectShape(3.16, 5.24, 0.20, 0.56, 0.34, 0.16);
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.64,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 1,
      bevelSize: 0.11,
      bevelThickness: 0.11,
    };

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    bodyGeo.center();
    const bodyMesh = new THREE.Mesh(bodyGeo, this.shellMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.bodyMesh = bodyMesh;
    this.root.add(bodyMesh);

    // Side seam groove ring separating front and rear shell halves (gives strong 3D depth)
    const seamShape = this.createRoundedRectShape(3.40, 5.48, 0.24, 0.62, 0.38, 0.16);
    const seamHole = this.createRoundedRectShape(3.32, 5.40, 0.22, 0.60, 0.36, 0.16);
    seamShape.holes.push(seamHole);
    const seamGeo = new THREE.ExtrudeGeometry(seamShape, { depth: 0.04, bevelEnabled: false });
    seamGeo.center();
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.75 });
    const seamMesh = new THREE.Mesh(seamGeo, seamMat);
    seamMesh.position.set(0, 0, 0.04);
    this.root.add(seamMesh);

    // Upper side grip ribs (5 sculpted horizontal ribs on both sides, like reference GBC)
    const ribGeo = new THREE.CapsuleGeometry(0.032, 0.24, 8, 12);
    ribGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const ry = 2.36 - i * 0.11;
      const leftRib = new THREE.Mesh(ribGeo, this.shellMat);
      leftRib.position.set(-1.69, ry, 0.06);
      this.root.add(leftRib);

      const rightRib = new THREE.Mesh(ribGeo, this.shellMat);
      rightRib.position.set(1.69, ry, 0.06);
      this.root.add(rightRib);
    }

    // Sculpted rear battery compartment bulge (visible when tilted in 3D)
    const packGeo = new THREE.BoxGeometry(2.55, 2.75, 0.38);
    const packMesh = new THREE.Mesh(packGeo, this.shellMat);
    packMesh.position.set(0.12, -0.92, -0.48);
    this.root.add(packMesh);

    // Embossed oval "Nintendo" / "POCKET DX" badge between screen bezel and controls
    const badgeOuterGeo = new THREE.CapsuleGeometry(0.13, 0.56, 8, 16);
    badgeOuterGeo.rotateZ(Math.PI / 2);
    badgeOuterGeo.scale(1, 1, 0.18);
    const badgeOuter = new THREE.Mesh(badgeOuterGeo, this.shellMat);
    badgeOuter.position.set(0, -0.18, 0.422);
    this.root.add(badgeOuter);

    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 256;
    badgeCanvas.height = 64;
    const bctx = badgeCanvas.getContext('2d')!;
    bctx.clearRect(0, 0, 256, 64);
    bctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    bctx.lineWidth = 4;
    bctx.beginPath();
    bctx.roundRect(10, 8, 236, 48, 24);
    bctx.stroke();
    bctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    bctx.font = 'bold 26px system-ui, sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('Nintendo', 128, 34);
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.22),
      new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true })
    );
    badgeLabel.position.set(0, -0.18, 0.448);
    this.root.add(badgeLabel);
  }

  private buildScreenBezelAndLCD(): void {
    // Larger dark glass lens frame with diagonal reflection streaks & micro-scratches
    const bezelCanvas = document.createElement('canvas');
    bezelCanvas.width = 512;
    bezelCanvas.height = 460;
    const bctx = bezelCanvas.getContext('2d')!;

    // Deep glossy charcoal bezel background
    bctx.fillStyle = '#121518';
    bctx.fillRect(0, 0, 512, 460);

    // Subtle diagonal glass sheen streaks & micro-scratches for 3D realism
    const grad = bctx.createLinearGradient(0, 0, 512, 460);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, 512, 460);

    bctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    bctx.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      const sx = (i * 67) % 480;
      const sy = (i * 89) % 420;
      bctx.beginPath();
      bctx.moveTo(sx, sy);
      bctx.lineTo(sx + 26, sy - 18);
      bctx.stroke();
    }

    // Subtle inner decorative border line
    bctx.strokeStyle = '#2d3239';
    bctx.lineWidth = 2.5;
    bctx.strokeRect(12, 12, 488, 434);

    // Left "))) POWER" badge (aligned cleanly to the right of the 3D red LED dome)
    bctx.fillStyle = '#b4b8c0';
    bctx.font = 'bold 12px system-ui, sans-serif';
    bctx.fillText(')))', 38, 178);
    bctx.font = 'bold 10px system-ui, sans-serif';
    bctx.fillText('POWER', 14, 202);

    // Bottom "GAME BOY COLOR" logo
    bctx.font = 'italic bold 26px system-ui, sans-serif';
    bctx.fillStyle = '#dde1e7';
    bctx.fillText('GAME BOY', 112, 428);

    const colorWord = [
      { ch: 'C', col: '#e83058' },
      { ch: 'O', col: '#9048d8' },
      { ch: 'L', col: '#48c838' },
      { ch: 'O', col: '#f8b818' },
      { ch: 'R', col: '#2898e8' },
    ];
    bctx.font = 'italic bold 25px "Comic Sans MS", system-ui, sans-serif';
    let cx = 274;
    for (const item of colorWord) {
      bctx.fillStyle = item.col;
      bctx.fillText(item.ch, cx, 428);
      cx += 22;
    }

    const bezelTex = new THREE.CanvasTexture(bezelCanvas);
    bezelTex.colorSpace = THREE.SRGBColorSpace;

    // Larger bezel (2.88 x 2.54) positioned near the top of the shell
    const bezelShape = this.createRoundedRectShape(2.88, 2.54, 0.14, 0.34, 0.14, 0.06);
    const bezelGeo = new THREE.ShapeGeometry(bezelShape);
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
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
    });

    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 1.22, 0.434);
    this.root.add(bezelMesh);

    // 3D Recessed inner shadow frame around the larger LCD
    const innerFrameGeo = new THREE.PlaneGeometry(2.36, 2.13);
    const innerFrameMat = new THREE.MeshStandardMaterial({ color: 0x070908, roughness: 0.8 });
    const innerFrame = new THREE.Mesh(innerFrameGeo, innerFrameMat);
    innerFrame.position.set(0.08, 1.32, 0.438);
    this.root.add(innerFrame);

    // Larger 160:144 (10:9) Active LCD Screen (2.28 x 2.05 — 44% more screen area!)
    const lcdGeo = new THREE.PlaneGeometry(2.28, 2.052);
    const lcdMesh = new THREE.Mesh(lcdGeo, this.screenMat);
    lcdMesh.position.set(0.08, 1.32, 0.442);
    lcdMesh.userData = { control: 'screen' };
    this.lcdMesh = lcdMesh;
    this.interactiveMeshes.push(lcdMesh);
    this.root.add(lcdMesh);

    // Power LED dome on the left of the bezel (to the left of the ")))" arcs)
    const ledGeo = new THREE.SphereGeometry(0.046, 16, 16);
    const ledMesh = new THREE.Mesh(ledGeo, this.ledMat);
    ledMesh.position.set(-1.31, 1.48, 0.442);
    this.root.add(ledMesh);

    this.ledLight.position.set(-1.31, 1.48, 0.58);
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
    const darkPlasticMat = new THREE.MeshPhysicalMaterial({
      color: 0x1c1f24,
      roughness: 0.30,
      metalness: 0.12,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
    });

    const wellMat = new THREE.MeshStandardMaterial({
      color: 0x0e1013,
      roughness: 0.75,
    });

    // --- ERGONOMICALLY LOWERED D-PAD (y = -0.96) ---
    // Recessed shadow well on shell under the D-Pad
    const dpadWellH = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.36), wellMat);
    const dpadWellV = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.98), wellMat);
    dpadWellH.position.set(-0.80, -0.96, 0.433);
    dpadWellV.position.set(-0.80, -0.96, 0.433);
    this.root.add(dpadWellH, dpadWellV);

    this.dpadGroup.position.set(-0.80, -0.96, 0.46);

    // Sculpted 3D D-Pad cross with beveled top layer
    const hBarGeo = new THREE.BoxGeometry(0.92, 0.30, 0.18);
    const vBarGeo = new THREE.BoxGeometry(0.30, 0.92, 0.18);
    const hBarTopGeo = new THREE.BoxGeometry(0.88, 0.26, 0.04);
    const vBarTopGeo = new THREE.BoxGeometry(0.26, 0.88, 0.04);
    const hBar = new THREE.Mesh(hBarGeo, darkPlasticMat);
    const vBar = new THREE.Mesh(vBarGeo, darkPlasticMat);
    const hBarTop = new THREE.Mesh(hBarTopGeo, darkPlasticMat);
    const vBarTop = new THREE.Mesh(vBarTopGeo, darkPlasticMat);
    hBarTop.position.z = 0.09;
    vBarTop.position.z = 0.09;
    this.dpadGroup.add(hBar, vBar, hBarTop, vBarTop);

    // Concave center pivot dip
    const centerDipGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20);
    centerDipGeo.rotateX(Math.PI / 2);
    const centerDip = new THREE.Mesh(
      centerDipGeo,
      new THREE.MeshStandardMaterial({ color: 0x131519, roughness: 0.45 })
    );
    centerDip.position.z = 0.095;
    this.dpadGroup.add(centerDip);

    // 3D Raised Molded Directional Triangles on the D-Pad arms
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x2c313a,
      roughness: 0.25,
      metalness: 0.15,
    });
    const makeArrowMesh = (rotZ: number, x: number, y: number) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0.075);
      s.lineTo(-0.065, -0.045);
      s.lineTo(0.065, -0.045);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
      const m = new THREE.Mesh(g, arrowMat);
      m.rotation.z = rotZ;
      m.position.set(x, y, 0.105);
      this.dpadGroup.add(m);
    };
    makeArrowMesh(0, 0, 0.30);               // Up
    makeArrowMesh(Math.PI, 0, -0.30);        // Down
    makeArrowMesh(Math.PI / 2, -0.30, 0);    // Left
    makeArrowMesh(-Math.PI / 2, 0.30, 0);    // Right

    // 4 directional raycast hit boxes on the D-Pad arms
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const dirs: Array<{ dir: GBCButton; x: number; y: number; w: number; h: number }> = [
      { dir: 'up', x: 0, y: 0.30, w: 0.30, h: 0.31 },
      { dir: 'down', x: 0, y: -0.30, w: 0.30, h: 0.31 },
      { dir: 'left', x: -0.30, y: 0, w: 0.31, h: 0.30 },
      { dir: 'right', x: 0.30, y: 0, w: 0.31, h: 0.30 },
    ];
    for (const d of dirs) {
      const hitGeo = new THREE.BoxGeometry(d.w, d.h, 0.26);
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(d.x, d.y, 0.06);
      hitMesh.userData = { control: d.dir };
      this.dpadGroup.add(hitMesh);
      this.interactiveMeshes.push(hitMesh);
      this.buttonMeshes[d.dir] = hitMesh;
    }

    this.root.add(this.dpadGroup);

    // --- ERGONOMICALLY LOWERED A & B BUTTONS (y = -0.80 and -1.08) ---
    // Recessed circular button wells on shell face
    const wellGeo = new THREE.RingGeometry(0.21, 0.255, 32);
    const wellA = new THREE.Mesh(wellGeo, wellMat);
    wellA.position.set(0.94, -0.80, 0.434);
    const wellB = new THREE.Mesh(wellGeo, wellMat);
    wellB.position.set(0.38, -1.08, 0.434);
    this.root.add(wellA, wellB);

    const btnGeo = new THREE.CylinderGeometry(0.22, 0.235, 0.20, 32);
    btnGeo.rotateX(Math.PI / 2);
    btnGeo.rotateZ(Math.PI / 2);

    const matA = new THREE.MeshPhysicalMaterial({
      map: this.createButtonLabelTexture('A', '#1d2026', '#d8dce2'),
      roughness: 0.20,
      metalness: 0.14,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
    });
    const matB = new THREE.MeshPhysicalMaterial({
      map: this.createButtonLabelTexture('B', '#1d2026', '#d8dce2'),
      roughness: 0.20,
      metalness: 0.14,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
    });

    this.btnAMesh = new THREE.Mesh(btnGeo, matA);
    this.btnAMesh.position.set(0.94, -0.80, 0.46);
    this.btnAMesh.userData = { control: 'a' };
    this.interactiveMeshes.push(this.btnAMesh);
    this.buttonMeshes.a = this.btnAMesh;
    this.root.add(this.btnAMesh);

    this.btnBMesh = new THREE.Mesh(btnGeo, matB);
    this.btnBMesh.position.set(0.38, -1.08, 0.46);
    this.btnBMesh.userData = { control: 'b' };
    this.interactiveMeshes.push(this.btnBMesh);
    this.buttonMeshes.b = this.btnBMesh;
    this.root.add(this.btnBMesh);

    // --- ERGONOMICALLY LOWERED SELECT & START RUBBER PILLS (y = -1.92) ---
    const pillGeo = new THREE.CapsuleGeometry(0.06, 0.23, 10, 18);
    pillGeo.rotateZ(Math.PI / 2);
    const pillMat = new THREE.MeshStandardMaterial({
      color: 0x2c3036,
      roughness: 0.55,
      metalness: 0.08,
    });

    this.btnSelectMesh = new THREE.Mesh(pillGeo, pillMat);
    this.btnSelectMesh.position.set(-0.26, -1.92, 0.445);
    this.btnSelectMesh.userData = { control: 'select' };
    this.interactiveMeshes.push(this.btnSelectMesh);
    this.buttonMeshes.select = this.btnSelectMesh;
    this.root.add(this.btnSelectMesh);

    this.btnStartMesh = new THREE.Mesh(pillGeo, pillMat);
    this.btnStartMesh.position.set(0.26, -1.92, 0.445);
    this.btnStartMesh.userData = { control: 'start' };
    this.interactiveMeshes.push(this.btnStartMesh);
    this.buttonMeshes.start = this.btnStartMesh;
    this.root.add(this.btnStartMesh);

    // Molded SELECT / START label plate under pills
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.clearRect(0, 0, 256, 64);
    lctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    lctx.font = 'bold 21px system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText('SELECT', 72, 42);
    lctx.fillText('START', 184, 42);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(1.14, 0.26);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, -2.10, 0.435);
    this.root.add(labelMesh);
  }

  private buildSpeakerGrille(): void {
    const holeGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.06, 10);
    holeGeo.rotateX(Math.PI / 2);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0d0f });

    // Authentic 7x7 diagonal-clipped perforated speaker grille in bottom-right corner
    const startX = 0.56;
    const startY = -1.72;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r + c < 2 || r + c > 10 || (r === 6 && c === 0) || (r === 0 && c === 6)) continue;
        const dot = new THREE.Mesh(holeGeo, holeMat);
        dot.position.set(startX + c * 0.10, startY - r * 0.10, 0.405);
        this.root.add(dot);
      }
    }
  }

  private buildCartridgeAndPowerSwitch(): void {
    // Protruding Game Pak Cartridge at the top rear slot
    const cartGroup = new THREE.Group();
    const cartGeo = new THREE.BoxGeometry(2.18, 0.92, 0.26);
    const cartMesh = new THREE.Mesh(cartGeo, this.cartridgeBodyMat);
    cartGroup.add(cartMesh);

    const labelGeo = new THREE.PlaneGeometry(1.68, 0.44);
    const labelMesh = new THREE.Mesh(labelGeo, this.cartridgeLabelMat);
    labelMesh.position.set(0, 0.14, 0.135);
    cartGroup.add(labelMesh);

    cartGroup.position.set(0, 2.52, -0.14);
    this.root.add(cartGroup);

    // Side Power Slider Switch in recessed side channel (like reference GBC photo)
    const slotGeo = new THREE.BoxGeometry(0.14, 0.52, 0.22);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.85 });
    const slotMesh = new THREE.Mesh(slotGeo, slotMat);
    slotMesh.position.set(1.66, 1.56, 0.04);
    this.root.add(slotMesh);

    const switchGeo = new THREE.BoxGeometry(0.18, 0.28, 0.16);
    const switchMat = new THREE.MeshStandardMaterial({ color: 0xb59452, roughness: 0.35, metalness: 0.18 });
    this.powerSwitchMesh = new THREE.Mesh(switchGeo, switchMat);
    this.powerSwitchMesh.position.set(1.71, 1.50, 0.04);
    this.powerSwitchMesh.userData = { control: 'power' };
    this.interactiveMeshes.push(this.powerSwitchMesh);
    this.root.add(this.powerSwitchMesh);
  }

  setPowerState(powered: boolean): void {
    this.isPowered = powered;
    if (powered) {
      this.ledMat.color.setHex(0xff3b3b);
      this.ledMat.emissive.setHex(0xff1e1e);
      this.ledMat.emissiveIntensity = 1.8;
      this.ledLight.intensity = 0.9;
      this.screenMat.color.setHex(0xffffff);
    } else {
      this.ledMat.color.setHex(0x3a1010);
      this.ledMat.emissive.setHex(0x000000);
      this.ledMat.emissiveIntensity = 0;
      this.ledLight.intensity = 0;
      this.screenMat.color.setHex(0x141816);
    }
  }

  setShellTheme(theme: ShellTheme): void {
    this.shellMat.color.setHex(theme.color);
    this.shellMat.roughness = theme.roughness;
  }

  setMobileFullBleed(_enabled: boolean, _minHeightWorld = 5.4): void {
    // Keep 1:1 true 3D proportions so the sculpted bevels, side ribs, and curved bottom chin remain visible
    if (this.bodyMesh) {
      this.bodyMesh.scale.set(1, 1, 1);
    }
  }

  setCartridgeAppearance(cartColorHex: string, accentColorHex: string): void {
    this.cartridgeBodyMat.color.set(cartColorHex);
    this.cartridgeLabelMat.color.set(accentColorHex);
  }

  setButtonState(btn: GBCButton, pressed: boolean): void {
    this.buttonTargets[btn] = pressed ? 1 : 0;
  }

  setButtonHover(btn: GBCButton, hovered: boolean): void {
    this.buttonHover[btn] = hovered ? 1 : 0;
  }

  update(dt: number): void {
    const speed = Math.min(1, dt * 22);
    (Object.keys(this.buttonTargets) as GBCButton[]).forEach((k) => {
      this.buttonCurrent[k] += (this.buttonTargets[k] - this.buttonCurrent[k]) * speed;
      this.hoverCurrent[k] += (this.buttonHover[k] - this.hoverCurrent[k]) * speed;
    });

    // D-Pad physical tilt + hover lift
    const tiltX = (this.buttonCurrent.down - this.buttonCurrent.up) * 0.17;
    const tiltY = (this.buttonCurrent.right - this.buttonCurrent.left) * 0.17;
    this.dpadGroup.rotation.x = tiltX;
    this.dpadGroup.rotation.y = tiltY;
    const dpadDepress = Math.max(
      this.buttonCurrent.up,
      this.buttonCurrent.down,
      this.buttonCurrent.left,
      this.buttonCurrent.right
    );
    const dpadHover = Math.max(
      this.hoverCurrent.up,
      this.hoverCurrent.down,
      this.hoverCurrent.left,
      this.hoverCurrent.right
    );
    this.dpadGroup.position.z = 0.46 + dpadHover * 0.018 - dpadDepress * 0.032;

    // A / B / Start / Select hover lift & physical depression
    this.btnAMesh.position.z = 0.46 + this.hoverCurrent.a * 0.022 - this.buttonCurrent.a * 0.055;
    this.btnBMesh.position.z = 0.46 + this.hoverCurrent.b * 0.022 - this.buttonCurrent.b * 0.055;
    this.btnSelectMesh.position.z = 0.445 + this.hoverCurrent.select * 0.015 - this.buttonCurrent.select * 0.038;
    this.btnStartMesh.position.z = 0.445 + this.hoverCurrent.start * 0.015 - this.buttonCurrent.start * 0.038;

    // Power switch position
    const targetSwitchY = this.isPowered ? 1.62 : 1.48;
    this.powerSwitchMesh.position.y += (targetSwitchY - this.powerSwitchMesh.position.y) * speed;
  }
}
