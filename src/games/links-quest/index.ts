import {
  drawGBCBox,
  drawPixelSprite,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  isBoss?: boolean;
  hurtTimer: number;
}

interface RoomData {
  name: string;
  bg: string;
  wallColor: string;
  tiles: string[]; // 10 cols x 8 rows (16x16 tiles, top 16px is HUD)
  enemies: Enemy[];
  chestOpened?: boolean;
  doorUnlocked?: boolean;
}

const HERO_SPRITE = [
  '..GGGGGG..',
  '.GGGGGGGG.',
  '.SSSSSSSS.',
  '.SKS..SKS.',
  '..SSSSSS..',
  '.GGGGGGGG.',
  'GGGGGGGGGG',
  'SS.GGGG.SS',
  '..BBBBBB..',
  '..BB..BB..',
];

const state = {
  ctx: null as unknown as GameContext,
  roomIdx: 0,
  rooms: [] as RoomData[],
  px: 72,
  py: 96,
  facing: 'up' as 'up' | 'down' | 'left' | 'right',
  hp: 6, // 3 hearts = 6 half-hearts
  maxHp: 6,
  rupees: 0,
  keys: 0,
  swordTimer: 0,
  dashTimer: 0,
  invulnTimer: 0,
  boomerang: null as { x: number; y: number; vx: number; vy: number; returning: boolean } | null,
  bannerText: '',
  bannerTimer: 0,
  wonDungeon: false,
  time: 0,
};

export const linksQuestCartridge: GameCartridge = {
  id: 'links-quest',
  title: "LINK'S QUEST DX",
  subtitle: 'AWAKENING ISLAND',
  genre: 'ADVENTURE',
  description: 'Slash monsters, find dungeon keys, throw your boomerang, and defeat the Temple Boss!',
  cartridgeColor: '#d4af37',
  labelColor: '#1b3b22',
  accentColor: '#58e878',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    ctx.fillStyle = '#183020';
    ctx.fillRect(x, y, w, h);

    // Golden Triforce + Master Sword emblem
    const glow = Math.floor(time * 4) % 2 === 0 ? '#f8e048' : '#e8b828';
    ctx.fillStyle = glow;
    const cx = x + Math.floor(w / 2);
    ctx.beginPath();
    ctx.moveTo(cx, y + 6);
    ctx.lineTo(cx - 10, y + 22);
    ctx.lineTo(cx + 10, y + 22);
    ctx.closePath();
    ctx.fill();

    // Sword blade
    ctx.fillStyle = '#d8f0f8';
    ctx.fillRect(cx - 1, y + 4, 2, 22);
    ctx.fillStyle = '#4898f8';
    ctx.fillRect(cx - 5, y + 10, 10, 2);
  },

  init(context: GameContext) {
    state.ctx = context;
    resetAdventure();
    context.audio.startBGM('quest');
  },

  update(dt: number, input: InputState) {
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.swordTimer > 0) state.swordTimer = Math.max(0, state.swordTimer - dt);
    if (state.dashTimer > 0) state.dashTimer = Math.max(0, state.dashTimer - dt);
    if (state.invulnTimer > 0) state.invulnTimer = Math.max(0, state.invulnTimer - dt);

    if (state.wonDungeon || state.hp <= 0) {
      if (input.justPressed.a || input.justPressed.start) {
        state.ctx.audio.playMenuSelect();
        resetAdventure();
      }
      return;
    }

    const room = state.rooms[state.roomIdx];
    const speed = state.dashTimer > 0 ? 115 : 64;
    let dx = 0;
    let dy = 0;
    if (input.held.up) { dy = -1; state.facing = 'up'; }
    else if (input.held.down) { dy = 1; state.facing = 'down'; }
    else if (input.held.left) { dx = -1; state.facing = 'left'; }
    else if (input.held.right) { dx = 1; state.facing = 'right'; }

    if (dx !== 0 || dy !== 0) {
      tryMovePlayer(room, dx * speed * dt, dy * speed * dt);
    }

    // B Button = Sword Slash
    if (input.justPressed.b && state.swordTimer <= 0) {
      state.swordTimer = 0.2;
      state.ctx.audio.playButtonClick();
      checkSwordHits(room);
    }

    // A Button = Boomerang + Pegasus Dash
    if (input.justPressed.a) {
      state.dashTimer = 0.18;
      if (!state.boomerang) {
        const bvx = state.facing === 'left' ? -130 : state.facing === 'right' ? 130 : 0;
        const bvy = state.facing === 'up' ? -130 : state.facing === 'down' ? 130 : 0;
        state.boomerang = {
          x: state.px + 6,
          y: state.py + 6,
          vx: bvx,
          vy: bvy,
          returning: false,
        };
        state.ctx.audio.playJump();
      }
    }

    updateBoomerang(room, dt);
    updateRoomEnemies(room, dt);
  },

  render(ctx: CanvasRenderingContext2D) {
    const room = state.rooms[state.roomIdx];
    ctx.fillStyle = room.bg;
    ctx.fillRect(0, 16, 160, 128);

    // Draw room tiles
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 10; c++) {
        const tx = c * 16;
        const ty = 16 + r * 16;
        const ch = room.tiles[r][c];

        if (ch === 'W') {
          ctx.fillStyle = room.wallColor;
          ctx.fillRect(tx, ty, 16, 16);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(tx + 1, ty + 1, 14, 14);
        } else if (ch === 'C') {
          // Treasure Chest
          ctx.fillStyle = room.chestOpened ? '#684828' : '#f8b828';
          ctx.fillRect(tx + 2, ty + 3, 12, 10);
          ctx.fillStyle = '#181818';
          ctx.fillRect(tx + 2, ty + 7, 12, 2);
        } else if (ch === 'L' && !room.doorUnlocked) {
          // Locked Boss Door
          ctx.fillStyle = '#b83828';
          ctx.fillRect(tx, ty, 16, 16);
          ctx.fillStyle = '#f8d838';
          ctx.fillRect(tx + 6, ty + 5, 4, 6);
        }
      }
    }

    // Draw Enemies
    for (const en of room.enemies) {
      if (en.hp <= 0) continue;
      const flash = en.hurtTimer > 0 && Math.floor(state.time * 25) % 2 === 0;
      if (en.isBoss) {
        // Giant Arachnid Boss "GOHMA"
        ctx.fillStyle = flash ? '#ffffff' : '#d83828';
        ctx.fillRect(Math.round(en.x - 14), Math.round(en.y - 10), 28, 20);
        ctx.fillStyle = '#f8e838';
        ctx.fillRect(Math.round(en.x - 6), Math.round(en.y - 4), 12, 8);
        ctx.fillStyle = '#181818';
        ctx.fillRect(Math.round(en.x - 2), Math.round(en.y - 2), 4, 4);
      } else {
        ctx.fillStyle = flash ? '#ffffff' : '#e84848';
        ctx.fillRect(Math.round(en.x - 6), Math.round(en.y - 6), 12, 12);
        ctx.fillStyle = '#f8f8f0';
        ctx.fillRect(Math.round(en.x - 4), Math.round(en.y - 3), 3, 3);
        ctx.fillRect(Math.round(en.x + 1), Math.round(en.y - 3), 3, 3);
      }
    }

    // Draw Boomerang
    if (state.boomerang) {
      ctx.fillStyle = '#f8d838';
      ctx.fillRect(Math.round(state.boomerang.x - 3), Math.round(state.boomerang.y - 3), 6, 6);
    }

    // Draw Hero
    const heroFlash = state.invulnTimer > 0 && Math.floor(state.time * 24) % 2 === 0;
    if (!heroFlash) {
      drawPixelSprite(
        ctx,
        HERO_SPRITE,
        { G: '#28b838', S: '#f8d098', K: '#181818', B: '#784820' },
        state.px,
        state.py,
        1
      );
    }

    // Draw Sword Slash
    if (state.swordTimer > 0) {
      const sx = state.px + (state.facing === 'left' ? -10 : state.facing === 'right' ? 12 : 3);
      const sy = state.py + (state.facing === 'up' ? -10 : state.facing === 'down' ? 12 : 3);
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(Math.round(sx), Math.round(sy), state.facing === 'left' || state.facing === 'right' ? 10 : 4, state.facing === 'up' || state.facing === 'down' ? 10 : 4);
    }

    // Top HUD Bar (160x16)
    ctx.fillStyle = '#181c18';
    ctx.fillRect(0, 0, 160, 16);
    drawPixelText(ctx, 'HP:', 4, 5, { color: '#f8f8f0', size: 5 });
    for (let h = 0; h < 3; h++) {
      const full = state.hp >= (h + 1) * 2;
      const half = state.hp === h * 2 + 1;
      ctx.fillStyle = full ? '#f83848' : half ? '#f88848' : '#484848';
      ctx.fillRect(22 + h * 9, 5, 6, 6);
    }
    drawPixelText(ctx, `KEY:${state.keys}`, 56, 5, { color: '#f8d838', size: 5 });
    drawPixelText(ctx, `GEM:${state.rupees}`, 98, 5, { color: '#58f888', size: 5 });

    if (state.bannerTimer > 0) {
      drawGBCBox(ctx, 4, 114, 152, 24);
      drawPixelText(ctx, state.bannerText, 80, 123, { color: '#182018', size: 4, align: 'center' });
    }

    if (state.wonDungeon || state.hp <= 0) {
      drawGBCBox(ctx, 18, 46, 124, 54, { bg: '#182418', borderOuter: '#f8d838' });
      drawPixelText(ctx, state.wonDungeon ? 'TRIFORCE FOUND!' : 'HERO FALLEN!', 80, 56, {
        color: state.wonDungeon ? '#f8e838' : '#f84848',
        size: 6,
        align: 'center',
      });
      drawPixelText(ctx, `GEMS COLLECTED: ${state.rupees}`, 80, 72, { color: '#f8f8f0', size: 5, align: 'center' });
      drawPixelText(ctx, 'PRESS A TO PLAY AGAIN', 80, 86, { color: '#58f878', size: 5, align: 'center' });
    }
  },
};

function resetAdventure(): void {
  state.roomIdx = 0;
  state.px = 74;
  state.py = 104;
  state.hp = 6;
  state.rupees = 0;
  state.keys = 0;
  state.wonDungeon = false;
  state.boomerang = null;
  state.bannerText = 'CLEAR ENEMIES & FIND KEY!';
  state.bannerTimer = 2.0;

  state.rooms = [
    {
      name: 'SOUTHERN BEACH',
      bg: '#c8d878',
      wallColor: '#387830',
      tiles: [
        'WWWW..WWWW',
        'W........W',
        'W.W....W.W',
        'W........W',
        'W...C....W',
        'W.W....W.W',
        'W........W',
        'WWWWWWWWWW',
      ],
      enemies: [
        { x: 44, y: 54, vx: 28, vy: 18, hp: 2, maxHp: 2, hurtTimer: 0 },
        { x: 112, y: 68, vx: -26, vy: 22, hp: 2, maxHp: 2, hurtTimer: 0 },
      ],
    },
    {
      name: 'ANCIENT TEMPLE HALL',
      bg: '#687888',
      wallColor: '#283448',
      tiles: [
        'WWWWLLWWWW',
        'W........W',
        'W.WW..WW.W',
        'W........W',
        'W..C.....W',
        'W.WW..WW.W',
        'W........W',
        'WWWW..WWWW',
      ],
      enemies: [
        { x: 40, y: 56, vx: 36, vy: 24, hp: 3, maxHp: 3, hurtTimer: 0 },
        { x: 118, y: 56, vx: -34, vy: -24, hp: 3, maxHp: 3, hurtTimer: 0 },
        { x: 80, y: 92, vx: 30, vy: -30, hp: 3, maxHp: 3, hurtTimer: 0 },
      ],
    },
    {
      name: 'GOHMA BOSS SANCTUM',
      bg: '#482830',
      wallColor: '#241018',
      tiles: [
        'WWWWWWWWWW',
        'W........W',
        'W........W',
        'W........W',
        'W........W',
        'W........W',
        'W........W',
        'WWWW..WWWW',
      ],
      enemies: [
        { x: 80, y: 54, vx: 46, vy: 24, hp: 10, maxHp: 10, isBoss: true, hurtTimer: 0 },
      ],
    },
  ];
}

function tryMovePlayer(room: RoomData, dx: number, dy: number): void {
  const nx = state.px + dx;
  const ny = state.py + dy;

  // Room transitions (North / South doors)
  if (ny < 18 && state.roomIdx < state.rooms.length - 1) {
    if (state.roomIdx === 1 && !room.doorUnlocked) {
      if (state.keys > 0) {
        state.keys--;
        room.doorUnlocked = true;
        state.ctx.audio.playPowerUp();
        state.bannerText = 'UNLOCKED BOSS SANCTUM!';
        state.bannerTimer = 1.6;
      } else {
        state.bannerText = 'NEED BOSS KEY FROM CHEST!';
        state.bannerTimer = 1.4;
        return;
      }
    }
    state.roomIdx++;
    state.py = 122;
    state.bannerText = state.rooms[state.roomIdx].name;
    state.bannerTimer = 1.5;
    return;
  }

  if (ny > 130 && state.roomIdx > 0) {
    state.roomIdx--;
    state.py = 24;
    state.bannerText = state.rooms[state.roomIdx].name;
    state.bannerTimer = 1.5;
    return;
  }

  const cx = Math.floor((nx + 5) / 16);
  const cy = Math.floor((ny + 5 - 16) / 16);
  const tile = room.tiles[cy]?.[cx] ?? 'W';

  if (tile === 'C' && !room.chestOpened) {
    room.chestOpened = true;
    state.keys++;
    state.rupees += 50;
    state.ctx.audio.playPowerUp();
    state.bannerText = 'FOUND DUNGEON KEY + 50 GEMS!';
    state.bannerTimer = 1.8;
  }

  if (tile !== 'W' && !(tile === 'L' && !room.doorUnlocked)) {
    state.px = Math.max(16, Math.min(134, nx));
    state.py = Math.max(20, Math.min(126, ny));
  }
}

function checkSwordHits(room: RoomData): void {
  const sx = state.px + (state.facing === 'left' ? -10 : state.facing === 'right' ? 14 : 4);
  const sy = state.py + (state.facing === 'up' ? -10 : state.facing === 'down' ? 14 : 4);

  for (const en of room.enemies) {
    if (en.hp <= 0) continue;
    const hitRadius = en.isBoss ? 20 : 14;
    if (Math.abs(sx - en.x) < hitRadius && Math.abs(sy - en.y) < hitRadius) {
      damageEnemy(en, 1);
    }
  }
}

function damageEnemy(en: Enemy, dmg: number): void {
  en.hp -= dmg;
  en.hurtTimer = 0.25;
  state.ctx.audio.playHit();
  if (en.hp <= 0) {
    state.rupees += en.isBoss ? 250 : 20;
    state.ctx.storage.setHighScore('links-quest', state.rupees);
    state.ctx.audio.playCoin();
    if (en.isBoss) {
      state.wonDungeon = true;
      state.ctx.audio.playPowerUp();
    }
  }
}

function updateBoomerang(room: RoomData, dt: number): void {
  const b = state.boomerang;
  if (!b) return;

  if (!b.returning) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 20 || b.x > 140 || b.y < 24 || b.y > 130) {
      b.returning = true;
    }
  } else {
    const dx = state.px + 5 - b.x;
    const dy = state.py + 5 - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) {
      state.boomerang = null;
      return;
    }
    b.x += (dx / dist) * 145 * dt;
    b.y += (dy / dist) * 145 * dt;
  }

  for (const en of room.enemies) {
    if (en.hp <= 0) continue;
    if (Math.abs(b.x - en.x) < 12 && Math.abs(b.y - en.y) < 12) {
      damageEnemy(en, 1);
      b.returning = true;
    }
  }
}

function updateRoomEnemies(room: RoomData, dt: number): void {
  for (const en of room.enemies) {
    if (en.hp <= 0) continue;
    if (en.hurtTimer > 0) en.hurtTimer = Math.max(0, en.hurtTimer - dt);

    en.x += en.vx * dt;
    en.y += en.vy * dt;

    if (en.x < 26 || en.x > 134) en.vx *= -1;
    if (en.y < 34 || en.y > 120) en.vy *= -1;

    if (state.invulnTimer <= 0 && Math.abs(en.x - (state.px + 5)) < 11 && Math.abs(en.y - (state.py + 5)) < 11) {
      state.hp = Math.max(0, state.hp - 1);
      state.invulnTimer = 0.9;
      state.ctx.audio.playHit();
    }
  }
}
