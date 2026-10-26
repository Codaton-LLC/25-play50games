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
   road: "#3a3f47",
   roadLine: "#e2e8f0",
   facadeA: "#e7dccb",
   facadeB: "#c9d3dd",
   facadeC: "#d6a58a",
   roof: "#475569",
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
//
// Triangle budget (assets.test.ts pins it at <= 250k per frame on every level): the Hyper3D GLBs are
// 1.5-3k triangles each, so they dress the playable blocks only, two per block (a corner shop and a
// townhouse, a bus stop once per level), and every other building cell is a code box (12 triangles,
// two tones and a window texture). The ring of blocks round the grid is code boxes only.

export interface CitySpots {
   /** GLB pieces (playable blocks) */
   houses: InstanceSpot[];
   shops: InstanceSpot[];
   busStops: InstanceSpot[];
   lamps: InstanceSpot[];
   trees: InstanceSpot[];
   /** code buildings in three facade colours (bodies sized by sx / sy / sz) and their roof caps */
   boxes: [InstanceSpot[], InstanceSpot[], InstanceSpot[]];
   roofs: InstanceSpot[];
   /** the raised pavement slab of each block, the courtyards */
   slabs: InstanceSpot[];
   courts: InstanceSpot[];
   /** road paint: centre dashes, zebra crossings at the playable junctions */
   dashes: InstanceSpot[];
   zebras: InstanceSpot[];
}

/** The four sides of a block: the outward normal's yaw (a model's front is +z), the edge start, the along direction, the inward normal. */
const SIDES = [
   { rotY: Math.PI, ox: 0, oz: 0, ax: 1, az: 0, nx: 0, nz: 1 },
   { rotY: Math.PI / 2, ox: 1, oz: 0, ax: 0, az: 1, nx: -1, nz: 0 },
   { rotY: 0, ox: 1, oz: 1, ax: -1, az: 0, nx: 0, nz: -1 },
   { rotY: -Math.PI / 2, ox: 0, oz: 1, ax: 0, az: -1, nx: 1, nz: 0 },
] as const;

const SHOP_W = FIT.shopHeight * (1.9053 / 1.2808);
const HOUSE_W = FIT.houseHeight * (1.5529 / 1.8983);
const HOUSE_D = FIT.houseHeight * (1.6696 / 1.8983);
const BUS_D = FIT.busStopHeight * (1.0217 / 1.239);

/**
 * One block: 12 building cells flush with its building box (4 corners, 2 along the middle of each side).
 * `glb`: a corner shop and a townhouse (or the level's bus stop) are GLBs, the other 10 cells are code
 * boxes; a ring block is 12 code boxes. A lamp and a courtyard tree on playable blocks only.
 */
function dressBlock(out: CitySpots, x0: number, z0: number, size: number, rng: () => number, glb: boolean, bus: boolean): void {
   out.slabs.push({ x: x0 + size / 2, y: 0.06, z: z0 + size / 2, sx: size + 0.3, sy: 0.12, sz: size + 0.3 });
   out.courts.push({ x: x0 + size / 2, y: 0.125, z: z0 + size / 2, sx: size - 2 * SHOP_W + 0.4, sy: 0.01, sz: size - 2 * SHOP_W + 0.4 });
   const shopCorner = Math.floor(rng() * 4);
   const houseCell = Math.floor(rng() * 8);
   const box = (cx: number, cz: number, w: number, d: number, h: number, quarter: boolean) => {
      const tone = Math.floor(rng() * 3);
      const sx = quarter ? d : w;
      const sz = quarter ? w : d;
      out.boxes[tone].push({ x: cx, y: 0.12 + h / 2, z: cz, sx, sy: h, sz });
      out.roofs.push({ x: cx, y: 0.12 + h + 0.06, z: cz, sx: sx + 0.12, sy: 0.12, sz: sz + 0.12 });
   };
   SIDES.forEach((side, k) => {
      const ex = x0 + side.ox * size;
      const ez = z0 + side.oz * size;
      const quarter = side.ax === 0;
      // the corner cell at the start of this side
      const cx = ex + side.ax * (SHOP_W / 2) + side.nx * (SHOP_W / 2);
      const cz = ez + side.az * (SHOP_W / 2) + side.nz * (SHOP_W / 2);
      if (glb && k === shopCorner) out.shops.push({ x: cx, y: 0.12, z: cz, rotY: side.rotY, scale: FIT.shopHeight });
      else box(cx, cz, SHOP_W - 0.1, SHOP_W - 0.1, 2.2 + rng() * 0.9, quarter);
      [size / 2 - HOUSE_W / 2 - 0.1, size / 2 + HOUSE_W / 2 + 0.1].forEach((along, m) => {
         const cell = k * 2 + m;
         const isGlb = glb && cell === houseCell;
         const isBus = isGlb && bus;
         const depth = isBus ? BUS_D : HOUSE_D;
         const x = ex + side.ax * along + side.nx * (depth / 2);
         const z = ez + side.az * along + side.nz * (depth / 2);
         if (isBus) out.busStops.push({ x, y: 0.12, z, rotY: side.rotY, scale: FIT.busStopHeight });
         else if (isGlb) out.houses.push({ x, y: 0.12, z, rotY: side.rotY, scale: FIT.houseHeight });
         else box(ex + side.ax * along + side.nx * (HOUSE_D / 2), ez + side.az * along + side.nz * (HOUSE_D / 2), HOUSE_W - 0.08, HOUSE_D, 2.4 + rng() * 0.8, quarter);
      });
      if (glb && k === (shopCorner + 2) % 4) out.lamps.push({ x: ex + side.ax * (size / 2) - side.nx * 0.15, y: 0, z: ez + side.az * (size / 2) - side.nz * 0.15, rotY: side.rotY, scale: FIT.lampHeight });
   });
   if (glb) out.trees.push({ x: x0 + size / 2 + (rng() - 0.5), y: 0.12, z: z0 + size / 2 + (rng() - 0.5), rotY: rng() * Math.PI * 2, scale: FIT.treeHeight * (0.85 + rng() * 0.3) });
}

const CITY = new Map<LevelId, CitySpots>();

/** The playable blocks (GLB-dressed) plus a ring of code-box blocks round the grid (no void at the edges). */
export function citySpots(id: LevelId): CitySpots {
   let city = CITY.get(id);
   if (city) return city;
   const level = LEVELS[id];
   const rng = createRng(9100 + id);
   city = { houses: [], shops: [], busStops: [], lamps: [], trees: [], boxes: [[], [], []], roofs: [], slabs: [], courts: [], dashes: [], zebras: [] };
   const size = BLOCK - INSET * 2;
   for (let r = -1; r <= level.blocksZ; r++) {
      for (let c = -1; c <= level.blocksX; c++) {
         const playable = r >= 0 && c >= 0 && r < level.blocksZ && c < level.blocksX;
         dressBlock(city, STREET + c * GRID + INSET, STREET + r * GRID + INSET, size, rng, playable, playable && r === 0 && c === 0);
      }
   }
   // centre dashes along every street segment (the ring's streets included): three 1.6 m dashes per block
   for (let i = -1; i <= level.blocksX + 1; i++) {
      for (let r = -1; r <= level.blocksZ; r++) for (const t of [-4.5, 0, 4.5]) city.dashes.push({ x: i * GRID + HALF_STREET, y: 0.015, z: STREET + r * GRID + BLOCK / 2 + t, sx: 0.16, sy: 0.02, sz: 1.6 });
   }
   for (let j = -1; j <= level.blocksZ + 1; j++) {
      for (let c = -1; c <= level.blocksX; c++) for (const t of [-4.5, 0, 4.5]) city.dashes.push({ x: STREET + c * GRID + BLOCK / 2 + t, y: 0.015, z: j * GRID + HALF_STREET, sx: 1.6, sy: 0.02, sz: 0.16 });
   }
   // zebra crossings on the four approaches of every playable junction, just outside the junction square
   for (let j = 0; j <= level.blocksZ; j++) {
      for (let i = 0; i <= level.blocksX; i++) {
         const cx = i * GRID + HALF_STREET;
         const cz = j * GRID + HALF_STREET;
         for (const dir of [-1, 1]) {
            for (let k = -2; k <= 2; k++) {
               city.zebras.push({ x: cx + k * 1.1, y: 0.016, z: cz + dir * (HALF_STREET + 1.1), sx: 0.55, sy: 0.02, sz: 1.6 });
               city.zebras.push({ x: cx + dir * (HALF_STREET + 1.1), y: 0.016, z: cz + k * 1.1, sx: 1.6, sy: 0.02, sz: 0.55 });
            }
         }
      }
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

/** Two cones per lit junction, on the corners the poles leave free. */
export function coneSpots(run: Run): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const light of run.lights) {
      const cx = streetX(light.i);
      const cz = streetZ(light.j);
      const d = HALF_STREET + 0.2;
      spots.push({ x: cx + d, y: 0, z: cz + d, scale: FIT.coneHeight });
      spots.push({ x: cx - d, y: 0, z: cz - d, scale: FIT.coneHeight });
   }
   return spots;
}

/** A white stop bar on the road at every stop line of a lit junction. */
export function stopBars(run: Run): InstanceSpot[] {
   return run.stops.map((stop) => {
      const mid = (stop.span0 + stop.span1) / 2;
      const along = stop.coord - stop.into * 0.2;
      return stop.axis === 0
         ? { x: along, y: 0.017, z: mid, sx: 0.35, sy: 0.02, sz: stop.span1 - stop.span0 - 0.4 }
         : { x: mid, y: 0.017, z: along, sx: stop.span1 - stop.span0 - 0.4, sy: 0.02, sz: 0.35 };
   });
}

/** Asphalt: a dark grey with a fine grain (never black), drawn once. */
export function drawAsphalt(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = COLORS.road;
   ctx.fillRect(0, 0, w, h);
   for (let i = 0; i < 2200; i++) {
      const v = Math.imul(i + 1, 2654435761) >>> 0;
      ctx.fillStyle = v % 3 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.12)";
      ctx.fillRect(v % w, (v >>> 8) % h, 1 + (v % 2), 1 + ((v >>> 4) % 2));
   }
}

/** A facade: a light wall with two floors of dark windows and a base band, drawn once (code buildings). */
export function drawFacade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = "#ffffff";
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "rgba(15,23,42,0.18)";
   ctx.fillRect(0, h * 0.86, w, h * 0.14);
   ctx.fillStyle = "rgba(30,41,59,0.78)";
   for (const fy of [0.16, 0.5]) for (let k = 0; k < 3; k++) ctx.fillRect(w * (0.12 + k * 0.29), h * fy, w * 0.18, h * 0.22);
}
