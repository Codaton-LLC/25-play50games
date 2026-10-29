// Color Door Sprint's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One Hall of Doors, five configurations of the same verb (READ AND COMMIT, the design card): an
// auto-run corridor along -z, a door wall every 35-45 m, a rule lamp ahead of each wall, doors that
// lock 0.6 s before impact. halls.ts builds each level's walls and props from these numbers.
import type { LevelId } from "@/arcade3d/types";

export interface DoorLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the auto-run speed (m/s): the card's 10 m/s on level 1 rising to 18 m/s on level 5 */
   speed: number;
   /** door lanes across the hall (2 to 5) */
   lanes: number;
   /** door walls (level 5: the warm-up walls before Flicker; his arena adds its own) */
   walls: number;
   /** the third star: the submitted time at or under this (ms) */
   starTargetMs: number;
   /** level 5: Flicker, the Fire Spirit */
   boss: boolean;
}

export const LEVELS: Record<LevelId, DoorLevel> = {
   1: { id: 1, name: "Two Doors", durationMs: 90_000, speed: 10, lanes: 2, walls: 8, starTargetMs: 34_000, boss: false },
   2: { id: 2, name: "Three Doors", durationMs: 110_000, speed: 12, lanes: 3, walls: 10, starTargetMs: 33_000, boss: false },
   3: { id: 3, name: "Fake Door", durationMs: 130_000, speed: 14, lanes: 3, walls: 12, starTargetMs: 33_000, boss: false },
   4: { id: 4, name: "Fast Gates", durationMs: 150_000, speed: 16, lanes: 5, walls: 14, starTargetMs: 33_000, boss: false },
   5: { id: 5, name: "Door Sprint Master", durationMs: 240_000, speed: 18, lanes: 4, walls: 5, starTargetMs: 70_000, boss: true },
};
