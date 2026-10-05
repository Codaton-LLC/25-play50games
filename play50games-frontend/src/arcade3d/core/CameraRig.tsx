"use client";

// Camera placement for a game. GameShell renders one with definition.camera (static camera).
// A game that needs a follow camera renders its own inside Scene:
//
//    <CameraRig camera={definition.camera} follow={robotRef} />
//
// The camera keeps the offset between definition.camera.position and .lookAt relative to the
// followed object, and eases towards it (frame-rate independent).
import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, type Object3D } from "three";
import type { GameDefinition } from "./types";

export interface CameraRigProps {
   camera: GameDefinition["camera"];
   /** object to follow; omit for a static camera */
   follow?: RefObject<Object3D | null>;
   /** follow speed (1/s); higher = snappier. Default 5 */
   damping?: number;
   /** camera offset from the followed object; default camera.position - camera.lookAt */
   offset?: [number, number, number];
}

const ORIGIN: [number, number, number] = [0, 0, 0];

export default function CameraRig({ camera: config, follow, damping = 5, offset }: CameraRigProps) {
   const camera = useThree((state) => state.camera);
   const [px, py, pz] = config.position;
   const [lx, ly, lz] = config.lookAt ?? ORIGIN;
   const fov = config.fov;

   // scratch vectors, allocated once
   const scratch = useMemo(
      () => ({ offset: new Vector3(), target: new Vector3(), look: new Vector3(), desired: new Vector3() }),
      []
   );

   // place the camera when the config changes
   useEffect(() => {
      camera.position.set(px, py, pz);
      if (fov && camera instanceof PerspectiveCamera) {
         camera.fov = fov;
         camera.updateProjectionMatrix();
      }
      camera.lookAt(lx, ly, lz);
      scratch.look.set(lx, ly, lz);
   }, [camera, px, py, pz, lx, ly, lz, fov, scratch]);

   useFrame((_state, delta) => {
      const target = follow?.current;
      if (!target) return;
      if (offset) scratch.offset.set(offset[0], offset[1], offset[2]);
      else scratch.offset.set(px - lx, py - ly, pz - lz);

      target.getWorldPosition(scratch.target);
      scratch.desired.copy(scratch.target).add(scratch.offset);
      const t = 1 - Math.exp(-damping * Math.min(delta, 0.1));
      camera.position.lerp(scratch.desired, t);
      scratch.look.lerp(scratch.target, t);
      camera.lookAt(scratch.look);
   });

   return null;
}
