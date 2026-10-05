"use client";

// Robot Collector camera fit: where the follow camera sits so the whole warehouse stays readable
// on every screen, from a 375 px portrait phone to a desktop. The idea is generic ("fit this box
// into the free part of the screen"); it lives in the game only because core/CameraRig has no such
// option yet (README.md "Known issues and core gaps"). Runs on resize only, never per frame.
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { WALL } from "./Primitives";
import { ARENA } from "./rules";

/** Camera tilt above the floor: a three-quarter top-down view. */
export const PITCH = (56 * Math.PI) / 180;
/** The camera follows a focus point this fraction of the way from the warehouse centre to the robot. */
export const FOLLOW = 0.12;
/** Screen area (NDC, -1..1) the warehouse must stay inside: room for the HUD on top. */
const SAFE = { side: 0.96, top: 0.78, bottom: -0.86 } as const;
/**
 * Touch screens: the joystick's box, in CSS px from the bottom-left corner of the canvas.
 * 132 px joystick + 20 px --controls-gap (core/TouchControls.module.css) + 8 px of air.
 * The safe-area insets (notch, home bar) are added when the view is fitted.
 */
const JOYSTICK_PX = 132 + 20 + 8;

export interface View {
   /** 0 = camera on the +z side (long side across the screen); PI/2 = on the +x side (portrait) */
   yaw: number;
   /** camera position relative to the focus point */
   offset: [number, number, number];
}

/** Points along the bottom and top outline of the warehouse, walls included. */
const OUTLINE: Vector3[] = (() => {
   const ex = ARENA.halfX + WALL.thickness;
   const ez = ARENA.halfZ + WALL.thickness;
   const steps = 12;
   const points: Vector3[] = [];
   for (const y of [0, WALL.height]) {
      for (let k = 0; k <= steps; k++) {
         const x = -ex + (2 * ex * k) / steps;
         const z = -ez + (2 * ez * k) / steps;
         points.push(new Vector3(x, y, -ez), new Vector3(x, y, ez), new Vector3(-ex, y, z), new Vector3(ex, y, z));
      }
   }
   return points;
})();

/**
 * Finds the closest camera that keeps the whole warehouse inside SAFE, and out from under the
 * joystick, wherever the follow focus goes. Tries both yaws and keeps the closer one, so a portrait
 * phone looks along the long side and the robot stays as big as possible.
 * `joystick` is the joystick's box in px (right edge, top edge) or null without touch controls.
 */
export function fitView(width: number, height: number, fov: number, joystick: { right: number; top: number } | null): View {
   const w = Math.max(1, width);
   const h = Math.max(1, height);
   const cam = new PerspectiveCamera(fov, w / h, 0.1, 500);
   // the joystick box in NDC: a point with x < joyX and y < joyY is under the joystick
   const joyX = joystick ? -1 + (2 * joystick.right) / w : -Infinity;
   const joyY = joystick ? -1 + (2 * joystick.top) / h : -Infinity;
   const focus = new Vector3();
   const p = new Vector3();

   const fits = (yaw: number, distance: number) => {
      const flat = Math.cos(PITCH) * distance;
      for (const sx of [-1, 1]) {
         for (const sz of [-1, 1]) {
            focus.set(sx * FOLLOW * ARENA.halfX, 0, sz * FOLLOW * ARENA.halfZ);
            cam.position.set(focus.x + Math.sin(yaw) * flat, Math.sin(PITCH) * distance, focus.z + Math.cos(yaw) * flat);
            cam.lookAt(focus);
            cam.updateMatrixWorld();
            for (const point of OUTLINE) {
               p.copy(point).project(cam);
               if (p.z > 1 || Math.abs(p.x) > SAFE.side || p.y > SAFE.top || p.y < SAFE.bottom) return false;
               if (p.x < joyX && p.y < joyY) return false;
            }
         }
      }
      return true;
   };

   let best: View = { yaw: 0, offset: [0, 20, 14] };
   let bestDistance = Infinity;
   for (const yaw of [0, Math.PI / 2]) {
      // binary search for the closest distance that still fits
      let near = 4;
      let far = 250;
      for (let i = 0; i < 28; i++) {
         const mid = (near + far) / 2;
         if (fits(yaw, mid)) far = mid;
         else near = mid;
      }
      if (far < bestDistance) {
         bestDistance = far;
         const flat = Math.cos(PITCH) * far;
         best = { yaw, offset: [Math.sin(yaw) * flat, Math.sin(PITCH) * far, Math.cos(yaw) * flat] };
      }
   }
   return best;
}

/** env(safe-area-inset-left / -bottom) in px, read from a hidden probe (0 without a notch). */
function safeAreaInsets(): { left: number; bottom: number } {
   if (typeof document === "undefined") return { left: 0, bottom: 0 };
   const probe = document.createElement("div");
   probe.style.cssText =
      "position:fixed;visibility:hidden;pointer-events:none;" +
      "padding-left:env(safe-area-inset-left,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
   document.body.appendChild(probe);
   const style = getComputedStyle(probe);
   const insets = { left: parseFloat(style.paddingLeft) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
   probe.remove();
   return insets;
}

/** The fitted view for the current canvas size; recomputed on resize and rotation. */
export function useWarehouseView(): View {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const camera = useThree((state) => state.camera);
   const coarse = useCoarsePointer();
   const fov = camera instanceof PerspectiveCamera ? camera.fov : 45;
   return useMemo(() => {
      // the joystick only shows on touch screens (TouchControls), in the bottom-left corner
      const insets = coarse ? safeAreaInsets() : null;
      const joystick = insets && { right: JOYSTICK_PX + insets.left, top: JOYSTICK_PX + insets.bottom };
      return fitView(width, height, fov, joystick);
   }, [width, height, fov, coarse]);
}
