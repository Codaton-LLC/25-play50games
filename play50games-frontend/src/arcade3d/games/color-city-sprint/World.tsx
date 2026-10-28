"use client";

// The world round the playable city: a ring of non-colliding pastel rows and glass towers (the rest
// of Ember Heights' street city, drained grey), the volcano's glow on the horizon, the level's
// hemisphere tint and moon/sun. The shell's lighting preset (look.ts) does the main light; the
// streets are Course.tsx.
import { useMemo } from "react";
import { InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE, PASTEL_SCALE, TOWER_SCALE } from "./assets";
import { LOOKS } from "./look";
import type { Course } from "./city";

function hash(a: number, b: number): number {
   let h = (a * 374761393) ^ (b * 668265263);
   h = (h ^ (h >>> 13)) * 1274126177;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Backdrop spots: rows of buildings 8-40 m outside the city on every side. */
export function backdropSpots(c: Course): { rows: InstanceSpot[]; towers: InstanceSpot[] } {
   const rows: InstanceSpot[] = [];
   const towers: InstanceSpot[] = [];
   const cx = (c.minX + c.maxX) / 2;
   const cz = (c.minZ + c.maxZ) / 2;
   const hw = (c.maxX - c.minX) / 2;
   const hd = (c.maxZ - c.minZ) / 2;
   const rowW = GLB_SIZE.pastel.x * PASTEL_SCALE;
   for (let ring = 0; ring < 2; ring++) {
      const gap = 6 + ring * 16;
      const sides = [
         { ox: 0, oz: -1, len: hw * 2 + gap * 2, yaw: 0 },
         { ox: 0, oz: 1, len: hw * 2 + gap * 2, yaw: Math.PI },
         { ox: -1, oz: 0, len: hd * 2 + gap * 2, yaw: Math.PI / 2 },
         { ox: 1, oz: 0, len: hd * 2 + gap * 2, yaw: -Math.PI / 2 },
      ];
      sides.forEach((s, si) => {
         const n = Math.ceil(s.len / (rowW + 1));
         for (let k = 0; k < n; k++) {
            const t = -s.len / 2 + (k + 0.5) * (s.len / n);
            const r = hash(k + ring * 31, si);
            const x = cx + (s.ox !== 0 ? s.ox * (hw + gap) : t);
            const z = cz + (s.oz !== 0 ? s.oz * (hd + gap) : t);
            if (ring === 1 && r < 0.45) {
               towers.push({ x, y: 0, z, rotY: s.yaw, sx: TOWER_SCALE * 1.1, sy: TOWER_SCALE * (1.4 + r * 1.6), sz: TOWER_SCALE * 1.1 });
            } else {
               rows.push({ x, y: 0, z, rotY: s.yaw, sx: PASTEL_SCALE, sy: PASTEL_SCALE * (1.7 + r * (ring === 0 ? 0.8 : 1.6)), sz: PASTEL_SCALE });
            }
         }
      });
   }
   return { rows, towers };
}

export function World({ course }: { course: Course }) {
   const look = LOOKS[course.id];
   const spots = useMemo(() => backdropSpots(course), [course]);
   const cx = (course.minX + course.maxX) / 2;
   const cz = (course.minZ + course.maxZ) / 2;
   return (
      <group>
         <hemisphereLight color={look.hemiSky} groundColor={look.hemiGround} intensity={look.hemi} />
         <directionalLight position={[cx + 30, 45, cz - 20]} intensity={look.sunI * 0.35} color={look.sun} />
         <InstancedModel asset={ASSETS.pastel} spots={spots.rows} fallback={null} />
         <InstancedModel asset={ASSETS.tower} spots={spots.towers} fallback={null} />
         {/* the volcano's ember glow low on the far horizon */}
         <mesh position={[cx, 14, cz - 150]}>
            <planeGeometry args={[420, 60]} />
            <meshBasicMaterial color={look.lighting === "night" ? "#7c2d12" : "#fb923c"} transparent opacity={look.lighting === "night" ? 0.35 : 0.18} depthWrite={false} fog={false} />
         </mesh>
      </group>
   );
}
