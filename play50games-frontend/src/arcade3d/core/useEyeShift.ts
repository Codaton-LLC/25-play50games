"use client";

// fitEyeShift (core/view.ts) for the live canvas: the lens shift that keeps a fixed eye's view band
// clear of the shell HUD, the game HUD's marked panels, the touch controls and the cookie banner
// (useSafeArea). For first-person cameras that never move back to fit (EyeRig). Use inside a Scene:
//
//    const BAND: AABB = { min: { x: -1.5, y: 0, z: 5 }, max: { x: 1.5, y: 2.4, z: 6.4 } }; // module level
//    const eye = useEyeShift({ fov: 70, eyeY: 1.6, band: BAND, padding: 8 });
//    <EyeRig position={[0, 1.6, 0]} yaw={guard.yaw} fov={70} shift={eye.shift} />
//
// - Recomputed only when the canvas size or the safe area changes (rects compared within half a
//   px, sameScreenRects), or one of its options does; never per frame.
// - The returned object (and its `shift` array) keeps its identity while the result is the same.
// - `fov` defaults to the canvas camera's; pass EyeRig's `fov` when it sets another one.
import { useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { sameScreenRects, useSafeArea, type SafeArea } from "./safeArea";
import { fitEyeShift, type EyeShift, type EyeShiftOptions, type ScreenRect } from "./view";

export interface LiveEyeShiftOptions extends Omit<EyeShiftOptions, "width" | "height" | "fov"> {
   /** vertical fov in degrees; default the canvas camera's. Match EyeRig's `fov` */
   fov?: number;
   /** keep the band out from under the shell HUD and the game HUD's marked panels. Default true */
   avoidHud?: boolean;
   /** keep the band out from under the touch controls. Default true */
   avoidControls?: boolean;
   /** keep the band out from under page UI over the canvas (the cookie banner). Default true */
   avoidObstructions?: boolean;
}

const NO_RECTS: readonly ScreenRect[] = [];

/** The pure part of useEyeShift: the shift for this canvas and safe area. */
export function fitLiveEyeShift(
   input: Omit<LiveEyeShiftOptions, "fov"> & { width: number; height: number; fov: number },
   safe: SafeArea
): EyeShift {
   const { avoid: extra = NO_RECTS, avoidHud = true, avoidControls = true, avoidObstructions = true, ...rest } = input;
   const avoid = [
      ...(avoidHud ? safe.hud : []),
      ...(avoidControls ? safe.controls : []),
      ...(avoidObstructions ? safe.obstructions ?? [] : []),
      ...extra,
   ];
   return fitEyeShift({ ...rest, avoid });
}

/** Is `b` the same result as `a` (so useEyeShift keeps `a` and its shift array)? */
export function sameEyeShift(a: EyeShift, b: EyeShift): boolean {
   return a.fits === b.fits && a.overflow === b.overflow && a.shift[0] === b.shift[0] && a.shift[1] === b.shift[1];
}

const sameBox = (a: EyeShiftOptions["band"], b: EyeShiftOptions["band"]) =>
   a.min.x === b.min.x && a.min.y === b.min.y && a.min.z === b.min.z && a.max.x === b.max.x && a.max.y === b.max.y && a.max.z === b.max.z;
const sameMargin = (a: EyeShiftOptions["margin"], b: EyeShiftOptions["margin"]) =>
   a === b || (!!a && !!b && a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left);

/**
 * The live lens shift for a fixed eye (EyeRig `shift`). Inline `band`, `margin` and `avoid`
 * objects are compared by value, so a new object with the same numbers does not refit.
 */
export function useEyeShift(options: LiveEyeShiftOptions): EyeShift {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const camera = useThree((state) => state.camera);
   const fov = options.fov ?? (camera instanceof PerspectiveCamera ? camera.fov : 50);
   const safe = useSafeArea();
   const { eyeY, pitch, padding, steps, avoidHud, avoidControls, avoidObstructions } = options;

   // the object-valued inputs, kept while their values hold (inline literals are fine)
   const inputs = useRef<{ band: EyeShiftOptions["band"]; margin: EyeShiftOptions["margin"]; avoid: readonly ScreenRect[]; safe: SafeArea } | null>(null);
   const prev = inputs.current;
   const avoid = options.avoid ?? NO_RECTS;
   const band = prev && sameBox(prev.band, options.band) ? prev.band : options.band;
   const margin = prev && sameMargin(prev.margin, options.margin) ? prev.margin : options.margin;
   const extra = prev && sameScreenRects(prev.avoid, avoid) ? prev.avoid : avoid;
   const sameSafe =
      prev !== null &&
      sameScreenRects(prev.safe.hud, safe.hud) &&
      sameScreenRects(prev.safe.controls, safe.controls) &&
      sameScreenRects(prev.safe.obstructions ?? NO_RECTS, safe.obstructions ?? NO_RECTS);
   const area = sameSafe ? prev.safe : safe;
   // a cache of the last inputs, not render output: rewriting it in a repeated render is harmless
   inputs.current = { band, margin, avoid: extra, safe: area };

   const last = useRef<EyeShift | null>(null);
   return useMemo(() => {
      const next = fitLiveEyeShift(
         { width, height, fov, eyeY, pitch, band, margin, avoid: extra, padding, steps, avoidHud, avoidControls, avoidObstructions },
         area
      );
      if (last.current && sameEyeShift(last.current, next)) return last.current;
      last.current = next;
      return next;
   }, [width, height, fov, eyeY, pitch, band, margin, extra, padding, steps, avoidHud, avoidControls, avoidObstructions, area]);
}
