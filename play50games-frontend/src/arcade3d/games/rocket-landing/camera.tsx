"use client";
import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { HULL } from "./assets";
import { BODY, PLANETS, padX, type Run } from "./rules";

const AREA = { min: { x: -10.5, y: -9.7, z: -1.5 }, max: { x: 10.5, y: 9.7, z: 1.5 } };
const FOCUS = followFocus({ lookAt: [0, 0, 0], reach: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, fraction: 1 });
const OPTIONS = { area: AREA, pitch: 0, yaws: [0], focus: FOCUS, fov: 35, margin: { top: 0.04, bottom: 0.04, left: 0.03, right: 0.03 }, padding: 4, shift: true };
export default function RocketCamera({ run }: { run: Run }) {
   const view = useFittedView(OPTIONS);
   const time = useGameTime();
   const [fit] = useState(() => ({ focus: { x: run.body.x / 2, y: 8, z: 0 }, eased: { x: run.body.x / 2, y: 8 }, offset: [0, 0, view.distance] as [number, number, number] }));
   useFrame(({ camera }) => {
      const b = run.body, c = Math.cos(b.angle), s = Math.sin(b.angle);
      const px = padX(run.layouts[run.planet], run.planet, run.attemptTime), half = PLANETS[run.planet].width / 2;
      let x0 = px - half, x1 = px + half, y0 = 1.6, y1 = 2.08;
      for (let i = 0; i < HULL.length; i++) {
         const x = b.x + c * HULL[i][0] - s * (HULL[i][1] - BODY.centre);
         const y = b.y + s * HULL[i][0] + c * (HULL[i][1] - BODY.centre);
         x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      fit.focus.x = (x0 + x1) / 2; fit.focus.y = (y0 + y1) / 2;
      const ease = 1 - Math.exp(-12 * Math.min(time.delta, 0.1));
      fit.eased.x += (fit.focus.x - fit.eased.x) * ease;
      fit.eased.y += (fit.focus.y - fit.eased.y) * ease;
      const hx = Math.max(x1 - fit.eased.x, fit.eased.x - x0, (x1 - x0) / 2) + 0.5;
      const hy = Math.max(y1 - fit.eased.y, fit.eased.y - y0, (y1 - y0) / 2) + 0.5;
      const scale = Math.max(hx / 10.5, hy / 9.7, 0.16);
      const needed = 1.5 + (view.distance - 1.5) * scale;
      // Compensate CameraRig's distance damping on expansion without a second camera writer.
      fit.offset[2] = needed > camera.position.z && ease > 0 ? camera.position.z + (needed - camera.position.z) / ease : needed;
   }, -0.4);
   return <CameraRig camera={{ position: view.offset, lookAt: [0, 0, 0], fov: 35 }} follow={fit.focus} followFraction={1} offset={fit.offset} shift={view.shift} damping={12} />;
}
