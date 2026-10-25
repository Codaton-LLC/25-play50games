"use client";

import { useEffect, useMemo } from "react";
import { RepeatWrapping, RingGeometry } from "three";
import { Instanced, useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { COLORS, HULL_GROUND } from "./looks";

const drawHullTexture: CanvasDraw = (ctx, w, h) => {
   // 1. Sleek metallic base
   ctx.fillStyle = COLORS.hull;
   ctx.fillRect(0, 0, w, h);

   // 2. Brushed panel seams & tiles
   const cols = 8;
   const rows = 8;
   const cw = w / cols;
   const rh = h / rows;

   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
         const x = c * cw;
         const y = r * rh;
         // Slight shade variations per panel tile
         const tone = (r * 3 + c * 5) % 3;
         ctx.fillStyle = tone === 0 ? COLORS.hull : tone === 1 ? COLORS.hullMid : COLORS.hullBright;
         ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

         // Panel corner rivets
         ctx.fillStyle = COLORS.hullTrim;
         ctx.fillRect(x + 5, y + 5, 2, 2);
         ctx.fillRect(x + cw - 7, y + 5, 2, 2);
         ctx.fillRect(x + 5, y + rh - 7, 2, 2);
         ctx.fillRect(x + cw - 7, y + rh - 7, 2, 2);
      }
   }

   // 3. Glowing neon blue runway conduits and service lines
   ctx.strokeStyle = COLORS.neonBlue;
   ctx.lineWidth = 4;
   ctx.shadowColor = COLORS.accent;
   ctx.shadowBlur = 8;

   // Horizontal light strip
   ctx.beginPath();
   ctx.moveTo(0, h * 0.5);
   ctx.lineTo(w, h * 0.5);
   ctx.stroke();

   // Vertical light strip
   ctx.beginPath();
   ctx.moveTo(w * 0.5, 0);
   ctx.lineTo(w * 0.5, h);
   ctx.stroke();

   // Reset shadow
   ctx.shadowBlur = 0;
};

// Perimeter light beacon spots around the outer deck ring (radius 10.2)
const BEACONS = Array.from({ length: 16 }, (_, i) => {
   const a = (i * Math.PI * 2) / 16;
   const r = 10.2;
   return {
      x: r * Math.sin(a),
      y: -0.16,
      z: r * Math.cos(a),
      rotY: a,
   };
});

/**
 * Sleek orbital space station hull ground structure beneath the play arena.
 * Guarantees zero void/gap at the bottom of the screen across all 3 viewports.
 */
export function StationHull() {
   const texture = useCanvasTexture(1024, 1024, drawHullTexture);

   useEffect(() => {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(6, 5);
      texture.needsUpdate = true;
   }, [texture]);

   const ringGeo = useMemo(() => new RingGeometry(9.9, 10.5, 32), []);

   useEffect(() => () => {
      ringGeo.dispose();
   }, [ringGeo]);

   const width = HULL_GROUND.maxX - HULL_GROUND.minX;
   const depth = HULL_GROUND.maxZ - HULL_GROUND.minZ;

   return (
      <group name="space-station-hull">
         {/* Main wide station hull deck plane */}
         <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, HULL_GROUND.y, 0]}
            name="space-hull-deck"
         >
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial
               map={texture}
               roughness={0.4}
               metalness={0.5}
               polygonOffset
               polygonOffsetFactor={1}
               polygonOffsetUnits={1}
            />
         </mesh>

         {/* Perimeter structural deck ring */}
         <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.22, 0]}
            geometry={ringGeo}
            name="space-perimeter-ring"
         >
            <meshStandardMaterial
               color={COLORS.hullTrim}
               roughness={0.5}
               metalness={0.6}
            />
         </mesh>

         {/* Glowing blue perimeter runway beacons */}
         <Instanced spots={BEACONS} name="space-beacons">
            <boxGeometry args={[0.2, 0.08, 0.4]} />
            <meshStandardMaterial
               color={COLORS.neonBlue}
               emissive={COLORS.neonBlue}
               emissiveIntensity={0.8}
               roughness={0.2}
            />
         </Instanced>
      </group>
   );
}
