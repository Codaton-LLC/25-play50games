// Which building stands on which block, and how tall (pure, three-free): Course.tsx draws it, the
// orbit camera's solids use its heights. Each block's look is fixed per level (a hash), never per run.
// Kept low (a street city, 5-11 m) so the default camera sees over most roofs to plan a route.
import { GLB_SIZE, BLOCK_W, BRICK_SCALE, PASTEL_SCALE, TOWER_SCALE } from "./assets";
import type { Course } from "./city";

export interface BuildingSpot {
   x: number;
   z: number;
   yaw: number;
   sx: number;
   sy: number;
   sz: number;
   /** the block it stands on (index into course.blocks) */
   block: number;
}

export interface Skyline {
   pastel: BuildingSpot[];
   tower: BuildingSpot[];
   brick: BuildingSpot[];
   /** per block: the drawn height (m), 0 for open blocks */
   height: number[];
}

export function blockHash(a: number, b: number, c: number): number {
   let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
   h = (h ^ (h >>> 13)) * 1274126177;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function buildSkyline(c: Course): Skyline {
   const pastel: BuildingSpot[] = [];
   const tower: BuildingSpot[] = [];
   const brick: BuildingSpot[] = [];
   const height = c.blocks.map(() => 0);
   c.blocks.forEach((b, i) => {
      if (b.kind !== "building" && b.kind !== "ghost") return;
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const r = blockHash(b.bx, b.bz, c.id);
      const tall = 1 + blockHash(b.bz, b.bx, c.id * 7) * 0.45;
      if (b.kind === "ghost" || r < 0.6) {
         const d = GLB_SIZE.pastel.z * PASTEL_SCALE;
         const t2 = tall * 0.9 + 0.05;
         pastel.push({ x: cx, z: b.z1 - d / 2, yaw: 0, sx: PASTEL_SCALE, sy: PASTEL_SCALE * tall, sz: PASTEL_SCALE, block: i });
         pastel.push({ x: cx, z: b.z0 + d / 2, yaw: Math.PI, sx: PASTEL_SCALE, sy: PASTEL_SCALE * t2, sz: PASTEL_SCALE, block: i });
         height[i] = GLB_SIZE.pastel.y * PASTEL_SCALE * Math.max(tall, t2);
      } else if (r < 0.82) {
         const sy = TOWER_SCALE * (0.72 + tall * 0.18);
         tower.push({ x: cx, z: cz, yaw: (Math.floor(r * 40) % 4) * (Math.PI / 2), sx: TOWER_SCALE, sy, sz: BLOCK_W / GLB_SIZE.tower.z, block: i });
         height[i] = GLB_SIZE.tower.y * sy;
      } else {
         const sy = BRICK_SCALE * 1.8;
         brick.push({ x: cx, z: cz, yaw: (Math.floor(r * 40) % 4) * (Math.PI / 2), sx: BRICK_SCALE, sy, sz: BRICK_SCALE, block: i });
         height[i] = GLB_SIZE.brick.y * sy;
      }
   });
   return { pastel, tower, brick, height };
}
