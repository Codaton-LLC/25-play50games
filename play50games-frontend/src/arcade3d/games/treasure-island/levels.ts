// Treasure Island's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One island, five configurations. Level 1 is today's game and must never change: 5 treasures,
// 90 s, tide 70 → 90 s down to shore 0.75, treasures 6 m apart, ellipse 14 × 11, route band 38–56.
// Those numbers are the rules.ts constants; levels.test.ts pins them and replays createRun.
//
// Ordering (flag at merge): the backlog wanted today's 5-treasure / 90 s game on level 4 and a
// 2-treasure / 150 s beach on level 1. That re-order is not applied. rules.test.ts pins
// meta.scoring to today's 2060 / 8500–92000 window and cannot be edited, levels[0] has to equal
// that window, and a 150 s clock does not fit it. Fewer treasures would also score under level 1.
// Levels 2–5 are harder variants of today's island. The plan's clue → map piece → final chest,
// blocked paths and rope bridge are not built (a win is still the Nth dig). Sunset stays.
//
// The plan's lower final shore (0.65) is not used either: the dock start is at rho 0.836, and a
// final shore under about 0.72 puts that start underwater, so the flood fill rejects every island.
// Pressure is the earlier tide. The clock stays 90 s, so a harder level never scores under level 1.
import type { LevelId } from "@/arcade3d/types";

export interface IslandLevel {
   /** treasures to dig. Level 1 is TREASURE_COUNT. */
   treasures: number;
   /** the shell's clock (ms). Every level is DURATION_MS: the plan's 180–300 s clocks do not fit the proven window. */
   durationMs: number;
   /** shore stays 1 until this second. Level 1 is TIDE.startS. */
   tideStartS: number;
   /** shore reaches finalShore at this second, then holds. Level 1 is TIDE.endS. */
   tideEndS: number;
   /** shoreline rho at the end of the rise. Every level is TIDE.finalShore (see the note above). */
   finalShore: number;
   /** metres between treasure spots. Level 1 is SPACING.treasures. */
   spacing: number;
   /** island ellipse semi-axis, east (m). Level 1 is ISLAND.rx. */
   rx: number;
   /** island ellipse semi-axis, south (m). Level 1 is ISLAND.rz. */
   rz: number;
   /** fairness band on the ideal route (m), centre to centre. Level 1 is IDEAL_ROUTE. */
   routeMin: number;
   routeMax: number;
}

export const LEVELS: Record<LevelId, IslandLevel> = {
   // today's game. Starter Beach is the built island, not the plan's 2-treasure beach.
   1: {
      treasures: 5, durationMs: 90_000, tideStartS: 70, tideEndS: 90, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 38, routeMax: 56,
   },
   // Palm Grove: the same island. The tide turns 10 s sooner and finishes at 80 s (no blocked path).
   2: {
      treasures: 5, durationMs: 90_000, tideStartS: 60, tideEndS: 80, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 38, routeMax: 56,
   },
   // Rocky Cove: a sixth treasure. Measured ideal routes of placed islands sit in 40–49 m.
   3: {
      treasures: 6, durationMs: 90_000, tideStartS: 55, tideEndS: 75, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 40, routeMax: 56,
   },
   // Jungle Interior: the same six, and the tide turns another 5 s sooner.
   4: {
      treasures: 6, durationMs: 90_000, tideStartS: 50, tideEndS: 70, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 40, routeMax: 56,
   },
   // Pirate Peak: wider island, treasures 5 m apart, the earliest tide. The plan's 300 s clock is not used.
   // Measured ideal routes sit in 37–50 m.
   5: {
      treasures: 6, durationMs: 90_000, tideStartS: 45, tideEndS: 65, finalShore: 0.75,
      spacing: 5, rx: 17, rz: 11, routeMin: 37, routeMax: 56,
   },
};
