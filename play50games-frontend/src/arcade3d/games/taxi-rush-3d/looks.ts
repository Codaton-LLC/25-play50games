// One palette and the chase camera. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type TaxiLevel } from "./levels";
import { BLOCK, HALF_STREET, INSET, PITCH as GRID, STREET, citySize, streetX, streetZ, type Run } from "./rules";
import { FIT } from "./assets";

export const COLORS = {
   road: "#334155",
   roadLine: "#cbd5e1",
   sidewalk: "#94a3b8",
   sidewalkTrim: "#64748b",
   building: "#e7e5e4",
   buildingTrim: "#cbd5e1",
   shop: "#f8fafc",
   shopAwning: "#0f172a",
   taxi: "#facc15",
   taxiDark: "#a16207",
   window: "#0f172a",
   wheel: "#1e293b",
   sign: "#f8fafc",
   pad: "#facc15",
   bulbRed: "#ef4444",
   bulbGreen: "#22c55e",
   cone: "#f97316",
   coneBand: "#f8fafc",
   pole: "#334155",
   bench: "#92400e",
   benchSlat: "#d6d3d1",
   lamp: "#e2e8f0",
   lampHead: "#fef9c3",
   bus: "#1d4ed8",
   busTrim: "#dbeafe",
   rider: "#e7e5e4",
   riderTrim: "#44403c",
   skin: "#f1d0b4",
   carA: "#e2e8f0",
   carB: "#38bdf8",
   carC: "#fb7185",
   trunk: "#78350f",
   leaves: "#4d7c0f",
   court: "#65a30d",
   ground: "#1e293b",
} as const;

export const PITCH = (48 * Math.PI) / 180;
export const YAWS = [0.35] as const;
export const FOV = 46;
export const LOOK_AHEAD = 3;
export const DAMPING = 4.5;
/** Half size of the street window the chase camera keeps on screen round its aim (an 18 x 18 m patch). */
export const WINDOW = 9;

export function cityBox(level: TaxiLevel): AABB {
   const size = citySize(level);
   return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: size.x, y: 3, z: size.z },
   };
}

export function lookAtFor(level: TaxiLevel): [number, number, number] {
   const size = citySize(level);
   return [size.x / 2, 0.6, size.z / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A chase camera: an 18 x 18 m window round the aim (the cab plus 3 m of look-ahead) stays clear of the HUD and the stick. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      view = {
         area: { min: { x: -WINDOW, y: 0, z: -WINDOW }, max: { x: WINDOW, y: 2, z: WINDOW } },
         pitch: PITCH,
         yaws: YAWS,
         margin: { top: 0.04, right: 0.03, bottom: 0.06, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

export function skyFor(level: TaxiLevel): { top: string; bottom: string } {
   if (level.lighting === "night") return { top: "#020617", bottom: "#1e293b" };
   if (level.lighting === "sunset") return { top: "#fb923c", bottom: "#fed7aa" };
   return { top: "#38bdf8", bottom: "#e0f2fe" };
}

/** Fog from beyond the chase window to past the ring of blocks round the grid. */
export function fogFor(level: TaxiLevel): [string, number, number] {
   return [level.background, 45, 120];
}

// ---------- the city around the streets (visual only; the rules' building boxes are the solids) ----------

export interface CitySpots {
   houses: InstanceSpot[];
   shops: InstanceSpot[];
   busStops: InstanceSpot[];
   lamps: InstanceSpot[];
   trees: InstanceSpot[];
   /** the raised pavement slab of each block (x, z, size in sx / sz) */
   slabs: InstanceSpot[];
   courts: InstanceSpot[];
   /** road centre dashes */
   dashes: InstanceSpot[];
}

/** The four sides of a block: the outward normal's yaw (a model's front is +z), the edge start and the along direction. */
const SIDES = [
   { rotY: Math.PI, ox: 0, oz: 0, ax: 1, az: 0, nx: 0, nz: 1 }, // south edge (z = z0), facing -z, depth into +z
   { rotY: Math.PI / 2, ox: 1, oz: 0, ax: 0, az: 1, nx: -1, nz: 0 }, // east edge (x = x1), facing +x
   { rotY: 0, ox: 1, oz: 1, ax: -1, az: 0, nx: 0, nz: -1 }, // north edge (z = z1), facing +z
   { rotY: -Math.PI / 2, ox: 0, oz: 1, ax: 0, az: -1, nx: 1, nz: 0 }, // west edge (x = x0), facing -x
] as const;

/**
 * One block's buildings, flush with its building box (the rules' AABB): a corner shop on each corner, two
 * townhouses (or a house and a bus stop) along the middle of each side, a lamp between them on the
 * pavement edge, and a courtyard with a tree. Every spot's scale is the piece's height (1 m fits).
 */
function dressBlock(out: CitySpots, x0: number, z0: number, size: number, rng: () => number): void {
   const shopW = FIT.shopHeight * (1.9053 / 1.2808);
   const houseW = FIT.houseHeight * (1.5529 / 1.8983);
   const houseD = FIT.houseHeight * (1.6696 / 1.8983);
   const busD = FIT.busStopHeight * (1.0217 / 1.239);
   out.slabs.push({ x: x0 + size / 2, y: 0.06, z: z0 + size / 2, sx: size + 0.3, sy: 0.12, sz: size + 0.3 });
   out.courts.push({ x: x0 + size / 2, y: 0.125, z: z0 + size / 2, sx: size - 2 * shopW + 0.4, sy: 0.01, sz: size - 2 * shopW + 0.4 });
   out.trees.push({ x: x0 + size / 2 + (rng() - 0.5), y: 0.12, z: z0 + size / 2 + (rng() - 0.5), rotY: rng() * Math.PI * 2, scale: FIT.treeHeight * (0.85 + rng() * 0.3) });
   const busSide = Math.floor(rng() * 4);
   SIDES.forEach((side, k) => {
      const ex = x0 + side.ox * size;
      const ez = z0 + side.oz * size;
      // corner shop at the start of this side, its front on this side
      out.shops.push({ x: ex + side.ax * (shopW / 2) + side.nx * (shopW / 2), y: 0.12, z: ez + side.az * (shopW / 2) + side.nz * (shopW / 2), rotY: side.rotY, scale: FIT.shopHeight });
      const mid = [size / 2 - houseW / 2 - 0.1, size / 2 + houseW / 2 + 0.1];
      mid.forEach((along, m) => {
         const bus = k === busSide && m === 1;
         // a house is 0.92-1.0 of the nominal height, so it never grows past its slot
         const scale = bus ? FIT.busStopHeight : FIT.houseHeight * (0.92 + rng() * 0.08);
         const depth = bus ? busD : houseD * (scale / FIT.houseHeight);
         out[bus ? "busStops" : "houses"].push({
            x: ex + side.ax * along + side.nx * (depth / 2),
            y: 0.12,
            z: ez + side.az * along + side.nz * (depth / 2),
            rotY: side.rotY,
            scale,
         });
      });
      out.lamps.push({ x: ex + side.ax * (size / 2) - side.nx * 0.15, y: 0, z: ez + side.az * (size / 2) - side.nz * 0.15, rotY: side.rotY, scale: FIT.lampHeight });
   });
}

const CITY = new Map<LevelId, CitySpots>();

/** The playable blocks plus a ring of blocks round the grid (so the streets never end in a void). */
export function citySpots(id: LevelId): CitySpots {
   let city = CITY.get(id);
   if (city) return city;
   const level = LEVELS[id];
   const rng = createRng(9100 + id);
   city = { houses: [], shops: [], busStops: [], lamps: [], trees: [], slabs: [], courts: [], dashes: [] };
   const size = BLOCK - INSET * 2;
   for (let r = -1; r <= level.blocksZ; r++) {
      for (let c = -1; c <= level.blocksX; c++) {
         dressBlock(city, STREET + c * GRID + INSET, STREET + r * GRID + INSET, size, rng);
      }
   }
   // dashes along every street, the ring's streets included
   for (let i = -1; i <= level.blocksX + 1; i++) {
      for (let r = -1; r <= level.blocksZ; r++) city.dashes.push({ x: i * GRID + HALF_STREET, y: 0.015, z: STREET + r * GRID + BLOCK / 2, sx: 0.14, sy: 0.02, sz: 2.2 });
   }
   for (let j = -1; j <= level.blocksZ + 1; j++) {
      for (let c = -1; c <= level.blocksX; c++) city.dashes.push({ x: STREET + c * GRID + BLOCK / 2, y: 0.015, z: j * GRID + HALF_STREET, sx: 2.2, sy: 0.02, sz: 0.14 });
   }
   CITY.set(id, city);
   return city;
}

/** Two light poles per lit junction (the north-south signal on one corner, the east-west on the opposite one). */
export function lightPoles(run: Run): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const light of run.lights) {
      const cx = streetX(light.i);
      const cz = streetZ(light.j);
      const d = HALF_STREET + 0.25;
      spots.push({ x: cx + d, y: 0, z: cz - d, rotY: Math.PI, scale: FIT.lightHeight });
      spots.push({ x: cx - d, y: 0, z: cz + d, rotY: -Math.PI / 2, scale: FIT.lightHeight });
   }
   return spots;
}

/** Cones at both ends of every stop line, on the road's edge. */
export function coneSpots(run: Run): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const stop of run.stops) {
      for (const end of [stop.span0 + 0.3, stop.span1 - 0.3]) {
         spots.push({ x: stop.axis === 0 ? stop.coord : end, y: 0, z: stop.axis === 0 ? end : stop.coord, scale: FIT.coneHeight });
      }
   }
   return spots;
}
