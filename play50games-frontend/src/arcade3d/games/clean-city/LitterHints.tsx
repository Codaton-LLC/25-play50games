"use client";

// Off-screen litter hints (README "Scene and camera", "Phones"). On a phone the camera frames a
// window around the cleaner, so most of the floor is off screen: a small green arrow at the screen's
// edge points to each of the MAX_HINTS nearest pieces that are not on screen (off the canvas, or
// under the HUD, a touch control or the cookie banner), the nearest one a little bigger. The arrow
// stands where the line from the cleaner towards the piece meets the screen's edge, moved out from
// under the HUD, the controls and the banner (core useSafeArea). On desktop the whole floor is in
// view, so none shows.
// - Where they stand is pure (hints.ts updateHints, tested in hints.test.ts); this file projects
//   with the live camera and draws.
// - Drawn in the scene: two <DynamicInstanced> pools (a dark outline, the green fill), placed every
//   frame just in front of the camera at the arrow's screen point, facing it, sized in px. No depth
//   test, so nothing hides them.
// - The frame loop allocates nothing: module scratch, the hint state's typed arrays.
// - Runs after CameraRig (-0.25) at -0.2, so it projects with this frame's camera; the pools draw at
//   FRAME_PRIORITY.visuals (0) from what it wrote.
import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Quaternion, Shape, Vector3, type Camera, type Matrix4 } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { ScreenRect } from "@/arcade3d/core/view";
import { HINT_FAR_SCALE, HINT_PX, MAX_HINTS, createHintState, updateHints, type Point2, type Projector } from "./hints";
import { RUNNER_RING } from "./Primitives";
import type { CleanRun } from "./rules";

/** View depth the arrows are drawn at (past the camera's 0.1 near plane). */
const DRAW_DEPTH = 2;
/** The fill arrow's length in its own units (arrowShape(1)). */
const ARROW_LENGTH = 1.6;

const V = new Vector3();
const P = new Vector3();
const Q = new Quaternion();
const TURN = new Quaternion();
const S = new Vector3();
const VIEW_Z = new Vector3(0, 0, 1);

/** A chevron arrow pointing along +x, ARROW_LENGTH x grow long, centred on its middle (plain data: R3F builds and frees the geometry). */
function arrowShape(grow: number): Shape {
   const s = new Shape();
   s.moveTo(0.8 * grow, 0);
   s.lineTo(-0.8 * grow, 0.72 * grow);
   s.lineTo(-0.4 * grow, 0);
   s.lineTo(-0.8 * grow, -0.72 * grow);
   s.closePath();
   return s;
}

const FILL_SHAPE = arrowShape(1);
const OUTLINE_SHAPE = arrowShape(1.32);

export default function LitterHints({ run }: { run: CleanRun }) {
   const camera = useThree((state) => state.camera);
   const size = useThree((state) => state.size);
   const time = useGameTime();
   const safe = useSafeArea();
   const covers = useMemo<ScreenRect[]>(() => [...safe.hud, ...safe.controls, ...(safe.obstructions ?? [])], [safe]);
   const live = useRef<{ camera: Camera; width: number; height: number; covers: ScreenRect[] }>({ camera, width: 0, height: 0, covers });
   live.current.camera = camera;
   live.current.width = size.width;
   live.current.height = size.height;
   live.current.covers = covers;
   const [hints] = useState(createHintState);
   // one projector per mount: the live camera and canvas size from the ref
   const project = useMemo<Projector>(
      () => (x: number, y: number, z: number, out: Point2) => {
         const { camera: cam, width, height } = live.current;
         V.set(x, y, z).project(cam);
         out.x = ((V.x + 1) / 2) * width;
         out.y = ((1 - V.y) / 2) * height;
         return V.z;
      },
      []
   );

   useFrame(() => {
      hints.count = 0;
      const phase = useArcadeStore.getState().phase;
      if (phase !== "playing" && phase !== "countdown" && phase !== "paused") return;
      const { camera: cam, width, height, covers: list } = live.current;
      // the rig moved the camera this frame (-0.25); its world matrix is updated at render
      cam.updateMatrixWorld();
      updateHints(hints, run.runner, run.litter, project, width, height, list);
   }, -0.2);

   /** Arrow `i` (both pools): at its screen point, DRAW_DEPTH in front of the camera, facing it, sized in px. */
   const placeArrow = (i: number, m: Matrix4) => {
      if (i >= hints.count || !(camera instanceof PerspectiveCamera) || size.height <= 0) return false;
      const e = camera.projectionMatrix.elements;
      // NDC z of the view depth DRAW_DEPTH (perspective: clip w = depth)
      const ndcZ = (-e[10] * DRAW_DEPTH + e[14]) / DRAW_DEPTH;
      P.set((hints.x[i] / size.width) * 2 - 1, 1 - (hints.y[i] / size.height) * 2, ndcZ).unproject(camera);
      const pulse = 1 + 0.08 * Math.sin(time.now * 6);
      const px = HINT_PX * (i === 0 ? 1 : HINT_FAR_SCALE) * pulse;
      // world units per CSS px at that depth (the lens shift keeps the full size)
      const unit = ((2 * DRAW_DEPTH * Math.tan((camera.fov * Math.PI) / 360)) / size.height / camera.zoom) * (px / ARROW_LENGTH);
      Q.copy(camera.quaternion).multiply(TURN.setFromAxisAngle(VIEW_Z, hints.angle[i]));
      S.set(unit, unit, unit);
      m.compose(P, Q, S);
   };

   return (
      <group name="litter-hints">
         <group renderOrder={20}>
            <DynamicInstanced count={MAX_HINTS} update={placeArrow} name="litter-hint-outline">
               <shapeGeometry args={[OUTLINE_SHAPE]} />
               <meshBasicMaterial color="#0b1020" transparent opacity={0.8} depthTest={false} depthWrite={false} fog={false} />
            </DynamicInstanced>
         </group>
         <group renderOrder={21}>
            <DynamicInstanced count={MAX_HINTS} update={placeArrow} name="litter-hint-fill">
               <shapeGeometry args={[FILL_SHAPE]} />
               <meshBasicMaterial color={RUNNER_RING} transparent opacity={0.95} depthTest={false} depthWrite={false} fog={false} />
            </DynamicInstanced>
         </group>
      </group>
   );
}
