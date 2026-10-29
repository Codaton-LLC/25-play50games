// Construction Worker's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One building site, five configurations of the same three buildings (36 pieces, 240 s). Level 1 is
// today's game and must never change: gusts only on the tower (building 3), wind 3 m/s² for 1 s of
// every 7, today's landing bands, today's stability costs. levels.test.ts pins it.
//
// The level brief proposed a 3-piece level 1 with today's full shift as level 5; level 1 must stay
// today's game, so every level is the full shift and a harder level makes the same work harder: the
// wind gusts from an earlier building, blow harder and more often, the landing bands shrink and good
// or ok landings cost more stability (a miss still costs 12, so a collapse still needs 9 misses).
// The plan's walking fetch-and-place loop, parallel objectives and work zones are not built.
//
// Each level is also its own site (README "Levels"): its own yard layout (where the five piles stand,
// how far out, and where the four slots of its building go), its own gust pattern, the worker's spot,
// and its own surroundings and light (looks.ts THEMES, sets.ts). None of it touches the proof: the
// piles stay inside the 7.8 m pickup gate and the slots on the 9.5 m ring, so every haul still
// crosses the 7.8 -> 8.9 gap.
import type { LevelId } from "@/arcade3d/types";

/** Which site (and look) a level is: a garden, a street of tiny houses, a garage yard, a shop street, downtown. */
export type CraneSite = "shed" | "tinyHouse" | "garage" | "shopFront" | "tower";

export interface CraneLevel {
   /** gusts blow from this building (0 house, 1 shop, 2 tower) on */
   gustFrom: number;
   /** gust strength, m/s² */
   wind: number;
   /** a gust blows for the first second of every `gustPeriod` s of windy building time */
   gustPeriod: number;
   /** factor on the perfect / good / ok landing bands */
   band: number;
   /** factor on the stability cost of a good or ok landing (a miss stays 12) */
   stab: number;
   site: CraneSite;
   /** the piles' radius from the mast (m, inside the 7.8 pickup gate) */
   pileR: number;
   /** each pile's angle (rad from +z), indexed by piece kind (slab, pillar, wall, window, roof) */
   pileA: readonly [number, number, number, number, number];
   /** the building's four slot angles on the 9.5 m ring */
   slotA: readonly [number, number, number, number];
   /** the first gust blows towards this angle (rad from +x in the xz plane; 0 = +x) */
   windDir: number;
   /** each later gust turns this much further (pi = it flips side, pi / 2 = it comes round) */
   windTurn: number;
   /** where the worker stands (in front of the piles, inside the camera's work area) */
   worker: { x: number; z: number };
}

/** Today's yard (level 1): the module constants in rules.ts are these. */
const TODAY = {
   pileR: 7,
   pileA: [-0.45, -0.15, 0, 0.15, 0.45],
   slotA: [-0.45, -0.15, 0.15, 0.45],
   windDir: 0,
   windTurn: 0,
   worker: { x: 2.6, z: 5.35 },
} as const;

export const LEVELS: Record<LevelId, CraneLevel> = {
   // Garden Shed: today's game in a back garden.
   1: { gustFrom: 2, wind: 3, gustPeriod: 7, band: 1, stab: 1, site: "shed", ...TODAY },
   // Tiny House: a street of small houses. The piles are spread wider, the tiny house's slots sit
   // close together; the wind starts at the shop and blows from the east (-x).
   2: {
      gustFrom: 1, wind: 3, gustPeriod: 7, band: 0.97, stab: 1.05, site: "tinyHouse",
      pileR: 6.9, pileA: [-0.5, -0.25, 0, 0.25, 0.5], slotA: [-0.36, -0.12, 0.12, 0.36],
      windDir: Math.PI, windTurn: 0, worker: { x: 1.3, z: 4.95 },
   },
   // Garage: two workstations, slabs and pillars in the left yard, walls and windows in the right one,
   // roof caps in the middle; the garage is wide (slots far apart); gusts come in across the yard.
   3: {
      gustFrom: 1, wind: 3.25, gustPeriod: 7, band: 0.95, stab: 1.1, site: "garage",
      pileR: 7.1, pileA: [-0.5, -0.33, 0, 0.33, 0.5], slotA: [-0.5, -0.2, 0.2, 0.5],
      windDir: Math.PI * 0.75, windTurn: 0, worker: { x: -1.6, z: 5.2 },
   },
   // Shop Front: the piles alternate sides (every new material is a long swing across the street) and
   // the crosswind flips side with every gust.
   4: {
      gustFrom: 0, wind: 3.25, gustPeriod: 7, band: 0.93, stab: 1.1, site: "shopFront",
      pileR: 7.2, pileA: [0.42, -0.42, 0.14, -0.14, 0], slotA: [-0.42, -0.14, 0.14, 0.42],
      windDir: 0, windTurn: Math.PI, worker: { x: 3.6, z: 5.3 },
   },
   // Mini Tower: downtown at night. The piles stand close together, the slim tower's slots too, and
   // the gusts blow diagonally, each from the next quarter round (45°, 135°, 225°, 315°).
   5: {
      gustFrom: 0, wind: 3.5, gustPeriod: 6, band: 0.92, stab: 1.15, site: "tower",
      pileR: 7.1, pileA: [-0.36, -0.18, 0, 0.18, 0.36], slotA: [-0.3, -0.1, 0.1, 0.3],
      windDir: Math.PI / 4, windTurn: Math.PI / 2, worker: { x: 3.2, z: 4.9 },
   },
};
