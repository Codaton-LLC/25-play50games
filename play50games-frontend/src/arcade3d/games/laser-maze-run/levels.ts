// Laser Maze Run's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One laser vault and five configurations of the same verb (THREAD THE BEAMS, the card): a run of
// laser zones down a corridor of rooms, each crossed by timing, a jump or a switch. course.ts builds
// each level's zones; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface LaserLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the card's target window (ms): the run clock's cap (reaching it ends the run "timeup", unranked); also the time base */
   durationMs: number;
   /** the card's laser zones to cross */
   zones: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** level 5: the Vault Core */
   boss: boolean;
}

export const LEVELS: Record<LevelId, LaserLevel> = {
   1: { id: 1, name: "Static Lasers", durationMs: 75_000, zones: 3, starTargetMs: 25_000, boss: false },
   2: { id: 2, name: "Moving Lasers", durationMs: 90_000, zones: 4, starTargetMs: 35_000, boss: false },
   3: { id: 3, name: "Cross Grid", durationMs: 105_000, zones: 5, starTargetMs: 45_000, boss: false },
   4: { id: 4, name: "Fast Maze", durationMs: 120_000, zones: 6, starTargetMs: 55_000, boss: false },
   5: { id: 5, name: "Laser Master", durationMs: 150_000, zones: 8, starTargetMs: 110_000, boss: true },
};
