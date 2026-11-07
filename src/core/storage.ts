const STORAGE_PREFIX = 'pocket_arcade_dx_v1_';

export interface GamePlayStat {
  gameId: string;
  sessions: number;
  totalSeconds: number;
  lastPlayedIso: string | null;
}

export interface ActivityLogEntry {
  timestampIso: string;
  gameId: string;
  message: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-boot', title: 'POWER ON!', description: 'Powered on the 3D Game Boy Color.', icon: '⚡' },
  { id: 'cart-hopper', title: 'CART HOPPER', description: 'Played 3 or more different Game Paks.', icon: '🕹️' },
  { id: 'monster-tamer', title: 'MONSTER TAMER', description: 'Scored 150+ in Pocket Monsters GBC.', icon: '🔴' },
  { id: 'brawl-star', title: 'BRAWL CHAMPION', description: 'Scored 500+ in Super Pocket Brawl.', icon: '🥊' },
  { id: 'pixel-pro', title: 'PIXEL PRO', description: 'Scored 1,000+ pts in any cartridge.', icon: '🏆' },
  { id: 'marathon', title: 'BATTERY DRAINER', description: 'Logged 5+ minutes of total play time.', icon: '🔋' },
];

export interface MemoryPakPayload {
  v: 1;
  exportedAt: string;
  callsign: string;
  highScores: Record<string, number>;
  gameSaves: Record<string, unknown>;
  playStats: Record<string, GamePlayStat>;
  activityLog: ActivityLogEntry[];
  unlockedAchievements: string[];
}

export class CartridgeStorage {
  private syncListener: (() => void) | null = null;
  private floatSecondsAccum = 0;

  onStateMutated(cb: () => void): void {
    this.syncListener = cb;
  }

  private notifyMutated(): void {
    if (this.syncListener) this.syncListener();
  }

  getCallsign(): string {
    return this.getSetting('callsign', 'PLAYER 1');
  }

  setCallsign(name: string): void {
    const clean = name.trim().slice(0, 24).toUpperCase() || 'PLAYER 1';
    this.setSetting('callsign', clean);
    this.notifyMutated();
  }

  getHighScore(gameId: string): number {
    try {
      const val = localStorage.getItem(`${STORAGE_PREFIX}hi_${gameId}`);
      return val ? Math.max(0, parseInt(val, 10) || 0) : 0;
    } catch {
      return 0;
    }
  }

  setHighScore(gameId: string, score: number): boolean {
    const current = this.getHighScore(gameId);
    const clean = Math.max(0, Math.floor(score));
    if (clean > current) {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}hi_${gameId}`, String(clean));
      } catch {
        // ignore quota errors
      }
      this.appendActivity(gameId, `New High Score: ${clean.toLocaleString()} pts`);
      this.evaluateAchievements();
      this.notifyMutated();
      return true;
    }
    return false;
  }

  loadData<T>(gameId: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}data_${gameId}`);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  saveData<T>(gameId: string, data: T): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}data_${gameId}`, JSON.stringify(data));
      this.notifyMutated();
    } catch {
      // ignore
    }
  }

  getSetting(key: string, fallback: string): string {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}cfg_${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  }

  setSetting(key: string, value: string): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}cfg_${key}`, value);
    } catch {
      // ignore
    }
  }

  // --- Play History & Session Tracking ---

  getAllPlayStats(): Record<string, GamePlayStat> {
    return this.loadData<Record<string, GamePlayStat>>('_sys_play_stats', {});
  }

  getGamePlayStat(gameId: string): GamePlayStat {
    const all = this.getAllPlayStats();
    return (
      all[gameId] ?? {
        gameId,
        sessions: 0,
        totalSeconds: 0,
        lastPlayedIso: null,
      }
    );
  }

  recordGameLaunch(gameId: string, gameTitle: string): void {
    const all = this.getAllPlayStats();
    const prev = all[gameId] ?? {
      gameId,
      sessions: 0,
      totalSeconds: 0,
      lastPlayedIso: null,
    };
    prev.sessions += 1;
    prev.lastPlayedIso = new Date().toISOString();
    all[gameId] = prev;
    this.saveData('_sys_play_stats', all);
    this.appendActivity(gameId, `Launched ${gameTitle} (Session #${prev.sessions})`);
    this.evaluateAchievements();
  }

  recordPlayTime(gameId: string, dtSeconds: number): void {
    this.floatSecondsAccum += dtSeconds;
    if (this.floatSecondsAccum < 5) return; // flush every 5 seconds
    const whole = Math.floor(this.floatSecondsAccum);
    this.floatSecondsAccum -= whole;

    const all = this.getAllPlayStats();
    const prev = all[gameId] ?? {
      gameId,
      sessions: 1,
      totalSeconds: 0,
      lastPlayedIso: new Date().toISOString(),
    };
    prev.totalSeconds += whole;
    prev.lastPlayedIso = new Date().toISOString();
    all[gameId] = prev;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}data__sys_play_stats`, JSON.stringify(all));
    } catch {
      // ignore
    }
    this.evaluateAchievements();
  }

  getActivityLog(): ActivityLogEntry[] {
    return this.loadData<ActivityLogEntry[]>('_sys_activity_log', []);
  }

  appendActivity(gameId: string, message: string): void {
    const log = this.getActivityLog();
    log.unshift({
      timestampIso: new Date().toISOString(),
      gameId,
      message,
    });
    const trimmed = log.slice(0, 30);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}data__sys_activity_log`, JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  }

  getUnlockedAchievements(): string[] {
    return this.loadData<string[]>('_sys_achievements', []);
  }

  unlockAchievement(id: string): boolean {
    const unlocked = this.getUnlockedAchievements();
    if (unlocked.includes(id)) return false;
    unlocked.push(id);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}data__sys_achievements`, JSON.stringify(unlocked));
    } catch {
      // ignore
    }
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (def) {
      this.appendActivity('system', `Unlocked Badge: ${def.icon} ${def.title}`);
    }
    return true;
  }

  evaluateAchievements(): void {
    const stats = this.getAllPlayStats();
    const playedGames = Object.values(stats).filter((s) => s.sessions > 0);
    if (playedGames.length >= 3) {
      this.unlockAchievement('cart-hopper');
    }

    const totalSec = Object.values(stats).reduce((acc, s) => acc + s.totalSeconds, 0);
    if (totalSec >= 300) {
      this.unlockAchievement('marathon');
    }

    if (this.getHighScore('pocket-monsters') >= 150) {
      this.unlockAchievement('monster-tamer');
    }
    if (this.getHighScore('pocket-brawl') >= 500) {
      this.unlockAchievement('brawl-star');
    }

    const gameIds = [
      'pocket-monsters',
      'pocket-brawl',
      'links-quest',
      'super-pixel-land',
      'tetrablock-dx',
      'street-racer',
    ];
    if (gameIds.some((id) => this.getHighScore(id) >= 1000)) {
      this.unlockAchievement('pixel-pro');
    }
  }

  // --- Memory Pak Export / Import (Cross-Device Save Code & Cloud Payload) ---

  buildPayload(gameIds: string[]): MemoryPakPayload {
    const highScores: Record<string, number> = {};
    const gameSaves: Record<string, unknown> = {};

    for (const id of gameIds) {
      highScores[id] = this.getHighScore(id);
      const saved = this.loadData<unknown | null>(id, null);
      if (saved !== null) {
        gameSaves[id] = saved;
      }
    }

    return {
      v: 1,
      exportedAt: new Date().toISOString(),
      callsign: this.getCallsign(),
      highScores,
      gameSaves,
      playStats: this.getAllPlayStats(),
      activityLog: this.getActivityLog(),
      unlockedAchievements: this.getUnlockedAchievements(),
    };
  }

  exportMemoryPakCode(gameIds: string[]): string {
    const payload = this.buildPayload(gameIds);
    const json = JSON.stringify(payload);
    const encoded = btoa(encodeURIComponent(json));
    return `GBC-PAK-${encoded}`;
  }

  importMemoryPakCode(rawInput: string): { ok: boolean; message: string } {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { ok: false, message: 'Please paste a GBC-PAK save code first.' };
    }

    try {
      let jsonStr = trimmed;
      if (trimmed.startsWith('GBC-PAK-')) {
        const b64 = trimmed.slice('GBC-PAK-'.length);
        jsonStr = decodeURIComponent(atob(b64));
      }
      const parsed = JSON.parse(jsonStr) as Partial<MemoryPakPayload>;
      if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) {
        return { ok: false, message: 'Invalid Memory Pak format.' };
      }

      this.mergePayload(parsed as MemoryPakPayload);
      this.appendActivity('system', 'Restored save data from Memory Pak Code');
      this.notifyMutated();
      return { ok: true, message: 'Memory Pak restored! High scores, RPG party & history updated.' };
    } catch {
      return { ok: false, message: 'Could not decode Memory Pak save code. Check for missing characters.' };
    }
  }

  mergePayload(payload: MemoryPakPayload): void {
    if (payload.callsign) {
      this.setSetting('callsign', payload.callsign.slice(0, 24).toUpperCase());
    }

    if (payload.highScores) {
      for (const [gameId, score] of Object.entries(payload.highScores)) {
        const current = this.getHighScore(gameId);
        if (typeof score === 'number' && score > current) {
          try {
            localStorage.setItem(`${STORAGE_PREFIX}hi_${gameId}`, String(Math.floor(score)));
          } catch {
            // ignore
          }
        }
      }
    }

    if (payload.gameSaves) {
      for (const [gameId, data] of Object.entries(payload.gameSaves)) {
        if (data !== undefined && data !== null) {
          try {
            localStorage.setItem(`${STORAGE_PREFIX}data_${gameId}`, JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      }
    }

    if (payload.playStats) {
      const localStats = this.getAllPlayStats();
      for (const [gameId, incoming] of Object.entries(payload.playStats)) {
        const existing = localStats[gameId];
        if (!existing) {
          localStats[gameId] = incoming;
        } else {
          localStats[gameId] = {
            gameId,
            sessions: Math.max(existing.sessions, incoming.sessions ?? 0),
            totalSeconds: Math.max(existing.totalSeconds, incoming.totalSeconds ?? 0),
            lastPlayedIso:
              (incoming.lastPlayedIso ?? '') > (existing.lastPlayedIso ?? '')
                ? incoming.lastPlayedIso
                : existing.lastPlayedIso,
          };
        }
      }
      try {
        localStorage.setItem(`${STORAGE_PREFIX}data__sys_play_stats`, JSON.stringify(localStats));
      } catch {
        // ignore
      }
    }

    if (Array.isArray(payload.unlockedAchievements)) {
      const merged = Array.from(new Set([...this.getUnlockedAchievements(), ...payload.unlockedAchievements]));
      try {
        localStorage.setItem(`${STORAGE_PREFIX}data__sys_achievements`, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
