// The frame loop rules every 3D Arcade game runs on. Owned by Claude. Pure (no React, no R3F), so
// tests can drive the real store exactly the way the canvas does:
//
//    advanceRunClock(store, delta);              // RunClock, FRAME_PRIORITY.clock
//    const dt = playedFrameDt(store.getState()); // useRunFrame, FRAME_PRIORITY.simulation
//    if (dt > 0) step(dt);
//
// Rules (core/README.md "Time and frame order"):
// - Game logic runs in useRunFrame. Its dt is exactly the play time the run clock counted in that
//   frame, so the game never moves for time the clock did not count (and the reverse).
// - Visuals animate with useGameTime() (stops while paused), never with state.clock.elapsedTime:
//   GameShell pauses by switching the R3F frameloop, and R3F resets that clock on every switch.
// - Order inside one frame: input -> run clock -> game time -> simulation -> camera -> visuals -> render.
// - After a run the scene keeps rendering for the game's result delay before the result panel
//   appears (resultDelayFor -> configure({ resultDelayMs }), then isResultShown); the score is
//   submitted at once.
import type { StoreApi } from "zustand/vanilla";
import type { EndReason, GameDefinition, RunPhase } from "./types";
import type { ArcadeStore } from "./useArcadeStore";

/**
 * useFrame priorities inside GameShell's canvas: lower runs first. Every one is <= 0, so R3F keeps
 * rendering on its own (a positive priority turns automatic rendering off).
 */
export const FRAME_PRIORITY = {
   /** InputLatch: publishes this frame's input */
   input: -2,
   /** RunClock: countdown, elapsedMs, timeLeftMs, "timeup" */
   clock: -1,
   /** the per-run animation clock behind useGameTime() */
   gameTime: -0.75,
   /** useRunFrame (default): the game's step, before anything draws its state */
   simulation: -0.5,
   /** CameraRig: follows the simulation's state, before the visuals that read the camera */
   camera: -0.25,
   /** plain useFrame (R3F default): visuals that read the simulation's state and the camera */
   visuals: 0,
} as const;

/**
 * The useFrame priority useRunFrame uses: FRAME_PRIORITY.simulation by default. A custom one must
 * be above FRAME_PRIORITY.gameTime (at or below it, the callback would run before the run clock
 * or useGameTime() advance and read the previous frame's values) and at most FRAME_PRIORITY.visuals
 * (a positive priority turns off R3F's automatic rendering). Above FRAME_PRIORITY.camera it runs
 * after the follow camera has moved. Anything else throws outside production and falls back to
 * the default in production.
 */
export function runFramePriority(priority?: number): number {
   if (priority === undefined) return FRAME_PRIORITY.simulation;
   if (priority > FRAME_PRIORITY.gameTime && priority <= FRAME_PRIORITY.visuals) return priority;
   if (process.env.NODE_ENV !== "production") {
      throw new RangeError(
         `useRunFrame priority ${priority} is outside (${FRAME_PRIORITY.gameTime}, ${FRAME_PRIORITY.visuals}] (FRAME_PRIORITY.gameTime, FRAME_PRIORITY.visuals].`
      );
   }
   return FRAME_PRIORITY.simulation;
}

/** Largest dt (seconds) a frame callback ever sees: 1/20 s. */
export const MAX_FRAME_DT = 1 / 20;

export function clampFrameDt(delta: number): number {
   if (!(delta > 0)) return 0;
   return Math.min(delta, MAX_FRAME_DT);
}

/** What RunClock does once per frame: advance the store by the clamped frame delta (seconds). */
export function advanceRunClock(store: StoreApi<ArcadeStore>, delta: number): void {
   store.getState().tick(clampFrameDt(delta) * 1000);
}

/**
 * The dt (seconds) useRunFrame hands the game this frame: the play time the run clock just
 * counted (`frameMs`), including the rest of the frame in which the countdown ended.
 * 0 = do not run the game this frame (not playing, or no play time passed).
 */
export function playedFrameDt(state: Pick<ArcadeStore, "phase" | "frameMs">): number {
   if (state.phase !== "playing" || !(state.frameMs > 0)) return 0;
   return state.frameMs / 1000;
}

// ---------- result delay ----------

/** GameDefinition.resultDelayMs when a game sets none: the scene stays on screen this long after a run. */
export const DEFAULT_RESULT_DELAY_MS = 800;
/**
 * Longest result delay. The store's overMs counts only up to the game's own delay
 * (config.resultDelayMs, at most this), so the result screen causes no store update per frame.
 */
export const RESULT_DELAY_MAX_MS = 5000;

/**
 * The result delay (ms) of a game: `definition.resultDelayMs`, DEFAULT_RESULT_DELAY_MS when unset,
 * clamped to [0, RESULT_DELAY_MAX_MS] (anything that is not a number >= 0 counts as 0). GameShell
 * hands it to the store with configure({ resultDelayMs }), which resolves it the same way.
 */
export function resultDelayFor(definition: Pick<GameDefinition, "resultDelayMs">): number {
   const ms = definition.resultDelayMs;
   if (ms === undefined) return DEFAULT_RESULT_DELAY_MS;
   if (!(ms > 0)) return 0;
   return Math.min(ms, RESULT_DELAY_MAX_MS);
}

/**
 * Is the result panel up? Only in phase "over", once the store's `overMs` (rendered ms since the
 * end, advanced by advanceRunClock) has reached the run's `config.resultDelayMs` (set by
 * configure()). A delay of 0 shows it on the frame the run ends, and so does "quit" (GameShell
 * exits instead). Pause cannot interrupt it: an ended run cannot be paused, and a hidden tab
 * renders no frames, so the delay simply waits for the player.
 */
export function isResultShown(
   state: Pick<ArcadeStore, "phase" | "overMs"> & { endReason: EndReason | null; config: { resultDelayMs: number } }
): boolean {
   if (state.phase !== "over") return false;
   const delayMs = state.config.resultDelayMs;
   if (!(delayMs > 0) || state.endReason === "quit") return true;
   return state.overMs >= Math.min(delayMs, RESULT_DELAY_MAX_MS);
}

// ---------- game time (visual animation) ----------

/** A long frame (tab switch, a redraw while paused) never moves an animation more than this (s). */
export const MAX_ANIM_DT = 0.1;

/**
 * Pause-safe clocks for one run (useGameTime()). Read the fields inside frame callbacks; the
 * object is mutated in place every frame and never replaced.
 */
export interface GameTime {
   /**
    * Animation seconds since this run's Scene mounted. Advances every frame by the frame delta
    * (at most MAX_ANIM_DT) in every phase except "paused", so pop-ins and bobbing also run during
    * the countdown and on the result screen. Use it for anything that only looks.
    */
   now: number;
   /** This frame's step of `now` (s): 0 while paused. Use it instead of useFrame's delta. */
   delta: number;
   /** Play seconds: the store's elapsedMs / 1000. Only advances while "playing". */
   play: number;
}

export function createGameTime(): GameTime {
   return { now: 0, delta: 0, play: 0 };
}

/** One frame of game time: `delta` is R3F's raw frame delta (s). */
export function advanceGameTime(time: GameTime, phase: RunPhase, delta: number, elapsedMs: number): void {
   const step = phase === "paused" || !(delta > 0) ? 0 : Math.min(delta, MAX_ANIM_DT);
   time.delta = step;
   time.now += step;
   time.play = elapsedMs / 1000;
}
