"use client";

// <ChaseRig target={run.vehicle} options={...} ground={heightAt} />: the canvas camera behind a
// vehicle's heading (pure math in chaseCamera.ts). Render it inside the Scene instead of a CameraRig.
// - target is read every frame (a live { x, y, z, yaw }, e.g. the rules' rover, already stepped this
//   frame by useRunFrame); yawOffset (a live { value }) swings the camera round it, e.g. a slow orbit
//   on a win.
// - On a portrait screen the lens widens (chaseFov) and the camera pulls back (portraitPullback).
// - Runs at FRAME_PRIORITY.camera (after the simulation, before every visual), so fx.shake, billboards
//   and TargetMarkers see this frame's camera. It clears any lens shift a previous rig left behind.
import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { chaseFov, createChaseState, portraitPullback, stepChase, type ChaseOptions, type ChaseTarget } from "./chaseCamera";
import { FRAME_PRIORITY } from "./frameLoop";

export interface ChaseRigProps {
   target: ChaseTarget;
   options: ChaseOptions;
   /** terrain height under a point (the camera stays `options.clearance` above it) */
   ground?: (x: number, z: number) => number;
   /** a live extra heading (radians) added to the target's, e.g. an orbit on a win */
   yawOffset?: { value: number };
   /** landscape vertical fov (degrees). Default 55 */
   fov?: number;
   /** the least horizontal fov kept on a portrait screen (degrees). Default 62 */
   minHorizontalFov?: number;
   /** the widest vertical fov (degrees). Default 75 */
   maxFov?: number;
}

export default function ChaseRig({ target, options, ground, yawOffset, fov = 55, minHorizontalFov = 62, maxFov = 75 }: ChaseRigProps) {
   const camera = useThree((s) => s.camera);
   const size = useThree((s) => s.size);
   const state = useMemo(createChaseState, []);
   const scaled = useMemo<ChaseOptions>(() => ({ ...options }), [options]);

   useLayoutEffect(() => {
      if (camera instanceof PerspectiveCamera) {
         camera.clearViewOffset();
         camera.updateProjectionMatrix();
      }
   }, [camera]);

   useFrame((_s, delta) => {
      const aspect = size.width / Math.max(1, size.height);
      const pull = portraitPullback(aspect);
      scaled.distance = options.distance * pull;
      scaled.height = options.height * pull;
      stepChase(state, target, scaled, Math.min(delta, 0.1), ground, yawOffset?.value ?? 0);
      if (camera instanceof PerspectiveCamera) {
         const want = chaseFov(aspect, fov, minHorizontalFov, maxFov);
         if (Math.abs(camera.fov - want) > 0.01) {
            camera.fov = want;
            camera.updateProjectionMatrix();
         }
         if (camera.view?.enabled) {
            camera.clearViewOffset();
            camera.updateProjectionMatrix();
         }
      }
      camera.position.set(state.x, state.y, state.z);
      camera.lookAt(state.lookX, state.lookY, state.lookZ);
   }, FRAME_PRIORITY.camera);

   return null;
}
