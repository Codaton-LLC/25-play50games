"use client";

// The Aurora Run's northern lights: three wide ribbons of soft green-to-violet light high over the
// far horizon, rippling slowly (pause-safe game time; still with reduced motion). Additive, unlit,
// no depth write, so they never hide the slope; 3 draw calls on the one level that has them.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, PlaneGeometry, type Mesh } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useCanvasTexture } from "@/arcade3d/core/render";

// low over the far end of the slope: the chase camera looks 25° down, so the top of its frame is
// about level with the camera; the glacier falls away ahead, so the ribbons rise over its far edge
const RIBBONS = [
   { x: -45, y: 2, z: -130, w: 130, h: 18, tilt: 0.1, phase: 0 },
   { x: 40, y: 5, z: -145, w: 140, h: 16, tilt: -0.07, phase: 2.1 },
   { x: 0, y: 8, z: -160, w: 170, h: 14, tilt: 0.03, phase: 4.2 },
] as const;

export function Aurora({ reduced }: { reduced: boolean }) {
   const time = useGameTime();
   const tex = useCanvasTexture(256, 128, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, "rgba(167,139,250,0)");
      g.addColorStop(0.35, "rgba(129,140,248,0.35)");
      g.addColorStop(0.7, "rgba(52,211,153,0.85)");
      g.addColorStop(1, "rgba(16,185,129,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
      // vertical curtain streaks
      for (let x = 0; x < 256; x += 6) {
         ctx.fillStyle = `rgba(236,253,245,${0.05 + 0.08 * Math.abs(Math.sin(x * 0.21))})`;
         ctx.fillRect(x, 20, 2, 96);
      }
   });
   // one unit plane as the rest shape, one copy per ribbon that the wave bends
   const base = useMemo(() => new PlaneGeometry(1, 1, 32, 1), []);
   const copies = useMemo(() => RIBBONS.map(() => base.clone()), [base]);
   useEffect(
      () => () => {
         base.dispose();
         for (const c of copies) c.dispose();
      },
      [base, copies],
   );
   const meshes = useRef<Array<Mesh | null>>([]);
   useFrame(() => {
      const t = reduced ? 0 : time.now;
      RIBBONS.forEach((r, i) => {
         const m = meshes.current[i];
         if (!m) return;
         // a slow wave along the ribbon: shear its vertices up and down
         const pos = m.geometry.getAttribute("position");
         const rest = base.getAttribute("position");
         for (let k = 0; k < pos.count; k++) {
            pos.setY(k, rest.getY(k) + 0.12 * Math.sin(rest.getX(k) * 9 + t * 0.6 + r.phase));
         }
         pos.needsUpdate = true;
      });
   });
   return (
      <group name="aurora">
         {RIBBONS.map((r, i) => (
            <mesh
               key={i}
               ref={(m) => {
                  meshes.current[i] = m;
               }}
               position={[r.x, r.y, r.z]}
               rotation={[0.1, 0, r.tilt]}
               scale={[r.w, r.h, 1]}
               geometry={copies[i]}
               frustumCulled={false}
            >
               <meshBasicMaterial map={tex} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} fog={false} />
            </mesh>
         ))}
      </group>
   );
}
