// The camera's local preferences and live signals, shared by the HUD (DOM) and the camera (canvas).
// Like core audio's mute (play50games_3d_muted), storage lives here and only here, behind a
// never-throwing adapter (localStorage in the browser, memory in tests): games never write
// localStorage themselves. Generalised from the Menu 2 orbit prefs (menu2/camera/orbitPrefs.ts).
//
// Stored (`play50games_3d_camera`):
// - `hintSeen`: the first-time "📷 / C: change view; drag to look around" hint was shown.
// - `autoFollow`: the free view swings behind the hero after a while without manual input (default on).
// - `views`: the last view the player chose, per game slug.
// Signals (memory only): a view-cycle request from the 📷 button, a recenter request, the live view
// list and current view (for the button), and "the player has turned the camera" (the hint hides).
import type { ViewId } from "./views";

export const CAMERA_PREFS_KEY = "play50games_3d_camera";

export interface CameraPrefs {
   hintSeen: boolean;
   autoFollow: boolean;
   views: Readonly<Record<string, ViewId>>;
}

export interface CameraPrefsStorage {
   read(key: string): string | null;
   write(key: string, value: string): void;
}

export const localCameraStorage: CameraPrefsStorage = {
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

export function memoryCameraStorage(seed: Record<string, string> = {}): CameraPrefsStorage & { items: Record<string, string> } {
   const items = { ...seed };
   return {
      items,
      read: (key) => (key in items ? items[key] : null),
      write: (key, value) => {
         items[key] = value;
      },
   };
}

const VIEW_IDS: readonly string[] = ["default", "chase", "top", "front", "free"];
const SLUG = /^[a-z0-9-]{1,64}$/;

export function parseCameraPrefs(raw: string | null): CameraPrefs {
   const out: CameraPrefs = { hintSeen: false, autoFollow: true, views: {} };
   if (!raw) return out;
   try {
      const v = JSON.parse(raw) as Partial<CameraPrefs> | null;
      const views: Record<string, ViewId> = {};
      if (v && typeof v.views === "object" && v.views) {
         for (const [slug, id] of Object.entries(v.views)) if (SLUG.test(slug) && VIEW_IDS.includes(id as string)) views[slug] = id as ViewId;
      }
      return { hintSeen: v?.hintSeen === true, autoFollow: v?.autoFollow !== false, views };
   } catch {
      return out;
   }
}

let storage: CameraPrefsStorage = localCameraStorage;
let cached: CameraPrefs | null = null;
const listeners = new Set<() => void>();

/** Tests: swap the storage (and drop the cache). */
export function setCameraPrefsStorage(next: CameraPrefsStorage): void {
   storage = next;
   cached = null;
}

/** The current preferences (the same object until one changes: safe for useSyncExternalStore). */
export function cameraPrefs(): CameraPrefs {
   if (!cached) cached = parseCameraPrefs(storage.read(CAMERA_PREFS_KEY));
   return cached;
}

/** The server render's snapshot: the hint "seen", so nothing flashes before hydration. */
const SERVER_PREFS: CameraPrefs = { hintSeen: true, autoFollow: true, views: {} };
export const serverCameraPrefs = (): CameraPrefs => SERVER_PREFS;

export function subscribeCameraPrefs(listener: () => void): () => void {
   listeners.add(listener);
   return () => listeners.delete(listener);
}

function save(next: CameraPrefs): void {
   cached = next;
   storage.write(CAMERA_PREFS_KEY, JSON.stringify(next));
   listeners.forEach((l) => l());
}

export function markCameraHintSeen(): void {
   if (!cameraPrefs().hintSeen) save({ ...cameraPrefs(), hintSeen: true });
}

export function setCameraAutoFollow(value: boolean): void {
   if (cameraPrefs().autoFollow !== value) save({ ...cameraPrefs(), autoFollow: value });
}

/** The last view the player chose in a game (null = never chose one). */
export function savedView(slug: string): ViewId | null {
   return cameraPrefs().views[slug] ?? null;
}

export function saveView(slug: string, view: ViewId): void {
   if (!SLUG.test(slug) || cameraPrefs().views[slug] === view) return;
   save({ ...cameraPrefs(), views: { ...cameraPrefs().views, [slug]: view } });
}

// ---------- live signals (memory only) ----------

export interface LiveViews {
   /** the views the mounted game offers, in cycle order (empty = no game uses CameraViews now) */
   list: readonly ViewId[];
   current: ViewId;
   /** the key that cycles, for the tooltip ("C") */
   key: string;
   /** one finger on the canvas turns the free view (false: only two fingers) */
   oneFinger: boolean;
   /** the left mouse button turns the free view (default true; false: right / middle drag only) */
   leftDrag?: boolean;
}

const NONE: LiveViews = { list: [], current: "default", key: "C", oneFinger: true };
let live: LiveViews = NONE;
const signals = { cycle: 0, recenter: 0, turned: 0 };
const liveListeners = new Set<() => void>();
const emit = () => liveListeners.forEach((l) => l());

/** The camera publishes its views (on mount, on every change); `null` on unmount. */
export function publishViews(next: LiveViews | null): void {
   const value = next ?? NONE;
   if (value.list.join() === live.list.join() && value.current === live.current && value.key === live.key && value.oneFinger === live.oneFinger && (value.leftDrag ?? true) === (live.leftDrag ?? true)) return;
   live = value;
   emit();
}

/** The mounted game's views (the same object until one changes). */
export function liveViews(): LiveViews {
   return live;
}
export const serverLiveViews = (): LiveViews => NONE;

/** The 📷 button: the camera goes to the next view on its next frame. */
export function requestViewCycle(): void {
   signals.cycle++;
}
export function viewCycleRequests(): number {
   return signals.cycle;
}

/** A recenter request (the free view swings behind the hero). */
export function requestCameraRecenter(): void {
   signals.recenter++;
}
export function cameraRecenterRequests(): number {
   return signals.recenter;
}

/** The camera reports the first manual turn or view change (the hint hides). */
export function noteCameraTurned(): void {
   if (signals.turned > 0) return;
   signals.turned++;
   emit();
}
export function cameraTurned(): number {
   return signals.turned;
}

export function subscribeLiveViews(listener: () => void): () => void {
   liveListeners.add(listener);
   return () => liveListeners.delete(listener);
}

/** Tests: clear the live signals. */
export function resetCameraSignals(): void {
   signals.cycle = 0;
   signals.recenter = 0;
   signals.turned = 0;
   live = NONE;
}
