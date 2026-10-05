"use client";

// The game loop hook. Use it instead of useFrame for anything that changes the game:
// - it runs only while the run is "playing" (not during the countdown, pause or result screen);
// - dt is the play time the run clock counted this frame (<= 1/20 s), so a long frame (tab switch,
//   GC pause) cannot teleport objects and the game never moves for time the clock did not count;
// - it runs before CameraRig and every plain useFrame (FRAME_PRIORITY.simulation), so the camera
//   and the visuals that read the simulation's state always draw this frame's state, wherever the
//   component is mounted.
import { useRef } from "react";
import { useFrame, type RootState } from "@react-three/fiber";
import { arcadeStore } from "./useArcadeStore";
import { playedFrameDt, runFramePriority } from "./frameLoop";

export { FRAME_PRIORITY, MAX_FRAME_DT, clampFrameDt, runFramePriority } from "./frameLoop";

/**
 * `state` is the R3F root state, `dt` this frame's play time in seconds (always > 0),
 * `time` the run's play time in seconds after this frame (the store's elapsedMs / 1000).
 * Never use `state.clock.elapsedTime`: R3F resets it whenever GameShell pauses or resumes.
 */
export type RunFrameCallback = (state: RootState, dt: number, time: number) => void;

export interface RunFrameOptions {
   /**
    * useFrame priority. Default FRAME_PRIORITY.simulation (-0.5): after the run clock and
    * useGameTime(), before the follow camera (-0.25) and every visual (0). Allowed range
    * (FRAME_PRIORITY.gameTime, FRAME_PRIORITY.visuals] = (-0.75, 0]: at or below -0.75 the callback
    * would read the previous frame's game time, and a positive priority turns off R3F's automatic
    * rendering. Out of range throws in development (runFramePriority in core/frameLoop.ts).
    */
   priority?: number;
}

/**
 * Runs `callback` every frame while the phase is "playing".
 * Read input from `useInput().current` and write results with `useArcadeStore.getState()`.
 * Do not allocate objects or call setState in here.
 */
export function useRunFrame(callback: RunFrameCallback, options?: RunFrameOptions): void {
   const ref = useRef(callback);
   ref.current = callback;

   useFrame((state) => {
      const run = arcadeStore.getState();
      const dt = playedFrameDt(run);
      if (dt > 0) ref.current(state, dt, run.elapsedMs / 1000);
   }, runFramePriority(options?.priority));
}
