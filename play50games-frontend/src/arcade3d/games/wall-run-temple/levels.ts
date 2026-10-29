// Wall Run Temple's five levels: pure data. One cliff temple and five configurations of the same verb
// (wall-run, kick, whip). course.ts places each level's walls, columns and pads.
import type { LevelId } from "@/arcade3d/types";

export interface WallLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** level 5: Umbra; the win is his defeat at the top glyph */
   boss: boolean;
}

export const LEVELS: Record<LevelId, WallLevel> = {
   1: { id: 1, name: "Training Wall", durationMs: 150_000, starTargetMs: 60_000, boss: false },
   2: { id: 2, name: "Double Wall", durationMs: 180_000, starTargetMs: 80_000, boss: false },
   3: { id: 3, name: "Column Hall", durationMs: 210_000, starTargetMs: 100_000, boss: false },
   4: { id: 4, name: "Broken Temple", durationMs: 240_000, starTargetMs: 120_000, boss: false },
   5: { id: 5, name: "Master Wall Run", durationMs: 300_000, starTargetMs: 150_000, boss: true },
};
