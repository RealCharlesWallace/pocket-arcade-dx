import {
  drawGBCBox,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

interface PlatformBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'GROUND' | 'BRICK' | 'QBLOCK' | 'PIPE' | 'GOAL';
  used?: boolean;
}

interface Goomba {
  x: number;
  y: number;
  vx: number;
  alive: boolean;
}

interface Coin {
  x: number;
  y: number;
  taken: boolean;
}

interface Fireball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const state = {
  ctx: null as unknown as GameContext,
  stage: 1,
  px: 24,
  py: 100,
  vx: 0,
  vy: 0,
  onGround: false,
  facingRight: true,
  score: 0,
  coins: 0,
  lives: 3,
  camX: 0,
  blocks: [] as PlatformBlock[],
  enemies: [] as Goomba[],
  coinItems: [] as Coin[],
  fireballs: [] as Fireball[],
  stageClearTimer: 0,
  time: 0,
};

export const superPixelLandCartridge: GameCartridge = {
  id: 'super-pixel-land',
  title: 'SUPER PIXEL LAND',
  subtitle: 'SARASALAND DX',
  genre: 'PLATFORM',
  description: 'Run, jump, hit ?-blocks, throw Super Balls, stomp enemies, and reach the Goal Gate!',
  cartridgeColor: '#f0c020',
  labelColor: '#283888',
  accentColor: '#f84848',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    ctx.fillStyle = '#5898f8';
    ctx.fillRect(x, y, w, h);

    // ? Block + Bouncing Super Mushroom
    const bounce = Math.round(Math.abs(Math.sin(time * 5)) * 3);
    const bx = x + Math.floor(w / 2) - 8;
    const by = y + 8 - bounce;
    ctx.fillStyle = '#f8b820';
    ctx.fillRect(bx, by, 16, 16);
    ctx.strokeStyle = '#181818';
    ctx.strokeRect(bx, by, 16, 16);
    drawPixelText(ctx, '?', bx + 5, by + 4, { color: '#181818', size: 8 });
  },

  init(context: GameContext) {
    state.ctx = context;
    state.stage = 1;
    state.score = 0;
    state.coins = 0;
    state.lives = 3;
    buildStage(1);
    context.audio.startBGM('platformer');
  },

  update(dt: number, input: InputState) {
    state.time += dt;

    if (state.stageClearTimer > 0) {
      state.stageClearTimer -= dt;
      if (state.stageClearTimer <= 0) {
        state.stage = (state.stage % 3) + 1;
        buildStage(state.stage);
      }
      return;
    }

    const maxSpeed = input.held.b ? 96 : 68;
    if (input.held.left) {
      state.vx = -maxSpeed;
      state.facingRight = false;
    } else if (input.held.right) {
      state.vx = maxSpeed;
      state.facingRight = true;
    } else {
      state.vx *= 0.78;
    }

    // Jump (A button)
    if (input.justPressed.a && state.onGround) {
      state.vy = -215;
      state.onGround = false;
      state.ctx.audio.playJump();
    }

    // Super Ball Shot (B button)
    if (input.justPressed.b && state.fireballs.length < 2) {
      state.fireballs.push({
        x: state.px + (state.facingRight ? 10 : -4),
        y: state.py + 4,
        vx: state.facingRight ? 150 : -150,
        vy: 55,
      });
      state.ctx.audio.playButtonClick();
    }

    // Horizontal motion + collision
    state.px += state.vx * dt;
    if (state.px < 4) state.px = 4;

    for (const b of state.blocks) {
      if (b.type === 'GOAL') continue;
      if (rectOverlap(state.px, state.py, 10, 12, b.x, b.y, b.w, b.h)) {
        if (state.vx > 0) state.px = b.x - 10;
        else if (state.vx < 0) state.px = b.x + b.w;
      }
    }

    // Vertical motion + gravity
    state.vy += 470 * dt;
    state.py += state.vy * dt;
    state.onGround = false;

    for (const b of state.blocks) {
      if (!rectOverlap(state.px, state.py, 10, 12, b.x, b.y, b.w, b.h)) continue;

      if (b.type === 'GOAL') {
        state.score += 500;
        state.ctx.storage.setHighScore('super-pixel-land', state.score);
        state.ctx.audio.playPowerUp();
        state.stageClearTimer = 1.4;
        return;
      }

      if (state.vy > 0) {
        state.py = b.y - 12;
        state.vy = 0;
        state.onGround = true;
      } else if (state.vy < 0) {
        state.py = b.y + b.h;
        state.vy = 10;
        if (b.type === 'QBLOCK' && !b.used) {
          b.used = true;
          state.coins++;
          state.score += 100;
          state.ctx.storage.setHighScore('super-pixel-land', state.score);
          state.ctx.audio.playCoin();
        }
      }
    }

    // Pitfall check
    if (state.py > 152) {
      loseLife();
      return;
    }

    // Coin collection
    for (const c of state.coinItems) {
      if (!c.taken && rectOverlap(state.px, state.py, 10, 12, c.x, c.y, 8, 8)) {
        c.taken = true;
        state.coins++;
        state.score += 50;
        state.ctx.storage.setHighScore('super-pixel-land', state.score);
        state.ctx.audio.playCoin();
      }
    }

    // Fireballs update
    for (let i = state.fireballs.length - 1; i >= 0; i--) {
      const fb = state.fireballs[i];
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      if (fb.y >= 120) fb.vy = -Math.abs(fb.vy);

      let hit = false;
      for (const en of state.enemies) {
        if (en.alive && rectOverlap(fb.x, fb.y, 4, 4, en.x, en.y, 12, 11)) {
          en.alive = false;
          state.score += 150;
          state.ctx.storage.setHighScore('super-pixel-land', state.score);
          state.ctx.audio.playHit();
          hit = true;
          break;
        }
      }
      if (hit || Math.abs(fb.x - state.px) > 150) {
        state.fireballs.splice(i, 1);
      }
    }

    // Enemies update
    for (const en of state.enemies) {
      if (!en.alive) continue;
      en.x += en.vx * dt;

      // Turn around at edges
      if (Math.sin(state.time * 1.5 + en.x * 0.01) > 0.98) en.vx *= -1;

      if (rectOverlap(state.px, state.py, 10, 12, en.x, en.y, 12, 11)) {
        if (state.vy > 0 && state.py + 12 - en.y <= 7) {
          // Stomp!
          en.alive = false;
          state.vy = -155;
          state.score += 100;
          state.ctx.storage.setHighScore('super-pixel-land', state.score);
          state.ctx.audio.playCoin();
        } else {
          loseLife();
          return;
        }
      }
    }

    state.camX = Math.max(0, state.px - 52);
  },

  render(ctx: CanvasRenderingContext2D) {
    // Sky backdrop (varies by stage)
    const skies = ['#78c8f8', '#f8a868', '#182448'];
    ctx.fillStyle = skies[(state.stage - 1) % skies.length];
    ctx.fillRect(0, 0, 160, 144);

    // Parallax Pyramids / Clouds in background
    ctx.fillStyle = state.stage === 3 ? '#283868' : '#d8e8f8';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 80 - state.camX * 0.3) % 420 + 420) % 420 - 40;
      ctx.fillRect(Math.round(cx), 34 + (i % 2) * 12, 24, 8);
    }

    ctx.save();
    ctx.translate(-Math.round(state.camX), 0);

    // Blocks & Platforms
    for (const b of state.blocks) {
      if (b.type === 'GROUND') {
        ctx.fillStyle = '#38a838';
        ctx.fillRect(b.x, b.y, b.w, 4);
        ctx.fillStyle = '#c87838';
        ctx.fillRect(b.x, b.y + 4, b.w, b.h - 4);
      } else if (b.type === 'BRICK') {
        ctx.fillStyle = '#b85828';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#181818';
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      } else if (b.type === 'QBLOCK') {
        ctx.fillStyle = b.used ? '#887868' : '#f8c828';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#181818';
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        if (!b.used) {
          drawPixelText(ctx, '?', b.x + 4, b.y + 3, { color: '#181818', size: 6 });
        }
      } else if (b.type === 'PIPE') {
        ctx.fillStyle = '#28b838';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#68f068';
        ctx.fillRect(b.x + 2, b.y, 4, b.h);
        ctx.strokeStyle = '#181818';
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      } else if (b.type === 'GOAL') {
        ctx.fillStyle = '#f8f8f0';
        ctx.fillRect(b.x + 4, b.y, 4, b.h);
        ctx.fillStyle = '#f83838';
        ctx.fillRect(b.x - 8, b.y + 4, 14, 10);
      }
    }

    // Coins
    ctx.fillStyle = '#f8e030';
    for (const c of state.coinItems) {
      if (c.taken) continue;
      ctx.fillRect(c.x + 1, c.y, 6, 8);
    }

    // Enemies
    for (const en of state.enemies) {
      if (!en.alive) continue;
      ctx.fillStyle = '#a84020';
      ctx.fillRect(Math.round(en.x), Math.round(en.y), 12, 9);
      ctx.fillStyle = '#181818';
      ctx.fillRect(Math.round(en.x + 2), Math.round(en.y + 9), 3, 3);
      ctx.fillRect(Math.round(en.x + 7), Math.round(en.y + 9), 3, 3);
    }

    // Fireballs
    ctx.fillStyle = '#f84828';
    for (const fb of state.fireballs) {
      ctx.fillRect(Math.round(fb.x), Math.round(fb.y), 4, 4);
    }

    // Player Hero
    const px = Math.round(state.px);
    const py = Math.round(state.py);
    ctx.fillStyle = '#e82828'; // Cap & shirt
    ctx.fillRect(px + 1, py, 8, 4);
    ctx.fillStyle = '#f8c898'; // Face
    ctx.fillRect(px + 1, py + 3, 8, 4);
    ctx.fillStyle = '#2858d8'; // Overalls
    ctx.fillRect(px + 1, py + 7, 8, 5);

    ctx.restore();

    // Top HUD
    ctx.fillStyle = 'rgba(16, 20, 24, 0.8)';
    ctx.fillRect(0, 0, 160, 13);
    drawPixelText(ctx, `W1-${state.stage}`, 4, 4, { color: '#f8e848', size: 5 });
    drawPixelText(ctx, `COIN:${state.coins}`, 44, 4, { color: '#f8f8f0', size: 5 });
    drawPixelText(ctx, `PTS:${state.score}`, 96, 4, { color: '#58f888', size: 5 });

    if (state.stageClearTimer > 0) {
      drawGBCBox(ctx, 24, 52, 112, 36);
      drawPixelText(ctx, `WORLD 1-${state.stage} CLEAR!`, 80, 62, { color: '#182018', size: 6, align: 'center' });
      drawPixelText(ctx, '+500 BONUS PTS', 80, 74, { color: '#287838', size: 5, align: 'center' });
    }
  },
};

function buildStage(stageNum: number): void {
  state.px = 20;
  state.py = 100;
  state.vx = 0;
  state.vy = 0;
  state.camX = 0;
  state.blocks = [];
  state.enemies = [];
  state.coinItems = [];
  state.fireballs = [];

  // Ground segments with jumpable gaps
  const segments = [
    { x: 0, w: 190 },
    { x: 214, w: 170 },
    { x: 408, w: 220 },
  ];
  for (const s of segments) {
    state.blocks.push({ x: s.x, y: 124, w: s.w, h: 24, type: 'GROUND' });
  }

  // Question blocks, bricks & pipes
  for (let x = 64; x < 520; x += 68) {
    state.blocks.push({ x, y: 88, w: 12, h: 12, type: 'BRICK' });
    state.blocks.push({ x: x + 12, y: 88, w: 12, h: 12, type: 'QBLOCK' });
    state.blocks.push({ x: x + 24, y: 88, w: 12, h: 12, type: 'BRICK' });

    state.coinItems.push({ x: x + 4, y: 72, taken: false });
    state.coinItems.push({ x: x + 16, y: 72, taken: false });

    state.enemies.push({
      x: x + 24,
      y: 112,
      vx: -24 - stageNum * 6,
      alive: true,
    });
  }

  state.blocks.push({ x: 140, y: 102, w: 18, h: 22, type: 'PIPE' });
  state.blocks.push({ x: 310, y: 98, w: 18, h: 26, type: 'PIPE' });
  state.blocks.push({ x: 560, y: 54, w: 12, h: 70, type: 'GOAL' });
}

function loseLife(): void {
  state.ctx.audio.playHit();
  state.lives--;
  if (state.lives <= 0) {
    state.lives = 3;
    state.score = 0;
  }
  buildStage(state.stage);
}

function rectOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
