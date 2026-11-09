import {
  buildHardwareTestRom,
  customizeGen1Sram,
  GBHardwareEmulator,
  parseGen1SramSummary,
} from '../../core/gb-emulator';
import {
  drawGBCBox,
  drawHealthBar,
  drawPixelSprite,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

type ElementType = 'FIRE' | 'WATER' | 'GRASS' | 'VOLT' | 'EARTH';
type VersionId = 'RED' | 'BLUE';

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
  evolvesTo?: string;
  evolveLv?: number;
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

const KANTO_SPECIES: MonsterSpecies[] = [
  {
    id: 'charmander',
    name: 'CHARMANDER',
    type: 'FIRE',
    baseHp: 34,
    baseAtk: 12,
    color1: '#f05028',
    color2: '#f8d030',
    evolvesTo: 'charizard',
    evolveLv: 8,
    sprite: [
      '....1111....',
      '...111111...',
      '..11311311..',
      '..11111111..',
      '...112211...',
      '..11122111.2',
      '.11.1221.122',
      '....1221.22.',
      '...11..111..',
      '..11....11..',
      '............',
      '............',
    ],
    moves: [
      { name: 'EMBER', type: 'FIRE', power: 13 },
      { name: 'FLAMETHROWER', type: 'FIRE', power: 17 },
      { name: 'SLASH', type: 'EARTH', power: 12 },
    ],
  },
  {
    id: 'charizard',
    name: 'CHARIZARD',
    type: 'FIRE',
    baseHp: 46,
    baseAtk: 15,
    color1: '#e84820',
    color2: '#f8c828',
    sprite: [
      '.11..1111..1',
      '122111111122',
      '122113113122',
      '.1111111111.',
      '..111222211.',
      '.11122222212',
      '11.112222122',
      '...11222211.',
      '..111....111',
      '.111......11',
      '............',
      '............',
    ],
    moves: [
      { name: 'FIRE BLAST', type: 'FIRE', power: 19 },
      { name: 'FLAMETHROWER', type: 'FIRE', power: 16 },
      { name: 'WING ATTACK', type: 'EARTH', power: 13 },
    ],
  },
  {
    id: 'squirtle',
    name: 'SQUIRTLE',
    type: 'WATER',
    baseHp: 36,
    baseAtk: 11,
    color1: '#2888f8',
    color2: '#d89848',
    evolvesTo: 'blastoise',
    evolveLv: 8,
    sprite: [
      '....1111....',
      '..11111111..',
      '.1131111311.',
      '.1111111111.',
      '..11222211..',
      '.11222222111',
      '11.222222.11',
      '...122221...',
      '..111..111..',
      '..11....11..',
      '............',
      '............',
    ],
    moves: [
      { name: 'BUBBLE', type: 'WATER', power: 13 },
      { name: 'WATER GUN', type: 'WATER', power: 16 },
      { name: 'SKULL BASH', type: 'EARTH', power: 12 },
    ],
  },
  {
    id: 'blastoise',
    name: 'BLASTOISE',
    type: 'WATER',
    baseHp: 48,
    baseAtk: 14,
    color1: '#1868d8',
    color2: '#b87838',
    sprite: [
      '.22.1111.22.',
      '.2211111122.',
      '..11311311..',
      '.1111111111.',
      '112222222211',
      '112222222211',
      '.1222222221.',
      '..11222211..',
      '.1111..1111.',
      '.111....111.',
      '............',
      '............',
    ],
    moves: [
      { name: 'HYDRO PUMP', type: 'WATER', power: 19 },
      { name: 'SURF', type: 'WATER', power: 16 },
      { name: 'BITE', type: 'EARTH', power: 13 },
    ],
  },
  {
    id: 'bulbasaur',
    name: 'BULBASAUR',
    type: 'GRASS',
    baseHp: 37,
    baseAtk: 11,
    color1: '#38b858',
    color2: '#208038',
    sprite: [
      '....2222....',
      '..22222222..',
      '.2221111222.',
      '.1111111111.',
      '113111111311',
      '111111111111',
      '.1111111111.',
      '.111....111.',
      '.11......11.',
      '............',
      '............',
      '............',
    ],
    moves: [
      { name: 'VINE WHIP', type: 'GRASS', power: 13 },
      { name: 'RAZOR LEAF', type: 'GRASS', power: 16 },
      { name: 'BODY SLAM', type: 'EARTH', power: 12 },
    ],
  },
  {
    id: 'pikachu',
    name: 'PIKACHU',
    type: 'VOLT',
    baseHp: 32,
    baseAtk: 13,
    color1: '#f8d020',
    color2: '#e84020',
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
      '............',
      '............',
    ],
    moves: [
      { name: 'THUNDERBOLT', type: 'VOLT', power: 16 },
      { name: 'THUNDER', type: 'VOLT', power: 18 },
      { name: 'QUICK ATTACK', type: 'EARTH', power: 11 },
    ],
  },
  {
    id: 'growlithe',
    name: 'GROWLITHE',
    type: 'FIRE',
    baseHp: 35,
    baseAtk: 13,
    color1: '#f06028',
    color2: '#f8e090',
    sprite: [
      '..221111....',
      '.22111111...',
      '.11311131...',
      '..11111122..',
      '..122112221.',
      '.1111111111.',
      '.1122112211.',
      '..11....11..',
      '.11......11.',
      '............',
      '............',
      '............',
    ],
    moves: [
      { name: 'FLAME WHEEL', type: 'FIRE', power: 15 },
      { name: 'EMBER', type: 'FIRE', power: 13 },
      { name: 'TAKE DOWN', type: 'EARTH', power: 12 },
    ],
  },
  {
    id: 'vulpix',
    name: 'VULPIX',
    type: 'FIRE',
    baseHp: 34,
    baseAtk: 12,
    color1: '#e05830',
    color2: '#f8b858',
    sprite: [
      '..222..222..',
      '.1122112211.',
      '.1131111311.',
      '..11111111..',
      '..1111111222',
      '.11111112222',
      '..111..1122.',
      '..11....11..',
      '............',
      '............',
      '............',
      '............',
    ],
    moves: [
      { name: 'FLAMETHROWER', type: 'FIRE', power: 16 },
      { name: 'FIRE SPIN', type: 'FIRE', power: 13 },
      { name: 'QUICK ATTACK', type: 'EARTH', power: 11 },
    ],
  },
  {
    id: 'onix',
    name: 'ONIX',
    type: 'EARTH',
    baseHp: 42,
    baseAtk: 12,
    color1: '#908880',
    color2: '#c8c0b8',
    sprite: [
      '....11......',
      '..112211....',
      '.11311311...',
      '.11111111...',
      '...112211...',
      '....112211..',
      '..11221111..',
      '.112211.....',
      '..1111111...',
      '....111221..',
      '............',
      '............',
    ],
    moves: [
      { name: 'ROCK THROW', type: 'EARTH', power: 15 },
      { name: 'EARTHQUAKE', type: 'EARTH', power: 18 },
      { name: 'BIND', type: 'EARTH', power: 11 },
    ],
  },
  {
    id: 'starmie',
    name: 'STARMIE',
    type: 'WATER',
    baseHp: 38,
    baseAtk: 14,
    color1: '#8858d8',
    color2: '#f8d038',
    sprite: [
      '.....11.....',
      '....1111....',
      '.1111221111.',
      '..11233211..',
      '...123321...',
      '..11222211..',
      '.1111111111.',
      '.11..11..11.',
      '............',
      '............',
      '............',
      '............',
    ],
    moves: [
      { name: 'BUBBLEBEAM', type: 'WATER', power: 16 },
      { name: 'HYDRO PUMP', type: 'WATER', power: 18 },
      { name: 'THUNDERBOLT', type: 'VOLT', power: 14 },
    ],
  },
  {
    id: 'mewtwo',
    name: 'MEWTWO',
    type: 'VOLT',
    baseHp: 50,
    baseAtk: 16,
    color1: '#c8a8e8',
    color2: '#8848b8',
    sprite: [
      '..11....11..',
      '..11111111..',
      '..13111131..',
      '...111111...',
      '..11122111..',
      '.11.1221.112',
      '....1221..22',
      '...11221122.',
      '..11....11..',
      '.11......11.',
      '............',
      '............',
    ],
    moves: [
      { name: 'PSYCHIC', type: 'VOLT', power: 19 },
      { name: 'THUNDERBOLT', type: 'VOLT', power: 16 },
      { name: 'SWIFT', type: 'EARTH', power: 13 },
    ],
  },
];

function getTypeMultiplier(atk: ElementType, def: ElementType): number {
  if (atk === 'FIRE' && def === 'GRASS') return 1.65;
  if (atk === 'FIRE' && (def === 'WATER' || def === 'EARTH')) return 0.65;
  if (atk === 'WATER' && (def === 'FIRE' || def === 'EARTH')) return 1.65;
  if (atk === 'WATER' && def === 'GRASS') return 0.65;
  if (atk === 'GRASS' && (def === 'WATER' || def === 'EARTH')) return 1.65;
  if (atk === 'GRASS' && def === 'FIRE') return 0.65;
  if (atk === 'VOLT' && def === 'WATER') return 1.65;
  if (atk === 'VOLT' && def === 'EARTH') return 0.6;
  if (atk === 'EARTH' && (def === 'VOLT' || def === 'FIRE')) return 1.65;
  return 1.0;
}

// 10x9 Kanto Overworld Tile Map (16x16 tiles = 160x144 screen)
// T = tree, . = road, G = Route 1 tall grass, W = water, H = PokeCenter roof,
// D = PokeCenter Heal Door, O = Prof. Oak Starter Table, N = Gym Leader (Brock / Misty)
const MAP_ROWS = [
  'TTTTTGGTTT',
  'THHHTGG..T',
  'T.D.TGGG.T',
  'T... ....T',
  'T.O..N.GGT',
  'T....GGGGT',
  'TWW...GGGT',
  'TWW....o.T',
  'TTTTTTTTTT',
];

type Mode =
  | 'PROFILES'
  | 'TITLE'
  | 'OVERWORLD'
  | 'STARTER_SELECT'
  | 'ENCOUNTER_FLASH'
  | 'BATTLE'
  | 'DIALOG'
  | 'EMU_ROM';

interface SaveProgress {
  party: PartyMonster[];
  balls: number;
  potions: number;
  wins: number;
  badges: number;
}

export interface TrainerAccountProfile {
  slot: number;
  playerName: string;
  rivalName: string;
  badges: number;
  badgesMask: number;
  pokedexOwned: number;
  hours: number;
  minutes: number;
  locationLabel: string;
  hasSave: boolean;
}

const BUNDLED_ROM_CACHE: Record<VersionId, Uint8Array | null> = {
  RED: null,
  BLUE: null,
};
let BUNDLED_SLOT1_SRAM: Uint8Array | null = null;
let BUNDLED_SLOT2_SRAM: Uint8Array | null = null;
const BUNDLED_LOAD_PROMISES: Partial<Record<VersionId, Promise<void>>> = {};

async function ensureBundledRomAndSram(version: VersionId): Promise<void> {
  if (BUNDLED_ROM_CACHE[version] && BUNDLED_SLOT1_SRAM && BUNDLED_SLOT2_SRAM) return;
  if (!BUNDLED_LOAD_PROMISES[version]) {
    const romUrl = version === 'RED' ? './roms/pokemon-red.gb' : './roms/pokemon-blue.gb';
    BUNDLED_LOAD_PROMISES[version] = (async () => {
      try {
        const [romRes, sram1Res, sram2Res] = await Promise.all([
          BUNDLED_ROM_CACHE[version] ? Promise.resolve(null) : fetch(romUrl),
          BUNDLED_SLOT1_SRAM ? Promise.resolve(null) : fetch('./roms/pokemon-red-base.sav'),
          BUNDLED_SLOT2_SRAM ? Promise.resolve(null) : fetch('./roms/pokemon-red-slot2.sav'),
        ]);
        if (romRes && romRes.ok) {
          BUNDLED_ROM_CACHE[version] = new Uint8Array(await romRes.arrayBuffer());
        }
        if (sram1Res && sram1Res.ok) {
          BUNDLED_SLOT1_SRAM = new Uint8Array(await sram1Res.arrayBuffer());
        }
        if (sram2Res && sram2Res.ok) {
          BUNDLED_SLOT2_SRAM = new Uint8Array(await sram2Res.arrayBuffer());
        }
      } catch (err) {
        console.warn(`Failed to fetch bundled ${version} ROM/SRAM:`, err);
      } finally {
        if (!BUNDLED_ROM_CACHE[version]) {
          delete BUNDLED_LOAD_PROMISES[version];
        }
      }
    })();
  }
  await BUNDLED_LOAD_PROMISES[version];
}

function getSpecies(id: string): MonsterSpecies {
  return KANTO_SPECIES.find((s) => s.id === id) ?? KANTO_SPECIES[0];
}

function createPartyMonster(speciesId: string, level: number): PartyMonster {
  const sp = getSpecies(speciesId);
  const maxHp = sp.baseHp + level * 4;
  return {
    speciesId: sp.id,
    level,
    hp: maxHp,
    maxHp,
    xp: 0,
  };
}

export function createPokemonVersionCartridge(version: VersionId): GameCartridge {
  const isRed = version === 'RED';
  const cartId = isRed ? 'pokemon-red' : 'pokemon-blue';
  const mascotId = isRed ? 'charizard' : 'blastoise';
  const defaultStarterId = isRed ? 'charmander' : 'squirtle';
  const gymLeaderName = isRed ? 'GYM BROCK' : 'GYM MISTY';
  const gymBossId = isRed ? 'onix' : 'starmie';
  const badgeName = isRed ? 'BOULDERBADGE' : 'CASCADEBADGE';
  const primaryHex = isRed ? '#d82828' : '#1e58d8';
  const accentHex = isRed ? '#ff7838' : '#48b8ff';
  const sgbPalette: [number, number, number, number] = isRed
    ? [0xfff4f0, 0xf89878, 0xd82828, 0x181018]
    : [0xf0f6ff, 0x68b8f8, 0x1e58d8, 0x101828];

  const wildPool = isRed
    ? ['charmander', 'pikachu', 'growlithe', 'bulbasaur', 'onix', 'mewtwo']
    : ['squirtle', 'pikachu', 'vulpix', 'bulbasaur', 'starmie', 'mewtwo'];

  const hwEmulator = new GBHardwareEmulator();

  function createDefaultProfiles(): TrainerAccountProfile[] {
    return [
      {
        slot: 0,
        playerName: isRed ? 'RED' : 'BLUE',
        rivalName: isRed ? 'BLUE' : 'RED',
        badges: 1,
        badgesMask: isRed ? 0x01 : 0x02,
        pokedexOwned: isRed ? 4 : 5,
        hours: 2,
        minutes: isRed ? 15 : 40,
        locationLabel: 'PALLET HOUSE',
        hasSave: true,
      },
      {
        slot: 1,
        playerName: isRed ? 'ASH' : 'GARY',
        rivalName: isRed ? 'GARY' : 'ASH',
        badges: 8,
        badgesMask: 0xff,
        pokedexOwned: 151,
        hours: isRed ? 42 : 38,
        minutes: isRed ? 30 : 45,
        locationLabel: 'PROF. OAK LAB',
        hasSave: true,
      },
      {
        slot: 2,
        playerName: 'NEW TRAINER',
        rivalName: isRed ? 'BLUE' : 'RED',
        badges: 0,
        badgesMask: 0x00,
        pokedexOwned: 0,
        hours: 0,
        minutes: 0,
        locationLabel: 'PROF. OAK INTRO',
        hasSave: false,
      },
    ];
  }

  const state = {
    ctx: null as unknown as GameContext,
    animTime: 0,
    mode: 'PROFILES' as Mode,
    profiles: createDefaultProfiles(),
    profileCursor: 0,
    activeProfileSlot: 0,
    sramSyncTimer: 0,
    romReady: false,
    titleCursor: 0, // 0: PLAY KANTO, 1: GYM LEADER, 2: LOAD .GB ROM
    starterCursor: isRed ? 0 : 1, // 0: CHARMANDER, 1: SQUIRTLE, 2: BULBASAUR
    playerX: 3,
    playerY: 3,
    facing: 'down' as 'up' | 'down' | 'left' | 'right',
    moveCooldown: 0,
    party: [] as PartyMonster[],
    activePartyIdx: 0,
    balls: 6,
    potions: 3,
    wins: 0,
    badges: 0,
    dialogLine1: '',
    dialogLine2: '',
    flashTimer: 0,

    // Battle state
    enemy: null as PartyMonster | null,
    isWild: true,
    trainerTitle: '',
    battlePhase: 'MENU' as 'MENU' | 'MOVES' | 'PARTY' | 'MSG' | 'CATCH_ANIM',
    menuCursor: 0,
    moveCursor: 0,
    partyCursor: 0,
    battleMsg1: '',
    battleMsg2: '',
    afterMsgAction: null as (() => void) | null,
    catchShakeTimer: 0,
  };

  function getProfileSramKey(slot: number): string {
    return `${cartId}-sram-v4-slot-${slot}`;
  }

  function buildDefaultSlotSram(prof: TrainerAccountProfile): number[] | null {
    const baseSram = prof.slot === 1 ? BUNDLED_SLOT2_SRAM ?? BUNDLED_SLOT1_SRAM : BUNDLED_SLOT1_SRAM;
    if (!baseSram) return null;
    const isSlot2 = prof.slot === 1;
    const leadSpeciesByte = isSlot2 ? (isRed ? 0xb4 : 0x1c) : (isRed ? 0xb0 : 0xb1);
    const leadNickname = isSlot2 ? (isRed ? 'CHARIZARD' : 'BLASTOISE') : (isRed ? 'CHARMANDER' : 'SQUIRTLE');
    return customizeGen1Sram(baseSram, {
      playerName: prof.playerName,
      rivalName: prof.rivalName,
      badgesMask: prof.badgesMask,
      pokedexOwnedCount: prof.pokedexOwned,
      hours: prof.hours,
      minutes: prof.minutes,
      leadSpeciesByte,
      leadNickname,
    });
  }

  function loadAndSyncProfiles(): void {
    if (!state.ctx) return;
    const defaults = createDefaultProfiles();
    const savedProfiles = state.ctx.storage.loadData<TrainerAccountProfile[] | null>(
      `${cartId}-profiles-v4`,
      null
    );
    state.profiles = savedProfiles && savedProfiles.length === 3 ? savedProfiles : defaults;

    // Ensure each profile with hasSave has its own distinct 32KB SRAM in storage and sync live stats from SRAM
    for (const prof of state.profiles) {
      let sram = state.ctx.storage.loadData<number[] | null>(getProfileSramKey(prof.slot), null);
      if ((!sram || sram.length < 0x3524) && prof.hasSave) {
        const built = buildDefaultSlotSram(prof);
        if (built) {
          sram = built;
          state.ctx.storage.saveData<number[]>(getProfileSramKey(prof.slot), sram);
        }
      }
      const summary = parseGen1SramSummary(sram);
      if (summary && summary.hasValidSave) {
        prof.playerName = summary.playerName;
        prof.badges = summary.badges;
        prof.pokedexOwned = summary.pokedexOwned;
        prof.hours = summary.hours;
        prof.minutes = summary.minutes;
        prof.hasSave = true;
      }
    }
    state.ctx.storage.saveData<TrainerAccountProfile[]>(`${cartId}-profiles-v4`, state.profiles);
  }

  function bootProfileIntoRealRom(
    slot: number,
    bootTarget: 'TITLE' | 'MAIN_MENU' | 'CONTINUE_INFO' | 'CONTINUE_GAME' | 'OAK_INTRO' = 'CONTINUE_GAME'
  ): boolean {
    const romBytes = BUNDLED_ROM_CACHE[version] ?? hwEmulator.getRawBytes();
    if (!romBytes) return false;

    state.activeProfileSlot = slot;
    state.profileCursor = slot;
    const prof = state.profiles[slot] ?? state.profiles[0];

    let sram = state.ctx?.storage.loadData<number[] | null>(getProfileSramKey(slot), null) ?? null;
    if ((!sram || sram.length < 0x3524) && prof.hasSave) {
      const built = buildDefaultSlotSram(prof);
      if (built) {
        sram = built;
        state.ctx?.storage.saveData<number[]>(getProfileSramKey(slot), sram);
      }
    }

    const effectiveSram = bootTarget === 'OAK_INTRO' || !prof.hasSave ? null : sram;
    const meta = hwEmulator.loadRom(`${cartId}.gb`, romBytes, effectiveSram, sgbPalette);
    if (meta.isExecutable && hwEmulator.isRunningHardware()) {
      const target =
        (bootTarget === 'CONTINUE_INFO' || bootTarget === 'CONTINUE_GAME') && !prof.hasSave
          ? 'OAK_INTRO'
          : bootTarget;
      hwEmulator.fastForwardGen1Boot(target);
      state.mode = 'EMU_ROM';
      state.ctx?.audio.stopBGM();
      return true;
    }
    return false;
  }

  function saveProgress(): void {
    if (!state.ctx) return;
    state.ctx.storage.saveData<SaveProgress>(cartId, {
      party: state.party,
      balls: state.balls,
      potions: state.potions,
      wins: state.wins,
      badges: state.badges,
    });

    if (hwEmulator.isRunningHardware()) {
      const { sram, summary } = hwEmulator.extractGen1SramWithLiveSync();
      if (sram.length > 0 && summary && summary.hasValidSave) {
        const slot = state.activeProfileSlot;
        state.ctx.storage.saveData<number[]>(getProfileSramKey(slot), sram);
        state.ctx.storage.saveData<number[]>(`${cartId}-sram`, sram);
        const prof = state.profiles[slot];
        if (prof) {
          prof.playerName = summary.playerName;
          prof.badges = summary.badges;
          prof.pokedexOwned = summary.pokedexOwned;
          prof.hours = summary.hours;
          prof.minutes = summary.minutes;
          prof.hasSave = true;
          state.ctx.storage.saveData<TrainerAccountProfile[]>(
            `${cartId}-profiles-v4`,
            state.profiles
          );
        }
      }
    }

    const bestProfileBadges = Math.max(
      state.badges,
      ...state.profiles.map((p) => (p.hasSave ? p.badges : 0))
    );
    const bestDex = Math.max(
      state.party.length,
      ...state.profiles.map((p) => (p.hasSave ? p.pokedexOwned : 0))
    );
    state.ctx.storage.setHighScore(
      cartId,
      state.wins * 100 + bestProfileBadges * 250 + bestDex * 25
    );
  }

  function showDialog(l1: string, l2 = ''): void {
    state.dialogLine1 = l1;
    state.dialogLine2 = l2;
    state.mode = 'DIALOG';
  }

  function startBattle(isWild: boolean, customEnemyId?: string, customLv?: number, trainerName = ''): void {
    state.isWild = isWild;
    state.trainerTitle = trainerName;
    const chosenId =
      customEnemyId ?? wildPool[Math.floor(Math.random() * wildPool.length)];
    const avgLv = Math.max(5, state.party[0]?.level ?? 5);
    const enemyLv =
      customLv ?? (isWild ? Math.max(3, avgLv - 1 + Math.floor(Math.random() * 3)) : avgLv + 2);
    state.enemy = createPartyMonster(chosenId, enemyLv);

    const healthyIdx = state.party.findIndex((m) => m.hp > 0);
    if (healthyIdx === -1) {
      state.party.forEach((m) => {
        m.hp = m.maxHp;
      });
      state.activePartyIdx = 0;
    } else {
      state.activePartyIdx = healthyIdx;
    }

    state.flashTimer = 0.5;
    state.mode = 'ENCOUNTER_FLASH';
    state.menuCursor = 0;
    state.moveCursor = 0;
    const sp = getSpecies(state.enemy.speciesId);
    state.battleMsg1 = isWild
      ? `Wild ${sp.name} appeared!`
      : `${trainerName || gymLeaderName} sent ${sp.name}!`;
    state.battleMsg2 = `Go! ${getSpecies(state.party[state.activePartyIdx].speciesId).name}!`;
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

  function endBattleToOverworld(): void {
    state.mode = 'OVERWORLD';
    state.ctx.audio.startBGM('monster_town');
  }

  function executePlayerMove(move: MoveDef): void {
    const playerMon = state.party[state.activePartyIdx];
    const enemyMon = state.enemy!;
    const playerSp = getSpecies(playerMon.speciesId);
    const enemySp = getSpecies(enemyMon.speciesId);

    const mult = getTypeMultiplier(move.type, enemySp.type);
    const rawDmg = ((playerSp.baseAtk + playerMon.level * 1.65) * move.power) / 14;
    const dmg = Math.max(3, Math.round(rawDmg * mult));

    enemyMon.hp = Math.max(0, enemyMon.hp - dmg);
    state.ctx.audio.playHit();

    const effText =
      mult > 1.1
        ? "It's super effective!"
        : mult < 0.9
          ? 'Not very effective...'
          : `Dealt ${dmg} damage!`;

    setBattleMessage(`${playerSp.name} used ${move.name}!`, effText, () => {
      if (enemyMon.hp <= 0) {
        state.wins++;
        if (!state.isWild) {
          state.badges++;
        }
        playerMon.xp += state.isWild ? 25 : 50;
        let lvMsg = state.isWild ? 'Gained 25 EXP!' : `Won ${badgeName}!`;
        if (playerMon.xp >= 50) {
          playerMon.xp -= 50;
          playerMon.level++;
          playerMon.maxHp += 5;
          playerMon.hp = playerMon.maxHp;
          if (playerSp.evolvesTo && playerMon.level >= (playerSp.evolveLv ?? 8)) {
            playerMon.speciesId = playerSp.evolvesTo;
            const evoSp = getSpecies(playerMon.speciesId);
            lvMsg = `Evolved into ${evoSp.name}!`;
          } else {
            lvMsg = `Grew to Lv.${playerMon.level}!`;
          }
        }
        state.ctx.audio.playPowerUp();
        saveProgress();
        setBattleMessage(`Foe ${enemySp.name} fainted!`, lvMsg, () => {
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
    const rawDmg = ((enemySp.baseAtk + enemyMon.level * 1.35) * move.power) / 16;
    const dmg = Math.max(2, Math.round(rawDmg * mult));

    playerMon.hp = Math.max(0, playerMon.hp - dmg);
    state.ctx.audio.playHit();

    setBattleMessage(`Foe ${enemySp.name} used`, `${move.name}! (-${dmg} HP)`, () => {
      if (playerMon.hp <= 0) {
        const nextHealthy = state.party.findIndex((m) => m.hp > 0);
        if (nextHealthy !== -1) {
          state.activePartyIdx = nextHealthy;
          const nextSp = getSpecies(state.party[nextHealthy].speciesId);
          setBattleMessage(`${playerSp.name} fainted!`, `Go! ${nextSp.name}!`, () => {
            state.battlePhase = 'MENU';
          });
        } else {
          state.party.forEach((m) => {
            m.hp = m.maxHp;
          });
          setBattleMessage('Party healed at', 'PALLET POKE CENTER!', () => {
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

  function updateProfiles(input: InputState): void {
    if (input.justPressed.up && state.profileCursor > 0) {
      state.profileCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.down && state.profileCursor < 2) {
      state.profileCursor++;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.b) {
      state.ctx.audio.playMenuBack();
      state.ctx.exitToMenu();
    } else if (input.justPressed.select) {
      // SELECT boots the real ROM directly onto its iconic Title Screen
      state.ctx.audio.playMenuSelect();
      if (!bootProfileIntoRealRom(state.profileCursor, 'TITLE')) {
        ensureBundledRomAndSram(version).then(() => {
          state.romReady = Boolean(BUNDLED_ROM_CACHE[version]);
          loadAndSyncProfiles();
          bootProfileIntoRealRom(state.profileCursor, 'TITLE');
        });
      }
    } else if (input.justPressed.a || input.justPressed.start) {
      state.ctx.audio.playMenuSelect();
      const chosen = state.profiles[state.profileCursor];
      // Boot saved profiles directly into their own live Kanto overworld (CONTINUE_GAME) so menus never overlap
      const target = chosen?.hasSave ? 'CONTINUE_GAME' : 'OAK_INTRO';
      if (!bootProfileIntoRealRom(state.profileCursor, target)) {
        ensureBundledRomAndSram(version).then(() => {
          state.romReady = Boolean(BUNDLED_ROM_CACHE[version]);
          loadAndSyncProfiles();
          if (!bootProfileIntoRealRom(state.profileCursor, target)) {
            state.mode = 'OVERWORLD';
            state.ctx.audio.startBGM('monster_town');
          }
        });
      }
    }
  }

  function updateTitle(input: InputState): void {
    if (input.justPressed.b) {
      state.ctx.audio.playMenuBack();
      state.mode = 'PROFILES';
      return;
    }
    if (input.justPressed.up && state.titleCursor > 0) {
      state.titleCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.down && state.titleCursor < 2) {
      state.titleCursor++;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.a || input.justPressed.start) {
      state.ctx.audio.playMenuSelect();
      if (state.titleCursor === 0) {
        state.mode = 'PROFILES';
      } else if (state.titleCursor === 1) {
        startBattle(false, gymBossId, 9, gymLeaderName);
      } else if (state.titleCursor === 2) {
        state.ctx.openRomFilePicker();
      }
    }
  }

  function updateStarterSelect(input: InputState): void {
    if (input.justPressed.left && state.starterCursor > 0) {
      state.starterCursor--;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.right && state.starterCursor < 2) {
      state.starterCursor++;
      state.ctx.audio.playMenuMove();
    } else if (input.justPressed.b) {
      state.ctx.audio.playMenuBack();
      state.mode = 'OVERWORLD';
    } else if (input.justPressed.a || input.justPressed.start) {
      const starters = ['charmander', 'squirtle', 'bulbasaur'];
      const chosenId = starters[state.starterCursor];
      const sp = getSpecies(chosenId);
      state.party[0] = createPartyMonster(chosenId, Math.max(5, state.party[0]?.level ?? 5));
      state.ctx.audio.playPowerUp();
      saveProgress();
      showDialog(`OAK: You chose ${sp.name}!`, 'Take on Route 1 & the Gym!');
    }
  }

  function updateOverworld(input: InputState): void {
    if (input.justPressed.start) {
      state.ctx.audio.playMenuMove();
      state.mode = 'TITLE';
      return;
    }

    if (state.moveCooldown <= 0) {
      let dx = 0;
      let dy = 0;
      if (input.held.up) {
        dy = -1;
        state.facing = 'up';
      } else if (input.held.down) {
        dy = 1;
        state.facing = 'down';
      } else if (input.held.left) {
        dx = -1;
        state.facing = 'left';
      } else if (input.held.right) {
        dx = 1;
        state.facing = 'right';
      }

      if (dx !== 0 || dy !== 0) {
        state.moveCooldown = 0.16;
        const nx = state.playerX + dx;
        const ny = state.playerY + dy;
        const tile = MAP_ROWS[ny]?.[nx] ?? 'T';

        if (tile === 'D') {
          state.party.forEach((m) => {
            m.hp = m.maxHp;
          });
          state.balls = Math.max(state.balls, 6);
          state.potions = Math.max(state.potions, 3);
          state.ctx.audio.playPowerUp();
          saveProgress();
          showDialog('POKE CENTER: Party healed!', 'Poke Balls & Potions filled!');
          return;
        }

        if (tile === 'O') {
          state.ctx.audio.playMenuSelect();
          state.mode = 'STARTER_SELECT';
          return;
        }

        if (tile === 'N') {
          startBattle(false, gymBossId, 9, gymLeaderName);
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
        state.party.forEach((m) => {
          m.hp = m.maxHp;
        });
        state.ctx.audio.playPowerUp();
        showDialog('NURSE JOY: Your Pokemon', 'are fighting fit again!');
      } else if (frontTile === 'O') {
        state.ctx.audio.playMenuSelect();
        state.mode = 'STARTER_SELECT';
      } else if (frontTile === 'N') {
        startBattle(false, gymBossId, 9, gymLeaderName);
      } else {
        const lead = state.party[0];
        const sp = getSpecies(lead.speciesId);
        showDialog(
          `${sp.name} Lv.${lead.level} (${state.party.length}/6)`,
          `Badges:${state.badges} Wins:${state.wins} Ball:${state.balls}`
        );
      }
    }
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
        const catchChance = 0.48 + (1 - hpRatio) * 0.5;
        if (Math.random() <= catchChance) {
          state.ctx.audio.playPowerUp();
          if (state.party.length < 6) {
            state.party.push({ ...enemyMon });
          }
          state.wins++;
          saveProgress();
          setBattleMessage(`Gotcha! ${enemySp.name}`, 'was caught! Added to party!', () => {
            endBattleToOverworld();
          });
        } else {
          state.ctx.audio.playMenuBack();
          setBattleMessage(`Shoot! ${enemySp.name}`, 'broke free from the ball!', () => {
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
          if (
            state.isWild &&
            state.balls > 0 &&
            (playerMon.hp > playerMon.maxHp * 0.4 || state.potions === 0)
          ) {
            state.balls--;
            state.catchShakeTimer = 1.05;
            state.battlePhase = 'CATCH_ANIM';
            state.ctx.audio.playJump();
          } else if (state.potions > 0) {
            state.potions--;
            playerMon.hp = Math.min(playerMon.maxHp, playerMon.hp + 26);
            state.ctx.audio.playPowerUp();
            setBattleMessage(
              `SUPER POTION on ${playerSp.name}!`,
              `Recovered 26 HP! (${state.potions} left)`,
              () => {
                enemyTurn();
              }
            );
          } else {
            setBattleMessage('No items left in BAG!', 'Visit Pallet Poke Center!', () => {
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

  function renderProfiles(ctx: CanvasRenderingContext2D): void {
    // Super Game Boy Red / Blue border & cream backdrop
    ctx.fillStyle = isRed ? '#fff4f0' : '#f0f6ff';
    ctx.fillRect(0, 0, 160, 144);

    // Top Version & ROM Status Banner
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 160, 22);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 20, 160, 2);

    drawPixelText(ctx, `POKEMON ${version} - ACCOUNTS`, 80, 3, {
      color: '#f8e838',
      size: 5,
      align: 'center',
      shadow: '#181818',
    });
    drawPixelText(
      ctx,
      state.romReady ? '1MB GEN-1 ROM & SRAM READY' : 'LOADING GEN-1 ROM...',
      80,
      12,
      {
        color: '#ffffff',
        size: 3.8,
        align: 'center',
      }
    );

    // 3 Trainer Account Profile Cards (distinct lead Pokemon, location, and stats per slot)
    state.profiles.forEach((prof, idx) => {
      const sel = state.profileCursor === idx;
      const by = 25 + idx * 34;

      drawGBCBox(ctx, 5, by, 150, 31, {
        bg: sel ? '#ffffff' : '#edece2',
        borderOuter: sel ? primaryHex : '#889098',
        borderInner: sel ? accentHex : '#c8ccd0',
      });

      if (sel) {
        drawPixelText(ctx, '>', 8, by + 11, { color: primaryHex, size: 5 });
      }

      if (prof.hasSave) {
        const iconSpeciesId = idx === 1 ? mascotId : defaultStarterId;
        const iconSp = getSpecies(iconSpeciesId);
        drawMonsterSprite(ctx, iconSp, 14, by + 10, 1);

        const timeStr = `${String(prof.hours).padStart(2, '0')}:${String(prof.minutes).padStart(2, '0')}`;
        drawPixelText(ctx, `FILE ${idx + 1}: ${prof.playerName}`, 27, by + 5, {
          color: sel ? '#101820' : '#384450',
          size: 4.3,
        });
        drawPixelText(ctx, prof.locationLabel, 149, by + 5, {
          color: primaryHex,
          size: 3.7,
          align: 'right',
        });
        drawPixelText(
          ctx,
          `BDG:${prof.badges}  DEX:${String(prof.pokedexOwned).padStart(3, '0')}  TIME:${timeStr}`,
          27,
          by + 17,
          {
            color: sel ? '#203828' : '#586470',
            size: 3.9,
          }
        );
      } else {
        // Draw mini Poke Ball icon for fresh New Game slot
        ctx.fillStyle = primaryHex;
        ctx.fillRect(15, by + 11, 8, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(15, by + 15, 8, 4);
        ctx.fillStyle = '#181818';
        ctx.fillRect(15, by + 14, 8, 1);
        ctx.fillRect(18, by + 13, 2, 3);

        drawPixelText(ctx, `FILE ${idx + 1}: + START NEW GAME`, 27, by + 6, {
          color: sel ? primaryHex : '#384450',
          size: 4.3,
        });
        drawPixelText(ctx, 'PROF. OAK INTRO / FRESH SAVE', 27, by + 17, {
          color: '#586470',
          size: 3.8,
        });
      }
    });

    // Footer instruction bar
    ctx.fillStyle = '#182028';
    ctx.fillRect(0, 129, 160, 15);
    drawPixelText(ctx, 'A/START:PLAY  SEL:TITLE  B:EXIT', 80, 134, {
      color: '#f8e838',
      size: 3.9,
      align: 'center',
    });
  }

  function renderTitle(ctx: CanvasRenderingContext2D): void {
    // Super Game Boy Red / Blue border & cream backdrop
    ctx.fillStyle = isRed ? '#fff4f0' : '#f0f6ff';
    ctx.fillRect(0, 0, 160, 144);

    // Top Version Banner
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 160, 27);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 25, 160, 2);

    drawPixelText(ctx, 'POKEMON', 80, 4, {
      color: '#f8e838',
      size: 9,
      align: 'center',
      shadow: '#181818',
    });
    drawPixelText(ctx, isRed ? 'RED VERSION' : 'BLUE VERSION', 80, 17, {
      color: '#ffffff',
      size: 5,
      align: 'center',
    });

    // Mascot (Charizard or Blastoise) + Trainer Red/Blue showcase
    const mascot = getSpecies(mascotId);
    const bounce = Math.round(Math.sin(state.animTime * 4) * 1.5);
    drawMonsterSprite(ctx, mascot, 22, 34 + bounce, 3);
    drawTrainerSprite(
      ctx,
      106,
      44,
      isRed ? '#d82828' : '#2060d8',
      isRed ? '#f83838' : '#2888f8',
      2
    );

    // Loaded Hardware ROM indicator if active
    const romMeta = hwEmulator.getMetadata();
    if (romMeta && hwEmulator.isRunningHardware()) {
      drawPixelText(ctx, `ROM READY: ${romMeta.title}`, 80, 74, {
        color: primaryHex,
        size: 4,
        align: 'center',
      });
    } else {
      drawPixelText(ctx, '(C)1996 GAME FREAK / LR35902', 80, 74, {
        color: '#485060',
        size: 3.8,
        align: 'center',
      });
    }

    // Title Menu Box
    drawGBCBox(ctx, 8, 82, 144, 58, {
      bg: '#f8f8f0',
      borderOuter: primaryHex,
      borderInner: '#283038',
    });

    const opts = [
      hwEmulator.isRunningHardware() ? 'BOOT LOADED .GB ROM' : 'PLAY KANTO QUEST',
      `BATTLE ${gymLeaderName}`,
      `LOAD ${version}.GB ROM FILE`,
    ];

    opts.forEach((label, idx) => {
      const y = 90 + idx * 15;
      const sel = state.titleCursor === idx;
      if (sel) {
        drawPixelText(ctx, '>', 15, y, { color: primaryHex, size: 5 });
      }
      drawPixelText(ctx, label, 25, y, {
        color: sel ? '#101820' : '#586470',
        size: 4.5,
      });
    });
  }

  function renderStarterSelect(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#f8f4e0';
    ctx.fillRect(0, 0, 160, 144);

    drawGBCBox(ctx, 4, 4, 152, 24, { bg: primaryHex, borderOuter: '#181818' });
    drawPixelText(ctx, "PROF. OAK'S LAB - PALLET", 80, 9, {
      color: '#ffffff',
      size: 4.5,
      align: 'center',
    });
    drawPixelText(ctx, 'CHOOSE YOUR KANTO STARTER:', 80, 18, {
      color: '#f8e838',
      size: 4,
      align: 'center',
    });

    const starters = ['charmander', 'squirtle', 'bulbasaur'];
    starters.forEach((id, idx) => {
      const sp = getSpecies(id);
      const bx = 8 + idx * 49;
      const by = 34;
      const sel = state.starterCursor === idx;

      drawGBCBox(ctx, bx, by, 46, 66, {
        bg: sel ? '#ffffff' : '#e8e4d0',
        borderOuter: sel ? primaryHex : '#788078',
      });
      drawMonsterSprite(ctx, sp, bx + 5, by + 8, 3);
      drawPixelText(ctx, sp.name.slice(0, 7), bx + 23, by + 48, {
        color: '#182018',
        size: 3.8,
        align: 'center',
      });
      drawPixelText(ctx, sp.type, bx + 23, by + 56, {
        color: sp.color1,
        size: 3.8,
        align: 'center',
      });
    });

    const chosenSp = getSpecies(starters[state.starterCursor]);
    drawGBCBox(ctx, 4, 104, 152, 36);
    drawPixelText(ctx, `OAK: Will you take ${chosenSp.name}`, 10, 110, {
      color: '#182018',
      size: 4.3,
    });
    drawPixelText(ctx, 'A:CONFIRM STARTER   B:BACK', 10, 123, {
      color: primaryHex,
      size: 4.2,
    });
  }

  function renderOverworld(ctx: CanvasRenderingContext2D): void {
    // Super Game Boy Red / Blue tinted overworld grass
    ctx.fillStyle = isRed ? '#a8e078' : '#88e090';
    ctx.fillRect(0, 0, 160, 144);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 10; c++) {
        const tx = c * 16;
        const ty = r * 16;
        const ch = MAP_ROWS[r][c];

        if (ch === 'T') {
          ctx.fillStyle = isRed ? '#285828' : '#1c5438';
          ctx.fillRect(tx + 1, ty + 1, 14, 14);
          ctx.fillStyle = '#389038';
          ctx.fillRect(tx + 3, ty + 2, 10, 9);
          ctx.fillStyle = '#583820';
          ctx.fillRect(tx + 6, ty + 11, 4, 4);
        } else if (ch === 'G') {
          ctx.fillStyle = '#309838';
          for (let gx = 2; gx < 14; gx += 4) {
            ctx.fillRect(tx + gx, ty + 4, 2, 10);
            ctx.fillRect(tx + gx + 1, ty + 2, 2, 4);
          }
        } else if (ch === 'W') {
          const wave = Math.floor(state.animTime * 3) % 2 === 0;
          ctx.fillStyle = '#2078e8';
          ctx.fillRect(tx, ty, 16, 16);
          ctx.fillStyle = '#78c8f8';
          ctx.fillRect(tx + (wave ? 2 : 5), ty + 5, 8, 2);
        } else if (ch === 'H') {
          ctx.fillStyle = primaryHex;
          ctx.fillRect(tx, ty, 16, 16);
          ctx.fillStyle = '#f8f8f0';
          ctx.fillRect(tx + 2, ty + 12, 12, 4);
        } else if (ch === 'D') {
          ctx.fillStyle = '#f8f0d8';
          ctx.fillRect(tx, ty, 16, 16);
          ctx.fillStyle = primaryHex;
          ctx.fillRect(tx + 4, ty + 4, 8, 12);
          drawPixelText(ctx, 'HEAL', tx + 1, ty - 6, {
            color: '#ffffff',
            size: 4,
            shadow: '#181818',
          });
        } else if (ch === 'O') {
          // Prof. Oak's 3 Starter Poké Balls Table
          ctx.fillStyle = '#b88848';
          ctx.fillRect(tx + 1, ty + 3, 14, 10);
          for (let b = 0; b < 3; b++) {
            ctx.fillStyle = '#e83030';
            ctx.fillRect(tx + 2 + b * 4, ty + 5, 3, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(tx + 2 + b * 4, ty + 7, 3, 2);
          }
          drawPixelText(ctx, 'OAK', tx + 2, ty - 5, {
            color: '#f8e838',
            size: 3.8,
            shadow: '#181818',
          });
        } else if (ch === 'N') {
          drawTrainerSprite(
            ctx,
            tx + 2,
            ty + 2,
            isRed ? '#885830' : '#2088d8',
            '#f8c838',
            1
          );
          drawPixelText(ctx, isRed ? 'BROCK' : 'MISTY', tx - 2, ty - 5, {
            color: '#ffffff',
            size: 3.6,
            shadow: '#181818',
          });
        } else if (ch === 'o') {
          ctx.fillStyle = primaryHex;
          ctx.fillRect(tx + 6, ty + 6, 4, 4);
        }
      }
    }

    // Player Red / Blue Sprite
    drawTrainerSprite(
      ctx,
      state.playerX * 16 + 2,
      state.playerY * 16 + 2,
      primaryHex,
      accentHex,
      1
    );

    // Top HUD strip
    ctx.fillStyle = 'rgba(16, 20, 28, 0.88)';
    ctx.fillRect(0, 0, 160, 12);
    const lead = state.party[0];
    const sp = getSpecies(lead.speciesId);
    drawPixelText(ctx, `${sp.name.slice(0, 9)} Lv${lead.level}`, 4, 3, {
      color: '#f8e858',
      size: 4.5,
    });
    drawPixelText(ctx, `PKM:${version} WIN:${state.wins}`, 92, 3, {
      color: '#f8f8f0',
      size: 4.5,
    });
  }

  function renderBattle(ctx: CanvasRenderingContext2D): void {
    const playerMon = state.party[state.activePartyIdx];
    const enemyMon = state.enemy!;
    const playerSp = getSpecies(playerMon.speciesId);
    const enemySp = getSpecies(enemyMon.speciesId);

    ctx.fillStyle = '#f8f6e8';
    ctx.fillRect(0, 0, 160, 144);

    // Enemy Status HUD (Top Left)
    drawGBCBox(ctx, 4, 4, 96, 28, { bg: '#f0eed8', borderOuter: primaryHex });
    drawPixelText(ctx, enemySp.name, 8, 8, { color: '#182018', size: 4.3 });
    drawPixelText(ctx, `:L${enemyMon.level}`, 96, 8, {
      color: '#285828',
      size: 4.3,
      align: 'right',
    });
    drawPixelText(ctx, 'HP:', 8, 19, { color: '#182018', size: 4 });
    drawHealthBar(ctx, 24, 19, 70, 5, enemyMon.hp / enemyMon.maxHp);

    // Enemy Platform & Sprite (Top Right)
    ctx.fillStyle = '#d0dcc0';
    ctx.fillRect(102, 38, 52, 8);
    if (state.battlePhase === 'CATCH_ANIM') {
      const wobble = Math.round(Math.sin(state.animTime * 22) * 3);
      const bx = 122 + wobble;
      const by = 22;
      ctx.fillStyle = '#e83030';
      ctx.fillRect(bx, by, 12, 6);
      ctx.fillStyle = '#f8f8f0';
      ctx.fillRect(bx, by + 6, 12, 6);
      ctx.fillStyle = '#181818';
      ctx.fillRect(bx, by + 5, 12, 2);
    } else {
      drawMonsterSprite(ctx, enemySp, 110, 6, 3);
    }

    // Player Platform & Sprite (Mid Left)
    ctx.fillStyle = '#d0dcc0';
    ctx.fillRect(6, 86, 54, 8);
    drawMonsterSprite(ctx, playerSp, 14, 54, 3);

    // Player Status HUD (Mid Right)
    drawGBCBox(ctx, 62, 56, 94, 36, { bg: '#f0eed8', borderOuter: primaryHex });
    drawPixelText(ctx, playerSp.name, 66, 60, { color: '#182018', size: 4.3 });
    drawPixelText(ctx, `:L${playerMon.level}`, 152, 60, {
      color: '#285828',
      size: 4.3,
      align: 'right',
    });
    drawPixelText(ctx, 'HP:', 66, 70, { color: '#182018', size: 4 });
    drawHealthBar(ctx, 82, 70, 68, 5, playerMon.hp / playerMon.maxHp);
    drawPixelText(ctx, `${playerMon.hp}/${playerMon.maxHp}`, 150, 79, {
      color: '#304030',
      size: 4,
      align: 'right',
    });

    // Bottom Battle Box
    drawGBCBox(ctx, 4, 96, 152, 44, { borderOuter: primaryHex });

    if (state.battlePhase === 'MSG' || state.battlePhase === 'CATCH_ANIM') {
      drawPixelText(ctx, state.battleMsg1, 10, 104, { color: '#182018', size: 4.5 });
      drawPixelText(ctx, state.battleMsg2, 10, 118, { color: '#384838', size: 4.5 });
      return;
    }

    if (state.battlePhase === 'MENU') {
      drawPixelText(ctx, 'What will', 10, 105, { color: '#182018', size: 4.5 });
      drawPixelText(ctx, `${playerSp.name} do?`, 10, 118, { color: '#182018', size: 4.5 });

      drawGBCBox(ctx, 82, 96, 74, 44, { bg: '#ffffff', borderOuter: primaryHex });
      const opts = ['FIGHT', 'PKMN', 'ITEM', 'RUN'];
      opts.forEach((opt, idx) => {
        const ox = 90 + (idx % 2) * 34;
        const oy = 105 + Math.floor(idx / 2) * 16;
        if (state.menuCursor === idx) {
          drawPixelText(ctx, '>', ox - 5, oy, { color: primaryHex, size: 4.5 });
        }
        drawPixelText(ctx, opt, ox, oy, { color: '#182018', size: 4.5 });
      });
      return;
    }

    if (state.battlePhase === 'MOVES') {
      playerSp.moves.forEach((m, idx) => {
        const my = 102 + idx * 12;
        if (state.moveCursor === idx) {
          drawPixelText(ctx, '>', 10, my, { color: primaryHex, size: 4.5 });
        }
        drawPixelText(ctx, `${m.name} (${m.type})`, 18, my, {
          color: '#182018',
          size: 4.3,
        });
      });
      return;
    }

    if (state.battlePhase === 'PARTY') {
      state.party.slice(0, 3).forEach((mon, idx) => {
        const sp = getSpecies(mon.speciesId);
        const py = 102 + idx * 12;
        if (state.partyCursor === idx) {
          drawPixelText(ctx, '>', 10, py, { color: primaryHex, size: 4.5 });
        }
        drawPixelText(ctx, `${sp.name} Lv${mon.level} ${mon.hp}/${mon.maxHp}`, 18, py, {
          color: mon.hp > 0 ? '#182018' : '#a83838',
          size: 4.2,
        });
      });
    }
  }

  return {
    id: cartId,
    title: isRed ? 'POKEMON RED' : 'POKEMON BLUE',
    subtitle: isRed ? 'RED VERSION (GEN 1)' : 'BLUE VERSION (GEN 1)',
    genre: 'RPG / EMU',
    description: isRed
      ? 'Gen-1 Pokemon Red (Charizard, Pallet Town, Brock) + real .gb ROM emulator!'
      : 'Gen-1 Pokemon Blue (Blastoise, Pallet Town, Misty) + real .gb ROM emulator!',
    cartridgeColor: primaryHex,
    labelColor: isRed ? '#2a1014' : '#101c38',
    accentColor: accentHex,

    renderPreviewIcon(ctx, x, y, w, h, time) {
      ctx.fillStyle = isRed ? '#280c10' : '#0c1830';
      ctx.fillRect(x, y, w, h);

      const mascot = getSpecies(mascotId);
      const bob = Math.round(Math.sin(time * 4) * 1.5);
      drawMonsterSprite(ctx, mascot, x + 6, y + 4 + bob, 2);
    },

    init(context: GameContext) {
      state.ctx = context;
      (hwEmulator as unknown as { setAudio?: (a: unknown) => void }).setAudio?.(context.audio);
      const saved = context.storage.loadData<SaveProgress | null>(cartId, null);
      if (saved && saved.party?.length > 0) {
        state.party = saved.party;
        state.balls = saved.balls ?? 6;
        state.potions = saved.potions ?? 3;
        state.wins = saved.wins ?? 0;
        state.badges = saved.badges ?? 0;
      } else {
        state.party = [
          createPartyMonster(defaultStarterId, 5),
          createPartyMonster('pikachu', 4),
        ];
        state.balls = 6;
        state.potions = 3;
        state.wins = 0;
        state.badges = 0;
      }

      state.playerX = 3;
      state.playerY = 3;
      state.titleCursor = 0;
      state.profileCursor = 0;
      state.mode = 'PROFILES';
      context.audio.startBGM('monster_town');

      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode')?.toLowerCase();
      const urlSlot = Math.max(0, Math.min(2, Number(params.get('slot') ?? '0') || 0));

      loadAndSyncProfiles();
      state.romReady = Boolean(BUNDLED_ROM_CACHE[version]);

      ensureBundledRomAndSram(version).then(() => {
        state.romReady = Boolean(BUNDLED_ROM_CACHE[version]);
        loadAndSyncProfiles();

        if (urlMode === 'title') {
          bootProfileIntoRealRom(urlSlot, 'TITLE');
        } else if (urlMode === 'continue') {
          bootProfileIntoRealRom(urlSlot, 'CONTINUE_INFO');
        } else if (urlMode === 'game') {
          bootProfileIntoRealRom(urlSlot, 'CONTINUE_GAME');
        } else if (urlMode === 'newgame') {
          bootProfileIntoRealRom(2, 'OAK_INTRO');
        }
      });

      if (urlMode === 'profiles') {
        state.mode = 'PROFILES';
        state.profileCursor = urlSlot;
      } else if (urlMode === 'oak') {
        state.mode = 'STARTER_SELECT';
      } else if (urlMode === 'overworld') {
        state.mode = 'OVERWORLD';
      } else if (urlMode === 'gym') {
        startBattle(false, gymBossId, 9, gymLeaderName);
        state.battlePhase = 'MENU';
        state.flashTimer = 0;
        state.mode = 'BATTLE';
      } else if (urlMode === 'hwrom') {
        const demoRom = buildHardwareTestRom(isRed ? 'POKEMON RED' : 'POKEMON BLUE');
        hwEmulator.loadRom(`${cartId}-test.gb`, demoRom, null, sgbPalette);
        state.mode = 'EMU_ROM';
        context.audio.startBGM('monster_town');
      }
    },

    onRomLoaded(fileName: string, bytes: Uint8Array) {
      BUNDLED_ROM_CACHE[version] = bytes;
      state.romReady = true;
      const savedSram = state.ctx?.storage.loadData<number[] | null>(
        getProfileSramKey(state.activeProfileSlot),
        null
      );
      const meta = hwEmulator.loadRom(fileName, bytes, savedSram, sgbPalette);
      if (meta.isExecutable && hwEmulator.isRunningHardware()) {
        hwEmulator.fastForwardGen1Boot('TITLE');
        state.mode = 'EMU_ROM';
        state.ctx?.audio.startBGM('monster_town');
      } else {
        state.mode = 'PROFILES';
      }
    },

    update(dt: number, input: InputState) {
      state.animTime += dt;
      if (state.moveCooldown > 0) state.moveCooldown -= dt;

      if (state.mode === 'EMU_ROM' && hwEmulator.isRunningHardware()) {
        // Holding SELECT + pressing B returns to the Trainer Accounts / Profile Switcher
        if (input.held.select && input.justPressed.b) {
          saveProgress();
          state.mode = 'PROFILES';
          state.ctx?.audio.playMenuBack();
          return;
        }
        hwEmulator.step(dt, input);
        state.sramSyncTimer += dt;
        if (state.sramSyncTimer >= 2.5) {
          state.sramSyncTimer = 0;
          saveProgress();
        }
        return;
      }

      if (state.mode === 'PROFILES') {
        updateProfiles(input);
      } else if (state.mode === 'TITLE') {
        updateTitle(input);
      } else if (state.mode === 'STARTER_SELECT') {
        updateStarterSelect(input);
      } else if (state.mode === 'OVERWORLD') {
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
      if (state.mode === 'EMU_ROM' && hwEmulator.isRunningHardware()) {
        if (hwEmulator.renderToCanvas(ctx)) {
          return;
        }
      }

      if (state.mode === 'PROFILES') {
        renderProfiles(ctx);
      } else if (state.mode === 'TITLE') {
        renderTitle(ctx);
      } else if (state.mode === 'STARTER_SELECT') {
        renderStarterSelect(ctx);
      } else if (
        state.mode === 'OVERWORLD' ||
        state.mode === 'DIALOG' ||
        state.mode === 'ENCOUNTER_FLASH'
      ) {
        renderOverworld(ctx);
        if (state.mode === 'DIALOG') {
          drawGBCBox(ctx, 4, 102, 152, 38, { borderOuter: primaryHex });
          drawPixelText(ctx, state.dialogLine1, 10, 109, { color: '#182018', size: 4.6 });
          drawPixelText(ctx, state.dialogLine2, 10, 121, { color: '#384838', size: 4.4 });
        }
        if (state.mode === 'ENCOUNTER_FLASH') {
          const flashOn = Math.floor(state.flashTimer * 14) % 2 === 0;
          if (flashOn) {
            ctx.fillStyle = primaryHex;
            ctx.fillRect(0, 0, 160, 144);
          }
        }
      } else if (state.mode === 'BATTLE') {
        renderBattle(ctx);
      }
    },

    onScreenTap(x: number, y: number): boolean {
      if (state.mode === 'PROFILES') {
        if (y >= 22 && y <= 130) {
          const slot = y < 58 ? 0 : y < 95 ? 1 : 2;
          state.profileCursor = slot;
        }
        state.ctx.audio.playMenuSelect();
        const chosen = state.profiles[state.profileCursor];
        const target = chosen?.hasSave ? 'CONTINUE_GAME' : 'OAK_INTRO';
        if (!bootProfileIntoRealRom(state.profileCursor, target)) {
          ensureBundledRomAndSram(version).then(() => {
            state.romReady = Boolean(BUNDLED_ROM_CACHE[version]);
            loadAndSyncProfiles();
            if (!bootProfileIntoRealRom(state.profileCursor, target)) {
              state.mode = 'OVERWORLD';
              state.ctx.audio.startBGM('monster_town');
            }
          });
        }
        return true;
      }
      return false;
    },

    cleanup() {
      saveProgress();
    },
  };
}

function drawTrainerSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shirt: string,
  cap: string,
  scale = 1
): void {
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
  drawPixelSprite(
    ctx,
    rows,
    {
      C: cap,
      S: '#f8d0a0',
      K: '#181818',
      B: shirt,
    },
    x,
    y,
    scale
  );
}

function drawMonsterSprite(
  ctx: CanvasRenderingContext2D,
  sp: MonsterSpecies,
  x: number,
  y: number,
  scale: number
): void {
  drawPixelSprite(
    ctx,
    sp.sprite,
    {
      '1': sp.color1,
      '2': sp.color2,
      '3': '#181818',
    },
    x,
    y,
    scale
  );
}

export const pokemonRedCartridge = createPokemonVersionCartridge('RED');
export const pokemonBlueCartridge = createPokemonVersionCartridge('BLUE');
export const pocketMonstersCartridge = pokemonRedCartridge;
