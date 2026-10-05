"use client";

// fitView (core/view.ts) for the live canvas: size, camera fov and the safe area (the shell HUD,
// the game HUD's marked panels, the touch controls and the cookie banner, useSafeArea). Recomputed
// only when one of those inputs changes (resize, rotation, the banner, HUD changes), never per
// frame. Use inside a Scene:
//
//    const FOCUS = followFocus({ lookAt: LOOK_AT, reach: FLOOR, fraction: FOLLOW });   // module level
//    const view = useFittedView({ area: ARENA_BOX, pitch: PITCH, yaws: [0, Math.PI / 2], focus: FOCUS, shift: true });
//    <CameraRig camera={{ position: view.offset, lookAt: LOOK_AT }} follow={run.player} followFraction={FOLLOW}
//       offset={view.offset} shift={view.shift} />
//    inputToWorld(input.moveX, input.moveY, view.yaw, run.dir);
//
// - The yaw is picked from `yaws` once per canvas size (and when the safe area is first measured).
//   Later safe-area changes (the cookie banner opening or closing, HUD panels) change only the
//   distance and the shift, so the camera never turns 90° in the middle of a run.
// - Pass module-level constants for `area`, `yaws`, `focus`, `margin` and `avoid`, so the fit is
//   not redone on every render.
// - The fov is the canvas camera's (definition.camera.fov). A Scene whose CameraRig sets another
//   fov passes the same value as `fov` here (the camera object does not re-render on fov changes).
import { useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { useSafeArea, type SafeArea } from "./safeArea";
import { fitView, type FitViewOptions, type FittedView, type ScreenRect } from "./view";

export interface FittedViewOptions extends Omit<FitViewOptions, "width" | "height" | "fov" | "avoid"> {
   /** vertical fov in degrees; default the canvas camera's (definition.camera.fov). Match CameraRig's camera.fov */
   fov?: number;
   /** keep the box out from under the shell HUD and the game HUD's marked panels. Default true */
   avoidHud?: boolean;
   /** keep the box out from under the touch controls. Default true */
   avoidControls?: boolean;
   /** keep the box out from under page UI over the canvas (the cookie banner). Default true */
   avoidObstructions?: boolean;
   /** more canvas rects to keep clear (CSS px from the canvas top-left), e.g. an in-scene label */
   avoid?: readonly ScreenRect[];
}

/** The yaw useFittedView keeps, and the layout it was picked for. */
export interface YawLock {
   width: number;
   height: number;
   /** the safe area had been measured */
   measured: boolean;
   /** number of touch-control rects */
   controls: number;
   yaw: number;
}

export interface LiveFitInput extends FittedViewOptions {
   width: number;
   height: number;
   fov: number;
}

const NO_RECTS: readonly ScreenRect[] = [];

/**
 * The pure part of useFittedView: the fit for this canvas and safe area. The yaw of `previous` is
 * kept while the canvas size, the measured flag and the touch-controls layout stay the same, so a
 * safe-area change alone (the banner, a HUD panel) never turns the camera. Returns the next lock.
 */
export function fitLiveView(input: LiveFitInput, safe: SafeArea, previous: YawLock | null): { view: FittedView; lock: YawLock } {
   const { width, height, yaws, avoid: extra = NO_RECTS, avoidHud = true, avoidControls = true, avoidObstructions = true, ...rest } = input;
   const avoid = [
      ...(avoidHud ? safe.hud : []),
      ...(avoidControls ? safe.controls : []),
      ...(avoidObstructions ? safe.obstructions ?? [] : []),
      ...extra,
   ];
   const measured = safe.width > 0 && safe.height > 0;
   const keep =
      previous !== null &&
      previous.width === width &&
      previous.height === height &&
      previous.measured === measured &&
      previous.controls === safe.controls.length &&
      (yaws ?? [0]).includes(previous.yaw);
   const view = fitView({ ...rest, width, height, avoid, yaws: keep ? [previous.yaw] : yaws });
   return { view, lock: { width, height, measured, controls: safe.controls.length, yaw: view.yaw } };
}

export function useFittedView(options: FittedViewOptions): FittedView {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const camera = useThree((state) => state.camera);
   const fov = options.fov ?? (camera instanceof PerspectiveCamera ? camera.fov : 50);
   const safe = useSafeArea();
   const { area, pitch, yaws, focus, margin, padding, shift, steps, minDistance, maxDistance, avoid, avoidHud, avoidControls, avoidObstructions } = options;
   const lock = useRef<YawLock | null>(null);

   return useMemo(() => {
      const input: LiveFitInput = {
         width,
         height,
         fov,
         area,
         pitch,
         yaws,
         focus,
         margin,
         padding,
         shift,
         steps,
         minDistance,
         maxDistance,
         avoid,
         avoidHud,
         avoidControls,
         avoidObstructions,
      };
      const next = fitLiveView(input, safe, lock.current);
      // a cache of the last pick, not render output: rewriting it in a repeated render is harmless
      lock.current = next.lock;
      return next.view;
   }, [width, height, fov, safe, area, pitch, yaws, focus, margin, padding, shift, steps, minDistance, maxDistance, avoid, avoidHud, avoidControls, avoidObstructions]);
}
