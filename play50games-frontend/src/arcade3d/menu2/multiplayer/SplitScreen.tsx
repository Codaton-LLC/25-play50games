"use client";

// Optional split screen (framework: "only where a game needs it", e.g. runners with 2 lanes per
// player): 2-4 viewports (splitViewports in framing.ts), each with its own camera following one
// hero from a fixed offset. It takes over the Canvas render (a positive useFrame priority), so a
// scene uses EITHER <SharedCamera /> OR <SplitScreen />, never both, and nothing else in the
// scene may render with a positive priority.
//
//    <SplitScreen targets={runs.map((r) => r.hero)} offset={[0, 3.2, 6.5]} lookAhead={[0, 1, -4]} />
import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import type { Vec3Like } from "@/arcade3d/core/collision";
import { splitViewports } from "./framing";

export interface SplitScreenProps {
   /** each viewport's live target (feet), read every frame; 2-4 */
   targets: readonly Vec3Like[];
   /** camera position relative to its target */
   offset?: readonly [number, number, number];
   /** the point each camera looks at, relative to its target */
   lookAhead?: readonly [number, number, number];
   fov?: number;
   /** px between the viewports (the clear colour shows there) */
   gap?: number;
   /** easing rate (1/s). Default 5 */
   damping?: number;
}

export function SplitScreen({ targets, offset = [0, 3.2, 6.5], lookAhead = [0, 1, -4], fov = 55, gap = 4, damping = 5 }: SplitScreenProps) {
   const gl = useThree((s) => s.gl);
   const scene = useThree((s) => s.scene);
   const size = useThree((s) => s.size);
   const count = Math.max(1, Math.min(4, targets.length));
   const cameras = useMemo(() => Array.from({ length: 4 }, () => new PerspectiveCamera(fov, 1, 0.1, 1000)), [fov]);
   const placed = useMemo(() => [false, false, false, false], [cameras]);
   const look = useMemo(() => Array.from({ length: 4 }, () => new Vector3()), []);
   const views = useMemo(() => splitViewports(count, size.width, size.height, gap), [count, size.width, size.height, gap]);

   useLayoutEffect(() => {
      views.forEach((v, i) => {
         cameras[i].aspect = v.width / Math.max(1, v.height);
         cameras[i].updateProjectionMatrix();
      });
   }, [views, cameras]);

   useLayoutEffect(
      () => () => {
         gl.setScissorTest(false);
         gl.setViewport(0, 0, size.width, size.height);
      },
      [gl, size.width, size.height],
   );

   useFrame((_state, delta) => {
      const dt = Math.min(0.1, delta);
      const k = 1 - Math.exp(-damping * dt);
      gl.autoClear = false;
      gl.setScissorTest(false);
      gl.clear();
      gl.setScissorTest(true);
      for (let i = 0; i < views.length; i++) {
         const t = targets[i];
         const cam = cameras[i];
         if (!t) continue;
         const kk = placed[i] ? k : 1;
         placed[i] = true;
         cam.position.x += (t.x + offset[0] - cam.position.x) * kk;
         cam.position.y += (t.y + offset[1] - cam.position.y) * kk;
         cam.position.z += (t.z + offset[2] - cam.position.z) * kk;
         look[i].x += (t.x + lookAhead[0] - look[i].x) * kk;
         look[i].y += (t.y + lookAhead[1] - look[i].y) * kk;
         look[i].z += (t.z + lookAhead[2] - look[i].z) * kk;
         cam.lookAt(look[i]);
         const v = views[i];
         // WebGL viewports count from the bottom
         const y = size.height - v.top - v.height;
         gl.setViewport(v.left, y, v.width, v.height);
         gl.setScissor(v.left, y, v.width, v.height);
         gl.clear();
         gl.render(scene, cam);
      }
      gl.setScissorTest(false);
      gl.autoClear = true;
   }, 1);
   return null;
}
