"use client";

// A short ribbon behind a moving thing (a thrown ball, a dashing hero, a drone). One mesh, one draw
// call, facing the camera, tapering and fading towards its tail; no allocation per frame.
//
//    const ball = useRef<Mesh>(null);
//    <mesh ref={ball}>…</mesh>
//    <Trail target={ball} length={24} width={0.25} color="#fde68a" />
//    <Trail target={run.player} />            // or a live {x, y, z} read every frame
//
// Render it inside the Scene (it uses the run's pause-safe clock: frozen while paused, gone on the
// next run). It follows at FRAME_PRIORITY.visuals, after the simulation and the camera.
import { useEffect, useLayoutEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   BufferAttribute,
   BufferGeometry,
   Color,
   DoubleSide,
   DynamicDrawUsage,
   MeshBasicMaterial,
   NormalBlending,
   Vector3,
   type Object3D,
} from "three";
import { useGameTime } from "../gameTime";
import { FRAME_PRIORITY } from "../frameLoop";
import type { Vec3Like } from "../collision";
import { createTrailHistory, followTrail } from "./trailHistory";

export interface TrailProps {
   /** what to follow: an object ref (its world position) or a live point */
   target: RefObject<Object3D | null> | Vec3Like;
   /** the most points kept (the trail's resolution); default 20 */
   length?: number;
   /** width at the head (m); default 0.25 */
   width?: number;
   color?: string;
   /** opacity at the head; default 0.8 */
   opacity?: number;
   /** distance (m) between kept points; default 0.12 */
   minDistance?: number;
   /** how fast the trail shrinks when the target stops, points per second; default 40 */
   fadeRate?: number;
   /** additive glow (default) or plain see-through */
   additive?: boolean;
}

export function Trail({
   target,
   length = 20,
   width = 0.25,
   color = "#ffffff",
   opacity = 0.8,
   minDistance = 0.12,
   fadeRate = 40,
   additive = true,
}: TrailProps) {
   const camera = useThree((state) => state.camera);
   const time = useGameTime();
   const n = Math.max(2, Math.floor(length));

   const parts = useMemo(() => {
      const history = createTrailHistory(n);
      const geometry = new BufferGeometry();
      const positions = new BufferAttribute(new Float32Array(n * 2 * 3), 3);
      const colors = new BufferAttribute(new Float32Array(n * 2 * 4), 4);
      positions.setUsage(DynamicDrawUsage);
      colors.setUsage(DynamicDrawUsage);
      geometry.setAttribute("position", positions);
      geometry.setAttribute("color", colors);
      const index: number[] = [];
      for (let i = 0; i < n - 1; i++) {
         const a = i * 2;
         index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geometry.setIndex(index);
      geometry.setDrawRange(0, 0);
      const material = new MeshBasicMaterial({
         vertexColors: true,
         transparent: true,
         depthWrite: false,
         side: DoubleSide,
         toneMapped: false,
      });
      return {
         history,
         geometry,
         positions,
         colors,
         material,
         point: new Vector3(),
         tangent: new Vector3(),
         toCamera: new Vector3(),
         side: new Vector3(),
         rgb: new Color(),
      };
   }, [n]);

   useEffect(() => {
      parts.material.blending = additive ? AdditiveBlending : NormalBlending;
      parts.material.needsUpdate = true;
   }, [parts, additive]);

   useLayoutEffect(() => {
      parts.rgb.set(color);
   }, [parts, color]);

   useEffect(
      () => () => {
         parts.geometry.dispose();
         parts.material.dispose();
      },
      [parts]
   );

   useFrame(() => {
      const { history, positions, colors, point, tangent, toCamera, side, rgb } = parts;
      if (!target) return;
      if ("current" in target) {
         if (!target.current) return;
         target.current.getWorldPosition(point);
      } else {
         point.set(target.x, target.y, target.z);
      }
      // frozen while paused: the clock does not move, neither does the trail
      if (time.delta <= 0 && history.count > 0) return;
      followTrail(history, point.x, point.y, point.z, minDistance, fadeRate, time.delta);

      const count = history.count;
      if (count < 2) {
         parts.geometry.setDrawRange(0, 0);
         return;
      }
      const p = history.points;
      const pos = positions.array as Float32Array;
      const col = colors.array as Float32Array;
      for (let i = 0; i < count; i++) {
         const prev = Math.max(0, i - 1) * 3;
         const next = Math.min(count - 1, i + 1) * 3;
         tangent.set(p[prev] - p[next], p[prev + 1] - p[next + 1], p[prev + 2] - p[next + 2]);
         toCamera.set(camera.position.x - p[i * 3], camera.position.y - p[i * 3 + 1], camera.position.z - p[i * 3 + 2]);
         side.crossVectors(tangent, toCamera);
         const len = side.length();
         const fade = 1 - i / (count - 1);
         const half = (width * 0.5 * fade) / (len > 1e-6 ? len : 1);
         if (len <= 1e-6) side.set(0, 0, 0);
         const v = i * 6;
         pos[v] = p[i * 3] + side.x * half;
         pos[v + 1] = p[i * 3 + 1] + side.y * half;
         pos[v + 2] = p[i * 3 + 2] + side.z * half;
         pos[v + 3] = p[i * 3] - side.x * half;
         pos[v + 4] = p[i * 3 + 1] - side.y * half;
         pos[v + 5] = p[i * 3 + 2] - side.z * half;
         const a = opacity * fade;
         const c = i * 8;
         col[c] = rgb.r;
         col[c + 1] = rgb.g;
         col[c + 2] = rgb.b;
         col[c + 3] = a;
         col[c + 4] = rgb.r;
         col[c + 5] = rgb.g;
         col[c + 6] = rgb.b;
         col[c + 7] = a;
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
      parts.geometry.setDrawRange(0, (count - 1) * 6);
   }, FRAME_PRIORITY.visuals);

   return <mesh geometry={parts.geometry} material={parts.material} frustumCulled={false} name="fx-trail" />;
}
