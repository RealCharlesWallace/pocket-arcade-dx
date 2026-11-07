import {
  drawGBCBox,
  drawHealthBar,
  drawPixelSprite,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

type ElementType = 'FIRE' | 'WATER' | 'GRASS' | 'VOLT' | 'EARTH';

interface MoveDef {
  name: string;
  type: ElementType;
  power: number;
}

interface MonsterSpecies {
  id: string;
  name: string;
  type: ElementType;
  baseHp: number;
  baseAtk: number;
  color1: string;
  color2: string;
  sprite: string[];
  moves: MoveDef[];
}

interface PartyMonster {
  speciesId: string;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
}

const SPECIES: MonsterSpecies[] = [
  {
    id: 'pyrokit',
    name: 'PYROKIT',
    type: 'FIRE',
    baseHp: 32,
    baseAtk: 11,
    color1: '#f85828',
    color2: '#f8d030',
    sprite: [
      '..11....11..',
      '.1221..1221.',
      '.1221111221.',
      '.1111111111.',
      '113111111311',
      '111112211111',
      '.1111111111.',
      '..11222211..',
      '.1112222111.',
      '.11.1111.11.',
      '....11.11...',
      '...11...11..',
    ],
    moves: [
      { name: 'FLAME CLAW', type: 'FIRE', power: 13 },
      { name: 'EMBER BURST', type: 'FIRE', power: 16 },
      { name: 'QUICK SCRATCH', type: 'EARTH', power: 10 },
    ],
  },
  {
    id: 'aquafin',
    name: 'AQUAFIN',
    type: 'WATER',
    baseHp: 35,
    baseAtk: 10,
    color1: '#2888f8',
    color2: '#88d8f8',
    sprite: [
      '....1111....',
      '..11222211..',
      '.1222222221.',
      '.1131221311.',
      '111112211111',
      '122111111221',
      '.1112222111.',
      '..11222211..',
      '..11111111..',
      '.1221..1221.',
      '.111....111.',
      '............',
    ],
    moves: [
      { name: 'AQUA JET', type: 'WATER', power: 13 },
      { name: 'TIDAL SPLASH', type: 'WATER', power: 16 },
      { name: 'SHELL BASH', type: 'EARTH', power: 10 },
    ],
  },
  {
    id: 'leafbud',
    name: 'LEAFBUD',
    type: 'GRASS',
    baseHp: 36,
    baseAtk: 10,
    color1: '#38b848',
    color2: '#a8f060',
    sprite: [
      '....2222....',
      '..22211222..',
      '...211112...',
      '..11111111..',
      '.1131111311.',
      '.1111221111.',
      '111111111111',
      '112211112211',
      '.1111111111.',
      '..111..111..',
      '..11....11..',
      '............',
    ],
    moves: [
      { name: 'VINE WHIP', type: 'GRASS', power: 13 },
      { name: 'SOLAR LEAF', type: 'GRASS', power: 16 },
      { name: 'BODY TACKLE', type: 'EARTH', power: 10 },
    ],
  },
  {
    id: 'voltmouse',
    name: 'VOLTMOUSE',
    type: 'VOLT',
    baseHp: 30,
    baseAtk: 12,
    color1: '#f8d020',
    color2: '#e85020',
    sprite: [
      '.11......11.',
      '.111....111.',
      '..11111111..',
      '.1131111311.',
      '.1211111121.',
      '.1111111111.',
      '..1111111122',
      '.1111111122.',
      '.111111111..',
      '..11....11..',
      '..11....11..',
      '............',
    ],
    moves: [
      { name: 'THUNDER ZAP', type: 'VOLT', power: 14 },
      { name: 'VOLT DASH', type: 'VOLT', power: 16 },
      { name: 'IRON TAIL', type: 'EARTH', power: 11 },
    ],
  },
  {
    id: 'rockgolem',
    name: 'CRAGREX',
    type: 'EARTH',
    baseHp: 40,
    baseAtk: 11,
    color1: '#a88050',
    color2: '#d8b888',
    sprite: [
      '...111111...',
      '..12211221..',
      '.1111111111.',
      '111311113111',
      '111111111111',
      '122112211221',
      '111111111111',
      '.1112222111.',
      '.1111111111.',
      '.111....111.',
      '111......111',
      '............',
    ],
    moves: [
      { name: 'BOULDER SLAM', type: 'EARTH', power: 14 },
      { name: 'QUAKE TREMOR', type: 'EARTH', power: 17 },
      { name: 'FLINT SPARK', type: 'FIRE', power: 11 },
    ],
  },
];

function getTypeMultiplier(atk: ElementType, def: ElementType): number {
  if (atk === 'FIRE' && def === 'GRASS') return 1.6;
  if (atk === 'FIRE' && def === 'WATER') return 0.65;
  if (atk === 'WATER' && (def === 'FIRE' || def === 'EARTH')) return 1.6;
  if (atk === 'WATER' && def === 'GRASS') return 0.65;
  if (atk === 'GRASS' && (def === 'WATER' || def === 'EARTH')) return 1.6;
  if (atk === 'GRASS' && def === 'FIRE') return 0.65;
  if (atk === 'VOLT' && def === 'WATER') return 1.6;
  if (atk === 'VOLT' && def === 'EARTH') return 0.65;
  if (atk === 'EARTH' && (def === 'VOLT' || def === 'FIRE')) return 1.6;
  return 1.0;
}

// 10x9 Overworld Tile Map (16x16 tiles = 160x144 screen)
// T = tree, . = path, G = tall grass, W = water, H = healer roof, D = healer door, N = rival NPC
const MAP_ROWS = [
  'TTTTTGGTTT',
  'THHHTGG..T',
  'T.D.TGGG.T',
  'T... ....T',
  'T..N..GGGT',
  'T....GGGGT',
  'TWW...GGGT',
  'TWW....o.T',
  'TTTTTTTTTT',
];

type Mode = 'OVERWORLD' | 'ENCOUNTER_FLASH' | 'BATTLE' | 'DIALOG';

interface SaveProgress {
  party: PartyMonster[];
  balls: number;
  potions: number;
  wins: number;
}

export const pocketMonstersCartridge: GameCartridge = {
  id: 'pocket-monsters',
  title: 'POCKET MONSTERS',
  subtitle: 'CRYSTAL QUEST DX',
  genre: 'RPG',
  description: 'Explore tall grass, battle & catch elemental monsters, and build your team!',
  cartridgeColor: '#2468c8',
  labelColor: '#1b2848',
  accentColor: '#48d8f8',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    ctx.fillStyle = '#182438';
    ctx.fillRect(x, y, w, h);

    // Classic Pokéball icon + bouncing monster
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2) + Math.round(Math.sin(time * 4) * 2);

    ctx.fillStyle = '#e83838';
    ctx.fillRect(cx - 10, cy - 10, 20, 10);
    ctx.fillStyle = '#f8f8f0';
    ctx.fillRect(cx - 10, cy, 20, 10);
    ctx.fillStyle = '#181818';
    ctx.fillRect(cx - 10, cy - 1, 20, 2);
    ctx.fillStyle = '#f8d838';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  },

  init(context: GameContext) {
    state.ctx = context;
    const saved = context.storage.loadData<SaveProgress | null>('pocket-monsters', null);
    if (saved && saved.party?.length > 0) {
      state.party = saved.party;
      state.balls = saved.balls ?? 5;
      state.potions = saved.potions ?? 3;
      state.wins = saved.wins ?? 0;
    } else {
      state.party = [
        createPartyMonster('pyrokit', 5),
        createPartyMonster('voltmouse', 4),
      ];
      state.balls = 6;
      state.potions = 3;
      state.wins = 0;
    }

    state.playerX = 3;
    state.playerY = 3;
    state.mode = 'OVERWORLD';
    state.dialogText = '';
    context.audio.startBGM('monster_town');
  },

  update(dt: number, input: InputState) {
    state.animTime += dt;
    if (state.moveCooldown > 0) state.moveCooldown -= dt;

    if (state.mode === 'OVERWORLD') {
      updateOverworld(input);
    } else if (state.mode === 'DIALOG') {
      if (input.justPressed.a || input.justPressed.b || input.justPressed.start) {
        state.ctx.audio.playMenuSelect();
        state.mode = 'OVERWORLD';
      }
    } else if (state.mode === 'ENCOUNTER_FLASH') {
      state.flashTimer -= dt;
      if (state.flashTimer <= 0) {
        state.mode = 'BATTLE';
      }
    } else if (state.mode === 'BATTLE') {
      updateBattle(dt, input);
    }
  },

  render(ctx: CanvasRenderingContext2D) {
    if (state.mode === 'OVERWORLD' || state.mode === 'DIALOG' || state.mode === 'ENCOUNTER_FLASH') {
      renderOverworld(ctx);
      if (state.mode === 'DIALOG') {
        drawGBCBox(ctx, 4, 102, 152, 38);
        drawPixelText(ctx, state.dialogLine1, 10, 109, { color: '#182018', size: 6 });
        drawPixelText(ctx, state.dialogLine2, 10, 121, { color: '#384838', size: 5 });
      }
      if (state.mode === 'ENCOUNTER_FLASH') {
        const flashOn = Math.floor(state.flashTimer * 14) % 2 === 0;
        if (flashOn) {
          ctx.fillStyle = '#f8f8f0';
          ctx.fillRect(0, 0, 160, 144);
        }
      }
    } else if (state.mode === 'BATTLE') {
      renderBattle(ctx);
    }
  },

  cleanup() {
    saveProgress();
  },
};

function createPartyMonster(speciesId: string, level: number): PartyMonster {
  const sp = SPECIES.find((s) => s.id === speciesId) ?? SPECIES[0];
  const maxHp = sp.baseHp + level * 4;
  return {
    speciesId: sp.id,
    level,
    hp: maxHp,
    maxHp,
    xp: 0,
  };
}

function getSpecies(id: string): MonsterSpecies {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0];
}

const state = {
  ctx: null as unknown as GameContext,
  animTime: 0,
  mode: 'OVERWORLD' as Mode,
  playerX: 3,
  playerY: 3,
  facing: 'down' as 'up' | 'down' | 'left' | 'right',
  moveCooldown: 0,
  party: [] as PartyMonster[],
  activePartyIdx: 0,
  balls: 6,
  potions: 3,
  wins: 0,
  dialogText: '',
  dialogLine1: '',
  dialogLine2: '',
  flashTimer: 0,

  // Battle state
  enemy: null as PartyMonster | null,
  isWild: true,
  battlePhase: 'MENU' as 'MENU' | 'MOVES' | 'PARTY' | 'MSG' | 'CATCH_ANIM',
  menuCursor: 0, // 0: FIGHT, 1: PKMN, 2: BAG, 3: RUN
  moveCursor: 0,
  partyCursor: 0,
  battleMsg1: '',
  battleMsg2: '',
  afterMsgAction: null as (() => void) | null,
  catchShakeTimer: 0,
};

function saveProgress(): void {
  if (!state.ctx) return;
  state.ctx.storage.saveData<SaveProgress>('pocket-monsters', {
    party: state.party,
    balls: state.balls,
    potions: state.potions,
    wins: state.wins,
  });
  state.ctx.storage.setHighScore('pocket-monsters', state.wins * 100 + state.party.length * 50);
}

function showDialog(l1: string, l2 = ''): void {
  state.dialogLine1 = l1;
  state.dialogLine2 = l2;
  state.mode = 'DIALOG';
}

function updateOverworld(input: InputState): void {
  if (state.moveCooldown <= 0) {
    let dx = 0;
    let dy = 0;
    if (input.held.up) { dy = -1; state.facing = 'up'; }
    else if (input.held.down) { dy = 1; state.facing = 'down'; }
    else if (input.held.left) { dx = -1; state.facing = 'left'; }
    else if (input.held.right) { dx = 1; state.facing = 'right'; }

    if (dx !== 0 || dy !== 0) {
      state.moveCooldown = 0.16;
      const nx = state.playerX + dx;
      const ny = state.playerY + dy;
      const tile = MAP_ROWS[ny]?.[nx] ?? 'T';

      if (tile === 'D') {
        // Heal party at Poké-Healer Door!
        state.party.forEach((m) => { m.hp = m.maxHp; });
        state.balls = Math.max(state.balls, 5);
        state.potions = Math.max(state.potions, 3);
        state.ctx.audio.playPowerUp();
        saveProgress();
        showDialog('HEALER: Team healed!', 'Balls & Potions restocked!');
        return;
      }

      if (tile === 'N') {
        startBattle(false);
        return;
      }

      if (tile !== 'T' && tile !== 'H' && tile !== 'W') {
        state.playerX = nx;
        state.playerY = ny;
        state.ctx.audio.playButtonClick();

        if (tile === 'G' && Math.random() < 0.35) {
          startBattle(true);
        }
      }
    }
  }

  if (input.justPressed.a) {
    const fx = state.playerX + (state.facing === 'left' ? -1 : state.facing === 'right' ? 1 : 0);
    const fy = state.playerY + (state.facing === 'up' ? -1 : state.facing === 'down' ? 1 : 0);
    const frontTile = MAP_ROWS[fy]?.[fx] ?? '';
    if (frontTile === 'D') {
      state.party.forEach((m) => { m.hp = m.maxHp; });
      state.ctx.audio.playPowerUp();
      showDialog('HEALER: All monsters', 'restored to full HP!');
    } else if (frontTile === 'N') {
      startBattle(false);
    } else {
      const lead = state.party[0];
      const sp = getSpecies(lead.speciesId);
      showDialog(`${sp.name} Lv.${lead.level} (${ state.party.length }/6)`, `Wins:${state.wins} Balls:${state.balls}`);
    }
  }
}

function startBattle(isWild: boolean): void {
  state.isWild = isWild;
  const randomSp = SPECIES[Math.floor(Math.random() * SPECIES.length)];
  const avgLv = Math.max(3, state.party[0]?.level ?? 5);
  const enemyLv = isWild ? Math.max(2, avgLv - 1 + Math.floor(Math.random() * 3)) : avgLv + 1;
  state.enemy = createPartyMonster(randomSp.id, enemyLv);

  // Pick first healthy monster in player's party
  const healthyIdx = state.party.findIndex((m) => m.hp > 0);
  if (healthyIdx === -1) {
    state.party.forEach((m) => { m.hp = m.maxHp; });
    state.activePartyIdx = 0;
  } else {
    state.activePartyIdx = healthyIdx;
  }

  state.flashTimer = 0.55;
  state.mode = 'ENCOUNTER_FLASH';
  state.menuCursor = 0;
  state.moveCursor = 0;
  const sp = getSpecies(state.enemy.speciesId);
  state.battleMsg1 = isWild ? `Wild ${sp.name} appeared!` : `Rival sent out ${sp.name}!`;
  state.battleMsg2 = 'Press A to battle!';
  state.battlePhase = 'MSG';
  state.afterMsgAction = () => {
    state.battlePhase = 'MENU';
  };
  state.ctx.audio.startBGM('monster_battle');
}

function setBattleMessage(l1: string, l2: string, next: () => void): void {
  state.battleMsg1 = l1;
  state.battleMsg2 = l2;
  state.battlePhase = 'MSG';
  state.afterMsgAction = next;
}

function updateBattle(dt: number, input: InputState): void {
  const playerMon = state.party[state.activePartyIdx];
  const enemyMon = state.enemy!;
  const playerSp = getSpecies(playerMon.speciesId);
  const enemySp = getSpecies(enemyMon.speciesId);

  if (state.battlePhase === 'CATCH_ANIM') {
    state.catchShakeTimer -= dt;
    if (state.catchShakeTimer <= 0) {
      const hpRatio = enemyMon.hp / enemyMon.maxHp;
      const catchChance = 0.45 + (1 - hpRatio) * 0.5;
      if (Math.random() <= catchChance) {
        state.ctx.audio.playPowerUp();
        if (state.party.length < 6) {
          state.party.push({ ...enemyMon });
        }
        state.wins++;
        saveProgress();
        setBattleMessage(`Gotcha! ${enemySp.name}`, 'was caught & added!', () => {
          endBattleToOverworld();
        });
      } else {
        state.ctx.audio.playMenuBack();
        setBattleMessage(`Oh no! ${enemySp.name}`, 'broke free!', () => {
          enemyTurn();
        });
      }
    }
    return;
  }

  if (state.battlePhase === 'MSG') {
    if (input.justPressed.a || input.justPressed.b || input.justPressed.start) {
      state.ctx.audio.playMenuSelect();
      const fn = state.afterMsgAction;
      state.afterMsgAction = null;
      if (fn) fn();
    }
    return;
  }

  if (state.battlePhase === 'MENU') {
    if (input.justPressed.left && state.menuCursor % 2 === 1) {
      state.menuCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.right && state.menuCursor % 2 === 0) {
      state.menuCursor++;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.up && state.menuCursor >= 2) {
      state.menuCursor -= 2;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.down && state.menuCursor < 2) {
      state.menuCursor += 2;
      state.ctx.audio.playMenuMove();
    }

    if (input.justPressed.a) {
      state.ctx.audio.playMenuSelect();
      if (state.menuCursor === 0) {
        state.moveCursor = 0;
        state.battlePhase = 'MOVES';
      } else if (state.menuCursor === 1) {
        state.partyCursor = state.activePartyIdx;
        state.battlePhase = 'PARTY';
      } else if (state.menuCursor === 2) {
        // BAG: Throw Monster Ball if wild and enemy weakened, else use Potion if injured
        if (state.isWild && state.balls > 0 && (playerMon.hp > playerMon.maxHp * 0.4 || state.potions === 0)) {
          state.balls--;
          state.catchShakeTimer = 1.1;
          state.battlePhase = 'CATCH_ANIM';
          state.ctx.audio.playJump();
        } else if (state.potions > 0) {
          state.potions--;
          playerMon.hp = Math.min(playerMon.maxHp, playerMon.hp + 24);
          state.ctx.audio.playPowerUp();
          setBattleMessage(`Used POTION on ${playerSp.name}!`, `Restored 24 HP! (${state.potions} left)`, () => {
            enemyTurn();
          });
        } else {
          setBattleMessage('Bag is empty!', 'Visit Healer house in town!', () => {
            state.battlePhase = 'MENU';
          });
        }
      } else if (state.menuCursor === 3) {
        state.ctx.audio.playMenuBack();
        setBattleMessage('Got away safely!', '', () => {
          endBattleToOverworld();
        });
      }
    }
    return;
  }

  if (state.battlePhase === 'MOVES') {
    if (input.justPressed.b) {
      state.ctx.audio.playMenuBack();
      state.battlePhase = 'MENU';
      return;
    }
    if (input.justPressed.up && state.moveCursor > 0) {
      state.moveCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.down && state.moveCursor < playerSp.moves.length - 1) {
      state.moveCursor++;
      state.ctx.audio.playMenuMove();
    }

    if (input.justPressed.a) {
      const move = playerSp.moves[state.moveCursor];
      executePlayerMove(move);
    }
    return;
  }

  if (state.battlePhase === 'PARTY') {
    if (input.justPressed.b) {
      state.ctx.audio.playMenuBack();
      state.battlePhase = 'MENU';
      return;
    }
    if (input.justPressed.up && state.partyCursor > 0) {
      state.partyCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.down && state.partyCursor < state.party.length - 1) {
      state.partyCursor++;
      state.ctx.audio.playMenuMove();
    }

    if (input.justPressed.a) {
      const chosen = state.party[state.partyCursor];
      if (chosen.hp <= 0) {
        state.ctx.audio.playMenuBack();
      } else {
        state.activePartyIdx = state.partyCursor;
        const sp = getSpecies(chosen.speciesId);
        state.ctx.audio.playMenuSelect();
        setBattleMessage(`Go! ${sp.name}!`, '', () => {
          enemyTurn();
        });
      }
    }
  }
}

function executePlayerMove(move: MoveDef): void {
  const playerMon = state.party[state.activePartyIdx];
  const enemyMon = state.enemy!;
  const playerSp = getSpecies(playerMon.speciesId);
  const enemySp = getSpecies(enemyMon.speciesId);

  const mult = getTypeMultiplier(move.type, enemySp.type);
  const rawDmg = ((playerSp.baseAtk + playerMon.level * 1.6) * move.power) / 14;
  const dmg = Math.max(3, Math.round(rawDmg * mult));

  enemyMon.hp = Math.max(0, enemyMon.hp - dmg);
  state.ctx.audio.playHit();

  const effText = mult > 1.1 ? "It's super effective!" : mult < 0.9 ? 'Not very effective...' : `Dealt ${dmg} damage!`;

  setBattleMessage(`${playerSp.name} used ${move.name}!`, effText, () => {
    if (enemyMon.hp <= 0) {
      state.wins++;
      playerMon.xp += 25;
      let lvMsg = `Gained 25 XP!`;
      if (playerMon.xp >= 50) {
        playerMon.xp -= 50;
        playerMon.level++;
        playerMon.maxHp += 5;
        playerMon.hp = playerMon.maxHp;
        lvMsg = `LEVELED UP to Lv.${playerMon.level}!`;
      }
      state.ctx.audio.playPowerUp();
      saveProgress();
      setBattleMessage(`${enemySp.name} fainted!`, lvMsg, () => {
        endBattleToOverworld();
      });
    } else {
      enemyTurn();
    }
  });
}

function enemyTurn(): void {
  const playerMon = state.party[state.activePartyIdx];
  const enemyMon = state.enemy!;
  const playerSp = getSpecies(playerMon.speciesId);
  const enemySp = getSpecies(enemyMon.speciesId);

  const move = enemySp.moves[Math.floor(Math.random() * enemySp.moves.length)];
  const mult = getTypeMultiplier(move.type, playerSp.type);
  const rawDmg = ((enemySp.baseAtk + enemyMon.level * 1.4) * move.power) / 16;
  const dmg = Math.max(2, Math.round(rawDmg * mult));

  playerMon.hp = Math.max(0, playerMon.hp - dmg);
  state.ctx.audio.playHit();

  setBattleMessage(`Foe ${enemySp.name} used`, `${move.name}! (-${dmg} HP)`, () => {
    if (playerMon.hp <= 0) {
      const nextHealthy = state.party.findIndex((m) => m.hp > 0);
      if (nextHealthy !== -1) {
        state.activePartyIdx = nextHealthy;
        const nextSp = getSpecies(state.party[nextHealthy].speciesId);
        setBattleMessage(`${playerSp.name} fainted!`, `Sent out ${nextSp.name}!`, () => {
          state.battlePhase = 'MENU';
        });
      } else {
        state.party.forEach((m) => { m.hp = m.maxHp; });
        setBattleMessage('All monsters tired!', 'Rushed to Healer House!', () => {
          state.playerX = 2;
          state.playerY = 3;
          endBattleToOverworld();
        });
      }
    } else {
      state.battlePhase = 'MENU';
    }
  });
}

function endBattleToOverworld(): void {
  state.mode = 'OVERWORLD';
  state.ctx.audio.startBGM('monster_town');
}

function renderOverworld(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#98e070';
  ctx.fillRect(0, 0, 160, 144);

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 10; c++) {
      const tx = c * 16;
      const ty = r * 16;
      const ch = MAP_ROWS[r][c];

      if (ch === 'T') {
        // Tree
        ctx.fillStyle = '#205828';
        ctx.fillRect(tx + 1, ty + 1, 14, 14);
        ctx.fillStyle = '#389038';
        ctx.fillRect(tx + 3, ty + 2, 10, 9);
        ctx.fillStyle = '#583820';
        ctx.fillRect(tx + 6, ty + 11, 4, 4);
      } else if (ch === 'G') {
        // Tall grass blades
        ctx.fillStyle = '#38a038';
        for (let gx = 2; gx < 14; gx += 4) {
          ctx.fillRect(tx + gx, ty + 4, 2, 10);
          ctx.fillRect(tx + gx + 1, ty + 2, 2, 4);
        }
      } else if (ch === 'W') {
        const wave = Math.floor(state.animTime * 3) % 2 === 0;
        ctx.fillStyle = '#2880e8';
        ctx.fillRect(tx, ty, 16, 16);
        ctx.fillStyle = '#78c8f8';
        ctx.fillRect(tx + (wave ? 2 : 5), ty + 5, 8, 2);
      } else if (ch === 'H') {
        ctx.fillStyle = '#d84040';
        ctx.fillRect(tx, ty, 16, 16);
        ctx.fillStyle = '#f8f8f0';
        ctx.fillRect(tx + 2, ty + 12, 12, 4);
      } else if (ch === 'D') {
        ctx.fillStyle = '#f8f0d8';
        ctx.fillRect(tx, ty, 16, 16);
        ctx.fillStyle = '#2868c8';
        ctx.fillRect(tx + 4, ty + 4, 8, 12);
        drawPixelText(ctx, 'HEAL', tx + 1, ty - 6, { color: '#ffffff', size: 4, shadow: '#181818' });
      } else if (ch === 'N') {
        // Rival Trainer NPC
        drawTrainerSprite(ctx, tx + 2, ty + 2, '#d83838', '#f8c838');
      } else if (ch === 'o') {
        // Decorative flower
        ctx.fillStyle = '#f85898';
        ctx.fillRect(tx + 6, ty + 6, 4, 4);
      }
    }
  }

  // Player sprite
  drawTrainerSprite(ctx, state.playerX * 16 + 2, state.playerY * 16 + 2, '#2060d8', '#f83838');

  // Top HUD strip
  ctx.fillStyle = 'rgba(16, 24, 20, 0.82)';
  ctx.fillRect(0, 0, 160, 12);
  const lead = state.party[0];
  const sp = getSpecies(lead.speciesId);
  drawPixelText(ctx, `${sp.name} Lv${lead.level}`, 4, 3, { color: '#f8e858', size: 5 });
  drawPixelText(ctx, `BALLx${state.balls} WIN:${state.wins}`, 88, 3, { color: '#f8f8f0', size: 5 });
}

function drawTrainerSprite(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, cap: string): void {
  const rows = [
    '...CCCCCC...',
    '..CCCCCCCC..',
    '..SSSSSSSS..',
    '..SKS..SKS..',
    '...SSSSSS...',
    '..BBBBBBBB..',
    '.BBBBBBBBBB.',
    '.BB.BBBB.BB.',
    '....KKKK....',
    '...KK..KK...',
  ];
  drawPixelSprite(ctx, rows, {
    C: cap,
    S: '#f8d0a0',
    K: '#181818',
    B: shirt,
  }, x, y, 1);
}

function renderBattle(ctx: CanvasRenderingContext2D): void {
  const playerMon = state.party[state.activePartyIdx];
  const enemyMon = state.enemy!;
  const playerSp = getSpecies(playerMon.speciesId);
  const enemySp = getSpecies(enemyMon.speciesId);

  // Cream GBC battle background
  ctx.fillStyle = '#f8f6e0';
  ctx.fillRect(0, 0, 160, 144);

  // Enemy status HUD (Top Left)
  drawGBCBox(ctx, 4, 4, 88, 28, { bg: '#f0eed8' });
  drawPixelText(ctx, `${enemySp.name}`, 8, 8, { color: '#182018', size: 5 });
  drawPixelText(ctx, `:L${enemyMon.level}`, 64, 8, { color: '#285828', size: 5 });
  drawHealthBar(ctx, 10, 18, 74, 6, enemyMon.hp / enemyMon.maxHp);

  // Enemy Monster Sprite (Top Right)
  const enemyBob = Math.round(Math.sin(state.animTime * 5) * 1.5);
  if (state.battlePhase === 'CATCH_ANIM') {
    const bx = 118 + Math.round(Math.sin(state.animTime * 28) * 3);
    ctx.fillStyle = '#e83030';
    ctx.fillRect(bx, 22, 12, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, 28, 12, 6);
    ctx.fillStyle = '#181818';
    ctx.fillRect(bx, 27, 12, 2);
  } else {
    drawPixelSprite(
      ctx,
      enemySp.sprite,
      { '1': enemySp.color1, '2': enemySp.color2, '3': '#181818' },
      104,
      10 + enemyBob,
      3
    );
  }

  // Player Monster Sprite (Bottom Left)
  drawPixelSprite(
    ctx,
    playerSp.sprite,
    { '1': playerSp.color1, '2': playerSp.color2, '3': '#181818' },
    14,
    54,
    3,
    true
  );

  // Player Status HUD (Middle Right)
  drawGBCBox(ctx, 66, 56, 90, 34, { bg: '#f0eed8' });
  drawPixelText(ctx, `${playerSp.name}`, 72, 60, { color: '#182018', size: 5 });
  drawPixelText(ctx, `:L${playerMon.level}`, 128, 60, { color: '#285828', size: 5 });
  drawHealthBar(ctx, 72, 70, 76, 6, playerMon.hp / playerMon.maxHp);
  drawPixelText(ctx, `HP ${playerMon.hp}/${playerMon.maxHp}`, 72, 79, { color: '#182018', size: 5 });

  // Bottom Command / Message Box
  drawGBCBox(ctx, 2, 94, 156, 48);

  if (state.battlePhase === 'MSG' || state.battlePhase === 'CATCH_ANIM') {
    drawPixelText(ctx, state.battleMsg1, 10, 104, { color: '#182018', size: 6 });
    drawPixelText(ctx, state.battleMsg2, 10, 120, { color: '#384838', size: 5 });
  } else if (state.battlePhase === 'MENU') {
    drawPixelText(ctx, 'What will', 10, 104, { color: '#182018', size: 5 });
    drawPixelText(ctx, `${playerSp.name} do?`, 10, 116, { color: '#182018', size: 5 });

    drawGBCBox(ctx, 78, 94, 80, 48);
    const opts = ['FIGHT', 'PKMN', state.isWild ? `BALL(${state.balls})` : `POTN(${state.potions})`, 'RUN'];
    opts.forEach((label, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ox = 86 + col * 36;
      const oy = 104 + row * 18;
      if (state.menuCursor === idx) {
        drawPixelText(ctx, '>', ox - 6, oy, { color: '#d83030', size: 5 });
      }
      drawPixelText(ctx, label, ox, oy, { color: '#182018', size: 5 });
    });
  } else if (state.battlePhase === 'MOVES') {
    playerSp.moves.forEach((mv, idx) => {
      const oy = 101 + idx * 12;
      if (state.moveCursor === idx) {
        drawPixelText(ctx, '>', 8, oy, { color: '#d83030', size: 5 });
      }
      drawPixelText(ctx, `${mv.name} (${mv.type})`, 16, oy, { color: '#182018', size: 5 });
    });
  } else if (state.battlePhase === 'PARTY') {
    state.party.slice(0, 3).forEach((pm, idx) => {
      const sp = getSpecies(pm.speciesId);
      const oy = 101 + idx * 12;
      if (state.partyCursor === idx) {
        drawPixelText(ctx, '>', 8, oy, { color: '#d83030', size: 5 });
      }
      drawPixelText(ctx, `${sp.name} Lv${pm.level} ${pm.hp}/${pm.maxHp}`, 16, oy, { color: '#182018', size: 5 });
    });
  }
}
