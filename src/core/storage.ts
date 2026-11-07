const STORAGE_PREFIX = 'pocket_arcade_dx_v1_';

export class CartridgeStorage {
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
        // ignore storage quota errors
      }
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
    } catch {
      // ignore storage quota errors
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
}
