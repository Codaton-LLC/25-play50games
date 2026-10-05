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
// - Order inside one frame: input -> run clock -> game time -> simulation -> visuals -> render.
import type { StoreApi } from "zustand/vanilla";
import type { RunPhase } from "./types";
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
   /** plain useFrame (R3F default): visuals that read the simulation's state */
   visuals: 0,
} as const;

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
