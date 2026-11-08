import * as THREE from 'three';
import type { GBCButton, ShellTheme } from '../core/types';

export const SHELL_THEMES: ShellTheme[] = [
  { id: 'atomic-purple', name: 'ATOMIC PURPLE', color: 0x6c3cb8, cssHex: '#6c3cb8', roughness: 0.28, transmission: 0.28, opacity: 0.91 },
  { id: 'transparent-blue', name: 'TRANSPARENT BLUE', color: 0x1a78ee, cssHex: '#1a78ee', roughness: 0.16, transmission: 0.36, opacity: 0.88 },
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

  public readonly dpadGroup = new THREE.Group();
  private dpadArmGroups: Partial<Record<GBCButton, THREE.Group>> = {};
  private dpadArmMats: Partial<Record<GBCButton, THREE.MeshPhysicalMaterial>> = {};
  private dpadArrowMats: Partial<Record<GBCButton, THREE.MeshStandardMaterial>> = {};
  private dpadSlideX = 0;
  private dpadSlideY = 0;
  private bodyMesh!: THREE.Mesh;
  private btnAGroup = new THREE.Group();
  private btnBGroup = new THREE.Group();
  private btnStartMesh!: THREE.Mesh;
  private btnSelectMesh!: THREE.Mesh;
  private matA!: THREE.MeshPhysicalMaterial;
  private matB!: THREE.MeshPhysicalMaterial;
  private matABody!: THREE.MeshPhysicalMaterial;
  private matBBody!: THREE.MeshPhysicalMaterial;
  private matSelect!: THREE.MeshStandardMaterial;
  private matStart!: THREE.MeshStandardMaterial;
  private btnATiltX = 0;
  private btnATiltY = 0;
  private btnBTiltX = 0;
  private btnBTiltY = 0;
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
    this.setShellTheme(SHELL_THEMES[0]);
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

  private createPcbTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 448;
    const ctx = c.getContext('2d')!;

    // Dark emerald/teal solder mask base
    const bgGrad = ctx.createLinearGradient(0, 0, 256, 448);
    bgGrad.addColorStop(0, '#0a3a30');
    bgGrad.addColorStop(0.5, '#0e4c3e');
    bgGrad.addColorStop(1, '#083028');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 448);

    // Subtle ground plane copper pour blocks
    ctx.fillStyle = 'rgba(24, 118, 94, 0.36)';
    ctx.fillRect(14, 18, 228, 170);
    ctx.fillRect(14, 210, 228, 220);

    // Gold copper bus traces & angled routing lines
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 22; i++) {
      const x0 = 22 + ((i * 19) % 210);
      const y0 = 28 + ((i * 37) % 380);
      const dx = ((i % 3) - 1) * 28;
      const dy = 24 + (i % 4) * 18;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dx, y0 + Math.abs(dx));
      ctx.lineTo(x0 + dx, y0 + Math.abs(dx) + dy);
      ctx.stroke();

      // Gold via pad at trace endpoints
      ctx.fillStyle = '#e5c158';
      ctx.beginPath();
      ctx.arc(x0, y0, 2.4, 0, Math.PI * 2);
      ctx.arc(x0 + dx, y0 + Math.abs(dx) + dy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Black QFP IC chips (CPU CGB & WRAM) with gold gull-wing pins
    const drawChip = (cx: number, cy: number, w: number, h: number, label: string) => {
      ctx.fillStyle = '#d8b448';
      for (let px = cx - w / 2 + 4; px <= cx + w / 2 - 4; px += 5) {
        ctx.fillRect(px - 1, cy - h / 2 - 4, 2, 4);
        ctx.fillRect(px - 1, cy + h / 2, 2, 4);
      }
      for (let py = cy - h / 2 + 4; py <= cy + h / 2 - 4; py += 5) {
        ctx.fillRect(cx - w / 2 - 4, py - 1, 4, 2);
        ctx.fillRect(cx + w / 2, py - 1, 4, 2);
      }
      ctx.fillStyle = '#14171c';
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.strokeStyle = '#2d333d';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = 'rgba(235, 240, 248, 0.55)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
    };

    drawChip(92, 224, 54, 54, 'CPU CGB');
    drawChip(174, 232, 38, 48, 'LH52256');
    drawChip(132, 148, 44, 30, 'AMP-GB');

    // Gold circular interdigitated button contact pads (D-Pad, A/B, Select/Start)
    const drawContactPad = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = '#dfba48';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b3d32';
      ctx.lineWidth = 1.6;
      for (let y = cy - r + 3; y <= cy + r - 3; y += 4) {
        ctx.beginPath();
        ctx.moveTo(cx - r + 2, y);
        ctx.lineTo(cx + r - 2, y);
        ctx.stroke();
      }
    };

    // D-Pad 4 directional contact pads
    drawContactPad(54, 286, 12);
    drawContactPad(54, 336, 12);
    drawContactPad(29, 311, 12);
    drawContactPad(79, 311, 12);

    // A & B contact pads
    drawContactPad(214, 297, 15);
    drawContactPad(163, 323, 15);

    // Select & Start pill contact pads
    drawContactPad(104, 400, 10);
    drawContactPad(152, 400, 10);

    // White PCB silkscreen markings
    ctx.fillStyle = 'rgba(240, 248, 245, 0.55)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DMG-CGB-04', 20, 428);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
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

    // Internal Game Boy Color PCB circuit board visible through translucent polycarbonate shells
    const pcbGeo = new THREE.PlaneGeometry(2.76, 4.86);
    const pcbMat = new THREE.MeshStandardMaterial({
      map: this.createPcbTexture(),
      roughness: 0.38,
      metalness: 0.28,
    });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.position.set(0, 0, 0.08);
    this.root.add(pcbMesh);

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

    // Sculpted 3D front perimeter bevel ridge inside the viewport so full-bleed mobile still shows 3D hardware contour
    const frontRidgeShape = this.createRoundedRectShape(3.04, 5.18, 0.18, 0.50, 0.30, 0.14);
    const frontRidgeHole = this.createRoundedRectShape(2.96, 5.10, 0.16, 0.48, 0.28, 0.14);
    frontRidgeShape.holes.push(frontRidgeHole);
    const frontRidgeGeo = new THREE.ExtrudeGeometry(frontRidgeShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.018,
      bevelThickness: 0.014,
    });
    frontRidgeGeo.center();
    const frontRidgeMesh = new THREE.Mesh(frontRidgeGeo, this.shellMat);
    frontRidgeMesh.position.set(0, 0, 0.432);
    this.root.add(frontRidgeMesh);

    // Upper side grip ribs (5 sculpted horizontal ribs visible along the upper edges)
    const ribGeo = new THREE.CapsuleGeometry(0.032, 0.22, 8, 12);
    ribGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const ry = 2.36 - i * 0.11;
      const leftRib = new THREE.Mesh(ribGeo, this.shellMat);
      leftRib.position.set(-1.51, ry, 0.425);
      this.root.add(leftRib);

      const rightRib = new THREE.Mesh(ribGeo, this.shellMat);
      rightRib.position.set(1.51, ry, 0.425);
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

  private createButtonCapTextures(letter: string): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    // 3D Spherical Dome Shading Gradient (top-left specular hotspot -> deep charcoal rim)
    const domeGrad = ctx.createRadialGradient(88, 82, 14, 128, 128, 124);
    domeGrad.addColorStop(0, '#464d5a');
    domeGrad.addColorStop(0.32, '#282d35');
    domeGrad.addColorStop(0.75, '#171a20');
    domeGrad.addColorStop(1, '#0d0f13');
    ctx.fillStyle = domeGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Outer 3D Chamfer Specular Rim Ring
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(128, 128, 112, Math.PI * 0.9, Math.PI * 1.85);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.arc(128, 128, 112, Math.PI * 1.9, Math.PI * 2.85);
    ctx.stroke();

    // Recessed Molded Inner Ring around Letter
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(10, 12, 16, 0.78)';
    ctx.beginPath();
    ctx.arc(128, 128, 88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(128, 128, 85, Math.PI * 0.85, Math.PI * 1.85);
    ctx.stroke();

    // Precision Dead-Centered 3D Molded Letter ('A' / 'B') with bevel shadow & specular top edge
    ctx.font = '900 132px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Deep recessed groove shadow
    ctx.fillStyle = '#080a0d';
    ctx.fillText(letter, 125, 131);

    // Specular bottom-right catch-light inside molded letter
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillText(letter, 130, 135);

    // Crisp centered embossed letter face
    ctx.fillStyle = '#e8edf5';
    ctx.fillText(letter, 128, 133);

    const colorMap = new THREE.CanvasTexture(c);
    colorMap.colorSpace = THREE.SRGBColorSpace;

    // Matching height/bump map so 3D directional lighting interacts with the dome & molded letter
    const bc = document.createElement('canvas');
    bc.width = 256;
    bc.height = 256;
    const bctx = bc.getContext('2d')!;
    const bumpGrad = bctx.createRadialGradient(128, 128, 10, 128, 128, 124);
    bumpGrad.addColorStop(0, '#ffffff');
    bumpGrad.addColorStop(0.72, '#b8b8b8');
    bumpGrad.addColorStop(1, '#303030');
    bctx.fillStyle = bumpGrad;
    bctx.fillRect(0, 0, 256, 256);

    bctx.lineWidth = 6;
    bctx.strokeStyle = '#505050';
    bctx.beginPath();
    bctx.arc(128, 128, 88, 0, Math.PI * 2);
    bctx.stroke();

    bctx.font = '900 132px system-ui, -apple-system, sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillStyle = '#383838';
    bctx.fillText(letter, 128, 133);

    const bumpMap = new THREE.CanvasTexture(bc);
    return { colorMap, bumpMap };
  }

  private buildControls(): void {
    const darkPlasticMat = new THREE.MeshPhysicalMaterial({
      color: 0x1c1f24,
      roughness: 0.28,
      metalness: 0.14,
      clearcoat: 0.45,
      clearcoatRoughness: 0.22,
    });

    const wellMat = new THREE.MeshStandardMaterial({
      color: 0x090b0e,
      roughness: 0.82,
    });

    // --- ERGONOMICALLY LOWERED D-PAD (y = -0.96) ---
    // Deep recessed cross shadow well + beveled shell cutout on shell under the D-Pad
    const dpadWellOuterH = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.42), this.shellMat);
    const dpadWellOuterV = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.04), this.shellMat);
    dpadWellOuterH.position.set(-0.80, -0.96, 0.432);
    dpadWellOuterV.position.set(-0.80, -0.96, 0.432);
    this.root.add(dpadWellOuterH, dpadWellOuterV);

    const dpadWellH = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.36), wellMat);
    const dpadWellV = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.98), wellMat);
    dpadWellH.position.set(-0.80, -0.96, 0.434);
    dpadWellV.position.set(-0.80, -0.96, 0.434);
    this.root.add(dpadWellH, dpadWellV);

    this.dpadGroup.position.set(-0.80, -0.96, 0.465);

    // Central pivot block + circular concave thumb pivot dip (unified with arm bevel height)
    const centerMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.12, 0.137, 0.16),
      roughness: 0.26,
      metalness: 0.14,
      clearcoat: 0.48,
      clearcoatRoughness: 0.20,
    });
    const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.18), centerMat);
    const centerTop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.048), centerMat);
    centerTop.position.z = 0.092;
    this.dpadGroup.add(centerBlock, centerTop);

    const centerDipGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.048, 28);
    centerDipGeo.rotateX(Math.PI / 2);
    const centerDip = new THREE.Mesh(
      centerDipGeo,
      new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.38, metalness: 0.14 })
    );
    centerDip.position.z = 0.095;
    this.dpadGroup.add(centerDip);

    // 4 Articulated 3D Directional Arms (each arm physically depresses & darkens into the recessed well when pressed)
    const buildDpadArm = (
      dir: GBCButton,
      armCenterX: number,
      armCenterY: number,
      isVertical: boolean,
      arrowRotZ: number
    ) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(armCenterX, armCenterY, 0);

      const armMat = new THREE.MeshPhysicalMaterial({
        color: 0x1f2329,
        roughness: 0.26,
        metalness: 0.14,
        clearcoat: 0.48,
        clearcoatRoughness: 0.20,
      });
      this.dpadArmMats[dir] = armMat;

      const baseW = isVertical ? 0.30 : 0.33;
      const baseH = isVertical ? 0.33 : 0.30;
      const topW = isVertical ? 0.255 : 0.295;
      const topH = isVertical ? 0.295 : 0.255;

      const armBase = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, 0.18), armMat);
      const armBevelTop = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, 0.048), armMat);
      armBevelTop.position.z = 0.092;
      armGroup.add(armBase, armBevelTop);

      // Molded 3D tactile grip ridges on each arm
      const ridgeMat = new THREE.MeshStandardMaterial({
        color: 0x2d333d,
        roughness: 0.32,
        metalness: 0.16,
      });
      const ridgeGeo = isVertical
        ? new THREE.BoxGeometry(0.16, 0.022, 0.018)
        : new THREE.BoxGeometry(0.022, 0.16, 0.018);
      const r1 = new THREE.Mesh(ridgeGeo, ridgeMat);
      const r2 = new THREE.Mesh(ridgeGeo, ridgeMat);
      const offsetSign = dir === 'up' || dir === 'right' ? 1 : -1;
      if (isVertical) {
        r1.position.set(0, -offsetSign * 0.06, 0.118);
        r2.position.set(0, -offsetSign * 0.10, 0.118);
      } else {
        r1.position.set(-offsetSign * 0.06, 0, 0.118);
        r2.position.set(-offsetSign * 0.10, 0, 0.118);
      }
      armGroup.add(r1, r2);

      // 3D Raised Molded Directional Triangle Arrow
      const arrowMat = new THREE.MeshStandardMaterial({
        color: 0x3b424f,
        roughness: 0.24,
        metalness: 0.18,
      });
      this.dpadArrowMats[dir] = arrowMat;
      const s = new THREE.Shape();
      s.moveTo(0, 0.078);
      s.lineTo(-0.068, -0.042);
      s.lineTo(0.068, -0.042);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.026,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 2,
      });
      const arrowMesh = new THREE.Mesh(g, arrowMat);
      arrowMesh.rotation.z = arrowRotZ;
      arrowMesh.position.set(
        isVertical ? 0 : offsetSign * 0.025,
        isVertical ? offsetSign * 0.025 : 0,
        0.112
      );
      armGroup.add(arrowMesh);

      this.dpadArmGroups[dir] = armGroup;
      this.dpadGroup.add(armGroup);
    };

    buildDpadArm('up', 0, 0.30, true, 0);
    buildDpadArm('down', 0, -0.30, true, Math.PI);
    buildDpadArm('left', -0.30, 0, false, Math.PI / 2);
    buildDpadArm('right', 0.30, 0, false, -Math.PI / 2);

    // 4 directional raycast hit boxes on the D-Pad arms
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const dirs: Array<{ dir: GBCButton; x: number; y: number; w: number; h: number }> = [
      { dir: 'up', x: 0, y: 0.30, w: 0.32, h: 0.34 },
      { dir: 'down', x: 0, y: -0.30, w: 0.32, h: 0.34 },
      { dir: 'left', x: -0.30, y: 0, w: 0.34, h: 0.32 },
      { dir: 'right', x: 0.30, y: 0, w: 0.34, h: 0.32 },
    ];
    for (const d of dirs) {
      const hitGeo = new THREE.BoxGeometry(d.w, d.h, 0.28);
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(d.x, d.y, 0.06);
      hitMesh.userData = { control: d.dir };
      this.dpadGroup.add(hitMesh);
      this.interactiveMeshes.push(hitMesh);
      this.buttonMeshes[d.dir] = hitMesh;
    }

    this.root.add(this.dpadGroup);

    // --- SCULPTED 4D DOMED A & B ACTION BUTTONS (y = -0.80 and -1.08) ---
    const buildActionButton = (
      btn: 'a' | 'b',
      letter: 'A' | 'B',
      x: number,
      y: number,
      group: THREE.Group
    ) => {
      // 1. Deep 3D Recessed Socket Well + Raised Shell Bevel Collar
      const outerLipGeo = new THREE.TorusGeometry(0.258, 0.022, 16, 40);
      const outerLip = new THREE.Mesh(outerLipGeo, this.shellMat);
      outerLip.position.set(x, y, 0.434);
      outerLip.scale.set(1, 1, 0.65);

      const socketFloor = new THREE.Mesh(new THREE.CircleGeometry(0.254, 36), wellMat);
      socketFloor.position.set(x, y, 0.434);

      const socketWallGeo = new THREE.RingGeometry(0.212, 0.256, 36);
      const socketWallMat = new THREE.MeshStandardMaterial({
        color: 0x07080a,
        roughness: 0.9,
      });
      const socketWall = new THREE.Mesh(socketWallGeo, socketWallMat);
      socketWall.position.set(x, y, 0.436);
      this.root.add(outerLip, socketFloor, socketWall);

      // 2. Articulated 3D/4D Button Plunger Group (Centered at (x, y))
      group.position.set(x, y, 0.468);

      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x20242c,
        roughness: 0.20,
        metalness: 0.16,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
      });
      if (btn === 'a') this.matABody = bodyMat;
      else this.matBBody = bodyMat;

      // Cylindrical Plunger Barrel (slides deep into the recessed well)
      const barrelGeo = new THREE.CylinderGeometry(0.228, 0.242, 0.18, 40);
      barrelGeo.rotateX(Math.PI / 2);
      const barrelMesh = new THREE.Mesh(barrelGeo, bodyMat);
      barrelMesh.position.z = -0.024;
      group.add(barrelMesh);

      // 3D Rounded Bevel Shoulder Torus (catches 360-degree specular rim lighting)
      const shoulderGeo = new THREE.TorusGeometry(0.196, 0.032, 20, 44);
      const shoulderMesh = new THREE.Mesh(shoulderGeo, bodyMat);
      shoulderMesh.position.z = 0.048;
      shoulderMesh.scale.set(1, 1, 0.85);
      group.add(shoulderMesh);

      // Convex 3D Domed Crown Cap
      const domeGeo = new THREE.SphereGeometry(0.220, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.42);
      domeGeo.rotateX(Math.PI / 2);
      const domeMesh = new THREE.Mesh(domeGeo, bodyMat);
      domeMesh.scale.set(1, 1, 0.48);
      domeMesh.position.z = 0.008;
      group.add(domeMesh);

      // Precision Dead-Centered Upright 'A' / 'B' Molded Cap Face (with bump relief)
      const { colorMap, bumpMap } = this.createButtonCapTextures(letter);
      const capMat = new THREE.MeshPhysicalMaterial({
        map: colorMap,
        bumpMap,
        bumpScale: 0.026,
        roughness: 0.18,
        metalness: 0.14,
        clearcoat: 0.90,
        clearcoatRoughness: 0.10,
      });
      if (btn === 'a') this.matA = capMat;
      else this.matB = capMat;

      const capFaceGeo = new THREE.CircleGeometry(0.194, 40);
      const capFaceMesh = new THREE.Mesh(capFaceGeo, capMat);
      capFaceMesh.position.z = 0.114;
      group.add(capFaceMesh);

      // 3D Specular Crown Rim Ring around the letter face
      const crownRimGeo = new THREE.TorusGeometry(0.192, 0.011, 14, 40);
      const crownRimMat = new THREE.MeshPhysicalMaterial({
        color: 0x363d4a,
        roughness: 0.16,
        metalness: 0.24,
        clearcoat: 0.95,
      });
      const crownRimMesh = new THREE.Mesh(crownRimGeo, crownRimMat);
      crownRimMesh.position.z = 0.110;
      crownRimMesh.scale.set(1, 1, 0.6);
      group.add(crownRimMesh);

      // Raycast hit cylinder covering the full 3D button plunger
      const hitGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.26, 28);
      hitGeo.rotateX(Math.PI / 2);
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.z = 0.04;
      hitMesh.userData = { control: btn };
      group.add(hitMesh);

      this.interactiveMeshes.push(hitMesh);
      this.buttonMeshes[btn] = group;
      this.root.add(group);
    };

    buildActionButton('a', 'A', 0.94, -0.80, this.btnAGroup);
    buildActionButton('b', 'B', 0.38, -1.08, this.btnBGroup);

    // --- ERGONOMICALLY LOWERED SELECT & START RUBBER PILLS (y = -1.92) ---
    // Tight, rounded stadium/capsule molded shell bezels & razor-tight capsule seams (zero black rectangles)
    const pillBezelGeo = new THREE.CapsuleGeometry(0.066, 0.224, 12, 20);
    pillBezelGeo.rotateZ(Math.PI / 2);
    pillBezelGeo.scale(1, 1, 0.22);
    const selectBezel = new THREE.Mesh(pillBezelGeo, this.shellMat);
    selectBezel.position.set(-0.26, -1.92, 0.432);
    const startBezel = new THREE.Mesh(pillBezelGeo, this.shellMat);
    startBezel.position.set(0.26, -1.92, 0.432);
    this.root.add(selectBezel, startBezel);

    const pillSeamGeo = new THREE.CapsuleGeometry(0.056, 0.216, 12, 20);
    pillSeamGeo.rotateZ(Math.PI / 2);
    pillSeamGeo.scale(1, 1, 0.12);
    const pillSeamMat = new THREE.MeshStandardMaterial({
      color: 0x1e222a,
      roughness: 0.78,
    });
    const selectSeam = new THREE.Mesh(pillSeamGeo, pillSeamMat);
    selectSeam.position.set(-0.26, -1.92, 0.435);
    const startSeam = new THREE.Mesh(pillSeamGeo, pillSeamMat);
    startSeam.position.set(0.26, -1.92, 0.435);
    this.root.add(selectSeam, startSeam);

    const pillGeo = new THREE.CapsuleGeometry(0.053, 0.212, 14, 24);
    pillGeo.rotateZ(Math.PI / 2);
    this.matSelect = new THREE.MeshStandardMaterial({
      color: 0x767e8a,
      roughness: 0.42,
      metalness: 0.06,
    });
    this.matStart = new THREE.MeshStandardMaterial({
      color: 0x767e8a,
      roughness: 0.42,
      metalness: 0.06,
    });

    this.btnSelectMesh = new THREE.Mesh(pillGeo, this.matSelect);
    this.btnSelectMesh.position.set(-0.26, -1.92, 0.446);
    this.btnSelectMesh.userData = { control: 'select' };
    this.interactiveMeshes.push(this.btnSelectMesh);
    this.buttonMeshes.select = this.btnSelectMesh;
    this.root.add(this.btnSelectMesh);

    this.btnStartMesh = new THREE.Mesh(pillGeo, this.matStart);
    this.btnStartMesh.position.set(0.26, -1.92, 0.446);
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
    this.shellMat.transparent = Boolean(theme.transmission && theme.transmission > 0);
    this.shellMat.opacity = theme.opacity ?? 1.0;
    this.shellMat.transmission = theme.transmission ?? 0;
    this.shellMat.thickness = theme.transmission ? 0.5 : 0;
    this.shellMat.clearcoat = theme.transmission ? 0.85 : 0.48;
    this.shellMat.needsUpdate = true;
  }

  setMobileFullBleed(enabled: boolean, minHeightWorld = 5.4): void {
    if (!this.bodyMesh) return;
    if (enabled) {
      const scaleY = Math.max(1.03, minHeightWorld / 5.25);
      this.bodyMesh.scale.set(1.02, scaleY, 1);
    } else {
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

  isButtonPressed(btn: GBCButton): boolean {
    return this.buttonTargets[btn] > 0.5;
  }

  setButtonHover(btn: GBCButton, hovered: boolean): void {
    this.buttonHover[btn] = hovered ? 1 : 0;
  }

  setDpadSlideVector(nx: number, ny: number): void {
    this.dpadSlideX = Math.max(-1, Math.min(1, nx));
    this.dpadSlideY = Math.max(-1, Math.min(1, ny));
  }

  setActionButtonTilt(btn: 'a' | 'b', tx: number, ty: number): void {
    const cx = Math.max(-1, Math.min(1, tx));
    const cy = Math.max(-1, Math.min(1, ty));
    if (btn === 'a') {
      this.btnATiltX = cy;
      this.btnATiltY = cx;
    } else {
      this.btnBTiltX = cy;
      this.btnBTiltY = cx;
    }
  }

  update(dt: number): void {
    const speed = Math.min(1, dt * 24);
    (Object.keys(this.buttonTargets) as GBCButton[]).forEach((k) => {
      this.buttonCurrent[k] += (this.buttonTargets[k] - this.buttonCurrent[k]) * speed;
      this.hoverCurrent[k] += (this.buttonHover[k] - this.hoverCurrent[k]) * speed;
    });

    // D-Pad 3D directional rocker + continuous 360-degree angle sliding + per-arm physical depression
    const discreteDirX = this.buttonCurrent.right - this.buttonCurrent.left;
    const discreteDirY = this.buttonCurrent.down - this.buttonCurrent.up;
    const hasSlide = Math.hypot(this.dpadSlideX, this.dpadSlideY) > 0.05;
    const effDirX = hasSlide ? this.dpadSlideX : discreteDirX;
    const effDirY = hasSlide ? this.dpadSlideY : discreteDirY;

    const pressTiltX = effDirY * 0.24;
    const pressTiltY = effDirX * 0.24;
    const hoverTiltX = (this.hoverCurrent.down - this.hoverCurrent.up) * 0.07;
    const hoverTiltY = (this.hoverCurrent.right - this.hoverCurrent.left) * 0.07;
    this.dpadGroup.rotation.x = pressTiltX + hoverTiltX;
    this.dpadGroup.rotation.y = pressTiltY + hoverTiltY;

    const dpadDepress = Math.max(
      this.buttonCurrent.up,
      this.buttonCurrent.down,
      this.buttonCurrent.left,
      this.buttonCurrent.right,
      Math.min(1, Math.hypot(this.dpadSlideX, this.dpadSlideY))
    );
    const dpadHover = Math.max(
      this.hoverCurrent.up,
      this.hoverCurrent.down,
      this.hoverCurrent.left,
      this.hoverCurrent.right
    );
    this.dpadGroup.position.x = -0.80 + effDirX * 0.022;
    this.dpadGroup.position.y = -0.96 - effDirY * 0.022;
    this.dpadGroup.position.z = 0.476 + dpadHover * 0.012 - dpadDepress * 0.020;

    const oppMap: Record<'up' | 'down' | 'left' | 'right', 'up' | 'down' | 'left' | 'right'> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };

    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const armGroup = this.dpadArmGroups[dir];
      const armMat = this.dpadArmMats[dir];
      const arrowMat = this.dpadArrowMats[dir];
      const p = this.buttonCurrent[dir];
      const opp = this.buttonCurrent[oppMap[dir]];
      const h = this.hoverCurrent[dir];

      if (armGroup) {
        // Pressed arm physically sinks into the recessed well while staying proud of the well floor (z > 0.434)
        armGroup.position.z = -p * 0.018 + opp * 0.014 + h * 0.006;
        armGroup.scale.set(1 - p * 0.03, 1 - p * 0.03, 1 - p * 0.16);
      }
      if (armMat) {
        // Natural shadow darkening when depressed into the well, top-light catch when lifted
        const shade = Math.max(0.56, Math.min(1.32, 1.0 - p * 0.40 + opp * 0.25 + h * 0.12));
        armMat.color.setRGB(0.12 * shade, 0.137 * shade, 0.16 * shade);
      }
      if (arrowMat) {
        const arrowShade = Math.max(0.50, Math.min(1.38, 1.0 - p * 0.44 + opp * 0.28 + h * 0.15));
        arrowMat.color.setRGB(0.23 * arrowShade, 0.26 * arrowShade, 0.31 * arrowShade);
        arrowMat.emissive.setHex(0x000000);
        arrowMat.emissiveIntensity = 0;
      }
    }

    // 4D Domed A & B Plunger Buttons: deep Z-plunge + 3D socket tilt + natural occlusion shading
    const pA = this.buttonCurrent.a;
    const hA = this.hoverCurrent.a;
    this.btnAGroup.position.z = 0.468 + hA * 0.018 - pA * 0.088;
    this.btnAGroup.rotation.x = pA * (0.14 + this.btnATiltX * 0.22) - hA * 0.05;
    this.btnAGroup.rotation.y = pA * (-0.12 + this.btnATiltY * 0.22) + hA * 0.04;
    const scaleA = 1 + hA * 0.025 - pA * 0.032;
    this.btnAGroup.scale.set(scaleA, scaleA, 1 - pA * 0.14);
    const shadeA = 1 - pA * 0.26 + hA * 0.08;
    this.matA.color.setRGB(shadeA, shadeA, shadeA);
    this.matABody.color.setRGB(0.125 * shadeA, 0.14 * shadeA, 0.172 * shadeA);

    const pB = this.buttonCurrent.b;
    const hB = this.hoverCurrent.b;
    this.btnBGroup.position.z = 0.468 + hB * 0.018 - pB * 0.088;
    this.btnBGroup.rotation.x = pB * (0.14 + this.btnBTiltX * 0.22) - hB * 0.05;
    this.btnBGroup.rotation.y = pB * (-0.12 + this.btnBTiltY * 0.22) + hB * 0.04;
    const scaleB = 1 + hB * 0.025 - pB * 0.032;
    this.btnBGroup.scale.set(scaleB, scaleB, 1 - pB * 0.14);
    const shadeB = 1 - pB * 0.26 + hB * 0.08;
    this.matB.color.setRGB(shadeB, shadeB, shadeB);
    this.matBBody.color.setRGB(0.125 * shadeB, 0.14 * shadeB, 0.172 * shadeB);

    // Select / Start rubber pill tactile squish into rounded capsule seams
    const pSel = this.buttonCurrent.select;
    const hSel = this.hoverCurrent.select;
    this.btnSelectMesh.position.z = 0.446 + hSel * 0.014 - pSel * 0.052;
    this.btnSelectMesh.scale.set(1, 1, 1 - pSel * 0.30);
    const shadeSel = 1 - pSel * 0.35 + hSel * 0.10;
    this.matSelect.color.setRGB(0.46 * shadeSel, 0.49 * shadeSel, 0.54 * shadeSel);

    const pStart = this.buttonCurrent.start;
    const hStart = this.hoverCurrent.start;
    this.btnStartMesh.position.z = 0.446 + hStart * 0.014 - pStart * 0.052;
    this.btnStartMesh.scale.set(1, 1, 1 - pStart * 0.30);
    const shadeStart = 1 - pStart * 0.35 + hStart * 0.10;
    this.matStart.color.setRGB(0.46 * shadeStart, 0.49 * shadeStart, 0.54 * shadeStart);

    // Power switch position
    const targetSwitchY = this.isPowered ? 1.62 : 1.48;
    this.powerSwitchMesh.position.y += (targetSwitchY - this.powerSwitchMesh.position.y) * speed;
  }
}
