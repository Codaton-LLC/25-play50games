"use client";

// Arrows at the screen edge pointing to world targets that are off screen (a delivery address, a
// lost chest), kept clear of the HUD, the touch controls and the cookie banner (useSafeArea). Render
// it inside the Scene: it projects with the scene's camera every frame and moves plain DOM arrows
// over the canvas (no React render per frame).
//
//    const DROPS = run.drops;                      // objects with x, y, z (mutated by the game)
//    <TargetMarkers targets={DROPS} color="#fbbf24" />
//
// - `targets` are read every frame (move them in place); `hidden: true` skips one. Keep the array's
//   length fixed (a change rebuilds the arrows).
// - A target on screen (inside the marker bounds) has no arrow; placement is the pure
//   placeMarker / markerBounds (hud/markerPlacement.ts).
// - Arrows only show while the run is playing or paused (not on the start card or the result).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { FRAME_PRIORITY } from "../frameLoop";
import { useSafeArea } from "../safeArea";
import { useArcadeStore } from "../useArcadeStore";
import { MARKER_MARGIN, markerBounds, placeMarker, type MarkerPlacement } from "./markerPlacement";

export interface MarkerTarget {
   x: number;
   y: number;
   z: number;
   /** skip this target (picked up, inactive) */
   hidden?: boolean;
   /** this arrow's colour (default: the component's) */
   color?: string;
}

export interface TargetMarkersProps {
   targets: readonly MarkerTarget[];
   color?: string;
   /** arrow size, CSS px (default 30) */
   size?: number;
   /** gap to the edges and covered bands, CSS px (default MARKER_MARGIN) */
   margin?: number;
}

const ARROW_SVG =
   '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M4 4 L21 12 L4 20 L8 12 Z" fill="currentColor" stroke="rgba(2,6,23,0.75)" stroke-width="1.5" stroke-linejoin="round"/></svg>';

export function TargetMarkers({ targets, color = "#fbbf24", size = 30, margin = MARKER_MARGIN }: TargetMarkersProps) {
   const gl = useThree((state) => state.gl);
   const camera = useThree((state) => state.camera);
   const canvasSize = useThree((state) => state.size);
   const area = useSafeArea();
   const shown = useArcadeStore((s) => s.phase === "playing" || s.phase === "paused");
   const bounds = useMemo(
      () => markerBounds({ ...area, width: canvasSize.width, height: canvasSize.height }, margin),
      [area, canvasSize.width, canvasSize.height, margin]
   );
   const count = targets.length;

   // the overlay and one arrow per target, made once (per count) and moved every frame
   const dom = useMemo(() => {
      if (typeof document === "undefined") return null;
      const layer = document.createElement("div");
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
      const arrows: HTMLDivElement[] = [];
      for (let i = 0; i < count; i++) {
         const arrow = document.createElement("div");
         arrow.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;display:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));will-change:transform;`;
         arrow.innerHTML = ARROW_SVG;
         layer.appendChild(arrow);
         arrows.push(arrow);
      }
      return { layer, arrows, last: arrows.map(() => ({ x: NaN, y: NaN, a: NaN, color: "" })) };
   }, [count, size]);

   useEffect(() => {
      const host = gl.domElement.parentElement;
      if (!dom || !host) return;
      host.appendChild(dom.layer);
      return () => dom.layer.remove();
   }, [gl, dom]);

   const live = useRef({ targets, color, bounds, shown });
   live.current = { targets, color, bounds, shown };
   const scratch = useMemo(() => ({ v: new Vector3(), place: { visible: false, x: 0, y: 0, angle: 0 } as MarkerPlacement }), []);

   useFrame(() => {
      if (!dom) return;
      const { targets: list, color: base, bounds: b, shown: on } = live.current;
      const { v, place } = scratch;
      const w = canvasSize.width;
      const h = canvasSize.height;
      // this frame's camera (CameraRig moved it at FRAME_PRIORITY.camera)
      camera.updateMatrixWorld();
      for (let i = 0; i < dom.arrows.length; i++) {
         const arrow = dom.arrows[i];
         const target = list[i];
         const last = dom.last[i];
         let visible = false;
         if (on && target && !target.hidden) {
            // behind = in front of the camera's near plane in view space (view space looks down -z)
            v.set(target.x, target.y, target.z).applyMatrix4(camera.matrixWorldInverse);
            const behind = v.z > 0;
            v.applyMatrix4(camera.projectionMatrix);
            placeMarker(v.x, v.y, behind, w, h, b, place);
            visible = place.visible;
         }
         if (!visible) {
            if (arrow.style.display !== "none") arrow.style.display = "none";
            continue;
         }
         if (arrow.style.display !== "block") arrow.style.display = "block";
         const x = Math.round(place.x);
         const y = Math.round(place.y);
         const a = Math.round(place.angle * 100) / 100;
         if (x !== last.x || y !== last.y || a !== last.a) {
            arrow.style.transform = `translate(${x}px,${y}px) rotate(${a}rad)`;
            last.x = x;
            last.y = y;
            last.a = a;
         }
         const c = target!.color ?? base;
         if (c !== last.color) {
            arrow.style.color = c;
            last.color = c;
         }
      }
   }, FRAME_PRIORITY.visuals);

   return null;
}
