"use client";

// A seeded starfield: one THREE.Points (one draw call) on a shell around the camera, never fogged.
//
//    <Starfield count={900} seed={7} />
//
// The same seed always gives the same sky. Stars keep a fixed pixel size (sizeAttenuation off) and
// follow the camera, so they look infinitely far away.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, PointsMaterial, type Points } from "three";
import { FRAME_PRIORITY } from "../frameLoop";
import { rngNext } from "../math";

export interface StarfieldProps {
   count?: number;
   seed?: number;
   /** inside the camera's far plane (400); default 170 */
   radius?: number;
   /** star size in CSS-ish px; default 2 */
   size?: number;
   color?: string;
   /** stars only above the horizon (a ground-level view); default false = all round */
   upperOnly?: boolean;
}

/** Fills `positions` (x, y, z triplets) and `colors` (r, g, b) with `count` seeded stars. Pure. */
export function fillStars(
   positions: Float32Array,
   colors: Float32Array,
   count: number,
   seed: number,
   radius: number,
   upperOnly: boolean
): void {
   const rng = { s: seed };
   for (let i = 0; i < count; i++) {
      let y = 2 * rngNext(rng) - 1;
      if (upperOnly) y = Math.abs(y) * 0.98 + 0.02;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = 2 * Math.PI * rngNext(rng);
      positions[i * 3] = radius * r * Math.cos(phi);
      positions[i * 3 + 1] = radius * y;
      positions[i * 3 + 2] = radius * r * Math.sin(phi);
      // most stars dim, a few bright
      const b = 0.35 + 0.65 * Math.pow(rngNext(rng), 3);
      colors[i * 3] = b;
      colors[i * 3 + 1] = b;
      colors[i * 3 + 2] = b;
   }
}

export function Starfield({ count = 800, seed = 1, radius = 170, size = 2, color = "#ffffff", upperOnly = false }: StarfieldProps) {
   const ref = useRef<Points>(null);
   const camera = useThree((state) => state.camera);
   const n = Math.max(1, Math.floor(count));
   const geometry = useMemo(() => {
      const positions = new Float32Array(n * 3);
      const colors = new Float32Array(n * 3);
      fillStars(positions, colors, n, seed, radius, upperOnly);
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(positions, 3));
      g.setAttribute("color", new BufferAttribute(colors, 3));
      return g;
   }, [n, seed, radius, upperOnly]);
   const material = useMemo(
      () =>
         new PointsMaterial({
            size: 1,
            sizeAttenuation: false,
            vertexColors: true,
            fog: false,
            depthWrite: false,
            transparent: true,
            toneMapped: false,
         }),
      []
   );
   useEffect(() => {
      material.size = size;
      material.color.set(color);
   }, [material, size, color]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   useEffect(() => () => material.dispose(), [material]);

   useFrame(() => {
      ref.current?.position.copy(camera.position);
   }, FRAME_PRIORITY.visuals);

   return <points ref={ref} geometry={geometry} material={material} renderOrder={-999} frustumCulled={false} name="env-stars" />;
}
