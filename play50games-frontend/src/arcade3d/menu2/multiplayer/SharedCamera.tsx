"use client";

// One camera that keeps every active hero framed (framing.ts). useFittedView fits the reference
// cube once per canvas size / safe area (so the HUD, the player chips and the cookie banner are
// avoided as in every core camera); each frame scales that fit to the heroes' frame and eases
// the camera there. Mount it once inside a multiplayer Scene instead of the solo follow camera:
//
//    const points = useMemo(() => runs.map((r) => r.hero), [runs]);   // live {x,y,z} feet
//    <SharedCamera points={points} active={() => runs.map(...)} pitch={0.45} maxSpan={26} anchor={leader} />
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import type { Vec3Like } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import type { ScreenMargin } from "@/arcade3d/core/view";
import { REF_BOX, createFraming, frameHeroes, sharedCameraPose, type CameraPose, type Framing, type FramingOptions } from "./framing";

export interface SharedCameraProps extends Omit<FramingOptions, "anchor"> {
   /** the heroes' live feet positions (read every frame, never copied) */
   points: readonly Vec3Like[];
   /** per point: still framed (default all); read every frame */
   active?: () => readonly boolean[] | undefined;
   /** the anchor when the zoom limit holds: "centroid" or a hero index; read every frame */
   anchor?: () => FramingOptions["anchor"];
   /** camera tilt above the ground (rad). Default 0.45 */
   pitch?: number;
   /** camera yaw (rad, 0 = looking towards -z). Default 0 */
   yaw?: number;
   /** the canvas camera's fov, if the scene changes it */
   fov?: number;
   margin?: ScreenMargin;
   /** easing rates (1/s) of the position and the look point. Default 3.5 and 5 */
   damping?: number;
   lookDamping?: number;
   /** called after each frame's framing (e.g. off-screen arrows) */
   onFrame?: (framing: Readonly<Framing>) => void;
}

const DEFAULT_MARGIN: ScreenMargin = { top: 0.08, bottom: 0.06, left: 0.05, right: 0.05 };

export function SharedCamera({
   points,
   active,
   anchor,
   pitch = 0.45,
   yaw = 0,
   fov,
   margin = DEFAULT_MARGIN,
   damping = 3.5,
   lookDamping = 5,
   onFrame,
   minSpan,
   maxSpan,
   padding,
   heroHeight,
}: SharedCameraProps) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const yaws = useMemo(() => [yaw], [yaw]);
   const view = useFittedView({ area: REF_BOX, pitch, yaws, margin, fov });
   const framing = useMemo(createFraming, []);
   const goal = useMemo<CameraPose>(() => ({ px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 }), []);
   const look = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const placed = useRef(false);
   const options = useMemo<FramingOptions>(() => ({ minSpan, maxSpan, padding, heroHeight }), [minSpan, maxSpan, padding, heroHeight]);

   useFrame((_state, delta) => {
      options.anchor = anchor?.() ?? "centroid";
      frameHeroes(points, active?.(), options, framing);
      if (framing.count === 0 && !placed.current) return;
      sharedCameraPose(framing, view.offset, goal);
      const dt = Math.min(0.1, delta);
      const kp = placed.current ? 1 - Math.exp(-damping * dt) : 1;
      const kl = placed.current ? 1 - Math.exp(-lookDamping * dt) : 1;
      placed.current = true;
      camera.position.x += (goal.px - camera.position.x) * kp;
      camera.position.y += (goal.py - camera.position.y) * kp;
      camera.position.z += (goal.pz - camera.position.z) * kp;
      look.x += (goal.lx - look.x) * kl;
      look.y += (goal.ly - look.y) * kl;
      look.z += (goal.lz - look.z) * kl;
      camera.lookAt(look.x, look.y, look.z);
      onFrame?.(framing);
   }, FRAME_PRIORITY.camera);
   return null;
}
