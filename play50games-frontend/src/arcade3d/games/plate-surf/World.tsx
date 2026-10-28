"use client";

// The bay round the wave (no collision): the coast of sea cliffs (m2SeaCliffBg) far out in front of
// the wave, sea stacks out on the open ocean behind it, the cliff arches by Nami's spray ledges, and on
// level 4 the canyon: cliff walls close on both sides of the wave. One instanced model for every cliff.
// The sea, the wave and the sky are Wave.tsx; the playable props Course.tsx.
import { useMemo } from "react";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { createRng } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS } from "./look";
import { FACE_W } from "./waves";
import type { Course } from "./rules";

/** The cliff spots of a course (pure: World draws them; a test keeps them off the ride). */
export function cliffSpots(course: Course, seed: number, decor = 1): InstanceSpot[] {
   const rng = createRng(seed + course.level * 101);
   const out: InstanceSpot[] = [];
   const unit = 1 / GLB_SIZE.cliff.x;
   const z0 = course.startZ + 80;
   const z1 = course.finishZ - 160;
   // the coast far out in front of the wave
   const step = decor < 0.7 ? 70 : 46;
   for (let z = z0; z > z1; z -= step * (0.8 + rng() * 0.4)) {
      const w = 26 + rng() * 22;
      out.push({ x: -75 - rng() * 30, y: -1, z, rotY: rng() * Math.PI * 2, sx: w * unit, sy: (10 + rng() * 14) * unit * 1.4, sz: w * unit * 0.8 });
   }
   // sea stacks out on the ocean behind the wave
   for (let z = z0; z > z1; z -= (decor < 0.7 ? 150 : 95) * (0.8 + rng() * 0.4)) {
      const w = 12 + rng() * 10;
      out.push({ x: FACE_W + 60 + rng() * 60, y: -1, z, rotY: rng() * Math.PI * 2, sx: w * unit, sy: (14 + rng() * 10) * unit * 1.4, sz: w * unit });
   }
   // Nami's spray ledges: a cliff arch just behind the crest
   for (const z of course.arches) out.push({ x: FACE_W + 9, y: course.H - 3, z, rotY: Math.PI / 2, sx: 9 * unit, sy: 9 * unit * 1.2, sz: 7 * unit });
   // level 4's canyon: walls close on both sides of the wave
   if (course.canyon) {
      for (let z = course.canyon.z0; z > course.canyon.z1; z -= 22) {
         const j = rng();
         out.push({ x: -12 - j * 4, y: -2, z, rotY: rng() * Math.PI * 2, sx: (18 + j * 6) * unit, sy: 26 * unit * 1.4, sz: 16 * unit });
         out.push({ x: FACE_W + 22 + rng() * 5, y: -2, z: z - 11, rotY: rng() * Math.PI * 2, sx: (18 + j * 6) * unit, sy: 30 * unit * 1.4, sz: 16 * unit });
      }
   }
   return out;
}

export default function World({ course, seed }: { course: Course; seed: number }) {
   const quality = useQuality();
   const spots = useMemo(() => cliffSpots(course, seed, quality.decor), [course, seed, quality.decor]);
   return (
      <InstancedModel
         asset={ASSETS.cliff}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <boxGeometry args={[1.9, 1.3, 1.75]} />
               <meshStandardMaterial color={COLORS.reef} roughness={0.95} />
            </Instanced>
         }
      />
   );
}
