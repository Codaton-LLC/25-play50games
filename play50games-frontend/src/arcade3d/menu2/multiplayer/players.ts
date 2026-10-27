// The local multiplayer session: 1-4 player slots, each with its device (input), hero, score,
// lives, live position and finished status, plus the mode. Pure reducers (tested in
// players.test.ts) behind one small zustand store, read with usePlayers(selector) in React and
// playersStore.getState() in the frame loop.
//
// Lifecycle: off -> lobby (the join screen) -> playing (runs; the session stays "playing" across
// Retry) -> back to lobby or off. While the session is "playing" the game runs its multiplayer
// scene, and every run counts as a multiplayer run (never on the solo leaderboard: leaderboard.ts).
//
// `position` is live: the game writes it in place every frame (setPosition), which never re-renders.
// Everything else changes through the store (a few times a run), so a HUD can subscribe to it.
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Vec3Like } from "@/arcade3d/core/collision";
import { MODES, type ModeId } from "./modes";
import type { DeviceId, PlayerInput } from "./playerInput";

export const MAX_PLAYERS = 4;
/** A multiplayer run needs at least this many players. */
export const MIN_PLAYERS = 2;

/** Player tag colours (the ring on the hero, the HUD chip), apart from the hero colours. */
export const PLAYER_COLORS: readonly string[] = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24"];

export interface PlayerState {
   /** 0..3, the slot (P1..P4) */
   index: number;
   device: DeviceId;
   heroId: string;
   ready: boolean;
   score: number;
   lives: number;
   /** live, written in place each frame (setPosition) */
   position: Vec3Like;
   finished: boolean;
   /** the run ms this player finished at (null while not finished) */
   finishMs: number | null;
   /** the game's own progress value for the HUD and the podium (height, laps, ...) */
   progress: number;
}

export type SessionPhase = "off" | "lobby" | "playing";

export interface PlayersState {
   phase: SessionPhase;
   mode: ModeId;
   /** the hero ids the game offers, in picker order */
   heroes: readonly string[];
   players: readonly PlayerState[];
}

export function initialPlayers(): PlayersState {
   return { phase: "off", mode: "versus", heroes: [], players: [] };
}

const freeSlot = (s: PlayersState): number => {
   for (let i = 0; i < MAX_PLAYERS; i++) if (!s.players.some((p) => p.index === i)) return i;
   return -1;
};

/** Is `heroId` taken by another player (only matters where the mode wants unique heroes)? */
export function heroTaken(s: PlayersState, heroId: string, except = -1): boolean {
   return s.players.some((p) => p.index !== except && p.heroId === heroId);
}

/** The next hero from `from` in direction `dir` (+1 / -1) that this player may take. */
export function nextHero(s: PlayersState, index: number, from: string, dir: 1 | -1): string {
   const list = s.heroes;
   if (list.length === 0) return from;
   const unique = MODES[s.mode].uniqueHeroes;
   let k = Math.max(0, list.indexOf(from));
   for (let n = 0; n < list.length; n++) {
      k = (k + dir + list.length) % list.length;
      if (!unique || !heroTaken(s, list[k], index)) return list[k];
   }
   return from;
}

const firstFreeHero = (s: PlayersState, index: number): string => {
   const unique = MODES[s.mode].uniqueHeroes;
   for (const h of s.heroes) if (!unique || !heroTaken(s, h, index)) return h;
   return s.heroes[0] ?? "";
};

const sortPlayers = (list: PlayerState[]) => list.sort((a, b) => a.index - b.index);

/** Opens the join screen for a game's hero list (keeps players already joined, all unready). */
export function openLobby(s: PlayersState, heroes: readonly string[]): PlayersState {
   const next: PlayersState = { ...s, phase: "lobby", heroes, players: s.players.map((p) => ({ ...p, ready: false })) };
   return { ...next, players: fixHeroes(next) };
}

/** Joins `device` into the first free slot (no-op if it is in, or the session is full). */
export function joinPlayer(s: PlayersState, device: DeviceId): PlayersState {
   if (s.phase !== "lobby" || s.players.some((p) => p.device === device)) return s;
   const index = freeSlot(s);
   if (index < 0) return s;
   const player: PlayerState = {
      index,
      device,
      heroId: firstFreeHero(s, index),
      ready: false,
      score: 0,
      lives: 0,
      position: { x: 0, y: 0, z: 0 },
      finished: false,
      finishMs: null,
      progress: 0,
   };
   return { ...s, players: sortPlayers([...s.players, player]) };
}

export function leavePlayer(s: PlayersState, index: number): PlayersState {
   if (!s.players.some((p) => p.index === index)) return s;
   return { ...s, players: s.players.filter((p) => p.index !== index) };
}

/** Removes the player on `device` (a gamepad unplugged in the lobby). */
export function dropDevice(s: PlayersState, device: DeviceId): PlayersState {
   const p = s.players.find((q) => q.device === device);
   return p ? leavePlayer(s, p.index) : s;
}

const patch = (s: PlayersState, index: number, fn: (p: PlayerState) => PlayerState): PlayersState => {
   let changed = false;
   const players = s.players.map((p) => {
      if (p.index !== index) return p;
      const q = fn(p);
      if (q !== p) changed = true;
      return q;
   });
   return changed ? { ...s, players } : s;
};

/** Picks a hero; refused (no change) when another player has it and the mode wants unique heroes, or while ready. */
export function pickHero(s: PlayersState, index: number, heroId: string): PlayersState {
   if (!s.heroes.includes(heroId)) return s;
   if (MODES[s.mode].uniqueHeroes && heroTaken(s, heroId, index)) return s;
   return patch(s, index, (p) => (p.ready || p.heroId === heroId ? p : { ...p, heroId }));
}

export function cycleHero(s: PlayersState, index: number, dir: 1 | -1): PlayersState {
   const p = s.players.find((q) => q.index === index);
   if (!p || p.ready) return s;
   return pickHero(s, index, nextHero(s, index, p.heroId, dir));
}

export function setReady(s: PlayersState, index: number, ready: boolean): PlayersState {
   return patch(s, index, (p) => (p.ready === ready ? p : { ...p, ready }));
}

/** In co-op, a later player who shares a hero with an earlier one moves to a free hero (and unreadies). */
function fixHeroes(s: PlayersState): PlayerState[] {
   if (!MODES[s.mode].uniqueHeroes) return s.players.slice();
   const used = new Set<string>();
   const out: PlayerState[] = [];
   for (const p of s.players) {
      let hero = p.heroId;
      if (used.has(hero) || !s.heroes.includes(hero)) hero = s.heroes.find((h) => !used.has(h)) ?? hero;
      used.add(hero);
      out.push(hero === p.heroId ? p : { ...p, heroId: hero, ready: false });
   }
   return out;
}

export function setMode(s: PlayersState, mode: ModeId): PlayersState {
   if (s.mode === mode) return s;
   const next = { ...s, mode };
   return { ...next, players: fixHeroes(next) };
}

/** Why the lobby cannot start yet (null = it can). */
export function startBlocker(s: PlayersState): string | null {
   if (s.phase !== "lobby") return "Not in the lobby";
   if (s.players.length < MIN_PLAYERS) return `Needs ${MIN_PLAYERS} players`;
   if (MODES[s.mode].uniqueHeroes) {
      const heroes = new Set(s.players.map((p) => p.heroId));
      if (heroes.size !== s.players.length) return "Each hero only once in co-op";
   }
   if (!s.players.every((p) => p.ready)) return "Waiting for everyone to be ready";
   return null;
}

export function canStart(s: PlayersState): boolean {
   return startBlocker(s) === null;
}

/** Starts the runs (from the lobby) or a new run (Retry): resets every per-run field. */
export function beginRun(s: PlayersState, lives = 0): PlayersState {
   if (s.phase === "lobby" && !canStart(s)) return s;
   if (s.phase === "off") return s;
   return {
      ...s,
      phase: "playing",
      players: s.players.map((p) => ({ ...p, score: 0, lives, finished: false, finishMs: null, progress: 0, position: { x: 0, y: 0, z: 0 } })),
   };
}

export function endSession(): PlayersState {
   return initialPlayers();
}

export type PlayerUpdate = Partial<Pick<PlayerState, "score" | "lives" | "progress" | "finished" | "finishMs">>;

export function updatePlayer(s: PlayersState, index: number, update: PlayerUpdate): PlayersState {
   return patch(s, index, (p) => {
      for (const k of Object.keys(update) as (keyof PlayerUpdate)[]) {
         if (update[k] !== undefined && update[k] !== p[k]) return { ...p, ...update };
      }
      return p;
   });
}

/**
 * The join screen's input for one device, once per frame (pure). An unjoined device joins with
 * Jump (A / Space / Enter). A joined one: left / right picks the hero, Jump readies, Action
 * unreadies, or leaves when not ready.
 */
export function applyLobbyInput(s: PlayersState, device: DeviceId, input: Readonly<PlayerInput>): PlayersState {
   if (s.phase !== "lobby") return s;
   const p = s.players.find((q) => q.device === device);
   if (!p) return input.jumpPressed ? joinPlayer(s, device) : s;
   let next = s;
   if (!p.ready) {
      if (input.pressed.left) next = cycleHero(next, p.index, -1);
      if (input.pressed.right) next = cycleHero(next, p.index, 1);
   }
   if (input.jumpPressed && !p.ready) next = setReady(next, p.index, true);
   else if (input.actionPressed) next = p.ready ? setReady(next, p.index, false) : leavePlayer(next, p.index);
   return next;
}

// ---------- the store ----------

export interface PlayersActions {
   openLobby(heroes: readonly string[]): void;
   join(device: DeviceId): void;
   leave(index: number): void;
   dropDevice(device: DeviceId): void;
   pickHero(index: number, heroId: string): void;
   cycleHero(index: number, dir: 1 | -1): void;
   setReady(index: number, ready: boolean): void;
   setMode(mode: ModeId): void;
   lobbyInput(device: DeviceId, input: Readonly<PlayerInput>): void;
   /** true when the runs started */
   beginRun(lives?: number): boolean;
   update(index: number, update: PlayerUpdate): void;
   /** live position, in place (no re-render) */
   setPosition(index: number, x: number, y: number, z: number): void;
   endSession(): void;
}

export type PlayersStore = PlayersState & PlayersActions;

export function createPlayersStore() {
   return createStore<PlayersStore>()((set, get) => {
      const apply = (fn: (s: PlayersState) => PlayersState) => {
         const s = get();
         const next = fn(s);
         if (next !== s) set(next);
      };
      return {
         ...initialPlayers(),
         openLobby: (heroes) => apply((s) => openLobby(s, heroes)),
         join: (device) => apply((s) => joinPlayer(s, device)),
         leave: (index) => apply((s) => leavePlayer(s, index)),
         dropDevice: (device) => apply((s) => dropDevice(s, device)),
         pickHero: (index, heroId) => apply((s) => pickHero(s, index, heroId)),
         cycleHero: (index, dir) => apply((s) => cycleHero(s, index, dir)),
         setReady: (index, ready) => apply((s) => setReady(s, index, ready)),
         setMode: (mode) => apply((s) => setMode(s, mode)),
         lobbyInput: (device, input) => apply((s) => applyLobbyInput(s, device, input)),
         beginRun(lives = 0) {
            const before = get();
            apply((s) => beginRun(s, lives));
            return get() !== before && get().phase === "playing";
         },
         update: (index, update) => apply((s) => updatePlayer(s, index, update)),
         setPosition(index, x, y, z) {
            const p = get().players.find((q) => q.index === index);
            if (!p) return;
            p.position.x = x;
            p.position.y = y;
            p.position.z = z;
         },
         endSession: () => set(endSession()),
      };
   });
}

/** The page's one session. */
export const playersStore = createPlayersStore();

export function usePlayers<T>(selector: (s: PlayersStore) => T): T {
   return useStore(playersStore, selector);
}

/** True while multiplayer runs are on (the game shows its multiplayer scene). */
export function isMultiplayerActive(s: Pick<PlayersState, "phase"> = playersStore.getState()): boolean {
   return s.phase === "playing";
}
