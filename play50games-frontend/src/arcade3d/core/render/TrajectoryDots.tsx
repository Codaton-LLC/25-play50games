"use client";

// The aim preview of a throw or a shot: dots along the ballistic arc (core/ballistics.ts
// trajectoryPoints), fading towards the end. One InstancedMesh, one draw call, no allocation per
// frame.
//
//    const shot = useRef<Projectile>({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 });   // the game aims it
//    useRunFrame(() => { aimFromDrag(input.current.drag, shot.current); });
//    <TrajectoryDots projectile={shot.current} params={BALLISTICS} fraction={0.6} visible={aiming} />
//
// - `projectile` is read every frame (mutate it in place); `params` too (wind may change).
// - The arc ends where it meets `groundY` (the last dot sits on the ground) or after `count` dots.
// - `fraction` (0..1) shows only the first part of the arc: a partial preview that hints the
//   direction without giving the landing spot away. 1 = the whole arc.
// - The fade and the shrink run over the dots the `fraction` allows (shownDots(count, fraction)):
//   a partial preview fades out fully at its end. Dot i always gets the same look for a given
//   count and fraction, so the dots do not flicker as the arc grows or shrinks.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   Color,
   DynamicDrawUsage,
   IcosahedronGeometry,
   InstancedBufferAttribute,
   InstancedMesh,
   Matrix4,
   ShaderMaterial,
} from "three";
import { trajectoryPoints, type BallisticParams, type Projectile } from "../ballistics";
import { FRAME_PRIORITY } from "../frameLoop";

export interface TrajectoryDotsProps {
   /** the launch state (position and velocity), read every frame; null hides the dots */
   projectile: Readonly<Projectile> | null;
   params: BallisticParams;
   /** the most dots (default 24); keep it fixed */
   count?: number;
   /** seconds of flight between two dots (default 0.06) */
   step?: number;
   /** the arc stops at this height (default 0) */
   groundY?: number;
   /** share of the arc shown, 0..1 (default 1) */
   fraction?: number;
   /** dot radius at the start, m (default 0.06); later dots shrink to `endScale` of it */
   radius?: number;
   endScale?: number;
   color?: string;
   /** opacity of the first dot (default 0.95); the last one fades to `endOpacity` (default 0.15) */
   opacity?: number;
   endOpacity?: number;
   /** false hides the dots without unmounting them (default true) */
   visible?: boolean;
}

const VERTEX = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() {
   vAlpha = aAlpha;
   gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
   gl_FragColor = vec4(uColor, vAlpha);
   #include <colorspace_fragment>
}
`;

/** Pure: the opacity of dot i of n (first `start`, last `end`). */
export function dotOpacity(i: number, n: number, start: number, end: number): number {
   if (n <= 1) return start;
   return start + (end - start) * (i / (n - 1));
}

/** Pure: how many of `available` arc points a `fraction` shows (at least 1 when there is an arc and fraction > 0). */
export function shownDots(available: number, fraction: number): number {
   if (!(available > 0) || !(fraction > 0)) return 0;
   const f = fraction >= 1 ? 1 : fraction;
   return Math.max(1, Math.min(available, Math.round(available * f)));
}

export function TrajectoryDots({
   projectile,
   params,
   count = 24,
   step = 0.06,
   groundY = 0,
   fraction = 1,
   radius = 0.06,
   endScale = 0.55,
   color = "#ffffff",
   opacity = 0.95,
   endOpacity = 0.15,
   visible = true,
}: TrajectoryDotsProps) {
   const n = Math.max(1, Math.floor(count));
   const parts = useMemo(() => {
      const geometry = new IcosahedronGeometry(1, 1);
      const alpha = new InstancedBufferAttribute(new Float32Array(n), 1);
      geometry.setAttribute("aAlpha", alpha);
      const material = new ShaderMaterial({
         uniforms: { uColor: { value: new Color(1, 1, 1) } },
         vertexShader: VERTEX,
         fragmentShader: FRAGMENT,
         transparent: true,
         depthWrite: false,
      });
      const mesh = new InstancedMesh(geometry, material, n);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = "trajectory-dots";
      return { mesh, geometry, material, alpha, points: new Float32Array(n * 3), matrix: new Matrix4() };
   }, [n]);

   // the fade runs over the dots a full arc shows at this fraction
   const span = Math.max(1, shownDots(n, fraction));
   useEffect(() => {
      const a = parts.alpha.array as Float32Array;
      for (let i = 0; i < n; i++) a[i] = dotOpacity(Math.min(i, span - 1), span, opacity, endOpacity);
      parts.alpha.needsUpdate = true;
   }, [parts, n, span, opacity, endOpacity]);

   useEffect(() => {
      (parts.material.uniforms.uColor.value as Color).set(color);
   }, [parts, color]);

   useEffect(
      () => () => {
         parts.geometry.dispose();
         parts.material.dispose();
         parts.mesh.dispose();
      },
      [parts]
   );

   const live = useRef({ projectile, params, step, groundY, fraction, radius, endScale, visible, span });
   live.current = { projectile, params, step, groundY, fraction, radius, endScale, visible, span };

   useFrame(() => {
      const p = live.current;
      const { mesh, points, matrix } = parts;
      if (!p.visible || !p.projectile) {
         mesh.count = 0;
         return;
      }
      const available = trajectoryPoints(p.projectile, p.params, n, p.step, points, p.groundY);
      const shown = shownDots(available, p.fraction);
      for (let i = 0; i < shown; i++) {
         const s = p.radius * (1 + (p.endScale - 1) * (p.span > 1 ? Math.min(1, i / (p.span - 1)) : 0));
         matrix.makeScale(s, s, s).setPosition(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
         mesh.setMatrixAt(i, matrix);
      }
      mesh.count = shown;
      mesh.instanceMatrix.needsUpdate = true;
   }, FRAME_PRIORITY.visuals);

   return <primitive object={parts.mesh} />;
}
