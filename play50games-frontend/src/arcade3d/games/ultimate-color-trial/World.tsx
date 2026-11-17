"use client";

// The fortress round the trial: the level's hemisphere tint and key light, the corridor's walls
// with their neon strips, and far prism towers (code) over the void. The shell's lighting preset
// (look.ts) does the main light; the floor, pads, rings, gates and props are TrialView.tsx.
import { useMemo } from "react";
import { AdditiveBlending, DoubleSide } from "three";
import { HALF_W } from "./levels";
import { COLORS, LOOKS } from "./look";
import type { Course } from "./course";

function hash(a: number, b: number): number {
   let h = (a * 374761393) ^ (b * 668265263);
   h = (h ^ (h >>> 13)) * 1274126177;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Decor towers beside the corridor, never over it. */
export function towerSpots(c: Course): { x: number; z: number; h: number; w: number }[] {
   const out: { x: number; z: number; h: number; w: number }[] = [];
   const len = c.maxZ - c.minZ;
   const n = Math.max(6, Math.floor(len / 18));
   for (let k = 0; k < n; k++) {
      const r = hash(k, c.id);
      const z = c.minZ + ((k + 0.5) / n) * len;
      const side = k % 2 === 0 ? -1 : 1;
      out.push({ x: side * (HALF_W + 9 + r * 8), z, h: 8 + r * 14, w: 2.2 + r * 2.4 });
   }
   return out;
}

export function World({ course }: { course: Course }) {
   const look = LOOKS[course.id];
   const towers = useMemo(() => towerSpots(course), [course]);
   const cz = (course.minZ + course.maxZ) / 2;
   const len = course.maxZ - course.minZ;
   return (
      <group>
         <hemisphereLight color={look.hemiSky} groundColor={look.hemiGround} intensity={look.hemi} />
         <directionalLight position={[22, 40, cz - 30]} intensity={look.keyIntensity} color={look.key} />
         {/* the corridor's walls and their neon top strips */}
         {[-1, 1].map((side) => (
            <group key={side} position={[side * (HALF_W + 0.5), 0, cz]}>
               <mesh position={[0, 1.6, 0]}>
                  <boxGeometry args={[1, 3.6, len]} />
                  <meshStandardMaterial color={COLORS.wall} roughness={0.6} metalness={0.2} />
               </mesh>
               <mesh position={[side * -0.52, 3.2, 0]} rotation-y={side > 0 ? -Math.PI / 2 : Math.PI / 2}>
                  <planeGeometry args={[len, 0.16]} />
                  <meshBasicMaterial color={COLORS.wallStrip} transparent opacity={0.55 * look.neon} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
               </mesh>
            </group>
         ))}
         {/* far prism towers */}
         {towers.map((t, i) => (
            <group key={i} position={[t.x, -6, t.z]}>
               <mesh position={[0, t.h / 2, 0]}>
                  <cylinderGeometry args={[t.w * 0.6, t.w, t.h, 6, 1]} />
                  <meshStandardMaterial color="#1a1238" roughness={0.5} metalness={0.3} emissive="#4c1d95" emissiveIntensity={0.25} flatShading />
               </mesh>
               <mesh position={[0, t.h + 0.6, 0]}>
                  <octahedronGeometry args={[t.w * 0.5, 0]} />
                  <meshBasicMaterial color={i % 2 ? "#f472b6" : "#60a5fa"} toneMapped={false} />
               </mesh>
            </group>
         ))}
         {/* a faint nebula far behind the summit */}
         <mesh position={[0, 14, course.maxZ + 90]} rotation-y={Math.PI}>
            <circleGeometry args={[40, 32]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
         </mesh>
      </group>
   );
}
