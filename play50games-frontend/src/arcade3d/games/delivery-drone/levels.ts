// Delivery Drone's five levels: pure data, no React (docs/arcade-levels.md §6.3).
// Level 1 is today's 12-delivery route, unchanged (dev game, but rules.test.ts and the
// approved limits pin that route). Levels 2-5 stack the plan's hazard knobs on top of it
// and add deliveries, so a harder level is worth at least as many points. Same city,
// same assets. Night lighting and colliding traffic are not in the built game: level 5
// keeps the day sky and uses pigeons as the only moving hazard.
import type { LevelId } from "@/arcade3d/types";

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
}

export const LEVELS: Record<LevelId, DroneLevel> = {
   // today's game
   1: {
      count: 12, bands: [4, 4, 4], ceiling: 180, towers: 8, padRadius: 1.25,
      windFrom: 60, windAccel: 1.5,
      pigeons: 6, pigeonInitial: 2, pigeonMiddle: 4, pigeonMiddleFrom: 60, pigeonFinalFrom: 120,
      fragileFrom: 8, fragilePrecision: 40, drain: 1, battery: 100,
   },
   // tighter pads, wind and the second pigeon wave a quarter-minute sooner, one extra near drop
   2: {
      count: 13, bands: [5, 4, 4], ceiling: 200, towers: 9, padRadius: 1.125,
      windFrom: 45, windAccel: 1.5,
      pigeons: 6, pigeonInitial: 2, pigeonMiddle: 4, pigeonMiddleFrom: 45, pigeonFinalFrom: 110,
      fragileFrom: 8, fragilePrecision: 40, drain: 1, battery: 100,
   },
   // two extra birds, and both the flock and the wind arrive at 30 s
   3: {
      count: 14, bands: [5, 5, 4], ceiling: 220, towers: 10, padRadius: 1.125,
      windFrom: 30, windAccel: 2,
      pigeons: 8, pigeonInitial: 3, pigeonMiddle: 5, pigeonMiddleFrom: 30, pigeonFinalFrom: 80,
      fragileFrom: 7, fragilePrecision: 40, drain: 1, battery: 100,
   },
   // fragile cargo, gusts of 2.5 and a faster drain; the battery cap rises so a clean route still fits
   4: {
      count: 15, bands: [5, 5, 5], ceiling: 240, towers: 10, padRadius: 1,
      windFrom: 30, windAccel: 2.5,
      pigeons: 8, pigeonInitial: 3, pigeonMiddle: 6, pigeonMiddleFrom: 30, pigeonFinalFrom: 70,
      fragileFrom: 5, fragilePrecision: 50, drain: 1.25, battery: 160,
   },
   // densest route. Day look on purpose: fog and sky are fixed, and lighting is the day preset only
   5: {
      count: 16, bands: [6, 5, 5], ceiling: 270, towers: 11, padRadius: 1,
      windFrom: 20, windAccel: 2.5,
      pigeons: 8, pigeonInitial: 4, pigeonMiddle: 6, pigeonMiddleFrom: 20, pigeonFinalFrom: 60,
      fragileFrom: 4, fragilePrecision: 50, drain: 1.5, battery: 230,
   },
};
