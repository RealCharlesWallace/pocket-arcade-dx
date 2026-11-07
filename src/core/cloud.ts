import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { CartridgeStorage, MemoryPakPayload } from './storage';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  score: number;
  updatedAtIso: string;
}

const CUSTOM_CONFIG_KEY = 'pocket_arcade_dx_v1_firebase_config';

export class CloudSyncService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private currentUser: User | null = null;
  private storage: CartridgeStorage;
  private gameIds: string[];
  private onStatusChangeCallbacks: Array<() => void> = [];

  constructor(storage: CartridgeStorage, gameIds: string[]) {
    this.storage = storage;
    this.gameIds = gameIds;
    this.tryInitialize();
  }

  private resolveConfig(): FirebaseOptions | null {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
    if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
      return {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      };
    }

    try {
      const saved = localStorage.getItem(CUSTOM_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FirebaseOptions;
        if (parsed.apiKey && parsed.projectId) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  tryInitialize(): boolean {
    if (this.app) return true;
    const cfg = this.resolveConfig();
    if (!cfg) return false;

    try {
      this.app = initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      onAuthStateChanged(this.auth, async (user) => {
        this.currentUser = user;
        if (user) {
          if (user.displayName && this.storage.getCallsign() === 'PLAYER 1') {
            this.storage.setCallsign(user.displayName);
          }
          await this.pullFromCloud();
          await this.pushToCloud();
        }
        this.emitStatusChange();
      });

      this.emitStatusChange();
      return true;
    } catch {
      this.app = null;
      this.auth = null;
      this.db = null;
      return false;
    }
  }

  saveCustomFirebaseConfig(rawJsonOrSnippet: string): { ok: boolean; message: string } {
    try {
      // Extract JSON object even if user pastes `const firebaseConfig = { ... };`
      const firstBrace = rawJsonOrSnippet.indexOf('{');
      const lastBrace = rawJsonOrSnippet.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        return { ok: false, message: 'Paste the firebaseConfig { ... } object from Firebase Console.' };
      }
      const objectSlice = rawJsonOrSnippet.slice(firstBrace, lastBrace + 1);
      // Normalize unquoted JS keys (`apiKey: "..."` -> `"apiKey": "..."`)
      const normalizedJson = objectSlice.replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":').replace(/'/g, '"');
      const parsed = JSON.parse(normalizedJson) as FirebaseOptions;

      if (!parsed.apiKey || !parsed.projectId) {
        return { ok: false, message: 'Config must include at least apiKey and projectId.' };
      }
      localStorage.setItem(CUSTOM_CONFIG_KEY, JSON.stringify(parsed));
      const initialized = this.tryInitialize();
      return initialized
        ? { ok: true, message: `Connected to Firebase project "${parsed.projectId}"!` }
        : { ok: false, message: 'Could not initialize Firebase with the provided config.' };
    } catch {
      return { ok: false, message: 'Invalid JSON/JS object format. Check your firebaseConfig snippet.' };
    }
  }

  isConfigured(): boolean {
    return this.db !== null && this.auth !== null;
  }

  getUser(): User | null {
    return this.currentUser;
  }

  onStatusChange(cb: () => void): void {
    this.onStatusChangeCallbacks.push(cb);
  }

  private emitStatusChange(): void {
    for (const cb of this.onStatusChangeCallbacks) cb();
  }

  async signInWithGoogle(): Promise<{ ok: boolean; message: string }> {
    if (!this.auth) {
      return { ok: false, message: 'Firebase is not configured yet. Paste your Firebase Web Config below first.' };
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      return { ok: true, message: 'Signed in with Google & synced play history!' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Google sign-in failed: ${msg}` };
    }
  }

  async signInGuestCloud(): Promise<{ ok: boolean; message: string }> {
    if (!this.auth) {
      return { ok: false, message: 'Firebase is not configured yet. Paste your Firebase Web Config below first.' };
    }
    try {
      await signInAnonymously(this.auth);
      return { ok: true, message: 'Signed in with Cloud Guest ID & synced!' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Anonymous cloud sign-in failed: ${msg}` };
    }
  }

  async signOutCloud(): Promise<void> {
    if (!this.auth) return;
    await signOut(this.auth);
  }

  async pullFromCloud(): Promise<boolean> {
    if (!this.db || !this.currentUser) return false;
    try {
      const snap = await getDoc(doc(this.db, 'users', this.currentUser.uid));
      if (!snap.exists()) return false;
      const data = snap.data() as Partial<MemoryPakPayload>;
      this.storage.mergePayload({
        v: 1,
        exportedAt: new Date().toISOString(),
        callsign: (data.callsign as string) ?? this.storage.getCallsign(),
        highScores: (data.highScores as Record<string, number>) ?? {},
        gameSaves: (data.gameSaves as Record<string, unknown>) ?? {},
        playStats: (data.playStats as MemoryPakPayload['playStats']) ?? {},
        activityLog: [],
        unlockedAchievements: (data.unlockedAchievements as string[]) ?? [],
      });
      return true;
    } catch {
      return false;
    }
  }

  async pushToCloud(): Promise<boolean> {
    if (!this.db || !this.currentUser) return false;
    try {
      const payload = this.storage.buildPayload(this.gameIds);
      const displayName = payload.callsign.slice(0, 30) || 'PLAYER 1';

      await setDoc(
        doc(this.db, 'users', this.currentUser.uid),
        {
          uid: this.currentUser.uid,
          displayName,
          updatedAt: serverTimestamp(),
          highScores: payload.highScores,
          gameSaves: payload.gameSaves,
          playStats: payload.playStats,
          achievements: payload.unlockedAchievements,
        },
        { merge: true }
      );

      // Also publish non-zero high scores to per-game leaderboards
      for (const [gameId, score] of Object.entries(payload.highScores)) {
        if (score > 0) {
          await setDoc(
            doc(this.db, 'leaderboards', gameId, 'scores', this.currentUser.uid),
            {
              uid: this.currentUser.uid,
              displayName,
              score,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async fetchLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
    const localScore = this.storage.getHighScore(gameId);
    const fallbackEntries: LeaderboardEntry[] = [
      { uid: 'npc-1', displayName: 'SADOK_MX', score: 1450, updatedAtIso: '2026-11-01' },
      { uid: 'npc-2', displayName: 'RED_PKMN', score: 1100, updatedAtIso: '2026-11-03' },
      { uid: 'npc-3', displayName: 'MELOONY_IT', score: 850, updatedAtIso: '2026-11-05' },
    ];
    if (localScore > 0) {
      fallbackEntries.push({
        uid: 'local-you',
        displayName: `${this.storage.getCallsign()} (YOU)`,
        score: localScore,
        updatedAtIso: 'TODAY',
      });
    }
    fallbackEntries.sort((a, b) => b.score - a.score);

    if (!this.db) return fallbackEntries;

    try {
      const q = query(
        collection(this.db, 'leaderboards', gameId, 'scores'),
        orderBy('score', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      if (snap.empty) return fallbackEntries;

      const list: LeaderboardEntry[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          uid: docSnap.id,
          displayName: String(d.displayName ?? 'PLAYER'),
          score: Number(d.score ?? 0),
          updatedAtIso: 'CLOUD',
        });
      });
      return list;
    } catch {
      return fallbackEntries;
    }
  }

  /**
   * Increments/reads the sadok.mx-style visitor counter (`You are player/visitor #...`).
   */
  async recordAndGetVisitorCount(): Promise<number> {
    const localVisits = parseInt(this.storage.getSetting('visitor_count', '1337'), 10) || 1337;
    const alreadyCountedSession = sessionStorage.getItem('gbc_visit_counted') === '1';
    const nextLocal = alreadyCountedSession ? localVisits : localVisits + 1;
    sessionStorage.setItem('gbc_visit_counted', '1');
    this.storage.setSetting('visitor_count', String(nextLocal));

    if (!this.db) return nextLocal;

    try {
      const ref = doc(this.db, 'meta', 'visitors');
      if (!alreadyCountedSession && this.currentUser) {
        const count = await runTransaction(this.db, async (tx) => {
          const snap = await tx.get(ref);
          const next = snap.exists() ? Number(snap.data().count ?? 1337) + 1 : 1338;
          tx.set(ref, { count: next, updatedAt: serverTimestamp() });
          return next;
        });
        return count;
      } else {
        const snap = await getDoc(ref);
        if (snap.exists()) return Number(snap.data().count ?? nextLocal);
      }
    } catch {
      // fall back to local counter
    }
    return nextLocal;
  }
}
