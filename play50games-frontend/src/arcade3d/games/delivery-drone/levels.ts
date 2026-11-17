// Delivery Drone's five levels: pure data, no React (docs/arcade-levels.md §6.3).
// Level 1 is today's 12-delivery route, unchanged (dev game, but rules.test.ts and the
// approved limits pin that route). Levels 2-5 stack the plan's hazard knobs on top of it
// and add deliveries, so a harder level is worth at least as many points. Each level has its
// own district (`map`): which cells are open parks or plazas, how tall the blocks are, where the
// towers stand, and its own look (looks.ts THEMES: sky, light, facades, rooftop props).
import type { LevelId } from "@/arcade3d/types";

export type DroneTheme = "training" | "residential" | "downtown" | "windy" | "night";

/** One level's district. Cells are row * 8 + col (row 0 = north, z -26.25; col 0 = west). */
export interface DroneMap {
   theme: DroneTheme;
   /** roof heights an ordinary block draws from, as CITY.roofs indexes, picked uniformly per block */
   roofPick: readonly [number, number, number];
   /** cells left open as parks / plazas besides the four depot cells (no building, no collision) */
   open: readonly number[];
   /** cells a tower prefers (tried first, in seeded order); the rest of the towers come from anywhere */
   towerCells: readonly number[];
   /** drawn tower height (m). The rules' towers are walls at every flight height (CITY.towerHeight 16) */
   towerVisual: number;
}

const ring = (rows: readonly number[], cols: readonly number[]) => rows.flatMap((r) => cols.map((c) => r * 8 + c));

export interface DroneLevel {
   /** successful drops that win the route */
   count: number;
   /** how many of those drops sit in each distance band: [10,18), [18,25), [25,35] */
   bands: readonly [number, number, number];
   /** played seconds before the run ends "timeup" */
   ceiling: number;
   towers: number;
   /** pad radius in metres; precision 100 is the roof centre, 0 is this rim */
   padRadius: number;
   /** played seconds before the two wind zones push the drone */
   windFrom: number;
   windAccel: number;
   pigeons: number;
   pigeonInitial: number;
   pigeonMiddle: number;
   pigeonMiddleFrom: number;
   pigeonFinalFrom: number;
   /** a parcel loaded when `completed` is at least this is fragile */
   fragileFrom: number;
   fragilePrecision: number;
   /** battery units lost per played second */
   drain: number;
   /** battery at the start, and the cap after a successful drop's recharge */
   battery: number;
   map: DroneMap;
}

export const MAPS: Record<LevelId, DroneMap> = {
   // today's city: mixed blocks, towers anywhere
   1: { theme: "training", roofPick: [0, 1, 2], open: [], towerCells: [], towerVisual: 16 },
   // low houses round four pocket parks; four apartment towers stand on the corners round the depot (tight turns home)
   2: { theme: "residential", roofPick: [0, 0, 1], open: [9, 14, 49, 54], towerCells: [18, 21, 42, 45], towerVisual: 16 },
   // tall offices, a civic square north of the depot, a skyscraper cluster in the north-east
   3: { theme: "downtown", roofPick: [1, 2, 2], open: [19, 20], towerCells: ring([0, 1, 2], [5, 6, 7]), towerVisual: 24 },
   // two tower walls (cols 1 and 6) make wind canyons along the north-south avenues
   4: { theme: "windy", roofPick: [0, 1, 2], open: [], towerCells: ring([0, 1, 2, 5, 6, 7], [1, 6]), towerVisual: 28 },
   // the night city: a lit plaza on each side of the depot, towers on the diagonals
   5: { theme: "night", roofPick: [0, 1, 2], open: [26, 29], towerCells: [0, 7, 56, 63, 9, 14, 49, 54, 18, 21, 42, 45], towerVisual: 20 },
};

export const LEVELS: Record<LevelId, DroneLevel> = {
   // today's game
   1: {
      count: 12, bands: [4, 4, 4], ceiling: 180, towers: 8, padRadius: 1.25,
      windFrom: 60, windAccel: 1.5,
      pigeons: 6, pigeonInitial: 2, pigeonMiddle: 4, pigeonMiddleFrom: 60, pigeonFinalFrom: 120,
      fragileFrom: 8, fragilePrecision: 40, drain: 1, battery: 100, map: MAPS[1],
   },
   // tighter pads, wind and the second pigeon wave a quarter-minute sooner, one extra near drop
   2: {
      count: 13, bands: [5, 4, 4], ceiling: 200, towers: 9, padRadius: 1.125,
      windFrom: 45, windAccel: 1.5,
      pigeons: 6, pigeonInitial: 2, pigeonMiddle: 4, pigeonMiddleFrom: 45, pigeonFinalFrom: 110,
      fragileFrom: 8, fragilePrecision: 40, drain: 1, battery: 100, map: MAPS[2],
   },
   // two extra birds, and both the flock and the wind arrive at 30 s
   3: {
      count: 14, bands: [5, 5, 4], ceiling: 220, towers: 10, padRadius: 1.125,
      windFrom: 30, windAccel: 2,
      pigeons: 8, pigeonInitial: 3, pigeonMiddle: 5, pigeonMiddleFrom: 30, pigeonFinalFrom: 80,
      fragileFrom: 7, fragilePrecision: 40, drain: 1, battery: 100, map: MAPS[3],
   },
   // fragile cargo, gusts of 2.5 and a faster drain; the battery cap rises so a clean route still fits
   4: {
      count: 15, bands: [5, 5, 5], ceiling: 240, towers: 10, padRadius: 1,
      windFrom: 30, windAccel: 2.5,
      pigeons: 8, pigeonInitial: 3, pigeonMiddle: 6, pigeonMiddleFrom: 30, pigeonFinalFrom: 70,
      fragileFrom: 5, fragilePrecision: 50, drain: 1.25, battery: 160, map: MAPS[4],
   },
   // densest route, at night: lit windows, street lamps and glowing pads
   5: {
      count: 16, bands: [6, 5, 5], ceiling: 270, towers: 11, padRadius: 1,
      windFrom: 20, windAccel: 2.5,
      pigeons: 8, pigeonInitial: 4, pigeonMiddle: 6, pigeonMiddleFrom: 20, pigeonFinalFrom: 60,
      fragileFrom: 4, fragilePrecision: 50, drain: 1.5, battery: 230, map: MAPS[5],
   },
};
