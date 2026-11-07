import {
  drawGBCBox,
  drawHealthBar,
  drawPixelSprite,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

interface FighterDef {
  id: string;
  name: string;
  title: string;
  speed: number;
  power: number;
  skin: string;
  hair: string;
  suit: string;
  accent: string;
  specialName: string;
  superQuote: string;
  taunts: string[];
}

const FIGHTERS: FighterDef[] = [
  {
    id: 'meloony',
    name: 'MELOONY',
    title: 'THE SHOUTSTRESS',
    speed: 78,
    power: 10,
    skin: '#f8d0a8',
    hair: '#f8c838',
    suit: '#2868d8',
    accent: '#f83858',
    specialName: 'SONIC COMIZIO',
    superQuote: 'IO SONO MELOONY!!',
    taunts: ['BASTA!!', 'SONO UNA MADRE!', 'PATRIOTI!'],
  },
  {
    id: 'salveneee',
    name: 'SALVENEEE',
    title: 'CAPITAN RUSPA',
    speed: 62,
    power: 13,
    skin: '#f0c098',
    hair: '#483020',
    suit: '#28a848',
    accent: '#f8d020',
    specialName: 'RUSPA CHARGE',
    superQuote: 'RUSPA TOTALE!!',
    taunts: ['RUSPAAA!', 'ELENCO COSE!', 'BACIONI!'],
  },
  {
    id: 'giuseppi',
    name: 'GIUSEPPI',
    title: 'DECRETO MASTER',
    speed: 72,
    power: 11,
    skin: '#f8c8a0',
    hair: '#202028',
    suit: '#203058',
    accent: '#f8f8f0',
    specialName: 'DPCM TORNADO',
    superQuote: 'CONFERENZA STAMPA!',
    taunts: ['AUTOCERTIFICA!', 'CONGIUNTI!', 'GRADUIDAMENTE!'],
  },
  {
    id: 'cavaliere',
    name: 'IL CAVALIERE',
    title: 'MEGA PRESIDENT',
    speed: 68,
    power: 12,
    skin: '#e8a058',
    hair: '#302018',
    suit: '#182848',
    accent: '#38b8f8',
    specialName: 'CHARISMA BEAM',
    superQuote: 'SCENDO IN CAMPO!!',
    taunts: ['MI CONSENTA!', 'CRIPIO!', 'FORZAAA!'],
  },
];

const FIGHTER_SPRITE_IDLE = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..SSSSSSSS..',
  '..SKS..SKS..',
  '..SSSSSSSS..',
  '...AAAAAA...',
  '..UUUUUUUU..',
  '.UUUUUUUUUU.',
  '.SS.UUUU.SS.',
  '...UUUUUU...',
  '...UU..UU...',
  '..KK....KK..',
];

const FIGHTER_SPRITE_ATTACK = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..SSSSSSSS..',
  '..SKS..SKS..',
  '..SSSSSSSS..',
  '...AAAAAA...',
  '..UUUUUUUUSS',
  '.UUUUUUUUUSS',
  '....UUUU....',
  '...UUUUUU...',
  '..UU....UU..',
  '.KK......KK.',
];

interface Projectile {
  x: number;
  y: number;
  vx: number;
  owner: 'p1' | 'cpu';
  color: string;
  dmg: number;
  text: string;
}

interface FighterRuntime {
  def: FighterDef;
  x: number;
  y: number;
  vy: number;
  facingRight: boolean;
  hp: number;
  maxHp: number;
  superMeter: number;
  attackTimer: number;
  attackType: 'LIGHT' | 'HEAVY' | 'SUPER';
  hitStun: number;
  blocking: boolean;
  tauntText: string;
  tauntTimer: number;
  comboCount: number;
}

const state = {
  ctx: null as unknown as GameContext,
  phase: 'SELECT' as 'SELECT' | 'VS_BANNER' | 'FIGHT' | 'KO' | 'VICTORY',
  selectIdx: 0,
  stageNum: 1,
  bannerTimer: 0,
  hitStop: 0,
  p1: null as unknown as FighterRuntime,
  cpu: null as unknown as FighterRuntime,
  projectiles: [] as Projectile[],
  time: 0,
  roundTimer: 99,
  totalScore: 0,
};

export const pocketBrawlCartridge: GameCartridge = {
  id: 'pocket-brawl',
  title: 'POCKET BRAWL',
  subtitle: 'ITALIAN BRAWLS DX',
  genre: 'FIGHTER',
  description: 'Satirical 1v1 arcade fighter inspired by italianbrawls.it with Super Moves & Taunts!',
  cartridgeColor: '#d82838',
  labelColor: '#1c1818',
  accentColor: '#38c858',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    // Italian tricolor ribbon + boxing glove Clash
    ctx.fillStyle = '#181414';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#28a848';
    ctx.fillRect(x + 2, y + 2, 10, h - 4);
    ctx.fillStyle = '#f8f8f0';
    ctx.fillRect(x + 12, y + 2, 12, h - 4);
    ctx.fillStyle = '#e82838';
    ctx.fillRect(x + 24, y + 2, 10, h - 4);

    const punchOffset = Math.round(Math.abs(Math.sin(time * 7)) * 4);
    ctx.fillStyle = '#f8d020';
    ctx.fillRect(x + 10 + punchOffset, y + 12, 14, 10);
    ctx.fillStyle = '#181818';
    ctx.strokeRect(x + 10 + punchOffset, y + 12, 14, 10);
  },

  init(context: GameContext) {
    state.ctx = context;
    state.phase = 'SELECT';
    state.selectIdx = 0;
    state.stageNum = 1;
    state.totalScore = 0;
    context.audio.startBGM('brawl');
  },

  update(dt: number, input: InputState) {
    state.time += dt;

    if (state.phase === 'SELECT') {
      if (input.justPressed.left) {
        state.selectIdx = (state.selectIdx + FIGHTERS.length - 1) % FIGHTERS.length;
        state.ctx.audio.playMenuMove();
      } else if (input.justPressed.right) {
        state.selectIdx = (state.selectIdx + 1) % FIGHTERS.length;
        state.ctx.audio.playMenuMove();
      } else if (input.justPressed.a || input.justPressed.start) {
        state.ctx.audio.playSpecialMove();
        startTournamentMatch(state.selectIdx, 1);
      }
      return;
    }

    if (state.phase === 'VS_BANNER') {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0 || input.justPressed.a || input.justPressed.start) {
        state.phase = 'FIGHT';
      }
      return;
    }

    if (state.phase === 'KO' || state.phase === 'VICTORY') {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0 && (input.justPressed.a || input.justPressed.start || input.justPressed.b)) {
        if (state.phase === 'VICTORY') {
          state.phase = 'SELECT';
        } else if (state.p1.hp > 0) {
          if (state.stageNum < 3) {
            startTournamentMatch(state.selectIdx, state.stageNum + 1);
          } else {
            state.phase = 'VICTORY';
            state.bannerTimer = 0.5;
          }
        } else {
          state.phase = 'SELECT';
        }
      }
      return;
    }

    // Active 1v1 Fight update
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      return;
    }

    state.roundTimer = Math.max(0, state.roundTimer - dt * 0.8);
    updateFighterPhysics(state.p1, dt);
    updateFighterPhysics(state.cpu, dt);

    // Face each other
    state.p1.facingRight = state.p1.x <= state.cpu.x;
    state.cpu.facingRight = state.cpu.x < state.p1.x;

    handlePlayerControls(dt, input);
    handleCPUAI(dt);
    updateProjectiles(dt);

    if (state.p1.hp <= 0 || state.cpu.hp <= 0 || state.roundTimer <= 0) {
      state.phase = 'KO';
      state.bannerTimer = 0.6;
      if (state.cpu.hp <= 0) {
        state.totalScore += 500 + Math.round(state.p1.hp * 5);
        state.ctx.storage.setHighScore('pocket-brawl', state.totalScore);
        state.ctx.audio.playPowerUp();
      } else {
        state.ctx.audio.playHit();
      }
    }
  },

  render(ctx: CanvasRenderingContext2D) {
    if (state.phase === 'SELECT') {
      renderSelectScreen(ctx);
    } else if (state.phase === 'VS_BANNER') {
      renderVsBanner(ctx);
    } else {
      renderArena(ctx);
    }
  },
};

function createFighterRuntime(def: FighterDef, x: number, facingRight: boolean): FighterRuntime {
  return {
    def,
    x,
    y: 108,
    vy: 0,
    facingRight,
    hp: 100,
    maxHp: 100,
    superMeter: 0,
    attackTimer: 0,
    attackType: 'LIGHT',
    hitStun: 0,
    blocking: false,
    tauntText: def.taunts[0],
    tauntTimer: 1.2,
    comboCount: 0,
  };
}

function startTournamentMatch(p1Idx: number, stageNum: number): void {
  state.stageNum = stageNum;
  const cpuIdx = (p1Idx + stageNum) % FIGHTERS.length;
  state.p1 = createFighterRuntime(FIGHTERS[p1Idx], 34, true);
  state.cpu = createFighterRuntime(FIGHTERS[cpuIdx], 116, false);
  state.projectiles = [];
  state.roundTimer = 99;
  state.bannerTimer = 1.6;
  state.phase = 'VS_BANNER';
}

function updateFighterPhysics(f: FighterRuntime, dt: number): void {
  if (f.attackTimer > 0) f.attackTimer = Math.max(0, f.attackTimer - dt);
  if (f.hitStun > 0) f.hitStun = Math.max(0, f.hitStun - dt);
  if (f.tauntTimer > 0) f.tauntTimer = Math.max(0, f.tauntTimer - dt);

  if (f.y < 108 || f.vy !== 0) {
    f.y += f.vy * dt;
    f.vy += 420 * dt;
    if (f.y >= 108) {
      f.y = 108;
      f.vy = 0;
    }
  }
  f.x = Math.max(12, Math.min(136, f.x));
}

function handlePlayerControls(dt: number, input: InputState): void {
  const p = state.p1;
  if (p.hitStun > 0) return;

  const movingBack = (p.facingRight && input.held.left) || (!p.facingRight && input.held.right);
  p.blocking = movingBack && p.attackTimer <= 0;

  if (p.attackTimer <= 0) {
    if (input.held.left) p.x -= p.def.speed * dt;
    if (input.held.right) p.x += p.def.speed * dt;
    if (input.justPressed.up && p.y >= 108) {
      p.vy = -175;
      state.ctx.audio.playJump();
    }
  }

  // B = Quick Jab / Kick
  if (input.justPressed.b && p.attackTimer <= 0) {
    triggerAttack(p, state.cpu, 'LIGHT', 'p1');
  }

  // A = Special Projectile or SUPER BRAWL (when meter is 100%)
  if (input.justPressed.a && p.attackTimer <= 0) {
    if (p.superMeter >= 100) {
      p.superMeter = 0;
      triggerAttack(p, state.cpu, 'SUPER', 'p1');
    } else {
      triggerAttack(p, state.cpu, 'HEAVY', 'p1');
    }
  }
}

function handleCPUAI(dt: number): void {
  const cpu = state.cpu;
  const p1 = state.p1;
  if (cpu.hitStun > 0 || cpu.attackTimer > 0) return;

  const dist = Math.abs(cpu.x - p1.x);
  const dir = p1.x > cpu.x ? 1 : -1;

  if (dist > 28) {
    cpu.x += dir * (cpu.def.speed * 0.78) * dt;
    cpu.blocking = false;
    if (Math.random() < 0.02) {
      triggerAttack(cpu, p1, 'HEAVY', 'cpu');
    }
  } else {
    cpu.blocking = Math.random() < 0.25;
    if (Math.random() < 0.065) {
      if (cpu.superMeter >= 100) {
        cpu.superMeter = 0;
        triggerAttack(cpu, p1, 'SUPER', 'cpu');
      } else {
        triggerAttack(cpu, p1, Math.random() < 0.65 ? 'LIGHT' : 'HEAVY', 'cpu');
      }
    }
  }

  if (Math.random() < 0.008 && cpu.y >= 108) {
    cpu.vy = -165;
  }
}

function triggerAttack(
  attacker: FighterRuntime,
  defender: FighterRuntime,
  type: 'LIGHT' | 'HEAVY' | 'SUPER',
  owner: 'p1' | 'cpu'
): void {
  attacker.attackType = type;
  attacker.attackTimer = type === 'LIGHT' ? 0.18 : type === 'HEAVY' ? 0.32 : 0.45;
  const dir = attacker.facingRight ? 1 : -1;

  if (type === 'SUPER') {
    attacker.tauntText = attacker.def.superQuote;
    attacker.tauntTimer = 1.5;
    state.ctx.audio.playSpecialMove();
    state.projectiles.push({
      x: attacker.x + dir * 10,
      y: attacker.y - 16,
      vx: dir * 155,
      owner,
      color: attacker.def.accent,
      dmg: 26,
      text: 'SUPER!!',
    });
  } else if (type === 'HEAVY') {
    attacker.tauntText = attacker.def.taunts[Math.floor(Math.random() * attacker.def.taunts.length)];
    attacker.tauntTimer = 1.0;
    state.ctx.audio.playMenuSelect();
    // Dash or launch decree/shout projectile
    attacker.x += dir * 8;
    state.projectiles.push({
      x: attacker.x + dir * 8,
      y: attacker.y - 14,
      vx: dir * 115,
      owner,
      color: attacker.def.accent,
      dmg: 12,
      text: '!',
    });
  } else {
    state.ctx.audio.playButtonClick();
  }

  // Close-range melee hit check
  const reach = type === 'LIGHT' ? 24 : 30;
  if (Math.abs(attacker.x - defender.x) <= reach && Math.abs(attacker.y - defender.y) <= 22) {
    applyHit(attacker, defender, type === 'LIGHT' ? attacker.def.power * 0.7 : attacker.def.power * 1.2);
  }
}

function applyHit(attacker: FighterRuntime, defender: FighterRuntime, rawDmg: number): void {
  const actualDmg = defender.blocking ? Math.max(1, Math.round(rawDmg * 0.25)) : Math.round(rawDmg);
  defender.hp = Math.max(0, defender.hp - actualDmg);
  defender.hitStun = defender.blocking ? 0.08 : 0.22;
  const pushDir = attacker.x < defender.x ? 1 : -1;
  defender.x += pushDir * (defender.blocking ? 3 : 8);

  attacker.superMeter = Math.min(100, attacker.superMeter + 22);
  defender.superMeter = Math.min(100, defender.superMeter + 12);
  attacker.comboCount++;
  state.hitStop = 0.045;
  state.ctx.audio.playHit();
}

function updateProjectiles(dt: number): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const pr = state.projectiles[i];
    pr.x += pr.vx * dt;

    const target = pr.owner === 'p1' ? state.cpu : state.p1;
    const source = pr.owner === 'p1' ? state.p1 : state.cpu;

    if (Math.abs(pr.x - target.x) < 12 && Math.abs(pr.y - (target.y - 12)) < 16) {
      applyHit(source, target, pr.dmg);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (pr.x < -10 || pr.x > 170) {
      state.projectiles.splice(i, 1);
    }
  }
}

function renderSelectScreen(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#181424';
  ctx.fillRect(0, 0, 160, 144);

  // Tricolor top banner
  ctx.fillStyle = '#28a848';
  ctx.fillRect(0, 0, 53, 4);
  ctx.fillStyle = '#f8f8f0';
  ctx.fillRect(53, 0, 54, 4);
  ctx.fillStyle = '#e82838';
  ctx.fillRect(107, 0, 53, 4);

  drawPixelText(ctx, 'ITALIAN BRAWLS DX', 80, 10, { color: '#f8d838', size: 7, align: 'center', shadow: '#000' });
  drawPixelText(ctx, 'CHOOSE YOUR BRAWLER', 80, 22, { color: '#a8b8d8', size: 5, align: 'center' });

  FIGHTERS.forEach((f, idx) => {
    const bx = 8 + idx * 37;
    const by = 34;
    const isSel = idx === state.selectIdx;

    ctx.fillStyle = isSel ? '#f8d838' : '#303850';
    ctx.fillRect(bx, by, 34, 46);
    ctx.fillStyle = isSel ? '#282038' : '#181c28';
    ctx.fillRect(bx + 2, by + 2, 30, 42);

    drawPixelSprite(
      ctx,
      FIGHTER_SPRITE_IDLE,
      { H: f.hair, S: f.skin, K: '#181818', A: f.accent, U: f.suit },
      bx + 5,
      by + 8,
      2
    );
  });

  const sel = FIGHTERS[state.selectIdx];
  drawGBCBox(ctx, 6, 86, 148, 52, { bg: '#202438', borderOuter: '#f8d838', borderInner: '#586888' });
  drawPixelText(ctx, sel.name, 14, 92, { color: '#f8d838', size: 6 });
  drawPixelText(ctx, sel.title, 14, 102, { color: '#98d8f8', size: 5 });
  drawPixelText(ctx, `SP: ${sel.specialName}`, 14, 114, { color: '#f8f8f0', size: 5 });
  drawPixelText(ctx, 'PRESS A / START TO FIGHT!', 80, 126, { color: '#58f878', size: 5, align: 'center' });
}

function renderVsBanner(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#181020';
  ctx.fillRect(0, 0, 160, 144);

  drawPixelText(ctx, `TOURNAMENT STAGE ${state.stageNum}/3`, 80, 18, { color: '#f8d838', size: 6, align: 'center' });
  drawPixelText(ctx, state.p1.def.name, 40, 56, { color: '#58d8f8', size: 6, align: 'center' });
  drawPixelText(ctx, 'VS', 80, 70, { color: '#f83838', size: 8, align: 'center' });
  drawPixelText(ctx, state.cpu.def.name, 120, 86, { color: '#f89848', size: 6, align: 'center' });
  drawPixelText(ctx, `"${state.cpu.def.superQuote}"`, 80, 116, { color: '#f8f8f0', size: 5, align: 'center' });
}

function renderArena(ctx: CanvasRenderingContext2D): void {
  // Roman Colosseum / Parliament Evening Backdrop
  ctx.fillStyle = '#241c38';
  ctx.fillRect(0, 0, 160, 108);

  // Pillars & Arches
  ctx.fillStyle = '#483c58';
  for (let x = 8; x < 160; x += 28) {
    ctx.fillRect(x, 42, 16, 66);
    ctx.fillStyle = '#181424';
    ctx.fillRect(x + 4, 52, 8, 22);
    ctx.fillStyle = '#483c58';
  }

  // Arena Floor
  ctx.fillStyle = '#786858';
  ctx.fillRect(0, 108, 160, 36);
  ctx.fillStyle = '#a89880';
  ctx.fillRect(0, 108, 160, 4);

  // Top HUD: Health Bars & Timer
  drawHealthBar(ctx, 4, 8, 62, 8, state.p1.hp / state.p1.maxHp);
  drawHealthBar(ctx, 94, 8, 62, 8, state.cpu.hp / state.cpu.maxHp);
  drawPixelText(ctx, state.p1.def.name.slice(0, 8), 4, 18, { color: '#f8f8f0', size: 5 });
  drawPixelText(ctx, state.cpu.def.name.slice(0, 8), 156, 18, { color: '#f8f8f0', size: 5, align: 'right' });

  drawPixelText(ctx, String(Math.ceil(state.roundTimer)).padStart(2, '0'), 80, 7, {
    color: '#f8d838',
    size: 7,
    align: 'center',
    shadow: '#000',
  });

  // Super Meters at bottom
  drawHealthBar(ctx, 4, 132, 56, 6, state.p1.superMeter / 100, {
    fillHigh: '#38d8f8',
    fillMid: '#2898f8',
    fillLow: '#2868c8',
  });
  drawPixelText(ctx, state.p1.superMeter >= 100 ? 'SUPER READY(A)' : 'SUPER', 4, 124, {
    color: state.p1.superMeter >= 100 ? '#f8e838' : '#c8c8c0',
    size: 4,
  });

  // Draw Fighters
  drawFighterOnStage(ctx, state.p1);
  drawFighterOnStage(ctx, state.cpu);

  // Projectiles
  for (const pr of state.projectiles) {
    ctx.fillStyle = pr.color;
    ctx.fillRect(Math.round(pr.x - 5), Math.round(pr.y - 4), 10, 8);
    drawPixelText(ctx, pr.text, pr.x, pr.y - 10, { color: '#ffffff', size: 5, align: 'center', shadow: '#000' });
  }

  if (state.phase === 'KO') {
    drawGBCBox(ctx, 22, 48, 116, 44, { bg: '#181420', borderOuter: '#f8d838' });
    const win = state.p1.hp > 0;
    drawPixelText(ctx, win ? 'K.O. - YOU WIN!' : 'DEFEATED!', 80, 56, {
      color: win ? '#58f878' : '#f84848',
      size: 6,
      align: 'center',
    });
    drawPixelText(ctx, 'PRESS A TO CONTINUE', 80, 74, { color: '#f8f8f0', size: 5, align: 'center' });
  } else if (state.phase === 'VICTORY') {
    drawGBCBox(ctx, 12, 40, 136, 58, { bg: '#182418', borderOuter: '#f8d838' });
    drawPixelText(ctx, 'CHAMPION OF ITALY!', 80, 48, { color: '#f8d838', size: 6, align: 'center' });
    drawPixelText(ctx, `${state.p1.def.name} CLEARED ALL!`, 80, 62, { color: '#ffffff', size: 5, align: 'center' });
    drawPixelText(ctx, `SCORE: ${state.totalScore}`, 80, 76, { color: '#58f878', size: 5, align: 'center' });
  }
}

function drawFighterOnStage(ctx: CanvasRenderingContext2D, f: FighterRuntime): void {
  const sprite = f.attackTimer > 0 ? FIGHTER_SPRITE_ATTACK : FIGHTER_SPRITE_IDLE;
  const flash = f.hitStun > 0 && Math.floor(state.time * 25) % 2 === 0;
  drawPixelSprite(
    ctx,
    sprite,
    {
      H: flash ? '#ffffff' : f.def.hair,
      S: flash ? '#ffffff' : f.def.skin,
      K: '#181818',
      A: f.def.accent,
      U: flash ? '#f84848' : f.def.suit,
    },
    f.x - 12,
    f.y - 24,
    2,
    !f.facingRight
  );

  if (f.tauntTimer > 0) {
    drawPixelText(ctx, f.tauntText, f.x, f.y - 34, {
      color: '#f8f8f0',
      size: 4,
      align: 'center',
      shadow: '#000000',
    });
  }
}
