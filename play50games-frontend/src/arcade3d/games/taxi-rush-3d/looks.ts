// One palette and the chase camera. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type TaxiLevel } from "./levels";
import { BLOCK, HALF_STREET, INSET, PITCH as GRID, ROAD_HALF, STREET, U, citySize, streetX, streetZ, type Run } from "./rules";
import { FIT } from "./assets";

export const COLORS = {
   road: "#3d434c",
   roadLine: "#f1f5f9",
   edgeLine: "#e2e8f0",
   facadeA: "#ece4d6",
   facadeB: "#cdd7e2",
   facadeC: "#dcae92",
   roof: "#3f4a5a",
   sidewalk: "#cfd4da",
   sidewalkTrim: "#9aa3ad",
   headlight: "#fff7d6",
   tailLight: "#ff3b30",
   beam: "#fff3c4",
   arrow: "#facc15",
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
   dropPad: "#22c55e",
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
   carA: "#f8fafc",
   carB: "#38bdf8",
   carC: "#ef4444",
   carD: "#94a3b8",
   carE: "#2563eb",
   carF: "#16a34a",
   trunk: "#78350f",
   leaves: "#4d7c0f",
   court: "#65a30d",
   ground: "#1e293b",
} as const;

export const PITCH = (48 * Math.PI) / 180;
export const YAWS = [0.35] as const;
export const FOV = 46;
export const LOOK_AHEAD = 3 * U;
export const DAMPING = 4.5;
/** Half size of the street window the chase camera keeps on screen round its aim (a 29 x 29 m patch). */
export const WINDOW = 9 * U;

export function cityBox(level: TaxiLevel): AABB {
   const size = citySize(level);
   return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: size.x, y: 3 * U, z: size.z },
   };
}

export function lookAtFor(level: TaxiLevel): [number, number, number] {
   const size = citySize(level);
   return [size.x / 2, 0.6 * U, size.z / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A chase camera: a 29 x 29 m window round the aim (the cab plus 4.9 m of look-ahead) stays clear of the HUD and the stick. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      view = {
         area: { min: { x: -WINDOW, y: 0, z: -WINDOW }, max: { x: WINDOW, y: 2 * U, z: WINDOW } },
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
   return [level.background, 45 * U, 120 * U];
}

// ---------- the city around the streets (visual only; the rules' building boxes are the solids) ----------
//
// Triangle budget (assets.test.ts pins it at <= 250k per frame on every level): the Hyper3D GLBs are
// 1.5-3k triangles each, so they dress the playable blocks only, two per block (a corner shop and a
// townhouse, a bus stop once per level), and every other building cell is a code box (12 triangles,
// two tones and a window texture). The ring of blocks round the grid is code boxes only.
//
// Street cross-section (metres): a 6.5 m asphalt road (two 3.25 m lanes, ROAD_HALF either side of the
// centreline) between raised pavements that run to the facades (KERB high). The cab may still mount a
// pavement (the solids are the building boxes), the traffic never does.

/** Pavement height above the road. */
export const KERB = 0.14;
/** Pavement width from the kerb to the building box. */
export const PAVE = HALF_STREET + INSET - ROAD_HALF;
/** The waiting rider stands on the pavement this far from the pad's street centreline (1.1 m in from the kerb). */
export const RIDER_SIDE = ROAD_HALF + 1.1;

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
   /** the raised pavement of each block (kerb to facades), the courtyards */
   slabs: InstanceSpot[];
   courts: InstanceSpot[];
   /** road paint: centre dashes (two-way streets), one-way arrows (the traffic loop), solid edge lines, zebra crossings at the playable junctions */
   dashes: InstanceSpot[];
   arrows: InstanceSpot[];
   edges: InstanceSpot[];
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
   out.slabs.push({ x: x0 + size / 2, y: KERB / 2, z: z0 + size / 2, sx: size + 2 * PAVE, sy: KERB, sz: size + 2 * PAVE });
   out.courts.push({ x: x0 + size / 2, y: KERB + 0.005, z: z0 + size / 2, sx: size - 2 * SHOP_W + 0.4 * U, sy: 0.01, sz: size - 2 * SHOP_W + 0.4 * U });
   const shopCorner = Math.floor(rng() * 4);
   const houseCell = Math.floor(rng() * 8);
   const box = (cx: number, cz: number, w: number, d: number, h: number, quarter: boolean) => {
      const tone = Math.floor(rng() * 3);
      const sx = quarter ? d : w;
      const sz = quarter ? w : d;
      out.boxes[tone].push({ x: cx, y: KERB + h / 2, z: cz, sx, sy: h, sz });
      out.roofs.push({ x: cx, y: KERB + h + 0.1, z: cz, sx: sx + 0.2, sy: 0.2, sz: sz + 0.2 });
   };
   SIDES.forEach((side, k) => {
      const ex = x0 + side.ox * size;
      const ez = z0 + side.oz * size;
      const quarter = side.ax === 0;
      // the corner cell at the start of this side
      const cx = ex + side.ax * (SHOP_W / 2) + side.nx * (SHOP_W / 2);
      const cz = ez + side.az * (SHOP_W / 2) + side.nz * (SHOP_W / 2);
      if (glb && k === shopCorner) out.shops.push({ x: cx, y: KERB, z: cz, rotY: side.rotY, scale: FIT.shopHeight });
      else box(cx, cz, SHOP_W - 0.1 * U, SHOP_W - 0.1 * U, (2.2 + rng() * 0.9) * U, quarter);
      [size / 2 - HOUSE_W / 2 - 0.1 * U, size / 2 + HOUSE_W / 2 + 0.1 * U].forEach((along, m) => {
         const cell = k * 2 + m;
         const isGlb = glb && cell === houseCell;
         const isBus = isGlb && bus;
         const depth = isBus ? BUS_D : HOUSE_D;
         const x = ex + side.ax * along + side.nx * (depth / 2);
         const z = ez + side.az * along + side.nz * (depth / 2);
         if (isBus) out.busStops.push({ x, y: KERB, z, rotY: side.rotY, scale: FIT.busStopHeight });
         else if (isGlb) out.houses.push({ x, y: KERB, z, rotY: side.rotY, scale: FIT.houseHeight });
         else box(ex + side.ax * along + side.nx * (HOUSE_D / 2), ez + side.az * along + side.nz * (HOUSE_D / 2), HOUSE_W - 0.08 * U, HOUSE_D, (2.4 + rng() * 0.8) * U, quarter);
      });
      // a street lamp on the pavement, 0.7 m in from the kerb
      if (glb && k === (shopCorner + 2) % 4) out.lamps.push({ x: ex + side.ax * (size / 2) - side.nx * (PAVE - 0.7), y: KERB, z: ez + side.az * (size / 2) - side.nz * (PAVE - 0.7), rotY: side.rotY, scale: FIT.lampHeight });
   });
   if (glb) out.trees.push({ x: x0 + size / 2 + (rng() - 0.5) * U, y: KERB, z: z0 + size / 2 + (rng() - 0.5) * U, rotY: rng() * Math.PI * 2, scale: FIT.treeHeight * (0.85 + rng() * 0.3) });
}

const CITY = new Map<LevelId, CitySpots>();
/** Centre dashes: 3 m paint, 3 m gaps, between the zebra crossings. */
const DASH = 3;
/** Zebra crossings: 7 stripes across the road, 1.4 m long, between the kerb corner and the stop line. */
const ZEBRA_AT = ROAD_HALF + 0.8;

/** The playable blocks (GLB-dressed) plus a ring of code-box blocks round the grid (no void at the edges). */
export function citySpots(id: LevelId): CitySpots {
   let city = CITY.get(id);
   if (city) return city;
   const level = LEVELS[id];
   const rng = createRng(9100 + id);
   city = { houses: [], shops: [], busStops: [], lamps: [], trees: [], boxes: [[], [], []], roofs: [], slabs: [], courts: [], dashes: [], arrows: [], edges: [], zebras: [] };
   const size = BLOCK - INSET * 2;
   for (let r = -1; r <= level.blocksZ; r++) {
      for (let c = -1; c <= level.blocksX; c++) {
         const playable = r >= 0 && c >= 0 && r < level.blocksZ && c < level.blocksX;
         dressBlock(city, STREET + c * GRID + INSET, STREET + r * GRID + INSET, size, rng, playable, playable && r === 0 && c === 0);
      }
   }
   // road paint along every street segment between two junctions (the ring's streets included)
   // (four 3 m dashes 6 m apart: +-10.5 m round the segment's middle, clear of the zebras; edge lines from stop line to stop line)
   const mid = STREET + BLOCK / 2;
   const run = BLOCK;
   const dashes = [-1.5, -0.5, 0.5, 1.5].map((k) => k * DASH * 2);
   // the traffic loop's streets are one-way (one lane): arrows with the flow instead of a centre line
   const loopCol = (i: number, r: number) => (i === 0 || i === level.blocksX) && r >= 0 && r < level.blocksZ;
   const loopRow = (j: number, c: number) => (j === 0 || j === level.blocksZ) && c >= 0 && c < level.blocksX;
   for (let i = -1; i <= level.blocksX + 1; i++) {
      for (let r = -1; r <= level.blocksZ; r++) {
         const x = i * GRID + HALF_STREET;
         const z = r * GRID + mid;
         if (loopCol(i, r)) for (const t of [-6, 6]) city.arrows.push({ x, y: 0.016, z: z + t, rotY: i === 0 ? Math.PI : 0 });
         else for (const t of dashes) city.dashes.push({ x, y: 0.015, z: z + t, sx: 0.15, sy: 0.02, sz: DASH });
         for (const s of [-1, 1]) city.edges.push({ x: x + s * (ROAD_HALF - 0.3), y: 0.015, z, sx: 0.12, sy: 0.02, sz: run });
      }
   }
   for (let j = -1; j <= level.blocksZ + 1; j++) {
      for (let c = -1; c <= level.blocksX; c++) {
         const z = j * GRID + HALF_STREET;
         const x = c * GRID + mid;
         if (loopRow(j, c)) for (const t of [-6, 6]) city.arrows.push({ x: x + t, y: 0.016, z, rotY: j === 0 ? Math.PI / 2 : -Math.PI / 2 });
         else for (const t of dashes) city.dashes.push({ x: x + t, y: 0.015, z, sx: DASH, sy: 0.02, sz: 0.15 });
         for (const s of [-1, 1]) city.edges.push({ x, y: 0.015, z: z + s * (ROAD_HALF - 0.3), sx: run, sy: 0.02, sz: 0.12 });
      }
   }
   // zebra crossings on the four approaches of every playable junction, between the kerb corner and the stop line
   for (let j = 0; j <= level.blocksZ; j++) {
      for (let i = 0; i <= level.blocksX; i++) {
         const cx = i * GRID + HALF_STREET;
         const cz = j * GRID + HALF_STREET;
         for (const dir of [-1, 1]) {
            for (let k = -3; k <= 3; k++) {
               city.zebras.push({ x: cx + k * 0.9, y: 0.016, z: cz + dir * ZEBRA_AT, sx: 0.45, sy: 0.02, sz: 1.4 });
               city.zebras.push({ x: cx + dir * ZEBRA_AT, y: 0.016, z: cz + k * 0.9, sx: 1.4, sy: 0.02, sz: 0.45 });
            }
         }
      }
   }
   CITY.set(id, city);
   return city;
}

/** Two light poles per lit junction (the north-south signal on one corner, the east-west on the opposite one), on the pavement corners. */
export function lightPoles(run: Run): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const light of run.lights) {
      const cx = streetX(light.i);
      const cz = streetZ(light.j);
      const d = ROAD_HALF + 0.6;
      spots.push({ x: cx + d, y: KERB, z: cz - d, rotY: Math.PI, scale: FIT.lightHeight });
      spots.push({ x: cx - d, y: KERB, z: cz + d, rotY: -Math.PI / 2, scale: FIT.lightHeight });
   }
   return spots;
}

/** Two cones per lit junction, on the pavement corners the poles leave free. */
export function coneSpots(run: Run): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const light of run.lights) {
      const cx = streetX(light.i);
      const cz = streetZ(light.j);
      const d = ROAD_HALF + 0.5;
      spots.push({ x: cx + d, y: KERB, z: cz + d, scale: FIT.coneHeight });
      spots.push({ x: cx - d, y: KERB, z: cz - d, scale: FIT.coneHeight });
   }
   return spots;
}

/** A white stop bar across the incoming (right-hand) lane at every stop line of a lit junction. */
export function stopBars(run: Run): InstanceSpot[] {
   return run.stops.map((stop) => {
      const mid = (stop.span0 + stop.span1) / 2;
      const along = stop.coord - stop.into * 0.25;
      // the driver's right: heading +z has it at -x, +x has it at +z
      const side = stop.axis === 1 ? -stop.into : stop.into;
      const lane = mid + side * (ROAD_HALF / 2);
      return stop.axis === 0
         ? { x: along, y: 0.017, z: lane, sx: 0.5, sy: 0.02, sz: ROAD_HALF - 0.2 }
         : { x: lane, y: 0.017, z: along, sx: ROAD_HALF - 0.2, sy: 0.02, sz: 0.5 };
   });
}

/** Asphalt: a cool dark grey with a fine aggregate grain and faint patches (never black), drawn once. */
export function drawAsphalt(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = COLORS.road;
   ctx.fillRect(0, 0, w, h);
   for (let i = 0; i < 6; i++) {
      const v = Math.imul(i + 7, 2246822519) >>> 0;
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)";
      ctx.beginPath();
      ctx.ellipse(v % w, (v >>> 9) % h, 20 + (v % 30), 12 + ((v >>> 5) % 20), (v % 314) / 100, 0, Math.PI * 2);
      ctx.fill();
   }
   for (let i = 0; i < 3200; i++) {
      const v = Math.imul(i + 1, 2654435761) >>> 0;
      ctx.fillStyle = v % 3 === 0 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.07)";
      ctx.fillRect(v % w, (v >>> 8) % h, 1 + (v % 2), 1 + ((v >>> 4) % 2));
   }
}

/** Pavement: light concrete slabs with thin joints, 4 x 4 per tile, drawn once. */
export function drawPaving(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = "#ffffff";
   ctx.fillRect(0, 0, w, h);
   for (let i = 0; i < 900; i++) {
      const v = Math.imul(i + 3, 2654435761) >>> 0;
      ctx.fillStyle = v % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.4)";
      ctx.fillRect(v % w, (v >>> 8) % h, 2, 2);
   }
   ctx.fillStyle = "rgba(15,23,42,0.22)";
   for (let k = 0; k < 4; k++) {
      ctx.fillRect(0, (k * h) / 4, w, 2);
      ctx.fillRect((k * w) / 4, 0, 2, h);
   }
}

/** A facade: a light wall with two floors of framed windows, a cornice line and a base band, drawn once (code buildings). */
export function drawFacade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = "#ffffff";
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "rgba(15,23,42,0.2)";
   ctx.fillRect(0, h * 0.86, w, h * 0.14);
   ctx.fillStyle = "rgba(15,23,42,0.12)";
   ctx.fillRect(0, h * 0.04, w, h * 0.04);
   for (const fy of [0.16, 0.5]) {
      for (let k = 0; k < 3; k++) {
         const x = w * (0.12 + k * 0.29);
         ctx.fillStyle = "rgba(255,255,255,0.9)";
         ctx.fillRect(x - 2, h * fy - 2, w * 0.18 + 4, h * 0.22 + 4);
         ctx.fillStyle = "rgba(30,41,59,0.8)";
         ctx.fillRect(x, h * fy, w * 0.18, h * 0.22);
         ctx.fillStyle = "rgba(148,197,255,0.35)";
         ctx.fillRect(x + 2, h * fy + 2, w * 0.07, h * 0.08);
      }
   }
}
