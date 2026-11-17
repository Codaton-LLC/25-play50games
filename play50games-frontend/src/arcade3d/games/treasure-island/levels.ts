// Treasure Island's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// Five islands. Level 1 is today's seeded island and must never change: 5 treasures, 90 s, tide
// 70 -> 90 s down to shore 0.75, treasures 6 m apart, ellipse 14 x 11, route band 38-56 (the rules.ts
// constants; levels.test.ts pins them and replays createRun). Levels 2-5 are their own maps (maps.ts):
// Palm Grove (a stream, two bridges, a fallen log on one), Rocky Cove (a ravine with the only rope
// bridge, tide pools, cliffs, a sea cave), Jungle Interior (foliage walls, vine gates, the temple),
// Pirate Peak (the hill, the wreck, cannons, the summit chest behind a rockfall). Levels 3-5 play a
// chain: a clue, map pieces, then the final chest, which the detector senses only once the map is whole.
//
// Every level keeps its treasure count, spacing, clock and route band, so the limit proof (README
// "Levels") and meta.scoring stay as they were: walls, gates and the locked chest only make a route
// longer, never shorter than the band's floor. The backlog's re-order (a 2-treasure / 150 s beach as
// level 1) is not applied: rules.test.ts pins meta.scoring to today's window. The plan's lower final
// shore (0.65) is not used either: the dock start is at rho 0.836 and would be under water.
import type { LevelId } from "@/arcade3d/types";
import { MAP_2, MAP_3, MAP_4, MAP_5, type IslandMap } from "./maps";

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
   /** the level's own map (maps.ts); level 1 has none: today's seeded island */
   map?: IslandMap;
}

export const LEVELS: Record<LevelId, IslandLevel> = {
   // today's game. Starter Beach is the built island, not the plan's 2-treasure beach.
   1: {
      treasures: 5, durationMs: 90_000, tideStartS: 70, tideEndS: 90, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 38, routeMax: 56,
   },
   // Palm Grove: the grove map. The tide turns 10 s sooner and is in by 80 s.
   2: {
      treasures: 5, durationMs: 90_000, tideStartS: 60, tideEndS: 80, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 38, routeMax: 56, map: MAP_2,
   },
   // Rocky Cove: a sixth treasure, the clue chain, the ravine and its rope bridge.
   3: {
      treasures: 6, durationMs: 90_000, tideStartS: 55, tideEndS: 75, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 40, routeMax: 56, map: MAP_3,
   },
   // Jungle Interior: two vine gates, and the tide turns another 5 s sooner.
   4: {
      treasures: 6, durationMs: 90_000, tideStartS: 50, tideEndS: 70, finalShore: 0.75,
      spacing: 6, rx: 14, rz: 11, routeMin: 40, routeMax: 56, map: MAP_4,
   },
   // Pirate Peak: the wider island, treasures 5 m apart, the earliest tide, the chest on the summit.
   // The plan's 300 s clock is not used.
   5: {
      treasures: 6, durationMs: 90_000, tideStartS: 45, tideEndS: 65, finalShore: 0.75,
      spacing: 5, rx: 17, rz: 11, routeMin: 37, routeMax: 56, map: MAP_5,
   },
};
