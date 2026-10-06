"use client";

// Camera placement for a game. GameShell renders one with definition.camera (static camera).
// A game that needs a follow camera renders its own inside Scene:
//
//    <CameraRig camera={definition.camera} follow={robotRef} />
//    <CameraRig camera={camera} follow={run.player} followFraction={0.2} bounds={LEVEL} offset={view.offset} shift={view.shift} />
//
// The camera keeps the offset between camera.position and .lookAt (or `offset`) relative to the
// point it looks at, and eases towards it (frame-rate independent):
// - follow: an Object3D ref, or a plain {x, y, z} read every frame (e.g. the simulation's player
//   state, which useRunFrame has already updated this frame, so the camera is never a frame late);
// - followFraction: look only part of the way from camera.lookAt towards the target, so the view
//   drifts gently with the player while the arena stays in frame (useFittedView `focus`);
// - bounds: the look-at point never leaves this box (the view stops at the level's edges).
//   useFittedView's `focus` must cover the same range: build both from one followFocus() call's
//   inputs (core/view.ts);
// - shift: useFittedView's lens shift (moves the picture on screen, e.g. above a lifted joystick).
// A follow camera is placed at its target on mount; later config changes (resize, a new fitted
// offset or shift) are eased into instead of jumping. The rig moves the camera at
// FRAME_PRIORITY.camera: after useRunFrame, before every plain useFrame.
// The lens shift survives Scene remounts (start, retry, restart remount the Scene and its rig):
// the outgoing rig clears the lens in a layout cleanup, in the commit that mounts the new rig and
// before its first frame, and every frame a rig checks that the camera still draws with its shift
// (stepLensShift), so a clear that lands after the new rig's first write is undone before the
// next frame is drawn.
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, type Object3D } from "three";
import type { GameDefinition } from "./types";
import type { AABB, Vec3Like } from "./collision";
import { FRAME_PRIORITY } from "./frameLoop";
import { clearLensShift, followAim, stepLensShift, type LensState } from "./view";

export interface CameraRigProps {
   camera: GameDefinition["camera"];
   /** what to follow: an object ref, or a live point read every frame; omit for a static camera */
   follow?: RefObject<Object3D | null> | Vec3Like;
   /** follow speed (1/s); higher = snappier. Default 5 */
   damping?: number;
   /** camera offset from the point it looks at; default camera.position - camera.lookAt */
   offset?: [number, number, number];
   /** 0..1: look this fraction of the way from camera.lookAt to the target. Default 1 */
   followFraction?: number;
   /** keeps the point the camera looks at inside this box */
   bounds?: AABB;
   /**
    * Lens shift from useFittedView (`view.shift`; NDC, x right, y up, 2 = the canvas): moves the
    * whole picture on screen without turning the camera. Set on the first frame, eased with
    * `damping` afterwards, set again whenever the camera stops drawing with it (another rig
    * cleared it), and removed when the rig unmounts or `shift` goes away. Omit it to leave the
    * lens alone.
    */
   shift?: readonly [number, number];
}

const ORIGIN: [number, number, number] = [0, 0, 0];

export default function CameraRig({ camera: config, follow, damping = 5, offset, followFraction = 1, bounds, shift }: CameraRigProps) {
   const camera = useThree((state) => state.camera);
   const [px, py, pz] = config.position;
   const lookAt = config.lookAt ?? ORIGIN;
   const [lx, ly, lz] = lookAt;
   const fov = config.fov;
   const placed = useRef(false);

   // scratch vectors and the applied lens shift, allocated once
   const scratch = useMemo(
      () => ({ offset: new Vector3(), target: new Vector3(), look: new Vector3(), desired: new Vector3() }),
      []
   );
   const lens = useMemo<LensState>(() => ({ x: 0, y: 0, set: false }), []);
   const managesLens = shift !== undefined;

   /** The point to look at this frame (false = nothing to follow yet). */
   const aim = (out: Vector3): boolean => {
      if (!follow) return false;
      if ("current" in follow) {
         if (!follow.current) return false;
         follow.current.getWorldPosition(out);
      } else {
         out.set(follow.x, follow.y, follow.z);
      }
      // the same math as followFocus, so useFittedView's focus covers every point aimed at
      followAim(out, lookAt, followFraction, bounds, out);
      return true;
   };
   const offsetOf = (out: Vector3) => (offset ? out.set(offset[0], offset[1], offset[2]) : out.set(px - lx, py - ly, pz - lz));

   // place the camera when the config changes; a follow camera only snaps the first time
   useEffect(() => {
      if (fov && camera instanceof PerspectiveCamera) {
         camera.fov = fov;
         camera.updateProjectionMatrix();
      }
      if (follow && placed.current) return;
      if (follow && aim(scratch.target)) {
         camera.position.copy(scratch.target).add(offsetOf(scratch.offset));
         scratch.look.copy(scratch.target);
         camera.lookAt(scratch.look);
         placed.current = true;
         return;
      }
      camera.position.set(px, py, pz);
      camera.lookAt(lx, ly, lz);
      scratch.look.set(lx, ly, lz);
      // aim/offsetOf read the same props listed here
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [camera, px, py, pz, lx, ly, lz, fov, scratch, follow, offset?.[0], offset?.[1], offset?.[2]]);

   // the lens shift belongs to this rig only while it has a `shift`. A layout cleanup: on a Scene
   // remount it runs in the commit that mounts the next rig, before that rig's first frame. A
   // passive one waits for React's deferred passive flush when the remount is not a discrete-event
   // commit, and a frame can run first: the new rig wrote its shift, then the old rig cleared it
   // (stepLensShift now writes it again on the next frame either way)
   useLayoutEffect(() => {
      if (!managesLens) return;
      return () => {
         if (camera instanceof PerspectiveCamera) clearLensShift(camera, lens);
      };
   }, [camera, managesLens, lens]);

   // after the simulation, before every visual (FRAME_PRIORITY.camera), so billboards, screen
   // projections and raycasts in plain useFrame callbacks see this frame's camera
   useFrame((state, delta) => {
      const t = 1 - Math.exp(-damping * Math.min(delta, 0.1));
      // writes only when the shift eases, the canvas resizes or the camera lost it (a remount)
      if (shift && camera instanceof PerspectiveCamera) {
         stepLensShift(camera, lens, shift[0], shift[1], state.size.width, state.size.height, t);
      }
      if (!aim(scratch.target)) return;
      offsetOf(scratch.offset);
      scratch.desired.copy(scratch.target).add(scratch.offset);
      camera.position.lerp(scratch.desired, t);
      scratch.look.lerp(scratch.target, t);
      camera.lookAt(scratch.look);
   }, FRAME_PRIORITY.camera);

   return null;
}
