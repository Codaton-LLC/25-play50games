// Run state for the one 3D Arcade game on screen: phase machine, score, timer, lives, HUD stats.
// Owned by Claude. Games read it with selectors (`useArcadeStore((s) => s.score)`) for React UI,
// and with `useArcadeStore.getState()` inside useRunFrame (no re-render, no allocation).
//
// Phases: loading -> ready -> countdown -> playing <-> paused -> over
//   configure() -> loading; markReady() -> ready; start()/restart() -> countdown;
//   tick() ends the countdown (-> playing) and the timer (-> over, "timeup").
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { EndReason, RunActions, RunPhase, RunState } from "./types";

/** Length of the 3-2-1 countdown before every run. */
export const COUNTDOWN_MS = 3000;
/** Upper bound for one tick, so a long frame (tab switch, GC pause) cannot skip the timer. */
export const MAX_TICK_MS = 250;

export interface RunConfig {
   /** countdown timer length; null = untimed game */
   durationMs: number | null;
   /** starting lives; null = game has no lives */
   lives: number | null;
}

export interface ArcadeStore extends RunState, RunActions {
   /** ms left in the 3-2-1 countdown (0 outside the countdown) */
   countdownMs: number;
   /** phase that resume() returns to */
   pausedFrom: "countdown" | "playing" | null;
   config: RunConfig;
   /** GameShell: set the game's timer and lives, back to "loading" (keeps runId) */
   configure(config: Partial<RunConfig>): void;
   /** GameShell: the scene finished loading ("loading" -> "ready") */
   markReady(): void;
   /** GameShell clock, once per frame: advances the countdown, elapsedMs and timeLeftMs */
   tick(dtMs: number): void;
}

type RunData = Omit<RunState, "phase" | "runId"> & { countdownMs: number };

const NO_CONFIG: RunConfig = { durationMs: null, lives: null };

function freshRun(config: RunConfig): RunData {
   return {
      score: 0,
      level: 1,
      lives: config.lives,
      elapsedMs: 0,
      timeLeftMs: config.durationMs,
      endReason: null,
      stats: {},
      countdownMs: 0,
   };
}

function initialData() {
   return {
      ...freshRun(NO_CONFIG),
      phase: "loading" as RunPhase,
      runId: 0,
      pausedFrom: null,
      config: NO_CONFIG,
   };
}

const ACTIVE: ReadonlySet<RunPhase> = new Set<RunPhase>(["countdown", "playing", "paused"]);

/** Creates an independent store (tests, previews). The app uses the shared `arcadeStore`. */
export function createArcadeStore(): StoreApi<ArcadeStore> {
   return createStore<ArcadeStore>()((set, get) => {
      /** score/stat changes are frozen once the run is over (the result is already computed) */
      const canEdit = () => get().phase !== "over";

      const beginRun = () => {
         const { config, runId } = get();
         set({
            ...freshRun(config),
            phase: "countdown",
            countdownMs: COUNTDOWN_MS,
            pausedFrom: null,
            // a new runId remounts the scene, so every run starts from a clean scene
            runId: runId + 1,
         });
      };

      return {
         ...initialData(),

         configure(config) {
            const next: RunConfig = {
               durationMs: config.durationMs ?? null,
               lives: config.lives ?? null,
            };
            set({ ...freshRun(next), config: next, phase: "loading", pausedFrom: null });
         },

         markReady() {
            if (get().phase === "loading") set({ phase: "ready" });
         },

         start() {
            const { phase } = get();
            if (phase === "ready") beginRun();
            else if (phase === "over") get().restart();
         },

         pause() {
            const { phase } = get();
            if (phase === "countdown" || phase === "playing") set({ phase: "paused", pausedFrom: phase });
         },

         resume() {
            const { phase, pausedFrom } = get();
            if (phase === "paused") set({ phase: pausedFrom ?? "playing", pausedFrom: null });
         },

         restart() {
            if (get().phase === "loading") return;
            beginRun();
         },

         reset() {
            set(initialData());
         },

         addScore(delta) {
            if (!canEdit() || !Number.isFinite(delta)) return;
            set((s) => ({ score: Math.max(0, s.score + delta) }));
         },

         setScore(value) {
            if (!canEdit() || !Number.isFinite(value)) return;
            set({ score: Math.max(0, value) });
         },

         setStat(key, value) {
            if (!canEdit()) return;
            set((s) => (s.stats[key] === value ? s : { stats: { ...s.stats, [key]: value } }));
         },

         incStat(key, delta = 1) {
            if (!canEdit()) return;
            set((s) => ({ stats: { ...s.stats, [key]: (s.stats[key] ?? 0) + delta } }));
         },

         setLevel(level) {
            if (!canEdit()) return;
            set({ level });
         },

         loseLife() {
            const { lives, phase } = get();
            if (lives === null || phase === "over") return;
            const next = Math.max(0, lives - 1);
            set({ lives: next });
            // out of lives ends the run (only while it is actually being played)
            if (next === 0 && phase === "playing") get().end("lose");
         },

         end(reason: EndReason) {
            const { phase, endReason } = get();
            if (!ACTIVE.has(phase) || endReason !== null) return;
            set({ phase: "over", endReason: reason, pausedFrom: null, countdownMs: 0 });
         },

         tick(dtMs) {
            if (!(dtMs > 0)) return;
            const dt = Math.min(dtMs, MAX_TICK_MS);
            const s = get();

            if (s.phase === "countdown") {
               const left = s.countdownMs - dt;
               set(left > 0 ? { countdownMs: left } : { countdownMs: 0, phase: "playing" });
               return;
            }
            if (s.phase !== "playing") return;

            if (s.timeLeftMs === null) {
               set({ elapsedMs: s.elapsedMs + dt });
               return;
            }
            // never count past the end of the timer: elapsedMs equals durationMs on "timeup"
            const step = Math.min(dt, s.timeLeftMs);
            const timeLeftMs = s.timeLeftMs - step;
            if (timeLeftMs > 0) {
               set({ elapsedMs: s.elapsedMs + step, timeLeftMs });
               return;
            }
            set({
               elapsedMs: s.elapsedMs + step,
               timeLeftMs: 0,
               phase: "over",
               endReason: "timeup",
               pausedFrom: null,
            });
         },
      };
   });
}

/** The shared store for the game on screen (one game at a time). */
export const arcadeStore = createArcadeStore();

type UseArcadeStore = {
   (): ArcadeStore;
   <T>(selector: (state: ArcadeStore) => T): T;
} & StoreApi<ArcadeStore>;

const selectAll = (state: ArcadeStore) => state;

function useBoundArcadeStore<T>(selector?: (state: ArcadeStore) => T): T | ArcadeStore {
   return useStore(arcadeStore, (selector ?? selectAll) as (state: ArcadeStore) => T | ArcadeStore);
}

/**
 * React hook + store API in one:
 * - `useArcadeStore((s) => s.score)` re-renders when the selected value changes;
 * - `useArcadeStore.getState().addScore(10)` inside useRunFrame never re-renders.
 */
export const useArcadeStore = Object.assign(useBoundArcadeStore, arcadeStore) as UseArcadeStore;
