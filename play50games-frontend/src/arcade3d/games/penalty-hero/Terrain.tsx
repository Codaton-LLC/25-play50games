"use client";

import { useMemo } from "react";
import { PlaneGeometry } from "three";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { COLORS, GROUND, PITCH } from "./looks";

/**
 * Draws the lush striped pitch with regulation penalty box and field lines.
 */
const drawPitch: CanvasDraw = (ctx, w, h) => {
   const sx = w / PITCH.width;
   const sz = h / PITCH.depth;
   const px = (x: number) => (x + PITCH.width / 2) * sx;
   const pz = (z: number) => (z - PITCH.z0) * sz;

   // 1. Lush mower stripes along the pitch
   const stripeCount = 14;
   const stripeH = h / stripeCount;
   for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? COLORS.grass : COLORS.grassLight;
      ctx.fillRect(0, i * stripeH, w, stripeH + 1);
   }

   // 2. Regulation white markings
   ctx.strokeStyle = COLORS.line;
   ctx.lineWidth = Math.max(2.5, 0.1 * sx);

   // Goal line (z = 0)
   ctx.beginPath();
   ctx.moveTo(px(-25), pz(0));
   ctx.lineTo(px(25), pz(0));
   ctx.stroke();

   // Touchlines
   ctx.beginPath();
   ctx.moveTo(px(-25), pz(-2));
   ctx.lineTo(px(-25), pz(32));
   ctx.moveTo(px(25), pz(-2));
   ctx.lineTo(px(25), pz(32));
   ctx.stroke();

   // 6-yard box (goal area: 18.32m wide, 5.5m deep)
   ctx.strokeRect(px(-9.16), pz(0), 18.32 * sx, 5.5 * sz);

   // 18-yard box (penalty area: 40.32m wide, 16.5m deep)
   ctx.strokeRect(px(-20.16), pz(0), 40.32 * sx, 16.5 * sz);

   // Penalty arc (radius 9.15m from penalty spot (0, 11), outside the 16.5m line)
   ctx.beginPath();
   const arcAngle = Math.asin(5.5 / 9.15);
   ctx.ellipse(
      px(0),
      pz(11),
      9.15 * sx,
      9.15 * sz,
      0,
      arcAngle,
      Math.PI - arcAngle
   );
   ctx.stroke();

   // Penalty spot at (0, 11)
   ctx.fillStyle = COLORS.line;
   ctx.beginPath();
   ctx.ellipse(px(0), pz(11), 0.22 * sx, 0.22 * sz, 0, 0, Math.PI * 2);
   ctx.fill();
};

/**
 * Tournament football pitch and deep surround ground covering the entire camera view.
 */
export function Terrain() {
   const pitchTexture = useCanvasTexture(1024, 853, drawPitch);

   return (
      <group name="penalty-terrain">
         {/* Deep ground surround plane: guarantees no void/sky shows below the scene at any camera size */}
         <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, GROUND.y, GROUND.zCenter]}
            name="ground-surround"
         >
            <planeGeometry args={[GROUND.width, GROUND.depth]} />
            <meshStandardMaterial color={COLORS.groundOuter} roughness={0.95} />
         </mesh>

         {/* Lush striped tournament playing pitch */}
         <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, PITCH.zCenter]}
            name="pitch-surface"
         >
            <planeGeometry args={[PITCH.width, PITCH.depth]} />
            <meshStandardMaterial
               map={pitchTexture}
               roughness={0.88}
               polygonOffset
               polygonOffsetFactor={-1}
               polygonOffsetUnits={-1}
            />
         </mesh>
      </group>
   );
}
