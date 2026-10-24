"use client";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import type { Run } from "./rules";

export const CAMERA = { position: [0, 10, 10] as [number, number, number], lookAt: [0, 1.1, 0] as [number, number, number], fov: 45 };
export const FIT = {
   area: { min: { x: -2.75, y: 0, z: -2.75 }, max: { x: 2.75, y: 2.2, z: 2.75 } },
   focus: [{ x: 0, y: 1.1, z: 0 }], pitch: 50 * Math.PI / 180, yaws: [0], fov: 45,
   margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 }, padding: 4, shift: true,
};
const BOUNDS = { min: { x: -9.55, y: 1.1, z: -9.55 }, max: { x: 9.55, y: 1.1, z: 9.55 } };
export default function RepairCamera({ run }: { run: Run }) {
   const view = useFittedView(FIT);
   return <CameraRig camera={CAMERA} follow={run.body} bounds={BOUNDS} damping={5} followFraction={1} offset={view.offset} shift={view.shift} />;
}
