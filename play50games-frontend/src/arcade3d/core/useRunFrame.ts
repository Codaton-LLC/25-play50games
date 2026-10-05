"use client";

// The game loop hook. Use it instead of useFrame for anything that changes the game:
// it runs only while the run is "playing" (not during the countdown, pause or result screen)
// and clamps dt so a long frame (tab switch, GC pause) cannot teleport objects.
import { useRef } from "react";
import { useFrame, type RootState } from "@react-three/fiber";
import { arcadeStore } from "./useArcadeStore";

/** Largest dt (seconds) a frame callback ever sees: 1/20 s. */
export const MAX_FRAME_DT = 1 / 20;

export function clampFrameDt(delta: number): number {
   if (!(delta > 0)) return 0;
   return Math.min(delta, MAX_FRAME_DT);
}

/** `state` is the R3F root state, `dt` the clamped frame time in seconds. */
export type RunFrameCallback = (state: RootState, dt: number) => void;

/**
 * Runs `callback` every frame while the phase is "playing".
 * Read input from `useInput().current` and write results with `useArcadeStore.getState()`.
 * Do not allocate objects or call setState in here.
 */
export function useRunFrame(callback: RunFrameCallback): void {
   const ref = useRef(callback);
   ref.current = callback;

   useFrame((state, delta) => {
      if (arcadeStore.getState().phase !== "playing") return;
      ref.current(state, clampFrameDt(delta));
   });
}
