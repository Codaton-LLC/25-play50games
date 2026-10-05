"use client";

// fitView (core/view.ts) for the live canvas: size, camera fov and the shell's safe area (HUD and
// touch controls, including the lift above the cookie banner). Recomputed only when one of them
// changes (resize, rotation, the banner), never per frame. Use inside a Scene:
//
//    const view = useFittedView({ area: ARENA_BOX, pitch: PITCH, yaws: [0, Math.PI / 2], focus: FOCUS_RANGE });
//    <CameraRig camera={{ position: view.offset, lookAt: ORIGIN }} follow={run.player} followFraction={FOLLOW} offset={view.offset} />
//    inputToWorld(input.moveX, input.moveY, view.yaw, run.dir);
//
// Pass module-level constants for `area`, `yaws`, `focus` and `margin`, so the fit is not redone
// on every render.
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { useSafeArea } from "./safeArea";
import { fitView, type FitViewOptions, type FittedView } from "./view";

export interface FittedViewOptions extends Omit<FitViewOptions, "width" | "height" | "fov" | "avoid"> {
   /** keep the box out from under the shell HUD. Default true */
   avoidHud?: boolean;
   /** keep the box out from under the touch controls. Default true */
   avoidControls?: boolean;
}

export function useFittedView(options: FittedViewOptions): FittedView {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const camera = useThree((state) => state.camera);
   const fov = camera instanceof PerspectiveCamera ? camera.fov : 50;
   const safe = useSafeArea();
   const { area, pitch, yaws, focus, margin, padding, steps, minDistance, maxDistance, avoidHud = true, avoidControls = true } = options;

   return useMemo(() => {
      const avoid = [...(avoidHud ? safe.hud : []), ...(avoidControls ? safe.controls : [])];
      return fitView({ width, height, fov, area, pitch, yaws, focus, margin, avoid, padding, steps, minDistance, maxDistance });
   }, [width, height, fov, safe, area, pitch, yaws, focus, margin, padding, steps, minDistance, maxDistance, avoidHud, avoidControls]);
}
