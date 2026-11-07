export const GBC_WIDTH = 160;
export const GBC_HEIGHT = 144;
export const GBC_SCALE = 4; // 640x576 internal canvas for razor-sharp text & sprites

/**
 * Draw crisp pixel-aligned text in native 160x144 GBC logical coordinates.
 */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    color?: string;
    size?: number;
    align?: CanvasTextAlign;
    shadow?: string;
  } = {}
): void {
  const { color = '#f8f8f0', size = 6, align = 'left', shadow } = options;
  ctx.save();
  ctx.font = `bold ${size}px "Press Start 2P", ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.restore();
}

/**
 * Draw a classic Game Boy RPG / Menu double-bordered dialogue box.
 */
export function drawGBCBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options: {
    bg?: string;
    borderOuter?: string;
    borderInner?: string;
  } = {}
): void {
  const {
    bg = '#f8f6e8',
    borderOuter = '#182018',
    borderInner = '#687868',
  } = options;

  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  ctx.fillStyle = borderOuter;
  ctx.fillRect(rx, ry, rw, rh);

  ctx.fillStyle = bg;
  ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);

  ctx.strokeStyle = borderInner;
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 2.5, ry + 2.5, rw - 5, rh - 5);
}

/**
 * Draw a pixel-art sprite from an ASCII string matrix and color map.
 */
export function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Record<string, string>,
  x: number,
  y: number,
  pixelSize = 1,
  flipX = false
): void {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      const drawCol = flipX ? w - 1 - c : c;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(x + drawCol * pixelSize),
        Math.round(y + r * pixelSize),
        pixelSize,
        pixelSize
      );
    }
  }
}

/**
 * Draw a retro GBC health or progress bar.
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  options: {
    bg?: string;
    border?: string;
    fillHigh?: string;
    fillMid?: string;
    fillLow?: string;
  } = {}
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  const {
    bg = '#222624',
    border = '#101412',
    fillHigh = '#38d858',
    fillMid = '#f8c830',
    fillLow = '#e83838',
  } = options;

  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = bg;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

  const fillColor = clamped > 0.5 ? fillHigh : clamped > 0.22 ? fillMid : fillLow;
  const innerW = Math.round((w - 2) * clamped);
  if (innerW > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 1, y + 1, innerW, h - 2);
  }
}

/**
 * Subtle LCD scanline / pixel grid pass over the 640x576 screen canvas for authentic GBC feel.
 */
export function drawLCDSubpixelOverlay(ctx: CanvasRenderingContext2D, fullW: number, fullH: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < fullH; y += 4) {
    ctx.fillRect(0, y, fullW, 1);
  }
  ctx.restore();
}
