"use client";

// Light falling snow: one THREE.Points (one draw call) in a box, flakes wrap from the bottom back
// to the top. The number drawn is scaled by useQuality().particles (the buffer keeps the full
// count, so a tier change never rebuilds it). Moves with the run's pause-safe clock: render it
// inside the Scene.
//
//    <SnowFall count={700} area={[40, 16, 40]} center={[0, 8, 0]} />
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, PointsMaterial } from "three";
import { useGameTime } from "../gameTime";
import { FRAME_PRIORITY } from "../frameLoop";
import { rngNext } from "../math";
import { scaledCount, useQuality } from "../quality";
import { useCanvasTexture, type CanvasDraw } from "../render/useCanvasTexture";

export interface SnowFallProps {
   /** flakes at "high" quality; default 600 */
   count?: number;
   /** box size (m): x, y, z; default [30, 14, 30] */
   area?: readonly [number, number, number];
   /** box centre; default [0, 7, 0] */
   center?: readonly [number, number, number];
   /** fall speed m/s; default 1.2 */
   speed?: number;
   /** flake size (m); default 0.09 */
   size?: number;
   color?: string;
   seed?: number;
}

/** Per flake: x, y, z in `positions` (relative to the box centre), sway phase and speed factor in `traits`. */
export function fillSnow(positions: Float32Array, traits: Float32Array, count: number, area: readonly [number, number, number], seed: number): void {
   const rng = { s: seed };
   for (let i = 0; i < count; i++) {
      positions[i * 3] = (rngNext(rng) - 0.5) * area[0];
      positions[i * 3 + 1] = (rngNext(rng) - 0.5) * area[1];
      positions[i * 3 + 2] = (rngNext(rng) - 0.5) * area[2];
      traits[i * 2] = 2 * Math.PI * rngNext(rng);
      traits[i * 2 + 1] = 0.6 + 0.8 * rngNext(rng);
   }
}

/** Moves the first `count` flakes down by dt (s) with a gentle sway, wrapping inside the box. Pure. */
export function stepSnow(
   positions: Float32Array,
   traits: Float32Array,
   count: number,
   area: readonly [number, number, number],
   speed: number,
   dt: number,
   now: number
): void {
   if (!(dt > 0)) return;
   const hx = area[0] / 2;
   const hy = area[1] / 2;
   const hz = area[2] / 2;
   for (let i = 0; i < count; i++) {
      const phase = traits[i * 2];
      const factor = traits[i * 2 + 1];
      let y = positions[i * 3 + 1] - speed * factor * dt;
      if (y < -hy) y += area[1];
      positions[i * 3 + 1] = y;
      let x = positions[i * 3] + Math.sin(now * 0.9 + phase) * 0.35 * dt;
      if (x < -hx) x += area[0];
      else if (x > hx) x -= area[0];
      positions[i * 3] = x;
      let z = positions[i * 3 + 2] + Math.cos(now * 0.7 + phase) * 0.25 * dt;
      if (z < -hz) z += area[2];
      else if (z > hz) z -= area[2];
      positions[i * 3 + 2] = z;
   }
}

const drawFlake: CanvasDraw = (ctx, w, h) => {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.55, "rgba(255,255,255,0.85)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
};

const DEFAULT_AREA = [30, 14, 30] as const;
const DEFAULT_CENTER = [0, 7, 0] as const;

export function SnowFall({
   count = 600,
   area = DEFAULT_AREA,
   center = DEFAULT_CENTER,
   speed = 1.2,
   size = 0.09,
   color = "#ffffff",
   seed = 11,
}: SnowFallProps) {
   const time = useGameTime();
   const quality = useQuality();
   const flake = useCanvasTexture(32, 32, drawFlake);
   const n = Math.max(1, Math.floor(count));
   const [ax, ay, az] = area;
   const data = useMemo(() => {
      const positions = new Float32Array(n * 3);
      const traits = new Float32Array(n * 2);
      fillSnow(positions, traits, n, [ax, ay, az], seed);
      const geometry = new BufferGeometry();
      const attribute = new BufferAttribute(positions, 3);
      attribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute("position", attribute);
      return { positions, traits, geometry, attribute, area: [ax, ay, az] as const };
   }, [n, ax, ay, az, seed]);
   const material = useMemo(
      () => new PointsMaterial({ size: 0.1, sizeAttenuation: true, transparent: true, depthWrite: false }),
      []
   );
   useEffect(() => {
      material.map = flake;
      material.size = size;
      material.color.set(color);
      material.needsUpdate = true;
   }, [material, flake, size, color]);
   useEffect(() => () => data.geometry.dispose(), [data]);
   useEffect(() => () => material.dispose(), [material]);

   const shown = scaledCount(n, quality.particles);
   useEffect(() => {
      data.geometry.setDrawRange(0, shown);
   }, [data, shown]);

   useFrame(() => {
      if (time.delta <= 0) return;
      stepSnow(data.positions, data.traits, shown, data.area, speed, time.delta, time.now);
      data.attribute.needsUpdate = true;
   }, FRAME_PRIORITY.visuals);

   return (
      <points
         geometry={data.geometry}
         material={material}
         position={[center[0], center[1], center[2]]}
         frustumCulled={false}
         name="env-snow"
      />
   );
}
