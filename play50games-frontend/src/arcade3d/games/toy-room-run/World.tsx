"use client";

// The room round the play: book stacks and toy-block piles on the carpet far below, tall book
// stacks along the walls, the level's hemisphere tint and a window light. The shell's lighting
// preset (look.ts) does the main light; the desks and the toys are Course.tsx.
import { useMemo } from "react";
import { InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { LOOKS } from "./look";
import type { Course } from "./room";

function hash(a: number, b: number): number {
   let h = (a * 374761393) ^ (b * 668265263);
   h = (h ^ (h >>> 13)) * 1274126177;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Decor spots below and beside the desks (never on a walkable top). */
export function decorSpots(c: Course): { books: InstanceSpot[]; blocks: InstanceSpot[] } {
   const books: InstanceSpot[] = [];
   const blocks: InstanceSpot[] = [];
   const len = c.maxZ - c.minZ;
   const n = Math.max(4, Math.floor(len / 26));
   for (let k = 0; k < n; k++) {
      const z = c.minZ + ((k + 0.5) / n) * len;
      const r = hash(k, c.id);
      // tall book stacks against the side walls
      books.push({ x: c.minX - 9 - r * 3, y: -9, z, rotY: r * 3, scale: 4 + r * 2 });
      books.push({ x: c.maxX + 9 + r * 3, y: -9, z: z + 8, rotY: r * 5, scale: 4 + r * 2.5 });
      // toy blocks spilled on the carpet under the gaps
      blocks.push({ x: (r - 0.5) * 6, y: -9, z: z + 4, rotY: r * 7, scale: 2 + r });
   }
   return { books, blocks };
}

export function World({ course }: { course: Course }) {
   const look = LOOKS[course.id];
   const spots = useMemo(() => decorSpots(course), [course]);
   const cx = (course.minX + course.maxX) / 2;
   const cz = (course.minZ + course.maxZ) / 2;
   return (
      <group>
         <hemisphereLight color={look.hemiSky} groundColor={look.hemiGround} intensity={look.hemi} />
         <directionalLight position={[cx + 20, 40, cz - 30]} intensity={look.lighting === "night" ? 0.25 : 0.5} color={look.lighting === "night" ? "#a5b4fc" : "#fff1d6"} />
         <InstancedModel asset={ASSETS.book} spots={spots.books} fallback={null} />
         <InstancedModel asset={ASSETS.blocks} spots={spots.blocks} fallback={null} />
      </group>
   );
}
