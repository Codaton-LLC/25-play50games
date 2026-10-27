// Where Menu 2 progress lives: a small storage adapter (localStorage in the browser, memory in tests)
// under `play50games_m2_progress:<user>`, the same user naming as core/scores.ts (guest / u<id>), plus
// the sync interface the WordPress backend will fill in later. Games call recordLevelResult only.
import { applyLevelResult, emptyProgress, mergeProgress, parseProgress, type LevelResult, type ProgressData, type RecordSummary } from "./progress";

export const PROGRESS_EVENT = "play50games_m2_progress_updated";

export const progressKey = (userId: number | null): string =>
   userId ? `play50games_m2_progress:u${userId}` : "play50games_m2_progress:guest";

/** The only thing that touches storage. Never throws. */
export interface ProgressStorage {
   read(key: string): string | null;
   write(key: string, value: string): void;
}

export const localProgressStorage: ProgressStorage = {
   read(key) {
      try {
         return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      } catch {
         return null;
      }
   },
   write(key, value) {
      try {
         if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      } catch {
         // storage full or blocked: progress just is not persisted
      }
   },
};

export function memoryProgressStorage(seed: Record<string, string> = {}): ProgressStorage & { items: Record<string, string> } {
   const items = { ...seed };
   return {
      items,
      read: (key) => (key in items ? items[key] : null),
      write: (key, value) => {
         items[key] = value;
      },
   };
}

export function loadProgress(userId: number | null, storage: ProgressStorage = localProgressStorage): ProgressData {
   return parseProgress(storage.read(progressKey(userId)));
}

export function saveProgress(userId: number | null, data: ProgressData, storage: ProgressStorage = localProgressStorage): void {
   storage.write(progressKey(userId), JSON.stringify(data));
   if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { userId } }));
   }
   void activeSync.push(userId, data).catch(() => undefined);
}

/** The level-end hook: load, apply, save, return what was new (XP, stars, secrets). */
export function recordLevelResult(userId: number | null, result: LevelResult, storage: ProgressStorage = localProgressStorage): RecordSummary {
   const summary = applyLevelResult(loadProgress(userId, storage), result);
   saveProgress(userId, summary.data, storage);
   return summary;
}

// ---------- the WordPress sync (stub) ----------

/**
 * The backend contract, for later (a `play50/v1/m2/progress` route): pull the account's copy, push
 * the merged one. Until it exists the no-op sync keeps everything local.
 */
export interface ProgressSync {
   pull(userId: number): Promise<ProgressData | null>;
   push(userId: number | null, data: ProgressData): Promise<void>;
}

export const noopProgressSync: ProgressSync = {
   pull: async () => null,
   push: async () => undefined,
};

let activeSync: ProgressSync = noopProgressSync;

export function setProgressSync(sync: ProgressSync): void {
   activeSync = sync;
}

/** Pulls the account copy, merges it with this device's (mergeProgress) and saves the result. */
export async function syncProgress(userId: number, storage: ProgressStorage = localProgressStorage, sync: ProgressSync = activeSync): Promise<ProgressData> {
   const local = loadProgress(userId, storage);
   let remote: ProgressData | null = null;
   try {
      remote = await sync.pull(userId);
   } catch {
      remote = null;
   }
   const merged = remote ? mergeProgress(local, remote) : local;
   if (remote) saveProgress(userId, merged, storage);
   return merged;
}

export { emptyProgress };
