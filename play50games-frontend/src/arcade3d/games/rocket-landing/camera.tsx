"use client";
import { useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { setLensShift } from "@/arcade3d/core/view";
import { fitRocketView, rocketBox } from "./cameraMath";
import type { Run } from "./rules";

export default function RocketCamera({ run }: { run: Run }) {
   const safe = useSafeArea(), camera = useThree((s) => s.camera);
   const size = useThree((s) => s.size);
   const avoid = [...safe.hud, ...safe.controls, ...safe.obstructions];
   useLayoutEffect(() => () => {
      if (camera instanceof PerspectiveCamera) camera.clearViewOffset();
   }, [camera]);
   useFrame(() => {
      if (!(camera instanceof PerspectiveCamera)) return;
      const view = fitRocketView(rocketBox(run), size.width, size.height, avoid);
      camera.fov = 35;
      camera.position.set(view.x, view.y, view.distance);
      camera.lookAt(view.x, view.y, 0);
      setLensShift(camera, 0, view.shift, size.width, size.height);
      camera.updateMatrixWorld();
   }, -0.25);
   return null;
}
