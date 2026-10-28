"use client";

// A first-person, fixed-eye camera: the camera sits at `position` and faces `yaw` (tilted by
// `pitch`). It never moves back to fit; a band that must stay on screen is kept clear of the HUD
// and the controls by a lens shift instead (useEyeShift -> `shift`). Render it inside the Scene:
//
//    const eye = useEyeShift({ fov: 70, eyeY: 1.6, band: BAND, padding: 8 });
//    <EyeRig position={EYE} yaw={guardYaw} fov={70} shift={eye.shift} turnRate={4} />
//
// - position: a tuple, or a ref to a live {x, y, z} read every frame (the simulation's state);
//   yaw / pitch / roll / fov: numbers or refs read every frame (roll only when given). yaw is a facing like inViewCone / Flashlight
//   (0 = looks along +z, positive turns towards +x); positive pitch looks down. The rotation is
//   written directly (setEyeRotation, Euler "YXZ"), never with lookAt, so it rolls only by `roll`.
// - turnRate (rad/s): turn towards `yaw` the short way round at most this fast (stepEyeYaw);
//   omitted = face `yaw` at once. shiftRate (1/s, default 8): eases a new `shift` in; the first
//   write snaps.
// - The mount layout effect writes the first pose at once (no frame drawn from definition.camera);
//   every frame after that runs at FRAME_PRIORITY.camera, after useRunFrame. The shell's static
//   CameraRig writes the camera only in its mount (and config-change) effect, so this rig owns it
//   from the first frame; a fov the shell set is put back on the next frame too.
// - The lens shift is this rig's only while it has a `shift`; it clears it in a layout cleanup
//   and checks it every frame (stepLensShift), like CameraRig, so it survives Scene remounts.
// - No allocation per frame.
import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import type { Vec3Like } from "./collision";
import { FRAME_PRIORITY } from "./frameLoop";
import { clearLensShift, setEyeRotation, stepEyeYaw, stepLensShift, type LensState } from "./view";

export interface EyeRigProps {
   /** the eye in world space: a fixed tuple, or a ref to a live point read every frame */
   position: readonly [number, number, number] | { current: Vec3Like };
   /** facing, radians: 0 = looks along +z, positive turns towards +x (inViewCone, Flashlight) */
   yaw: number | { current: number };
   /** look down by this much, radians. Default 0 */
   pitch?: number | { current: number };
   /** vertical fov in degrees, or a ref read every frame (a boost's fov kick); omitted = leave the camera's fov alone */
   fov?: number | { current: number };
   /**
    * Roll about the view axis, radians (positive tips the picture's top to the left), a number or a ref
    * read every frame: a flight camera leaning into its turns. Default 0 = never rolls.
    */
   roll?: number | { current: number };
   /** lens shift (NDC, x right, y up) from useEyeShift; omit to leave the lens alone */
   shift?: readonly [number, number];
   /** how fast a new shift eases in, 1/s. Default 8 (the first write snaps) */
   shiftRate?: number;
   /** max turn speed towards `yaw`, rad/s, the short way round; omitted = copy yaw */
   turnRate?: number;
}

const read = (value: number | { current: number } | undefined, fallback: number) =>
   value === undefined ? fallback : typeof value === "number" ? value : value.current;

export function EyeRig({ position, yaw, pitch, fov, roll, shift, shiftRate = 8, turnRate }: EyeRigProps): null {
   const camera = useThree((state) => state.camera);
   const get = useThree((state) => state.get);
   const pose = useMemo(() => ({ yaw: 0 }), []);
   const lens = useMemo<LensState>(() => ({ x: 0, y: 0, set: false }), []);
   const managesLens = shift !== undefined;

   /** Writes the eye's pose; `dt` 0 with snap = face the target at once. */
   const place = (dt: number, snap: boolean) => {
      if ("current" in position) camera.position.set(position.current.x, position.current.y, position.current.z);
      else camera.position.set(position[0], position[1], position[2]);
      const target = read(yaw, 0);
      pose.yaw = snap ? target : stepEyeYaw(pose.yaw, target, turnRate, dt);
      setEyeRotation(camera.rotation, pose.yaw, read(pitch, 0));
      if (roll !== undefined) camera.rotation.z = read(roll, 0);
      const f = fov === undefined ? undefined : read(fov, 0);
      if (f !== undefined && camera instanceof PerspectiveCamera && Math.abs(camera.fov - f) > 1e-3) {
         camera.fov = f;
         camera.updateProjectionMatrix();
      }
   };

   // the first pose (and shift) before anything is drawn
   useLayoutEffect(() => {
      place(0, true);
      if (shift && camera instanceof PerspectiveCamera) {
         const { size } = get();
         stepLensShift(camera, lens, shift[0], shift[1], size.width, size.height, 1);
      }
      // only on mount / a new camera: later prop changes are eased in by the frame callback
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [camera]);

   // the lens belongs to this rig only while it has a `shift` (a layout cleanup, as in CameraRig)
   useLayoutEffect(() => {
      if (!managesLens) return;
      return () => {
         if (camera instanceof PerspectiveCamera) clearLensShift(camera, lens);
      };
   }, [camera, managesLens, lens]);

   useFrame((state, delta) => {
      const dt = Math.min(delta, 0.1);
      place(dt, false);
      if (shift && camera instanceof PerspectiveCamera) {
         stepLensShift(camera, lens, shift[0], shift[1], state.size.width, state.size.height, 1 - Math.exp(-shiftRate * dt));
      }
   }, FRAME_PRIORITY.camera);

   return null;
}

export default EyeRig;
