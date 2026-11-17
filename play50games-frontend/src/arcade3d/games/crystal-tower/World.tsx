"use client";

// The cosmos round the tower: the level's hemisphere tint and key light, far neon stars (m2SkyStar)
// on a shell round the spire, hanging crystals growing out of the spire, and three faint nebula
// discs far behind. The shell's lighting preset (look.ts) does the main light; the pads, crystals
// and beacons are Tower.tsx.
import { useMemo } from "react";
import { AdditiveBlending, DoubleSide } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { LOOKS } from "./look";
import { CORE_R, type Course } from "./tower";

function hash(a: number, b: number): number {
   let h = (a * 374761393) ^ (b * 668265263);
   h = (h ^ (h >>> 13)) * 1274126177;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Decor spots: stars on a far shell, hanging crystals on the spire (never over a pad). */
export function decorSpots(c: Course): { stars: InstanceSpot[]; hanging: InstanceSpot[] } {
   const stars: InstanceSpot[] = [];
   const hanging: InstanceSpot[] = [];
   const span = c.maxY - c.minY + 30;
   for (let k = 0; k < 44; k++) {
      const r = hash(k, c.id);
      const r2 = hash(k + 101, c.id);
      const a = r * Math.PI * 2;
      const rad = 48 + r2 * 40;
      stars.push({ x: Math.sin(a) * rad, y: c.minY - 14 + hash(k + 7, c.id) * span, z: Math.cos(a) * rad, rotY: r2 * 6, scale: 0.9 + r * 1.6 });
   }
   const n = Math.max(6, Math.floor(span / 5));
   for (let k = 0; k < n; k++) {
      const r = hash(k + 300, c.id);
      const a = r * Math.PI * 2;
      const y = c.minY - 6 + ((k + 0.5) / n) * (c.maxY - c.minY + 4);
      // a crystal growing out of the spire's side, tilted outward: its base on the spire, tip out and down
      hanging.push({ x: Math.sin(a) * (CORE_R - 0.3), y: y + 1.6, z: Math.cos(a) * (CORE_R - 0.3), rotY: a + Math.PI, scale: (1.2 + r * 0.9) / GLB_SIZE.hanging.y });
   }
   return { stars, hanging };
}

export function World({ course }: { course: Course }) {
   const look = LOOKS[course.id];
   const spots = useMemo(() => decorSpots(course), [course]);
   const midY = (course.minY + course.maxY) / 2;
   return (
      <group>
         <hemisphereLight color={look.hemiSky} groundColor={look.hemiGround} intensity={look.hemi} />
         <directionalLight position={[26, midY + 40, -18]} intensity={look.keyIntensity} color={look.key} />
         <pointLight position={[0, course.maxY + 6, 0]} intensity={1.4} distance={40} color="#e879f9" />
         <InstancedModel asset={ASSETS.star} spots={spots.stars} fallback={null} />
         <InstancedModel asset={ASSETS.hanging} spots={spots.hanging} fallback={null} />
         {/* nebula discs far behind the tower */}
         {[0, 1, 2].map((i) => {
            const a = i * 2.1 + 0.6;
            return (
               <mesh key={i} position={[Math.sin(a) * 95, midY + (i - 1) * 22, Math.cos(a) * 95]} rotation-y={a + Math.PI}>
                  <circleGeometry args={[26 + i * 6, 32]} />
                  <meshBasicMaterial color={i === 1 ? "#7c3aed" : i === 0 ? "#db2777" : "#2563eb"} transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
               </mesh>
            );
         })}
      </group>
   );
}
