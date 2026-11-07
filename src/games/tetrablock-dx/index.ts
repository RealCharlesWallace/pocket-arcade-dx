import {
  drawGBCBox,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

const COLS = 10;
const ROWS = 20;
const CELL = 6; // 10x20 grid at 6x6px = 60x120px playfield

interface TetrominoDef {
  color: string;
  matrix: number[][];
}

const SHAPES: TetrominoDef[] = [
  { color: '#38d8f8', matrix: [[1, 1, 1, 1]] }, // I
  { color: '#f8d828', matrix: [[1, 1], [1, 1]] }, // O
  { color: '#b848f8', matrix: [[0, 1, 0], [1, 1, 1]] }, // T
  { color: '#48e848', matrix: [[0, 1, 1], [1, 1, 0]] }, // S
  { color: '#f83848', matrix: [[1, 1, 0], [0, 1, 1]] }, // Z
  { color: '#3878f8', matrix: [[1, 0, 0], [1, 1, 1]] }, // J
  { color: '#f88828', matrix: [[0, 0, 1], [1, 1, 1]] }, // L
];

const state = {
  ctx: null as unknown as GameContext,
  board: [] as (string | null)[][],
  curMatrix: [] as number[][],
  curColor: '#38d8f8',
  curX: 3,
  curY: 0,
  nextIdx: 0,
  score: 0,
  lines: 0,
  level: 1,
  dropTimer: 0,
  dasTimer: 0,
  gameOver: false,
};

export const tetrablockDxCartridge: GameCartridge = {
  id: 'tetrablock-dx',
  title: 'TETRABLOCK DX',
  subtitle: 'MARATHON PUZZLE',
  genre: 'PUZZLE',
  description: 'Stack color-coded GBC Tetrominoes, use Ghost Preview & Hard Drop, and clear 4-line Tetrises!',
  cartridgeColor: '#8838d8',
  labelColor: '#201838',
  accentColor: '#f8c838',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    ctx.fillStyle = '#181428';
    ctx.fillRect(x, y, w, h);

    const pulse = Math.floor(time * 3) % 2 === 0;
    // T-piece + L-piece
    const cx = x + 8;
    const cy = y + 8;
    ctx.fillStyle = pulse ? '#b848f8' : '#38d8f8';
    ctx.fillRect(cx + 6, cy, 6, 6);
    ctx.fillRect(cx, cy + 6, 18, 6);

    ctx.fillStyle = '#f8d828';
    ctx.fillRect(cx + 12, cy + 14, 12, 12);
  },

  init(context: GameContext) {
    state.ctx = context;
    resetGame();
    context.audio.startBGM('tetris');
  },

  update(dt: number, input: InputState) {
    if (state.gameOver) {
      if (input.justPressed.a || input.justPressed.start) {
        state.ctx.audio.playMenuSelect();
        resetGame();
      }
      return;
    }

    // Horizontal move + auto-repeat
    if (input.justPressed.left) {
      tryMove(-1, 0);
      state.dasTimer = 0.18;
    } else if (input.justPressed.right) {
      tryMove(1, 0);
      state.dasTimer = 0.18;
    } else if (input.held.left || input.held.right) {
      state.dasTimer -= dt;
      if (state.dasTimer <= 0) {
        tryMove(input.held.left ? -1 : 1, 0);
        state.dasTimer = 0.06;
      }
    }

    // Rotate CW (A) / CCW (B)
    if (input.justPressed.a) {
      rotateCurrent(true);
    } else if (input.justPressed.b) {
      rotateCurrent(false);
    }

    // Hard Drop (Up)
    if (input.justPressed.up) {
      let dropped = 0;
      while (canPlace(state.curMatrix, state.curX, state.curY + 1)) {
        state.curY++;
        dropped++;
      }
      state.score += dropped * 2;
      state.ctx.audio.playButtonClick();
      lockPiece();
      return;
    }

    // Gravity / Soft Drop (Down)
    const interval = input.held.down ? 0.045 : Math.max(0.1, 0.65 - (state.level - 1) * 0.055);
    state.dropTimer += dt;
    if (state.dropTimer >= interval) {
      state.dropTimer = 0;
      if (!tryMove(0, 1)) {
        lockPiece();
      } else if (input.held.down) {
        state.score += 1;
      }
    }
  },

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#181828';
    ctx.fillRect(0, 0, 160, 144);

    // Playfield Frame (x=14, y=12, w=64, h=124)
    const bx = 14;
    const by = 12;
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(bx - 2, by - 2, COLS * CELL + 4, ROWS * CELL + 4);
    ctx.strokeStyle = '#6878a8';
    ctx.strokeRect(bx - 1.5, by - 1.5, COLS * CELL + 3, ROWS * CELL + 3);

    // Subtle grid dots
    ctx.fillStyle = '#222438';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillRect(bx + c * CELL + 2, by + r * CELL + 2, 1, 1);
      }
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const col = state.board[r][c];
        if (col) {
          drawBlockCell(ctx, bx + c * CELL, by + r * CELL, col);
        }
      }
    }

    // Ghost piece preview
    if (!state.gameOver) {
      let ghostY = state.curY;
      while (canPlace(state.curMatrix, state.curX, ghostY + 1)) {
        ghostY++;
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      for (let r = 0; r < state.curMatrix.length; r++) {
        for (let c = 0; c < state.curMatrix[r].length; c++) {
          if (state.curMatrix[r][c]) {
            ctx.strokeRect(
              bx + (state.curX + c) * CELL + 0.5,
              by + (ghostY + r) * CELL + 0.5,
              CELL - 1,
              CELL - 1
            );
          }
        }
      }

      // Active piece
      for (let r = 0; r < state.curMatrix.length; r++) {
        for (let c = 0; c < state.curMatrix[r].length; c++) {
          if (state.curMatrix[r][c]) {
            drawBlockCell(ctx, bx + (state.curX + c) * CELL, by + (state.curY + r) * CELL, state.curColor);
          }
        }
      }
    }

    // Right Sidebar HUD
    drawGBCBox(ctx, 84, 10, 70, 42, { bg: '#141824', borderOuter: '#586898' });
    drawPixelText(ctx, 'NEXT', 92, 15, { color: '#98b8f8', size: 5 });
    const nextDef = SHAPES[state.nextIdx];
    for (let r = 0; r < nextDef.matrix.length; r++) {
      for (let c = 0; c < nextDef.matrix[r].length; c++) {
        if (nextDef.matrix[r][c]) {
          drawBlockCell(ctx, 104 + c * CELL, 26 + r * CELL, nextDef.color);
        }
      }
    }

    drawGBCBox(ctx, 84, 56, 70, 78, { bg: '#141824', borderOuter: '#586898' });
    drawPixelText(ctx, 'SCORE', 90, 62, { color: '#f8d838', size: 5 });
    drawPixelText(ctx, String(state.score), 90, 72, { color: '#ffffff', size: 6 });

    drawPixelText(ctx, 'LINES', 90, 88, { color: '#58f888', size: 5 });
    drawPixelText(ctx, String(state.lines), 90, 98, { color: '#ffffff', size: 6 });

    drawPixelText(ctx, `LV.${state.level}`, 90, 114, { color: '#f88848', size: 6 });

    if (state.gameOver) {
      drawGBCBox(ctx, 18, 48, 124, 46, { bg: '#181420', borderOuter: '#f83848' });
      drawPixelText(ctx, 'GAME OVER', 80, 56, { color: '#f84848', size: 7, align: 'center' });
      drawPixelText(ctx, 'PRESS A TO RETRY', 80, 74, { color: '#f8f8f0', size: 5, align: 'center' });
    }
  },
};

function drawBlockCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, CELL - 1, 1);
  ctx.fillRect(x, y, 1, CELL - 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + CELL - 1, y, 1, CELL);
  ctx.fillRect(x, y + CELL - 1, CELL, 1);
}

function resetGame(): void {
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.gameOver = false;
  state.nextIdx = Math.floor(Math.random() * SHAPES.length);
  spawnNextPiece();
}

function spawnNextPiece(): void {
  const def = SHAPES[state.nextIdx];
  state.nextIdx = Math.floor(Math.random() * SHAPES.length);
  state.curMatrix = def.matrix.map((r) => [...r]);
  state.curColor = def.color;
  state.curX = Math.floor((COLS - state.curMatrix[0].length) / 2);
  state.curY = 0;

  if (!canPlace(state.curMatrix, state.curX, state.curY)) {
    state.gameOver = true;
    state.ctx.audio.playHit();
  }
}

function canPlace(matrix: number[][], tx: number, ty: number): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const nx = tx + c;
      const ny = ty + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && state.board[ny][nx] !== null) return false;
    }
  }
  return true;
}

function tryMove(dx: number, dy: number): boolean {
  if (canPlace(state.curMatrix, state.curX + dx, state.curY + dy)) {
    state.curX += dx;
    state.curY += dy;
    if (dx !== 0) state.ctx.audio.playButtonClick();
    return true;
  }
  return false;
}

function rotateCurrent(cw: boolean): void {
  const R = state.curMatrix.length;
  const C = state.curMatrix[0].length;
  const rotated: number[][] = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (cw) {
        rotated[c][R - 1 - r] = state.curMatrix[r][c];
      } else {
        rotated[C - 1 - c][r] = state.curMatrix[r][c];
      }
    }
  }

  // Wall-kick offsets
  for (const offset of [0, -1, 1, -2, 2]) {
    if (canPlace(rotated, state.curX + offset, state.curY)) {
      state.curMatrix = rotated;
      state.curX += offset;
      state.ctx.audio.playMenuMove();
      return;
    }
  }
}

function lockPiece(): void {
  for (let r = 0; r < state.curMatrix.length; r++) {
    for (let c = 0; c < state.curMatrix[r].length; c++) {
      if (!state.curMatrix[r][c]) continue;
      const ny = state.curY + r;
      const nx = state.curX + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        state.board[ny][nx] = state.curColor;
      }
    }
  }

  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r].every((cell) => cell !== null)) {
      state.board.splice(r, 1);
      state.board.unshift(Array(COLS).fill(null));
      cleared++;
      r++;
    }
  }

  if (cleared > 0) {
    const pts = [0, 100, 300, 500, 800][cleared] ?? 800;
    state.score += pts * state.level;
    state.lines += cleared;
    state.level = 1 + Math.floor(state.lines / 8);
    state.ctx.storage.setHighScore('tetrablock-dx', state.score);
    state.ctx.audio.playLineClear();
  } else {
    state.ctx.audio.playButtonClick();
  }

  spawnNextPiece();
}
