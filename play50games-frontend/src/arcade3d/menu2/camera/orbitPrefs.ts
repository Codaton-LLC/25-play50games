// The orbit camera's local preferences and live signals, shared by the HUD (DOM) and the camera
// (canvas). Like core audio's mute (play50games_3d_muted), storage lives here and only here, behind
// a never-throwing adapter (localStorage in the browser, memory in tests): games never write
// localStorage themselves.
//
// - `hintSeen`: the first-time "Drag to look around / Two fingers to rotate" hint was shown.
// - `autoFollow`: the camera swings behind the hero after a while without manual input (default on).
// Signals (not stored): a recenter request from the HUD button, and "the player has turned the camera".

export const ORBIT_PREFS_KEY = "play50games_m2_camera";

export interface OrbitPrefs {
   hintSeen: boolean;
   autoFollow: boolean;
}

export interface OrbitPrefsStorage {
   read(key: string): string | null;
   write(key: string, value: string): void;
}

export const localOrbitStorage: OrbitPrefsStorage = {
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
         // storage blocked: the preference holds for this visit only
      }
   },
};

export function memoryOrbitStorage(seed: Record<string, string> = {}): OrbitPrefsStorage & { items: Record<string, string> } {
   const items = { ...seed };
   return {
      items,
      read: (key) => (key in items ? items[key] : null),
      write: (key, value) => {
         items[key] = value;
      },
   };
}

const DEFAULTS: OrbitPrefs = { hintSeen: false, autoFollow: true };

export function parseOrbitPrefs(raw: string | null): OrbitPrefs {
   if (!raw) return { ...DEFAULTS };
   try {
      const v = JSON.parse(raw) as Partial<OrbitPrefs> | null;
      return {
         hintSeen: v?.hintSeen === true,
         autoFollow: v?.autoFollow !== false,
      };
   } catch {
      return { ...DEFAULTS };
   }
}

let storage: OrbitPrefsStorage = localOrbitStorage;
let cached: OrbitPrefs | null = null;
const listeners = new Set<() => void>();

/** Tests: swap the storage (and drop the cache). */
export function setOrbitPrefsStorage(next: OrbitPrefsStorage): void {
   storage = next;
   cached = null;
}

/** The current preferences (the same object until one changes: safe for useSyncExternalStore). */
export function orbitPrefs(): OrbitPrefs {
   if (!cached) cached = parseOrbitPrefs(storage.read(ORBIT_PREFS_KEY));
   return cached;
}

/** The server render's snapshot: defaults with the hint "seen", so nothing flashes before hydration. */
const SERVER_PREFS: OrbitPrefs = { hintSeen: true, autoFollow: true };
export const serverOrbitPrefs = (): OrbitPrefs => SERVER_PREFS;

export function subscribeOrbitPrefs(listener: () => void): () => void {
   listeners.add(listener);
   return () => listeners.delete(listener);
}

function save(next: OrbitPrefs): void {
   cached = next;
   storage.write(ORBIT_PREFS_KEY, JSON.stringify(next));
   listeners.forEach((l) => l());
}

export function markOrbitHintSeen(): void {
   if (!orbitPrefs().hintSeen) save({ ...orbitPrefs(), hintSeen: true });
}

export function setOrbitAutoFollow(value: boolean): void {
   if (orbitPrefs().autoFollow !== value) save({ ...orbitPrefs(), autoFollow: value });
}

// ---------- live signals (memory only) ----------

const signals = { recenter: 0, turned: 0 };
const signalListeners = new Set<() => void>();

/** The HUD's recenter button: the camera swings behind the hero on its next frame. */
export function requestOrbitRecenter(): void {
   signals.recenter++;
}

/** A counter the camera compares with the last one it handled. */
export function orbitRecenterRequests(): number {
   return signals.recenter;
}

/** The camera reports a manual turn (the hint hides). */
export function noteOrbitTurned(): void {
   if (signals.turned > 0) return;
   signals.turned++;
   signalListeners.forEach((l) => l());
}

export function orbitTurned(): number {
   return signals.turned;
}

export function subscribeOrbitTurned(listener: () => void): () => void {
   signalListeners.add(listener);
   return () => signalListeners.delete(listener);
}

/** Tests: clear the live signals. */
export function resetOrbitSignals(): void {
   signals.recenter = 0;
   signals.turned = 0;
}
