"use client";

// The crystal cavern round the rooms: a dark violet dome, the chasm far below (a mist-lit floor), grotto
// walls (m2GrottoWallBg, instanced, scaled to cliffs) on both sides of the route, glowing crystal
// clusters on the cliffs (code: the light sources) and drifting motes. Scenery only: nothing collides.
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { SkyDome } from "@/arcade3d/core/env";
import { ASSETS, GLB_SIZE } from "./assets";
import type { Course } from "./course";
import { COLORS, levelLook } from "./look";

const rnd = (a: number, b: number): number => {
   const h = Math.imul(a * 2654435761 + b * 40503, 2246822519) >>> 0;
   return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

function extent(c: Course) {
   let minZ = Infinity;
   let maxZ = -Infinity;
   for (const b of c.boxes) {
      minZ = Math.min(minZ, b.minZ);
      maxZ = Math.max(maxZ, b.maxZ);
   }
   return { minZ: minZ - 10, maxZ: maxZ + 10 };
}

function Cliffs({ course }: { course: Course }) {
   const { walls, gems } = useMemo(() => {
      const e = extent(course);
      const walls: InstanceSpot[] = [];
      const gems: InstanceSpot[] = [];
      let k = 0;
      for (let z = e.maxZ; z > e.minZ; z -= 7, k++) {
         for (const side of [-1, 1]) {
            const x = side * (22 + rnd(k, side + 2) * 6);
            const h = 26 + rnd(k, side + 4) * 16;
            walls.push({ x, y: -30, z, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2, sx: 8 / GLB_SIZE.grotto.x, sy: h / GLB_SIZE.grotto.y, sz: 6 / GLB_SIZE.grotto.z });
            for (let g = 0; g < 2; g++) {
               const s = 0.6 + rnd(k * 3 + g, side + 6) * 1.4;
               gems.push({ x: x - side * (2.6 + g), y: -6 + rnd(k, g + 9) * 14, z: z + (g - 0.5) * 3, rotY: rnd(k, g) * 6, sx: s * 0.7, sy: s * 1.8, sz: s * 0.7 });
            }
         }
      }
      return { walls, gems };
   }, [course]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.grotto}
            spots={walls}
            fallback={
               <Instanced spots={walls}>
                  <boxGeometry args={[GLB_SIZE.grotto.x, GLB_SIZE.grotto.y, GLB_SIZE.grotto.z]} />
                  <meshStandardMaterial color={COLORS.wall} roughness={0.95} />
               </Instanced>
            }
         />
         <Instanced spots={gems}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1.1} roughness={0.3} toneMapped={false} />
         </Instanced>
      </>
   );
}

function Chasm({ course }: { course: Course }) {
   const e = extent(course);
   return (
      <mesh rotation-x={-Math.PI / 2} position={[0, -30, (e.minZ + e.maxZ) / 2]}>
         <planeGeometry args={[200, e.maxZ - e.minZ + 120]} />
         <meshStandardMaterial color={COLORS.chasm} emissive={COLORS.mist} emissiveIntensity={0.12} />
      </mesh>
   );
}

function Motes({ course }: { course: Course }) {
   const geo = useMemo(() => {
      const e = extent(course);
      const g = new BufferGeometry();
      const pts: number[] = [];
      for (let k = 0; k < 400; k++) pts.push((rnd(k, 1) - 0.5) * 40, -8 + rnd(k, 2) * 22, e.minZ + rnd(k, 3) * (e.maxZ - e.minZ));
      g.setAttribute("position", new Float32BufferAttribute(pts, 3));
      return g;
   }, [course]);
   useEffect(() => () => geo.dispose(), [geo]);
   return (
      <points geometry={geo}>
         <pointsMaterial color="#e9d5ff" size={0.12} transparent opacity={0.7} />
      </points>
   );
}

export default function World({ course }: { course: Course }) {
   const look = levelLook(course.level);
   return (
      <group>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <Chasm course={course} />
         <Cliffs course={course} />
         <Motes course={course} />
      </group>
   );
}
