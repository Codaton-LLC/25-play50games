"use client";

import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Fog, Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { bank } from "@/arcade3d/core/motion";
import type { FittedView } from "@/arcade3d/core/view";
import type { Run } from "./rules";

export const VIEW = {
   area: { min: { x: -5, y: 0, z: -32 }, max: { x: 5, y: 4, z: 4 } },
   pitch: 25 * Math.PI / 180, yaws: [0], focus: [{ x: 0, y: 0, z: -10 }],
   padding: 2, margin: { top: 0.11, bottom: 0.08, left: 0.03, right: 0.03 }, shift: true, fov: 50,
};

export function useReducedMotion(): boolean {
   const [reduced, setReduced] = useState(false);
   useEffect(() => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduced(media.matches);
      update(); media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
   }, []);
   return reduced;
}

export function ChaseCamera({ run, reduced, view }: { run: Run; reduced: boolean; view: FittedView }) {
   const camera = useThree((s) => s.camera);
   const scene = useThree((s) => s.scene);
   const time = useGameTime();
   const scratch = useMemo(() => ({ desired: new Vector3(), focus: new Vector3(0, 0, -10), up: new Vector3(), forward: new Vector3(), placed: false }), []);
   const config = useMemo(() => ({ position: [view.offset[0], view.offset[1], view.offset[2] - 10] as [number, number, number], lookAt: [0, 0, -10] as [number, number, number], fov: 50 }), [view.offset]);
   useEffect(() => { scratch.placed = false; }, [config, scratch]);
   useFrame(() => {
      const factor = reduced ? 1 : 1 + 0.2 * run.speed / 22;
      scratch.desired.set(view.offset[0] * factor, view.offset[1] * factor, -10 + view.offset[2] * factor);
      if (!scratch.placed) { camera.position.copy(scratch.desired); scratch.placed = true; }
      else camera.position.lerp(scratch.desired, 1 - Math.exp(-6 * time.delta));
      const roll = reduced ? 0 : bank(run.steer * 2, 3 * Math.PI / 180);
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.lookAt(scratch.focus);
      if (scene.fog instanceof Fog) {
         // Linear fog uses view-space depth. Offset after fitting and pullback.
         scratch.forward.copy(scratch.focus).sub(camera.position).normalize();
         const d = -camera.position.dot(scratch.forward);
         scene.fog.near = d + 22;
         scene.fog.far = d + 46;
      }
   }, FRAME_PRIORITY.camera);
   return <CameraRig camera={config} offset={view.offset} shift={view.shift} />;
}
