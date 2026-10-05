"use client";

// Camera placement for a game. GameShell renders one with definition.camera (static camera).
// A game that needs a follow camera renders its own inside Scene:
//
//    <CameraRig camera={definition.camera} follow={robotRef} />
//    <CameraRig camera={camera} follow={run.player} followFraction={0.2} bounds={LEVEL} offset={view.offset} />
//
// The camera keeps the offset between camera.position and .lookAt (or `offset`) relative to the
// point it looks at, and eases towards it (frame-rate independent):
// - follow: an Object3D ref, or a plain {x, y, z} read every frame (e.g. the simulation's player
//   state, which useRunFrame has already updated this frame, so the camera is never a frame late);
// - followFraction: look only part of the way from camera.lookAt towards the target, so the view
//   drifts gently with the player while the arena stays in frame (useFittedView `focus`);
// - bounds: the look-at point never leaves this box (the view stops at the level's edges).
// A follow camera is placed at its target on mount; later config changes (resize, a new fitted
// offset) are eased into instead of jumping.
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, type Object3D } from "three";
import type { GameDefinition } from "./types";
import type { AABB, Vec3Like } from "./collision";

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
}

const ORIGIN: [number, number, number] = [0, 0, 0];

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

export default function CameraRig({ camera: config, follow, damping = 5, offset, followFraction = 1, bounds }: CameraRigProps) {
   const camera = useThree((state) => state.camera);
   const [px, py, pz] = config.position;
   const [lx, ly, lz] = config.lookAt ?? ORIGIN;
   const fov = config.fov;
   const placed = useRef(false);

   // scratch vectors, allocated once
   const scratch = useMemo(
      () => ({ offset: new Vector3(), target: new Vector3(), look: new Vector3(), desired: new Vector3() }),
      []
   );

   /** The point to look at this frame (false = nothing to follow yet). */
   const aim = (out: Vector3): boolean => {
      if (!follow) return false;
      if ("current" in follow) {
         if (!follow.current) return false;
         follow.current.getWorldPosition(out);
      } else {
         out.set(follow.x, follow.y, follow.z);
      }
      if (followFraction !== 1) out.set(lx + (out.x - lx) * followFraction, ly + (out.y - ly) * followFraction, lz + (out.z - lz) * followFraction);
      if (bounds) {
         out.set(clamp(out.x, bounds.min.x, bounds.max.x), clamp(out.y, bounds.min.y, bounds.max.y), clamp(out.z, bounds.min.z, bounds.max.z));
      }
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

   useFrame((_state, delta) => {
      if (!aim(scratch.target)) return;
      offsetOf(scratch.offset);
      scratch.desired.copy(scratch.target).add(scratch.offset);
      const t = 1 - Math.exp(-damping * Math.min(delta, 0.1));
      camera.position.lerp(scratch.desired, t);
      scratch.look.lerp(scratch.target, t);
      camera.lookAt(scratch.look);
   });

   return null;
}
