// Run state for the one 3D Arcade game on screen: phase machine, score, timer, lives, HUD stats.
// Owned by Claude. Games read it with selectors (`useArcadeStore((s) => s.score)`) for React UI,
// and with `useArcadeStore.getState()` inside useRunFrame (no re-render, no allocation).
//
// Phases: loading -> ready -> countdown -> playing <-> paused -> over
//   configure() -> loading; markReady() -> ready; start()/restart() -> countdown;
//   tick() ends the countdown (-> playing) and the timer (-> over, "timeup").
// Clock: tick() counts play time into elapsedMs and reports it as frameMs, which useRunFrame hands
// to the game as dt. The frame in which the countdown ends counts its rest as play time, so the
// game never moves for time the clock did not count (core/frameLoop.ts).
// After the run: tick() counts rendered time into overMs until it reaches config.resultDelayMs
// (GameDefinition.resultDelayMs via configure()), then stops; GameShell shows the result panel once
// it is there (isResultShown in core/frameLoop.ts).
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { EndReason, RunActions, RunPhase, RunState } from "./types";
import { isPausable, resultDelayFor } from "./frameLoop";

export { DEFAULT_RESULT_DELAY_MS, RESULT_DELAY_MAX_MS } from "./frameLoop";

/** Length of the 3-2-1 countdown before every run. */
export const COUNTDOWN_MS = 3000;
/** Upper bound for one tick, so a long frame (tab switch, GC pause) cannot skip the timer. */
export const MAX_TICK_MS = 250;

export interface RunConfig {
   /** countdown timer length; null = untimed game */
   durationMs: number | null;
   /** starting lives; null = game has no lives */
   lives: number | null;
   /**
    * Rendered ms the scene stays on screen after a run before the result panel (GameShell passes
    * GameDefinition.resultDelayMs). configure() resolves it with resultDelayFor: unset = 800 ms
    * (DEFAULT_RESULT_DELAY_MS), clamped to [0, RESULT_DELAY_MAX_MS].
    */
   resultDelayMs: number;
}

export interface ArcadeStore extends RunState, RunActions {
   /** ms left in the 3-2-1 countdown (0 outside the countdown) */
   countdownMs: number;
   /** phase that resume() returns to */
   pausedFrom: "countdown" | "playing" | null;
   /**
    * Play time (ms) the latest tick() added to elapsedMs; 0 when it added none (countdown, pause,
    * a 0 ms frame). useRunFrame hands exactly this to the game as dt (core/frameLoop.ts).
    */
   frameMs: number;
   /**
    * Rendered ms since the run ended: 0 when phase "over" begins, then every tick() adds its frame
    * time until it reaches config.resultDelayMs, where it stops (no store update per frame once the
    * result panel is up). Frames only, so a hidden tab (no frames) does not count. GameShell shows
    * the result once it is there (isResultShown, core/frameLoop.ts).
    */
   overMs: number;
   config: RunConfig;
   /** GameShell: set the game's timer, lives and result delay, back to "loading" (keeps runId) */
   configure(config: Partial<RunConfig>): void;
   /** GameShell: the scene finished loading ("loading" -> "ready") */
   markReady(): void;
   /** GameShell clock, once per frame: advances the countdown, elapsedMs and timeLeftMs; sets frameMs */
   tick(dtMs: number): void;
}

type RunData = Omit<RunState, "phase" | "runId"> & { countdownMs: number; frameMs: number; overMs: number };

const NO_CONFIG: RunConfig = { durationMs: null, lives: null, resultDelayMs: resultDelayFor({}) };

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
      frameMs: 0,
      overMs: 0,
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

type ClockUpdate = Partial<Pick<ArcadeStore, "phase" | "elapsedMs" | "timeLeftMs" | "frameMs" | "endReason" | "pausedFrom" | "overMs">>;

/** Counts `ms` (>= 0) of play into a playing run, never past the end of its timer. */
function play(s: Pick<ArcadeStore, "elapsedMs" | "timeLeftMs" | "config">, ms: number): ClockUpdate {
   if (s.timeLeftMs === null) return { phase: "playing", elapsedMs: s.elapsedMs + ms, frameMs: ms };
   const step = Math.min(ms, s.timeLeftMs);
   const timeLeftMs = s.timeLeftMs - step;
   if (timeLeftMs > 0) return { phase: "playing", elapsedMs: s.elapsedMs + step, timeLeftMs, frameMs: step };
   // "timeup": elapsedMs is exactly durationMs (no float drift from summing frames)
   return {
      elapsedMs: s.config.durationMs ?? s.elapsedMs + step,
      timeLeftMs: 0,
      frameMs: step,
      phase: "over",
      endReason: "timeup",
      pausedFrom: null,
      overMs: 0,
   };
}

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
               resultDelayMs: resultDelayFor({ resultDelayMs: config.resultDelayMs }),
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
            if (isPausable(phase)) set({ phase: "paused", pausedFrom: phase });
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
            set({ phase: "over", endReason: reason, pausedFrom: null, countdownMs: 0, overMs: 0 });
         },

         tick(dtMs) {
            const s = get();
            const dt = dtMs > 0 ? Math.min(dtMs, MAX_TICK_MS) : 0;

            if (s.phase === "countdown" && dt > 0) {
               const left = s.countdownMs - dt;
               if (left > 0) {
                  set({ countdownMs: left, frameMs: 0 });
                  return;
               }
               // the countdown ended inside this frame: the rest of the frame is already play time
               set({ countdownMs: 0, ...play(s, Math.max(0, -left)) });
               return;
            }
            if (s.phase === "over" && dt > 0 && s.overMs < s.config.resultDelayMs) {
               // the scene stays on screen after the run: count the frames GameShell waits for, then
               // stop (the result screen causes no store update per frame)
               set({ overMs: Math.min(s.config.resultDelayMs, s.overMs + dt), frameMs: 0 });
               return;
            }
            if (s.phase !== "playing" || dt === 0) {
               if (s.frameMs !== 0) set({ frameMs: 0 });
               return;
            }
            set(play(s, dt));
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
